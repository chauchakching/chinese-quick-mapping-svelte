<script lang="ts">
  import { onMount, untrack } from 'svelte';

  import { browser } from '$app/environment';
  import { page } from '$app/stores';

  import { modes, type Mode } from '$lib/types';
  import { chineseToParts, updateInputHistory } from '$lib/utils';
  import { quickMapping } from '$lib/mappingLoader';
  import CharDecompositionGraph from '$lib/CharDecompositionGraph.svelte';
  import { showToast } from '$lib/toast';
  import charsWithImages from '$lib/chars-with-images.json';

  const charsWithImagesSet = new Set(charsWithImages);

  const defaultText = '速成倉頡';

  const setQueryParam = (key: string, value: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set(key, value);
    window.history.pushState(null, '', url.toString());
  };

  // Text to convert
  // Initialize with query param on client if non-empty, otherwise defaultText
  let userInputText = $state(
    browser && $page.url.searchParams.get('q') ? $page.url.searchParams.get('q')! : defaultText
  );

  // on text change, update query param "q"
  $effect(() => {
    if (userInputText !== defaultText && typeof window !== 'undefined') {
      setQueryParam('q', userInputText);
    }
  });

  // dom
  let textarea: HTMLTextAreaElement | undefined = $state();

  const maxInputLines = 6;

  const fitInputHeight = () => {
    if (!textarea) return;
    const style = getComputedStyle(textarea);
    const lineHeight = parseFloat(style.lineHeight);
    const verticalPadding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    const line = Number.isFinite(lineHeight) ? lineHeight : 28;
    const pad = Number.isFinite(verticalPadding) ? verticalPadding : 0;
    const maxHeight = line * maxInputLines + pad;
    textarea.style.height = 'auto';
    const needed = textarea.scrollHeight;
    textarea.style.height = `${Math.min(needed, maxHeight)}px`;
    textarea.style.overflowY = needed > maxHeight ? 'auto' : 'hidden';
  };

  $effect(() => {
    void userInputText;
    if (!textarea) return;
    fitInputHeight();
    const onResize = () => fitInputHeight();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  });

  // 速成/倉頡
  const inputModeKey = 'inputMode';

  const isMode = (value: string | null): value is Mode =>
    value === modes.quick || value === modes.cangjie;

  let mode: Mode = $state(modes.quick);
  let persistMode = $state(false);

  onMount(() => {
    const stored = localStorage.getItem(inputModeKey);
    if (isMode(stored)) mode = stored;
    persistMode = true;

    if (textarea) {
      textarea.focus();
      textarea.select();
    }
  });

  $effect(() => {
    if (!persistMode) return;
    localStorage.setItem(inputModeKey, mode);
  });

  let hasLookupText = $derived(userInputText.trim().length > 0);

  let charBoxItems = $derived(
    userInputText.split('').map((char) => {
      const { ch, parts } = chineseToParts(quickMapping, mode, char);
      return { ch, parts };
    })
  );

  let inputHistory: string[] = $state(
    browser ? JSON.parse(localStorage.getItem('inputHistory') || '[]') : []
  );

  // update input history on user input change (ignore default text)
  $effect(() => {
    const currentText = userInputText;
    if (currentText !== defaultText) {
      inputHistory = updateInputHistory(
        currentText,
        untrack(() => inputHistory)
      );
    }
  });

  // save input history to local storage
  $effect(() => {
    if (browser) {
      localStorage.setItem('inputHistory', JSON.stringify(inputHistory));
    }
  });
</script>

<svelte:head>
  <title>速成查字</title>
</svelte:head>

