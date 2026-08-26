/**
 * Compile-freshness gate. Runs before the first require, because the suites
 * themselves load .test-dist.
 *
 * The trap this closes has bitten more than once: tests import compiled
 * output, so editing src/ and re-running gives a green suite that proves
 * yesterday's code — and deleting a src file leaves its compiled module
 * behind, still importable, still green. "rm -rf .test-dist before trusting
 * green" lived in a note; now the runner refuses on its own.
 */
{
  const fs = require('node:fs');
  const path = require('node:path');
  const root = path.join(__dirname, '..');
  const srcDir = path.join(root, 'src');
  const distDir = path.join(root, '.test-dist');

  const walk = (dir, ext, out = []) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full, ext, out);
      else if (entry.name.endsWith(ext)) out.push(full);
    }
    return out;
  };

  const problems = [];
  if (!fs.existsSync(distDir)) {
    problems.push('.test-dist does not exist');
  } else {
    for (const source of walk(srcDir, '.ts')) {
      if (source.endsWith('.d.ts')) continue;
      const rel = path.relative(srcDir, source);
      const compiled = path.join(distDir, rel.replace(/\.ts$/, '.js'));
      if (!fs.existsSync(compiled)) {
        problems.push(`never compiled: src/${rel}`);
      } else if (fs.statSync(compiled).mtimeMs < fs.statSync(source).mtimeMs) {
        problems.push(`older than its source: src/${rel}`);
      }
    }

    for (const compiled of walk(distDir, '.js')) {
      const rel = path.relative(distDir, compiled);
      // tsc follows imports beyond the include list, so a compiled module's
      // source can be .ts or .tsx.
      const stem = path.join(srcDir, rel.replace(/\.js$/, ''));
      if (!fs.existsSync(`${stem}.ts`) && !fs.existsSync(`${stem}.tsx`)) {
        problems.push(`source deleted but still compiled: .test-dist/${rel}`);
      } else if (
        fs.existsSync(`${stem}.tsx`) &&
        fs.statSync(compiled).mtimeMs < fs.statSync(`${stem}.tsx`).mtimeMs
      ) {
        // .tsx staleness lands here; the src walk above only sees .ts.
        problems.push(`older than its source: ${path.relative(root, `${stem}.tsx`)}`);
      }
    }
  }

  if (problems.length > 0) {
    console.error('.test-dist does not match src/ — a green run would prove nothing:');
    for (const problem of problems.slice(0, 15)) {
      console.error(`  ${problem}`);
    }
    if (problems.length > 15) {
      console.error(`  ...and ${problems.length - 15} more`);
    }
    console.error('\nRecompile first:');
    console.error('  Remove-Item -Recurse -Force .test-dist; npx tsc -p tsconfig.test.json');
    process.exit(1);
  }
}

