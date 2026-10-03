const assert = require('node:assert/strict');

const { callHandler, loadApiModule } = require('../helpers/apiModule.cjs');

/**
 * The usage-event endpoint takes the two error events under the same
 * validation as the others (2026-10-03): run for real, with the blob store
 * replaced by a recorder. Retention is unchanged — the events land in the
 * same events/ folder the daily prune already covers.
 */

const INSTALL = '12345678-1234-4123-8123-123456789abc';
const AT = '2026-10-03T10:00:00.000Z';

const appError = (over = {}) => ({
  name: 'app_error',
  at: AT,
  props: {
    kind: 'js_fatal',
    name: 'TypeError',
    signature: 'a1b2c3d4e5f607',
    frames: ['index.android.bundle:1:1234567', 'index.android.bundle:1:98765'],
    screen: 'workout/programDay',
    appVersion: '1.1.0',
    platform: 'android',
    ...over,
  },
});
const failed = (over = {}) => ({ name: 'operation_failed', at: AT, props: { op: 'backup_upload', code: 'STORE_UNAVAILABLE', ...over } });

function endpoint() {
  const puts = [];
  const blob = {
    put: async (pathname, body, options) => {
      puts.push({ pathname, body: JSON.parse(body), options });
      return { pathname };
    },
    get: async () => null,
    list: async () => ({ blobs: [], hasMore: false }),
  };
  const { default: handler } = loadApiModule('api/events.ts', { '@vercel/blob': blob });
  const post = (events, over = {}) =>
    callHandler(handler, { method: 'POST', headers: {}, body: { installId: INSTALL, sentAt: AT, events, ...over } });
  return { puts, post };
}

module.exports = [
  {
    name: 'events endpoint: a batch with an error report and a failed operation is stored in the usual place',
    async run() {
      const { puts, post } = endpoint();
      const answer = await post([{ name: 'app_open', at: AT }, appError(), failed()]);
      assert.equal(answer.status, 200);
      assert.deepEqual(answer.body, { ok: true });
      assert.equal(puts.length, 1);
      assert.match(puts[0].pathname, /^events\/\d{4}-\d{2}-\d{2}\//, 'the folder the retention prune already reads');
      assert.equal(puts[0].options.access, 'private');
      assert.deepEqual(
        puts[0].body.events.map((event) => event.name),
        ['app_open', 'app_error', 'operation_failed'],
      );
      assert.equal(puts[0].body.events[1].props.signature, 'a1b2c3d4e5f607');
    },
  },
  {
    name: 'events endpoint: a report with a message, a path, a stray field or an unknown code rejects the whole batch',
    async run() {
      const { puts, post } = endpoint();
      const bad = [
        appError({ message: 'Cannot find exercise Squat' }),
        appError({ frames: ['/data/user/0/app.vinha/files/index.android.bundle:1:2'] }),
        appError({ screen: 'home/jussi' }),
        appError({ name: 'Cannot read sets' }),
        appError({ userId: 'x' }),
        failed({ code: 'Network request failed' }),
        failed({ op: 'delete_everything' }),
        failed({ message: 'x' }),
        { name: 'app_error', at: AT },
        { name: 'operation_failed', at: AT, props: {} },
      ];
      for (const event of bad) {
        const answer = await post([{ name: 'app_open', at: AT }, event]);
        assert.equal(answer.status, 400, JSON.stringify(event));
        assert.deepEqual(answer.body, { ok: false, error: 'BAD_REQUEST' });
      }
      assert.equal(puts.length, 0, 'nothing from a rejected batch is stored');
    },
  },
  {
    name: 'events endpoint: the per-batch caps on error events hold',
    async run() {
      const { puts, post } = endpoint();
      assert.equal((await post(Array.from({ length: 20 }, () => appError()))).status, 200);
      assert.equal((await post(Array.from({ length: 21 }, () => appError()))).status, 400);
      assert.equal((await post(Array.from({ length: 40 }, () => failed()))).status, 200);
      assert.equal((await post(Array.from({ length: 41 }, () => failed()))).status, 400);
      assert.equal(puts.length, 2);
    },
  },
];
