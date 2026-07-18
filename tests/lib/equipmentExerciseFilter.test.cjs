const assert = require('node:assert/strict');

const {
  applyEquipmentToExercises,
  isExerciseAllowedWithEquipment,
  resolveAvailableEquipment,
} = require('../../.test-dist/lib/equipmentExerciseFilter');
const { composeProgramWeekForSelection } = require('../../.test-dist/lib/programDayComposer');
const { DEFAULT_FIRST_RUN_SELECTION } = require('../../.test-dist/lib/firstRunSetup');
const { WORKOUT_TEMPLATES_V1 } = require('../../.test-dist/features/workout/workoutCatalog');

function exercise(name) {
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
  };
}

module.exports = [
  {
    name: 'equipmentExerciseFilter: chips are the truth, bodyweight setup means no equipment',
    run() {
      assert.deepEqual(resolveAvailableEquipment({ equipmentItems: ['Dumbbells'] }), ['Dumbbells']);
      assert.deepEqual(resolveAvailableEquipment({ trainingEnvironment: 'bodyweight_only', equipmentItems: [] }), []);
      assert.equal(resolveAvailableEquipment({ trainingEnvironment: 'full_gym', equipmentItems: [] }), null);
    },
  },
  {
    name: 'equipmentExerciseFilter: requirement groups gate exercises correctly',
    run() {
      assert.equal(isExerciseAllowedWithEquipment('Barbell Bench Press', null), true);
      assert.equal(isExerciseAllowedWithEquipment('Dumbbell Curl', ['Dumbbells']), true);
      assert.equal(isExerciseAllowedWithEquipment('Barbell Curl', ['Dumbbells']), false);
      // Bench press needs a bench AND a barbell.
      assert.equal(isExerciseAllowedWithEquipment('Bench Press', ['Bench']), false);
      assert.equal(isExerciseAllowedWithEquipment('Bench Press', ['Bench', 'Barbells']), true);
      assert.equal(isExerciseAllowedWithEquipment('Back Squat', ['Barbells']), false);
      assert.equal(isExerciseAllowedWithEquipment('Back Squat', ['Barbells', 'Squat rack']), true);
      assert.equal(isExerciseAllowedWithEquipment('Push-Up Wide', []), true);
    },
  },
  {
    name: 'equipmentExerciseFilter: unmet gear swaps to the best allowed fallback',
    run() {
      const dumbbellsOnly = applyEquipmentToExercises(
        [exercise('Barbell Bench Press'), exercise('Back Squat'), exercise('Lat Pulldown')],
        ['Dumbbells', 'Bench'],
      );
      assert.deepEqual(
        dumbbellsOnly.exercises.map((entry) => entry.exerciseName),
        ['Dumbbell Floor Press', 'Goblet Squat', 'Inverted Row'],
      );

      const nothing = applyEquipmentToExercises([exercise('Barbell Bench Press')], []);
      assert.deepEqual(
        nothing.exercises.map((entry) => entry.exerciseName),
        ['Push-Up Wide'],
      );
      assert.equal(nothing.exercises[0].trackingMode, 'bodyweight');
    },
  },
  {
    name: 'equipmentExerciseFilter: composed week never demands missing gear',
    run() {
      const template = WORKOUT_TEMPLATES_V1.find((entry) =>
        entry.sessions.some((sessionEntry) =>
          sessionEntry.exercises.some((item) => item.exerciseName.toLowerCase().includes('barbell')),
        ),
      );
      assert.ok(template, 'catalog should contain barbell work');

      const available = ['Dumbbells', 'Bench', 'Resistance bands'];
      const week = composeProgramWeekForSelection(
        {
          ...DEFAULT_FIRST_RUN_SELECTION,
          daysPerWeek: template.daysPerWeek,
          availableDays: [],
          scheduleMode: 'app_managed',
          equipmentItems: available,
        },
        template.id,
      );

      assert.ok(week);
      assert.ok(week.equipmentSwapped.length + week.equipmentRemoved.length > 0);
      for (const sessionEntry of week.sessions) {
        for (const item of sessionEntry.exercises) {
          assert.equal(
            isExerciseAllowedWithEquipment(item.exerciseName, available),
            true,
            `${item.exerciseName} should be doable with ${available.join(', ')}`,
          );
        }
      }
    },
  },
];
