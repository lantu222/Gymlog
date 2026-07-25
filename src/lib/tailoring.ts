import { t } from './i18n';
import {
  AppLanguage,
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

export function getTrainingFeelTitle(value: TrainingFeelPreference, language: AppLanguage = 'en') {
  switch (value) {
    case 'easy':
      return t(language, 'tailor.feel.easy');
    case 'challenging':
      return t(language, 'tailor.feel.challenging');
    case 'intense':
      return t(language, 'tailor.feel.intense');
    case 'steady':
    default:
      return t(language, 'tailor.feel.steady');
  }
}

export function getTrainingFeelHint(value: TrainingFeelPreference, language: AppLanguage = 'en') {
  switch (value) {
    case 'easy':
      return t(language, 'tailor.feel.easyHint');
    case 'steady':
      return t(language, 'tailor.feel.steadyHint');
    case 'challenging':
      return t(language, 'tailor.feel.challengingHint');
    case 'intense':
      return t(language, 'tailor.feel.intenseHint');
    default:
      return t(language, 'tailor.feel.defaultHint');
  }
}

export function getWorkoutVarietyTitle(value: WorkoutVarietyPreference, language: AppLanguage = 'en') {
  switch (value) {
    case 'stable':
      return t(language, 'tailor.variety.stable');
    case 'varied':
      return t(language, 'tailor.variety.varied');
    case 'fresh':
      return t(language, 'tailor.variety.fresh');
    case 'balanced':
    default:
      return t(language, 'tailor.variety.balanced');
  }
}

export function getWorkoutVarietyHint(value: WorkoutVarietyPreference, language: AppLanguage = 'en') {
  switch (value) {
    case 'stable':
      return t(language, 'tailor.variety.stableHint');
    case 'balanced':
      return t(language, 'tailor.variety.balancedHint');
    case 'varied':
      return t(language, 'tailor.variety.variedHint');
    case 'fresh':
      return t(language, 'tailor.variety.freshHint');
    default:
      return t(language, 'tailor.variety.defaultHint');
  }
}

export function getExerciseModalityPreferenceTitle(
  value: ExerciseModalityPreference,
  language: AppLanguage = 'en',
) {
  switch (value) {
    case 'avoid':
      return t(language, 'tailor.modality.avoid');
    case 'prefer':
      return t(language, 'tailor.modality.prefer');
    case 'love':
      return t(language, 'tailor.modality.love');
    case 'neutral':
    default:
      return t(language, 'tailor.modality.neutral');
  }
}

export function getSetupEquipmentTitle(
  value: SetupEquipment | null | undefined,
  language: AppLanguage = 'en',
) {
  switch (value) {
    case 'gym':
      return t(language, 'setup.equip.gym');
    case 'home':
      return t(language, 'setup.equip.home');
    case 'minimal':
      return t(language, 'setup.equip.minimal');
    default:
      return t(language, 'setup.equip.default');
  }
}

export function getSetupEquipmentHint(
  value: SetupEquipment | null | undefined,
  language: AppLanguage = 'en',
) {
  switch (value) {
    case 'gym':
      return t(language, 'tailor.equipHint.gym');
    case 'home':
      return t(language, 'tailor.equipHint.home');
    case 'minimal':
      return t(language, 'tailor.equipHint.minimal');
    default:
      return t(language, 'tailor.equipHint.default');
  }
}

export function getJointSwapBiasTitle(value: JointSwapBias, language: AppLanguage = 'en') {
  switch (value) {
    case 'shoulders':
      return t(language, 'onb.area.shoulders');
    case 'elbows':
      return t(language, 'onb.area.elbows');
    case 'knees':
      return t(language, 'onb.area.knees');
    default:
      return t(language, 'tailor.joint.default');
  }
}

export function getJointSwapBiasHint(value: JointSwapBias, language: AppLanguage = 'en') {
  switch (value) {
    case 'shoulders':
      return t(language, 'tailor.jointHint.shoulders');
    case 'elbows':
      return t(language, 'tailor.jointHint.elbows');
    case 'knees':
      return t(language, 'tailor.jointHint.knees');
    default:
      return t(language, 'tailor.jointHint.default');
  }
}

export function getJointSwapPreferenceTitle(value: JointSwapPreference, language: AppLanguage = 'en') {
  switch (value) {
    case 'prefer':
      return t(language, 'tailor.modality.prefer');
    case 'prioritize':
      return t(language, 'tailor.swap.prioritize');
    case 'neutral':
    default:
      return t(language, 'tailor.modality.neutral');
  }
}

export function getJointSwapPreferenceHint(value: JointSwapPreference, language: AppLanguage = 'en') {
  switch (value) {
    case 'prefer':
      return t(language, 'tailor.swapHint.prefer');
    case 'prioritize':
      return t(language, 'tailor.swapHint.prioritize');
    case 'neutral':
    default:
      return t(language, 'tailor.swapHint.neutral');
  }
}

export function summarizeExercisePreferences(
  options: {
    trainingFeel: TrainingFeelPreference;
    workoutVariety: WorkoutVarietyPreference;
    freeWeights: ExerciseModalityPreference;
    bodyweight: ExerciseModalityPreference;
    machines: ExerciseModalityPreference;
  },
  language: AppLanguage = 'en',
) {
  const favoredModalities = [
    options.freeWeights === 'love' || options.freeWeights === 'prefer'
      ? t(language, 'tailor.mod.freeWeights')
      : null,
    options.bodyweight === 'love' || options.bodyweight === 'prefer'
      ? t(language, 'tailor.mod.bodyweight')
      : null,
    options.machines === 'love' || options.machines === 'prefer'
      ? t(language, 'tailor.mod.machines')
      : null,
  ].filter((value): value is string => Boolean(value));

  const favoredSummary =
    favoredModalities.length > 0
      ? favoredModalities.slice(0, 2).join(' + ')
      : t(language, 'tailor.noBias');

  return t(language, 'tailor.prefSummary', {
    feel: getTrainingFeelTitle(options.trainingFeel, language),
    variety: getWorkoutVarietyTitle(options.workoutVariety, language),
    favored: favoredSummary,
  });
}

export function summarizeJointSwapPreferences(
  options: {
    shoulders: JointSwapPreference;
    elbows: JointSwapPreference;
    knees: JointSwapPreference;
  },
  language: AppLanguage = 'en',
) {
  const active = [
    options.shoulders === 'neutral'
      ? null
      : t(
          language,
          options.shoulders === 'prioritize' ? 'tailor.swap.shoulderPriority' : 'tailor.swap.shoulderPrefer',
        ),
    options.elbows === 'neutral'
      ? null
      : t(language, options.elbows === 'prioritize' ? 'tailor.swap.elbowPriority' : 'tailor.swap.elbowPrefer'),
    options.knees === 'neutral'
      ? null
      : t(language, options.knees === 'prioritize' ? 'tailor.swap.kneePriority' : 'tailor.swap.kneePrefer'),
  ].filter((value): value is string => Boolean(value));

  if (active.length === 0) {
    return t(language, 'tailor.swap.neutralRanking');
  }

  if (active.length === 1) {
    return active[0];
  }

  if (active.length === 2) {
    return `${active[0]} | ${active[1]}`;
  }

  return t(language, 'tailor.swap.andMore', { first: active[0], count: active.length - 1 });
}
