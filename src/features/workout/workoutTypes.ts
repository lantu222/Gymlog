// Type-only, and explicitly so: this module now exports runtime predicates, and
// format.ts imports them. Erasing these keeps workoutTypes a leaf at build time
// instead of a node in a cycle through progressionGate and cardio.
import type { SetupLevel, UnitPreference } from '../../types/models';
import type { ProgressionFatigueSignal } from '../../lib/progressionGate';
import type { ActiveCardioSession } from '../../lib/cardio';

export type WorkoutGoalType = 'strength' | 'hypertrophy' | 'general';
export type WorkoutLevel = 'beginner' | 'intermediate' | 'advanced';
export type WorkoutSplitType = 'full_body' | 'upper_lower' | 'hybrid';
export type WorkoutProgressionModel = 'double_progression';
export type DefaultScheduleMode = 'rolling_sequence';
export type WorkoutRole = 'primary' | 'secondary' | 'accessory';
export type WorkoutProgressionPriority = 'high' | 'medium' | 'low';
/**
 * `hold` is a timed position: the rep numbers are SECONDS, not repetitions.
 *
 * The catalogs have prescribed holds this way from the start — "Plank 3x30-60",
 * "Legs Up the Wall 1x180-300" — with nothing in the data to say so, so every
 * screen read those numbers as reps and the app asked users for 300 repetitions
 * of lying with their legs up a wall. The mode records what was already true;
 * it does not introduce a new kind of set.
 */
export type WorkoutTrackingMode = 'load_and_reps' | 'reps_first' | 'bodyweight' | 'hold';

/**
 * No external load to log. A hold is bodyweight by definition, so every rule
 * that used to ask `!== 'bodyweight'` before requiring a weight means this.
 */
export function isUnloadedTrackingMode(trackingMode: WorkoutTrackingMode) {
  return trackingMode === 'bodyweight' || trackingMode === 'hold';
}

/** Whether this exercise's rep numbers are seconds. */
export function isTimedTrackingMode(trackingMode: WorkoutTrackingMode) {
  return trackingMode === 'hold';
}
export type WorkoutStatus = 'active' | 'paused' | 'completed';
export type WorkoutExerciseStatus = 'pending' | 'active' | 'completed' | 'skipped' | 'swapped';
export type WorkoutSetStatus = 'pending' | 'completed' | 'skipped';
export type WorkoutSetEffort = 'easy' | 'good' | 'hard';
export type RestTimerStatus = 'idle' | 'running' | 'paused';
export type WorkoutInputField = 'load' | 'reps' | 'notes' | null;

export interface WorkoutSubstitutionGroup {
  id: string;
  allowedExerciseNames: string[];
}

export interface WorkoutTemplateExercise {
  id: string;
  persistedExerciseTemplateId?: string | null;
  exerciseName: string;
  slotId: string;
  role: WorkoutRole;
  progressionPriority: WorkoutProgressionPriority;
  trackingMode: WorkoutTrackingMode;
  sets: number;
  repsMin: number;
  repsMax: number;
  restSecondsMin: number;
  restSecondsMax: number;
  substitutionGroup: string;
}

export interface WorkoutTemplateSession {
  id: string;
  name: string;
  orderIndex: number;
  exercises: WorkoutTemplateExercise[];
}

export interface WorkoutProgressionRules {
  primary: string;
  secondary: string;
  accessory: string;
  failureHandling: string;
}

export interface WorkoutTemplateV1 {
  id: string;
  name: string;
  goalType: WorkoutGoalType;
  level: WorkoutLevel;
  splitType: WorkoutSplitType;
  daysPerWeek: number;
  /**
   * Program block length. Optional override — when absent the catalog rule
   * applies: beginner 4 wk, intermediate (UI "Advanced") 8 wk, advanced
   * (UI "Pro") 12 wk. See src/lib/readyProgramDuration.ts.
   */
  blockLengthWeeks?: number;
  estimatedSessionDuration: number;
  progressionModel: WorkoutProgressionModel;
  defaultScheduleMode: DefaultScheduleMode;
  sessions: WorkoutTemplateSession[];
  progressionRules: WorkoutProgressionRules;
}

export interface WorkoutRuntimeTemplate {
  id: string;
  name: string;
  defaultScheduleMode: DefaultScheduleMode;
  sessions: WorkoutTemplateSession[];
}

