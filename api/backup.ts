/**
 * Cloud backup endpoint: one JSON blob per Google or Apple account.
 *
 * Identity is a Google ID token, verified against Google's tokeninfo endpoint
 * on every request — or, on iPhone, an Apple session (below) — this function keeps no session state, exactly like the
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
 * - APPLE_BUNDLE_ID        — optional, default app.vinha; an Apple identity
 *   token's audience must match
 * - BACKUP_MAX_BYTES       — optional payload cap, default 4 MB (Vercel refuses
 *   request and response bodies over 4.5 MB whatever this says)
 *
 * Versions (server audit, 2026-09-21). Two phones on one Google account share
 * the one blob, and each used to upload whenever it had not shrunk against its
 * own last count, without looking at what the cloud held: the phone that wrote
 * last won, older data included. Every copy now has a version — the blob's
 * ETag — and a write names the copy it replaces:
 *
 * - GET answers with `version`, the copy it returned.
 * - PUT answers with `version`, the copy it wrote.
 * - PUT with `x-backup-expected-version: <version>` replaces that copy and no
 *   other; with `none` it writes only where there is no copy yet. When the
 *   store holds anything else it answers 412 BACKUP_CHANGED and writes
 *   nothing. The phone then reads the copy and asks the reader restore-or-keep,
 *   the question it already asks when it holds far less than the cloud.
 * - PUT without the header is a build from before versions, and still
 *   overwrites: refusing it would stop every installed phone backing up until
 *   the reader updates, which is a worse loss than the one this closes.
 */
import { createHmac, createPublicKey, timingSafeEqual, verify } from 'node:crypto';
import { BlobNotFoundError, BlobPreconditionFailedError, del, get, head, list, put } from '@vercel/blob';

import { appUpdateRefusalBody, isAppVersionRefused } from '../src/lib/appUpdateGate';
import { isServicePaused, servicePausedBody } from '../src/lib/serverNotice';

type ApiRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  socket?: {
    remoteAddress?: string;
  };
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
  // 4 MB, not the 2 MB it was: a plain-JSON history stopped fitting at about
  // 250 sessions and every backup after that failed. Large backups now arrive
  // gzipped (lib/accountBackup), and this is the headroom under the platform's
  // own 4.5 MB body limit, which the GET response has to fit as well.
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 4 * 1024 * 1024;
})();

// Same per-IP speed bump as the coach endpoint, and with the same honesty
// about what it is: per-instance, reset by a cold start, a brake on one
// hammering client. It sits BEFORE token verification, because the cost it
// bounds is the outbound tokeninfo call an unauthenticated spammer would
// otherwise make this function pay for.
const RATE_LIMIT_WINDOW_MS = Number(process.env.BACKUP_RATE_LIMIT_WINDOW_MS ?? 10 * 60 * 1000);
const RATE_LIMIT_MAX = Number(process.env.BACKUP_RATE_LIMIT_MAX ?? 60);
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function getIpAddress(req: ApiRequest) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0]?.trim() ?? 'unknown';
  }
  return req.socket?.remoteAddress ?? 'unknown';
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const existing = rateLimitStore.get(ip);
  if (!existing || existing.resetAt <= now) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  if (existing.count >= RATE_LIMIT_MAX) {
    return true;
  }
  existing.count += 1;
  return false;
}

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

/**
 * Sign in with Apple. An Apple identity token lives ten minutes and Apple has
 * no silent refresh like Google's, so a background backup an hour later would
 * have nothing to send. The phone trades the identity token once, here, for an
 * Apple session: `vs1.<payload>.<mac>`, signed with a key derived from
 * BACKUP_PATH_SECRET, naming the Apple subject, the time it was issued and an
 * expiry. The phone checks with Apple that the sign-in has not been revoked
 * before it sends one, and deleting the account (DELETE with
 * `x-backup-action: delete-account`) records a revocation that ends every
 * session issued before it. Apple's own token revocation is not called: it
 * needs a client secret signed with the team's key (docs/ios-launch.md).
 *
 * Apple subjects are stored as `apple:<sub>`, so they can never land on a
 * Google account's blob. Google subjects stay bare: prefixing them now would
 * orphan every backup already stored.
 */
