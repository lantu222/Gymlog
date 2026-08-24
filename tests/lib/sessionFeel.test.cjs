const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

/**
 * "Miltä treeni tuntui?" — one question on the way out of the finish screen
 * (user 2026-08-23), written onto the already-saved session.
 *
 * Source-level where the code talks to AsyncStorage or renders; the guards
 * pin the chain: Done opens the ask → the answer reaches
 * updateCompletedWorkoutSession → the stored value survives normalization.
 */

const root = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const completionSource = read('src/screens/WorkoutCompletionScreen.tsx');
const appSource = read('App.tsx');
const databaseSource = read('src/storage/database.ts');
const modelsSource = read('src/types/models.ts');
const i18nSource = read('src/lib/i18n.ts');

module.exports = [
  {
    name: 'session feel: Done asks, four colour-coded answers, skip costs one tap',
    run() {
      // The CTA opens the ask instead of leaving directly.
      assert.match(completionSource, /onPress=\{\(\) => setFeelSheetVisible\(true\)\}/);
      // All four verdicts and the skip are offered; each answer leaves.
      for (const feel of ['easy', 'right', 'hard', 'too_hard']) {
        assert.match(completionSource, new RegExp(`feel: '${feel}'`));
      }
      assert.match(completionSource, /onDone\(option\.feel\)/);
      assert.match(completionSource, /onDone\(null\)/);
      // The prop carries the verdict out.
      assert.match(completionSource, /onDone: \(feel: SessionFeel \| null\) => void/);
    },
  },
  {
    name: 'session feel: the verdict lands on the saved session',
    run() {
      assert.match(
        appSource,
        /void updateCompletedWorkoutSession\(completionSummary\.sessionId, \{ feel \}\)/,
      );
    },
  },
  {
    name: 'session feel: the stored value survives a reload, junk does not',
    run() {
      assert.match(modelsSource, /export type SessionFeel = 'easy' \| 'right' \| 'hard' \| 'too_hard'/);
      assert.match(modelsSource, /feel\?: SessionFeel \| null;/);
      // Normalization admits exactly the four values and nulls anything else.
      assert.match(
        databaseSource,
        /session\?\.feel === 'easy' \|\| session\?\.feel === 'right' \|\| session\?\.feel === 'hard' \|\| session\?\.feel === 'too_hard'/,
      );
    },
  },
  {
    name: 'session feel: every string reads in both languages',
    run() {
      for (const key of [
        'complete.feel.title',
        'complete.feel.easy',
        'complete.feel.right',
        'complete.feel.hard',
        'complete.feel.tooHard',
        'complete.feel.skip',
      ]) {
        const occurrences = i18nSource.split(`'${key}':`).length - 1;
        assert.equal(occurrences, 2, `${key} is missing one of its two languages`);
      }
    },
  },
];
