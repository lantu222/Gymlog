const assert = require('node:assert/strict');

const guard = require('../../scripts/releaseGuard.cjs');

module.exports = [
  {
    name: 'release guard: a store build needs a version the store has not had',
    run() {
      // Before the first release anything well-formed goes.
      assert.deepEqual(guard.decide({ platform: 'ios', version: '1.1.0', tags: [] }), { ok: true, previous: null });
      // A second TestFlight build of an unreleased version is fine.
      assert.equal(guard.decide({ platform: 'ios', version: '1.1.0', tags: ['android-v1.1.0'] }).ok, true);

      const released = guard.decide({ platform: 'ios', version: '1.1.0', tags: ['ios-v1.1.0'] });
      assert.equal(released.ok, false);
      assert.match(released.reason, /on jo julkaistu/);
      assert.match(released.reason, /1\.2\.0/);

      const lower = guard.decide({ platform: 'android', version: '1.1.9', tags: ['android-v1.1.0', 'android-v1.2.0'] });
      assert.equal(lower.ok, false);
      assert.match(lower.reason, /pienempi/);

      // Numbers, not strings: 1.10.0 is after 1.9.0.
      assert.deepEqual(guard.decide({ platform: 'ios', version: '1.10.0', tags: ['ios-v1.9.0', 'ios-v1.2.0'] }), {
        ok: true,
        previous: '1.9.0',
      });

      assert.equal(guard.decide({ platform: 'web', version: '1.1.0', tags: [] }).ok, false);
      assert.equal(guard.decide({ platform: 'ios', version: '1.1', tags: [] }).ok, false);
    },
  },
  {
    name: 'release guard: the what’s-new draft lists the commits since the last release',
    run() {
      assert.equal(
        guard.releaseNotes({ platform: 'ios', version: '1.2.0', previous: '1.1.0', subjects: ['Fix a', 'Add b'] }),
        '# iOS 1.2.0\n\nMuutokset version 1.1.0 jälkeen:\n\n- Fix a\n- Add b\n',
      );
      assert.match(guard.releaseNotes({ platform: 'android', version: '1.1.0', previous: null, subjects: [] }), /Ensimmäinen julkaisu/);
      assert.equal(guard.tagFor('android', '1.1.0'), 'android-v1.1.0');
    },
  },
];