const APPLE_ISSUER = 'https://appleid.apple.com';
const APPLE_KEYS_URL = 'https://appleid.apple.com/auth/keys';
const APPLE_SESSION_PREFIX = 'vs1.';
const APPLE_SESSION_DAYS = 180;
/** The request header that asks for an Apple session instead of a backup operation. */
const ACTION_HEADER = 'x-backup-action';
const APPLE_SESSION_ACTION = 'apple-session';
/** Trades a still-valid Apple session for a fresh one, so an active reader is never timed out. */
const APPLE_RENEW_ACTION = 'apple-renew';
/**
 * On a DELETE: the reader is deleting the account, not only the copy. A plain
 * DELETE ("Delete cloud backup") keeps them signed in, so it must not end the
 * session that sent it.
 */
const DELETE_ACCOUNT_ACTION = 'delete-account';

type AppleKey = { kty: string; n: string; e: string; kid?: string; alg?: string };
let appleKeys: { keys: AppleKey[]; fetchedAt: number } | null = null;

async function loadAppleKeys(forceRefresh: boolean): Promise<AppleKey[]> {
  // Apple rotates its keys rarely; an hour per instance spares the call,
  // and an unknown kid refetches once.
  if (!forceRefresh && appleKeys && Date.now() - appleKeys.fetchedAt < 60 * 60 * 1000) {
    return appleKeys.keys;
  }
  const response = await fetch(APPLE_KEYS_URL);
  if (!response.ok) {
    return appleKeys?.keys ?? [];
  }
  const body = (await response.json()) as { keys?: AppleKey[] };
  appleKeys = { keys: Array.isArray(body.keys) ? body.keys : [], fetchedAt: Date.now() };
  return appleKeys.keys;
}

function decodeSegment<T>(segment: string): T | null {
  try {
    return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8')) as T;
  } catch {
    return null;
  }
}

