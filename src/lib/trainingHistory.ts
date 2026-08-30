import { getCalendarWeekStartAfter, getRollingWindowStart } from './completedSessions';
import { getTotalVolume } from './progression';
import { ExerciseLog, SetupWeekday, WorkoutSession } from '../types/models';
import { TrainingSchedule, trainsOn } from './trainingSchedule';

/**
 * The numeric layer under everything the coach says.
 *
 * This file holds no words. It turns logged sessions and sets into figures —
 * per-session volume, per-lift trajectories, week-by-week planned versus
 * actual — and leaves the phrasing to its callers. The coach sheet and the
 * analysis screen render these numbers as localized sentences; the AI context
 * payload sends them raw, because the model should be given evidence and asked
 * to write, not handed a finished sentence to repeat.
 *
 * Keeping the arithmetic here is what stops the two surfaces from drifting
 * apart and quietly disagreeing about the same workout.
 *
 * Names stay as stored — English exercise and session snapshots are
 * identifiers here, not labels.
 */

const DAY_MS = 86400000;

/** Eight weeks: the span a reader should be able to reconstruct from this. */
export const DEFAULT_HISTORY_WINDOW_DAYS = 56;

const WEEKDAY_BY_INDEX: SetupWeekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export interface SessionSummary {
  sessionId: string;
  name: string;
  performedAt: string;
  time: number;
  durationMinutes: number | null;
  /** Null when the session has no weighted work to total. */
  volumeKg: number | null;
  setCount: number;
  exerciseCount: number;
}

export interface LiftPoint {
  sessionId: string;
  performedAt: string;
  time: number;
  topSetWeightKg: number;
  topSetReps: number;
  setCount: number;
  totalReps: number;
  volumeKg: number;
}

export interface LiftHistory {
  key: string;
  name: string;
  /** Oldest first. */
  points: LiftPoint[];
  first: LiftPoint;
  latest: LiftPoint;
  bestWeightKg: number;
  /** Latest top-set weight minus the first one. */
  weightChangeKg: number;
  spanDays: number;
  /** How many of the most recent sessions share the latest top-set weight. */
  stalledSessions: number;
}

export interface WeekSummary {
  /** Monday of the week, as a local YYYY-MM-DD date. */
  weekStart: string;
  sessions: number;
  volumeKg: number;
  /**
   * Sessions the schedule called for. Null without a fixed schedule; in the
   * running week it counts only the planned days that have already come round.
   */
  plannedSessions: number | null;
}

export interface ScheduleAdherence {
  trainingDays: SetupWeekday[];
  /** A rolling rhythm the weekday list cannot express; null for weekday plans. */
  cycle?: { onDays: number; offDays: number; length: number } | null;
  /** ISO date of the next training day on or after today. */
  nextTrainingDate?: string | null;
  plannedPerWeek: number;
  plannedSessions: number;
  completedSessions: number;
}

export interface TrainingHistory {
  windowDays: number;
  /** Oldest first, inside the window. */
  sessions: SessionSummary[];
  /** Most-trained lift first. */
  lifts: LiftHistory[];
  /** Oldest first, including weeks with no training. */
  weeks: WeekSummary[];
  /** Null when the plan places the week itself, so nothing was promised. */
  adherence: ScheduleAdherence | null;
  totalVolumeKg: number;
  sessionCount: number;
}

export interface TrainingHistoryInput {
  sessions: WorkoutSession[];
  logs: ExerciseLog[];
  /** Weekdays the plan schedules; empty means the plan has no fixed days. */
  trainingDays?: SetupWeekday[];
  /**
   * The plan's real rhythm when known. Wins over `trainingDays`: a cycle
   * cannot be written as weekdays, and availability is not a plan.
   */
  schedule?: TrainingSchedule | null;
  windowDays?: number;
  now?: number;
}

export function normalizedName(value: string) {
  return value.trim().toLowerCase();
}

export function sessionTime(session: Pick<WorkoutSession, 'performedAt'>) {
  const time = new Date(session.performedAt).getTime();
  return Number.isFinite(time) ? time : 0;
}

