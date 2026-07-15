import type { SetupFocusArea, SetupGoal, SetupLevel, SetupSecondaryOutcome, SetupEquipment, SetupGender } from './models';
import type { RecommendationProfile } from '../lib/recommendationProfile';

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
export type RecommendationWeekRole = 'baseline' | 'build' | 'review';
export type RecommendationEquipmentTier = 'full_gym' | 'low_equipment';
export type RecommendationRecoveryDemand = 'low' | 'moderate' | 'high';
export type RecommendationStyleTag = 'heavy' | 'pump' | 'balanced' | 'express' | 'recovery' | 'conditioning';
export type RecommendationTargetGender = 'male' | 'female' | 'unisex';
export type RecommendationProgrammeDurationStatus = 'starter' | 'standard' | 'long_catalog' | 'advanced_reference';
export type RecommendationSessionBlockType = 'prep' | 'main' | 'support' | 'focus' | 'conditioning' | 'cooldown';

export interface RecommendationInput {
  goal: SetupGoal;
  level: SetupLevel;
  daysPerWeek: number;
  equipment: SetupEquipment;
  gender: SetupGender;
  profile: RecommendationProfile;
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
  targetGender: RecommendationTargetGender;
  daysPerWeek: number;
  estimatedSessionMinutes: number;
}

export interface RecommendationScoreBreakdown {
  goalAlignment: number;
  scheduleFit: number;
  equipmentFit: number;
  experienceFit: number;
  genderFit: number;
  preferenceFit: number;
  focusFit: number;
  contentFit: number;
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

export interface RecommendationProgrammeDurationModel {
  status: RecommendationProgrammeDurationStatus;
  blockLengthWeeks: number;
  label: string;
  description: string;
  laterDurations: number[];
}

export interface RecommendationSessionBlock {
  type: RecommendationSessionBlockType;
  label: string;
  body: string;
}

export interface RecommendationSessionComposition {
  prepBlock: RecommendationSessionBlock;
  mainBlock: RecommendationSessionBlock;
  supportBlock: RecommendationSessionBlock;
  focusBlock: RecommendationSessionBlock | null;
  conditioningBlock: RecommendationSessionBlock | null;
  cooldownBlock: RecommendationSessionBlock;
}

export interface RecommendationProgrammeProfile {
  programId: string;
  familyId: TemplateFamilyId;
  blockLengthWeeks: number;
  durationModel: RecommendationProgrammeDurationModel;
  sessionComposition: RecommendationSessionComposition;
  progressionStyle: string;
  phaseLabels: string[];
  volumeProgression: string;
  intensityProgression: string;
  exerciseStability: string;
  easierWeek: RecommendationProgrammeEasierWeek;
}

export interface RecommendationTrainingBlock {
  blockLengthWeeks: number;
  currentWeek: number;
  currentWeekRole: RecommendationWeekRole;
  weekRoles: RecommendationWeekRole[];
  summary: string;
  nextWeekAction: string;
}

export type RecommendationPlanReadyScheduleDaySource = 'template' | 'suggested';

export interface RecommendationPlanReadyScheduleDay {
  id: string;
  weekdayLabel: string;
  name: string;
  meta: string;
  keyLifts: string[];
  source: RecommendationPlanReadyScheduleDaySource;
  note: string | null;
}

export interface RecommendationPlanReadyWeekPhase {
  week: number;
  role: RecommendationWeekRole;
  label: string;
  body: string;
}

export interface RecommendationPlanReadyPayload {
  programId: string;
  title: string;
  subtitle: string;
  blockLengthWeeks: number;
  durationModel: RecommendationProgrammeDurationModel;
  requestedDaysPerWeek: number;
  programDaysPerWeek: number;
  whyThisPlan: string[];
  planOverview: string[];
  weeklySchedule: RecommendationPlanReadyScheduleDay[];
  fourWeekProgression: RecommendationPlanReadyWeekPhase[];
  sessionComposition: RecommendationSessionComposition;
  sessionBlocks: RecommendationSessionBlock[];
  prepSummary: string;
  cooldownSummary: string;
  howToProgress: string;
  focusAllocation: string;
  readinessGuardrail: string;
  firstAction: string;
  fallbackReason: string | null;
}

export type RecommendationWaterfallRule =
  | 'home_equipment'
  | 'run_mobility'
  | 'beginner_first'
  | 'female_targeted'
  | 'lean_athletic'
  | 'muscle_focus'
  | 'muscle'
  | 'strength'
  | 'general'
  | 'fallback';

export interface RecommendationWaterfallDecision {
  rule: RecommendationWaterfallRule;
  primaryProgramId: string;
  alternativeProgramId: string | null;
  whyPrimary: string;
  whyAlternative: string | null;
}

export interface RecommendationResult {
  featuredProgramId: string;
  secondaryProgramId: string | null;
  alternativeProgramIds: string[];
  confidence: RecommendationConfidence;
  recommendationConfidence: number;
  fallbackReason: string | null;
  trainingBlock: RecommendationTrainingBlock;
  primaryFamilyId: TemplateFamilyId;
  scoredCandidates: RecommendationCandidate[];
  waterfall: RecommendationWaterfallDecision | null;
}
