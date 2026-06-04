const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const screenPath = path.join(__dirname, '..', '..', 'src', 'screens', 'WorkoutLoggingScreen.tsx');
const summaryPath = path.join(__dirname, '..', '..', 'src', 'components', 'WorkoutSummaryBar.tsx');
const exerciseCardPath = path.join(__dirname, '..', '..', 'src', 'components', 'WorkoutExerciseCard.tsx');
const setRowPath = path.join(__dirname, '..', '..', 'src', 'components', 'WorkoutSetRow.tsx');

function readSource(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

module.exports = [
  {
    name: 'workout logging screen uses the light active workout layout',
    run() {
      const source = [
        readSource(screenPath),
        readSource(summaryPath),
        readSource(exerciseCardPath),
        readSource(setRowPath),
      ].join('\n');

      assert.match(source, /LOGGING_BACKGROUND\s*=\s*'#F7F3FF'/);
      assert.match(source, /LOGGING_PURPLE\s*=\s*'#7C3AED'/);
      assert.match(source, /Active Workout/);
      assert.match(source, /Finish Workout/);
      assert.match(source, /SET/);
      assert.match(source, /KG/);
      assert.match(source, /REPS/);
      assert.match(source, /CHECK/);

      assert.doesNotMatch(source, /Today starts here/);
      assert.doesNotMatch(source, /Load \+ reps/);
      assert.doesNotMatch(source, /Then tap Done/);
      assert.doesNotMatch(source, /First workout: just finish/);
      assert.doesNotMatch(source, /<WorkoutSceneGraphic/);
      assert.doesNotMatch(source, />More</);
      assert.doesNotMatch(source, /fontSize:\s*0/);
      assert.doesNotMatch(source, /currentPhaseLabel=/);
      assert.doesNotMatch(source, /statusMeta=/);
      assert.doesNotMatch(source, /cardGlow/);
    },
  },
];
