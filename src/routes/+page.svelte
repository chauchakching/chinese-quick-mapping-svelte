<script lang="ts">
  import { run } from 'svelte/legacy';

  import { browser } from '$app/environment';
  import { page } from '$app/stores';

  import { modes, type Mode } from '$lib/types';
  import { chineseToParts, updateInputHistory } from '$lib/utils';
  import quickMapping from '$lib/cj_small.json';
  import Modal from '$lib/Modal.svelte';
  import CharDecompositionGraph from '$lib/CharDecompositionGraph.svelte';
  import Message from '$lib/Message.svelte';
  import charsWithImages from '$lib/chars-with-images.json';

  const charsWithImagesSet = new Set(charsWithImages);

  const defaultText =
    '速成輸入法，或稱簡易輸入法，亦作速成或簡易，為倉頡輸入法演化出來的簡化版本。';

  let copyResultMessage: { open: () => void } | undefined = $state();

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

  // auto select text when init
  run(() => {
    if (textarea) {
      textarea.focus();
      textarea.select();
    }
  });

  // 速成/倉頡
  let mode: Mode = $state(modes.quick);

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

  let modalVisible = $state(false);
  let modalChar = $state('速');

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
        alt="success icon"
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
          <button
            class="flex items-center text-center block border rounded py-1 px-3 hover:bg-gray-200 shadow rounded bg-white"
            onclick={() => {
              userInputText = '';
              textarea.focus();
            }}
          >
            <img src="/icons/trash.svg" alt="清空" class="h-4 w-4 mr-2" />
            <span>清空</span>
          </button>
        </div>
        <div class="flex flex-row">
          {#if typeof navigator !== 'undefined' && !!navigator?.clipboard?.writeText}
            <button
              class="text-center block border rounded mr-2 py-1 px-2 hover:bg-gray-200 shadow rounded bg-white"
              onclick={() => {
                navigator.clipboard.writeText(window.location.href);
                copyResultMessage.open();
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
    <div>
      <div class="flex flex-col sm:flex-row items-stretch">
        <div class="flex-1 p-2 border rounded-t sm:rounded-b bg-white shadow-md flex">
          <textarea
            id="user-input"
            placeholder="輸入字句"
            rows="6"
            class="w-full outline-none resize-none text-lg"
            bind:value={userInputText}
            bind:this={textarea}
          ></textarea>
        </div>
        <div
          class="flex-1 px-2 pt-3 pb-1 border-l border-r border-b sm:border-0 rounded-b sm:rounded-t sm:ml-4 flex content-start flex-wrap bg-white shadow-md relative"
          data-testid="char-box-container"
        >
          {#each charBoxItems as { ch, parts }, i (i)}
            {@const clickable = charsWithImagesSet.has(ch)}
            <button
              class={`flex flex-col items-center mx-1 mb-2 px-2.5 py-1.5 ${
                clickable
                  ? 'hover:bg-gray-100 border rounded-lg shadow-sm cursor-pointer'
                  : 'cursor-default'
              }`}
              data-testid="char-box"
              data-box-char={ch}
              onclick={() => clickable && openCharModal(ch)}
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
  <Modal
    visible={modalVisible}
    onClose={() => {
      modalVisible = false;
    }}
  >
    <div class="w-full my-12 mx-12">
      <CharDecompositionGraph
        char={modalChar}
        parts={chineseToParts(quickMapping, modes.cangjie, modalChar).parts}
      />
    </div>
  </Modal>
</section>
