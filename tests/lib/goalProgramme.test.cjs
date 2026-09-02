const assert = require('node:assert/strict');

const {
  describeGoalCoverage,
  isSameLift,
  matchProgrammeToLift,
  rankProgrammesForLift,
} = require('../../.test-dist/lib/goalProgramme.js');
const { STRENGTH_GOAL_PRESETS } = require('../../.test-dist/lib/strengthGoalPresets.js');
const {
  WORKOUT_TEMPLATES_V1,
  getWorkoutTemplateById,
} = require('../../.test-dist/features/workout/workoutCatalog.js');
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
    /**
     * A strength target gets a strength programme where one exists.
     *
     * rankProgrammesForLift knows nothing about goalType — correctly, it
     * serves the browse surfaces too — so "squat 140 kg" came back as SHRED
     * Elite: a conditioning block that squats on day one and happened to match
     * a five-day reader. Six programmes were tied at one squat day and the
     * fat-loss one won on calendar fit alone. The flow re-sorts by goal before
     * it picks.
     */
    name: 'a strength target is not answered with a conditioning block',
    run() {
      const reader = { level: 'pro', daysPerWeek: 5 };
      for (const lift of ['Barbell Squat', 'Barbell Deadlift', 'Barbell Bench Press - Medium Grip']) {
        const primary = rankProgrammesForLift(WORKOUT_TEMPLATES_V1, lift, {
          libraryNames,
          reader,
        }).filter((match) => match.primary);
        assert.ok(primary.length > 0, `${lift}: nothing trains it as a main lift`);

        // The flow's own choice: strength first, the ranker's order within.
        const chosen =
          primary.find((match) => getWorkoutTemplateById(match.id)?.goalType === 'strength') ??
          primary[0];
        const template = getWorkoutTemplateById(chosen.id);
        assert.equal(
          template.goalType,
          'strength',
          `${lift}: the best answer is ${template.name}, a ${template.goalType} programme`,
        );
      }
    },
  },
  {
    /**
     * "A target always has a programme", with no exceptions.
     *
     * There were two for a day. The front squat's was a naming gap, not a
     * missing programme: the catalog prescribes "Front Squat" in eight weeks
     * and the guided alias resolves that to "Front Barbell Squat", while the
     * preset named "Front Squat (Clean Grip)" — a different library row.
     * The upright row's was real, and it went onto two shoulder days
     * (2026-09-01). Both are covered now, so the rule is unconditional again.
     */
    name: 'every goal preset has a ready programme that trains its lift as a main lift',
    run() {
      const unexpected = [];
      for (const preset of STRENGTH_GOAL_PRESETS) {
        const lift = preset.exerciseName;
        const ranked = rankProgrammesForLift(WORKOUT_TEMPLATES_V1, lift, { libraryNames });
        if (ranked.length === 0 || !ranked[0].primary) {
          unexpected.push(`${lift}: ${ranked.length} programmes, primary=${ranked[0]?.primary ?? false}`);
        }
      }
      assert.deepEqual(unexpected, [], `targets with no main-lift programme: ${unexpected.join(', ')}`);
      // This used to assert the opposite: without the library, "Barbell
      // Deadlift" matched nothing and the goal reported no programme at all.
      // The same-lift groups now carry the five goal lifts on their own, so
      // the deadlift resolves with or without the library — and the library is
      // still what resolves everything outside those five.
      assert.ok(
        rankProgrammesForLift(WORKOUT_TEMPLATES_V1, 'Barbell Deadlift').length > 0,
        'the goal lifts resolve without needing the library',
      );
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

  {
    name: 'the programme suggested for a target is one the reader can actually run',
    run() {
      // Ranked on deadlift sessions alone, everyone was pointed at the six-day
      // advanced split because it pulls twice a week — including a beginner
      // who trains three times.
      const programmes = [
        {
          id: 'six_day_advanced',
          level: 'advanced',
          daysPerWeek: 6,
          sessions: [
            { exercises: [{ exerciseName: 'Deadlift', role: 'primary' }] },
            { exercises: [{ exerciseName: 'Deadlift', role: 'primary' }] },
          ],
        },
        {
          id: 'three_day_beginner',
          level: 'beginner',
          daysPerWeek: 3,
          sessions: [{ exercises: [{ exerciseName: 'Conventional Deadlift', role: 'primary' }] }],
        },
      ];

      assert.equal(
        rankProgrammesForLift(programmes, 'Barbell Deadlift')[0].id,
        'six_day_advanced',
        'without a reader the heaviest dose still wins',
      );
      assert.equal(
        rankProgrammesForLift(programmes, 'Barbell Deadlift', {
          reader: { level: 'beginner', daysPerWeek: 3 },
        })[0].id,
        'three_day_beginner',
      );
      assert.equal(
        rankProgrammesForLift(programmes, 'Barbell Deadlift', {
          reader: { level: 'pro', daysPerWeek: 6 },
        })[0].id,
        'six_day_advanced',
      );
    },
  },
];
