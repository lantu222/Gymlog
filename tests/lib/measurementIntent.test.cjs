const assert = require('node:assert/strict');

const { parseMeasurementIntent } = require('../../.test-dist/lib/measurementIntent.js');

module.exports = [
  {
    name: 'measurementIntent: a stated body measurement parses to kind, value and unit',
    run() {
      assert.deepEqual(parseMeasurementIntent('Rinnanympärys on 90 cm'), { kind: 'chest', value: 90, unit: 'cm' });
      assert.deepEqual(parseMeasurementIntent('vyötärö 82,5'), { kind: 'waist', value: 82.5, unit: 'cm' });
      assert.deepEqual(parseMeasurementIntent('painoni on 81.4 kg'), { kind: 'bodyweight', value: 81.4, unit: 'kg' });
      assert.deepEqual(parseMeasurementIntent('rasvaprosentti 18'), { kind: 'bodyfat', value: 18, unit: '%' });
      assert.deepEqual(parseMeasurementIntent('my chest is 100 cm', 'en'), { kind: 'chest', value: 100, unit: 'cm' });
      assert.deepEqual(parseMeasurementIntent('hauis 38'), { kind: 'arms', value: 38, unit: 'cm' });
    },
  },
  {
    // A false positive offers to log a number the reader never meant; these
    // are the shapes that must stay silent.
    name: 'measurementIntent: questions, goals, lifts and nonsense parse to nothing',
    run() {
      for (const text of [
        'Pitäisikö rinnan olla 100 cm?',
        'Tavoite on 95 cm rinta',
        'rinta 80 kg',            // a bench press, not a chest
        'Miten saisin isomman rinnan',
        'paino 2 kg',             // out of range
        'penkki 80 x 5',
        '',
      ]) {
        assert.equal(parseMeasurementIntent(text), null, text);
      }
    },
  },
];
