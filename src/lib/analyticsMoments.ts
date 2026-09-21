/**
 * When a usage event is true — the decisions behind the call sites, kept
 * where Node can hold them to a clock (analytics audit, 2026-09-21).
 *
 * Each name in lib/analytics.ts stands for a moment: the app was opened, the
 * paywall was on screen, a programme was taken into use. The audit found
 * each of them counted at a moment that looked like it and was not — every
 * return from a permission dialog an open, a Pro member's look at their own
 * membership a paywall view, a refused adoption an adoption. The rules for
 * the real moment live here, and App.tsx asks them.
 */

/**
 * How long the app must have been away for its return to count as an open.
 *
 * `app_open` is the pipe's daily actives and its retention, and it fired on
 * every return to the foreground: the photo picker, a permission dialog, the
 * system settings the app itself sends the reader to — each came back as a
 * fresh open, so one sitting read as five. Thirty minutes is the usual line
 * between one sitting and the next.
 */
export const APP_OPEN_AWAY_MS = 30 * 60 * 1000;

/**
 * Whether a return to the foreground is a new open. A cold start always is;
 * the caller counts that one without asking.
 *
 * `backgroundedAtMs` is when the app last went to the background, or null
 * when it has not since the last return. A clock that reads earlier than the
 * moment the app left says nothing about how long it was gone, so it does
 * not count: an open missed is a smaller error than one sitting counted
 * twice.
 */
export function countsAsAppOpen(backgroundedAtMs: number | null, nowMs: number): boolean {
  if (backgroundedAtMs === null || !Number.isFinite(backgroundedAtMs) || !Number.isFinite(nowMs)) {
    return false;
  }
  return nowMs - backgroundedAtMs >= APP_OPEN_AWAY_MS;
}

/**
 * Whether arriving on the Pro page is a paywall view.
 *
 * Only for a reader Pro is not on: a member opening the page sees "Pro on"
 * and a link to their subscription, not an offer, and counting them made the
 * top of the conversion funnel partly people who had already converted. And
 * only on arrival: `paywallWasOpen` is whether the page was already open — on
 * screen, or waiting under the terms or privacy page opened from it — so
 * coming back from reading the terms is the same visit, and so is the route
 * being rewritten in place.
 */
export function countsAsPaywallView(input: {
  paywallWasOpen: boolean;
  onPaywall: boolean;
  proUnlocked: boolean;
}): boolean {
  return input.onPaywall && !input.paywallWasOpen && !input.proUnlocked;
}

/**
 * Whether a write took a programme into use: the running set after it holds a
 * plan the set before it did not.
 *
 * `plan_adopted` means a programme started running. Making a held programme
 * the lead, switching on one that was already running, a cap that said no —
 * none of these adds anything, and each was counted as an adoption somewhere.
 * Onboarding's writes replace the plan its last run made rather than adding
 * beside it, so the test is "a plan that was not there", not "the set grew".
 */
export function joinedRunningSet(before: readonly string[], after: readonly string[]): boolean {
  const held = new Set(before);
  return after.some((planId) => !held.has(planId));
}
