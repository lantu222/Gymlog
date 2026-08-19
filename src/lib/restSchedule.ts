/**
 * The schedule maths behind the background timer (design: "GAINER Background
 * Timer", built for Vinha): rest end, overrun, the warning and repeat offsets,
 * and the idle threshold. Pure, so every number the lock screen and the rest
 * bar show can be checked without a clock running.
 *
 * Rule 01 of the design: timestamps, never ticks. A rest stores when it ends,
 * a session stores when it started, and everything here derives from a `nowMs`
 * the caller passes in — so the numbers are right the moment the app is looked
 * at again, however long it was away.
 */

/** The haptic-only warning before a rest ends. No sound — you may still be under the bar. */
export const REST_WARNING_SECONDS = 10;
/** One repeat after the end alert, then silence. The app never nags twice. */
export const REST_REPEAT_AFTER_SECONDS = 30;
/** The idle nudge: nothing logged for this long and the session asks if it is still one. */
export const IDLE_NUDGE_MINUTES = 25;

export type RestPhase = 'running' | 'done';

export interface RestStatus {
  phase: RestPhase;
  /** Seconds left while running; 0 once done. */
  remainingSeconds: number;
  /** Seconds past the end while done; 0 while running. Overrun is data, not an error. */
  overrunSeconds: number;
}

export function describeRest(endsAtMs: number, nowMs: number): RestStatus {
  const delta = Math.round((endsAtMs - nowMs) / 1000);
  if (delta > 0) {
    return { phase: 'running', remainingSeconds: delta, overrunSeconds: 0 };
  }
  // `0 - 0` is -0 and deepEqual notices; normalise.
  return { phase: 'done', remainingSeconds: 0, overrunSeconds: Math.abs(delta) };
}

/** "m:ss" for a countdown or an overrun; hours appear only past sixty minutes. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const mm = hours > 0 ? String(minutes).padStart(2, '0') : String(minutes);
  return `${hours > 0 ? `${hours}:` : ''}${mm}:${String(seconds).padStart(2, '0')}`;
}

/**
 * The wall-clock end, "18:42", so the bar states something checkable against
 * the gym clock. A countdown alone cannot be trusted after any gap.
 */
export function formatEndsAt(endsAtMs: number): string {
  const d = new Date(endsAtMs);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** When the warning and the repeat alert fire for a given rest end. */
export function restAlertTimes(endsAtMs: number): { warningAtMs: number; repeatAtMs: number } {
  return {
    warningAtMs: endsAtMs - REST_WARNING_SECONDS * 1000,
    repeatAtMs: endsAtMs + REST_REPEAT_AFTER_SECONDS * 1000,
  };
}

/** When the idle nudge is due, given the last moment something was logged. */
export function idleNudgeAtMs(lastActivityMs: number, thresholdMinutes = IDLE_NUDGE_MINUTES): number {
  return lastActivityMs + thresholdMinutes * 60_000;
}
