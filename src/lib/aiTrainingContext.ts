import { HomeSummary } from './dashboard';
import { ExerciseProgressSummary } from './progression';
import { ExerciseLog, SetupWeekday, UnitPreference, WorkoutSession } from '../types/models';
import { AICoachHistory, AICoachTrainingContext } from '../types/aiCoach';
import { detectPlateaus } from './progressionAnalyzer';
import { buildFatigueModel } from './fatigueModel';
import { buildTrainingHistory, DEFAULT_HISTORY_WINDOW_DAYS } from './trainingHistory';
import type { TrainingSchedule } from './trainingSchedule';

/**
 * Caps on the history block. Model quality is bounded by what we tell it, but
 * an unbounded payload is a bill — these keep eight weeks of real training
 * inside a few kilobytes, and `truncated` says so when older work is dropped.
 */
const MAX_HISTORY_SESSIONS = 24;
const MAX_HISTORY_LIFTS = 10;

export interface BuildAiTrainingContextInput {
  unitPreference: UnitPreference;
  activeWorkoutSummary: {
    title: string;
    nextExercise: string | null;
    meta: string;
  } | null;
  /**
   * Only the three fields this actually reads. Demanding the whole
   * HomeStreakSummary forced every caller to build a full dashboard summary
   * just to ask the coach a question.
   */
  homeSummary: {
    streak: {
      sessionsThisWeek: number;
      sessionsLast30Days: number;
      activity: { days: HomeSummary['streak']['activity']['days'] };
    };
  };
  workoutSessions: WorkoutSession[];
  exerciseLogs: ExerciseLog[];
  trackedProgress: ExerciseProgressSummary[];
  readyProgramCount: number;
  recommendedProgramId: string | null;
  recommendedProgramTitle: string | null;
  customProgramTitle: string | null;
  plannerSetup?: {
    goal: string | null;
    daysPerWeek: number | null;
    experience: string | null;
    sessionMinutes: number | null;
    equipment: string | null;
    recovery: string | null;
    mustInclude: string[];
    avoid: string[];
    limitations: string[];
  } | null;
  /** Weekdays the plan schedules; empty means the plan has no fixed days. */
  trainingDays?: SetupWeekday[];
  /** The plan's real rhythm; wins over trainingDays when given. */
  schedule?: TrainingSchedule | null;
  historyWindowDays?: number;
  includeActiveSessionContext?: boolean;
}

/**
 * The history of someone who has not trained yet: no sessions, no lifts, no
 * weeks — and the schedule they just chose, which is the one thing that is
 * already true about them.
 */
export function emptyAiCoachHistory(trainingDays: SetupWeekday[] = []): AICoachHistory {
  return {
    windowDays: DEFAULT_HISTORY_WINDOW_DAYS,
    sessionCount: 0,
    totalVolumeKg: 0,
    sessions: [],
    lifts: [],
    weeks: [],
    schedule:
      trainingDays.length > 0
        ? {
            trainingDays,
            plannedPerWeek: trainingDays.length,
            plannedSessions: 0,
            completedSessions: 0,
          }
        : null,
    truncated: false,
  };
}

function buildHistoryBlock(
  workoutSessions: WorkoutSession[],
  exerciseLogs: ExerciseLog[],
  trainingDays: SetupWeekday[],
  windowDays: number,
  schedule: TrainingSchedule | null = null,
): AICoachHistory {
  const history = buildTrainingHistory({
    sessions: workoutSessions,
    logs: exerciseLogs,
    trainingDays,
    schedule,
    windowDays,
  });

  const sessions = history.sessions.slice(-MAX_HISTORY_SESSIONS).map((entry) => ({
    sessionId: entry.sessionId,
    name: entry.name,
    performedAt: entry.performedAt,
    durationMinutes: entry.durationMinutes,
    volumeKg: entry.volumeKg === null ? null : Math.round(entry.volumeKg),
    setCount: entry.setCount,
    exerciseCount: entry.exerciseCount,
  }));

  return {
    windowDays: history.windowDays,
    sessionCount: history.sessionCount,
    totalVolumeKg: history.totalVolumeKg,
    sessions,
    lifts: history.lifts.slice(0, MAX_HISTORY_LIFTS).map((lift) => ({
      name: lift.name,
      sessions: lift.points.length,
      firstWeightKg: lift.first.topSetWeightKg,
      latestWeightKg: lift.latest.topSetWeightKg,
      latestReps: lift.latest.topSetReps,
      bestWeightKg: lift.bestWeightKg,
      changeKg: lift.weightChangeKg,
      spanDays: lift.spanDays,
      stalledSessions: lift.stalledSessions,
      weightSeriesKg: lift.points.map((point) => point.topSetWeightKg),
    })),
    weeks: history.weeks,
    schedule: history.adherence,
    truncated: history.sessionCount > sessions.length,
  };
}

