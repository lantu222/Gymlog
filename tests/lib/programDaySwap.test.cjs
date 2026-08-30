const assert = require('node:assert/strict');

const {
  buildDaySwapCandidates,
  buildSwappedDayExercises,
  daySwapMuscleOptions,
  filterDaySwapCandidates,
  summariseSessionMuscles,
} = require('../../.test-dist/lib/programDaySwap.js');
const { applyProgramSessionEdit } = require('../../.test-dist/lib/programSessionEdit.js');
const { WORKOUT_TEMPLATES_V1 } = require('../../.test-dist/features/workout/workoutCatalog.js');

const LIBRARY = [
  { name: 'Barbell Bench Press', bodyPart: 'chest' },
  { name: 'Barbell Row', bodyPart: 'back' },
];

module.exports = [
  {
    name: 'day swap: the muscle summary agrees with the completion screen',
    run() {
      // The library wins on an exact name; everything else falls back to the
      // same inference the summary screen uses. If these two disagreed, a
      // reader would pick a chest day and be shown a back one afterwards.
      const muscles = summariseSessionMuscles(
        ['Barbell Bench Press', 'Incline Dumbbell Press', 'Cable Crossover', 'Plank'],
        LIBRARY,
      );
      assert.equal(muscles[0], 'chest', 'three presses and a plank is a chest day');
      assert.ok(muscles.includes('core'));

      // "Chest-Supported Row" is the trap: it says chest and trains back.
      assert.deepEqual(summariseSessionMuscles(['Chest-Supported Row'], []), ['back']);

      // Unclassifiable lifts drop out rather than becoming a group called
      // "other" that the reader would then be offered as a filter.
      assert.deepEqual(summariseSessionMuscles(['Sled Push'], []), []);
    },
  },
  {
    name: 'day swap: candidates are real catalogue days, never the day itself',
    run() {
      const anySession = WORKOUT_TEMPLATES_V1[0].sessions[0];
      const candidates = buildDaySwapCandidates(anySession.id, LIBRARY);

      assert.ok(candidates.length > 50, 'the catalogue should offer plenty to swap to');
      assert.ok(
        !candidates.some((candidate) => candidate.sessionId === anySession.id),
        'the day being replaced must not be offered as its own replacement',
      );

      // Every candidate is a day someone wrote, with its programme named — the
      // reader is choosing provenance, not a generated block.
      for (const candidate of candidates) {
        const template = WORKOUT_TEMPLATES_V1.find((entry) => entry.id === candidate.templateId);
        assert.ok(template, `${candidate.templateId} is not in the catalogue`);
        assert.ok(template.sessions.some((entry) => entry.id === candidate.sessionId));
        assert.ok(candidate.exerciseCount > 0, 'an empty day is not a replacement');
        assert.ok(candidate.setCount > 0);
      }
    },
  },
  {
    name: 'day swap: the ask that started this can actually be answered',
    run() {
      // "haluan rinta%vatsat treenit myös mukaan" — so a chest day and a core
      // day both have to be findable, or the feature does not answer its own
      // request.
      const candidates = buildDaySwapCandidates('nothing', LIBRARY);
      const options = daySwapMuscleOptions(candidates);
      assert.ok(options.includes('chest'), 'the catalogue must offer a chest day');
      assert.ok(options.includes('core'), 'the catalogue must offer a core day');

      const chest = filterDaySwapCandidates(candidates, 'chest');
      assert.ok(chest.length > 0);
      for (const candidate of chest) {
        assert.ok(candidate.muscles.includes('chest'));
      }

      // No filter means everything, not nothing.
      assert.equal(filterDaySwapCandidates(candidates, null).length, candidates.length);
    },
  },
  {
    name: 'day swap: the replacement lands in the target day, with new ids',
    run() {
      const candidates = buildDaySwapCandidates('nothing', LIBRARY);
      const pick = candidates.find((candidate) => candidate.exerciseCount >= 3);
      assert.ok(pick, 'need a candidate with a few exercises');

      const exercises = buildSwappedDayExercises(pick, 'day_target', () => null);
      assert.equal(exercises.length, pick.exerciseCount);

      // Ids are rebuilt into the target day. Carrying the catalogue's ids over
      // would let two days in one programme hold the same exercise id, which
      // works right up until the reader edits one and both change.
      for (const exercise of exercises) {
        assert.match(exercise.id, /^day_target_swap_\d+$/);
        assert.ok(exercise.targetSets > 0);
        assert.ok(exercise.repMax >= exercise.repMin);
      }
      assert.equal(new Set(exercises.map((entry) => entry.id)).size, exercises.length);

      // A candidate that is not in the catalogue yields nothing rather than
      // throwing: this runs behind a sheet the reader can leave open.
      assert.deepEqual(
        buildSwappedDayExercises({ templateId: 'nope', sessionId: 'nope' }, 'day_target', () => null),
        [],
      );
    },
  },
  {
    name: 'replaceDay: the day changes name and contents, the programme does not',
    run() {
      const sessions = [
        {
          id: 'day_1',
          name: 'Day 1: Legs',
          exercises: [
            { id: 'a', name: 'Back Squat', targetSets: 4, repMin: 5, repMax: 5, restSeconds: 120, trackedDefault: true },
          ],
        },
        {
          id: 'day_2',
          name: 'Day 2: Back',
          exercises: [
            { id: 'b', name: 'Barbell Row', targetSets: 3, repMin: 8, repMax: 10, restSeconds: 90, trackedDefault: true },
          ],
        },
      ];

      const result = applyProgramSessionEdit(sessions, 'day_1', {
        kind: 'replaceDay',
        name: 'Day 1: Chest',
        exercises: [
          { id: 'day_1_swap_1', name: 'Barbell Bench Press', targetSets: 4, repMin: 8, repMax: 10, restSeconds: 120, trackedDefault: true },
          { id: 'day_1_swap_2', name: 'Plank', targetSets: 3, repMin: 30, repMax: 45, restSeconds: 60, trackedDefault: false },
        ],
      });

      assert.equal(result.kind, 'save');
      const [first, second] = result.sessions;

      // The name travels with the exercises. A day whose contents became chest
      // while its heading still said Legs would be the worst of both.
      assert.equal(first.name, 'Day 1: Chest');
      assert.deepEqual(first.exercises.map((entry) => entry.name), ['Barbell Bench Press', 'Plank']);

      // And every other day is carried through untouched, because the template
      // is stored whole: writing one day without the rest deletes the rest.
      assert.equal(second.name, 'Day 2: Back');
      assert.deepEqual(second.exercises.map((entry) => entry.name), ['Barbell Row']);
    },
  },
  {
    name: 'replaceDay: an empty replacement is refused in its own words',
    run() {
      const sessions = [
        {
          id: 'day_1',
          name: 'Day 1',
          exercises: [
            { id: 'a', name: 'Back Squat', targetSets: 4, repMin: 5, repMax: 5, restSeconds: 120, trackedDefault: true },
          ],
        },
      ];
      const result = applyProgramSessionEdit(sessions, 'day_1', {
        kind: 'replaceDay',
        name: 'Day 1: Nothing',
        exercises: [],
      });
      // Caught before the rebuild, so the reason names the action taken rather
      // than reporting it as the last exercise being removed — a true sentence
      // about a different thing.
      assert.equal(result.kind, 'skip');
      assert.equal(result.reason, 'lastExerciseInDay');
    },
  },
];
