import './src/globalFont';

import React, { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, BackHandler, Linking, Platform, View } from 'react-native';
import Constants from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Font from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';

import { AppShell } from './src/components/AppShell';
import { BottomTabBar } from './src/components/BottomTabBar';
import { getMonthTrainingTotals } from './src/lib/dashboard';
import { formatDurationMinutes, formatRepRange, formatSetScheme, formatShortDate, formatTime, formatVolume, formatWeight, pluralize, removeTrailingZeros } from './src/lib/format';
import { createId } from './src/lib/ids';
import { HistoryScrollMemory } from './src/lib/historyScrollMemory';
import {
  buildFirstRunRecommendationReasons,
  FirstRunSetupSelection,
  getFocusAreaTitle,
  isSetupDaysPerWeek,
} from './src/lib/firstRunSetup';
import { formatWorkoutDisplayLabel } from './src/lib/displayLabel';
import { buildCardioStatsLine, getCardioActivity } from './src/lib/cardio';
import { haptics } from './src/utils/haptics';
import { useScheduledNotifications } from './src/hooks/useScheduledNotifications';
import { usePendingAiLogDeletions } from './src/hooks/usePendingAiLogDeletions';
import { ThemeProvider, themeForName, useTheme } from './src/theming';
import { writeHomeWidgetPayload } from './src/utils/homeWidget';
import {
  isHomeWidgetAdded,
  isHomeWidgetSupported,
  refreshHomeWidget,
  requestPinHomeWidget,
} from './modules/home-widget';
import { buildHomeWidgetPayload, HomeWidgetTarget, resolveHomeWidgetSessionTap } from './src/lib/widgetPayload';
import { parseWidgetDeepLink } from './src/lib/widgetDeepLink';
import { planSetupHandoff } from './src/lib/setupHandoff';
import { SetupHandoffChoices, SetupHandoffScreen } from './src/screens/SetupHandoffScreen';
import { LegalDocumentScreen } from './src/screens/LegalDocumentScreen';
import { LEGAL_LAST_UPDATED, formatLegalDate, type LegalDocumentId } from './src/lib/legalDocuments';
import { acceptLegal, legalAcceptanceDue } from './src/lib/legalAcceptance';
import { LegalConsentSheet } from './src/components/LegalConsentSheet';
import { FirstRunTour } from './src/components/FirstRunTour';
import { createTourTargetRegistry } from './src/features/tour/tourTargets';
import {
  isTourDue,
  markTourSeen,
  resolveTourBeats,
  resolveTourSurface,
  TourBarStop,
  TourTargetId,
  TourSurface,
} from './src/lib/firstRunTour';
import { useAccountBackup } from './src/features/account/useAccountBackup';
import { hasWorkoutInProgress } from './src/lib/accountBackup';
import { useAccountOutcome } from './src/app/useAccountOutcome';
import { getReadyTemplatePresentation } from './src/lib/templatePresentation';
import {
  activateOnboardingPlan,
  addActiveProgram,
  findReplaceableOnboardingTemplateId,
  evaluateProgramAdoption,
  ONBOARDING_PLAN_PREFIX,
  removeActiveProgram,
  resolveActiveProgramCap,
} from './src/lib/activeProgramSet';
import {
  leadTemplateId,
  listHeldProgrammes,
  resumeProgramme,
  stopProgramme,
  switchActiveProgramme,
} from './src/lib/runningProgrammes';
import {
  buildReadyProgramPlanId,
  buildCustomProgramPlanId,
  buildProgramWorkoutPlan,
} from './src/lib/programAdoption';
import { describeProgramCap, programCapLineKey } from './src/lib/programCapNotice';
import { computePostSessionInsight } from './src/lib/postSessionInsight';
import { composeProgramWeekForSelection } from './src/lib/programDayComposer';
import { getProgrammeBlockWeeks, getReadyProgramBlockWeeks } from './src/lib/readyProgramDuration';
import { getReadyProgramContent } from './src/lib/readyProgramContent';
import {
  getCalendarDayStartTimestamp,
  getCanonicalCompletedSessions,
  getRecentActivityStrip,
} from './src/lib/completedSessions';
import { useRecordsAndMilestones } from './src/app/useRecordsAndMilestones';
import { markCoachDemoMomentUsed } from './src/lib/coachDemoMoments';
import { blockWeekOfSession, blockWeekTally, buildHomePlanProgress } from './src/lib/homePlanProgress';
import { resolveHomePrompt } from './src/lib/homePrompts';
import {
  buildSessionEquipmentLabel,
  classifySessionFocus,
  getSessionBodyFocusLabel,
} from './src/lib/homeSessionHero';
import { estimateSessionMinutes } from './src/lib/sessionDuration';
import { buildMuscleFocus, getVolumeDeltaVsPrevious } from './src/lib/workoutCompleteView';
import { buildHomeQuickStats, buildHomeUpcomingSessions } from './src/lib/homeVisuals';
import { I18nKey, t } from './src/lib/i18n';
import { isProUnlocked, resolveProEntitlement, resolveProgressionOptions } from './src/lib/proEntitlement';
import { ThemeChoiceDialog } from './src/components/ThemeChoiceDialog';
import { resolveThemeName } from './src/lib/themePreference';
import { localizeSessionFocus, localizeSessionName } from './src/lib/sessionNameLabel';
import { trackEvent } from './src/features/analytics/analyticsClient';
import { countsAsAppOpen, joinedRunningSet } from './src/lib/analyticsMoments';

import { resolveWorkoutLoggerFallbackRoute } from './src/lib/workoutLoggerNavigation';
import { CoachChatMemory } from './src/lib/coachChatMemory';
import { CoachAdviceMemoryEntry } from './src/lib/coachAdviceMemory';
import { clearCoachAdviceMemory } from './src/storage/coachAdviceMemoryStore';
import type { ChatMessage } from './src/screens/AICoachChatScreen';
import {
  toDraftExercise,
} from './src/lib/programSessionEdit';
import { hasOnlyEmptyDays, nextStartableSessionIndex } from './src/lib/programSessionList';
import { ProgramLimitReachedError } from './src/lib/programSlots';
import { createUnlessAtLimit } from './src/app/programLimitGuard';
import { useProgramExerciseEdit } from './src/app/useProgramExerciseEdit';
import {
  ProgramSeason,
  getSeasonProgramId,
  getSeasonProgramIds,
} from './src/lib/programSeasons';
import {
  SEASON_COLORS,
  SEASON_WEEKS,
  SeasonWindow,
  formatSeasonDateRange,
  nextSeasonWindow,
  resolveSeasonWindow,
  seasonLastDay,
  seasonProgressRatio,
  seasonWeek,
  seasonWeeksLeft,
} from './src/lib/season';
import { isMeasurementCardKey } from './src/lib/homeStatCards';
import { planTrainedOnDay, resolveNextPlanEntryIndex } from './src/lib/planRotation';
import { alignHistoryToCopiedDays, programmeHistoryIds } from './src/lib/programLineage';
import { cycleSchedule, weekdaySchedule, withRestDays } from './src/lib/trainingSchedule';
import {
  isLightenPending,
  lightenedFatigueSignal,
  lightenRuntimeTemplate,
} from './src/lib/recoverySheet';
import { useRecoverySheet } from './src/app/useRecoverySheet';
import {
  planWeekdayIndexes,
  resolveProgramTrainingDays,
  WEEKDAY_KEYS,
} from './src/lib/programTrainingDays';
import {
  planLabelsForProgramme,
  planLabelsFromWeekdays,
  rotateLabelsForNextSession,
  weekdaysFromPlanLabels,
} from './src/lib/trainingWeekSync';
import { programCoverStyle } from './src/lib/programVisualIdentity';
import { countSessionsSince, resolveCompletionCard } from './src/lib/programCompletion';
import { backfillRecommendations } from './src/lib/recommendationBackfill';
import { expandRunningIdsWithSources, findReadyProgrammeCopyId } from './src/lib/programmeCopyLink';
import { useGoalFlow } from './src/app/useGoalFlow';
import {
  addSeasonEnrolment,
  isEnrolled,
} from './src/lib/seasonEnrolment';
import { buildProgramFingerprint } from './src/lib/programFingerprint';
import {
  countByCategory,
  filterByCategory,
  PROGRAM_CATEGORIES,
  ProgramCategoryKey,
} from './src/lib/programCategories';
import { ProgramLimitSheet } from './src/components/ProgramLimitSheet';
import { RateAppSheet } from './src/components/RateAppSheet';
import { decideRatingPrompt, recordRatingAsked, recordRatingCompleted } from './src/lib/ratingPrompt';

/**
 * The listing, opened by every star. Not the in-app review API: Google's own
 * card must not be preceded by a custom prompt that asks for a rating, and the
 * sheet is exactly that.
 */
const PLAY_LISTING_URL = 'https://play.google.com/store/apps/details?id=app.vinha';
import { buildCustomSessionRuntimeTemplate, buildReadySessionRuntimeTemplate } from './src/lib/programDetails';
import {
  AdaptedSessionRef,
  applySessionAdaptation,
  HeldSessionAdaptations,
  heldAdaptationFor,
  NO_HELD_SESSION_ADAPTATIONS,
  SessionAdaptation,
  spendHeldAdaptation,
  updateHeldAdaptation,
  withoutSessionDrop,
  withSessionDrop,
  withSessionSwap,
} from './src/lib/sessionAdaptation';
import { forgetRoutesForTemplate, popRoute, pushRoute, withoutTrailingRoute } from './src/navigation/routeHistory';
import { liveSessionBlocksProgrammeDelete } from './src/lib/programmeDeletion';
import { AppRoute, ROOT_ROUTES, RootTabKey, WORKOUT_PLAN_ROUTE } from './src/navigation/routes';
import { backSkipsHistory, getBackRoute } from './src/app/backRoute';
import { renderProfileTab } from './src/app/renderProfileTab';
import { resolveTodaySessionPick } from './src/lib/todaySessionPick';
import { renderHomeScreens } from './src/app/renderHomeScreens';
import { renderWorkoutTab } from './src/app/renderWorkoutTab';
import { renderProgressTab } from './src/app/renderProgressTab';
import { formatGoalLabel, formatHomeSessionTitle } from './src/app/homeSessionTitle';
import { useSessionNotifications } from './src/app/useSessionNotifications';
import { useNotificationRoute } from './src/app/useNotificationRoute';
import { useCoachContext } from './src/app/useCoachContext';
import { createProgrammeDayEdits } from './src/app/programmeDayEdits';
import {
  buildSavedOnboardingPlan,
  buildSavedOnboardingWorkoutPlan,
  buildSetupPreferencePatch,
} from './src/app/onboardingHandoff';
import {
  buildCompletionCardsFromAdaptedSession,
  buildSessionMovement,
  buildExerciseLogsForCompletedSession,
  CompletionSummaryState,
  getEndOfWeek,
  getStartOfWeek,
} from './src/app/workoutCompletionState';
import { useDeviceSwitches } from './src/app/useDeviceSwitches';
import { useFunnelAnalytics } from './src/app/useFunnelAnalytics';
import { useInstallStamps } from './src/app/useInstallStamps';
import { useSetupWeightSeed } from './src/app/useSetupWeightSeed';
import { useTodayKey } from './src/app/useTodayKey';
import { useDaySummaries } from './src/app/useDaySummaries';
import { useCoachDemoMoment } from './src/app/useCoachDemoMoment';
import { useCoachEntryReadings } from './src/app/useCoachEntryReadings';
import { useRoutineBlockCosts } from './src/app/useRoutineBlockCosts';
import { useSetupReadings } from './src/app/useSetupReadings';
import { useLeadPlanRepair } from './src/app/useLeadPlanRepair';
import { useTemplateBuilderDraft } from './src/app/useTemplateBuilderDraft';
import { useProInsights } from './src/app/useProInsights';
import { useHomeStatCards } from './src/app/useHomeStatCards';
import { useCoachAdviceMemory } from './src/app/useCoachAdviceMemory';
import { useCustomProgramViews } from './src/app/useCustomProgramViews';
import { buildSessionAnalysis } from './src/lib/sessionAnalysis';
import { AboutYouScreen, AboutYouValues } from './src/screens/AboutYouScreen';
import { LaunchScreen } from './src/screens/LaunchScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { OnboardingReadyCatalogScreen } from './src/screens/OnboardingReadyCatalogScreen';
import { StartPathScreen } from './src/screens/StartPathScreen';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import { setNumberLanguage } from './src/lib/format';
import { programTableToCsv } from './src/lib/programImageImport';
import { pickProgramImage, type ProgramImageImportResult } from './src/utils/programImagePicker';
import { VinhaSplashScreen } from './src/screens/VinhaSplashScreen';
import { ExportablePlan } from './src/screens/ExportPlanScreen';
import { NewProgramSheet } from './src/components/NewProgramSheet';
import { buildCoachContextChips } from './src/lib/coachChat';
import { isAiCoachLiveConfigured, requestProgramTableFromImage } from './src/lib/aiCoachClient';
import { accountNameStep } from './src/lib/accountNameAdoption';
import type { CatalogScreenItem } from './src/screens/CatalogScreen';
import { ProgramsExploreItem } from './src/screens/ProgramsHomeScreen';
import { WorkoutCompletionScreen } from './src/screens/WorkoutCompletionScreen';
import { FreestyleFinishSummary } from './src/lib/emptyWorkoutSession';
import { WorkoutProvider, useWorkoutContext } from './src/features/workout/WorkoutProvider';
import { AdaptedCompletedWorkoutExercise, adaptCompletedWorkoutSessionForAppDatabase } from './src/features/workout/workoutAppAdapter';
import { getWorkoutTemplateById, WORKOUT_TEMPLATES_V1 } from './src/features/workout/workoutCatalog';
import { isTimedTrackingMode } from './src/features/workout/workoutTypes';
import { AppProvider, useAppContext } from './src/state/AppProvider';
import { AppUpdateDialog } from './src/features/appUpdate/AppUpdateDialog';
import { ServerNoticeDialog } from './src/features/serverNotice/ServerNoticeDialog';
import { rememberServerNotice } from './src/lib/serverNotice';
import { registerAppIdentity } from './src/features/appUpdate/appUpdateSignal';
import { appInfo } from './src/theme';
import {
  AppLanguage,
  AppPreferences,
  ExerciseTemplateDraft,
  SetupCautionFlag,
  SetupDaysPerWeek,
  SetupWeekday,
  SetupGender,
  UnitPreference,
  WorkoutTemplateDraft,
} from './src/types/models';

void SplashScreen.preventAutoHideAsync().catch(() => {
  // Native splash may already be controlled by the host app during fast refresh.
});

interface NavigationState {
  route: AppRoute;
  history: AppRoute[];
}

interface FinishSaveState {
  status: 'idle' | 'saving' | 'error';
  sessionId: string | null;
  message: string | null;
}

/**
 * Reads the inset for NewProgramSheet's Modal.
 *
 * VinhaApp itself cannot call `useSafeAreaInsets` — it is the component that
 * RETURNS `<AppShell>`, so its own fiber sits above AppShell's
 * SafeAreaProvider, not inside it, and the hook throws with no provider to
 * read from. This wrapper is rendered as an AppShell child instead (in the
 * same spot NewProgramSheet used to sit), which puts it inside the provider,
 * and it renders no Modal of its own — the same shape as a screen that reads
 * insets and hands them to a sheet component (#bugs 2026-08-28 pattern).
 */
function SettingsImportSheet(props: Omit<React.ComponentProps<typeof NewProgramSheet>, 'bottomInset'>) {
  const insets = useSafeAreaInsets();
  return <NewProgramSheet {...props} bottomInset={insets.bottom} />;
}

