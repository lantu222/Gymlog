/**
 * TEMPORARY development endpoint: read the coach transcripts back.
 *
 * What is in transcripts/ is decided by the reader, not by a switch: since
 * #92 the coach keeps a copy only for a reader who ticked the line for it
 * (keepTranscript in api/ai-coach.ts). The folder also still holds entries
 * the development log wrote before #92, without asking; those are removed
 * by hand before release. This returns both to scripts/coach-transcripts.cjs
 * on the developer's machine, which has no Blob credentials of its own — the
 * function's OIDC identity reads the store, and the script proves itself
 * with TRANSCRIPT_READ_SECRET in a header.
 *
 * Answers 404 unless AI_COACH_DEBUG_TRANSCRIPTS is on in the code
 * (src/lib/aiCoachDebug.ts) and in the environment, so a forgotten
 * deployment exposes nothing. tests/releaseReadiness.test.cjs says to delete
 * this file before Play; the 404 is the belt to that suspender.
 *
 *   GET /api/transcripts?since=2026-08-23&limit=200   (that day and later)
 *   GET /api/transcripts?since=2026-09                (that month and later)
 *   GET /api/transcripts?path=transcripts/<day>/<name>.json   (one entry)
 *   x-transcript-secret: <TRANSCRIPT_READ_SECRET>
 *
 * The list leaves kept photos out and says how big each one is; one entry
 * asked for by path carries its photo. A photo is up to 2.8 MB of base64, and
 * a list that carried them all went past the platform's 4.5 MB response
 * limit and failed as a whole.
 */
import { timingSafeEqual } from 'node:crypto';
import { get, list } from '@vercel/blob';
import { AI_COACH_DEBUG_TRANSCRIPTS } from '../src/lib/aiCoachDebug';
import { isTranscriptPath, shapeTranscriptEntry, transcriptTimeKey } from '../src/lib/aiCoachLogId';

const SINCE_PATTERN = /^\d{4}-\d{2}(-\d{2})?$/;

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

  const onePath = queryValue(req, 'path');
  if (onePath !== undefined) {
    if (!isTranscriptPath(onePath)) {
      res.status(400).json({ ok: false, error: 'BAD_PATH', expected: 'transcripts/YYYY-MM-DD/<name>.json' });
      return;
    }
    const stored = await get(onePath, { access: 'private', useCache: false });
    if (!stored || stored.statusCode !== 200) {
      res.status(404).json({ ok: false, error: 'NOT_FOUND' });
      return;
    }
    try {
      const text = await new Response(stored.stream).text();
      res.status(200).json({ ok: true, entry: shapeTranscriptEntry(onePath, JSON.parse(text), { withPhoto: true }) });
    } catch {
      res.status(200).json({ ok: true, entry: { pathname: onePath, corrupt: true } });
    }
    return;
  }

  // A malformed date is refused rather than ignored: ignored, `--since
  // 23.8.2026` listed everything under a heading that said it was filtered.
  const since = queryValue(req, 'since');
  if (since !== undefined && !SINCE_PATTERN.test(since)) {
    res.status(400).json({ ok: false, error: 'BAD_SINCE', expected: 'YYYY-MM or YYYY-MM-DD' });
    return;
  }
  const limit = Math.min(500, Math.max(1, Number(queryValue(req, 'limit') ?? 200) || 200));

  // The whole folder is listed and the date is a lower bound on the path.
  // Using `since` as the prefix made "since 23 August" mean "on 23 August"
  // and "since September" mean "in September": every later day was cut off
  // by the listing before the comparison below ever saw it.
  const pathnames: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: 'transcripts/', cursor, limit: 1000 });
    for (const blob of page.blobs) {
      if (!since || blob.pathname >= `transcripts/${since}`) {
        pathnames.push(blob.pathname);
      }
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  // Newest first, then cap — the reader wants the latest conversations. By
  // time, not by name: a labelled name sorts by its random label.
  pathnames.sort((a, b) => {
    const ka = transcriptTimeKey(a);
    const kb = transcriptTimeKey(b);
    return ka < kb ? 1 : ka > kb ? -1 : 0;
  });
  const selected = pathnames.slice(0, limit);

  const entries = await Promise.all(
    selected.map(async (pathname) => {
      const stored = await get(pathname, { access: 'private', useCache: false });
      if (!stored || stored.statusCode !== 200) {
        return null;
      }
      try {
        const text = await new Response(stored.stream).text();
        // The email some old entries hold ends here, and only the fact of it
        // goes on — see shapeTranscriptEntry. Nothing this returns can print
        // an address, whatever reads it.
        return shapeTranscriptEntry(pathname, JSON.parse(text));
      } catch {
        return { pathname, corrupt: true };
      }
    }),
  );

  res.status(200).json({ ok: true, total: pathnames.length, entries: entries.filter(Boolean) });
}
