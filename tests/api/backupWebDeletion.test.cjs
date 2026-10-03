const assert = require('node:assert/strict');

const { callHandler, loadApiModule, withEnv } = require('../helpers/apiModule.cjs');

/**
 * The web deletion page (styxon.fi) deletes an account through the backup
 * endpoint from a browser. The browser lets the page read an answer only when
 * the answer names the page's origin, so these run the endpoint and look at
 * which answers carry that header: the DELETE and its preflight from the
 * page, and nothing else — not a read of the backup, not another origin.
 */

const CLIENT_ID = 'client.apps.googleusercontent.com';
const PAGE = 'https://styxon.fi';

function fakeBlobStore() {
  class BlobNotFoundError extends Error {}
  class BlobPreconditionFailedError extends Error {}
  const state = { body: JSON.stringify({ version: 1, database: {}, workoutHistory: {} }), deletes: 0 };
  return {
    state,
    BlobNotFoundError,
    BlobPreconditionFailedError,
    async head() {
      if (state.body === null) throw new BlobNotFoundError();
      return { etag: '"e1"' };
    },
    async get() {
      if (state.body === null) return null;
      return { statusCode: 200, stream: new Blob([state.body]).stream(), blob: { etag: '"e1"' } };
    },
    async put() {
      return { etag: '"e2"' };
    },
    async del() {
      state.body = null;
      state.deletes += 1;
    },
    async list() {
      return { blobs: [] };
    },
  };
}

async function withEndpoint(scenario, { tokenValid = true } = {}) {
  const savedFetch = global.fetch;
  const quiet = console.error;
  global.fetch = async () =>
    tokenValid
      ? { ok: true, json: async () => ({ aud: CLIENT_ID, sub: 'sub-1', exp: String(Math.floor(Date.now() / 1000) + 3600) }) }
      : { ok: false, json: async () => ({ error: 'invalid_token' }) };
  console.error = () => undefined;
  try {
    await withEnv({ GOOGLE_WEB_CLIENT_ID: CLIENT_ID, BACKUP_PATH_SECRET: 'test-secret' }, async () => {
      const blob = fakeBlobStore();
      const { default: handler } = loadApiModule('api/backup.ts', { '@vercel/blob': blob });
      const call = (method, headers = {}) => callHandler(handler, { method, headers });
      await scenario({ call, store: blob.state });
    });
  } finally {
    console.error = quiet;
    global.fetch = savedFetch;
  }
}

const fromPage = { origin: PAGE, authorization: 'Bearer id-token', 'x-backup-action': 'delete-account' };

module.exports = [
  {
    name: 'web deletion: the page’s preflight is answered for DELETE with its own origin',
    async run() {
      await withEndpoint(async ({ call, store }) => {
        const answer = await call('OPTIONS', { origin: PAGE, 'access-control-request-method': 'DELETE' });
        assert.equal(answer.status, 204);
        assert.equal(answer.headers['access-control-allow-origin'], PAGE);
        assert.equal(answer.headers['access-control-allow-methods'], 'DELETE');
        const allowed = answer.headers['access-control-allow-headers'].split(', ');
        assert.ok(allowed.includes('authorization') && allowed.includes('x-backup-action'));
        assert.notEqual(store.body, null, 'a preflight deletes nothing');
      });
    },
  },
  {
    name: 'web deletion: another origin gets no CORS header, preflight or request',
    async run() {
      await withEndpoint(async ({ call, store }) => {
        const preflight = await call('OPTIONS', { origin: 'https://evil.example' });
        assert.equal(preflight.status, 405);
        assert.equal(preflight.headers['access-control-allow-origin'], undefined);
        const lookalike = await call('DELETE', { ...fromPage, origin: 'https://styxon.fi.evil.example' });
        assert.equal(lookalike.headers['access-control-allow-origin'], undefined);
        assert.equal(store.deletes, 1, 'the server still acts on a valid token; only the browser withholds the answer');
      });
    },
  },
  {
    name: 'web deletion: the page’s DELETE deletes the copy and the page can read that it did',
    async run() {
      await withEndpoint(async ({ call, store }) => {
        const answer = await call('DELETE', fromPage);
        assert.equal(answer.status, 200);
        assert.deepEqual(answer.body, { ok: true });
        assert.equal(answer.headers['access-control-allow-origin'], PAGE);
        assert.equal(store.body, null);
      });
    },
  },
  {
    name: 'web deletion: a refused sign-in reaches the page as a 401 it can read, and deletes nothing',
    async run() {
      await withEndpoint(
        async ({ call, store }) => {
          const answer = await call('DELETE', fromPage);
          assert.equal(answer.status, 401);
          assert.equal(answer.headers['access-control-allow-origin'], PAGE);
          assert.notEqual(store.body, null);
        },
        { tokenValid: false },
      );
    },
  },
  {
    name: 'web deletion: a read of the backup from the page carries no CORS header',
    async run() {
      await withEndpoint(async ({ call }) => {
        const answer = await call('GET', { origin: PAGE, authorization: 'Bearer id-token' });
        assert.equal(answer.status, 200, 'the server answers as it does the app');
        assert.equal(answer.headers['access-control-allow-origin'], undefined, 'but the browser keeps it from the page');
      });
    },
  },
  {
    name: 'web deletion: the app’s own requests (no Origin) are unchanged',
    async run() {
      await withEndpoint(async ({ call, store }) => {
        const answer = await call('DELETE', { authorization: 'Bearer id-token' });
        assert.equal(answer.status, 200);
        assert.equal(answer.headers['access-control-allow-origin'], undefined);
        assert.equal(store.body, null);
      });
    },
  },
];
