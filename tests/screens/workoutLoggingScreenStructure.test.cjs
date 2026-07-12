const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const screenPath = path.join(__dirname, '..', '..', 'src', 'screens', 'WorkoutLoggingScreen.tsx');
const appPath = path.join(__dirname, '..', '..', 'App.tsx');
const themePath = path.join(__dirname, '..', '..', 'src', 'theme.ts');
const setRowPath = path.join(__dirname, '..', '..', 'src', 'components', 'WorkoutSetRow.tsx');

function readSource(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

module.exports = [
  {
    name: 'workout logging screen uses a flat native workout list layout',
    run() {
      const screenSource = readSource(screenPath);
      const setRowSource = readSource(setRowPath);
      const source = [
        readSource(appPath),
        readSource(themePath),
        screenSource,
        setRowSource,
      ].join('\n');

      assert.match(source, /LOGGING_BACKGROUND\s*=\s*'#FFFFFF'/);
      assert.match(source, /LOGGING_PURPLE\s*=\s*'#7C3AED'/);
      assert.match(source, /Font\.loadAsync/);
      assert.match(source, /Inter:\s*require\('\.\/assets\/fonts\/Inter\.ttf'\)/);
      assert.match(source, /Manrope:\s*require\('\.\/assets\/fonts\/Manrope\.ttf'\)/);
      assert.match(source, /fontFamily:\s*'Manrope'/);
      assert.match(source, /fontFamily:\s*typography\.fontFamily/);
      assert.match(screenSource, /WORKOUT_FONT_FAMILY\s*=\s*'Manrope'/);
      assert.match(screenSource, /fontFamily:\s*WORKOUT_FONT_FAMILY/);

      assert.match(screenSource, /headerFinishButton/);
      assert.match(screenSource, />Finish</);
      assert.doesNotMatch(screenSource, /activeWorkoutCloseButton/);
      assert.doesNotMatch(screenSource, />v</);

      // The Duration/Volume/Sets card was replaced by a single meta strip that
      // carries the clock alongside the counts; "done so far" is gone.
      assert.match(screenSource, /metaStrip/);
      assert.match(screenSource, /metaStripText/);
      assert.match(screenSource, /\{elapsedText\}/);
      assert.match(screenSource, /\{completedSets\} sets/);
      assert.match(screenSource, /\{volumeText\} volume/);
      assert.doesNotMatch(screenSource, /done so far/);

      assert.match(screenSource, /workoutExerciseRows\s*=\s*activeSession\.exercises/);
      assert.match(screenSource, /exerciseList/);
      assert.match(screenSource, /exerciseListRow/);
      assert.match(screenSource, /exerciseListIcon/);
      assert.match(screenSource, /<Svg width=\{24\} height=\{24\}/);
      assert.match(screenSource, /exerciseListMore/);
      assert.match(screenSource, /fontSize:\s*19/);
      assert.match(screenSource, /letterSpacing:\s*-0\.2/);
      assert.match(screenSource, /color:\s*'#344054'/);
      assert.match(screenSource, /fontWeight:\s*'700'/);
      assert.match(screenSource, /formatWorkoutListExerciseName/);
      assert.match(screenSource, /getExerciseCompletionMeta/);
      assert.match(screenSource, /\$\{completedSets\}\/\$\{totalSets\} done/);
      assert.match(screenSource, /formatWorkoutListExerciseName\(exercise\.exerciseName\)/);
      assert.match(screenSource, /getWorkoutListIcon\(exercise\.exerciseName\)/);
      assert.match(screenSource, /More actions for \$\{exercise\.exerciseName\}/);
      assert.match(screenSource, />\.\.\.</);
      assert.match(screenSource, /borderBottomWidth:\s*1/);
      assert.doesNotMatch(screenSource, /borderTopWidth:\s*1/);
      assert.match(screenSource, /backgroundColor:\s*'#FFFFFF'/);
      assert.match(screenSource, /minHeight:\s*73/);

      assert.match(screenSource, /<WorkoutSetRow/);
      assert.match(screenSource, /activeExercisePanel/);
      assert.match(screenSource, /REST_TIMER_OPTIONS/);
      assert.match(screenSource, /handleSelectRestDuration/);
      assert.match(screenSource, /Rest Timer:/);
      assert.match(screenSource, /restTimerMenu/);
      assert.match(screenSource, /setTableHeader/);
      assert.match(screenSource, />SET</);
      assert.match(screenSource, />PREVIOUS</);
      assert.match(screenSource, />KG</);
      assert.match(screenSource, />REPS</);
      assert.match(screenSource, />\+ Add set</);
      assert.match(screenSource, /updateSetDraft\(exercise\.slotId, rowIndex, \{ loadText: value \}\)/);
      assert.match(screenSource, /updateSetDraft\(exercise\.slotId, rowIndex, \{ repsText: value \}\)/);
      assert.match(screenSource, /completeSet\(exercise\.slotId, rowIndex, unitPreference\)/);
      assert.match(setRowSource, /WORKOUT_FONT_FAMILY\s*=\s*'Manrope'/);
      assert.match(setRowSource, /VALUE_CELL_WIDTH\s*=\s*76/);
      // Per-row CHECK button removed (handoff §1): no CHECK column/spacer, no
      // per-row done button. The set is logged via the Log set button / reps
      // submit; completed rows paint green.
      assert.doesNotMatch(setRowSource, /CHECK_BUTTON_SIZE/);
      assert.doesNotMatch(setRowSource, /doneButton/);
      assert.doesNotMatch(setRowSource, /setHeaderCheck/);
      assert.doesNotMatch(screenSource, /setHeaderCheck/);
      assert.match(setRowSource, /const SUCCESS_GREEN = '#16A34A'/);
      assert.match(setRowSource, /rowCompleted:\s*\{\s*backgroundColor: SUCCESS_GREEN_BG/);
      assert.match(setRowSource, /const WEIGHT_STEPS = \[-2\.5, 1\.25, 2\.5, 5\]/);
      assert.match(setRowSource, /function WeightConsole/);
      // No Log set button: submitting reps completes the set (rest timer + auto
      // advance handled by the existing reducer).
      assert.doesNotMatch(setRowSource, /Log set/);
      assert.doesNotMatch(setRowSource, /logSetButton/);
      assert.match(screenSource, /onRepsSubmit=\{\(\) => handleRepsSubmit\(exercise, rowIndex\)\}/);
      assert.match(setRowSource, /minHeight:\s*38/);
      assert.match(setRowSource, /marginLeft:\s*5/);
      assert.match(setRowSource, /PREVIOUS_CELL_WIDTH\s*=\s*86/);
      assert.match(setRowSource, /paddingLeft:\s*10/);
      assert.match(screenSource, /width:\s*86/);
      assert.match(screenSource, /paddingLeft:\s*10/);
      assert.match(setRowSource, /backgroundColor:\s*'#F5F5F7'/);
      assert.match(setRowSource, /setMiddleGroup/);
      assert.match(setRowSource, /valueCellsGroup/);
      assert.match(screenSource, /setHeaderMiddleGroup/);
      assert.match(screenSource, /setHeaderValueGroup/);
      assert.doesNotMatch(setRowSource, /rowSpacer/);
      assert.doesNotMatch(screenSource, /setHeaderSpacer/);
      assert.match(setRowSource, /placeholderTextColor="#9B93AD"/);
      assert.match(setRowSource, /valueTextMuted/);

      assert.match(screenSource, />\+ Add exercise</);
      assert.match(screenSource, /addExerciseButton/);
      assert.match(screenSource, /color:\s*'#5B21B6'/);
      assert.match(screenSource, /fontSize:\s*15/);
      assert.match(screenSource, /borderRadius:\s*radii\.pill/);
      assert.match(screenSource, />Cancel workout</);
      assert.match(screenSource, /cancelWorkoutButton/);
      assert.match(screenSource, /onPress=\{onDiscardWorkout\}/);
      assert.match(screenSource, /color:\s*'#DC2626'/);

      assert.doesNotMatch(screenSource, /<WorkoutExerciseCard/);
      assert.doesNotMatch(screenSource, /<WorkoutSummaryBar/);
      assert.doesNotMatch(screenSource, /<ScreenHeader/);
      assert.doesNotMatch(screenSource, /ACTIVE WORKOUT/);
      assert.doesNotMatch(screenSource, />Push A</);
      assert.doesNotMatch(screenSource, /WARMUP_FLOW_ITEMS/);
      assert.doesNotMatch(screenSource, /COOLDOWN_FLOW_ITEMS/);
      assert.doesNotMatch(screenSource, /warmupExpanded/);
      assert.doesNotMatch(screenSource, /cooldownExpanded/);
      assert.doesNotMatch(screenSource, /sessionQueueRow/);
      assert.doesNotMatch(screenSource, /sessionFlowDetails/);
      assert.doesNotMatch(screenSource, /cooldownRow/);
      assert.doesNotMatch(screenSource, /fullRestTimerScreen/);
      assert.doesNotMatch(screenSource, /fullRestTimerOrbit/);
      assert.doesNotMatch(screenSource, /REST_RING_CIRCUMFERENCE/);
      assert.doesNotMatch(screenSource, /strokeDashoffset=\{restProgressStrokeOffset\}/);
      assert.doesNotMatch(screenSource, /restTransitionCard/);
      assert.doesNotMatch(screenSource, /bottomStack/);
      assert.doesNotMatch(screenSource, /restingCard/);
      assert.doesNotMatch(screenSource, /restTimerPanel/);
      assert.doesNotMatch(screenSource, /phaseStrip/);
      assert.doesNotMatch(screenSource, /sessionSectionLabel/);
      assert.doesNotMatch(screenSource, />SESSION</);
      assert.doesNotMatch(screenSource, />Warm-up</);
      assert.doesNotMatch(screenSource, />Cool-down</);
      assert.doesNotMatch(screenSource, />OK</);
      assert.doesNotMatch(screenSource, />DONE</);
      assert.doesNotMatch(screenSource, />Done</);
      assert.doesNotMatch(screenSource, /Quick effort check/);
      assert.doesNotMatch(screenSource, /showEffortPrompt\s*&&/);
      assert.doesNotMatch(screenSource, /Today starts here/);
      assert.doesNotMatch(screenSource, /cardGlow/);

      const appSource = readSource(appPath);
      assert.match(appSource, /summaryNavigationPendingRef/);
      assert.match(appSource, /route\.screen === 'log'[\s\S]*!workout\.activeSession[\s\S]*finishSaveState\.status !== 'saving'[\s\S]*!summaryNavigationPendingRef\.current/);
      assert.match(appSource, /route\.screen === 'summary'[\s\S]*!completionSummary[\s\S]*finishSaveState\.status !== 'saving'[\s\S]*!summaryNavigationPendingRef\.current/);
      assert.match(appSource, /workout\.finishWorkout\(adaptedSession\.performedAt\);[\s\S]*const summary = await saveCompletedWorkoutSession/);
      assert.match(appSource, /setCompletionSummary\([\s\S]*summaryNavigationPendingRef\.current = true;[\s\S]*workout\.clearCompletedWorkout\(\);[\s\S]*replaceRoute\(\{ tab: 'workout', screen: 'summary' \}\)/);
    },
  },
];
