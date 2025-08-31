import { keyToQuickUnit } from './keyToQuickUnit';
import { modes, type Mode } from './types';

export const chineseToParts = (quickMapping: Record<string, string>, mode: Mode, ch: string) => {
  const keyboardKeys = quickMapping[ch] ?? '';
  const chineseToQuickUnits = keyboardKeys.split('').map(alphabetToQuickUnit).join('');
  const parts = mode == modes.quick ? quickUnitsToParts(chineseToQuickUnits) : chineseToQuickUnits;
  return { ch, parts };
};

const quickUnitsToParts = (quickUnits: string) => {
  if (quickUnits.length < 2) return quickUnits;
  return `${quickUnits[0]}${quickUnits[quickUnits.length - 1]}`;
};

const alphabetToQuickUnit = (char: string) => keyToQuickUnit[char];

export const updateInputHistory = (newContent: string, inputHistory: string[]) => {
  if (newContent.length === 0) return inputHistory;

  const shouldAppendHistory =
    newContent.length > 0 &&
    !inputHistory[0]?.startsWith(newContent) &&
    !inputHistory.includes(newContent);

  const shouldUpdateLastHistory = newContent.startsWith(inputHistory[0]);

  return (
    shouldAppendHistory && shouldUpdateLastHistory
      ? [newContent, ...inputHistory.slice(1)]
      : shouldAppendHistory
        ? [newContent, ...inputHistory]
        : inputHistory
  ).slice(0, 10);
};

export const getColor = (i: number) => {
  return colorAndFilters[i][0];
};

export const getColorFilter = (i: number) => {
  return colorAndFilters[i][1];
};

/**
 * For better color accessibility
 * https://color.adobe.com/zh/create/color-accessibility
 *
 * Try the algo on https://codepen.io/sosuke/pen/Pjoqqp
 */
const colorAndFilters = [
  // blue
  [
    '#423BE0',
    'filter: invert(18%) sepia(73%) saturate(4208%) hue-rotate(242deg) brightness(91%) contrast(94%);'
  ],
  // red
  [
    '#E31B36',
    'filter: invert(13%) sepia(79%) saturate(6156%) hue-rotate(347deg) brightness(95%) contrast(86%);'
  ],
  // green2
  [
    '#1E9423',
    'filter: invert(43%) sepia(44%) saturate(866%) hue-rotate(73deg) brightness(94%) contrast(93%);'
  ],
  // orange
  [
    '#DB993D',
    'filter: invert(47%) sepia(68%) saturate(404%) hue-rotate(356deg) brightness(118%) contrast(96%);'
  ],
  // green1
  [
    '#63E7F0',
    'filter: invert(82%) sepia(85%) saturate(2170%) hue-rotate(148deg) brightness(100%) contrast(88%);'
  ]
];

/**
 * Array utilities
 */
export function shuffle<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/**
 * Typing performance calculations
 */
export function calculateCPM(completedChars: number, startTime: number, endTime?: number): number {
  if (!startTime || completedChars === 0) return 0;

  const currentTime = endTime || Date.now();
  const elapsedTimeMinutes = (currentTime - startTime) / 60000;

  if (elapsedTimeMinutes === 0) return 0;

  return Math.round(completedChars / elapsedTimeMinutes);
}

export function calculateAccuracy(completedChars: number, totalErrors: number): number {
  return completedChars > 0 ? (completedChars / (completedChars + totalErrors)) * 100 : 100;
}

/**
 * Character utilities
 */
export function isChineseChar(ch: string): boolean {
  // BMP ranges commonly used in provided texts: CJK Unified Ideographs + Compatibility Ideographs
  return /[\u3400-\u9FFF\uF900-\uFAFF]/.test(ch);
}

/**
 * Typing test state management
 */
export interface TypingTestState {
  userInput: string;
  completedChars: number;
  startTime: number | null;
  endTime: number | null;
  isCompleted: boolean;
  totalErrors: number;
  lastErrorChar: string;
}

export function createInitialTypingState(): TypingTestState {
  return {
    userInput: '',
    completedChars: 0,
    startTime: null,
    endTime: null,
    isCompleted: false,
    totalErrors: 0,
    lastErrorChar: ''
  };
}

export function resetTypingState(): TypingTestState {
  return createInitialTypingState();
}

/**
 * TYPING LOGIC EXPLANATION & DESIGN RATIONALE
 *
 * This handles character-by-character progression for Chinese typing practice.
 * The logic is designed to work naturally with Chinese Input Method Editors (IME).
 *
 * BACKGROUND - Chinese IME Behavior:
 * - IME composition states must not be interrupted by programmatic input changes
 * - Browser sees intermediate composition states that should not be evaluated
 * - Users expect natural composition flow without interference
 *
 * SOLUTION - "Non-Intrusive Progress Tracking":
 * 1. NEVER modify userInput - preserve IME composition states
 * 2. Extract only committed Chinese characters for progress evaluation
 * 3. Track completion based on correct Chinese character sequence match
 * 4. Allow natural error correction without input manipulation
 *
 * EDGE CASES HANDLED:
 * - IME composition: Never alter user input during any composition state
 * - Progress tracking: Based purely on Chinese character matching
 * - Error tracking: Count mistakes without disrupting input flow
 * - Completion: Detected when all target characters are correctly typed
 *
 * This preserves natural Chinese typing flow while providing accurate progress feedback.
 */
export function processTypingInput(state: TypingTestState, targetText: string): TypingTestState {
  const newState = { ...state };

  // Start timing only when user starts typing
  if (!newState.startTime && newState.userInput.length >= 1 && newState.completedChars === 0) {
    newState.startTime = Date.now();
    newState.isCompleted = false;
  }

  // Extract only Chinese characters from user input for comparison
  const typedChineseChars = newState.userInput.split('').filter(isChineseChar);

  // Count how many characters match from the beginning
  let correctChars = 0;
  for (let i = 0; i < Math.min(typedChineseChars.length, targetText.length); i++) {
    if (typedChineseChars[i] === targetText[i]) {
      correctChars++;
    } else {
      break; // Stop at first mismatch
    }
  }

  // Update completed character count
  newState.completedChars = correctChars;

  // Track errors when user types more characters than correct matches
  if (typedChineseChars.length > correctChars) {
    const wrongChar = typedChineseChars[correctChars];
    if (wrongChar !== newState.lastErrorChar) {
      newState.totalErrors += 1;
      newState.lastErrorChar = wrongChar;
    }
  } else {
    // Reset error tracking when user corrects/deletes wrong characters
    newState.lastErrorChar = '';
  }

  // Check for completion
  if (newState.completedChars === targetText.length) {
    newState.endTime = Date.now();
    newState.isCompleted = true;
  }

  return newState;
}
