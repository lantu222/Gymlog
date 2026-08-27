/**
 * The weight on a set: what stepping does, and what typing accepts.
 *
 * Two complaints from the same dial, one morning apart (#bugs 2026-08-27):
 *
 * "Ei voi valita tasan 12 kg." True, and no step size fixes it. The dial moves
 * in 1,25 kg — the smallest real plate pair — so from zero it lands on 11,25
 * and 12,5 and never on 12. A stepper can only reach its own grid; a reader who
 * wants a number off that grid has to be able to say it. The card has claimed
 * you could since it was built — it draws a pencil and tells a screen reader
 * "tap to edit" — and tapping opened the same two buttons.
 *
 * "Yhtäkkiä paino pomppasi +5000 kg." The dial had no ceiling: `Math.max(0, …)`
 * on the way down and nothing on the way up, while a held button accelerates to
 * a step every 45 ms. Whatever produced it, a set of five thousand kilograms is
 * not a number the app should be able to hold — it lands in volume, in records
 * and in the coach's context, and it poisons every chart it touches.
 */

import { parseNumberInput } from './format';

/** The smallest real plate pair. */
export const WEIGHT_DIAL_STEP_KG = 1.25;

/**
 * The heaviest single set the app will hold.
 *
 * Not a guess at anybody's strength: the all-time raw deadlift record is a bit
 * over 500 kg, so this cannot stand between a reader and a lift they actually
 * did. It exists so a stuck button, a fat finger or a typo cannot write a
 * number that breaks every chart it reaches.
 */
export const WEIGHT_DIAL_MAX_KG = 500;

interface DialBounds {
  step?: number;
  max?: number;
}

/** Two decimals, because 61.25 rounds itself to 61.3 on the way through. */
function toDialPrecision(kg: number): number {
  return Number(kg.toFixed(2));
}

/** One press, or one tick of a held button. */
export function stepDialWeight(
  currentKg: number,
  direction: -1 | 1,
  { step = WEIGHT_DIAL_STEP_KG, max = WEIGHT_DIAL_MAX_KG }: DialBounds = {},
): number {
  const next = (Number.isFinite(currentKg) ? currentKg : 0) + direction * step;
  return toDialPrecision(Math.min(max, Math.max(0, next)));
}

/**
 * What a typed weight becomes.
 *
 * Unparseable input keeps what was there rather than falling to zero: the
 * reader is mid-edit, and a field that empties itself when you delete the last
 * digit has thrown away the number you were adjusting.
 */
export function commitDialWeight(
  text: string,
  previousKg: number,
  { max = WEIGHT_DIAL_MAX_KG }: DialBounds = {},
): number {
  // parseNumberInput takes the Finnish comma as well as the dot.
  const parsed = parseNumberInput(text);
  if (parsed === null) {
    return toDialPrecision(Math.min(max, Math.max(0, previousKg)));
  }
  return toDialPrecision(Math.min(max, Math.max(0, parsed)));
}
