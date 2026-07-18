const assert = require('node:assert/strict');

const {
  applyCautionFlagsToExercises,
  buildCautionSummaryLabel,
  exerciseHitsCautionArea,
} = require('../../.test-dist/lib/cautionExerciseFilter');
const { composeProgramWeekForSelection } = require('../../.test-dist/lib/programDayComposer');
const { DEFAULT_FIRST_RUN_SELECTION } = require('../../.test-dist/lib/firstRunSetup');
const { WORKOUT_TEMPLATES_V1 } = require('../../.test-dist/features/workout/workoutCatalog');

function exercise(name, overrides = {}) {
  return {
    id: `ex_${name.replace(/\W+/g, '_').toLowerCase()}`,
    exerciseName: name,
    slotId: 'slot',
    role: 'primary',
    progressionPriority: 'high',
    trackingMode: 'load_and_reps',
    sets: 3,
    repsMin: 8,
    repsMax: 12,
    restSecondsMin: 60,
    restSecondsMax: 120,
    substitutionGroup: 'none',
    ...overrides,
  };
}

const AREA_LABELS = {
  shoulders: 'Shoulders',
  lower_back: 'Lower back',
  knees: 'Knees',
  elbows: 'Elbows',
  wrists: 'Wrists',
  hips: 'Hips',
  neck: 'Neck',
  ankles: 'Ankles',
};

module.exports = [
  {
    name: 'cautionExerciseFilter: avoid removes every exercise that stresses the area',
    run() {
      const result = applyCautionFlagsToExercises(
        [exercise('Back Squat'), exercise('Reverse Lunge'), exercise('Leg Press'), exercise('Bench Press')],
        [{ area: 'knees', level: 'avoid', refinements: [] }],
      );

      assert.deepEqual(
        result.exercises.map((entry) => entry.exerciseName),
        ['Bench Press'],
      );
      assert.equal(result.removed.length, 3);
      assert.ok(result.removed.every((entry) => entry.area === 'knees'));
    },
  },
  {
    name: 'cautionExerciseFilter: careful swaps to joint-friendly variants and keeps the prescription',
    run() {
      const result = applyCautionFlagsToExercises(
        [exercise('Back Squat', { sets: 4, repsMin: 5, repsMax: 8 }), exercise('Walking Lunge'), exercise('Bench Press')],
        [{ area: 'knees', level: 'careful', refinements: [] }],
      );

      const names = result.exercises.map((entry) => entry.exerciseName);
      assert.deepEqual(names, ['Box Squat', 'Glute Bridge', 'Bench Press']);
      assert.equal(result.exercises[0].sets, 4);
      assert.equal(result.exercises[0].repsMin, 5);
      // Glute Bridge reads as bodyweight work.
      assert.equal(result.exercises[1].trackingMode, 'bodyweight');
      assert.equal(result.swapped.length, 2);
    },
  },
  {
    name: 'cautionExerciseFilter: careful area picked as focus swaps bodyweight-first',
    run() {
      const result = applyCautionFlagsToExercises(
        [exercise('Back Squat'), exercise('Walking Lunge')],
        [{ area: 'knees', level: 'careful', refinements: [] }],
        ['quads'],
      );

      assert.deepEqual(
        result.exercises.map((entry) => entry.exerciseName),
        ['Bodyweight Squat', 'Bodyweight Walking Lunge'],
      );
      assert.ok(result.exercises.every((entry) => entry.trackingMode === 'bodyweight'));
    },
  },
  {
    name: 'cautionExerciseFilter: info flags change nothing and swaps never land on a banned exercise',
    run() {
      const info = applyCautionFlagsToExercises(
        [exercise('Back Squat')],
        [{ area: 'knees', level: 'info', refinements: [] }],
      );
      assert.equal(info.exercises[0].exerciseName, 'Back Squat');
      assert.equal(info.swapped.length, 0);

      // knees careful would swap Leg Press -> Hip Thrust, but hips avoid bans
      // hip thrusts — the original stays rather than swapping into a ban.
      const guarded = applyCautionFlagsToExercises(
        [exercise('Leg Press')],
        [
          { area: 'knees', level: 'careful', refinements: [] },
          { area: 'hips', level: 'avoid', refinements: [] },
        ],
      );
      assert.equal(guarded.exercises[0].exerciseName, 'Leg Press');
    },
  },
  {
    name: 'cautionExerciseFilter: composed week contains no avoided movements end to end',
    run() {
      const template = WORKOUT_TEMPLATES_V1.find((entry) =>
        entry.sessions.some((session) =>
          session.exercises.some((item) => exerciseHitsCautionArea(item.exerciseName, 'knees')),
        ),
      );
      assert.ok(template, 'catalog should contain knee-stressing work');

      const week = composeProgramWeekForSelection(
        {
          ...DEFAULT_FIRST_RUN_SELECTION,
          daysPerWeek: template.daysPerWeek,
          availableDays: [],
          scheduleMode: 'app_managed',
          cautionFlags: [{ area: 'knees', level: 'avoid', refinements: [] }],
        },
        template.id,
      );

      assert.ok(week);
      assert.ok(week.cautionRemoved.length > 0);
      for (const session of week.sessions) {
        for (const item of session.exercises) {
          assert.equal(
            exerciseHitsCautionArea(item.exerciseName, 'knees'),
            false,
            `${item.exerciseName} should not stress avoided knees`,
          );
        }
      }
    },
  },
  {
    name: 'cautionExerciseFilter: summary label lists serious flags only',
    run() {
      assert.equal(
        buildCautionSummaryLabel(
          [
            { area: 'knees', level: 'avoid', refinements: [] },
            { area: 'shoulders', level: 'careful', refinements: [] },
            { area: 'hips', level: 'info', refinements: [] },
          ],
          AREA_LABELS,
        ),
        'Trains around: Knees left out · Shoulders joint-friendly',
      );
      assert.equal(buildCautionSummaryLabel([], AREA_LABELS), null);
    },
  },
];
