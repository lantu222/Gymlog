import { getWorkoutTemplateById } from '../features/workout/workoutCatalog';
import type { SetupFocusArea, SetupGoal, SetupLevel, SetupSecondaryOutcome } from '../types/models';
import type { RecommendationProgramDefinition, TemplateFamilyId } from '../types/recommendation';

function defineProgram(
  programId: string,
  config: {
    familyId: TemplateFamilyId;
    supportedGoals: SetupGoal[];
    backupGoals?: SetupGoal[];
    supportedLevels: SetupLevel[];
    equipmentTier: RecommendationProgramDefinition['equipmentTier'];
    recoveryDemand: RecommendationProgramDefinition['recoveryDemand'];
    styleTags: RecommendationProgramDefinition['styleTags'];
    secondaryOutcomeTags?: SetupSecondaryOutcome[];
    focusAreaTags?: SetupFocusArea[];
    lowFriction?: boolean;
    jointFriendly?: boolean;
  },
): RecommendationProgramDefinition {
  const template = getWorkoutTemplateById(programId);
  if (!template) {
    throw new Error(`Unknown recommendation program: ${programId}`);
  }

  return {
    programId,
    familyId: config.familyId,
    supportedGoals: config.supportedGoals,
    backupGoals: config.backupGoals ?? [],
    supportedLevels: config.supportedLevels,
    equipmentTier: config.equipmentTier,
    recoveryDemand: config.recoveryDemand,
    styleTags: config.styleTags,
    secondaryOutcomeTags: config.secondaryOutcomeTags ?? [],
    focusAreaTags: config.focusAreaTags ?? [],
    lowFriction: config.lowFriction ?? false,
    jointFriendly: config.jointFriendly ?? false,
    daysPerWeek: template.daysPerWeek,
    estimatedSessionMinutes: template.estimatedSessionDuration,
  };
}

