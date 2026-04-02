import { UnitPreference } from '../../types/models';

export type WorkoutGoalType = 'strength' | 'hypertrophy' | 'general';
export type WorkoutLevel = 'beginner' | 'intermediate' | 'advanced';
export type WorkoutSplitType = 'full_body' | 'upper_lower' | 'hybrid';
export type WorkoutProgressionModel = 'double_progression';
export type DefaultScheduleMode = 'rolling_sequence';
export type WorkoutRole = 'primary' | 'secondary' | 'accessory';
export type WorkoutProgressionPriority = 'high' | 'medium' | 'low';
export type WorkoutTrackingMode = 'load_and_reps' | 'reps_first' | 'bodyweight';
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
  actualLoadKg?: number;
  actualReps?: number;
  status: WorkoutSetStatus;
  effort?: WorkoutSetEffort | null;
  completedAt?: string;
  edited: boolean;
  skippedReason?: string;
}

export interface WorkoutExerciseInstance {
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

export interface WorkoutUiState {
  activeSlotId: string | null;
  activeSetIndex: number;
  focusedField: WorkoutInputField;
  noteEditorSlotId: string | null;
  swapSheetSlotId: string | null;
  expandedSlotIds: string[];
  finishSummaryOpen: boolean;
}

export interface WorkoutSessionRuntime {
  sessionId: string;
  templateId: string;
  templateName: string;
  status: WorkoutStatus;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  elapsedSeconds: number;
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

export interface WorkoutSessionMaterializeOptions {
  unitPreference: UnitPreference;
  history: WorkoutHistoryStore;
  sessionOrderIndex: number;
}
