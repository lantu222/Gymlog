const assert = require('node:assert/strict');

const {
  workoutReducer,
  workoutInitialState,
} = require('../../../.test-dist/features/workout/workoutState.js');
const { createCompletedSession, createExercise, createSet } = require('../../helpers/workoutFixtures.cjs');

const NOW = Date.parse('2026-03-19T10:10:00.000Z');

function pendingSet(setIndex) {
  return createSet({
    setIndex,
    status: 'pending',
    actualLoadKg: undefined,
    actualReps: undefined,
    completedAt: undefined,
    edited: false,
  });
}

/** Two lifts, two sets each, paired or not depending on `supersetGroup`. */
function session(supersetGroup) {
  return createCompletedSession({
    status: 'active',
    completedAt: undefined,
    exercises: [
      createExercise({
        slotId: 'a',
        exerciseName: 'Bench Press',
        restSecondsMin: 120,
        orderIndex: 0,
        status: 'pending',
        supersetGroup,
        sets: [pendingSet(0), pendingSet(1)],
      }),
      createExercise({
        slotId: 'b',
        exerciseName: 'Barbell Row',
        restSecondsMin: 45,
        orderIndex: 1,
        status: 'pending',
        supersetGroup,
        sets: [pendingSet(0), pendingSet(1)],
      }),
    ],
  });
}

function logSet(state, slotId, setIndex) {
  return workoutReducer(state, {
    type: 'set/complete',
    payload: { slotId, setIndex, nowMs: NOW, unitPreference: 'kg' },
  });
}

function start(supersetGroup) {
  return { ...workoutInitialState, activeSession: session(supersetGroup), nowMs: NOW };
}

module.exports = [
  {
    name: 'logging A1 opens A2 rather than the next set of A1',
    run() {
      const after = logSet(start('g1'), 'a', 0);
      assert.equal(after.activeSession.ui.activeSlotId, 'b');
      assert.equal(after.activeSession.ui.activeSetIndex, 0);
    },
  },
  {
    name: 'no rest runs between the lifts of a superset',
    run() {
      const after = logSet(start('g1'), 'a', 0);
      assert.equal(after.activeSession.restTimer.status, 'idle');
    },
  },
  {
    name: 'the rest comes after the round, and is the longer lift’s',
    run() {
      const after = logSet(logSet(start('g1'), 'a', 0), 'b', 0);
      assert.equal(after.activeSession.restTimer.status, 'running');
      // 120 from the bench, not 45 from the row: a squat paired with a curl is
      // still a squat.
      assert.equal(after.activeSession.restTimer.durationSeconds, 120);
      assert.equal(after.activeSession.ui.activeSlotId, 'a');
      assert.equal(after.activeSession.ui.activeSetIndex, 1);
    },
  },
  {
    name: 'unpaired lifts still run one at a time, with a rest between sets',
    run() {
      const after = logSet(start(null), 'a', 0);
      assert.equal(after.activeSession.ui.activeSlotId, 'a');
      assert.equal(after.activeSession.ui.activeSetIndex, 1);
      assert.equal(after.activeSession.restTimer.status, 'running');
      assert.equal(after.activeSession.restTimer.durationSeconds, 120);
    },
  },
  {
    /**
     * A block is counted in rounds, so a round is added to every lift in it —
     * "yksi sarjan lisäys tarkoittaa että molemmat nousee yhden" (user
     * 2026-09-11). Adding to one half would put the pair back into the state
     * linking exists to prevent.
     */
    name: 'adding a set to a superset adds a round to every lift in it',
    run() {
      const after = workoutReducer(start('g1'), { type: 'exercise/addSet', payload: { slotId: 'a' } });
      assert.deepEqual(
        after.activeSession.exercises.map((exercise) => exercise.sets.length),
        [3, 3],
      );
    },
  },
  {
    name: 'an unpaired lift still gains a set on its own',
    run() {
      const after = workoutReducer(start(null), { type: 'exercise/addSet', payload: { slotId: 'a' } });
      assert.deepEqual(
        after.activeSession.exercises.map((exercise) => exercise.sets.length),
        [3, 2],
      );
    },
  },
  {
    name: 'taking a set back takes it off every lift in the block',
    run() {
      const after = workoutReducer(start('g1'), { type: 'exercise/removeSet', payload: { slotId: 'a' } });
      assert.deepEqual(
        after.activeSession.exercises.map((exercise) => exercise.sets.length),
        [1, 1],
      );
    },
  },
  {
    name: 'a block whose other half has a logged last set keeps its rounds',
    run() {
      // All or none: taking the round back here would either lose the logged
      // set or leave the two halves disagreeing again.
      let state = logSet(start('g1'), 'a', 0);
      state = logSet(state, 'b', 0);
      state = logSet(state, 'a', 1);
      state = logSet(state, 'b', 1);
      const after = workoutReducer(state, { type: 'exercise/removeSet', payload: { slotId: 'a' } });
      assert.deepEqual(
        after.activeSession.exercises.map((exercise) => exercise.sets.length),
        [2, 2],
      );
    },
  },
  {
    name: 'the last set of the last lift ends the session without a rest',
    run() {
      let state = start('g1');
      state = logSet(state, 'a', 0);
      state = logSet(state, 'b', 0);
      state = logSet(state, 'a', 1);
      state = logSet(state, 'b', 1);
      assert.equal(state.activeSession.restTimer.status, 'idle');
    },
  },
];
