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
  return {
    blobs,
    BlobNotFoundError,
    BlobPreconditionFailedError,
    async head(pathname) {
      if (!blobs.has(pathname)) {
        throw new BlobNotFoundError();
      }
      return { etag: '"etag"' };
    },
    async get(pathname) {
      const body = blobs.get(pathname);
      return body === undefined ? null : { statusCode: 200, stream: new Blob([body]).stream(), blob: { etag: '"etag"' } };
    },
    async put(pathname, body) {
      blobs.set(pathname, body);
      return { etag: '"etag"' };
    },
    async del(pathname) {
      blobs.delete(pathname);
    },
  };
}

async function withEndpoint(scenario) {
  const savedFetch = global.fetch;
  const quiet = console.error;
  const fetched = [];
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
        await scenario({ call, exchange, blobs: blob.blobs, fetched });
      },
    );
  } finally {
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
];
