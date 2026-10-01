const assert = require('node:assert/strict');
const path = require('node:path');

const { requireWithStubs } = require('../../helpers/hookHarness.cjs');

/**
 * Sign in with Apple on the phone (2026-10-01): the session it keeps, when it
 * stops trusting it, and how the account layer picks between Apple and Google.
 */

const DIST = path.join(__dirname, '..', '..', '..', '.test-dist');
const APPLE_AUTH = path.join(DIST, 'features', 'account', 'appleAuth.js');
const ACCOUNT_AUTH = path.join(DIST, 'features', 'account', 'accountAuth.js');

const DAY = 24 * 60 * 60 * 1000;
const AUTHORIZED = 1;
const REVOKED = 0;
const NOT_FOUND = 2;

function memoryStorage(initial = {}) {
  const items = new Map(Object.entries(initial));
  return {
    items,
    async getItem(key) {
      return items.has(key) ? items.get(key) : null;
    },
    async setItem(key, value) {
      items.set(key, value);
    },
    async removeItem(key) {
      items.delete(key);
    },
  };
}

function loadApple({ os = 'ios', storage = memoryStorage(), apple = {}, exchange, renew } = {}) {
  const module = {
    isAvailableAsync: async () => true,
    signInAsync: async () => ({
      user: 'apple-user-1',
      identityToken: 'header.eyJlbWFpbCI6InJlbGF5QHByaXZhdGVyZWxheS5hcHBsZWlkLmNvbSJ9.sig',
      email: null,
      fullName: { givenName: 'Aino', familyName: 'Virtanen' },
    }),
    getCredentialStateAsync: async () => AUTHORIZED,
    ...apple,
  };
  require.cache[APPLE_MODULE] = { id: APPLE_MODULE, filename: APPLE_MODULE, loaded: true, exports: module };
  const auth = requireWithStubs(APPLE_AUTH, {
    'react-native': { Platform: { OS: os } },
    '@react-native-async-storage/async-storage': { __esModule: true, default: storage },
    './backupApi': {
      exchangeAppleSession:
        exchange ?? (async () => ({ ok: true, sessionToken: 'vs1.session', expiresAt: new Date(Date.now() + 180 * DAY).toISOString() })),
      renewAppleSession:
        renew ??
        (async () => {
          throw new Error('renewed a session with months left');
        }),
    },
  });
  return { auth, storage };
}

// appleAuth requires the native module lazily, at the call, after
// requireWithStubs has put the cache back — so the stub sits in the cache for
// the length of a test, and each test puts back what was there.
const APPLE_MODULE = require.resolve('expo-apple-authentication', { paths: [path.dirname(APPLE_AUTH)] });

function withAppleCache(run) {
  return async () => {
    const saved = require.cache[APPLE_MODULE];
    try {
      await run();
    } finally {
      if (saved) {
        require.cache[APPLE_MODULE] = saved;
      } else {
        delete require.cache[APPLE_MODULE];
      }
    }
  };
}

const stored = (expiresAt) =>
  JSON.stringify({ user: 'apple-user-1', sessionToken: 'vs1.session', expiresAt: new Date(expiresAt).toISOString() });

