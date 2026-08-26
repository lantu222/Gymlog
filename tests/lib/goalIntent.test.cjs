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
    name: 'goalIntent: a goal the coach declared is read from its own words, not held to the sniffer',
    run() {
      // The reader wrote "haluisin painaa 80kg"; the coach offered to save
      // "painaa 80 kg". The trim dropped the goal word the sniffer demands, so
      // the offer was discarded while the answer kept telling them to press a
      // button ("En nää nappia", log 2026-08-25).
      assert.equal(parseGoalIntent('painaa 80 kg', 'fi'), null, 'unprompted, this is still not a stated goal');

      const declared = parseGoalIntent('painaa 80 kg', 'fi', { declared: true });
      assert.ok(declared, 'the coach already said this is a goal');
      assert.equal(declared.kind, 'bodyweight');
      assert.equal(declared.targetValue, 80);
      assert.equal(declared.unit, 'kg');

      // Declared or not, a goal still has to name something the app can track,
      // or the button saves a sentence nothing can ever measure against.
      assert.equal(parseGoalIntent('jaksaa paremmin', 'fi', { declared: true }), null);
      assert.equal(parseGoalIntent('onko tämä hyvä', 'fi', { declared: true }), null, 'a question is never a goal');

      // The reader's full sentence must keep working — it is what the coach is
      // now told to pass through unchanged.
      const verbatim = parseGoalIntent('haluisin painaa 80 kg', 'fi', { declared: true });
      assert.equal(verbatim.kind, 'bodyweight');
      assert.equal(verbatim.targetValue, 80);
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
