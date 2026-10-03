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
      assert.deepEqual(answer.body, { ok: true, accepted: 3, dropped: 0 });
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
    name: 'events endpoint: a report with a message, a path, a stray field or an unknown code is dropped, and the valid events beside it are stored',
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
        const before = puts.length;
        // One event the server refuses must not take the funnel events with it:
        // a 400 here was retried by the app forever, stalling its whole queue.
        const answer = await post([{ name: 'app_open', at: AT }, event, { name: 'workout_started', at: AT }]);
        assert.equal(answer.status, 200, JSON.stringify(event));
        assert.deepEqual(answer.body, { ok: true, accepted: 2, dropped: 1 }, JSON.stringify(event));
        assert.equal(puts.length, before + 1);
        const stored = puts[puts.length - 1].body.events;
        assert.deepEqual(stored.map((entry) => entry.name), ['app_open', 'workout_started']);
        assert.ok(!JSON.stringify(stored).includes('Squat') && !JSON.stringify(stored).includes('jussi'));
      }
    },
  },
  {
    name: 'events endpoint: a batch with nothing valid stores nothing and still answers 200; a malformed batch is a 400',
    async run() {
      const { puts, post } = endpoint();
      const none = await post([appError({ message: 'x' }), { name: 'made_up', at: AT }]);
      assert.equal(none.status, 200);
      assert.deepEqual(none.body, { ok: true, accepted: 0, dropped: 2 });
      assert.equal(puts.length, 0);

      for (const answer of [
        await post([]),
        await post(Array.from({ length: 101 }, () => ({ name: 'app_open', at: AT }))),
        await post([{ name: 'app_open', at: AT }], { installId: 'not-a-uuid' }),
        await post('events'),
      ]) {
        assert.equal(answer.status, 400);
        assert.deepEqual(answer.body, { ok: false, error: 'BAD_REQUEST' });
      }
      assert.equal(puts.length, 0);
    },
  },
  {
    name: 'events endpoint: error events past the per-batch caps are dropped, the rest kept',
    async run() {
      const { puts, post } = endpoint();
      assert.deepEqual((await post(Array.from({ length: 20 }, () => appError()))).body, { ok: true, accepted: 20, dropped: 0 });
      assert.deepEqual((await post(Array.from({ length: 21 }, () => appError()))).body, { ok: true, accepted: 20, dropped: 1 });
      assert.deepEqual((await post(Array.from({ length: 40 }, () => failed()))).body, { ok: true, accepted: 40, dropped: 0 });
      assert.deepEqual((await post(Array.from({ length: 41 }, () => failed()))).body, { ok: true, accepted: 40, dropped: 1 });
      assert.equal(puts.length, 4);
    },
  },
];
