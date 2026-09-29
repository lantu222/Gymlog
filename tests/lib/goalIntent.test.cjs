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

      // "laskea painoa 78 kg" lowers by 78 kg, not to it — a relative
      // phrasing, so the number is not kept (was pinned at 78 kg before the
      // relative/absolute fix; see the suite below).
      const weight = parseGoalIntent('haluan laskea painoa 78 kg', 'fi');
      assert.ok(weight);
      assert.equal(weight.kind, 'bodyweight');
      assert.equal(weight.targetValue, null);
      assert.equal(weight.unit, null);

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
    // A relative phrasing states a change from wherever the reader is now,
    // not the goal's own number: "nosta painoa 5 kg" from an 85 kg reader is
    // not a 5 kg goal. The goal survives; the number does not — the same
    // conservative call a unit mismatch already gets.
    name: 'goalIntent: a number phrased as a change from now, not as the target, is kept as a goal without a number',
    run() {
      const relativeCases = [
        'haluan lisätä painoa 10 kg',
        'haluan pudottaa painoa 8 kg',
        'nosta painoa 5 kg',
        'haluan kasvattaa rinnanympärystä 10 cm',
        'I want to gain 10 kg of weight',
        'I want to lose 10 kg of weight',
      ];
      for (const text of relativeCases) {
        const goal = parseGoalIntent(text, 'fi', { declared: true });
        assert.ok(goal, `${text} should still be a goal`);
        assert.equal(goal.targetValue, null, `${text} kept a relative amount as an absolute target`);
        assert.equal(goal.unit, null, `${text}`);
      }

      const absoluteCases = [
        { text: 'tavoite paino 95 kg', kind: 'bodyweight', value: 95 },
        { text: 'haluan painaa 80 kg', kind: 'bodyweight', value: 80 },
        { text: 'rinnanympärys 104 cm', kind: 'chest', value: 104 },
      ];
      for (const { text, kind, value } of absoluteCases) {
        const goal = parseGoalIntent(text, 'fi', { declared: true });
        assert.ok(goal, `${text} should be a goal`);
        assert.equal(goal.kind, kind, text);
        assert.equal(goal.targetValue, value, `${text} dropped an absolute target`);
      }
    },
  },
  {
    name: 'goalIntent: a goal with a number never leaks into the measurement logger',
    run() {
      // Not "kasvattaa …", which the suite above now reads as a relative
      // amount and drops: this case is about the number reaching the goal at
      // all, not about which phrasing keeps it.
      const text = 'tavoite rinnanympärys 104 cm';
      assert.equal(parseMeasurementIntent(text, 'fi'), null, 'measurement parser must reject goal sentences');
      const goal = parseGoalIntent(text, 'fi');
      assert.ok(goal);
      assert.equal(goal.targetValue, 104);
    },
  },
];
