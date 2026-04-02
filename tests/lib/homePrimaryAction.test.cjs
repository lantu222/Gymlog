const assert = require('node:assert/strict');

const { selectHomePrimaryAction } = require('../../.test-dist/lib/homePrimaryAction.js');

module.exports = [
  {
    name: 'home primary action prioritizes resuming the active workout',
    run() {
      const selection = selectHomePrimaryAction({
        activeWorkout: {
          title: 'Upper Day',
          nextExercise: 'Bench Press',
          meta: '6 sets left | Started 18:20',
        },
        nextPlannedWorkout: {
          source: 'custom',
          workoutTemplateId: 'custom_1',
          title: 'Plan Workout',
          subtitle: 'Rotation day',
        },
        lastWorkout: null,
        recommendedWorkout: null,
      });

      assert.equal(selection.mode, 'resume_active');
      assert.equal(selection.card.actionLabel, 'Resume workout');
      assert.equal(selection.target.type, 'resume_active');
    },
  },
  {
    name: 'home primary action prefers continuing the plan before opening the last workout',
    run() {
      const selection = selectHomePrimaryAction({
        activeWorkout: null,
        nextPlannedWorkout: {
          source: 'custom',
          workoutTemplateId: 'custom_1',
          title: 'Upper Lower',
          subtitle: 'Plan - Wednesday',
          meta: '4 exercises',
        },
        lastWorkout: {
          source: 'ready',
          workoutTemplateId: 'ready_1',
          title: '3-Day Full Body',
          subtitle: 'Last completed Mar 28',
        },
        recommendedWorkout: null,
      });

      assert.equal(selection.mode, 'continue_plan');
      assert.equal(selection.card.actionLabel, 'Continue plan');
      assert.deepEqual(selection.target, {
        type: 'open_program',
        source: 'custom',
        workoutTemplateId: 'custom_1',
      });
    },
  },
  {
    name: 'home primary action opens the last workout before falling back to recommended plans',
    run() {
      const selection = selectHomePrimaryAction({
        activeWorkout: null,
        nextPlannedWorkout: null,
        lastWorkout: {
          source: 'ready',
          workoutTemplateId: 'ready_1',
          title: '3-Day Full Body',
          subtitle: 'Last completed Mar 28',
        },
        recommendedWorkout: {
          source: 'ready',
          workoutTemplateId: 'ready_2',
          title: '4-Day Upper/Lower',
          subtitle: 'Best for intermediates',
        },
      });

      assert.equal(selection.mode, 'open_last_workout');
      assert.equal(selection.card.actionLabel, 'Open last workout');
      assert.equal(selection.target.workoutTemplateId, 'ready_1');
    },
  },
  {
    name: 'home primary action falls back to the ready-program library when nothing else exists',
    run() {
      const selection = selectHomePrimaryAction({
        activeWorkout: null,
        nextPlannedWorkout: null,
        lastWorkout: null,
        recommendedWorkout: null,
      });

      assert.equal(selection.mode, 'ready_programs');
      assert.equal(selection.card.title, 'Ready programs');
      assert.deepEqual(selection.target, { type: 'open_ready_library' });
    },
  },
];