export interface WorkoutSetInstance {
  setIndex: number;
  plannedLoadKg?: number;
  plannedRepsMin: number;
  plannedRepsMax: number;
  draftLoadText: string;
  draftRepsText: string;
  /**
   * Load this set was carrying before automated progression moved it up (Pro).
   * Undefined when the prefill simply repeats last session — the loggers use it
   * to mark a weight the user did not pick themselves.
   */
  autoProgressedFromKg?: number;
  /**
   * The load would have moved up, and recovery said not today (Pro).
   *
   * The counterpart to autoProgressedFromKg: that one explains a weight the
   * user did not choose, this one explains a weight that did not change when
   * it had been earned. Without it the hold is silent, and a feature nobody
   * can perceive is not one they can knowingly pay for.
   */
  heldForFatigue?: boolean;
  /**
   * When the prefill came from the same lift in a DIFFERENT slot — another
   * program, another day, an empty workout — this is when that session was
   * performed. The guided player shows it, because a weight that did not come
   * from this slot should say where it did come from. (The list logger does
   * not surface it yet.) Undefined for the ordinary case — this slot's own
   * history — and for a blank set.
   */
  prefilledFromPerformedAt?: string;
  /**
   * The reps this set should open at when automated progression moved the
   * target (bodyweight work, where the load gate stays silent). Undefined
   * whenever the template target stands — the dial falls back to
   * plannedRepsMax, which is what it always did.
   */
  plannedTargetReps?: number;
  /**
   * The rep floor the user proved before progression raised it — the reps
   * counterpart to autoProgressedFromKg, and set only alongside
   * plannedTargetReps.
   */
  autoProgressedFromReps?: number;
  actualLoadKg?: number;
  actualReps?: number;
  status: WorkoutSetStatus;
  effort?: WorkoutSetEffort | null;
  completedAt?: string;
  edited: boolean;
  skippedReason?: string;
}

export interface WorkoutExerciseInstance {
  /**
   * The highest set index that was already logged when this exercise was
   * swapped. Those sets were performed as a DIFFERENT lift, so nothing may
   * carry forward across this line — the sheet promises "your logged sets stay
   * on the exercise you did them on", and a prefill that reaches back over the
   * swap quietly breaks that promise. Undefined when no swap happened, or when
   * the swap happened before anything was logged.
   */
  swappedAfterSetIndex?: number;
  templateExerciseId: string;
  persistedExerciseTemplateId?: string | null;
  slotId: string;
  templateSlotId: string;
  exerciseName: string;
  role: WorkoutRole;
  progressionPriority: WorkoutProgressionPriority;
  trackingMode: WorkoutTrackingMode;
  restSecondsMin: number;
  restSecondsMax: number;
  substitutionGroup: string;
  orderIndex: number;
  sets: WorkoutSetInstance[];
  status: WorkoutExerciseStatus;
  libraryItemId?: string | null;
  sessionInserted?: boolean;
  sourceExerciseName?: string;
  notes?: string;
  isExpanded: boolean;
}

export interface WorkoutRestTimerState {
  status: RestTimerStatus;
  exerciseSlotId: string | null;
  setIndex: number | null;
  startedAtMs: number | null;
  endsAtMs: number | null;
  durationSeconds: number;
}

/**
 * What the guided player was showing, in terms that survive the plan being
 * rebuilt. The step list changes shape whenever a lift is skipped or the app
 * updates, and an index into the old list then points at a different step —
 * "Jatka treeniä · Penkkipunnerrus sarja 2" for a session that had never
 * touched the bench. A set is identified by its slot and index, a drill by
 * its phase and name; the resume looks the step up again in whatever list
 * exists now.
 */
export interface GuidedResumeAnchor {
  type: 'splash' | 'ready' | 'drill' | 'position' | 'set' | 'rest' | 'finish';
  phase: 'warmup' | 'work' | 'cooldown' | null;
  slotId?: string;
  setIndex?: number;
  drillName?: string;
}

export interface WorkoutUiState {
  activeSlotId: string | null;
  activeSetIndex: number;
  focusedField: WorkoutInputField;
  noteEditorSlotId: string | null;
  swapSheetSlotId: string | null;
  expandedSlotIds: string[];
  finishSummaryOpen: boolean;
  /**
   * Guided-player resume position (index into the built step list). Kept for
   * sessions persisted before the anchor existed; the anchor wins when both
   * are present.
   */
  guidedStepIndex?: number;
  guidedResumeAnchor?: GuidedResumeAnchor;
}

