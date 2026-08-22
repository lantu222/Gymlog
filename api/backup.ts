/**
 * Cloud backup endpoint: one JSON blob per Google account.
 *
 * Identity is a Google ID token, verified against Google's tokeninfo endpoint
 * on every request — this function keeps no session state, exactly like the
 * coach endpoint keeps none. The blob pathname is an HMAC of the Google
 * subject with a server secret, so the storage URL is deterministic for the
 * server and unguessable for anyone else. The store is PRIVATE access: no
 * blob URL is publicly fetchable, and nothing here returns one anyway.
 *
 * What this endpoint never does: log payloads, list users, or accept a write
 * without a verified token. The payload cap is a spend and abuse control the
 * same way the coach's request bounds are.
 *
 * Env (see docs/account-backup.md):
 * - GOOGLE_WEB_CLIENT_ID   — the OAuth Web client id; token audience must match
 * - Blob auth: connecting the store adds BLOB_STORE_ID and the SDK uses the
 *   function's OIDC identity — there is no BLOB_READ_WRITE_TOKEN in this flow
 * - BACKUP_PATH_SECRET     — any long random string; changing it orphans stored backups
 * - BACKUP_MAX_BYTES       — optional payload cap, default 2 MB
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { del, get, put } from '@vercel/blob';

type ApiRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type ApiResponse = {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
  end: (body?: string) => void;
};

const MAX_BYTES = (() => {
  const parsed = Number(process.env.BACKUP_MAX_BYTES);
  // A zero, negative or unparseable value falls back rather than opening the
  // tap — same rule as the coach budget.
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 2 * 1024 * 1024;
})();

const TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo';

interface VerifiedIdentity {
  sub: string;
}

/**
 * Verifies the Google ID token and returns the stable subject, or null.
 * Audience must be OUR web client id: any Google-signed token for some other
 * app is somebody else's identity, not a key to a backup here.
 */
async function verifyGoogleIdToken(idToken: string, clientId: string): Promise<VerifiedIdentity | null> {
  const response = await fetch(`${TOKENINFO_URL}?id_token=${encodeURIComponent(idToken)}`);
  if (!response.ok) {
    return null;
  }
  const info = (await response.json()) as { aud?: string; sub?: string; exp?: string };
  if (!info.aud || !info.sub) {
    return null;
  }
  const expected = Buffer.from(clientId);
  const actual = Buffer.from(info.aud);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    // Client ids are public identifiers, so naming the prefixes is safe -
    // it turns "sign-in silently fails" into "the env var has a typo".
    console.error('backup aud mismatch:', info.aud.slice(0, 16), 'expected:', clientId.slice(0, 16));
    return null;
  }
  if (!info.exp || Number(info.exp) * 1000 < Date.now()) {
    return null;
  }
  return { sub: info.sub };
}

/** Deterministic, unguessable pathname for one account's backup. */
function backupPathname(sub: string, secret: string): string {
  return `backups/${createHmac('sha256', secret).update(sub).digest('hex')}.json`;
}

function bearerToken(req: ApiRequest): string | null {
  const header = req.headers.authorization;
  const value = Array.isArray(header) ? header[0] : header;
  if (!value || !value.startsWith('Bearer ')) {
    return null;
  }
  const token = value.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const clientId = process.env.GOOGLE_WEB_CLIENT_ID;
  const pathSecret = process.env.BACKUP_PATH_SECRET;
  if (!clientId || !pathSecret) {
    res.status(500).json({ ok: false, error: 'MISSING_SERVER_CONFIG' });
    return;
  }

  const token = bearerToken(req);
  if (!token) {
    res.status(401).json({ ok: false, error: 'MISSING_TOKEN' });
    return;
  }

  let identity: VerifiedIdentity | null = null;
  try {
    identity = await verifyGoogleIdToken(token, clientId);
  } catch {
    identity = null;
  }
  if (!identity) {
    console.error('backup INVALID_TOKEN');
    res.status(401).json({ ok: false, error: 'INVALID_TOKEN' });
    return;
  }

  const pathname = backupPathname(identity.sub, pathSecret);

  try {
    if (req.method === 'PUT' || req.method === 'POST') {
      const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? null);
      if (!body || body === 'null') {
        res.status(400).json({ ok: false, error: 'EMPTY_PAYLOAD' });
        return;
      }
      if (Buffer.byteLength(body, 'utf8') > MAX_BYTES) {
        res.status(413).json({ ok: false, error: 'PAYLOAD_TOO_LARGE', maxBytes: MAX_BYTES });
        return;
      }
      await put(pathname, body, {
        access: 'private',
        contentType: 'application/json',
        addRandomSuffix: false,
        allowOverwrite: true,
      });
      // Success is reported only after the store accepted the write — the
      // same rule the app applies to saved workouts.
      res.status(200).json({ ok: true, savedAt: new Date().toISOString() });
      return;
    }

    if (req.method === 'GET') {
      let stored;
      try {
        stored = await get(pathname, { access: 'private', useCache: false });
      } catch {
        stored = null;
      }
      if (!stored || stored.statusCode !== 200) {
        res.status(404).json({ ok: false, error: 'NO_BACKUP' });
        return;
      }
      const payload = await new Response(stored.stream).text();
      res.setHeader('content-type', 'application/json');
      res.status(200).end(JSON.stringify({ ok: true, payload: JSON.parse(payload) }));
      return;
    }

    if (req.method === 'DELETE') {
      try {
        await del(pathname);
      } catch {
        // Already gone is the outcome the caller asked for.
      }
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
  } catch (error) {
    // No payloads, no token contents — a storage failure is reported as a
    // plain code plus the store's own message, which names auth and config
    // problems without ever containing user data.
    console.error('backup STORAGE_FAILED:', error instanceof Error ? error.message.slice(0, 200) : 'unknown');
    res.status(502).json({ ok: false, error: 'STORAGE_FAILED' });
  }
}
