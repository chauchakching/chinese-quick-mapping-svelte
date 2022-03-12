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

  const shouldUpdateLastHistory = inputHistory[0]?.startsWith(newContent);

  return (
    shouldAppendHistory && shouldUpdateLastHistory
      ? [newContent, ...inputHistory.slice(1)]
      : shouldAppendHistory
      ? [newContent, ...inputHistory]
      : inputHistory
  ).slice(0, 10);
};
