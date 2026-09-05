import './src/globalFont';

import React, { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, BackHandler, Linking, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import { emitRestAction } from './src/hooks/useRestEndAlert';
import { IDLE_NUDGE_MINUTES, idleNudgeAtMs } from './src/lib/restSchedule';
import {
  ACTION_EXTEND_30,
  ACTION_EXTEND_60,
  ACTION_FINISH,
  ACTION_SKIP_REST,
  ACTION_STILL_GOING,
  SESSION_NOTIFICATION_MARKER,
  cancelIdleNudge,
  clearAllSessionNotifications,
  scheduleIdleNudge,
} from './src/utils/sessionNotifications';
import * as Font from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';

import { AppShell } from './src/components/AppShell';
import { BottomTabBar } from './src/components/BottomTabBar';
import { getHomeSummary, getMonthTrainingTotals } from './src/lib/dashboard';
import { formatDurationMinutes, formatRepRange, formatSetScheme, formatShortDate, formatTime, formatVolume, formatWeight, pluralize, removeTrailingZeros } from './src/lib/format';
import { createId } from './src/lib/ids';
import {
  buildFirstRunRecommendationReasons,
  buildFirstRunPromptSuggestions,
  DEFAULT_RHYTHM_BY_DAYS,
  DEFAULT_FIRST_RUN_SELECTION,
  FirstRunSetupSelection,
  getFocusAreaTitle,
  isSetupDaysPerWeek,
  resolveFirstRunRecommendationWithTailoring,
} from './src/lib/firstRunSetup';
import { getExerciseTemplateDefaults, getRecentExerciseLibraryItems } from './src/lib/exerciseSuggestions';
import { formatWorkoutDisplayLabel } from './src/lib/displayLabel';
import { buildCardioStatsLine, getCardioActivity } from './src/lib/cardio';
import { setSoundCuesEnabled } from './src/utils/sound';
import { haptics, setHapticsEnabled } from './src/utils/haptics';
import { useScheduledNotifications } from './src/hooks/useScheduledNotifications';
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
import { useAccountBackup } from './src/features/account/useAccountBackup';
import { selectHomeCustomProgram } from './src/lib/homeProgramSelection';
import { getReadyTemplatePresentation } from './src/lib/templatePresentation';
import {
  addActiveProgram,
  evaluateProgramAdoption,
  removeActiveProgram,
} from './src/lib/activeProgramSet';
import {
  buildReadyProgramPlanId,
  buildCustomProgramPlanId,
  buildProgramWorkoutPlan,
} from './src/lib/programAdoption';
import { buildAiTrainingContext } from './src/lib/aiTrainingContext';
import { buildAiCoachProgramme } from './src/lib/aiCoachProgramme';
import { describeProgramCap, programCapLineKey } from './src/lib/programCapNotice';
import { computePostSessionInsight } from './src/lib/postSessionInsight';
import { composeProgramWeekForSelection } from './src/lib/programDayComposer';
import { resolveAvailableEquipment } from './src/lib/equipmentExerciseFilter';
import { getReadyProgramBlockWeeks } from './src/lib/readyProgramDuration';
import { getReadyProgramContent } from './src/lib/readyProgramContent';
import {
  getCalendarDayStartTimestamp,
  getCanonicalCompletedSessions,
  getRecentActivityStrip,
} from './src/lib/completedSessions';
import { getLifetimeTrainingSummary } from './src/lib/lifetimeSummary';
import { buildMilestoneLedger, getMilestoneFacts } from './src/lib/milestoneFacts';
import { getTrainingRhythm } from './src/lib/trainingRhythm';
import { buildFatigueModel } from './src/lib/fatigueModel';
import { buildLiftHistories } from './src/lib/trainingHistory';
import {
  buildCompletionConclusion,
  buildNextSessionMoment,
  buildPlateauConclusion,
  buildPlateauDetection,
  buildPlateauMoment,
  buildWeeklyRead,
  detectPlateau,
  pickCompletionLift,
} from './src/lib/proInsights';
import { markCoachDemoMomentUsed, resolveDueCoachDemoMoment } from './src/lib/coachDemoMoments';
import { buildHomePlanProgress } from './src/lib/homePlanProgress';
import { resolveHomePrompt } from './src/lib/homePrompts';
import { buildHomeStatCardCatalog, buildHomeStatCards, resolveHomeStatCardKeys } from './src/lib/homeStatCards';
import { silencedSuggestionKinds } from './src/lib/coachSuggestions';
import {
  buildSessionEquipmentLabel,
  classifySessionFocus,
  getDefaultCooldown,
  getDefaultWarmup,
  getSessionBodyFocusLabel,
  SessionFocusKind,
} from './src/lib/homeSessionHero';
import { estimateRoutineBlockSeconds, findGuidedLibraryIndex } from './src/lib/guidedPlayer';
import { estimateSessionMinutes } from './src/lib/sessionDuration';
import { buildMuscleFocus, getVolumeDeltaVsPrevious } from './src/lib/workoutCompleteView';
import { buildHomeQuickStats, buildHomeUpcomingSessions } from './src/lib/homeVisuals';
import { I18nKey, t } from './src/lib/i18n';
import { buildCoachModules } from './src/lib/aiCoachModules';
import { isProUnlocked, resolveProEntitlement, resolveProgressionOptions, resolveTrialProUntil } from './src/lib/proEntitlement';
import { ThemeChoiceDialog } from './src/components/ThemeChoiceDialog';
import { toProgressionFatigueSignal } from './src/lib/progressionGate';
import { resolveThemeName } from './src/lib/themePreference';
import { localizeSessionFocus, localizeSessionName } from './src/lib/sessionNameLabel';
import { setUsageStatisticsEnabled, trackEvent } from './src/features/analytics/analyticsClient';

import { resolveWorkoutLoggerFallbackRoute } from './src/lib/workoutLoggerNavigation';
import { buildExerciseHistoryLookup } from './src/lib/workoutEditorTable';
import { buildExercisePrLookup } from './src/lib/workoutCompletionSummary';
import { buildDuplicatedCustomProgramDraft } from './src/lib/customProgramDuplication';
import { resolveObservedRate } from './src/lib/strengthGoalPlan';
import type { GoalFlowLift, GoalFlowProposal } from './src/screens/StrengthGoalFlowScreen';
import { CoachChatMemory } from './src/lib/coachChatMemory';
import { CoachAdviceMemoryEntry, mergeCoachAdviceMemory, rememberCoachAdvice } from './src/lib/coachAdviceMemory';
import { loadCoachAdviceMemory, saveCoachAdviceMemory } from './src/storage/coachAdviceMemoryStore';
import type { ChatMessage } from './src/screens/AICoachChatScreen';
import {
  applyProgramSessionEdit,
  ProgramPrescription,
} from './src/lib/programSessionEdit';
import { repointPlanEntrySessions } from './src/lib/planSessionOrder';
import { reorderProgramSessions } from './src/lib/programSessionOrder';
import { ProgramLimitReachedError } from './src/lib/programSlots';
import {
  ProgramSeason,
  getSeasonProgramTitleKey,
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
import { suggestHomeStatCardKeys } from './src/lib/homeCardSuggestions';
import { isMeasurementCardKey } from './src/lib/homeStatCards';
import { resolveNextPlanEntryIndex } from './src/lib/planRotation';
import { cycleSchedule, trainsOn, weekdaySchedule } from './src/lib/trainingSchedule';
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
import {
  countPlanSessionsInRange,
  countSessionsSince,
  resolveCompletionCard,
} from './src/lib/programCompletion';
import { backfillRecommendations } from './src/lib/recommendationBackfill';
import { STRENGTH_GOAL_PRESETS } from './src/lib/strengthGoalPresets';
import { describeGoalCoverage, GoalProgrammeSuggestionView, isSameLift, rankProgrammesForLift } from './src/lib/goalProgramme';
import {
  addSeasonEnrolment,
  isEnrolled,
} from './src/lib/seasonEnrolment';
import { exerciseNameLabel } from './src/lib/exerciseNameLabel';
import { buildProgramFingerprint } from './src/lib/programFingerprint';
import { firstRecordDates, resolveRecords } from './src/lib/personalRecords';
import { getComparableLogSets } from './src/lib/exerciseLog';
import { resolveGoalProgress, upsertStrengthGoal } from './src/lib/strengthGoals';
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
import { applySessionAdaptation } from './src/lib/sessionAdaptation';
import { buildProgramInsightMap } from './src/lib/programInsights';
import { buildTailoringPreferences } from './src/lib/tailoringFit';
import { popRoute, pushRoute } from './src/navigation/routeHistory';
import { AppRoute, ROOT_ROUTES, RootTabKey, WORKOUT_PLAN_ROUTE } from './src/navigation/routes';
import { getBackRoute } from './src/app/backRoute';
import { renderProfileTab } from './src/app/renderProfileTab';
import { resolveTodaySessionPick } from './src/lib/todaySessionPick';
import { renderHomeScreens } from './src/app/renderHomeScreens';
import { renderWorkoutTab } from './src/app/renderWorkoutTab';
import { renderProgressTab } from './src/app/renderProgressTab';
import { formatGoalLabel, formatHomeSessionTitle } from './src/app/homeSessionTitle';
import {
  buildSavedOnboardingPlan,
  buildSavedOnboardingWorkoutPlan,
  buildSetupPreferencePatch,
  buildSetupSelectionFromPreferences,
} from './src/app/onboardingHandoff';
import {
  buildCompletionCardsFromAdaptedSession,
  buildSessionMovement,
  buildExerciseLogsForCompletedSession,
  CompletionSummaryState,
  getEndOfWeek,
  getStartOfWeek,
  WorkoutCelebrationState,
} from './src/app/workoutCompletionState';
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
import { pickProgramImage } from './src/utils/programImagePicker';
import { VinhaSplashScreen } from './src/screens/VinhaSplashScreen';
import { ExportablePlan } from './src/screens/ExportPlanScreen';
import { NewProgramSheet } from './src/components/NewProgramSheet';
import { buildCoachContextChips } from './src/lib/coachChat';
import { requestProgramTableFromImage } from './src/lib/aiCoachClient';
import type { CatalogScreenItem } from './src/screens/CatalogScreen';
import { ProgramsExploreItem } from './src/screens/ProgramsHomeScreen';
import { WorkoutCompletionScreen } from './src/screens/WorkoutCompletionScreen';
import { WorkoutCelebrationScreen } from './src/screens/WorkoutCelebrationScreen';
import { WorkoutEditorFinishSummary } from './src/screens/WorkoutEditorScreen';
import { WorkoutProvider, useWorkoutContext } from './src/features/workout/WorkoutProvider';
import { adaptLegacyWorkoutTemplateToRuntimeTemplate } from './src/features/workout/customWorkoutAdapter';
import { AdaptedCompletedWorkoutExercise, adaptCompletedWorkoutSessionForAppDatabase } from './src/features/workout/workoutAppAdapter';
import { getWorkoutTemplateById, WORKOUT_TEMPLATES_V1 } from './src/features/workout/workoutCatalog';
import { isTimedTrackingMode } from './src/features/workout/workoutTypes';
import { AppProvider, useAppContext } from './src/state/AppProvider';
import {
  AppLanguage,
  AppPreferences,
  ExerciseTemplateDraft,
  SetupDaysPerWeek,
  SetupWeekday,
  SetupGender,
  UnitPreference,
  WorkoutTemplateDraft,
} from './src/types/models';
import { AICoachAction } from './src/types/aiCoach';

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

const DEFAULT_HOME_AI_PROMPT_SUGGESTIONS = [
  'Best 3-day muscle plan?',
  'Bench stuck?',
  'Fix my split?',
  '30-day run challenge?',
];

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
    editWorkoutTemplateSessions,
    findWorkoutTemplateIdBySource,
    getWorkoutTemplateSessionsFresh,
    programSlots,
    upsertWorkoutPlan,
    saveOnboardingResult,
    deleteWorkoutTemplate,
    resetAllData,
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

  // Account & cloud backup: sign in with Google on the hand-off card or in
  // Settings, and the data survives a new phone. Free and Pro alike (decision
  // 2026-08-22). Absent entirely in builds without the OAuth client id.
  const accountBackup = useAccountBackup({
    hydrated,
    database,
    workoutHistory: workout.history,
    restoreDatabase: restoreDatabaseFromBackup,
    restoreWorkoutHistory: workout.restoreHistoryFromBackup,
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
  const [completionSummary, setCompletionSummary] = useState<CompletionSummaryState | null>(null);
  const [workoutCelebration, setWorkoutCelebration] = useState<WorkoutCelebrationState | null>(null);
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
  const [fontsLoaded, setFontsLoaded] = useState(false);

  // Keep the cue utilities in sync with the user's preferences, so every call
  // site across the app is gated by one switch.
  useEffect(() => {
    setSoundCuesEnabled(preferences.soundCuesEnabled);
  }, [preferences.soundCuesEnabled]);
  useEffect(() => {
    setHapticsEnabled(preferences.hapticsEnabled);
  }, [preferences.hapticsEnabled]);
  // Usage statistics are the one thing the app sends on its own, so the
  // switch has to reach the client before anything can leave: the client
  // refuses to send until told, and it is only told once the stored
  // preferences are in — the pre-hydration default is "on", and a reader who
  // switched it off must never lose a batch to that default.
  useEffect(() => {
    if (!hydrated) {
      return;
    }
    setUsageStatisticsEnabled(preferences.usageStatisticsEnabled);
  }, [hydrated, preferences.usageStatisticsEnabled]);

  // Mirrors the notification preferences onto the OS clock: reminders, the
  // comeback nudge, the Sunday summary and the morning-after record note.
  useScheduledNotifications(database);

  /* ---------------- Background timer: the app-level half ---------------- */
  // The rest ladder and the ongoing card are owned by the screen that holds the
  // rest (useRestEndAlert). What belongs here is everything that outlives a
  // screen: lock-screen action responses, the idle nudge, cleanup when the
  // session ends, and the truth about a session restored after a cold start.

  const activeSessionId = workout.activeSession?.sessionId ?? null;
  const activeSessionStatus = workout.activeSession?.status ?? null;
  const navigateToActiveWorkoutRef = useRef<() => boolean>(() => false);
  const finishFromNotificationRef = useRef<() => void>(() => {});

  // Lock-screen actions. Every action opens the app; the running rest is then
  // told over the bus, because it lives in screen state.
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data ?? {};
      if (data[SESSION_NOTIFICATION_MARKER] !== true) {
        return;
      }
      const action = response.actionIdentifier;
      // Bring the session to the front first; the screen that owns the rest
      // mounts its bus listener on render.
      navigateToActiveWorkoutRef.current();
      setTimeout(() => {
        if (action === ACTION_EXTEND_30) {
          emitRestAction({ kind: 'extend', seconds: 30 });
        } else if (action === ACTION_EXTEND_60) {
          emitRestAction({ kind: 'extend', seconds: 60 });
        } else if (action === ACTION_SKIP_REST) {
          emitRestAction({ kind: 'skip' });
        } else if (action === ACTION_FINISH) {
          finishFromNotificationRef.current();
        } else if (action === ACTION_STILL_GOING) {
          // Handled by the idle effect below: opening the app counts as activity.
        }
      }, 350);
    });
    return () => subscription.remove();
  }, []);

  // Session ended or was discarded: nothing of ours stays in the shade.
  useEffect(() => {
    if (!activeSessionId || activeSessionStatus !== 'active') {
      void clearAllSessionNotifications();
    }
  }, [activeSessionId, activeSessionStatus]);

  // The idle nudge: 25 minutes after the last logged set, one question. Keyed
  // on the count of completed sets so every logged set pushes it forward, and
  // on the app coming to the foreground, which also counts as being there.
  const completedSetCount = useMemo(
    () =>
      (workout.activeSession?.exercises ?? []).reduce(
        (sum, exercise) => sum + exercise.sets.filter((set) => set.status === 'completed').length,
        0,
      ),
    [workout.activeSession?.exercises],
  );
  useEffect(() => {
    if (!activeSessionId || activeSessionStatus !== 'active' || !preferences.notificationPrefs.idleNudge) {
      void cancelIdleNudge();
      return;
    }
    const language = preferences.appLanguage;
    const sessionName = localizeSessionName(
      formatWorkoutDisplayLabel(workout.activeSession?.templateName ?? ''),
      language,
    );
    void scheduleIdleNudge({
      atMs: idleNudgeAtMs(Date.now()),
      title: t(language, 'rest.notify.idleTitle', { minutes: IDLE_NUDGE_MINUTES }),
      body: t(language, 'rest.notify.idleBody', { session: sessionName, done: completedSetCount }),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSessionId, activeSessionStatus, completedSetCount, preferences.notificationPrefs.idleNudge, preferences.appLanguage]);

  // After a cold start the session comes back from stored timestamps: elapsed
  // is real and a rest that expired meanwhile is already resolved. Say so once.
  const restoredToastShownRef = useRef(false);
  useEffect(() => {
    if (!workout.hydrated || restoredToastShownRef.current) {
      return;
    }
    restoredToastShownRef.current = true;
    if (workout.activeSession?.status === 'active') {
      showToast(t(preferences.appLanguage, 'rest.notify.restoredToast'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workout.hydrated]);

  // Every seeded row is browsable now that the legacy `lib_*` tier is gone
  // (2026-09-01), so this no longer filters. The name stays: ten call sites
  // read it, and "the library the reader can open" is still what they mean.
  // What keeps it true is a guard on the seed, not a filter here — a filter
  // hides a bad row, and hiding is how the two sets drifted apart in the first
  // place.
  const exerciseBrowserItems = exerciseLibrary;
  const summaryExitRouteRef = useRef<AppRoute | null>(null);
  const summaryNavigationPendingRef = useRef(false);
  const workoutLogNavigationAllowedAtRef = useRef<number | null>(null);
  const route = navigationState.route;
  const appHydrated = hydrated && workout.hydrated;

  useEffect(() => {
    if (!appHydrated || preferences.hasOpenedAppBefore) {
      return;
    }

    void updatePreferences({
      hasOpenedAppBefore: true,
    });
  }, [appHydrated, preferences.hasOpenedAppBefore, updatePreferences]);

  /**
   * The install date the coach demo moments count their 7 / 30 / 90 days from.
   *
   * Stamped separately from hasOpenedAppBefore rather than beside it, because
   * an install that predates this field has already opened the app: it would
   * never take that branch, and its moments would never fire. Keyed on the
   * date being missing instead, so an upgrade starts the clock at the upgrade.
   */
  useEffect(() => {
    if (!appHydrated || preferences.firstLaunchAt) {
      return;
    }
    void updatePreferences({ firstLaunchAt: new Date().toISOString() });
  }, [appHydrated, preferences.firstLaunchAt, updatePreferences]);

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
      setWorkoutCelebration(null);
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
    void updatePreferences({ ratingPrompt: recordRatingAsked(preferences.ratingPrompt, Date.now()) });
  }

  function navigateToTab(tab: RootTabKey) {
    // Programs-tab redesign (flagged): the workout tab lands on the Programs
    // home instead of the legacy exercise list.
    if (tab === 'workout' && preferences.programsTabEnabled) {
      resetToRoute({ tab: 'workout', screen: 'programs_home' });
      return;
    }
    resetToRoute(ROOT_ROUTES[tab]);
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
      route.screen === 'editor' &&
      route.workoutTemplateId &&
      !workoutTemplates.some((template) => template.id === route.workoutTemplateId)
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
  // Both start paths share about-you (profile creation); they fork after.
  const [onboardingPath, setOnboardingPath] = useState<'build' | 'ready'>('build');
  // The funnel's spine: which onboarding stage was reached. If half of every
  // install stops at one stage, that stage is the finding — the question this
  // whole event pipe exists to answer (user, 2026-08-25).
  //
  // Gated on hydration: before the stored preferences are in,
  // onboardingCompleted is the provider's default false, so every cold start
  // of a long-finished install used to count as reaching step "path" —
  // the funnel's first stage was inflated by every returning user
  // (review finding, 2026-09-04).
  useEffect(() => {
    if (hydrated && onboardingActive) {
      trackEvent('onboarding_step', { path: onboardingStep });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, onboardingActive, onboardingStep]);
  // Conversion's top of funnel: the paywall was on screen. Purchases will
  // come from Play's own reporting once billing exists.
  useEffect(() => {
    if (route.tab === 'profile' && route.screen === 'premium') {
      trackEvent('paywall_viewed');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route]);
  const [busySavingReadyPick, setBusySavingReadyPick] = useState(false);

  // The onboarding flow state lives in memory; when the gate closes (finished)
  // or the app returns to the Welcome entry (e.g. after a data reset), start
  // the next run from the path screen — never mid-questionnaire.
  useEffect(() => {
    if (preferences.onboardingCompleted || !preferences.entryFlowCompleted) {
      setOnboardingStep('path');
      setOnboardingPath('build');
      setAboutYouValues(null);
    }
  }, [preferences.entryFlowCompleted, preferences.onboardingCompleted]);
  const [aboutYouValues, setAboutYouValues] = useState<AboutYouValues | null>(null);
  /**
   * Today's swaps for the next session, slot id → exercise name, chosen on Home
   * before the session exists. Deliberately not persisted: it is an answer to
   * "what am I doing today", and it is spent when the session starts.
   */
  const [sessionSwaps, setSessionSwaps] = useState<Record<string, string>>({});
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
  /**
   * Slots left out of today's session, chosen on Home beside the swaps and
   * spent at the same moment. Not a change to the programme — that is edited
   * from the programme's own page.
   */
  const [sessionDrops, setSessionDrops] = useState<string[]>([]);
  // Shown when a create is blocked, from wherever it was attempted. Not a
  // route: the user was in the middle of something, and a screen change
  // would lose the thing they were doing to a wall they may dismiss.
  const [programLimitVisible, setProgramLimitVisible] = useState(false);
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

  useEffect(() => {
    if (!hydrated || !preferences.onboardingCompleted) {
      return;
    }

    if (
      typeof preferences.setupCurrentWeightKg !== 'number' ||
      !Number.isFinite(preferences.setupCurrentWeightKg) ||
      preferences.setupCurrentWeightKg <= 0
    ) {
      return;
    }

    if (database.bodyweightEntries.length > 0) {
      return;
    }

    void addBodyweightEntry(preferences.setupCurrentWeightKg);
  }, [
    addBodyweightEntry,
    database.bodyweightEntries.length,
    hydrated,
    preferences.onboardingCompleted,
    preferences.setupCurrentWeightKg,
  ]);

  useEffect(() => {
    if (onboardingActive) {
      return undefined;
    }

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      const nextRoute = getBackRoute(route, workoutHomeRoute);
      if (!nextRoute && navigationState.history.length === 0) {
        return false;
      }

      if (route.tab === 'workout' && route.screen === 'summary') {
        setCompletionSummary(null);
        setFinishSaveState({ status: 'idle', sessionId: null, message: null });
        workout.clearCompletedWorkout();
        navigateBack(summaryExitRouteRef.current ?? workoutHomeRoute);
        return true;
      }

      navigateBack(nextRoute);
      return true;
    });

    return () => subscription.remove();
  }, [navigationState.history.length, onboardingActive, route, workout]);

  const homeSummary = useMemo(() => getHomeSummary(database, unitPreference), [database, unitPreference]);
  const lifetimeSummary = useMemo(() => getLifetimeTrainingSummary(database), [database]);
  const progressTrainingRhythm = useMemo(() => getTrainingRhythm(database), [database]);
  // The paywall-moments data layer: real lift histories → detections (free)
  // and deterministic conclusions (Pro / blurred). Pure, from logged sets.
  const proLiftHistories = useMemo(
    () => buildLiftHistories(database.workoutSessions, database.exerciseLogs),
    [database.exerciseLogs, database.workoutSessions],
  );
  const proFatigue = useMemo(
    () =>
      buildFatigueModel({
        workoutSessions: database.workoutSessions,
        exerciseLogs: database.exerciseLogs,
      }),
    [database.exerciseLogs, database.workoutSessions],
  );
  /**
   * Recovery, in the shape the progression gate acts on.
   *
   * The gate has carried fatigue holds since it was written, and nothing ever
   * passed a signal in — so the paywall's "Pro reads your load and eases off
   * before fatigue costs you a week" described something that never happened
   * on a single set. This is the wire.
   *
   * It rides on the progression options, which resolveProgressionOptions
   * already gates behind Pro, so the hold is a paid behaviour by construction
   * rather than by a second check that could drift from the first.
   */
  const progressionFatigueSignal = useMemo(
    () => toProgressionFatigueSignal(proFatigue),
    [proFatigue],
  );
  const proPlateauLift = useMemo(() => detectPlateau(proLiftHistories), [proLiftHistories]);
  const proPlateau = useMemo(
    () =>
      proPlateauLift
        ? {
            detection: buildPlateauDetection(proPlateauLift, preferences.appLanguage),
            conclusion: buildPlateauConclusion(proPlateauLift, preferences.appLanguage),
            moment: buildPlateauMoment(proPlateauLift, preferences.appLanguage, preferences.setupLevel),
          }
        : null,
    [preferences.appLanguage, preferences.setupLevel, proPlateauLift],
  );
  const proWeeklyRead = useMemo(
    () => buildWeeklyRead(proLiftHistories, proFatigue, preferences.appLanguage),
    [preferences.appLanguage, proFatigue, proLiftHistories],
  );
  const proCompletionLift = useMemo(() => pickCompletionLift(proLiftHistories), [proLiftHistories]);
  const proCompletionMoment = useMemo(
    () =>
      proCompletionLift
        ? {
            conclusion: buildCompletionConclusion(proCompletionLift, preferences.appLanguage, preferences.setupLevel),
            moment: buildNextSessionMoment(proCompletionLift, preferences.appLanguage, preferences.setupLevel),
          }
        : null,
    [preferences.appLanguage, preferences.setupLevel, proCompletionLift],
  );
  // The Pro page's coach specimen: the deterministic read of the user's own
  // stalled lift — the same text Pro unlocks at the plateau moments.
  const proCoachSpecimen = useMemo(
    () => (proPlateau ? proPlateau.conclusion.body : null),
    [proPlateau],
  );
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
    if (!activeSession || finishSaveState.status === 'saving') {
      return;
    }

    const adaptedSession = adaptCompletedWorkoutSessionForAppDatabase(activeSession);
    if (adaptedSession.logs.length === 0) {
      await handleDiscardWorkout();
      return;
    }

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
      trackEvent('workout_completed');
      if (!summary.sessionId || !summary.performedAt) {
        throw new Error('Workout save did not produce a valid summary');
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
        // The tile counts lifts that were done, and it counts them off the
        // same cards the list below draws — so the two cannot disagree.
        // summary.exercisesLogged is every persisted entry, skipped included:
        // "6 LIIKETTÄ" above five rows of "0 sarjaa" was that number.
        exercisesLogged: completionCards.exerciseCards.filter((card) => card.completedSets > 0).length,
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
    }
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

  async function persistSetupSelection(selection: FirstRunSetupSelection, recommendedProgramId: string | null) {
    trackEvent('onboarding_completed', { path: onboardingPath });
    await completeOnboarding(buildSetupPreferencePatch(selection, recommendedProgramId, preferences.trainingCycle));

    if (
      typeof selection.currentWeightKg === 'number' &&
      selection.currentWeightKg > 0 &&
      database.bodyweightEntries.length === 0
    ) {
      await addBodyweightEntry(selection.currentWeightKg);
    }
  }


  function handleOpenReadyProgramDetail(workoutTemplateId: string) {
    navigate({ tab: 'workout', screen: 'program', programType: 'ready', workoutTemplateId });
  }

  function handleOpenCustomProgramDetail(
    workoutTemplateId: string,
    programType: 'ready' | 'custom' = 'custom',
  ) {
    navigate({ tab: 'workout', screen: 'program', programType, workoutTemplateId });
  }

  function handleOpenAICoach(prompt: string) {
    navigate({ tab: 'home', screen: 'ai', prompt });
  }

  function handleSelectAiCoachAction(action: AICoachAction, prompt: string) {
    switch (action.kind) {
      case 'resume_workout':
        if (!navigateToActiveWorkout({ resume: true })) {
          showToast(t(preferences.appLanguage, 'toast.noActiveWorkout'));
        }
        return;

      case 'open_last_session':
        if (action.sessionId) {
          navigate({ tab: 'home', screen: 'session', sessionId: action.sessionId });
        } else {
          navigate({ tab: 'home', screen: 'history' });
        }
        return;

      case 'open_lift_progress':
        if (action.exerciseKey) {
          navigate({ tab: 'progress', screen: 'detail', exerciseKey: action.exerciseKey });
        } else {
          navigate(ROOT_ROUTES.progress);
        }
        return;

      case 'open_progress':
        navigate(ROOT_ROUTES.progress);
        return;

      case 'browse_ready_plans':
        navigate(workoutHomeRoute);
        return;

      case 'open_recommended_program': {
        const recommendedProgramId = action.programId ?? preferences.recommendedProgramId;
        if (recommendedProgramId) {
          navigate({
            tab: 'workout',
            screen: 'program',
            programType: 'ready',
            workoutTemplateId: recommendedProgramId,
          });
        } else {
          navigate(workoutHomeRoute);
        }
        return;
      }

      case 'review_setup':
        handleOpenSetupEditor();
        return;

      case 'open_custom_editor':
        navigate({
          tab: 'workout',
          screen: 'editor',
          prefillName: action.prefillName ?? (prompt.trim() ? 'Vinha AI custom workout' : undefined),
        });
        return;

      default:
        navigate(ROOT_ROUTES.home);
    }
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
      void updatePreferences({ trainingFirstRunDismissed: true });
      const runtimeTemplate = applySessionAdaptation(
        buildReadySessionRuntimeTemplate(template, sessionId),
        { swaps: sessionSwaps, drops: sessionDrops },
      );
      workout.startCustomWorkout(runtimeTemplate, nextUnitPreference, {
        ...resolveProgressionOptions(preferences),
        fatigueSignal: progressionFatigueSignal,
      });
      // Today's changes are spent the moment they are applied — an adaptation
      // is an answer about right now, and a stale one is worse than none.
      setSessionSwaps({});
      setSessionDrops([]);
      navigateToGuidedWorkout(workoutTemplateId);
    });
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
  function resolveNextSessionIdForTemplate(workoutTemplateId: string): string | null {
    const plan = database.workoutPlans.find(
      (item) => item.entries[0]?.workoutTemplateId === workoutTemplateId,
    );
    if (!plan || plan.entries.length === 0) {
      return null;
    }
    const ordered = [...plan.entries].sort((left, right) => left.orderIndex - right.orderIndex);
    const index = resolveNextPlanEntryIndex(ordered, getCanonicalCompletedSessions(database));
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
  async function handleAdoptReadyProgram(
    workoutTemplateId: string,
    options?: { lead?: boolean },
  ): Promise<boolean> {
    const template = getWorkoutTemplateById(workoutTemplateId);
    if (!template) {
      return false;
    }
    trackEvent('plan_adopted');

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
        navigate({ tab: 'profile', screen: 'premium', reason: 'program_cap' });
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
    await dismissCompletionCard(planId);
    await handleAdoptReadyProgram(nextTemplateId, { lead: true });
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
      resolveNextPlanEntryIndex(ordered, getCanonicalCompletedSessions(database)),
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
    if (days.length > 0) {
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
      resolveNextPlanEntryIndex(ordered, getCanonicalCompletedSessions(database)),
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
          id: exercise.id,
          name: exercise.name,
          targetSets: setsByExerciseId.get(exercise.id) ?? exercise.targetSets,
          repMin: exercise.repMin,
          repMax: exercise.repMax,
          restSeconds: exercise.restSeconds,
          trackedDefault: exercise.trackedDefault,
          libraryItemId: exercise.libraryItemId ?? null,
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
    await dismissCompletionCard(planId);
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
        // A season programme goes by the season's name, not the template's:
        // the reader joined "Kesäkunto" and the template is called "RUN".
        // One helper decides that for every surface, because computing it
        // separately per screen is what put three different names on one
        // programme today.
        const seasonTitleKey = templateId ? getSeasonProgramTitleKey(templateId) : null;
        const title = seasonTitleKey
          ? t(preferences.appLanguage, seasonTitleKey)
          : template
            ? getReadyTemplatePresentation(template, preferences.appLanguage, days).title
            : formatWorkoutDisplayLabel(plan.name || '');
        return {
          planId,
          title,
          meta: t(preferences.appLanguage, 'programs.card.days', { count: days }),
        };
      })
      .filter((row): row is { planId: string; title: string; meta: string } => row !== null);
  }, [database.workoutPlans, preferences.activePlanIds, preferences.activePlanId, preferences.appLanguage]);

  /**
   * Start the questionnaire again, keeping everything already logged.
   *
   * There was no way back into onboarding once it had been finished, so a
   * reader whose life changed had to live with the programme their first five
   * minutes had chosen. entryFlowCompleted stays true — they have met the
   * Welcome screen and do not need to again.
   */
  async function handleRedoOnboarding() {
    await updatePreferences({ onboardingCompleted: false, setupCompleted: false });
  }

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
      navigate({ tab: 'workout', screen: 'template', workoutTemplateId });
      return;
    }

    // Same rule as the ready-programme start above.
    if (navigateToActiveWorkout({ resume: isActiveSessionFor(workoutTemplateId, sessionId) })) {
      return;
    }

    guardStrengthStartOverCardio(() => {
      void updatePreferences({ trainingFirstRunDismissed: true });
      const runtimeTemplate = applySessionAdaptation(
        buildCustomSessionRuntimeTemplate(customTemplate, sessionId),
        { swaps: sessionSwaps, drops: sessionDrops },
      );
      workout.startCustomWorkout(runtimeTemplate, unitPreference, {
        ...resolveProgressionOptions(preferences),
        fatigueSignal: progressionFatigueSignal,
      });
      setSessionSwaps({});
      setSessionDrops([]);
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

  /**
   * Renaming a session from Home.
   *
   * Only a program of the reader's own can be renamed: the catalog's templates
   * are immutable at runtime, and a rename that silently did nothing would be
   * worse than no button. The sheet asks whether this handler exists before it
   * draws the pencil.
   */
  async function handleRenameActivePlanSession(sessionId: string, name: string) {
    const trimmed = name.trim();
    const templateId = homeActivePlanCard?.programId;
    if (!trimmed || !templateId || homeActivePlanCard?.programType !== 'custom') {
      return;
    }
    await editWorkoutTemplateSessions(templateId, (sessions) => ({
      kind: 'save',
      sessions: sessions.map((session) => ({
        id: session.id,
        // Every other field is copied because upsert replaces the record; only
        // the one session the reader named changes.
        name: session.id === sessionId ? trimmed : session.name,
        exercises: session.exercises.map((exercise) => ({
          id: exercise.id,
          name: exercise.name,
          targetSets: exercise.targetSets,
          repMin: exercise.repMin,
          repMax: exercise.repMax,
          restSeconds: exercise.restSeconds,
          trackedDefault: exercise.trackedDefault,
          libraryItemId: exercise.libraryItemId ?? null,
        })),
      })),
    }));
  }

  /**
   * Move a whole day inside the programme (user 2026-08-31).
   *
   * The rotation reads the session list positionally, so this is the edit that
   * decides which session lands on which weekday - the same list the day rows
   * print in. Custom programmes only: reordering a catalog programme would
   * mean copying it, and the reader has not asked for a copy by dragging.
   */
  async function handleReorderProgramSession(
    workoutTemplateId: string,
    sessionId: string,
    toIndex: number,
  ) {
    await editWorkoutTemplateSessions(workoutTemplateId, (sessions) => {
      const result = reorderProgramSessions(sessions, sessionId, toIndex);
      if (result.kind === 'skip') {
        return { kind: 'skip', reason: result.reason };
      }
      return {
        kind: 'save',
        // Position in this array is the stored order; every other field is
        // copied because upsert replaces the record.
        sessions: result.sessions.map((session) => ({
          id: session.id,
          name: session.name,
          exercises: session.exercises.map((exercise) => ({
            id: exercise.id,
            name: exercise.name,
            targetSets: exercise.targetSets,
            repMin: exercise.repMin,
            repMax: exercise.repMax,
            restSeconds: exercise.restSeconds,
            trackedDefault: exercise.trackedDefault,
            libraryItemId: exercise.libraryItemId ?? null,
          })),
        })),
      };
    });

    // The template is only half the record. Each plan entry pins a weekday to
    // a session BY ID, and Home, the calendar and the rotation read the
    // assignment from there — so a reorder that stopped at the template moved
    // the list on one screen and changed nothing about what gets trained.
    // Read the order back rather than trusting the draft: the repository is
    // what decided it.
    const plan = database.workoutPlans.find(
      (item) => item.entries[0]?.workoutTemplateId === workoutTemplateId,
    );
    if (!plan) {
      return;
    }
    const saved = await getWorkoutTemplateSessionsFresh(workoutTemplateId);
    const repointed = repointPlanEntrySessions(
      plan.entries,
      saved.map((session) => session.id),
    );
    if (repointed.kind === 'skip') {
      return;
    }
    await upsertWorkoutPlan({ ...plan, entries: repointed.entries, updatedAt: plan.updatedAt });
  }

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

  /**
   * What one edit to a programme's exercise does. Both reach the template the
   * same way — copying a ready programme first when there is no template to
   * write to — so they share a path rather than two near-identical ones.
   */
  type ProgramExerciseEdit =
    | { kind: 'remove' }
    | { kind: 'replace'; exerciseName: string }
    | { kind: 'add'; exerciseNames: string[] }
    | { kind: 'prescribe'; prescription: ProgramPrescription }
    | { kind: 'reorder'; toIndex: number };

  /**
   * The prescription a lift added from the library starts on.
   *
   * The day screen adds a name, not a dose — the library has no opinion about
   * how many sets of it you do. These are the same defaults the template
   * editor writes, so a lift added from either place looks the same afterwards.
   */
  function buildAddedProgramExercises(exerciseNames: string[], sessionId: string) {
    return exerciseNames.map((name) => {
      const libraryItemId = resolveLibraryItemIdForName(name);
      const defaults = getExerciseTemplateDefaults(
        exerciseLibrary.find((item) => item.id === libraryItemId),
        preferences.defaultRestSeconds,
      );
      return {
        id: createId(`${sessionId}_add`),
        name,
        libraryItemId,
        ...defaults,
      };
    });
  }

  /**
   * The library entry a name belongs to, so a swapped-in lift keeps its photo,
   * its instructions and its history. Writing the name alone leaves the row
   * pointing at the exercise it used to be.
   */
  function resolveLibraryItemIdForName(name: string): string | null {
    const index = findGuidedLibraryIndex(
      name,
      exerciseLibrary.map((item) => item.name),
    );
    return index === null || index < 0 ? null : exerciseLibrary[index]?.id ?? null;
  }

  /**
   * Programme edits run one at a time, in the order they were pressed.
   *
   * Not for the writes themselves — the provider already serialises those. It
   * is for the decision in front of them: editing a ready programme first asks
   * whether a copy of it exists and then makes one if it does not, and two
   * edits overlapping across that gap both answer "no". A stepper turns that
   * from a theoretical race into the normal case, because the second tap
   * arrives while the first copy is still being written.
   */
  const programEditQueue = useRef<Promise<void>>(Promise.resolve());

  function handleEditProgramExercise(
    programType: 'ready' | 'custom',
    programId: string,
    sessionId: string,
    exerciseId: string,
    edit: ProgramExerciseEdit,
  ): Promise<void> {
    const next = programEditQueue.current.then(() =>
      runProgramExerciseEdit(programType, programId, sessionId, exerciseId, edit),
    );
    // A failed edit must not wedge every edit queued behind it.
    programEditQueue.current = next.catch(() => undefined);
    return next;
  }

  async function runProgramExerciseEdit(
    programType: 'ready' | 'custom',
    programId: string,
    sessionId: string,
    exerciseId: string,
    edit: ProgramExerciseEdit,
  ) {
    if (programType === 'custom') {
      // The day is read inside the write, not before it: an add that lands
      // while the previous add is still being saved must build on it rather
      // than on the screen's copy of how the programme looked a render ago.
      const added =
        edit.kind === 'add' ? buildAddedProgramExercises(edit.exerciseNames, sessionId) : [];
      const result = await editWorkoutTemplateSessions(programId, (sessions) =>
        applyProgramSessionEdit(
          sessions,
          sessionId,
          edit.kind === 'remove'
            ? { kind: 'remove', exerciseId }
            : edit.kind === 'replace'
              ? {
                  kind: 'replace',
                  exerciseId,
                  exerciseName: edit.exerciseName,
                  libraryItemId: resolveLibraryItemIdForName(edit.exerciseName),
                }
              : edit.kind === 'prescribe'
                ? { kind: 'prescribe', exerciseId, prescription: edit.prescription }
                : edit.kind === 'reorder'
                  ? { kind: 'reorder', exerciseId, toIndex: edit.toIndex }
                  : { kind: 'add', exercises: added },
        ),
      );
      if (result.reason === 'lastExerciseInDay') {
        showToast(t(preferences.appLanguage, 'toast.lastExerciseInDay'));
        return;
      }
      if (!result.saved) {
        return;
      }
      void haptics.success();
      if (edit.kind === 'replace') {
        // Today's swap has been spent by the programme itself. Leaving it in
        // place would keep an override on a slot that now already says this.
        setSessionSwaps((current) => {
          const next = { ...current };
          for (const [slotId, name] of Object.entries(next)) {
            if (name === edit.exerciseName) {
              delete next[slotId];
            }
          }
          return next;
        });
        // No "it is in your programme now" popup: the row behind the sheet
        // already says the new lift, and it stops being marked as today's
        // override. A toast that repeats the screen is the thing the reader
        // keeps asking to be rid of (user 2026-08-26).
      }
      return;
    }

    const template = WORKOUT_TEMPLATES_V1.find((item) => item.id === programId);
    if (!template) {
      return;
    }

    /**
     * A drop that changes nothing, checked before anything is written.
     *
     * Everything below this line copies the catalog programme into a custom
     * one — that is what editing a ready programme means. Pressing "up" on the
     * top row is not an edit, and letting it through would hand the reader a
     * copy of the whole programme, and one fewer free slot, in exchange for a
     * list that looks exactly as it did.
     */
    if (edit.kind === 'reorder') {
      const day = template.sessions.find((session) => session.id === sessionId);
      const from = day?.exercises.findIndex((exercise) => exercise.id === exerciseId) ?? -1;
      const to = day
        ? Math.max(0, Math.min(day.exercises.length - 1, Math.round(edit.toIndex)))
        : -1;
      if (!day || from === -1 || to === from) {
        return;
      }
    }

    /**
     * Already have a version of this one? Edit it.
     *
     * This branch used to build a fresh copy from the catalog every time, so
     * editing the same ready programme three times left the reader with THREE
     * programmes — the third arriving as "(kopio 2)", and the free cap filling
     * up with the same programme (#bugs 2026-08-26). The catalog original is
     * immutable and keeps its id forever; the copy now records which one it
     * came from, and a second edit finds it and goes down the custom path.
     *
     * Asked of the database rather than of `workoutTemplates`, which is the
     * screen's copy and one render behind: three stepper taps inside a single
     * render all read "no copy yet" and all three made one. Serialising the
     * handler (see programEditQueue) is the other half — the lookup has to run
     * after the previous edit's write, not merely against fresh data.
     */
    const existingCopyId = await findWorkoutTemplateIdBySource(programId);
    if (existingCopyId) {
      // Straight to the body, not back through the queue this call is already
      // holding — the same reason the provider has an "Exclusive" twin.
      await runProgramExerciseEdit('custom', existingCopyId, sessionId, exerciseId, edit);
      return;
    }

    // No cap check for the programme being run: the copy replaces it, so the
    // reader ends with what they started with. Copying one they are only
    // browsing does add, and the repository charges that as before.
    const readyPlanId = buildReadyProgramPlanId(programId);
    const wasRunning = preferences.activePlanIds.includes(readyPlanId);
    if (!wasRunning && !programSlots.canCreate) {
      setProgramLimitVisible(true);
      return;
    }
    const draft = buildDuplicatedCustomProgramDraft(
      template.name,
      template.sessions.map((session, sessionIndex) => {
        const exercises = [
          ...session.exercises
          .filter(
            (exercise) =>
              edit.kind !== 'remove' || !(session.id === sessionId && exercise.id === exerciseId),
          )
          .map((exercise, exerciseIndex) => {
            const target = session.id === sessionId && exercise.id === exerciseId;
            const name =
              target && edit.kind === 'replace' ? edit.exerciseName : exercise.exerciseName;
            // The catalog's dose unless this row is the one being re-dosed.
            // Rest rides along on the same rule the custom path uses
            // (applyProgramSessionEdit): a number overrides, null leaves the
            // catalog's own value alone.
            const dose =
              target && edit.kind === 'prescribe'
                ? edit.prescription
                : {
                    targetSets: exercise.sets,
                    repMin: exercise.repsMin,
                    repMax: exercise.repsMax,
                    restSeconds: null,
                  };
            return {
              id: exercise.id,
              workoutTemplateId: template.id,
              workoutTemplateSessionId: session.id,
              name,
              targetSets: dose.targetSets,
              repMin: dose.repMin,
              repMax: dose.repMax,
              // Reading only the catalog value here dropped a rest-time edit
              // in silence — and it had already cost the reader one of three
              // custom-programme slots to make the copy (PR #33 review).
              restSeconds:
                typeof dose.restSeconds === 'number' ? dose.restSeconds : exercise.restSecondsMin,
              trackedDefault: false,
              orderIndex: exerciseIndex,
              libraryItemId: target && edit.kind === 'replace' ? resolveLibraryItemIdForName(name) : null,
            };
          }),
          // A ready programme is copied to be edited, so adding to one of its
          // days works exactly as removing from one already does.
          ...(edit.kind === 'add' && session.id === sessionId
            ? buildAddedProgramExercises(edit.exerciseNames, session.id).map((exercise, index) => ({
                ...exercise,
                workoutTemplateId: template.id,
                workoutTemplateSessionId: session.id,
                orderIndex: session.exercises.length + index,
              }))
            : []),
        ];

        if (edit.kind === 'reorder' && session.id === sessionId) {
          const from = exercises.findIndex((exercise) => exercise.id === exerciseId);
          const to = Math.max(0, Math.min(exercises.length - 1, Math.round(edit.toIndex)));
          const [moved] = exercises.splice(from, 1);
          exercises.splice(to, 0, moved);
        }

        return {
          id: session.id,
          workoutTemplateId: template.id,
          name: session.name,
          orderIndex: sessionIndex,
          exerciseIds: session.exercises.map((exercise) => exercise.id),
          // Re-numbered from where the rows now sit: the position in this
          // array is what the reader sees, and orderIndex is what is stored.
          exercises: exercises.map((exercise, orderIndex) => ({ ...exercise, orderIndex })),
        };
      }),
      workoutTemplates.map((item) => item.name),
      preferences.appLanguage,
      // Its own name, not "(kopio)". The reader asked to change a lift, not to
      // make a second programme — and there is no second programme: the catalog
      // original is untouched and comes back whole if they take it up again.
      { keepName: true },
    );
    // The link the next edit will look for.
    draft.sourceTemplateId = programId;

    try {
      const workoutTemplateId = await upsertWorkoutTemplate(draft, { replacesPlanId: readyPlanId });
      const planId = buildCustomProgramPlanId(workoutTemplateId);
      // Read the ids back rather than trusting the draft's: the repository
      // assigns them, and a plan pointing at ids that were never stored is a
      // programme whose days resolve to nothing.
      // Fresh, not rendered: this line runs inside the closure that created
      // the copy, and that closure's `database` predates it.
      const copiedSessions = await getWorkoutTemplateSessionsFresh(workoutTemplateId);
      const sessionIds = copiedSessions
        .filter((session) => session.exercises.length > 0)
        .map((session) => session.id);
      const plan = buildProgramWorkoutPlan({
        planId,
        workoutTemplateId,
        programName: formatWorkoutDisplayLabel(draft.name),
        sessionIds,
        dayLabels: planLabelsForProgramme(sessionIds.length, preferences.setupAvailableDays, new Date()),
        now: new Date().toISOString(),
      });
      await upsertWorkoutPlan(plan);
      // The copy takes the ready programme's place rather than joining it —
      // the reader had one programme before this and must have one after. Only
      // when the ready one was actually running: editing a day of a programme
      // they are merely browsing must not adopt anything.
      await updatePreferences(
        wasRunning
          ? {
              activePlanIds: addActiveProgram(
                removeActiveProgram(preferences.activePlanIds, readyPlanId),
                plan.id,
              ),
              activePlanId: plan.id,
            }
          : {},
      );
      void haptics.success();
      if (edit.kind === 'replace') {
        setSessionSwaps((current) => {
          const next = { ...current };
          for (const [slotId, name] of Object.entries(next)) {
            if (name === edit.exerciseName) {
              delete next[slotId];
            }
          }
          return next;
        });
      }
      /**
       * Onto the copy's version of the day the reader is standing on.
       *
       * This used to land on the programme page, which was survivable when
       * every edit here was a one-shot press in a sheet that closed anyway.
       * With a stepper it is not: the first "+" copied the programme and then
       * moved the reader to a different screen, with the sheet they were still
       * using floating over it. The days are copied in order, so the day at
       * the same position is the same day.
       */
      const dayIndex = template.sessions.findIndex((session) => session.id === sessionId);
      // Read off the unfiltered list: the plan drops a day with nothing in it,
      // but the days are still stored in their original order, and indexing
      // the filtered list would walk one day forward past a dropped one.
      const copiedSessionId = dayIndex > -1 ? copiedSessions[dayIndex]?.id : undefined;
      navigate(
        copiedSessionId
          ? {
              tab: 'workout',
              screen: 'programDay',
              programType: 'custom',
              workoutTemplateId,
              sessionId: copiedSessionId,
            }
          : { tab: 'workout', screen: 'program', programType: 'custom', workoutTemplateId },
      );
    } catch (error) {
      if (error instanceof ProgramLimitReachedError) {
        setProgramLimitVisible(true);
        return;
      }
      console.error('Failed to remove exercise from ready program', error);
      showToast(t(preferences.appLanguage, 'toast.programCopyFailed'));
    }
  }

  async function handleAdoptCustomProgram(workoutTemplateId: string, options?: { lead?: boolean }) {
    const template = customWorkoutRuntimeMap[workoutTemplateId];
    // An empty program is not a plan. Home would draw a card with no session
    // behind it, so the editor is the honest destination.
    const sessionIds = (template?.sessions ?? [])
      .filter((session) => session.exercises.length > 0)
      .map((session) => session.id);
    if (sessionIds.length === 0) {
      showToast(t(preferences.appLanguage, 'toast.addExercisesTemplate'));
      navigate({ tab: 'workout', screen: 'template', workoutTemplateId });
      return;
    }

    if (activeProgramTemplateIds.includes(workoutTemplateId)) {
      if (options?.lead) {
        await promoteHeldProgramToLead(workoutTemplateId);
      }
      return;
    }

    const planId = buildCustomProgramPlanId(workoutTemplateId);
    const decision = evaluateProgramAdoption({
      activePlanIds: preferences.activePlanIds,
      targetPlanId: planId,
      proUnlocked: resolveProEntitlement(preferences).unlocked,
    });

    if (decision.kind === 'already_active') {
      return;
    }

    if (decision.kind === 'blocked') {
      if (decision.canUpgrade) {
        navigate({ tab: 'profile', screen: 'premium', reason: 'program_cap' });
        return;
      }
      showToast(t(preferences.appLanguage, 'programs.cap.full', { cap: decision.cap }));
      return;
    }

    // The program's own session count leads, exactly as it does for a ready
    // programme: an imported six-day week dealt across three chosen weekdays
    // would run every session twice and call itself a three-day programme.
    const dayLabels = planLabelsForProgramme(sessionIds.length, preferences.setupAvailableDays, new Date());

    const plan = buildProgramWorkoutPlan({
      planId,
      workoutTemplateId,
      programName: formatWorkoutDisplayLabel(template?.name ?? ''),
      sessionIds,
      dayLabels,
      now: new Date().toISOString(),
    });

    await upsertWorkoutPlan(plan);
    await updatePreferences({
      activePlanIds: addActiveProgram(preferences.activePlanIds, plan.id),
      activePlanId: options?.lead ? plan.id : preferences.activePlanId ?? plan.id,
    });
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


  function handleDuplicateCustomProgram(workoutTemplateId: string) {
    const template = workoutTemplates.find((item) => item.id === workoutTemplateId);
    if (!template) {
      return;
    }

    const draft = buildDuplicatedCustomProgramDraft(
      template.name,
      getWorkoutTemplateSessions(template.id),
      workoutTemplates.map((item) => item.name),
      preferences.appLanguage,
    );

    Promise.resolve(upsertWorkoutTemplate(draft))
      .then((nextWorkoutTemplateId) => {
        void haptics.success();
        navigate({ tab: 'workout', screen: 'program', programType: 'custom', workoutTemplateId: nextWorkoutTemplateId });
      })
      .catch((error) => {
        console.error('Failed to duplicate custom program', error);
        showToast(t(preferences.appLanguage, 'toast.workoutDuplicateFailed'));
      });
  }

  async function handleDeleteCustomWorkout(workoutTemplateId: string) {
    await deleteWorkoutTemplate(workoutTemplateId);
    void haptics.success();
    navigate(workoutHomeRoute);
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
        // hang the sessions on. The programme's own day count is a fact about
        // the thing the reader just picked, so the default rhythm for THAT
        // count beats a global fallback.
        const dayLabels = DEFAULT_RHYTHM_BY_DAYS[templateDaysPerWeek ?? 3] ?? DEFAULT_RHYTHM_BY_DAYS[3];
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

      // The ready path skips the About form, so every basic here is normally
      // null — that is fine and deliberate. Guided onboarding is the path that
      // fills them. No questionnaire ran either, so setup stays incomplete.
      await completeOnboarding({
        onboardingCompleted: true,
        setupCompleted: false,
        trainingFirstRunDismissed: false,
        profileName: aboutYouValues?.name ?? null,
        setupGender: aboutYouValues?.gender ?? null,
        setupHeightCm: aboutYouValues?.heightCm ?? null,
        setupCurrentWeightKg: aboutYouValues?.weightKg ?? null,
        // Kept as well as the plan: the recommendation is what the catalog
        // highlights on a later visit, the plan is what Home trains from.
        recommendedProgramId: programId,
        setupDaysPerWeek: templateDaysPerWeek,
        activePlanId: adoptedPlanId,
        activePlanIds: adoptedPlanId ? [adoptedPlanId] : [],
      });
      if (
        typeof aboutYouValues?.weightKg === 'number' &&
        aboutYouValues.weightKg > 0 &&
        database.bodyweightEntries.length === 0
      ) {
        await addBodyweightEntry(aboutYouValues.weightKg);
      }
      resetToRoute(ROOT_ROUTES.home);
    } finally {
      setBusySavingReadyPick(false);
    }
  }

  async function handleOnboardingSkip(destination: 'home' | 'programs' = 'home') {
    await completeOnboarding({
      onboardingCompleted: true,
      setupCompleted: false,
      trainingFirstRunDismissed: false,
      setupGoal: null,
      setupLevel: null,
      setupDaysPerWeek: null,
      setupEquipment: null,
      setupTrainingEnvironment: null,
      setupSecondaryOutcomes: [],
      setupFocusAreas: [],
      setupGuidanceMode: null,
      setupScheduleMode: null,
      setupWeeklyMinutes: null,
      setupAvailableDays: [],
        setupTrainingFeel: 'challenging',
        setupWorkoutVariety: 'balanced',
        setupFreeWeightsPreference: 'neutral',
        setupBodyweightPreference: 'neutral',
        setupMachinesPreference: 'neutral',
        setupShoulderFriendlySwaps: 'neutral',
        setupElbowFriendlySwaps: 'neutral',
        setupKneeFriendlySwaps: 'neutral',
        bodyweightGoalKg: null,
        recommendedProgramId: null,
    });
    if (destination === 'programs') {
      if (preferences.programsTabEnabled) {
        resetToRoute({ tab: 'workout', screen: 'programs_home' });
      } else {
        resetToRoute(ROOT_ROUTES.workout);
      }
      return;
    }
    navigate(ROOT_ROUTES.home);
  }

  /**
   * A photo of a programme, as the CSV text the paste box would have held.
   *
   * Every failure returns null on purpose: no network, no permission, an
   * unreadable photo and a photo of something else all leave the reader with
   * nothing to import, and the sheet says so in one sentence rather than
   * teaching them the difference.
   */
  async function handlePickProgramImage(): Promise<string | null> {
    const picked = await pickProgramImage();
    if (picked.status !== 'picked') {
      return null;
    }
    const rows = await requestProgramTableFromImage(picked.image);
    return rows && rows.length > 0 ? programTableToCsv(rows) : null;
  }

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

  function openRecommendedProgramDetail(recommendedProgramId: string) {
    replaceRoute({
      tab: 'workout',
      screen: 'program',
      programType: 'ready',
      workoutTemplateId: recommendedProgramId,
    });
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
    await saveOnboardingResult({
      preferences: {
        onboardingCompleted: true,
        ...buildSetupPreferencePatch(selection, recommendedProgramId, preferences.trainingCycle),
      },
      templateDraft: savedPlan.draft,
      // Session ids come from the template that was actually written, not from
      // the in-memory draft it was built from.
      buildPlan: (workoutTemplateId, sessionIds) =>
        buildSavedOnboardingWorkoutPlan(
          selection,
          workoutTemplateId,
          sessionIds,
          preferences.appLanguage,
        ),
      activate: (planId) => ({ activePlanId: planId }),
    });
    if (
      typeof selection.currentWeightKg === 'number' &&
      selection.currentWeightKg > 0 &&
      database.bodyweightEntries.length === 0
    ) {
      await addBodyweightEntry(selection.currentWeightKg);
    }
    // Onboarding ends here, on the app itself.
    //
    // Two paywalls have been removed from this seam. First the hop to the
    // standalone pro_offer screen, when the sale moved inside onboarding as
    // its last step; then that last step too (user 2026-08-24) — the reader
    // has just been handed a programme, and asking for money in the same
    // breath is the wrong moment. Both orphaned screens were deleted on
    // 2026-08-25; the Pro page in Profile is where the sale lives.
    resetToRoute(ROOT_ROUTES.home);
  }

  async function handleOnboardingCompleteToProgramDetail(
    selection: FirstRunSetupSelection,
    recommendedProgramId: string,
  ) {
    await persistSetupSelection(selection, recommendedProgramId);
    openRecommendedProgramDetail(recommendedProgramId);
  }

  async function handleOnboardingCompleteToCustom(
    selection: FirstRunSetupSelection,
    recommendedProgramId: string | null,
    prefillName: string,
  ) {
    await persistSetupSelection(selection, recommendedProgramId);
    navigate({ tab: 'workout', screen: 'editor', prefillName });
  }

  function handleOpenSetupEditor() {
    navigate({ tab: 'profile', screen: 'setup' });
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
    await saveOnboardingResult({
      preferences: {
        onboardingCompleted: true,
        ...buildSetupPreferencePatch(selection, recommendedProgramId, preferences.trainingCycle),
      },
      templateDraft: savedPlan.draft,
      // Session ids come from the template that was actually written, not from
      // the in-memory draft it was built from.
      buildPlan: (workoutTemplateId, sessionIds) =>
        buildSavedOnboardingWorkoutPlan(
          selection,
          workoutTemplateId,
          sessionIds,
          preferences.appLanguage,
        ),
      activate: (planId) => ({ activePlanId: planId }),
    });
    if (
      typeof selection.currentWeightKg === 'number' &&
      selection.currentWeightKg > 0 &&
      database.bodyweightEntries.length === 0
    ) {
      await addBodyweightEntry(selection.currentWeightKg);
    }
    void haptics.success();
    resetToRoute(ROOT_ROUTES.home);
  }

  async function handleSetupOpenProgramDetail(selection: FirstRunSetupSelection, recommendedProgramId: string) {
    await persistSetupSelection(selection, recommendedProgramId);
    void haptics.success();
    const template = getWorkoutTemplateById(recommendedProgramId);
    if (!template) {
      navigate(workoutHomeRoute);
      return;
    }

    openRecommendedProgramDetail(recommendedProgramId);
  }

  async function handleSetupBuildOwn(
    selection: FirstRunSetupSelection,
    recommendedProgramId: string | null,
    prefillName: string,
  ) {
    await persistSetupSelection(selection, recommendedProgramId);
    void haptics.success();
    navigate({ tab: 'workout', screen: 'editor', prefillName });
  }
  const customWorkoutRuntimeMap = useMemo(
    () =>
      Object.fromEntries(
        workoutTemplates.map((template) => {
          const sessions = getWorkoutTemplateSessions(template.id);
          return [
            template.id,
            adaptLegacyWorkoutTemplateToRuntimeTemplate(
              template,
              sessions,
              exerciseLibrary,
              preferences.defaultRestSeconds,
            ),
          ] as const;
        }),
      ),
    [exerciseLibrary, getWorkoutTemplateSessions, preferences.defaultRestSeconds, workoutTemplates],
  );

  const customWorkouts = useMemo(
    () =>
      [...workoutTemplates]
        .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
        .map((template) => ({
          id: template.id,
          name: template.name,
          sessionCount: getWorkoutTemplateSessions(template.id).length,
          exerciseCount: getWorkoutExercises(template.id).length,
          updatedAt: template.updatedAt,
          origin: template.origin,
        })),
    [getWorkoutExercises, getWorkoutTemplateSessions, workoutTemplates],
  );
  const programInsightsByTemplateId = useMemo(
    () =>
      buildProgramInsightMap({
        database,
        programs: [
          ...workout.templates.map((template) => ({
            id: template.id,
            name: template.name,
            sessions: template.sessions,
            weeklyTarget: template.daysPerWeek,
          })),
          ...Object.values(customWorkoutRuntimeMap).map((template) => ({
            id: template.id,
            name: template.name,
            sessions: template.sessions,
            weeklyTarget: template.sessions.length,
          })),
        ],
        unitPreference,
        activeSession: workout.activeSession,
      }),
    [database, customWorkoutRuntimeMap, unitPreference, workout.activeSession, workout.templates],
  );
  const recentCompletedCustomTemplateId = useMemo(
    () =>
      workout.history.sessions.find((session) => customWorkouts.some((workoutItem) => workoutItem.id === session.templateId))
        ?.templateId ?? null,
    [customWorkouts, workout.history.sessions],
  );
  const selectedCustomProgram = useMemo(
    () =>
      selectHomeCustomProgram({
        customWorkouts,
        activeSessionTemplateId: workout.activeSession?.templateId ?? null,
        hasActiveSession: Boolean(workout.activeSession),
        lastSelectedTemplateId: workout.history.lastSelectedTemplateId,
        recentCompletedCustomTemplateId,
      }),
    [customWorkouts, recentCompletedCustomTemplateId, workout.activeSession, workout.history.lastSelectedTemplateId],
  );
  const recentExerciseLibraryItems = useMemo(
    () =>
      getRecentExerciseLibraryItems({
        exerciseLibrary,
        exerciseLogs: database.exerciseLogs,
        workoutSessions: database.workoutSessions,
        exerciseTemplates: database.exerciseTemplates,
      }),
    [database.exerciseLogs, database.exerciseTemplates, database.workoutSessions, exerciseLibrary],
  );
  const recentExerciseBrowserItems = recentExerciseLibraryItems;
  const editorExerciseHistoryLookup = useMemo(
    () =>
      buildExerciseHistoryLookup({
        exerciseLogs: database.exerciseLogs,
        workoutSessions: database.workoutSessions,
        exerciseTemplates: database.exerciseTemplates,
        unitPreference,
      }),
    [database.exerciseLogs, database.exerciseTemplates, database.workoutSessions, unitPreference],
  );
  const exercisePrLookup = useMemo(
    () =>
      buildExercisePrLookup({
        exerciseLogs: database.exerciseLogs,
        workoutSessions: database.workoutSessions,
        exerciseTemplates: database.exerciseTemplates,
      }),
    [database.exerciseLogs, database.exerciseTemplates, database.workoutSessions],
  );
  const proEntitlement = resolveProEntitlement(preferences);
  const coachProUnlocked = proEntitlement.unlocked;

  /**
   * The coach demo moment that came due with this session, if one has.
   *
   * Free readers get three real coach answers per install, at day 7, 30 and
   * 90 — offered after a completed session so the log behind the answer is
   * fresh. Null for Pro, and null until the day and the session count both
   * come good. See lib/coachDemoMoments.
   */
  const coachDemoMoment = useMemo(
    () =>
      resolveDueCoachDemoMoment({
        firstLaunchAt: preferences.firstLaunchAt,
        usedMoments: preferences.coachDemoMomentsUsed,
        proUnlocked: coachProUnlocked,
        sessionCount: database.workoutSessions.length,
        lifts: proLiftHistories,
        fatigueSignal: proFatigue?.confident ? proFatigue.signal : null,
      }),
    [
      coachProUnlocked,
      database.workoutSessions.length,
      preferences.coachDemoMomentsUsed,
      preferences.firstLaunchAt,
      proFatigue,
      proLiftHistories,
    ],
  );
  const coachDemoQuestion = coachDemoMoment
    ? t(preferences.appLanguage, coachDemoMoment.questionKey, coachDemoMoment.vars)
    : null;

  /**
   * The coach's long memory, read once at startup.
   *
   * Failures are already swallowed by the store, so this cannot reject: the
   * worst case is an empty list, which is exactly what a reader who has never
   * asked a question has.
   */
  useEffect(() => {
    let cancelled = false;
    loadCoachAdviceMemory().then((stored) => {
      if (cancelled) {
        return;
      }
      const at = new Date().toISOString();
      setCoachAdviceMemory((current) => {
        // Merged, not assigned. An answer recorded before this read resolves
        // would otherwise be overwritten by the older stored list — and the
        // list it overwrote would already have been written back over the
        // stored one, losing both halves.
        const merged = mergeCoachAdviceMemory(stored, current, at);
        // Expiry runs on write, so a phone that has not asked the coach
        // anything in a month still carries the whole file. Pruning it here is
        // what makes "deleted as it ages past three weeks" true for a reader
        // who stopped asking rather than kept asking.
        if (merged.length !== stored.length) {
          void saveCoachAdviceMemory(merged);
        }
        return merged;
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Remember one answer.
   *
   * State and disk are written from the same computed value rather than the
   * write being derived from state again, so two answers in quick succession
   * cannot store a list that skips the first. Pruning of expired lines happens
   * inside rememberCoachAdvice, on every write.
   */
  /**
   * Erase everything, the coach's memory included.
   *
   * resetDatabase clears the memory's key on disk, but this component is not
   * remounted by a reset: without this the state would still hold every
   * takeaway, hand them to the next question, and write them straight back.
   */
  const handleResetAllData = useCallback(async () => {
    await resetAllData();
    setCoachAdviceMemory([]);
  }, [resetAllData]);

  const handleCoachAdviceGiven = useCallback((takeaway: string) => {
    // Stamped once, outside the updater: React may invoke an updater more than
    // once, and a clock read inside it would make two invocations disagree.
    const at = new Date().toISOString();
    setCoachAdviceMemory((current) => {
      const next = rememberCoachAdvice(current, takeaway, at);
      void saveCoachAdviceMemory(next);
      return next;
    });
  }, []);

  // Seven days out. There is no billing, so this is the demo story the paywall
  // already tells rather than a date anything will act on.
  const premiumTrialEndsAt = useMemo(() => {
    const end = new Date();
    end.setDate(end.getDate() + 7);
    return end.toISOString();
  }, []);
  const analysisSessionId = route.tab === 'home' && route.screen === 'analysis' ? route.sessionId : null;
  // The AI tab's written-analysis entry needs the most recent session that has
  // enough logged sets to analyse. Only built while the chat is open.
  const coachLastSession = useMemo(() => {
    if (!(route.tab === 'home' && route.screen === 'ai_chat')) {
      return null;
    }
    const modules = buildCoachModules({
      sessions: workoutSessions,
      logs: database.exerciseLogs,
      language: preferences.appLanguage,
    });
    return modules.analysis
      ? { id: modules.analysis.sessionId, name: modules.analysis.caption }
      : null;
  }, [database.exerciseLogs, preferences.appLanguage, route, workoutSessions]);
  const availableEquipmentForDrills = useMemo(
    () =>
      resolveAvailableEquipment({
        trainingEnvironment: preferences.setupTrainingEnvironment,
        equipmentItems: preferences.setupEquipmentItems,
      }),
    [preferences.setupTrainingEnvironment, preferences.setupEquipmentItems],
  );
  /**
   * Warm-up and cool-down cost for a session, from the same blocks the player
   * runs — so Home's "~50 min" and the guided entry's "~50 min" are the same
   * arithmetic on the same inputs, not two guesses that happen to be close.
   */
  const routineBlockSeconds = useCallback(
    (focus: SessionFocusKind) => ({
      warmupSeconds: estimateRoutineBlockSeconds(
        getDefaultWarmup(
          focus,
          preferences.appLanguage,
          availableEquipmentForDrills,
          preferences.routineDrillOverrides,
        ),
      ),
      cooldownSeconds: estimateRoutineBlockSeconds(
        getDefaultCooldown(
          focus,
          preferences.appLanguage,
          availableEquipmentForDrills,
          preferences.routineDrillOverrides,
        ),
      ),
    }),
    [preferences.appLanguage, availableEquipmentForDrills, preferences.routineDrillOverrides],
  );
  // Both used to depend on the whole preferences object, so a theme or sound
  // toggle handed them a new object and they rebuilt — and everything
  // downstream of the setup selection (the recommendation, the programme
  // rankings, the goal-programme suggestions) rebuilt with them. Measured: that
  // chain was the ~4.9s behind every settings switch. A key over the fields
  // each one actually reads is what "changed" should have meant all along.
  const setupSelectionKey = JSON.stringify([
    preferences.automatedProgressionEnabled, preferences.bodyweightGoalKg, preferences.profileName,
    preferences.setupAge, preferences.setupAgeRange, preferences.setupAvailableDays,
    preferences.setupCautionFlags, preferences.setupCompleted, preferences.setupCurrentWeightKg,
    preferences.setupDaysPerWeek, preferences.setupEquipment, preferences.setupEquipmentItems,
    preferences.setupFocusAreas, preferences.setupGender, preferences.setupGoal, preferences.setupGoals,
    preferences.setupGuidanceMode, preferences.setupHeightCm, preferences.setupLevel,
    preferences.setupScheduleMode, preferences.setupSecondaryOutcomes, preferences.setupTrainingEnvironment,
    preferences.setupWeeklyMinutes, preferences.unitPreference,
  ]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const setupSelection = useMemo(() => buildSetupSelectionFromPreferences(preferences), [setupSelectionKey]);
  const tailoringKey = JSON.stringify([
    preferences.setupBodyweightPreference, preferences.setupElbowFriendlySwaps, preferences.setupEquipment,
    preferences.setupFreeWeightsPreference, preferences.setupKneeFriendlySwaps, preferences.setupMachinesPreference,
    preferences.setupShoulderFriendlySwaps,
  ]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tailoringPreferences = useMemo(() => buildTailoringPreferences(preferences), [tailoringKey]);
  const setupRecommendation = useMemo(
    () => (setupSelection ? resolveFirstRunRecommendationWithTailoring(setupSelection, tailoringPreferences) : null),
    [setupSelection, tailoringPreferences],
  );
  const currentFitReadyTemplate = useMemo(
    () => (setupRecommendation?.featuredProgramId ? getWorkoutTemplateById(setupRecommendation.featuredProgramId) : null),
    [setupRecommendation?.featuredProgramId],
  );
  const recommendedReadyTemplate = useMemo(
    () => (preferences.recommendedProgramId ? getWorkoutTemplateById(preferences.recommendedProgramId) : null),
    [preferences.recommendedProgramId],
  );
  const recommendedReadyContent = useMemo(
    () => (recommendedReadyTemplate ? getReadyProgramContent(recommendedReadyTemplate.id, preferences.appLanguage) : null),
    [recommendedReadyTemplate],
  );
  const homeActivePlanCard = useMemo(() => {
    const completedPlanSessions = getCanonicalCompletedSessions(database);
    // Local midnight, to date the reader's hand-picked session against. Read
    // once per rebuild rather than per session, and local rather than UTC —
    // the same midnight the calendar and the widget mean.
    const now = new Date();
    const todayDayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
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
      const nextSessionIndex = resolveNextPlanEntryIndex(sortedEntries, completedPlanSessions);
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
      const nextSession = pickedToday ?? homeSessions[nextSessionIndex] ?? homeSessions[0] ?? null;
      if (activeTemplate && nextSession) {
        const estimatedDuration = Number.parseInt(nextSession.duration.replace(/\D/g, ''), 10) || 20;
        const planTemplateIds = new Set(sortedEntries.map((entry) => entry.workoutTemplateId));
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
          activeWorkoutPlan.id.startsWith('onboarding_plan_') && setupSelection && preferences.recommendedProgramId
            ? composeProgramWeekForSelection(setupSelection, preferences.recommendedProgramId)?.weeks
            : undefined;
        // The demo tester's block is one week by construction — see
        // handleCreateDemoCompletionProgram.
        const demoBlockWeeks = activeWorkoutPlan.id.startsWith('demo_plan_') ? 1 : undefined;
        const planProgress = buildHomePlanProgress({ language: preferences.appLanguage,
          completedSessions: completedSessionCount,
          sessionsPerWeek: sortedEntries.length,
          totalWeeks: demoBlockWeeks ?? onboardingBlockWeeks,
        });

        return {
          programId: activeTemplate.id,
          programType: activePlanProgramType,
          // The plan's own templates, so every counter that says "of this
          // plan" can agree on what that means. The week counter used to read
          // all sessions in the week and filled the programme's week with
          // freestyle workouts.
          planTemplateIds: [...planTemplateIds],
          eyebrow: `${sortedEntries.length} day custom plan`,
          goalLabel: formatGoalLabel(preferences.aiPlannerGoal || preferences.setupGoal || 'general'),
          title: formatWorkoutDisplayLabel(activeWorkoutPlan.name || activeTemplate.name, 'Workout plan'),
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

          // The catalog lookup, not the DB one: a custom template has no goal
          // or level for affinity to compare, so its card simply offers no
          // step up. Restart is real here — a plan record exists to reset.
          completion: buildCompletion(
            activeWorkoutPlan.id,
            planProgress.sessionsDone,
            planProgress.sessionsTotal,
            getWorkoutTemplateById(firstEntry.workoutTemplateId),
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
  }, [database.workoutPlans, database.workoutSessions, database.exerciseLogs, exerciseLibrary, getWorkoutTemplateSessions, preferences.activePlanId, preferences.aiPlannerGoal, preferences.dismissedCompletionPlanIds, preferences.recommendedProgramId, preferences.setupGoal, preferences.todaySession, recommendedReadyContent, recommendedReadyTemplate, setupSelection, workoutTemplates]);
  // The AI tab's opening state. Deterministic, so the most valuable-looking
  // part of the coach costs nothing to render and works offline.
  const progressWeeklyTarget = Number.parseInt(homeActivePlanCard?.sessionsPerWeek ?? '', 10) || null;
  // "Your cards" on Home: full catalog computed once, pins resolved from prefs.
  const homeStatCardSources = useMemo(
    () => ({
      bodyweightEntries: database.bodyweightEntries,
      measurementEntries: database.measurementEntries,
      trackedProgress,
    }),
    [database.bodyweightEntries, database.measurementEntries, trackedProgress],
  );
  const homeStatCatalogCards = useMemo(
    () =>
      buildHomeStatCards(
        buildHomeStatCardCatalog(homeStatCardSources).map((item) => item.key),
        homeStatCardSources,
        preferences.appLanguage,
      ),
    [homeStatCardSources, preferences.appLanguage],
  );
  const homePinnedStatCardKeys = useMemo(
    () => resolveHomeStatCardKeys(preferences.homeStatCardKeys),
    [preferences.homeStatCardKeys],
  );
  /**
   * The ONE prompt card Home may show (design frame 15). The suggester and
   * the sign-in offer used to render independently and stacked; the queue
   * decides, and the props below go quiet for whichever card is not up.
   */
  const homeSuggestedStatCardKeys = suggestHomeStatCardKeys({
    focusAreas: preferences.setupFocusAreas,
    goals: [preferences.setupGoal, ...preferences.setupGoals],
    pinnedKeys: homePinnedStatCardKeys,
    dismissedKeys: preferences.dismissedCardSuggestionKeys,
  });
  const homePrompt = resolveHomePrompt({
    signInAvailable: accountBackup.available && accountBackup.state.status === 'signed_out',
    signInDismissed: preferences.accountBackupPromptDismissed,
    loggedSessionCount: database.workoutSessions.length + database.cardioSessions.length,
    suggestionKey: homeSuggestedStatCardKeys[0] ?? null,
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
    const now = new Date();
    const weekStart = getStartOfWeek(now).getTime();
    const weekEnd = getEndOfWeek(now).getTime();
    const ids = new Set<string>();
    for (const session of workoutSessions) {
      const stamp = Date.parse(session.performedAt);
      if (!Number.isFinite(stamp) || stamp < weekStart || stamp >= weekEnd) {
        continue;
      }
      if (session.workoutTemplateSessionId) {
        ids.add(session.workoutTemplateSessionId);
      }
    }
    return [...ids];
  }, [workoutSessions]);

  const homeTrainingSchedule = useMemo(() => {
    const cycle = preferences.trainingCycle;
    return cycle ? cycleSchedule(cycle.pattern, cycle.anchorDayStart) : weekdaySchedule(homeTrainingDayIndexes);
  }, [homeTrainingDayIndexes, preferences.trainingCycle]);
  const aiCoachTrainingContext = useMemo(
    () =>
      buildAiTrainingContext({
        unitPreference,
        activeWorkoutSummary: homeActiveWorkoutSummary,
        homeSummary,
        workoutSessions,
        exerciseLogs: database.exerciseLogs,
        trackedProgress,
        readyProgramCount: workout.templates.length,
        recommendedProgramId: preferences.recommendedProgramId,
        recommendedProgramTitle: preferences.recommendedProgramId
          ? formatWorkoutDisplayLabel(getWorkoutTemplateById(preferences.recommendedProgramId)?.name)
          : null,
        customProgramTitle: selectedCustomProgram.workoutId
          ? formatWorkoutDisplayLabel(selectedCustomProgram.title)
          : null,
        // The week itself, from Home's own composed card. A title alone made
        // the coach answer "I cannot see your programme's exercises in this
        // data" to a reader one tap away from the list (#bugs 2026-08-25).
        programme: buildAiCoachProgramme(homeActivePlanCard),
        // The plan's real rhythm — cycle or weekdays — so planned-versus-actual
        // and "next training day" cannot disagree with Home. Availability alone
        // told a 2-on-1-off reader their schedule was mon-wed-thu (2026-08-23).
        trainingDays: preferences.setupAvailableDays,
        schedule: homeTrainingSchedule,
        // The body record and goals: without these a chest-growth or nutrition
        // question got a training summary (transcript review, 23.8.).
        bodyweightEntries: database.bodyweightEntries,
        measurementEntries: database.measurementEntries,
        coachGoals: preferences.coachGoals,
        primaryGoalId: preferences.primaryGoalId,
        bodyweightGoalKg: preferences.bodyweightGoalKg,
        // What the coach already said, so it stops repeating itself across
        // conversations (lib/coachAdviceMemory).
        coachMemory: coachAdviceMemory,
        profile: {
          heightCm: preferences.setupHeightCm,
          age: preferences.setupAge,
          gender: preferences.setupGender,
        },
        // What Home already carries, and what the coach must not bring up:
        // an offer for something already on is the sign explaining a sign.
        homeState: {
          pinnedStatCardKeys: homePinnedStatCardKeys,
          weighInReminderEnabled: preferences.notificationPrefs.weighInReminder,
          silencedSuggestions: silencedSuggestionKinds(preferences.coachSuggestionState),
        },
        plannerSetup: preferences.aiSetupCompleted
          ? {
              goal: preferences.aiPlannerGoal,
              daysPerWeek: preferences.aiPlannerDaysPerWeek,
              experience: preferences.aiPlannerExperience,
              sessionMinutes: preferences.aiPlannerSessionMinutes,
              equipment: preferences.aiPlannerEquipment,
              recovery: preferences.aiPlannerRecovery,
              mustInclude: preferences.aiPlannerMustInclude
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean),
              avoid: preferences.aiPlannerAvoid
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean),
              limitations: preferences.aiPlannerLimitations
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean),
            }
          : null,
      }),
    [
      homeActiveWorkoutSummary,
      homeActivePlanCard,
      homeSummary,
      selectedCustomProgram.title,
      selectedCustomProgram.workoutId,
      trackedProgress,
      unitPreference,
      database.bodyweightEntries,
      database.measurementEntries,
      preferences.coachGoals,
      preferences.primaryGoalId,
      coachAdviceMemory,
      homePinnedStatCardKeys,
      preferences.coachSuggestionState,
      preferences.notificationPrefs.weighInReminder,
      preferences.bodyweightGoalKg,
      preferences.setupHeightCm,
      preferences.setupAge,
      preferences.setupGender,
      preferences.aiSetupCompleted,
      preferences.aiPlannerGoal,
      preferences.aiPlannerDaysPerWeek,
      preferences.aiPlannerExperience,
      preferences.aiPlannerSessionMinutes,
      preferences.aiPlannerEquipment,
      preferences.aiPlannerRecovery,
      preferences.aiPlannerMustInclude,
      preferences.aiPlannerAvoid,
      preferences.aiPlannerLimitations,
      preferences.recommendedProgramId,
      preferences.setupAvailableDays,
      homeTrainingSchedule,
      workout.templates.length,
      workoutSessions,
      database.exerciseLogs,
    ],
  );
  // Only a session the schedule actually puts on TODAY is "on the plan
  // today". The next session in the rotation used to be named regardless, so
  // the coach opened a rest day with "Upper is on the plan today — walk
  // through it?" (#bugs, 2026-08-23). On a rest day the coach says so and
  // names what comes next.
  const coachChatIntro = useMemo(
    () => ({
      // Focus, not the ordinal: the coach's line has the day in it already
      // ("today", "next on the plan"), so "Päivä 1:" pushed the real name past
      // the edge and it arrived as "Koko keho + H..." (user, 2026-08-25).
      todaySessionTitle:
        homeActivePlanCard?.nextSession && trainsOn(homeTrainingSchedule, new Date())
          ? localizeSessionFocus(
              formatWorkoutDisplayLabel(homeActivePlanCard.nextSession.title),
              preferences.appLanguage,
            )
          : null,
      nextSessionTitle: homeActivePlanCard?.nextSession
        ? localizeSessionFocus(
            formatWorkoutDisplayLabel(homeActivePlanCard.nextSession.title),
            preferences.appLanguage,
          )
        : null,
      sessionsThisWeek: homeSummary.streak.sessionsThisWeek,
      weeklyRead: proWeeklyRead,
      fatigue: proFatigue,
      // The one opening that had nothing to offer. The chat can build a week
      // from a sentence now, and this is the reader that needs to know.
      hasProgramme: Boolean(homeActivePlanCard),
    }),
    [homeActivePlanCard, homeSummary.streak.sessionsThisWeek, homeTrainingSchedule, preferences.appLanguage, proFatigue, proWeeklyRead],
  );
  /**
   * Home must never say "find a programme" while one is running.
   *
   * Removing the lead already promotes the next in line, but that is one path
   * of several that can empty `activePlanId` — a season leaving, a plan record
   * being rewritten, a stored value from an older build. Rather than chase each
   * one, the invariant is repaired wherever it broke: a held programme with no
   * lead becomes the lead.
   */
  useEffect(() => {
    if (!appHydrated || preferences.activePlanId) {
      return;
    }
    const held = preferences.activePlanIds.find((planId) =>
      database.workoutPlans.some((plan) => plan.id === planId),
    );
    if (held) {
      void updatePreferences({ activePlanId: held });
    }
  }, [appHydrated, database.workoutPlans, preferences.activePlanId, preferences.activePlanIds, updatePreferences]);

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
    // Also the day's app_open: the same foreground moment the widget check
    // uses. Daily actives and D2/D7 retention are counted from these.
    trackEvent('app_open');
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void refresh();
        trackEvent('app_open');
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
  const setupHandoffReady =
    preferences.onboardingCompleted && !preferences.setupHandoffCompleted && homeWidgetState !== null;
  const setupHandoffPlan = useMemo(
    () =>
      setupHandoffReady
        ? planSetupHandoff({
            canOfferWidget: Boolean(homeWidgetState?.supported) && !homeWidgetState?.added,
            pinnedCardKeys: homePinnedStatCardKeys,
            focusAreas: preferences.setupFocusAreas,
            canOfferAccountBackup: accountBackup.available && accountBackup.state.status === 'signed_out',
          })
        : null,
    [accountBackup.available, accountBackup.state.status, homePinnedStatCardKeys, homeWidgetState, preferences.setupFocusAreas, setupHandoffReady],
  );
  const setupHandoffActive = setupHandoffPlan?.shouldShow ?? false;

  // Nothing left to offer — a reader running onboarding a second time. Close the
  // door rather than leave it to open on some later launch.
  useEffect(() => {
    if (setupHandoffReady && setupHandoffPlan && !setupHandoffPlan.shouldShow) {
      void updatePreferences({ setupHandoffCompleted: true });
    }
  }, [setupHandoffPlan, setupHandoffReady, updatePreferences]);

  /**
   * The whole sign-in conversation: outcome toasts, and the one dialog that
   * appears when both the phone and the cloud hold data. Shared by the
   * hand-off card and the Settings row so both tell the same story.
   */
  const handleAccountSignIn = useCallback(async () => {
    const language = preferences.appLanguage;
    const outcome = await accountBackup.signIn();
    if (outcome.kind === 'backed_up') {
      // No toast. The backup row states the result better than a bar can: it
      // carries the account and, in green, when the cloud copy was written.
      // A pill saying "Varmuuskopioitu" over a row that already says
      // "juuri nyt" is the class of message the reader has asked to be rid of
      // four times (#bugs 2026-08-26, prio 1).
      return outcome.kind;
    }
    if (outcome.kind === 'restored') {
      showToast(t(language, 'account.restore.restored'));
      return outcome.kind;
    }
    if (outcome.kind === 'failed') {
      showToast(t(language, 'account.signInFailed'));
      return outcome.kind;
    }
    if (outcome.kind === 'unavailable') {
      showToast(t(language, 'account.signInUnavailable'));
      return outcome.kind;
    }
    if (outcome.kind !== 'choice') {
      // Cancelled: the reader changed their mind, and that is not an error.
      return outcome.kind;
    }
    const summary = outcome.summary;
    Alert.alert(
      t(language, 'account.restore.title'),
      t(language, 'account.restore.body', {
        date: new Date(summary.exportedAt).toLocaleDateString(),
        workouts: String(summary.workoutCount),
        programs: String(summary.customProgramCount),
      }),
      [
        {
          text: t(language, 'account.restore.keepLocal'),
          onPress: () => {
            void accountBackup.resolveRestoreChoice('keep_local').then((ok) => {
              // Only the failure speaks. Success is the row's green timestamp.
              if (!ok) {
                showToast(t(language, 'account.backupFailed'));
              }
            });
          },
        },
        {
          text: t(language, 'account.restore.useBackup'),
          style: 'destructive',
          onPress: () => {
            void accountBackup.resolveRestoreChoice('restore').then((ok) => {
              if (ok) {
                showToast(t(language, 'account.restore.restored'));
              }
            });
          },
        },
      ],
      // Dismissing would leave the pending choice dangling with no way back.
      { cancelable: false },
    );
    return outcome.kind;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountBackup, preferences.appLanguage]);

  const handleSetupHandoffDone = async (choices: SetupHandoffChoices) => {
    const patch: Partial<AppPreferences> = { setupHandoffCompleted: true };
    // Asked here, so Home's one-time card must not ask again. Settings keeps its
    // permanent row either way.
    if (setupHandoffPlan?.offerWidget) {
      patch.homeWidgetPromptDismissed = true;
    }
    const pinned = [...homePinnedStatCardKeys];
    if (choices.pinTrackingCard && setupHandoffPlan?.tracking) {
      pinned.push(setupHandoffPlan.tracking.cardKey);
    }
    if (choices.pinBodyweightCard && setupHandoffPlan?.offerBodyweight && !pinned.includes('bodyweight')) {
      pinned.push('bodyweight');
    }
    if (pinned.length !== homePinnedStatCardKeys.length) {
      patch.homeStatCardKeys = pinned;
    }
    await updatePreferences(patch);
    // The system dialog last, so it is not racing a state write.
    if (choices.addWidget) {
      await requestPinHomeWidget();
    }
    // And sign-in after that: it opens its own sheet, and the reader asked for
    // it — a cancel there is a change of mind, not an error.
    if (choices.signInForBackup) {
      await handleAccountSignIn();
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
  const widgetCompletedDayStarts = useMemo(
    () =>
      getRecentActivityStrip(database, new Date(), 45)
        .filter((day) => day.active)
        .map((day) => day.dayStart),
    [database],
  );
  // This month's totals, for the three figures the 4x2 draws beside the
  // calendar, and the streak the 2x1 counts.
  const widgetMonthTotals = useMemo(() => getMonthTrainingTotals(database), [database]);

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
        // Home's own answer for today, so the launcher cannot name a different
        // workout than the screen the reader just left.
        todaySessionId: homeActivePlanCard?.nextSession.id ?? null,
        completedDayStarts: widgetCompletedDayStarts,
        completedWorkoutDayStarts: widgetCompletedWorkoutDayStarts,
        sessions: homeActivePlanCard?.sessions ?? [],
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
            weekNumber: homeActivePlanCard?.currentWeek ?? null,
          })
        : null,
    [
      analysisSessionId,
      database.exerciseLogs,
      homeActivePlanCard?.currentWeek,
      preferences.appLanguage,
      workoutSessions,
    ],
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
  const guidedEntryEyebrow = useMemo(() => {
    const weekday = t(preferences.appLanguage, `guided.weekday.${new Date().getDay()}` as I18nKey);
    const week = homeActivePlanCard?.currentWeek;
    return week ? t(preferences.appLanguage, 'guided.entry.eyebrow', { weekday, week }) : weekday;
  }, [homeActivePlanCard?.currentWeek, preferences.appLanguage]);
  /**
   * Sessions logged this week, and the label above them.
   *
   * `done` is deliberately NOT part of this: the two screens that show it sit
   * on opposite sides of the save. The guided player's finish view renders
   * before the session is written, so it has to add the one in hand; the
   * summary renders after, where the same +1 counted it twice and printed
   * "2/1" beside a Home that said 1/1. One base, two honest readings.
   */
  const weekProgressBase = useMemo(() => {
    if (!progressWeeklyTarget) {
      return null;
    }
    const now = new Date();
    const weekStart = getStartOfWeek(now);
    const weekEnd = getEndOfWeek(now);
    // Only the plan's own sessions. This counted every session in the week,
    // and the label above it names the programme's week while the denominator
    // is the programme's days per week — so two freestyle workouts read as
    // "VIIKKO 1 · 2/2" against a programme neither of them touched.
    const savedThisWeek = countPlanSessionsInRange(
      workoutSessions,
      new Set(homeActivePlanCard?.planTemplateIds ?? []),
      weekStart.getTime(),
      weekEnd.getTime(),
    );
    return {
      weekLabel: homeActivePlanCard
        ? t(preferences.appLanguage, 'guided.finish.week', { week: homeActivePlanCard.currentWeek })
        : t(preferences.appLanguage, 'guided.finish.thisWeek'),
      savedThisWeek,
      target: progressWeeklyTarget,
    };
  }, [homeActivePlanCard, preferences.appLanguage, progressWeeklyTarget, workoutSessions]);

  /** Before the save: the session in hand is not in the log yet. */
  const guidedWeekProgress = weekProgressBase
    ? {
        weekLabel: weekProgressBase.weekLabel,
        done: weekProgressBase.savedThisWeek + 1,
        target: weekProgressBase.target,
      }
    : null;

  /** After the save: the log already contains it. */
  const completionWeekProgress = weekProgressBase
    ? {
        weekLabel: weekProgressBase.weekLabel,
        done: weekProgressBase.savedThisWeek,
        target: weekProgressBase.target,
      }
    : null;
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
  const homeAiPromptSuggestions = useMemo(
    () =>
      setupSelection
        ? buildFirstRunPromptSuggestions(setupSelection, recommendedReadyTemplate?.name ?? null)
        : DEFAULT_HOME_AI_PROMPT_SUGGESTIONS,
    [recommendedReadyTemplate?.name, setupSelection],
  );
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
   * NOT labelled AI, deliberately. aiInfo.never.2 states that the model is
   * "never used to pick your programme — that is a scored, testable decision",
   * and it is: recommendationScoring plus a waterfall, covered by tests. An AI
   * badge here would contradict the app's own privacy page.
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
        adoptedIds: activeProgramTemplateIds,
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
  /**
   * Your bests, from the tracked lifts' own logs.
   *
   * Built through getComparableLogSets so the records agree with every other
   * number the app derives from a set — a second reader would drift the first
   * time the legacy shape came up.
   */
  const recordSources = useMemo(
    () => {
      const bodyPartByName = new Map(
        exerciseBrowserItems.map((item) => [item.name.trim().toLowerCase(), item.bodyPart]),
      );
      return trackedProgress.map((summary) => ({
        key: summary.key,
        name: summary.name,
        bodyPart: bodyPartByName.get(summary.name.trim().toLowerCase()) ?? null,
        entries: summary.logs.map((log) => ({
          performedAt: log.performedAt,
          sets: getComparableLogSets(log).map((set) => ({ weight: set.weight, reps: set.reps })),
        })),
      }));
    },
    [exerciseBrowserItems, trackedProgress],
  );
  const personalRecords = useMemo(
    () => ({
      weight: resolveRecords(recordSources, 'weight'),
      reps: resolveRecords(recordSources, 'reps'),
      volume: resolveRecords(recordSources, 'volume'),
    }),
    [recordSources],
  );

  /** Lifts holding a record, counted once no matter how many kinds. */
  const distinctRecordCount = useMemo(
    () =>
      new Set([
        ...personalRecords.weight.map((record) => record.key),
        ...personalRecords.reps.map((record) => record.key),
        ...personalRecords.volume.map((record) => record.key),
      ]).size,
    [personalRecords],
  );

  /** The day each lift first held a record — the same lifts distinctRecordCount counts. */
  const recordDates = useMemo(() => firstRecordDates(personalRecords), [personalRecords]);
  // Keyed on the four tables the facts read, not the whole database: a theme
  // or language toggle replaces the database object without touching a log,
  // and this is a full pass over every set. `lifetimeSummary` is itself keyed
  // on the whole database, so depending on the object would have undone the
  // narrowing — only the one field this reads is a dependency.
  const milestoneFacts = useMemo(
    () => getMilestoneFacts(database, lifetimeSummary, recordDates),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      database.workoutSessions,
      database.exerciseLogs,
      database.cardioSessions,
      database.bodyweightEntries,
      lifetimeSummary.currentWeekStreak,
      recordDates,
    ],
  );
  const milestoneLedger = useMemo(() => buildMilestoneLedger(milestoneFacts, unitPreference), [milestoneFacts, unitPreference]);

  const programsSeasonTileCounts = useMemo(
    () => ({
      winter: getSeasonProgramIds('winter').length,
      summer: getSeasonProgramIds('summer').length,
    }),
    [],
  );
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

  const libraryNames = useMemo(() => exerciseLibrary.map((item) => item.name), [exerciseLibrary]);

  /**
   * The lifts the target flow can aim at, and what the log says about each.
   *
   * The named eight, not the library. Nobody says "I want to cable-crossover
   * 30 kg" — see STRENGTH_GOAL_PRESETS for the list and why sumo is not on it.
   * Offering all 876 also broke the promise behind every target: step 3 shows
   * the programme that trains the lift, and for most of the library there is
   * none.
   *
   * The log is read through `isSameLift`, not by name, so a "Barbell Bench
   * Press" in the log finds the row for "Barbell Bench Press - Medium Grip".
   * Matching on the name is how the target row once read 70 kg of 200 while
   * the picker behind it said "not logged yet" for the same lift.
   */
  const goalFlowLifts = useMemo<GoalFlowLift[]>(() => {
    const now = Date.now();
    return STRENGTH_GOAL_PRESETS.map((preset) => {
      // The target already set for this lift, so the flow can say so instead
      // of replacing it in silence.
      const targetKg =
        preferences.strengthGoals.find((goal) =>
          isSameLift(goal.exerciseName, preset.exerciseName, libraryNames),
        )?.targetKg ?? null;
      const history = proLiftHistories.find((entry) =>
        isSameLift(entry.name, preset.exerciseName, libraryNames),
      );
      if (!history || !(history.bestWeightKg > 0)) {
        return {
          exerciseName: preset.exerciseName,
          targetKg,
          bestKg: null,
          rate: null,
          lastLoggedAt: null,
          daysSinceLogged: null,
        };
      }
      return {
        exerciseName: preset.exerciseName,
        targetKg,
        bestKg: history.bestWeightKg,
        rate: resolveObservedRate(history.points),
        lastLoggedAt: history.latest.time,
        daysSinceLogged: Math.max(0, Math.round((now - history.latest.time) / 86_400_000)),
      };
    });
  }, [libraryNames, preferences.strengthGoals, proLiftHistories]);

  /**
   * The programme the flow would put the reader on, for one lift.
   *
   * A real catalog programme, ranked by how central the lift is in it and how
   * well it fits the reader's week — not a generated one. The composer that
   * writes weeks from scratch has invented exercise names in this app before,
   * and a target's programme is the last place that should happen.
   *
   * PRIMARY only. A programme that touches the lift as an accessory is not a
   * programme that goes where the target goes, and offering one would be the
   * "any answer beats no answer" failure the goal coverage layer already
   * refuses.
   */
  const getGoalProposal = useCallback(
    (exerciseName: string): GoalFlowProposal | null => {
      const ranked = rankProgrammesForLift(WORKOUT_TEMPLATES_V1, exerciseName, {
        libraryNames,
        reader: { level: preferences.setupLevel, daysPerWeek: preferences.setupDaysPerWeek },
      });
      /*
       * A strength target wants a strength programme.
       *
       * rankProgrammesForLift orders by how central the lift is and then by
       * how well the week fits the reader — which it should, it serves the
       * browse surfaces too. It knows nothing about goalType, so "squat 140
       * kg" came back as SHRED Elite: a five-day conditioning block that
       * happens to squat on day one and happens to match a five-day reader.
       * Six programmes were tied at one squat day and the fat-loss one won on
       * calendar fit alone.
       *
       * Among the primary matches, the ones built for strength go first. Order
       * within each group is the ranker's, so the reader's week still decides
       * between two strength programmes.
       */
      const primary = ranked.filter((match) => match.primary);
      const best =
        primary.find((match) => getWorkoutTemplateById(match.id)?.goalType === 'strength') ??
        primary[0];
      const template = best ? getWorkoutTemplateById(best.id) : null;
      if (!best || !template) {
        return null;
      }

      const days = template.sessions.map((session) => ({
        sessionId: session.id,
        name: formatWorkoutDisplayLabel(session.name),
        // The first three lifts, which is what the reader is deciding on. The
        // screen joins nothing: a card that composes its own sentence is a
        // card that can compose one the programme does not contain.
        lead: session.exercises
          .slice(0, 3)
          .map(
            (exercise) =>
              `${exerciseNameLabel(preferences.appLanguage, exercise.exerciseName)} ${exercise.sets}×${exercise.repsMin}`,
          )
          .join(' · '),
        trainsTarget: session.exercises.some((exercise) =>
          isSameLift(exercise.exerciseName, exerciseName, libraryNames),
        ),
      }));

      return {
        templateId: template.id,
        programmeName: getReadyTemplatePresentation(template, preferences.appLanguage).title,
        daysPerWeek: template.daysPerWeek,
        minutes: template.estimatedSessionDuration,
        blockWeeks: getReadyProgramBlockWeeks(template),
        days,
        targetDays: days.filter((day) => day.trainsTarget).length,
      };
    },
    [libraryNames, preferences.appLanguage, preferences.setupDaysPerWeek, preferences.setupLevel],
  );

  /**
   * Accepting the proposal: the target is stored and the programme is taken on.
   *
   * Both, in that order, and the adoption is what the reader watches for — a
   * target with no programme behind it was the thing feedback round 2 asked to
   * end. Adoption owns the cap: full on the free tier routes to the paywall,
   * full on Pro says so, and neither is this screen's business.
   */
  async function handleAcceptTargetProposal(input: {
    exerciseName: string;
    targetKg: number;
    templateId: string;
  }) {
    // The programme FIRST, and the target only if it landed.
    //
    // Stored first, a refused adoption left the reader with exactly the thing
    // this flow exists to end: a target and nothing going towards it. The cap
    // refuses for real — three programmes on the free tier sends them to the
    // paywall — and that is not a moment to have quietly written a goal.
    const adopted = await handleAdoptReadyProgram(input.templateId, { lead: true });
    if (!adopted) {
      return;
    }
    await updatePreferences({
      strengthGoals: upsertStrengthGoal(preferences.strengthGoals, {
        exerciseName: input.exerciseName,
        targetKg: input.targetKg,
        createdAt: new Date().toISOString(),
      }),
    });

    // And say so. Both writes have resolved by here — the programme, then the
    // target — which is the order CLAUDE.md asks for: a success state follows
    // the write, never precedes it.
    //
    // Without this the tap did all its work in silence. The screen kept the
    // same three steps with the same numbers in them, nothing navigated, and
    // 'goalFlow.created' sat translated in both dictionaries with no reader.
    // The copy names where the programme went, so the reader is sent there.
    showToast(t(preferences.appLanguage, 'goalFlow.created'));
    navigate({ tab: 'workout', screen: 'programs_home' });
  }

  /**
   * Goals with a bar that can move.
   *
   * Measured against the user's own best set for that lift — never an
   * estimate. A goal on a lift they have not logged shows as not started
   * rather than 0%: those are different states, and a bar alone cannot tell
   * them apart.
   */
  const programsGoals = useMemo(
    () =>
      resolveGoalProgress(
        preferences.strengthGoals,
        new Map(trackedProgress.map((summary) => [summary.name, summary.bestWeight])),
        // Same rule the coverage row uses, so "your program trains this" and
        // "you have lifted this" can never disagree about what the lift is.
        (loggedName, liftName) => isSameLift(loggedName, liftName, libraryNames),
      ),
    [libraryNames, preferences.strengthGoals, trackedProgress],
  );
  /**
   * The programme behind each goal lift (feedback round 2, #1: a target always
   * has a programme that goes towards it).
   *
   * Computed for every preset lift, not only the goals set, so the picker can
   * answer the moment a target is tapped. "Covered" means one of the ACTIVE
   * programmes — ready or the reader's own — trains the lift; otherwise the
   * best ready programme that does is suggested, ordered by how central the
   * lift is there and then by the setup recommendation. No fit is invented:
   * a lift no ready programme trains says so and points at the editor.
   */
  // One array per library, so the goal-programme resolver's cache can key on it
  // instead of being defeated by a fresh `.map` every render.
  const goalProgrammeSuggestions = useMemo(() => {
    const activeCandidates = activeProgramTemplateIds
      .map((id) => getWorkoutTemplateById(id) ?? customWorkoutRuntimeMap[id] ?? null)
      .filter((template): template is NonNullable<typeof template> => Boolean(template));
    const activeIds = new Set(activeProgramTemplateIds);
    const preferredOrder = programsRecommendations.map((item) => item.id);
    const titleOf = (id: string) => {
      const ready = getWorkoutTemplateById(id);
      if (ready) {
        return getReadyTemplatePresentation(ready, preferences.appLanguage).title;
      }
      const custom = customWorkoutRuntimeMap[id];
      return custom ? formatWorkoutDisplayLabel(custom.name) : id;
    };
    const result: Record<string, GoalProgrammeSuggestionView> = {};
    for (const preset of STRENGTH_GOAL_PRESETS) {
      const lift = preset.exerciseName;
      const coverage = describeGoalCoverage(
        { exerciseName: lift, targetKg: 1, createdAt: '' },
        activeCandidates,
        libraryNames,
      );
      if (coverage.status === 'covered' && coverage.coveredBy) {
        const active = activeCandidates.find((template) => template.id === coverage.coveredBy);
        const match = rankProgrammesForLift(active ? [active] : [], lift, { libraryNames })[0];
        result[lift] = {
          status: 'covered',
          programme: {
            id: coverage.coveredBy,
            title: titleOf(coverage.coveredBy),
            sessionCount: match?.sessionCount ?? 0,
            totalSessions: active?.sessions.length ?? 0,
          },
        };
        continue;
      }
      const ranked = rankProgrammesForLift(WORKOUT_TEMPLATES_V1, lift, {
        preferredOrder,
        libraryNames,
        // The suggestion has to be a programme this reader can actually run.
        reader: { level: preferences.setupLevel, daysPerWeek: preferences.setupDaysPerWeek },
      }).filter(
        (match) => !activeIds.has(match.id),
      );
      const best = ranked[0];
      const template = best ? getWorkoutTemplateById(best.id) : null;
      result[lift] =
        best && template
          ? {
              status: 'suggest',
              programme: {
                id: best.id,
                title: getReadyTemplatePresentation(template, preferences.appLanguage).title,
                sessionCount: best.sessionCount,
                totalSessions: template.sessions.length,
              },
            }
          : { status: 'none', programme: null };
    }
    return result;
  }, [
    activeProgramTemplateIds,
    customWorkoutRuntimeMap,
    libraryNames,
    preferences.appLanguage,
    preferences.setupDaysPerWeek,
    preferences.setupLevel,
    programsRecommendations,
  ]);
  // Programmes the reader built, not every template in the database: a
  // freestyle log writes a template of its own to hang the session on, and
  // "Omat ohjelmasi" was listing each of those as a programme. Those sessions
  // live in History; the same rule the programme cap already uses.
  const programsCustomItems = useMemo(() => {
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
        active: homeActivePlanCard?.programId === template.id,
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

    const activeIsAuthored = authored.some((item) => item.active);
    if (!homeActivePlanCard || activeIsAuthored) {
      return leadFirst(authored);
    }
    return [
      {
        id: homeActivePlanCard.programId,
        name: formatWorkoutDisplayLabel(homeActivePlanCard.title),
        subtitle: t(preferences.appLanguage, 'programs.activeSubtitle'),
        active: true,
        programType: homeActivePlanCard.programType,
      },
      ...authored,
    ];
  }, [customWorkouts, homeActivePlanCard, preferences.appLanguage]);

  const editorDraft = useMemo<WorkoutTemplateDraft>(() => {
    if (route.tab !== 'workout' || route.screen !== 'editor') {
      return { name: '', sessions: [{ name: 'Session 1', exercises: [] }] };
    }

    if (!route.workoutTemplateId) {
      // The editor could open pre-loaded with one exercise, from the library
      // card's "add to workout". That door closed in #38 and nothing has set
      // prefillExerciseLibraryId since, so the branch built an empty array by
      // a longer route.
      return {
        name: route.prefillName ?? '',
        sessions: [{ name: 'Session 1', exercises: [] }],
      };
    }

    const template = workoutTemplates.find((item) => item.id === route.workoutTemplateId);
    if (!template) {
      return { name: '', sessions: [{ name: 'Session 1', exercises: [] }] };
    }

    return {
      id: template.id,
      name: template.name,
      sessions: getWorkoutTemplateSessions(template.id).map((session) => ({
        id: session.id,
        name: session.name,
        exercises: session.exercises.map((exercise) => ({
          id: exercise.id,
          name: exercise.name,
          targetSets: exercise.targetSets,
          repMin: exercise.repMin,
          repMax: exercise.repMax,
          restSeconds: exercise.restSeconds,
          trackedDefault: exercise.trackedDefault,
          libraryItemId: exercise.libraryItemId ?? null,
        })),
      })),
    };
  }, [exerciseBrowserItems, getWorkoutTemplateSessions, preferences.defaultRestSeconds, route, workoutTemplates]);
  const templateBuilderDraft = useMemo<WorkoutTemplateDraft>(() => {
    if (route.tab !== 'workout' || route.screen !== 'template') {
      return {
        name: '',
        sessions: [
          { name: 'Day 1', exercises: [] },
          { name: 'Day 2', exercises: [] },
          { name: 'Day 3', exercises: [] },
        ],
      };
    }

    if (!route.workoutTemplateId) {
      return {
        name: '',
        sessions: [
          { name: 'Day 1', exercises: [] },
          { name: 'Day 2', exercises: [] },
          { name: 'Day 3', exercises: [] },
        ],
      };
    }

    const template = workoutTemplates.find((item) => item.id === route.workoutTemplateId);
    if (!template) {
      return {
        name: '',
        sessions: [
          { name: 'Day 1', exercises: [] },
          { name: 'Day 2', exercises: [] },
          { name: 'Day 3', exercises: [] },
        ],
      };
    }

    return {
      id: template.id,
      name: template.name,
      sessions: getWorkoutTemplateSessions(template.id).map((session) => ({
        id: session.id,
        name: session.name,
        exercises: session.exercises.map((exercise) => ({
          id: exercise.id,
          name: exercise.name,
          targetSets: exercise.targetSets,
          repMin: exercise.repMin,
          repMax: exercise.repMax,
          restSeconds: exercise.restSeconds,
          trackedDefault: exercise.trackedDefault,
          libraryItemId: exercise.libraryItemId ?? null,
        })),
      })),
    };
  }, [getWorkoutTemplateSessions, route, workoutTemplates]);

  if (!nativeSplashHidden || !hydrated || !workout.hydrated) {
    return <LaunchScreen />;
  }

  // Shared finish path for logged one-off sessions (freestyle + editor):
  // template first, then the completed session, and only then the summary
  // screen — a failed save must leave the logger open with its sets intact.
  const finishLoggedWorkoutSave = async (draft: WorkoutTemplateDraft, summary: WorkoutEditorFinishSummary) => {
    trackEvent('workout_completed');
    const workoutTemplateId = await upsertWorkoutTemplate(draft);
    const sessionId = createId('session');
    await saveCompletedWorkoutSession({
      sessionId,
      workoutTemplateId,
      workoutNameSnapshot: summary.workoutName,
      logs: summary.logs,
      startedAt: summary.startedAt,
      performedAt: summary.performedAt,
    });
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
            setOnboardingPath('build');
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
            }).then(() => navigate({ tab: 'home', screen: 'dashboard' }));
          }}
          onBrowsePrograms={() => {
            // Straight to the catalog. This fork used to detour through the
            // About-you form first, which is the opposite of what the card
            // promises ("choose the program you want yourself") — the reader
            // asked to skip the questions and got a form. Nothing downstream
            // needs the answers: handleOnboardingPickReadyProgram already
            // reads every basic through `aboutYouValues?.` and stores null.
            // The profile is filled in later, from Settings.
            setOnboardingPath('ready');
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
            setOnboardingStep(onboardingPath === 'ready' ? 'ready_catalog' : 'questionnaire');
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
                  profileName: aboutYouValues.name,
                  gender: aboutYouValues.gender ?? 'unspecified',
                  age: aboutYouValues.age,
                  heightCm: aboutYouValues.heightCm,
                  currentWeightKg: aboutYouValues.weightKg,
                }
              : null
          }
          onDismissTip={handleDismissTip}
          onBackToEntry={() => setOnboardingStep('about')}
          onSkip={() => void handleOnboardingSkip()}
          onCompleteToTraining={handleOnboardingCompleteToTraining}
          onFullBleedReviewChange={setFullBleedReview}
          onCompleteToProgramDetail={handleOnboardingCompleteToProgramDetail}
          onCompleteToCustom={handleOnboardingCompleteToCustom}
        />
      );
    }
  } else if (setupHandoffActive && setupHandoffPlan) {
    // Between the last question and the app. The route behind this is already
    // the one onboarding chose, so finishing here just uncovers it.
    content = (
      <SetupHandoffScreen
        language={preferences.appLanguage}
        plan={setupHandoffPlan}
        focusLabel={
          setupHandoffPlan.tracking?.focus
            ? getFocusAreaTitle(setupHandoffPlan.tracking.focus, preferences.appLanguage)
            : null
        }
        onDone={(choices) => void handleSetupHandoffDone(choices)}
        onSkip={() => void handleSetupHandoffDone({ addWidget: false, pinTrackingCard: false, pinBodyweightCard: false, signInForBackup: false })}
      />
    );
  } else if (route.tab === 'profile' && route.screen === 'setup') {
    content = (
      <OnboardingScreen
        key={`setup:${preferences.recommendedProgramId ?? 'none'}:${preferences.setupCompleted ? 'complete' : 'pending'}:${route.stage ?? 'default'}`}
        mode="edit"
        initialSelection={setupSelection ?? DEFAULT_FIRST_RUN_SELECTION}
        initialStage={route.stage ?? (setupSelection ? 'review' : 'location')}
        initialUnitPreference={unitPreference}
        language={preferences.appLanguage}
        tailoringPreferences={tailoringPreferences}
        readyProgramCount={workout.templates.length}
        dismissedTipIds={dismissedTipIds}
        onDismissTip={handleDismissTip}
        onSkip={() => navigateBack(ROOT_ROUTES.profile)}
        onCancel={() => navigateBack(ROOT_ROUTES.profile)}
        onCompleteToTraining={handleSetupCompleteToTraining}
        onCompleteToProgramDetail={handleSetupOpenProgramDetail}
        onCompleteToCustom={handleSetupBuildOwn}
      />
    );
  } else if (
    route.tab === 'home' &&
    (route.screen === 'cardio' ||
      route.screen === 'ai' ||
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
      homeAiPromptSuggestions,
      aiCoachTrainingContext,
      handleOpenAICoach,
      handleSelectAiCoachAction,
      exerciseLibrary,
      programSlots,
      setProgramLimitVisible,
      workoutTemplates,
      upsertWorkoutTemplate,
      workoutSessions,
      getSessionLogs,
      deleteCompletedWorkoutSession,
      deleteCardioSession,
      unitPreference,
      coachProUnlocked,
      database,
      coachChatIntro,
      coachLastSession,
      homePinnedStatCardKeys,
      addBodyweightEntry,
      addMeasurementEntry,
      accountBackup,
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
  } else if (route.tab === 'workout' && route.screen === 'celebration' && workoutCelebration) {
    content = (
      <WorkoutCelebrationScreen
        language={preferences.appLanguage}
        workoutName={workoutCelebration.workoutName}
        heroImageUrl={workoutCelebration.heroImageUrl}
        workoutsThisWeek={workoutCelebration.workoutsThisWeek}
        totalLiftedKgThisWeek={workoutCelebration.totalLiftedKgThisWeek}
        totalDurationMinutesThisWeek={workoutCelebration.totalDurationMinutesThisWeek}
        prCount={workoutCelebration.prCount}
        unitPreference={unitPreference}
        // Same shape as the summary: the celebration branch is guarded on
        // `&& workoutCelebration`, so clearing it urgently would drop through
        // to the same catch-all on the way out.
        onDone={() => leaveFinishedWorkout(ROOT_ROUTES.home)}
        onViewProgress={() => leaveFinishedWorkout(ROOT_ROUTES.progress)}
      />
    );
  } else if (route.tab === 'workout') {
    // Every route-pure workout branch. `summary` and `celebration` sit above
    // this on purpose: their guards read finish-flow state, and when that
    // state was just cleared the module returns null here and the dashboard
    // fallback below catches it — the same drop-through the old chain had.
    content = renderWorkoutTab({
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
      customWorkoutRuntimeMap,
      setupSelection,
      setupRecommendation,
      tailoringPreferences,
      activeProgramTemplateIds,
      homeActivePlanCard,
      programInsightsByTemplateId,
      availableEquipmentForDrills,
      resolveNextSessionIdForTemplate,
      handleStartReadyProgramSession,
      handleAdoptReadyProgram,
      handleStartCustomProgram,
      handleAdoptCustomProgram,
      handleStartCustomProgramSession,
      editProgramExercise: handleEditProgramExercise,
      handleSaveRhythm,
      handleReorderProgramSession,
      handleSaveEmphasis,
      handleDeleteCustomWorkout,
      sessionSwaps,
      setSessionSwaps,
      templateBuilderDraft,
      exerciseBrowserItems,
      recentExerciseBrowserItems,
      upsertWorkoutTemplate,
      showToast,
      exercisePrLookup,
      finishLoggedWorkoutSave,
      editorDraft,
      editorExerciseHistoryLookup,
      exerciseLibrary,
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
      handleOpenReadyProgramDetail,
      handleStartReadyProgram,
      handleOpenCustomProgramDetail,
      handleDuplicateCustomWorkout: handleDuplicateCustomProgram,
      goalProgrammeSuggestions,
      goalFlowLifts,
      getGoalProposal,
      handleAcceptTargetProposal,
      programSlots,
      setProgramLimitVisible,
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
      preferences,
      updatePreferences,
      personalRecords,
      distinctRecordCount,
      recordSources,
      targetLifts: goalFlowLifts,
      trackedProgress,
      bodyweightProgress,
      measurementEntries,
      workoutSessions,
      activityCalendar: homeSummary.streak.calendar,
      homeTrainingSchedule,
      progressTrainingRhythm,
      progressWeeklyTarget,
      unitPreference,
      proWeeklyRead,
      proPlateauMoment: proPlateau?.moment ?? null,
      coachProUnlocked,
      addBodyweightEntry,
      addMeasurementEntry,
      deleteBodyweightEntry,
      deleteMeasurementEntry,
      homeRecentSessions,
    });
  } else if (route.tab === 'profile') {
    // Everything under the profile tab except `setup`, which the onboarding
    // gate above already claimed — the module's ProfileScreen fallback never
    // sees it. Branch order inside the module mirrors the old chain exactly.
    content = renderProfileTab({
      route,
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
      settingsScrollOffsetRef,
      homeWidgetState,
      handleAddHomeWidget,
      accountBackup,
      handleAccountSignIn,
      showToast,
      setSettingsImportVisible,
      setRatingSheetVisible,
      resetAllData: handleResetAllData,
      setCompletionSummary,
      setWorkoutCelebration,
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
        onOpenSubscription={() => navigate({ tab: 'profile', screen: 'subscription' })}
        activePlan={homeActivePlanCard}
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
            handleOpenReadyProgramDetail(templateId);
          }
        }}
        onRemoveOtherProgram={(planId) => void handleRemoveActiveProgram(planId)}
        availableEquipment={availableEquipmentForDrills}
        routineDrillOverrides={preferences.routineDrillOverrides}
        // Permanent by nature: the drills are generated from the session's
        // focus, so the choice belongs to every day with that focus rather
        // than to today. There is no "just this time" to offer.
        onSwapRoutineDrill={(slotKey, drillKey) =>
          void updatePreferences({
            routineDrillOverrides: { ...preferences.routineDrillOverrides, [slotKey]: drillKey },
          })
        }
        widgetPrompt={
          homeWidgetState?.supported && !homeWidgetState.added && !preferences.homeWidgetPromptDismissed
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
                    if (kind === 'backed_up' || kind === 'restored' || kind === 'choice') {
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
          void updatePreferences({
            dismissedCardSuggestionKeys: [...preferences.dismissedCardSuggestionKeys, key],
          })
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
        sessionSwaps={sessionSwaps}
        onSwapSessionExercise={(slotId, exerciseName) =>
          setSessionSwaps((current) => ({ ...current, [slotId]: exerciseName }))
        }
        sessionDrops={sessionDrops}
        onDropSessionExercise={(slotId) =>
          setSessionDrops((current) => (current.includes(slotId) ? current : [...current, slotId]))
        }
        onRestoreSessionExercise={(slotId) =>
          setSessionDrops((current) => current.filter((id) => id !== slotId))
        }
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
        // Paused counts: it is still a session the button resumes.
        hasActiveSession={workout.activeSession !== null && workout.activeSession.status !== 'completed'}
        onPickTodaySession={(sessionId) => void handlePickTodaySession(sessionId)}
        // Ready programmes are immutable at runtime, so the pencil is simply
        // not offered for them rather than offered and inert.
        onRenameSession={
          homeActivePlanCard?.programType === 'custom'
            ? (sessionId, name) => void handleRenameActivePlanSession(sessionId, name)
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
        onCreateWorkoutFromExercises={() => navigate({ tab: 'workout', screen: 'empty' })}
        // No programme to start: the hero button goes to the catalog instead of
        // offering an empty session the "empty workout" row already offers.
        onFindProgram={() => navigateToTab('workout')}
        onOpenCardio={() => navigate({ tab: 'home', screen: 'cardio' })}
        onOpenPremium={() => navigate({ tab: 'profile', screen: 'premium' })}
        plateau={proPlateau ? { headline: proPlateau.detection.headline, meta: proPlateau.detection.meta, locked: proPlateau.conclusion, moment: proPlateau.moment } : null}
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
        route.screen === 'summary' ||
        route.screen === 'celebration')
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
      route.screen === 'promo' ||
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
  const aiCoachActive = route.tab === 'home' && route.screen === 'ai';
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

  return (
    <AppShell
      toastMessage={toastMessage}
      safeAreaEdges={
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
              : ['top', 'left', 'right', 'bottom']
      }
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
              (route.screen === 'ai_chat' || route.screen === 'ai')
            }
            onTabPress={navigateToTab}
            // The design's rule for the middle button: it opens the chat, for
            // everyone, always. It used to open a paywall-shaped sheet — the
            // app's most valuable placement spent on an advert.
            onAiPress={() => navigate({ tab: 'home', screen: 'ai_chat' })}
          />
        ) : undefined
      }
    >
      {content}
      <NewProgramSheet
        visible={settingsImportVisible}
        initialView="csv"
        language={preferences.appLanguage}
        exerciseLibrary={exerciseBrowserItems}
        nameBook={exerciseNameBook}
        onPickImage={handlePickProgramImage}
        onTeachName={(wrote, exercise) =>
          teachExerciseName(wrote, { name: exercise.name, libraryItemId: exercise.id })
        }
        onClose={() => setSettingsImportVisible(false)}
        // Settings' CSV sheet opens straight on the paste box, so this row is
        // never drawn from here and the Pro lock the Programs tab passes does
        // not apply. The lock itself was decided on 2026-09-01, reversing the
        // earlier "the chat, for everyone" call: the gate had moved onto the
        // act of composing, and the row went to the chat for anyone.
        onAiAssisted={() =>
          navigate({ tab: 'home', screen: 'ai_chat' })
        }
        onBuildYourself={() => navigate({ tab: 'workout', screen: 'template' })}
        onImportProgram={async (draft) => {
          const workoutTemplateId = await upsertWorkoutTemplate(draft);
          setSettingsImportVisible(false);
          navigate({ tab: 'workout', screen: 'program', programType: 'custom', workoutTemplateId });
        }}
        onImportHistory={async (preview) => {
          const result = await importWorkoutHistory(preview.workouts);
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
        slots={programSlots}
        language={preferences.appLanguage}
        onClose={() => setProgramLimitVisible(false)}
        onSeePro={() => {
          setProgramLimitVisible(false);
          navigate({ tab: 'profile', screen: 'premium' });
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
          void updatePreferences({ ratingPrompt: recordRatingCompleted(preferences.ratingPrompt) });
          void Linking.openURL(PLAY_LISTING_URL);
        }}
        onDismiss={() => setRatingSheetVisible(false)}
      />
    </AppShell>
  );
}

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
const WEEKDAY_LABEL_KEYS: Record<string, I18nKey> = {
  MON: 'setup.day.mon',
  TUE: 'setup.day.tue',
  WED: 'setup.day.wed',
  THU: 'setup.day.thu',
  FRI: 'setup.day.fri',
  SAT: 'setup.day.sat',
  SUN: 'setup.day.sun',
};


