const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), 'utf8').replace(/\r\n/g, '\n');

const screen = read('src', 'screens', 'EmptyWorkoutScreen.tsx');

/**
 * Two user decisions from 2026-09-26 for the freestyle logger:
 *
 * 1. Finish must not be reachable with zero sets ticked — a board with rows
 *    typed in and nothing ticked used to save as a session nobody performed.
 * 2. The ✕ that removes an exercise must ask first once there is a set
 *    logged to lose, the same way leaving the screen does — it used to
 *    remove on one tap with no undo.
 */
module.exports = [
  {
    name: 'empty workout: Finish is gated on canFinishFreestyleSession, not just having a lift on the board',
    run() {
      assert.match(
        screen,
        /const hasLoggedSet = canFinishFreestyleSession\(exercises\);\s*const canFinish = hasExercises && !isSaving && hasLoggedSet;/,
      );
      // Both Finish buttons (header + footer) key off the same canFinish.
      assert.equal((screen.match(/disabled=\{!canFinish\}/g) ?? []).length, 2);
      // And the footer button looks it: disabled alone left it full purple
      // beside a hint calling it grey (second look, 2026-09-26).
      assert.match(screen, /!hasLoggedSet && !isSaving && styles\.finishButtonDisabled/);
      assert.match(screen, /styles\.finishButtonText, !hasLoggedSet && !isSaving && styles\.finishButtonTextDisabled/);
      // The reader is told why, not just left to guess at a greyed-out button.
      assert.match(screen, /!hasLoggedSet && !isSaving \? \(\s*<Text style=\{styles\.finishHint\}>\{t\(language, 'emptyWorkout\.finishNeedsSet'\)\}/);
    },
  },
  {
    name: 'empty workout: removing an exercise with logged work asks first',
    run() {
      const fn = screen.slice(
        screen.indexOf('const requestRemoveExercise = '),
        screen.indexOf('const patchSet = '),
      );
      assert.match(fn, /const work = freestyleUnsavedWork\(\[exercise\]\);/);
      assert.match(fn, /if \(work\.doneSets === 0 && work\.enteredSets === 0\) \{\s*removeExercise\(exerciseKey\);\s*return;\s*\}/);
      assert.match(fn, /setPendingRemoval\(\{ key: exerciseKey, name \}\);/);

      // The ✕ calls the gate, not the removal directly.
      assert.match(screen, /onPress=\{\(\) => requestRemoveExercise\(exercise\.localKey, exercise\.displayName\)\}/);

      // A confirm dialog, wired to actually remove on confirm.
      assert.match(
        screen,
        /visible=\{pendingRemoval != null\}[\s\S]{0,400}?onConfirm=\{\(\) => \{\s*if \(pendingRemoval\) \{\s*removeExercise\(pendingRemoval\.key\);/,
      );
    },
  },
];