export function buildAiTrainingContext({
  unitPreference,
  activeWorkoutSummary,
  homeSummary,
  workoutSessions,
  exerciseLogs,
  trackedProgress,
  readyProgramCount,
  recommendedProgramId,
  recommendedProgramTitle,
  customProgramTitle,
  plannerSetup,
  trainingDays = [],
  schedule = null,
  historyWindowDays = DEFAULT_HISTORY_WINDOW_DAYS,
  includeActiveSessionContext = false,
}: BuildAiTrainingContextInput): AICoachTrainingContext {
  const recentCompletedSessions = [...workoutSessions]
    .sort((left, right) => new Date(right.performedAt).getTime() - new Date(left.performedAt).getTime())
    .slice(0, 3)
    .map((session) => ({
      sessionId: session.id,
      title: session.workoutNameSnapshot.trim(),
      performedAt: session.performedAt,
      durationMinutes: session.durationMinutes ?? null,
      setsCompleted: session.setsCompleted ?? null,
      swappedExercises: session.exercisesSwapped ?? 0,
      noteCount: session.noteCount ?? 0,
    }));

  const trackedLifts = trackedProgress.slice(0, 3).map((summary) => ({
    key: summary.key,
    name: summary.name,
    latestWeight: summary.latestWeight,
    bestWeight: summary.bestWeight,
    latestReps: summary.latestReps,
  }));

  const latestTopSets = trackedProgress.slice(0, 3).map((summary) => ({
    exerciseName: summary.name,
    weight: summary.latestWeight,
    reps: summary.latestReps,
    performedAt: summary.latestLog?.performedAt ?? null,
  }));

  const plateaus = detectPlateaus(trackedProgress)
    .filter((p) => p.isPlateau)
    .map((p) => ({
      exerciseKey: p.exerciseKey,
      name: p.name,
      stagnantSessions: p.stagnantSessions,
      topWeightKg: p.topWeightHistory[0] ?? null,
    }));

  const fatigueResult = buildFatigueModel({ workoutSessions, exerciseLogs });
  const fatigue = {
    acwr: fatigueResult.acwr,
    recoveryScore: fatigueResult.recoveryScore,
    signal: fatigueResult.signal,
    confident: fatigueResult.confident,
    sessionCount7d: fatigueResult.sessionCount7d,
  };

  return {
    unitPreference,
    activeSession: includeActiveSessionContext && activeWorkoutSummary
      ? {
          title: activeWorkoutSummary.title,
          nextExercise: activeWorkoutSummary.nextExercise,
          meta: activeWorkoutSummary.meta,
        }
      : null,
    recentCompletedSessions,
    trackedLifts,
    latestTopSets,
    sessionsThisWeek: homeSummary.streak.sessionsThisWeek,
    sessionsLast30Days: homeSummary.streak.sessionsLast30Days,
    rhythm: homeSummary.streak.activity.days.map((day) => ({
      dayStart: day.dayStart,
      dayNumber: day.dayNumber,
      weekdayLabel: day.weekdayLabel,
      active: day.active,
      isToday: day.isToday,
    })),
    readyProgramCount,
    recommendedProgramId,
    recommendedProgramTitle,
    customProgramTitle,
    plateaus,
    fatigue,
    history: buildHistoryBlock(workoutSessions, exerciseLogs, trainingDays, historyWindowDays, schedule),
    ...(plannerSetup !== undefined ? { plannerSetup } : {}),
  };
}

/**
 * A context with every field present, whatever the client sent.
 *
 * The endpoint accepted any object as a context, and the preview builder
 * then read `context.trackedLifts[0]` — so a request with `context: {}`
 * (a smoke test, an older client, a hand-written call) crashed the function
 * instead of answering. Same rule as the database loader: missing fields get
 * defaults, never a throw. Only shape is repaired here; a present field is
 * trusted as the client sent it.
 */
export function normalizeAiCoachTrainingContext(
  input: Partial<AICoachTrainingContext> | null | undefined,
): AICoachTrainingContext {
  const candidate = input && typeof input === 'object' ? input : {};
  const array = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);
  const number = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);
  const fatigue = candidate.fatigue && typeof candidate.fatigue === 'object' ? candidate.fatigue : null;
  return {
    unitPreference: candidate.unitPreference === 'lb' ? 'lb' : 'kg',
    activeSession: candidate.activeSession ?? null,
    recentCompletedSessions: array(candidate.recentCompletedSessions),
    trackedLifts: array(candidate.trackedLifts),
    latestTopSets: array(candidate.latestTopSets),
    sessionsThisWeek: number(candidate.sessionsThisWeek),
    sessionsLast30Days: number(candidate.sessionsLast30Days),
    rhythm: array(candidate.rhythm),
    readyProgramCount: number(candidate.readyProgramCount),
    recommendedProgramId: candidate.recommendedProgramId ?? null,
    recommendedProgramTitle: candidate.recommendedProgramTitle ?? null,
    customProgramTitle: candidate.customProgramTitle ?? null,
    plateaus: array(candidate.plateaus),
    fatigue: fatigue ?? {
      acwr: 0,
      recoveryScore: 0,
      signal: 'optimal',
      sessionCount7d: 0,
      confident: false,
    },
    history:
      candidate.history && typeof candidate.history === 'object' ? candidate.history : emptyAiCoachHistory(),
    plannerSetup: candidate.plannerSetup ?? null,
  };
}