export interface WorkoutSessionRuntime {
  sessionId: string;
  templateId: string;
  templateSessionId: string | null;
  templateName: string;
  status: WorkoutStatus;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  elapsedSeconds: number;
  /**
   * How long this session has spent paused, in milliseconds.
   *
   * The workout clock used to be plain wall time from `startedAt`, so pausing
   * froze the countdown on screen and the session clock kept running behind it
   * — "eikö tauko tarkoita että tauko treenistä", reported 2026-08-21. Both the
   * clock on screen and the duration written to history subtract this, so there
   * is one answer to how long the workout took.
   */
  pausedMs: number;
  /** When the current pause began, or null while running. */
  pausedAt: string | null;
  activePlanMode: DefaultScheduleMode;
  exercises: WorkoutExerciseInstance[];
  restTimer: WorkoutRestTimerState;
  ui: WorkoutUiState;
  sessionOrderIndex: number;
}

export interface WorkoutSlotHistorySet {
  setIndex: number;
  loadKg: number;
  reps: number;
  completedAt: string;
  effort?: WorkoutSetEffort | null;
}

export interface WorkoutSlotHistoryEntry {
  slotId: string;
  templateId: string;
  templateName: string;
  exerciseName: string;
  substitutionGroup: string;
  performedAt: string;
  sessionId: string;
  sets: WorkoutSlotHistorySet[];
  skipped: boolean;
  swappedFrom?: string;
}

export interface WorkoutSessionSummary {
  sessionId: string;
  templateId: string;
  templateSessionId: string | null;
  templateName: string;
  performedAt: string;
  durationMinutes: number;
  setsCompleted: number;
  exercisesCompleted: number;
  exercisesSkipped: number;
  exercisesSwapped: number;
  totalVolumeKg: number;
}

export interface WorkoutHistoryStore {
  sessions: WorkoutSessionSummary[];
  slotHistory: Record<string, WorkoutSlotHistoryEntry[]>;
  lastSelectedTemplateId: string | null;
}

export interface WorkoutPersistenceBundle {
  activeSession: WorkoutSessionRuntime | null;
  history: WorkoutHistoryStore;
  /** Live cardio session (Cardio v1) — same offline persistence as strength. */
  activeCardio?: ActiveCardioSession | null;
}

export interface WorkoutSetDraftInput {
  loadText?: string;
  repsText?: string;
}

export interface WorkoutExerciseInsertInput {
  exerciseName: string;
  role?: WorkoutRole;
  progressionPriority?: WorkoutProgressionPriority;
  trackingMode: WorkoutTrackingMode;
  sets: number;
  repsMin: number;
  repsMax: number;
  restSecondsMin: number;
  restSecondsMax: number;
  substitutionGroup: string;
  libraryItemId?: string | null;
}

export interface WorkoutSwapOption {
  exerciseName: string;
  substitutionGroup: string;
}

/** What the logger needs to decide whether a prefill may move up. */
export interface WorkoutProgressionOptions {
  automatedProgressionEnabled: boolean;
  setupLevel?: SetupLevel | null;
  /**
   * Recovery at the moment the session starts, from the ACWR model.
   *
   * Read once when the session materializes rather than per set: the model
   * looks at 28 days, so it cannot change during a workout, and re-reading it
   * mid-session would only let a load move for a reason the user never sees.
   */
  fatigueSignal?: ProgressionFatigueSignal;
}

export interface WorkoutSessionMaterializeOptions {
  unitPreference: UnitPreference;
  history: WorkoutHistoryStore;
  sessionOrderIndex: number;
  /**
   * When true, an earned rep-ceiling clears the load for the next session
   * (ADR-004). Off repeats what was logged. Defaults to off so a caller that
   * has not been updated cannot silently start moving a user's weights.
   */
  automatedProgressionEnabled?: boolean;
  /** Drives the beginner/intermediate progression parameters. */
  setupLevel?: SetupLevel | null;
  /** Recovery at session start; holds an earned progression when high. */
  fatigueSignal?: ProgressionFatigueSignal;
}
