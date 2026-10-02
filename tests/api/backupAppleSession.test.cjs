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
  const store = {
    blobs,
    BlobNotFoundError,
    BlobPreconditionFailedError,
    // Set to a predicate on the pathname to make that read or write fail.
    failGets: null,
    failPuts: null,
    async head(pathname) {
      if (!blobs.has(pathname)) {
        throw new BlobNotFoundError();
      }
      return { etag: '"etag"' };
    },
    async get(pathname) {
      if (store.failGets?.(pathname)) {
        throw new Error('store unavailable');
      }
      const body = blobs.get(pathname);
      return body === undefined ? null : { statusCode: 200, stream: new Blob([body]).stream(), blob: { etag: '"etag"' } };
    },
    async put(pathname, body) {
      if (store.failPuts?.(pathname)) {
        throw new Error('store unavailable');
      }
      blobs.set(pathname, body);
      return { etag: '"etag"' };
    },
    async del(pathname) {
      blobs.delete(pathname);
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
    name: 'apple backup: a session carries the time it was issued, and a renewal carries a new one',
    async run() {
      await withEndpoint(async ({ call, exchange }) => {
        const claimsOf = (token) => JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
        const before = Math.floor(Date.now() / 1000);
        const { sessionToken } = (await exchange(appleToken())).body;
        const claims = claimsOf(sessionToken);
        assert.ok(claims.iat >= before && claims.iat <= before + 5, `iat ${claims.iat} is not the issue time`);
        assert.equal(claims.exp - claims.iat, 180 * 24 * 60 * 60, 'a session lasts 180 days from its iat');

        const renewed = await call('POST', sessionToken, { 'x-backup-action': 'apple-renew' });
        assert.ok(claimsOf(renewed.body.sessionToken).iat >= claims.iat);
      });
    },
  },
  {
    name: 'apple backup: deleting the account ends every session issued before it, here and on any other phone',
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

        // Signing in with Apple again is a new account use, and works.
        clock.advance(5000);
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
        clock.advance(5000);
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
];