function sameText(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Verifies an Apple identity token (RS256, Apple's published keys) for this app. */
async function verifyAppleIdentityToken(idToken: string, bundleId: string): Promise<{ sub: string } | null> {
  const parts = idToken.split('.');
  if (parts.length !== 3) {
    return null;
  }
  const [headerPart, payloadPart, signaturePart] = parts;
  const header = decodeSegment<{ alg?: string; kid?: string }>(headerPart);
  const payload = decodeSegment<{ iss?: string; aud?: string; sub?: string; exp?: number }>(payloadPart);
  if (!header || !payload || header.alg !== 'RS256' || !header.kid) {
    return null;
  }
  let key = (await loadAppleKeys(false)).find((candidate) => candidate.kid === header.kid);
  if (!key) {
    key = (await loadAppleKeys(true)).find((candidate) => candidate.kid === header.kid);
  }
  if (!key) {
    return null;
  }
  const valid = verify(
    'RSA-SHA256',
    Buffer.from(`${headerPart}.${payloadPart}`),
    createPublicKey({ key, format: 'jwk' }),
    Buffer.from(signaturePart, 'base64url'),
  );
  if (!valid || payload.iss !== APPLE_ISSUER || typeof payload.sub !== 'string' || !payload.sub) {
    return null;
  }
  if (typeof payload.aud !== 'string' || !sameText(payload.aud, bundleId)) {
    console.error('backup apple aud mismatch:', String(payload.aud).slice(0, 32), 'expected:', bundleId);
    return null;
  }
  if (typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now()) {
    return null;
  }
  return { sub: payload.sub };
}

function appleSessionKey(pathSecret: string): Buffer {
  // Derived, not BACKUP_PATH_SECRET itself: a session mac must never double as a blob pathname.
  return createHmac('sha256', pathSecret).update('apple-session-v1').digest();
}

/**
 * A session carries the millisecond it was issued (`iatMs`; `iat` is the same
 * in seconds, for anything that reads the older field). One from before
 * either existed has neither, and is taken to have been issued 180 days
 * before it expires — which is exactly when it was, since every session lasts
 * that long. One with only `iat` counts from the start of that second.
 */
function issueAppleSession(
  sub: string,
  pathSecret: string,
): { sessionToken: string; expiresAt: string } {
  const issuedAtMs = Date.now();
  const expiresAtMs = issuedAtMs + APPLE_SESSION_DAYS * 24 * 60 * 60 * 1000;
  const payload = Buffer.from(
    JSON.stringify({
      sub,
      iat: Math.floor(issuedAtMs / 1000),
      iatMs: issuedAtMs,
      exp: Math.floor(expiresAtMs / 1000),
    }),
  ).toString('base64url');
  const mac = createHmac('sha256', appleSessionKey(pathSecret)).update(payload).digest('base64url');
  return { sessionToken: `${APPLE_SESSION_PREFIX}${payload}.${mac}`, expiresAt: new Date(expiresAtMs).toISOString() };
}

/** The revocation record could not be read or written: neither "revoked" nor "fine". */
class StoreUnavailable extends Error {}

/**
 * Where an Apple account's revocation is recorded: `revoked/<hash>.json`, next
 * to the backups, under a hash of its own so it never names the account and
 * never lands on a backup's pathname.
 */
function revocationPathname(sub: string, secret: string): string {
  return `revoked/${createHmac('sha256', secret).update(`revoked:${sub}`).digest('hex')}.json`;
}

/**
 * A marker stops mattering once every session it could have ended has
 * expired: those were issued before it, and last 180 days. A day of margin.
 */
const REVOCATION_KEPT_MS = (APPLE_SESSION_DAYS + 1) * 24 * 60 * 60 * 1000;

/**
 * When (unix ms) the account's sessions were last ended, or null if never — or
 * if the marker has outlived its use, in which case it is removed on the spot.
 *
 * A marker that cannot be read (corrupt) must never lock the account out for
 * good: it is taken to say "revoked at the time the store wrote it", which
 * ends the sessions that existed then and lets a sign-in made afterwards
 * work. If the store does not say when it was written, it is taken to say
 * nothing — not revoked, logged — because the other reading refuses every
 * session including a fresh sign-in, forever.
 */
async function revokedAtOf(sub: string, secret: string): Promise<number | null> {
  const pathname = revocationPathname(sub, secret);
  let stored;
  try {
    stored = await get(pathname, { access: 'private', useCache: false });
  } catch (error) {
    if (error instanceof BlobNotFoundError) {
      return null;
    }
    throw new StoreUnavailable();
  }
  if (!stored || stored.statusCode !== 200) {
    return null;
  }
  let revokedAtMs: number | null = null;
  try {
    const record = JSON.parse(await new Response(stored.stream).text()) as { revokedAtMs?: unknown };
    if (typeof record.revokedAtMs === 'number' && Number.isFinite(record.revokedAtMs)) {
      revokedAtMs = record.revokedAtMs;
    }
  } catch {
    // Unreadable: falls through to the store's own write time below.
  }
  if (revokedAtMs === null) {
    const writtenAt = new Date(stored.blob?.uploadedAt as unknown as string | number | Date).getTime();
    if (!Number.isFinite(writtenAt)) {
      console.error('backup revocation marker unreadable, and the store gave no write time: not revoked');
      return null;
    }
    console.error('backup revocation marker unreadable: revoked as of its write time');
    revokedAtMs = writtenAt;
  }
  if (revokedAtMs + REVOCATION_KEPT_MS < Date.now()) {
    // Removing it is housekeeping: failing to is not worth failing a request.
    await del(pathname).catch(() => undefined);
    return null;
  }
  return revokedAtMs;
}

/**
 * Housekeeping on the paths that already take the store's time: removes
 * markers older than REVOCATION_KEPT_MS. It runs when an Apple sign-in is
 * exchanged or an account is deleted, so a marker is removed some time after
 * 180 days, not at that day exactly. Never fails a request.
 */
async function purgeOldRevocations(): Promise<void> {
  try {
    const { blobs } = await list({ prefix: 'revoked/', limit: 100 });
    const old = blobs
      .filter((blob) => new Date(blob.uploadedAt).getTime() + REVOCATION_KEPT_MS < Date.now())
      .map((blob) => blob.pathname);
    if (old.length > 0) {
      await del(old);
    }
  } catch {
    // Best effort.
  }
}

async function verifyAppleSession(token: string, pathSecret: string): Promise<VerifiedIdentity | null> {
  const [payload, mac, extra] = token.slice(APPLE_SESSION_PREFIX.length).split('.');
  if (!payload || !mac || extra !== undefined) {
    return null;
  }
  const expected = createHmac('sha256', appleSessionKey(pathSecret)).update(payload).digest('base64url');
  if (!sameText(mac, expected)) {
    return null;
  }
  const claims = decodeSegment<{ sub?: string; iat?: number; iatMs?: number; exp?: number }>(payload);
  if (!claims || typeof claims.sub !== 'string' || !claims.sub || typeof claims.exp !== 'number') {
    return null;
  }
  if (claims.exp * 1000 < Date.now()) {
    return null;
  }
  const sub = `apple:${claims.sub}`;
  // Ended by an account deletion since it was issued? A session is otherwise
  // good for 180 days and renews itself, so without this nothing stops it.
  const issuedAtMs =
    typeof claims.iatMs === 'number'
      ? claims.iatMs
      : typeof claims.iat === 'number'
        ? claims.iat * 1000
        : (claims.exp - APPLE_SESSION_DAYS * 24 * 60 * 60) * 1000;
  const revokedAtMs = await revokedAtOf(sub, pathSecret);
  if (revokedAtMs !== null && issuedAtMs <= revokedAtMs) {
    return null;
  }
  return { sub };
}

/** Deterministic, unguessable pathname for one account's backup. */
function backupPathname(sub: string, secret: string): string {
  return `backups/${createHmac('sha256', secret).update(sub).digest('hex')}.json`;
}

/** The header a versioned write names the copy it replaces with. */
const EXPECTED_VERSION_HEADER = 'x-backup-expected-version';
/** Its value for "there is no copy yet": the first backup of an account. */
const NO_COPY = 'none';

/**
 * The copy a write says it replaces: undefined when it says nothing (a build
 * from before versions), NO_COPY, a version, or null for a value that is not
 * one — an ETag is short and printable, and this one ends up in a header.
 */
function expectedVersion(req: ApiRequest): string | null | undefined {
  const header = req.headers[EXPECTED_VERSION_HEADER];
  const value = (Array.isArray(header) ? header[0] : header)?.trim();
  if (value === undefined || value === '') {
    return undefined;
  }
  return value.length <= 200 && /^[\x21-\x7e]+$/.test(value) ? value : null;
}

/**
 * The version of the stored copy, or null when there is none.
 *
 * Read with `head` because its ETag comes from the same API as the one `put`
 * returns and `ifMatch` compares against; `get`'s comes from the content
 * response's own header, and a format difference between the two would read
 * as a conflict on every write after a restore.
 */
async function storedVersion(pathname: string): Promise<string | null> {
  try {
    const meta = await head(pathname);
    return meta.etag || null;
  } catch (error) {
    if (error instanceof BlobNotFoundError) {
      return null;
    }
    throw error;
  }
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
  // The kill switch (docs/tietoturvaloukkaus.md): first, before anything is
  // read, parsed or written. api/notice stays open to say why. Deleting stays
  // open too: the policy promises the copy goes at once, and during an
  // incident it is the one request a reader most needs to land.
  if (isServicePaused(process.env) && req.method !== 'DELETE') {
    res.status(503).json(servicePausedBody());
    return;
  }
  const clientId = process.env.GOOGLE_WEB_CLIENT_ID;
  const pathSecret = process.env.BACKUP_PATH_SECRET;
  if (!clientId || !pathSecret) {
    res.status(500).json({ ok: false, error: 'MISSING_SERVER_CONFIG' });
    return;
  }

  if (isRateLimited(getIpAddress(req))) {
    res.status(429).json({ ok: false, error: 'RATE_LIMITED' });
    return;
  }

  // Only a write is refused to a build older than APP_MIN_VERSION_<platform>:
  // the shape it writes is what the server may no longer read. Reading your
  // own backup back and deleting it work from any build (lib/appUpdateGate).
  if ((req.method === 'PUT' || req.method === 'POST') && isAppVersionRefused(req.headers, process.env)) {
    res.status(426).json(appUpdateRefusalBody(req.headers, process.env));
    return;
  }

  const token = bearerToken(req);
  if (!token) {
    res.status(401).json({ ok: false, error: 'MISSING_TOKEN' });
    return;
  }

  const actionHeader = req.headers[ACTION_HEADER];
  const action = Array.isArray(actionHeader) ? actionHeader[0] : actionHeader;
  if (action === APPLE_RENEW_ACTION) {
    if (req.method !== 'POST') {
      res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
      return;
    }
    let current: VerifiedIdentity | null = null;
    try {
      current = token.startsWith(APPLE_SESSION_PREFIX) ? await verifyAppleSession(token, pathSecret) : null;
    } catch (error) {
      if (error instanceof StoreUnavailable) {
        console.error('backup revocation record unreadable');
        res.status(502).json({ ok: false, error: 'STORE_UNAVAILABLE' });
        return;
      }
    }
    if (!current) {
      res.status(401).json({ ok: false, error: 'INVALID_TOKEN' });
      return;
    }
    const renewed = issueAppleSession(current.sub.slice('apple:'.length), pathSecret);
    // A second look just before answering. An account deleted while this
    // request was between its first look and here has its marker written by
    // now, and the session being renewed is older than it — the new one is
    // issued after the marker's time and would survive it. What is left is a
    // delete whose marker lands after this look, within milliseconds.
    try {
      current = await verifyAppleSession(token, pathSecret);
    } catch (error) {
      if (error instanceof StoreUnavailable) {
        console.error('backup revocation record unreadable');
        res.status(502).json({ ok: false, error: 'STORE_UNAVAILABLE' });
        return;
      }
      current = null;
    }
    if (!current) {
      res.status(401).json({ ok: false, error: 'INVALID_TOKEN' });
      return;
    }
    res.status(200).json({ ok: true, ...renewed });
    return;
  }
  if (action === APPLE_SESSION_ACTION) {
    if (req.method !== 'POST') {
      res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
      return;
    }
    let apple: { sub: string } | null = null;
    try {
      apple = await verifyAppleIdentityToken(token, (process.env.APPLE_BUNDLE_ID ?? '').trim() || 'app.vinha');
    } catch {
      apple = null;
    }
    if (!apple) {
      console.error('backup INVALID_APPLE_TOKEN');
      res.status(401).json({ ok: false, error: 'INVALID_TOKEN' });
      return;
    }
    await purgeOldRevocations();
    res.status(200).json({ ok: true, ...issueAppleSession(apple.sub, pathSecret) });
    return;
  }

  let identity: VerifiedIdentity | null = null;
  try {
    identity = token.startsWith(APPLE_SESSION_PREFIX)
      ? await verifyAppleSession(token, pathSecret)
      : await verifyGoogleIdToken(token, clientId);
  } catch (error) {
    // A store that cannot answer is not a sign-in that failed: a 401 here
    // signs the phone out, a 502 is tried again.
    if (error instanceof StoreUnavailable) {
      console.error('backup revocation record unreadable');
      res.status(502).json({ ok: false, error: 'STORE_UNAVAILABLE' });
      return;
    }
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
      const expected = expectedVersion(req);
      if (expected === null) {
        res.status(400).json({ ok: false, error: 'BAD_VERSION' });
        return;
      }
      const options = { access: 'private' as const, contentType: 'application/json', addRandomSuffix: false };
      let written;
      try {
        written =
          expected === undefined
            ? await put(pathname, body, { ...options, allowOverwrite: true })
            : expected === NO_COPY
              ? await put(pathname, body, { ...options, allowOverwrite: false })
              : await put(pathname, body, { ...options, allowOverwrite: true, ifMatch: expected });
      } catch (error) {
        // The store names a lost race two ways: a version that no longer
        // matches, and a copy that has gone since it was read. A first write
        // refused because a copy exists comes back as a plain error, so for
        // that one the store is asked whether a copy is there now — anything
        // else is a storage failure, and the outer catch says so.
        const conflict =
          expected === undefined
            ? false
            : error instanceof BlobPreconditionFailedError ||
              (expected === NO_COPY
                ? (await storedVersion(pathname).catch(() => null)) !== null
                : error instanceof BlobNotFoundError);
        if (!conflict) {
          throw error;
        }
        res.status(412).json({ ok: false, error: 'BACKUP_CHANGED' });
        return;
      }
      // Success is reported only after the store accepted the write — the
      // same rule the app applies to saved workouts.
      res.status(200).json({ ok: true, savedAt: new Date().toISOString(), version: written.etag || null });
      return;
    }

    if (req.method === 'GET') {
      let stored;
      let version: string | null;
      try {
        // The version first, then the copy. The other way round, a write
        // landing between the two reads would pair the new version with the
        // old content, and a phone holding that pair could replace a copy it
        // never saw. This way round the worst is an old version with the new
        // content, which the phone's next write names wrongly and is refused.
        version = await storedVersion(pathname);
        stored = await get(pathname, { access: 'private', useCache: false });
      } catch (error) {
        // `get` answers a missing blob with null and throws for everything
        // else — a 403, a 5xx, the network. Those used to become NO_BACKUP,
        // and the app treats NO_BACKUP as "upload this phone's data as the
        // first backup": a new phone signing in during a storage blip wrote
        // its empty database over the reader's whole history.
        console.error('backup GET failed', error);
        res.status(502).json({ ok: false, error: 'STORE_UNAVAILABLE' });
        return;
      }
      if (!stored || stored.statusCode !== 200) {
        res.status(404).json({ ok: false, error: 'NO_BACKUP' });
        return;
      }
      const payload = await new Response(stored.stream).text();
      res.setHeader('content-type', 'application/json');
      res.status(200).end(JSON.stringify({ ok: true, payload: JSON.parse(payload), version }));
      return;
    }

    if (req.method === 'DELETE') {
      try {
        await del(pathname);
      } catch (error) {
        // Already gone is the outcome the caller asked for (the store does
        // not throw for a missing blob, but should it, that is still done).
        // Anything else — auth, a 5xx, the network — used to be swallowed
        // here too, and the app told the reader the copy was gone while it
        // was still on the server.
        if (!(error instanceof BlobNotFoundError)) {
          console.error('backup DELETE failed:', error instanceof Error ? error.message.slice(0, 200) : 'unknown');
          res.status(502).json({ ok: false, error: 'STORE_UNAVAILABLE' });
          return;
        }
      }
      // Deleting the account, not just the copy: the Apple sessions this
      // server has issued for it are refused from now on, this phone's
      // included. (A phone holding one learns of it at its next request, when
      // the 401 INVALID_TOKEN signs it out — useAccountBackup.) Written
      // AFTER the copy is gone, so a failure here leaves the session alive and
      // the reader able to ask again — the other order would lock them out of
      // a copy they were deleting. A Google account has no session of ours to
      // end (Google's token is checked with Google on every request).
      if (action === DELETE_ACCOUNT_ACTION && identity.sub.startsWith('apple:')) {
        try {
          await put(
            revocationPathname(identity.sub, pathSecret),
            JSON.stringify({ revokedAtMs: Date.now() }),
            { access: 'private', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true },
          );
        } catch (error) {
          console.error('backup revocation failed:', error instanceof Error ? error.message.slice(0, 200) : 'unknown');
          res.status(502).json({ ok: false, error: 'STORE_UNAVAILABLE' });
          return;
        }
        await purgeOldRevocations();
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
