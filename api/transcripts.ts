/**
 * TEMPORARY development endpoint: read the coach transcript log back.
 *
 * The coach endpoint stores question + answer pairs in the private Blob
 * store while AI_COACH_DEBUG_TRANSCRIPTS is on (src/lib/aiCoachDebug.ts).
 * This returns them to scripts/coach-transcripts.cjs on the developer's
 * machine, which has no Blob credentials of its own — the function's OIDC
 * identity reads the store, and the script proves itself with
 * TRANSCRIPT_READ_SECRET in a header.
 *
 * Answers 404 once the switch is off, so a forgotten deployment exposes
 * nothing. tests/releaseReadiness.test.cjs says to delete this file before
 * Play; the 404 is the belt to that suspender.
 *
 *   GET /api/transcripts?since=2026-08-23&limit=200
 *   x-transcript-secret: <TRANSCRIPT_READ_SECRET>
 */
import { timingSafeEqual } from 'node:crypto';
import { get, list } from '@vercel/blob';
import { AI_COACH_DEBUG_TRANSCRIPTS } from '../src/lib/aiCoachDebug';

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

export default async function handler(req: RequestLike, res: ResponseLike): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');
  if (!AI_COACH_DEBUG_TRANSCRIPTS || process.env.AI_COACH_DEBUG_TRANSCRIPTS !== '1') {
    res.status(404).json({ ok: false, error: 'NOT_FOUND' });
    return;
  }
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
    return;
  }
  if (!secretMatches(headerValue(req, 'x-transcript-secret'), process.env.TRANSCRIPT_READ_SECRET)) {
    res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
    return;
  }

  const since = queryValue(req, 'since');
  const limit = Math.min(500, Math.max(1, Number(queryValue(req, 'limit') ?? 200) || 200));
  const prefix = since && /^\d{4}-\d{2}(-\d{2})?$/.test(since) ? `transcripts/${since}` : 'transcripts/';

  const pathnames: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix, cursor, limit: 1000 });
    for (const blob of page.blobs) {
      if (!since || blob.pathname >= `transcripts/${since}`) {
        pathnames.push(blob.pathname);
      }
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  // Newest first, then cap — the reader wants the latest conversations.
  pathnames.sort().reverse();
  const selected = pathnames.slice(0, limit);

  const entries = await Promise.all(
    selected.map(async (pathname) => {
      const stored = await get(pathname, { access: 'private', useCache: false });
      if (!stored || stored.statusCode !== 200) {
        return null;
      }
      try {
        const text = await new Response(stored.stream).text();
        return { pathname, ...(JSON.parse(text) as Record<string, unknown>) };
      } catch {
        return { pathname, corrupt: true };
      }
    }),
  );

  res.status(200).json({ ok: true, total: pathnames.length, entries: entries.filter(Boolean) });
}
