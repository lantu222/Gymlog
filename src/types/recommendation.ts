import type { SetupFocusArea, SetupGoal, SetupLevel, SetupSecondaryOutcome, SetupEquipment } from './models';

export type TemplateFamilyId =
  | 'mass_hypertrophy'
  | 'powerbuilding'
  | 'strength_base'
  | 'full_body_minimal'
  | 'glute_priority'
  | 'athletic_recomp'
  | 'low_equipment'
  | 'joint_friendly';

export type RecommendationConfidence = 'high' | 'medium' | 'low';
export type RecommendationEquipmentTier = 'full_gym' | 'low_equipment';
export type RecommendationRecoveryDemand = 'low' | 'moderate' | 'high';
export type RecommendationStyleTag = 'heavy' | 'pump' | 'balanced' | 'express' | 'recovery' | 'conditioning';

export interface RecommendationInput {
  goal: SetupGoal;
  level: SetupLevel;
  daysPerWeek: number;
  equipment: SetupEquipment;
  secondaryOutcomes: SetupSecondaryOutcome[];
  focusAreas: SetupFocusArea[];
  weeklyMinutes: number | null;
  preferredSessionMinutes: number | null;
  wantsConsistency: boolean;
}

export interface RecommendationProgramDefinition {
  programId: string;
  familyId: TemplateFamilyId;
  supportedGoals: SetupGoal[];
  backupGoals: SetupGoal[];
  supportedLevels: SetupLevel[];
  equipmentTier: RecommendationEquipmentTier;
  recoveryDemand: RecommendationRecoveryDemand;
  styleTags: RecommendationStyleTag[];
  secondaryOutcomeTags: SetupSecondaryOutcome[];
  focusAreaTags: SetupFocusArea[];
  lowFriction: boolean;
  jointFriendly: boolean;
  daysPerWeek: number;
  estimatedSessionMinutes: number;
}

export interface RecommendationScoreBreakdown {
  goalAlignment: number;
  scheduleFit: number;
  equipmentFit: number;
  experienceFit: number;
  preferenceFit: number;
  focusFit: number;
}

export interface RecommendationCandidate {
  programId: string;
  familyId: TemplateFamilyId;
  score: number;
  breakdown: RecommendationScoreBreakdown;
}

export interface RecommendationProgrammeEasierWeek {
  week: number;
  reason: string;
}

export interface RecommendationProgrammeProfile {
  programId: string;
  familyId: TemplateFamilyId;
  blockLengthWeeks: number;
  progressionStyle: string;
  phaseLabels: string[];
  volumeProgression: string;
  intensityProgression: string;
  exerciseStability: string;
  easierWeek: RecommendationProgrammeEasierWeek;
}

export interface RecommendationResult {
  featuredProgramId: string;
  secondaryProgramId: string | null;
  alternativeProgramIds: string[];
  confidence: RecommendationConfidence;
  primaryFamilyId: TemplateFamilyId;
  scoredCandidates: RecommendationCandidate[];
}
