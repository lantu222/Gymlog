/**
 * NOT RENDERED TODAY.
 *
 * The Pro page's v2 hero charted the reader's own working weight with the
 * coach's next step dashed on the end. v3 (design: "Vinha Pro v3 — tumma")
 * replaced that hero with a statement, and the personal proof moved to the
 * paywall moments on Home and in the coach chat, where the wall is actually
 * hit. Nothing calls this function now.
 *
 * It is kept, tested and pure rather than deleted because the decision that
 * orphaned it is a layout decision, not a claim that turned out false — if the
 * chart comes back to the hero, or lands on the unlock moment, this is the
 * module that draws it honestly. proSurfaces.test.cjs asserts App.tsx does not
 * call it, so it cannot quietly become a value computed and never read.
 */
import { AppLanguage, UnitPreference } from '../types/models';
import { formatLiftDisplayLabel } from './displayLabel';
import { exerciseNameLabel } from './exerciseNameLabel';
import { convertWeightFromKg } from './format';
import { ExerciseProgressSummary } from './progression';
import { getLoadIncrementKg } from './workoutIntelligence';

export interface PremiumHeroChart {
  /** Display name of the tracked lift the chart is built from. */
  liftName: string;
  /** Working weights in the user's unit, oldest → newest. */
  points: number[];
  /** Latest logged working weight, in the user's unit. */
  latest: number;
  /** Coach's illustrative next step (latest + increment), in the user's unit. */
  projectedNext: number;
  /** Number of logged points behind the chart. */
  sessions: number;
}

/**
 * Picks the richest tracked-lift history for the Premium hero chart and returns
 * its real working-weight series plus the coach's next-step projection. Returns
 * null when no tracked lift has enough history to draw a trend, so the screen
 * can fall back to a neutral state for fresh users.
 */
export function buildPremiumHeroChart(
  summaries: ExerciseProgressSummary[],
  unitPreference: UnitPreference,
  /**
   * Needed because the name is shown, not just carried. Without it the Pro
   * hero asked "Miten Barbell Bench Press - Medium Grip etenee?" in Finnish,
   * quoting the raw library name while the logger and the workout summary two
   * taps away both said "Penkkipunnerrus" (seen on the phone). Localizing here
   * rather than at the call site means the next consumer cannot forget.
   */
  language: AppLanguage = 'en',
): PremiumHeroChart | null {
  let best: { summary: ExerciseProgressSummary; weightsKg: number[] } | null = null;

  for (const summary of summaries) {
    const weightsKg = [...summary.logs]
      .reverse()
      .map((log) => log.weight)
      .filter((weight): weight is number => typeof weight === 'number' && Number.isFinite(weight) && weight > 0);

    if (weightsKg.length < 2) {
      continue;
    }

    if (!best || weightsKg.length > best.weightsKg.length) {
      best = { summary, weightsKg };
    }
  }

  if (!best) {
    return null;
  }

  const points = best.weightsKg.map((weightKg) => convertWeightFromKg(weightKg, unitPreference));
  const latestKg = best.weightsKg[best.weightsKg.length - 1];

  return {
    liftName: exerciseNameLabel(language, formatLiftDisplayLabel(best.summary.name)),
    points,
    latest: points[points.length - 1],
    // The coach's real micro-progression step (2.5 kg, or 5 lb for lb users).
    projectedNext: convertWeightFromKg(latestKg + getLoadIncrementKg(unitPreference), unitPreference),
    sessions: points.length,
  };
}
