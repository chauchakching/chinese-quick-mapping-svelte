<script lang="ts">
  import { browser } from '$app/environment';
  import { 
    shuffle,
    type TypingTestState, 
    createInitialTypingState, 
    resetTypingState, 
    processTypingInput,
    calculateCPM,
    calculateAccuracy
  } from '$lib/utils';
  import type { NormalizedSnippetsPayload, SnippetSourceMeta } from '$lib/types';
  
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
        testState = resetTypingState(testState);
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
  let currentSnippet = $derived(snippets.length ? snippets[currentSnippetIndex] : undefined);
  let currentText = $derived(currentSnippet ? getText(currentSnippet) : '');
  let currentMeta = $derived(currentSnippet ? getMeta(currentSnippet) : undefined);
  let currentChar = $derived(currentText[testState.completedChars] || '');
  let accuracy = $derived(calculateAccuracy(testState.completedChars, testState.totalErrors));
  let cpm = $derived(calculateCPM(testState.completedChars, testState.startTime || 0, testState.endTime || undefined));
  

  
  const nextText = () => {
    if (snippets.length) {
      pickNextSnippet();
      testState = resetTypingState(testState);
    }
  };
  
  const resetTest = () => {
    testState = resetTypingState(testState);
  };
  
  // Handle input changes on user interaction
  const onInput = () => {
    testState = processTypingInput(testState, currentText);
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
  <div class="bg-white rounded-lg shadow-md p-6 mb-6">
    <!-- Practice Text Display -->
    <div class="mb-6">
      <h3 class="text-lg font-medium text-gray-700 mb-2">練習文本：</h3>
      <div class="bg-gray-50 p-4 rounded-lg border text-lg leading-relaxed font-mono" data-testid="typing-text-display">
        {#each currentText.split('') as char, i}
          {@const isCompleted = i < testState.completedChars || (i >= testState.completedChars && i < testState.completedChars + testState.userInput.length && testState.userInput[i - testState.completedChars] === char)}
          {@const allTypedMatch = testState.userInput.split('').every((inputChar, idx) => inputChar === currentText[testState.completedChars + idx])}
          {@const currentPosition = allTypedMatch ? testState.completedChars + testState.userInput.length : testState.completedChars}
          {@const isCurrent = i === currentPosition}
          <span 
            class={`${
              isCompleted
                ? 'bg-green-50 text-green-700' 
                : isCurrent 
                  ? 'bg-blue-100 text-blue-700 animate-pulse' 
                  : 'text-gray-400 opacity-60'
            }`}
            data-testid="typing-char"
            data-char-index={i}
            data-char-state={isCompleted ? 'completed' : isCurrent ? 'current' : 'pending'}
          >{char}</span>
        {/each}
      </div>
    </div>
    
    <!-- User Input Area -->
    <div class="mb-4">
      <input
        type="text"
        bind:value={testState.userInput}
        oninput={onInput}
        placeholder={testState.isCompleted ? "已完成！" : "開始打字..."}
        class="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg font-mono text-center"
        disabled={testState.isCompleted}
        autocomplete="off"
        autocorrect="off"
        autocapitalize="off"
        spellcheck="false"
        data-testid="typing-input"
      />
    </div>
    
    <!-- Statistics -->
    <div class="flex justify-center mb-4">
      <div class="flex gap-6 text-sm text-gray-600" data-testid="typing-stats">
        <span>速度: <span class="font-medium text-gray-800">{cpm}</span> 字/分鐘</span>
      </div>
    </div>
    
    <!-- Completion Message -->
    {#if testState.isCompleted}
      <div class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4" data-testid="completion-message">
        <div class="flex items-center">
          <img src="/icons/check.svg" alt="完成" class="h-5 w-5 mr-2" />
          <span class="font-medium">恭喜完成！</span>
        </div>
        <div class="mt-2 text-sm">
          準確度: {Math.round(accuracy)}% | 速度: {cpm} 字/分鐘 | 
          用時: {testState.startTime && testState.endTime ? Math.round((testState.endTime - testState.startTime) / 1000) : 0} 秒 | 
          錯誤: {testState.totalErrors} 次
        </div>
        {#if currentMeta?.title || currentMeta?.author}
          <div class="mt-2 text-xs text-gray-700">
            來源：{currentMeta?.title}{currentMeta?.author ? `（${currentMeta.author}）` : ''}
          </div>
        {/if}
      </div>
    {/if}
    
    <!-- Control Buttons -->
    <div class="flex flex-col sm:flex-row gap-3 justify-center">
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
        下一個文本
      </button>
    </div>

  </div>
</section>
