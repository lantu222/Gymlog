import './src/globalFont';

import React, { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import Constants from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Font from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';

import { AppShell } from './src/components/AppShell';
import { formatDurationMinutes, formatRepRange, formatShortDate, formatTime, formatVolume, formatWeight, pluralize, removeTrailingZeros } from './src/lib/format';
import { HistoryScrollMemory } from './src/lib/historyScrollMemory';
import {
  buildFirstRunRecommendationReasons,
  FirstRunSetupSelection,
  isSetupDaysPerWeek,
} from './src/lib/firstRunSetup';
import { formatWorkoutDisplayLabel } from './src/lib/displayLabel';
import { buildCardioStatsLine, getCardioActivity } from './src/lib/cardio';
import { haptics } from './src/utils/haptics';
import { useScheduledNotifications } from './src/hooks/useScheduledNotifications';
import { usePendingAiLogDeletions } from './src/hooks/usePendingAiLogDeletions';
import { ThemeProvider, themeForName, useTheme } from './src/theming';
import {
  isHomeWidgetAdded,
  isHomeWidgetSupported,
  refreshHomeWidget,
  requestPinHomeWidget,
} from './modules/home-widget';
import { createTourTargetRegistry } from './src/features/tour/tourTargets';
import {
  TourBarStop,
  TourTargetId,
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
  removeActiveProgram,
  resolveActiveProgramCap,
} from './src/lib/activeProgramSet';
import {
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
import {
  getCanonicalCompletedSessions,
} from './src/lib/completedSessions';
import { useRecordsAndMilestones } from './src/app/useRecordsAndMilestones';
import { markCoachDemoMomentUsed } from './src/lib/coachDemoMoments';
import { buildHomeQuickStats, buildHomeUpcomingSessions } from './src/lib/homeVisuals';
import { I18nKey, t } from './src/lib/i18n';
import { isProUnlocked, resolveProEntitlement, resolveProgressionOptions } from './src/lib/proEntitlement';
import { resolveThemeName } from './src/lib/themePreference';
import { localizeSessionName } from './src/lib/sessionNameLabel';
import { trackEvent } from './src/features/analytics/analyticsClient';
import { joinedRunningSet } from './src/lib/analyticsMoments';

import { resolveWorkoutLoggerFallbackRoute } from './src/lib/workoutLoggerNavigation';
import { CoachChatMemory } from './src/lib/coachChatMemory';
import { CoachAdviceMemoryEntry } from './src/lib/coachAdviceMemory';
import { clearCoachAdviceMemory } from './src/storage/coachAdviceMemoryStore';
import type { ChatMessage } from './src/screens/AICoachChatScreen';
import {
  toDraftExercise,
} from './src/lib/programSessionEdit';
import { ProgramLimitReachedError } from './src/lib/programSlots';
import { useProgramExerciseEdit } from './src/app/useProgramExerciseEdit';
import { getSeasonProgramId } from './src/lib/programSeasons';
import { getSeasonProgramIds } from './src/lib/programSeasons';
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
import { resolveNextPlanEntryIndex } from './src/lib/planRotation';
import { alignHistoryToCopiedDays, programmeHistoryIds } from './src/lib/programLineage';
import {
  isLightenPending,
  lightenedFatigueSignal,
  lightenRuntimeTemplate,
} from './src/lib/recoverySheet';
import { useRecoverySheet } from './src/app/useRecoverySheet';
import {
  WEEKDAY_KEYS,
} from './src/lib/programTrainingDays';
import {
  planLabelsForProgramme,
  planLabelsFromWeekdays,
  rotateLabelsForNextSession,
  weekdaysFromPlanLabels,
} from './src/lib/trainingWeekSync';
import { findReadyProgrammeCopyId } from './src/lib/programmeCopyLink';
import { useGoalFlow } from './src/app/useGoalFlow';
import {
  isEnrolled,
} from './src/lib/seasonEnrolment';

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
} from './src/lib/sessionAdaptation';
import { forgetRoutesForTemplate, popRoute, pushRoute, withoutTrailingRoute } from './src/navigation/routeHistory';
import { liveSessionBlocksProgrammeDelete } from './src/lib/programmeDeletion';
import { AppRoute, ROOT_ROUTES, RootTabKey, WORKOUT_PLAN_ROUTE } from './src/navigation/routes';
import { renderProfileTab } from './src/app/renderProfileTab';
import { renderHomeScreens } from './src/app/renderHomeScreens';
import { renderAppShell } from './src/app/renderAppShell';
import { renderHomeDashboard } from './src/app/renderHomeDashboard';
import { renderOnboardingFlow, renderSetupEditor, renderSetupHandoff } from './src/app/renderOnboarding';
import { renderWorkoutCompletion } from './src/app/renderWorkoutCompletion';
import { renderWorkoutTab } from './src/app/renderWorkoutTab';
import { renderProgressTab } from './src/app/renderProgressTab';
import { formatGoalLabel } from './src/app/homeSessionTitle';
import { useSessionNotifications } from './src/app/useSessionNotifications';
import { useNotificationRoute } from './src/app/useNotificationRoute';
import { useCoachContext } from './src/app/useCoachContext';
import { createProgrammeDayEdits } from './src/app/programmeDayEdits';
import {
  buildSavedOnboardingPlan,
  buildSavedOnboardingWorkoutPlan,
  buildSetupPreferencePatch,
} from './src/app/onboardingHandoff';
import { useDeviceSwitches } from './src/app/useDeviceSwitches';
import { useFunnelAnalytics } from './src/app/useFunnelAnalytics';
import { useInstallStamps } from './src/app/useInstallStamps';
import { useSetupWeightSeed } from './src/app/useSetupWeightSeed';
import { useTodayKey } from './src/app/useTodayKey';
import { useFinishState } from './src/app/useFinishState';
import { useFinishRefs } from './src/app/useFinishRefs';
import { createFinishExits } from './src/app/finishExits';
import { useFinishRouteGuard } from './src/app/useFinishRouteGuard';
import { createFinishSaves } from './src/app/finishSaves';
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
import { useHandoffLegalHolders } from './src/app/useHandoffLegalHolders';
import { useRouteBack } from './src/app/useRouteBack';
import { useHomeWidgetPinState } from './src/app/useHomeWidgetPinState';
import { useSetupHandoffOverlays } from './src/app/useSetupHandoffOverlays';
import { createSetupHandoffDone } from './src/app/setupHandoffDone';
import { useHomeWidgetFeed } from './src/app/useHomeWidgetFeed';
import { useWidgetTaps } from './src/app/useWidgetTaps';
import { AboutYouValues } from './src/screens/AboutYouScreen';
import { useHomeActivePlan } from './src/app/useHomeActivePlan';
import { useHomeTrainingSchedule } from './src/app/useHomeTrainingSchedule';
import { usePlanReadouts } from './src/app/usePlanReadouts';
import { useRecentSessions } from './src/app/useRecentSessions';
import { useProgramsCatalog } from './src/app/useProgramsCatalog';
import { useSeasonEnrolment } from './src/app/useSeasonEnrolment';
import { useProgramsCustomItems } from './src/app/useProgramsCustomItems';
import { LaunchScreen } from './src/screens/LaunchScreen';
import { setNumberLanguage } from './src/lib/format';
import { programTableToCsv } from './src/lib/programImageImport';
import { pickProgramImage, type ProgramImageImportResult } from './src/utils/programImagePicker';
import { VinhaSplashScreen } from './src/screens/VinhaSplashScreen';
import { NewProgramSheet } from './src/components/NewProgramSheet';
import { buildCoachContextChips } from './src/lib/coachChat';
import { isAiCoachLiveConfigured, requestProgramTableFromImage } from './src/lib/aiCoachClient';
import { accountNameStep } from './src/lib/accountNameAdoption';
import { WorkoutProvider, useWorkoutContext } from './src/features/workout/WorkoutProvider';
import { AdaptedCompletedWorkoutExercise } from './src/features/workout/workoutAppAdapter';
import { getWorkoutTemplateById } from './src/features/workout/workoutCatalog';
import { AppProvider, useAppContext } from './src/state/AppProvider';
import { registerAppIdentity } from './src/features/appUpdate/appUpdateSignal';
import { appInfo } from './src/theme';
import {
  AppLanguage,
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
  const {
    completionSummary,
    setCompletionSummary,
    ratingSheetVisible,
    setRatingSheetVisible,
    finishSaveState,
    setFinishSaveState,
  } = useFinishState();
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
  const { summaryExitRouteRef, summaryNavigationPendingRef, finishInFlightRef, completionCountedRef } = useFinishRefs();
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

  const { leaveFinishedWorkout } = createFinishExits({
    preferences,
    database,
    updatePreferences,
    setCompletionSummary,
    setFinishSaveState,
    setNavigationState,
    setRatingSheetVisible,
  });

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

  useFinishRouteGuard({
    finishSaveState,
    setFinishSaveState,
    completionSummary,
    workout,
    route,
    replaceRoute,
    workoutHomeRoute,
    workoutLogNavigationAllowedAtRef,
    summaryNavigationPendingRef,
    summaryExitRouteRef,
    workoutTemplates,
    exerciseLibrary,
    exerciseBrowserItems,
    trackedProgress,
    workoutSessions,
  });

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
  const {
    handoffLegalDocument,
    setHandoffLegalDocument,
    legalConsentDueRef,
    legalSheetHeld,
    setLegalSheetHeld,
    handoffLegalOpenRef,
    setupHandoffActiveRef,
  } = useHandoffLegalHolders();
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

  useRouteBack({
    cardioRunActive,
    route,
    navigationState,
    onboardingActive,
    workoutHomeRoute,
    handoffLegalDocument,
    setHandoffLegalDocument,
    handoffLegalOpenRef,
    setupHandoffActiveRef,
    legalConsentDueRef,
    resetToRoute,
    navigateBack,
    setCompletionSummary,
    setFinishSaveState,
    workoutRef,
    summaryExitRouteRef,
  });

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
  const {
    homeActivePlanCard,
    homeEmptyProgramme,
    homeSessionAdaptation,
    adaptHomeSession,
    progressWeeklyTarget,
  } = useHomeActivePlan({
    database,
    preferences,
    workoutTemplates,
    exerciseLibrary,
    getWorkoutTemplateSessions,
    todayStartMs,
    setupSelection,
    recommendedReadyTemplate,
    recommendedReadyContent,
    customWorkoutRuntimeMap,
    routineBlockSeconds,
    completedSessionsForTemplate,
    templatesRunByOtherPlans,
    sessionAdaptationFor,
    adaptSession,
  });
  const { homeStatCatalogCards, homePinnedStatCardKeys, homeSuggestedStatCardKeys } = useHomeStatCards({
    database,
    trackedProgress,
    preferences,
  });
  // Same equipment truth the composer filters exercises with, for the default
  // warmup/cooldown drills: null = setup never said, [] = no equipment at all.
  const {
    homeTrainingDayIndexes,
    homeDoneThisWeekSessionIds,
    baseTrainingSchedule,
    homeTrainingSchedule,
  } = useHomeTrainingSchedule({
    database,
    preferences,
    homeActivePlanCard,
    workoutTemplates,
    todayStartMs,
    completedSessionsForTemplate,
    templatesRunByOtherPlans,
  });

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

  const { handleAddHomeWidget } = useHomeWidgetPinState({
    appHydrated,
    setHomeWidgetState,
    updatePreferences,
    isHomeWidgetSupported,
    isHomeWidgetAdded,
    requestPinHomeWidget,
  });

  // Feeds the home-screen widget. The launcher redraws it on its own schedule,
  // so all this has to do is keep the file current. Placed after the plan card
  // and the picked days, because it is built from exactly what Home renders.
  //
  // The calendar reaches back two weeks, so the widget needs the days that were
  // trained — not just this week's weekdays. 21 days covers two past weeks plus
  // every day of the current one, whichever weekday today is.
  const {
    setupHandoffHeldRef,
    setSetupHandoffHeld,
    setupHandoffPlan,
    setupHandoffActive,
    legalConsentDue,
    homeTourActive,
    homePrompt,
    tourElement,
    handleServerNoticeSeen,
    appUpdateHeld,
    renderLegalConsent,
  } = useSetupHandoffOverlays({
    preferences,
    updatePreferences,
    appHydrated,
    brandSplashDone,
    onboardingActive,
    route,
    homeWidgetState,
    homePinnedStatCardKeys,
    homeSuggestedStatCardKeys,
    accountBackup,
    database,
    homeActivePlanCard,
    workout,
    tourRegistry,
    setTourSweep,
    setTourFocus,
    setupHandoffActiveRef,
    legalConsentDueRef,
    legalSheetHeld,
    setLegalSheetHeld,
    handoffLegalDocument,
    setHandoffLegalDocument,
    LEGAL_OVER_CONSENT,
  });

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

  const { handleSetupHandoffDone } = createSetupHandoffDone({
    setupHandoffPlan,
    homePinnedStatCardKeys,
    setupHandoffHeldRef,
    setSetupHandoffHeld,
    updatePreferences,
    showToast,
    preferences,
    requestPinHomeWidget,
    handleAccountSignIn,
    navigate,
  });

  const { widgetCompletedWorkoutDayStarts } = useHomeWidgetFeed({
    appHydrated,
    preferences,
    database,
    todayStartMs,
    recommendedReadyTemplate,
    homeActivePlanCard,
    homeTrainingSchedule,
    lifetimeSummary,
    refreshHomeWidget,
  });

  useWidgetTaps({
    appHydrated,
    workout,
    homeActivePlanCard,
    homeTrainingSchedule,
    recommendedReadyTemplate,
    widgetCompletedWorkoutDayStarts,
    resetToRoute,
    navigateToActiveWorkout,
  });

  useNotificationRoute({ appHydrated, resetToRoute });

  const {
    exportablePlans,
    sessionAnalysis,
    profilePlanSummary,
    guidedEntryEyebrow,
    guidedWeekProgress,
    completionWeekProgress,
    guidedNextUp,
  } = usePlanReadouts({
    workoutTemplates,
    getWorkoutTemplateSessions,
    homeActivePlanCard,
    analysisSessionId,
    workoutSessions,
    database,
    preferences,
    todayStartMs,
    progressWeeklyTarget,
    workout,
    WEEKDAY_LABEL_KEYS,
  });
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
  const { completedWorkoutSessions, homeRecentSessions } = useRecentSessions({
    database,
    workoutSessions,
    getSessionLogs,
    preferences,
    unitPreference,
  });
  const {
    dismissedTipIds,
    programsCatalogItems,
    programsCategoryCounts,
    catalogScreenItems,
    programsCategoryMembers,
    programsRecommendations,
  } = useProgramsCatalog({
    preferences,
    workout,
    setupRecommendation,
    homeActivePlanCard,
    recommendedReadyTemplate,
    activeProgramTemplateIds,
    database,
  });
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
  const { handleEnrolSeason } = useSeasonEnrolment({ preferences, updatePreferences });

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
  const { programsCustomItems } = useProgramsCustomItems({
    customWorkouts,
    database,
    preferences,
    runningProgrammeTitle,
  });

  const templateBuilderDraft = useTemplateBuilderDraft({
    route,
    preferences,
    workoutTemplates,
    getWorkoutTemplateSessions,
  });

  if (!nativeSplashHidden || !hydrated || !workout.hydrated) {
    return <LaunchScreen />;
  }

  const { handleDiscardWorkout, handleConfirmFinishWorkout, finishLoggedWorkoutSave } = createFinishSaves({
    workout,
    database,
    preferences,
    unitPreference,
    exerciseLibrary,
    updatePreferences,
    saveCompletedWorkoutSession,
    upsertWorkoutTemplate,
    deleteWorkoutTemplate,
    exercisePrLookup,
    setCompletionSummary,
    setFinishSaveState,
    finishInFlightRef,
    completionCountedRef,
    summaryNavigationPendingRef,
    summaryExitRouteRef,
    getWorkoutLoggerFallbackRoute,
    navigateBack,
    replaceRoute,
    showToast,
  });

  let content: React.ReactNode = null;

  if (onboardingActive) {
    content = renderOnboardingFlow({
      entryFlowActive,
      onboardingStep,
      setOnboardingStep,
      preferences,
      updatePreferences,
      handleContinueEntry,
      completeOnboarding,
      navigate,
      showToast,
      handleBackToEntry,
      aboutYouValues,
      setAboutYouValues,
      busySavingReadyPick,
      handleOnboardingPickReadyProgram,
      unitPreference,
      tailoringPreferences,
      workout,
      dismissedTipIds,
      handleDismissTip,
      handleOnboardingCompleteToTraining,
      setFullBleedReview,
    });
  } else if (setupHandoffActive && setupHandoffPlan) {
    // Between the last question and the app. The route behind this is already
    // the one onboarding chose, so finishing here just uncovers it.
    content = renderSetupHandoff({
      preferences,
      setupHandoffPlan,
      handleSetupHandoffDone,
      setHandoffLegalDocument,
      handoffLegalDocument,
      LEGAL_OVER_HANDOFF,
    });
  } else if (route.tab === 'profile' && route.screen === 'setup') {
    content = renderSetupEditor({
      route,
      preferences,
      setupEditSelection,
      setupBasics,
      setupSelection,
      unitPreference,
      tailoringPreferences,
      workout,
      dismissedTipIds,
      handleDismissTip,
      navigateBack,
      handleSetupCompleteToTraining,
      handleSaveSetupLimitations,
    });
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
    content = renderWorkoutCompletion({
      preferences,
      completionWeekProgress,
      guidedNextUp,
      completionSummary,
      coachProUnlocked,
      proCompletionMoment,
      navigate,
      coachDemoQuestion,
      coachDemoMoment,
      updateCompletedWorkoutSession,
      workout,
      leaveFinishedWorkout,
    });
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
    content = renderHomeDashboard({
      preferences,
      updatePreferences,
      tourRegistry,
      tourFocus,
      navigate,
      resolveTabRoute,
      homeActivePlanCard,
      homeEmptyProgramme,
      handleCompletionStartNext,
      handleCompletionRestart,
      dismissCompletionCard,
      homeOtherPrograms,
      programCapLine,
      database,
      handleOpenProgramDetail,
      handleRemoveActiveProgram,
      availableEquipmentForDrills,
      homeTourActive,
      homeWidgetState,
      handleAddHomeWidget,
      homePrompt,
      handleAccountSignIn,
      homeTrainingSchedule,
      homeDoneThisWeekSessionIds,
      homeStatCatalogCards,
      homeSuggestedStatCardKeys,
      homePinnedStatCardKeys,
      homeSessionAdaptation,
      adaptHomeSession,
      handleEditProgramExercise,
      exerciseBrowserItems,
      workout,
      handlePickTodaySession,
      handleRenameProgramSession,
      handleStartCustomProgramSession,
      handleStartReadyProgramSession,
      guardStrengthStartOverCardio,
      proPlateau,
      coachProUnlocked,
    });
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

  return renderAppShell({
    content,
    route,
    historySessionActive,
    welcomeActive,
    workoutSummaryActive,
    onboardingScreenActive,
    premiumActive,
    showTabBar,
    fullBleedReview,
    toastMessage,
    preferences,
    updatePreferences,
    navigate,
    navigateToTab,
    tourSweep,
    tourRegistry,
    legalConsentDue,
    renderLegalConsent,
    tourElement,
    appUpdateHeld,
    handleServerNoticeSeen,
    SettingsImportSheet,
    settingsImportVisible,
    setSettingsImportVisible,
    exerciseBrowserItems,
    exerciseNameBook,
    handlePickProgramImage,
    teachExerciseName,
    upsertWorkoutTemplate,
    importWorkoutHistory,
    showToast,
    programLimitVisible,
    setProgramLimitVisible,
    programSlots,
    runningCapSheet,
    setRunningCapSheet,
    themeChoiceVisible,
    setThemeChoiceVisible,
    ratingSheetVisible,
    setRatingSheetVisible,
    PLAY_LISTING_URL,
  });
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


