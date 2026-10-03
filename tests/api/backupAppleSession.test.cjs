const assert = require('node:assert/strict');
const { generateKeyPairSync, sign } = require('node:crypto');

const { callHandler, loadApiModule, withEnv } = require('../helpers/apiModule.cjs');

/**
 * Sign in with Apple on the backup endpoint (2026-10-01).
 *
 * An Apple identity token lives ten minutes and has no silent refresh, so the
 * phone trades it once for the server's Apple session and sends that from then
 * on. Run with Apple's key endpoint, Google's tokeninfo and the blob store
 * replaced by fakes, and a key pair made here standing in for Apple's.
 */

const GOOGLE_CLIENT_ID = 'client.apps.googleusercontent.com';
const BUNDLE_ID = 'app.vinha';
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const JWK = { ...publicKey.export({ format: 'jwk' }), kid: 'apple-key-1', alg: 'RS256', use: 'sig' };

function appleToken(claims = {}, { kid = 'apple-key-1', key = privateKey } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ iss: 'https://appleid.apple.com', aud: BUNDLE_ID, sub: 'apple-user-1', iat: now, exp: now + 600, ...claims }),
  ).toString('base64url');
  const signature = sign('RSA-SHA256', Buffer.from(`${header}.${payload}`), key).toString('base64url');
  return `${header}.${payload}.${signature}`;
}

/** A blob store that remembers which pathname each copy went to. */
function pathBlobStore() {
  class BlobNotFoundError extends Error {}
  class BlobPreconditionFailedError extends Error {}
  const blobs = new Map();
  // When each pathname was last written, by the (movable) clock: the store's own uploadedAt.
  const uploaded = new Map();
  // The marker's etag, which changes with every write: a conditional write names the one it read.
  const versions = new Map();
  const store = {
    blobs,
    BlobNotFoundError,
    BlobPreconditionFailedError,
    // Set to a predicate on the pathname to make that read or write fail.
    failGets: null,
    failPuts: null,
    failList: false,
    // Called after a read has been answered: lets a test make something happen between two reads.
    afterGet: null,
    // The SDK's get() has no "unknown": uploadedAt is the store's Last-Modified, or — when the
    // store sends none — the moment of the read (@vercel/blob: `lastModified ? new Date(lastModified) : new Date()`).
    lastModifiedMissing: false,
    hangList: false,
    listCalls: 0,
    afterList: null,
    // { release: Promise } — the first write to revoked/ waits for it, after saying it got there.
    holdMarkerPut: null,
    // { pathname, reached, release } — the next del of that pathname waits for release, after saying it got there.
    holdDel: null,
    // What a del was asked, in order: { pathname, ifMatch }.
    delCalls: [],
    // Every write that was accepted, in order: { pathname, body }.
    putLog: [],
    // Rewrites the etag get() reports (the content response's header can be written differently from the API's).
    getEtag: (etag) => etag,
    // A predicate on the pathname: the next read of it hands out a body that fails part-way.
    breakBodyOnce: null,
    /** A blob that was written at a given time, without going through the endpoint. */
    seed(pathname, body, uploadedMs) {
      blobs.set(pathname, body);
      uploaded.set(pathname, uploadedMs);
      versions.set(pathname, (versions.get(pathname) ?? 0) + 1);
    },
    async head(pathname) {
      if (!blobs.has(pathname)) {
        throw new BlobNotFoundError();
      }
      return { etag: pathname.startsWith('revoked/') ? `"v${versions.get(pathname) ?? 0}"` : '"etag"' };
    },
    async get(pathname) {
      if (store.failGets?.(pathname)) {
        throw new Error('store unavailable');
      }
      const body = blobs.get(pathname);
      const answer =
        body === undefined
          ? null
          : {
              statusCode: 200,
              stream: new Blob([body]).stream(),
              blob: {
                etag: store.getEtag(`"v${versions.get(pathname) ?? 0}"`),
                uploadedAt: store.lastModifiedMissing ? new Date(Date.now()) : new Date(uploaded.get(pathname) ?? Date.now()),
              },
            };
      if (answer && store.breakBodyOnce?.(pathname)) {
        store.breakBodyOnce = null;
        answer.stream = new ReadableStream({
          pull(controller) {
            controller.error(new TypeError('terminated'));
          },
        });
      }
      store.afterGet?.(pathname);
      return answer;
    },
    async list({ prefix = '', limit = 1000, cursor } = {}) {
      store.listCalls += 1;
      if (store.failList) {
        throw new Error('list unavailable');
      }
      if (store.hangList) {
        return new Promise(() => undefined);
      }
      // A cursor is the last pathname handed out, so deleting while paging does not skip anything.
      const all = [...blobs.keys()].filter((pathname) => pathname.startsWith(prefix) && (!cursor || pathname > cursor)).sort();
      const page = all.slice(0, limit);
      const answer = {
        blobs: page.map((pathname) => ({ pathname, uploadedAt: new Date(uploaded.get(pathname)) })),
        hasMore: all.length > page.length,
        cursor: all.length > page.length ? page[page.length - 1] : undefined,
      };
      store.afterList?.(answer);
      return answer;
    },
    async put(pathname, body, options = {}) {
      if (store.failPuts?.(pathname)) {
        throw new Error('store unavailable');
      }
      if (store.holdMarkerPut && !store.holdMarkerPut.taken && pathname.startsWith('revoked/')) {
        store.holdMarkerPut.taken = true;
        store.holdMarkerPut.reached();
        await store.holdMarkerPut.release;
      }
      if (options.ifMatch && pathname.startsWith('revoked/') && options.ifMatch !== `"v${versions.get(pathname) ?? 0}"`) {
        throw new BlobPreconditionFailedError();
      }
      store.putLog.push({ pathname, body });
      blobs.set(pathname, body);
      uploaded.set(pathname, Date.now());
      versions.set(pathname, (versions.get(pathname) ?? 0) + 1);
      return { etag: '"etag"' };
    },
    async del(pathnames, options = {}) {
      for (const pathname of [].concat(pathnames)) {
        store.delCalls.push({ pathname, ifMatch: options.ifMatch });
        if (store.holdDel && !store.holdDel.taken && store.holdDel.pathname === pathname) {
          store.holdDel.taken = true;
          store.holdDel.reached();
          await store.holdDel.release;
        }
        if (options.ifMatch && options.ifMatch !== `"v${versions.get(pathname) ?? 0}"`) {
          throw new BlobPreconditionFailedError();
        }
        blobs.delete(pathname);
      }
    },
  };
  return store;
}

