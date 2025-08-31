<script lang="ts">
  import { browser } from '$app/environment';
  

  
  // Snippets loaded from static/texts/snippets.json
  import type { NormalizedSnippetsPayload, SnippetSourceMeta } from '$lib/types';
  let snippets: [string, number][] = $state([]);
  let sources: SnippetSourceMeta[] = $state([]);
  let remainingIndices: number[] = $state([]); // shuffled pool of indices; pop() to avoid reuse
  let currentSnippetIndex = $state(0);

  function shuffle(arr: number[]) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
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
        resetTest();
      }
    } catch (e) {
      console.warn('Failed to load snippets:', e);
    }
  }


  let userInput = $state('');
  let completedChars = $state(0);
  let startTime = $state<number | null>(null);
  let endTime = $state<number | null>(null);
  let isCompleted = $state(false);
  let totalErrors = $state(0);
  let lastErrorChar = $state('');
  
  const getText = (s: [string, number]) => s[0];
  const getMeta = (s: [string, number]) => sources[s[1]];
  let currentText = $derived(snippets.length ? getText(snippets[currentSnippetIndex]) : '');
  let currentMeta = $derived(snippets.length ? getMeta(snippets[currentSnippetIndex]) : undefined);
  let currentChar = $derived(currentText[completedChars] || '');
  let accuracy = $derived(completedChars > 0 ? 
    ((completedChars) / (completedChars + totalErrors) * 100) : 100);
  
  // Calculate CPM (Characters Per Minute) based on matched characters and elapsed time
  let cpm = $derived.by(() => {
    if (!startTime) return 0;
    
    const currentTime = isCompleted && endTime ? endTime : Date.now();
    const elapsedTimeMinutes = (currentTime - startTime) / 60000;
    
    if (elapsedTimeMinutes === 0 || completedChars === 0) return 0;
    
    // CPM = characters completed per minute
    return Math.round(completedChars / elapsedTimeMinutes);
  });
  
  /**
   * TYPING LOGIC EXPLANATION & DESIGN RATIONALE
   * 
   * This handles character-by-character progression for Chinese typing practice.
   * The logic is designed to work naturally with Chinese Input Method Editors (IME).
   * 
   * BACKGROUND - Chinese IME Behavior:
   * - Single-radical characters (1 key) require space/enter to confirm in OS
   * - Immediate character removal interrupts this natural confirmation process
   * - Browser only sees final committed characters, not intermediate IME states
   * - Users expect to see character composition while typing
   * 
   * SOLUTION - "Next Character Confirmation" Pattern:
   * 1. User types correct character -> keep it visible in input
   * 2. User types next character -> if also correct, remove previous character
   * 3. For last character -> complete immediately (no next char to wait for)
   * 
   * EDGE CASES HANDLED:
   * - Last character: Complete immediately when typed correctly
   * - Wrong characters: Keep in input for natural correction
   * - Error tracking: Count unique mistakes per position
   * - IME composition: Never interrupt character input process
   * 
   * This maintains natural Chinese typing flow while providing clear progress feedback.
   */
  const handleInput = () => {
    // Start timing only when user starts typing (not just when component loads)
    if (!startTime && userInput.length >= 1 && completedChars === 0) {
      startTime = Date.now();
      isCompleted = false;
    }
    
    const expectedChar = currentText[completedChars];
    const isLastChar = completedChars === currentText.length - 1;
    
    // Check if first character in input matches expected character
    if (userInput.length >= 1 && userInput[0] === expectedChar) {
      if (isLastChar) {
        // EDGE CASE: Last character - complete immediately since no next char to wait for
        completedChars += 1;
        userInput = '';
        endTime = Date.now();
        isCompleted = true;
      } else if (userInput.length >= 2) {
        // Not the last character - check if next character also matches
        const nextExpectedChar = currentText[completedChars + 1];
        if (userInput[1] === nextExpectedChar) {
          // Next character matches too - NOW we can safely remove completed character
          completedChars += 1;
          lastErrorChar = ''; // Reset error tracking for next character
          userInput = userInput.slice(1); // Remove the completed character
        }
      }
      // If only 1 char and not last: wait for next character (IME-friendly)
    } else if (userInput.length >= 1 && userInput[0] !== expectedChar && userInput[0] !== lastErrorChar) {
      // First character is wrong - keep in input for natural correction
      totalErrors += 1;
      lastErrorChar = userInput[0];
    }
  };
  
  const nextText = () => {
    if (snippets.length) {
      pickNextSnippet();
      resetTest();
    }
  };
  
  const resetTest = () => {
    userInput = '';
    completedChars = 0;
    totalErrors = 0;
    lastErrorChar = '';
    startTime = null;
    endTime = null;
    isCompleted = false;
  };
  
  // Watch for input changes
  $effect(() => {
    handleInput();
  });

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
      <div class="bg-gray-50 p-4 rounded-lg border text-lg leading-relaxed font-mono">
        {#each currentText.split('') as char, i}
          {@const isCompleted = i < completedChars || (i >= completedChars && i < completedChars + userInput.length && userInput[i - completedChars] === char)}
          {@const allTypedMatch = userInput.split('').every((inputChar, idx) => inputChar === currentText[completedChars + idx])}
          {@const currentPosition = allTypedMatch ? completedChars + userInput.length : completedChars}
          {@const isCurrent = i === currentPosition}
          <span class={`${
            isCompleted
              ? 'bg-green-50 text-green-700' 
              : isCurrent 
                ? 'bg-blue-100 text-blue-700 animate-pulse' 
                : 'text-gray-400 opacity-60'
          }`}>{char}</span>
        {/each}
      </div>
    </div>
    
    <!-- User Input Area -->
    <div class="mb-4">
      <input
        type="text"
        bind:value={userInput}
        placeholder={isCompleted ? "已完成！" : "開始打字..."}
        class="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg font-mono text-center"
        disabled={isCompleted}
        autocomplete="off"
        autocorrect="off"
        autocapitalize="off"
        spellcheck="false"
      />
    </div>
    
    <!-- Statistics -->
    <div class="flex justify-center mb-4">
      <div class="flex gap-6 text-sm text-gray-600">
        <span>速度: <span class="font-medium text-gray-800">{cpm}</span> 字/分鐘</span>
      </div>
    </div>
    
    <!-- Completion Message -->
    {#if isCompleted}
      <div class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
        <div class="flex items-center">
          <img src="/icons/check.svg" alt="完成" class="h-5 w-5 mr-2" />
          <span class="font-medium">恭喜完成！</span>
        </div>
        <div class="mt-2 text-sm">
          準確度: {Math.round(accuracy)}% | 速度: {cpm} 字/分鐘 | 
          用時: {startTime && endTime ? Math.round((endTime - startTime) / 1000) : 0} 秒 | 
          錯誤: {totalErrors} 次
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
      >
        <img src="/icons/refresh.svg" alt="重置" class="h-4 w-4 mr-2" style="filter: invert(1);" />
        重新開始
      </button>
      
      <button
        onclick={nextText}
        class="flex items-center justify-center px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
      >
        <img src="/icons/arrow-right.svg" alt="下一個" class="h-4 w-4 mr-2" style="filter: invert(1);" />
        下一個文本
      </button>
    </div>

  </div>
</section>
