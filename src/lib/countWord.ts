import { AppLanguage } from '../types/models';

const EN = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const FI = ['nolla', 'yksi', 'kaksi', 'kolme', 'neljä', 'viisi', 'kuusi', 'seitsemän', 'kahdeksan', 'yhdeksän', 'kymmenen'];

/**
 * A small count as a word: "Five caps just came off", "these five go back".
 * Capitalised by default for the start of a headline; `position: 'inline'`
 * keeps it lower-case mid-sentence. Past ten, or for anything that is not a
 * whole number, the numeral — a word for "seventeen" is not clearer than 17.
 *
 * Derived rather than typed into copy: the unlock screen's "five" is the
 * length of PRO_UNLOCK_CARDS, and a hardcoded word lies the day a row moves.
 */
export function countWord(
  count: number,
  language: AppLanguage,
  position: 'start' | 'inline' = 'start',
): string {
  const words = language === 'fi' ? FI : EN;
  if (!Number.isInteger(count) || count < 0 || count >= words.length) {
    return String(count);
  }
  const word = words[count];
  return position === 'inline' ? word : word.charAt(0).toUpperCase() + word.slice(1);
}
