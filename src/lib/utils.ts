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

export function resetTypingState(state: TypingTestState): TypingTestState {
  return createInitialTypingState();
}

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
export function processTypingInput(state: TypingTestState, targetText: string): TypingTestState {
  const newState = { ...state };

  // Start timing only when user starts typing
  if (!newState.startTime && newState.userInput.length >= 1 && newState.completedChars === 0) {
    newState.startTime = Date.now();
    newState.isCompleted = false;
  }

  const expectedChar = targetText[newState.completedChars];
  const isLastChar = newState.completedChars === targetText.length - 1;

  // Check if first character in input matches expected character
  if (newState.userInput.length >= 1 && newState.userInput[0] === expectedChar) {
    if (isLastChar) {
      // EDGE CASE: Last character - complete immediately since no next char to wait for
      newState.completedChars += 1;
      newState.userInput = '';
      newState.endTime = Date.now();
      newState.isCompleted = true;
    } else if (newState.userInput.length >= 2) {
      // Not the last character - check if next character also matches
      const nextExpectedChar = targetText[newState.completedChars + 1];
      if (newState.userInput[1] === nextExpectedChar) {
        // Next character matches too - NOW we can safely remove completed character
        newState.completedChars += 1;
        newState.lastErrorChar = ''; // Reset error tracking for next character
        newState.userInput = newState.userInput.slice(1); // Remove the completed character
      }
    }
    // If only 1 char and not last: wait for next character (IME-friendly)
  } else if (
    newState.userInput.length >= 1 &&
    newState.userInput[0] !== expectedChar &&
    newState.userInput[0] !== newState.lastErrorChar
  ) {
    // First character is wrong - keep in input for natural correction
    newState.totalErrors += 1;
    newState.lastErrorChar = newState.userInput[0];
  }

  return newState;
}
