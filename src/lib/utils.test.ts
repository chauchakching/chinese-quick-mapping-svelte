import { describe, it, expect, beforeEach } from 'vitest';
import {
  shuffle,
  calculateCPM,
  createInitialTypingState,
  resetTypingState,
  processTypingInput,
  type TypingTestState,
  isChineseChar,
  calculateTypingProgress,
  getCharacterDisplayState
} from './utils';

describe('shuffle', () => {
  it('should shuffle array elements', () => {
    const original = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const toShuffle = [...original];

    shuffle(toShuffle);

    // Array should have same elements
    expect(toShuffle).toHaveLength(original.length);
    expect(toShuffle.sort()).toEqual(original.sort());

    // Test multiple shuffles to ensure function works (deterministic test)
    let hasShuffled = false;
    for (let i = 0; i < 10; i++) {
      const testArray = [...original];
      shuffle(testArray);
      if (!testArray.every((val, idx) => val === original[idx])) {
        hasShuffled = true;
        break;
      }
    }
    expect(hasShuffled).toBe(true);
  });

  it('should handle empty array', () => {
    const arr: number[] = [];
    shuffle(arr);
    expect(arr).toEqual([]);
  });

  it('should handle single element array', () => {
    const arr = [1];
    shuffle(arr);
    expect(arr).toEqual([1]);
  });
});

describe('calculateCPM', () => {
  it('should return 0 for no completed characters', () => {
    const result = calculateCPM(0, Date.now());
    expect(result).toBe(0);
  });

  it('should return 0 for no start time', () => {
    const result = calculateCPM(10, 0);
    expect(result).toBe(0);
  });

  it('should calculate CPM correctly', () => {
    const startTime = Date.now() - 60000; // 1 minute ago
    const completedChars = 60;

    const result = calculateCPM(completedChars, startTime);
    expect(result).toBe(60); // 60 chars in 1 minute = 60 CPM
  });

  it('should calculate CPM with end time', () => {
    const startTime = Date.now() - 120000; // 2 minutes ago
    const endTime = Date.now() - 60000; // ended 1 minute ago
    const completedChars = 30;

    const result = calculateCPM(completedChars, startTime, endTime);
    expect(result).toBe(30); // 30 chars in 1 minute = 30 CPM
  });

  it('should round CPM to nearest integer', () => {
    const startTime = Date.now() - 90000; // 1.5 minutes ago
    const completedChars = 100;

    const result = calculateCPM(completedChars, startTime);
    expect(result).toBe(67); // 100/1.5 = 66.67, rounded to 67
  });
});

describe('createInitialTypingState', () => {
  it('should create correct initial state', () => {
    const state = createInitialTypingState();

    expect(state).toEqual({
      userInput: '',
      completedChars: 0,
      startTime: null,
      endTime: null,
      isCompleted: false
    });
  });
});

describe('resetTypingState', () => {
  it('should reset state to initial values', () => {
    const result = resetTypingState();
    expect(result).toEqual(createInitialTypingState());
  });
});

describe('processTypingInput', () => {
  let initialState: TypingTestState;
  const targetText = '測試文本';

  beforeEach(() => {
    initialState = createInitialTypingState();
  });

  it('should start timing when user begins typing', () => {
    const state = { ...initialState, userInput: '測' };
    const result = processTypingInput(state, targetText);

    expect(result.startTime).toBeTruthy();
    expect(result.isCompleted).toBe(false);
  });

  it('should not start timing if already started', () => {
    const startTime = Date.now() - 1000;
    const state = { ...initialState, userInput: '測', startTime };
    const result = processTypingInput(state, targetText);

    expect(result.startTime).toBe(startTime); // Should not change
  });

  it('should complete immediately on last character', () => {
    const state = {
      ...initialState,
      userInput: '測試文本', // Complete correct input
      completedChars: 3, // At last character position
      startTime: Date.now() - 1000
    };
    const result = processTypingInput(state, targetText);

    expect(result.completedChars).toBe(4);
    expect(result.userInput).toBe('測試文本'); // Input is preserved
    expect(result.isCompleted).toBe(true);
    expect(result.endTime).toBeTruthy();
  });

  it('should advance when next character is also correct', () => {
    const state = {
      ...initialState,
      userInput: '測試',
      completedChars: 0,
      startTime: Date.now() - 1000
    };
    const result = processTypingInput(state, targetText);

    expect(result.completedChars).toBe(2); // Both characters match
    expect(result.userInput).toBe('測試'); // Input is preserved
  });

  it('should advance when correct character is typed', () => {
    const state = {
      ...initialState,
      userInput: '測',
      completedChars: 0,
      startTime: Date.now() - 1000
    };
    const result = processTypingInput(state, targetText);

    expect(result.completedChars).toBe(1); // Should advance when correct
    expect(result.userInput).toBe('測');
  });

  it('should handle wrong characters without error tracking', () => {
    const state = {
      ...initialState,
      userInput: 'x',
      completedChars: 0,
      startTime: Date.now() - 1000
    };
    const result = processTypingInput(state, targetText);

    expect(result.completedChars).toBe(0);
  });

  it('should handle repeated wrong characters without error tracking', () => {
    const state = {
      ...initialState,
      userInput: 'x',
      completedChars: 0,

      startTime: Date.now() - 1000
    };
    processTypingInput(state, targetText);
  });

  it('should handle empty input', () => {
    const state = {
      ...initialState,
      userInput: '',
      startTime: Date.now() - 1000
    };
    const result = processTypingInput(state, targetText);

    expect(result).toEqual(state); // No changes
  });

  it('should handle complex IME scenario', () => {
    // Simulate successful typing progression through multiple characters
    let state: TypingTestState = { ...initialState, userInput: '測', startTime: Date.now() };

    // Type first char - should advance immediately
    state = processTypingInput(state, targetText);
    expect(state.completedChars).toBe(1);

    // Type second char - should advance to 2
    state.userInput = '測試';
    state = processTypingInput(state, targetText);
    expect(state.completedChars).toBe(2);
    expect(state.userInput).toBe('測試'); // Input preserved

    // Type third char correctly - should advance to 3
    state.userInput = '測試文';
    state = processTypingInput(state, targetText);
    expect(state.completedChars).toBe(3);
    expect(state.userInput).toBe('測試文'); // Input preserved

    // Type wrong fourth char - should NOT advance (since 'x' doesn't match '本')
    state.userInput = '測試文x';
    state = processTypingInput(state, targetText);
    expect(state.completedChars).toBe(3); // Should not advance past correct chars
    expect(state.userInput).toBe('測試文x'); // Input preserved
  });

  it('should handle first character error tracking correctly', () => {
    // Test that errors are only counted for the first character in input
    const state = {
      ...initialState,
      userInput: 'x', // Wrong first character
      completedChars: 0,
      startTime: Date.now() - 1000
    };
    const result = processTypingInput(state, targetText);

    expect(result.completedChars).toBe(0);
    expect(result.userInput).toBe('x'); // Should keep wrong char for correction
  });

  it('should complete single character text immediately', () => {
    const singleCharText = '測';
    const state = {
      ...initialState,
      userInput: '測',
      startTime: Date.now() - 1000
    };
    const result = processTypingInput(state, singleCharText);

    expect(result.completedChars).toBe(1);
    expect(result.isCompleted).toBe(true);
    expect(result.userInput).toBe('測'); // Input is preserved
    expect(result.endTime).toBeTruthy();
  });
});

