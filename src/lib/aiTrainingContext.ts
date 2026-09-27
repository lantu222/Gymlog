import { calendarDaysBetween, getRollingWindowStart, localDateKey } from './completedSessions';
import { getCardioMinutes } from './cardio';
import { HomeSummary } from './dashboard';
import { ExerciseProgressSummary } from './progression';
import {
  BodyweightEntry,
  CardioSession,
  CoachGoal,
  ExerciseLog,
  MeasurementEntry,
  SetupWeekday,
  UnitPreference,
  WorkoutSession,
} from '../types/models';
import {
  AICoachBody,
  AICoachBodyChange,
  AICoachCardio,
  AICoachGoal,
  AICoachHistory,
  AICoachHistoryConfidence,
  AICoachHomeState,
  AICoachLastSession,
  AICoachProfile,
  AICoachProgramme,
  AICoachTrainingContext,
} from '../types/aiCoach';
import { DEFAULT_BUDGET_LIMITS } from './aiCoachBudget';
import { buildAiCoachContextText } from './aiCoachSystemContext';
import { detectPlateaus } from './progressionAnalyzer';
import { buildFatigueModel } from './fatigueModel';
import { getComparableLogSets } from './exerciseLog';
import {
  buildTrainingHistory,
  DEFAULT_HISTORY_WINDOW_DAYS,
  normalizedName,
  sessionTime,
  sessionVolumeKg,
  topSetOf,
} from './trainingHistory';
import { CoachAdviceMemoryEntry, buildCoachAdviceLines, parseCoachAdviceLines } from './coachAdviceMemory';
import type { TrainingSchedule } from './trainingSchedule';

/**
 * Caps on the history block. Model quality is bounded by what we tell it, but
 * an unbounded payload is a bill — these keep eight weeks of real training
 * inside a few kilobytes, and `truncated` says so when older work is dropped.
 */
const MAX_HISTORY_SESSIONS = 24;
const MAX_HISTORY_LIFTS = 10;
const MAX_LAST_SESSION_EXERCISES = 12;
const MAX_LAST_SESSION_SETS = 8;
/** A cardio line is short, but it is still a line per session. */
const MAX_CARDIO_SESSIONS = 12;

type AiCardioInput = Pick<CardioSession, 'id' | 'activityType' | 'performedAt' | 'durationSec' | 'distanceKm'>;

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
  /**
   * Runs, rides and rows. `homeSummary`'s counts already include them, so
   * leaving them out here made the context disagree with itself.
   */
  cardioSessions?: AiCardioInput[];
  exerciseLogs: ExerciseLog[];
  trackedProgress: ExerciseProgressSummary[];
  readyProgramCount: number;
  recommendedProgramId: string | null;
  recommendedProgramTitle: string | null;
  customProgramTitle: string | null;
  /** The running programme's actual week — see buildAiCoachProgramme. */
  programme?: AICoachProgramme | null;
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
  /**
   * What the coach already told this reader, from
   * storage/coachAdviceMemoryStore. Passed through rather than derived: it is
   * the only part of the context the app itself did not observe.
   */
  coachMemory?: CoachAdviceMemoryEntry[];
  bodyweightGoalKg?: number | null;
  profile?: AICoachProfile | null;
  /** What Home already shows and what the coach must not offer right now. */
  homeState?: AICoachHomeState | null;
  /**
   * The set screen's opening targets for the last session's lifts, next time
   * (workoutState previewNextSession) — from the caller, which owns the
   * workout store. Empty when the last session is not a startable programme's.
   */
  nextSessionTargets?: readonly { exerciseName: string; sets: { loadKg: number | null; reps: number }[] }[];
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
  // Calendar stepping: a fixed windowDays * 24h puts the edge an hour off the
  // time of day it claims for the six months after every clock change, so a
  // weigh-in near the boundary is admitted or dropped against what the coach is
  // told the window covers.
  const cutoff = getRollingWindowStart(now, windowDays);
  // Bounded at both ends, like every sibling window. A weigh-in stamped in the
  // future — a wrong device clock keeps that timestamp forever — otherwise
  // becomes the reading the change is measured to, and a thirty-day window
  // reports a four-month span.
  const nowTimestamp = now.getTime();
  const inWindow = sorted.filter((entry) => {
    const recordedAt = new Date(entry.recordedAt).getTime();
    return recordedAt >= cutoff && recordedAt <= nowTimestamp;
  });
  if (inWindow.length < 2) {
    // One weigh-in is a fact, not a direction — report no change at all.
    return null;
  }
  const first = inWindow[0];
  const last = inWindow[inWindow.length - 1];
  const spanDays = calendarDaysBetween(first.recordedAt, last.recordedAt);
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
  // Bounded like the change windows below. Left open, a weigh-in stamped in
  // the future is reported as the reader's current weight while the change
  // beside it is measured to a different reading entirely — one payload
  // stating two weights.
  const nowTimestamp = now.getTime();
  const recordedWeights = weights.filter(
    (entry) => new Date(entry.recordedAt).getTime() <= nowTimestamp,
  );
  const latestWeight = recordedWeights[recordedWeights.length - 1] ?? null;

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
      latestAt: localDateKey(latest.recordedAt),
      previousValue: previous?.value ?? null,
      previousAt: previous ? localDateKey(previous.recordedAt) : null,
    };
  });

  if (!latestWeight && measurements.length === 0) {
    return null;
  }
  return {
    weightKg: latestWeight?.weight ?? null,
    weightAt: latestWeight ? localDateKey(latestWeight.recordedAt) : null,
    weightChange30d: weightChange(weights, 30, now),
    weightChange90d: weightChange(weights, 90, now),
    measurements,
  };
}

