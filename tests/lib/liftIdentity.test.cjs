const assert = require('node:assert/strict');

const { isSameLiftByGroup, liftGroupOf, bestForLift } = require('../../.test-dist/lib/liftIdentity.js');
const { isSameLift, rankProgrammesForLift } = require('../../.test-dist/lib/goalProgramme.js');
const { resolveGoalProgress } = require('../../.test-dist/lib/strengthGoals.js');
const { buildGoalPresetRows } = require('../../.test-dist/lib/strengthGoalPresets.js');
const { WORKOUT_TEMPLATES_V1 } = require('../../.test-dist/features/workout/workoutCatalog.js');
const { STRENGTH_GOAL_PRESETS } = require('../../.test-dist/lib/strengthGoalPresets.js');
const library = require('../../.test-dist/data/generatedExerciseLibrary.js');

const libraryNames = library[Object.keys(library).find((key) => Array.isArray(library[key]))].map(
  (entry) => entry.name,
);

module.exports = [
  {
    name: 'a lift is the same lift however the program spelled it',
    run() {
      // The catalog writes the deadlift six ways across its programs; a target
      // names one of them.
      for (const name of [
        'Deadlift',
        'Conventional Deadlift',
        'Competition Deadlift',
        'Sumo Deadlift',
        'Trap Bar Deadlift',
        'Deficit Deadlift',
      ]) {
        assert.equal(isSameLiftByGroup(name, 'Barbell Deadlift'), true, `${name} should be a deadlift`);
      }
      assert.equal(isSameLiftByGroup('Barbell Bench Press', 'Bench Press'), true);
      assert.equal(isSameLiftByGroup('Competition Back Squat', 'Back Squat'), true);
      assert.equal(isSameLiftByGroup('Standing Overhead Press', 'Overhead Press'), true);
      assert.equal(isSameLiftByGroup('Pendlay Row', 'Barbell Row'), true);
    },
  },
  {
    name: 'a movement that is merely nearby is not the lift',
    run() {
      // A Romanian deadlift is a hinge accessory. Filling a deadlift target
      // with it would be the same lie as measuring progress from an estimate.
      for (const name of ['Romanian Deadlift', 'Romanian Deadlift (Light)', 'Single-Leg Romanian Deadlift']) {
        assert.equal(isSameLiftByGroup(name, 'Barbell Deadlift'), false, `${name} is not a deadlift`);
        assert.equal(isSameLift(name, 'Barbell Deadlift', libraryNames), false, `${name} must not match via the library either`);
      }
      assert.equal(isSameLift('Incline Bench Press', 'Bench Press', libraryNames), false);
      assert.equal(isSameLift('Dumbbell Bench Press', 'Bench Press', libraryNames), false);
      assert.equal(isSameLift('Front Squat', 'Back Squat', libraryNames), false);
      assert.equal(isSameLift('Dumbbell Shoulder Press', 'Overhead Press', libraryNames), false);
      assert.equal(isSameLift('Seated Cable Row', 'Barbell Row', libraryNames), false);
    },
  },
  {
    name: 'a name outside every group still falls back to the library',
    run() {
      // The groups only speak for the five lifts a target can name; everything
      // else resolves the way it always did.
      assert.equal(liftGroupOf('Lateral Raise'), null);
      assert.equal(isSameLift('Bench Press', 'bench press'), true);
      assert.equal(isSameLift('Back Squat', 'Barbell Full Squat', libraryNames), true);
    },
  },
  {
    name: 'a target reads the best set logged under any spelling of its lift',
    run() {
      const goals = [{ exerciseName: 'Barbell Deadlift', targetKg: 100, createdAt: '' }];
      const bests = new Map([
        ['Conventional Deadlift', 92.5],
        ['Trap Bar Deadlift', 110],
        ['Romanian Deadlift', 140],
      ]);
      const matches = (logged, lift) => isSameLift(logged, lift, libraryNames);

      // What it used to do: nothing under that exact name, so the bar never moved.
      assert.equal(resolveGoalProgress(goals, bests)[0].currentKg, null);

      const [progress] = resolveGoalProgress(goals, bests, matches);
      // 110, not 140: the heaviest DEADLIFT, not the heaviest hinge.
      assert.equal(progress.currentKg, 110);
      assert.equal(progress.reached, true);

      assert.equal(bestForLift('Barbell Deadlift', new Map(), matches), null);
      assert.equal(
        bestForLift('Barbell Deadlift', new Map([['Romanian Deadlift', 200]]), matches),
        null,
        'a hinge accessory alone leaves the target unstarted',
      );
    },
  },
  {
    name: 'every preset target is trained by a fair share of the catalog',
    run() {
      // The deadlift target saw three programs of fifty-seven while the others
      // saw twenty to thirty — the names, not the training, were the gap.
      const thin = [];
      for (const preset of STRENGTH_GOAL_PRESETS) {
        const count = rankProgrammesForLift(WORKOUT_TEMPLATES_V1, preset.exerciseName, { libraryNames }).length;
        if (count < 10) {
          thin.push(`${preset.exerciseName}: ${count}`);
        }
      }
      assert.deepEqual(thin, [], `targets almost no program trains: ${thin.join(', ')}`);
    },
  },

  {
    name: 'the target picker and the target row read the log the same way',
    run() {
      // They disagreed on the phone: the row showed 70 kg of 200 while the
      // picker behind it said "not logged yet" for the same lift, because one
      // resolved the lift and the other matched the name.
      const bests = new Map([['Barbell Bench Press', 70], ['Conventional Deadlift', 120]]);
      const matches = (logged, lift) => isSameLift(logged, lift, libraryNames);

      const rows = buildGoalPresetRows(bests, [], matches);
      const bench = rows.find((row) => row.exerciseName === 'Bench Press');
      const deadlift = rows.find((row) => row.exerciseName === 'Barbell Deadlift');
      assert.equal(bench.bestKg, 70);
      assert.equal(deadlift.bestKg, 120);
      assert.equal(deadlift.options.find((option) => option.targetKg === 100).alreadyReached, true);
      assert.equal(deadlift.options.find((option) => option.targetKg === 150).alreadyReached, false);

      // And the row for the same log agrees.
      const [progress] = resolveGoalProgress(
        [{ exerciseName: 'Barbell Deadlift', targetKg: 150, createdAt: '' }],
        bests,
        matches,
      );
      assert.equal(progress.currentKg, deadlift.bestKg);
    },
  },
];
