import { AICoachAdvice } from '../types/aiCoach';
import { AppLanguage } from '../types/models';

/**
 * A decimal point between two digits, not part of a date or a time.
 *
 * - "3.8.2026" and "1.2.3": a third number means a date or a version; it stays.
 * - "17.9.": a dot right after, on numbers a day and a month can be, is a
 *   Finnish date — the prompt asks for dates written that way; it stays.
 *   "77.5." at the end of a sentence cannot be a date and takes a comma.
 * - "0.8–1.3.": the second end of a range whose first end is a decimal is a
 *   decimal too, dot after or not.
 * - "klo 17.30" is a Finnish time; it stays.
 */
const DECIMAL_POINT = /(?<![\d.,])(\d+)\.(\d+)(?!\d)/g;
const TIME_BEFORE = /klo\s*$/i;
const DECIMAL_RANGE_START = /\d[.,]\d+\s*[–-]\s*$/;

function couldBeDate(whole: string, fraction: string): boolean {
  const day = Number(whole);
  const month = Number(fraction);
  return whole.length <= 2 && fraction.length <= 2 && !fraction.startsWith('0') && day >= 1 && day <= 31 && month >= 1 && month <= 12;
}

/** One line with its decimal points written the Finnish way. */
export function finnishDecimals(text: string): string {
  return text.replace(DECIMAL_POINT, (match: string, whole: string, fraction: string, offset: number, all: string) => {
    const before = all.slice(Math.max(0, offset - 12), offset);
    const after = all.slice(offset + match.length);
    if (TIME_BEFORE.test(before) || /^\.\d/.test(after)) {
      return match;
    }
    if (after.startsWith('.') && couldBeDate(whole, fraction) && !DECIMAL_RANGE_START.test(before)) {
      return match;
    }
    return `${whole},${fraction}`;
  });
}

/**
 * A live answer with its numbers in the reader's own format.
 *
 * The context carries the lifts' series as English data ("top sets 72.5 → 75
 * → 80"), and the model copied them into Finnish answers as they stood — "72.5
 * → 75" under a takeaway that wrote "72,5 kg" (emulator, 2026-09-30). The
 * prompt already asks for the decimal comma; this makes it so. English answers
 * and the reader's own words (a programme brief) pass through untouched.
 */
export function localizeAdviceDecimals(advice: AICoachAdvice, language: AppLanguage | null | undefined): AICoachAdvice {
  if (language !== 'fi') {
    return advice;
  }
  const line = finnishDecimals;
  const lines = (values: string[]) => values.map(line);
  return {
    ...advice,
    takeaway: line(advice.takeaway),
    why: lines(advice.why),
    nextSteps: lines(advice.nextSteps),
    plan: lines(advice.plan),
    assumptions: lines(advice.assumptions),
    ...(typeof advice.attention === 'string' ? { attention: line(advice.attention) } : {}),
    ...(typeof advice.example === 'string' ? { example: line(advice.example) } : {}),
  };
}