/**
 * Dates the coach quotes are the reader's days, not UTC's.
 *
 * `recordedAt.slice(0, 10)` is the first ten characters of an ISO string,
 * which is the UTC date: a weigh-in at half past midnight in Helsinki is
 * stored as 21:30 the previous day, so the coach told the reader they last
 * weighed in yesterday — and dated the change it was reading from
 * (2026-09-16). localDateKey resolves the day on the phone, which is the only
 * place that knows the reader's timezone; the endpoint's own clock is UTC.
 */
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
    setAt: localDateKey(goal.createdAt),
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
  now: Date = new Date(),
): AICoachHistory {
  const history = buildTrainingHistory({
    sessions: workoutSessions,
    logs: exerciseLogs,
    trainingDays,
    schedule,
    windowDays,
    now: now.getTime(),
  });

  const sessions = history.sessions.slice(-MAX_HISTORY_SESSIONS).map((entry) => ({
    sessionId: entry.sessionId,
    name: entry.name,
    performedAt: entry.performedAt,
    day: localDateKey(entry.performedAt),
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

/**
 * The cardio block: what the session counts include and the strength blocks
 * do not. Null when there is none to report, which is what an older client's
 * payload looks like too.
 *
 * Deduplicated by id and bounded at now, like every sibling window; the 7- and
 * 30-day counts use the same calendar-stepped edges as the Load lines they sit
 * beside, so "3 sessions, 3 of them cardio" is one count read two ways.
 */
export function buildAiCoachCardio(
  cardioSessions: AiCardioInput[],
  windowDays: number,
  now: Date = new Date(),
): AICoachCardio | null {
  const nowMs = now.getTime();
  const seen = new Set<string>();
  const dated = cardioSessions
    .filter((session) => {
      if (seen.has(session.id)) {
        return false;
      }
      seen.add(session.id);
      return true;
    })
    .map((session) => ({ session, at: new Date(session.performedAt).getTime() }))
    .filter((entry) => Number.isFinite(entry.at) && entry.at <= nowMs)
    .sort((left, right) => left.at - right.at);
  const since = (days: number) => {
    const start = getRollingWindowStart(now, days);
    return dated.filter((entry) => entry.at >= start);
  };
  const inWindow = since(windowDays);
  const last30 = since(30);
  if (inWindow.length === 0 && last30.length === 0) {
    return null;
  }
  const shown = inWindow.slice(-MAX_CARDIO_SESSIONS);
  return {
    windowDays,
    sessionCount: inWindow.length,
    totalMinutes: getCardioMinutes(inWindow.map((entry) => entry.session)),
    sessionsLast7Days: since(7).length,
    sessionsLast30Days: last30.length,
    sessions: shown.map(({ session }) => ({
      day: localDateKey(session.performedAt),
      activity: session.activityType,
      minutes: getCardioMinutes([session]),
      distanceKm: typeof session.distanceKm === 'number' && session.distanceKm > 0 ? session.distanceKm : null,
    })),
    truncated: inWindow.length > shown.length,
  };
}

/**
 * A lift's next-session targets as the context carries them: one load (the
 * first set's — the screen opens there) and every set's reps. Null when the
 * app has nothing to open on.
 */
function nextFor(
  lift: { sets: { loadKg: number | null; reps: number }[] } | undefined,
): { loadKg: number | null; reps: number[] } | null {
  if (!lift || lift.sets.length === 0) {
    return null;
  }
  const reps = lift.sets.map((set) => set.reps).filter((count) => Number.isFinite(count) && count > 0);
  if (reps.length === 0) {
    return null;
  }
  const loadKg = lift.sets[0].loadKg;
  return { loadKg: typeof loadKg === 'number' && Number.isFinite(loadKg) && loadKg > 0 ? loadKg : null, reps };
}

/**
 * The newest session at or before now, with every exercise's completed sets —
 * see AICoachLastSession. Null when nothing is logged.
 */
export function buildAiCoachLastSession(
  workoutSessions: WorkoutSession[],
  exerciseLogs: ExerciseLog[],
  now: Date = new Date(),
  /**
   * What the set screen will open on next time for this session's lifts
   * (workoutState previewNextSession), built by the caller that owns the
   * workout store. Matched to a lift by name.
   */
  nextTargets: readonly { exerciseName: string; sets: { loadKg: number | null; reps: number }[] }[] = [],
): AICoachLastSession | null {
  const nextByLift = new Map(nextTargets.map((lift) => [normalizedName(lift.exerciseName), lift]));
  const nowMs = now.getTime();
  let newest: WorkoutSession | null = null;
  let newestAt = -Infinity;
  for (const session of workoutSessions) {
    const at = new Date(session.performedAt).getTime();
    if (Number.isFinite(at) && at <= nowMs && at > newestAt) {
      newest = session;
      newestAt = at;
    }
  }
  if (!newest) {
    return null;
  }
  const sessionId = newest.id;
  const setsOf = (log: ExerciseLog) =>
    getComparableLogSets(log)
      .filter((set) => set.reps > 0 && set.weight >= 0)
      .map((set) => ({ weightKg: set.weight, reps: set.reps }));

  // Every earlier session, newest first — "before" is by time, not by list order.
  const earlierAt = new Map<string, number>();
  for (const session of workoutSessions) {
    const at = sessionTime(session);
    if (session.id !== sessionId && at < newestAt) {
      earlierAt.set(session.id, at);
    }
  }
  const sessionById = new Map(workoutSessions.map((session) => [session.id, session]));
  const sameName = normalizedName(newest.workoutNameSnapshot);
  // Earlier logs of each lift, newest first — grouped once, not rescanned per lift.
  const earlierByLift = new Map<string, { log: ExerciseLog; sets: ReturnType<typeof setsOf> }[]>();
  for (const log of exerciseLogs) {
    if (!earlierAt.has(log.sessionId) || log.skipped) continue;
    const sets = setsOf(log);
    if (sets.length === 0) continue;
    const key = normalizedName(log.exerciseNameSnapshot);
    const list = earlierByLift.get(key) ?? [];
    list.push({ log, sets });
    earlierByLift.set(key, list);
  }
  for (const list of earlierByLift.values()) {
    list.sort((left, right) => (earlierAt.get(right.log.sessionId) ?? 0) - (earlierAt.get(left.log.sessionId) ?? 0));
  }

  const exercises = exerciseLogs
    .filter((log) => log.sessionId === sessionId && !log.skipped)
    .sort((left, right) => left.orderIndex - right.orderIndex)
    .map((log) => {
      const sets = setsOf(log);
      const name = log.exerciseNameSnapshot.trim();
      const earlier = earlierByLift.get(normalizedName(name)) ?? [];
      const before = earlier[0];
      const beforeSession = before ? sessionById.get(before.log.sessionId) : undefined;
      // The streak is this day's: a lift programmed heavier on one day and
      // lighter on another would otherwise restart every session, and the
      // block would call a weight "first" that this day has used for weeks.
      const top = topSetOf(log)?.weight ?? null;
      let sessionsAtThisWeight = 1;
      for (const entry of earlier) {
        const entrySession = sessionById.get(entry.log.sessionId);
        if (!entrySession || normalizedName(entrySession.workoutNameSnapshot) !== sameName) continue;
        if (top === null || topSetOf(entry.log)?.weight !== top) break;
        sessionsAtThisWeight += 1;
      }
      return {
        name,
        sets,
        previous:
          before && beforeSession
            ? { day: localDateKey(beforeSession.performedAt), sets: before.sets.slice(0, MAX_LAST_SESSION_SETS) }
            : null,
        sessionsAtThisWeight,
        next: nextFor(nextByLift.get(normalizedName(name))),
      };
    })
    .filter((exercise) => exercise.name.length > 0 && exercise.sets.length > 0);
  const shown = exercises
    .slice(0, MAX_LAST_SESSION_EXERCISES)
    .map((exercise) => ({ ...exercise, sets: exercise.sets.slice(0, MAX_LAST_SESSION_SETS) }));

  let previousSameName: WorkoutSession | null = null;
  for (const session of workoutSessions) {
    const at = earlierAt.get(session.id);
    if (
      at !== undefined &&
      normalizedName(session.workoutNameSnapshot) === sameName &&
      (!previousSameName || at > sessionTime(previousSameName))
    ) {
      previousSameName = session;
    }
  }
  const previousVolume = previousSameName ? sessionVolumeKg(previousSameName, exerciseLogs) : null;

  return {
    day: localDateKey(newest.performedAt),
    name: newest.workoutNameSnapshot.trim(),
    exercises: shown,
    truncated:
      exercises.length > shown.length || exercises.some((exercise) => exercise.sets.length > MAX_LAST_SESSION_SETS),
    previousSameName: previousSameName
      ? {
          day: localDateKey(previousSameName.performedAt),
          volumeKg: previousVolume === null ? null : Math.round(previousVolume),
        }
      : null,
  };
}

export function buildAiTrainingContext({
  unitPreference,
  activeWorkoutSummary,
  homeSummary,
  workoutSessions,
  cardioSessions = [],
  exerciseLogs,
  trackedProgress,
  readyProgramCount,
  recommendedProgramId,
  recommendedProgramTitle,
  customProgramTitle,
  programme = null,
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
  coachMemory = [],
  profile = null,
  homeState = null,
  nextSessionTargets = [],
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
      // Dated here, on the phone: see AICoachRecentCompletedSession.day.
      day: localDateKey(session.performedAt),
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

  // The same reference date every other block in this payload is built from.
  // Left to its own clock it reports a different week than the history beside it.
  const fatigueResult = buildFatigueModel({ workoutSessions, exerciseLogs }, now);
  const fatigue = {
    acwr: fatigueResult.acwr,
    recoveryScore: fatigueResult.recoveryScore,
    signal: fatigueResult.signal,
    confident: fatigueResult.confident,
    sessionCount7d: fatigueResult.sessionCount7d,
  };

  return fitAiCoachContextToCap({
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
    programme,
    plateaus,
    fatigue,
    history: buildHistoryBlock(workoutSessions, exerciseLogs, trainingDays, historyWindowDays, schedule, now),
    lastSession: buildAiCoachLastSession(workoutSessions, exerciseLogs, now, nextSessionTargets),
    cardio: buildAiCoachCardio(cardioSessions, historyWindowDays, now),
    ...(plannerSetup !== undefined ? { plannerSetup } : {}),
    body,
    goals: buildAiCoachGoals(coachGoals, bodyweightGoalKg, body, primaryGoalId),
    profile:
      profile
      && (profile.heightCm !== null
        || profile.age !== null
        || (profile.ageRange !== null && profile.ageRange !== undefined)
        || profile.gender !== null)
        ? profile
        : null,
    homeState,
    // Dates resolved on the device: buildAiCoachSystemContext runs on the
    // endpoint, where the timezone is the server's. Expiry runs here too — the
    // file was last written when the reader's last question was answered.
    coachMemory: buildCoachAdviceLines(coachMemory, now.toISOString()),
  });
}

/** A goal is a sentence; past this it is a paragraph pasted into the chat. */
const FIT_GOAL_TEXT_CHARS = 200;
/** The last resort's length for any one piece of text. */
const FIT_ANY_TEXT_CHARS = 60;

function clipText(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Every string in a value, clipped — the last step, when names alone overflow. */
function clipAllText<T>(value: T, max: number): T {
  if (typeof value === 'string') {
    return clipText(value, max) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => clipAllText(entry, max)) as unknown as T;
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, clipAllText(entry, max)])) as T;
  }
  return value;
}

/**
 * What goes when a context is too big to send, least needed first. Each step
 * keeps what the one before it kept and takes a little more; the history
 * blocks say "N of M shown" when they are trimmed, so nothing reads as a
 * shorter record than the reader has.
 */
const CONTEXT_SHEDDING: ReadonlyArray<(context: AICoachTrainingContext) => AICoachTrainingContext> = [
  (context) => ({
    ...context,
    goals: (context.goals ?? []).map((goal) => ({ ...goal, text: clipText(goal.text, FIT_GOAL_TEXT_CHARS) })),
  }),
  (context) => ({ ...context, coachMemory: [] }),
  (context) => ({ ...context, plateaus: context.plateaus.slice(0, 5) }),
  (context) => ({
    ...context,
    history: { ...context.history, sessions: context.history.sessions.slice(-12), truncated: true },
    cardio: context.cardio ? { ...context.cardio, sessions: context.cardio.sessions.slice(-6), truncated: true } : context.cardio,
  }),
  (context) => ({
    ...context,
    programme: context.programme
      ? {
          ...context.programme,
          days: context.programme.days.map((day) => ({ ...day, exercises: day.exercises.slice(0, 6) })),
          truncated: true,
        }
      : context.programme,
    history: {
      ...context.history,
      lifts: context.history.lifts.slice(0, 5).map((lift) => ({ ...lift, weightSeriesKg: lift.weightSeriesKg.slice(-8) })),
    },
  }),
  // The reader can open their plan; the coach can do without its rows.
  (context) => ({ ...context, programme: null }),
  (context) => ({
    ...context,
    history: { ...context.history, sessions: [], lifts: [], truncated: true },
    lastSession: context.lastSession
      ? {
          ...context.lastSession,
          exercises: context.lastSession.exercises.slice(0, 6),
          // Only when something was cut: the block says so to the model.
          truncated: context.lastSession.truncated || context.lastSession.exercises.length > 6,
        }
      : context.lastSession,
    cardio: context.cardio ? { ...context.cardio, sessions: [], truncated: true } : context.cardio,
    goals: (context.goals ?? []).filter((goal) => goal.isPrimary),
  }),
  (context) => clipAllText(context, FIT_ANY_TEXT_CHARS),
];

/**
 * The context, trimmed until the endpoint will take it.
 *
 * The endpoint refuses a context longer than its cap — measured on the text it
 * sends (buildAiCoachContextText) — and a refusal reaches the reader as the
 * offline badge on every question. The caps in this file keep an ordinary
 * reader well under it, but names and goals are the reader's own words with no
 * length, and a heavy reader crossed the cap once the endpoint's own rules
 * were counted in it (server audit, 2026-09-21). Measured exactly as the
 * endpoint measures, after the same repair; returned untouched when it fits.
 */
export function fitAiCoachContextToCap(
  context: AICoachTrainingContext,
  maxChars: number = DEFAULT_BUDGET_LIMITS.maxContextChars,
): AICoachTrainingContext {
  const fits = (candidate: AICoachTrainingContext) =>
    buildAiCoachContextText(normalizeAiCoachTrainingContext(candidate)).length <= maxChars;
  if (fits(context)) {
    return context;
  }
  let fitted = context;
  for (const shed of CONTEXT_SHEDDING) {
    fitted = shed(fitted);
    if (fits(fitted)) {
      break;
    }
  }
  return fitted;
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

/**
 * The last session, rebuilt field by field: it is rendered as text in front of
 * the model, and on the endpoint it is whatever was posted. An exercise with a
 * name that is not plain text or a set that is not two sane numbers is dropped;
 * an older client sends none, which is null.
 */
function normalizeLastSession(input: unknown): AICoachLastSession | null {
  if (!input || typeof input !== 'object') {
    return null;
  }
  const candidate = input as Partial<AICoachLastSession>;
  const isDay = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
  const day = isDay(candidate.day) ? candidate.day : null;
  const name = typeof candidate.name === 'string' ? candidate.name.trim().slice(0, 120) : '';
  if (!day || !name || !Array.isArray(candidate.exercises)) {
    return null;
  }
  const parseSets = (value: unknown) =>
    (Array.isArray(value) ? value : [])
      .slice(0, MAX_LAST_SESSION_SETS)
      .filter(
        (set): set is { weightKg: number; reps: number } =>
          !!set &&
          typeof set.weightKg === 'number' &&
          Number.isFinite(set.weightKg) &&
          set.weightKg >= 0 &&
          set.weightKg <= 1000 &&
          typeof set.reps === 'number' &&
          Number.isInteger(set.reps) &&
          set.reps > 0 &&
          set.reps <= 500,
      )
      .map((set) => ({ weightKg: set.weightKg, reps: set.reps }));
  const exercises = candidate.exercises
    .slice(0, MAX_LAST_SESSION_EXERCISES)
    .map((exercise) => {
      const exerciseName =
        exercise && typeof exercise === 'object' && typeof exercise.name === 'string'
          ? exercise.name.trim().slice(0, 80)
          : '';
      const sets = parseSets(exercise?.sets);
      const previousSets = parseSets(exercise?.previous?.sets);
      // Absent stays absent: an app from before this field sends none, and
      // null would tell the model every lift was a first.
      const previous =
        exercise?.previous && isDay(exercise.previous.day) && previousSets.length > 0
          ? { day: exercise.previous.day, sets: previousSets }
          : exercise?.previous === null
            ? null
            : undefined;
      const streak = exercise?.sessionsAtThisWeight;
      const rawNext = exercise?.next;
      const nextReps = Array.isArray(rawNext?.reps)
        ? rawNext.reps
            .slice(0, MAX_LAST_SESSION_SETS)
            .filter((count): count is number => typeof count === 'number' && Number.isInteger(count) && count > 0 && count <= 500)
        : [];
      const nextLoad = rawNext?.loadKg;
      const next =
        nextReps.length > 0
          ? {
              loadKg: typeof nextLoad === 'number' && Number.isFinite(nextLoad) && nextLoad > 0 && nextLoad <= 1000 ? nextLoad : null,
              reps: nextReps,
            }
          : null;
      return {
        name: exerciseName,
        sets,
        ...(next ? { next } : {}),
        ...(previous !== undefined ? { previous } : {}),
        ...(typeof streak === 'number' && Number.isInteger(streak) && streak >= 1 && streak <= 1000
          ? { sessionsAtThisWeight: streak }
          : {}),
      };
    })
    .filter((exercise) => exercise.name.length > 0 && exercise.sets.length > 0);
  const before = candidate.previousSameName;
  const previousSameName =
    before && typeof before === 'object' && isDay(before.day)
      ? {
          day: before.day,
          volumeKg:
            typeof before.volumeKg === 'number' && Number.isFinite(before.volumeKg) && before.volumeKg >= 0
              ? before.volumeKg
              : null,
        }
      : null;
  return { day, name, exercises, truncated: candidate.truncated === true, previousSameName };
}

/**
 * The cardio block, rebuilt field by field. Rendered as text in front of the
 * model, so a line that is not a plain day, a known-shaped id and numbers is
 * dropped rather than passed on; an older client sends none, which is null.
 */
function normalizeCardio(input: unknown): AICoachCardio | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return null;
  }
  const raw = input as Partial<Record<keyof AICoachCardio, unknown>>;
  const count = (value: unknown) =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.round(value) : 0;
  const sessions = (Array.isArray(raw.sessions) ? raw.sessions : [])
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
    .filter(
      (entry) =>
        typeof entry.day === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(entry.day) &&
        typeof entry.activity === 'string' &&
        /^[a-z-]{1,20}$/.test(entry.activity),
    )
    .slice(-MAX_CARDIO_SESSIONS)
    .map((entry) => ({
      day: entry.day as string,
      activity: entry.activity as string,
      minutes: count(entry.minutes),
      distanceKm:
        typeof entry.distanceKm === 'number' && Number.isFinite(entry.distanceKm) && entry.distanceKm > 0
          ? entry.distanceKm
          : null,
    }));
  return {
    windowDays: count(raw.windowDays) || DEFAULT_HISTORY_WINDOW_DAYS,
    sessionCount: count(raw.sessionCount),
    totalMinutes: count(raw.totalMinutes),
    sessionsLast7Days: count(raw.sessionsLast7Days),
    sessionsLast30Days: count(raw.sessionsLast30Days),
    sessions,
    truncated: raw.truncated === true,
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
    programme: candidate.programme && typeof candidate.programme === 'object' ? candidate.programme : null,
    plateaus: array(candidate.plateaus),
    fatigue: fatigue ?? {
      acwr: 0,
      recoveryScore: 0,
      signal: 'optimal',
      sessionCount7d: 0,
      confident: false,
    },
    history: normalizeHistory(candidate.history),
    lastSession: normalizeLastSession(candidate.lastSession),
    cardio: normalizeCardio(candidate.cardio),
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
    // Re-parsed rather than trusted. This runs on the endpoint, where the
    // payload is whatever was posted: the same bound the device applies has to
    // hold for a request the device did not write.
    coachMemory: parseCoachAdviceLines(candidate.coachMemory),
  };
}
