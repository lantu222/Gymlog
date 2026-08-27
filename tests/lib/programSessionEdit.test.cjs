const assert = require('node:assert/strict');

const { applyProgramSessionEdit } = require('../../.test-dist/lib/programSessionEdit');
const { readAppWiring } = require('../helpers/appWiringSource.cjs');

function lift(id, name, overrides = {}) {
  return {
    id,
    name,
    targetSets: 3,
    repMin: 8,
    repMax: 12,
    restSeconds: 90,
    trackedDefault: true,
    libraryItemId: `lib_${id}`,
    ...overrides,
  };
}

function programme() {
  return [
    { id: 'day_1', name: 'Glutes', exercises: [lift('e1', 'Hip Thrust'), lift('e2', 'Sumo Deadlift')] },
    { id: 'day_2', name: 'Chest', exercises: [lift('e3', 'Bench Press')] },
  ];
}

module.exports = [
  {
    name: 'removing a lift touches only its own day',
    run() {
      const result = applyProgramSessionEdit(programme(), 'day_1', { kind: 'remove', exerciseId: 'e1' });
      assert.equal(result.kind, 'save');
      assert.deepEqual(
        result.sessions.map((session) => session.exercises.map((exercise) => exercise.name)),
        [['Sumo Deadlift'], ['Bench Press']],
      );
    },
  },
  {
    name: 'emptying a day is refused rather than saved',
    run() {
      const result = applyProgramSessionEdit(programme(), 'day_2', { kind: 'remove', exerciseId: 'e3' });
      assert.equal(result.kind, 'skip');
      assert.equal(result.reason, 'lastExerciseInDay');
    },
  },
  {
    name: 'a swap changes the lift and its library row, never the prescription',
    run() {
      const result = applyProgramSessionEdit(programme(), 'day_1', {
        kind: 'replace',
        exerciseId: 'e2',
        exerciseName: 'Trap Bar Deadlift',
        libraryItemId: 'lib_trap',
      });
      assert.equal(result.kind, 'save');
      const swapped = result.sessions[0].exercises[1];
      assert.equal(swapped.name, 'Trap Bar Deadlift');
      assert.equal(swapped.libraryItemId, 'lib_trap');
      // The dose is the programme's, not the lift's.
      assert.equal(swapped.targetSets, 3);
      assert.equal(swapped.repMin, 8);
      assert.equal(swapped.repMax, 12);
      assert.equal(swapped.restSeconds, 90);
      // The day it was not on is untouched.
      assert.deepEqual(result.sessions[1].exercises.map((exercise) => exercise.name), ['Bench Press']);
    },
  },
  {
    name: 'added lifts land at the end of the day they were added from',
    run() {
      const result = applyProgramSessionEdit(programme(), 'day_2', {
        kind: 'add',
        exercises: [lift('e4', 'Incline Press'), lift('e5', 'Cable Fly')],
      });
      assert.equal(result.kind, 'save');
      assert.deepEqual(
        result.sessions.map((session) => session.exercises.map((exercise) => exercise.name)),
        [
          ['Hip Thrust', 'Sumo Deadlift'],
          ['Bench Press', 'Incline Press', 'Cable Fly'],
        ],
      );
    },
  },
  {
    /**
     * The morning of 2026-08-27: lifts were added, and then they were gone.
     * Each edit rebuilt the whole programme from the screen's copy of it, so a
     * second edit that started before the first had been painted wrote the
     * first one out of existence. Edits have to compose.
     */
    name: 'a second edit builds on the first instead of replacing it',
    run() {
      const first = applyProgramSessionEdit(programme(), 'day_2', {
        kind: 'add',
        exercises: [lift('e4', 'Incline Press')],
      });
      assert.equal(first.kind, 'save');
      const second = applyProgramSessionEdit(first.sessions, 'day_2', {
        kind: 'add',
        exercises: [lift('e5', 'Cable Fly')],
      });
      assert.equal(second.kind, 'save');
      assert.deepEqual(second.sessions[1].exercises.map((exercise) => exercise.name), [
        'Bench Press',
        'Incline Press',
        'Cable Fly',
      ]);
    },
  },
  {
    /**
     * The composing above is only worth anything if the app hands it fresh
     * days. Reading them from the rendered state is exactly the bug: the read
     * has to happen inside the write, which is what editWorkoutTemplateSessions
     * is for. This pins the three handlers that change a stored programme onto
     * it, so the next one written cannot quietly go back to the old shape.
     */
    name: 'programme edits go through the provider, not through render state',
    run() {
      const source = readAppWiring();
      for (const handler of [
        'handleEditProgramExercise',
        'handleSaveEmphasis',
        'handleRenameActivePlanSession',
      ]) {
        const start = source.indexOf(`function ${handler}(`);
        assert.ok(start > -1, `${handler} should still exist`);
        const body = source.slice(start, start + 2600);
        assert.ok(
          body.includes('editWorkoutTemplateSessions('),
          `${handler} must edit a stored programme through editWorkoutTemplateSessions`,
        );
        assert.ok(
          !body.includes('getWorkoutTemplateSessions('),
          `${handler} must not rebuild a programme from rendered state — that is the lost-exercise bug`,
        );
      }
    },
  },
];
