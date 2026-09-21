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
 *   GET  /api/events?since=2026-08-25&limit=500           (that day and later)
 *   GET  /api/events?since=2026-08-25&cursor=<next>       (the page after)
 *   x-analytics-secret: <ANALYTICS_READ_SECRET>
 *
 * GET answers a page at a time. Each carries `next`, the cursor to pass for
 * the following page, null on the last; the first page also carries `total`,
 * every batch the query matches, so the reader can say when it got less.
 */
import { timingSafeEqual } from 'node:crypto';
import { get, list, put } from '@vercel/blob';

import { validateBatch } from '../src/lib/analytics';
import {
  ANALYTICS_READ_CONCURRENCY,
  ANALYTICS_READ_PAGE_MAX,
  ANALYTICS_SINCE_PATTERN,
  EVENTS_PREFIX,
  inChunks,
  selectEventBatches,
} from '../src/lib/analyticsRead';

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

/** One stored batch, or null when it cannot be read — never a throw. */
async function readBatch(pathname: string): Promise<Record<string, unknown> | null> {
  try {
    const stored = await get(pathname, { access: 'private', useCache: false });
    if (!stored || stored.statusCode !== 200) {
      return null;
    }
    const text = await new Response(stored.stream).text();
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function handleGet(req: RequestLike, res: ResponseLike): Promise<void> {
  if (!secretMatches(headerValue(req, 'x-analytics-secret'), process.env.ANALYTICS_READ_SECRET)) {
    res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
    return;
  }

  // A malformed date is refused rather than ignored, as the transcript
  // reader does: ignored, it read everything under a heading that said it
  // was filtered.
  const since = queryValue(req, 'since');
  if (since !== undefined && !ANALYTICS_SINCE_PATTERN.test(since)) {
    res.status(400).json({ ok: false, error: 'BAD_SINCE', expected: 'YYYY-MM or YYYY-MM-DD' });
    return;
  }
  // The store's own cursor, handed back from `next`; opaque here.
  const cursor = queryValue(req, 'cursor');
  if (cursor !== undefined && (cursor.length === 0 || cursor.length > 2048)) {
    res.status(400).json({ ok: false, error: 'BAD_CURSOR', expected: 'the `next` of the previous page' });
    return;
  }
  const limit = Math.min(
    ANALYTICS_READ_PAGE_MAX,
    Math.max(1, Number(queryValue(req, 'limit') ?? ANALYTICS_READ_PAGE_MAX) || ANALYTICS_READ_PAGE_MAX),
  );

  // The first page counts every matching batch, once per read, so the
  // report can say when what it fetched falls short of it. The whole folder
  // is listed and `since` is a lower bound on the path — see
  // lib/analyticsRead.ts for the day-long "since" this used to be.
  let total: number | undefined;
  if (cursor === undefined) {
    total = 0;
    let countCursor: string | undefined;
    do {
      const listed = await list({ prefix: EVENTS_PREFIX, cursor: countCursor, limit: 1000 });
      total += selectEventBatches(listed.blobs.map((blob) => blob.pathname), since).length;
      countCursor = listed.hasMore ? listed.cursor : undefined;
    } while (countCursor);
  }

  // One page of the store's listing. A page before `since` may hold nothing
  // to return; its `next` still leads on.
  const page = await list({ prefix: EVENTS_PREFIX, cursor, limit });
  const selected = selectEventBatches(page.blobs.map((blob) => blob.pathname), since);

  const batches: Record<string, unknown>[] = [];
  let unreadable = 0;
  for (const chunk of inChunks(selected, ANALYTICS_READ_CONCURRENCY)) {
    for (const batch of await Promise.all(chunk.map(readBatch))) {
      if (batch) {
        batches.push(batch);
      } else {
        unreadable += 1;
      }
    }
  }

  res.status(200).json({
    ok: true,
    ...(total !== undefined ? { total } : {}),
    batches,
    unreadable,
    next: page.hasMore && page.cursor ? page.cursor : null,
  });
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
