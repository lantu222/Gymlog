const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const screenPath = path.join(__dirname, '..', '..', 'src', 'screens', 'WorkoutLoggingScreen.tsx');
const appPath = path.join(__dirname, '..', '..', 'App.tsx');
const themePath = path.join(__dirname, '..', '..', 'src', 'theme.ts');
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
        readSource(appPath),
        readSource(themePath),
        readSource(screenPath),
        readSource(summaryPath),
        readSource(exerciseCardPath),
        readSource(setRowPath),
      ].join('\n');

      assert.match(source, /LOGGING_BACKGROUND\s*=\s*'#F7F3FF'/);
      assert.match(source, /LOGGING_PURPLE\s*=\s*'#7C3AED'/);
      assert.match(source, /Font\.loadAsync/);
      assert.match(source, /Inter:\s*require\('\.\/assets\/fonts\/Inter\.ttf'\)/);
      assert.match(source, /fontFamily:\s*'Inter'/);
      assert.match(source, /fontFamily:\s*typography\.fontFamily/);
      assert.match(source, /ACTIVE WORKOUT/);
      assert.match(source, /Duration/);
      assert.match(source, /Sets/);
      assert.match(source, /Volume/);
      assert.match(source, /fullRestTimerScreen/);
      assert.match(source, />Skip Rest</);
      assert.match(source, /fullRestTimerOrbit/);
      assert.match(source, /Animated\.timing/);
      assert.match(source, /getActiveWorkoutDisplayName/);
      assert.match(source, /WARMUP_FLOW_ITEMS/);
      assert.match(source, /COOLDOWN_FLOW_ITEMS/);
      assert.match(source, /warmupExpanded/);
      assert.match(source, /cooldownExpanded/);
      assert.match(source, /collapsedExerciseSlotIds/);
      assert.match(source, /handleToggleExercise/);
      assert.match(source, /collapseExercise/);
      assert.match(source, /sessionFlowDetails/);
      assert.match(source, /liveStatValueLong/);
      assert.match(source, /NEXT/);
      assert.match(source, /sessionNextChip/);
      assert.match(source, />WU</);
      assert.match(source, /LATER/);
      assert.match(source, /Add set/);
      assert.match(source, /Log set/);
      assert.match(source, /Add exercise/);
      assert.match(source, /Finish workout/);
      assert.match(source, /liveStatsCard/);
      assert.match(source, /minHeight:\s*88/);
      assert.match(source, /workoutExerciseRows/);
      assert.match(source, /sessionQueueRow/);
      assert.match(source, /cooldownRow/);
      assert.match(source, /SET/);
      assert.match(source, /KG/);
      assert.match(source, /REPS/);
      assert.match(source, /CHECK/);
      assert.match(source, /Set \$\{Math\.min\(activeSetIndex \+ 1, exercise\.sets\.length\)\} \/ \$\{exercise\.sets\.length\}/);
      assert.match(source, /valueCellFlex/);

      const setRowSource = readSource(setRowPath);
      const exerciseCardSource = readSource(exerciseCardPath);
      assert.match(setRowSource, /SET_BADGE_SIZE\s*=\s*30/);
      assert.match(setRowSource, /VALUE_CELL_FLEX\s*=\s*0\.5/);
      assert.match(setRowSource, /VALUE_CELL_WIDTH\s*=\s*96/);
      assert.match(setRowSource, /CHECK_BUTTON_SIZE\s*=\s*38/);
      assert.match(setRowSource, /valueCellCompletedPurple/);
      assert.match(setRowSource, /doneButtonCompletedPurple/);
      assert.match(setRowSource, /textAlignVertical:\s*'center'/);
      assert.match(setRowSource, /width:\s*'100%'/);
      assert.doesNotMatch(setRowSource, /LOGGING_GREEN/);
      assert.match(exerciseCardSource, /cardCompleted/);
      assert.match(exerciseCardSource, /exerciseCompleted/);
      assert.doesNotMatch(exerciseCardSource, /LOGGING_GREEN/);
      assert.doesNotMatch(setRowSource, /inputSuffix/);
      assert.doesNotMatch(setRowSource, />\{unitPreference\}</);
      assert.doesNotMatch(setRowSource, />reps</);

      assert.doesNotMatch(source, /<ScreenHeader/);
      assert.doesNotMatch(source, /<WorkoutSummaryBar/);
      assert.doesNotMatch(source, /cardAccent/);
      assert.doesNotMatch(source, /width=\{92\}/);
      assert.doesNotMatch(source, /width=\{76\}/);
      assert.doesNotMatch(source, /Quick effort check/);
      assert.doesNotMatch(source, /showEffortPrompt\s*&&/);
      assert.doesNotMatch(source, /Saving workout\.\.\./);
      assert.doesNotMatch(source, /restingCard/);
      assert.doesNotMatch(source, /restTimerPanel/);
      assert.doesNotMatch(source, /phaseStrip/);
      assert.doesNotMatch(source, /sessionSectionLabel/);
      assert.doesNotMatch(source, /sessionQueueChevron/);
      assert.doesNotMatch(source, /activeWorkoutBackText/);
      assert.doesNotMatch(source, />SESSION</);
      assert.doesNotMatch(source, />OK</);
      assert.doesNotMatch(source, />DONE</);
      assert.doesNotMatch(source, />Done</);
      assert.doesNotMatch(source, /Rest before the next set/);
      assert.doesNotMatch(source, /const queuedExercises = nextUpExercise \? \[nextUpExercise, \.\.\.laterQueueExercises\] : laterQueueExercises/);
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
