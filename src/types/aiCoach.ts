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
  /** Weekday plans only; empty for a cycle. */
  trainingDays: SetupWeekday[];
  /**
   * A rolling rhythm ("2 on, 1 off") the weekday list cannot express. The
   * coach used to read the questionnaire's availability instead and told a
   * 2-on-1-off reader their schedule was mon-wed-thu (transcript, 2026-08-23).
   */
  cycle?: { onDays: number; offDays: number; length: number } | null;
  /** ISO date of the next day the schedule trains on, from today. */
  nextTrainingDate?: string | null;
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
  /**
   * How much record the reading rests on — counted here, never judged by the
   * model. A model asked to rate its own confidence hedges everything; a
   * number of sessions and a span of days cannot.
   */
  confidence: AICoachHistoryConfidence;
}

export type AICoachHistoryConfidence = 'low' | 'medium' | 'high';

export interface AICoachBodyMeasurementTrend {
  kind: string;
  unit: string;
  latestValue: number;
  latestAt: string;
  previousValue: number | null;
  previousAt: string | null;
}

export interface AICoachBodyChange {
  deltaKg: number;
  spanDays: number;
}

/**
 * What the body record says: latest weight with its short trends, and the
 * latest + previous reading of every measured site. Without this block the
 * coach knows nothing about the body it is coaching — a chest-growth or
 * nutrition question got a training summary (transcript review, 23.8.).
 */
export interface AICoachBody {
  weightKg: number | null;
  weightAt: string | null;
  weightChange30d: AICoachBodyChange | null;
  weightChange90d: AICoachBodyChange | null;
  measurements: AICoachBodyMeasurementTrend[];
}

export interface AICoachGoal {
  text: string;
  kind: string | null;
  targetValue: number | null;
  unit: string | null;
  startValue: number | null;
  currentValue: number | null;
  setAt: string | null;
  /**
   * The one goal the answer is measured against. Exactly one goal carries it
   * whenever there is any goal at all — a list where everything is equally
   * important reads as a list where nothing is.
   */
  isPrimary: boolean;
}

export interface AICoachProfile {
  heightCm: number | null;
  age: number | null;
  gender: string | null;
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
  /** Optional so an older client's payload still parses. */
  body?: AICoachBody | null;
  goals?: AICoachGoal[];
  profile?: AICoachProfile | null;
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
  /**
   * True when the coach could not answer and asked for a clearer question.
   *
   * The free tier is three questions a week, and one of those used to be spent
   * on "ask one clear question" — including when the user had tapped a chip
   * the app itself offered. An answer that answers nothing does not cost one.
   */
  unanswered?: boolean;
}

export interface AICoachAdviceRequest {
  prompt: string;
  context: AICoachTrainingContext;
  /**
   * The language the answer must come back in. The live coach is told to
   * answer in the language the user wrote in; the offline preview has no
   * model to infer that, so it is passed explicitly. Defaults to English when
   * absent, which is what an older client sends.
   */
  language?: 'fi' | 'en';
  /**
   * TEMPORARY, development only: the signed-in account's email, so the
   * transcript log can say which phone asked. Sent only while
   * AI_COACH_DEBUG_TRANSCRIPTS is on (src/lib/aiCoachDebug.ts) and ignored
   * by the server otherwise.
   */
  reporter?: string;
  /**
   * TEMPORARY, development only: per-request thinking-effort override
   * (low | medium | high | off) so latency settings can be A/B-measured
   * against production without a deploy per setting. Honored only while
   * AI_COACH_DEBUG_TRANSCRIPTS is on; ignored otherwise.
   */
  effortOverride?: string;
  /** TEMPORARY, development only: per-request model override under the same debug gate. */
  modelOverride?: string;
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
