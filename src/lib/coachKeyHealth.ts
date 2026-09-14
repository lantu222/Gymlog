/**
 * Whether the live coach's key still opens the door.
 *
 * On 2026-09-13 the production key had been rejected by Anthropic ("API key is
 * invalid", 401) for an unknown stretch: every coach answer was quietly the
 * on-device fallback, and nothing said so to anyone who could fix it. Vercel's
 * free tier keeps function logs for about an hour, so the failure left no trail
 * either. A daily probe (api/coach-health.ts) asks and this decides what the
 * answer means.
 *
 * Only a verdict on the KEY raises an alert. A timeout, a 429 or a 5xx is
 * Anthropic or the network having a bad minute, and the next day's run asks
 * again; alerting on those would teach the reader to ignore the channel.
 */

export type CoachKeyState = 'ok' | 'missing' | 'rejected' | 'unreachable';

export interface CoachKeyProbe {
  /** Whether ANTHROPIC_API_KEY is set at all. */
  keyConfigured: boolean;
  /** The HTTP status Anthropic answered with, or null when no answer arrived. */
  status: number | null;
}

export interface CoachKeyVerdict {
  state: CoachKeyState;
  alert: boolean;
}

export function classifyCoachKeyProbe(probe: CoachKeyProbe): CoachKeyVerdict {
  if (!probe.keyConfigured) {
    return { state: 'missing', alert: true };
  }
  if (probe.status !== null && probe.status >= 200 && probe.status < 300) {
    return { state: 'ok', alert: false };
  }
  // 401: the key is unknown, deleted or disabled. 403: it exists but may not
  // be used (a disabled workspace or organisation). Both need a person.
  if (probe.status === 401 || probe.status === 403) {
    return { state: 'rejected', alert: true };
  }
  return { state: 'unreachable', alert: false };
}

/**
 * The Slack note for an alerting verdict, or null when there is nothing to say.
 *
 * In Finnish, because the one reader of #bugs reads it that way. It names the
 * consequence and the fix, never the key itself.
 */
export function coachKeyAlertText(verdict: CoachKeyVerdict, status: number | null): string | null {
  if (!verdict.alert) {
    return null;
  }
  const consequence = 'Kaikki valmentajan vastaukset ovat nyt laitteen varavastauksia.';
  const fix =
    'Korjaus: uusi avain Anthropic Consolessa → Vercel, projekti vinha → Settings → Environment Variables → '
    + 'ANTHROPIC_API_KEY (Production) → Deployments → Redeploy.';
  if (verdict.state === 'missing') {
    return `Valmentajan API-avain puuttuu: ANTHROPIC_API_KEY ei ole asetettu Vercelissä. ${consequence} ${fix}`;
  }
  return `Valmentajan API-avain ei kelpaa: Anthropic vastasi ${status}. ${consequence} ${fix}`;
}
