/**
 * Where a long Finnish word may break across two lines.
 *
 * Finnish exercise names are compounds — "lantionnostopito", "askelkyykky" —
 * and a compound longer than its column has to break somewhere. With nothing
 * to say where, Android breaks it at whatever character runs out of room, and
 * the day screen read "lantionno / stopito" (device, 2026-09-16). Android's
 * own hyphenator has no Finnish patterns, so the break points are supplied
 * here, as soft hyphens (U+00AD): invisible unless the line actually breaks
 * there, and then drawn as a hyphen.
 *
 * The rules are the standard ones for Finnish syllables:
 *
 * 1. A consonant followed by a vowel starts a syllable: ka-la, kort-ti.
 * 2. Two vowels in a row are split unless they are a long vowel (aa, ää…) or
 *    a diphthong (ai, ei, au, ou, äy…): ti-on, but kau-la.
 * 3. ie, uo and yö are diphthongs only in a word's first syllable.
 *
 * Compound boundaries fall on syllable boundaries in almost every exercise
 * name, so no dictionary is needed. A break that would leave fewer than two
 * letters on either side of it is not offered — "a-" at the end of a line is
 * worse than no break at all.
 */

export const SOFT_HYPHEN = '\u00AD';

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u', 'y', 'ä', 'ö', 'å']);
const DIPHTHONGS = new Set([
  'ai', 'ei', 'oi', 'ui', 'yi', 'äi', 'öi',
  'au', 'eu', 'iu', 'ou',
  'ey', 'iy', 'äy', 'öy',
]);
const FIRST_SYLLABLE_DIPHTHONGS = new Set(['ie', 'uo', 'yö']);

/** Words shorter than this fit any column the app draws a name in. */
const MIN_WORD_LENGTH = 7;
/** The fewest letters a break may leave on either side of it. */
const MIN_SIDE = 2;

function isVowel(letter: string) {
  return VOWELS.has(letter);
}

function isLetter(letter: string) {
  return /\p{L}/u.test(letter);
}

/**
 * Break positions inside one word, as indexes where a syllable starts.
 * The word is matched lower-case; positions refer to the original.
 */
function syllableStarts(word: string): number[] {
  const lower = word.toLowerCase();
  const starts: number[] = [];
  let syllableCount = 0;

  for (let index = 1; index < lower.length; index += 1) {
    const previous = lower[index - 1];
    const current = lower[index];
    const next = lower[index + 1];

    // Rule 1: a consonant followed by a vowel begins a syllable, provided
    // there is a vowel somewhere before it to end the previous one.
    if (!isVowel(current) && next !== undefined && isVowel(next)) {
      const vowelBefore = [...lower.slice(0, index)].some(isVowel);
      if (vowelBefore) {
        starts.push(index);
        syllableCount += 1;
      }
      continue;
    }

    // Rule 2 and 3: two vowels that are neither long nor a diphthong split.
    if (isVowel(previous) && isVowel(current)) {
      const pair = previous + current;
      const long = previous === current;
      const diphthong =
        DIPHTHONGS.has(pair) || (syllableCount === 0 && FIRST_SYLLABLE_DIPHTHONGS.has(pair));
      // A vowel that already closed a diphthong cannot open a second one:
      // "raiu" is rai-u, not ra-iu.
      const closesTriple = index >= 2 && isVowel(lower[index - 2]) && !starts.includes(index - 1);
      if ((!long && !diphthong) || closesTriple) {
        starts.push(index);
        syllableCount += 1;
      }
    }
  }

  return starts.filter((position) => position >= MIN_SIDE && word.length - position >= MIN_SIDE);
}

/** One word with soft hyphens at its syllable boundaries. */
export function hyphenateFinnishWord(word: string): string {
  if (word.length < MIN_WORD_LENGTH || ![...word].every(isLetter)) {
    return word;
  }
  const starts = syllableStarts(word);
  if (starts.length === 0) {
    return word;
  }
  let result = '';
  let from = 0;
  for (const position of starts) {
    result += word.slice(from, position) + SOFT_HYPHEN;
    from = position;
  }
  return result + word.slice(from);
}

/**
 * A whole label, word by word. Anything that is not a run of letters —
 * spaces, digits, brackets, an existing hyphen — is left exactly as it was.
 */
export function hyphenateFinnish(text: string): string {
  return text.replace(/\p{L}+/gu, (word) => hyphenateFinnishWord(word));
}
