import { HomeSummary } from './dashboard';
import { ExerciseProgressSummary } from './progression';
import { BodyweightEntry, CoachGoal, ExerciseLog, MeasurementEntry, SetupWeekday, UnitPreference, WorkoutSession } from '../types/models';
import {
  AICoachBody,
  AICoachBodyChange,
  AICoachGoal,
  AICoachHistory,
  AICoachHistoryConfidence,
  AICoachHomeState,
  AICoachProfile,
  AICoachTrainingContext,
} from '../types/aiCoach';
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
  /** Body record + goals: without these a chest or nutrition question gets a training summary. */
  bodyweightEntries?: BodyweightEntry[];
  measurementEntries?: MeasurementEntry[];
  coachGoals?: CoachGoal[];
  /** Which of them leads; null falls back to the newest. */
  primaryGoalId?: string | null;
  bodyweightGoalKg?: number | null;
  profile?: AICoachProfile | null;
  /** What Home already shows and what the coach must not offer right now. */
  homeState?: AICoachHomeState | null;
  now?: Date;
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
    // Nothing logged is the clearest low there is.
    confidence: 'low',
  };
}

function weightChange(sorted: BodyweightEntry[], windowDays: number, now: Date): AICoachBodyChange | null {
  const cutoff = now.getTime() - windowDays * 24 * 60 * 60 * 1000;
  const inWindow = sorted.filter((entry) => new Date(entry.recordedAt).getTime() >= cutoff);
  if (inWindow.length < 2) {
    // One weigh-in is a fact, not a direction — report no change at all.
    return null;
  }
  const first = inWindow[0];
  const last = inWindow[inWindow.length - 1];
  const spanDays = Math.round((new Date(last.recordedAt).getTime() - new Date(first.recordedAt).getTime()) / (24 * 60 * 60 * 1000));
  return { deltaKg: Math.round((last.weight - first.weight) * 10) / 10, spanDays };
}

export function buildAiCoachBodyState(
  bodyweightEntries: BodyweightEntry[],
  measurementEntries: MeasurementEntry[],
  now: Date = new Date(),
): AICoachBody | null {
  const weights = [...bodyweightEntries].sort(
    (left, right) => new Date(left.recordedAt).getTime() - new Date(right.recordedAt).getTime(),
  );
  const latestWeight = weights[weights.length - 1] ?? null;

  const byKind = new Map<string, MeasurementEntry[]>();
  for (const entry of measurementEntries) {
    const list = byKind.get(entry.kind) ?? [];
    list.push(entry);
    byKind.set(entry.kind, list);
  }
  const measurements = [...byKind.entries()].map(([kind, entries]) => {
    const sorted = entries.sort((left, right) => new Date(left.recordedAt).getTime() - new Date(right.recordedAt).getTime());
    const latest = sorted[sorted.length - 1];
    const previous = sorted[sorted.length - 2] ?? null;
    return {
      kind,
      unit: latest.unit,
      latestValue: latest.value,
      latestAt: latest.recordedAt.slice(0, 10),
      previousValue: previous?.value ?? null,
      previousAt: previous ? previous.recordedAt.slice(0, 10) : null,
    };
  });

  if (!latestWeight && measurements.length === 0) {
    return null;
  }
  return {
    weightKg: latestWeight?.weight ?? null,
    weightAt: latestWeight ? latestWeight.recordedAt.slice(0, 10) : null,
    weightChange30d: weightChange(weights, 30, now),
    weightChange90d: weightChange(weights, 90, now),
    measurements,
  };
}

export function buildAiCoachGoals(
  coachGoals: CoachGoal[],
  bodyweightGoalKg: number | null,
  body: AICoachBody | null,
  primaryGoalId: string | null = null,
): AICoachGoal[] {
  // Which goal leads. A stored id that no longer matches a goal must not leave
  // the list headless, so the newest stated goal takes over — the last thing
  // the reader said out loud is the best guess at what they care about now.
  const primaryId =
    coachGoals.find((goal) => goal.id === primaryGoalId)?.id ??
    coachGoals.reduce<CoachGoal | null>(
      (newest, goal) => (newest === null || goal.createdAt > newest.createdAt ? goal : newest),
      null,
    )?.id ??
    null;
  const currentFor = (kind: string | null): number | null => {
    if (kind === 'bodyweight') return body?.weightKg ?? null;
    if (!kind) return null;
    return body?.measurements.find((entry) => entry.kind === kind)?.latestValue ?? null;
  };
  const goals: AICoachGoal[] = coachGoals.map((goal) => ({
    text: goal.text,
    kind: goal.kind,
    targetValue: goal.targetValue,
    unit: goal.unit,
    startValue: goal.startValue,
    currentValue: currentFor(goal.kind),
    setAt: goal.createdAt.slice(0, 10),
    isPrimary: goal.id === primaryId,
  }));
  // The onboarding weight goal counts as a goal too — but the one the user
  // stated to the coach wins when both name bodyweight.
  if (bodyweightGoalKg !== null && !goals.some((goal) => goal.kind === 'bodyweight')) {
    goals.push({
      text: 'reach target bodyweight',
      kind: 'bodyweight',
      targetValue: bodyweightGoalKg,
      unit: 'kg',
      startValue: null,
      currentValue: body?.weightKg ?? null,
      setAt: null,
      // An onboarding answer leads only when nothing was ever said to the
      // coach: a goal the reader stated in their own words outranks a number
      // they tapped into a setup step months ago.
      isPrimary: goals.length === 0,
    });
  }
  return goals;
}

