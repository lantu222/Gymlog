const assert = require('node:assert/strict');

const { buildFocusEmphasisAdditions, getFocusEmphasisCount } = require('../../.test-dist/lib/focusEmphasis');
const { composeProgramWeekForSelection } = require('../../.test-dist/lib/programDayComposer');
const { exerciseHitsCautionArea } = require('../../.test-dist/lib/cautionExerciseFilter');
const { DEFAULT_FIRST_RUN_SELECTION } = require('../../.test-dist/lib/firstRunSetup');
const { WORKOUT_TEMPLATES_V1 } = require('../../.test-dist/features/workout/workoutCatalog');

function session(id, exerciseNames) {
  return {
    id,
    exercises: exerciseNames.map((name, index) => ({
      id: `${id}_${index}`,
      exerciseName: name,
      slotId: `slot_${index}`,
      role: 'primary',
      progressionPriority: 'high',
      trackingMode: 'load_and_reps',
      sets: 3,
      repsMin: 8,
      repsMax: 12,
      restSecondsMin: 60,
      restSecondsMax: 120,
      substitutionGroup: 'none',
    })),
  };
}

function selectionWith(overrides) {
  return { ...DEFAULT_FIRST_RUN_SELECTION, availableDays: [], scheduleMode: 'app_managed', ...overrides };
}

module.exports = [
  {
    name: 'focusEmphasis: big areas add two weekly accessories, small areas one',
    run() {
      assert.equal(getFocusEmphasisCount('chest'), 2);
      assert.equal(getFocusEmphasisCount('arms'), 1);

      const sessions = [session('a', ['Bench Press']), session('b', ['Barbell Row'])];
      const big = buildFocusEmphasisAdditions(sessions, ['chest']);
      assert.equal(big.additions.length, 2);
      assert.ok(big.additions.every((entry) => entry.area === 'chest'));

      const small = buildFocusEmphasisAdditions(sessions, ['arms']);
      assert.equal(small.additions.length, 1);
    },
  },
  {
    name: 'focusEmphasis: never duplicates a movement the session already holds',
    run() {
      const sessions = [session('a', ['Cable Fly']), session('b', ['Bench Press'])];
      const result = buildFocusEmphasisAdditions(sessions, ['chest']);

      const flyTargets = result.additions.filter((entry) => entry.exerciseName === 'Cable Fly');
      assert.equal(flyTargets.length, 1);
      assert.equal(flyTargets[0].sessionId, 'b');
    },
  },
  {
    name: 'focusEmphasis: composed week contains the added accessories and reports them',
    run() {
      const template = WORKOUT_TEMPLATES_V1.find((entry) => entry.daysPerWeek >= 4);
      assert.ok(template);

      const baseline = composeProgramWeekForSelection(
        selectionWith({ daysPerWeek: template.daysPerWeek, focusAreas: [] }),
        template.id,
      );
      const emphasized = composeProgramWeekForSelection(
        selectionWith({ daysPerWeek: template.daysPerWeek, focusAreas: ['chest'] }),
        template.id,
      );

      assert.ok(baseline && emphasized);
      const countExercises = (week) => week.sessions.reduce((sum, entry) => sum + entry.exercises.length, 0);
      assert.equal(countExercises(emphasized), countExercises(baseline) + emphasized.focusAdditions.length);
      assert.ok(emphasized.focusAdditions.length >= 1);
      assert.ok(emphasized.focusAdditions.every((entry) => entry.area === 'chest'));
    },
  },
  {
    name: 'focusEmphasis: caution flags veto emphasis — no banned movement sneaks in',
    run() {
      const template = WORKOUT_TEMPLATES_V1.find((entry) => entry.daysPerWeek >= 3);
      assert.ok(template);

      const week = composeProgramWeekForSelection(
        selectionWith({
          daysPerWeek: template.daysPerWeek,
          focusAreas: ['legs'],
          cautionFlags: [{ area: 'knees', level: 'avoid', refinements: [] }],
        }),
        template.id,
      );

      assert.ok(week);
      for (const entry of week.sessions) {
        for (const exercise of entry.exercises) {
          assert.equal(
            exerciseHitsCautionArea(exercise.exerciseName, 'knees'),
            false,
            `${exercise.exerciseName} must not stress avoided knees`,
          );
        }
      }
      // Reported additions only include survivors.
      for (const addition of week.focusAdditions) {
        assert.equal(exerciseHitsCautionArea(addition.exerciseName, 'knees'), false);
      }
    },
  },
];
