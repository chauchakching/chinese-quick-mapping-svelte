<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import type { Mode, NormalizedSnippetsPayload, SnippetSourceMeta } from '$lib/types';
  import {
    calculateCPM,
    calculateTypingProgress,
    createInitialTypingState,
    getCharacterDisplayState,
    processTypingInput,
    resetTypingState,
    shuffle,
    chineseToParts,
    preloadCharacterImage,
    simpleHash,
    findSnippetByHash,
    type TypingTestState
  } from '$lib/utils';
  import { showToast } from '$lib/toast';
  import { modes } from '$lib/types';
  import { quickMapping } from '$lib/mappingLoader';
  import CharDecompositionGraph from '$lib/CharDecompositionGraph.svelte';
  import Modal from '$lib/Modal.svelte';
  import charsWithImages from '$lib/chars-with-images.json';

  const charsWithImagesSet = new Set(charsWithImages);
  const inputModeKey = 'inputMode';
  const showCharImagesKey = 'typingShowCharImages';

  // Debug mode state
  let debugMode = $state(false);
  const debugSnippet: [string, number] = ['眞靜靜，了一個', 0];
  const debugSource: SnippetSourceMeta = {
    id: 'debug',
    slug: 'debug',
    title: 'Debug Mode',
    author: 'Debug',
    snippetCount: 1
  };

  let mode: Mode = $state(modes.quick);
  let persist = $state(false);

  // Image toggle state
  let showCharImages = $state(true);
  let ended = $state(false);
  let detailChar = $state<string | null>(null);

  onMount(() => {
    const storedMode = localStorage.getItem(inputModeKey);
    if (storedMode === modes.quick || storedMode === modes.cangjie) mode = storedMode;
    const storedShowImages = localStorage.getItem(showCharImagesKey);
    if (storedShowImages === 'false') showCharImages = false;
    if (storedShowImages === 'true') showCharImages = true;
    persist = true;
  });

  $effect(() => {
    if (!persist) return;
    localStorage.setItem(inputModeKey, mode);
    localStorage.setItem(showCharImagesKey, showCharImages ? 'true' : 'false');
  });

  // Snippet management - reactive state
  let sources: SnippetSourceMeta[] = $state([]);
  let snippets: [string, number][] = $state([]);
  let remainingIndices: number[] = $state([]);
  let currentSnippetIndex = $state(0);
  let isSpecificSnippet = $state(false); // Track if current snippet was loaded via URL parameter

  async function loadSnippets() {
    if (!browser || snippets.length) return;
    try {
      const res = await fetch('/texts/snippets.json');
      if (res.ok) {
        const data: NormalizedSnippetsPayload = await res.json();
        sources = data.sources;
        snippets = data.snippets;

        // Check for snippet parameter in URL
        const snippetHash = $page.url.searchParams.get('snippet');
        if (snippetHash) {
          const snippetIndex = findSnippetByHash(snippets, snippetHash);
          if (snippetIndex >= 0) {
            currentSnippetIndex = snippetIndex;
            isSpecificSnippet = true;
            testState = resetTypingState();
            return;
          }
        }

        // Default behavior: random selection
        initSnippetOrder();
        pickNextSnippet();
        testState = resetTypingState();
      }
    } catch (e) {
      console.warn('Failed to load snippets:', e);
    }
  }

  function initSnippetOrder() {
    remainingIndices = Array.from({ length: snippets.length }, (_, i) => i);
    shuffle(remainingIndices);
  }

  function pickNextSnippet() {
    if (!snippets.length) return;
    if (remainingIndices.length === 0) initSnippetOrder();
    const idx = remainingIndices.pop();
    if (idx !== undefined) currentSnippetIndex = idx;
  }

  // Typing test state
  let testState: TypingTestState = $state(createInitialTypingState());

  const getText = (s: [string, number]) => s[0];
  const getMeta = (s: [string, number]) => sources[s[1]];
  let currentSnippet = $derived(
    debugMode ? debugSnippet : snippets.length ? snippets[currentSnippetIndex] : undefined
  );
  let currentText = $derived(currentSnippet ? getText(currentSnippet) : '');
  let currentMeta = $derived(
    debugMode ? debugSource : currentSnippet ? getMeta(currentSnippet) : undefined
  );
  // Calculate typing progress using utility functions
  let progress = $derived(calculateTypingProgress(currentText, testState.userInput));
  let roundOver = $derived(testState.isCompleted || ended);
  let cpm = $derived(
    calculateCPM(testState.completedChars, testState.startTime || 0, testState.endTime || undefined)
  );

  // Current character decode logic
  let currentChar = $derived(progress.currentChar);

  // Hover state for character decomposition preview
  let hoveredChar = $state<string>('');
  let hoverLeaveTimeout: ReturnType<typeof setTimeout> | null = null;

  // Character to display in decomposition (prioritize hovered, fallback to current)
  let displayChar = $derived(hoveredChar || currentChar);

  // Next character for preloading
  let nextChar = $derived(progress.filteredChineseText[progress.currentChinesePosition + 1]);

  let displayCharParts = $derived(
    displayChar ? chineseToParts(quickMapping, modes.cangjie, displayChar).parts : ''
  );

  // Auto-scroll functionality
  let textDisplayElement: HTMLElement;

  // Input field reference for auto-focus
  let inputElement = $state<HTMLInputElement | undefined>(undefined);

  // Auto-scroll to current character line when it changes
  $effect(() => {
    void progress.currentChineseCharIndex;
    void currentText;
    if (!textDisplayElement || !currentText || progress.currentChineseCharIndex < 0) return;

    const currentCharElement = textDisplayElement.querySelector(
      `[data-char-index="${progress.currentChineseCharIndex}"]`
    );
    if (!(currentCharElement instanceof HTMLElement)) return;

    const lineHeight = parseFloat(getComputedStyle(textDisplayElement).lineHeight);
    if (!Number.isFinite(lineHeight) || lineHeight <= 0) return;
    const box = textDisplayElement.getBoundingClientRect();
    const rect = currentCharElement.getBoundingClientRect();
    const glyphTop = rect.top - box.top + textDisplayElement.scrollTop;
    const line = Math.floor((glyphTop + rect.height / 2) / lineHeight);
    textDisplayElement.scrollTop = line * lineHeight;
  });

  // Preload next character image when it changes
  $effect(() => {
    if (nextChar && browser) {
      preloadCharacterImage(nextChar);
    }
  });

  const endExercise = () => {
    if (roundOver || testState.startTime === null) return;
    testState = {
      ...testState,
      endTime: Date.now()
    };
    ended = true;
  };

  const nextText = () => {
    const wasCompleted = roundOver;

    // If viewing a specific snippet via URL, remove query param and switch to random mode
    if (isSpecificSnippet) {
      // Remove snippet query parameter from URL
      const url = new URL(window.location.href);
      url.searchParams.delete('snippet');
      window.history.replaceState(null, '', url.toString());

      // Switch back to random selection mode
      isSpecificSnippet = false;
      initSnippetOrder(); // Initialize random order
    }

    // Normal random selection behavior
    pickNextSnippet();
    testState = resetTypingState();
    ended = false;
    detailChar = null;

    // Auto-focus the input field only if the user clicked after completing a test
    if (wasCompleted) {
      setTimeout(() => {
        if (inputElement) {
          inputElement.focus();
        }
      }, 100);
    }
  };

  const shareCurrentSnippet = async () => {
    if (!currentSnippet || !browser) return;

    const snippetText = currentSnippet[0];
    const hash = simpleHash(snippetText);
    const shareUrl = `${window.location.origin}/typing?snippet=${hash}`;

    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast('連結已複製到剪貼板！', 'success');
    } catch {
      // Fallback for older browsers - show the URL in a toast
      showToast(`連結：${shareUrl}`, 'info', 5000);
    }
  };

  // Handle input changes on user interaction
  const onInput = () => {
    // Clear any pending hover timeout and reset hover state when user starts typing
    if (hoverLeaveTimeout !== null) {
      clearTimeout(hoverLeaveTimeout);
      hoverLeaveTimeout = null;
    }
    hoveredChar = '';
    // Do not restrict user input; progression is based on filteredChineseText only
    testState = processTypingInput(testState, progress.filteredChineseText);
  };

  // Handle character hover for decomposition preview
  const onCharacterHover = (char: string, isChinese: boolean) => {
    // Clear any pending timeout to prevent flickering when moving between chars
    if (hoverLeaveTimeout !== null) {
      clearTimeout(hoverLeaveTimeout);
      hoverLeaveTimeout = null;
    }

    if (isChinese) {
      hoveredChar = char;
    }
  };

  // Handle mouse leave from character with debounce to prevent flickering
  const onCharacterLeave = () => {
    // Delay clearing hover state to allow smooth transitions between characters
    hoverLeaveTimeout = setTimeout(() => {
      hoveredChar = '';
      hoverLeaveTimeout = null;
    }, 150); // 150ms delay to bridge the gap between characters
  };

  // Handle input focus - move cursor to end for better mobile UX
  const onFocus = () => {
    if (inputElement && testState.userInput.length > 0) {
      // Small delay to ensure focus is fully established
      setTimeout(() => {
        if (inputElement) {
          // Set cursor position to end without selecting text
          inputElement.selectionStart = inputElement.value.length;
          inputElement.selectionEnd = inputElement.value.length;
        }
      }, 10);
    }
  };

  // Load snippets on mount (browser only)
  $effect(() => {
    if (browser && snippets.length === 0) {
      void loadSnippets();
    }
  });