/** Heaviest completed set in a log, or null when nothing usable was logged. */
export function topSetOf(log: ExerciseLog) {
  if (log.skipped || log.weight <= 0) {
    return null;
  }

  const reps = (log.repsPerSet ?? []).filter((count) => count > 0);
  if (reps.length === 0) {
    return null;
  }

  return { weight: log.weight, reps: Math.max(...reps) };
}

export function completedReps(log: ExerciseLog) {
  return (log.repsPerSet ?? []).filter((count) => count > 0);
}

/**
 * Total lifted in a session. Prefers the stored total and recomputes for older
 * saves that predate it, so history does not thin out the further back it goes.
 */
export function sessionVolumeKg(session: WorkoutSession, logs: ExerciseLog[]) {
  if (typeof session.totalVolumeKg === 'number' && session.totalVolumeKg > 0) {
    return session.totalVolumeKg;
  }

  const own = logs.filter((log) => log.sessionId === session.id);
  const volume = own.reduce((sum, log) => sum + getTotalVolume(log), 0);
  return volume > 0 ? volume : null;
}

/**
 * Every session sharing a name with this one, up to and including it, oldest
 * first. "Compared with your last Push" only means something against Push.
 */
export function comparableSessions(session: WorkoutSession, sessions: WorkoutSession[]) {
  const key = normalizedName(session.workoutNameSnapshot);
  const until = sessionTime(session);
  return sessions
    .filter((entry) => normalizedName(entry.workoutNameSnapshot) === key)
    .filter((entry) => entry.id === session.id || sessionTime(entry) <= until)
    .sort((left, right) => sessionTime(left) - sessionTime(right));
}

/** The most recent session of the same name before this one, or null. */
export function previousComparableSession(session: WorkoutSession, sessions: WorkoutSession[]) {
  const earlier = comparableSessions(session, sessions).filter((entry) => entry.id !== session.id);
  return earlier.length > 0 ? earlier[earlier.length - 1] : null;
}

function startOfWeek(time: number) {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  // Monday-first, matching the week strip the rest of the app draws.
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return date.getTime();
}

