/**
 * The daily check that the live coach's key still works.
 *
 * vercel.json runs this once a day. It asks Anthropic for its model list — a
 * call that needs a valid key and spends no tokens — and when the key is
 * missing or refused it posts one line to Slack #bugs. The rule for what counts
 * lives in src/lib/coachKeyHealth.ts; see there for why a timeout does not.
 *
 * Two ways in, the same as api/prune-events.ts:
 *   - Vercel's cron, with `Authorization: Bearer <CRON_SECRET>`
 *   - a person, with the `x-analytics-secret` header
 *
 *   GET /api/coach-health            check, and alert if the key is refused
 *   GET /api/coach-health?notify=0   check only
 *
 * The alert needs SLACK_WEBHOOK_BUGS in the project's Production environment
 * (docs/slack-workflow.md). Without it the check still runs and says so in its
 * response and log. The key itself is never logged, returned or posted.
 */
import { timingSafeEqual } from 'node:crypto';

import { classifyCoachKeyProbe, coachKeyAlertText } from '../src/lib/coachKeyHealth';

interface RequestLike {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[] | undefined>;
}

interface ResponseLike {
  status(code: number): ResponseLike;
  json(body: unknown): void;
  setHeader(name: string, value: string): void;
}

const PROBE_TIMEOUT_MS = 10000;

function headerValue(req: RequestLike, name: string): string | undefined {
  const value = req.headers[name] ?? req.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function queryValue(req: RequestLike, name: string): string | undefined {
  const value = req.query?.[name];
  return Array.isArray(value) ? value[0] : value;
}

function secretMatches(provided: string | undefined, expected: string | undefined): boolean {
  if (!provided || !expected) {
    return false;
  }
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function authorized(req: RequestLike): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && secretMatches(headerValue(req, 'authorization'), `Bearer ${cronSecret}`)) {
    return true;
  }
  return secretMatches(headerValue(req, 'x-analytics-secret'), process.env.ANALYTICS_READ_SECRET);
}

/** Anthropic's answer status for the model list, or null when none arrived in time. */
async function probeStatus(apiKey: string): Promise<number | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const response = await fetch('https://api.anthropic.com/v1/models?limit=1', {
      method: 'GET',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      signal: controller.signal,
    });
    return response.status;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function postToSlack(webhook: string, text: string): Promise<number | null> {
  try {
    const response = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    return response.status;
  } catch {
    return null;
  }
}

export default async function handler(req: RequestLike, res: ResponseLike): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
    return;
  }
  if (!authorized(req)) {
    res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const status = apiKey ? await probeStatus(apiKey) : null;
  const verdict = classifyCoachKeyProbe({ keyConfigured: Boolean(apiKey), status });
  const text = coachKeyAlertText(verdict, status);

  let notified: 'sent' | 'skipped' | 'no-webhook' | 'failed' | null = null;
  if (text) {
    const webhook = process.env.SLACK_WEBHOOK_BUGS;
    if (queryValue(req, 'notify') === '0') {
      notified = 'skipped';
    } else if (!webhook) {
      notified = 'no-webhook';
    } else {
      const slackStatus = await postToSlack(webhook, text);
      notified = slackStatus !== null && slackStatus >= 200 && slackStatus < 300 ? 'sent' : 'failed';
    }
  }

  const summary = { ok: verdict.state === 'ok', state: verdict.state, status, notified };
  if (verdict.state === 'ok') {
    console.log('coach-health', JSON.stringify(summary));
  } else {
    console.error('coach-health', JSON.stringify(summary));
  }
  // Not 2xx while the key is refused, so the run reads as a failure in the
  // function log as well as in Slack.
  res.status(verdict.state === 'ok' || verdict.state === 'unreachable' ? 200 : 503).json(summary);
}