</script>

<svelte:head>
  <title>打字練習 - 速成查字</title>
</svelte:head>

<section class="w-full max-w-xl mx-auto pb-8">
  <div class="bg-white rounded-2xl shadow-sm p-4 mb-4">
    {#if !roundOver}
      <div class="mb-4 flex flex-nowrap items-center gap-2">
        <div class="flex h-11 rounded-full bg-neutral-100 p-1" role="group" aria-label="輸入法">
          <button
            type="button"
            class="rounded-full px-3.5 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 {mode ===
            modes.quick
              ? 'bg-white text-neutral-900 shadow-sm'
              : 'text-neutral-500 hover:text-neutral-800'}"
            aria-pressed={mode === modes.quick}
            data-testid="mode-quick"
            onclick={() => (mode = modes.quick)}
          >
            速成
          </button>
          <button
            type="button"
            class="rounded-full px-3.5 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 {mode ===
            modes.cangjie
              ? 'bg-white text-neutral-900 shadow-sm'
              : 'text-neutral-500 hover:text-neutral-800'}"
            aria-pressed={mode === modes.cangjie}
            data-testid="mode-cangjie"
            onclick={() => (mode = modes.cangjie)}
          >
            倉頡
          </button>
        </div>

        <button
          type="button"
          class="inline-flex h-11 shrink-0 items-center gap-1 rounded-full px-2.5 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 {showCharImages
            ? 'hint-lit'
            : 'text-neutral-500 hover:bg-neutral-100'}"
          aria-pressed={showCharImages}
          data-testid={showCharImages ? 'assist-on' : 'assist-off'}
          onclick={() => (showCharImages = !showCharImages)}
        >
          <svg viewBox="0 0 24 24" class="hint-bulb h-5 w-5" aria-hidden="true">
            <path
              class="hint-glass"
              d="M12 2.5a5.5 5.5 0 0 0-3.2 10c.4.3.7.8.7 1.3V15h5v-1.2c0-.5.3-1 .7-1.3A5.5 5.5 0 0 0 12 2.5z"
            />
            <path
              class="hint-filament"
              d="M12 7.2v2.6"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
            />
            <path
              class="hint-base"
              d="M9.5 17.4h5M10.2 19.8h3.6"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
            />
          </svg>
          拆解圖
        </button>

        {#if testState.startTime === null}
          <button
            type="button"
            onclick={nextText}
            class="ml-auto h-11 shrink-0 px-1 text-sm font-medium text-neutral-800 hover:text-neutral-950"
            data-testid="next-text-button"
          >
            下一個
          </button>
        {:else}
          <button
            type="button"
            onclick={endExercise}
            class="ml-auto h-11 shrink-0 px-1 text-sm font-medium text-[#E31B36] hover:text-[#b9152c]"
            data-testid="end-button"
          >
            結束
          </button>
        {/if}
      </div>
    {/if}

    {#if roundOver}
      <div class="mb-4" data-testid="completion-message">
        {#if currentMeta?.title}
          <div class="text-sm text-neutral-500">
            來源：{currentMeta.title}{currentMeta.author ? `（${currentMeta.author}）` : ''}
          </div>
        {/if}
        <div class="mt-4 grid grid-cols-3 text-center">
          <div>
            <div class="text-xs text-neutral-500">速度</div>
            <div class="mt-1 text-lg font-medium leading-none text-neutral-900">{cpm}</div>
            <div class="mt-1 text-[11px] leading-none text-neutral-500">字/分鐘</div>
          </div>
          <div>
            <div class="text-xs text-neutral-500">用時</div>
            <div class="mt-1 text-lg font-medium text-neutral-900">
              {testState.startTime && testState.endTime
                ? Math.round((testState.endTime - testState.startTime) / 1000)
                : 0}<span class="ml-0.5 text-xs font-normal text-neutral-500">秒</span>
            </div>
          </div>
          <div>
            <div class="text-xs text-neutral-500">字數</div>
            <div class="mt-1 text-lg font-medium text-neutral-900">
              {testState.isCompleted
                ? progress.filteredChineseText.length
                : `${testState.completedChars}/${progress.filteredChineseText.length}`}
            </div>
          </div>
        </div>
      </div>

      <div class="mb-4 flex items-center justify-between" data-testid="completion-actions">
        <button
          type="button"
          onclick={shareCurrentSnippet}
          class="inline-flex h-11 items-center gap-1.5 rounded-full border border-neutral-300 bg-white px-3.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
          data-testid="share-button"
        >
          <img src="/icons/link.svg" alt="" class="h-4 w-4" />
          分享
        </button>
        <button
          type="button"
          onclick={nextText}
          class="h-11 rounded-full bg-[#423BE0] px-4 text-sm font-medium text-white shadow-sm hover:brightness-110"
          data-testid="next-text-button"
        >
          下一個文本
        </button>
      </div>
    {/if}

    <!-- Practice Text Display -->
    <div
      class={roundOver ? 'rounded-xl border border-neutral-200 bg-neutral-50 p-3' : 'mb-3 px-1'}
      data-testid="typing-text-display"
    >
      <div
        bind:this={textDisplayElement}
        class="font-mono text-lg leading-relaxed {roundOver ? '' : 'h-[1lh] overflow-y-auto'}"
      >
        {#each currentText.split('') as char, i (i)}
          {@const charState = getCharacterDisplayState(i, char, progress)}
          {@const isChinese = charState.isChinese}
          {@const isCompletedChinese = charState.isCompletedChinese}
          {@const isCurrentChinese = !roundOver && charState.isCurrentChinese}
          {@const isHoveredAndDisplayed = !roundOver && hoveredChar === char}
          {@const canOpen = roundOver && isChinese}
          {@const spanClass = `${
            isChinese
              ? isCompletedChinese
                ? roundOver
                  ? 'text-neutral-900'
                  : 'bg-green-50 text-green-700'
                : isCurrentChinese
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-400 opacity-60'
              : 'text-gray-400 opacity-60'
          } ${isHoveredAndDisplayed ? 'bg-yellow-100 text-yellow-800' : ''} ${isChinese ? 'cursor-pointer' : ''}`}
          {#if canOpen}
            <button
              type="button"
              class="inline cursor-pointer border-0 p-0 font-[inherit] leading-[inherit] {spanClass}"
              data-testid="typing-char"
              data-char-index={i}
              data-char-state={isCompletedChinese ? 'completed' : 'pending'}
              onclick={() => (detailChar = char)}>{char}</button
            >
          {:else}
            <span
              class={spanClass}
              role={isChinese ? 'button' : undefined}
              data-testid="typing-char"
              data-char-index={i}
              data-char-state={isChinese
                ? isCompletedChinese
                  ? 'completed'
                  : isCurrentChinese
                    ? 'current'
                    : 'pending'
                : 'neutral'}
              onmouseenter={() => onCharacterHover(char, isChinese)}
              onmouseleave={onCharacterLeave}>{char}</span
            >
          {/if}
        {/each}
      </div>
    </div>

    <!-- Current Character Decode Images (quiet stage matching /practice) -->
    {#if showCharImages && !roundOver}
      <div class="mb-3 flex justify-center">
        <div class="w-44 p-2">
          {#if displayChar && charsWithImagesSet.has(displayChar) && displayCharParts.length > 0}
            <CharDecompositionGraph
              char={displayChar}
              parts={displayCharParts}
              endsOnly={mode === modes.quick}
              compact
              class="block w-full"
              imageStyle="width: 100%; aspect-ratio: 96 / 68; height: auto;"
              charStyle="font-size: 18px; font-weight: 600; margin: 4px 3px 0;"
            />
          {:else if displayChar}
            {@const fallbackParts = chineseToParts(quickMapping, mode, displayChar).parts}
            <div class="flex flex-col items-center justify-center py-3">
              <div class="text-4xl leading-none">{displayChar}</div>
              {#if fallbackParts}
                <div class="mt-2 text-lg font-bold tracking-widest text-gray-800">
                  {fallbackParts}
                </div>
              {/if}
            </div>
          {/if}
        </div>
      </div>
    {/if}

    <!-- User Input Area (only when not completed) -->
    {#if !roundOver}
      <div class="mb-3">
        <input
          bind:this={inputElement}
          type="text"
          bind:value={testState.userInput}
          oninput={onInput}
          onfocus={onFocus}
          placeholder="開始打字..."
          class="w-full rounded-xl border border-neutral-200 bg-neutral-50/60 px-4 py-3 text-center font-mono text-lg text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/30"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          spellcheck="false"
          data-testid="typing-input"
        />
      </div>

      <!-- Statistics (only during typing) -->
      <div class="flex justify-center">
        <div class="flex gap-6 text-sm text-gray-600" data-testid="typing-stats">
          <span>速度: <span class="font-medium text-gray-800">{cpm}</span> 字/分鐘</span>
          <span>
            進度:
            <span class="font-medium text-gray-800">
              {testState.completedChars}/{progress.filteredChineseText.length}
            </span>
          </span>
        </div>
      </div>
    {/if}
  </div>
</section>

{#if detailChar}
  {@const detailParts = chineseToParts(quickMapping, modes.cangjie, detailChar).parts}
  <Modal visible={true} onClose={() => (detailChar = null)}>
    <div class="w-72 max-w-[80vw] px-3 py-4" data-testid="typing-char-modal">
      {#if charsWithImagesSet.has(detailChar)}
        <CharDecompositionGraph
          char={detailChar}
          parts={detailParts}
          endsOnly={mode === modes.quick}
          class="w-full"
          imageStyle="width: 100%; aspect-ratio: 96 / 68; height: auto;"
          charStyle="font-size: 22px; font-weight: 700; line-height: 1.2; margin: 2px;"
        />
      {:else}
        <div class="flex flex-col items-center justify-center px-2 py-5">
          <div class="text-5xl leading-none">{detailChar}</div>
          {#if detailParts}
            <div class="mt-3 text-2xl font-bold tracking-widest text-gray-800">{detailParts}</div>
          {/if}
        </div>
      {/if}
    </div>
  </Modal>
{/if}
