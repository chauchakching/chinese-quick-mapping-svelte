<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte';
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import type { Mode, NormalizedSnippetsPayload, SnippetSourceMeta } from '$lib/types';
  import { modes } from '$lib/types';
  import { cangjieKeyboardRows, keyToQuickUnit } from '$lib/keyToQuickUnit';
  import { quickMapping } from '$lib/mappingLoader';
  import CharDecompositionGraph from '$lib/CharDecompositionGraph.svelte';
  import Modal from '$lib/Modal.svelte';
  import { showToast } from '$lib/toast';
  import charsWithImages from '$lib/chars-with-images.json';
  import {
    accuracyPercent,
    calculateCPM,
    chineseToParts,
    codeSteps,
    findSnippetByHash,
    getColor,
    letterFromKeyCode,
    practiceSlots,
    preloadCharacterImage,
    shuffle,
    simpleHash,
    stepColorIndex
  } from '$lib/utils';

  const charsWithImagesSet = new Set(charsWithImages);
  const inputModeKey = 'inputMode';
  const assistKey = 'keyPracticeAssist';
  const feedbackMs = 400;
  const settleMs = 500;

  let sources: SnippetSourceMeta[] = $state([]);
  let snippets: [string, number][] = $state([]);
  let remainingIndices: number[] = $state([]);
  let currentSnippetIndex = $state(0);
  let isSpecificSnippet = $state(false);
  let loadError = $state('');

  let mode: Mode = $state(modes.quick);
  let assist = $state(true);
  let persist = $state(false);

  let step = $state(0);
  let charIndex = $state(0);
  let attempts = $state(0);
  let hits = $state(0);
  let completedChars = $state(0);
  let startTime = $state<number | null>(null);
  let endTime = $state<number | null>(null);
  let ended = $state(false);
  let activeLetter = $state<string | null>(null);
  let activeTone = $state<'hit' | 'miss' | null>(null);
  let shake = $state(false);
  let oneShotFlags = $state<boolean[]>([]);
  let detailChar = $state<string | null>(null);
  let charHadMiss = false;

  let flashTimer: ReturnType<typeof setTimeout> | null = null;
  let advanceTimer: ReturnType<typeof setTimeout> | null = null;
  let lastRadicalMissed = false;

  onDestroy(clearAdvance);

  onMount(() => {
    const storedMode = localStorage.getItem(inputModeKey);
    if (storedMode === modes.quick || storedMode === modes.cangjie) mode = storedMode;
    const storedAssist = localStorage.getItem(assistKey);
    if (storedAssist === 'normal') assist = false;
    if (storedAssist === 'assist') assist = true;
    persist = true;
  });

  $effect(() => {
    if (!persist) return;
    localStorage.setItem(inputModeKey, mode);
    localStorage.setItem(assistKey, assist ? 'assist' : 'normal');
  });

  function clearAdvance() {
    if (!advanceTimer) return;
    clearTimeout(advanceTimer);
    advanceTimer = null;
  }

  function clearProgress() {
    clearAdvance();
    step = 0;
    charIndex = 0;
    attempts = 0;
    hits = 0;
    completedChars = 0;
    startTime = null;
    endTime = null;
    ended = false;
    activeLetter = null;
    activeTone = null;
    shake = false;
    lastRadicalMissed = false;
    charHadMiss = false;
    oneShotFlags = [];
    detailChar = null;
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
    clearProgress();
  }

  async function loadSnippets() {
    if (!browser || snippets.length) return;
    try {
      const res = await fetch('/texts/snippets.json');
      if (!res.ok) {
        loadError = '文本載入失敗。請檢查網絡後重新整理。';
        return;
      }
      const data: NormalizedSnippetsPayload = await res.json();
      sources = data.sources;
      snippets = data.snippets;

      const snippetHash = $page.url.searchParams.get('snippet');
      if (snippetHash) {
        const snippetIndex = findSnippetByHash(snippets, snippetHash);
        if (snippetIndex >= 0) {
          currentSnippetIndex = snippetIndex;
          isSpecificSnippet = true;
          clearProgress();
          return;
        }
      }

      initSnippetOrder();
      pickNextSnippet();
    } catch (error) {
      console.warn('Failed to load snippets:', error);
      loadError = '文本載入失敗。請檢查網絡後重新整理。';
    }
  }

  $effect(() => {
    if (browser && snippets.length === 0 && !loadError) {
      void loadSnippets();
    }
  });

  const getText = (snippet: [string, number]) => snippet[0];
  const getMeta = (snippet: [string, number]) => sources[snippet[1]];

  let currentSnippet = $derived(snippets.length ? snippets[currentSnippetIndex] : undefined);
  let currentText = $derived(currentSnippet ? getText(currentSnippet) : '');
  let currentMeta = $derived(currentSnippet ? getMeta(currentSnippet) : undefined);
  let practiceList = $derived(practiceSlots(currentText, quickMapping));
  let ready = $derived(snippets.length > 0 && !loadError);
  let isCompleted = $derived(practiceList.length > 0 && charIndex >= practiceList.length);
  let roundOver = $derived(isCompleted || ended);
  let currentSlot = $derived(practiceList[charIndex]);
  let steps = $derived(currentSlot ? codeSteps(quickMapping[currentSlot.char] ?? '', mode) : []);
  let radicalParts = $derived(
    currentSlot ? chineseToParts(quickMapping, modes.cangjie, currentSlot.char).parts : ''
  );
  let showKeyboard = $derived(ready && !!currentSlot && !roundOver);

  let litParts = $derived(
    steps.slice(0, step).map((codeStep, index) => ({
      partIndex: codeStep.partIndex,
      colorIndex: stepColorIndex(index, steps.length, mode, codeStep.partIndex)
    }))
  );
  let hintPart = $derived.by(() => {
    if (!assist || step >= steps.length) return null;
    const codeStep = steps[step];
    if (!codeStep) return null;
    return {
      partIndex: codeStep.partIndex,
      colorIndex: stepColorIndex(step, steps.length, mode, codeStep.partIndex)
    };
  });

  let slotOrdinal = $derived.by(() => {
    const ordinals: Record<number, number> = {};
    practiceList.forEach((slot, ordinal) => {
      ordinals[slot.index] = ordinal;
    });
    return ordinals;
  });

  let cpm = $derived(calculateCPM(completedChars, startTime || 0, endTime || undefined));
  let accuracy = $derived(accuracyPercent(hits, attempts));

  let textDisplayElement = $state<HTMLDivElement | undefined>(undefined);

  $effect(() => {
    const next = practiceList[charIndex + 1]?.char;
    if (next && browser) preloadCharacterImage(next);
  });

  $effect(() => {
    void charIndex;
    void currentText;
    if (!textDisplayElement) return;
    const current = textDisplayElement.querySelector('[data-char-state="current"]');
    if (!(current instanceof HTMLElement)) return;
    const lineHeight = parseFloat(getComputedStyle(textDisplayElement).lineHeight);
    if (!Number.isFinite(lineHeight) || lineHeight <= 0) return;
    const box = textDisplayElement.getBoundingClientRect();
    const rect = current.getBoundingClientRect();
    const glyphTop = rect.top - box.top + textDisplayElement.scrollTop;
    const line = Math.floor((glyphTop + rect.height / 2) / lineHeight);
    textDisplayElement.scrollTop = line * lineHeight;
  });

  function setMode(next: Mode) {
    if (next === mode) return;
    clearAdvance();
    mode = next;
    step = 0;
    lastRadicalMissed = false;
  }

  async function flash(letter: string, tone: 'hit' | 'miss') {
    activeLetter = letter;
    activeTone = tone;
    if (tone === 'miss') {
      shake = false;
      await tick();
      shake = true;
    } else {
      shake = false;
    }
    if (flashTimer) clearTimeout(flashTimer);
    flashTimer = setTimeout(() => {
      activeLetter = null;
      activeTone = null;
      shake = false;
      flashTimer = null;
    }, feedbackMs);
  }

  function finishChar() {
    clearAdvance();
    oneShotFlags = [...oneShotFlags, !charHadMiss];
    charHadMiss = false;
    lastRadicalMissed = false;
    completedChars += 1;
    if (charIndex + 1 >= practiceList.length) endTime = Date.now();
    charIndex += 1;
    step = 0;
  }

  function submitLetter(letter: string) {
    if (advanceTimer) finishChar();
    if (!showKeyboard || steps.length === 0) return;
    const expected = steps[step];
    if (!expected) return;
    if (!startTime) startTime = Date.now();
    attempts += 1;
    const correct = expected.key === letter;
    void flash(letter, correct ? 'hit' : 'miss');
    if (!correct) {
      charHadMiss = true;
      if (step === steps.length - 1) lastRadicalMissed = true;
      return;
    }
    hits += 1;
    step += 1;
    if (step < steps.length) return;
    if (!lastRadicalMissed) {
      finishChar();
      return;
    }
    advanceTimer = setTimeout(() => {
      advanceTimer = null;
      finishChar();
    }, settleMs);
  }

  function undo() {
    if (advanceTimer) {
      clearAdvance();
      if (step > 0) step -= 1;
      return;
    }
    if (!showKeyboard || step === 0) return;
    step -= 1;
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
    const target = event.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
    ) {
      return;
    }
    if (detailChar && event.key === 'Escape') {
      event.preventDefault();
      detailChar = null;
      return;
    }
    if (event.code === 'Backspace') {
      event.preventDefault();
      undo();
      return;
    }
    const letter = letterFromKeyCode(event.code);
    if (!letter) return;
    event.preventDefault();
    submitLetter(letter);
  }

  function keyClass(letter: string) {
    const face = 'shadow-[0_1px_0_rgba(0,0,0,0.28)] active:brightness-95';
    if (activeLetter !== letter || !activeTone) return `bg-white ${face}`;
    return activeTone === 'hit' ? `bg-green-200 ${face}` : `bg-red-200 ${face}`;
  }

  const radicalLabel = (letter: string) => keyToQuickUnit[letter] ?? letter;

  function endExercise() {
    if (advanceTimer) finishChar();
    if (isCompleted || ended || startTime === null) return;
    endTime = Date.now();
    ended = true;
  }

  function nextText() {
    if (isSpecificSnippet && browser) {
      const url = new URL(window.location.href);
      url.searchParams.delete('snippet');
      window.history.replaceState(null, '', url.toString());
      isSpecificSnippet = false;
      initSnippetOrder();
    }
    pickNextSnippet();
  }

  async function shareCurrentSnippet() {
    if (!currentSnippet || !browser) return;
    const hash = simpleHash(currentSnippet[0]);
    const shareUrl = `${window.location.origin}/practice?snippet=${hash}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast('連結已複製到剪貼板！', 'success');
    } catch {
      showToast(`連結：${shareUrl}`, 'info', 5000);
    }
  }
</script>

<svelte:head>
  <title>練拆碼 - 速成查字</title>
</svelte:head>

<svelte:window onkeydown={onKeyDown} />

<section
  class="practice-shell w-full max-w-xl mx-auto {showKeyboard ? 'practice-shell-keyboard' : ''}"
>
  <div class="bg-white rounded-2xl shadow-sm p-4 mb-4">
    {#if ready && !roundOver}
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
            onclick={() => setMode(modes.quick)}
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
            onclick={() => setMode(modes.cangjie)}
          >
            倉頡
          </button>
        </div>
        <button
          type="button"
          class="inline-flex h-11 shrink-0 items-center gap-1 rounded-full px-2.5 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 {assist
            ? 'hint-lit'
            : 'text-neutral-500 hover:bg-neutral-100'}"
          aria-pressed={assist}
          data-testid={assist ? 'assist-on' : 'assist-off'}
          onclick={() => (assist = !assist)}
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
          提示
        </button>
        {#if !roundOver}
          {#if startTime === null}
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
        {/if}
      </div>
    {/if}

    {#if loadError}
      <p class="text-center text-red-700 py-10" data-testid="keys-error">{loadError}</p>
    {:else if !ready}
      <p class="text-center text-gray-500 py-10" data-testid="keys-loading">載入文本…</p>
    {:else if practiceList.length === 0}
      <p class="text-center text-gray-600 py-10" data-testid="keys-empty">
        這段文本沒有可練習的字。
      </p>
    {:else}
      {#if roundOver}
        <div class="mb-4" data-testid="completion-message">
          {#if currentMeta?.title}
            <div class="text-sm text-neutral-500">
              來源：{currentMeta.title}{currentMeta.author ? `（${currentMeta.author}）` : ''}
            </div>
          {/if}
          <div class="mt-4 grid grid-cols-4 text-center">
            <div>
              <div class="text-xs text-neutral-500">速度</div>
              <div class="mt-1 text-lg font-medium leading-none text-neutral-900">{cpm}</div>
              <div class="mt-1 text-[11px] leading-none text-neutral-500">字/分鐘</div>
            </div>
            <div>
              <div class="text-xs text-neutral-500">準確</div>
              <div class="mt-1 text-lg font-medium text-neutral-900">{accuracy ?? 0}%</div>
            </div>
            <div>
              <div class="text-xs text-neutral-500">用時</div>
              <div class="mt-1 text-lg font-medium text-neutral-900">
                {startTime && endTime ? Math.round((endTime - startTime) / 1000) : 0}<span
                  class="ml-0.5 text-xs font-normal text-neutral-500">秒</span
                >
              </div>
            </div>
            <div>
              <div class="text-xs text-neutral-500">字數</div>
              <div class="mt-1 text-lg font-medium text-neutral-900">
                {isCompleted ? practiceList.length : `${completedChars}/${practiceList.length}`}
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

      <div
        class={roundOver ? 'rounded-xl border border-neutral-200 bg-neutral-50 p-3' : 'mb-2 px-1'}
        data-testid="keys-text-display"
      >
        <div
          bind:this={textDisplayElement}
          class="font-mono text-lg leading-relaxed {roundOver ? '' : 'h-[1lh] overflow-y-auto'}"
        >
          {#each currentText.split('') as char, index (index)}
            {@const ordinal = slotOrdinal[index]}
            {@const isPractice = ordinal !== undefined}
            {@const isDone = isPractice && ordinal < charIndex}
            {@const isCurrent = isPractice && !roundOver && ordinal === charIndex}
            {@const missed = roundOver && isDone && oneShotFlags[ordinal] === false}
            {@const canOpen = roundOver && isPractice}
            {@const charClass = missed
              ? 'bg-red-50 text-red-700'
              : isDone && !roundOver
                ? 'bg-green-50 text-green-700'
                : isCurrent
                  ? 'bg-blue-100 text-blue-700'
                  : roundOver && isDone
                    ? 'text-neutral-900'
                    : 'text-gray-400 opacity-60'}
            {@const charState = isPractice
              ? missed
                ? 'missed'
                : isDone
                  ? roundOver
                    ? 'clean'
                    : 'completed'
                  : isCurrent
                    ? 'current'
                    : 'pending'
              : 'neutral'}
            {#if canOpen}
              <button
                type="button"
                class="inline cursor-pointer border-0 p-0 font-[inherit] leading-[inherit] {charClass}"
                data-testid="keys-char"
                data-char-state={charState}
                onclick={() => (detailChar = char)}
              >
                {char}
              </button>
            {:else}
              <span class={charClass} data-testid="keys-char" data-char-state={charState}
                >{char}</span
              >
            {/if}
          {/each}
        </div>
      </div>

      {#if currentSlot && !roundOver}
        <p class="sr-only" aria-live="polite">
          {currentSlot.char}，已輸入 {step} / {steps.length}{activeTone === 'miss' ? '，不對' : ''}
        </p>

        <div class="mb-3 flex justify-center" data-testid="keys-stage">
          <div class="w-60 p-4" data-testid="keys-graph">
            {#if radicalParts}
              <CharDecompositionGraph
                char={currentSlot.char}
                parts={radicalParts}
                {litParts}
                {hintPart}
                pulseHint={assist}
                showLetters={false}
                dimLit
                compact
                class="block w-full"
                imageStyle="width: 100%; aspect-ratio: 96 / 68; height: auto;"
              />
            {/if}
          </div>
        </div>

        <div class="mb-3 flex h-10 justify-center gap-2" data-testid="key-slots">
          {#each steps as codeStep, index (index)}
            {@const filled = index < step}
            {@const isNext = index === step}
            {@const color = getColor(stepColorIndex(index, steps.length, mode, codeStep.partIndex))}
            <div
              class="flex h-10 w-10 items-center justify-center rounded-md border bg-white text-xl {shake &&
              isNext
                ? 'key-shake'
                : ''}"
              data-testid="key-slot"
              data-state={filled ? 'filled' : isNext ? 'next' : 'empty'}
              style={filled
                ? `color: ${color}; border-color: ${color};`
                : isNext
                  ? shake
                    ? 'border-color: #E31B36; background: #fff1f2; box-shadow: 0 0 0 3px rgba(227,27,54,0.22);'
                    : 'border-color: #423BE0; background: #eef0ff; box-shadow: 0 0 0 3px rgba(66,59,224,0.2);'
                  : 'border-color: #e5e7eb;'}
            >
              {#if filled}
                {radicalLabel(codeStep.key)}
              {/if}
            </div>
          {/each}
        </div>

        <div class="flex justify-center gap-6 text-sm text-gray-600" data-testid="keys-stats">
          <span>速度: <span class="font-medium text-gray-800">{cpm}</span> 字/分鐘</span>
          <span>
            準確:
            <span class="inline-block w-10 text-center font-medium text-gray-800">
              {accuracy === null ? '—' : `${accuracy}%`}
            </span>
          </span>
        </div>
      {/if}
    {/if}
  </div>
</section>

{#if showKeyboard}
  <div
    class="practice-keyboard fixed inset-x-0 bottom-0 z-20 bg-[#d1d4da] px-1 pt-1.5 pb-[max(0.4rem,env(safe-area-inset-bottom))]"
    data-testid="virtual-keyboard"
  >
    <div class="mx-auto grid max-w-lg grid-cols-[repeat(20,minmax(0,1fr))] gap-x-1 gap-y-1.5">
      {#each cangjieKeyboardRows[0].split('') as letter, index (letter)}
        <button
          type="button"
          class="flex h-[42px] w-full flex-col items-center justify-center rounded-[5px] touch-manipulation select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 {keyClass(
            letter
          )}"
          style="grid-column: {index * 2 + 1} / span 2; grid-row: 1"
          data-testid="key-button"
          data-letter={letter}
          aria-label="{radicalLabel(letter)} {letter}"
          onclick={() => submitLetter(letter)}
        >
          <span class="block text-[17px] leading-none text-neutral-900">{radicalLabel(letter)}</span
          >
          <span class="mt-0.5 block text-[9px] leading-none uppercase text-neutral-400"
            >{letter}</span
          >
        </button>
      {/each}
      {#each cangjieKeyboardRows[1].split('') as letter, index (letter)}
        <button
          type="button"
          class="flex h-[42px] w-full flex-col items-center justify-center rounded-[5px] touch-manipulation select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 {keyClass(
            letter
          )}"
          style="grid-column: {index * 2 + 2} / span 2; grid-row: 2"
          data-testid="key-button"
          data-letter={letter}
          aria-label="{radicalLabel(letter)} {letter}"
          onclick={() => submitLetter(letter)}
        >
          <span class="block text-[17px] leading-none text-neutral-900">{radicalLabel(letter)}</span
          >
          <span class="mt-0.5 block text-[9px] leading-none uppercase text-neutral-400"
            >{letter}</span
          >
        </button>
      {/each}
      {#each cangjieKeyboardRows[2].split('') as letter, index (letter)}
        <button
          type="button"
          class="flex h-[42px] w-full flex-col items-center justify-center rounded-[5px] touch-manipulation select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 {keyClass(
            letter
          )}"
          style="grid-column: {index * 2 + 4} / span 2; grid-row: 3"
          data-testid="key-button"
          data-letter={letter}
          aria-label="{radicalLabel(letter)} {letter}"
          onclick={() => submitLetter(letter)}
        >
          <span class="block text-[17px] leading-none text-neutral-900">{radicalLabel(letter)}</span
          >
          <span class="mt-0.5 block text-[9px] leading-none uppercase text-neutral-400"
            >{letter}</span
          >
        </button>
      {/each}
    </div>
  </div>
{/if}

{#if detailChar}
  {@const detailParts = chineseToParts(quickMapping, modes.cangjie, detailChar).parts}
  <Modal visible={true} onClose={() => (detailChar = null)}>
    <div class="w-72 max-w-[80vw] px-3 py-4" data-testid="keys-char-modal">
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

<style>
  /* Touch-first phones and tablets. A mouse or trackpad keeps the physical keyboard only. */
  .practice-shell {
    padding-bottom: 2rem;
  }

  .practice-keyboard {
    display: none;
  }

  @media (hover: none) and (pointer: coarse) {
    .practice-shell-keyboard {
      padding-bottom: 12rem;
    }

    .practice-keyboard {
      display: block;
    }
  }
</style>
