/**
 * The daily check that the live coach's key still works.
 *
 * vercel.json runs this once a day. It checks that AI_COACH_APP_KEY is set —
 * without it the coach refuses every request the app makes — and asks the
 * coach's own model for one token: the model list it used to read answers a
 * valid key even when every real call is refused, by a spend limit, spent
 * credit or a model that no longer exists (server audit, 2026-09-21). One
 * token of input and output a day costs a few thousandths of a cent. When
 * anything is missing or refused it posts one line to Slack #bugs. The rule
 * for what counts lives in src/lib/coachKeyHealth.ts; see there for why a
 * timeout does not.
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

import { AI_COACH_DEFAULT_MODEL } from '../src/lib/aiCoachModel';
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

/** The coach's model, as api/ai-coach.ts resolves it. */
const COACH_MODEL = process.env.AI_COACH_CLAUDE_MODEL ?? AI_COACH_DEFAULT_MODEL;

/**
 * The smallest call the coach could make: its own model, one word in, one
 * token out, and no thinking to pay for (Haiku takes no thinking setting at
 * all, as in api/ai-coach.ts effortConfig).
 */
function probeBody(model: string): string {
  return JSON.stringify({
    model,
    max_tokens: 1,
    ...(/haiku/.test(model) ? {} : { thinking: { type: 'disabled' } }),
    messages: [{ role: 'user', content: 'ping' }],
  });
}

/** Anthropic's own error type and message, clipped: what a refusal says about the account. */
async function refusalDetail(response: Response): Promise<string | null> {
  const body = (await response.json().catch(() => null)) as { error?: { type?: unknown; message?: unknown } } | null;
  const parts = [body?.error?.type, body?.error?.message].filter((part): part is string => typeof part === 'string' && part.length > 0);
  return parts.length > 0 ? parts.join(': ').slice(0, 200) : null;
}

/** Anthropic's answer to the one-token call, or a null status when none arrived in time. */
async function probeCoachCall(apiKey: string): Promise<{ status: number | null; detail: string | null }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: probeBody(COACH_MODEL),
      signal: controller.signal,
    });
    return { status: response.status, detail: response.ok ? null : await refusalDetail(response) };
  } catch {
    return { status: null, detail: null };
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
  const probe = apiKey ? await probeCoachCall(apiKey) : { status: null, detail: null };
  const status = probe.status;
  const verdict = classifyCoachKeyProbe({
    keyConfigured: Boolean(apiKey),
    // Read as the coach reads it (hasAppKey trims): a value that is only
    // whitespace refuses every build too.
    appKeyConfigured: Boolean(process.env.AI_COACH_APP_KEY?.trim()),
    status,
  });
  const text = coachKeyAlertText(verdict, status, probe.detail);

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
