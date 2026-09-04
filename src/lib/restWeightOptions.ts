/**
 * The three weights offered on the rest screen (design: session flow, screen 7).
 *
 * Rest is when the next set gets decided, and until now the decision was made
 * for the reader by a prefilled dial two screens later. Three options — one
 * down, the engine's pick, one up — turn a number they would have accepted
 * into one they chose, without making them dial anything.
 *
 * Deliberately not a free stepper. The dial on the set screen is the free
 * stepper; this is the same decision reduced to the three answers that are
 * actually likely, for a reader holding a phone with one hand between sets.
 */
import { formatWeight } from './format';
import { t } from './i18n';
import { AppLanguage, UnitPreference } from '../types/models';

/**
 * The default distance between options: two pairs of the smallest real plate,
 * and the step the progression gate itself takes.
 */
export const REST_WEIGHT_STEP_KG = 2.5;

export interface RestWeightOption {
  loadKg: number;
  /** "62,5 kg". */
  label: string;
  /** "same" when it matches what was lifted last time; null otherwise. */
  note: string | null;
  /** The weight the progression gate picked — pre-selected. */
  isPick: boolean;
}

export interface RestWeightInput {
  /** What the next set is prefilled with. Null on a lift that logs no load. */
  pickKg: number | null;
  /** Last session's load on this lift, when there is one. */
  lastKg: number | null;
  /**
   * The distance to the neighbours. Defaults to the gate's own step; passing
   * the jump the gate just made keeps the three options on the same grid the
   * engine moves on.
   */
  stepKg?: number;
}

export function buildRestWeightOptions(
  input: RestWeightInput,
  language: AppLanguage,
  unitPreference: UnitPreference = 'kg',
): RestWeightOption[] {
  const { pickKg, lastKg } = input;
  if (pickKg === null || !Number.isFinite(pickKg) || pickKg <= 0) {
    return [];
  }

  const step =
    input.stepKg && Number.isFinite(input.stepKg) && input.stepKg > 0
      ? input.stepKg
      : REST_WEIGHT_STEP_KG;

  // Two decimals, because 61.25 - 2.5 arrives as 58.749999999999996.
  const round = (value: number) => Number(value.toFixed(2));
  const candidates = [round(pickKg - step), round(pickKg), round(pickKg + step)];

  return candidates
    // A negative or zero option is not a weight; on a light lift the row is
    // two options rather than three, which is honest and still a choice.
    .filter((loadKg) => loadKg > 0)
    .map((loadKg) => ({
      loadKg,
      label: formatWeight(loadKg, unitPreference),
      note:
        lastKg !== null && Math.abs(loadKg - lastKg) < 0.001
          ? t(language, 'guided.rest.sameAsLast')
          : null,
      isPick: Math.abs(loadKg - pickKg) < 0.001,
    }));
}
