const assert = require('node:assert/strict');

const { setNumberLanguage } = require('../../.test-dist/lib/format.js');
setNumberLanguage('en');

const {
  REST_WEIGHT_STEP_KG,
  buildRestWeightOptions,
} = require('../../.test-dist/lib/restWeightOptions.js');

module.exports = [
  {
    name: 'three options around the gate pick, with the pick pre-selected',
    run() {
      const options = buildRestWeightOptions({ pickKg: 62.5, lastKg: 60 }, 'en');
      assert.deepEqual(options.map((option) => option.loadKg), [60, 62.5, 65]);
      assert.deepEqual(options.map((option) => option.label), ['60 kg', '62.5 kg', '65 kg']);
      // Exactly one is the pick, and it is the middle one.
      assert.deepEqual(options.map((option) => option.isPick), [false, true, false]);
      // The one that matches last session says so, and only that one.
      assert.deepEqual(options.map((option) => option.note), ['same', null, null]);
      assert.equal(buildRestWeightOptions({ pickKg: 62.5, lastKg: 60 }, 'fi')[0].note, 'sama');
      assert.equal(REST_WEIGHT_STEP_KG, 2.5);
    },
  },
  {
    name: 'the options sit on the grid the gate itself moved on',
    run() {
      // The gate jumped 5 kg, so the neighbours are 5 kg away — offering
      // 2,5 kg steps under a 5 kg progression would fight the engine.
      const options = buildRestWeightOptions({ pickKg: 105, lastKg: 100, stepKg: 5 }, 'en');
      assert.deepEqual(options.map((option) => option.loadKg), [100, 105, 110]);
      // A nonsense step falls back to the default rather than collapsing the row.
      assert.deepEqual(
        buildRestWeightOptions({ pickKg: 60, lastKg: null, stepKg: 0 }, 'en').map((o) => o.loadKg),
        [57.5, 60, 62.5],
      );
    },
  },
  {
    name: 'arithmetic that would print 58.749999999999996 does not',
    run() {
      const options = buildRestWeightOptions({ pickKg: 61.25, lastKg: null }, 'en');
      assert.deepEqual(options.map((option) => option.loadKg), [58.75, 61.25, 63.75]);
    },
  },
  {
    name: 'a light lift offers two options rather than a negative one',
    run() {
      // 1 kg - 2.5 kg is not a weight; the row drops it and stays a choice.
      const options = buildRestWeightOptions({ pickKg: 1, lastKg: null }, 'en');
      assert.deepEqual(options.map((option) => option.loadKg), [1, 3.5]);
      assert.equal(options[0].isPick, true);
      // Exactly the step down lands on zero, which is also not a weight.
      assert.deepEqual(
        buildRestWeightOptions({ pickKg: 2.5, lastKg: null }, 'en').map((o) => o.loadKg),
        [2.5, 5],
      );
    },
  },
  {
    name: 'a lift that logs no load is offered no weights at all',
    run() {
      assert.deepEqual(buildRestWeightOptions({ pickKg: null, lastKg: null }, 'en'), []);
      assert.deepEqual(buildRestWeightOptions({ pickKg: 0, lastKg: null }, 'en'), []);
      assert.deepEqual(buildRestWeightOptions({ pickKg: Number.NaN, lastKg: null }, 'en'), []);
    },
  },
];
