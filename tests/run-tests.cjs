const suites = [
  ...require('./features/workout/workoutAppAdapter.test.cjs'),
  ...require('./features/workout/workoutState.test.cjs'),
  ...require('./state/completedWorkoutPersistence.test.cjs'),
  ...require('./integration/liveWorkoutSavePipeline.test.cjs'),
  ...require('./lib/workoutInput.test.cjs'),
  ...require('./lib/workoutFlow.test.cjs'),
  ...require('./lib/workoutValidation.test.cjs'),
  ...require('./lib/workoutLoggingSessionBootstrap.test.cjs'),
  ...require('./lib/workoutLoggerNavigation.test.cjs'),
  ...require('./lib/exerciseInfo.test.cjs'),
  ...require('./lib/adaptiveCoach.test.cjs'),
  ...require('./lib/routeHistory.test.cjs'),
  ...require('./lib/dashboard.test.cjs'),
  ...require('./lib/progressionActivePlan.test.cjs'),
  ...require('./lib/progressionSignal.test.cjs'),
  ...require('./lib/homeProgramSelection.test.cjs'),
  ...require('./lib/homePrimaryAction.test.cjs'),
  ...require('./lib/aiTrainingContext.test.cjs'),
  ...require('./lib/valluActions.test.cjs'),
  ...require('./lib/displayLabel.test.cjs'),
  ...require('./lib/tailoring.test.cjs'),
  ...require('./lib/tailoringFit.test.cjs'),
  ...require('./lib/recommendationExplanation.test.cjs'),
  ...require('./lib/recommendationPresentation.test.cjs'),
  ...require('./lib/recommendationProgramme.test.cjs'),
  ...require('./lib/recommendationScoring.test.cjs'),
  ...require('./lib/firstRunSetup.test.cjs'),
  ...require('./lib/workoutDiscovery.test.cjs'),
  ...require('./lib/historyView.test.cjs'),
  ...require('./lib/programDetails.test.cjs'),
  ...require('./lib/readyProgramDuplication.test.cjs'),
  ...require('./lib/customProgramDuplication.test.cjs'),
  ...require('./lib/programInsights.test.cjs'),
  ...require('./lib/readyProgramCatalog.test.cjs'),
  ...require('./lib/readyProgramCollections.test.cjs'),
  ...require('./lib/startingWeek.test.cjs'),
  ...require('./lib/workoutTemplateSessions.test.cjs'),
  ...require('./lib/workoutEditorNaming.test.cjs'),
  ...require('./lib/workoutEditorTable.test.cjs'),
];

let failed = 0;

for (const suite of suites) {
  try {
    suite.run();
    console.log(`PASS ${suite.name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${suite.name}`);
    console.error(error);
  }
}

if (failed > 0) {
  process.exitCode = 1;
  console.error(`\n${failed} test(s) failed.`);
} else {
  console.log(`\n${suites.length} test(s) passed.`);
}
