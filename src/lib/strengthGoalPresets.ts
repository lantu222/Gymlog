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
