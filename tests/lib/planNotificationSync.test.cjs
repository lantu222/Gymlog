const assert = require('node:assert/strict');
const path = require('node:path');

const { planNotificationSync } = require(path.join(__dirname, '..', '..', '.test-dist', 'lib', 'planNotificationSync.js'));

/**
 * The rule behind syncing the planned notifications (native audit,
 * 2026-09-21): the first sync of a process re-arms everything, because the
 * pending list outlives the alarms behind it; every later one diffs. The
 * writes against a fake expo-notifications are in
 * tests/utils/sessionNotifications.test.cjs.
 */
const pending = (...pairs) => pairs.map(([identifier, signature]) => ({ identifier, signature }));

module.exports = [
  {
    name: 'plan sync: the first sync of a process cancels and re-schedules an unchanged plan',
    run() {
      const steps = planNotificationSync({
        pending: pending(['a', 'x'], ['b', 'y']),
        wanted: ['x', 'y'],
        rearm: true,
        allowed: true,
      });
      assert.deepEqual(steps, { cancel: ['a', 'b'], schedule: ['x', 'y'], keep: [] });
    },
  },
  {
    name: 'plan sync: later syncs keep what is pending, schedule what is missing, cancel the stale and the duplicate',
    run() {
      const steps = planNotificationSync({
        pending: pending(['a', 'x'], ['b', 'x'], ['c', 'old'], ['d', '']),
        wanted: ['x', 'y', 'y'],
        rearm: false,
        allowed: true,
      });
      assert.deepEqual(steps, { cancel: ['b', 'c', 'd'], schedule: ['y'], keep: ['x'] });

      // Nothing changed: nothing is written.
      assert.deepEqual(
        planNotificationSync({ pending: pending(['a', 'x']), wanted: ['x'], rearm: false, allowed: true }),
        { cancel: [], schedule: [], keep: ['x'] },
      );
    },
  },
  {
    name: 'plan sync: no permission or no plan clears everything, re-arm or not',
    run() {
      for (const rearm of [true, false]) {
        assert.deepEqual(
          planNotificationSync({ pending: pending(['a', 'x']), wanted: ['x'], rearm, allowed: false }),
          { cancel: ['a'], schedule: [], keep: [] },
        );
        assert.deepEqual(
          planNotificationSync({ pending: pending(['a', 'x']), wanted: [], rearm, allowed: true }),
          { cancel: ['a'], schedule: [], keep: [] },
        );
      }
    },
  },
];
