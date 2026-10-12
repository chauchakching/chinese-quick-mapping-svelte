<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte';
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import type { Mode, NormalizedSnippetsPayload, SnippetSourceMeta } from '$lib/types';
  import { modes } from '$lib/types';
  import { cangjieKeyboardRows, keyToQuickUnit } from '$lib/keyToQuickUnit';
  import { quickMapping } from '$lib/mappingLoader';
  import CharDecompositionGraph from '$lib/CharDecompositionGraph.svelte';
  import { showToast } from '$lib/toast';
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
  let activeLetter = $state<string | null>(null);
  let activeTone = $state<'hit' | 'miss' | null>(null);
  let shake = $state(false);

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
    activeLetter = null;
    activeTone = null;
    shake = false;
    lastRadicalMissed = false;
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
  let currentSlot = $derived(practiceList[charIndex]);
  let steps = $derived(currentSlot ? codeSteps(quickMapping[currentSlot.char] ?? '', mode) : []);
  let radicalParts = $derived(
    currentSlot ? chineseToParts(quickMapping, modes.cangjie, currentSlot.char).parts : ''
  );
  let showKeyboard = $derived(ready && !!currentSlot && !isCompleted);

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
    const box = textDisplayElement.getBoundingClientRect();
    const rect = current.getBoundingClientRect();
    if (rect.top < box.top) textDisplayElement.scrollTop -= box.top - rect.top;
    else if (rect.bottom > box.bottom) textDisplayElement.scrollTop += rect.bottom - box.bottom;
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

  function resetTest() {
    clearProgress();
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
    const shareUrl = `${window.location.origin}/keys?snippet=${hash}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast('連結已複製到剪貼板！', 'success');
    } catch {
      showToast(`連結：${shareUrl}`, 'info', 5000);
    }
  }
</script>

<svelte:head>
  <title>拆碼練習 - 速成查字</title>
</svelte:head>

<svelte:window onkeydown={onKeyDown} />

<section class="w-full max-w-xl mx-auto {showKeyboard ? 'pb-48' : 'pb-8'}">
  <div class="bg-white rounded-lg shadow-md p-4 mb-4">
    {#if ready}
      <div class="flex flex-wrap items-center justify-center gap-3 mb-3">
        <div class="flex" role="group" aria-label="輸入法">
          <button
            type="button"
            class={`min-h-11 px-4 border border-slate-300 rounded-l shadow ${
              mode === modes.quick ? 'text-white bg-slate-500' : 'bg-white hover:bg-gray-200'
            }`}
            aria-pressed={mode === modes.quick}
            data-testid="mode-quick"
            onclick={() => setMode(modes.quick)}
          >
            速成
          </button>
          <button
            type="button"
            class={`min-h-11 px-4 border border-slate-300 rounded-r shadow -ml-px ${
              mode === modes.cangjie ? 'text-white bg-slate-500' : 'bg-white hover:bg-gray-200'
            }`}
            aria-pressed={mode === modes.cangjie}
            data-testid="mode-cangjie"
            onclick={() => setMode(modes.cangjie)}
          >
            倉頡
          </button>
        </div>
        <div class="flex" role="group" aria-label="提示">
          <button
            type="button"
            class={`min-h-11 px-4 border border-slate-300 rounded-l shadow ${
              assist ? 'text-white bg-slate-500' : 'bg-white hover:bg-gray-200'
            }`}
            aria-pressed={assist}
            data-testid="assist-on"
            onclick={() => (assist = true)}
          >
            提示
          </button>
          <button
            type="button"
            class={`min-h-11 px-4 border border-slate-300 rounded-r shadow -ml-px ${
              !assist ? 'text-white bg-slate-500' : 'bg-white hover:bg-gray-200'
            }`}
            aria-pressed={!assist}
            data-testid="assist-off"
            onclick={() => (assist = false)}
          >
            正常
          </button>
        </div>
      </div>

      {#if !isCompleted}
        <div class="flex flex-wrap justify-center gap-2 mb-3">
        <button
          type="button"
          onclick={shareCurrentSnippet}
          class="min-h-11 px-3 text-sm border border-slate-300 bg-white text-slate-700 rounded-lg hover:bg-slate-50"
          data-testid="share-button"
        >
          分享
        </button>
        <button
          type="button"
          onclick={resetTest}
          class="min-h-11 px-3 text-sm border border-slate-300 bg-white text-slate-700 rounded-lg hover:bg-slate-50"
          data-testid="reset-button"
        >
          重新開始
        </button>
        <button
          type="button"
          onclick={nextText}
          class="min-h-11 px-3 text-sm border border-slate-300 bg-white text-slate-700 rounded-lg hover:bg-slate-50"
          data-testid="next-text-button"
        >
          下一個文本
        </button>
        </div>
      {/if}
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
      {#if isCompleted}
        <div
          class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-3"
          data-testid="completion-message"
        >
          <div class="font-medium">完成！</div>
          {#if currentMeta?.title}
            <div class="mt-2 text-sm text-green-800">
              來源：{currentMeta.title}{currentMeta.author ? `（${currentMeta.author}）` : ''}
            </div>
          {/if}
          <div class="mt-3 grid grid-cols-4 gap-2 text-sm">
            <div class="text-center">
              <div class="text-gray-600 text-xs mb-1">速度</div>
              <div class="font-medium text-gray-800">{cpm}</div>
            </div>
            <div class="text-center">
              <div class="text-gray-600 text-xs mb-1">準確</div>
              <div class="font-medium text-gray-800">{accuracy ?? 0}%</div>
            </div>
            <div class="text-center">
              <div class="text-gray-600 text-xs mb-1">用時</div>
              <div class="font-medium text-gray-800">
                {startTime && endTime ? Math.round((endTime - startTime) / 1000) : 0} 秒
              </div>
            </div>
            <div class="text-center">
              <div class="text-gray-600 text-xs mb-1">字數</div>
              <div class="font-medium text-gray-800">{practiceList.length}</div>
            </div>
          </div>
        </div>

        <div class="mb-3 flex items-center justify-between gap-3" data-testid="completion-actions">
          <div class="flex gap-2">
            <button
              type="button"
              onclick={resetTest}
              class="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
              data-testid="reset-button"
              aria-label="重新開始"
            >
              <img src="/icons/refresh.svg" alt="" class="h-5 w-5" />
            </button>
            <button
              type="button"
              onclick={shareCurrentSnippet}
              class="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
              data-testid="share-button"
              aria-label="分享"
            >
              <img src="/icons/link.svg" alt="" class="h-5 w-5" />
            </button>
          </div>
          <button
            type="button"
            onclick={nextText}
            class="min-h-11 px-5 text-base font-medium text-white bg-[#423BE0] rounded-lg shadow-sm hover:brightness-110"
            data-testid="next-text-button"
          >
            下一個文本
          </button>
        </div>
      {/if}

      <div
        bind:this={textDisplayElement}
        class="bg-gray-50 p-3 rounded-lg border text-lg leading-relaxed font-mono {isCompleted
          ? ''
          : 'mb-3 h-16 overflow-y-auto'}"
        data-testid="keys-text-display"
      >
        {#each currentText.split('') as char, index (index)}
          {@const ordinal = slotOrdinal[index]}
          {@const isPractice = ordinal !== undefined}
          {@const isDone = isPractice && ordinal < charIndex}
          {@const isCurrent = isPractice && ordinal === charIndex}
          <span
            class={isDone
              ? 'bg-green-50 text-green-700'
              : isCurrent
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-400 opacity-60'}
            data-testid="keys-char"
            data-char-state={isPractice
              ? isDone
                ? 'completed'
                : isCurrent
                  ? 'current'
                  : 'pending'
              : 'neutral'}>{char}</span
          >
        {/each}
      </div>

      {#if currentSlot}
        <p class="sr-only" aria-live="polite">
          {currentSlot.char}，已輸入 {step} / {steps.length}{activeTone === 'miss' ? '，不對' : ''}
        </p>

        <div class="mb-3 flex justify-center" data-testid="keys-stage">
          <div class="w-52 rounded-lg border border-gray-200 bg-gray-50 p-4" data-testid="keys-graph">
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
    class="fixed inset-x-0 bottom-0 z-20 bg-[#d1d4da] px-1 pt-1.5 pb-[max(0.4rem,env(safe-area-inset-bottom))]"
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