/**
 * How much record a reading rests on. Counted from the log, not asked of the
 * model: self-rated confidence turns into "it seems that" in front of every
 * sentence, and the hedge stops meaning anything.
 *
 * The thresholds continue the rule the prompt already had — three sessions is
 * where a trend starts — and the top step needs both a count and a stretch of
 * calendar, because twelve sessions crammed into a fortnight say less about a
 * direction than the same twelve spread across six weeks.
 */
export function resolveHistoryConfidence(sessionCount: number, spanDays: number): AICoachHistoryConfidence {
  if (sessionCount < 3) {
    return 'low';
  }
  return sessionCount >= 12 && spanDays >= 42 ? 'high' : 'medium';
}

function historySpanDays(sessions: { performedAt: string }[]): number {
  if (sessions.length < 2) {
    return 0;
  }
  const times = sessions.map((entry) => new Date(entry.performedAt).getTime()).filter((time) => Number.isFinite(time));
  if (times.length < 2) {
    return 0;
  }
  return Math.round((Math.max(...times) - Math.min(...times)) / (24 * 60 * 60 * 1000));
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
    confidence: resolveHistoryConfidence(history.sessionCount, historySpanDays(history.sessions)),
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
  bodyweightEntries = [],
  measurementEntries = [],
  coachGoals = [],
  primaryGoalId = null,
  bodyweightGoalKg = null,
  profile = null,
  homeState = null,
  now = new Date(),
}: BuildAiTrainingContextInput): AICoachTrainingContext {
  const body = buildAiCoachBodyState(bodyweightEntries, measurementEntries, now);
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
    body,
    goals: buildAiCoachGoals(coachGoals, bodyweightGoalKg, body, primaryGoalId),
    profile: profile && (profile.heightCm !== null || profile.age !== null || profile.gender !== null) ? profile : null,
    homeState,
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
/**
 * The history block, repaired rather than trusted. The renderer walks
 * `sessions`, `lifts` and `weeks` unconditionally, so a payload that carries a
 * history without one of them used to throw on the way to the model — an
 * error where the honest outcome is a thinner answer.
 */
function normalizeHistory(input: Partial<AICoachHistory> | null | undefined): AICoachHistory {
  if (!input || typeof input !== 'object') {
    return emptyAiCoachHistory();
  }
  const empty = emptyAiCoachHistory();
  const list = <T,>(value: unknown, fallback: T[]): T[] => (Array.isArray(value) ? (value as T[]) : fallback);
  const sessions = list(input.sessions, empty.sessions);
  return {
    windowDays:
      typeof input.windowDays === 'number' && Number.isFinite(input.windowDays) ? input.windowDays : empty.windowDays,
    sessionCount:
      typeof input.sessionCount === 'number' && Number.isFinite(input.sessionCount)
        ? input.sessionCount
        : sessions.length,
    totalVolumeKg:
      typeof input.totalVolumeKg === 'number' && Number.isFinite(input.totalVolumeKg) ? input.totalVolumeKg : 0,
    sessions,
    lifts: list(input.lifts, empty.lifts),
    weeks: list(input.weeks, empty.weeks),
    schedule: input.schedule ?? null,
    truncated: input.truncated === true,
    // An older app sends a history with no confidence in it. Falling back to
    // 'low' would tell a reader with a year of training that their record is
    // too short, so it is recounted from what the payload does carry.
    confidence:
      input.confidence ??
      resolveHistoryConfidence(
        typeof input.sessionCount === 'number' && Number.isFinite(input.sessionCount)
          ? input.sessionCount
          : sessions.length,
        historySpanDays(sessions),
      ),
  };
}

function withPrimaryGoal(goals: AICoachGoal[]): AICoachGoal[] {
  if (goals.length === 0 || goals.some((goal) => goal.isPrimary === true)) {
    return goals;
  }
  return goals.map((goal, index) => ({ ...goal, isPrimary: index === goals.length - 1 }));
}

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
    history: normalizeHistory(candidate.history),
    plannerSetup: candidate.plannerSetup ?? null,
    body: candidate.body && typeof candidate.body === 'object' ? candidate.body : null,
    // An installed app that predates the primary goal sends goals without the
    // flag, and it keeps sending them until the reader updates. Rather than
    // leaving the list headless, the newest goal — last in the order the
    // client appends them — takes the lead, which is what a null stored
    // choice resolves to anyway.
    goals: withPrimaryGoal(array<AICoachGoal>(candidate.goals)),
    profile: candidate.profile && typeof candidate.profile === 'object' ? candidate.profile : null,
    homeState: candidate.homeState && typeof candidate.homeState === 'object' ? candidate.homeState : null,
  };
}
