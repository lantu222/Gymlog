const assert = require('node:assert/strict');

const {
  getWorkoutLoggingSessionBootstrapResult,
} = require('../../.test-dist/lib/workoutLoggingSessionBootstrap.js');

module.exports = [
  {
    name: 'workout logging bootstrap starts a session the first time a route opens without an active session',
    run() {
      assert.deepEqual(
        getWorkoutLoggingSessionBootstrapResult({
          hydrated: true,
          activeSessionId: null,
          targetKey: 'template:tpl_strength_a',
          lastBootstrappedTargetKey: null,
        }),
        {
          shouldStartWorkout: true,
          nextBootstrappedTargetKey: 'template:tpl_strength_a',
        },
      );
    },
  },
  {
    name: 'workout logging bootstrap does not restart the same route after discard clears the active session',
    run() {
      assert.deepEqual(
        getWorkoutLoggingSessionBootstrapResult({
          hydrated: true,
          activeSessionId: null,
          targetKey: 'template:tpl_strength_a',
          lastBootstrappedTargetKey: 'template:tpl_strength_a',
        }),
        {
          shouldStartWorkout: false,
          nextBootstrappedTargetKey: 'template:tpl_strength_a',
        },
      );
    },
  },
  {
    name: 'workout logging bootstrap allows a different route to start after the previous one was discarded',
    run() {
      assert.deepEqual(
        getWorkoutLoggingSessionBootstrapResult({
          hydrated: true,
          activeSessionId: null,
          targetKey: 'template:tpl_upper_lower',
          lastBootstrappedTargetKey: 'template:tpl_strength_a',
        }),
        {
          shouldStartWorkout: true,
          nextBootstrappedTargetKey: 'template:tpl_upper_lower',
        },
      );
    },
  },
  {
    name: 'workout logging bootstrap waits for hydration and tracks the current route when a live session exists',
    run() {
      assert.deepEqual(
        getWorkoutLoggingSessionBootstrapResult({
          hydrated: false,
          activeSessionId: null,
          targetKey: 'template:tpl_strength_a',
          lastBootstrappedTargetKey: null,
        }),
        {
          shouldStartWorkout: false,
          nextBootstrappedTargetKey: null,
        },
      );

      assert.deepEqual(
        getWorkoutLoggingSessionBootstrapResult({
          hydrated: true,
          activeSessionId: 'session_live_1',
          targetKey: 'template:tpl_strength_a',
          lastBootstrappedTargetKey: null,
        }),
        {
          shouldStartWorkout: false,
          nextBootstrappedTargetKey: 'template:tpl_strength_a',
        },
      );
    },
  },
];
