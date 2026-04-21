export type UnitPreference = 'kg' | 'lb';
export type ThemePreference = 'dark';
export type AppLanguage = 'en' | 'fi';
export type SignInMethod = 'apple' | 'email' | 'local' | 'google';
export type AccessTier = 'free' | 'premium';
export type SetupGender = 'male' | 'female' | 'unspecified';
export type SetupAgeRange = 'unspecified' | '18' | '19_25' | '26_30' | '31_40' | '41_plus';
export type SetupGoal = 'strength' | 'muscle' | 'general' | 'run_mobility';
export type SetupLevel = 'beginner' | 'intermediate';
export type SetupDaysPerWeek = 2 | 3 | 4 | 5;
export type SetupEquipment = 'gym' | 'minimal' | 'home';
export type SetupSecondaryOutcome = 'consistency' | 'mobility' | 'conditioning' | 'muscle' | 'strength';
export type SetupFocusArea =
  | 'bodyweight'
  | 'glutes'
  | 'legs'
  | 'chest'
  | 'shoulders'
  | 'back'
  | 'arms'
  | 'core'
  | 'conditioning';
export type SetupGuidanceMode = 'done_for_me' | 'guided_editable' | 'self_directed';
export type SetupScheduleMode = 'app_managed' | 'self_managed';
export type SetupWeekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type TrainingFeelPreference = 'easy' | 'steady' | 'challenging' | 'intense';
export type WorkoutVarietyPreference = 'stable' | 'balanced' | 'varied' | 'fresh';
export type ExerciseModalityPreference = 'avoid' | 'neutral' | 'prefer' | 'love';
export type JointSwapBias = 'shoulders' | 'elbows' | 'knees';
export type JointSwapPreference = 'neutral' | 'prefer' | 'prioritize';
export type WorkoutPlanMode = 'weekday' | 'rotation';
export type ExerciseCategory = 'compound' | 'isolation' | 'cardio' | 'core';
export type ExerciseBodyPart =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'legs'
  | 'biceps'
  | 'triceps'
  | 'core'
  | 'glutes'
  | 'full body';
export type ExerciseEquipment = 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight';
export type ExerciseSetKind = 'working' | 'warmup' | 'drop';
export type ExerciseSetOutcome = 'completed' | 'failed' | 'skipped';
export type ExerciseLogSetStatus = 'pending' | 'completed' | 'skipped';
export type ExerciseLogSetEffort = 'easy' | 'good' | 'hard';
export type ExerciseLogStatus = 'active' | 'completed' | 'skipped' | 'swapped';
export type MeasurementKind = 'bodyfat' | 'shoulders' | 'chest' | 'waist' | 'hips' | 'thighs';
export type MeasurementUnit = 'cm' | 'in' | '%';
export type AiPlannerGoal = 'strength' | 'muscle' | 'fat_loss' | 'fitness';
export type AiPlannerDaysPerWeek = 1 | 2 | 3 | 4;
export type AiPlannerExperience = 'beginner' | 'intermediate' | 'advanced';
export type AiPlannerEquipment = 'full_gym' | 'home_gym' | 'minimal' | 'bodyweight';
export type AiPlannerRecovery = 'low' | 'moderate' | 'high';

