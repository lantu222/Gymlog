import type { WorkoutRestTimerState, WorkoutSessionRuntime } from '../features/workout/workoutTypes';

/**
 * A running session's clock, read at a given moment.
 *
 * These lived in the workout reducer's module, so anything that only needed to
 * know how long a workout ran — the adapter that saves it — loaded the reducer
 * and the whole catalog with it. They read a session and a time and nothing
 * else.
 */

/** Wall time since the start, less every pause — including one still open. */
export function elapsedSecondsOf(session: WorkoutSessionRuntime, nowMs: number): number {
  const open = session.pausedAt ? Math.max(0, nowMs - new Date(session.pausedAt).getTime()) : 0;
  const wall = nowMs - new Date(session.startedAt).getTime();
  return Math.max(0, Math.floor((wall - (session.pausedMs ?? 0) - open) / 1000));
}

export function latestCompletedSetMs(session: WorkoutSessionRuntime): number {
  let latest = -Infinity;
  session.exercises.forEach((exercise) => {
    exercise.sets.forEach((set) => {
      const time = set.status === 'completed' && set.completedAt ? Date.parse(set.completedAt) : Number.NaN;
      if (Number.isFinite(time) && time > latest) {
        latest = time;
      }
    });
  });
  return latest;
}

/**
 * How long the workout ran up to `endMs`, pauses off.
 *
 * When the end is the last logged set rather than the finish (a session left
 * open and reopened days later), only the pauses that had run by that set come
 * off — `pausedMs` by then also holds the days it sat paused, and subtracting
 * all of it saved a 48-minute workout as one minute (PR #120 review).
 */
export function workoutSecondsUntil(session: WorkoutSessionRuntime, endMs: number): number {
  const lastSetMs = latestCompletedSetMs(session);
  if (Number.isFinite(lastSetMs) && endMs <= lastSetMs) {
    const wall = endMs - new Date(session.startedAt).getTime();
    const stamped = session.pausedMsAtLastSet;
    if (typeof stamped === 'number' && Number.isFinite(stamped) && stamped >= 0) {
      return Math.max(0, Math.floor((wall - stamped) / 1000));
    }
    // A session from before the stamp was kept. Its pauses are right unless
    // they swallow the whole window — sets were logged in it, so time was
    // spent unpaused — and then they ran past it, and the wall clock is the
    // better answer.
    const counted = elapsedSecondsOf(session, endMs);
    return counted > 0 ? counted : Math.max(0, Math.floor(wall / 1000));
  }
  return elapsedSecondsOf(session, endMs);
}

/** Whether a rest the clock is counting has run out by `nowMs`. */
export function restTimerHasEnded(timer: WorkoutRestTimerState, nowMs: number): boolean {
  return timer.status === 'running' && typeof timer.endsAtMs === 'number' && nowMs >= timer.endsAtMs;
}

/** Whole seconds left on a running rest, at `nowMs`. */
export function restSecondsLeft(timer: WorkoutRestTimerState, nowMs: number): number {
  if (timer.status !== 'running' || typeof timer.endsAtMs !== 'number') {
    return 0;
  }
  return Math.max(0, Math.ceil((timer.endsAtMs - nowMs) / 1000));
}

/**
 * The last moment the session was in use, as of `nowMs`.
 *
 * `updatedAt` moves with every action. A rest is time in the workout too, and
 * the shared clock used to move `updatedAt` every second while one ran — which
 * re-rendered the whole app once a second to keep a timestamp current. The
 * rest is read here instead: an active session resting counts as in use up to
 * now, or up to the rest's end if that has passed.
 */
export function sessionLastActiveMs(session: WorkoutSessionRuntime, nowMs: number): number {
  const updatedMs = Date.parse(session.updatedAt);
  const base = Number.isFinite(updatedMs) ? updatedMs : -Infinity;
  // Read on the finish path, which must not throw on a session built without a timer.
  const timer: WorkoutRestTimerState | null | undefined = session.restTimer;
  if (session.status !== 'active' || timer?.status !== 'running' || typeof timer.endsAtMs !== 'number') {
    return base;
  }
  return Math.max(base, Math.min(nowMs, timer.endsAtMs));
}
