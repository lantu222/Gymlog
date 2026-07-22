export type UnitPreference = 'kg' | 'lb';
export type ThemePreference = 'dark';
export type AppLanguage = 'en' | 'fi';
export type SignInMethod = 'apple' | 'email' | 'local' | 'google';
export type AccessTier = 'free' | 'premium';
export type SetupGender = 'male' | 'female' | 'unspecified';
export type SetupAgeRange = 'unspecified' | '18' | '19_25' | '26_30' | '31_40' | '41_plus';
export type SetupGoal =
  | 'strength'
  | 'muscle'
  | 'general'
  | 'run_mobility'
  | 'lean_athletic'
  | 'general_fitness';
export type SetupLevel = 'beginner' | 'advanced' | 'pro';
export type SetupDaysPerWeek = 2 | 3 | 4 | 5 | 6;
export type SetupEquipment = 'gym' | 'minimal' | 'home';
export type SetupTrainingEnvironment =
  | 'full_gym'
  | 'home_gym'
  | 'minimal_equipment'
  | 'bodyweight_only'
  | 'running_hybrid';
export type SetupSecondaryOutcome = 'consistency' | 'mobility' | 'conditioning' | 'muscle' | 'strength';
export type SetupFocusArea =
  | 'bodyweight'
  | 'glutes'
  | 'legs'
  | 'quads'
  | 'hamstrings'
  | 'calves'
  | 'chest'
  | 'shoulders'
  | 'back'
  | 'arms'
  | 'core'
  | 'mobility'
  | 'conditioning';
export type SetupCautionArea =
  | 'neck'
  | 'shoulders'
  | 'elbows'
  | 'wrists'
  | 'lower_back'
  | 'hips'
  | 'knees'
  | 'ankles';
export type SetupCautionLevel = 'info' | 'careful' | 'avoid';
export type NotificationLevel = 'quiet' | 'normal' | 'motivating';

export interface NotificationPrefs {
  pushEnabled: boolean;
  level: NotificationLevel;
  personalRecords: boolean;
  weeklySummary: boolean;
  comebackNudge: boolean;
  sessionReminders: boolean;
}

export type TrainingBreakReason = 'injury' | 'holiday' | 'other';

export interface TrainingBreak {
  reason: TrainingBreakReason;
  note: string | null;
  startedAt: string;
}

export interface SetupCautionFlag {
  area: SetupCautionArea;
  level: SetupCautionLevel;
  refinements: string[];
}
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
export type PostSessionInsightType =
  | 'personal_record'
  | 'plateau_detected'
  | 'session_volume_peak'
  | 'return_after_gap';

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
  workoutTemplateSessionId?: string | null;
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
  workoutTemplateSessionId?: string | null;
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
  /** Workout cue sounds (countdown ticks, set logged, rest over, session done). */
  soundCuesEnabled: boolean;
  /** Vibration feedback for the same moments. */
  hapticsEnabled: boolean;
  /**
   * "Your cards" pins on Home. null = never customized (defaults apply);
   * [] = the user removed every card and that choice sticks.
   */
  homeStatCardKeys: string[] | null;
  /**
   * Notification settings. Stored ahead of the delivery engine — nothing is
   * sent yet; the master defaults to off per product principle.
   */
  notificationPrefs: NotificationPrefs;
  /** Active training break, or null when training normally. */
  trainingBreak: TrainingBreak | null;
  /** ISO date until which a redeemed promo keeps Pro unlocked; null = none. */
  promoProUntil: string | null;
  /** Feature-request ids this device has upvoted (local demo board). */
  featureVotedIds: string[];
  adaptiveCoachPremiumUnlocked: boolean;
  /** Plan-review toggle: GAINER adjusts weekly load/progression automatically. */
  automatedProgressionEnabled: boolean;
  aiSetupCompleted: boolean;
  hasOpenedAppBefore: boolean;
  entryFlowCompleted: boolean;
  trainingFirstRunDismissed: boolean;
  selectedSignInMethod: SignInMethod | null;
  selectedAccessTier: AccessTier | null;
  profileName: string | null;
  setupCurrentWeightKg: number | null;
  bodyweightGoalKg: number | null;
  onboardingCompleted: boolean;
  setupCompleted: boolean;
  setupGender: SetupGender | null;
  setupAge: number | null;
  setupAgeRange: SetupAgeRange | null;
  setupHeightCm: number | null;
  setupGoal: SetupGoal | null;
  setupGoals: SetupGoal[];
  setupLevel: SetupLevel | null;
  setupDaysPerWeek: SetupDaysPerWeek | null;
  setupEquipment: SetupEquipment | null;
  setupTrainingEnvironment: SetupTrainingEnvironment | null;
  setupEquipmentItems: string[];
  setupSecondaryOutcomes: SetupSecondaryOutcome[];
  setupFocusAreas: SetupFocusArea[];
  setupCautionFlags: SetupCautionFlag[];
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
  lastInsightSessionId: string | null;
  lastInsightType: PostSessionInsightType | null;
  recommendedProgramId: string | null;
  trackedExerciseLibraryItemIds: string[];
  dismissedTipIds: string[];
  activePlanId: string | null;
  /**
   * Feature flag for the Programs-tab redesign: when true the second tab lands
   * on ProgramsHomeScreen; when false it keeps the legacy exercise list.
   * Defaults to true (phase 4); flip to false for a data-free rollback.
   */
  programsTabEnabled: boolean;
}

export type CardioActivityType = 'run' | 'tread-run' | 'tread-walk' | 'cycle-in' | 'cycle-out' | 'row';

export type CardioFeel = 'easy' | 'steady' | 'hard' | 'max';

/**
 * A completed cardio session (Cardio v1). Timer-based, no GPS — distance is
 * optional manual entry at finish. Avg pace is always DERIVED
 * (durationSec/distanceKm), never stored.
 */
export interface CardioSession {
  id: string;
  activityType: CardioActivityType;
  startedAt: string;
  /** Completion timestamp — the week/streak counters key off this. */
  performedAt: string;
  durationSec: number;
  distanceKm?: number | null;
  feel?: CardioFeel | null;
}

export interface AppDatabase {
  workoutTemplates: WorkoutTemplate[];
  exerciseTemplates: ExerciseTemplate[];
  workoutPlans: WorkoutPlan[];
  exerciseLibrary: ExerciseLibraryItem[];
  workoutSessions: WorkoutSession[];
  cardioSessions: CardioSession[];
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
