import { CancelSurveyAnswer } from '../lib/cancelSurvey';
import { SeasonEnrolment } from '../lib/seasonEnrolment';
import { StrengthGoal } from '../lib/strengthGoals';
import { SubscriptionTermKey } from '../lib/subscriptionView';
export type UnitPreference = 'kg' | 'lb';
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
  /** Local time of day for session reminders, 24h "HH:MM". */
  reminderTime: string;
  /**
   * Rest & alerts (design: Background Timer). Defaults assume a noisy gym —
   * each is defeatable here, none is a marketing push.
   */
  /** The alert ladder when a rest ends: end tone + one repeat 30 s later. */
  restAlerts: boolean;
  /** The haptic-only tick 10 s before a rest ends. */
  restWarning: boolean;
  /** The ongoing lock-screen card while a workout is live. */
  sessionOngoing: boolean;
  /** One nudge after 25 minutes without a logged set. */
  idleNudge: boolean;
  /** The in-app permission sheet has been shown once; asked in context, never twice. */
  restAlertsAsked: boolean;
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
/**
 * Arms and calves were missing, so the two tape readings a growth trainee
 * takes most often could not be logged at all — and picking "arms" as a focus
 * area could never be answered with a card.
 */
export type MeasurementKind =
  | 'bodyfat'
  | 'shoulders'
  | 'chest'
  | 'arms'
  | 'waist'
  | 'hips'
  | 'thighs'
  | 'calves';
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
  /**
   * How this template came to exist.
   *
   * A freestyle session has to be stored against something, so logging one
   * leaves a template behind — but the user did not author a program, and the
   * free cap counts authoring. See `countAuthoredPrograms`.
   */
  origin: WorkoutTemplateOrigin;
}

export type WorkoutTemplateOrigin = 'authored' | 'freestyle';

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
  defaultRestSeconds: number;
  autoFocusNextInput: boolean;
  keepScreenAwakeDuringWorkout: boolean;
  /** Workout cue sounds (countdown ticks, set logged, rest over, session done). */
  soundCuesEnabled: boolean;
  /** Vibration feedback for the same moments. */
  hapticsEnabled: boolean;
  /**
   * The dark-theme choice, kept exactly as the user set it even when Pro
   * lapses — resolveThemeName decides what actually gets served.
   */
  darkThemeEnabled: boolean;
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
  /**
   * Demo-build only: which term the subscription screen pretends the reader is
   * on, and whether they have pretended to cancel it.
   *
   * Named `mock` on purpose, in the persisted database, where anyone reading a
   * dump can see what they are. There is no billing — these exist so the
   * management screen can be walked end to end before there is a store to walk
   * it against, and they come out with MOCK_BILLING when billing lands.
   */
  mockSubscriptionTerm: SubscriptionTermKey;
  mockSubscriptionCancelled: boolean;
  /**
   * When Pro was turned on, ISO. The renewal date is COUNTED from this plus the
   * term's length — never written into copy, which is the requirement #bugs
   * locked after the unlock receipt shipped a hardcoded "15.9.2026".
   *
   * The one field real billing has to fill. Everything downstream already reads
   * it through resolveSubscriptionView, so the store replaces this and nothing
   * else changes.
   */
  mockSubscriptionPurchasedAt: string | null;
  /**
   * Why the reader ended their membership, kept on the device. Null when the
   * survey was never answered or was skipped — a skip is not an empty answer.
   */
  cancelSurveyAnswer: CancelSurveyAnswer | null;
  /** Feature-request ids this device has upvoted (local demo board). */
  featureVotedIds: string[];
  /**
   * Free coach-question counter for the current week (3/week — the Pro page
   * table promises it, so it must be real). Null = nothing used yet.
   */
  aiCoachFreeQuota: { weekStart: string; used: number } | null;
  adaptiveCoachPremiumUnlocked: boolean;
  /** Plan-review toggle: Vinha adjusts weekly load/progression automatically. */
  automatedProgressionEnabled: boolean;
  aiSetupCompleted: boolean;
  hasOpenedAppBefore: boolean;
  /**
   * True once the home-screen widget offer has been answered either way. The
   * offer is shown once; Settings keeps a permanent entry for later.
   */
  homeWidgetPromptDismissed: boolean;
  /** The Home sign-in offer asked once and was declined; it never returns. */
  accountBackupPromptDismissed: boolean;
  /**
   * Whether the hand-off step after onboarding has had its turn. It offers the
   * widget and a tracking card once; a reader who ran onboarding again has
   * already been asked.
   */
  setupHandoffCompleted: boolean;
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
  /**
   * A rhythm that does not fit inside a week, e.g. two days on and one off.
   *
   * When set, this OVERRIDES `setupAvailableDays` everywhere a calendar day is
   * marked as training or rest: the weekday list cannot express a period other
   * than seven, so the two would disagree on most days. Availability stays as
   * written because the recommender and reminders still read it as "days I
   * could train".
   *
   * `pattern` is read cyclically from `anchorDayStart` (a local midnight):
   * `[true, true, false]` is two on, one off. Null = plain weekdays.
   */
  trainingCycle: { pattern: boolean[]; anchorDayStart: number } | null;
  /**
   * Today's session, when the reader has picked one by hand.
   *
   * The rotation decides which session comes next, and it is right nearly
   * always — but "today is legs, not upper" is a fact about the reader's day
   * that no rotation can know. This overrides it for one day only: `dayStart`
   * is a local midnight, and an override for a day that is no longer today is
   * simply ignored rather than needing to be cleared.
   */
  todaySession: { dayStart: number; sessionId: string } | null;
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
  /**
   * "Bench 100 kg" targets. Empty until the user sets one — the onboarding
   * goal is a category ('strength'), not a number, and a progress bar needs
   * a number.
   */
  strengthGoals: StrengthGoal[];
  /**
   * Seasons the reader has signed up for, one row per season and year.
   *
   * Kept instead of reading "is the season programme my active plan?", which
   * could not tell a pre-registration from a programme swap and un-joined you
   * the moment you trained something else. See lib/seasonEnrolment.
   */
  seasonEnrolments: SeasonEnrolment[];
  dismissedTipIds: string[];
  /**
   * Plans whose completion card the reader has answered. Keyed by plan id, not
   * template id, so restarting the same programme (a new plan round) earns a
   * new card. The card stays until answered — no timer — because completion is
   * the biggest moment the app has, and it must not be missable by opening the
   * app on the wrong day.
   */
  dismissedCompletionPlanIds: string[];
  /**
   * Card suggestions the reader has answered, accepted or put away. Keyed by
   * card key, so an offer declined once never returns.
   */
  dismissedCardSuggestionKeys: string[];
  /**
   * The programme Home leads with. Kept as the primary while `activePlanIds`
   * carries the full set, so every screen that only ever wanted one still has
   * one to read.
   */
  activePlanId: string | null;
  /**
   * Every programme the reader is running, in the order they took them on.
   *
   * The app held exactly one programme until a season needed to arrive without
   * evicting the reader's own. This is deliberately its own list rather than
   * `workoutPlans.filter(isActive)`: onboarding never deactivated the plan it
   * replaced, so old runs leave `isActive` plans lying in storage, and deriving
   * the set would resurrect them all at once. Migrated from `activePlanId` on
   * load — see normalizeDatabase.
   */
  activePlanIds: string[];
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
  /** Defaults to 'authored'; only freestyle logging passes 'freestyle'. */
  origin?: WorkoutTemplateOrigin;
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
