const assert = require('node:assert/strict');

const { applyProgramSessionEdit } = require('../../.test-dist/lib/programSessionEdit');
const { estimateSessionSeconds } = require('../../.test-dist/lib/sessionDuration');
const { freestyleRestSecondsForTick } = require('../../.test-dist/lib/emptyWorkoutSession');

function idFactory() {
  let next = 0;
  return () => {
    next += 1;
    return `g${next}`;
  };
}

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
    supersetGroup: null,
    ...overrides,
  };
}

function day(...exercises) {
  return [{ id: 'day_1', name: 'Upper', exercises }];
}

function groupsOf(result) {
  return result.sessions[0].exercises.map((exercise) => exercise.supersetGroup ?? null);
}

function freestyleLift(localKey, overrides = {}) {
  return {
    localKey,
    name: localKey,
    libraryItemId: null,
    imageUrl: null,
    repMin: 8,
    repMax: 12,
    restSeconds: 90,
    trackedDefault: true,
    supersetGroup: null,
    sets: [{ localKey: `${localKey}_s1`, kg: '60', reps: '8', done: false }],
    ...overrides,
  };
}

module.exports = [
  {
    name: 'the day view pairs a lift with the one below it',
    run() {
      const result = applyProgramSessionEdit(
        day(lift('e1', 'Bench Press'), lift('e2', 'Barbell Row')),
        'day_1',
        { kind: 'supersetLink', exerciseId: 'e1', linked: true },
        idFactory(),
      );
      assert.equal(result.kind, 'save');
      assert.deepEqual(groupsOf(result), ['g1', 'g1']);
    },
  },
  {
    name: 'the bottom lift of a day has nothing below it to run into',
    run() {
      const result = applyProgramSessionEdit(
        day(lift('e1', 'Bench Press'), lift('e2', 'Barbell Row')),
        'day_1',
        { kind: 'supersetLink', exerciseId: 'e2', linked: true },
        idFactory(),
      );
      assert.deepEqual(result, { kind: 'skip', reason: 'noRowBelow' });
    },
  },
  {
    name: 'removing one half of a pair ends the pair',
    run() {
      const result = applyProgramSessionEdit(
        day(
          lift('e1', 'Bench Press', { supersetGroup: 'a' }),
          lift('e2', 'Barbell Row', { supersetGroup: 'a' }),
          lift('e3', 'Curl'),
        ),
        'day_1',
        { kind: 'remove', exerciseId: 'e2' },
        idFactory(),
      );
      assert.equal(result.kind, 'save');
      assert.deepEqual(groupsOf(result), [null, null]);
    },
  },
  {
    name: 'dragging a lift out from between a pair does not pair the wrong two',
    run() {
      const result = applyProgramSessionEdit(
        day(
          lift('e1', 'Bench Press', { supersetGroup: 'a' }),
          lift('e2', 'Barbell Row', { supersetGroup: 'a' }),
          lift('e3', 'Curl'),
        ),
        'day_1',
        { kind: 'reorder', exerciseId: 'e3', toIndex: 1 },
        idFactory(),
      );
      assert.equal(result.kind, 'save');
      assert.deepEqual(
        result.sessions[0].exercises.map((exercise) => exercise.id),
        ['e1', 'e3', 'e2'],
      );
      // Bench and Row are no longer next to each other, so they are no longer
      // a superset — and Curl did not inherit the pairing it landed inside.
      assert.deepEqual(groupsOf(result), [null, null, null]);
    },
  },
  {
    name: 'a superset rests once per round, not once per lift',
    run() {
      const paired = estimateSessionSeconds({
        exercises: [
          { sets: 3, reps: 10, restSeconds: 90, supersetGroup: 'a' },
          { sets: 3, reps: 10, restSeconds: 90, supersetGroup: 'a' },
        ],
      });
      const apart = estimateSessionSeconds({
        exercises: [
          { sets: 3, reps: 10, restSeconds: 90 },
          { sets: 3, reps: 10, restSeconds: 90 },
        ],
      });
      // Four rests apart, two rests paired: three minutes of the estimate.
      assert.equal(apart - paired, 2 * 90);
    },
  },
  {
    name: 'a skipped half of a pair leaves the other resting on its own',
    run() {
      const seconds = estimateSessionSeconds({
        exercises: [
          { sets: 3, reps: 10, restSeconds: 90, supersetGroup: 'a' },
          { sets: 3, reps: 10, restSeconds: 90, supersetGroup: 'a', skipped: true },
        ],
      });
      const alone = estimateSessionSeconds({ exercises: [{ sets: 3, reps: 10, restSeconds: 90 }] });
      assert.equal(seconds, alone);
    },
  },
  {
    name: 'ticking A1 in a free workout starts no rest',
    run() {
      const exercises = [
        freestyleLift('a', { supersetGroup: 'g1' }),
        freestyleLift('b', { supersetGroup: 'g1' }),
      ];
      assert.equal(freestyleRestSecondsForTick(exercises[0], exercises[0].sets[0], 90, exercises), null);
    },
  },
  {
    name: 'ticking the last lift of the pair rests for the longer of the two',
    run() {
      const exercises = [
        freestyleLift('a', { supersetGroup: 'g1', restSeconds: 150 }),
        freestyleLift('b', { supersetGroup: 'g1', restSeconds: 45 }),
      ];
      assert.equal(freestyleRestSecondsForTick(exercises[1], exercises[1].sets[0], 90, exercises), 150);
    },
  },
  {
    name: 'an unpaired free workout rests exactly as it did before',
    run() {
      const exercises = [freestyleLift('a', { restSeconds: 120 }), freestyleLift('b')];
      assert.equal(freestyleRestSecondsForTick(exercises[0], exercises[0].sets[0], 90, exercises), 120);
    },
  },
  {
    name: 'un-ticking a set inside a superset starts nothing either',
    run() {
      const exercises = [
        freestyleLift('a', { supersetGroup: 'g1', sets: [{ localKey: 'x', kg: '60', reps: '8', done: true }] }),
        freestyleLift('b', { supersetGroup: 'g1' }),
      ];
      assert.equal(freestyleRestSecondsForTick(exercises[0], exercises[0].sets[0], 90, exercises), null);
    },
  },
];
