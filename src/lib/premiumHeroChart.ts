import { UnitPreference } from '../types/models';
import { formatLiftDisplayLabel } from './displayLabel';
import { convertWeightFromKg } from './format';
import { ExerciseProgressSummary } from './progression';

// The Adaptive Coach's typical micro-progression step, used to draw the dashed
// "coach's next step" segment past the real history line.
const COACH_INCREMENT_KG = 2.5;

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
    liftName: formatLiftDisplayLabel(best.summary.name),
    points,
    latest: points[points.length - 1],
    projectedNext: convertWeightFromKg(latestKg + COACH_INCREMENT_KG, unitPreference),
    sessions: points.length,
  };
}
