import {
  ExerciseModalityPreference,
  JointSwapBias,
  JointSwapPreference,
  SetupEquipment,
  TrainingFeelPreference,
  WorkoutVarietyPreference,
} from '../types/models';

export const TRAINING_FEEL_OPTIONS: TrainingFeelPreference[] = [
  'easy',
  'steady',
  'challenging',
  'intense',
];

export const WORKOUT_VARIETY_OPTIONS: WorkoutVarietyPreference[] = [
  'stable',
  'balanced',
  'varied',
  'fresh',
];

export const EXERCISE_MODALITY_OPTIONS: ExerciseModalityPreference[] = [
  'avoid',
  'neutral',
  'prefer',
  'love',
];

export const JOINT_SWAP_BIAS_OPTIONS: JointSwapBias[] = ['shoulders', 'elbows', 'knees'];
export const JOINT_SWAP_PREFERENCE_OPTIONS: JointSwapPreference[] = ['neutral', 'prefer', 'prioritize'];

export function getTrainingFeelTitle(value: TrainingFeelPreference) {
  switch (value) {
    case 'easy':
      return 'Easy';
    case 'steady':
      return 'Steady';
    case 'challenging':
      return 'Challenging';
    case 'intense':
      return 'Intense';
    default:
      return 'Steady';
  }
}

export function getTrainingFeelHint(value: TrainingFeelPreference) {
  switch (value) {
    case 'easy':
      return 'Keep the work lighter.';
    case 'steady':
      return 'Push, but stay repeatable.';
    case 'challenging':
      return 'Make the main sets count.';
    case 'intense':
      return 'Let hard work lead.';
    default:
      return 'Stay consistent.';
  }
}

export function getWorkoutVarietyTitle(value: WorkoutVarietyPreference) {
  switch (value) {
    case 'stable':
      return 'Stable';
    case 'balanced':
      return 'Balanced';
    case 'varied':
      return 'Varied';
    case 'fresh':
      return 'Fresh';
    default:
      return 'Balanced';
  }
}

export function getWorkoutVarietyHint(value: WorkoutVarietyPreference) {
  switch (value) {
    case 'stable':
      return 'Keep the exercise menu tight.';
    case 'balanced':
      return 'Repeat the main lifts, rotate the rest.';
    case 'varied':
      return 'Mix the week more often.';
    case 'fresh':
      return 'Keep sessions feeling new.';
    default:
      return 'Keep the week adaptable.';
  }
}

export function getExerciseModalityPreferenceTitle(value: ExerciseModalityPreference) {
  switch (value) {
    case 'avoid':
      return 'Avoid';
    case 'neutral':
      return 'Neutral';
    case 'prefer':
      return 'Prefer';
    case 'love':
      return 'Love';
    default:
      return 'Neutral';
  }
}

export function getSetupEquipmentTitle(value: SetupEquipment | null | undefined) {
  switch (value) {
    case 'gym':
      return 'Full gym';
    case 'home':
      return 'Home setup';
    case 'minimal':
      return 'Minimal setup';
    default:
      return 'Equipment';
  }
}

export function getSetupEquipmentHint(value: SetupEquipment | null | undefined) {
  switch (value) {
    case 'gym':
      return 'Assume broad equipment access.';
    case 'home':
      return 'Keep it friendlier for a home setup.';
    case 'minimal':
      return 'Favor lighter, simpler equipment.';
    default:
      return 'Pick the setup Gymlog should assume most weeks.';
  }
}

export function getJointSwapBiasTitle(value: JointSwapBias) {
  switch (value) {
    case 'shoulders':
      return 'Shoulders';
    case 'elbows':
      return 'Elbows';
    case 'knees':
      return 'Knees';
    default:
      return 'Joint';
  }
}

export function getJointSwapBiasHint(value: JointSwapBias) {
  switch (value) {
    case 'shoulders':
      return 'Bias away from rough pressing angles.';
    case 'elbows':
      return 'Prefer friendlier curls, pushdowns, and pulls.';
    case 'knees':
      return 'Prefer gentler squat and single-leg options.';
    default:
      return 'Bias swaps toward friendlier options.';
  }
}

export function getJointSwapPreferenceTitle(value: JointSwapPreference) {
  switch (value) {
    case 'neutral':
      return 'Neutral';
    case 'prefer':
      return 'Prefer';
    case 'prioritize':
      return 'Prioritize';
    default:
      return 'Neutral';
  }
}

export function getJointSwapPreferenceHint(value: JointSwapPreference) {
  switch (value) {
    case 'neutral':
      return 'Keep swaps balanced.';
    case 'prefer':
      return 'Push friendlier options higher.';
    case 'prioritize':
      return 'Protect this joint first.';
    default:
      return 'Keep swaps balanced.';
  }
}

export function summarizeExercisePreferences(options: {
  trainingFeel: TrainingFeelPreference;
  workoutVariety: WorkoutVarietyPreference;
  freeWeights: ExerciseModalityPreference;
  bodyweight: ExerciseModalityPreference;
  machines: ExerciseModalityPreference;
}) {
  const favoredModalities = [
    options.freeWeights === 'love' || options.freeWeights === 'prefer' ? 'free weights' : null,
    options.bodyweight === 'love' || options.bodyweight === 'prefer' ? 'bodyweight' : null,
    options.machines === 'love' || options.machines === 'prefer' ? 'machines' : null,
  ].filter((value): value is string => Boolean(value));

  const favoredSummary =
    favoredModalities.length > 0 ? favoredModalities.slice(0, 2).join(' + ') : 'no strong equipment bias';

  return `${getTrainingFeelTitle(options.trainingFeel)} work | ${getWorkoutVarietyTitle(options.workoutVariety)} week | ${favoredSummary}`;
}

export function summarizeJointSwapPreferences(options: {
  shoulders: JointSwapPreference;
  elbows: JointSwapPreference;
  knees: JointSwapPreference;
}) {
  const active = [
    options.shoulders === 'neutral'
      ? null
      : options.shoulders === 'prioritize'
        ? 'Shoulder priority'
        : 'Shoulders prefer',
    options.elbows === 'neutral'
      ? null
      : options.elbows === 'prioritize'
        ? 'Elbow priority'
        : 'Elbows prefer',
    options.knees === 'neutral'
      ? null
      : options.knees === 'prioritize'
        ? 'Knee priority'
        : 'Knees prefer',
  ].filter((value): value is string => Boolean(value));

  if (active.length === 0) {
    return 'Neutral swap ranking';
  }

  if (active.length === 1) {
    return active[0];
  }

  if (active.length === 2) {
    return `${active[0]} | ${active[1]}`;
  }

  return `${active[0]} + ${active.length - 1} more`;
}
