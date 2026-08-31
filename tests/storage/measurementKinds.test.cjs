const assert = require('node:assert/strict');

const {
  MEASUREMENT_KIND_ORDER,
  isMeasurementKind,
} = require('../../.test-dist/lib/measurementKinds.js');
const { MEASUREMENT_LABEL_KEYS } = require('../../.test-dist/lib/homeStatCards.js');

module.exports = [
  {
    name: 'every measurement the app can take survives a save and a load',
    run() {
      // The bug this exists for: normalizeDatabase carried its own chain of
      // `entry.kind === '...'` comparisons, and arms and calves reached the
      // model and the measurement screen without ever reaching that chain.
      // A biceps or calf entry was written, read back, and dropped in
      // silence — the reader's own data, gone on the next app start.
      for (const kind of ['bodyfat', 'shoulders', 'chest', 'back', 'arms', 'waist', 'hips', 'thighs', 'calves']) {
        assert.ok(isMeasurementKind(kind), `${kind} must survive the loader`);
      }
    },
  },
  {
    name: 'the list and the labels cannot drift apart',
    run() {
      // MEASUREMENT_LABEL_KEYS is typed Record<MeasurementKind, I18nKey>, so
      // the compiler already forces it to hold every kind. Comparing the two
      // catches the other direction at runtime: a kind listed here that the
      // screens cannot name.
      assert.deepEqual(
        [...MEASUREMENT_KIND_ORDER].sort(),
        Object.keys(MEASUREMENT_LABEL_KEYS).sort(),
      );
    },
  },
  {
    name: 'anything that is not a measurement is refused',
    run() {
      for (const value of ['bodyweight', 'lift:squat', '', 'BACK', null, undefined, 7, {}, ['back']]) {
        assert.equal(isMeasurementKind(value), false, JSON.stringify(value) ?? String(value));
      }
    },
  },
  {
    name: 'the loader delegates instead of keeping a second opinion',
    run() {
      // The rule lives in one pure place a test can call. A chain of
      // comparisons inside normalizeDatabase cannot be run from Node at all —
      // that module imports AsyncStorage — which is exactly how this drifted
      // for two kinds without anything going red.
      const fs = require('node:fs');
      const path = require('node:path');
      const source = fs.readFileSync(
        path.join(__dirname, '..', '..', 'src', 'storage', 'database.ts'),
        'utf8',
      );
      assert.match(source, /const kind = isMeasurementKind\(entry\?\.kind\) \? entry\.kind : null;/);
      assert.doesNotMatch(source, /entry\?\.kind === '/);
    },
  },
];
