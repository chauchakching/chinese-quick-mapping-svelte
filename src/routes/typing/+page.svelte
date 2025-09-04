<script lang="ts">
  import { browser } from '$app/environment';
  import type { NormalizedSnippetsPayload, SnippetSourceMeta } from '$lib/types';
  import {
    calculateCPM,
    calculateTypingProgress,
    createInitialTypingState,
    getCharacterDisplayState,
    processTypingInput,
    resetTypingState,
    shuffle,
    chineseToParts,
    type TypingTestState
  } from '$lib/utils';
  import { modes } from '$lib/types';
  import { quickMapping } from '$lib/mappingLoader';
  import CharDecompositionGraph from '$lib/CharDecompositionGraph.svelte';

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

  // Image toggle state
  let showCharImages = $state(true);

  // Snippet management - reactive state
  let sources: SnippetSourceMeta[] = $state([]);
  let snippets: [string, number][] = $state([]);
  let remainingIndices: number[] = $state([]);
  let currentSnippetIndex = $state(0);

  async function loadSnippets() {
    if (!browser || snippets.length) return;
    try {
      const res = await fetch('/texts/snippets.json');
      if (res.ok) {
        const data: NormalizedSnippetsPayload = await res.json();
        sources = data.sources;
        snippets = data.snippets;
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
  let cpm = $derived(
    calculateCPM(testState.completedChars, testState.startTime || 0, testState.endTime || undefined)
  );

  // Current character decode logic
  let currentChar = $derived(progress.currentChar);

  let currentCharParts = $derived(
    currentChar ? chineseToParts(quickMapping, modes.cangjie, currentChar).parts : ''
  );

  // Auto-scroll functionality
  let textDisplayElement: HTMLElement;

  // Input field reference for auto-focus
  let inputElement = $state<HTMLInputElement | undefined>(undefined);

  // Auto-scroll to current character when it changes
  $effect(() => {
    if (!textDisplayElement || !currentText || progress.currentChineseCharIndex < 0) return;

    const currentCharElement = textDisplayElement.querySelector(
      `[data-char-index="${progress.currentChineseCharIndex}"]`
    ) as HTMLElement;
    if (!currentCharElement) return;

    // Calculate if we need to scroll
    const containerRect = textDisplayElement.getBoundingClientRect();
    const charRect = currentCharElement.getBoundingClientRect();

    // If character is outside the visible area, scroll to it
    if (charRect.top < containerRect.top || charRect.bottom > containerRect.bottom) {
      currentCharElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest'
      });
    }
  });

  // Debug logging for user input
  $effect(() => {
    console.log('Current user input:', testState.userInput);
  });

  const nextText = () => {
    const wasCompleted = testState.isCompleted;

    if (debugMode) {
      // In debug mode, just reset the test state since there's only one snippet
      testState = resetTypingState();
    } else if (snippets.length) {
      pickNextSnippet();
      testState = resetTypingState();
    }

    // Auto-focus the input field only if the user clicked after completing a test
    if (wasCompleted) {
      setTimeout(() => {
        if (inputElement) {
          inputElement.focus();
        }
      }, 100);
    }
  };

  const resetTest = () => {
    testState = resetTypingState();

    // Auto-focus the input field after a short delay to ensure the UI has updated
    setTimeout(() => {
      if (inputElement) {
        inputElement.focus();
      }
    }, 100);
  };

  // Handle input changes on user interaction
  const onInput = () => {
    // Do not restrict user input; progression is based on filteredChineseText only
    testState = processTypingInput(testState, progress.filteredChineseText);
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

<section class="w-full max-w-4xl mx-auto">
  <div class="bg-white rounded-lg shadow-md p-6 mb-6 max-w-xl mx-auto">
    <!-- Character Images Toggle -->
    {#if !testState.isCompleted}
      <div class="mb-4">
        <div class="flex items-center justify-end gap-3">
          <label class="inline-flex items-center cursor-pointer">
            <span class="mr-2 text-sm font-medium text-gray-900 dark:text-gray-300">拆解圖</span>
            <input type="checkbox" bind:checked={showCharImages} class="sr-only peer" />
            <div
              class="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600 dark:peer-checked:bg-blue-600"
            ></div>
          </label>
        </div>
      </div>
    {/if}

    <!-- Current Character Decode Images -->
    {#if showCharImages && !testState.isCompleted}
      <div class="mb-2">
        <div class="flex justify-center items-center">
          <div class="bg-gray-50 p-1 rounded-lg border" style="width: 112px; height: 102px;">
            {#if currentCharParts && currentCharParts.length > 0}
              <CharDecompositionGraph
                char={currentChar}
                parts={currentCharParts}
                imageStyle="width: 80px;"
                charStyle="font-size: 14px; margin: 2px 3px;"
              />
            {/if}
          </div>
        </div>
      </div>
    {/if}

    <!-- Practice Text Display -->
    <div class="mb-2">
      <div
        bind:this={textDisplayElement}
        class="bg-gray-50 p-4 rounded-lg border text-lg leading-relaxed font-mono overflow-y-auto h-16 md:h-auto"
        style="line-height: 1.625;"
        data-testid="typing-text-display"
      >
        {#each currentText.split('') as char, i (i)}
          {@const charState = getCharacterDisplayState(i, char, progress)}
          {@const isChinese = charState.isChinese}
          {@const isCompletedChinese = charState.isCompletedChinese}
          {@const isCurrentChinese = charState.isCurrentChinese}
          <span
            class={`${
              isChinese
                ? isCompletedChinese
                  ? 'bg-green-50 text-green-700'
                  : isCurrentChinese
                    ? 'bg-blue-100 text-blue-700 animate-pulse'
                    : 'text-gray-400 opacity-60'
                : 'text-gray-400 opacity-60'
            }`}
            data-testid="typing-char"
            data-char-index={i}
            data-char-state={isChinese
              ? isCompletedChinese
                ? 'completed'
                : isCurrentChinese
                  ? 'current'
                  : 'pending'
              : 'neutral'}>{char}</span
          >
        {/each}
      </div>
    </div>

    <!-- Book Source (only when completed) -->
    {#if testState.isCompleted && currentMeta?.title}
      <div class="mb-4 text-center">
        <div class="text-sm text-gray-600 bg-gray-50 py-2 px-4 rounded-lg inline-block">
          來源：{currentMeta.title}{currentMeta.author ? `（${currentMeta.author}）` : ''}
        </div>
      </div>
    {/if}

    <!-- User Input Area (only when not completed) -->
    {#if !testState.isCompleted}
      <div class="mb-4">
        <input
          bind:this={inputElement}
          type="text"
          bind:value={testState.userInput}
          oninput={onInput}
          onfocus={onFocus}
          placeholder="開始打字..."
          class="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg font-mono text-center"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          spellcheck="false"
          data-testid="typing-input"
        />
      </div>
    {/if}

    <!-- Statistics (only during typing) -->
    {#if !testState.isCompleted}
      <div class="flex justify-center mb-4">
        <div class="flex gap-6 text-sm text-gray-600" data-testid="typing-stats">
          <span>速度: <span class="font-medium text-gray-800">{cpm}</span> 字/分鐘</span>
        </div>
      </div>
    {/if}

    <!-- Completion Message -->
    {#if testState.isCompleted}
      <div
        class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4"
        data-testid="completion-message"
      >
        <div class="flex items-center">
          <img src="/icons/check.svg" alt="完成" class="h-5 w-5 mr-2" />
          <span class="font-medium">完成！</span>
        </div>
        <div class="mt-3 grid grid-cols-3 gap-4 text-sm">
          <div class="text-center">
            <div class="text-gray-600 text-xs mb-1">速度</div>
            <div class="font-medium text-gray-800">{cpm} 字/分鐘</div>
          </div>
          <div class="text-center">
            <div class="text-gray-600 text-xs mb-1">用時</div>
            <div class="font-medium text-gray-800">
              {testState.startTime && testState.endTime
                ? Math.round((testState.endTime - testState.startTime) / 1000)
                : 0} 秒
            </div>
          </div>
          <div class="text-center">
            <div class="text-gray-600 text-xs mb-1">字數</div>
            <div class="font-medium text-gray-800">{progress.filteredChineseText.length} 字</div>
          </div>
        </div>
      </div>
    {/if}

    <!-- Control Buttons -->
    <div class="flex flex-row gap-3 justify-center">
      <button
        onclick={resetTest}
        class="flex items-center justify-center px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
        data-testid="reset-button"
      >
        <img src="/icons/refresh.svg" alt="重置" class="h-4 w-4 mr-2" style="filter: invert(1);" />
        重新開始
      </button>

      <button
        onclick={nextText}
        class="flex items-center justify-center px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        data-testid="next-text-button"
      >
        <img
          src="/icons/arrow-right.svg"
          alt="下一個"
          class="h-4 w-4 mr-2"
          style="filter: invert(1);"
        />
        {debugMode ? '重新開始' : '下一個文本'}
      </button>
    </div>
  </div>
</section>