module.exports = [
  {
    name: 'apple sign-in: the identity token is traded for a session, kept, and the account is Apple’s own',
    run: withAppleCache(async () => {
      const { auth, storage } = loadApple();
      const result = await auth.signInWithApple();
      assert.equal(result.status, 'signed_in');
      assert.equal(result.account.sub, 'apple:apple-user-1', 'an Apple subject could collide with a Google one');
      assert.equal(result.account.idToken, 'vs1.session', 'the ten-minute identity token was used as the backup token');
      assert.equal(result.account.name, 'Aino Virtanen');
      // Apple sends the email on the credential only the first time; the token carries it every time.
      assert.equal(result.account.email, 'relay@privaterelay.appleid.com');
      assert.equal(JSON.parse(storage.items.get('@vinha/account/apple/v1')).user, 'apple-user-1');
      assert.equal(await auth.hasAppleSession(), true);
    }),
  },
  {
    name: 'apple sign-in: a cancelled sheet, a refused exchange and Android are not a sign-in',
    run: withAppleCache(async () => {
      const cancelled = loadApple({
        apple: {
          signInAsync: async () => {
            throw Object.assign(new Error('cancelled'), { code: 'ERR_REQUEST_CANCELED' });
          },
        },
      });
      assert.deepEqual(await cancelled.auth.signInWithApple(), { status: 'cancelled' });

      const refused = loadApple({ exchange: async () => ({ ok: false }) });
      assert.deepEqual(await refused.auth.signInWithApple(), { status: 'failed' });
      assert.equal(refused.storage.items.size, 0, 'a session was kept that the server never issued');

      const android = loadApple({ os: 'android' });
      assert.equal(android.auth.isAppleSignInConfigured(), false);
      assert.deepEqual(await android.auth.signInWithApple(), { status: 'unavailable' });
    }),
  },
  {
    name: 'apple session: renewed in its last month, signed out when revoked or run out, kept when Apple is out of reach',
    run: withAppleCache(async () => {
      const fresh = () => memoryStorage({ '@vinha/account/apple/v1': stored(Date.now() + 100 * DAY) });

      assert.deepEqual(await loadApple({ storage: fresh() }).auth.getFreshAppleToken(), { status: 'ok', idToken: 'vs1.session' });

      for (const state of [REVOKED, NOT_FOUND]) {
        const { auth } = loadApple({ storage: fresh(), apple: { getCredentialStateAsync: async () => state } });
        assert.deepEqual(await auth.getFreshAppleToken(), { status: 'signed_out' }, `credential state ${state}`);
      }

      // Offline: Apple cannot be asked, and the server still judges the session.
      const offline = loadApple({
        storage: fresh(),
        apple: {
          getCredentialStateAsync: async () => {
            throw new Error('offline');
          },
        },
      });
      assert.deepEqual(await offline.auth.getFreshAppleToken(), { status: 'ok', idToken: 'vs1.session' });

      // Within its last 30 days a backup renews it first, and keeps the new one.
      const renewedUntil = new Date(Date.now() + 180 * DAY).toISOString();
      const ending = loadApple({
        storage: memoryStorage({ '@vinha/account/apple/v1': stored(Date.now() + 12 * DAY) }),
        renew: async (token) => {
          assert.equal(token, 'vs1.session');
          return { ok: true, sessionToken: 'vs1.renewed', expiresAt: renewedUntil };
        },
      });
      assert.deepEqual(await ending.auth.getFreshAppleToken(), { status: 'ok', idToken: 'vs1.renewed' });
      const kept = JSON.parse(ending.storage.items.get('@vinha/account/apple/v1'));
      assert.deepEqual(kept, { user: 'apple-user-1', sessionToken: 'vs1.renewed', expiresAt: renewedUntil });

      // A failed renewal still backs up with the session it has, and tries again next time.
      const unrenewed = loadApple({
        storage: memoryStorage({ '@vinha/account/apple/v1': stored(Date.now() + 12 * DAY) }),
        renew: async () => ({ ok: false }),
      });
      assert.deepEqual(await unrenewed.auth.getFreshAppleToken(), { status: 'ok', idToken: 'vs1.session' });

      // A revoked sign-in is not renewed.
      const revokedEnding = loadApple({
        storage: memoryStorage({ '@vinha/account/apple/v1': stored(Date.now() + 12 * DAY) }),
        apple: { getCredentialStateAsync: async () => REVOKED },
      });
      assert.deepEqual(await revokedEnding.auth.getFreshAppleToken(), { status: 'signed_out' });

      // Run out (months offline): one Face ID, not a backup the server refuses.
      const expired = loadApple({ storage: memoryStorage({ '@vinha/account/apple/v1': stored(Date.now() + 10 * 60 * 1000) }) });
      assert.deepEqual(await expired.auth.getFreshAppleToken(), { status: 'signed_out' });

      // Garbage in storage is no session.
      const broken = loadApple({ storage: memoryStorage({ '@vinha/account/apple/v1': '{"user":1}' }) });
      assert.equal(await broken.auth.hasAppleSession(), false);

      const signedOut = loadApple({ storage: fresh() });
      await signedOut.auth.signOutApple();
      assert.equal(signedOut.storage.items.size, 0);
    }),
  },
  {
    name: 'account auth: an Apple session routes the backup token to Apple, and a Google sign-in drops it',
    async run() {
      const calls = [];
      let appleSession = true;
      const load = ({ apple = true, google = true } = {}) =>
        requireWithStubs(ACCOUNT_AUTH, {
          './appleAuth': {
            isAppleSignInConfigured: () => apple,
            hasAppleSession: async () => appleSession,
            getFreshAppleToken: async () => ({ status: 'ok', idToken: 'apple-session' }),
            signInWithApple: async () => ({ status: 'signed_in', account: { sub: 'apple:x' } }),
            signOutApple: async () => {
              calls.push('signOutApple');
              appleSession = false;
            },
          },
          './googleAuth': {
            isGoogleSignInConfigured: () => google,
            getFreshIdToken: async () => ({ status: 'ok', idToken: 'google-token' }),
            signInWithGoogle: async () => ({ status: 'signed_in', account: { sub: 'g' } }),
            signOutGoogle: async () => {
              calls.push('signOutGoogle');
            },
          },
        });

      const auth = load();
      // Apple first, as Apple asks.
      assert.deepEqual(auth.availableSignInProviders(), ['apple', 'google']);
      assert.deepEqual(load({ apple: false }).availableSignInProviders(), ['google']);
      assert.equal(load({ apple: false, google: false }).isAccountSignInConfigured(), false);
      assert.deepEqual(await load({ apple: false }).signInWith('apple'), { status: 'unavailable' });

      assert.deepEqual(await auth.getFreshIdToken(), { status: 'ok', idToken: 'apple-session' });
      await auth.signInWith('google');
      assert.deepEqual(calls, ['signOutApple'], 'a Google sign-in kept the Apple session that routes backups');
      assert.deepEqual(await auth.getFreshIdToken(), { status: 'ok', idToken: 'google-token' });

      calls.length = 0;
      await auth.signOutAccount();
      assert.deepEqual(calls, ['signOutApple', 'signOutGoogle']);
    },
  },
];