describe('isChineseChar', () => {
  it('should detect BMP CJK unified ideographs', () => {
    expect(isChineseChar('測')).toBe(true);
    expect(isChineseChar('試')).toBe(true);
    expect(isChineseChar('文')).toBe(true);
    expect(isChineseChar('本')).toBe(true);
  });

  it('should detect CJK compatibility ideographs', () => {
    // U+FA0E is a compatibility ideograph (﨎)
    expect(isChineseChar('\uFA0E')).toBe(true);
  });

  it('should reject Latin letters, digits, and punctuation', () => {
    expect(isChineseChar('A')).toBe(false);
    expect(isChineseChar('z')).toBe(false);
    expect(isChineseChar('0')).toBe(false);
    expect(isChineseChar('，')).toBe(false); // full-width comma
    expect(isChineseChar(',')).toBe(false);
    expect(isChineseChar(' ')).toBe(false);
  });
});

describe('Typing progress calculation', () => {
  it('calculateTypingProgress handles duplicate characters correctly', () => {
    const snippetText = '靜靜，了一個';

    // No input yet
    let result = calculateTypingProgress(snippetText, '');
    expect(result.filteredChineseText).toBe('靜靜了一個');
    expect(result.matchedChinesePrefixLen).toBe(0);
    expect(result.currentChinesePosition).toBe(0);

    // Typed first "靜"
    result = calculateTypingProgress(snippetText, '靜');
    expect(result.matchedChinesePrefixLen).toBe(1);
    expect(result.currentChinesePosition).toBe(1);

    // Typed both "靜" characters
    result = calculateTypingProgress(snippetText, '靜靜');
    expect(result.matchedChinesePrefixLen).toBe(2);
    expect(result.currentChinesePosition).toBe(2);

    // Typed up to "了"
    result = calculateTypingProgress(snippetText, '靜靜了');
    expect(result.matchedChinesePrefixLen).toBe(3);
    expect(result.currentChinesePosition).toBe(3);
  });

  it('getCharacterDisplayState highlights correctly with duplicates', () => {
    const snippetText = '靜靜，了一個';
    const progress = calculateTypingProgress(snippetText, '靜');

    // First "靜" at index 0 - should be completed
    const firstJing = getCharacterDisplayState(0, '靜', progress);
    expect(firstJing.isCompletedChinese).toBe(true);
    expect(firstJing.isCurrentChinese).toBe(false);

    // Second "靜" at index 1 - should be current
    const secondJing = getCharacterDisplayState(1, '靜', progress);
    expect(secondJing.isCompletedChinese).toBe(false);
    expect(secondJing.isCurrentChinese).toBe(true);

    // "了" at index 3 - should be pending
    const liao = getCharacterDisplayState(3, '了', progress);
    expect(liao.isCompletedChinese).toBe(false);
    expect(liao.isCurrentChinese).toBe(false);
  });

  it('calculateTypingProgress with mixed input handles non-Chinese correctly', () => {
    const snippetText = '靜a靜';
    const result = calculateTypingProgress(snippetText, '靜a靜b');

    // Should only consider Chinese characters
    expect(result.filteredChineseText).toBe('靜靜');
    expect(result.typedChineseOnly).toBe('靜靜');
    expect(result.matchedChinesePrefixLen).toBe(2);
  });
});