const suites = [
  ...require('./releaseReadiness.test.cjs'),
  ...require('./scripts/slackNotify.test.cjs'),
  ...require('./lib/appIcon.test.cjs'),
  ...require('./lib/promoCodes.test.cjs'),
  ...require('./lib/proBenefits.test.cjs'),
  ...require('./features/workout/workoutAppAdapter.test.cjs'),
  ...require('./features/workout/workoutState.test.cjs'),
  ...require('./state/completedWorkoutPersistence.test.cjs'),
  ...require('./utils/haptics.test.cjs'),
  ...require('./utils/reduceMotion.test.cjs'),
  ...require('./components/primaryCTAButton.test.cjs'),
  ...require('./integration/liveWorkoutSavePipeline.test.cjs'),
  ...require('./lib/workoutInput.test.cjs'),
  ...require('./lib/workoutContentFit.test.cjs'),
  ...require('./lib/sessionGuidance.test.cjs'),
  ...require('./lib/guidedPlayer.test.cjs'),
  ...require('./lib/exerciseHistoryLookup.test.cjs'),
  ...require('./lib/sessionAdaptation.test.cjs'),
  ...require('./lib/sessionDuration.test.cjs'),
  ...require('./lib/holdTracking.test.cjs'),
  ...require('./lib/cardio.test.cjs'),
  ...require('./lib/workoutLoggerNavigation.test.cjs'),
  ...require('./lib/exerciseSuggestions.test.cjs'),
  ...require('./lib/routeHistory.test.cjs'),
  ...require('./lib/dashboard.test.cjs'),
  ...require('./lib/progressionActivePlan.test.cjs'),
  ...require('./lib/progressionSignal.test.cjs'),
  ...require('./lib/exerciseProgressForName.test.cjs'),
  ...require('./lib/lifetimeSummary.test.cjs'),
  ...require('./lib/profileOverview.test.cjs'),
  ...require('./lib/homeStatCards.test.cjs'),
  ...require('./lib/homeCardSuggestions.test.cjs'),
  ...require('./lib/ratingPrompt.test.cjs'),
  ...require('./lib/blurredPreviewText.test.cjs'),
  ...require('./lib/bodyweightCard.test.cjs'),
  ...require('./lib/programFamilyIdentity.test.cjs'),
  ...require('./lib/programCatalogFocus.test.cjs'),
  ...require('./lib/seasonEnrolment.test.cjs'),
  ...require('./lib/deviceLanguage.test.cjs'),
  ...require('./lib/i18n.test.cjs'),
  ...require('./lib/premiumHeroChart.test.cjs'),
  ...require('./lib/proChatHero.test.cjs'),
  ...require('./lib/trainingRhythm.test.cjs'),
  ...require('./lib/progressionAnalyzer.test.cjs'),
  ...require('./lib/fatigueModel.test.cjs'),
  ...require('./lib/progressActivity.test.cjs'),
  ...require('./lib/postSessionInsight.test.cjs'),
  ...require('./lib/proEntitlement.test.cjs'),
  ...require('./lib/proSurfaces.test.cjs'),
  ...require('./lib/subscriptionView.test.cjs'),
  ...require('./lib/cancelSurvey.test.cjs'),
  ...require('./lib/legalDocuments.test.cjs'),
  ...require('./lib/notificationPlan.test.cjs'),
  ...require('./lib/programCsvExport.test.cjs'),
  ...require('./lib/setupHandoff.test.cjs'),
  ...require('./lib/quickLayoutExercises.test.cjs'),
  ...require('./lib/exerciseSearch.test.cjs'),
  ...require('./lib/libraryLabel.test.cjs'),
  ...require('./lib/goalProgramme.test.cjs'),
  ...require('./lib/liftIdentity.test.cjs'),
  ...require('./lib/programmeBrief.test.cjs'),
  ...require('./lib/widgetPayload.test.cjs'),
  ...require('./lib/widgetResources.test.cjs'),
  ...require('./lib/theming.test.cjs'),
  ...require('./lib/proInsights.test.cjs'),
  ...require('./lib/aiCoachQuota.test.cjs'),
  ...require('./lib/coachChat.test.cjs'),
  ...require('./lib/coachSmallTalk.test.cjs'),
  ...require('./lib/coachConversation.test.cjs'),
  ...require('./lib/analytics.test.cjs'),
  ...require('./lib/coachSuggestions.test.cjs'),
  ...require('./lib/aiCoachCostModel.test.cjs'),
  ...require('./lib/trainingHistory.test.cjs'),
  ...require('./lib/serialTaskQueue.test.cjs'),
  ...require('./lib/catalogExercisePools.test.cjs'),
  ...require('./lib/onboardingPlanSweep.test.cjs'),
  ...require('./lib/progressionGate.test.cjs'),
  ...require('./lib/programSlots.test.cjs'),
  ...require('./lib/programSeasons.test.cjs'),
  ...require('./lib/personalRecords.test.cjs'),
  ...require('./lib/sessionFeel.test.cjs'),
  ...require('./lib/exerciseNameBook.test.cjs'),
  ...require('./lib/programImageImport.test.cjs'),
  ...require('./lib/recordWindow.test.cjs'),
  ...require('./lib/exerciseSetLog.test.cjs'),
  ...require('./lib/logRecordedWork.test.cjs'),
  ...require('./lib/authoredProgramCount.test.cjs'),
  ...require('./lib/uncalledExports.test.cjs'),
  ...require('./lib/cutCorner.test.cjs'),
  ...require('./lib/programEquipment.test.cjs'),
  ...require('./lib/progressionRuleLabel.test.cjs'),
  ...require('./lib/singleRepTarget.test.cjs'),
  ...require('./lib/intervalScheme.test.cjs'),
  ...require('./lib/todaySessionPick.test.cjs'),
  ...require('./lib/programBrowse.test.cjs'),
  ...require('./lib/readyProgramCards.test.cjs'),
  ...require('./lib/exerciseInstructionsFi.test.cjs'),
  ...require('./lib/buildArchitectures.test.cjs'),
  ...require('./lib/season.test.cjs'),
  ...require('./lib/programCategories.test.cjs'),
  ...require('./lib/programFingerprint.test.cjs'),
  ...require('./lib/strengthGoals.test.cjs'),
  ...require('./lib/historyWindow.test.cjs'),
  ...require('./lib/workoutLogCsvExport.test.cjs'),
  ...require('./lib/aiCoachBudget.test.cjs'),
  ...require('./lib/aiCoachLiveGate.test.cjs'),
  ...require('./lib/accountBackup.test.cjs'),
  ...require('./lib/hevyImport.test.cjs'),
  ...require('./lib/measurementIntent.test.cjs'),
  ...require('./lib/goalIntent.test.cjs'),
  ...require('./lib/aiCoachBody.test.cjs'),
  ...require('./lib/aiCoachEval.test.cjs'),
  ...require('./api/aiCoachEndpoint.test.cjs'),
  ...require('./lib/aiCoachModules.test.cjs'),
  ...require('./lib/sessionAnalysis.test.cjs'),
  ...require('./lib/coachHighlight.test.cjs'),
  ...require('./lib/homeProgramSelection.test.cjs'),
  ...require('./lib/homePrimaryAction.test.cjs'),
  ...require('./lib/homePlanProgress.test.cjs'),
  ...require('./lib/homeSessionHero.test.cjs'),
  ...require('./lib/sessionFocusClassification.test.cjs'),
  ...require('./lib/substitutionGroups.test.cjs'),
  ...require('./lib/workoutCompleteView.test.cjs'),
  ...require('./lib/homeCalendar.test.cjs'),
  ...require('./lib/trainingSchedule.test.cjs'),
  ...require('./lib/readableOn.test.cjs'),
  ...require('./lib/workoutPauseClock.test.cjs'),
  ...require('./lib/historyDelete.test.cjs'),
  ...require('./screens/guidedPlayerSwap.test.cjs'),
  ...require('./screens/setPanels.test.cjs'),
  ...require('./screens/completionHero.test.cjs'),
  ...require('./screens/leadProgram.test.cjs'),
  ...require('./lib/homeVisuals.test.cjs'),
  ...require('./lib/aiTrainingContext.test.cjs'),
  ...require('./lib/aiCoachSystemContext.test.cjs'),
  ...require('./lib/aiCoachProgramme.test.cjs'),
  ...require('./lib/coachComposeOffer.test.cjs'),
  ...require('./lib/briefProgrammeMatch.test.cjs'),
  ...require('./lib/extraExerciseLibrary.test.cjs'),
  ...require('./lib/sessionDrops.test.cjs'),
  ...require('./lib/programCapNotice.test.cjs'),
  ...require('./lib/swapShortlist.test.cjs'),
  ...require('./lib/aiCoachPreview.test.cjs'),
  ...require('./lib/coachChipAnswers.test.cjs'),
  ...require('./lib/aiCoachActions.test.cjs'),
  ...require('./lib/displayLabel.test.cjs'),
  ...require('./lib/decimalSeparator.test.cjs'),
  ...require('./lib/localizedFormatting.test.cjs'),
  ...require('./lib/tailoringFit.test.cjs'),
  ...require('./lib/recommendationExplanation.test.cjs'),
  ...require('./lib/recommendationProfile.test.cjs'),
  ...require('./lib/recommendationPresentation.test.cjs'),
  ...require('./lib/recommendationProgramme.test.cjs'),
  ...require('./lib/csvProgramImport.test.cjs'),
  ...require('./lib/recommendationScoring.test.cjs'),
  ...require('./lib/recommendationBackfill.test.cjs'),
  ...require('./lib/recommendationWaterfall.test.cjs'),
  ...require('./lib/recommendationReach.test.cjs'),
  ...require('./lib/recommendationWaterfallCopy.test.cjs'),
  ...require('./lib/firstRunSetup.test.cjs'),
  ...require('./lib/focusAreaPresentation.test.cjs'),
  ...require('./lib/programFocusSplit.test.cjs'),
  ...require('./lib/programDayComposer.test.cjs'),
  ...require('./lib/cautionExerciseFilter.test.cjs'),
  ...require('./lib/focusEmphasis.test.cjs'),
  ...require('./lib/equipmentExerciseFilter.test.cjs'),
  ...require('./lib/onboardingStructure.test.cjs'),
  ...require('./screens/homeScreenStructure.test.cjs'),
  ...require('./screens/programsHomeStructure.test.cjs'),
  ...require('./screens/programPlanOverview.test.cjs'),
  ...require('./screens/addExerciseSheet.test.cjs'),
  ...require('./screens/cardioPlayer.test.cjs'),
  ...require('./screens/onboardingVisualPolish.test.cjs'),
  ...require('./screens/headerBackReachable.test.cjs'),
  ...require('./lib/workoutDiscovery.test.cjs'),
  ...require('./lib/historyView.test.cjs'),
  ...require('./lib/programDetails.test.cjs'),
  ...require('./lib/customProgramDuplication.test.cjs'),
  ...require('./lib/programInsights.test.cjs'),
  ...require('./lib/readyProgramCatalog.test.cjs'),
  ...require('./lib/readyProgramCollections.test.cjs'),
  ...require('./lib/readyProgramDuration.test.cjs'),
  ...require('./lib/workoutTemplateSessions.test.cjs'),
  ...require('./lib/workoutEditorNaming.test.cjs'),
  ...require('./lib/workoutEditorTable.test.cjs'),
  ...require('./lib/plateMath.test.cjs'),
  ...require('./lib/programAdoption.test.cjs'),
  ...require('./lib/planRotation.test.cjs'),
  ...require('./integration/planRotationAdvances.test.cjs'),
  ...require('./lib/programTrainingDays.test.cjs'),
  ...require('./lib/trainingWeekSync.test.cjs'),
  ...require('./lib/restSchedule.test.cjs'),
  ...require('./lib/programCompletion.test.cjs'),
  ...require('./lib/programEmphasis.test.cjs'),
  ...require('./lib/programEmphasisAdjust.test.cjs'),
  ...require('./lib/activeProgramSet.test.cjs'),
  ...require('./lib/emptyWorkoutSession.test.cjs'),
  ...require('./lib/sessionNameLabel.test.cjs'),
  ...require('./lib/readyProgramContentFi.test.cjs'),
  ...require('./lib/exerciseNameLabel.test.cjs'),
  ...require('./storage/firstLaunchIsEmpty.test.cjs'),
  ...require('./storage/corruptDatabase.test.cjs'),
  ...require('./lib/untranslatedCopy.test.cjs'),
  ...require('./lib/homeCalendarPaging.test.cjs'),
  ...require('./lib/drillMedia.test.cjs'),
  ...require('./lib/userFitnessProfile.test.cjs'),
];

(async () => {
  let failed = 0;

  for (const suite of suites) {
    try {
      // Await so async suites (e.g. serialTaskQueue) can actually fail; sync
      // suites are unaffected.
      await suite.run();
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
})();
