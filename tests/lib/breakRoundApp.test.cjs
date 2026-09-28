const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { switchBar } = require('../../.test-dist/lib/barChoice.js');
const { WEIGHT_DIAL_MAX_KG } = require('../../.test-dist/lib/weightLimits.js');
const { canCompleteSet } = require('../../.test-dist/features/workout/workoutState.js');
const { formatPlanSessionTitle, isReaderNamedSession } = require('../../.test-dist/lib/sessionNameLabel.js');
const { createExercise, createSet } = require('../helpers/workoutFixtures.cjs');
const { createFakeAsyncStorage, loadAgainstFake } = require('../storage/fakeAsyncStorage.cjs');

const root = path.join(__dirname, '..', '..');
const read = (...segments) => fs.readFileSync(path.join(root, ...segments), 'utf8').replace(/\r\n/g, '\n');
const strip = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

/**
 * The app half of the break round, 2026-09-28: each case below is one of the
 * repros the adversarial pass wrote against #202, #206, #208 and #214, turned
 * into the rule that now holds.
 */
module.exports = [
  {
    name: 'break round: a bar tap never lifts the total past the dial ceiling',
    run() {
      assert.equal(switchBar(500, null, 20), WEIGHT_DIAL_MAX_KG);
      assert.equal(switchBar(495, 7.5, 20), WEIGHT_DIAL_MAX_KG);
      // Everything under the ceiling moves by the difference, as before.
      assert.equal(switchBar(100, 20, 15), 95);
      assert.equal(switchBar(27.5, 7.5, null), 20);
      assert.equal(switchBar(5, 20, null), 0);
    },
  },
  {
    name: 'break round: the store and the player share one rule for a loggable set',
    run() {
      const exercise = createExercise();
      const pending = (draftLoadText, draftRepsText) =>
        createSet({ status: 'pending', draftLoadText, draftRepsText, actualReps: null, actualLoadKg: null });
      assert.equal(canCompleteSet(exercise, pending('100', '8'), 'kg'), true);
      assert.equal(canCompleteSet(exercise, pending('500', '8'), 'kg'), true);
      // What the bar tap used to produce: refused, so the player must not cheer.
      assert.equal(canCompleteSet(exercise, pending('520', '8'), 'kg'), false);
      assert.equal(canCompleteSet(exercise, pending('100', '0'), 'kg'), false);
      assert.equal(canCompleteSet(exercise, pending('100', ''), 'kg'), false);
      // An interval bout logs no load, and is still a set.
      const interval = createExercise({ exerciseName: 'Treadmill Intervals (30s on / 30s off)', trackingMode: 'reps_first' });
      const intervalSet = createSet({ status: 'pending', draftLoadText: '', draftRepsText: '30', plannedLoadKg: undefined });
      assert.equal(canCompleteSet(interval, intervalSet, 'kg'), true);

      // The reducer asks the same function rather than a copy of its rules.
      const reducer = strip(read('src', 'features', 'workout', 'workoutState.ts'));
      const complete = reducer.slice(reducer.indexOf("case 'set/complete': {"), reducer.indexOf("set.status = 'completed';"));
      assert.match(complete, /!canCompleteSet\(exercise, set, action\.payload\.unitPreference\)/);
      assert.doesNotMatch(complete, /isLiftableWeight/);
    },
  },
  {
    name: 'break round: a name the reader typed is shown as typed, and only while it is still the name',
    run() {
      const typed = { id: 's2', name: 'Päivä 2' };
      // The app's own placeholder reads as a positional workout…
      assert.equal(formatPlanSessionTitle(typed, 1, 'My plan', 'fi'), 'Treeni 2');
      // …and the reader's own words as they wrote them.
      assert.equal(formatPlanSessionTitle(typed, 1, 'My plan', 'fi', true), 'Päivä 2');
      assert.equal(formatPlanSessionTitle({ name: 'Workout B' }, 4, 'My plan', 'en', true), 'Workout B');
      assert.equal(formatPlanSessionTitle({ name: 'Päivä 1: Jalat' }, 0, 'My plan', 'fi', true), 'Päivä 1: Jalat');
      // Not through the display label either, which reads a one-letter name as "Workout".
      assert.equal(formatPlanSessionTitle({ name: 'A' }, 0, 'My plan', 'en', true), 'A');

      assert.equal(isReaderNamedSession({ s2: 'Päivä 2' }, typed), true);
      assert.equal(isReaderNamedSession({ s2: '  Päivä   2 ' }, typed), true, 'whitespace the store trims');
      // Renamed since by something else: the usual rule again.
      assert.equal(isReaderNamedSession({ s2: 'Päivä 2' }, { id: 's2', name: 'Workout B' }), false);
      assert.equal(isReaderNamedSession({}, typed), false);
      assert.equal(isReaderNamedSession(undefined, typed), false);
    },
  },
  {
    name: 'break round: the stored reader names load defensively on an old install',
    run() {
      const fake = createFakeAsyncStorage();
      const { normalizeDatabase } = loadAgainstFake(fake, (requireDist) => requireDist('storage/database.js'));
      assert.deepEqual(normalizeDatabase({ preferences: {} }).preferences.readerSessionNames, {});
      assert.deepEqual(normalizeDatabase({ preferences: { readerSessionNames: null } }).preferences.readerSessionNames, {});
      assert.deepEqual(normalizeDatabase({ preferences: { readerSessionNames: ['x'] } }).preferences.readerSessionNames, {});
      assert.deepEqual(
        normalizeDatabase({ preferences: { readerSessionNames: { s1: 'Jalat', s2: 7, '': 'x', s3: '' } } }).preferences
          .readerSessionNames,
        { s1: 'Jalat' },
      );
    },
  },
  {
    name: 'break round: the day page pen opens on the stored name and records what was typed',
    run() {
      const day = strip(read('src', 'screens', 'ProgramDayScreen.tsx'));
      // Seeded from the stored name, never the title as shown (a translation
      // or a placeholder), which saving turned into the name for good.
      assert.match(day, /onPress=\{\(\) => setNameDraft\(session\.name\)\}/);
      assert.doesNotMatch(day, /setNameDraft\(dayTitle\)/);
      assert.match(day, /trimmed && trimmed !== session\.name\.trim\(\)/);

      const app = strip(read('App.tsx'));
      const rename = app.slice(app.indexOf('async function handleRenameProgramSession('));
      const body = rename.slice(0, rename.indexOf('\n  }\n'));
      // Remembered only after the stored name changed.
      assert.match(body, /if \(!result\.saved\) \{\s*return;\s*\}/);
      // A failed save is said and stops there; the name is remembered in a
      // write of its own after it, whose failure is not told as a failed
      // rename — the name is already stored by then (review, 2026-09-28).
      assert.match(
        body,
        /showToast\(t\(preferences\.appLanguage, 'toast\.planSaveFailed'\)\);\s*return;\s*\}\s*try \{\s*await updatePreferences\(\(current\) => \(\{\s*readerSessionNames: \{ \.\.\.current\.readerSessionNames, \[sessionId\]: trimmed \},\s*\}\)\);\s*\} catch \(error\) \{\s*console\.error\(/,
      );
      assert.ok(body.indexOf('editWorkoutTemplateSessions(') < body.indexOf('readerSessionNames'));
    },
  },
];
