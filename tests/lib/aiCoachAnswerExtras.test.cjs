const assert = require('node:assert/strict');

const { MAX_EXTRA_LINE_CHARS, readAnswerExtras } = require('../../.test-dist/lib/aiCoachAnswerExtras.js');

// The last-workout answer's shape (user, 2026-09-27): "Viime treenin havainto",
// "Mitä tekisin seuraavaksi?", "Huomio" when there is one, "Kehitysesimerkki".

module.exports = [
  {
    name: 'the last-workout answer carries its topic, heads-up and example',
    run() {
      assert.deepEqual(
        readAnswerExtras({
          topic: 'last_session',
          attention: '  Kolmas sarja putosi neljään — 30 s lisää lepoa voisi pitää sen.  ',
          example: 'Pidä 50 kg ja tavoittele 7/7/7.',
        }),
        {
          topic: 'last_session',
          attention: 'Kolmas sarja putosi neljään — 30 s lisää lepoa voisi pitää sen.',
          example: 'Pidä 50 kg ja tavoittele 7/7/7.',
        },
      );
    },
  },
  {
    name: 'an empty heads-up or example is left out, and any other answer is unchanged',
    run() {
      // Most answers have no warning: the heading is drawn only over something.
      assert.deepEqual(readAnswerExtras({ topic: 'last_session', attention: '   ', example: '' }), { topic: 'last_session' });
      assert.deepEqual(readAnswerExtras({ topic: 'other', attention: 'x' }), { attention: 'x' });
      assert.deepEqual(readAnswerExtras({ takeaway: 'Proteiinia 1,6 g/kg.' }), {});
      assert.deepEqual(readAnswerExtras(null), {});
      assert.deepEqual(readAnswerExtras({ topic: 'last_session', example: 42 }), { topic: 'last_session' });
    },
  },
  {
    name: 'a heads-up that runs to a paragraph is cut to a sentence\'s length',
    run() {
      const long = 'a'.repeat(MAX_EXTRA_LINE_CHARS + 50);
      assert.equal(readAnswerExtras({ attention: long }).attention.length, MAX_EXTRA_LINE_CHARS);
    },
  },
];
