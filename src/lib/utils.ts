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

const alphabetToQuickUnit = (char) => keyToQuickUnit[char];

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