async function withEndpoint(scenario) {
  const savedFetch = global.fetch;
  const quiet = console.error;
  const fetched = [];
  // The session carries the second it was issued in, and a revocation is dated
  // by the second it was recorded in: the test moves time instead of sleeping.
  const realNow = Date.now;
  let offsetMs = 0;
  Date.now = () => realNow() + offsetMs;
  const clock = { advance: (ms) => (offsetMs += ms) };
  global.fetch = async (url) => {
    fetched.push(String(url));
    if (String(url).startsWith('https://appleid.apple.com/auth/keys')) {
      return { ok: true, json: async () => ({ keys: [JWK] }) };
    }
    // Google's tokeninfo: anything that is not an Apple session lands here.
    return {
      ok: true,
      json: async () => ({ aud: GOOGLE_CLIENT_ID, sub: 'google-sub-1', exp: String(Math.floor(Date.now() / 1000) + 3600) }),
    };
  };
  console.error = () => undefined;
  try {
    await withEnv(
      { GOOGLE_WEB_CLIENT_ID: GOOGLE_CLIENT_ID, BACKUP_PATH_SECRET: 'test-secret', APPLE_BUNDLE_ID: undefined },
      async () => {
        const blob = pathBlobStore();
        const { default: handler } = loadApiModule('api/backup.ts', { '@vercel/blob': blob });
        const call = (method, token, extraHeaders = {}, body) =>
          callHandler(handler, { method, headers: { authorization: `Bearer ${token}`, ...extraHeaders }, body });
        const exchange = (token) => call('POST', token, { 'x-backup-action': 'apple-session' });
        await scenario({ call, exchange, blobs: blob.blobs, store: blob, fetched, clock });
      },
    );
  } finally {
    Date.now = realNow;
    console.error = quiet;
    global.fetch = savedFetch;
  }
}

const copy = (label) => JSON.stringify({ version: 1, exportedAt: label, database: {}, workoutHistory: {} });

