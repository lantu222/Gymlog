const assert = require('node:assert/strict');
const path = require('node:path');

const { requireWithStubs } = require('../../helpers/hookHarness.cjs');

/**
 * The phone's side of "Delete cloud backup" and "Delete account": what it
 * sends, and how a refusal reaches the hook as a code. The hook signs an Apple
 * session out on SESSION_REVOKED / SESSION_EXPIRED only, so the client has to
 * hand the server's code through and nothing else.
 */

const API = path.join(__dirname, '..', '..', '..', '.test-dist', 'features', 'account', 'backupApi.js');

async function withApi(answer, scenario) {
  const savedFetch = global.fetch;
  const savedUrl = process.env.EXPO_PUBLIC_BACKUP_API_URL;
  process.env.EXPO_PUBLIC_BACKUP_API_URL = 'https://backup.example/api/backup';
  const requests = [];
  global.fetch = async (url, init) => {
    requests.push({ url, init });
    if (answer instanceof Error) {
      throw answer;
    }
    return { ok: answer.status >= 200 && answer.status < 300, status: answer.status, json: async () => answer.body };
  };
  try {
    const api = requireWithStubs(API, {
      '../appUpdate/appUpdateSignal': { appVersionHeaders: () => ({}), noteServerAnswer: () => undefined },
    });
    await scenario(api, requests);
  } finally {
    global.fetch = savedFetch;
    if (savedUrl === undefined) {
      delete process.env.EXPO_PUBLIC_BACKUP_API_URL;
    } else {
      process.env.EXPO_PUBLIC_BACKUP_API_URL = savedUrl;
    }
  }
}

module.exports = [
  {
    name: 'backup client: a refused session reaches the caller as the server’s own code',
    async run() {
      for (const code of ['SESSION_REVOKED', 'SESSION_EXPIRED', 'INVALID_TOKEN']) {
        await withApi({ status: 401, body: { ok: false, error: code } }, async (api) => {
          assert.deepEqual(await api.deleteBackup('vs1.x.y'), { ok: false, error: code, definite: true });
          assert.deepEqual(await api.deleteBackup('vs1.x.y', { account: true }), { ok: false, error: code, definite: true });
        });
      }
    },
  },
  {
    name: 'backup client: only a 401 carries a code — a store that could not answer, a failed delete and an offline phone do not',
    async run() {
      // A 502 with an error code is the store failing, not a session ending: no code, so no sign-out.
      for (const status of [500, 502, 503]) {
        await withApi({ status, body: { ok: false, error: 'STORE_UNAVAILABLE' } }, async (api) => {
          assert.deepEqual(await api.deleteBackup('vs1.x.y'), { ok: false });
        });
      }
      await withApi({ status: 200, body: { ok: false } }, async (api) => {
        assert.deepEqual(await api.deleteBackup('vs1.x.y'), { ok: false, definite: true }, 'a 2xx that is not the server’s yes counted');
      });
      await withApi({ status: 401, body: null }, async (api) => {
        assert.deepEqual(await api.deleteBackup('vs1.x.y'), { ok: false, definite: true }, 'a 401 with no body carried a code');
      });
      await withApi(new Error('offline'), async (api) => {
        assert.deepEqual(await api.deleteBackup('vs1.x.y'), { ok: false });
      });
      await withApi({ status: 200, body: { ok: true } }, async (api) => {
        assert.deepEqual(await api.deleteBackup('vs1.x.y'), { ok: true, definite: true });
      });
      // 4xx settles the request; a 5xx or no answer at all leaves it open whether the delete went through
      // ("Delete account" keeps its pending record on those, and clears it on the others).
      await withApi({ status: 400, body: { ok: false, error: 'BAD_VERSION' } }, async (api) => {
        assert.deepEqual(await api.deleteBackup('vs1.x.y'), { ok: false, definite: true });
      });
    },
  },
  {
    name: 'backup client: Delete account sends the account action, Delete cloud backup does not',
    async run() {
      await withApi({ status: 200, body: { ok: true } }, async (api, requests) => {
        await api.deleteBackup('tok');
        await api.deleteBackup('tok', { account: true });
        assert.equal(requests[0].init.method, 'DELETE');
        assert.equal(requests[0].init.headers['x-backup-action'], undefined, 'a plain delete asked for the account to go');
        assert.equal(requests[1].init.headers['x-backup-action'], 'delete-account');
        assert.equal(requests[1].init.headers.authorization, 'Bearer tok');
      });
    },
  },
];
