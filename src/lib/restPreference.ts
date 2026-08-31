/**
 * The stored default rest, made usable.
 *
 * This lives here rather than inline in `normalizeDatabase` because of how its
 * first version failed. The rule was written as a ternary in the preferences
 * literal and guarded by a test that read the FILE:
 *
 *     assert.match(branch, /input\.preferences\.defaultRestSeconds > 0/);
 *
 * That test passes whether or not the rule is right — it pins the shape of the
 * code, not what the code decides — and it duly went green over a hole. The
 * positivity check ran on the raw value while the rounding happened after it,
 * so a stored `0.3` cleared `> 0` and then `Math.round` turned it into exactly
 * the `0` the guard existed to reject. Found by the PR reviewer on #32.
 *
 * A pure function can be required in Node and asked what it returns, so the
 * test below asserts decisions instead of syntax. Round first, then judge.
 */

/** Ten minutes. Longer than any rest between sets, short of a stored absurdity. */
export const MAX_DEFAULT_REST_SECONDS = 600;

/**
 * @param value  whatever the stored preferences held — any type, from an
 *               install several versions old or from a corrupted write.
 * @param fallback the app default, used whenever `value` cannot be a rest.
 */
export function normalizeDefaultRestSeconds(value: unknown, fallback: number): number {
  // `typeof NaN === 'number'`, and NaN survives Math.min, Math.round and the
  // countdown arithmetic to reach the reader as a bar frozen at 0:00 that
  // never ends. Infinity does the same in the other direction.
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  const rounded = Math.round(value);
  if (rounded <= 0) {
    return fallback;
  }

  return Math.min(rounded, MAX_DEFAULT_REST_SECONDS);
}
