import { UnitPreference } from './models';

export interface ValluLiftHighlight {
  key: string;
  name: string;
  latestWeight: number | null;
  bestWeight: number | null;
  latestReps: string;
}

export interface ValluActiveSessionSummary {
  title: string;
  nextExercise: string | null;
  meta: string;
}

export interface ValluRecentCompletedSession {
  sessionId: string;
  title: string;
  performedAt: string;
  durationMinutes: number | null;
  setsCompleted: number | null;
  swappedExercises: number;
  noteCount: number;
}

export interface ValluLatestTopSet {
  exerciseName: string;
  weight: number | null;
  reps: string;
  performedAt: string | null;
}

export interface ValluRhythmDay {
  dayStart: number;
  dayNumber: number;
  weekdayLabel: string;
  active: boolean;
  isToday: boolean;
}

export interface ValluTrainingContext {
  unitPreference: UnitPreference;
  activeSession: ValluActiveSessionSummary | null;
  recentCompletedSessions: ValluRecentCompletedSession[];
  trackedLifts: ValluLiftHighlight[];
  latestTopSets: ValluLatestTopSet[];
  sessionsThisWeek: number;
  sessionsLast30Days: number;
  rhythm: ValluRhythmDay[];
  readyProgramCount: number;
  recommendedProgramId: string | null;
  recommendedProgramTitle: string | null;
  customProgramTitle: string | null;
}

export type ValluActionKind =
  | 'resume_workout'
  | 'open_last_session'
  | 'open_lift_progress'
  | 'open_progress'
  | 'browse_ready_plans'
  | 'open_recommended_program'
  | 'review_setup'
  | 'open_custom_editor';

export interface ValluAction {
  kind: ValluActionKind;
  label: string;
  description: string;
  sessionId?: string;
  exerciseKey?: string;
  programId?: string | null;
  prefillName?: string | null;
}

export interface ValluAdvice {
  takeaway: string;
  why: string[];
  nextSteps: string[];
  plan: string[];
  assumptions: string[];
  actions?: ValluAction[];
}

export interface ValluAdviceRequest {
  prompt: string;
  context: ValluTrainingContext;
}

export interface ValluAdviceSuccess {
  ok: true;
  source: 'live' | 'preview';
  answer: ValluAdvice;
  note?: string;
}

export interface ValluAdviceError {
  ok: false;
  source: 'live' | 'preview';
  error: {
    code: 'BAD_REQUEST' | 'METHOD_NOT_ALLOWED' | 'RATE_LIMIT' | 'UPSTREAM_TIMEOUT' | 'UPSTREAM_ERROR' | 'INVALID_RESPONSE' | 'MISSING_API_KEY';
    message: string;
  };
  fallback?: ValluAdvice;
  note?: string;
}

export type ValluAdviceResponse = ValluAdviceSuccess | ValluAdviceError;
