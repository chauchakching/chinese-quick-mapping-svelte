import { describe, it, expect, beforeEach } from 'vitest';
import {
  shuffle,
  calculateCPM,
  calculateAccuracy,
  createInitialTypingState,
  resetTypingState,
  processTypingInput,
  type TypingTestState,
  isChineseChar
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

describe('calculateAccuracy', () => {
  it('should return 100% for no errors', () => {
    const result = calculateAccuracy(10, 0);
    expect(result).toBe(100);
  });

  it('should return 100% for no completed characters', () => {
    const result = calculateAccuracy(0, 5);
    expect(result).toBe(100);
  });

  it('should calculate accuracy correctly', () => {
    const result = calculateAccuracy(8, 2); // 8 correct, 2 errors = 80%
    expect(result).toBe(80);
  });

  it('should handle floating point accuracy', () => {
    const result = calculateAccuracy(7, 3); // 7/(7+3) = 70%
    expect(result).toBe(70);
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
      isCompleted: false,
      totalErrors: 0,
      lastErrorChar: ''
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
      userInput: '本',
      completedChars: 3, // At last character position
      startTime: Date.now() - 1000
    };
    const result = processTypingInput(state, targetText);

    expect(result.completedChars).toBe(4);
    expect(result.userInput).toBe('');
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

    expect(result.completedChars).toBe(1);
    expect(result.userInput).toBe('試');
    expect(result.lastErrorChar).toBe('');
  });

  it('should wait for next character when only one correct char typed', () => {
    const state = {
      ...initialState,
      userInput: '測',
      completedChars: 0,
      startTime: Date.now() - 1000
    };
    const result = processTypingInput(state, targetText);

    expect(result.completedChars).toBe(0); // Should not advance yet
    expect(result.userInput).toBe('測');
  });

  it('should track errors for wrong characters', () => {
    const state = {
      ...initialState,
      userInput: 'x',
      completedChars: 0,
      startTime: Date.now() - 1000
    };
    const result = processTypingInput(state, targetText);

    expect(result.totalErrors).toBe(1);
    expect(result.lastErrorChar).toBe('x');
    expect(result.completedChars).toBe(0);
  });

  it('should not double-count same error character', () => {
    const state = {
      ...initialState,
      userInput: 'x',
      completedChars: 0,
      totalErrors: 1,
      lastErrorChar: 'x',
      startTime: Date.now() - 1000
    };
    const result = processTypingInput(state, targetText);

    expect(result.totalErrors).toBe(1); // Should not increment again
    expect(result.lastErrorChar).toBe('x');
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

    // Type first char - should wait
    state = processTypingInput(state, targetText);
    expect(state.completedChars).toBe(0);

    // Type second char - should advance first char
    state.userInput = '測試';
    state = processTypingInput(state, targetText);
    expect(state.completedChars).toBe(1);
    expect(state.userInput).toBe('試');

    // Type third char correctly - should advance second char
    state.userInput = '試文';
    state = processTypingInput(state, targetText);
    expect(state.completedChars).toBe(2);
    expect(state.userInput).toBe('文');

    // Type wrong fourth char - should NOT advance (since 'x' doesn't match '本')
    // Note: The logic only tracks errors for first char in input, not subsequent chars
    state.userInput = '文x';
    state = processTypingInput(state, targetText);
    expect(state.completedChars).toBe(2); // Should not advance
    expect(state.userInput).toBe('文x'); // Should keep both chars
    expect(state.totalErrors).toBe(0); // No error counted since first char '文' is correct
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

    expect(result.totalErrors).toBe(1);
    expect(result.lastErrorChar).toBe('x');
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
    expect(result.userInput).toBe('');
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