function isoDate(time: number) {
  const date = new Date(time);
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function summarizeSession(
  session: WorkoutSession,
  logsBySession: Map<string, ExerciseLog[]>,
  logs: ExerciseLog[],
): SessionSummary {
  const own = (logsBySession.get(session.id) ?? []).filter((log) => !log.skipped);
  const setCount = own.reduce((sum, log) => sum + completedReps(log).length, 0);

  return {
    sessionId: session.id,
    name: session.workoutNameSnapshot.trim(),
    performedAt: session.performedAt,
    time: sessionTime(session),
    durationMinutes:
      typeof session.durationMinutes === 'number' && session.durationMinutes > 0
        ? session.durationMinutes
        : null,
    volumeKg: sessionVolumeKg(session, logs),
    setCount,
    exerciseCount: own.length,
  };
}

/**
 * Per-lift trajectories across the given sessions, oldest point first.
 *
 * A lift only produces a point for a session where it was genuinely logged, so
 * the gaps in a series are real gaps rather than zeros.
 */
export function buildLiftHistories(
  sessions: WorkoutSession[],
  logs: ExerciseLog[],
): LiftHistory[] {
  const timeById = new Map(sessions.map((session) => [session.id, sessionTime(session)] as const));
  const buckets = new Map<string, { name: string; nameTime: number; points: LiftPoint[] }>();

  for (const log of logs) {
    const top = topSetOf(log);
    const time = timeById.get(log.sessionId);
    if (!top || time === undefined) {
      continue;
    }

    const reps = completedReps(log);
    const key = normalizedName(log.exerciseNameSnapshot);
    const bucket = buckets.get(key) ?? { name: '', nameTime: -1, points: [] };
    if (time >= bucket.nameTime) {
      // A renamed lift should read the way it does today.
      bucket.name = log.exerciseNameSnapshot.trim();
      bucket.nameTime = time;
    }
    bucket.points.push({
      sessionId: log.sessionId,
      performedAt: new Date(time).toISOString(),
      time,
      topSetWeightKg: top.weight,
      topSetReps: top.reps,
      setCount: reps.length,
      totalReps: reps.reduce((sum, count) => sum + count, 0),
      volumeKg: getTotalVolume(log),
    });
    buckets.set(key, bucket);
  }

  const histories: LiftHistory[] = [];

  for (const [key, bucket] of buckets) {
    const points = [...bucket.points].sort((left, right) => left.time - right.time);
    const first = points[0];
    const latest = points[points.length - 1];

    let stalledSessions = 1;
    for (let index = points.length - 2; index >= 0; index -= 1) {
      if (Math.abs(points[index].topSetWeightKg - latest.topSetWeightKg) >= 0.001) {
        break;
      }
      stalledSessions += 1;
    }

    histories.push({
      key,
      name: bucket.name,
      points,
      first,
      latest,
      bestWeightKg: points.reduce((max, point) => Math.max(max, point.topSetWeightKg), 0),
      weightChangeKg: Math.round((latest.topSetWeightKg - first.topSetWeightKg) * 100) / 100,
      spanDays: Math.max(0, Math.round((latest.time - first.time) / DAY_MS)),
      stalledSessions,
    });
  }

  return histories.sort(
    (left, right) => right.points.length - left.points.length || right.latest.time - left.latest.time,
  );
}

function buildWeeks(
  sessions: SessionSummary[],
  trainingDays: SetupWeekday[],
  now: number,
  schedule: TrainingSchedule | null = null,
): WeekSummary[] {
  const isTrainingDay = (date: Date) =>
    schedule ? trainsOn(schedule, date) : trainingDays.includes(WEEKDAY_BY_INDEX[date.getDay()]);
  const hasPlan = schedule ? true : trainingDays.length > 0;
  if (sessions.length === 0) {
    return [];
  }

  const firstWeek = startOfWeek(sessions[0].time);
  const currentWeek = startOfWeek(now);
  const weeks: WeekSummary[] = [];
  const todayStart = new Date(now).setHours(0, 0, 0, 0);

  // Calendar stepping, not 7 * DAY_MS. A week containing a clock change is 167
  // or 169 hours long, so a fixed step drifts an hour off local Monday midnight
  // and then compounds: past a spring change the cursor overshoots currentWeek
  // and the loop exits before emitting the running week at all, and past an
  // autumn one every weekStart lands on the previous Sunday at 23:00, which
  // isoDate then names as the week and the planned-session cap reads as a week
  // already over.
  let weekStart = firstWeek;
  while (weekStart <= currentWeek) {
    // One value, used as this week's upper bound and as the next cursor, so the
    // two cannot drift apart if either is ever changed.
    const weekEnd = getCalendarWeekStartAfter(weekStart);
    const inWeek = sessions.filter((entry) => entry.time >= weekStart && entry.time < weekEnd);

    let plannedSessions: number | null = null;
    if (hasPlan) {
      // Count the week's days through the schedule, so a cycle's planned
      // count is the days it actually lands on, not a weekday tally. The
      // running week only promises up to today.
      let planned = 0;
      for (let offset = 0; offset < 7; offset += 1) {
        const dayStart = new Date(weekStart);
        dayStart.setDate(dayStart.getDate() + offset);
        if (weekStart >= currentWeek && dayStart.getTime() > todayStart) {
          break;
        }
        if (isTrainingDay(dayStart)) {
          planned += 1;
        }
      }
      plannedSessions = planned;
    }

    weeks.push({
      weekStart: isoDate(weekStart),
      sessions: inWeek.length,
      volumeKg: Math.round(inWeek.reduce((sum, entry) => sum + (entry.volumeKg ?? 0), 0)),
      plannedSessions,
    });

    weekStart = weekEnd;
  }

  return weeks;
}

export function buildTrainingHistory({
  sessions,
  logs,
  trainingDays = [],
  schedule = null,
  windowDays = DEFAULT_HISTORY_WINDOW_DAYS,
  now = Date.now(),
}: TrainingHistoryInput): TrainingHistory {
  // Calendar stepping, like the week rows above: a fixed windowDays * DAY_MS
  // puts the cutoff an hour off the time of day it claims for the six months
  // after every clock change, admitting a session from the far side of the
  // window or dropping one inside it.
  const cutoff = getRollingWindowStart(now, windowDays);
  const inWindow = sessions
    .filter((session) => sessionTime(session) >= cutoff)
    .sort((left, right) => sessionTime(left) - sessionTime(right));

  const logsBySession = new Map<string, ExerciseLog[]>();
  for (const log of logs) {
    const bucket = logsBySession.get(log.sessionId) ?? [];
    bucket.push(log);
    logsBySession.set(log.sessionId, bucket);
  }

  const summaries = inWindow.map((session) => summarizeSession(session, logsBySession, logs));
  const windowIds = new Set(inWindow.map((session) => session.id));
  const windowLogs = logs.filter((log) => windowIds.has(log.sessionId) && !log.skipped);
  const weeks = buildWeeks(summaries, trainingDays, now, schedule);

  const adherence: ScheduleAdherence | null = describeSchedule(schedule, trainingDays, weeks, summaries.length, now);

  return {
    windowDays,
    sessions: summaries,
    lifts: buildLiftHistories(inWindow, windowLogs),
    weeks,
    adherence,
    totalVolumeKg: Math.round(summaries.reduce((sum, entry) => sum + (entry.volumeKg ?? 0), 0)),
    sessionCount: summaries.length,
  };
}

/** The next day on or after today the schedule trains on, as an ISO date. */
function nextTrainingDate(schedule: TrainingSchedule, now: number): string | null {
  for (let offset = 0; offset < 14; offset += 1) {
    const day = new Date(now);
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() + offset);
    if (trainsOn(schedule, day)) {
      return isoDate(day.getTime());
    }
  }
  return null;
}

