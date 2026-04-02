const assert = require('node:assert/strict');

const { WORKOUT_TEMPLATES_V1, getWorkoutTemplateById } = require('../../.test-dist/features/workout/workoutCatalog.js');
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
];
