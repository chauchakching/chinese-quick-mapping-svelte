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

/**
 * Generate a simple hash for a string (for snippet identification)
 * Using a simple djb2 hash algorithm for browser compatibility
 */
export const simpleHash = (str: string): string => {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) & 0xffffffff;
  }
  // Convert to positive number and base36 for shorter URL-friendly string
  return Math.abs(hash).toString(36);
};

/**
 * Find snippet index by its hash
 */
export const findSnippetByHash = (snippets: [string, number][], hash: string): number => {
  for (let i = 0; i < snippets.length; i++) {
    if (simpleHash(snippets[i][0]) === hash) {
      return i;
    }
  }
  return -1;
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
 * Apply color to SVG part group using direct fill (universal browser support)
 * Simpler and more reliable than CSS filters, works on all browsers including Safari
 */
export const applyFillColor = (group: HTMLElement, color: string) => {
  group.style.filter = '';
  group.style.transform = '';
  group.style.fill = color;
  group.querySelectorAll('path').forEach((path) => {
    (path as SVGPathElement).style.fill = color;
  });
};

export const applyPartColor = (group: HTMLElement, colorIndex: number) => {
  if (colorIndex < 0 || colorIndex >= colorAndFilters.length) return;
  applyFillColor(group, getColor(colorIndex));
};

/**
 * Keep the hue and mix it toward gray.
 * Confirmed parts stay identifiable, and the still-active part remains the one that stands out.
 */
export function softenColor(hex: string, amount = 0.62): string {
  const toward = { r: 197, g: 202, b: 211 };
  const normalized = hex.replace('#', '');
  const channels = [0, 2, 4].map((start) => parseInt(normalized.slice(start, start + 2), 16));
  const mixed = channels.map((channel, index) => {
    const target = [toward.r, toward.g, toward.b][index];
    return Math.round(channel + (target - channel) * amount);
  });
  return `#${mixed.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

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
}

export function createInitialTypingState(): TypingTestState {
  return {
    userInput: '',
    completedChars: 0,
    startTime: null,
    endTime: null,
    isCompleted: false
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

  // Check for completion
  if (newState.completedChars === targetText.length) {
    newState.endTime = Date.now();
    newState.isCompleted = true;
  }

  return newState;
}

/**
 * Calculate typing progress and character states for highlighting
 * @param snippetText - The full text snippet
 * @param userInput - The current user input
 * @returns Object with character indices, positions, and state information
 */
export function calculateTypingProgress(snippetText: string, userInput: string) {
  // Get indices of Chinese characters in the original text
  const chineseIndices = snippetText
    .split('')
    .map((c, i) => (isChineseChar(c) ? i : -1))
    .filter((i) => i !== -1);

  // Extract only Chinese characters from the snippet
  const filteredChineseText = chineseIndices.map((i) => snippetText[i]).join('');

  // Create mapping from text index to Chinese character ordinal position
  const indexToChineseOrdinal = chineseIndices.reduce((map, idx, ord) => {
    map.set(idx, ord);
    return map;
  }, new Map<number, number>());

  // Extract only Chinese characters from user input
  const typedChineseOnly = userInput.split('').filter(isChineseChar).join('');

  // Count how many characters match from the beginning
  let matchedChinesePrefixLen = 0;
  const typed = typedChineseOnly.split('');
  for (let i = 0; i < typed.length; i++) {
    if (typed[i] === filteredChineseText[i]) {
      matchedChinesePrefixLen++;
    } else {
      break;
    }
  }

  const currentChinesePosition = matchedChinesePrefixLen;
  const currentChineseCharIndex = chineseIndices[currentChinesePosition] ?? -1;
  const currentChar = currentChineseCharIndex >= 0 ? snippetText[currentChineseCharIndex] : '';

  return {
    chineseIndices,
    filteredChineseText,
    indexToChineseOrdinal,
    typedChineseOnly,
    matchedChinesePrefixLen,
    currentChinesePosition,
    currentChineseCharIndex,
    currentChar
  };
}

/**
 * Get the display state for a character at a specific index
 * @param charIndex - Index of the character in the full text
 * @param char - The character itself
 * @param progress - Progress object from calculateTypingProgress
 * @returns Object with character state information for highlighting
 */
export function getCharacterDisplayState(
  charIndex: number,
  char: string,
  progress: ReturnType<typeof calculateTypingProgress>
) {
  const isChinese = isChineseChar(char);
  const ord = isChinese ? (progress.indexToChineseOrdinal.get(charIndex) ?? -1) : -1;
  const isCompletedChinese = isChinese && ord >= 0 && ord < progress.matchedChinesePrefixLen;
  const isCurrentChinese = isChinese && ord === progress.matchedChinesePrefixLen;

  return {
    isChinese,
    ord,
    isCompletedChinese,
    isCurrentChinese
  };
}

export async function fetchCharacterSvg(char: string): Promise<Response> {
  return await fetch(`chars/${char}/combined.svg`);
}

/**
 * Preloads a character's combined SVG by fetching it.
 * The service worker will cache it for later use.
 */
export async function preloadCharacterImage(char: string): Promise<void> {
  if (!char) return;

  try {
    await fetchCharacterSvg(char);
    // No need to process response - just warming the cache
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (e) {
    // Silent fail - preloading shouldn't break the app
  }
}

/**
 * Preloads multiple character images
 */
export async function preloadCharacterImages(chars: string[]): Promise<void> {
  await Promise.allSettled(chars.map((char) => preloadCharacterImage(char)));
}

/** One accepted key in a practice round, and the SVG part it lights. */
export interface CodeStep {
  key: string;
  partIndex: number;
}

/**
 * Key sequence the player must press.
 * 倉頡 uses the full code. 速成 uses the first key and the last key.
 * partIndex matches combined.svg groups: part-1 is index 0.
 */
export function codeSteps(code: string, mode: Mode): CodeStep[] {
  const letters = code
    .toLowerCase()
    .replace(/[^a-z]/g, '')
    .split('');
  if (letters.length === 0) return [];
  if (mode === modes.quick) {
    if (letters.length === 1) return [{ key: letters[0], partIndex: 0 }];
    return [
      { key: letters[0], partIndex: 0 },
      { key: letters[letters.length - 1], partIndex: letters.length - 1 }
    ];
  }
  return letters.map((key, partIndex) => ({ key, partIndex }));
}

/** Physical key from KeyboardEvent.code, for example KeyM → m. */
export function letterFromKeyCode(code: string): string | null {
  const match = /^Key([A-Z])$/.exec(code);
  return match ? match[1].toLowerCase() : null;
}

export interface PartPaint {
  partIndex: number;
  colorIndex: number;
}

/**
 * Palette index for a step. 速成's last key uses the second color,
 * matching the lookup view, which always paints the two ends as blue then red.
 */
export function stepColorIndex(
  stepIndex: number,
  stepCount: number,
  mode: Mode,
  partIndex: number
): number {
  if (mode === modes.quick && stepCount >= 2 && stepIndex === stepCount - 1) return 1;
  return Math.min(Math.max(partIndex, 0), 4);
}

export interface PracticeSlot {
  /** Index of the character in the original snippet. */
  index: number;
  char: string;
}

/** Chinese characters in reading order that have a stored code. */
export function practiceSlots(text: string, mapping: Record<string, string>): PracticeSlot[] {
  const slots: PracticeSlot[] = [];
  const chars = text.split('');
  for (let index = 0; index < chars.length; index++) {
    const char = chars[index];
    if (isChineseChar(char) && /[a-z]/i.test(mapping[char] ?? '')) slots.push({ index, char });
  }
  return slots;
}

/** Null before the player has pressed a letter, so the UI can show a blank instead of 100%. */
export function accuracyPercent(hits: number, attempts: number): number | null {
  if (attempts <= 0) return null;
  return Math.round((hits / attempts) * 100);
}