<section class="w-full max-w-xl mx-auto pb-8">
  <div>
    <div class="mb-3 flex flex-nowrap items-center justify-between gap-2">
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
      {#if typeof navigator !== 'undefined' && !!navigator?.clipboard?.writeText}
        <button
          type="button"
          class="inline-flex h-11 items-center gap-1.5 rounded-full border border-neutral-300 bg-white px-3.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
          onclick={() => {
            navigator.clipboard.writeText(window.location.href);
            showToast('已複製連結', 'success');
          }}
        >
          <img src="/icons/link.svg" alt="複製連結" class="h-4 w-4" />
          <span>分享</span>
        </button>
      {/if}
    </div>
    <div class="flex flex-col gap-4">
      <div class="relative">
        <img
          src="/icons/search.svg"
          alt=""
          class="pointer-events-none absolute left-4 top-3.5 h-5 w-5"
        />
        {#if userInputText.length > 0}
          <button
            type="button"
            aria-label="清空"
            class="absolute right-0.5 top-0.5 flex h-11 w-11 items-center justify-center"
            onclick={() => {
              userInputText = '';
              textarea?.focus();
            }}
          >
            <span class="flex h-5 w-5 items-center justify-center rounded-full bg-gray-400">
              <svg viewBox="0 0 12 12" class="h-2.5 w-2.5" aria-hidden="true">
                <path
                  d="M3.2 3.2l5.6 5.6M8.8 3.2L3.2 8.8"
                  stroke="white"
                  stroke-width="1.8"
                  stroke-linecap="round"
                />
              </svg>
            </span>
          </button>
        {/if}
        <textarea
          id="user-input"
          placeholder="輸入字句"
          rows="1"
          aria-label="輸入字句"
          class={`block w-full resize-none rounded-2xl border border-neutral-200 bg-white py-2.5 pl-11 text-lg leading-7 text-gray-900 shadow-sm outline-none placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 ${
            userInputText.length > 0 ? 'pr-12' : 'pr-4'
          }`}
          bind:value={userInputText}
          bind:this={textarea}
        ></textarea>
      </div>
      {#if hasLookupText}
        {@const fewChars = charBoxItems.length <= 2}
        <div
          class="{fewChars
            ? 'flex flex-wrap justify-center'
            : 'grid grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(11rem,1fr))]'} gap-3 rounded-2xl bg-white p-4 shadow-sm"
          data-testid="char-box-container"
        >
          {#each charBoxItems as { ch, parts }, i (i)}
            {@const hasImage = charsWithImagesSet.has(ch)}
            <div
              class="flex flex-col items-center rounded-xl border border-neutral-200 bg-neutral-50 px-2 py-3 {fewChars
                ? 'w-[calc((100%-0.75rem)/2)] sm:w-64'
                : ''}"
              data-testid="char-box"
              data-box-char={ch}
            >
              <span class="sr-only">{ch}</span>
              {#if hasImage}
                {@const composition = chineseToParts(quickMapping, modes.cangjie, ch).parts}
                <CharDecompositionGraph
                  char={ch}
                  parts={composition}
                  endsOnly={mode === modes.quick}
                  class="w-full"
                  imageStyle="width: 100%; aspect-ratio: 96 / 68; height: auto;"
                  charStyle="font-size: 22px; font-weight: 700; line-height: 1.2; margin: 2px;"
                />
              {:else}
                <div class="flex flex-col items-center justify-center px-2 py-5">
                  <div class="text-5xl leading-none">{ch}</div>
                  {#if parts}
                    <div class="mt-3 text-2xl font-bold tracking-widest text-gray-800">{parts}</div>
                  {/if}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {:else}
        <div
          class="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-neutral-300 bg-white/70 px-4 py-8 text-center"
        >
          <div
            class="flex flex-col items-center rounded-xl border border-dashed border-neutral-300 px-3 py-1.5 text-gray-300"
            aria-hidden="true"
          >
            <span class="text-2xl leading-8">字</span>
            <span class="text-xs">字碼</span>
          </div>
          <p class="text-sm text-gray-500">
            輸入文字，查看{mode === modes.quick ? '速成' : '倉頡'}字碼
          </p>
        </div>
      {/if}
    </div>

    <div class="mt-3 flex flex-wrap items-center gap-2" data-testid="history-entries">
      {#each inputHistory as str (str)}
        <button
          type="button"
          class="h-9 max-w-[180px] truncate rounded-full border border-neutral-200 bg-white px-3.5 text-sm text-neutral-700 shadow-sm hover:bg-neutral-50 hover:text-neutral-950"
          data-testid="history-entry-button"
          onclick={() => {
            userInputText = str;
          }}
        >
          {str}
        </button>
      {/each}
    </div>
  </div>
</section>