module.exports = [
  {
    name: 'apple backup: an Apple identity token buys a session, and the session reads and writes its own copy',
    async run() {
      await withEndpoint(async ({ call, exchange, blobs }) => {
        const traded = await exchange(appleToken());
        assert.equal(traded.status, 200);
        assert.equal(traded.body.ok, true);
        assert.match(traded.body.sessionToken, /^vs1\./);
        const days = (Date.parse(traded.body.expiresAt) - Date.now()) / (24 * 60 * 60 * 1000);
        assert.ok(days > 179 && days <= 180, `a session of ${days} days`);
        // The exchange itself writes nothing.
        assert.equal(blobs.size, 0);

        const session = traded.body.sessionToken;
        const written = await call('PUT', session, { 'x-backup-expected-version': 'none' }, copy('apple-1'));
        assert.equal(written.status, 200);
        const read = await call('GET', session);
        assert.equal(read.status, 200);
        assert.equal(read.body.payload.exportedAt, 'apple-1');

        // A Google account has its own copy: an Apple subject never lands on it.
        await call('PUT', 'google-id-token', { 'x-backup-expected-version': 'none' }, copy('google-1'));
        assert.equal(blobs.size, 2, 'the Apple and Google accounts shared one blob');
        const again = await call('GET', session);
        assert.equal(again.body.payload.exportedAt, 'apple-1');
      });
    },
  },
  {
    name: 'apple backup: a token for another app, from another key, expired or for Google is refused',
    async run() {
      await withEndpoint(async ({ exchange }) => {
        assert.equal((await exchange(appleToken({ aud: 'com.someone.else' }))).status, 401, 'another app’s Apple token');
        assert.equal((await exchange(appleToken({ iss: 'https://evil.example' }))).status, 401, 'another issuer');
        assert.equal((await exchange(appleToken({ exp: Math.floor(Date.now() / 1000) - 5 }))).status, 401, 'expired');
        const stranger = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
        assert.equal((await exchange(appleToken({}, { key: stranger }))).status, 401, 'signed by a key that is not Apple’s');
        assert.equal((await exchange(appleToken({}, { kid: 'unknown' }))).status, 401, 'a key Apple does not publish');
        assert.equal((await exchange('not-a-jwt')).status, 401);
      });
    },
  },
  {
    name: 'apple backup: a session is only good unaltered, unexpired and from this server',
    async run() {
      await withEndpoint(async ({ call, exchange }) => {
        const { sessionToken } = (await exchange(appleToken())).body;
        const [, payload, mac] = sessionToken.split('.');

        // Another subject under the same mac.
        const forged = Buffer.from(JSON.stringify({ sub: 'apple-user-2', exp: Math.floor(Date.now() / 1000) + 3600 })).toString(
          'base64url',
        );
        assert.equal((await call('GET', `vs1.${forged}.${mac}`)).status, 401, 'a session for someone else was accepted');
        assert.equal((await call('GET', `vs1.${payload}.${mac.slice(1)}x`)).status, 401);
        assert.equal((await call('GET', `vs1.${payload}`)).status, 401);

        // Expired, though correctly signed: made with the server's own key derivation.
        const { createHmac } = require('node:crypto');
        const key = createHmac('sha256', 'test-secret').update('apple-session-v1').digest();
        const old = Buffer.from(JSON.stringify({ sub: 'apple-user-1', exp: Math.floor(Date.now() / 1000) - 1 })).toString('base64url');
        const oldMac = createHmac('sha256', key).update(old).digest('base64url');
        assert.equal((await call('GET', `vs1.${old}.${oldMac}`)).status, 401, 'an expired session was accepted');
        // The same, unexpired, is fine: the derivation above is the server's.
        const fresh = Buffer.from(JSON.stringify({ sub: 'apple-user-1', exp: Math.floor(Date.now() / 1000) + 60 })).toString('base64url');
        const freshMac = createHmac('sha256', key).update(fresh).digest('base64url');
        assert.equal((await call('GET', `vs1.${fresh}.${freshMac}`)).status, 404);

        // Renewal: a valid session buys a fresh one for the same account; nothing else does.
        const renewed = await call('POST', sessionToken, { 'x-backup-action': 'apple-renew' });
        assert.equal(renewed.status, 200);
        assert.match(renewed.body.sessionToken, /^vs1\./);
        const renewedClaims = JSON.parse(Buffer.from(renewed.body.sessionToken.split('.')[1], 'base64url').toString('utf8'));
        assert.equal(renewedClaims.sub, 'apple-user-1');
        assert.equal((await call('POST', `vs1.${forged}.${mac}`, { 'x-backup-action': 'apple-renew' })).status, 401);
        assert.equal((await call('POST', `vs1.${old}.${oldMac}`, { 'x-backup-action': 'apple-renew' })).status, 401, 'an expired session renewed');
        assert.equal((await call('POST', appleToken(), { 'x-backup-action': 'apple-renew' })).status, 401, 'an identity token is not a session');
        assert.equal((await call('POST', 'google-id-token', { 'x-backup-action': 'apple-renew' })).status, 401);

        // And the exchange only answers a POST.
        assert.equal((await call('GET', appleToken(), { 'x-backup-action': 'apple-session' })).status, 405);
      });
    },
  },
  {
    name: 'apple backup: a session carries the time it was issued (to the millisecond), and a renewal carries a new one',
    async run() {
      await withEndpoint(async ({ call, exchange }) => {
        const claimsOf = (token) => JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
        const before = Math.floor(Date.now() / 1000);
        const { sessionToken } = (await exchange(appleToken())).body;
        const claims = claimsOf(sessionToken);
        assert.ok(claims.iat >= before && claims.iat <= before + 5, `iat ${claims.iat} is not the issue time`);
        assert.equal(claims.iat, Math.floor(claims.iatMs / 1000), 'iat and iatMs name different moments');
        assert.ok(Math.abs(claims.iatMs - Date.now()) < 5000, 'iatMs is not the issue time in milliseconds');
        assert.equal(claims.exp - claims.iat, 180 * 24 * 60 * 60, 'a session lasts 180 days from its iat');

        const renewed = await call('POST', sessionToken, { 'x-backup-action': 'apple-renew' });
        assert.ok(claimsOf(renewed.body.sessionToken).iat >= claims.iat);
      });
    },
  },
  {
    name: 'apple backup: deleting the account ends every session issued before it, whichever phone holds it',
    async run() {
      await withEndpoint(async ({ call, exchange, blobs, clock }) => {
        const first = (await exchange(appleToken())).body.sessionToken;
        const second = (await exchange(appleToken())).body.sessionToken; // another phone, same Apple ID
        await call('PUT', first, { 'x-backup-expected-version': 'none' }, copy('apple-1'));
        assert.equal((await call('GET', second)).status, 200);

        const deleted = await call('DELETE', first, { 'x-backup-action': 'delete-account' });
        assert.equal(deleted.status, 200);
        assert.equal(deleted.body.ok, true);
        assert.equal([...blobs.keys()].filter((key) => key.startsWith('backups/')).length, 0, 'the backup is still there');
        assert.equal([...blobs.keys()].filter((key) => key.startsWith('revoked/')).length, 1, 'no revocation was recorded');
        assert.ok(![...blobs.keys()].some((key) => key.includes('apple-user-1')), 'the revocation record names the account in the clear');

        // Every request a session can make is refused, the renewal included:
        // "extends any unexpired session for 180 days" is what this closes.
        for (const session of [first, second]) {
          assert.equal((await call('GET', session)).status, 401, 'a revoked session read');
          assert.equal((await call('PUT', session, { 'x-backup-expected-version': 'none' }, copy('late'))).status, 401);
          assert.equal((await call('DELETE', session)).status, 401);
          assert.equal((await call('POST', session, { 'x-backup-action': 'apple-renew' })).status, 401, 'a revoked session renewed');
        }
        assert.equal([...blobs.keys()].filter((key) => key.startsWith('backups/')).length, 0, 'a revoked session wrote');

        // Signing in with Apple again is a new account use, and works — in the
        // same second as the deletion, one millisecond after it.
        clock.advance(1);
        const again = (await exchange(appleToken())).body.sessionToken;
        assert.equal((await call('GET', again)).status, 404, 'a session issued after the deletion was refused');
        assert.equal((await call('PUT', again, { 'x-backup-expected-version': 'none' }, copy('apple-2'))).status, 200);
        const renewed = await call('POST', again, { 'x-backup-action': 'apple-renew' });
        assert.equal(renewed.status, 200);
        assert.equal((await call('GET', renewed.body.sessionToken)).status, 200);
      });
    },
  },
  {
    name: 'apple backup: a session from before sessions carried a time is treated as issued 180 days before it expires',
    async run() {
      await withEndpoint(async ({ call, exchange, clock }) => {
        const { createHmac } = require('node:crypto');
        const key = createHmac('sha256', 'test-secret').update('apple-session-v1').digest();
        const legacy = () => {
          const payload = Buffer.from(
            JSON.stringify({ sub: 'apple-user-1', exp: Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60 }),
          ).toString('base64url');
          return `vs1.${payload}.${createHmac('sha256', key).update(payload).digest('base64url')}`;
        };
        const old = legacy();
        assert.equal((await call('GET', old)).status, 404, 'a session without iat was refused before any deletion');

        const live = (await exchange(appleToken())).body.sessionToken;
        assert.equal((await call('DELETE', live, { 'x-backup-action': 'delete-account' })).status, 200);
        assert.equal((await call('GET', old)).status, 401, 'an old-format session outlived the deletion');
        assert.equal((await call('POST', old, { 'x-backup-action': 'apple-renew' })).status, 401);

        // Made now, a session of the old format claims an issue time before the stamp too.
        clock.advance(1);
        assert.equal((await call('GET', legacy())).status, 401);
      });
    },
  },
  {
    name: 'apple backup: only the account deletion revokes — deleting the copy alone keeps the reader signed in, and no one else is touched',
    async run() {
      await withEndpoint(async ({ call, exchange, blobs }) => {
        const mine = (await exchange(appleToken())).body.sessionToken;
        const other = (await exchange(appleToken({ sub: 'apple-user-2' }))).body.sessionToken;
        await call('PUT', mine, { 'x-backup-expected-version': 'none' }, copy('mine'));

        assert.equal((await call('DELETE', mine)).status, 200);
        assert.equal([...blobs.keys()].filter((key) => key.startsWith('revoked/')).length, 0, 'a plain delete revoked');
        assert.equal((await call('GET', mine)).status, 404, 'the reader was signed out by deleting the copy');

        await call('DELETE', other, { 'x-backup-action': 'delete-account' });
        assert.equal((await call('GET', other)).status, 401);
        assert.equal((await call('GET', mine)).status, 404, 'another Apple ID’s deletion ended this session');

        // A Google account has no server session to end: the copy goes, nothing is recorded.
        await call('PUT', 'google-id-token', { 'x-backup-expected-version': 'none' }, copy('google'));
        assert.equal((await call('DELETE', 'google-id-token', { 'x-backup-action': 'delete-account' })).status, 200);
        assert.equal([...blobs.keys()].filter((key) => key.startsWith('revoked/')).length, 1);
        assert.equal((await call('GET', 'google-id-token')).status, 404);
      });
    },
  },
  {
    name: 'apple backup: the copy goes before the sessions do, and a store that fails is not mistaken for a revoked session',
    async run() {
      await withEndpoint(async ({ call, exchange, blobs, store }) => {
        const session = (await exchange(appleToken())).body.sessionToken;
        await call('PUT', session, { 'x-backup-expected-version': 'none' }, copy('mine'));

        // The record cannot be written: the answer is a failure, never "deleted".
        store.failPuts = (pathname) => pathname.startsWith('revoked/');
        const refused = await call('DELETE', session, { 'x-backup-action': 'delete-account' });
        assert.equal(refused.status, 502);
        assert.equal(refused.body.ok, false);
        // The session still works, so the reader can try again instead of being locked out of their own copy.
        store.failPuts = null;
        assert.equal((await call('GET', session)).status, 404, 'the copy was deleted, and the session survived the failed revocation');
        assert.equal((await call('DELETE', session, { 'x-backup-action': 'delete-account' })).status, 200);

        // A store that cannot be read is a 502 on the next request, not a 401 that signs the phone out.
        const next = (await exchange(appleToken({ sub: 'apple-user-3' }))).body.sessionToken;
        store.failGets = (pathname) => pathname.startsWith('revoked/');
        assert.equal((await call('GET', next)).status, 502);
        assert.equal((await call('POST', next, { 'x-backup-action': 'apple-renew' })).status, 502);
        store.failGets = null;
        assert.equal((await call('GET', next)).status, 404);
        assert.equal(blobs.size, 1, 'only the first account’s revocation record is left');
      });
    },
  },
  {
    name: 'apple backup: a session with only the older second-based iat is read from the start of that second',
    async run() {
      await withEndpoint(async ({ call, exchange, clock }) => {
        const { createHmac } = require('node:crypto');
        const key = createHmac('sha256', 'test-secret').update('apple-session-v1').digest();
        const secondsOnly = (issuedAtMs) => {
          const payload = Buffer.from(
            JSON.stringify({
              sub: 'apple-user-1',
              iat: Math.floor(issuedAtMs / 1000),
              exp: Math.floor(issuedAtMs / 1000) + 180 * 24 * 60 * 60,
            }),
          ).toString('base64url');
          return `vs1.${payload}.${createHmac('sha256', key).update(payload).digest('base64url')}`;
        };
        const before = secondsOnly(Date.now());
        assert.equal((await call('GET', before)).status, 404, 'a session with iat in seconds was refused before any deletion');
        const live = (await exchange(appleToken())).body.sessionToken;
        assert.equal((await call('DELETE', live, { 'x-backup-action': 'delete-account' })).status, 200);
        assert.equal((await call('GET', before)).status, 401, 'a seconds-only session outlived the deletion');
      });
    },
  },
  {
    name: 'apple backup: a marker that cannot be read is resolved once to the store’s time and rewritten, and never locks the account out',
    async run() {
      const markerOf = (blobs) => [...blobs.keys()].find((key) => key.startsWith('revoked/'));
      await withEndpoint(async ({ call, exchange, blobs, clock }) => {
        const old = (await exchange(appleToken())).body.sessionToken;
        assert.equal((await call('DELETE', old, { 'x-backup-action': 'delete-account' })).status, 200);
        blobs.set(markerOf(blobs), '{ this is not json');

        // Taken as revoked at the moment the store wrote it: what existed then is ended…
        const refused = await call('GET', old);
        assert.equal(refused.status, 401, 'a corrupt marker stopped ending the older session');
        // …and the marker is valid again, with that time, so every later read agrees.
        const rewritten = JSON.parse(blobs.get(markerOf(blobs)));
        assert.ok(Number.isFinite(rewritten.revokedAtMs), 'the corrupt marker was left as it was');
        clock.advance(1);
        const fresh = (await exchange(appleToken())).body.sessionToken;
        assert.equal((await call('GET', fresh)).status, 404, 'a corrupt marker refused a fresh sign-in');
        assert.equal((await call('POST', fresh, { 'x-backup-action': 'apple-renew' })).status, 200);
        clock.advance(60 * 1000);
        assert.equal((await call('GET', fresh)).status, 404, 'the answer moved on a later read');
        assert.equal((await call('GET', old)).status, 401);
      });

      // The store sends no Last-Modified, so the SDK's uploadedAt is "now" on EVERY read. Read afresh
      // each time that is a marker revoking everything up to this very moment, for ever.
      await withEndpoint(async ({ call, exchange, blobs, clock, store }) => {
        const old = (await exchange(appleToken())).body.sessionToken;
        assert.equal((await call('DELETE', old, { 'x-backup-action': 'delete-account' })).status, 200);
        blobs.set(markerOf(blobs), 'garbage');
        store.lastModifiedMissing = true;

        assert.equal((await call('GET', old)).status, 401);
        clock.advance(1);
        const fresh = (await exchange(appleToken())).body.sessionToken;
        for (let read = 0; read < 3; read += 1) {
          assert.equal((await call('GET', fresh)).status, 404, `read ${read}: a sign-in made after the marker was refused`);
          clock.advance(1000);
        }
      });

      // A rewrite the store refuses is a 502 to try again, not a 401 that signs the phone out.
      await withEndpoint(async ({ call, exchange, blobs, store }) => {
        const old = (await exchange(appleToken())).body.sessionToken;
        await call('DELETE', old, { 'x-backup-action': 'delete-account' });
        blobs.set(markerOf(blobs), 'garbage');
        store.failPuts = (pathname) => pathname.startsWith('revoked/');
        assert.equal((await call('GET', old)).status, 502);
      });
    },
  },
  {
    name: 'apple backup: the phone is told "session revoked" or "session expired" — and a session that does not verify stays INVALID_TOKEN',
    async run() {
      await withEndpoint(async ({ call, exchange, clock }) => {
        const { createHmac } = require('node:crypto');
        const session = (await exchange(appleToken())).body.sessionToken;
        const forge = (secret, claims) => {
          const key = createHmac('sha256', secret).update('apple-session-v1').digest();
          const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
          return `vs1.${payload}.${createHmac('sha256', key).update(payload).digest('base64url')}`;
        };

        // Not a session this server made — or one made under a secret it no longer has —
        // is nobody's session ending, so nobody is signed out by it.
        for (const [label, token] of [
          ['another secret', forge('another-secret', { sub: 'apple-user-1', iatMs: Date.now(), exp: Math.floor(Date.now() / 1000) + 3600 })],
          ['a bad mac', session.slice(0, -2) + 'xx'],
          ['malformed', 'vs1.nonsense'],
        ]) {
          for (const request of [() => call('GET', token), () => call('POST', token, { 'x-backup-action': 'apple-renew' })]) {
            const answer = await request();
            assert.equal(answer.status, 401, label);
            assert.equal(answer.body.error, 'INVALID_TOKEN', `${label} was answered as a session that ended`);
          }
        }

        // Expired: the server's own session, over.
        const expired = forge('test-secret', { sub: 'apple-user-1', iatMs: Date.now() - 200 * 86400000, exp: Math.floor(Date.now() / 1000) - 5 });
        const lapsed = await call('GET', expired);
        assert.equal(lapsed.status, 401);
        assert.equal(lapsed.body.error, 'SESSION_EXPIRED');
        assert.equal((await call('POST', expired, { 'x-backup-action': 'apple-renew' })).body.error, 'SESSION_EXPIRED');

        // Revoked: the account was deleted.
        assert.equal((await call('DELETE', session, { 'x-backup-action': 'delete-account' })).status, 200);
        for (const request of [
          () => call('GET', session),
          () => call('PUT', session, { 'x-backup-expected-version': 'none' }, copy('x')),
          () => call('DELETE', session),
          () => call('POST', session, { 'x-backup-action': 'apple-renew' }),
        ]) {
          const answer = await request();
          assert.equal(answer.status, 401);
          assert.equal(answer.body.error, 'SESSION_REVOKED');
        }
        // A Google token the server turns away is what it always was.
        const google = await call('GET', 'google-id-token');
        assert.equal(google.status, 404);
      });
    },
  },
  {
    name: 'apple backup: markers are swept on sign-in exchanges — bounded, re-checked, never on a deletion and never holding the request',
    async run() {
      const DAY = 24 * 60 * 60 * 1000;
      const markers = (blobs) => [...blobs.keys()].filter((key) => key.startsWith('revoked/')).length;
      await withEndpoint(async ({ call, exchange, blobs, clock, store }) => {
        const session = (await exchange(appleToken())).body.sessionToken;
        assert.equal((await call('DELETE', session, { 'x-backup-action': 'delete-account' })).status, 200);
        assert.equal(markers(blobs), 1);

        // Not yet: a session issued before it could still be valid.
        clock.advance(179 * DAY);
        await exchange(appleToken({ sub: 'someone-else' }));
        assert.equal(markers(blobs), 1, 'the marker went while a session it ends could still be valid');

        // Past 180 days every session it ended has expired. A DELETION does not sweep — its answer is
        // what the phone is waiting for under a timeout — so the marker is still there after one.
        clock.advance(2 * DAY);
        const other = (await exchange(appleToken({ sub: 'apple-user-9' }))).body.sessionToken;
        // (that exchange already swept the first marker: a stale one is put there for the next two steps)
        store.seed('revoked/c0ffee.json', JSON.stringify({ revokedAtMs: Date.now() - 200 * DAY }), Date.now() - 200 * DAY);
        const callsBefore = store.listCalls;
        assert.equal((await call('DELETE', other, { 'x-backup-action': 'delete-account' })).status, 200);
        assert.equal(store.listCalls, callsBefore, 'an account deletion listed the store before answering');
        assert.ok(blobs.has('revoked/c0ffee.json'), 'an account deletion swept');

        // A sign-in does.
        await exchange(appleToken({ sub: 'someone-else' }));
        assert.ok(!blobs.has('revoked/c0ffee.json'), 'the stale marker outlived a sign-in');
      });

      // Paged by cursor and bounded: each run is five list calls at most. And at scale it still gets
      // everywhere: 600 FRESH markers sort before 600 stale ones, so the stale ones are past the first
      // 500 of the listing and a run that always started at the beginning would never reach them.
      await withEndpoint(async ({ exchange, blobs, store }) => {
        const { createHash } = require('node:crypto');
        const stale = [];
        for (let index = 0; index < 1200; index += 1) {
          const name = createHash('sha256').update(String(index)).digest('hex');
          const old = name[0] >= '8';
          const pathname = `revoked/${name}.json`;
          if (old) {
            stale.push(pathname);
          }
          store.seed(pathname, JSON.stringify({ revokedAtMs: old ? 1 : Date.now() }), old ? Date.now() - 300 * DAY : Date.now());
        }
        let runs = 0;
        while (stale.some((pathname) => blobs.has(pathname)) && runs < 80) {
          const before = store.listCalls;
          await exchange(appleToken());
          runs += 1;
          assert.ok(store.listCalls - before <= 5, `run ${runs}: the sweep listed ${store.listCalls - before} times`);
        }
        assert.equal(stale.filter((pathname) => blobs.has(pathname)).length, 0, `stale markers were never reached in ${runs} runs`);
        assert.equal(markers(blobs), 1200 - stale.length, 'a fresh marker was swept');
        assert.ok(runs > 1, 'one bounded run removed them all');
      });

      // Read again before removing: a marker written to the same path since the listing is fresh.
      await withEndpoint(async ({ exchange, blobs, store }) => {
        store.seed('revoked/a.json', JSON.stringify({ revokedAtMs: 1 }), Date.now() - 300 * DAY);
        store.seed('revoked/b.json', JSON.stringify({ revokedAtMs: 1 }), Date.now() - 300 * DAY);
        store.afterList = () => {
          // a new deletion of the account behind revoked/a.json, after it was listed as stale
          store.seed('revoked/a.json', JSON.stringify({ revokedAtMs: Date.now() }), Date.now());
        };
        await exchange(appleToken());
        assert.ok(blobs.has('revoked/a.json'), 'a marker rewritten after the listing was removed as stale');
        assert.ok(!blobs.has('revoked/b.json'));
      });

      // A sweep that fails, or never answers, does not fail or hold the sign-in.
      await withEndpoint(async ({ exchange, store }) => {
        store.failList = true;
        assert.equal((await exchange(appleToken())).status, 200);
        store.failList = false;
        store.hangList = true;
        const started = Date.now();
        let timer;
        const traded = await Promise.race([
          exchange(appleToken()),
          new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error('a sweep that never answers held the sign-in')), 5000);
          }),
        ]).finally(() => clearTimeout(timer));
        assert.equal(traded.status, 200);
        assert.ok(Date.now() - started < 5000, 'a sweep that never answers held the sign-in');
      });

      // With the sweep never having run, a request from the account itself removes its own stale marker.
      await withEndpoint(async ({ call, exchange, blobs, clock, store }) => {
        const session = (await exchange(appleToken())).body.sessionToken;
        await call('DELETE', session, { 'x-backup-action': 'delete-account' });
        store.failList = true;
        clock.advance(182 * DAY);
        const fresh = (await exchange(appleToken())).body.sessionToken;
        assert.equal((await call('GET', fresh)).status, 404);
        assert.equal(markers(blobs), 0, 'the account’s own requests did not remove its old marker');
      });
    },
  },
  {
    name: 'apple backup: a renewal that raced an account deletion is refused, not given a session issued after the marker',
    async run() {
      await withEndpoint(async ({ call, exchange, blobs, clock, store }) => {
        const session = (await exchange(appleToken())).body.sessionToken;
        // The first look finds no marker; before the renewal answers, the
        // deletion lands — its marker is dated before the new session.
        let reads = 0;
        store.afterGet = (pathname) => {
          if (!pathname.startsWith('revoked/')) {
            return;
          }
          reads += 1;
          if (reads === 1) {
            blobs.set(pathname, JSON.stringify({ revokedAtMs: Date.now() }));
            clock.advance(1);
          }
        };
        const raced = await call('POST', session, { 'x-backup-action': 'apple-renew' });
        assert.equal(raced.status, 401, 'a session was renewed after the account was deleted');
        assert.equal(raced.body.sessionToken, undefined);
        assert.ok(reads >= 2, 'the renewal looked once');
      });
    },
  },
  {
    name: 'apple backup: a renewal minted while the marker is still being written is refused by the marker’s second stamp',
    async run() {
      await withEndpoint(async ({ call, exchange, clock, store }) => {
        const session = (await exchange(appleToken())).body.sessionToken;
        let reached;
        const gotThere = new Promise((resolve) => {
          reached = resolve;
        });
        let release;
        store.holdMarkerPut = { taken: false, reached, release: new Promise((resolve) => (release = resolve)) };

        // The deletion has deleted the copy and stamped the marker, and the store has not taken it yet.
        const deleting = call('DELETE', session, { 'x-backup-action': 'delete-account' });
        await gotThere;
        clock.advance(1);
        // A renewal now looks twice, finds no marker either time, and mints a session issued after the stamp.
        const renewed = await call('POST', session, { 'x-backup-action': 'apple-renew' });
        assert.equal(renewed.status, 200, 'the race this test stands in for did not happen');

        release();
        assert.equal((await deleting).status, 200);
        // The marker is written again with the time the first write returned: the new session is older than it.
        assert.equal((await call('GET', renewed.body.sessionToken)).status, 401, 'a session minted during the marker write outlived the deletion');
        assert.equal((await call('GET', session)).status, 401);
      });
    },
  },
  {
    name: 'apple backup: a corrupt marker is rewritten conditionally, so a deletion that stamps meanwhile is never overwritten with an older time',
    async run() {
      await withEndpoint(async ({ call, exchange, blobs, clock, store }) => {
        const old = (await exchange(appleToken())).body.sessionToken;
        assert.equal((await call('DELETE', old, { 'x-backup-action': 'delete-account' })).status, 200);
        const path = [...blobs.keys()].find((key) => key.startsWith('revoked/'));
        store.seed(path, 'garbage', Date.now() - 1000);

        // Between the read of the corrupt copy and the rewrite, a deletion stamps the marker with a LATER time.
        const later = Date.now() + 60 * 1000;
        let reads = 0;
        store.afterGet = (pathname) => {
          if (pathname === path && (reads += 1) === 1) {
            store.seed(path, JSON.stringify({ revokedAtMs: later }), Date.now());
          }
        };
        assert.equal((await call('GET', old)).status, 401);
        assert.equal(JSON.parse(blobs.get(path)).revokedAtMs, later, 'the rewrite moved a valid marker backwards');
        // A session issued before that later stamp is ended by it, as the deletion meant.
        clock.advance(1);
        const between = await exchange(appleToken());
        assert.equal(between.status, 401, 'a sign-in before that later stamp bought a session');
        assert.equal(between.body.error, 'SESSION_REVOKED');
      });
    },
  },
  {
    name: 'apple backup: only the SECOND marker stamp failing is a 502 that leaves the account ended — and a retry meets SESSION_REVOKED',
    async run() {
      await withEndpoint(async ({ call, exchange, blobs, store }) => {
        const session = (await exchange(appleToken())).body.sessionToken;
        await call('PUT', session, { 'x-backup-expected-version': 'none' }, copy('mine'));
        let stamps = 0;
        store.failPuts = (pathname) => pathname.startsWith('revoked/') && (stamps += 1) === 2;
        const answer = await call('DELETE', session, { 'x-backup-action': 'delete-account' });
        assert.equal(answer.status, 502, 'the deletion said it was done with one of its two stamps missing');
        assert.equal(answer.body.ok, false);
        assert.equal([...blobs.keys()].filter((key) => key.startsWith('backups/')).length, 0, 'the copy is gone');
        // The first stamp landed, so the session is over: the phone's retry is told so, and its own
        // pending record (useAccountBackup) is what lets that read as "deleted".
        const retry = await call('DELETE', session, { 'x-backup-action': 'delete-account' });
        assert.equal(retry.status, 401);
        assert.equal(retry.body.error, 'SESSION_REVOKED');
      });
    },
  },
  {
    name: 'apple backup: a marker body that fails part-way is a 502 and is left as it was — never rewritten with the store’s time',
    async run() {
      const markerOf = (blobs) => [...blobs.keys()].find((key) => key.startsWith('revoked/'));
      await withEndpoint(async ({ call, exchange, blobs, clock, store }) => {
        const old = (await exchange(appleToken())).body.sessionToken;
        assert.equal((await call('DELETE', old, { 'x-backup-action': 'delete-account' })).status, 200);
        const path = markerOf(blobs);
        const before = blobs.get(path);
        clock.advance(60 * 1000);
        const fresh = (await exchange(appleToken())).body.sessionToken;

        // The store sends no Last-Modified, so a rewrite would date the marker "now" and refuse `fresh`.
        store.lastModifiedMissing = true;
        const puts = store.putLog.length;
        for (const request of [
          () => call('GET', fresh),
          () => call('POST', fresh, { 'x-backup-action': 'apple-renew' }),
          () => exchange(appleToken()),
        ]) {
          store.breakBodyOnce = (pathname) => pathname === path;
          const answer = await request();
          assert.equal(answer.status, 502, 'a stream error on a valid marker was not a store failure');
          assert.equal(answer.body.error, 'STORE_UNAVAILABLE');
          assert.equal(store.putLog.length, puts, 'a marker that could not be read was rewritten');
          assert.equal(blobs.get(path), before);
        }
        // The next read is the marker as it always was.
        clock.advance(1000);
        assert.equal((await call('GET', fresh)).status, 404);
        assert.equal((await call('GET', old)).status, 401);
      });
    },
  },
  {
    name: 'apple backup: a stale marker is removed only if it is still the copy that was read — a Delete account stamped meanwhile survives',
    async run() {
      const { createHmac } = require('node:crypto');
      const DAY = 24 * 60 * 60 * 1000;
      const pathOf = (sub) => `revoked/${createHmac('sha256', 'test-secret').update(`revoked:apple:${sub}`).digest('hex')}.json`;
      const held = (store, pathname) => {
        let reached;
        const gotThere = new Promise((resolve) => (reached = resolve));
        let release;
        store.holdDel = { pathname, taken: false, reached, release: new Promise((resolve) => (release = resolve)) };
        return { gotThere, release };
      };

      // A request from the account itself: its del of the stale marker is in flight when Delete account lands.
      await withEndpoint(async ({ call, exchange, blobs, clock, store }) => {
        const phoneA = (await exchange(appleToken())).body.sessionToken;
        clock.advance(5);
        const phoneB = (await exchange(appleToken())).body.sessionToken;
        const path = pathOf('apple-user-1');
        store.seed(path, JSON.stringify({ revokedAtMs: Date.now() - 200 * DAY }), Date.now() - 200 * DAY);
        const hold = held(store, path);
        const bGet = call('GET', phoneB);
        await hold.gotThere;
        clock.advance(5);
        assert.equal((await call('DELETE', phoneA, { 'x-backup-action': 'delete-account' })).status, 200);
        hold.release();
        assert.equal((await bGet).status, 404, 'a phone whose request began before the deletion was answered');
        assert.ok(blobs.has(path), 'a stale-marker removal erased the revocation written meanwhile');
        assert.ok(JSON.parse(blobs.get(path)).revokedAtMs > Date.now() - DAY);
        clock.advance(1000);
        for (const answer of [
          await call('GET', phoneB),
          await call('PUT', phoneB, { 'x-backup-expected-version': 'none' }, copy('resurrected')),
          await call('POST', phoneB, { 'x-backup-action': 'apple-renew' }),
        ]) {
          assert.equal(answer.status, 401);
          assert.equal(answer.body.error, 'SESSION_REVOKED');
        }
        const markerDels = store.delCalls.filter((entry) => entry.pathname.startsWith('revoked/'));
        assert.ok(markerDels.length > 0 && markerDels.every((entry) => entry.ifMatch), 'a marker was deleted unconditionally');
      });

      // The sweep: the same, from another account's sign-in.
      await withEndpoint(async ({ call, exchange, blobs, clock, store }) => {
        const phoneA = (await exchange(appleToken())).body.sessionToken;
        clock.advance(5);
        const path = pathOf('apple-user-1');
        store.seed(path, JSON.stringify({ revokedAtMs: Date.now() - 200 * DAY }), Date.now() - 200 * DAY);
        const hold = held(store, path);
        const sweeping = exchange(appleToken({ sub: 'someone-else' }));
        await hold.gotThere;
        clock.advance(5);
        assert.equal((await call('DELETE', phoneA, { 'x-backup-action': 'delete-account' })).status, 200);
        hold.release();
        assert.equal((await sweeping).status, 200);
        assert.ok(blobs.has(path), 'the sweep erased the revocation written after it re-read the marker');
        clock.advance(1000);
        assert.equal((await call('GET', phoneA)).body.error, 'SESSION_REVOKED');
      });

      // A stale marker nobody touches is still removed — conditionally on the copy read, however the store writes its ETags.
      for (const [label, getEtag, removed] of [
        ['the same form', (etag) => etag, true],
        ['a weak, unquoted form of the same value', (etag) => `W/${etag.replace(/"/g, '')}`, true],
        ['a form that cannot be matched', () => 'some-other-scheme', false],
      ]) {
        await withEndpoint(async ({ call, exchange, blobs, clock, store }) => {
          const logged = []; // withEndpoint puts the real console.error back afterwards
          console.error = (...args) => logged.push(args.join(' '));
          const session = (await exchange(appleToken())).body.sessionToken;
          clock.advance(5);
          const path = pathOf('apple-user-1');
          store.seed(path, JSON.stringify({ revokedAtMs: Date.now() - 200 * DAY }), Date.now() - 200 * DAY);
          store.getEtag = getEtag;
          assert.equal((await call('GET', session)).status, 404, `${label}: the request failed`);
          assert.equal(blobs.has(path), !removed, `${label}: ${removed ? 'a stale marker stayed' : 'a marker was removed without a matching ETag'}`);
          const dels = store.delCalls.filter((entry) => entry.pathname === path);
          assert.equal(dels.length, removed ? 1 : 0, label);
          assert.ok(dels.every((entry) => entry.ifMatch), `${label}: unconditional del`);
          // Forms that cannot be matched leave a trace — shapes only, no value.
          const traces = logged.filter((line) => line.includes('stale marker etag forms differ'));
          assert.equal(traces.length, removed ? 0 : 1, `${label}: the log line`);
          if (!removed) {
            assert.match(traces[0], /get=strong-bare-len\d+ head=strong-quoted-len\d+$/);
            assert.ok(!traces[0].includes('some-other-scheme'), 'the log line carries an ETag value');
          }
        });
      }
    },
  },
  {
    name: 'apple backup: an identity token issued before Delete account cannot buy a session after it — a new sign-in still can',
    async run() {
      await withEndpoint(async ({ call, exchange, clock, store }) => {
        const early = appleToken(); // issued now, and good for ten minutes
        const session = (await exchange(appleToken())).body.sessionToken;
        assert.equal((await exchange(early)).status, 200, 'the token is good before the deletion (and more than once)');
        clock.advance(2000);
        assert.equal((await call('DELETE', session, { 'x-backup-action': 'delete-account' })).status, 200);

        const replay = await exchange(early);
        assert.equal(replay.status, 401, 'a pre-deletion identity token bought a fresh session');
        assert.equal(replay.body.error, 'SESSION_REVOKED');
        assert.equal(replay.body.sessionToken, undefined);
        // Another Apple ID's token is nobody's business of this marker.
        assert.equal((await exchange(appleToken({ sub: 'apple-user-2', iat: Math.floor(Date.now() / 1000) - 600 }))).status, 200);

        // A token Apple issues after the deletion is a new sign-in: this second, and the next.
        const same = await exchange(appleToken());
        assert.equal(same.status, 200);
        assert.equal((await call('PUT', same.body.sessionToken, { 'x-backup-expected-version': 'none' }, copy('again'))).status, 200);
        clock.advance(1500);
        assert.equal((await exchange(appleToken())).status, 200);

        // A token that names no issue time cannot be shown to be newer than the deletion.
        const [header, payload] = appleToken().split('.');
        const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
        delete claims.iat;
        const bare = `${header}.${Buffer.from(JSON.stringify(claims)).toString('base64url')}`;
        const resigned = `${bare}.${sign('RSA-SHA256', Buffer.from(bare), privateKey).toString('base64url')}`;
        assert.equal((await exchange(resigned)).status, 401);

        // A store that cannot be read is a 502 to try again, not a 401 that signs the phone out.
        store.failGets = (pathname) => pathname.startsWith('revoked/');
        assert.equal((await exchange(appleToken())).status, 502);
      });
    },
  },
  {
    name: 'apple backup: x-delete-request-id is kept in both marker stamps and handed back, with the error and nothing else, to a session the marker refuses',
    async run() {
      const id = '0123456789abcdef0123456789abcdef';
      const markerOf = (blobs) => [...blobs.keys()].find((key) => key.startsWith('revoked/'));
      const deleteWith = (call, session, requestId) =>
        call('DELETE', session, { 'x-backup-action': 'delete-account', ...(requestId === undefined ? {} : { 'x-delete-request-id': requestId }) });

      await withEndpoint(async ({ call, exchange, blobs, store }) => {
        const phoneA = (await exchange(appleToken())).body.sessionToken;
        const phoneB = (await exchange(appleToken())).body.sessionToken;
        assert.equal((await deleteWith(call, phoneA, id)).status, 200);
        const stamps = store.putLog.filter((entry) => entry.pathname.startsWith('revoked/'));
        assert.equal(stamps.length, 2);
        for (const stamp of stamps) {
          assert.equal(JSON.parse(stamp.body).deleteRequestId, id, 'a stamp lost the request id');
        }

        // Every refusal by that marker names it — the phone that sent it, and another phone of the account.
        for (const session of [phoneA, phoneB]) {
          for (const answer of [
            await call('GET', session),
            await call('PUT', session, { 'x-backup-expected-version': 'none' }, copy('x')),
            await call('DELETE', session),
            await call('POST', session, { 'x-backup-action': 'apple-renew' }),
          ]) {
            assert.equal(answer.status, 401);
            assert.deepEqual(answer.body, { ok: false, error: 'SESSION_REVOKED', deleteRequestId: id });
          }
        }
        // …and so does an identity token from before it.
        const early = await exchange(appleToken({ iat: Math.floor(Date.now() / 1000) - 600 }));
        assert.deepEqual(early.body, { ok: false, error: 'SESSION_REVOKED', deleteRequestId: id });
        // Not an INVALID_TOKEN, and not a Google token's refusal.
        assert.equal((await call('GET', 'vs1.nonsense')).body.deleteRequestId, undefined);
        assert.equal((await call('GET', 'google-id-token')).status, 404);

        // A corrupt marker that still names its request keeps it through the rewrite.
        store.seed(markerOf(blobs), JSON.stringify({ revokedAtMs: 'not a time', deleteRequestId: id }), Date.now() + 1000);
        const refused = await call('GET', phoneB);
        assert.deepEqual(refused.body, { ok: false, error: 'SESSION_REVOKED', deleteRequestId: id });
        assert.equal(JSON.parse(blobs.get(markerOf(blobs))).deleteRequestId, id);
      });

      // Anything that is not 32 lowercase hex characters is ignored; so is no header. A marker naming no request answers with an explicit null, so a phone can tell it from an older server that never says.
      for (const bad of ['0123456789ABCDEF0123456789ABCDEF', '0123456789abcdef0123456789abcde', `${id}0`, 'g'.repeat(32), '', ' ', '{"x":1}']) {
        await withEndpoint(async ({ call, exchange, store }) => {
          const session = (await exchange(appleToken())).body.sessionToken;
          assert.equal((await deleteWith(call, session, bad)).status, 200, JSON.stringify(bad));
          for (const stamp of store.putLog) {
            assert.equal(JSON.parse(stamp.body).deleteRequestId, undefined, `${JSON.stringify(bad)} was stored`);
          }
          assert.deepEqual((await call('GET', session)).body, { ok: false, error: 'SESSION_REVOKED', deleteRequestId: null });
        });
      }
      await withEndpoint(async ({ call, exchange, store }) => {
        const session = (await exchange(appleToken())).body.sessionToken;
        assert.equal((await deleteWith(call, session)).status, 200);
        assert.deepEqual((await call('GET', session)).body, { ok: false, error: 'SESSION_REVOKED', deleteRequestId: null });
        // A marker written before the id existed.
        store.seed(
          [...store.blobs.keys()].find((key) => key.startsWith('revoked/')),
          JSON.stringify({ revokedAtMs: Date.now() }),
          Date.now(),
        );
        assert.deepEqual((await call('GET', session)).body, { ok: false, error: 'SESSION_REVOKED', deleteRequestId: null });
      });

      // The second stamp failing: the phone's retry meets the first stamp's id, which is how it knows the deletion was its own.
      await withEndpoint(async ({ call, exchange, store }) => {
        const session = (await exchange(appleToken())).body.sessionToken;
        let stamps = 0;
        store.failPuts = (pathname) => pathname.startsWith('revoked/') && (stamps += 1) === 2;
        assert.equal((await deleteWith(call, session, id)).status, 502);
        const retry = await deleteWith(call, session, 'fedcba9876543210fedcba9876543210');
        assert.equal(retry.status, 401);
        assert.deepEqual(retry.body, { ok: false, error: 'SESSION_REVOKED', deleteRequestId: id });
      });
    },
  },
];
