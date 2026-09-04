/**
 * The cron that keeps the retention promise. The privacy policy says the
 * anonymous usage events are kept for up to ANALYTICS_RETENTION_MONTHS and
 * then deleted; vercel.json runs this once a day, and this deletes them.
 * Daily, not monthly: a monthly run let a batch live up to 25 months against
 * that promise. The rule and the arithmetic live in
 * src/lib/analyticsRetention.ts.
 *
 * Two ways in, and both have to prove themselves:
 *   - Vercel's cron, which sends `Authorization: Bearer <CRON_SECRET>`
 *     (the project environment variable — see docs/usage-events.md)
 *   - a person, via scripts/prune-events.cjs, with the same
 *     x-analytics-secret header the reader endpoint takes
 *
 *   GET /api/prune-events          delete what is past the window
 *   GET /api/prune-events?dry=1    only count it
 *
 * Idempotent by construction — deleting a batch twice is the same as once —
 * which is what Vercel asks of a cron that may be skipped or run twice.
 * Nothing about a batch's contents is ever logged; only counts.
 */
import { timingSafeEqual } from 'node:crypto';
import { del, list } from '@vercel/blob';

import {
  ANALYTICS_RETENTION_MONTHS,
  analyticsRetentionCutoffDay,
  selectExpiredEventBlobs,
} from '../src/lib/analyticsRetention';

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

/** Blob deletes take a list; a hundred at a time keeps one call well under any limit. */
const DELETE_CHUNK = 100;

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

  try {
    const now = new Date();
    const cutoffDay = analyticsRetentionCutoffDay(now);
    const pathnames: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await list({ prefix: 'events/', cursor, limit: 1000 });
      for (const blob of page.blobs) {
        pathnames.push(blob.pathname);
      }
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);

    const expired = selectExpiredEventBlobs(pathnames, now);
    const dry = queryValue(req, 'dry') === '1';
    if (!dry) {
      for (let index = 0; index < expired.length; index += DELETE_CHUNK) {
        await del(expired.slice(index, index + DELETE_CHUNK));
      }
    }

    console.info(
      `prune-events: ${dry ? 'would delete' : 'deleted'} ${expired.length} of ${pathnames.length} batches from before ${cutoffDay}`,
    );
    res.status(200).json({
      ok: true,
      dry,
      retentionMonths: ANALYTICS_RETENTION_MONTHS,
      cutoffDay,
      scanned: pathnames.length,
      expired: expired.length,
      deleted: dry ? 0 : expired.length,
    });
  } catch (error) {
    console.error('prune-events failed', error instanceof Error ? error.message : String(error));
    res.status(500).json({ ok: false, error: 'INTERNAL' });
  }
}
