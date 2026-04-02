const assert = require('node:assert/strict');

const {
  completeWorkoutSession,
  workoutReducer,
  workoutInitialState,
} = require('../../../.test-dist/features/workout/workoutState.js');
const { createCompletedSession, createExercise, createSet } = require('../../helpers/workoutFixtures.cjs');

module.exports = [
  {
    name: 'finishWorkout can lock a custom performedAt into the completion summary',
    run() {
      const activeSession = createCompletedSession({
        status: 'active',
        completedAt: undefined,
        ui: {
          activeSlotId: null,
          activeSetIndex: 0,
          focusedField: null,
          noteEditorSlotId: null,
          swapSheetSlotId: null,
          expandedSlotIds: [],
          finishSummaryOpen: false,
        },
      });

      const performedAt = '2026-03-31T10:30:00.000Z';
      const nextState = completeWorkoutSession(
        {
          ...workoutInitialState,
          activeSession,
        },
        performedAt,
      );

      assert.equal(nextState.activeSession.status, 'completed');
      assert.equal(nextState.activeSession.completedAt, performedAt);
      assert.equal(nextState.completionSummary.performedAt, performedAt);
    },
  },
  {
    name: 'discardWorkout clears the active session without creating a completion summary',
    run() {
      const activeSession = createCompletedSession({
        status: 'active',
        completedAt: undefined,
      });

      const nextState = workoutReducer(
        {
          ...workoutInitialState,
          activeSession,
        },
        { type: 'session/discardWorkout' },
      );

      assert.equal(nextState.activeSession, null);
      assert.equal(nextState.completionSummary, null);
      assert.equal(nextState.history.sessions.length, 0);
    },
  },
  {
    name: 'recordSetEffort stores a quick effort read on a completed set',
    run() {
      const activeSession = createCompletedSession({
        status: 'active',
        completedAt: undefined,
        exercises: [
          createExercise({
            sets: [
              createSet({
                setIndex: 0,
                status: 'completed',
                effort: null,
                actualLoadKg: 90,
                actualReps: 6,
              }),
            ],
          }),
        ],
      });

      const nextState = workoutReducer(
        {
          ...workoutInitialState,
          activeSession,
        },
        { type: 'set/recordEffort', payload: { slotId: activeSession.exercises[0].slotId, setIndex: 0, effort: 'hard' } },
      );

      assert.equal(nextState.activeSession.exercises[0].sets[0].effort, 'hard');
    },
  },
  {
    name: 'timer override resets a running rest timer to the premium suggestion',
    run() {
      const activeSession = createCompletedSession({
        status: 'active',
        completedAt: undefined,
        restTimer: {
          status: 'running',
          exerciseSlotId: 'slot-1',
          setIndex: 0,
          startedAtMs: 1000,
          endsAtMs: 121000,
          durationSeconds: 120,
        },
      });

      const nextState = workoutReducer(
        {
          ...workoutInitialState,
          nowMs: 1000,
          activeSession,
        },
        { type: 'timer/override', payload: { durationSeconds: 150, nowMs: 5000 } },
      );

      assert.equal(nextState.activeSession.restTimer.durationSeconds, 150);
      assert.equal(nextState.activeSession.restTimer.startedAtMs, 5000);
      assert.equal(nextState.activeSession.restTimer.endsAtMs, 155000);
    },
  },
  {
    name: 'timer override updates paused rest duration without resuming',
    run() {
      const activeSession = createCompletedSession({
        status: 'active',
        completedAt: undefined,
        restTimer: {
          status: 'paused',
          exerciseSlotId: 'slot-1',
          setIndex: 0,
          startedAtMs: 1000,
          endsAtMs: null,
          durationSeconds: 60,
        },
      });

      const nextState = workoutReducer(
        {
          ...workoutInitialState,
          nowMs: 1000,
          activeSession,
        },
        { type: 'timer/override', payload: { durationSeconds: 90, nowMs: 5000 } },
      );

      assert.equal(nextState.activeSession.restTimer.status, 'paused');
      assert.equal(nextState.activeSession.restTimer.durationSeconds, 90);
      assert.equal(nextState.activeSession.restTimer.endsAtMs, null);
    },
  },
];
