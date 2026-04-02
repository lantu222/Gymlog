const assert = require('node:assert/strict');

const {
  getTrainingFeelTitle,
  getWorkoutVarietyTitle,
  getExerciseModalityPreferenceTitle,
  getJointSwapPreferenceTitle,
  summarizeExercisePreferences,
  summarizeJointSwapPreferences,
} = require('../../.test-dist/lib/tailoring.js');

module.exports = [
  {
    name: 'tailoring labels stay short and user facing',
    run() {
      assert.equal(getTrainingFeelTitle('challenging'), 'Challenging');
      assert.equal(getWorkoutVarietyTitle('fresh'), 'Fresh');
      assert.equal(getExerciseModalityPreferenceTitle('love'), 'Love');
      assert.equal(getJointSwapPreferenceTitle('prioritize'), 'Prioritize');
    },
  },
  {
    name: 'tailoring summary favors preferred modalities',
    run() {
      const summary = summarizeExercisePreferences({
        trainingFeel: 'steady',
        workoutVariety: 'balanced',
        freeWeights: 'love',
        bodyweight: 'neutral',
        machines: 'prefer',
      });

      assert.equal(summary, 'Steady work | Balanced week | free weights + machines');
    },
  },
  {
    name: 'tailoring summary falls back when there is no strong modality bias',
    run() {
      const summary = summarizeExercisePreferences({
        trainingFeel: 'easy',
        workoutVariety: 'stable',
        freeWeights: 'neutral',
        bodyweight: 'avoid',
        machines: 'neutral',
      });

      assert.equal(summary, 'Easy work | Stable week | no strong equipment bias');
    },
  },
  {
    name: 'joint swap summary stays compact and user facing',
    run() {
      const summary = summarizeJointSwapPreferences({
        shoulders: 'prioritize',
        elbows: 'neutral',
        knees: 'prefer',
      });

      assert.equal(summary, 'Shoulder priority | Knees prefer');
    },
  },
];
