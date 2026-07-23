const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const screenPath = path.join(__dirname, '..', '..', 'src', 'screens', 'WorkoutLoggingScreen.tsx');
const appPath = path.join(__dirname, '..', '..', 'App.tsx');
const themePath = path.join(__dirname, '..', '..', 'src', 'theme.ts');
const setRowPath = path.join(__dirname, '..', '..', 'src', 'components', 'WorkoutSetRow.tsx');
const workoutStatePath = path.join(__dirname, '..', '..', 'src', 'features', 'workout', 'workoutState.ts');
const i18nPath = path.join(__dirname, '..', '..', 'src', 'lib', 'i18n.ts');

function readSource(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

module.exports = [
  {
    name: 'workout logging screen uses a flat native workout list layout',
    run() {
      const screenSource = readSource(screenPath);
      const setRowSource = readSource(setRowPath);
      const i18nSource = readSource(i18nPath);
      const workoutStateSource = readSource(workoutStatePath);
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
      // Copy moved to i18n.ts; the screen renders it via t(language, …).
      assert.match(screenSource, /t\(language, 'logger\.finish'\)/);
      assert.match(i18nSource, /'logger\.finish': 'Finish'/);
      assert.doesNotMatch(screenSource, /activeWorkoutCloseButton/);
      assert.doesNotMatch(screenSource, />v</);

      // The Duration/Volume/Sets card was replaced by a single meta strip that
      // carries the clock alongside the counts; "done so far" is gone.
      assert.match(screenSource, /metaStrip/);
      assert.match(screenSource, /metaStripText/);
      assert.match(screenSource, /\{elapsedText\}/);
      assert.match(screenSource, /t\(language, 'logger\.stat\.sets', \{ count: completedSets \}\)/);
      assert.match(screenSource, /t\(language, 'logger\.stat\.volume', \{ volume: volumeText \}\)/);
      assert.doesNotMatch(screenSource, /done so far/);

      assert.match(screenSource, /workoutExerciseRows\s*=\s*activeSession\.exercises/);
      assert.match(screenSource, /exerciseList/);
      assert.match(screenSource, /exerciseListRow/);
      // Exercise rows carry no leading icon tile — just the name/meta copy.
      assert.doesNotMatch(screenSource, /exerciseListIcon/);
      assert.doesNotMatch(screenSource, /getWorkoutListIcon/);
      assert.match(screenSource, /exerciseListMore/);
      assert.match(screenSource, /fontSize:\s*19/);
      assert.match(screenSource, /letterSpacing:\s*-0\.2/);
      assert.match(screenSource, /color:\s*'#344054'/);
      assert.match(screenSource, /fontWeight:\s*'700'/);
      assert.match(screenSource, /formatWorkoutListExerciseName/);
      assert.match(screenSource, /getExerciseCompletionMeta/);
      assert.match(screenSource, /'logger\.exerciseDone', \{ done: completedSets, total: totalSets \}/);
      assert.match(i18nSource, /'logger\.exerciseDone': '\{done\}\/\{total\} done'/);
      assert.match(screenSource, /formatWorkoutListExerciseName\(exercise\.exerciseName\)/);
      assert.match(screenSource, /'logger\.a11y\.moreActions', \{ name: exercise\.exerciseName \}/);
      assert.match(screenSource, />\.\.\.</);
      assert.match(screenSource, /borderBottomWidth:\s*1/);
      assert.doesNotMatch(screenSource, /borderTopWidth:\s*1/);
      assert.match(screenSource, /backgroundColor:\s*'#FFFFFF'/);
      assert.match(screenSource, /minHeight:\s*73/);

      assert.match(screenSource, /<WorkoutSetRow/);
      assert.match(screenSource, /activeExercisePanel/);
      assert.match(screenSource, /REST_TIMER_OPTIONS/);
      assert.match(screenSource, /handleSelectRestDuration/);
      assert.match(screenSource, /'logger\.restTimer'/);
      assert.match(i18nSource, /'logger\.restTimer': 'Rest Timer: \{label\}'/);
      assert.match(screenSource, /restTimerMenu/);
      assert.match(screenSource, /setTableHeader/);
      assert.match(screenSource, /t\(language, 'logger\.col\.set'\)/);
      assert.match(screenSource, /t\(language, 'logger\.col\.previous'\)/);
      assert.match(screenSource, />KG</);
      assert.match(screenSource, /t\(language, 'logger\.col\.reps'\)/);
      assert.match(screenSource, /t\(language, 'logger\.addSet'\)/);
      assert.match(i18nSource, /'logger\.addSet': '\+ Add set'/);
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
      // No weight console and no Log set button: the row is just SET/PREVIOUS/
      // KG/REPS. Submitting reps completes the set (rest timer + auto-advance
      // via the existing reducer), and the weight carries to the next set.
      assert.doesNotMatch(setRowSource, /WEIGHT_STEPS/);
      assert.doesNotMatch(setRowSource, /WeightConsole/);
      assert.doesNotMatch(setRowSource, /consoleChip/);
      assert.doesNotMatch(setRowSource, /Log set/);
      assert.doesNotMatch(setRowSource, /logSetButton/);
      assert.match(screenSource, /onRepsSubmit=\{\(\) => handleRepsSubmit\(exercise, rowIndex\)\}/);
      // Rest timer keeps its tap-to-change behaviour but drops the chevron glyph.
      assert.doesNotMatch(screenSource, /restTimerChevron/);
      // Weight carries forward to the next set in the same exercise.
      assert.match(workoutStateSource, /Carry the weight just used forward/);
      assert.match(workoutStateSource, /nextSet\.draftLoadText = formatWeightInputValue\(set\.actualLoadKg/);
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

      assert.match(screenSource, /t\(language, 'logger\.addExercise'\)/);
      assert.match(i18nSource, /'logger\.addExercise': '\+ Add exercise'/);
      assert.match(screenSource, /addExerciseButton/);
      assert.match(screenSource, /color:\s*'#5B21B6'/);
      assert.match(screenSource, /fontSize:\s*15/);
      assert.match(screenSource, /borderRadius:\s*radii\.pill/);
      assert.match(screenSource, /t\(language, 'logger\.cancel'\)/);
      assert.match(i18nSource, /'logger\.cancel': 'Cancel workout'/);
      assert.match(screenSource, /cancelWorkoutButton/);
      assert.match(screenSource, /onPress=\{onDiscardWorkout\}/);
      assert.match(screenSource, /color:\s*'#DC2626'/);

      // Finish no longer opens a confirm sheet first: with data logged it saves
      // straight away; with nothing logged it asks "are you sure" in a centered
      // dialog before discarding. The old bottom "Finish workout" sheet is gone.
      assert.match(screenSource, /if \(hasPersistableWorkoutData\) \{\s*\n\s*\/\/[^\n]*\n\s*onConfirmFinishWorkout\(\);/);
      assert.match(screenSource, /setDiscardConfirmVisible\(true\)/);
      assert.match(screenSource, /dialogOverlay/);
      assert.match(screenSource, /t\(language, 'logger\.discard\.title'\)/);
      assert.match(i18nSource, /'logger\.discard\.title': 'Discard workout\?'/);
      assert.match(i18nSource, /'logger\.discard\.body': 'Nothing has been logged yet\./);
      assert.doesNotMatch(screenSource, /Save this workout now/);
      assert.doesNotMatch(screenSource, />Finish workout</);
      assert.doesNotMatch(screenSource, /finishReviewVisible/);
      // The resume-workout toast is gone (was the odd dark banner on Start).
      assert.doesNotMatch(readSource(appPath), /Resume current workout before starting another/);

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
      // Save truthfulness: the session may only be finished AFTER the database
      // save resolves — finishing first stranded the logged sets when a save
      // failed (they were gone on the next launch).
      assert.match(appSource, /const summary = await saveCompletedWorkoutSession[\s\S]*workout\.finishWorkout\(adaptedSession\.performedAt\);/);
      assert.doesNotMatch(appSource, /workout\.finishWorkout\(adaptedSession\.performedAt\);[\s\S]*const summary = await saveCompletedWorkoutSession/);
      assert.match(appSource, /setCompletionSummary\([\s\S]*summaryNavigationPendingRef\.current = true;[\s\S]*workout\.clearCompletedWorkout\(\);[\s\S]*replaceRoute\(\{ tab: 'workout', screen: 'summary' \}\)/);
    },
  },
];
