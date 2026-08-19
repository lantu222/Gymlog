/**
 * TEMPORARY walkthrough tracer — remove once the lag is located.
 *
 * Every mark prints the gap since the previous one, so one pass through the app
 * produces a timeline in logcat rather than a single number in isolation. The
 * gaps are the point: a 6s hole between two marks says where the app went away,
 * and a mark that is itself slow says what it was doing.
 */
let last = 0;

export function trace(label: string) {
  const now = Date.now();
  const delta = last === 0 ? 0 : now - last;
  last = now;
  console.log(`[trace] +${String(delta).padStart(5)}ms  ${label}`);
}