export interface WorkoutTemplateSessionRecord {
  id: string;
  name: string;
  orderIndex: number;
  exerciseIds: string[];
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  exerciseIds: string[];
  sessions: WorkoutTemplateSessionRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface ExerciseTemplate {
  id: string;
  workoutTemplateId: string;
  workoutTemplateSessionId: string;
  name: string;
  targetSets: number;
  repMin: number;
  repMax: number;
  restSeconds: number | null;
  trackedDefault: boolean;
  orderIndex: number;
  libraryItemId?: string | null;
  persistedExerciseTemplateId?: string | null;
}

export interface WorkoutTemplateSessionWithExercises extends WorkoutTemplateSessionRecord {
  exercises: ExerciseTemplate[];
}

export interface WorkoutPlanEntry {
  id: string;
  workoutTemplateId: string;
  label: string;
  orderIndex: number;
}

export interface WorkoutPlan {
  id: string;
  name: string;
  mode: WorkoutPlanMode;
  entries: WorkoutPlanEntry[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ExerciseLibraryItem {
  id: string;
  name: string;
  category: ExerciseCategory;
  bodyPart: ExerciseBodyPart;
  equipment: ExerciseEquipment;
  primaryMuscles?: string[];
  secondaryMuscles?: string[];
  instructions?: string[];
  imageUrls?: string[];
  sourceCategory?: string | null;
  sourceEquipment?: string | null;
  sourceMechanic?: string | null;
  sourceLevel?: string | null;
}

export interface ExerciseLogSet {
  orderIndex: number;
  weight: number;
  reps: number;
  kind: ExerciseSetKind;
  outcome: ExerciseSetOutcome | null;
  status?: ExerciseLogSetStatus;
  effort?: ExerciseLogSetEffort | null;
  completedAt?: string | null;
  skippedReason?: string | null;
}

export interface WorkoutSession {
  id: string;
  workoutTemplateId: string;
  workoutNameSnapshot: string;
  sessionNotes?: string | null;
  performedAt: string;
  startedAt?: string;
  durationMinutes?: number;
  setsCompleted?: number;
  exercisesCompleted?: number;
  exercisesSkipped?: number;
  exercisesSwapped?: number;
  totalVolumeKg?: number;
  trackedExercisesUpdated?: number;
  noteCount?: number;
  sessionInsertedCount?: number;
  legacyShapeMismatches?: string[];
}

export interface ExerciseLog {
  id: string;
  sessionId: string;
  exerciseTemplateId: string | null;
  exerciseNameSnapshot: string;
  weight: number;
  repsPerSet: number[];
  sets?: ExerciseLogSet[];
  tracked: boolean;
  orderIndex: number;
  skipped?: boolean;
  sessionInserted?: boolean;
  status?: ExerciseLogStatus;
  slotId?: string | null;
  templateSlotId?: string | null;
  templateExerciseId?: string | null;
  notes?: string | null;
  swappedFrom?: string | null;
}

export interface BodyweightEntry {
  id: string;
  recordedAt: string;
  weight: number;
}

export interface MeasurementEntry {
  id: string;
  kind: MeasurementKind;
  recordedAt: string;
  value: number;
  unit: MeasurementUnit;
}

export interface AppPreferences {
  appLanguage: AppLanguage;
  unitPreference: UnitPreference;
  theme: ThemePreference;
  defaultRestSeconds: number;
  autoFocusNextInput: boolean;
  keepScreenAwakeDuringWorkout: boolean;
  adaptiveCoachPremiumUnlocked: boolean;
  aiSetupCompleted: boolean;
  entryFlowCompleted: boolean;
  trainingFirstRunDismissed: boolean;
  selectedSignInMethod: SignInMethod | null;
  selectedAccessTier: AccessTier | null;
  setupCurrentWeightKg: number | null;
  bodyweightGoalKg: number | null;
  onboardingCompleted: boolean;
  setupCompleted: boolean;
  setupGender: SetupGender | null;
  setupAge: number | null;
  setupAgeRange: SetupAgeRange | null;
  setupGoal: SetupGoal | null;
  setupGoals: SetupGoal[];
  setupLevel: SetupLevel | null;
  setupDaysPerWeek: SetupDaysPerWeek | null;
  setupEquipment: SetupEquipment | null;
  setupSecondaryOutcomes: SetupSecondaryOutcome[];
  setupFocusAreas: SetupFocusArea[];
  setupGuidanceMode: SetupGuidanceMode | null;
  setupScheduleMode: SetupScheduleMode | null;
  setupWeeklyMinutes: number | null;
  setupAvailableDays: SetupWeekday[];
  setupTrainingFeel: TrainingFeelPreference;
  setupWorkoutVariety: WorkoutVarietyPreference;
  setupFreeWeightsPreference: ExerciseModalityPreference;
  setupBodyweightPreference: ExerciseModalityPreference;
  setupMachinesPreference: ExerciseModalityPreference;
  setupShoulderFriendlySwaps: JointSwapPreference;
  setupElbowFriendlySwaps: JointSwapPreference;
  setupKneeFriendlySwaps: JointSwapPreference;
  aiPlannerGoal: AiPlannerGoal | null;
  aiPlannerDaysPerWeek: AiPlannerDaysPerWeek | null;
  aiPlannerExperience: AiPlannerExperience | null;
  aiPlannerSessionMinutes: number | null;
  aiPlannerEquipment: AiPlannerEquipment | null;
  aiPlannerRecovery: AiPlannerRecovery | null;
  aiPlannerMustInclude: string;
  aiPlannerAvoid: string;
  aiPlannerLimitations: string;
  aiCoachTemplateId: string | null;
  aiCoachSetupHash: string | null;
  aiCoachPlanGeneratedAt: string | null;
  recommendedProgramId: string | null;
  trackedExerciseLibraryItemIds: string[];
  dismissedTipIds: string[];
  activePlanId: string | null;
}

export interface AppDatabase {
  workoutTemplates: WorkoutTemplate[];
  exerciseTemplates: ExerciseTemplate[];
  workoutPlans: WorkoutPlan[];
  exerciseLibrary: ExerciseLibraryItem[];
  workoutSessions: WorkoutSession[];
  exerciseLogs: ExerciseLog[];
  bodyweightEntries: BodyweightEntry[];
  measurementEntries: MeasurementEntry[];
  preferences: AppPreferences;
}

export interface WorkoutTemplateDraft {
  id?: string;
  name: string;
  sessions: WorkoutTemplateSessionDraft[];
  exercises?: ExerciseTemplateDraft[];
}

export interface WorkoutTemplateSessionDraft {
  id?: string;
  name: string;
  exercises: ExerciseTemplateDraft[];
}

export interface ExerciseTemplateDraft {
  id?: string;
  name: string;
  targetSets: number;
  repMin: number;
  repMax: number;
  restSeconds: number | null;
  trackedDefault: boolean;
  libraryItemId?: string | null;
}

export interface ExerciseLogDraft {
  exerciseTemplateId: string | null;
  exerciseNameSnapshot: string;
  weight?: number;
  repsPerSet?: number[];
  sets: ExerciseLogSet[];
  tracked: boolean;
  orderIndex: number;
  skipped?: boolean;
  sessionInserted?: boolean;
  status?: ExerciseLogStatus;
  slotId?: string | null;
  templateSlotId?: string | null;
  templateExerciseId?: string | null;
  notes?: string | null;
  swappedFrom?: string | null;
}
