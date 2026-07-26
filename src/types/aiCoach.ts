import { SetupWeekday, UnitPreference } from './models';
import { FatigueSignal } from '../lib/fatigueModel';

export interface AICoachLiftHighlight {
  key: string;
  name: string;
  latestWeight: number | null;
  bestWeight: number | null;
  latestReps: string;
}

export interface AICoachActiveSessionSummary {
  title: string;
  nextExercise: string | null;
  meta: string;
}

export interface AICoachRecentCompletedSession {
  sessionId: string;
  title: string;
  performedAt: string;
  durationMinutes: number | null;
  setsCompleted: number | null;
  swappedExercises: number;
  noteCount: number;
}

export interface AICoachLatestTopSet {
  exerciseName: string;
  weight: number | null;
  reps: string;
  performedAt: string | null;
}

export interface AICoachRhythmDay {
  dayStart: number;
  dayNumber: number;
  weekdayLabel: string;
  active: boolean;
  isToday: boolean;
}

export interface AICoachPlateauSummary {
  exerciseKey: string;
  name: string;
  stagnantSessions: number;
  topWeightKg: number | null;
}

export interface AICoachFatigueSummary {
  acwr: number;
  recoveryScore: number;
  signal: FatigueSignal;
  sessionCount7d: number;
  /** False when there is too little history to read the signal as fact. */
  confident: boolean;
}

export interface AICoachPlannerSetupSummary {
  goal: string | null;
  daysPerWeek: number | null;
  experience: string | null;
  sessionMinutes: number | null;
  equipment: string | null;
  recovery: string | null;
  mustInclude: string[];
  avoid: string[];
  limitations: string[];
}

export interface AICoachHistorySession {
  sessionId: string;
  /** Session name as stored, in English — an identifier, not a label. */
  name: string;
  performedAt: string;
  durationMinutes: number | null;
  volumeKg: number | null;
  setCount: number;
  exerciseCount: number;
}

export interface AICoachHistoryLift {
  name: string;
  sessions: number;
  firstWeightKg: number;
  latestWeightKg: number;
  latestReps: number;
  bestWeightKg: number;
  changeKg: number;
  spanDays: number;
  /** Consecutive most-recent sessions at the current top-set weight. */
  stalledSessions: number;
  /** Top-set weight per logged session, oldest first. */
  weightSeriesKg: number[];
}

export interface AICoachHistoryWeek {
  /** Monday of the week, local YYYY-MM-DD. */
  weekStart: string;
  sessions: number;
  volumeKg: number;
  /** Null when the plan places the week itself, so nothing was promised. */
  plannedSessions: number | null;
}

export interface AICoachHistorySchedule {
  trainingDays: SetupWeekday[];
  plannedPerWeek: number;
  plannedSessions: number;
  completedSessions: number;
}

/**
 * Enough of the training log for a reader to reconstruct the window: every
 * session with its volume, every lift's trajectory, and week-by-week planned
 * versus actual. Figures only — the wording is the model's job.
 */
export interface AICoachHistory {
  windowDays: number;
  /** Sessions inside the window, before the list below was capped. */
  sessionCount: number;
  totalVolumeKg: number;
  /** Newest last. Capped; check `truncated`. */
  sessions: AICoachHistorySession[];
  /** Most-trained lift first. Capped. */
  lifts: AICoachHistoryLift[];
  weeks: AICoachHistoryWeek[];
  schedule: AICoachHistorySchedule | null;
  /** True when older sessions were dropped to keep the payload small. */
  truncated: boolean;
}

export interface AICoachTrainingContext {
  unitPreference: UnitPreference;
  activeSession: AICoachActiveSessionSummary | null;
  recentCompletedSessions: AICoachRecentCompletedSession[];
  trackedLifts: AICoachLiftHighlight[];
  latestTopSets: AICoachLatestTopSet[];
  sessionsThisWeek: number;
  sessionsLast30Days: number;
  rhythm: AICoachRhythmDay[];
  readyProgramCount: number;
  recommendedProgramId: string | null;
  recommendedProgramTitle: string | null;
  customProgramTitle: string | null;
  plateaus: AICoachPlateauSummary[];
  fatigue: AICoachFatigueSummary;
  history: AICoachHistory;
  plannerSetup?: AICoachPlannerSetupSummary | null;
}

export type AICoachActionKind =
  | 'resume_workout'
  | 'open_last_session'
  | 'open_lift_progress'
  | 'open_progress'
  | 'browse_ready_plans'
  | 'open_recommended_program'
  | 'review_setup'
  | 'open_custom_editor';

export interface AICoachAction {
  kind: AICoachActionKind;
  label: string;
  description: string;
  sessionId?: string;
  exerciseKey?: string;
  programId?: string | null;
  prefillName?: string | null;
}

export interface AICoachAdvice {
  takeaway: string;
  why: string[];
  nextSteps: string[];
  plan: string[];
  assumptions: string[];
  actions?: AICoachAction[];
}

export interface AICoachAdviceRequest {
  prompt: string;
  context: AICoachTrainingContext;
}

export interface AICoachAdviceSuccess {
  ok: true;
  source: 'live' | 'preview';
  answer: AICoachAdvice;
  note?: string;
}

export interface AICoachAdviceError {
  ok: false;
  source: 'live' | 'preview';
  error: {
    code: 'BAD_REQUEST' | 'METHOD_NOT_ALLOWED' | 'RATE_LIMIT' | 'UPSTREAM_TIMEOUT' | 'UPSTREAM_ERROR' | 'INVALID_RESPONSE' | 'MISSING_API_KEY';
    message: string;
  };
  fallback?: AICoachAdvice;
  note?: string;
}

export type AICoachAdviceResponse = AICoachAdviceSuccess | AICoachAdviceError;
