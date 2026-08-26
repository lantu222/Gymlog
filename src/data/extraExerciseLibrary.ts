import { ExerciseLibraryItem } from '../types/models';

/**
 * Exercises the upstream database does not carry, but real gyms do.
 *
 * `generatedExerciseLibrary.ts` is rewritten wholesale by `npm run
 * exercise:sync`, so nothing added there survives. This file is the layer that
 * does — the same arrangement as `EXERCISE_NAME_FI` in exerciseNameLabel.ts and
 * the Finnish steps in exerciseInstructions.ts.
 *
 * The bar for adding one is a reader who looked for it and did not find it, not
 * a gap in a list. An entry here has no photo, and a row without a photo is
 * worse than one with — so it earns its place by being a machine or a variation
 * people actually train, and it is written with its own instructions rather
 * than pointed at a near neighbour whose steps describe different equipment.
 */
export const EXTRA_EXERCISE_LIBRARY: ExerciseLibraryItem[] = [
  {
    // The hip thrust machine. The swap list under "Lantionnosto tangolla"
    // offered the banded, bodyweight and single-leg versions but not the one
    // sitting in the gym (user 2026-08-26).
    //
    // Not an alias to Barbell Hip Thrust: the position is the same, but the
    // barbell entry's steps are three sentences about rolling a loaded bar
    // over your hips and padding it — instructions for equipment this reader
    // is deliberately not using.
    id: 'extra_machine_hip_thrust',
    name: 'Machine Hip Thrust',
    category: 'compound',
    bodyPart: 'glutes',
    equipment: 'machine',
    primaryMuscles: ['glutes'],
    secondaryMuscles: ['hamstrings'],
    instructions: [
      'Sit into the machine with your back against the pad and the lap belt or bar across your hips, just below the hip bones.',
      'Set the seat so your shins are vertical at the top of the movement, and drive through your heels to extend your hips.',
      'Squeeze the glutes at the top without arching your lower back, then lower under control until the weight is almost resting.',
    ],
  },
];