export const RECOMMENDATION_PROGRAMS: RecommendationProgramDefinition[] = [
  defineProgram('tpl_2_day_minimal_full_body_v1', {
    familyId: 'full_body_minimal',
    supportedGoals: ['general'],
    backupGoals: ['muscle', 'strength'],
    supportedLevels: ['beginner', 'intermediate'],
    equipmentTier: 'low_equipment',
    recoveryDemand: 'low',
    styleTags: ['express', 'balanced'],
    secondaryOutcomeTags: ['consistency'],
    focusAreaTags: ['core', 'legs'],
    lowFriction: true,
    jointFriendly: true,
  }),
  defineProgram('tpl_2_day_beginner_strength_v1', {
    familyId: 'strength_base',
    supportedGoals: ['strength'],
    backupGoals: ['general'],
    supportedLevels: ['beginner'],
    equipmentTier: 'full_gym',
    recoveryDemand: 'moderate',
    styleTags: ['heavy', 'express'],
    secondaryOutcomeTags: ['consistency', 'strength'],
    focusAreaTags: ['legs', 'chest', 'back'],
    lowFriction: true,
  }),
  defineProgram('tpl_3_day_strength_base_v1', {
    familyId: 'strength_base',
    supportedGoals: ['strength'],
    backupGoals: ['muscle', 'general'],
    supportedLevels: ['beginner', 'intermediate'],
    equipmentTier: 'full_gym',
    recoveryDemand: 'moderate',
    styleTags: ['heavy', 'balanced'],
    secondaryOutcomeTags: ['strength', 'consistency'],
    focusAreaTags: ['legs', 'chest', 'back'],
  }),
  defineProgram('tpl_4_day_strength_size_v1', {
    familyId: 'powerbuilding',
    supportedGoals: ['strength'],
    backupGoals: ['general'],
    supportedLevels: ['intermediate'],
    equipmentTier: 'full_gym',
    recoveryDemand: 'moderate',
    styleTags: ['heavy', 'balanced'],
    secondaryOutcomeTags: ['strength', 'muscle'],
    focusAreaTags: ['legs', 'chest', 'back', 'shoulders'],
  }),
  defineProgram('tpl_4_day_powerbuilding_v1', {
    familyId: 'powerbuilding',
    supportedGoals: ['strength', 'muscle'],
    backupGoals: ['general'],
    supportedLevels: ['intermediate'],
    equipmentTier: 'full_gym',
    recoveryDemand: 'high',
    styleTags: ['heavy', 'pump'],
    secondaryOutcomeTags: ['strength', 'muscle'],
    focusAreaTags: ['legs', 'chest', 'back', 'arms'],
  }),
  defineProgram('tpl_3_day_upper_lower_lite_v1', {
    familyId: 'athletic_recomp',
    supportedGoals: ['general'],
    backupGoals: ['strength', 'muscle'],
    supportedLevels: ['beginner', 'intermediate'],
    equipmentTier: 'full_gym',
    recoveryDemand: 'low',
    styleTags: ['balanced', 'express'],
    secondaryOutcomeTags: ['consistency'],
    focusAreaTags: ['arms', 'back', 'chest'],
    lowFriction: true,
    jointFriendly: true,
  }),
  defineProgram('tpl_3_day_full_body_v1', {
    familyId: 'full_body_minimal',
    supportedGoals: ['general'],
    backupGoals: ['muscle'],
    supportedLevels: ['beginner', 'intermediate'],
    equipmentTier: 'full_gym',
    recoveryDemand: 'moderate',
    styleTags: ['balanced', 'express'],
    secondaryOutcomeTags: ['consistency'],
    focusAreaTags: ['legs', 'chest', 'back'],
    lowFriction: true,
  }),
  defineProgram('tpl_3_day_push_pull_legs_v1', {
    familyId: 'mass_hypertrophy',
    supportedGoals: ['muscle'],
    backupGoals: ['strength'],
    supportedLevels: ['intermediate'],
    equipmentTier: 'full_gym',
    recoveryDemand: 'moderate',
    styleTags: ['pump', 'balanced'],
    secondaryOutcomeTags: ['muscle'],
    focusAreaTags: ['chest', 'back', 'arms', 'legs'],
  }),
  defineProgram('tpl_4_day_muscle_builder_v1', {
    familyId: 'mass_hypertrophy',
    supportedGoals: ['muscle'],
    backupGoals: ['general'],
    supportedLevels: ['beginner', 'intermediate'],
    equipmentTier: 'full_gym',
    recoveryDemand: 'moderate',
    styleTags: ['pump', 'balanced'],
    secondaryOutcomeTags: ['muscle'],
    focusAreaTags: ['glutes', 'legs', 'chest', 'back'],
    jointFriendly: true,
  }),
  defineProgram('tpl_4_day_upper_lower_v1', {
    familyId: 'mass_hypertrophy',
    supportedGoals: ['muscle'],
    backupGoals: ['general', 'strength'],
    supportedLevels: ['intermediate'],
    equipmentTier: 'full_gym',
    recoveryDemand: 'moderate',
    styleTags: ['balanced', 'pump'],
    secondaryOutcomeTags: ['muscle'],
    focusAreaTags: ['legs', 'chest', 'back'],
  }),
  defineProgram('tpl_5_day_hybrid_v1', {
    familyId: 'mass_hypertrophy',
    supportedGoals: ['muscle'],
    backupGoals: ['strength'],
    supportedLevels: ['intermediate'],
    equipmentTier: 'full_gym',
    recoveryDemand: 'high',
    styleTags: ['balanced', 'pump', 'heavy'],
    secondaryOutcomeTags: ['muscle'],
    focusAreaTags: ['chest', 'back', 'arms', 'legs'],
  }),
  defineProgram('tpl_2_day_mobility_reset_v1', {
    familyId: 'joint_friendly',
    supportedGoals: ['general', 'run_mobility'],
    backupGoals: [],
    supportedLevels: ['beginner', 'intermediate'],
    equipmentTier: 'low_equipment',
    recoveryDemand: 'low',
    styleTags: ['recovery', 'express'],
    secondaryOutcomeTags: ['mobility', 'consistency'],
    focusAreaTags: ['conditioning'],
    lowFriction: true,
    jointFriendly: true,
  }),
  defineProgram('tpl_2_day_yoga_recovery_v1', {
    familyId: 'joint_friendly',
    supportedGoals: ['run_mobility'],
    backupGoals: ['general'],
    supportedLevels: ['beginner', 'intermediate'],
    equipmentTier: 'low_equipment',
    recoveryDemand: 'low',
    styleTags: ['recovery'],
    secondaryOutcomeTags: ['mobility', 'consistency'],
    focusAreaTags: ['conditioning'],
    lowFriction: true,
    jointFriendly: true,
  }),
  defineProgram('tpl_3_day_run_mobility_v1', {
    familyId: 'athletic_recomp',
    supportedGoals: ['run_mobility', 'general'],
    backupGoals: [],
    supportedLevels: ['beginner', 'intermediate'],
    equipmentTier: 'low_equipment',
    recoveryDemand: 'moderate',
    styleTags: ['conditioning', 'balanced'],
    secondaryOutcomeTags: ['conditioning', 'mobility'],
    focusAreaTags: ['conditioning'],
    jointFriendly: true,
  }),
];

export function getRecommendationProgramDefinition(programId: string) {
  return RECOMMENDATION_PROGRAMS.find((entry) => entry.programId === programId) ?? null;
}
