import { UnitPreference } from './models';

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
  plannerSetup: AICoachPlannerSetupSummary | null;
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
