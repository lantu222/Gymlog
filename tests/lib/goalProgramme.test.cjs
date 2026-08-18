const assert = require('node:assert/strict');

const {
  describeGoalCoverage,
  isSameLift,
  matchProgrammeToLift,
  rankProgrammesForLift,
} = require('../../.test-dist/lib/goalProgramme.js');
const { STRENGTH_GOAL_PRESETS } = require('../../.test-dist/lib/strengthGoalPresets.js');
const { WORKOUT_TEMPLATES_V1 } = require('../../.test-dist/features/workout/workoutCatalog.js');
const library = Object.values(require('../../.test-dist/data/generatedExerciseLibrary.js'))[0];
const libraryNames = library.map((item) => item.name);

const goal = (exerciseName) => ({ exerciseName, targetKg: 100, createdAt: '2026-08-18T00:00:00.000Z' });

module.exports = [
  {
    name: 'a lift is the same lift by canonical name, and by library alias when a library is given',
    run() {
      assert.equal(isSameLift('Bench Press', 'bench press'), true);
      assert.equal(isSameLift('Bench Press', 'Overhead Press'), false);
      // A custom programme may carry the library variant of the same lift.
      assert.equal(isSameLift('Back Squat', 'Barbell Full Squat', libraryNames), true);
      assert.equal(isSameLift('Back Squat', 'Barbell Full Squat'), false, 'without a library only the name counts');
    },
  },
  {
    name: 'a programme matches a lift with how central the lift is there',
    run() {
      const programme = {
        id: 'p',
        sessions: [
          { exercises: [{ exerciseName: 'Bench Press', role: 'primary' }, { exerciseName: 'Lat Pulldown', role: 'accessory' }] },
          { exercises: [{ exerciseName: 'Back Squat', role: 'primary' }] },
          { exercises: [{ exerciseName: 'Bench Press', role: 'accessory' }] },
        ],
      };
      assert.deepEqual(matchProgrammeToLift(programme, 'Bench Press'), { id: 'p', sessionCount: 2, primary: true });
      assert.deepEqual(matchProgrammeToLift(programme, 'Lat Pulldown'), { id: 'p', sessionCount: 1, primary: false });
      assert.equal(matchProgrammeToLift(programme, 'Overhead Press'), null);
    },
  },
  {
    name: 'ranking puts the lift-as-main-lift first, then more sessions, then the caller order',
    run() {
      const accessoryOnly = { id: 'acc', sessions: [{ exercises: [{ exerciseName: 'Bench Press', role: 'accessory' }] }] };
      const primaryOnce = { id: 'once', sessions: [{ exercises: [{ exerciseName: 'Bench Press', role: 'primary' }] }] };
      const primaryTwice = {
        id: 'twice',
        sessions: [
          { exercises: [{ exerciseName: 'Bench Press', role: 'primary' }] },
          { exercises: [{ exerciseName: 'Bench Press', role: 'primary' }] },
        ],
      };
      const primaryTwiceB = { ...primaryTwice, id: 'twiceB' };
      const none = { id: 'none', sessions: [{ exercises: [{ exerciseName: 'Back Squat', role: 'primary' }] }] };
      const ranked = rankProgrammesForLift([accessoryOnly, primaryOnce, primaryTwice, primaryTwiceB, none], 'Bench Press', {
        preferredOrder: ['twiceB'],
      });
      assert.deepEqual(
        ranked.map((match) => match.id),
        ['twiceB', 'twice', 'once', 'acc'],
      );
    },
  },
  {
    name: 'every goal preset has a ready programme that trains its lift as a main lift',
    run() {
      // The rule is "a goal always has a programme". The catalog spells the
      // deadlift "Deadlift" where the preset says "Barbell Deadlift" — the
      // library alias matcher is what makes those the same lift, which is why
      // ranking is given the library names. Without them the deadlift goal
      // would honestly, and wrongly, report no programme.
      for (const preset of STRENGTH_GOAL_PRESETS) {
        const lift = preset.exerciseName;
        const ranked = rankProgrammesForLift(WORKOUT_TEMPLATES_V1, lift, { libraryNames });
        assert.ok(ranked.length > 0, `${lift}: no ready programme`);
        assert.ok(ranked[0].primary, `${lift}: best programme should train it as a main lift, got ${ranked[0].id}`);
      }
      assert.deepEqual(rankProgrammesForLift(WORKOUT_TEMPLATES_V1, 'Barbell Deadlift'), [], 'name-only match misses the catalog spelling');
    },
  },
  {
    name: 'coverage tells covered, uncovered and no-programme apart',
    run() {
      const bench = { id: 'b', sessions: [{ exercises: [{ exerciseName: 'Bench Press', role: 'primary' }] }] };
      assert.deepEqual(describeGoalCoverage(goal('Bench Press'), []), {
        goal: goal('Bench Press'),
        status: 'noProgramme',
        coveredBy: null,
      });
      assert.equal(describeGoalCoverage(goal('Bench Press'), [bench]).status, 'covered');
      assert.equal(describeGoalCoverage(goal('Bench Press'), [bench]).coveredBy, 'b');
      assert.equal(describeGoalCoverage(goal('Back Squat'), [bench]).status, 'uncovered');
    },
  },
];
