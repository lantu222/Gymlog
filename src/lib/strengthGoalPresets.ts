import { bestForLift } from './liftIdentity';
import { StrengthGoal } from './strengthGoals';

/**
 * Ready-made targets — "penkki 100 kg" without typing anything.
 *
 * Setting a target used to require having already logged the lift: the sheet
 * offered the lifts you had trained, and asked for a number next to your
 * current best. That is a fine way to raise a target and a terrible way to set
 * a first one, because the reader with nothing logged — exactly the one a
 * target would help — was offered an empty list.
 *
 * So the list is fixed and the numbers are round, and none of them is a
 * recommendation: 100 / 150 / 200 is what people say out loud, which is the
 * only thing that makes a target a target. The app does not know what you
 * should aim at and does not pretend to; it knows what you picked, and it
 * measures it against your own best set.
 */

export interface StrengthGoalPreset {
  /** Matches ExerciseProgressSummary.name — the stored English name. */
  exerciseName: string;
  /** Round numbers, ascending. */
  targetsKg: readonly number[];
}

export const STRENGTH_GOAL_PRESETS: readonly StrengthGoalPreset[] = [
  { exerciseName: 'Back Squat', targetsKg: [100, 150, 200] },
  { exerciseName: 'Barbell Deadlift', targetsKg: [100, 150, 200] },
  { exerciseName: 'Bench Press', targetsKg: [100, 150, 200] },
  { exerciseName: 'Overhead Press', targetsKg: [40, 60, 80] },
  { exerciseName: 'Barbell Row', targetsKg: [60, 80, 100] },
];

export interface StrengthGoalPresetOption {
  targetKg: number;
  /** True when this exact target is the one already set for this lift. */
  selected: boolean;
  /**
   * True when the reader's best set already meets it. Not hidden — a target
   * you have passed is a fact worth showing next to one you have not, and
   * hiding it would leave a lift with three options one day and two the next
   * for no visible reason.
   */
  alreadyReached: boolean;
}

export interface StrengthGoalPresetRow {
  exerciseName: string;
  /** The reader's best logged working weight, or null if never lifted. */
  bestKg: number | null;
  /** The target already set for this lift, if any. */
  currentTargetKg: number | null;
  options: StrengthGoalPresetOption[];
}

/**
 * The rows the picker draws, with the reader's own numbers folded in.
 *
 * Every preset is always offered. The state on top of it — what you lift now,
 * what you have already aimed at — is what makes the list yours rather than a
 * price sheet.
 */
export function buildGoalPresetRows(
  bests: ReadonlyMap<string, number | null>,
  goals: readonly StrengthGoal[],
  /**
   * Same lift matcher the goals row uses. Without it this screen said "not
   * logged yet" beside a lift the row behind it was already showing progress
   * for — one of them reading the log by exact name, the other by lift.
   */
  matches?: (loggedName: string, liftName: string) => boolean,
): StrengthGoalPresetRow[] {
  const targetByName = new Map(goals.map((goal) => [goal.exerciseName, goal.targetKg]));

  return STRENGTH_GOAL_PRESETS.map((preset) => {
    const best = matches
      ? bestForLift(preset.exerciseName, bests, matches)
      : bests.get(preset.exerciseName) ?? null;
    const currentTargetKg = targetByName.get(preset.exerciseName) ?? null;
    return {
      exerciseName: preset.exerciseName,
      bestKg: best !== null && best > 0 ? best : null,
      currentTargetKg,
      options: preset.targetsKg.map((targetKg) => ({
        targetKg,
        selected: currentTargetKg === targetKg,
        alreadyReached: best !== null && best >= targetKg,
      })),
    };
  });
}
