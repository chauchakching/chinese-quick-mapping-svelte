<script context="module" lang="ts">
  export const prerender = true;
</script>

<script lang="ts">
  import { browser } from '$app/environment';
  import { page } from '$app/stores';

  import { modes, type Mode } from '$lib/types';
  import { chineseToParts, updateInputHistory } from '$lib/utils';
  import quickMapping from '$lib/ChineseQuickMappingSmall.json';
  import Modal from '$lib/Modal.svelte';
  import CharDecompositionGraph from '$lib/CharDecompositionGraph.svelte';
  import Message from '$lib/Message.svelte';
  import charsWithImages from '$lib/chars-with-images.json';

  const charsWithImagesSet = new Set(charsWithImages);

  const defaultText =
    '速成輸入法，或稱簡易輸入法，亦作速成或簡易，為倉頡輸入法演化出來的簡化版本。';

  let copyResultMessage: any;

  const setQueryParam = (key: string, value: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set(key, value);
    window.history.pushState(null, '', url.toString());
  };

  // Text to convert
  // On mount, use query param "q" to set text
  let userInputText = $page.url.searchParams.get('q') || defaultText;

  // on text change, update query param "q"
  $: if (userInputText !== defaultText && typeof window !== 'undefined') {
    setQueryParam('q', userInputText);
  }

  // dom
  let textarea: any;

  // auto select text when init
  $: if (textarea) {
    textarea.focus();
    textarea.select();
  }

  // 速成/倉頡
  let mode: Mode = modes.quick;

  $: charBoxItems = userInputText.split('').map((char) => {
    const { ch, parts } = chineseToParts(quickMapping, mode, char);
    return { ch, parts };
  });

  let inputHistory: string[] = browser
    ? JSON.parse(localStorage.getItem('inputHistory') || '[]')
    : [];

  // update input history on user input change (ignore default text)
  let inputChanged = false;
  $: inputChanged = inputChanged || userInputText !== defaultText;
  $: if (inputChanged) {
    inputHistory = updateInputHistory(userInputText, inputHistory);
  }

  // save input history to local storage
  $: if (browser) {
    localStorage.setItem('inputHistory', JSON.stringify(inputHistory));
  }

  let modalVisible = false;
  let modalChar = '速';

  const openCharModal = (ch: string) => {
    modalChar = ch;
    modalVisible = true;
  };
</script>

<svelte:head>
  <title>速成查字</title>
</svelte:head>

<section>
  <Message bind:ele={copyResultMessage}>
    <div class="flex justify-center items-center">
      <img
        src="/icons/check.svg"
        alt="複製連結"
        class="h-4 w-4 mr-2 text-green-500"
        style="filter: invert(59%) sepia(70%) saturate(487%) hue-rotate(89deg) brightness(90%) contrast(94%)"
      />
      <span>已複製連結</span>
    </div>
  </Message>
  <div>
    <div>
      <div class="flex flex-row justify-between mb-4">
        <div class="flex flex-row">
          <div class="flex-0 w-20 -mr-4">
            <button
              class={`text-center block border rounded py-1 px-4 hover:bg-gray-200 shadow rounded bg-white`}
              on:click={(e) => {
                userInputText = '';
                textarea.focus();
              }}
            >
              清空
            </button>
          </div>
        </div>
        <div class="flex flex-row">
          {#if typeof navigator !== 'undefined' && !!navigator?.clipboard?.writeText}
            <button
              class={`text-center block border rounded mr-2 py-1 px-2 hover:bg-gray-200 shadow rounded bg-white`}
              on:click={(e) => {
                navigator.clipboard.writeText(window.location.href);
                copyResultMessage.open();
              }}
            >
              <img src="/icons/link.svg" alt="複製連結" class="h-4 w-4" />
            </button>
          {/if}
          <div class="flex-0 w-20 -mr-4">
            <button
              class="text-center block border border-slate-300 py-1 px-4 text-white shadow bg-slate-500 hover:bg-slate-700 rounded-l"
              on:click={() => (mode = modes.quick)}
            >
              速成
            </button>
          </div>
          <div class="flex-0 w-20 -mr-3">
            <button
              class={`text-center block border border-slate-300 py-1 px-4 shadow bg-white hover:bg-gray-200 rounded-r`}
              on:click={() => (mode = modes.cangjie)}
            >
              倉頡
            </button>
          </div>
        </div>
      </div>
    </div>
    <div>
      <div class="flex flex-col sm:flex-row items-stretch">
        <div class="flex-1 p-2 border rounded-t sm:rounded-b bg-white shadow-md flex">
          <textarea
            id="user-input"
            placeholder="輸入字句"
            rows="6"
            class="w-full outline-none resize-none"
            bind:value={userInputText}
            bind:this={textarea}
          />
        </div>
        <div
          class="flex-1 px-2 pt-3 pb-1 border-l border-r border-b sm:border-0 rounded-b sm:rounded-t sm:ml-4 flex content-start flex-wrap bg-white shadow-md relative"
          data-testid="char-box-container"
        >
          {#each charBoxItems as { ch, parts }}
            {@const clickable = charsWithImagesSet.has(ch)}
            <button
              class={`flex flex-col items-center mx-1 mb-2 px-2.5 py-1.5 ${
                clickable
                  ? 'hover:bg-gray-100 border rounded-lg shadow-sm cursor-pointer'
                  : 'cursor-default'
              }`}
              data-testid="char-box"
              data-box-char={ch}
              on:click={() => clickable && openCharModal(ch)}
            >
              <div class="flex flex-row text-2xl leading-8">{ch}</div>
              <div class="flex flex-row text-xs text-gray-500">{parts}</div>
            </button>
          {/each}
        </div>
      </div>
    </div>

    <div class="flex flex-row flex-wrap items-stretch" data-testid="history-entries">
      <div class="flex-1 mt-2">
        {#each inputHistory as str (str)}
          <button
            class="bg-white hover:bg-gray-200 border mr-1 mt-2 px-2 rounded-full truncate"
            data-testid="history-entry-button"
            style="max-width: 180px;"
            on:click={() => {
              userInputText = str;
            }}
          >
            {str}
          </button>
        {/each}
      </div>
      <div class="sm:flex-1" />
    </div>
  </div>
  <Modal
    visible={modalVisible}
    onClose={() => {
      modalVisible = false;
    }}
  >
    <CharDecompositionGraph
      char={modalChar}
      parts={chineseToParts(quickMapping, modes.cangjie, modalChar).parts}
    />
  </Modal>
</section>
