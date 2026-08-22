/**
 * The gate between "a live coach URL is configured" and "a release build may
 * actually call it".
 *
 * The request-size bounds and the per-instance token budget in the endpoint
 * are brakes, not ceilings — the only real spend ceiling is the usage limit
 * set by hand in the Anthropic Console (docs/ai-coach-backend.md, step 1 of
 * the runbook). Nothing in this repo can verify that step happened, so this
 * constant is where a human signs that it did.
 *
 * While it is false, a release build ignores EXPO_PUBLIC_AI_COACH_API_URL and
 * stays in preview mode even when the variable is set — misconfiguring a
 * build cannot open the tap. Dev builds pass the URL through so the live path
 * can be tested before anything ships.
 *
 * Flip to true ONLY after the usage limit is set on the production key.
 * tests/releaseReadiness.test.cjs enforces that this gate stays wired.
 */
export const AI_LIVE_SPEND_CAP_CONFIRMED = false;

/**
 * The URL the client is allowed to use, given the build type. Returns '' —
 * preview mode — when the build is a release and the cap is unconfirmed.
 */
export function resolveLiveAiCoachUrl(rawUrl: string | undefined, isDevBuild: boolean): string {
  const url = (rawUrl ?? '').trim();
  if (!url) {
    return '';
  }
  if (isDevBuild || AI_LIVE_SPEND_CAP_CONFIRMED) {
    return url;
  }
  return '';
}