function describeSchedule(
  schedule: TrainingSchedule | null,
  trainingDays: SetupWeekday[],
  weeks: WeekSummary[],
  completedSessions: number,
  now: number,
): ScheduleAdherence | null {
  const plannedSessions = weeks.reduce((sum, week) => sum + (week.plannedSessions ?? 0), 0);
  if (schedule?.kind === 'cycle') {
    const onDays = schedule.pattern.filter(Boolean).length;
    const length = schedule.pattern.length;
    return {
      trainingDays: [],
      cycle: { onDays, offDays: length - onDays, length },
      nextTrainingDate: nextTrainingDate(schedule, now),
      plannedPerWeek: Math.round((7 * onDays) / length * 10) / 10,
      plannedSessions,
      completedSessions,
    };
  }
  if (schedule?.kind === 'weekdays') {
    // Monday first, and the sort is load-bearing rather than tidiness. The
    // schedule's own array is in PLAN ORDER — which session owns which day —
    // because that is what decides "is today session one" further up
    // (programTrainingDays.planWeekdayIndexes). This list is not that
    // question: it is the week read aloud, and it ends up in the coach's
    // system prompt as "3x/week on …". Left in plan order a programme adopted
    // on a Sunday described itself as "Sun, Wed, Fri", so two readers with the
    // same week got different sentences depending only on the day they
    // happened to start.
    const days = [...schedule.weekdayIndexes]
      .sort((left, right) => left - right)
      .map((index) => WEEKDAY_BY_INDEX[(index + 1) % 7]);
    if (days.length === 0) {
      return null;
    }
    return {
      trainingDays: days,
      cycle: null,
      nextTrainingDate: nextTrainingDate(schedule, now),
      plannedPerWeek: days.length,
      plannedSessions,
      completedSessions,
    };
  }
  if (trainingDays.length > 0) {
    return { trainingDays, plannedPerWeek: trainingDays.length, plannedSessions, completedSessions };
  }
  return null;
}
