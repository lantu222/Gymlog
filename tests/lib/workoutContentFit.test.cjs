const assert = require('node:assert/strict');

const { evaluateWorkoutContentFit } = require('../../.test-dist/lib/workoutContentFit.js');
const { WORKOUT_TEMPLATES_V1 } = require('../../.test-dist/features/workout/workoutCatalog.js');

module.exports = [
  {
    name: 'workout content fit accepts strength templates with low-rep loaded anchors',
    run() {
      const fit = evaluateWorkoutContentFit('tpl_4_day_powerbuilding_v1', {
        goalType: 'strength',
        setupContext: 'full_gym',
      });

      assert.deepEqual(fit.issues, []);
      assert.equal(fit.signals.hasLowRepLoadedAnchors, true);
      assert.equal(fit.signals.primarySetCount >= 14, true);
      assert.equal(fit.signals.hasFullGymOnlyExercises, true);
    },
  },
  {
    name: 'workout content fit accepts muscle gain templates with enough volume work',
    run() {
      const fit = evaluateWorkoutContentFit('tpl_5_day_hybrid_v1', {
        goalType: 'hypertrophy',
        setupContext: 'full_gym',
      });

      assert.deepEqual(fit.issues, []);
      assert.equal(fit.signals.hasHypertrophyVolume, true);
      assert.equal(fit.signals.accessoryExerciseCount >= 8, true);
      assert.equal(fit.signals.weeklySetCount >= 60, true);
    },
  },
  {
    name: 'workout content fit accepts fat-loss full-gym templates when fatigue stays moderate',
    run() {
      const fit = evaluateWorkoutContentFit('tpl_3_day_full_body_v1', {
        goalType: 'fat_loss',
        setupContext: 'full_gym',
      });

      assert.deepEqual(fit.issues, []);
      assert.equal(fit.signals.maxExercisesPerSession <= 5, true);
      assert.equal(fit.signals.averageSessionMinutes <= 55, true);
      assert.equal(fit.signals.loadedExerciseCount >= 8, true);
      assert.equal(fit.signals.hasResistanceWork, true);
      assert.equal(fit.signals.hasRunWork, false);
    },
  },
  {
    name: 'workout content fit accepts endurance templates with run and mobility work',
    run() {
      const fit = evaluateWorkoutContentFit('tpl_3_day_run_mobility_v1', {
        goalType: 'endurance',
        setupContext: 'outdoor_running',
      });

      assert.deepEqual(fit.issues, []);
      assert.equal(fit.signals.hasRunWork, true);
      assert.equal(fit.signals.runExerciseCount >= 2, true);
      assert.equal(fit.signals.hasMobilityWork, true);
      assert.equal(fit.signals.hasFullGymOnlyExercises, false);
    },
  },
  {
    name: 'workout content fit accepts home bodyweight templates without full-gym-only work',
    run() {
      const fit = evaluateWorkoutContentFit('tpl_2_day_minimal_full_body_v1', {
        goalType: 'hypertrophy',
        setupContext: 'bodyweight',
      });

      assert.deepEqual(fit.issues, []);
      assert.equal(fit.signals.hasFullGymOnlyExercises, false);
      assert.equal(fit.signals.bodyweightExerciseCount >= 6, true);
    },
  },
  {
    name: 'workout content fit requires fat-loss plans to include resistance work',
    run() {
      const fit = evaluateWorkoutContentFit('tpl_2_day_yoga_recovery_v1', {
        goalType: 'fat_loss',
        setupContext: 'bodyweight',
      });

      assert.match(fit.issues.join(' '), /resistance/i);
    },
  },
  {
    name: 'workout content fit validates every strength template has heavy anchors',
    run() {
      const strengthTemplates = WORKOUT_TEMPLATES_V1.filter((template) => template.goalType === 'strength');

      assert.ok(strengthTemplates.length >= 3);
      strengthTemplates.forEach((template) => {
        const fit = evaluateWorkoutContentFit(template.id, {
          goalType: 'strength',
          setupContext: 'full_gym',
        });

        assert.deepEqual(fit.issues, [], template.id);
        assert.equal(fit.signals.hasLowRepLoadedAnchors, true, template.id);
        assert.equal(fit.signals.primarySetCount >= 6, true, template.id);
      });
    },
  },
  {
    name: 'workout content fit validates every hypertrophy template has enough volume',
    run() {
      const hypertrophyTemplates = WORKOUT_TEMPLATES_V1.filter((template) => template.goalType === 'hypertrophy');

      assert.ok(hypertrophyTemplates.length >= 4);
      hypertrophyTemplates.forEach((template) => {
        const fit = evaluateWorkoutContentFit(template.id, {
          goalType: 'hypertrophy',
          setupContext: 'full_gym',
        });

        assert.deepEqual(fit.issues, [], template.id);
        assert.equal(fit.signals.hasHypertrophyVolume, true, template.id);
        assert.equal(fit.signals.weeklySetCount >= 24, true, template.id);
      });
    },
  },
  {
    name: 'workout content fit keeps beginner templates within manageable complexity',
    run() {
      const beginnerTemplates = WORKOUT_TEMPLATES_V1.filter((template) => template.level === 'beginner');

      assert.ok(beginnerTemplates.length >= 6);
      beginnerTemplates.forEach((template) => {
        const fit = evaluateWorkoutContentFit(template.id, {
          goalType: template.goalType === 'strength' ? 'strength' : template.goalType === 'hypertrophy' ? 'hypertrophy' : 'recomposition',
          setupContext: template.id === 'tpl_2_day_minimal_full_body_v1' ? 'bodyweight' : 'full_gym',
        });

        assert.equal(fit.signals.maxExercisesPerSession <= 6, true, template.id);
        assert.equal(fit.signals.averageSessionMinutes <= 55, true, template.id);
        assert.equal(fit.signals.technicalLiftCount <= 2, true, template.id);
      });
    },
  },
  {
    name: 'workout content fit validates endurance templates have at least two run exposures',
    run() {
      const fit = evaluateWorkoutContentFit('tpl_3_day_run_mobility_v1', {
        goalType: 'endurance',
        setupContext: 'outdoor_running',
      });

      assert.deepEqual(fit.issues, []);
      assert.equal(fit.signals.runExerciseCount >= 2, true);
    },
  },
];
