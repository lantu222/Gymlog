/**
 * Matching a word inside a sentence, in two languages that disagree about
 * where a word ends.
 *
 * Finnish glues the ending on — "palautunut" is "palautu" plus an ending — so
 * a Finnish stem matches from the start of a word and lets the rest be
 * whatever it is. English does not, and matching an English word the Finnish
 * way is how "run" became the start of "runo" and a request for a poem read
 * as a training question (2026-09-16). The same trap holds "set" inside
 * "setä" and "rep" inside "reppu".
 *
 * Both were written twice — once in aiCoachPreview for the lifts a question
 * names, once in aiCoachScope for what a question is about — and the second
 * copy had lost the escaping. One copy, escaped, used by both.
 */

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The word itself, standing alone — "run", never the "run" in "crunches" or "runo". */
export function hasWord(text: string, word: string): boolean {
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(word)}($|[^\\p{L}\\p{N}])`, 'u').test(text);
}

/** A word that starts with this stem — "palautu" in "palautunut", never mid-word. */
export function hasWordStart(text: string, stem: string): boolean {
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(stem)}`, 'u').test(text);
}