function VinhaApp() {
  const theme = useTheme();
  const {
    database,
    hydrated,
    preferences,
    unitPreference,
    workoutTemplates,
    exerciseLibrary,
    workoutSessions,
    cardioSessions,
    trackedProgress,
    bodyweightProgress,
    measurementEntries,
    exerciseNameBook,
    teachExerciseName,
    getWorkoutExercises,
    getWorkoutTemplateSessions,
    getSessionLogs,
    updatePreferences,
    completeOnboarding,
    upsertWorkoutTemplate,
    renameWorkoutTemplate,
    editWorkoutTemplateSessions,
    findWorkoutTemplateIdBySource,
    getWorkoutTemplateSessionsFresh,
    programSlots,
    upsertWorkoutPlan,
    saveOnboardingResult,
    deleteWorkoutTemplate,
    forgetHeldProgramme,
    resetAllData,
    clearPendingAiLogDeletions,
    retireAiLogLabel,
    addBodyweightEntry,
    addMeasurementEntry,
    deleteBodyweightEntry,
    deleteMeasurementEntry,
    saveCompletedWorkoutSession,
    updateCompletedWorkoutSession,
    deleteCompletedWorkoutSession,
    deleteCardioSession,
    saveCardioSession,
    restoreDatabaseFromBackup,
    importWorkoutHistory,
  } = useAppContext();
  const workout = useWorkoutContext();
  // For listeners that must not re-subscribe on every workout change: the
  // context is a new object once a second while a rest timer or cardio runs.
  const workoutRef = useRef(workout);
  workoutRef.current = workout;
  // A boolean, so the back listener below can ask it without depending on the
  // whole context: this flips only when a run starts or goes away.
  const cardioRunActive = workout.activeCardio !== null;

  // Account & cloud backup: sign in with Google on the hand-off card or in
  // Settings, and the data survives a new phone. Free and Pro alike (decision
  // 2026-08-22). Absent entirely in builds without the OAuth client id.
  const accountBackup = useAccountBackup({
    // Both stores, not the database alone: the workout store can load later
    // (its Retry screen), and a backup before then uploads the empty history
    // it starts with over the real one. The same as appHydrated below.
    hydrated: hydrated && workout.hydrated,
    // Everything a restore puts away, the free workout's board included.
    liveSession: hasWorkoutInProgress(workout),
    database,
    workoutHistory: workout.history,
    restoreDatabase: restoreDatabaseFromBackup,
    restoreWorkoutHistory: workout.restoreHistoryFromBackup,
    // A landed restore replaces the database and the workout history — but
    // not the coach's own memory, which lives outside both (this component's
    // state, plus its own AsyncStorage key). Left alone, it would survive a
    // restore that just replaced everything else, another account's data
    // included. Same reasoning as handleResetAllData below, which clears it
    // for the reset path; not fired on "keep this phone's data" or a failed
    // restore, since useAccountBackup only calls this once both stores land.
    onRestored: async () => {
      setCoachAdviceMemory([]);
      setCoachChatMemory(null);
      // Awaited: useAccountBackup's applyRestore holds the restore open
      // until this settles, so a process kill cannot land the restore while
      // the erase is still on disk (recheck round, 2026-09-29).
      await clearCoachAdviceMemory();
    },
  });

  /**
   * Where "back to the programmes" lands.
   *
   * Three routes used to stand in for this: the tab bar opened Programs home,
   * the logger's fallback opened the exercise list, and deleting a programme —
   * along with leaving a summary and every missing-template fallback — opened
   * the pre-redesign catalog list, a screen nothing else in the app leads to.
   * Delete a programme and you were somewhere you could not get back to.
   * One answer now, and it is the same one the tab gives.
   */
  const workoutHomeRoute = useMemo<AppRoute>(
    () => (preferences.programsTabEnabled ? { tab: 'workout', screen: 'programs_home' } : WORKOUT_PLAN_ROUTE),
    [preferences.programsTabEnabled],
  );

  /**
   * Numbers follow the app language, not the device.
   *
   * Written during render, and placed above every hook that could format a
   * number — that ordering is the whole point.
   *
   * removeTrailingZeros reads a module setting rather than a parameter (see the
   * note in lib/format.ts), and much of the app's formatted text is produced by
   * useMemo blocks in this file. This used to be an effect, which runs *after*
   * render: on the render where the language changed, every one of those memos
   * recomputed while the setting still held the previous language's separator —
   * and then never recomputed again, because their dependency on appLanguage had
   * already fired. The setting was corrected a moment later with nothing left to
   * read it.
   *
   * It cost the Pro hero "92.5 kg" in front of a Finnish reader, and it needs two
   * languages to show up: the device supplies the first render's language and the
   * stored preference supplies the second. On a phone whose system language
   * matches the app, the separator is never wrong to begin with, which is why
   * five rounds on a Finnish phone never saw it and an en-US emulator did.
   *
   * The setter is idempotent, so running it every render — including StrictMode's
   * double invoke — costs one comparison and cannot be observed.
   */
  setNumberLanguage(preferences.appLanguage);

  const [navigationState, setNavigationState] = useState<NavigationState>({
    route: ROOT_ROUTES.home,
    history: [],
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  // Where Settings was scrolled when a sub-screen opened; the screen
  // unmounts on navigation, so the position survives here.
  const settingsScrollOffsetRef = useRef(0);
  // Where History's list was scrolled before opening a session, and what
  // search/filter it was showing then. Browsing old workouts landed back at
  // the top of the list every time — the same row you had just opened, then
  // a re-scroll down past everything you had already seen (#bugs
  // 2026-09-29). Keyed by search/filter too: a bare offset restored onto a
  // list a tab switch had reset the search on landed the reader partway
  // down rows they had never scrolled past (recheck round 2026-09-29).
  const historyScrollOffsetRef = useRef<HistoryScrollMemory | null>(null);
  const [completionSummary, setCompletionSummary] = useState<CompletionSummaryState | null>(null);
  const [ratingSheetVisible, setRatingSheetVisible] = useState(false);
  const [finishSaveState, setFinishSaveState] = useState<FinishSaveState>({
    status: 'idle',
    sessionId: null,
    message: null,
  });
  const [cardioSaving, setCardioSaving] = useState(false);
  // Settings' "Import plan (CSV)" opens the same sheet the Programs tab uses,
  // straight into its paste view. One importer, two doors.
  const [settingsImportVisible, setSettingsImportVisible] = useState(false);
  /** The theme question, asked once right after "Let's begin". */
  const [themeChoiceVisible, setThemeChoiceVisible] = useState(false);
  // null = still asking Android, or the device cannot pin widgets at all.
  const [homeWidgetState, setHomeWidgetState] = useState<{ supported: boolean; added: boolean } | null>(
    null,
  );
  const [minimumSplashElapsed, setMinimumSplashElapsed] = useState(false);
  const [nativeSplashHidden, setNativeSplashHidden] = useState(false);
  // The brand animation plays once per cold start, after the native splash has
  // handed over. It is skipped entirely until the app is ready, so it never
  // becomes the thing hiding a slow start.
  const [brandSplashDone, setBrandSplashDone] = useState(false);
  // The first-run tour's wiring: where its targets are, and which bar item
  // its sweep is resting on. The registry is one object for the app's life.
  const tourRegistry = useRef(createTourTargetRegistry()).current;
  const [tourSweep, setTourSweep] = useState<TourBarStop | null>(null);
  /**
   * Which section the tour is pointing at. Home reads it to shut its folds
   * before the beat that rings one — the layer cannot reach into a screen's
   * state, and should not, so it says where it is and the screen decides.
   */
  const [tourFocus, setTourFocus] = useState<TourTargetId | null>(null);
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useDeviceSwitches({ hydrated, preferences });

  // Mirrors the notification preferences onto the OS clock: reminders, the
  // comeback nudge, the Sunday summary and the morning-after record note.
  useScheduledNotifications(database);

  const { navigateToActiveWorkoutRef, finishFromNotificationRef } = useSessionNotifications({
    workout,
    preferences,
    showToast,
  });

  // Every seeded row is browsable now that the legacy `lib_*` tier is gone
  // (2026-09-01), so this no longer filters. The name stays: ten call sites
  // read it, and "the library the reader can open" is still what they mean.
  // What keeps it true is a guard on the seed, not a filter here — a filter
  // hides a bad row, and hiding is how the two sets drifted apart in the first
  // place.
  const exerciseBrowserItems = exerciseLibrary;
  const summaryExitRouteRef = useRef<AppRoute | null>(null);
  const summaryNavigationPendingRef = useRef(false);
  /** A finish that has started and not yet settled. See handleConfirmFinishWorkout. */
  const finishInFlightRef = useRef(false);
  /** Sessions whose `workout_completed` has been sent. See handleConfirmFinishWorkout. */
  const completionCountedRef = useRef(new Set<string>());
  const workoutLogNavigationAllowedAtRef = useRef<number | null>(null);
  const route = navigationState.route;
  const appHydrated = hydrated && workout.hydrated;
  // The coach-log deletes a reset could not confirm, retried on start and on
  // every return to the foreground; Reset uses the same runner for its own.
  const deletePendingAiLogs = usePendingAiLogDeletions({
    hydrated,
    pending: preferences.pendingAiLogDeletions,
    clear: clearPendingAiLogDeletions,
  });

  const { todayKey, todayStartMs } = useTodayKey();

  useInstallStamps({ appHydrated, preferences, updatePreferences });

  useEffect(() => {
    const timeout = setTimeout(() => setMinimumSplashElapsed(true), 1200);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadFonts() {
      await Font.loadAsync({
        Inter: require('./assets/fonts/Inter.ttf'),
        // Variable Manrope kept as a fallback; the static per-weight families
        // below are what globalFont.ts maps fontWeight onto, because Android
        // does not drive a variable font's weight axis (headings rendered at
        // the ExtraLight default with a synthetic bold otherwise).
        Manrope: require('./assets/fonts/Manrope.ttf'),
        'Manrope-Regular': require('./assets/fonts/Manrope-Regular.ttf'),
        'Manrope-Medium': require('./assets/fonts/Manrope-Medium.ttf'),
        'Manrope-SemiBold': require('./assets/fonts/Manrope-SemiBold.ttf'),
        'Manrope-Bold': require('./assets/fonts/Manrope-Bold.ttf'),
        'Manrope-ExtraBold': require('./assets/fonts/Manrope-ExtraBold.ttf'),
        // Sets × reps numerals on the Home agenda list (design: JetBrains Mono).
        JetBrainsMono: require('./assets/fonts/JetBrainsMono.ttf'),
      }).catch(() => {
        // Keep the app usable if font loading fails in a dev host.
      });

      if (!cancelled) {
        setFontsLoaded(true);
      }
    }

    void loadFonts();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (nativeSplashHidden || !appHydrated || !fontsLoaded) {
      return;
    }

    if (!minimumSplashElapsed) {
      return;
    }

    let cancelled = false;

    async function hideNativeSplash() {
      await SplashScreen.hideAsync().catch(() => {
        // Ignore host-level splash errors on warm reloads.
      });

      if (!cancelled) {
        setNativeSplashHidden(true);
      }
    }

    void hideNativeSplash();

    return () => {
      cancelled = true;
    };
  }, [appHydrated, fontsLoaded, minimumSplashElapsed, nativeSplashHidden]);

  function navigate(nextRoute: AppRoute) {
    startTransition(() =>
      setNavigationState((current) => ({
        route: nextRoute,
        history: pushRoute(current.history, current.route, nextRoute),
      })),
    );
  }

  function replaceRoute(nextRoute: AppRoute) {
    startTransition(() =>
      setNavigationState((current) => ({
        route: nextRoute,
        history: current.history,
      })),
    );
  }

  function resetToRoute(nextRoute: AppRoute) {
    startTransition(() =>
      setNavigationState({
        route: nextRoute,
        history: [],
      }),
    );
  }

  /**
   * Leave a finished-workout screen: clear its data and move, in one commit.
   *
   * The single transition is the whole point. Every navigation helper here
   * wraps setNavigationState in startTransition, which makes route changes
   * non-urgent — so a plain `setCompletionSummary(null)` alongside them is
   * urgent and lands *first*. That commits a frame where the route is still
   * {workout, summary} while the summary data is already gone.
   *
   * The summary branch is guarded on `&& completionSummary`, so that frame
   * matches no named workout screen and falls through to the tab's catch-all,
   * which renders the exercise browser. Reported from the phone as "Ohjelmat
   * flashes for a beat between the summary and Home".
   *
   * Clearing after navigating does not fix it: the clear would still be the
   * urgent half. They have to be the same update.
   */
  function leaveFinishedWorkout(nextRoute: AppRoute) {
    startTransition(() => {
      setCompletionSummary(null);
      setFinishSaveState({ status: 'idle', sessionId: null, message: null });
      setNavigationState({ route: nextRoute, history: [] });
    });
    maybeAskForRating();
  }

  /**
   * The rating ask, at the one moment the reader has just finished something.
   *
   * Fired on the way out of the finish screen rather than on it: the finish
   * screen already asks how the session felt, and two sheets stacked on one
   * tap is how a reader learns to dismiss sheets without reading them.
   *
   * The ask is recorded when the sheet is SHOWN, not when it is answered. A
   * reader who closes it has still been asked, and counting only the answers
   * would let the app ask forever.
   */
  function maybeAskForRating() {
    const decision = decideRatingPrompt({
      state: preferences.ratingPrompt,
      sessionsLogged: database.workoutSessions.length + database.cardioSessions.length,
      atPeakMoment: true,
      nowMs: Date.now(),
    });
    if (!decision.ask) {
      return;
    }
    setRatingSheetVisible(true);
    void updatePreferences((current) => ({ ratingPrompt: recordRatingAsked(current.ratingPrompt, Date.now()) }));
  }

  /**
   * Where a tab lands. Programs-tab redesign (flagged): the workout tab lands
   * on the Programs home instead of the legacy exercise list.
   *
   * Separate from `navigateToTab` because the destination and the history are
   * two decisions. The bar resets; a button inside a screen must not.
   */
  function resolveTabRoute(tab: RootTabKey): AppRoute {
    if (tab === 'workout' && preferences.programsTabEnabled) {
      return { tab: 'workout', screen: 'programs_home' };
    }
    return ROOT_ROUTES[tab];
  }

  function navigateToTab(tab: RootTabKey) {
    resetToRoute(resolveTabRoute(tab));
  }

  /**
   * Guided player (design_handoff_guided_player) is the only way to run a
   * PROGRAMME session.
   *
   * The list logger itself is alive and shipping — an empty workout runs on
   * it, and the editor route already seeds itself from a stored template. What
   * was removed is the button from here to there (see the note on
   * guided.exit.finishSave in i18n).
   *
   * The two are not interchangeable, and the difference is not layout. This
   * screen drives WorkoutProvider, so its session is the only one written to
   * @vinha/workout/v1 and the only one that survives the app being killed; the
   * list logger holds its sets in component state until you finish. And its
   * save is freestyle by construction (see finishLoggedWorkoutSave): no plan
   * identity, so no previous-session comparison and no progression. Offering
   * it for a programme day means giving it both, not adding a switch.
   */
  function navigateToGuidedWorkout(workoutTemplateId: string, options?: { resume?: boolean }) {
    workoutLogNavigationAllowedAtRef.current = Date.now();
    navigate({ tab: 'workout', screen: 'guided', workoutTemplateId, resume: options?.resume });
  }

  function navigateBack(fallback: AppRoute | null = null) {
    startTransition(() =>
      setNavigationState((current) => {
        const previous = popRoute(current.history);
        if (previous.route) {
          return {
            route: previous.route,
            history: previous.history,
          };
        }

        if (fallback) {
          return {
            route: fallback,
            history: [],
          };
        }

        return current;
      }),
    );
  }

  function showToast(message: string) {
    setToastMessage(message);
  }

  useEffect(() => {
    if (!toastMessage) {
      return;
    }

    const timeout = setTimeout(() => setToastMessage(null), 2800);
    return () => clearTimeout(timeout);
  }, [toastMessage]);

  useEffect(() => {
    if (finishSaveState.status === 'idle') {
      return;
    }

    const activeSessionId = workout.activeSession?.sessionId ?? null;
    if (activeSessionId === finishSaveState.sessionId) {
      return;
    }

    setFinishSaveState({ status: 'idle', sessionId: null, message: null });
  }, [finishSaveState.sessionId, finishSaveState.status, workout.activeSession?.sessionId]);

  useEffect(() => {
    if (route.tab === 'workout' && route.screen === 'guided') {
      const allowedAt = workoutLogNavigationAllowedAtRef.current;
      workoutLogNavigationAllowedAtRef.current = null;

      if (
        !workout.activeSession &&
        finishSaveState.status !== 'saving' &&
        !summaryNavigationPendingRef.current &&
        (!allowedAt || Date.now() - allowedAt > 2000)
      ) {
        replaceRoute(ROOT_ROUTES.home);
        return;
      }
    }

    if (
      route.tab === 'workout' &&
      route.screen === 'guided' &&
      !workout.templates.some((template) => template.id === route.workoutTemplateId) &&
      !workoutTemplates.some((template) => template.id === route.workoutTemplateId)
    ) {
      replaceRoute(workoutHomeRoute);
    }

      if (
        route.tab === 'workout' &&
        route.screen === 'detail' &&
        !exerciseBrowserItems.some((item) => item.id === route.exerciseId)
      ) {
        replaceRoute(ROOT_ROUTES.workout);
      }

    if (
      route.tab === 'workout' &&
      (route.screen === 'program' || route.screen === 'programDay') &&
      ((route.programType === 'ready' && !workout.templates.some((template) => template.id === route.workoutTemplateId)) ||
        (route.programType === 'custom' && !workoutTemplates.some((template) => template.id === route.workoutTemplateId)))
    ) {
      replaceRoute(workoutHomeRoute);
    }

    if (
      route.tab === 'workout' &&
      route.screen === 'template' &&
      route.workoutTemplateId &&
      !workoutTemplates.some((template) => template.id === route.workoutTemplateId)
    ) {
      replaceRoute(workoutHomeRoute);
    }

    if (
      route.tab === 'progress' &&
      route.screen === 'detail' &&
      !trackedProgress.some((item) => item.key === route.exerciseKey)
    ) {
      replaceRoute(ROOT_ROUTES.progress);
    }

    if (
      route.tab === 'home' &&
      route.screen === 'session' &&
      !workoutSessions.some((session) => session.id === route.sessionId)
    ) {
      replaceRoute({ tab: 'home', screen: 'history' });
    }

    if (
      route.tab === 'workout' &&
      route.screen === 'summary' &&
      completionSummary &&
      summaryNavigationPendingRef.current
    ) {
      summaryNavigationPendingRef.current = false;
    }

    if (
      route.tab === 'workout' &&
      route.screen === 'summary' &&
      !completionSummary &&
      finishSaveState.status !== 'saving' &&
      !summaryNavigationPendingRef.current
    ) {
      const nextRoute = summaryExitRouteRef.current ?? workoutHomeRoute;
      summaryExitRouteRef.current = null;
      replaceRoute(nextRoute);
    }
  }, [
    completionSummary,
    exerciseLibrary,
    finishSaveState.status,
    route,
    trackedProgress,
    workout.activeSession,
    workoutSessions,
    workout.templates,
    workoutTemplates,
  ]);

  const onboardingActive = !preferences.onboardingCompleted;
  const entryFlowActive = onboardingActive && !preferences.entryFlowCompleted;
  // Pre-questionnaire flow: after Welcome the user picks a path (01b); the
  // build path then runs about-you (01e) before the questionnaire. The ready
  // path exits onboarding to the catalog.
  const [onboardingStep, setOnboardingStep] = useState<
    'path' | 'about' | 'questionnaire' | 'ready_catalog'
  >('path');
  useFunnelAnalytics({ hydrated, onboardingActive, entryFlowActive, onboardingStep, route, navigationState, preferences });
  const [busySavingReadyPick, setBusySavingReadyPick] = useState(false);

  // The onboarding flow state lives in memory; when the gate closes (finished)
  // or the app returns to the Welcome entry (e.g. after a data reset), start
  // the next run from the path screen — never mid-questionnaire.
  useEffect(() => {
    if (preferences.onboardingCompleted || !preferences.entryFlowCompleted) {
      setOnboardingStep('path');
      setAboutYouValues(null);
    }
  }, [preferences.entryFlowCompleted, preferences.onboardingCompleted]);
  const [aboutYouValues, setAboutYouValues] = useState<AboutYouValues | null>(null);
  /**
   * The document the hand-off screen has open, if any. Kept here rather than
   * routed: the legal screen belongs to the Profile tab, and navigating to it
   * mid-onboarding would end onboarding. Null puts the hand-off back.
   */
  const [handoffLegalDocument, setHandoffLegalDocument] = useState<LegalDocumentId | null>(null);
  /** Read by the route-level back, which is declared before the value is. */
  const legalConsentDueRef = useRef(false);
  /**
   * The terms sheet, held on screen while its answer is being written.
   *
   * `updatePreferences` shows a change before the disk has it and takes it
   * back if the disk refuses. Derived from the preferences alone, the sheet
   * vanished on the optimistic half — before the acceptance was durable — and
   * a refused write mounted a fresh sheet whose error the old one could never
   * show (CI review of #184). Held, it leaves only after the write resolves,
   * and a refusal lands on the sheet that asked.
   */
  const [legalSheetHeld, setLegalSheetHeld] = useState<'first' | 'changed' | null>(null);
  const handoffLegalOpenRef = useRef(false);
  handoffLegalOpenRef.current = handoffLegalDocument !== null;
  // Whether the hand-off is on screen, for the route-level back below. Set
  // where the hand-off plan is worked out, further down.
  const setupHandoffActiveRef = useRef(false);
  /**
   * Today's swaps and left-out slots, chosen on Home or a programme's day page
   * before the session exists — each held for the session it was made on, on
   * the day it was made (lib/sessionAdaptation). Deliberately not persisted: it
   * is an answer to "what am I doing today", and it is spent when that session
   * starts.
   */
  const [heldSessionAdaptations, setHeldSessionAdaptations] =
    useState<HeldSessionAdaptations>(NO_HELD_SESSION_ADAPTATIONS);
  /** What is held for this session today — read by every screen that shows or starts it. */
  const sessionAdaptationFor = (ref: AdaptedSessionRef | null | undefined): SessionAdaptation =>
    heldAdaptationFor(heldSessionAdaptations, ref, todayStartMs);
  const adaptSession = (ref: AdaptedSessionRef, change: (current: SessionAdaptation) => SessionAdaptation) =>
    setHeldSessionAdaptations((held) => updateHeldAdaptation(held, ref, todayStartMs, change));
  /**
   * The open coach conversation, held here because the chat screen unmounts.
   *
   * Its best answers end in "katso tämä treeni", and following that used to
   * throw away the brief that earned it (#bugs 2026-08-27). Not persisted: the
   * thread ends when the app does, and lib/coachChatMemory ends it after eight
   * hours anyway.
   */
  const [coachChatMemory, setCoachChatMemory] = useState<CoachChatMemory<ChatMessage> | null>(null);
  /**
   * What the coach advised over the last three weeks — the memory that does
   * outlive the thread above, and the app.
   *
   * Its own AsyncStorage key rather than a preference: see
   * storage/coachAdviceMemoryStore for why it stays out of the cloud backup.
   * Loaded once on mount; an empty list until it arrives, so the first
   * question of a cold start is answered without it rather than delayed by it.
   */
  const [coachAdviceMemory, setCoachAdviceMemory] = useState<CoachAdviceMemoryEntry[]>([]);
  // Shown when a create is blocked, from wherever it was attempted. Not a
  // route: the user was in the middle of something, and a screen change
  // would lose the thing they were doing to a wall they may dismiss.
  const [programLimitVisible, setProgramLimitVisible] = useState(false);
  // The running-programme wall on the free tier. The numbers outlive `visible`
  // so the title does not read 0/0 while the sheet fades out.
  const [runningCapSheet, setRunningCapSheet] = useState({ visible: false, used: 0, cap: 0 });
  /**
   * The onboarding's last two steps are full-bleed: the program picker's
   * diagonal and the paywall's hero both run to the top edge. The shell
   * reserves and paints the status-bar strip for onboarding, which would cut a
   * light band across either of them.
   */
  const [fullBleedReviewRaw, setFullBleedReview] = useState<'light' | 'dark' | null>(null);
  /**
   * Only meaningful while onboarding is on screen.
   *
   * OnboardingScreen reports this from an effect and had no cleanup, so
   * finishing on the paywall left it at 'light' forever: the shell kept the
   * full-bleed edges and the translucent status bar, and Home's greeting drew
   * underneath the clock on the reader's very first screen. Reading it through
   * onboardingActive means an unmount cannot leak, whatever the last stage
   * happened to report.
   */
  const fullBleedReview =
    onboardingActive || (route.tab === 'profile' && route.screen === 'setup')
      ? fullBleedReviewRaw
      : null;

  useSetupWeightSeed({ hydrated, preferences, database, addBodyweightEntry, updatePreferences });

  /**
   * The route-level back. BackHandler calls the newest listener first, and a
   * screen with its own answer to back (the cardio end sheet, the guided
   * player's exit sheet, the free workout's discard question) registers after
   * this one. That only holds while this effect stays put: it used to depend on
   * the workout context, which is a new object every second while a rest timer
   * or cardio runs, so it re-subscribed every second, became the newest
   * listener, and walked the reader Home past the screen's own handler.
   */
  useEffect(() => {
    // Stands down on the cardio screen while a run is on the clock. The
    // player's back opens its end sheet, but this listener re-subscribes on
    // every route change and a parent's effect runs after its child's — so
    // coming back to a running session made this the newest listener, and
    // back walked Home past the sheet. The screen answers back in every mode.
    if (cardioRunActive && route.tab === 'home' && route.screen === 'cardio') {
      return undefined;
    }
    // Stands down on the free workout, in every state. Its own listener
    // answers back — the question before logged sets are lost, and the
    // discard when there is nothing to lose — and it registers once, on
    // mount. This listener re-subscribes on every route change and a
    // parent's effect runs after its child's, so it was the newest one:
    // back walked Home past the question and past the discard (CI review
    // of #162). Same stand-down as the cardio player and the questionnaire.
    if (route.tab === 'workout' && route.screen === 'empty') {
      return undefined;
    }
    // Stands down on the guided player, in both of its modes. Its own
    // listener answers back — the exit sheet in the player, a plain leave on
    // the overview. But "Continue" from Home mounts it straight into the
    // player in the same commit as the route change, and a parent's effect
    // runs after its child's: this listener was the newest, and back walked
    // Home past the exit sheet (live-session audit, 2026-09-20).
    if (route.tab === 'workout' && route.screen === 'guided') {
      return undefined;
    }
    // Stands down for the questionnaire in BOTH of its forms. The setup route
    // is the same OnboardingScreen, which answers back itself, stage by
    // stage — but this listener re-subscribes on every route change, and a
    // parent's effect runs after its child's, so it was always the newest
    // one: back from any question of "create a new programme" went straight
    // to settings (device, 2026-09-16).
    if (onboardingActive || (route.tab === 'profile' && route.screen === 'setup')) {
      return undefined;
    }

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      // A document open over the hand-off is not a route; back closes it
      // before anything behind it moves. Asked here as well as below, because
      // this listener re-subscribes on route changes and can end up newest.
      if (handoffLegalOpenRef.current) {
        setHandoffLegalDocument(null);
        return true;
      }
      // The hand-off answers back itself. It is drawn over the route rather
      // than routed, so this listener — re-subscribed as onboarding closes,
      // after the hand-off's own — was the newest and popped the route
      // behind it. False hands the key on to the hand-off's listener.
      if (setupHandoffActiveRef.current) {
        return false;
      }
      // The terms sheet answers back itself (it leaves the app). Walking the
      // route behind a sheet nobody can see past would change the screen the
      // reader returns to, for a key they pressed to get away.
      if (legalConsentDueRef.current) {
        return false;
      }
      const nextRoute = getBackRoute(route, workoutHomeRoute);
      if (!nextRoute && navigationState.history.length === 0) {
        return false;
      }

      if (nextRoute && backSkipsHistory(route)) {
        resetToRoute(nextRoute);
        return true;
      }

      if (route.tab === 'workout' && route.screen === 'summary') {
        setCompletionSummary(null);
        setFinishSaveState({ status: 'idle', sessionId: null, message: null });
        workoutRef.current.clearCompletedWorkout();
        navigateBack(summaryExitRouteRef.current ?? workoutHomeRoute);
        return true;
      }

      navigateBack(nextRoute);
      return true;
    });

    return () => subscription.remove();
  }, [cardioRunActive, navigationState.history.length, onboardingActive, route]);

  /**
   * The back key closes a policy or terms page opened over the hand-off.
   *
   * The page is drawn over the hand-off rather than routed, so the handler
   * above never knew it was open: on a fresh install the route behind has no
   * history, back returned false, and Android put the app away with the terms
   * still up (backfill review of #92, 2026-09-16). Registered while the page
   * is open and after the route handler, so it is the newest listener — and it
   * works on the setup route too, where the route handler stands down.
   */
  useEffect(() => {
    if (!handoffLegalDocument) {
      return undefined;
    }
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setHandoffLegalDocument(null);
      return true;
    });
    return () => subscription.remove();
  }, [handoffLegalDocument]);

  const { homeSummary, lifetimeSummary, progressTrainingRhythm } = useDaySummaries({
    database,
    unitPreference,
    todayKey,
  });
  const {
    proLiftHistories,
    proFatigue,
    progressionFatigueSignal,
    proPlateau,
    proWeeklyRead,
    proCompletionMoment,
    proCoachSpecimen,
  } = useProInsights({ database, preferences });
  const homeActiveWorkoutSummary = useMemo(() => {
    if (!workout.activeSession) {
      return null;
    }

    const activeExercise =
      workout.activeSession.exercises.find((exercise) => exercise.slotId === workout.activeSession?.ui.activeSlotId) ??
      workout.activeSession.exercises.find(
        (exercise) => exercise.status !== 'completed' && exercise.status !== 'skipped',
      ) ??
      null;
    const remainingSets = workout.activeSession.exercises.reduce(
      (sum, exercise) => sum + exercise.sets.filter((set) => set.status === 'pending').length,
      0,
    );

    return {
      title: workout.activeSession.templateName,
      nextExercise: activeExercise?.exerciseName ?? null,
      meta: `${pluralize(remainingSets, 'set')} left | Started ${formatTime(workout.activeSession.startedAt)}`,
    };
  }, [workout.activeSession]);
  /**
   * Go to the session that is already running, if there is one.
   *
   * Two different intents come through here and they must not land the same
   * way. Home's hero and the lock-screen card ask to CONTINUE, and get the set
   * they left off on. But this is also the guard on "start a session": ask for
   * Day 2 while Day 1 is running and you are redirected, which is not a resume
   * at all — the app is telling you something, and dropping you mid-set in
   * Day 1's player says it silently. That reader logs sets into the wrong day.
   *
   * So `resume` is the caller's claim about its own button, and the guards
   * only make it when the running session IS the one that was asked for. The
   * overview is what a redirect owes you: the session's name, at the top.
   */
  function navigateToActiveWorkout(options?: { message?: string; resume?: boolean }) {
    if (!workout.activeSession) {
      return false;
    }

    if (options?.message) {
      showToast(options.message);
    }

    workout.resumeWorkout();
    navigateToGuidedWorkout(workout.activeSession.templateId, { resume: options?.resume === true });
    return true;
  }

  /** Whether the running session is the very one a start button just asked for. */
  function isActiveSessionFor(workoutTemplateId: string, sessionId: string) {
    const active = workout.activeSession;
    return (
      active !== null
      && active.templateId === workoutTemplateId
      && active.templateSessionId === sessionId
    );
  }

  navigateToActiveWorkoutRef.current = () => navigateToActiveWorkout({ resume: true });
  finishFromNotificationRef.current = () => {
    // "Finish workout" from the lock screen opens the session; ending it is a
    // confirmed step on that screen, not a silent write from a notification.
    navigateToActiveWorkout({ resume: true });
  };

  function getWorkoutLoggerFallbackRoute() {
    return resolveWorkoutLoggerFallbackRoute({
      activeWorkoutTemplateId: workout.activeSession?.templateId ?? null,
      recommendedProgramId: preferences.recommendedProgramId,
      setupCompleted: preferences.setupCompleted,
    });
  }

  async function handleDiscardWorkout() {
    if (!workout.activeSession) {
      return;
    }

    const fallbackRoute = getWorkoutLoggerFallbackRoute();
    await updatePreferences({ trainingFirstRunDismissed: true });
    workout.discardWorkout();
    setFinishSaveState({ status: 'idle', sessionId: null, message: null });
    navigateBack(fallbackRoute);
  }

  async function handleConfirmFinishWorkout() {
    const activeSession = workout.activeSession;
    // A ref, not `finishSaveState`: two taps inside one render both read the
    // state as idle, and each went on to save and finish.
    if (!activeSession || finishInFlightRef.current) {
      return;
    }

    const adaptedSession = adaptCompletedWorkoutSessionForAppDatabase(activeSession);
    if (adaptedSession.logs.length === 0) {
      await handleDiscardWorkout();
      return;
    }

    finishInFlightRef.current = true;
    setFinishSaveState({
      status: 'saving',
      sessionId: adaptedSession.sessionId,
      message: null,
    });

    try {
      const summary = await saveCompletedWorkoutSession({
        ...adaptedSession,
        performedAt: adaptedSession.performedAt,
      });
      if (!summary.sessionId || !summary.performedAt) {
        throw new Error('Workout save did not produce a valid summary');
      }
      // Once per session. A write after this one can fail — the preferences
      // below — and the retry saves again, which hands back the session
      // already stored: counted on every pass, one workout was two
      // (analytics audit, 2026-09-21).
      if (!completionCountedRef.current.has(adaptedSession.sessionId)) {
        completionCountedRef.current.add(adaptedSession.sessionId);
        trackEvent('workout_completed');
      }

      // Only after the database save is verified: finishing flips the session
      // to 'completed' and stamps slot history. Doing it before the save meant
      // a failed save stranded the session in a state resume would not pick up
      // — the logged sets were gone on the next launch (launch-scope Risk 1).
      workout.finishWorkout(adaptedSession.performedAt);

      const sessionExerciseLogs = buildExerciseLogsForCompletedSession(adaptedSession.sessionId, adaptedSession.logs);
      const insight = computePostSessionInsight(
        {
          completedSession: {
            id: adaptedSession.sessionId,
            performedAt: summary.performedAt,
            totalVolumeKg: summary.totalVolume,
            setsCompleted: summary.setsCompleted,
          },
          sessionExerciseLogs,
          allPriorSessions: database.workoutSessions,
          allPriorExerciseLogs: database.exerciseLogs,
          lastInsightSessionId: preferences.lastInsightSessionId,
          lastInsightType: preferences.lastInsightType,
          unitPreference,
        },
        new Date(summary.performedAt),
      );

      await updatePreferences({
        trainingFirstRunDismissed: true,
        ...(insight
          ? {
              lastInsightSessionId: adaptedSession.sessionId,
              lastInsightType: insight.type,
            }
          : {}),
      });
      const completionCards = buildCompletionCardsFromAdaptedSession({
        exercises: adaptedSession.exercises,
        exerciseTemplates: database.exerciseTemplates,
        exerciseLibrary,
        exercisePrLookup,
        language: preferences.appLanguage,
      });
      setCompletionSummary({
        sessionId: adaptedSession.sessionId,
        workoutName: adaptedSession.workoutNameSnapshot,
        performedAt: summary.performedAt,
        durationMinutes: summary.durationMinutes,
        setsCompleted: summary.setsCompleted,
        totalVolume: summary.totalVolume,
        // The tile counts lifts that were done: the save's own count, by the
        // rule History reads the same logs with (lib/sessionTotals), so this
        // tile and the session's History row cannot disagree. The cards below
        // agree too — a card with a completed set is a log the rule counts.
        // Not summary.exercisesLogged, which is every persisted entry, skipped
        // included: "6 LIIKETTÄ" above five rows of "0 sarjaa" was that number.
        exercisesLogged: summary.exercisesCompleted,
        volumeDeltaKg: getVolumeDeltaVsPrevious(
          {
            sessionId: adaptedSession.sessionId,
            workoutName: adaptedSession.workoutNameSnapshot,
            performedAt: summary.performedAt,
            totalVolumeKg: summary.totalVolume,
          },
          database.workoutSessions,
        ),
        muscles: buildMuscleFocus(adaptedSession.exercises, exerciseLibrary),
        exerciseCards: completionCards.exerciseCards,
        prCards: completionCards.prCards,
        // Read from the persisted logs. The builder excludes this session by
        // id, so "last time" cannot mean today whether or not the save has
        // already landed in the snapshot this closure holds.
        ...buildSessionMovement({
          exercises: adaptedSession.exercises,
          exerciseLogs: database.exerciseLogs,
          workoutSessions: database.workoutSessions,
          sessionId: adaptedSession.sessionId,
          language: preferences.appLanguage,
          unitPreference,
        }),
        insight,
      });
      summaryNavigationPendingRef.current = true;
      // Finish on the completion screen returns Home. Set the exit route so the
      // summary-dismiss effect can't race onDone's navigation to WORKOUT_PLAN_ROUTE.
      summaryExitRouteRef.current = ROOT_ROUTES.home;
      workout.clearCompletedWorkout();
      replaceRoute({ tab: 'workout', screen: 'summary' });
      setFinishSaveState({ status: 'idle', sessionId: null, message: null });
    } catch (error) {
      console.error('Failed to save completed workout', error);
      setFinishSaveState({
        status: 'error',
        sessionId: adaptedSession.sessionId,
        message: 'Could not save this workout. Try again before leaving the screen.',
      });
      showToast(t(preferences.appLanguage, 'toast.saveWorkoutFailed'));
    } finally {
      finishInFlightRef.current = false;
    }
  }

  /**
   * Deleting a saved workout takes it out of the next session's prefill and
   * "Last time" as well as the database — after the database delete has
   * landed, so a refused delete leaves both as they were.
   */
  async function handleDeleteCompletedSession(sessionId: string) {
    await deleteCompletedWorkoutSession(sessionId);
    workout.forgetHistorySession(sessionId);
  }

  async function handleDismissTip(tipId: string) {
    const dismissedTipIds = preferences.dismissedTipIds ?? [];
    if (dismissedTipIds.includes(tipId)) {
      return;
    }

    await updatePreferences({
      dismissedTipIds: [...dismissedTipIds, tipId],
    });
  }

  /**
   * The type is a fact about the id, not something the caller can know.
   *
   * This was `handleOpenProgramDetail`, which wrote `programType:
   * 'ready'` whatever it was handed. Home's "other programmes" list holds
   * whatever the reader adopted, their own programmes included, so tapping
   * your own programme sent the route guard looking for a catalog template
   * that was never there and left the reader on the programme list. Every
   * caller that has an id and no type comes here, and the type is resolved
   * the way Home resolves its own hero — the stored template first, so the
   * two cannot disagree about what an id is.
   */
  function resolveProgramTypeForTemplate(workoutTemplateId: string): 'ready' | 'custom' {
    return workoutTemplates.some((template) => template.id === workoutTemplateId) ? 'custom' : 'ready';
  }

  function handleOpenProgramDetail(workoutTemplateId: string) {
    navigate({
      tab: 'workout',
      screen: 'program',
      programType: resolveProgramTypeForTemplate(workoutTemplateId),
      workoutTemplateId,
    });
  }

  function handleOpenCustomProgramDetail(
    workoutTemplateId: string,
    programType: 'ready' | 'custom' = 'custom',
  ) {
    navigate({ tab: 'workout', screen: 'program', programType, workoutTemplateId });
  }

  // Cardio v1 conflict rule: never two live sessions, never a silent discard.
  // Mirrors the sheet the cardio list shows when a strength session is live.
  function guardStrengthStartOverCardio(proceed: () => void) {
    if (!workout.activeCardio) {
      proceed();
      return;
    }

    Alert.alert(
      t(preferences.appLanguage, 'confirm.cardioRunning.title'),
      t(preferences.appLanguage, 'confirm.cardioRunning.body'),
      [
        {
          text: t(preferences.appLanguage, 'confirm.cardioRunning.resume'),
          onPress: () => navigate({ tab: 'home', screen: 'cardio' }),
        },
        {
          text: t(preferences.appLanguage, 'confirm.cardioRunning.discard'),
          style: 'destructive',
          onPress: () => {
            workout.clearCardio();
            proceed();
          },
        },
        { text: t(preferences.appLanguage, 'common.cancel'), style: 'cancel' },
      ],
    );
  }

  function startReadyProgramSessionWithUnit(
    workoutTemplateId: string,
    sessionId: string,
    nextUnitPreference: UnitPreference,
  ) {
    const template = getWorkoutTemplateById(workoutTemplateId);
    if (!template) {
      return;
    }

    // Home's hero says "Jatka treeniä" and comes through here, so this IS the
    // resume path — but only when the running session is this one.
    if (navigateToActiveWorkout({ resume: isActiveSessionFor(workoutTemplateId, sessionId) })) {
      return;
    }

    guardStrengthStartOverCardio(() => {
      // Training a session does not change which programme is active. It
      // used to — the lead followed whatever was trained — and a one-off
      // session from another programme quietly moved Home and the ACTIVE tag
      // off the one the reader had chosen. The Active switch is the one door
      // now, and it asks first (user 2026-09-21).
      void updatePreferences({ trainingFirstRunDismissed: true });
      // Only what was chosen for THIS session: a swap made on another day's
      // card shares slot ids with this one and is not an answer about it.
      const sessionRef = { programId: workoutTemplateId, sessionId };
      const runtimeTemplate = applySessionAdaptation(
        buildReadySessionRuntimeTemplate(template, sessionId),
        sessionAdaptationFor(sessionRef),
      );
      startProgrammeWorkout(runtimeTemplate, nextUnitPreference);
      // Today's changes are spent the moment they are applied — an adaptation
      // is an answer about right now, and a stale one is worse than none.
      setHeldSessionAdaptations((held) => spendHeldAdaptation(held, sessionRef));
      navigateToGuidedWorkout(workoutTemplateId);
    });
  }

  /**
   * A programme session, started. The one door both programme starts use, so
   * "Kevennä seuraava treeni" from the recovery sheet reaches whichever comes
   * next: one set fewer on every lift that has one to spare, and loads held.
   * Spent here — the request is for the next session, not every session.
   */
  /**
   * The template and options a programme session starts with: the entitlement
   * resolved once, and a pending lighter session applied. Shared by the start
   * itself and by the coach's preview of the next session, so the example the
   * coach quotes is what the start will open on.
   */
  function programmeStart(runtimeTemplate: Parameters<typeof workout.startCustomWorkout>[0], now: Date = new Date()) {
    const lighten = isLightenPending(preferences.lightNextSession, now);
    return {
      template: lighten ? lightenRuntimeTemplate(runtimeTemplate) : runtimeTemplate,
      options: {
        ...resolveProgressionOptions(preferences),
        fatigueSignal: lighten ? lightenedFatigueSignal(progressionFatigueSignal) : progressionFatigueSignal,
      },
    };
  }

  function startProgrammeWorkout(
    runtimeTemplate: Parameters<typeof workout.startCustomWorkout>[0],
    unit: UnitPreference,
  ) {
    const start = programmeStart(runtimeTemplate);
    workout.startCustomWorkout(start.template, unit, start.options);
    if (preferences.lightNextSession) {
      // A refused write rolls the request back into place, and it would
      // lighten the session after this one too. Said, rather than left to
      // happen quietly (CI review of #188); the sheet can take it back.
      updatePreferences({ lightNextSession: null }).catch((error) => {
        console.error('Failed to spend the lighter-session request', error);
        showToast(t(preferences.appLanguage, 'recovery.toast.spendFailed'));
      });
    }
  }

  function handleStartReadyProgramSession(workoutTemplateId: string, sessionId: string) {
    startReadyProgramSessionWithUnit(workoutTemplateId, sessionId, unitPreference);
  }

  /**
   * The session a programme's own plan offers next.
   *
   * Home resolves this for the plan it leads with; a programme running
   * alongside has the same rotation and no one asking it. Same pure rule
   * either way, so the two cannot drift.
   */
  /**
   * Completed sessions, with a copied programme's history wearing the ids its
   * copy knows them by.
   *
   * Editing a lift in a ready programme hands the reader their own copy of it,
   * and the copy's days carry new ids. The rotation matches a plan entry
   * against a logged session by both ids, so the day after the copy was made
   * it found no match at all and offered day 1 to a reader who trained day 3
   * yesterday. A day is found by its name, which follows it when the reader
   * reorders the copy, and by position only where the name says nothing — a
   * day that cannot be told is not translated rather than guessed at (see
   * programLineage).
   */
  /**
   * The programmes some OTHER plan is running, so their work is that plan's.
   *
   * Read off the plan records rather than the active set: a plan the reader
   * holds but does not lead with is still the plan those sessions belong to.
   */
  function templatesRunByOtherPlans(workoutTemplateId: string | null | undefined): string[] {
    return database.workoutPlans
      .map((plan) => plan.entries[0]?.workoutTemplateId)
      .filter((id): id is string => Boolean(id) && id !== workoutTemplateId);
  }

  function completedSessionsForTemplate(
    workoutTemplateId: string | null | undefined,
    // The canonical list walks every logged session, so a caller that has
    // already built it hands it over rather than paying for it twice.
    completed?: readonly ReturnType<typeof getCanonicalCompletedSessions>[number][],
  ) {
    const sessions = completed ?? getCanonicalCompletedSessions(database);
    const copy = workoutTemplateId
      ? database.workoutTemplates.find((template) => template.id === workoutTemplateId) ?? null
      : null;
    const source = copy?.sourceTemplateId ? getWorkoutTemplateById(copy.sourceTemplateId) : null;
    if (!copy || !source) {
      return sessions;
    }
    const copiedDays = getWorkoutTemplateSessions(copy.id);
    return alignHistoryToCopiedDays(sessions, {
      fromTemplateIds: programmeHistoryIds(copy.id, database.workoutTemplates, templatesRunByOtherPlans(copy.id)),
      fromSessionIds: source.sessions.map((session) => session.id),
      // The copy stores its day names translated, in whichever language the
      // app was in when it was made.
      fromSessionNames: source.sessions.map((session) => [
        session.name,
        localizeSessionName(session.name, 'fi'),
        localizeSessionName(session.name, 'en'),
      ]),
      toTemplateId: copy.id,
      toSessionIds: copiedDays.map((session) => session.id),
      toSessionNames: copiedDays.map((session) => session.name),
    });
  }

  function resolveNextSessionIdForTemplate(workoutTemplateId: string): string | null {
    const plan = database.workoutPlans.find(
      (item) => item.entries[0]?.workoutTemplateId === workoutTemplateId,
    );
    if (!plan || plan.entries.length === 0) {
      return null;
    }
    const ordered = [...plan.entries].sort((left, right) => left.orderIndex - right.orderIndex);
    const index = resolveNextPlanEntryIndex(ordered, completedSessionsForTemplate(workoutTemplateId));
    return ordered[index]?.workoutTemplateSessionId ?? ordered[0]?.workoutTemplateSessionId ?? null;
  }

  /**
   * Take on a ready programme — what "Start season" promises.
   *
   * It ADDS. Nothing here ever drops a programme the reader already has: a
   * season is another commitment, not a replacement for the week they built.
   * The only thing standing between them and a fourth is the cap, and the only
   * thing that removes a programme is the reader asking for it.
   *
   * Before this existed, `activePlanId` was written by the two onboarding
   * finishes and nowhere else, so a season could be opened but never joined.
   */
  /**
   * Returns whether the programme is running when this resolves.
   *
   * The target flow is the caller that needs to know: it stores a target only
   * if the programme behind it actually landed, and the cap can refuse. Every
   * other caller ignores the value, which is why this can be added without
   * touching them.
   */
  /**
   * Put a programme the reader already holds back into the running set.
   *
   * Held is not gone: the plan record is still there with its block, its
   * week and its rotation, and switching a programme on has always resumed
   * it rather than rebuilding it. Adoption arrives at the same programmes by
   * other doors — the goal flow, a completion card, a catalog page whose
   * programme the reader has a copy of — and each of them used to build a
   * plan over the top instead, which is week 5 of 24 coming back as week 1.
   *
   * Answers true when the programme is running again, false when the cap
   * refused it, and null when there is no plan to resume — the caller then
   * builds one.
   */
  async function resumeHeldProgramme(
    templateId: string,
    options?: { lead?: boolean },
  ): Promise<boolean | null> {
    const resumed = resumeProgramme({
      activePlanId: preferences.activePlanId,
      activePlanIds: preferences.activePlanIds,
      plans: database.workoutPlans,
      templateId,
    });
    if (!resumed) {
      return null;
    }
    const decision = evaluateProgramAdoption({
      activePlanIds: preferences.activePlanIds,
      targetPlanId: resumed.planId,
      proUnlocked: resolveProEntitlement(preferences).unlocked,
    });
    if (decision.kind === 'blocked') {
      if (decision.canUpgrade) {
        setRunningCapSheet({ visible: true, used: decision.used, cap: decision.cap });
        return false;
      }
      showToast(t(preferences.appLanguage, 'programs.cap.full', { cap: decision.cap }));
      return false;
    }
    await updatePreferences({
      activePlanIds: resumed.activePlanIds,
      // resumeProgramme names the resumed plan as activePlanId whichever way,
      // so the lead is kept here: joining a season must not quietly demote the
      // programme at the top of Home.
      activePlanId: options?.lead ? resumed.planId : preferences.activePlanId ?? resumed.planId,
    });
    // Counted here, after the write, for every door that resumes through
    // this — and only when the plan was not already running (analytics
    // audit, 2026-09-21).
    if (joinedRunningSet(preferences.activePlanIds, resumed.activePlanIds)) {
      trackEvent('plan_adopted');
    }
    return true;
  }

  async function handleAdoptReadyProgram(
    workoutTemplateId: string,
    options?: { lead?: boolean },
  ): Promise<boolean> {
    const template = getWorkoutTemplateById(workoutTemplateId);
    if (!template) {
      return false;
    }

    // Already running this programme under some other plan id (an onboarding
    // pick, say) — joining again would spend a cap slot on a duplicate. But
    // "already held" is not "already the one Home leads with", and this used to
    // return on both: the only way to change the lead was to REMOVE the other
    // programme, which is a destructive answer to a question about ordering.
    if (activeProgramTemplateIds.includes(workoutTemplateId)) {
      if (options?.lead) {
        await promoteHeldProgramToLead(workoutTemplateId);
      }
      // Already held is already running, which is what the caller asked for.
      return true;
    }

    /*
     * The reader's own version of this programme IS this programme.
     *
     * Onboarding hands most readers a copy of the recommended programme,
     * fitted to their answers, and that copy is what they train. Adopting the
     * catalog original beside it gave one programme two rows in the list, two
     * plans, two slots of the running cap — and a Home offering a week the
     * reader had never been shown (audit round 4, 2026-09-20). The copy is
     * the answer: running already, or resumed through its own plan with its
     * block intact. Only if it has no plan at all does the catalog version
     * get built below.
     */
    const copyTemplateId = findReadyProgrammeCopyId(
      workoutTemplateId,
      database.workoutTemplates,
      // Running first, then merely held: with two copies of one programme
      // — possible on an install from before the link — resuming the one
      // nothing points at would leave both running.
      [
        ...activeProgramTemplateIds,
        ...database.workoutPlans
          .map((plan) => plan.entries[0]?.workoutTemplateId)
          .filter((id): id is string => typeof id === 'string'),
      ],
    );
    if (copyTemplateId) {
      if (activeProgramTemplateIds.includes(copyTemplateId)) {
        if (options?.lead) {
          await promoteHeldProgramToLead(copyTemplateId);
        }
        return true;
      }
      // resumeHeldProgramme counts the adoption itself, once its write lands.
      const resumedCopy = await resumeHeldProgramme(copyTemplateId, options);
      if (resumedCopy !== null) {
        return resumedCopy;
      }
    }

    // Held but switched off: resumed, not rebuilt. Falling through here
    // built a fresh plan over the same id, and its updatedAt is the block
    // boundary — a programme at week 5, 12 of 24, came back from the goal
    // flow or the completion card as week 1, 0 of 24, with its week dealt
    // again while the rotation carried on (audit round 4, 2026-09-20).
    // The Active switch already keeps the plan; this is the same path, and
    // it is the same path the reader's own copy comes back through above.
    const resumedHeld = await resumeHeldProgramme(workoutTemplateId, options);
    if (resumedHeld !== null) {
      return resumedHeld;
    }
    const planId = buildReadyProgramPlanId(workoutTemplateId);
    const decision = evaluateProgramAdoption({
      activePlanIds: preferences.activePlanIds,
      targetPlanId: planId,
      proUnlocked: resolveProEntitlement(preferences).unlocked,
    });

    if (decision.kind === 'already_active') {
      return true;
    }

    if (decision.kind === 'blocked') {
      // Full on the free tier is a sale; full on Pro is not, and sending a
      // paying reader to the paywall would be selling them what they own.
      if (decision.canUpgrade) {
        // The wall first, on this screen, then Pro only if the reader asks —
        // it used to jump straight to the paywall (user 2026-09-14).
        setRunningCapSheet({ visible: true, used: decision.used, cap: decision.cap });
        return false;
      }
      showToast(t(preferences.appLanguage, 'programs.cap.full', { cap: decision.cap }));
      return false;
    }

    // The programme's own week leads. This read availability alone and fell
    // back to a three-day default, and the plan then dealt sessions round-robin
    // across whatever labels it got — so a six-session programme ran on three
    // days, twice over, and every programme became a three-day programme.
    const dayLabels = planLabelsForProgramme(
      template.sessions.length,
      preferences.setupAvailableDays,
      // Adopting is a moment, and the cycle starts from it.
      new Date(),
    );

    const plan = buildProgramWorkoutPlan({
      planId,
      workoutTemplateId,
      programName: formatWorkoutDisplayLabel(template.name),
      sessionIds: template.sessions.map((session) => session.id),
      dayLabels,
      now: new Date().toISOString(),
    });

    await upsertWorkoutPlan(plan);
    const nextActivePlanIds = addActiveProgram(preferences.activePlanIds, plan.id);
    await updatePreferences({
      activePlanIds: nextActivePlanIds,
      // Joining a season must not quietly demote the programme already at the
      // top of Home — but stepping up FROM a finished programme is the reader
      // explicitly choosing a new lead, so the completion flow passes `lead`.
      activePlanId: options?.lead ? plan.id : preferences.activePlanId ?? plan.id,
    });
    /*
     * Counted where a programme has started running: after the write.
     *
     * This fired at the top of the handler, before every early return, and
     * then (2026-09-20) above the cap check — "an attempt at one", so a free
     * reader at the cap who looked at the sheet and said no was counted as
     * having adopted a programme, and so was a write that failed. The row
     * says a programme is in use; the cap sheet is not that (analytics
     * audit, 2026-09-21).
     */
    trackEvent('plan_adopted');
    return true;
  }

  /**
   * The completion card's three answers. Each one dismisses the card for this
   * plan id — the card is a question, and every branch is an answer to it.
   */
  async function dismissCompletionCard(planId: string) {
    if (preferences.dismissedCompletionPlanIds.includes(planId)) {
      return;
    }
    await updatePreferences({
      dismissedCompletionPlanIds: [...preferences.dismissedCompletionPlanIds, planId],
    });
  }

  async function handleCompletionStartNext(planId: string, nextTemplateId: string) {
    // Adopted first, dismissed second. The card was put away before the
    // adoption was attempted, so a reader at the free programme cap saw the
    // paywall, said no — and the step-up offer was gone for good, with no way
    // back to it (2026-09-16).
    const adopted = await handleAdoptReadyProgram(nextTemplateId, { lead: true });
    if (adopted) {
      await dismissCompletionCard(planId);
    }
  }


  /**
   * Emphasis save (design screen 3): new set counts, written to the reader's
   * own template.
   *
   * Only custom programmes reach here — a catalog template is immutable at
   * runtime, so the detail screen shows no stepper for a ready programme
   * rather than one that silently does nothing. Everything except the set
   * counts is carried through unchanged, so this cannot become a rewrite of
   * the whole template disguised as an emphasis nudge.
   */
  /**
   * Writes a finished rhythm onto the plan's own entries.
   *
   * Entry labels already carry weekday keys, so this needs no new stored
   * state — and the screen only calls it once the day count is whole again,
   * so a plan can never be written mid-move.
   */
  async function handleSaveRhythm(workoutTemplateId: string, dayIndexes: number[]) {
    const plan = database.workoutPlans.find(
      (item) => item.entries[0]?.workoutTemplateId === workoutTemplateId,
    );
    if (!plan || plan.entries.length !== dayIndexes.length) {
      return;
    }
    const ordered = [...plan.entries].sort((left, right) => left.orderIndex - right.orderIndex);
    // The strip is a set of days, not a per-session assignment — it hands them
    // back Monday-first however they were tapped. Which session lands on which
    // of them is this app's answer, and it is the same one adoption gives:
    // whatever comes next in the rotation takes the first day not yet gone.
    const labels = rotateLabelsForNextSession(
      dayIndexes.map((index) => WEEKDAY_KEYS[index]),
      resolveNextPlanEntryIndex(ordered, completedSessionsForTemplate(ordered[0]?.workoutTemplateId)),
      new Date(),
    );
    const entries = ordered.map((entry, index) => ({ ...entry, label: labels[index] }));
    await upsertWorkoutPlan({
      ...plan,
      entries,
      updatedAt: plan.updatedAt,
    });

    // The other half of the same week. The plan's labels drive Home's strip and
    // the calendar; availability drives the reminders, the widget and Profile's
    // chips. Writing only the first left a reader who moved leg day here still
    // being reminded on the day they moved it off.
    const days = weekdaysFromPlanLabels(entries);
    // Only the plan Home leads with, which is the same invariant the Profile
    // picker states two functions below. Availability is one list for the
    // whole app — Profile's chips, the reminders, the widget — and a rhythm
    // is per programme. Moving a day on a programme the reader holds but has
    // switched off rewrote that list while Home and the calendar kept reading
    // the lead plan's own labels (audit round 4, 2026-09-20); so does moving a
    // day on the SECOND running programme, which the running-set test let
    // through — two may run at once (CI review of #161).
    if (days.length > 0 && plan.id === preferences.activePlanId) {
      await updatePreferences({
        setupAvailableDays: days,
        // Naming the days by hand IS self-managed; leaving the mode alone would
        // let app_managed clear the list we just wrote.
        setupScheduleMode: 'self_managed',
        // Only when the count is an answer the questionnaire can hold. A
        // one-session programme is a real rhythm but not a 2–6 answer, and
        // clamping it up would tell the recommender something untrue.
        ...(days.length >= 2 && days.length <= 6
          ? { setupDaysPerWeek: days.length as SetupDaysPerWeek }
          : {}),
      });
    }
  }

  /**
   * The weekday picker in Profile, from the other side of the same week.
   *
   * Only the lead plan is rewritten. Availability is one list for the whole
   * app, but a rhythm is per programme, and rewriting every active plan from
   * one picker would move days on programmes this screen never showed.
   */
  async function handleChangeTrainingDays(days: SetupWeekday[]) {
    // Same invariants as the onboarding day question: picking specific days
    // makes the schedule self-managed and the count follows, 2–6.
    const clamped = Math.min(6, Math.max(2, days.length)) as SetupDaysPerWeek;
    await updatePreferences({
      setupAvailableDays: days,
      setupDaysPerWeek: clamped,
      setupScheduleMode: 'self_managed',
    });

    const plan = database.workoutPlans.find((item) => item.id === preferences.activePlanId);
    if (!plan) {
      return;
    }
    const ordered = [...plan.entries].sort((left, right) => left.orderIndex - right.orderIndex);
    const labels = planLabelsFromWeekdays(ordered.length, days);
    if (!labels) {
      // Fewer days chosen than the programme has sessions. The availability is
      // stored — reminders follow it — and the rhythm the reader already has is
      // left alone rather than replaced by a week they did not choose.
      return;
    }
    // Same rule as adoption and as the rhythm strip: the session that comes
    // next takes the first training day that has not gone. Writing the spread
    // straight through put session one on the earliest weekday, so a reader
    // who moved a day mid-week was offered one session and shown another one's
    // day beside it.
    const placed = rotateLabelsForNextSession(
      labels,
      resolveNextPlanEntryIndex(ordered, completedSessionsForTemplate(ordered[0]?.workoutTemplateId)),
      new Date(),
    );
    await upsertWorkoutPlan({
      ...plan,
      entries: ordered.map((entry, index) => ({ ...entry, label: placed[index] })),
      // Untouched on purpose: the plan record's own boundary is what the week
      // counter counts from, so moving days must not restart the block.
      updatedAt: plan.updatedAt,
    });
  }

  async function handleSaveEmphasis(
    workoutTemplateId: string,
    updates: Array<{ sessionId: string; exerciseId: string; sets: number }>,
  ) {
    if (updates.length === 0) {
      return;
    }
    const setsByExerciseId = new Map(updates.map((update) => [update.exerciseId, update.sets]));
    await editWorkoutTemplateSessions(workoutTemplateId, (sessions) => ({
      kind: 'save',
      sessions: sessions.map((session) => ({
        id: session.id,
        name: session.name,
        exercises: session.exercises.map((exercise) => ({
          ...toDraftExercise(exercise),
          targetSets: setsByExerciseId.get(exercise.id) ?? exercise.targetSets,
        })),
      })),
    }));
    // The emphasis is visible on the rows it changed; a toast on top said the
    // same thing more slowly (user 2026-08-26).
    void haptics.success();
  }

  async function handleCompletionRestart(planId: string) {
    const plan = database.workoutPlans.find((entry) => entry.id === planId);
    if (!plan) {
      return;
    }
    // A fresh `updatedAt` IS the restart: the hero counts sessions from the
    // plan record's own boundary, so the new round begins at 0 of N without
    // touching a single logged session.
    await upsertWorkoutPlan({ ...plan, updatedAt: new Date().toISOString() });
    // The card goes because the block is no longer finished — 0 of N — not
    // because it was dismissed. Dismissing put the plan id on a list that is
    // never cleared, so the reader who restarted a programme was never
    // congratulated for finishing it again: the card was answered once, for
    // ever (2026-09-16). A new round is a new card, so the old dismissal is
    // dropped here rather than added to.
    if (preferences.dismissedCompletionPlanIds.includes(planId)) {
      await updatePreferences({
        dismissedCompletionPlanIds: preferences.dismissedCompletionPlanIds.filter((id) => id !== planId),
      });
    }
    // The hero counts 0 of N and the completion card is gone: the restart is
    // the thing on screen, not a sentence about it.
  }

  /**
   * Which programmes the active plans actually point at.
   *
   * Plan ids are not programme ids: onboarding writes onboarding_plan_<id> and
   * adoption writes ready_plan_<id>, so a reader who picked the season
   * programme during onboarding holds a different plan id for the same
   * programme. Membership has to be asked of the template, not the plan.
   */
  const activeProgramTemplateIds = useMemo(() => {
    const byId = new Map(database.workoutPlans.map((plan) => [plan.id, plan]));
    // The LEADER counts too. Several writers set `activePlanId` without
    // adding it to `activePlanIds` (activating a held plan, the season
    // paths), so the plan Home leads with could be missing from this set —
    // and its own detail page then offered "Start this programme" for a
    // programme that was already running (device, 2026-08-30).
    return [...new Set([preferences.activePlanId, ...preferences.activePlanIds])]
      .filter((planId): planId is string => Boolean(planId))
      .map((planId) => byId.get(planId)?.entries[0]?.workoutTemplateId ?? null)
      .filter((id): id is string => Boolean(id));
  }, [database.workoutPlans, preferences.activePlanId, preferences.activePlanIds]);

  /**
   * What a RUNNING programme is called, wherever it is listed.
   *
   * Its presentation title, the name its own page wears, and a plan whose
   * template is gone falls back to the plan's own name. A programme tagged
   * for a season used to go by the season's name here instead, and that tag
   * covers twenty-odd ordinary programmes: STRONG Elite was "Talvikunto" in
   * the list and STRONG Elite once opened (user 2026-09-21, "poistetaan
   * kaikki talvikunto kesäkunto").
   *
   * One function because the comment that used to sit inside Home's copy was
   * right: computing this per screen is what put three different names on one
   * programme. The Programs tab now lists the same programmes Home does, so
   * it had to reach the same answer.
   */
  const runningProgrammeTitle = useCallback(
    (templateId: string | null, planName: string | null | undefined, days: number): string => {
      const template = templateId ? getWorkoutTemplateById(templateId) : null;
      if (template) {
        return getReadyTemplatePresentation(template, preferences.appLanguage, days).title;
      }
      return formatWorkoutDisplayLabel(planName || '');
    },
    [preferences.appLanguage],
  );

  /**
   * The programmes running alongside the one Home leads with.
   *
   * Home's hero still belongs to a single plan; these are the rest, listed
   * under it so a season the reader joined is visible rather than merely
   * stored.
   */
  const homeOtherPrograms = useMemo(() => {
    const byId = new Map(database.workoutPlans.map((plan) => [plan.id, plan]));
    return preferences.activePlanIds
      .filter((planId) => planId !== preferences.activePlanId)
      .map((planId) => {
        const plan = byId.get(planId);
        const templateId = plan?.entries[0]?.workoutTemplateId ?? null;
        const template = templateId ? getWorkoutTemplateById(templateId) : null;
        if (!plan) {
          return null;
        }
        const days = template?.daysPerWeek ?? plan.entries.length;
        // The reader's own programme is named by its template, for the same
        // reason the hero above is: the plan's copy of the name can be older
        // than the last rename. A ready one is not in this map at all, and
        // gets its presentation title from runningProgrammeTitle — the one
        // helper every surface names a running programme with.
        const ownTemplate = templateId
          ? workoutTemplates.find((entry) => entry.id === templateId) ?? null
          : null;
        return {
          planId,
          title: runningProgrammeTitle(templateId, ownTemplate?.name || plan.name, days),
          meta: t(preferences.appLanguage, 'programs.card.days', { count: days }),
        };
      })
      .filter((row): row is { planId: string; title: string; meta: string } => row !== null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    database.workoutPlans,
    preferences.activePlanIds,
    preferences.activePlanId,
    preferences.appLanguage,
    workoutTemplates,
  ]);

  /** The reader dropping a programme — the only path that removes one. */
  /**
   * Make a programme you already hold the one Home leads with.
   *
   * Matched on the template rather than the plan id, because the same programme
   * can be held under a plan id minted by onboarding, by adoption, or by a
   * season — and all three are equally "this programme".
   */
  async function promoteHeldProgramToLead(workoutTemplateId: string) {
    const plan = database.workoutPlans.find(
      (entry) =>
        preferences.activePlanIds.includes(entry.id) &&
        entry.entries[0]?.workoutTemplateId === workoutTemplateId,
    );
    if (!plan || preferences.activePlanId === plan.id) {
      return;
    }
    await updatePreferences({ activePlanId: plan.id });
  }

  /**
   * Stop a programme from its own page, by programme rather than by plan.
   *
   * The detail screen knows a template id; `handleRemoveActiveProgram` wants a
   * plan id, and one programme can be held under more than one — onboarding
   * writes `onboarding_plan_<id>` and adoption writes `ready_plan_<id>`. Every
   * plan pointing at this programme goes, or the switch would read off while
   * the programme was still running under the other id.
   */
  async function handleStopProgram(workoutTemplateId: string) {
    const stopped = stopProgramme({
      activePlanId: preferences.activePlanId,
      activePlanIds: preferences.activePlanIds,
      plans: database.workoutPlans,
      templateId: workoutTemplateId,
    });
    if (!stopped) {
      return;
    }
    await updatePreferences(stopped);
  }

  /**
   * The Active switch, turned on: this programme becomes THE active one.
   *
   * One programme is active and the others the reader holds stay theirs
   * (user 2026-09-21), so this makes it the lead and leaves the rest where
   * they are. One the reader switched off comes back under the plan it
   * already has, so its block and its place in the rotation come back with
   * it — and through the same cap the adoption path answers to, because
   * running is what the cap counts (device, 2026-09-16: the switch used to be
   * a one-way door). The page has already asked whether to move off the
   * programme that was active.
   */
  async function handleResumeProgram(workoutTemplateId: string) {
    const resumed = resumeProgramme({
      activePlanId: preferences.activePlanId,
      activePlanIds: preferences.activePlanIds,
      plans: database.workoutPlans,
      templateId: workoutTemplateId,
    });
    if (!resumed) {
      return;
    }
    const decision = evaluateProgramAdoption({
      activePlanIds: preferences.activePlanIds,
      targetPlanId: resumed.planId,
      proUnlocked: resolveProEntitlement(preferences).unlocked,
    });
    if (decision.kind === 'blocked') {
      if (decision.canUpgrade) {
        setRunningCapSheet({ visible: true, used: decision.used, cap: decision.cap });
        return;
      }
      showToast(t(preferences.appLanguage, 'programs.cap.full', { cap: decision.cap }));
      return;
    }
    await updatePreferences({ activePlanIds: resumed.activePlanIds, activePlanId: resumed.activePlanId });
    // A programme switched back on is a programme taken into use; one that
    // was running already and only became the lead is not (analytics audit,
    // 2026-09-21).
    if (joinedRunningSet(preferences.activePlanIds, resumed.activePlanIds)) {
      trackEvent('plan_adopted');
    }
  }

  /**
   * The active programme switched off, and the reader said yes to making
   * another one active instead (user 2026-09-22).
   *
   * One write: every plan of the old programme stops and the chosen one leads,
   * joining the running set if the reader had switched it off. Stopping and
   * then resuming in two writes would read the running set from the render
   * before the first. The count cannot grow, so the cap has nothing to refuse.
   */
  async function handleSwitchActiveProgram(fromTemplateId: string, to: { templateId: string; planId: string | null }) {
    // One of the reader's own programmes never started has no plan yet: it
    // gets the week adoption would give it, stored first, and the switch
    // below counts it among the plans (CI review of #179).
    let plans = database.workoutPlans;
    let toPlanId = to.planId;
    if (!toPlanId) {
      const plan = buildCustomProgrammePlan(to.templateId);
      if (!plan) {
        return;
      }
      await upsertWorkoutPlan(plan);
      plans = [...plans.filter((entry) => entry.id !== plan.id), plan];
      toPlanId = plan.id;
    }
    const next = switchActiveProgramme({
      activePlanId: preferences.activePlanId,
      activePlanIds: preferences.activePlanIds,
      plans,
      fromTemplateId,
      toPlanId,
    });
    await updatePreferences(next);
    // A programme switched back on is a programme taken into use.
    if (joinedRunningSet(preferences.activePlanIds, next.activePlanIds)) {
      trackEvent('plan_adopted');
    }
  }

  /**
   * "Remove from my programmes", for a programme with no template of its own.
   *
   * Deleting a custom programme deletes its template; a ready programme's
   * template is catalog data, so what goes is every plan that holds it. The
   * page the reader deleted it from goes with it, the same way a deleted
   * custom programme's pages do.
   */
  async function handleForgetHeldProgram(workoutTemplateId: string) {
    // The same rule as deleting your own programme: not mid-workout on it.
    // A ready programme's session still saves, but the running slot went
    // mid-workout and the player's week line with it (break round,
    // 2026-09-28).
    if (liveSessionBlocksProgrammeDelete(workout.activeSession, workoutTemplateId)) {
      void haptics.error();
      showToast(t(preferences.appLanguage, 'toast.programDeleteWorkoutRunning'));
      return;
    }
    await forgetHeldProgramme(workoutTemplateId);
    void haptics.success();
    leaveDeletedProgramme(workoutTemplateId);
  }

  async function handleRemoveActiveProgram(planId: string) {
    await updatePreferences({
      activePlanIds: removeActiveProgram(preferences.activePlanIds, planId),
      activePlanId:
        preferences.activePlanId === planId
          ? removeActiveProgram(preferences.activePlanIds, planId)[0] ?? null
          : preferences.activePlanId,
    });
  }

  function handleStartReadyProgram(workoutTemplateId: string) {
    const template = getWorkoutTemplateById(workoutTemplateId);
    const firstSessionId = template?.sessions[0]?.id;
    if (!firstSessionId) {
      return;
    }

    handleStartReadyProgramSession(workoutTemplateId, firstSessionId);
  }

  function handleStartCustomProgramSession(workoutTemplateId: string, sessionId: string) {
    const customTemplate = customWorkoutRuntimeMap[workoutTemplateId];
    if (!customTemplate) {
      return;
    }

    const selectedSession = customTemplate.sessions.find((session) => session.id === sessionId) ?? null;
    if (!selectedSession?.exercises.length) {
      showToast(t(preferences.appLanguage, 'toast.addExercisesSession'));
      // To the day itself, where "Lisää liike" is. It went to the template
      // editor, which a programme page no longer opens — and a day can be
      // empty now on purpose, named first and filled after (2026-09-26).
      if (selectedSession) {
        navigate({ tab: 'workout', screen: 'programDay', programType: 'custom', workoutTemplateId, sessionId });
      }
      return;
    }

    // Same rule as the ready-programme start above.
    if (navigateToActiveWorkout({ resume: isActiveSessionFor(workoutTemplateId, sessionId) })) {
      return;
    }

    guardStrengthStartOverCardio(() => {
      // Nor here: training leaves the active programme where it is, as on the
      // ready path above.
      void updatePreferences({ trainingFirstRunDismissed: true });
      const sessionRef = { programId: workoutTemplateId, sessionId };
      const runtimeTemplate = applySessionAdaptation(
        buildCustomSessionRuntimeTemplate(customTemplate, sessionId),
        sessionAdaptationFor(sessionRef),
      );
      startProgrammeWorkout(runtimeTemplate, unitPreference);
      setHeldSessionAdaptations((held) => spendHeldAdaptation(held, sessionRef));
      navigateToGuidedWorkout(workoutTemplateId);
    });
  }

  /**
   * "Ota ohjelma käyttöön" on a program of the reader's own.
   *
   * The ready-program half of this was fixed and the custom half was not, which
   * left a program the reader built or imported reachable only as a list of
   * sessions to start one at a time. Reported by a reader who imported their own
   * six-day program and could not get it onto the home screen by any route —
   * Home offered the catalog and onboarding, and neither of those knows about a
   * program that came from a spreadsheet.
   *
   * Adoption is the same act whatever the program's source, so this is
   * `handleAdoptReadyProgram` with the template read from the reader's own
   * templates and the plan id from the custom namespace.
   */
  /**
   * "Today is legs, not upper."
   *
   * The rotation decides what comes next in the programme and is right nearly
   * every day; what it cannot know is that the reader's day went differently.
   * The pick is dated, so it answers for today and the rotation answers again
   * tomorrow — nothing has to remember to clear it.
   */
  async function handlePickTodaySession(sessionId: string) {
    const now = new Date();
    await updatePreferences({
      todaySession: {
        dayStart: new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime(),
        sessionId,
        // The instant matters, not just the day: picking a session you already
        // trained today is how you say "again", and without a timestamp it was
        // indistinguishable from the stale pick left over from this morning.
        pickedAt: now.getTime(),
      },
    });
  }

  const {
    handleRenameProgramSession,
    handleRenameCustomProgram,
    handleReorderProgramSession,
    handleAddProgramSession,
    handleRemoveProgramSession,
    syncPlanToTemplate,
  } = createProgrammeDayEdits({
    database,
    preferences,
    updatePreferences,
    editWorkoutTemplateSessions,
    renameWorkoutTemplate,
    getWorkoutTemplateSessionsFresh,
    upsertWorkoutPlan,
    completedSessionsForTemplate,
    showToast,
  });

  /**
   * Take one lift out of the programme for good, from wherever the reader is
   * looking at it.
   *
   * "Jätä tänään pois" answers today; this answers the plan. They sit together
   * because the reader asking "how do I get rid of this exercise" does not yet
   * know which of the two they mean, and offering only the temporary one sent
   * them hunting for an editor they could not find (user 2026-08-26).
   *
   * A ready programme is immutable at runtime, so removing from one means the
   * programme becomes the reader's own. That copy is made silently and takes
   * the plan's place — the reader asked to drop a lift, not to learn how the
   * catalog is stored. The one thing not done silently is spending their last
   * programme slot: that is said before anything is written, because finding
   * out at a paywall mid-edit is the surprise the silence was meant to avoid.
   */
  /**
   * How full the programme set is, for the line the Programs tab shows.
   *
   * This was a toast on every adoption for about an hour. It was the wrong
   * shape twice over: a popup that says what the screen behind it already
   * shows is the thing the reader keeps asking to be rid of ("otit ohjelman
   * käyttöön", #bugs 2026-08-26), and a count nobody is near is a sign about
   * nothing. So it sits on the list it describes, and only once there is one
   * place left — the point of it was never to report, it was to stop the cap
   * arriving as news.
   *
   * Counted from the set as it stands, which is what that list is showing.
   */
  const programCapLine = useMemo(() => {
    const state = describeProgramCap({
      activePlanIds: preferences.activePlanIds,
      proUnlocked: resolveProEntitlement(preferences).unlocked,
    });
    const key = programCapLineKey(state);
    return key
      ? t(preferences.appLanguage, `programs.cap.${key}` as I18nKey, { used: state.used, cap: state.cap })
      : null;
  }, [preferences]);

  const { handleEditProgramExercise } = useProgramExerciseEdit({
    exerciseLibrary,
    preferences,
    database,
    workout,
    workoutTemplates,
    programSlots,
    editWorkoutTemplateSessions,
    findWorkoutTemplateIdBySource,
    upsertWorkoutTemplate,
    getWorkoutTemplateSessionsFresh,
    upsertWorkoutPlan,
    updatePreferences,
    forgetHeldProgramme,
    navigate,
    showToast,
    adaptSession,
    setProgramLimitVisible,
  });

  /** Resolves true once the programme is running, false when it was not taken on. */
  /**
   * The plan that takes one of the reader's own programmes into use, or null
   * when it has no lift to train. Shared by adoption and by switching the
   * active programme off in its favour, so both build the same week.
   */
  function buildCustomProgrammePlan(workoutTemplateId: string) {
    const template = customWorkoutRuntimeMap[workoutTemplateId];
    const sessionIds = (template?.sessions ?? [])
      .filter((session) => session.exercises.length > 0)
      .map((session) => session.id);
    if (sessionIds.length === 0) {
      return null;
    }
    // The program's own session count leads, exactly as it does for a ready
    // programme: an imported six-day week dealt across three chosen weekdays
    // would run every session twice and call itself a three-day programme.
    const dayLabels = planLabelsForProgramme(sessionIds.length, preferences.setupAvailableDays, new Date());
    return buildProgramWorkoutPlan({
      planId: buildCustomProgramPlanId(workoutTemplateId),
      workoutTemplateId,
      programName: formatWorkoutDisplayLabel(template?.name ?? ''),
      sessionIds,
      dayLabels,
      now: new Date().toISOString(),
    });
  }

  async function handleAdoptCustomProgram(workoutTemplateId: string, options?: { lead?: boolean }): Promise<boolean> {
    const template = customWorkoutRuntimeMap[workoutTemplateId];
    // An empty program is not a plan. Home would draw a card with no session
    // behind it, so the editor is the honest destination.
    const sessionIds = (template?.sessions ?? [])
      .filter((session) => session.exercises.length > 0)
      .map((session) => session.id);
    if (sessionIds.length === 0) {
      showToast(t(preferences.appLanguage, 'toast.addExercisesTemplate'));
      navigate({ tab: 'workout', screen: 'template', workoutTemplateId });
      return false;
    }

    if (activeProgramTemplateIds.includes(workoutTemplateId)) {
      if (options?.lead) {
        await promoteHeldProgramToLead(workoutTemplateId);
      }
      return true;
    }

    const planId = buildCustomProgramPlanId(workoutTemplateId);
    const decision = evaluateProgramAdoption({
      activePlanIds: preferences.activePlanIds,
      targetPlanId: planId,
      proUnlocked: resolveProEntitlement(preferences).unlocked,
    });

    if (decision.kind === 'already_active') {
      return true;
    }

    if (decision.kind === 'blocked') {
      if (decision.canUpgrade) {
        setRunningCapSheet({ visible: true, used: decision.used, cap: decision.cap });
        return false;
      }
      showToast(t(preferences.appLanguage, 'programs.cap.full', { cap: decision.cap }));
      return false;
    }

    const plan = buildCustomProgrammePlan(workoutTemplateId);
    if (!plan) {
      return false;
    }

    await upsertWorkoutPlan(plan);
    await updatePreferences({
      activePlanIds: addActiveProgram(preferences.activePlanIds, plan.id),
      activePlanId: options?.lead ? plan.id : preferences.activePlanId ?? plan.id,
    });
    // The reader's own programme taken into use is an adoption like a ready
    // one, and was never counted as one (analytics audit, 2026-09-21).
    trackEvent('plan_adopted');
    return true;
  }

  function handleStartCustomProgram(workoutTemplateId: string) {
    const customTemplate = customWorkoutRuntimeMap[workoutTemplateId];
    const firstSessionId = customTemplate?.sessions.find((session) => session.exercises.length > 0)?.id;
    if (!firstSessionId) {
      showToast(t(preferences.appLanguage, 'toast.addExercisesTemplate'));
      navigate({ tab: 'workout', screen: 'template', workoutTemplateId });
      return;
    }

    handleStartCustomProgramSession(workoutTemplateId, firstSessionId);
  }


  async function handleDeleteCustomWorkout(workoutTemplateId: string) {
    // Not while one of its days is running: the player would be routed to a
    // programme that is gone, and the sets in it could never be saved.
    if (liveSessionBlocksProgrammeDelete(workout.activeSession, workoutTemplateId)) {
      void haptics.error();
      showToast(t(preferences.appLanguage, 'toast.programDeleteWorkoutRunning'));
      return;
    }
    await deleteWorkoutTemplate(workoutTemplateId);
    void haptics.success();
    leaveDeletedProgramme(workoutTemplateId);
  }

  /**
   * Off the page of a programme that no longer exists, and out of its pages.
   *
   * The programme's pages go with the programme. `navigate` pushes, so the
   * page the reader deleted it from stayed in the back stack: Back returned
   * to a programme that no longer exists, the route guard bounced them to
   * the list, and Back read as broken (2026-09-16).
   */
  function leaveDeletedProgramme(workoutTemplateId: string) {
    startTransition(() =>
      setNavigationState((current) => ({
        route: workoutHomeRoute,
        // And no copy of the destination left on top of the stack: the
        // programme was opened FROM this list, so without the second call the
        // first Back press pops the duplicate and lands on the screen the
        // reader is already looking at (PR #126 review).
        history: withoutTrailingRoute(
          forgetRoutesForTemplate(current.history, workoutTemplateId),
          workoutHomeRoute,
        ),
      })),
    );
  }

  async function handleOnboardingPickReadyProgram(programId: string) {
    if (busySavingReadyPick) {
      return;
    }
    setBusySavingReadyPick(true);
    try {
      // Actually ADOPT the programme, don't just remember that it was suggested.
      //
      // This wrote `recommendedProgramId: programId, activePlanId: null`, and a
      // recommendation is not a plan: Home reads the active plan, so a reader
      // who picked a programme here landed on a Home that showed no programme
      // at all and a Profile that said "no programme selected". The pick was
      // stored, and invisible. Every other way into a ready programme —
      // joining a season, stepping up after a completion — goes through
      // handleAdoptReadyProgram and builds this plan record; onboarding was the
      // one door that skipped it.
      const template = getWorkoutTemplateById(programId);
      // A template's day count is a plain number; the preference is a union of
      // the five the questionnaire offers. Narrow rather than cast, so a
      // catalog entry outside that range stores null instead of a value the
      // rest of the app has no branch for.
      const templateDaysPerWeek =
        template && isSetupDaysPerWeek(template.daysPerWeek) ? template.daysPerWeek : null;
      let adoptedPlanId: string | null = null;
      if (template) {
        // No questionnaire ran on this path, so there are no chosen weekdays to
        // hang the sessions on. The programme's own session count is a fact
        // about the thing the reader just picked, so the rhythm for THAT count
        // beats a global fallback — placed the way every other adoption places
        // it, with day 1 on the first training day still ahead. The unrotated
        // rhythm put day 1 on Monday whatever day the pick was made, while
        // Home offered it today (2026-09-17; the guided path was fixed in #125).
        const dayLabels = planLabelsForProgramme(template.sessions.length, [], new Date());
        const plan = buildProgramWorkoutPlan({
          planId: buildReadyProgramPlanId(programId),
          workoutTemplateId: programId,
          programName: formatWorkoutDisplayLabel(template.name),
          sessionIds: template.sessions.map((session) => session.id),
          dayLabels,
          now: new Date().toISOString(),
        });
        // upsertWorkoutPlan and completeOnboarding both run through the
        // provider's serial queue, so awaiting in order is enough — the plan
        // exists before any preference points at it.
        await upsertWorkoutPlan(plan);
        adoptedPlanId = plan.id;
      }
      // The same rule as the guided finishes: onboarding's earlier plan is
      // replaced, and a season or a programme adopted by hand keeps running.
      // No template, no plan — and nothing that was running is stopped. Held
      // in a name because the adoption below is read off it.
      const activation = adoptedPlanId
        ? activateOnboardingPlan(
            preferences,
            adoptedPlanId,
            resolveActiveProgramCap(resolveProEntitlement(preferences).unlocked),
          )
        : null;

      // Finished, by the catalogue rather than by the questionnaire (fixed
      // 2026-09-10). Four paths complete onboarding and only one of them used
      // to say so, so the funnel's last row read 0 % while people plainly got
      // through it — plans adopted and workouts logged under a step nobody had
      // reached. `path` is what tells the four apart. Sent below, once the
      // write has landed.
      // The ready path skips the About form, so every basic here is normally
      // null — that is fine and deliberate. Guided onboarding is the path that
      // fills them. No questionnaire ran either, so setup stays incomplete.
      await completeOnboarding({
        onboardingCompleted: true,
        setupCompleted: false,
        trainingFirstRunDismissed: false,
        setupGender: aboutYouValues?.gender ?? null,
        setupAgeRange: aboutYouValues?.ageRange ?? null,
        setupCurrentWeightKg: aboutYouValues?.weightKg ?? null,
        // Kept as well as the plan: the recommendation is what the catalog
        // highlights on a later visit, the plan is what Home trains from.
        recommendedProgramId: programId,
        setupDaysPerWeek: templateDaysPerWeek,
        ...(activation ?? {}),
      });
      trackEvent('onboarding_completed', { path: 'ready_catalog' });
      // The pick is a programme taken into use, and this door sent only the
      // completion: the funnel's "programme in use" row missed every reader
      // who started from the catalogue (analytics audit, 2026-09-21).
      if (activation && joinedRunningSet(preferences.activePlanIds, activation.activePlanIds)) {
        trackEvent('plan_adopted');
      }
      // No weigh-in written here: the setup weight is logged once, by the
      // flagged seeding effect, which this and the effect both writing used to
      // turn into two identical entries.
      resetToRoute(ROOT_ROUTES.home);
    } catch (error) {
      // The reader tapped a programme and nothing happened: the button came
      // back and no reason was given (2026-09-17). Said out loud now, the
      // same way the guided finish says it.
      console.error('Failed to save the onboarding catalogue pick', error);
      showToast(t(preferences.appLanguage, 'toast.planSaveFailed'));
    } finally {
      setBusySavingReadyPick(false);
    }
  }

  /**
   * A photo of a programme, as the CSV text the paste box would have held.
   *
   * Every failure returns null on purpose: no network, no permission, an
   * unreadable photo and a photo of something else all leave the reader with
   * nothing to import, and the sheet says so in one sentence rather than
   * teaching them the difference.
   */
  /**
   * Import a programme from a photo — the live coach's path, and only its.
   *
   * `requestProgramTableFromImage` returns null before it makes a request
   * when there is no endpoint, so in a preview build the button opened the
   * gallery, took a photo the reader had to choose, and produced nothing at
   * all. The button is offered only when there is something behind it
   * (2026-09-16).
   */
  /**
   * The notice, before the photo leaves — the one the policy promises.
   *
   * The policy: the AI coach's online mode is sent "when you read a notice
   * and then send a question, ask for a programme, or import one from a
   * photo" — docs/legal/privacy, both languages. The notice existed in
   * exactly one place, the chat screen, and
   * `aiOnlineNoticeAcknowledged` was read only there. The photo import is
   * reached from the Programs tab, the training plan and Settings, none of
   * which touches the chat, so a reader who had never opened the coach could
   * send a photo of their programme with nothing said at all (audit 3,
   * 2026-09-19).
   *
   * Here rather than in the sheet, because the sheet is rendered from three
   * screens and a fourth entry point would miss a gate placed in it. This is
   * the one function every path goes through.
   */
  function askPhotoOnlineNotice(): Promise<boolean> {
    // Its own flag, and the chat's as well — one way only. The chat's notice
    // covers everything this one does and a great deal more (the workouts, the
    // programme, the goals, the weight and measurements, height, age, gender,
    // the conversation so far), so a reader who has read THAT has been told
    // about a photo too. Answering this one cannot stand in for that: sharing
    // the flag would have let a reader who only ever saw "one photo, and
    // nothing else about you" send all of it later with no notice at all
    // (CI review of #146).
    if (preferences.aiPhotoNoticeAcknowledged || preferences.aiOnlineNoticeAcknowledged) {
      return Promise.resolve(true);
    }
    return new Promise((resolve) => {
      Alert.alert(
        t(preferences.appLanguage, 'csv.photo.notice.title'),
        t(preferences.appLanguage, 'csv.photo.notice.body'),
        [
          { text: t(preferences.appLanguage, 'csv.photo.notice.cancel'), style: 'cancel', onPress: () => resolve(false) },
          {
            text: t(preferences.appLanguage, 'csv.photo.notice.continue'),
            onPress: () => {
              // This notice only. The chat asks its own, because it discloses
              // its own.
              void updatePreferences({ aiPhotoNoticeAcknowledged: true });
              resolve(true);
            },
          },
        ],
        { cancelable: true, onDismiss: () => resolve(false) },
      );
    });
  }

  async function pickProgramImageForImport(): Promise<ProgramImageImportResult> {
    // Pro only (user 2026-09-29): each photo is a paid model call. The sheet
    // locks its link, but a sheet whose caller forgot proUnlocked defaults to
    // unlocked, so the paid call itself checks too.
    if (!resolveProEntitlement(preferences).unlocked) {
      return { status: 'cancelled' };
    }
    if (!(await askPhotoOnlineNotice())) {
      return { status: 'cancelled' };
    }
    const picked = await pickProgramImage();
    if (picked.status === 'cancelled') {
      // Backing out of the picker is an answer, not a failure. It used to come
      // back as the same null every other ending did, so the sheet told a
      // reader who had chosen nothing that their photo could not be read.
      return { status: 'cancelled' };
    }
    if (picked.status !== 'picked') {
      return { status: 'failed' };
    }
    const rows = await requestProgramTableFromImage({
      ...picked.image,
      // The photo line of the consent sheet, read at the moment the photo is
      // sent rather than remembered from when the screen opened.
      keepConsent: preferences.aiLogPhotoConsent,
      logId: preferences.aiLogId,
    });
    return rows && rows.length > 0 ? { status: 'read', csv: programTableToCsv(rows) } : { status: 'failed' };
  }

  const handlePickProgramImage = isAiCoachLiveConfigured() ? pickProgramImageForImport : undefined;

  async function handleContinueEntry() {
    await updatePreferences({
      selectedSignInMethod: 'local',
      entryFlowCompleted: true,
      selectedAccessTier: 'free',
    });
    // "Let's begin" opens the theme question (user 2026-08-23). It sits here
    // rather than anywhere later because the answer decides what the rest of
    // onboarding looks like — asking afterwards would repaint a flow the
    // reader has already been through.
    setThemeChoiceVisible(true);
  }

  async function handleBackToEntry() {
    await updatePreferences({
      entryFlowCompleted: false,
    });
  }

  /**
   * Onboarding's save, with both ways it can fail said out loud.
   *
   * Setup can be answered again from Profile at any time, and every run writes
   * a new programme of the reader's own. A free reader who already keeps three
   * had the provider refuse the fourth — and nothing caught the refusal: the
   * button came back, nothing happened, and no reason was given. The limit
   * sheet is the reason, the same one shown everywhere else a programme is
   * made. Anything else is a failed save, and says so.
   */
  /** The draft, carrying the id of the untouched onboarding programme it replaces, if any. */
  function withReplaceableOnboardingId(draft: WorkoutTemplateDraft): WorkoutTemplateDraft {
    const replaceableId = findReplaceableOnboardingTemplateId({
      activePlanId: preferences.activePlanId,
      activePlanIds: preferences.activePlanIds,
      templates: database.workoutTemplates,
      sessions: database.workoutSessions,
    });
    return replaceableId ? { ...draft, id: replaceableId } : draft;
  }

  async function saveOnboardingOrExplain(input: Parameters<typeof saveOnboardingResult>[0]): Promise<boolean> {
    try {
      await saveOnboardingResult(input);
      return true;
    } catch (error) {
      if (error instanceof ProgramLimitReachedError) {
        setProgramLimitVisible(true);
        return false;
      }
      console.error('Failed to save the onboarding result', error);
      showToast(t(preferences.appLanguage, 'toast.planSaveFailed'));
      return false;
    }
  }

  async function handleOnboardingCompleteToTraining(
    selection: FirstRunSetupSelection,
    recommendedProgramId: string,
  ) {
    // Was three seconds of setTimeout before any of this ran, so finishing
    // onboarding took the real work plus a flat 3s of nothing — reported from
    // the phone as a five-second freeze on "Kysy myöhemmin" and "Hanki Pro".
    // The saving state is shown for as long as saving actually takes, which is
    // the same rule the workout save already follows.
    const savedPlan = buildSavedOnboardingPlan(
      selection,
      recommendedProgramId,
      preferences.appLanguage,
    );
    // One save, not four. Preferences, the template, its exercises and the plan
    // used to be four awaited mutations in a row, each one serializing the whole
    // database through the same queue — at the end of onboarding, where the wait
    // is least affordable. The plan is built inside that single lock because it
    // needs the id the template upsert generates.
    let joined = false;
    const saved = await saveOnboardingOrExplain({
      preferences: {
        onboardingCompleted: true,
        ...buildSetupPreferencePatch(selection, recommendedProgramId, preferences.trainingCycle),
      },
      // A new run of the questionnaire writes over the programme the last run
      // made, unless the reader has changed it since.
      templateDraft: withReplaceableOnboardingId(savedPlan.draft),
      // Session ids come from the template that was actually written, not from
      // the in-memory draft it was built from.
      buildPlan: (workoutTemplateId, sessionIds) =>
        buildSavedOnboardingWorkoutPlan(
          selection,
          workoutTemplateId,
          sessionIds,
          preferences.appLanguage,
        ),
      activate: (planId, current) => {
        const next = activateOnboardingPlan(current, planId, resolveActiveProgramCap(resolveProEntitlement(current).unlocked));
        // Read inside the lock, against the set as it stands there.
        joined = joinedRunningSet(current.activePlanIds, next.activePlanIds);
        return next;
      },
    });
    if (!saved) {
      return;
    }
    // The questionnaire's finish, counted. The only call for this path sat in
    // a finish handler nothing on screen reached, so the funnel's last row
    // missed the path most readers take (2026-09-17).
    trackEvent('onboarding_completed', { path: 'build' });
    // And the programme it built, which is running now. This path sent only
    // the completion, so "programme in use" missed most first runs
    // (analytics audit, 2026-09-21).
    if (joined) {
      trackEvent('plan_adopted');
    }
    // The About form's weight reaches the log through the flagged seeding
    // effect, once. Writing it here as well gave a first run two identical
    // weigh-ins: the effect fires as soon as onboarding is marked done, and
    // this check read a `database` from before the save, always empty.
    // Onboarding ends here, on the app itself.
    //
    // Two paywalls have been removed from this seam. First the hop to the
    // standalone pro_offer screen, when the sale moved inside onboarding as
    // its last step; then that last step too (user 2026-08-24) — the reader
    // has just been handed a programme, and asking for money in the same
    // breath is the wrong moment. Both orphaned screens were deleted on
    // 2026-08-25; the Pro page in Profile is where the sale lives.
    // The success buzz, now that there is a success: the review screen's
    // button used to buzz on press, before the save had even started.
    void haptics.success();
    resetToRoute(ROOT_ROUTES.home);
  }

  /**
   * My Data's "Edit limitations", saved as what it is: a preference.
   *
   * The step used to walk on into a whole new programme, so a limitation
   * counted only if the reader rebuilt their training behind it, and backing
   * out dropped it (2026-09-17). Back to My Data once the write has landed;
   * a refused write keeps the step open and says so.
   */
  async function handleSaveSetupLimitations(cautionFlags: SetupCautionFlag[]) {
    try {
      await updatePreferences({ setupCautionFlags: cautionFlags });
    } catch (error) {
      console.error('Failed to save the limitations', error);
      showToast(t(preferences.appLanguage, 'toast.limitationsSaveFailed'));
      return;
    }
    void haptics.success();
    navigateBack(ROOT_ROUTES.profile);
  }

  function handleOpenPremium() {
    navigate({ tab: 'profile', screen: 'premium' });
  }

  async function handleSetupCompleteToTraining(selection: FirstRunSetupSelection, recommendedProgramId: string) {
    // Was three seconds of setTimeout before any of this ran, so finishing
    // onboarding took the real work plus a flat 3s of nothing — reported from
    // the phone as a five-second freeze on "Kysy myöhemmin" and "Hanki Pro".
    // The saving state is shown for as long as saving actually takes, which is
    // the same rule the workout save already follows.
    const savedPlan = buildSavedOnboardingPlan(
      selection,
      recommendedProgramId,
      preferences.appLanguage,
    );
    // One save, not four. Preferences, the template, its exercises and the plan
    // used to be four awaited mutations in a row, each one serializing the whole
    // database through the same queue — at the end of onboarding, where the wait
    // is least affordable. The plan is built inside that single lock because it
    // needs the id the template upsert generates.
    let joined = false;
    const saved = await saveOnboardingOrExplain({
      preferences: {
        onboardingCompleted: true,
        ...buildSetupPreferencePatch(selection, recommendedProgramId, preferences.trainingCycle),
      },
      // A new run of the questionnaire writes over the programme the last run
      // made, unless the reader has changed it since.
      templateDraft: withReplaceableOnboardingId(savedPlan.draft),
      // Session ids come from the template that was actually written, not from
      // the in-memory draft it was built from.
      buildPlan: (workoutTemplateId, sessionIds) =>
        buildSavedOnboardingWorkoutPlan(
          selection,
          workoutTemplateId,
          sessionIds,
          preferences.appLanguage,
        ),
      activate: (planId, current) => {
        const next = activateOnboardingPlan(current, planId, resolveActiveProgramCap(resolveProEntitlement(current).unlocked));
        joined = joinedRunningSet(current.activePlanIds, next.activePlanIds);
        return next;
      },
    });
    if (!saved) {
      return;
    }
    // A re-run that wrote over its own untouched programme adds nothing; one
    // that built a new programme beside it took that one into use
    // (analytics audit, 2026-09-21).
    if (joined) {
      trackEvent('plan_adopted');
    }
    // No weigh-in on a re-run. The questions carry the stored setup weight
    // through without asking for a new one, so there is nothing new to log —
    // and an empty log here is usually one the reader emptied: this put their
    // deleted weigh-in straight back (2026-09-17). The first one is the
    // seeding effect's, once.
    void haptics.success();
    resetToRoute(ROOT_ROUTES.home);
  }

  const {
    customWorkoutRuntimeMap,
    customWorkouts,
    programInsightsByTemplateId,
    selectedCustomProgram,
    recentExerciseBrowserItems,
    exercisePrLookup,
  } = useCustomProgramViews({
    workoutTemplates,
    getWorkoutTemplateSessions,
    getWorkoutExercises,
    exerciseLibrary,
    preferences,
    database,
    unitPreference,
    workout,
  });
  const proEntitlement = resolveProEntitlement(preferences);
  const coachProUnlocked = proEntitlement.unlocked;

  const { coachDemoMoment, coachDemoQuestion } = useCoachDemoMoment({
    preferences,
    coachProUnlocked,
    database,
    proLiftHistories,
    proFatigue,
  });

  const { handleResetAllData, handleCoachAdviceGiven } = useCoachAdviceMemory({
    resetAllData,
    setCoachAdviceMemory,
    setCoachChatMemory,
    setHeldSessionAdaptations,
  });

  const { premiumTrialEndsAt, analysisSessionId, coachLastSession } = useCoachEntryReadings({
    route,
    workoutSessions,
    database,
    preferences,
  });
  const { availableEquipmentForDrills, routineBlockSeconds, routineSecondsForExercises } = useRoutineBlockCosts({
    preferences,
  });
  const {
    setupSelection,
    latestWeighInKg,
    setupEditSelection,
    setupBasics,
    tailoringPreferences,
    setupRecommendation,
    currentFitReadyTemplate,
    recommendedReadyTemplate,
    recommendedReadyContent,
  } = useSetupReadings({
    preferences,
    bodyweightProgress,
  });
  const homeActivePlanCard = useMemo(() => {
    const completedPlanSessions = getCanonicalCompletedSessions(database);
    // Local midnight, to date the reader's hand-picked session against. Read
    // from the day key rather than from the clock, so an app left open
    // overnight moves on with the reader rather than keeping yesterday — and
    // local rather than UTC, the same midnight the calendar and the widget
    // mean.
    const todayDayStart = todayStartMs;
    /** The local midnight an ISO timestamp falls in — not the UTC one. */
    const toDayStartMs = (iso: string) => {
      const date = new Date(iso);
      return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    };
    // Both hero branches end in the same question — is this block finished,
    // and what may the card claim? The display name is resolved here because
    // Home has no catalog access, and the presentation title (not the raw
    // template name) is what every other surface shows.
    const buildCompletion = (
      planId: string,
      sessionsDone: number,
      sessionsTotal: number,
      activeTemplate: ReturnType<typeof getWorkoutTemplateById>,
      canRestart: boolean,
    ) => {
      const card = resolveCompletionCard({
        planId,
        sessionsDone,
        sessionsTotal,
        activeTemplate,
        catalog: WORKOUT_TEMPLATES_V1,
        dismissedPlanIds: preferences.dismissedCompletionPlanIds,
      });
      if (!card) {
        return null;
      }
      const nextTemplate = card.nextLevelTemplateId ? getWorkoutTemplateById(card.nextLevelTemplateId) : null;
      return {
        planId: card.planId,
        sessionsTotal: card.sessionsTotal,
        nextLevelTemplateId: card.nextLevelTemplateId,
        nextLevelTitle: nextTemplate
          ? getReadyTemplatePresentation(nextTemplate, preferences.appLanguage).title
          : null,
        canRestart,
      };
    };
    const activeWorkoutPlan = database.workoutPlans.find((plan) => plan.id === preferences.activePlanId) ?? null;
    if (activeWorkoutPlan?.entries.length) {
      const sortedEntries = [...activeWorkoutPlan.entries].sort((left, right) => left.orderIndex - right.orderIndex);
      const firstEntry = sortedEntries[0];
      // A plan can point at either source. Only the database was resolved
      // here, so an adopted READY programme found no template, rendered no
      // hero, and fell through to the recommendation branch — which showed a
      // different programme's day 1 and started it. Removing that fallback is
      // what made this visible.
      const dbTemplate = workoutTemplates.find((template) => template.id === firstEntry.workoutTemplateId) ?? null;
      const readyPlanTemplate = dbTemplate ? null : getWorkoutTemplateById(firstEntry.workoutTemplateId);
      const activeTemplate = dbTemplate ?? readyPlanTemplate;
      const activePlanProgramType = dbTemplate ? ('custom' as const) : ('ready' as const);
      const activeTemplateSessions = dbTemplate
        ? getWorkoutTemplateSessions(dbTemplate.id)
        : (readyPlanTemplate?.sessions ?? []).map((session) => ({
            id: session.id,
            name: session.name,
            orderIndex: session.orderIndex,
            exercises: session.exercises.map((exercise) => ({
              id: exercise.id,
              name: exercise.exerciseName,
              targetSets: exercise.sets,
              repMin: exercise.repsMin,
              repMax: exercise.repsMax,
            })),
          }));
      const orderedPlanSessions = sortedEntries
        .map((entry) => {
          if (entry.workoutTemplateSessionId) {
            return activeTemplateSessions.find((session) => session.id === entry.workoutTemplateSessionId) ?? null;
          }

          return activeTemplateSessions[entry.orderIndex] ?? null;
        })
        .filter((session): session is NonNullable<typeof session> => Boolean(session));
      // The runtime template is where a custom exercise gets its slot id and
      // substitution group; read them from there rather than rebuilding the
      // rule here, so Home and the session cannot disagree about a slot.
      // Catalog exercises already carry slot, role, tracking mode and rests,
      // so a ready plan reads them straight off the template.
      const activeRuntimeExercises = new Map(
        (dbTemplate
          ? customWorkoutRuntimeMap[dbTemplate.id]?.sessions ?? []
          : readyPlanTemplate?.sessions ?? []
        )
          .flatMap((session) => session.exercises)
          .map((exercise) => [exercise.id, exercise] as const),
      );
      const homeSessions = orderedPlanSessions.map((session, sessionIndex) => {
        const exerciseCount = session.exercises.length;
        // Was `exercises × 10 min`, which ignored both sets and rest. Same
        // formula as the guided entry now, so the two screens agree.
        const durationInputs = session.exercises.map((exercise) => ({
          slotId: activeRuntimeExercises.get(exercise.id)?.slotId ?? exercise.id,
          role: activeRuntimeExercises.get(exercise.id)?.role ?? 'accessory',
          sets: exercise.targetSets,
          reps: exercise.repMax,
          timed: isTimedTrackingMode(activeRuntimeExercises.get(exercise.id)?.trackingMode ?? 'reps_first'),
          restSeconds: activeRuntimeExercises.get(exercise.id)?.restSecondsMin ?? 90,
          // Home quotes the same number the entry screen does, so it has to
          // know the same thing about rests: a superset rests once per round.
          supersetGroup: activeRuntimeExercises.get(exercise.id)?.supersetGroup ?? null,
        }));
        // Classified here, where the whole session is still in hand — Home
        // receives only the first five exercises below.
        const focusKind = classifySessionFocus(session.exercises.map((exercise) => exercise.name));
        const routineSeconds = routineBlockSeconds(focusKind);
        const estimatedDuration = estimateSessionMinutes({
          exercises: durationInputs,
          ...routineSeconds,
        });
        // Weekday truth (P6): surface the plan's own entry label so week rows
        // land on the user's chosen days, not a generic spread.
        const entryLabel = sortedEntries[sessionIndex]?.label ?? null;

        return {
          id: session.id,
          name: session.name,
          title: formatHomeSessionTitle(session.name, session.exercises),
          duration: `~${estimatedDuration} min`,
          dayLabel: entryLabel,
          totalSets: session.exercises.reduce((sum, exercise) => sum + exercise.targetSets, 0),
          durationMinutes: estimatedDuration,
          focusKind,
          // The whole session, not the first five (user 2026-08-24: "saako
          // treeni osion näkyviin kokonaan"). Home decides what to show and
          // the reader can fold the list; truncating here meant the count in
          // the header and the rows beneath it were two different numbers,
          // and every consumer had to add the hidden ones back to get one.
          exercises: session.exercises.map((exercise) => ({
            name: exercise.name,
            // The template's own id, which is what removing from the programme
            // writes against. The slot id belongs to the runtime and cannot
            // find a row in the stored template.
            exerciseId: exercise.id,
            setsLabel: `${exercise.targetSets} sets`,
            targetSets: exercise.targetSets,
            schemeLabel: formatSetScheme(
              exercise.targetSets,
              exercise.repMin,
              exercise.repMax,
              activeRuntimeExercises.get(exercise.id)?.trackingMode ?? 'reps_first',
            ),
            slotId: activeRuntimeExercises.get(exercise.id)?.slotId,
            substitutionGroup: activeRuntimeExercises.get(exercise.id)?.substitutionGroup,
          })),
        };
      });
      // Was `homeSessions[0]`, always. Finishing day 1 offered day 1 again,
      // and the start button logged the wrong session against the plan.
      const completedForTemplate = completedSessionsForTemplate(firstEntry.workoutTemplateId, completedPlanSessions);
      const nextSessionIndex = resolveNextPlanEntryIndex(sortedEntries, completedForTemplate);
      // Where the rotation stands, for the calendars: they name days from here
      // on by what Home will offer, not by counting calendar days
      // (trainingSchedule forecastSlotOn).
      const sessionForecast = {
        fromDayStart: todayDayStart,
        nextSlot: nextSessionIndex,
        trainedToday: planTrainedOnDay(sortedEntries, completedForTemplate, todayDayStart),
      };
      // The reader's own answer wins for the day they gave it. The rotation
      // knows what comes next in the programme and cannot know that today is
      // legs — but it is right again tomorrow, so the override is dated rather
      // than sticky, and a stale one is ignored instead of cleared.
      const pickedToday = resolveTodaySessionPick({
        pick: preferences.todaySession,
        sessions: homeSessions,
        todayDayStart,
        completed: completedPlanSessions,
        toDayStart: toDayStartMs,
      });
      // A day named but not yet filled is not a session to offer: its turn
      // goes to the next day that has something in it (2026-09-26). A pick of
      // an empty day is passed over the same way.
      const startableIndex = nextStartableSessionIndex(
        homeSessions.map((session) => session.exercises.length),
        nextSessionIndex,
      );
      const nextSession =
        (pickedToday && pickedToday.exercises.length > 0 ? pickedToday : null) ??
        (startableIndex === null ? null : homeSessions[startableIndex]) ??
        null;
      if (activeTemplate && nextSession) {
        const estimatedDuration = Number.parseInt(nextSession.duration.replace(/\D/g, ''), 10) || 20;
        // The programme, not the record that happens to hold it: a copy made
        // by editing one lift is the same programme the reader has been
        // training, and every counter below reads this set.
        const planTemplateIds = new Set([
          ...sortedEntries.map((entry) => entry.workoutTemplateId),
          ...programmeHistoryIds(activeTemplate.id, workoutTemplates, templatesRunByOtherPlans(activeTemplate.id)),
        ]);
        // Counted from the plan record's own start, not all time. Plan records
        // are only written at onboarding, adoption and restart, so `updatedAt`
        // IS the block boundary — and without it "Uusi kierros" is impossible:
        // an all-time count means a restarted plan is born complete.
        const completedSessionCount = countSessionsSince(
          completedPlanSessions,
          planTemplateIds,
          activeWorkoutPlan.updatedAt,
        );
        // Onboarding-built plans promised a specific block length ("4-week
        // plan") — the Home hero must count the same total, not the generic
        // 8-week default.
        const onboardingBlockWeeks =
          activeWorkoutPlan.id.startsWith(ONBOARDING_PLAN_PREFIX) && setupSelection && preferences.recommendedProgramId
            ? composeProgramWeekForSelection(setupSelection, preferences.recommendedProgramId)?.weeks
            : undefined;
        // The demo tester's block is one week by construction — see
        // handleCreateDemoCompletionProgram.
        const demoBlockWeeks = activeWorkoutPlan.id.startsWith('demo_plan_') ? 1 : undefined;
        // An adopted ready programme carries its own block length — twelve
        // weeks for several of them — and Home counted every one of them as
        // the generic eight. The programme's own page already showed twelve,
        // so the hero said "week 1/8" beside a page saying 12, and the
        // session total under it was a third short.
        // Asked of the programme, not of the record holding it: the copy
        // made by changing one lift keeps this block's start and its
        // sessions, so it keeps its length too — see getProgrammeBlockWeeks.
        const programmeBlockWeeks = getProgrammeBlockWeeks(activeTemplate.id, workoutTemplates, getWorkoutTemplateById);
        const planProgress = buildHomePlanProgress({ language: preferences.appLanguage,
          completedSessions: completedSessionCount,
          sessionsPerWeek: sortedEntries.length,
          totalWeeks: demoBlockWeeks ?? onboardingBlockWeeks ?? programmeBlockWeeks,
        });

        return {
          programId: activeTemplate.id,
          programType: activePlanProgramType,
          // The plan's own templates, so every counter that says "of this
          // plan" can agree on what that means. The week counter used to read
          // all sessions in the week and filled the programme's week with
          // freestyle workouts.
          planTemplateIds: [...planTemplateIds],
          // The boundary every count above is measured from, so a screen
          // asking which week a past session filled counts from the same
          // place the hero does.
          blockStartedAt: activeWorkoutPlan.updatedAt,
          eyebrow: `${sortedEntries.length} day custom plan`,
          goalLabel: formatGoalLabel(preferences.aiPlannerGoal || preferences.setupGoal || 'general'),
          // For a CUSTOM programme the template's name wins, and the plan's
          // copy is only the fallback. Both records hold the name — the plan
          // took its copy the day it was made — and renaming keeps them in
          // step, but that only helps renames made after the fix existed. A
          // reader who renamed on an earlier build was left with the old name
          // on Home for ever, with the programme page showing the new one
          // (user 2026-09-09, "ei vaihtunut kodissa nimi"). Reading the
          // template first heals that, and makes the whole class impossible.
          //
          // A READY programme keeps the plan's name first: there the plan may
          // carry a season's name, which is not the template's at all.
          title: formatWorkoutDisplayLabel(
            activePlanProgramType === 'custom'
              ? activeTemplate.name || activeWorkoutPlan.name
              : activeWorkoutPlan.name || activeTemplate.name,
            'Workout plan',
          ),
          subtitle: `${sortedEntries.length} workouts in rotation.`,
          weekLabel: planProgress.weekLabel,
          progressPercent: planProgress.progressPercent,
          sessionsDone: planProgress.sessionsDone,
          sessionsTotal: planProgress.sessionsTotal,
          currentWeek: planProgress.currentWeek,
          planTotalWeeks: planProgress.totalWeeks,
          focusLabel: getSessionBodyFocusLabel(undefined),
          equipmentLabel: buildSessionEquipmentLabel(
            (orderedPlanSessions[0]?.exercises ?? []).map((exercise) => exercise.name),
            exerciseLibrary,
          ),
          sessionsPerWeek: `${sortedEntries.length}`,
          weeklyMinutes: `~${estimatedDuration * sortedEntries.length} min`,
          sessions: homeSessions,
          nextSession: {
            ...nextSession,
            label: 'Week 1 · Day 1',
          },
          // The reader's own answer for today, apart from the rotation's. The
          // widget needs the difference: a pick makes today a training day,
          // the rotation's next session does not.
          todayPickSessionId: pickedToday?.id ?? null,
          sessionForecast,

          // The catalog lookup, not the DB one, but by SOURCE id for a copy:
          // a custom template carries no goal or level for affinity to
          // compare, so looking it up by its own id found nothing and the
          // card offered no step up to a reader who had only edited one lift
          // in a ready programme (#bugs, 2026-09-26) — see programmeCopyLink.
          // A hand-built custom programme still has no source and still gets
          // no step-up card, correctly: there is no "next level" of it.
          // Restart is real here — a plan record exists to reset.
          completion: buildCompletion(
            activeWorkoutPlan.id,
            planProgress.sessionsDone,
            planProgress.sessionsTotal,
            dbTemplate
              ? (dbTemplate.sourceTemplateId ? getWorkoutTemplateById(dbTemplate.sourceTemplateId) : null)
              : readyPlanTemplate,
            true,
          ),
        };
      }
    }

    // No fallback to the recommended programme.
    //
    // This branch used to build the whole hero out of `recommendedProgramId`
    // whenever the reader had no usable plan — which made three separate
    // failures invisible. Removing your last programme left Home showing a
    // programme ("poista ohjelma ei poista"), the demo plan's missing
    // entries fell through to it, and the start button logged sessions
    // against a programme the reader had never adopted.
    //
    // A suggestion is not a plan. Home's no-plan state is honest: no hero,
    // and the start button opens a freestyle session. Picking a programme
    // happens on the Programs tab, which is the one place that can say what
    // adopting it means.
    return null;
  }, [database.workoutPlans, database.workoutSessions, database.exerciseLogs, exerciseLibrary, getWorkoutTemplateSessions, preferences.activePlanId, preferences.aiPlannerGoal, preferences.dismissedCompletionPlanIds, preferences.recommendedProgramId, preferences.setupGoal, preferences.todaySession, recommendedReadyContent, recommendedReadyTemplate, setupSelection, todayStartMs, workoutTemplates]);
  /**
   * The active programme when it has days but none with anything in them.
   *
   * The hero has nothing to offer then, and the card above returns null —
   * which Home drew as having no programme at all: no hero, no week, no
   * counters, for a programme the reader is running (audit 8, 2026-09-26;
   * add an empty day, remove the only filled one). This names it instead,
   * and opens the programme where days are filled. Only an own programme can
   * be emptied; a ready one always has its lifts.
   */
  const homeEmptyProgramme = useMemo(() => {
    if (homeActivePlanCard) {
      return null;
    }
    const plan = database.workoutPlans.find((candidate) => candidate.id === preferences.activePlanId) ?? null;
    const firstEntry = plan ? [...plan.entries].sort((left, right) => left.orderIndex - right.orderIndex)[0] : undefined;
    const template = firstEntry
      ? workoutTemplates.find((candidate) => candidate.id === firstEntry.workoutTemplateId) ?? null
      : null;
    if (!template) {
      return null;
    }
    const counts = getWorkoutTemplateSessions(template.id).map((session) => session.exercises.length);
    return hasOnlyEmptyDays(counts) ? { workoutTemplateId: template.id, title: template.name } : null;
  }, [database.workoutPlans, getWorkoutTemplateSessions, homeActivePlanCard, preferences.activePlanId, workoutTemplates]);
  /**
   * The session Home's card offers, which is what its swaps and left-out rows
   * are held for. Pick another session for today and the card shows that
   * one's own — none, until some are made for it.
   */
  const homeSessionRef: AdaptedSessionRef | null = homeActivePlanCard?.nextSession
    ? { programId: homeActivePlanCard.programId, sessionId: homeActivePlanCard.nextSession.id }
    : null;
  const homeSessionAdaptation = sessionAdaptationFor(homeSessionRef);
  const adaptHomeSession = (change: (current: SessionAdaptation) => SessionAdaptation) => {
    if (homeSessionRef) {
      adaptSession(homeSessionRef, change);
    }
  };
  // The AI tab's opening state. Deterministic, so the most valuable-looking
  // part of the coach costs nothing to render and works offline.
  const progressWeeklyTarget = Number.parseInt(homeActivePlanCard?.sessionsPerWeek ?? '', 10) || null;
  const { homeStatCatalogCards, homePinnedStatCardKeys, homeSuggestedStatCardKeys } = useHomeStatCards({
    database,
    trackedProgress,
    preferences,
  });
  // Same equipment truth the composer filters exercises with, for the default
  // warmup/cooldown drills: null = setup never said, [] = no equipment at all.
  // Week-strip training dots from the days the user actually picked
  // (Monday-first indexes). Empty = unknown → no dots, no invented rhythm.
  const homeTrainingDayIndexes = useMemo(() => {
    const order: Record<string, number> = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 };
    const open = preferences.setupAvailableDays
      .map((day) => order[day])
      .filter((index) => index !== undefined);
    // Availability is not a plan. This marked every day the reader said they
    // COULD train, so a one-session-a-week programme lit three dots and the
    // strip claimed three workouts where the plan prescribes one.
    // A plan that names its own weekdays is the answer; deriving over the top
    // of it would silently undo a rhythm the reader set by hand.
    const activePlan = database.workoutPlans.find((plan) => plan.id === preferences.activePlanId) ?? null;
    const named = planWeekdayIndexes(activePlan?.entries ?? []);
    if (named.length > 0) {
      return named;
    }
    const sessionsPerWeek = homeActivePlanCard
      ? Number.parseInt(homeActivePlanCard.sessionsPerWeek, 10) || open.length
      : open.length;
    return resolveProgramTrainingDays(open, sessionsPerWeek);
  }, [database.workoutPlans, homeActivePlanCard, preferences.activePlanId, preferences.setupAvailableDays]);
  /**
   * The rhythm every calendar in the app reads.
   *
   * A saved cycle wins outright over the weekday list. The two cannot be merged
   * — one repeats every seven days and the other need not — and the plan's own
   * entry labels are still weekdays after a switch, so anything deriving from
   * them would quietly put the old week back.
   */
  /**
   * Which of the programme's sessions have been trained since Monday.
   *
   * The week list used to carry two chips that predicted — TÄNÄÄN from the
   * calendar, SEURAAVAKSI from the rotation — and on any day those two differ
   * the reader has to work out which one the row's outline meant. A week list
   * is for what happened, so it reports that instead.
   */
  const homeDoneThisWeekSessionIds = useMemo(() => {
    // The programme's own history, read the way the hero counter and the
    // rotation read it: sessions of the lead programme and of what it was
    // copied from, with the original's day ids read as the copy's. This
    // used to match every session's day id against the plan's, unaligned
    // and unfiltered — so a swap that copied the programme greyed Monday's
    // chip while the hero kept counting it, and a day trained in ANOTHER
    // programme lit a chip here, because the catalog reuses day ids across
    // programmes (audit round 4, 2026-09-20).
    const programId = homeActivePlanCard?.programId ?? null;
    if (!programId) {
      return [];
    }
    const lineage = new Set([
      programId,
      ...programmeHistoryIds(programId, workoutTemplates, templatesRunByOtherPlans(programId)),
    ]);
    // The week is read from the day key too: an app open over Sunday night
    // kept last week's dots until it was closed.
    const now = new Date(todayStartMs);
    const weekStart = getStartOfWeek(now).getTime();
    const weekEnd = getEndOfWeek(now).getTime();
    const ids = new Set<string>();
    for (const session of completedSessionsForTemplate(programId)) {
      if (!session.workoutTemplateId || !lineage.has(session.workoutTemplateId)) {
        continue;
      }
      const stamp = Date.parse(session.performedAt);
      if (!Number.isFinite(stamp) || stamp < weekStart || stamp >= weekEnd) {
        continue;
      }
      if (session.workoutTemplateSessionId) {
        ids.add(session.workoutTemplateSessionId);
      }
    }
    return [...ids];
    // Keyed on what completedSessionsForTemplate and the lineage read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    homeActivePlanCard?.programId,
    todayStartMs,
    database.workoutSessions,
    database.exerciseLogs,
    database.workoutTemplates,
    database.workoutPlans,
  ]);

  /** The rhythm as chosen, before any day taken off. */
  const baseTrainingSchedule = useMemo(() => {
    const cycle = preferences.trainingCycle;
    return cycle ? cycleSchedule(cycle.pattern, cycle.anchorDayStart) : weekdaySchedule(homeTrainingDayIndexes);
  }, [homeTrainingDayIndexes, preferences.trainingCycle]);
  /**
   * The rhythm every calendar draws: the chosen one, with the days the reader
   * took off from the recovery sheet (2026-09-26). One place, so Home, the
   * widget, Progress and the coach all agree that tomorrow is rest.
   */
  const homeTrainingSchedule = useMemo(
    () => withRestDays(baseTrainingSchedule, preferences.restDayStarts),
    [baseTrainingSchedule, preferences.restDayStarts],
  );

  const { recoverySheet, handleRecoveryAction, handleRecoveryUndo } = useRecoverySheet({
    proFatigue,
    database,
    homeActivePlanCard,
    preferences,
    coachProUnlocked,
    baseTrainingSchedule,
    todayStartMs,
    updatePreferences,
    showToast,
  });
  const { aiCoachTrainingContext, coachChatIntro } = useCoachContext({
    workoutSessions,
    cardioSessions,
    database,
    preferences,
    workout,
    unitPreference,
    trackedProgress,
    todayStartMs,
    coachAdviceMemory,
    homeSummary,
    proFatigue,
    progressionFatigueSignal,
    proWeeklyRead,
    homeActiveWorkoutSummary,
    programmeStart,
    customWorkoutRuntimeMap,
    selectedCustomProgram,
    homeActivePlanCard,
    homePinnedStatCardKeys,
    homeTrainingSchedule,
  });
  useLeadPlanRepair({
    appHydrated,
    preferences,
    database,
    updatePreferences,
  });

  // What Android says about pinning the widget. Re-asked on every foreground,
  // because the user may have added or removed it while we were away.
  useEffect(() => {
    if (!appHydrated) {
      return undefined;
    }
    let cancelled = false;
    const refresh = async () => {
      const supported = await isHomeWidgetSupported();
      const added = supported ? await isHomeWidgetAdded() : false;
      if (!cancelled) {
        setHomeWidgetState({ supported, added });
      }
    };
    void refresh();
    // Also app_open, which daily actives and retention are counted from: the
    // cold start, and a return after a real absence. Every foreground used to
    // count, and the app sends the reader out and back itself — the photo
    // picker, a permission dialog, the system settings — so one sitting read
    // as several opens (analytics audit, 2026-09-21).
    trackEvent('app_open');
    let backgroundedAtMs: number | null = null;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        backgroundedAtMs = Date.now();
        return;
      }
      if (state === 'active') {
        void refresh();
        if (countsAsAppOpen(backgroundedAtMs, Date.now())) {
          trackEvent('app_open');
        }
        backgroundedAtMs = null;
      }
    });
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [appHydrated]);

  // Android never reports whether the user accepted the pin dialog, so the
  // offer is retired on the attempt, not on a success we cannot observe. The
  // Settings row stays available either way.
  const handleAddHomeWidget = async () => {
    await requestPinHomeWidget();
    void updatePreferences({ homeWidgetPromptDismissed: true });
  };

  // Feeds the home-screen widget. The launcher redraws it on its own schedule,
  // so all this has to do is keep the file current. Placed after the plan card
  // and the picked days, because it is built from exactly what Home renders.
  //
  // The calendar reaches back two weeks, so the widget needs the days that were
  // trained — not just this week's weekdays. 21 days covers two past weeks plus
  // every day of the current one, whichever weekday today is.
  // ── The hand-off after onboarding ────────────────────────────────────────
  // Onboarding used to end by dropping the reader on Home with the widget
  // unplaced and nothing being tracked. This offers both, once, while the app
  // still remembers which body part they just named.
  //
  // It waits for `homeWidgetState`: until Android has answered whether it can
  // pin a widget, showing the step would either hide an offer that was
  // available or make one that is not.
  //
  // Held while its own closing write is in flight, the way the terms sheet is:
  // `updatePreferences` shows the write before the disk has it, so the page
  // left on the optimistic half, and a refused write brought a fresh one back
  // at page one, tick cleared, nothing said (audit 8, 2026-09-26).
  const [setupHandoffHeld, setSetupHandoffHeld] = useState(false);
  const setupHandoffHeldRef = useRef(false);
  const setupHandoffReady =
    preferences.onboardingCompleted &&
    (!preferences.setupHandoffCompleted || setupHandoffHeld) &&
    homeWidgetState !== null;
  // Read once and depended on by value: the whole preferences object as a
  // dependency made a fresh plan on every unrelated write.
  const proUnlockedForHandoff = resolveProEntitlement(preferences).unlocked;
  const liveSetupHandoffPlan = useMemo(
    () =>
      setupHandoffReady
        ? planSetupHandoff({
            canOfferWidget: Boolean(homeWidgetState?.supported) && !homeWidgetState?.added,
            pinnedCardKeys: homePinnedStatCardKeys,
            focusAreas: preferences.setupFocusAreas,
            canOfferAccountBackup: accountBackup.available && accountBackup.state.status === 'signed_out',
            // A reader who already bought Pro is not offered the page that
            // sells it.
            canOfferPro: !proUnlockedForHandoff,
          })
        : null,
    [
      accountBackup.available,
      accountBackup.state.status,
      homePinnedStatCardKeys,
      homeWidgetState,
      preferences.setupFocusAreas,
      proUnlockedForHandoff,
      setupHandoffReady,
    ],
  );
  // Frozen while its closing write is held: that write pins the tracked
  // sites and marks the widget asked, which re-plans the page — and a plan
  // with nothing left to offer unmounted the page mid-write anyway.
  const heldSetupHandoffPlanRef = useRef(liveSetupHandoffPlan);
  if (!setupHandoffHeld) {
    heldSetupHandoffPlanRef.current = liveSetupHandoffPlan;
  }
  const setupHandoffPlan = setupHandoffHeld ? heldSetupHandoffPlanRef.current : liveSetupHandoffPlan;
  const setupHandoffActive = setupHandoffPlan?.shouldShow ?? false;
  setupHandoffActiveRef.current = setupHandoffActive;

  /**
   * The terms, owed (#bugs 2026-09-22; decided 2026-09-26): never accepted, or
   * accepted before the documents last changed. Asked over the app once the
   * questions and the hand-off are behind the reader — the hand-off asks it
   * itself, and this catches whoever skipped that page, everyone who was here
   * before the question existed, and every change to the documents after.
   * Not before hydration: the stored answer is not known until then, and a
   * reader who had accepted would see the sheet flash.
   */
  const legalConsentOwed =
    appHydrated && brandSplashDone && !onboardingActive && !setupHandoffActive
      ? legalAcceptanceDue(preferences.legalAcceptance, LEGAL_LAST_UPDATED)
      : null;
  const legalConsentDue = legalConsentOwed ?? legalSheetHeld;
  legalConsentDueRef.current = legalConsentDue !== null;

  /**
   * The first-run tour: once per surface, only on a tab's root, only after
   * onboarding and its hand-off have finished. It goes in front of Home's
   * one-card prompt queue — the widget offer and the card suggestion wait
   * until the surface is marked seen. See lib/firstRunTour.ts.
   */
  const tourSurface = resolveTourSurface(route);
  const tourActive =
    brandSplashDone &&
    !onboardingActive &&
    !setupHandoffActive &&
    // The tour waits for the terms: it points at a screen the sheet covers.
    legalConsentDue === null &&
    tourSurface !== null &&
    isTourDue(preferences.firstRunToursSeen, tourSurface);
  const homeTourActive = tourActive && tourSurface === 'home';
  // The queue decides with the tour in it, so it is computed here, after
  // the tour, rather than up with the suggester.
  const homePrompt = resolveHomePrompt({
    signInAvailable: accountBackup.available && accountBackup.state.status === 'signed_out',
    signInDismissed: preferences.accountBackupPromptDismissed,
    loggedSessionCount: database.workoutSessions.length + database.cardioSessions.length,
    suggestionKey: homeSuggestedStatCardKeys[0] ?? null,
    tourActive: homeTourActive,
  });
  const tourHasProgram = Boolean(homeActivePlanCard && homeActivePlanCard.sessions.length > 0);
  const tourBeats = useMemo(
    () => (tourSurface ? resolveTourBeats(tourSurface, { hasProgram: tourHasProgram }) : []),
    [tourHasProgram, tourSurface],
  );
  const firstRunToursSeenRef = useRef(preferences.firstRunToursSeen);
  firstRunToursSeenRef.current = preferences.firstRunToursSeen;
  // Stable: the layer calls this from its unmount, and a fresh closure per
  // render would be a fresh reason to fire it.
  const handleTourFinish = useCallback(
    (surface: TourSurface) => {
      const seen = firstRunToursSeenRef.current;
      if (!isTourDue(seen, surface)) {
        return;
      }
      void updatePreferences({ firstRunToursSeen: markTourSeen(seen, surface) });
    },
    [updatePreferences],
  );
  const tourElement =
    tourActive && tourSurface ? (
      <FirstRunTour
        key={tourSurface}
        surface={tourSurface}
        beats={tourBeats}
        registry={tourRegistry}
        language={preferences.appLanguage}
        onSweep={setTourSweep}
        onBeatChange={setTourFocus}
        onFinish={handleTourFinish}
      />
    ) : null;

  /**
   * The terms sheet, when owed, in the shell's overlay slot — above the tab
   * bar, where the tour draws. The two never meet: the tour waits for it.
   *
   * Told whether the shell already pads the bottom edge: it usually does, and
   * the sheet adding the navigation bar's height on top of that left a band
   * of empty sheet under Continue (#bugs 2026-09-26, "jatka buttoni
   * alemmas"). On the screens that drop the edge it pads for itself.
   */
  /**
   * The update prompt waits for a calm moment. A refusal can arrive at any
   * time — the statistics flush runs in the background — and the prompt is a
   * modal of its own, which must not land on the terms sheet, the tour or a
   * workout in progress (review, 2026-09-28).
   */
  /**
   * A server notice the reader closed is not shown again. A refused write
   * leaves it unmarked, so it comes back next launch rather than being lost.
   */
  const handleServerNoticeSeen = useCallback(
    (id: string) => {
      void updatePreferences({
        seenServerNoticeIds: rememberServerNotice(preferences.seenServerNoticeIds, id),
      }).catch(() => undefined);
    },
    [preferences.seenServerNoticeIds, updatePreferences],
  );
  const appUpdateHeld =
    !appHydrated ||
    !brandSplashDone ||
    onboardingActive ||
    setupHandoffActive ||
    legalConsentDue !== null ||
    Boolean(tourElement) ||
    (workout.activeSession !== null && workout.activeSession.status !== 'completed');

  const renderLegalConsent = (shellPadsBottom: boolean) => (
    <>
      <LegalConsentSheet
        shellPadsBottom={shellPadsBottom}
        language={preferences.appLanguage}
        reason={legalConsentDue ?? 'first'}
        updatedLabel={formatLegalDate(preferences.appLanguage)}
        onOpenLegal={(document) => setHandoffLegalDocument(document)}
        // The sheet goes when the stored answer says it is no longer owed —
        // after this write, never on the tap.
        onAccept={async () => {
          setLegalSheetHeld(legalConsentDue);
          try {
            await updatePreferences({ legalAcceptance: acceptLegal(LEGAL_LAST_UPDATED, new Date()) });
          } finally {
            // Refused, the preferences are already rolled back and the sheet
            // stays owed; accepted, it goes now — after the write.
            setLegalSheetHeld(null);
          }
        }}
      />
      {/* Over the sheet, the way the documents open over the hand-off:
          reading them is not an answer, and the box keeps its tick. */}
      {handoffLegalDocument ? (
        <View style={LEGAL_OVER_CONSENT}>
          <LegalDocumentScreen
            document={handoffLegalDocument}
            language={preferences.appLanguage}
            onBack={() => setHandoffLegalDocument(null)}
          />
        </View>
      ) : null}
    </>
  );

  // Nothing left to offer — a reader running onboarding a second time. Close the
  // door rather than leave it to open on some later launch.
  useEffect(() => {
    if (setupHandoffReady && setupHandoffPlan && !setupHandoffPlan.shouldShow) {
      void updatePreferences({ setupHandoffCompleted: true });
    }
  }, [setupHandoffPlan, setupHandoffReady, updatePreferences]);

  /**
   * The name comes from Google, so the About form stopped asking for one
   * (2026-09-09).
   *
   * An effect rather than a line inside the sign-in handler, because it has to
   * cover the reader who signed in before this shipped as well as the one
   * signing in now. Adopted once and never overwritten: a name typed in Profile
   * is the reader's own answer and outranks the account's — and so is a name
   * cleared there, which the old "the profile has no name" rule filled straight
   * back in (2026-09-16).
   */
  //
  // Not before the stored preferences have loaded. The account is a small key
  // and arrives first, while preferences are still the defaults and
  // profileName is null — so this wrote the DEFAULT preferences plus the name
  // to the preferences key, and the load then laid that over the real ones:
  // onboarding, running programmes, goals, consents and the trial gone on a
  // cold start, for every signed-in reader.
  useEffect(() => {
    if (!appHydrated) {
      return;
    }
    const step = accountNameStep({
      accountName: accountBackup.state.name,
      profileName: preferences.profileName,
      adopted: preferences.accountNameAdopted,
    });
    if (step.kind === 'markAdopted') {
      void updatePreferences({ accountNameAdopted: true });
    } else if (step.kind === 'adopt') {
      void updatePreferences({ profileName: step.name, accountNameAdopted: true });
    }
  }, [
    accountBackup.state.name,
    appHydrated,
    preferences.accountNameAdopted,
    preferences.profileName,
    updatePreferences,
  ]);

  const { handleAccountSignIn, handleAccountBackupNow } = useAccountOutcome({ accountBackup, preferences, showToast });

  const handleSetupHandoffDone = async (choices: SetupHandoffChoices) => {
    const patch: Partial<AppPreferences> = { setupHandoffCompleted: true };
    // Asked here, so Home's one-time card must not ask again. Settings keeps its
    // permanent row either way.
    if (setupHandoffPlan?.offerWidget) {
      patch.homeWidgetPromptDismissed = true;
    }
    // In the same write as the page closing, so the sheet over the app never
    // opens for a reader who has just ticked the box.
    if (choices.legalAccepted) {
      patch.legalAcceptance = acceptLegal(LEGAL_LAST_UPDATED, new Date());
    }
    const pinned = [...homePinnedStatCardKeys];
    // The site's name IS its card key, so the dialog's answer goes straight to
    // Home. Only what is not already there: pinning a card twice would draw it
    // twice.
    for (const site of choices.trackedSites) {
      if (!pinned.includes(site)) {
        pinned.push(site);
      }
    }
    if (pinned.length !== homePinnedStatCardKeys.length) {
      patch.homeStatCardKeys = pinned;
    }
    // One write at a time: a second Done during the first was a second patch.
    if (setupHandoffHeldRef.current) {
      return;
    }
    setupHandoffHeldRef.current = true;
    setSetupHandoffHeld(true);
    try {
      await updatePreferences(patch);
    } catch (error) {
      // The page stays as the reader left it — their answers, their tick —
      // and says so; nothing below runs on a write that did not happen.
      console.error('Failed to finish the setup hand-off', error);
      showToast(t(preferences.appLanguage, 'toast.setupHandoffFailed'));
      return;
    } finally {
      setupHandoffHeldRef.current = false;
      setSetupHandoffHeld(false);
    }
    // The system dialog last, so it is not racing a state write.
    if (choices.addWidget) {
      await requestPinHomeWidget();
    }
    // And sign-in after that: it opens its own sheet, and the reader asked for
    // it — a cancel there is a change of mind, not an error.
    if (choices.signInForBackup) {
      await handleAccountSignIn();
    }
    // Pro last, and only if it was asked for. It is a page, not a sheet: it
    // takes the screen, so anything that had to happen first has happened.
    if (choices.showPro) {
      navigate({ tab: 'profile', screen: 'premium' });
    }
  };

  // The programme the widget offers when there is none running: the app's own
  // recommendation, under its curated title.
  const widgetSuggestion = useMemo(() => {
    if (!recommendedReadyTemplate) {
      return null;
    }
    const presentation = getReadyTemplatePresentation(recommendedReadyTemplate, preferences.appLanguage);
    return { title: presentation.title };
  }, [preferences.appLanguage, recommendedReadyTemplate]);
  // The widget's calendar is a whole month, and a Monday-first grid drags in up
  // to six days of the month before it — so 45 days back covers the longest
  // grid whatever today's date is. (21 was right for the four-week strip this
  // replaced, and would have left the first fortnight of every month blank.)
  //
  // Both of these read "today", so both are keyed on the day as well as the
  // data: keyed on the data alone, an app left open over the last night of a
  // month drew the new month's calendar beside last month's totals until the
  // next workout was logged.
  const widgetCompletedDayStarts = useMemo(
    () =>
      getRecentActivityStrip(database, new Date(todayStartMs), 45)
        .filter((day) => day.active)
        .map((day) => day.dayStart),
    [database, todayStartMs],
  );
  // This month's totals, for the three figures the 4x2 draws beside the
  // calendar, and the streak the 2x1 counts.
  const widgetMonthTotals = useMemo(
    () => getMonthTrainingTotals(database, new Date(todayStartMs)),
    [database, todayStartMs],
  );

  // The narrower set, for the one question the strip cannot answer: is today's
  // session behind you. The strip counts cardio, and a run leaves the planned
  // workout undone — fed to the skip, it would have the widget name tomorrow
  // while Home still offers today.
  const widgetCompletedWorkoutDayStarts = useMemo(
    () =>
      getCanonicalCompletedSessions(database).map((session) =>
        getCalendarDayStartTimestamp(session.performedAt),
      ),
    [database],
  );
  useEffect(() => {
    if (!appHydrated) {
      return;
    }

    const written = writeHomeWidgetPayload(
      buildHomeWidgetPayload({
        nowMs: Date.now(),
        language: preferences.appLanguage,
        // The widget shows whatever the app resolved, Pro gate included — it
        // cannot re-derive this, it is drawn in the launcher's process.
        theme: resolveThemeName(preferences),
        planName: homeActivePlanCard?.title ?? null,
        // With no programme the widget names the one the app would recommend
        // rather than asking an empty question. Presented here, because the
        // catalog's curated titles live on this side of the bridge.
        suggestion: widgetSuggestion,
        schedule: homeTrainingSchedule,
        // The session the reader picked for today, and only that. Home's next
        // session is always set — it is the rotation's answer for whenever the
        // reader trains next — and passed here it made every rest day read
        // "Treeni" on the 2x1.
        todaySessionId: homeActivePlanCard?.todayPickSessionId ?? null,
        completedDayStarts: widgetCompletedDayStarts,
        completedWorkoutDayStarts: widgetCompletedWorkoutDayStarts,
        sessions: homeActivePlanCard?.sessions ?? [],
        sessionForecast: homeActivePlanCard?.sessionForecast ?? null,
        monthTotals: widgetMonthTotals,
        // Every workout ever, not a week streak: the 2x1 counts what you have
        // done, asked for on the home screen 2026-08-20.
        totalWorkouts: lifetimeSummary.sessionCount,
      }),
    );

    // Ask the widget to read it now rather than within the next half hour. The
    // delay used to be invisible because the content was day-granular; it stops
    // being invisible the moment the file's shape changes, and the widget falls
    // back to "create your first program" while the real file sits on disk.
    if (written) {
      void refreshHomeWidget();
    }
  }, [
    appHydrated,
    preferences,
    homeActivePlanCard,
    homeTrainingSchedule,
    widgetCompletedDayStarts,
    widgetCompletedWorkoutDayStarts,
    widgetMonthTotals,
    widgetSuggestion,
    lifetimeSummary,
  ]);

  // ── Widget taps ──────────────────────────────────────────────────────────
  // A widget can only ask Android to open a URL, so each tap arrives as
  // `vinha://widget/<target>` and is resolved here against live state. The
  // widget's own file can be half an hour old; the workout it named is looked
  // up again now, so a tap never opens yesterday's session.
  const [pendingWidgetTarget, setPendingWidgetTarget] = useState<HomeWidgetTarget | null>(null);

  useEffect(() => {
    function handleUrl(url: string | null | undefined) {
      const target = parseWidgetDeepLink(url);
      if (target) {
        setPendingWidgetTarget(target);
      }
    }

    // Cold start: the URL is already waiting. Warm start: it arrives here.
    void Linking.getInitialURL().then(handleUrl).catch(() => undefined);
    const subscription = Linking.addEventListener('url', (event) => handleUrl(event.url));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    // Held until the database is loaded: resolving "the session you named"
    // against an empty store would land on Home every time.
    if (!appHydrated || !pendingWidgetTarget) {
      return;
    }
    setPendingWidgetTarget(null);

    if (pendingWidgetTarget === 'calendar') {
      // The widget's month opens the same calendar it is a small copy of:
      // Progress → Activity, scrolled to the calendar itself — the block
      // lives mid-page, and landing at the top of the overview is landing
      // somewhere else (user 2026-08-25). The standalone calendar screen
      // this used to open was retired as a duplicate.
      resetToRoute({ tab: 'progress', screen: 'list', section: 'overview', scrollTo: 'activity' });
      return;
    }
    if (pendingWidgetTarget === 'programs') {
      resetToRoute({ tab: 'workout', screen: 'programs_home' });
      return;
    }
    if (pendingWidgetTarget === 'suggestion') {
      // The programme the widget named, resolved again now — the catalog cannot
      // change under it, but the recommendation can, and the widget's copy of it
      // may be half an hour old.
      if (recommendedReadyTemplate) {
        resetToRoute({
          tab: 'workout',
          screen: 'program',
          programType: 'ready',
          workoutTemplateId: recommendedReadyTemplate.id,
        });
        return;
      }
      resetToRoute({ tab: 'workout', screen: 'programs_home' });
      return;
    }
    if (pendingWidgetTarget === 'schedule') {
      resetToRoute({ tab: 'profile', screen: 'training_plan', editSchedule: true });
      return;
    }
    if (pendingWidgetTarget === 'home') {
      resetToRoute(ROOT_ROUTES.home);
      return;
    }

    const tap = resolveHomeWidgetSessionTap({
      hasActiveSession: workout.activeSession !== null,
      hasActivePlan: homeActivePlanCard !== null,
      nowMs: Date.now(),
      schedule: homeTrainingSchedule,
      sessions: homeActivePlanCard?.sessions ?? [],
      completedWorkoutDayStarts: widgetCompletedWorkoutDayStarts,
      // Today's session is the one Home offers, not the calendar's slot for
      // today: the two differ whenever the rotation and the weekday disagree,
      // and the tap opened the one Home was not showing.
      homeSessionId: homeActivePlanCard?.nextSession.id ?? null,
      todayPicked: Boolean(homeActivePlanCard?.todayPickSessionId),
      // The same rotation the tile was drawn with, so a later day opens the
      // session it showed.
      sessionForecast: homeActivePlanCard?.sessionForecast ?? null,
    });

    // A running workout wins. The tile means "my training", and a reader who
    // stepped out to Home mid-set is asking for the set back, not for the
    // schedule to be looked up again (device report 2026-09-01).
    if (tap.kind === 'resume') {
      navigateToActiveWorkout({ resume: true });
      return;
    }
    // No session to open any more — the plan changed while the widget was
    // showing the old one. Home is the honest landing, not an empty screen.
    if (tap.kind === 'home' || !homeActivePlanCard) {
      resetToRoute(ROOT_ROUTES.home);
      return;
    }
    resetToRoute({
      tab: 'workout',
      screen: 'programDay',
      programType: homeActivePlanCard.programType,
      workoutTemplateId: homeActivePlanCard.programId,
      sessionId: tap.next.session.id,
    });
  }, [
    appHydrated,
    homeActivePlanCard,
    homeTrainingSchedule,
    pendingWidgetTarget,
    recommendedReadyTemplate,
    widgetCompletedWorkoutDayStarts,
  ]);

  useNotificationRoute({ appHydrated, resetToRoute });

  // Settings → "Export plan (CSV)". The user's own plans, plus the ready
  // program they are actually running. The rest of the catalog is app content
  // that never leaves the app, so there is nothing to carry out for it.
  const exportablePlans = useMemo<ExportablePlan[]>(() => {
    const plans: ExportablePlan[] = workoutTemplates.map((template) => ({
      id: template.id,
      name: formatWorkoutDisplayLabel(template.name, 'Workout plan'),
      sessions: getWorkoutTemplateSessions(template.id).map((session) => ({
        name: session.name,
        exercises: session.exercises.map((exercise) => ({
          name: exercise.name,
          sets: exercise.targetSets,
          repMin: exercise.repMin,
          repMax: exercise.repMax,
        })),
      })),
    }));

    if (homeActivePlanCard?.programType === 'ready') {
      const readyTemplate = getWorkoutTemplateById(homeActivePlanCard.programId);
      if (readyTemplate && !plans.some((plan) => plan.id === readyTemplate.id)) {
        plans.push({
          id: readyTemplate.id,
          // The card's title, not the raw catalog name: curated titles in
          // templatePresentation override it, and the export must not name the
          // plan differently from every other screen.
          name: homeActivePlanCard.title,
          sessions: readyTemplate.sessions.map((session) => ({
            name: session.name,
            exercises: session.exercises.map((exercise) => ({
              name: exercise.exerciseName,
              sets: exercise.sets,
              repMin: exercise.repsMin,
              repMax: exercise.repsMax,
            })),
          })),
        });
      }
    }

    return plans;
  }, [workoutTemplates, getWorkoutTemplateSessions, homeActivePlanCard]);

  // Profile "TRAINING PLAN" card. Reuses the same composed plan Home renders so
  // the two screens can never disagree about what the user is running.
  // Built only while the analysis route is open; it reads the whole log table.
  const sessionAnalysis = useMemo(
    () =>
      analysisSessionId
        ? buildSessionAnalysis({
            sessionId: analysisSessionId,
            sessions: workoutSessions,
            logs: database.exerciseLogs,
            language: preferences.appLanguage,
            // The week the analysed session filled, not the week the reader
            // is in: right after a week's last session those are two weeks,
            // and the analysis read "WEEK 2" beside a summary that had just
            // said week 1. A session outside the block gets no week at all.
            weekNumber: homeActivePlanCard
              ? blockWeekOfSession({
                  sessionId: analysisSessionId,
                  sessions: getCanonicalCompletedSessions(database),
                  templateIds: new Set(homeActivePlanCard.planTemplateIds),
                  blockStartedAt: homeActivePlanCard.blockStartedAt,
                  sessionsTotal: homeActivePlanCard.sessionsTotal,
                  totalWeeks: homeActivePlanCard.planTotalWeeks,
                })
              : null,
          })
        : null,
    [analysisSessionId, database, homeActivePlanCard, preferences.appLanguage, workoutSessions],
  );

  const profilePlanSummary = useMemo(() => {
    if (!homeActivePlanCard) {
      return { name: null, daysPerWeek: null, exerciseCount: null, sessionNames: [] as string[] };
    }

    const exerciseNames = new Set<string>();
    for (const session of homeActivePlanCard.sessions) {
      for (const exercise of session.exercises) {
        exerciseNames.add(exercise.name.trim().toLowerCase());
      }
    }

    // One row per day, full names. This used to be a deduplicated one-liner
    // ("Koko keho + H... · Koko keho + C...") that truncated exactly where the
    // days stopped reading alike — the user asked for the days themselves
    // (#bugs 2026-08-25).
    const sessionNames = homeActivePlanCard.sessions.map((session) =>
      localizeSessionFocus(formatWorkoutDisplayLabel(session.title), preferences.appLanguage),
    );

    return {
      name: homeActivePlanCard.title,
      daysPerWeek: Number.parseInt(homeActivePlanCard.sessionsPerWeek, 10) || homeActivePlanCard.sessions.length || null,
      exerciseCount: exerciseNames.size,
      sessionNames,
    };
  }, [homeActivePlanCard, preferences.appLanguage]);
  // Guided-player context props (entry eyebrow + finish-screen cards).
  // The weekday from the day key, not the clock: keyed on the week alone, a
  // player opened after midnight in an app left open named yesterday.
  const guidedEntryEyebrow = useMemo(() => {
    const weekday = t(preferences.appLanguage, `guided.weekday.${new Date(todayStartMs).getDay()}` as I18nKey);
    const week = homeActivePlanCard?.currentWeek;
    return week ? t(preferences.appLanguage, 'guided.entry.eyebrow', { weekday, week }) : weekday;
  }, [homeActivePlanCard?.currentWeek, preferences.appLanguage, todayStartMs]);
  /**
   * The programme's week, and how much of it is done — "VIIKKO 2 · 1/3".
   *
   * Both numbers come from the block, the same count Home's hero reads. The
   * count used to be the plan's sessions Monday to Sunday under a week label
   * taken from the block, and the two only line up for a plan started on a
   * Monday — see blockWeekTally.
   *
   * The two screens that show it sit on opposite sides of the save. The
   * guided player's finish view renders before the session is written, so it
   * counts the one in hand; the summary renders after, where the log already
   * has it and the same +1 counted it twice ("2/1" beside a Home that said
   * 1/1). One count, two honest readings.
   */
  const weekProgressBase = useMemo(() => {
    if (!homeActivePlanCard || !progressWeeklyTarget) {
      return null;
    }
    const reading = (sessionsDone: number) => {
      const tally = blockWeekTally({
        sessionsDone,
        sessionsTotal: homeActivePlanCard.sessionsTotal,
        totalWeeks: homeActivePlanCard.planTotalWeeks,
      });
      return {
        weekLabel: t(preferences.appLanguage, 'guided.finish.week', { week: tally.week }),
        done: tally.done,
        target: tally.target,
      };
    };
    return {
      beforeSave: reading(homeActivePlanCard.sessionsDone + 1),
      afterSave: reading(homeActivePlanCard.sessionsDone),
    };
  }, [homeActivePlanCard, preferences.appLanguage, progressWeeklyTarget]);

  /** Before the save: the session in hand is not in the log yet. */
  const guidedWeekProgress = weekProgressBase?.beforeSave ?? null;

  /** After the save: the log already contains it. */
  const completionWeekProgress = weekProgressBase?.afterSave ?? null;
  const guidedNextUp = useMemo(() => {
    const card = homeActivePlanCard;
    const templateSessionId = workout.activeSession?.templateSessionId;
    if (!card || !templateSessionId || card.sessions.length < 2) {
      return null;
    }
    const index = card.sessions.findIndex((session) => session.id === templateSessionId);
    if (index < 0) {
      return null;
    }
    const next = card.sessions[(index + 1) % card.sessions.length];
    // dayLabel is a stored English code (MON/TUE/…) matched against saved
    // plans, so it has to be translated before it reaches a screen — it was
    // printing "WED" over a Finnish summary.
    const rawDay = 'dayLabel' in next ? next.dayLabel ?? '' : '';
    const dayKey = WEEKDAY_LABEL_KEYS[rawDay.trim().slice(0, 3).toUpperCase()];
    return {
      name: next.title,
      weekday: dayKey ? t(preferences.appLanguage, dayKey) : rawDay,
    };
  }, [homeActivePlanCard, preferences.appLanguage, workout.activeSession?.templateSessionId]);
  const nextPlannedWorkout = useMemo(() => {
    if (!homeSummary.nextWorkout?.plan) {
      return null;
    }

    const template = homeSummary.nextWorkout.workout;
    return {
      source: 'custom' as const,
      workoutTemplateId: template.id,
      title: template.name,
      subtitle: homeSummary.nextWorkout.subtitle,
      meta: `${pluralize(getWorkoutTemplateSessions(template.id).length, 'session')} | ${pluralize(getWorkoutExercises(template.id).length, 'exercise')}`,
    };
  }, [getWorkoutExercises, getWorkoutTemplateSessions, homeSummary.nextWorkout]);
  const lastReusableWorkout = useMemo(() => {
    const lastSession = homeSummary.lastSession?.session;
    if (!lastSession) {
      return null;
    }

    const readyTemplate = getWorkoutTemplateById(lastSession.workoutTemplateId);
    if (readyTemplate) {
      return {
        source: 'ready' as const,
        workoutTemplateId: readyTemplate.id,
        title: readyTemplate.name,
        subtitle: `Last completed ${formatShortDate(lastSession.performedAt)}`,
        meta: `${readyTemplate.daysPerWeek} days | ${formatGoalLabel(readyTemplate.goalType)} | ${readyTemplate.estimatedSessionDuration} min`,
      };
    }

    const customTemplate = workoutTemplates.find((item) => item.id === lastSession.workoutTemplateId);
    if (!customTemplate) {
      return null;
    }

    return {
      source: 'custom' as const,
      workoutTemplateId: customTemplate.id,
      title: customTemplate.name,
      subtitle: `Last completed ${formatShortDate(lastSession.performedAt)}`,
      meta: `${pluralize(getWorkoutTemplateSessions(customTemplate.id).length, 'session')} | ${pluralize(getWorkoutExercises(customTemplate.id).length, 'exercise')}`,
    };
  }, [getWorkoutExercises, getWorkoutTemplateSessions, homeSummary.lastSession, workoutTemplates]);
  const recommendedHomeWorkout = useMemo(
    () =>
      recommendedReadyTemplate
        ? {
            source: 'ready' as const,
            workoutTemplateId: recommendedReadyTemplate.id,
            title: recommendedReadyTemplate.name,
            subtitle: recommendedReadyContent?.summary ?? 'Open a proven split and start the next session fast.',
            meta: `${recommendedReadyTemplate.daysPerWeek} days | ${formatGoalLabel(recommendedReadyTemplate.goalType)} | ${recommendedReadyTemplate.estimatedSessionDuration} min`,
          }
        : null,
    [recommendedReadyContent, recommendedReadyTemplate],
  );
  const hasSavedTrainingSetup = useMemo(
    () => preferences.trainingFirstRunDismissed || Boolean(workout.activeSession),
    [preferences.trainingFirstRunDismissed, workout.activeSession],
  );
  const homeQuickStats = useMemo(
    () =>
      buildHomeQuickStats({
        sessionsThisWeek: homeSummary.sessionsThisWeek,
        streakValue: homeSummary.streak.value,
        streakLabel: homeSummary.streak.label,
        deltaValue: homeSummary.lastSessionDelta?.value ?? null,
      }),
    [homeSummary.lastSessionDelta?.value, homeSummary.sessionsThisWeek, homeSummary.streak.label, homeSummary.streak.value],
  );
  const homeUpcomingSessions = useMemo(
    () =>
      buildHomeUpcomingSessions({
        database,
        readyTemplates: workout.templates,
        customTemplates: workoutTemplates,
        setupSelection,
        recommendedReadyTemplate,
      }),
    [database, recommendedReadyTemplate, setupSelection, workout.templates, workoutTemplates],
  );
  const weeklySnapshot = useMemo(() => {
    const workoutsDelta = homeSummary.weeklySnapshot.workoutsCurrent - homeSummary.weeklySnapshot.workoutsPrevious;
    const durationDeltaMinutes =
      homeSummary.weeklySnapshot.durationCurrentMinutes - homeSummary.weeklySnapshot.durationPreviousMinutes;
    const volumeDeltaKg = homeSummary.weeklySnapshot.volumeCurrentKg - homeSummary.weeklySnapshot.volumePreviousKg;
    const latestBodyweight = homeSummary.bodyweight.latest
      ? formatWeight(homeSummary.bodyweight.latest.weight, unitPreference)
      : '--';
    const bodyweightDelta =
      homeSummary.bodyweight.latest && homeSummary.bodyweight.previous
        ? homeSummary.bodyweight.latest.weight - homeSummary.bodyweight.previous.weight
        : null;

    return [
      {
        value: `${homeSummary.weeklySnapshot.workoutsCurrent}`,
        label: 'Workouts',
        trendLabel: workoutsDelta === 0 ? '-' : `${workoutsDelta > 0 ? '+' : ''}${workoutsDelta}`,
        trendDirection:
          workoutsDelta === 0 ? ('flat' as const) : workoutsDelta > 0 ? ('up' as const) : ('down' as const),
      },
      {
        value:
          homeSummary.weeklySnapshot.durationCurrentMinutes > 0
            ? formatDurationMinutes(homeSummary.weeklySnapshot.durationCurrentMinutes)
            : '0 min',
        label: 'Duration',
        trendLabel:
          durationDeltaMinutes === 0
            ? '-'
            : `${durationDeltaMinutes > 0 ? '+' : ''}${formatDurationMinutes(Math.abs(durationDeltaMinutes))}`,
        trendDirection:
          durationDeltaMinutes === 0
            ? ('flat' as const)
            : durationDeltaMinutes > 0
              ? ('up' as const)
              : ('down' as const),
      },
      {
        value:
          homeSummary.weeklySnapshot.volumeCurrentKg > 0
            ? formatVolume(homeSummary.weeklySnapshot.volumeCurrentKg, unitPreference)
            : `0 ${unitPreference}`,
        label: 'Volume',
        trendLabel:
          volumeDeltaKg === 0
            ? '-'
            : `${volumeDeltaKg > 0 ? '+' : ''}${formatVolume(Math.abs(volumeDeltaKg), unitPreference)}`,
        trendDirection:
          volumeDeltaKg === 0 ? ('flat' as const) : volumeDeltaKg > 0 ? ('up' as const) : ('down' as const),
      },
      {
        value: latestBodyweight,
        label: 'Bodyweight',
        trendLabel:
          bodyweightDelta === null
            ? '-'
            : `${bodyweightDelta > 0 ? '+' : ''}${formatWeight(Math.abs(bodyweightDelta), unitPreference)}`,
        trendDirection:
          bodyweightDelta === null || Math.abs(bodyweightDelta) < 0.001
            ? ('flat' as const)
            : bodyweightDelta > 0
              ? ('up' as const)
              : ('down' as const),
      },
    ];
  }, [homeSummary.bodyweight.latest, homeSummary.bodyweight.previous, homeSummary.weeklySnapshot, unitPreference]);
  /**
   * The sessions Progress counts: the canonical list — an exercise done in
   * it, one row per workout — that the calendar on the same card, the widget
   * and Profile already count. Handed every saved session, the activity card
   * counted a free workout with weights typed and nothing ticked, and read
   * "3 viikkoa putkeen · 3 treeniä" over a calendar that marked two (audit,
   * 2026-09-20). The History card at the foot of the tab keeps every saved
   * session, as History itself does.
   */
  const completedWorkoutSessions = useMemo(
    () =>
      getCanonicalCompletedSessions({
        workoutSessions: database.workoutSessions,
        exerciseLogs: database.exerciseLogs,
      }),
    [database.exerciseLogs, database.workoutSessions],
  );
  const homeRecentSessions = useMemo(
    () =>
      [...workoutSessions]
        .sort((left, right) => new Date(right.performedAt).getTime() - new Date(left.performedAt).getTime())
        .slice(0, 3)
        .map((session) => {
          const sessionLogs = [...getSessionLogs(session.id)].sort((left, right) => left.orderIndex - right.orderIndex);
          const exercisePreview = sessionLogs
            .filter((log) => !log.skipped)
            .map((log) => log.exerciseNameSnapshot)
            .slice(0, 3)
            .join(', ');
          const notePreview =
            sessionLogs.find((log) => typeof log.notes === 'string' && log.notes.trim().length > 0)?.notes?.trim() ?? null;
          const completedSets = typeof session.setsCompleted === 'number' ? session.setsCompleted : null;
          const completedExercises =
            typeof session.exercisesCompleted === 'number'
              ? session.exercisesCompleted
              : sessionLogs.filter((log) => !log.skipped).length;

          return {
            id: session.id,
            title: localizeSessionName(
              formatWorkoutDisplayLabel(session.workoutNameSnapshot, t(preferences.appLanguage, 'ai.signal.workout')),
              preferences.appLanguage,
            ),
            dateLabel: formatShortDate(session.performedAt, preferences.appLanguage),
            durationLabel:
              typeof session.durationMinutes === 'number' && session.durationMinutes > 0
                ? formatDurationMinutes(session.durationMinutes)
                : '0 min',
            volumeLabel: formatVolume(session.totalVolumeKg ?? 0, unitPreference),
            detailLabel:
              completedSets !== null
                ? t(preferences.appLanguage, 'recent.setCount', { count: completedSets })
                : t(preferences.appLanguage, 'recent.exerciseCount', { count: completedExercises }),
            exercisePreview: exercisePreview || t(preferences.appLanguage, 'recent.completed'),
            notePreview,
          };
        }),
    [getSessionLogs, preferences.appLanguage, unitPreference, workoutSessions],
  );
  const dismissedTipIds = preferences.dismissedTipIds ?? [];
  /**
   * The full catalog as browse cards, plus the counts each category tile
   * shows.
   *
   * Explore used to be eight hand-picked ids — a curated row that could not
   * grow and that no filter could reach past. With categories on the screen
   * the rail has to be the whole catalog, or a tile saying "Voima 8" would
   * open a list of three.
   */
  const programsCatalogItems = useMemo<ProgramsExploreItem[]>(
    () =>
      workout.templates.map((template, index) => ({
        id: template.id,
        name: formatWorkoutDisplayLabel(template.name),
        goal: formatGoalLabel(template.goalType, preferences.appLanguage),
        blurb: getReadyProgramContent(template.id, preferences.appLanguage)?.summary ?? '',
        days: template.daysPerWeek,
        minutes: template.estimatedSessionDuration,
        cover: programCoverStyle(template.id, template.name),
        fingerprint: buildProgramFingerprint(template),
        level: template.level,
        weeks: getReadyProgramBlockWeeks(template),
      })),
    [preferences.appLanguage, workout.templates],
  );
  const programsCategoryCounts = useMemo(
    () => countByCategory(workout.templates),
    [workout.templates],
  );
  /**
   * The catalog screen's rows: the explore items plus every category each
   * programme belongs to, because the goal chips narrow on that and a
   * programme in two categories has to be findable under both.
   */
  const catalogScreenItems = useMemo<CatalogScreenItem[]>(() => {
    const memberships = new Map<string, ProgramCategoryKey[]>();
    for (const category of PROGRAM_CATEGORIES) {
      for (const template of filterByCategory(workout.templates, category.key)) {
        const keys = memberships.get(template.id);
        if (keys) {
          keys.push(category.key);
        } else {
          memberships.set(template.id, [category.key]);
        }
      }
    }
    return programsCatalogItems.map((item) => ({
      ...item,
      categories: memberships.get(item.id) ?? [],
    }));
  }, [programsCatalogItems, workout.templates]);
  const programsCategoryMembers = useMemo(
    () =>
      Object.fromEntries(
        PROGRAM_CATEGORIES.map((category) => [
          category.key,
          filterByCategory(workout.templates, category.key).map((template) => template.id),
        ]),
      ) as Record<ProgramCategoryKey, string[]>,
    [workout.templates],
  );
  /**
   * "For you" — the programs the recommendation engine actually picked, each
   * with the reason it picked them.
   *
   * Every card carries a "why": the waterfall's picks bring their own, and the
   * affinity backfill names its reason per match (same goal one level up, a
   * different split, ...). That is the rule that used to cap this row at two —
   * a recommendation without a reason is the thing this app has repeatedly
   * refused to ship — and it still holds at six (user asked for more cards,
   * #bugs 2026-08-25): the row grows only as far as reasoned matches exist.
   *
   * NOT labelled AI, deliberately. The model is never used to pick a
   * programme — that is a scored, testable decision: recommendationScoring
   * plus a waterfall, covered by tests. An AI badge here would claim
   * otherwise.
   */
  /**
   * "Sinulle" — and nothing in it is something you already run.
   *
   * The questionnaire's two picks lead, but adopting one used to leave it in
   * the row, so the tab kept recommending a programme the reader was already
   * training. A taken programme drops out and the row is filled from the
   * catalog, measured from what is being trained NOW — see
   * lib/recommendationBackfill. The first reason the ranker reaches for is
   * "same goal, one level up", so the fill is usually a step harder.
   */
  const programsRecommendations = useMemo(
    () => {
      const byId = new Map(workout.templates.map((template) => [template.id, template]));
      const waterfall = setupRecommendation?.waterfall;
      // A custom programme is not in the catalog, so it cannot anchor the
      // affinity read directly — but it was composed from the same answers
      // the questionnaire's featured ready pick matches (goal, level, days),
      // so that pick stands in. Without the fallback a custom-programme user
      // saw the row collapse to the two questionnaire cards forever.
      const anchor =
        (homeActivePlanCard?.programId ? byId.get(homeActivePlanCard.programId) ?? null : null)
        ?? recommendedReadyTemplate
        ?? null;
      const picks = waterfall
        ? [
            { templateId: waterfall.primaryProgramId, whyKey: waterfall.whyPrimary },
            { templateId: waterfall.alternativeProgramId, whyKey: waterfall.whyAlternative },
          ].filter(
            (entry): entry is { templateId: string; whyKey: I18nKey } =>
              Boolean(entry.templateId && entry.whyKey),
          )
        : [];

      return backfillRecommendations({
        picks,
        // A programme you run under your own copy of it is a programme you
        // run. The row dropped what was adopted by template id, and a copy
        // carries a new one — so the card the questionnaire had just handed
        // over went on being recommended, under the catalog name, to the
        // reader already training it (audit round 4, 2026-09-20).
        adoptedIds: expandRunningIdsWithSources(
          activeProgramTemplateIds,
          database.workoutTemplates,
          workout.templates.map((template) => template.id),
        ),
        anchor,
        catalog: workout.templates,
        // Six either way: the questionnaire's picks lead when they exist, and
        // affinity neighbours of the active programme fill the rest. With no
        // active programme there is nothing to measure affinity from, so the
        // row honestly shrinks to the picks instead of padding.
        limit: 6,
      })
        .map((slot) => {
          const template = byId.get(slot.templateId);
          return template
            ? {
                id: template.id,
                name: formatWorkoutDisplayLabel(template.name),
                goal: formatGoalLabel(template.goalType, preferences.appLanguage),
                blurb: getReadyProgramContent(template.id, preferences.appLanguage)?.summary ?? '',
                why: t(preferences.appLanguage, slot.whyKey, { days: template.daysPerWeek }),
                days: template.daysPerWeek,
                minutes: template.estimatedSessionDuration,
                cover: programCoverStyle(template.id, template.name),
                fingerprint: buildProgramFingerprint(template),
                level: template.level,
                weeks: getReadyProgramBlockWeeks(template),
              }
            : null;
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
    },
    [
      activeProgramTemplateIds,
      // The row asks which catalog programmes the running ones are copies
      // of, so a copy made without the running set changing — a fork made
      // while browsing — has to reach it (review, 2026-09-20).
      database.workoutTemplates,
      homeActivePlanCard?.programId,
      preferences.appLanguage,
      recommendedReadyTemplate,
      setupRecommendation?.waterfall,
      workout.templates,
    ],
  );
  /**
   * The rotating hero's slides, and the counts they promise.
   *
   * Every count is read off the same catalog the tiles filter, so a slide
   * cannot advertise a season that has nothing in it.
   */
  const {
    toSetLogSource,
    recordSources,
    liftHistory,
    plateauNotice,
    personalRecords,
    distinctRecordCount,
    milestoneLedger,
  } = useRecordsAndMilestones({
    exerciseBrowserItems,
    trackedProgress,
    database,
    proLiftHistories,
    preferences,
    lifetimeSummary,
    unitPreference,
  });

  /**
   * The strip under "Aloita treeni".
   *
   * Every input is read from state that is true right now: the season window
   * the calendar is actually in, a recommendation the reader is not already
   * running, and a target only once there are lifts to measure one from.
   */
  /**
   * Signing up for a season — the whole act, in one place.
   *
   * It writes a row and nothing else. Adopting the season programme is a
   * separate decision made on the season screen, because it replaces what you
   * are training today and that needs the sentence next to it.
   */
  const handleEnrolSeason = useCallback(
    (season: ProgramSeason, year: number) => {
      void updatePreferences({
        seasonEnrolments: addSeasonEnrolment(preferences.seasonEnrolments, {
          season,
          year,
          joinedAt: new Date().toISOString(),
        }),
      });
    },
    [preferences.seasonEnrolments, updatePreferences],
  );

  const {
    sameLibraryRow,
    goalFlowLifts,
    targetLiftProgress,
    targetLiftSources,
    getGoalProposal,
    handleAcceptTargetProposal,
    programsGoals,
    goalProgrammeSuggestions,
  } = useGoalFlow({
    exerciseLibrary,
    todayStartMs,
    preferences,
    proLiftHistories,
    trackedProgress,
    toSetLogSource,
    handleAdoptReadyProgram,
    updatePreferences,
    navigate,
    activeProgramTemplateIds,
    customWorkoutRuntimeMap,
    programsRecommendations,
  });
  // Programmes the reader built, not every template in the database: a
  // freestyle log writes a template of its own to hang the session on, and
  // "Omat ohjelmasi" was listing each of those as a programme. Those sessions
  // live in History; the same rule the programme cap already uses.
  const programsCustomItems = useMemo(() => {
    // The Active tag follows the plan Home leads with, read from the plan
    // itself. It was read off Home's hero card, which is null whenever the
    // hero cannot be built — and then no row carried the tag at all.
    const leadingTemplateId = leadTemplateId({ activePlanId: preferences.activePlanId, plans: database.workoutPlans });
    const authored = customWorkouts
      .filter((template) => template.origin !== 'freestyle')
      .map((template) => ({
        id: template.id,
        name: formatWorkoutDisplayLabel(template.name),
        // Built in English here, under a Finnish heading, on the tab that
        // sells programs. The key existed the whole time.
        subtitle: t(
          preferences.appLanguage,
          template.sessionCount === 1 ? 'prog.custom.countsOne' : 'prog.custom.counts',
          { sessions: template.sessionCount, exercises: template.exerciseCount },
        ),
        active: leadingTemplateId === template.id,
        programType: 'custom' as const,
      }));

    // The plan you are actually training belongs on this list even when it is
    // a ready programme rather than one you wrote: onboarding's second button
    // adopts the catalog programme without authoring anything, so the reader
    // trained a programme that appeared nowhere under "your programmes".
    // Active first, whether it was authored or adopted (user, 2026-09-01).
    // An authored programme kept its authoring position, so the one you are
    // training could sit third under two you are not — and ACTIVE is a tag you
    // have to read the list to find rather than a place in it.
    //
    // Stable beyond that: the rest keep the order they were written in, so
    // nothing else moves under the reader.
    const leadFirst = <T extends { active: boolean }>(rows: T[]): T[] => [
      ...rows.filter((row) => row.active),
      ...rows.filter((row) => !row.active),
    ];

    // Every RUNNING programme belongs here, not only the one Home leads with.
    //
    // An adopted ready programme has no row of its own in `workoutTemplates`
    // — adoption points a plan at the catalog rather than copying it — so it
    // was listed only while it was the leader. Making a second programme lead
    // dropped it out of the one list called "your programmes" while it kept
    // running and kept holding a slot against the programme cap: a reader at
    // the cap could be blocked by a programme this screen would not show them
    // (user 2026-09-07, "laitoin advanced glutes nayta kodissa niin tama
    // strong ohjelma katosi kokonaan").
    //
    // Home already listed them under its hero, and its own removal copy says
    // "it stays in Programs" — a promise this list could not keep.
    const authoredIds = authored.map((item) => item.id);
    // And every programme the reader HOLDS, running or not: switching one off
    // is not deleting it, and a list that dropped it made the switch look
    // like a delete (device, 2026-09-16).
    const runningRows = listHeldProgrammes({
      activePlanId: preferences.activePlanId,
      activePlanIds: preferences.activePlanIds,
      plans: database.workoutPlans,
      authoredTemplateIds: authoredIds,
    })
      .map((row) => {
        // Only what the catalog can actually open. A plan pointing at a custom
        // template the reader has since deleted is neither authored nor ready,
        // and a row for it would navigate to a programme that is not there.
        const template = getWorkoutTemplateById(row.templateId);
        if (!template) {
          return null;
        }
        // The SAME question the authored rows ask, so one list cannot hold two
        // notions of "active" and mark a row by each.
        const active = leadingTemplateId === row.templateId;
        return {
          id: row.templateId,
          name: runningProgrammeTitle(row.templateId, row.planName, template.daysPerWeek),
          /**
           * "The programme you are training right now" is a claim about ONE
           * row, and this list can now hold several running programmes. Said
           * on every one of them it contradicted the ACTIVE tag beside it,
           * which only the leader carries (review, 2026-09-07). A programme
           * that runs without leading gets the neutral line the same
           * programmes already carry under Home's hero.
           */
          subtitle: active
            ? t(preferences.appLanguage, 'programs.activeSubtitle')
            : row.running
              ? t(preferences.appLanguage, 'programs.card.days', { count: template.daysPerWeek })
              : t(preferences.appLanguage, 'programs.card.switchedOff'),
          active,
          programType: 'ready' as const,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    return leadFirst([...runningRows, ...authored]);
  }, [
    customWorkouts,
    database.workoutPlans,
    preferences.activePlanId,
    preferences.activePlanIds,
    preferences.appLanguage,
    runningProgrammeTitle,
  ]);

  const templateBuilderDraft = useTemplateBuilderDraft({
    route,
    preferences,
    workoutTemplates,
    getWorkoutTemplateSessions,
  });

  if (!nativeSplashHidden || !hydrated || !workout.hydrated) {
    return <LaunchScreen />;
  }

  // Shared finish path for logged one-off sessions (freestyle + editor):
  // template first, then the completed session, and only then the summary
  // screen — a failed save must leave the logger open with its sets intact.
  const finishLoggedWorkoutSave = async (draft: WorkoutTemplateDraft, summary: FreestyleFinishSummary) => {
    const workoutTemplateId = await upsertWorkoutTemplate(draft);
    const sessionId = createId('session');
    try {
      await saveCompletedWorkoutSession({
        sessionId,
        workoutTemplateId,
        workoutNameSnapshot: summary.workoutName,
        logs: summary.logs,
        startedAt: summary.startedAt,
        performedAt: summary.performedAt,
      });
    } catch (error) {
      // The template is written first so the session can name it. A session
      // that did not land must not leave the template behind — the retry made
      // a second one (audit round 4, 2026-09-20). Best effort: the failure
      // the reader hears about is the save.
      await deleteWorkoutTemplate(workoutTemplateId).catch(() => undefined);
      throw error;
    }
    // Counted once it is on disk, as the guided path counts it.
    trackEvent('workout_completed');
    /**
     * Remembered for the next time these lifts come up.
     *
     * The weight a set opens on is read from the workout provider's slot
     * history, and the only thing that ever wrote to it was the guided
     * player's own finish — so a lift done here left no trace, and opened at
     * nothing next time even though the numbers had just been written to the
     * database ("paino automaattisesti siihen mitä on viimeksi tehnyt", #bugs
     * 2026-08-27). Only completed sets with both numbers: a row that was put
     * on the board and not done is not a weight.
     */
    workout.recordLoggedWorkout({
      performedAt: summary.performedAt,
      sessionId,
      templateName: summary.workoutName,
      exercises: summary.logs.map((log) => ({
        exerciseName: log.exerciseNameSnapshot,
        sets: log.sets
          .filter((set) => set.outcome === 'completed' && set.reps > 0)
          .map((set, setIndex) => ({
            setIndex,
            loadKg: set.weight,
            reps: set.reps,
            completedAt: set.completedAt ?? summary.performedAt,
          })),
      })),
    });
    setCompletionSummary({
      sessionId,
      ...summary,
      // Freestyle sessions have no plan identity: no previous-session
      // comparison, and muscle focus comes from the logged drafts.
      volumeDeltaKg: null,
      muscles: buildMuscleFocus(
        summary.logs.map((log) => ({
          exerciseName: log.exerciseNameSnapshot,
          sets: log.sets.map((set) => ({
            status: set.outcome === 'completed' ? ('completed' as const) : ('skipped' as const),
            weightKg: set.weight,
            reps: set.reps,
          })),
        })),
        exerciseLibrary,
      ),
      // A freestyle session has no plan identity, and the comparison this
      // screen makes is "against the last time you trained this lift" — a
      // claim the empty-workout flow does not gather the history for.
      whatMoved: [],
      movementById: {},
      insight: null,
    });
    summaryExitRouteRef.current = ROOT_ROUTES.home;
    replaceRoute({ tab: 'workout', screen: 'summary' });
  };

  let content: React.ReactNode = null;

  if (onboardingActive) {
    if (entryFlowActive) {
      content = (
        <WelcomeScreen
          language={preferences.appLanguage}
          onChangeLanguage={(nextLanguage) => void updatePreferences({ appLanguage: nextLanguage })}
          onContinue={() => void handleContinueEntry()}
        />
      );
    } else if (onboardingStep === 'path') {
      content = (
        <StartPathScreen
          language={preferences.appLanguage}
          // Both paths go straight to about-you. A Health Connect step used to
          // sit here and was removed for v1 on 2026-08-11: it imported exactly
          // two numbers that the next screen asks for anyway, and on a real
          // Galaxy A54 it imported nothing at all — the break is between
          // Samsung Health and Health Connect, outside this app, and only adb
          // can see it. A user just taps and watches nothing happen, in the
          // first minute, before the app has shown any value. Health returns in
          // v2 under Settings, and as an export of finished workouts rather
          // than an import of body stats.
          onGuidedOnboarding={() => {
            setOnboardingStep('about');
          }}
          /**
           * In with nothing at all (user 2026-08-31).
           *
           * A reader who wants to look around before committing had to answer
           * a questionnaire or adopt a programme first — the front door had no
           * handle for "not yet". No plan, no template, no questionnaire:
           * `setupCompleted` stays false, so Profile still offers to fill the
           * profile in later, and Home shows its no-programme state rather
           * than a plan nobody chose.
           */
          onStartEmpty={() => {
            void completeOnboarding({
              onboardingCompleted: true,
              setupCompleted: false,
              trainingFirstRunDismissed: false,
              // The handoff's two offers are skipped too: they are the
              // friction this path exists to escape, and both live in
              // Settings for whenever the reader wants them.
              setupHandoffCompleted: true,
            })
              .then(() => {
                // Counted once it has happened, not when it was asked for.
                trackEvent('onboarding_completed', { path: 'empty' });
                navigate({ tab: 'home', screen: 'dashboard' });
              })
              // A refused write left the reader on this screen with no word
              // about why the button did nothing (2026-09-17).
              .catch((error) => {
                console.error('Failed to start empty', error);
                showToast(t(preferences.appLanguage, 'toast.startEmptyFailed'));
              });
          }}
          onBrowsePrograms={() => {
            // Straight to the catalog. This fork used to detour through the
            // About-you form first, which is the opposite of what the card
            // promises ("choose the program you want yourself") — the reader
            // asked to skip the questions and got a form. Nothing downstream
            // needs the answers: handleOnboardingPickReadyProgram already
            // reads every basic through `aboutYouValues?.` and stores null.
            // The profile is filled in later, from Settings.
            setOnboardingStep('ready_catalog');
          }}
          onBack={() => void handleBackToEntry()}
        />
      );
    } else if (onboardingStep === 'about') {
      content = (
        <AboutYouScreen
          language={preferences.appLanguage}
          initialValues={aboutYouValues}
          onContinue={(values) => {
            setAboutYouValues(values);
            // Only the build path opens About; the ready path goes from the
            // fork straight to the catalogue.
            setOnboardingStep('questionnaire');
          }}
          onBack={() => setOnboardingStep('path')}
        />
      );
    } else if (onboardingStep === 'ready_catalog') {
      content = (
        <OnboardingReadyCatalogScreen
          language={preferences.appLanguage}
          busy={busySavingReadyPick}
          onPick={(programId) => void handleOnboardingPickReadyProgram(programId)}
          // Back goes where the reader came from, which is the fork — not the
          // About form they deliberately did not open.
          onBack={() => setOnboardingStep('path')}
        />
      );
    } else {
      content = (
        <OnboardingScreen
          initialUnitPreference={unitPreference}
          language={preferences.appLanguage}
          tailoringPreferences={tailoringPreferences}
          readyProgramCount={workout.templates.length}
          dismissedTipIds={dismissedTipIds}
          basicsSeed={
            aboutYouValues
              ? {
                  gender: aboutYouValues.gender ?? 'unspecified',
                  ageRange: aboutYouValues.ageRange,
                  currentWeightKg: aboutYouValues.weightKg,
                }
              : null
          }
          onDismissTip={handleDismissTip}
          onBackToEntry={() => setOnboardingStep('about')}
          onCompleteToTraining={handleOnboardingCompleteToTraining}
          onFullBleedReviewChange={setFullBleedReview}
        />
      );
    }
  } else if (setupHandoffActive && setupHandoffPlan) {
    // Between the last question and the app. The route behind this is already
    // the one onboarding chose, so finishing here just uncovers it.
    content = (
      <>
      <SetupHandoffScreen
        language={preferences.appLanguage}
        plan={setupHandoffPlan}
        focusLabel={
          setupHandoffPlan.tracking?.focus
            ? getFocusAreaTitle(setupHandoffPlan.tracking.focus, preferences.appLanguage)
            : null
        }
        onDone={(choices) => void handleSetupHandoffDone(choices)}
        onSkip={() =>
          void handleSetupHandoffDone({
            addWidget: false,
            signInForBackup: false,
            showPro: false,
            trackedSites: [],
            legalAccepted: false,
          })
        }
        onOpenLegal={(document) => setHandoffLegalDocument(document)}
        legalAlreadyAccepted={
          legalAcceptanceDue(preferences.legalAcceptance, LEGAL_LAST_UPDATED) === null
        }
      />
      {/* Over the hand-off, never instead of it (2026-09-10). The screen owns
          the reader's answers in local state — which page they are on, which
          sites they picked, whether they asked for the widget — so swapping it
          out to show a document threw all of that away and put them back on
          page one. Reading the policy is not a decision to unmake. */}
      {handoffLegalDocument ? (
        <View style={LEGAL_OVER_HANDOFF}>
          <LegalDocumentScreen
            document={handoffLegalDocument}
            language={preferences.appLanguage}
            onBack={() => setHandoffLegalDocument(null)}
          />
        </View>
      ) : null}
      </>
    );
  } else if (route.tab === 'profile' && route.screen === 'setup') {
    content = (
      <OnboardingScreen
        key={`setup:${preferences.recommendedProgramId ?? 'none'}:${preferences.setupCompleted ? 'complete' : 'pending'}:${route.stage ?? 'default'}`}
        mode="edit"
        // Answers only for a reader who gave them. One who started empty or
        // picked from the catalogue was handed the questionnaire's defaults
        // here, and finishing wrote those over their My Data — gender, age,
        // height, weight, rhythm (2026-09-17). They get what they entered as
        // basics, and the questions open unanswered.
        initialSelection={setupEditSelection}
        basicsSeed={setupEditSelection ? null : setupBasics}
        initialStage={route.stage ?? (setupSelection ? 'review' : 'location')}
        initialUnitPreference={unitPreference}
        language={preferences.appLanguage}
        tailoringPreferences={tailoringPreferences}
        readyProgramCount={workout.templates.length}
        dismissedTipIds={dismissedTipIds}
        onDismissTip={handleDismissTip}
        onCancel={() => navigateBack(ROOT_ROUTES.profile)}
        onCompleteToTraining={handleSetupCompleteToTraining}
        onSaveLimitations={route.stage === 'avoid' ? handleSaveSetupLimitations : undefined}
      />
    );
  } else if (
    route.tab === 'home' &&
    (route.screen === 'cardio' ||
      route.screen === 'history' ||
      route.screen === 'session' ||
      route.screen === 'ai_chat' ||
      route.screen === 'analysis')
  ) {
    // Every home sub-screen; the dashboard stays in the chain's final else,
    // where it doubles as the safety net for cleared guard state.
    content = renderHomeScreens({
      route,
      navigate,
      replaceRoute,
      navigateBack,
      preferences,
      updatePreferences,
      workout,
      cardioSessions,
      cardioSaving,
      setCardioSaving,
      saveCardioSession,
      navigateToActiveWorkout,
      setFinishSaveState,
      showToast,
      aiCoachTrainingContext,
      exerciseLibrary,
      programSlots,
      setProgramLimitVisible,
      workoutTemplates,
      upsertWorkoutTemplate,
      workoutSessions,
      getSessionLogs,
      historyScrollOffsetRef,
      deleteCompletedWorkoutSession: handleDeleteCompletedSession,
      deleteCardioSession,
      unitPreference,
      coachProUnlocked,
      database,
      coachChatIntro,
      coachLastSession,
      homePinnedStatCardKeys,
      addBodyweightEntry,
      addMeasurementEntry,
      coachChatMemory,
      onCoachChatMemoryChange: setCoachChatMemory,
      onCoachAdviceGiven: handleCoachAdviceGiven,
      sessionAnalysis,
    });
  } else if (route.tab === 'workout' && route.screen === 'summary' && completionSummary) {
    content = (
      <WorkoutCompletionScreen
        language={preferences.appLanguage}
        weekProgress={completionWeekProgress}
        nextUp={guidedNextUp}
        workoutName={completionSummary.workoutName}
        performedAt={completionSummary.performedAt}
        durationMinutes={completionSummary.durationMinutes}
        setsCompleted={completionSummary.setsCompleted}
        exercisesLogged={completionSummary.exercisesLogged}
        muscles={completionSummary.muscles}
        exerciseCards={completionSummary.exerciseCards}
        whatMoved={completionSummary.whatMoved}
        movementById={completionSummary.movementById}
        prCards={completionSummary.prCards}
        // Moment 1 is for free users only — Pro gets the conclusions unlocked
        // at the surfaces where they live, not a lock on its own screen.
        lockedInsight={
          !coachProUnlocked && proCompletionMoment
            ? {
                teaser: proCompletionMoment.conclusion.teaser,
                body: proCompletionMoment.conclusion.body,
                moment: proCompletionMoment.moment,
              }
            : null
        }
        onOpenPremium={() => navigate({ tab: 'profile', screen: 'premium' })}
        demoQuestion={coachDemoQuestion}
        onSendDemoQuestion={() => {
          if (!coachDemoMoment || !coachDemoQuestion) {
            return;
          }
          // Spending it HERE was wrong, and the device found it: the chat
          // will not send while the online disclosure is unacknowledged, so a
          // reader who met that sheet for the first time and backed out lost
          // one of three answers without ever getting one. The moment is now
          // spent by the chat, at the moment it actually dispatches the send.
          navigate({
            tab: 'home',
            screen: 'ai_chat',
            demoQuestion: coachDemoQuestion,
            demoMomentKey: coachDemoMoment.key,
          });
        }}
        onDone={(feel) => {
          // The verdict lands on the already-saved session; leaving does not
          // wait for the write (it goes through the same serial queue every
          // other database write uses).
          if (feel) {
            void updateCompletedWorkoutSession(completionSummary.sessionId, { feel });
          }
          workout.clearCompletedWorkout();
          leaveFinishedWorkout(ROOT_ROUTES.home);
        }}
      />
    );
  } else if (route.tab === 'workout') {
    // Every route-pure workout branch. `summary` and `celebration` sit above
    // this on purpose: their guards read finish-flow state, and when that
    // state was just cleared the module returns null here and the dashboard
    // fallback below catches it — the same drop-through the old chain had.
    content = renderWorkoutTab({
      onStopProgram: handleStopProgram,
      onResumeProgram: handleResumeProgram,
      onSwitchActiveProgram: handleSwitchActiveProgram,
      onForgetHeldProgram: handleForgetHeldProgram,
      route,
      navigate,
      navigateBack,
      replaceRoute,
      workoutHomeRoute,
      preferences,
      updatePreferences,
      unitPreference,
      database,
      workout,
      freestyleDraft: workout.freestyleDraft,
      saveFreestyleDraft: workout.saveFreestyleDraft,
      clearFreestyleDraft: workout.clearFreestyleDraft,
      customWorkoutRuntimeMap,
      setupSelection,
      setupRecommendation,
      tailoringPreferences,
      activeProgramTemplateIds,
      homeActivePlanCard,
      programInsightsByTemplateId,
      availableEquipmentForDrills,
      routineSecondsForExercises,
      resolveNextSessionIdForTemplate,
      handleStartReadyProgramSession,
      handleAdoptReadyProgram,
      handleStartCustomProgram,
      handleAdoptCustomProgram,
      handleStartCustomProgramSession,
      editProgramExercise: handleEditProgramExercise,
      handleSaveRhythm,
      handleRenameCustomProgram,
      handleRenameProgramSession,
      handleReorderProgramSession,
      handleAddProgramSession,
      handleRemoveProgramSession,
      handleSaveEmphasis,
      handleDeleteCustomWorkout,
      sessionAdaptationFor,
      adaptSession,
      templateBuilderDraft,
      exerciseBrowserItems,
      recentExerciseBrowserItems,
      upsertWorkoutTemplate,
      showToast,
      exercisePrLookup,
      finishLoggedWorkoutSave,
      exerciseLibrary,
      liftHistory,
      plateauNotice,
      sameLibraryRow,
      guidedEntryEyebrow,
      guidedWeekProgress,
      guidedNextUp,
      getWorkoutLoggerFallbackRoute,
      handleDiscardWorkout,
      handleConfirmFinishWorkout,
      finishSaveState,
      customWorkouts,
      recommendedReadyProgramId: recommendedReadyTemplate?.id ?? null,
      navigateToGuidedWorkout,
      handleOpenProgramDetail,
      handleStartReadyProgram,
      handleOpenCustomProgramDetail,
      goalProgrammeSuggestions,
      goalFlowLifts,
      getGoalProposal,
      handleAcceptTargetProposal,
      programSlots,
      setProgramLimitVisible,
      syncPlanToTemplate,
      trackedProgress,
      workoutSessions,
      handleEnrolSeason,
      programsCatalogItems,
      catalogScreenItems,
      proUnlocked: proEntitlement.unlocked,
      programsCategoryCounts,
      programsCategoryMembers,
      programsRecommendations,
      programsGoals,
      programsCustomItems,
      exerciseNameBook,
      teachExerciseName,
      handlePickProgramImage,
      coachProUnlocked,
    });
  } else if (route.tab === 'progress') {
    content = renderProgressTab({
      route,
      navigate,
      resetToRoute,
      tourTargets: tourRegistry,
      preferences,
      updatePreferences,
      personalRecords,
      distinctRecordCount,
      recordSources,
      targetLifts: goalFlowLifts,
      targetLiftProgress,
      targetLiftSources,
      bodyweightProgress,
      measurementEntries,
      completedWorkoutSessions,
      cardioSessions,
      activityCalendar: homeSummary.streak.calendar,
      homeTrainingSchedule,
      progressTrainingRhythm,
      progressWeeklyTarget,
      unitPreference,
      proWeeklyRead,
      recoverySheet,
      onRecoveryAction: handleRecoveryAction,
      onRecoveryUndo: handleRecoveryUndo,
      proPlateauMoment: proPlateau?.moment ?? null,
      coachProUnlocked,
      addBodyweightEntry,
      addMeasurementEntry,
      deleteBodyweightEntry,
      deleteMeasurementEntry,
      showToast,
      homeRecentSessions,
    });
  } else if (route.tab === 'profile') {
    // Everything under the profile tab except `setup`, which the onboarding
    // gate above already claimed — the module's ProfileScreen fallback never
    // sees it. Branch order inside the module mirrors the old chain exactly.
    content = renderProfileTab({
      route,
      tourTargets: tourRegistry,
      readyProgramCount: workout.templates.length,
      proUnlocked: proEntitlement.unlocked,
      navigate,
      navigateBack,
      resetToRoute,
      preferences,
      updatePreferences,
      coachProUnlocked,
      proCoachSpecimen,
      proEntitlement,
      profilePlanSummary,
      homeActivePlanCard,
      exerciseBrowserItems,
      exerciseNameBook,
      teachExerciseName,
      handlePickProgramImage,
      handleChangeTrainingDays,
      programSlots,
      setProgramLimitVisible,
      upsertWorkoutTemplate,
      exportablePlans,
      database,
      latestWeighInKg,
      settingsScrollOffsetRef,
      homeWidgetState,
      handleAddHomeWidget,
      accountBackup,
      handleAccountSignIn,
      handleAccountBackupNow,
      showToast,
      setSettingsImportVisible,
      setRatingSheetVisible,
      resetAllData: handleResetAllData,
      deletePendingAiLogs,
      retireAiLogLabel,
      setCompletionSummary,
      setFinishSaveState,
      workout,
      lifetimeSummary,
      milestoneLedger,
      trackedProgress,
      exerciseLibrary,
      unitPreference,
      homeTrainingDayIndexes,
      distinctRecordCount,
    });
  }

  // The dashboard — and the safety net. `content` is still null when no
  // branch claimed the route OR a tab module declined it (a summary whose
  // finish-flow state was just cleared): both land on Home, exactly as the
  // chain's final else always did.
  if (content == null) {
    content = (
      <HomeScreen
        language={preferences.appLanguage}
        tourTargets={tourRegistry}
        tourFocus={tourFocus}
        onOpenSubscription={() => navigate({ tab: 'profile', screen: 'subscription' })}
        activePlan={homeActivePlanCard}
        emptyProgramme={homeEmptyProgramme}
        onOpenEmptyProgramme={() => {
          if (homeEmptyProgramme) {
            navigate({
              tab: 'workout',
              screen: 'program',
              programType: 'custom',
              workoutTemplateId: homeEmptyProgramme.workoutTemplateId,
            });
          }
        }}
        onCompletionStartNext={(planId, templateId) => void handleCompletionStartNext(planId, templateId)}
        onCompletionRestart={(planId) => void handleCompletionRestart(planId)}
        onCompletionDismiss={(planId) => void dismissCompletionCard(planId)}
        onCompletionBrowse={(planId) => {
          void dismissCompletionCard(planId);
          navigate(ROOT_ROUTES.workout);
        }}
        otherPrograms={homeOtherPrograms}
        programCapLine={programCapLine}
        onOpenOtherProgram={(planId) => {
          const plan = database.workoutPlans.find((entry) => entry.id === planId);
          const templateId = plan?.entries[0]?.workoutTemplateId;
          if (templateId) {
            handleOpenProgramDetail(templateId);
          }
        }}
        onRemoveOtherProgram={(planId) => void handleRemoveActiveProgram(planId)}
        availableEquipment={availableEquipmentForDrills}
        routineDrillOverrides={preferences.routineDrillOverrides}
        // Permanent by nature: the drills are generated from the session's
        // focus, so the choice belongs to every day with that focus rather
        // than to today. There is no "just this time" to offer.
        onSwapRoutineDrill={(slotKey, drillKey) =>
          void updatePreferences((current) => ({
            routineDrillOverrides: { ...current.routineDrillOverrides, [slotKey]: drillKey },
          }))
        }
        widgetPrompt={
          !homeTourActive && homeWidgetState?.supported && !homeWidgetState.added && !preferences.homeWidgetPromptDismissed
            ? {
                onAdd: () => void handleAddHomeWidget(),
                onDismiss: () => void updatePreferences({ homeWidgetPromptDismissed: true }),
              }
            : null
        }
        accountBackupPrompt={
          // One prompt at a time, and this one waits for the third logged
          // session (lib/homePrompts): a fresh install has nothing worth
          // backing up, and the account ask is the one most likely to be
          // both refused and remembered.
          homePrompt === 'signIn'
            ? {
                onSignIn: () => {
                  void handleAccountSignIn().then((kind) => {
                    // An answered offer never returns; a cancelled sheet or a
                    // failure leaves it up for another try or a real dismissal.
                    if (kind === 'backed_up' || kind === 'restored' || kind === 'choice' || kind === 'confirm_upload') {
                      void updatePreferences({ accountBackupPromptDismissed: true });
                    }
                  });
                },
                onDismiss: () => void updatePreferences({ accountBackupPromptDismissed: true }),
              }
            : null
        }
        trainingSchedule={homeTrainingSchedule}
        doneThisWeekSessionIds={homeDoneThisWeekSessionIds}
        statCatalogCards={homeStatCatalogCards}
        suggestedStatCardKeys={homePrompt === 'suggestion' ? homeSuggestedStatCardKeys : []}
        onDismissStatCardSuggestion={(key) =>
          void updatePreferences((current) => ({
            dismissedCardSuggestionKeys: [...current.dismissedCardSuggestionKeys, key],
          }))
        }
        pinnedStatCardKeys={homePinnedStatCardKeys}
        onChangePinnedStatCardKeys={(next) => void updatePreferences({ homeStatCardKeys: next })}
        onOpenStatCard={(key) => {
          // Each card opens the surface where its data is tracked and logged.
          if (key === 'bodyweight') {
            navigate({ tab: 'progress', screen: 'bodyweight' });
            return;
          }
          if (isMeasurementCardKey(key)) {
            // The card's own measurement, selected and ready to log — not
            // the section on whatever was picked last.
            navigate({ tab: 'progress', screen: 'list', section: 'measures', measure: key });
            return;
          }
          if (key.startsWith('lift:')) {
            navigate({ tab: 'progress', screen: 'detail', exerciseKey: key.slice('lift:'.length) });
          }
        }}
        sessionSwaps={homeSessionAdaptation.swaps}
        onSwapSessionExercise={(slotId, exerciseName) =>
          adaptHomeSession((current) => withSessionSwap(current, slotId, exerciseName))
        }
        sessionDrops={homeSessionAdaptation.drops}
        onDropSessionExercise={(slotId) => adaptHomeSession((current) => withSessionDrop(current, slotId))}
        onRestoreSessionExercise={(slotId) => adaptHomeSession((current) => withoutSessionDrop(current, slotId))}
        onRemoveSessionExercise={(exerciseId) => {
          const sessionId = homeActivePlanCard?.nextSession?.id;
          if (homeActivePlanCard && sessionId) {
            void handleEditProgramExercise(
              homeActivePlanCard.programType,
              homeActivePlanCard.programId,
              sessionId,
              exerciseId,
              { kind: 'remove' },
            );
          }
        }}
        onKeepSwapInProgram={(exerciseId, exerciseName) => {
          const sessionId = homeActivePlanCard?.nextSession?.id;
          if (homeActivePlanCard && sessionId) {
            void handleEditProgramExercise(
              homeActivePlanCard.programType,
              homeActivePlanCard.programId,
              sessionId,
              exerciseId,
              { kind: 'replace', exerciseName },
            );
          }
        }}
        tailoringPreferences={preferences}
        exerciseLibrary={exerciseBrowserItems}
        // Paused counts: it is still a session the button resumes.
        hasActiveSession={workout.activeSession !== null && workout.activeSession.status !== 'completed'}
        onPickTodaySession={(sessionId) => void handlePickTodaySession(sessionId)}
        // Ready programmes are immutable at runtime, so the pencil is simply
        // not offered for them rather than offered and inert.
        onRenameSession={
          homeActivePlanCard?.programType === 'custom'
            ? (sessionId, name) => void handleRenameProgramSession(homeActivePlanCard.programId, sessionId, name)
            : undefined
        }
        onStartActivePlanSession={(sessionId) => {
          if (!homeActivePlanCard) {
            return;
          }

          if (homeActivePlanCard.programType === 'custom') {
            handleStartCustomProgramSession(homeActivePlanCard.programId, sessionId);
            return;
          }

          handleStartReadyProgramSession(homeActivePlanCard.programId, sessionId);
        }}
        // Through the cardio guard like every other start: the empty workout
        // began over a run still on the clock, and left two sessions live.
        onCreateWorkoutFromExercises={() =>
          guardStrengthStartOverCardio(() => navigate({ tab: 'workout', screen: 'empty' }))
        }
        // No programme to start: the hero button goes to the catalog instead of
        // offering an empty session the "empty workout" row already offers.
        //
        // `navigate`, not `navigateToTab`: the bar resets history because a tab
        // is where you START, but this is a button inside a screen, and it left
        // the reader on Programs with nothing behind them — the next Back
        // closed the app.
        onFindProgram={() => navigate(resolveTabRoute('workout'))}
        onOpenCardio={() => navigate({ tab: 'home', screen: 'cardio' })}
        activeCardioActivity={workout.activeCardio?.activityType ?? null}
        onOpenPremium={() => navigate({ tab: 'profile', screen: 'premium' })}
        plateau={
          proPlateau
            ? {
                headline: proPlateau.detection.headline,
                meta: proPlateau.detection.meta,
                locked: proPlateau.conclusion,
                moment: proPlateau.moment,
                episodeKey: proPlateau.episodeKey,
              }
            : null
        }
        // Guarded like dismissedTipIds (handleDismissTip) and
        // dismissedCompletionPlanIds (dismissCompletionCard): a double tap
        // before the write lands must not append the same episode twice
        // (break round 2026-09-29).
        onDismissPlateau={(episodeKey) =>
          void updatePreferences((current) =>
            current.dismissedPlateauEpisodes.includes(episodeKey)
              ? current
              : { dismissedPlateauEpisodes: [...current.dismissedPlateauEpisodes, episodeKey] },
          )
        }
        proUnlocked={coachProUnlocked}
        onSetTrainingDays={() =>
          navigate({ tab: 'profile', screen: 'training_plan', editSchedule: true })
        }
        onOpenActivePlan={() => {
          if (!homeActivePlanCard) {
            return;
          }
          navigate({
            tab: 'workout',
            screen: 'program',
            programType: homeActivePlanCard.programType ?? 'ready',
            workoutTemplateId: homeActivePlanCard.programId,
          });
        }}
        // A session row opens its own day, not the whole plan — the plan is
        // one tap away behind the section title (user 2026-08-23).
        onOpenPlanSession={(sessionId) => {
          if (!homeActivePlanCard) {
            return;
          }
          navigate({
            tab: 'workout',
            screen: 'programDay',
            programType: homeActivePlanCard.programType ?? 'ready',
            workoutTemplateId: homeActivePlanCard.programId,
            sessionId,
          });
        }}
      />
    );
  }

  const showTabBar =
    !onboardingActive &&
    // The hand-off is the last step of onboarding wearing the app's clothes. A
    // tab bar under it offers four ways out of a step that has one button.
    !setupHandoffActive &&
    !(
      route.tab === 'workout' &&
      (route.screen === 'detail' ||
        route.screen === 'empty' ||
        route.screen === 'guided' ||
        route.screen === 'summary')
    ) &&
    !(route.tab === 'home' && route.screen === 'cardio') &&
    // The setup editor is a full-screen flow — the floating bar was covering
    // its footer Cancel/Back controls.
    !(route.tab === 'profile' && route.screen === 'setup') &&
    // The unlock moment is a full-screen takeover; a floating bar over it
    // would say 'you are still in the app' at the one moment that should not.
    !(route.tab === 'profile' && route.screen === 'premium_unlock') &&
    // The Pro page ends in its own pinned CTA. The floating bar sat on top of
    // it, so the page had to reserve a bar's worth of dead space under the
    // button — on a paywall, the most expensive space on the screen. The
    // membership screen has the same pinned footer, and there the bar covered
    // the second button outright.
    // Any new screen that pins a CTA to the bottom belongs on this list. The
    // post-onboarding offer was the third entry until the screen was deleted
    // (2026-08-25) — its bar covered the primary button outright.
    !(route.tab === 'profile' && (route.screen === 'premium' || route.screen === 'membership_end'));
  const setupOnboardingActive = route.tab === 'profile' && route.screen === 'setup';
  const onboardingScreenActive = onboardingActive || setupOnboardingActive;
  const welcomeActive = onboardingActive && entryFlowActive;
  const emptyWorkoutActive = route.tab === 'workout' && route.screen === 'empty';
  const readyTemplatesActive = route.tab === 'workout' && route.screen === 'plans';
  const programDetailActive = route.tab === 'workout' && route.screen === 'program';
  const workoutLogActive = route.tab === 'workout' && route.screen === 'guided';
  // Workout Complete opens on a full-bleed purple hero — the status bar joins it
  // rather than sitting above it as a dark strip.
  const workoutSummaryActive = route.tab === 'workout' && route.screen === 'summary';
  const exerciseDetailActive = route.tab === 'workout' && route.screen === 'detail';
  const exercisesListActive = route.tab === 'workout' && route.screen === 'list';
  const programsHomeActive = route.tab === 'workout' && route.screen === 'programs_home';
  const profileListActive = route.tab === 'profile' && route.screen === 'list';
  const profileSettingsActive =
    route.tab === 'profile' &&
    (route.screen === 'settings' ||
      route.screen === 'my_data' ||
      route.screen === 'export_plan' ||
      route.screen === 'edit_profile' ||
      route.screen === 'training_plan' ||
      route.screen === 'notifications' ||
      route.screen === 'training_break' ||
      route.screen === 'subscription' ||
      route.screen === 'legal');
  /**
   * The Pro page commits to one dark treatment in BOTH themes (theme.ts,
   * PRO_TIER): the tier's colour is the only thing telling Free from Pro from
   * Lifetime, and repainting it per reader would make that signal mean
   * something different for each of them.
   *
   * The shell has to be told, or only the page obeys. v4 painted itself
   * theme.bg and matched by accident; v6 paints itself black, and under the
   * light theme the safe-area bands above and below it stayed light — two
   * pale strips framing a black page.
   */
  const premiumActive = route.tab === 'profile' && route.screen === 'premium';
  const historyActive = route.tab === 'home' && (route.screen === 'history' || route.screen === 'session' || route.screen === 'cardio');
  // The saved-session view opens on the same purple hero as Workout Complete,
  // so the status bar joins it instead of sitting above it as a light strip.
  const historySessionActive = route.tab === 'home' && route.screen === 'session';
  const progressActive = route.tab === 'progress';

  // The brand animation, once per cold start. It sits outside AppShell's
  // status-bar plumbing on purpose: it is a full-bleed field, and it must not
  // be the reason a slow start looks slower, so it only plays once everything
  // it would otherwise be covering is already there.
  if (!brandSplashDone) {
    return (
      <AppShell safeAreaEdges={['left', 'right']}>
        <VinhaSplashScreen
          language={preferences.appLanguage}
          onDone={() => setBrandSplashDone(true)}
        />
      </AppShell>
    );
  }

  const shellSafeAreaEdges: Array<'top' | 'left' | 'right' | 'bottom'> =
    // A saved workout drops the TOP edge so its gradient runs under the
    // status bar — and used to drop the bottom one with it, which put the
    // floating tab bar on top of the phone's own navigation buttons.
    historySessionActive
      ? ['left', 'right', 'bottom']
      : welcomeActive || workoutSummaryActive || fullBleedReview !== null
        ? ['left', 'right']
        : onboardingScreenActive
          ? // Every onboarding screen pads for the status bar itself — the
            // path fork, About you, the ready catalog, the questionnaire
            // and its back chevron all read insets.top. With the shell
            // padding the top edge too, each of them sat one status bar
            // too low, and the questionnaire's chevron (insets.top + 10
            // inside a root already below the bar) landed on "STEP 2 OF
            // 6" ("step teksti menee back napin taakse", user
            // 2026-09-02). Same edges as Welcome, for the same reason.
            //
            // onboardingScreenActive, not onboardingActive: the same
            // questionnaire is the plan editor under Profile, and it
            // reads the inset there too (PR review).
            ['left', 'right']
          : ['top', 'left', 'right', 'bottom'];

  return (
    <AppShell
      toastMessage={toastMessage}
      safeAreaEdges={shellSafeAreaEdges}
      // Only the gradient-hero screens want light icons; everything else takes
      // the shell's light default.
      // The Pro page is black in both themes, so the bands the shell paints
      // around it have to be too — see premiumActive.
      shellBackgroundColor={premiumActive ? '#000000' : undefined}
      statusBarStyleOverride={
        // The workout summary is off this list since its hero turned gold: a
        // pale gold bar needs dark icons, and the shell already derives that
        // from the theme.
        fullBleedReview
          ? fullBleedReview
          : historySessionActive || premiumActive
            ? 'light'
            : undefined
      }
      statusBarBackgroundColor={
        // The saved workout's hero scrolls, and under a transparent bar its
        // date ended up printed across the phone's clock. Painted with the
        // hero's own top colour it is invisible at rest and a clean cap once
        // the screen moves.
        historySessionActive
          ? '#8B5CF6'
          : premiumActive
            ? '#000000'
            : workoutSummaryActive || welcomeActive || fullBleedReview !== null
              ? 'transparent'
              : undefined
      }
      statusBarTranslucent={
        welcomeActive || workoutSummaryActive || historySessionActive || fullBleedReview !== null
      }
      tabBar={
        showTabBar ? (
          <BottomTabBar
            language={preferences.appLanguage}
            activeTab={route.tab === 'workout' && route.screen === 'plans' ? null : route.tab}
            aiActive={
              route.tab === 'home' &&
              route.screen === 'ai_chat'
            }
            onTabPress={navigateToTab}
            // The design's rule for the middle button: it opens the chat, for
            // everyone, always. It used to open a paywall-shaped sheet — the
            // app's most valuable placement spent on an advert.
            onAiPress={() => navigate({ tab: 'home', screen: 'ai_chat' })}
            sweep={tourSweep}
            tourTargets={tourRegistry}
          />
        ) : undefined
      }
      overlay={
        legalConsentDue ? renderLegalConsent(shellSafeAreaEdges.includes('bottom')) : tourElement
      }
    >
      {content}
      <AppUpdateDialog language={preferences.appLanguage} held={appUpdateHeld} />
      <ServerNoticeDialog
        language={preferences.appLanguage}
        held={appUpdateHeld}
        seenIds={preferences.seenServerNoticeIds}
        onSeen={handleServerNoticeSeen}
      />
      <SettingsImportSheet
        visible={settingsImportVisible}
        initialView="csv"
        language={preferences.appLanguage}
        exerciseLibrary={exerciseBrowserItems}
        nameBook={exerciseNameBook}
        onPickImage={handlePickProgramImage}
        // The photo link on the paste box is Pro only (2026-09-29), so this
        // sheet passes the lock too; the AI-assisted row it also gates is
        // never drawn from here.
        proUnlocked={resolveProEntitlement(preferences).unlocked}
        onOpenPaywall={() => navigate({ tab: 'profile', screen: 'premium' })}
        onTeachName={(wrote, exercise) =>
          teachExerciseName(wrote, { name: exercise.name, libraryItemId: exercise.id })
        }
        onClose={() => setSettingsImportVisible(false)}
        // Settings' CSV sheet opens straight on the paste box, so this row is
        // never drawn from here. The lock itself was decided on 2026-09-01, reversing the
        // earlier "the chat, for everyone" call: the gate had moved onto the
        // act of composing, and the row went to the chat for anyone.
        onAiAssisted={() =>
          navigate({ tab: 'home', screen: 'ai_chat' })
        }
        onBuildYourself={() => navigate({ tab: 'workout', screen: 'template' })}
        onImportProgram={async (draft) => {
          const workoutTemplateId = await createUnlessAtLimit(
            () => upsertWorkoutTemplate(draft),
            () => setProgramLimitVisible(true),
          );
          if (!workoutTemplateId) {
            // Refused at the cap: the sheet stays open with the table it read,
            // so this one does not hide it either.
            return false;
          }
          setSettingsImportVisible(false);
          navigate({ tab: 'workout', screen: 'program', programType: 'custom', workoutTemplateId });
          return true;
        }}
        onImportHistory={async (preview) => {
          // Thrown on when the write fails: the sheet keeps the pasted export
          // for a retry and says why itself. A toast from here would draw
          // behind its modal.
          let result;
          try {
            result = await importWorkoutHistory(preview.workouts);
          } catch (error) {
            console.error('Failed to import workout history', error);
            throw error;
          }
          setSettingsImportVisible(false);
          showToast(
            t(
              preferences.appLanguage,
              result.duplicates > 0 ? 'hevy.doneWithDuplicates' : 'hevy.done',
              { imported: String(result.imported), duplicates: String(result.duplicates) },
            ),
          );
        }}
      />
      <ProgramLimitSheet
        visible={programLimitVisible}
        kind="own"
        used={programSlots.used}
        limit={programSlots.limit ?? programSlots.used}
        language={preferences.appLanguage}
        onClose={() => setProgramLimitVisible(false)}
        onSeePro={() => {
          setProgramLimitVisible(false);
          navigate({ tab: 'profile', screen: 'premium' });
        }}
      />
      <ProgramLimitSheet
        visible={runningCapSheet.visible}
        kind="running"
        used={runningCapSheet.used}
        limit={runningCapSheet.cap}
        language={preferences.appLanguage}
        onClose={() => setRunningCapSheet((current) => ({ ...current, visible: false }))}
        onSeePro={() => {
          setRunningCapSheet((current) => ({ ...current, visible: false }));
          navigate({ tab: 'profile', screen: 'premium', reason: 'program_cap' });
        }}
      />
      <ThemeChoiceDialog
        visible={themeChoiceVisible}
        language={preferences.appLanguage}
        darkEnabled={preferences.darkThemeEnabled}
        // Written straight to preferences, so the dialog repaints itself along
        // with everything behind it. That IS the preview.
        onChange={(dark) => void updatePreferences({ darkThemeEnabled: dark })}
        // Closes onto the path screen, which onboarding is already showing
        // behind it. No navigation: the dialog interrupts the flow, it does
        // not move it.
        onDone={() => setThemeChoiceVisible(false)}
      />
      {/* Built months ago and left unwired — the strings even said so. The
          sheet takes the star it was given and ignores it on purpose: every
          star opens the same listing, because routing the low ones somewhere
          private is review gating and against Play policy. */}
      <RateAppSheet
        visible={ratingSheetVisible}
        language={preferences.appLanguage}
        onRate={() => {
          setRatingSheetVisible(false);
          // Every star arrives here. Marked rated on the way out rather than
          // on the way back: the app never learns whether a review was
          // actually left, and asking again someone who went to the listing
          // is worse than missing one who changed their mind.
          void updatePreferences((current) => ({ ratingPrompt: recordRatingCompleted(current.ratingPrompt) }));
          void Linking.openURL(PLAY_LISTING_URL);
        }}
        onDismiss={() => setRatingSheetVisible(false)}
      />
    </AppShell>
  );
}

/**
 * Which build this is, on every request to our server (lib/appUpdateGate).
 * Read from the app config the native build was made from, so it is the
 * version the store shows; the theme's copy is only the fallback for a run
 * that has no config to read.
 */
registerAppIdentity(Constants.expoConfig?.version ?? appInfo.version, Platform.OS);

/**
 * ThemeProvider sits *inside* AppProvider because the theme is a stored,
 * Pro-gated preference — it cannot be resolved before the database has
 * hydrated. AppProvider renders nothing of its own, so nothing is unthemed
 * while that happens.
 */
function ThemedRoot() {
  const { preferences } = useAppContext();
  const theme = useMemo(
    () => themeForName(resolveThemeName(preferences)),
    // The entitlement can lapse mid-session; recomputing on any preference
    // change is cheap and keeps the theme honest without a timer.
    [preferences],
  );

  return (
    <ThemeProvider theme={theme}>
      <WorkoutProvider>
        <VinhaApp />
      </WorkoutProvider>
    </ThemeProvider>
  );
}

export default function App() {
  return (
    <AppProvider>
      <ThemedRoot />
    </AppProvider>
  );
}











































/** Stored weekday codes → the display keys the rest of the app uses. */
/**
 * The legal document, laid over the hand-off rather than swapped in for it.
 *
 * Its own background is opaque, so nothing of the screen underneath shows
 * through; what survives is that screen's state, which is the whole point.
 */
const LEGAL_OVER_HANDOFF = { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 } as const;
/** Above the consent sheet's zIndex/elevation (40). */
const LEGAL_OVER_CONSENT = { ...LEGAL_OVER_HANDOFF, zIndex: 50, elevation: 50 } as const;

const WEEKDAY_LABEL_KEYS: Record<string, I18nKey> = {
  MON: 'setup.day.mon',
  TUE: 'setup.day.tue',
  WED: 'setup.day.wed',
  THU: 'setup.day.thu',
  FRI: 'setup.day.fri',
  SAT: 'setup.day.sat',
  SUN: 'setup.day.sun',
};


