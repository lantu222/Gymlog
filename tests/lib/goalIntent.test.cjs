const assert = require('node:assert/strict');
const { parseGoalIntent } = require('../../.test-dist/lib/goalIntent.js');
const { parseMeasurementIntent } = require('../../.test-dist/lib/measurementIntent.js');

module.exports = [
  {
    name: 'goalIntent: a stated goal parses, with and without a target number',
    run() {
      const plain = parseGoalIntent('Yritän kasvattaa rinnanympärystä', 'fi');
      assert.ok(plain, 'goal without a number should parse');
      assert.equal(plain.kind, 'chest');
      assert.equal(plain.targetValue, null);
      assert.equal(plain.unit, null);

      const withTarget = parseGoalIntent('tavoite rinnanympärys 104 cm', 'fi');
      assert.ok(withTarget);
      assert.equal(withTarget.kind, 'chest');
      assert.equal(withTarget.targetValue, 104);
      assert.equal(withTarget.unit, 'cm');

      const weight = parseGoalIntent('haluan laskea painoa 78 kg', 'fi');
      assert.ok(weight);
      assert.equal(weight.kind, 'bodyweight');
      assert.equal(weight.targetValue, 78);
      assert.equal(weight.unit, 'kg');

      const english = parseGoalIntent('I want to grow my chest to 104 cm', 'en');
      assert.ok(english);
      assert.equal(english.kind, 'chest');
      assert.equal(english.targetValue, 104);
    },
  },
  {
    name: 'goalIntent: questions, plain statements and unit mismatches do not become goals',
    run() {
      assert.equal(parseGoalIntent('Onko tavoitteeni kasvattaa rintaa hyvä?', 'fi'), null, 'question mark kills it');
      assert.equal(parseGoalIntent('rinnanympärys on 98 cm', 'fi'), null, 'a reading is not a goal');
      assert.equal(parseGoalIntent('haluan tietää rinnanympärykseni', 'fi'), null, 'no direction word');
      assert.equal(parseGoalIntent('tavoitteena on jaksaa paremmin', 'fi'), null, 'no body-part word');

      // "tavoite rinta 104 kg" is a bench dream: the goal survives, the number does not.
      const mismatch = parseGoalIntent('tavoite on kasvattaa rintaa 104 kg', 'fi');
      assert.ok(mismatch);
      assert.equal(mismatch.targetValue, null);
    },
  },
  {
    name: 'goalIntent: a goal with a number never leaks into the measurement logger',
    run() {
      const text = 'haluan kasvattaa rinnanympärystä 104 cm';
      assert.equal(parseMeasurementIntent(text, 'fi'), null, 'measurement parser must reject goal sentences');
      const goal = parseGoalIntent(text, 'fi');
      assert.ok(goal);
      assert.equal(goal.targetValue, 104);
    },
  },
];
