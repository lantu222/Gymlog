const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { GENERATED_EXERCISE_LIBRARY } = require('../../.test-dist/data/generatedExerciseLibrary.js');
const { WORKOUT_TEMPLATES_V1 } = require('../../.test-dist/features/workout/workoutCatalog.js');
const { isUnloadedTrackingMode } = require('../../.test-dist/features/workout/workoutTypes.js');
const { adaptLegacyWorkoutTemplateToRuntimeTemplate } = require('../../.test-dist/features/workout/customWorkoutAdapter.js');
const {
  FOCUS_ACCESSORY_POOL,
  SUPPLEMENTAL_DAY_POOL,
  getCatalogTrackingMode,
} = require('../../.test-dist/lib/catalogExercisePools.js');

const root = path.join(__dirname, '..', '..');
const { overrides } = JSON.parse(
  fs.readFileSync(path.join(root, 'scripts', 'exercise-equipment-overrides.json'), 'utf8'),
);

/**
 * A loaded lift is not bodyweight (2026-09-21).
 *
 * The library generator turned every equipment value it did not know into
 * "bodyweight", and the source files trap bars, farmer's walks, sleds and
 * plates under "other". Bodyweight is what decides the weight dial in the
 * reader's own programme, the Bodyweight filter chip and a no-equipment coach
 * plan, so a trap bar deadlift in your own programme saved 0 kg. Two ready
 * programme rows had the same mistake by hand: weighted pull-ups and dips.
 */
module.exports = [
  {
    name: 'library equipment: every loaded lift the source calls "other" is filed where its load is',
    run() {
      const byName = new Map(GENERATED_EXERCISE_LIBRARY.map((item) => [item.name, item]));
      const wrong = Object.entries(overrides)
        .filter(([name, bucket]) => byName.get(name)?.equipment !== bucket)
        .map(([name, bucket]) => `${name}: ${byName.get(name)?.equipment ?? 'missing'} (want ${bucket})`);
      assert.deepEqual(wrong, [], 'the generated library and scripts/exercise-equipment-overrides.json disagree');

      // And the next sync keeps them: the generator reads the same file.
      const generator = fs.readFileSync(path.join(root, 'scripts', 'generate_free_exercise_library.mjs'), 'utf8');
      assert.match(generator, /scripts\/exercise-equipment-overrides\.json/);
      assert.match(generator, /equipment: EQUIPMENT_OVERRIDES\[name\] \?\? mapEquipment\(entry\.equipment\)/);
    },
  },
  {
    name: 'library equipment: a trap bar deadlift or a farmer\'s walk in your own programme asks for the weight',
    run() {
      const exercise = (id, name, orderIndex) => ({
        id,
        workoutTemplateId: 'wt_mine',
        workoutTemplateSessionId: 'wts_day1',
        name,
        targetSets: 3,
        repMin: 5,
        repMax: 8,
        restSeconds: 120,
        trackedDefault: true,
        orderIndex,
        libraryItemId: null,
      });
      const runtime = adaptLegacyWorkoutTemplateToRuntimeTemplate(
        { id: 'wt_mine', name: 'Mine', exerciseIds: [], sessions: [], createdAt: '', updatedAt: '' },
        [
          {
            id: 'wts_day1',
            workoutTemplateId: 'wt_mine',
            name: 'Day 1',
            orderIndex: 0,
            exercises: [
              exercise('ex_trap', 'Trap Bar Deadlift', 0),
              exercise('ex_farmer', "Farmer's Walk", 1),
              exercise('ex_sled', 'Sled Push', 2),
              exercise('ex_pushup', 'Pushups', 3),
            ],
          },
        ],
        GENERATED_EXERCISE_LIBRARY,
        90,
      );
      const modes = Object.fromEntries(
        runtime.sessions[0].exercises.map((item) => [item.exerciseName, item.trackingMode]),
      );
      assert.equal(modes['Trap Bar Deadlift'], 'load_and_reps');
      assert.equal(modes["Farmer's Walk"], 'load_and_reps');
      assert.equal(modes['Sled Push'], 'load_and_reps');
      // Bodyweight work stays bodyweight: the fix names lifts, it does not
      // flip the fallback.
      assert.equal(modes.Pushups, 'bodyweight');

      assert.equal(getCatalogTrackingMode('Trap Bar Deadlift'), 'load_and_reps');
      assert.equal(getCatalogTrackingMode("Farmer's Walk"), 'load_and_reps');
    },
  },
  {
    name: 'library equipment: the ready programmes log a weighted pull-up and a weighted dip with the weight',
    run() {
      const unloaded = [];
      for (const template of WORKOUT_TEMPLATES_V1) {
        for (const session of template.sessions) {
          for (const exercise of session.exercises) {
            if (/^weighted\b/i.test(exercise.exerciseName) && isUnloadedTrackingMode(exercise.trackingMode)) {
              unloaded.push(`${template.id} / ${exercise.id}: ${exercise.exerciseName} (${exercise.trackingMode})`);
            }
          }
        }
      }
      assert.deepEqual(unloaded, [], 'a weighted lift with no weight dial saves 0 kg');
    },
  },
  {
    name: 'library equipment: a plan for someone with no equipment asks for no weight',
    run() {
      // The composer's bodyweight pools are what a reader with no equipment is
      // given. The recovery day's farmer's walk got in because the library
      // called it bodyweight.
      const loaded = [];
      for (const [label, pools] of [
        ['focus', FOCUS_ACCESSORY_POOL],
        ['supplemental', SUPPLEMENTAL_DAY_POOL],
      ]) {
        for (const [kind, pool] of Object.entries(pools)) {
          for (const name of pool.bodyweight) {
            if (getCatalogTrackingMode(name) === 'load_and_reps') {
              loaded.push(`${label}.${kind}: ${name}`);
            }
          }
        }
      }
      assert.deepEqual(loaded, []);
    },
  },
];
