const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const playerSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'src', 'screens', 'GuidedPlayerScreen.tsx'),
  'utf8',
);
const i18nSource = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'lib', 'i18n.ts'), 'utf8');

/**
 * "Pitää olla myös helppo lisätä liikkeitä kesken treenin jos haluaa tehdä
 * enemmän, nyt jouduin palautumiseen ilman että halusin" (user 2026-09-29).
 *
 * There was no mid-workout add-exercise UI anywhere in the guided/programmed
 * flow before this: `exercise/insertAfter` existed in the reducer and
 * `insertExerciseAfter` on WorkoutProvider, but nothing dispatched either —
 * dead scaffolding. This wires it, for the first time, from a third and
 * quieter action on the cooldown intro, reusing the existing reducer action,
 * the existing library-item defaults policy (getExerciseTemplateDefaults,
 * the same one the day editor's own picker uses) and the existing catalog
 * tracking-mode lookup (getCatalogTrackingMode) — nothing invented.
 */
module.exports = [
  {
    name: 'guided cooldown intro: a third, quieter action adds an exercise and returns to the work block',
    run() {
      // Cooldown only — the warm-up splash has nothing to add to.
      assert.match(playerSource, /step\.phase === 'cooldown' \? \(\s*<Pressable\s+accessibilityRole="button"\s+style=\{styles\.gateAddExerciseLink\}/);
      assert.match(playerSource, /onPress=\{\(\) => setAddExerciseOpen\(true\)\}/);
      assert.match(playerSource, /\{t\(language, 'guided\.own\.addExercise'\)\}/);
      // The sheet is the existing one the day editor uses, not a new picker.
      assert.match(playerSource, /<AddExerciseSheet\s/);
      assert.match(playerSource, /onSelectItem=\{addMidWorkoutExercise\}/);
    },
  },
  {
    name: 'guided add-exercise: the insert reuses the existing reducer action and existing defaults, invents nothing new',
    run() {
      // The reducer/provider method already existed; this is its first caller.
      assert.match(playerSource, /workout\.insertExerciseAfter\(anchor\.slotId, \{/);
      assert.match(playerSource, /trackingMode: getCatalogTrackingMode\(item\.name\),/);
      assert.match(
        playerSource,
        /const defaults = getExerciseTemplateDefaults\(item, anchor\.restSecondsMin\);/,
      );
      // No new tracking-mode or rep-default policy invented for this screen.
      assert.doesNotMatch(playerSource, /function resolveInsertTrackingMode|function getInsertDefaults/);
    },
  },
  {
    name: 'guided add-exercise: lands on the new lift once the rebuilt steps carry it, not on a guessed index',
    run() {
      assert.match(playerSource, /const pendingInsertKnownSlotsRef = useRef<Set<string> \| null>\(null\);/);
      assert.match(
        playerSource,
        /const insertedSlotId = exercises\.map\(\(exercise\) => exercise\.slotId\)\.find\(\(slotId\) => !known\.has\(slotId\)\);/,
      );
      assert.match(playerSource, /goToRef\.current\(target\);/);
    },
  },
  {
    name: 'guided add-exercise: the sheet freezes the step like every other overlay',
    run() {
      assert.match(
        playerSource,
        /const frozen = paused \|\| howtoOpen \|\| exitOpen \|\| pauseSheetOpen \|\| swapOpen \|\| addExerciseOpen \|\| restEditOpen \|\| runSheetHolds \|\| ownBlock !== null \|\| restAsk\.sheetOpen;/,
      );
    },
  },
  {
    name: 'guided add-exercise: the new string reads in both languages',
    run() {
      const occurrences = i18nSource.split("'guided.own.addExercise':").length - 1;
      assert.equal(occurrences, 2, 'guided.own.addExercise is missing one of its two languages');
      assert.match(i18nSource, /'guided\.own\.addExercise': 'Add an exercise'/);
      assert.match(i18nSource, /'guided\.own\.addExercise': 'Lisää liike'/);
    },
  },
];
