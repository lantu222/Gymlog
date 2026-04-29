const assert = require('node:assert/strict');

const {
  WORKOUT_SUBSTITUTION_GROUPS,
  WORKOUT_TEMPLATES_V1,
  getWorkoutTemplateById,
} = require('../../.test-dist/features/workout/workoutCatalog.js');
const { getReadyProgramContent } = require('../../.test-dist/lib/readyProgramContent.js');

module.exports = [
  {
    name: 'ready workout catalog now covers multiple goals with a broader library',
    run() {
      assert.ok(WORKOUT_TEMPLATES_V1.length >= 10);

      const strengthTemplates = WORKOUT_TEMPLATES_V1.filter((template) => template.goalType === 'strength');
      const hypertrophyTemplates = WORKOUT_TEMPLATES_V1.filter((template) => template.goalType === 'hypertrophy');
      const generalTemplates = WORKOUT_TEMPLATES_V1.filter((template) => template.goalType === 'general');
      assert.ok(strengthTemplates.length >= 3);
      assert.ok(hypertrophyTemplates.length >= 4);
      assert.ok(generalTemplates.length >= 3);

      const minimal = getWorkoutTemplateById('tpl_2_day_minimal_full_body_v1');
      assert.equal(minimal.daysPerWeek, 2);
      assert.equal(minimal.sessions.length, 2);
      assert.equal(minimal.sessions[0].name, 'Minimal A');

      const muscleBuilder = getWorkoutTemplateById('tpl_4_day_muscle_builder_v1');
      assert.equal(muscleBuilder.sessions.length, 4);
      assert.equal(muscleBuilder.level, 'beginner');
    },
  },
  {
    name: 'ready workout content exists for every ready template',
    run() {
      WORKOUT_TEMPLATES_V1.forEach((template) => {
        const content = getReadyProgramContent(template.id);
        assert.ok(content);
        assert.ok(content.summary.length > 20);
        assert.ok(content.audience.length > 20);
        assert.ok(Object.keys(content.sessionFocusById).length > 0);
      });
    },
  },
  {
    name: 'low-equipment starter avoids full-gym-only exercises',
    run() {
      const minimal = getWorkoutTemplateById('tpl_2_day_minimal_full_body_v1');
      const fullGymOnly = new Set([
        'Back Squat',
        'Bench Press',
        'Chest-Supported Row',
        'Cable Crunch',
        'Leg Press',
        'Overhead Press',
        'Lat Pulldown',
        'Leg Curl',
      ]);
      const exerciseNames = minimal.sessions.flatMap((session) =>
        session.exercises.map((exercise) => exercise.exerciseName),
      );

      assert.equal(exerciseNames.some((exerciseName) => fullGymOnly.has(exerciseName)), false);
      assert.ok(exerciseNames.includes('Bodyweight Squat'));
      assert.ok(exerciseNames.includes('Incline Push-Up'));
      assert.ok(exerciseNames.includes('Inverted Row'));
      assert.equal(
        minimal.sessions.every((session) =>
          session.exercises.every((exercise) => exercise.trackingMode === 'bodyweight'),
        ),
        true,
      );
    },
  },
  {
    name: 'ready workout substitutions cover every template exercise',
    run() {
      const groupsById = new Map(WORKOUT_SUBSTITUTION_GROUPS.map((group) => [group.id, group]));

      WORKOUT_TEMPLATES_V1.forEach((template) => {
        template.sessions.forEach((session) => {
          session.exercises.forEach((exercise) => {
            const group = groupsById.get(exercise.substitutionGroup);

            assert.ok(group, `${template.id} ${session.id} ${exercise.exerciseName}`);
            assert.ok(
              group.allowedExerciseNames.includes(exercise.exerciseName),
              `${exercise.exerciseName} missing from ${exercise.substitutionGroup}`,
            );
          });
        });
      });
    },
  },
  {
    name: 'ready workout substitution groups provide realistic alternatives',
    run() {
      WORKOUT_SUBSTITUTION_GROUPS.forEach((group) => {
        assert.equal(group.allowedExerciseNames.length >= 2, true, group.id);
        assert.equal(new Set(group.allowedExerciseNames).size, group.allowedExerciseNames.length, group.id);
      });
    },
  },
  {
    name: 'bodyweight substitution groups avoid full-gym-only alternatives',
    run() {
      const fullGymOnly = new Set([
        'Back Squat',
        'Bench Press',
        'Barbell Row',
        'Cable Crunch',
        'Chest-Supported Row',
        'Front Squat',
        'Hack Squat',
        'Lat Pulldown',
        'Leg Curl',
        'Leg Press',
        'Machine Chest Press',
        'Machine Shoulder Press',
        'Seated Cable Row',
        'Trap Bar Deadlift',
        'Triceps Pushdown',
        'Hip Thrust',
      ]);
      const bodyweightGroups = WORKOUT_SUBSTITUTION_GROUPS.filter((group) => group.id.startsWith('bodyweight_'));

      bodyweightGroups.forEach((group) => {
        assert.equal(
          group.allowedExerciseNames.some((exerciseName) => fullGymOnly.has(exerciseName)),
          false,
          group.id,
        );
      });
    },
  },
];
