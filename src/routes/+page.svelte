<script lang="ts">
  import { onMount } from 'svelte';
  import { run } from 'svelte/legacy';

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
  // Initialize with defaultText, will update with query param in browser
  let userInputText = $state(defaultText);

  // On client-side, check for query param
  run(() => {
    if (browser) {
      const queryParam = $page.url.searchParams.get('q');
      if (queryParam) {
        userInputText = queryParam;
      }
    }
  });

  // on text change, update query param "q"
  run(() => {
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

  // auto select text when init
  run(() => {
    if (textarea) {
      textarea.focus();
      textarea.select();
    }
  });

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
  let inputChanged = $derived(userInputText !== defaultText);
  run(() => {
    if (inputChanged) {
      inputHistory = updateInputHistory(userInputText, inputHistory);
    }
  });

  // save input history to local storage
  run(() => {
    if (browser) {
      localStorage.setItem('inputHistory', JSON.stringify(inputHistory));
    }
  });

</script>

<svelte:head>
  <title>速成查字</title>
</svelte:head>

<section>
  <div>
    <div>
      <div class="mb-4 flex flex-row justify-end">
        <div class="flex flex-row">
          {#if typeof navigator !== 'undefined' && !!navigator?.clipboard?.writeText}
            <button
              class="text-center block border rounded mr-2 py-1 px-2 hover:bg-gray-200 shadow rounded bg-white"
              onclick={() => {
                navigator.clipboard.writeText(window.location.href);
                showToast('已複製連結', 'success');
              }}
            >
              <img src="/icons/link.svg" alt="複製連結" class="h-4 w-4" />
            </button>
          {/if}
          <div class="flex-0 w-20 -mr-4">
            <button
              class={`text-center block border border-slate-300 py-1 px-4 shadow rounded-l ${
                mode === modes.quick
                  ? 'text-white bg-slate-500 hover:bg-slate-700'
                  : 'bg-white hover:bg-gray-200'
              }`}
              onclick={() => (mode = modes.quick)}
            >
              速成
            </button>
          </div>
          <div class="flex-0 w-20 -mr-3">
            <button
              class={`text-center block border border-slate-300 py-1 px-4 shadow rounded-r ${
                mode === modes.cangjie
                  ? 'text-white bg-slate-500 hover:bg-slate-700'
                  : 'bg-white hover:bg-gray-200'
              }`}
              onclick={() => (mode = modes.cangjie)}
            >
              倉頡
            </button>
          </div>
        </div>
      </div>
    </div>
    <div class="flex flex-col gap-4">
      <div class="relative">
        <img
          src="/icons/search.svg"
          alt=""
          class="pointer-events-none absolute left-3.5 top-3.5 h-5 w-5"
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
          class={`block w-full resize-none rounded-lg border border-gray-300 bg-white py-2.5 pl-11 text-lg leading-7 text-gray-900 shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)] outline-none placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 ${
            userInputText.length > 0 ? 'pr-12' : 'pr-3'
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
            : 'grid grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(11rem,1fr))]'} gap-3 rounded-lg border bg-white p-3 shadow-md"
          data-testid="char-box-container"
        >
          {#each charBoxItems as { ch, parts }, i (i)}
            {@const hasImage = charsWithImagesSet.has(ch)}
            <div
              class="flex flex-col items-center rounded-lg border border-gray-300 bg-gray-50 px-2 py-3 shadow-sm {fewChars
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
          class="flex flex-col items-center gap-3 rounded-lg border border-dashed border-gray-300 bg-white/70 px-4 py-6 text-center"
        >
          <div
            class="flex flex-col items-center rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-gray-300"
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

    <div class="flex flex-row flex-wrap items-stretch" data-testid="history-entries">
      <div class="flex-1 mt-2">
        {#each inputHistory as str (str)}
          <button
            class="bg-white hover:bg-gray-200 border mr-1 mt-2 px-2 rounded-full truncate"
            data-testid="history-entry-button"
            style="max-width: 180px;"
            onclick={() => {
              userInputText = str;
            }}
          >
            {str}
          </button>
        {/each}
      </div>
      <div class="sm:flex-1"></div>
    </div>
  </div>
</section>
