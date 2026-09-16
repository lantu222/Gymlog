/**
 * TEMPORARY development switch: the coach's tuning controls.
 *
 * It has been read as "the switch that decides what the server keeps" twice,
 * and it has not been that since #92. What a reader allows is what the server
 * keeps; this flag decides nothing about storage. Two things are left, and
 * both need the AI_COACH_DEBUG_TRANSCRIPTS environment variable on as well:
 *
 *   - `effortOverride` / `modelOverride` on a request, so latency and model
 *     settings can be measured against production without a deploy each.
 *   - `api/transcripts.ts`, which reads the log back and 404s without this.
 *
 * It used to carry a third: the signed-in account's email, attached to every
 * question so the log could say which phone asked. That is gone (2026-09-16).
 * The policy says a coach question cannot be tied to the reader, the label a
 * consenting reader already has says which phone asked without a name, and
 * the server accepted the field whether this flag was on or not — so flipping
 * the flag was never the fix it looked like.
 *
 * tests/releaseReadiness.test.cjs fails while this is true, once the demo flag
 * is cleared: the overrides cannot reach Play by being forgotten. Flip to
 * false (or delete the file) before release, and unset the variable in Vercel.
 */
export const AI_COACH_DEBUG_TRANSCRIPTS = true;
