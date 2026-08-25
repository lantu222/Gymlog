/**
 * The usage-event sink and its reader.
 *
 * POST: the app sends a batch of allowlisted, anonymous events (see
 * src/lib/analytics.ts — the allowlist there is the whole vocabulary, and
 * this endpoint validates against the same code, so client and server cannot
 * drift). Each accepted batch becomes one private blob under
 * events/YYYY-MM-DD/. Nothing here has a name, an email, or any content the
 * user typed; the privacy policy describes exactly this.
 *
 * GET: returns raw batches to scripts/analytics-report.cjs on the developer's
 * machine, which aggregates locally (funnels, retention). Proven by
 * ANALYTICS_READ_SECRET in a header, same pattern as the transcript reader —
 * but unlike transcripts this endpoint ships: it is the product's own
 * telemetry, not a development tap.
 *
 *   POST /api/events            { installId, sentAt, events: [...] }
 *   GET  /api/events?since=2026-08-25&limit=500
 *   x-analytics-secret: <ANALYTICS_READ_SECRET>
 */
import { timingSafeEqual } from 'node:crypto';
import { get, list, put } from '@vercel/blob';

import { validateBatch } from '../src/lib/analytics';

interface RequestLike {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[] | undefined>;
  body?: unknown;
  socket?: { remoteAddress?: string };
}

interface ResponseLike {
  status(code: number): ResponseLike;
  json(body: unknown): void;
  setHeader(name: string, value: string): void;
}

/**
 * Loose per-IP brake, same spirit as the coach's: a broken client retrying in
 * a loop should not write a blob per second all night.
 */
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 60;
const rateStore = new Map<string, { count: number; resetAt: number }>();

function limited(ip: string): boolean {
  const now = Date.now();
  const entry = rateStore.get(ip);
  if (!entry || entry.resetAt <= now) {
    rateStore.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  if (entry.count >= MAX_PER_WINDOW) {
    return true;
  }
  entry.count += 1;
  return false;
}

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

async function handlePost(req: RequestLike, res: ResponseLike): Promise<void> {
  const ip =
    (typeof req.headers['x-forwarded-for'] === 'string' && req.headers['x-forwarded-for'].split(',')[0]?.trim()) ||
    req.socket?.remoteAddress ||
    'unknown';
  if (limited(ip)) {
    res.status(429).json({ ok: false, error: 'RATE_LIMIT' });
    return;
  }

  const parsed = typeof req.body === 'string' ? safeJson(req.body) : req.body;
  const batch = validateBatch(parsed);
  if (!batch) {
    // Rejected whole rather than filtered: a client sending anything outside
    // the vocabulary is a bug worth surfacing, not trimming.
    res.status(400).json({ ok: false, error: 'BAD_REQUEST' });
    return;
  }

  const at = new Date();
  const day = at.toISOString().slice(0, 10);
  const pathname = `events/${day}/${at.toISOString().replace(/[:.]/g, '-')}-${Math.random().toString(36).slice(2, 8)}.json`;
  await put(pathname, JSON.stringify(batch), {
    access: 'private',
    contentType: 'application/json',
    addRandomSuffix: false,
  });
  res.status(200).json({ ok: true });
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function handleGet(req: RequestLike, res: ResponseLike): Promise<void> {
  if (!secretMatches(headerValue(req, 'x-analytics-secret'), process.env.ANALYTICS_READ_SECRET)) {
    res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
    return;
  }

  const since = queryValue(req, 'since');
  const limit = Math.min(2000, Math.max(1, Number(queryValue(req, 'limit') ?? 1000) || 1000));
  const prefix = since && /^\d{4}-\d{2}(-\d{2})?$/.test(since) ? `events/${since}` : 'events/';

  const pathnames: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix, cursor, limit: 1000 });
    for (const blob of page.blobs) {
      if (!since || blob.pathname >= `events/${since}`) {
        pathnames.push(blob.pathname);
      }
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  pathnames.sort();
  const selected = pathnames.slice(-limit);

  const batches = await Promise.all(
    selected.map(async (pathname) => {
      const stored = await get(pathname, { access: 'private', useCache: false });
      if (!stored || stored.statusCode !== 200) {
        return null;
      }
      try {
        const text = await new Response(stored.stream).text();
        return JSON.parse(text) as Record<string, unknown>;
      } catch {
        return null;
      }
    }),
  );

  res.status(200).json({ ok: true, total: pathnames.length, batches: batches.filter(Boolean) });
}

export default async function handler(req: RequestLike, res: ResponseLike): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'POST') {
      await handlePost(req, res);
      return;
    }
    if (req.method === 'GET') {
      await handleGet(req, res);
      return;
    }
    res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
  } catch (error) {
    console.error('events endpoint failed', error instanceof Error ? error.message : String(error));
    res.status(500).json({ ok: false, error: 'INTERNAL' });
  }
}
