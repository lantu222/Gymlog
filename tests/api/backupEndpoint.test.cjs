const assert = require('node:assert/strict');

const { callHandler, loadApiModule, withEnv } = require('../helpers/apiModule.cjs');

/**
 * The backup endpoint's version protocol, run (server audit, 2026-09-21).
 *
 * Two phones on one Google account share one blob, and the endpoint wrote
 * whatever it was sent over whatever was there: the phone that backed up last
 * won, older data included. A write now names the copy it replaces and the
 * store keeps a copy it was not named — behaviour, which a source pattern can
 * only describe, so the endpoint is run with the blob store and Google's
 * tokeninfo replaced by fakes.
 */

const CLIENT_ID = 'client.apps.googleusercontent.com';

/** A blob store that keeps one copy and versions it the way Vercel Blob does. */
function fakeBlobStore() {
  class BlobError extends Error {}
  class BlobNotFoundError extends BlobError {}
  class BlobPreconditionFailedError extends BlobError {}
  const state = { body: null, etag: null, writes: 0, failNextPut: null };
  return {
    state,
    BlobNotFoundError,
    BlobPreconditionFailedError,
    async head() {
      if (state.body === null) {
        throw new BlobNotFoundError();
      }
      return { etag: state.etag };
    },
    async get() {
      if (state.body === null) {
        return null;
      }
      // The content response's own header, in a different form from the
      // API's: the version handed out must be the one `put` compares against.
      return { statusCode: 200, stream: new Blob([state.body]).stream(), blob: { etag: `W/${state.etag}` } };
    },
    async put(_pathname, body, options) {
      if (state.failNextPut) {
        const error = state.failNextPut;
        state.failNextPut = null;
        throw error;
      }
      if (options.ifMatch !== undefined && options.ifMatch !== state.etag) {
        throw state.body === null ? new BlobNotFoundError() : new BlobPreconditionFailedError();
      }
      if (options.allowOverwrite === false && state.body !== null) {
        // What the store answers: a plain error, not a precondition one.
        throw new BlobError('Vercel Blob: This blob already exists, use `allowOverwrite: true` if you want to overwrite it.');
      }
      state.body = body;
      state.writes += 1;
      state.etag = `"etag-${state.writes}"`;
      return { etag: state.etag };
    },
    async del() {
      state.body = null;
      state.etag = null;
    },
  };
}

async function withEndpoint(scenario) {
  const savedFetch = global.fetch;
  const quiet = console.error;
  global.fetch = async () => ({
    ok: true,
    json: async () => ({ aud: CLIENT_ID, sub: 'sub-1', exp: String(Math.floor(Date.now() / 1000) + 3600) }),
  });
  console.error = () => undefined;
  try {
    await withEnv({ GOOGLE_WEB_CLIENT_ID: CLIENT_ID, BACKUP_PATH_SECRET: 'test-secret' }, async () => {
      const blob = fakeBlobStore();
      const { default: handler } = loadApiModule('api/backup.ts', { '@vercel/blob': blob });
      const call = (method, { body, version } = {}) => {
        const headers = { authorization: 'Bearer id-token' };
        if (version !== undefined) {
          headers['x-backup-expected-version'] = version;
        }
        return callHandler(handler, { method, headers, body });
      };
      await scenario({ call, store: blob.state });
    });
  } finally {
    console.error = quiet;
    global.fetch = savedFetch;
  }
}

const copy = (label) => JSON.stringify({ version: 1, exportedAt: label, database: {}, workoutHistory: {} });

module.exports = [
  {
    name: 'backup endpoint: a write names the copy it replaces, and a stale one is refused without writing',
    async run() {
      await withEndpoint(async ({ call, store }) => {
        // The first backup of the account: onto no copy.
        const first = await call('PUT', { body: copy('phone-a-1'), version: 'none' });
        assert.equal(first.status, 200);
        assert.equal(first.body.ok, true);
        assert.equal(first.body.version, '"etag-1"');

        // Both phones read it, and learn its version.
        const read = await call('GET');
        assert.equal(read.status, 200);
        assert.equal(read.body.payload.exportedAt, 'phone-a-1');
        assert.equal(read.body.version, '"etag-1"', 'the version handed out is not the one a write is compared against');

        // Phone B writes over the copy it read.
        const b = await call('PUT', { body: copy('phone-b-1'), version: read.body.version });
        assert.equal(b.status, 200);
        assert.equal(b.body.version, '"etag-2"');

        // Phone A still names the copy it read, which is gone: refused, and
        // B's copy stays.
        const stale = await call('PUT', { body: copy('phone-a-2'), version: read.body.version });
        assert.equal(stale.status, 412, "phone A's older data was written over phone B's");
        assert.deepEqual(stale.body, { ok: false, error: 'BACKUP_CHANGED' });
        assert.equal(JSON.parse(store.body).exportedAt, 'phone-b-1');

        // A first backup where a copy already is: refused the same way.
        const late = await call('PUT', { body: copy('phone-c-1'), version: 'none' });
        assert.equal(late.status, 412, 'a first backup overwrote an existing copy');
        assert.equal(JSON.parse(store.body).exportedAt, 'phone-b-1');

        // A copy deleted from another phone since: the name matches nothing.
        await call('DELETE');
        const afterDelete = await call('PUT', { body: copy('phone-b-2'), version: '"etag-2"' });
        assert.equal(afterDelete.status, 412);
        assert.equal(store.body, null);
      });
    },
  },
  {
    name: 'backup endpoint: a build from before versions still backs up, and nonsense in the header is refused',
    async run() {
      await withEndpoint(async ({ call, store }) => {
        await call('PUT', { body: copy('old-1') });
        const legacy = await call('PUT', { body: copy('old-2') });
        assert.equal(legacy.status, 200, 'every installed phone stopped backing up until it updated');
        assert.equal(JSON.parse(store.body).exportedAt, 'old-2');

        const odd = await call('PUT', { body: copy('odd'), version: 'x'.repeat(300) });
        assert.equal(odd.status, 400);
        assert.equal(JSON.parse(store.body).exportedAt, 'old-2');
      });
    },
  },
  {
    name: 'backup endpoint: a store that fails a first write is a storage failure, not a copy another phone wrote',
    async run() {
      await withEndpoint(async ({ call, store }) => {
        store.failNextPut = new Error('store unavailable');
        const failed = await call('PUT', { body: copy('first'), version: 'none' });
        // 412 would send the phone to the restore question about a copy that
        // does not exist; this is a backup that did not happen, and is tried again.
        assert.equal(failed.status, 502);
        assert.equal(failed.body.error, 'STORAGE_FAILED');
        const missing = await call('GET');
        assert.equal(missing.status, 404);
        assert.equal(missing.body.error, 'NO_BACKUP');
      });
    },
  },
];
