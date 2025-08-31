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
      type TypingTestState
  } from '$lib/utils';
  
  // Debug mode state
  let debugMode = $state(false);
  const debugSnippet: [string, number] = ["靜靜，了一個", 0];
  const debugSource: SnippetSourceMeta = { 
    id: "debug", 
    slug: "debug", 
    title: "Debug Mode", 
    author: "Debug", 
    snippetCount: 1 
  };

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
  let currentSnippet = $derived(debugMode ? debugSnippet : (snippets.length ? snippets[currentSnippetIndex] : undefined));
  let currentText = $derived(currentSnippet ? getText(currentSnippet) : '');
  let currentMeta = $derived(debugMode ? debugSource : (currentSnippet ? getMeta(currentSnippet) : undefined));
  // Calculate typing progress using utility functions
  let progress = $derived(calculateTypingProgress(currentText, testState.userInput));
  let cpm = $derived(calculateCPM(testState.completedChars, testState.startTime || 0, testState.endTime || undefined));
  
  // Debug logging for user input
  $effect(() => {
    console.log('Current user input:', testState.userInput);
  });

  
  const nextText = () => {
    if (debugMode) {
      // In debug mode, just reset the test state since there's only one snippet
      testState = resetTypingState();
    } else if (snippets.length) {
      pickNextSnippet();
      testState = resetTypingState();
    }
  };
  
  const resetTest = () => {
    testState = resetTypingState();
  };
  
  // Handle input changes on user interaction
  const onInput = () => {
    // Do not restrict user input; progression is based on filteredChineseText only
    testState = processTypingInput(testState, progress.filteredChineseText);
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
    <!-- Practice Text Display -->
    <div class="mb-6">
      <h3 class="text-lg font-medium text-gray-700 mb-2">練習文本：</h3>
      <div class="bg-gray-50 p-4 rounded-lg border text-lg leading-relaxed font-mono" data-testid="typing-text-display">
        {#each currentText.split('') as char, i}
          {@const charState = getCharacterDisplayState(i, char, progress)}
          {@const isChinese = charState.isChinese}
          {@const isCompletedChinese = charState.isCompletedChinese}
          {@const isCurrentChinese = charState.isCurrentChinese}
          <span 
            class={`${
              isChinese
                ? (isCompletedChinese
                    ? 'bg-green-50 text-green-700'
                    : isCurrentChinese
                      ? 'bg-blue-100 text-blue-700 animate-pulse'
                      : 'text-gray-400 opacity-60')
                : 'text-gray-400 opacity-60'
            }`}
            data-testid="typing-char"
            data-char-index={i}
            data-char-state={isChinese ? (isCompletedChinese ? 'completed' : isCurrentChinese ? 'current' : 'pending') : 'neutral'}
          >{char}</span>
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
          type="text"
          bind:value={testState.userInput}
          oninput={onInput}
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
      <div class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4" data-testid="completion-message">
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
            <div class="font-medium text-gray-800">{testState.startTime && testState.endTime ? Math.round((testState.endTime - testState.startTime) / 1000) : 0} 秒</div>
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
        <img src="/icons/arrow-right.svg" alt="下一個" class="h-4 w-4 mr-2" style="filter: invert(1);" />
        {debugMode ? '重新開始' : '下一個文本'}
      </button>
    </div>

  </div>
</section>
