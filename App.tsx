import React, { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, StyleSheet, View } from 'react-native';

import { AppShell } from './src/components/AppShell';
import { BottomTabBar } from './src/components/BottomTabBar';
import { getHomeSummary } from './src/lib/dashboard';
import { formatShortDate, formatTime, pluralize } from './src/lib/format';
import {
  buildFirstRunRecommendationReasons,
  buildFirstRunPromptSuggestions,
  DEFAULT_RHYTHM_BY_DAYS,
  DEFAULT_FIRST_RUN_SELECTION,
  FirstRunSetupSelection,
  resolveFirstRunRecommendationWithTailoring,
} from './src/lib/firstRunSetup';
import { buildStartingWeekView } from './src/lib/startingWeek';
import { getRecentExerciseLibraryItems } from './src/lib/exerciseSuggestions';
import { formatWorkoutDisplayLabel } from './src/lib/displayLabel';
import { selectHomeCustomProgram } from './src/lib/homeProgramSelection';
import { selectHomePrimaryAction } from './src/lib/homePrimaryAction';
import { buildAiTrainingContext } from './src/lib/aiTrainingContext';
import { getReadyProgramContent } from './src/lib/readyProgramContent';
import { resolveWorkoutLoggerFallbackRoute } from './src/lib/workoutLoggerNavigation';
import { buildExerciseHistoryLookup } from './src/lib/workoutEditorTable';
import { buildDuplicatedCustomProgramDraft } from './src/lib/customProgramDuplication';
import { buildCustomDraftFromReadyProgram } from './src/lib/readyProgramDuplication';
import { buildCustomProgramDetail, buildCustomSessionRuntimeTemplate, buildReadyProgramDetail, buildReadySessionRuntimeTemplate } from './src/lib/programDetails';
import { buildProgramInsightMap } from './src/lib/programInsights';
import { buildTailoringPreferences } from './src/lib/tailoringFit';
import { popRoute, pushRoute } from './src/navigation/routeHistory';
import { AppRoute, ROOT_ROUTES, RootTabKey } from './src/navigation/routes';
import { AICoachScreen } from './src/screens/AICoachScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { EquipmentPreferencesScreen } from './src/screens/EquipmentPreferencesScreen';
import { ExercisePreferencesScreen } from './src/screens/ExercisePreferencesScreen';
import { JointFriendlySwapsScreen } from './src/screens/JointFriendlySwapsScreen';
import { PlanSettingsScreen } from './src/screens/PlanSettingsScreen';
import { PremiumScreen } from './src/screens/PremiumScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { ProgressScreen } from './src/screens/ProgressScreen';
import { ProgramDetailScreen } from './src/screens/ProgramDetailScreen';
import { StartingWeekScreen } from './src/screens/StartingWeekScreen';
import { WorkoutCompletionScreen } from './src/screens/WorkoutCompletionScreen';
import { WorkoutEditorScreen } from './src/screens/WorkoutEditorScreen';
import { WorkoutLoggingScreen } from './src/screens/WorkoutLoggingScreen';
import { WorkoutsScreen } from './src/screens/WorkoutsScreen';
import { WorkoutProvider, useWorkoutContext } from './src/features/workout/WorkoutProvider';
import { adaptLegacyWorkoutTemplateToRuntimeTemplate } from './src/features/workout/customWorkoutAdapter';
import { adaptCompletedWorkoutSessionForAppDatabase } from './src/features/workout/workoutAppAdapter';
import { getWorkoutTemplateById } from './src/features/workout/workoutCatalog';
import { AppProvider, useAppContext } from './src/state/AppProvider';
import { colors } from './src/theme';
import { AppPreferences, SetupScheduleMode, UnitPreference, WorkoutTemplateDraft } from './src/types/models';
import { ValluAction } from './src/types/vallu';

interface CompletionSummaryState {
  workoutName: string;
  performedAt: string;
  durationMinutes: number;
  setsCompleted: number;
  totalVolume: number;
  exercisesLogged: number;
}

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

const PROGRAM_DETAIL_TIP_ID = 'program_detail_start';
const WORKOUT_LOGGER_TIP_ID = 'workout_logger_start';
const WORKOUT_EDITOR_TIP_ID = 'workout_editor_start';

function getBackRoute(route: AppRoute): AppRoute | null {
  if (
    route.tab === 'home' &&
    (route.screen === 'ai' || route.screen === 'history' || route.screen === 'session' || route.screen === 'starting_week')
  ) {
    return ROOT_ROUTES.home;
  }

  if (route.tab === 'workout' && (route.screen === 'program' || route.screen === 'editor' || route.screen === 'log' || route.screen === 'summary')) {
    return ROOT_ROUTES.workout;
  }

  if (route.tab === 'progress' && (route.screen === 'detail' || route.screen === 'bodyweight')) {
    return ROOT_ROUTES.progress;
  }

  if (route.tab === 'profile' && route.screen === 'setup') {
    return ROOT_ROUTES.profile;
  }

  if (route.tab === 'profile' && route.screen === 'plan_settings') {
    return ROOT_ROUTES.profile;
  }

  if (route.tab === 'profile' && route.screen === 'exercise_preferences') {
    return { tab: 'profile', screen: 'plan_settings' };
  }

  if (route.tab === 'profile' && route.screen === 'equipment') {
    return { tab: 'profile', screen: 'plan_settings' };
  }

  if (route.tab === 'profile' && route.screen === 'joint_swaps') {
    return { tab: 'profile', screen: 'plan_settings' };
  }

  if (route.tab === 'profile' && route.screen === 'premium') {
    return ROOT_ROUTES.profile;
  }

  return null;
}

function buildSetupSelectionFromPreferences(preferences: AppPreferences): FirstRunSetupSelection | null {
  if (
    !preferences.setupCompleted ||
    !preferences.setupGoal ||
    !preferences.setupLevel ||
    !preferences.setupDaysPerWeek ||
    !preferences.setupEquipment
  ) {
    return null;
  }

  return {
    goal: preferences.setupGoal,
    level: preferences.setupLevel,
    daysPerWeek: preferences.setupDaysPerWeek,
    equipment: preferences.setupEquipment,
    secondaryOutcomes:
      preferences.setupSecondaryOutcomes.length > 0
        ? preferences.setupSecondaryOutcomes
        : DEFAULT_FIRST_RUN_SELECTION.secondaryOutcomes,
    focusAreas: preferences.setupFocusAreas.length > 0 ? preferences.setupFocusAreas : DEFAULT_FIRST_RUN_SELECTION.focusAreas,
    guidanceMode: preferences.setupGuidanceMode ?? DEFAULT_FIRST_RUN_SELECTION.guidanceMode,
    scheduleMode: preferences.setupScheduleMode ?? DEFAULT_FIRST_RUN_SELECTION.scheduleMode,
    weeklyMinutes: preferences.setupWeeklyMinutes,
    availableDays:
      preferences.setupAvailableDays.length > 0
        ? preferences.setupAvailableDays
        : DEFAULT_FIRST_RUN_SELECTION.availableDays,
    currentWeightKg: null,
    targetWeightKg: preferences.bodyweightGoalKg,
    unitPreference: preferences.unitPreference,
  };
}

function buildSetupPreferencePatch(
  selection: FirstRunSetupSelection,
  recommendedProgramId: string | null,
): Partial<AppPreferences> {
  return {
    onboardingCompleted: true,
    setupCompleted: true,
    setupGoal: selection.goal,
    setupLevel: selection.level,
    setupDaysPerWeek: selection.daysPerWeek,
    setupEquipment: selection.equipment,
    setupSecondaryOutcomes: selection.secondaryOutcomes,
    setupFocusAreas: selection.focusAreas,
    setupGuidanceMode: selection.guidanceMode,
    setupScheduleMode: selection.scheduleMode,
    setupWeeklyMinutes: selection.weeklyMinutes ?? null,
    setupAvailableDays: selection.scheduleMode === 'self_managed' ? selection.availableDays : [],
    bodyweightGoalKg: selection.targetWeightKg ?? null,
    recommendedProgramId,
    unitPreference: selection.unitPreference,
  };
}

function formatGoalLabel(goalType: string) {
  if (goalType === 'hypertrophy') {
    return 'Muscle';
  }

  if (!goalType) {
    return 'General';
  }

  return goalType[0].toUpperCase() + goalType.slice(1);
}

function GymlogApp() {
  const {
    database,
    hydrated,
    preferences,
    unitPreference,
    workoutTemplates,
    exerciseLibrary,
    workoutSessions,
    trackedProgress,
    bodyweightProgress,
    getWorkoutExercises,
    getWorkoutTemplateSessions,
    getSessionLogs,
    setUnitPreference,
    updatePreferences,
    completeOnboarding,
    upsertWorkoutTemplate,
    deleteWorkoutTemplate,
    resetAllData,
    addBodyweightEntry,
    saveCompletedWorkoutSession,
  } = useAppContext();
  const workout = useWorkoutContext();

  const [navigationState, setNavigationState] = useState<NavigationState>({
    route: ROOT_ROUTES.home,
    history: [],
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [completionSummary, setCompletionSummary] = useState<CompletionSummaryState | null>(null);
  const [finishSaveState, setFinishSaveState] = useState<FinishSaveState>({
    status: 'idle',
    sessionId: null,
    message: null,
  });
  const summaryExitRouteRef = useRef<AppRoute | null>(null);
  const route = navigationState.route;

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

  function navigateToTab(tab: RootTabKey) {
    resetToRoute(ROOT_ROUTES[tab]);
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
    if (
      route.tab === 'workout' &&
      route.screen === 'log' &&
      !workout.templates.some((template) => template.id === route.workoutTemplateId) &&
      !workoutTemplates.some((template) => template.id === route.workoutTemplateId)
    ) {
      replaceRoute(ROOT_ROUTES.workout);
    }

    if (
      route.tab === 'workout' &&
      route.screen === 'program' &&
      ((route.programType === 'ready' && !workout.templates.some((template) => template.id === route.workoutTemplateId)) ||
        (route.programType === 'custom' && !workoutTemplates.some((template) => template.id === route.workoutTemplateId)))
    ) {
      replaceRoute(ROOT_ROUTES.workout);
    }

    if (
      route.tab === 'workout' &&
      route.screen === 'editor' &&
      route.workoutTemplateId &&
      !workoutTemplates.some((template) => template.id === route.workoutTemplateId)
    ) {
      replaceRoute(ROOT_ROUTES.workout);
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

    if (route.tab === 'workout' && route.screen === 'summary' && !completionSummary) {
      const nextRoute = summaryExitRouteRef.current ?? ROOT_ROUTES.workout;
      summaryExitRouteRef.current = null;
      replaceRoute(nextRoute);
    }
  }, [completionSummary, route, trackedProgress, workoutSessions, workout.templates, workoutTemplates]);

  const onboardingActive = !preferences.onboardingCompleted;

  useEffect(() => {
    if (onboardingActive) {
      return undefined;
    }

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      const nextRoute = getBackRoute(route);
      if (!nextRoute && navigationState.history.length === 0) {
        return false;
      }

      if (route.tab === 'workout' && route.screen === 'summary') {
        setCompletionSummary(null);
        setFinishSaveState({ status: 'idle', sessionId: null, message: null });
        workout.clearCompletedWorkout();
        navigateBack(summaryExitRouteRef.current ?? ROOT_ROUTES.workout);
        return true;
      }

      navigateBack(nextRoute);
      return true;
    });

    return () => subscription.remove();
  }, [navigationState.history.length, onboardingActive, route, workout]);

  const homeSummary = useMemo(() => getHomeSummary(database, unitPreference), [database, unitPreference]);
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
  function navigateToActiveWorkout(message?: string) {
    if (!workout.activeSession) {
      return false;
    }

    if (message) {
      showToast(message);
    }

    workout.resumeWorkout();
    navigate({ tab: 'workout', screen: 'log', workoutTemplateId: workout.activeSession.templateId });
    return true;
  }

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
    workout.discardWorkout();
    setFinishSaveState({ status: 'idle', sessionId: null, message: null });
    showToast('Workout discarded');
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

      if (!summary.sessionId || !summary.performedAt) {
        throw new Error('Workout save did not produce a valid summary');
      }

      workout.finishWorkout(summary.performedAt);
      setCompletionSummary({
        workoutName: adaptedSession.workoutNameSnapshot,
        performedAt: summary.performedAt,
        durationMinutes: summary.durationMinutes,
        setsCompleted: summary.setsCompleted,
        totalVolume: summary.totalVolume,
        exercisesLogged: summary.exercisesLogged,
      });
      setFinishSaveState({ status: 'idle', sessionId: null, message: null });
      replaceRoute({ tab: 'workout', screen: 'summary' });
    } catch (error) {
      console.error('Failed to save completed workout', error);
      setFinishSaveState({
        status: 'error',
        sessionId: adaptedSession.sessionId,
        message: 'Could not save this workout. Try again before leaving the screen.',
      });
      showToast('Could not save workout');
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
    await completeOnboarding(buildSetupPreferencePatch(selection, recommendedProgramId));

    if (
      typeof selection.currentWeightKg === 'number' &&
      selection.currentWeightKg > 0 &&
      database.bodyweightEntries.length === 0
    ) {
      await addBodyweightEntry(selection.currentWeightKg);
    }
  }

  function handleOpenReadyPrograms() {
    navigate(ROOT_ROUTES.workout);
  }

  function handleOpenReadyProgramDetail(workoutTemplateId: string) {
    navigate({ tab: 'workout', screen: 'program', programType: 'ready', workoutTemplateId });
  }

  function handleOpenCustomProgramDetail(workoutTemplateId: string) {
    navigate({ tab: 'workout', screen: 'program', programType: 'custom', workoutTemplateId });
  }

  function handleOpenAICoach(prompt: string) {
    navigate({ tab: 'home', screen: 'ai', prompt });
  }

  function handleSelectValluAction(action: ValluAction, prompt: string) {
    switch (action.kind) {
      case 'resume_workout':
        if (!navigateToActiveWorkout()) {
          showToast('No active workout to resume');
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
        navigate(ROOT_ROUTES.workout);
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
          navigate(ROOT_ROUTES.workout);
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
          prefillName: action.prefillName ?? (prompt.trim() ? 'Vallu custom workout' : undefined),
        });
        return;

      default:
        navigate(ROOT_ROUTES.home);
    }
  }

  function handleOpenCustomPrograms() {
    navigate(ROOT_ROUTES.workout);
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

    if (
      navigateToActiveWorkout(
        workout.activeSession && workout.activeSession.templateId !== workoutTemplateId
          ? 'Resume current workout before starting another.'
          : undefined,
      )
    ) {
      return;
    }

    const runtimeTemplate = buildReadySessionRuntimeTemplate(template, sessionId);
    workout.startCustomWorkout(runtimeTemplate, nextUnitPreference);
    navigate({ tab: 'workout', screen: 'log', workoutTemplateId });
  }

  function handleStartReadyProgramSession(workoutTemplateId: string, sessionId: string) {
    startReadyProgramSessionWithUnit(workoutTemplateId, sessionId, unitPreference);
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

    if (
      navigateToActiveWorkout(
        workout.activeSession && workout.activeSession.templateId !== workoutTemplateId
          ? 'Resume current workout before starting another.'
          : undefined,
      )
    ) {
      return;
    }

    const runtimeTemplate = buildCustomSessionRuntimeTemplate(customTemplate, sessionId);
    workout.startCustomWorkout(runtimeTemplate, unitPreference);
    navigate({ tab: 'workout', screen: 'log', workoutTemplateId });
  }

  function handleStartCustomProgram(workoutTemplateId: string) {
    const customTemplate = customWorkoutRuntimeMap[workoutTemplateId];
    const firstSessionId = customTemplate?.sessions[0]?.id;
    if (!firstSessionId) {
      return;
    }

    handleStartCustomProgramSession(workoutTemplateId, firstSessionId);
  }

  function handleResumeWorkout() {
    navigateToActiveWorkout();
  }

  function handleOpenPrimaryAction() {
    if (primaryActionSelection.target.type === 'resume_active') {
      handleResumeWorkout();
      return;
    }

    if (primaryActionSelection.target.type === 'open_program') {
      navigate({
        tab: 'workout',
        screen: 'program',
        programType: primaryActionSelection.target.source,
        workoutTemplateId: primaryActionSelection.target.workoutTemplateId,
      });
      return;
    }

    navigate(ROOT_ROUTES.workout);
  }

  function handleDuplicateReadyProgram(workoutTemplateId: string) {
    const template = getWorkoutTemplateById(workoutTemplateId);
    if (!template) {
      return;
    }

    const draft = buildCustomDraftFromReadyProgram(
      template,
      exerciseLibrary,
      workoutTemplates.map((item) => item.name),
    );

    Promise.resolve(upsertWorkoutTemplate(draft))
      .then((workoutTemplateId) => {
        showToast('Program copied to your workouts');
        navigate({ tab: 'workout', screen: 'program', programType: 'custom', workoutTemplateId });
      })
      .catch((error) => {
        console.error('Failed to duplicate ready program', error);
        showToast('Could not copy program');
      });
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
    );

    Promise.resolve(upsertWorkoutTemplate(draft))
      .then((nextWorkoutTemplateId) => {
        showToast('Workout duplicated');
        navigate({ tab: 'workout', screen: 'program', programType: 'custom', workoutTemplateId: nextWorkoutTemplateId });
      })
      .catch((error) => {
        console.error('Failed to duplicate custom program', error);
        showToast('Could not duplicate workout');
      });
  }

  async function handleDeleteCustomWorkout(workoutTemplateId: string) {
    await deleteWorkoutTemplate(workoutTemplateId);
    showToast('Workout deleted');
    navigate(ROOT_ROUTES.workout);
  }

  async function handleOnboardingSkip() {
    await completeOnboarding({
      onboardingCompleted: true,
      setupCompleted: false,
      setupGoal: null,
      setupLevel: null,
      setupDaysPerWeek: null,
      setupEquipment: null,
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
      setupShoulderFriendlySwaps: false,
      setupElbowFriendlySwaps: false,
      setupKneeFriendlySwaps: false,
      bodyweightGoalKg: null,
      recommendedProgramId: null,
    });
    navigate(ROOT_ROUTES.home);
  }

  function openStartingWeek(recommendedProgramId: string, source: 'first_run' | 'edit') {
    replaceRoute({
      tab: 'home',
      screen: 'starting_week',
      recommendedProgramId,
      source,
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

  async function handleOnboardingCompleteToStartingWeek(
    selection: FirstRunSetupSelection,
    recommendedProgramId: string,
  ) {
    await persistSetupSelection(selection, recommendedProgramId);
    openStartingWeek(recommendedProgramId, 'first_run');
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

  function handleOpenPlanSettings() {
    navigate({ tab: 'profile', screen: 'plan_settings' });
  }

  function handleOpenExercisePreferences() {
    navigate({ tab: 'profile', screen: 'exercise_preferences' });
  }

  function handleOpenEquipment() {
    navigate({ tab: 'profile', screen: 'equipment' });
  }

  function handleOpenJointSwaps() {
    navigate({ tab: 'profile', screen: 'joint_swaps' });
  }

  function handleOpenPremium() {
    navigate({ tab: 'profile', screen: 'premium' });
  }

  async function handleTailoringPreferenceChange(patch: Partial<AppPreferences>) {
    const nextPreferences = {
      ...preferences,
      ...patch,
    };
    const nextSetupSelection = buildSetupSelectionFromPreferences(nextPreferences);

    if (!nextSetupSelection) {
      await updatePreferences(patch);
      return;
    }

    const nextTailoringPreferences = buildTailoringPreferences(nextPreferences);
    const nextRecommendation = resolveFirstRunRecommendationWithTailoring(nextSetupSelection, nextTailoringPreferences);

    await updatePreferences({
      ...patch,
      recommendedProgramId: nextRecommendation.featuredProgramId,
    });
  }

  async function handleUpdateScheduleMode(nextMode: SetupScheduleMode) {
    if (preferences.setupScheduleMode === nextMode) {
      return;
    }

    const patch: Partial<AppPreferences> = {
      setupScheduleMode: nextMode,
    };

    if (nextMode === 'app_managed') {
      patch.setupAvailableDays = [];
    } else if (preferences.setupAvailableDays.length === 0 && preferences.setupDaysPerWeek) {
      patch.setupAvailableDays = DEFAULT_RHYTHM_BY_DAYS[preferences.setupDaysPerWeek];
    }

    await updatePreferences(patch);
    showToast(nextMode === 'app_managed' ? 'Gymlog manages the week' : 'You manage the days');
  }

  async function handleSetupCompleteToStartingWeek(selection: FirstRunSetupSelection, recommendedProgramId: string) {
    await persistSetupSelection(selection, recommendedProgramId);
    showToast('Setup updated');
    openStartingWeek(recommendedProgramId, 'edit');
  }

  async function handleSetupOpenProgramDetail(selection: FirstRunSetupSelection, recommendedProgramId: string) {
    await persistSetupSelection(selection, recommendedProgramId);
    showToast('Setup updated');
    const template = getWorkoutTemplateById(recommendedProgramId);
    if (!template) {
      navigate(ROOT_ROUTES.workout);
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
    showToast('Setup updated');
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
  const valluTrainingContext = useMemo(
    () =>
      buildAiTrainingContext({
        unitPreference,
        activeWorkoutSummary: homeActiveWorkoutSummary,
        homeSummary,
        workoutSessions,
        trackedProgress,
        readyProgramCount: workout.templates.length,
        recommendedProgramId: preferences.recommendedProgramId,
        recommendedProgramTitle: preferences.recommendedProgramId
          ? formatWorkoutDisplayLabel(getWorkoutTemplateById(preferences.recommendedProgramId)?.name)
          : null,
        customProgramTitle: selectedCustomProgram.workoutId
          ? formatWorkoutDisplayLabel(selectedCustomProgram.title)
          : null,
      }),
    [
      homeActiveWorkoutSummary,
      homeSummary,
      selectedCustomProgram.title,
      selectedCustomProgram.workoutId,
      trackedProgress,
      unitPreference,
      preferences.recommendedProgramId,
      workout.templates.length,
      workoutSessions,
    ],
  );
  const setupSelection = useMemo(() => buildSetupSelectionFromPreferences(preferences), [preferences]);
  const tailoringPreferences = useMemo(() => buildTailoringPreferences(preferences), [preferences]);
  const setupRecommendation = useMemo(
    () => (setupSelection ? resolveFirstRunRecommendationWithTailoring(setupSelection, tailoringPreferences) : null),
    [setupSelection, tailoringPreferences],
  );
  const recommendedReadyTemplate = useMemo(
    () => (preferences.recommendedProgramId ? getWorkoutTemplateById(preferences.recommendedProgramId) : null),
    [preferences.recommendedProgramId],
  );
  const recommendedReadyContent = useMemo(
    () => (recommendedReadyTemplate ? getReadyProgramContent(recommendedReadyTemplate.id) : null),
    [recommendedReadyTemplate],
  );
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
  const primaryActionSelection = useMemo(
    () =>
      selectHomePrimaryAction({
        activeWorkout: homeActiveWorkoutSummary,
        nextPlannedWorkout,
        lastWorkout: lastReusableWorkout,
        recommendedWorkout: recommendedHomeWorkout,
      }),
    [homeActiveWorkoutSummary, lastReusableWorkout, nextPlannedWorkout, recommendedHomeWorkout],
  );
  const dismissedTipIds = preferences.dismissedTipIds ?? [];
  const readyProgramBadgeLabel = 'Browse';
  const readyProgramTitle = 'Ready plans';
  const readyProgramSubtitle = recommendedReadyTemplate
    ? `${recommendedReadyTemplate.name} · ${formatGoalLabel(recommendedReadyTemplate.goalType)} · ${recommendedReadyTemplate.daysPerWeek} days`
    : 'Browse the full ready-program library.';
  const readyProgramMeta = recommendedReadyTemplate
    ? `Recommended now · ${recommendedReadyTemplate.estimatedSessionDuration} min sessions`
    : 'Browse';
  const readyProgramCtaLabel = 'Browse ready plans';
  const customProgramCount = customWorkouts.length;
  const customProgramBadgeLabel = customProgramCount > 0 ? 'Browse' : 'Start';
  const customProgramTitle = 'Your workouts';
  const customProgramSubtitle = selectedCustomProgram.workoutId
    ? `${formatWorkoutDisplayLabel(selectedCustomProgram.title)} · ${selectedCustomProgram.meta}`
    : 'Build your first split and keep it editable.';
  const customProgramMeta = selectedCustomProgram.workoutId ? 'Latest split' : 'Start here';
  const customProgramCtaLabel = selectedCustomProgram.workoutId ? 'Browse workouts' : 'Open workouts';

  const editorDraft = useMemo<WorkoutTemplateDraft>(() => {
    if (route.tab !== 'workout' || route.screen !== 'editor') {
      return { name: '', sessions: [{ name: 'Session 1', exercises: [] }] };
    }

    if (!route.workoutTemplateId) {
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
  }, [getWorkoutTemplateSessions, route, workoutTemplates]);

  if (!hydrated || !workout.hydrated) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  const programDetailInlineTip = dismissedTipIds.includes(PROGRAM_DETAIL_TIP_ID)
    ? null
    : {
        title: 'Open the exact session first',
        body: 'Read the split, then start the exact session you want instead of launching blindly from the list.',
        accent: 'blue' as const,
        onDismiss: () => {
          void handleDismissTip(PROGRAM_DETAIL_TIP_ID);
        },
      };
  const workoutEditorInlineTip = dismissedTipIds.includes(WORKOUT_EDITOR_TIP_ID)
    ? null
    : {
        title: 'Start with the main lift first',
        body: 'Name the workout, put the main lift on the first row, then fill the rest of the table underneath it.',
        accent: 'rose' as const,
        onDismiss: () => {
          void handleDismissTip(WORKOUT_EDITOR_TIP_ID);
        },
      };
  const workoutLoggerInlineTip = dismissedTipIds.includes(WORKOUT_LOGGER_TIP_ID)
    ? null
    : {
        title: 'Log one set at a time',
        body: 'Enter load and reps, then Done locks the set and moves the workout forward.',
        accent: 'blue' as const,
        onDismiss: () => {
          void handleDismissTip(WORKOUT_LOGGER_TIP_ID);
        },
      };

  let content: React.ReactNode;

  if (onboardingActive) {
    content = (
      <OnboardingScreen
        initialUnitPreference={unitPreference}
        tailoringPreferences={tailoringPreferences}
        readyProgramCount={workout.templates.length}
        dismissedTipIds={dismissedTipIds}
        onDismissTip={handleDismissTip}
        onSkip={handleOnboardingSkip}
        onCompleteToStartingWeek={handleOnboardingCompleteToStartingWeek}
        onCompleteToProgramDetail={handleOnboardingCompleteToProgramDetail}
        onCompleteToCustom={handleOnboardingCompleteToCustom}
      />
    );
  } else if (route.tab === 'profile' && route.screen === 'setup') {
    content = (
      <OnboardingScreen
        key={`setup:${preferences.recommendedProgramId ?? 'none'}:${preferences.setupCompleted ? 'complete' : 'pending'}`}
        mode="edit"
        initialSelection={setupSelection ?? DEFAULT_FIRST_RUN_SELECTION}
        initialStage={setupSelection ? 'recommendation' : 'location'}
        initialUnitPreference={unitPreference}
        tailoringPreferences={tailoringPreferences}
        readyProgramCount={workout.templates.length}
        dismissedTipIds={dismissedTipIds}
        onDismissTip={handleDismissTip}
        onSkip={() => navigateBack(ROOT_ROUTES.profile)}
        onCancel={() => navigateBack(ROOT_ROUTES.profile)}
        onCompleteToStartingWeek={handleSetupCompleteToStartingWeek}
        onCompleteToProgramDetail={handleSetupOpenProgramDetail}
        onCompleteToCustom={handleSetupBuildOwn}
      />
    );
  } else if (route.tab === 'workout' && route.screen === 'program') {
    const readyTemplate = route.programType === 'ready' ? getWorkoutTemplateById(route.workoutTemplateId) : null;
    const customTemplate = route.programType === 'custom' ? customWorkoutRuntimeMap[route.workoutTemplateId] ?? null : null;
    const readyProgramFitExplanation =
      readyTemplate && setupSelection && setupRecommendation?.featuredProgramId === readyTemplate.id
        ? buildFirstRunRecommendationReasons(setupSelection, {
            projectedDaysPerWeek: readyTemplate.daysPerWeek,
            estimatedSessionDuration: readyTemplate.estimatedSessionDuration,
            mismatchNote: setupRecommendation.mismatchNote,
          }, tailoringPreferences).join(' ')
        : null;
    const program = readyTemplate
      ? buildReadyProgramDetail(
          readyTemplate,
          programInsightsByTemplateId[route.workoutTemplateId],
          readyProgramFitExplanation,
        )
      : customTemplate
        ? buildCustomProgramDetail(customTemplate, programInsightsByTemplateId[route.workoutTemplateId])
        : null;

    content = program ? (
      <ProgramDetailScreen
        program={program}
        inlineTip={programDetailInlineTip}
        onBack={() => navigateBack(ROOT_ROUTES.workout)}
        onPrimaryAction={() => {
          if (route.programType === 'ready') {
            handleStartReadyProgram(route.workoutTemplateId);
            return;
          }

          handleStartCustomProgram(route.workoutTemplateId);
        }}
        onStartSession={(sessionId) => {
          if (route.programType === 'ready') {
            handleStartReadyProgramSession(route.workoutTemplateId, sessionId);
            return;
          }

          handleStartCustomProgramSession(route.workoutTemplateId, sessionId);
        }}
        onEdit={route.programType === 'custom' ? () => navigate({ tab: 'workout', screen: 'editor', workoutTemplateId: route.workoutTemplateId }) : undefined}
        secondaryActionLabel={route.programType === 'ready' ? 'Make it mine' : 'Duplicate'}
        onSecondaryAction={route.programType === 'ready' ? () => handleDuplicateReadyProgram(route.workoutTemplateId) : () => handleDuplicateCustomProgram(route.workoutTemplateId)}
        destructiveActionLabel={route.programType === 'custom' ? 'Delete' : undefined}
        destructiveActionTitle={route.programType === 'custom' ? 'Delete workout' : undefined}
        destructiveActionMessage={
          route.programType === 'custom'
            ? `Delete ${program.title}? This removes the custom program from your workout list.`
            : undefined
        }
        onDestructiveAction={route.programType === 'custom' ? () => void handleDeleteCustomWorkout(route.workoutTemplateId) : undefined}
      />
    ) : (
      <View />
    );
  } else if (route.tab === 'workout' && route.screen === 'editor') {
    content = (
      <WorkoutEditorScreen
        key={`${route.workoutTemplateId ?? 'new'}:${route.prefillName ?? ''}`}
        initialDraft={editorDraft}
        exerciseLibrary={exerciseLibrary}
        recentExerciseLibraryItems={recentExerciseLibraryItems}
        defaultRestSeconds={preferences.defaultRestSeconds}
        unitPreference={unitPreference}
        exerciseHistoryLookup={editorExerciseHistoryLookup}
        inlineTip={workoutEditorInlineTip}
        onBack={() => navigateBack(ROOT_ROUTES.workout)}
        onSave={async (draft) => {
          const isNew = !draft.id;
          await upsertWorkoutTemplate(draft);
          showToast(isNew ? 'Workout created' : 'Workout updated');
          navigateBack(ROOT_ROUTES.workout);
        }}
      />
    );
  } else if (route.tab === 'workout' && route.screen === 'log') {
    content = (
      <WorkoutLoggingScreen
        sessionKey={route.workoutTemplateId}
        unitPreference={unitPreference}
        autoFocusNextInput={preferences.autoFocusNextInput}
        defaultRestSeconds={preferences.defaultRestSeconds}
        hasAdaptiveCoachPremium={preferences.adaptiveCoachPremiumUnlocked}
        tailoringPreferences={tailoringPreferences}
        exerciseLibrary={exerciseLibrary}
        recentExerciseLibraryItems={recentExerciseLibraryItems}
        customTemplate={customWorkoutRuntimeMap[route.workoutTemplateId] ?? null}
        inlineTip={workoutLoggerInlineTip}
        dismissedTipIds={dismissedTipIds}
        onDismissTip={handleDismissTip}
        onOpenAdaptiveCoachPremium={handleOpenPremium}
        onBack={() => navigateBack(getWorkoutLoggerFallbackRoute())}
        onConfirmFinishWorkout={() => void handleConfirmFinishWorkout()}
        onDiscardWorkout={() => void handleDiscardWorkout()}
        isSavingWorkout={finishSaveState.status === 'saving'}
        finishErrorMessage={finishSaveState.status === 'error' ? finishSaveState.message : null}
      />
    );
  } else if (route.tab === 'workout' && route.screen === 'summary' && completionSummary) {
    content = (
      <WorkoutCompletionScreen
        workoutName={completionSummary.workoutName}
        performedAt={completionSummary.performedAt}
        durationMinutes={completionSummary.durationMinutes}
        setsCompleted={completionSummary.setsCompleted}
        totalVolume={completionSummary.totalVolume}
        exercisesLogged={completionSummary.exercisesLogged}
        unitPreference={unitPreference}
        onDone={() => {
          setCompletionSummary(null);
          setFinishSaveState({ status: 'idle', sessionId: null, message: null });
          workout.clearCompletedWorkout();
          resetToRoute(ROOT_ROUTES.home);
        }}
        onViewProgress={() => {
          const trackedExercise = workout.activeSession?.exercises.find((exercise) => exercise.progressionPriority !== 'low');
          const trackedExerciseKey = trackedExercise?.exerciseName.trim().toLowerCase() ?? null;
          const nextRoute: AppRoute =
            trackedExerciseKey && trackedProgress.some((item) => item.key === trackedExerciseKey)
              ? { tab: 'progress', screen: 'detail', exerciseKey: trackedExerciseKey }
              : ROOT_ROUTES.progress;
          setCompletionSummary(null);
          setFinishSaveState({ status: 'idle', sessionId: null, message: null });
          workout.clearCompletedWorkout();
          resetToRoute(nextRoute);
        }}
      />
    );
  } else if (route.tab === 'progress') {
    content = (
      <ProgressScreen
        summaries={trackedProgress}
        bodyweightProgress={bodyweightProgress}
        unitPreference={unitPreference}
        selectedExerciseKey={route.screen === 'detail' ? route.exerciseKey : undefined}
        showBodyweightDetail={route.screen === 'bodyweight'}
        onSelectExercise={(exerciseKey) => navigate({ tab: 'progress', screen: 'detail', exerciseKey })}
        onSelectBodyweight={() => navigate({ tab: 'progress', screen: 'bodyweight' })}
        onAddBodyweight={async (weightKg) => {
          await addBodyweightEntry(weightKg);
          showToast('Bodyweight saved');
        }}
        onBack={() => navigateBack(ROOT_ROUTES.progress)}
      />
    );
  } else if (route.tab === 'home' && route.screen === 'starting_week') {
    const week = setupSelection ? buildStartingWeekView(setupSelection, route.recommendedProgramId, route.source) : null;
    content = week ? (
      <StartingWeekScreen
        week={week}
        hasActiveWorkout={workout.activeSession?.templateId === week.programId}
        hasLiveWorkout={Boolean(workout.activeSession)}
        onStart={() => (workout.activeSession ? handleResumeWorkout() : handleStartReadyProgram(week.programId))}
        onAdjust={handleOpenSetupEditor}
        onOpenProgram={() =>
          navigate({
            tab: 'workout',
            screen: 'program',
            programType: 'ready',
            workoutTemplateId: week.programId,
          })
        }
        onAskVallu={() => navigate({ tab: 'home', screen: 'ai', prompt: week.helperPrompt })}
      />
    ) : (
      <View />
    );
  } else if (route.tab === 'home' && route.screen === 'ai') {
    content = (
      <AICoachScreen
        initialPrompt={route.prompt}
        suggestions={homeAiPromptSuggestions}
        trainingContext={valluTrainingContext}
        onBack={() => navigateBack(ROOT_ROUTES.home)}
        onSubmitPrompt={handleOpenAICoach}
        onSelectAction={handleSelectValluAction}
      />
    );
  } else if (route.tab === 'home' && (route.screen === 'history' || route.screen === 'session')) {
    content = (
      <HistoryScreen
        sessions={workoutSessions}
        unitPreference={unitPreference}
        selectedSessionId={route.screen === 'session' ? route.sessionId : undefined}
        getSessionLogs={getSessionLogs}
        onSelectSession={(sessionId) => navigate({ tab: 'home', screen: 'session', sessionId })}
        onBack={() => navigateBack(ROOT_ROUTES.home)}
      />
    );
  } else if (route.tab === 'profile' && route.screen === 'plan_settings') {
    content = (
      <PlanSettingsScreen
        preferences={preferences}
        recommendedProgramName={recommendedReadyTemplate?.name ?? null}
        onBack={() => navigateBack(ROOT_ROUTES.profile)}
        onRefineSetup={handleOpenSetupEditor}
        onOpenExercisePreferences={handleOpenExercisePreferences}
        onOpenEquipment={handleOpenEquipment}
        onOpenJointSwaps={handleOpenJointSwaps}
        onOpenPremium={handleOpenPremium}
        onScheduleModeChange={(mode) => void handleUpdateScheduleMode(mode)}
        onOpenWeek={
          preferences.recommendedProgramId
            ? () => openStartingWeek(preferences.recommendedProgramId!, 'edit')
            : undefined
        }
        onOpenProgram={
          preferences.recommendedProgramId
            ? () => openRecommendedProgramDetail(preferences.recommendedProgramId!)
            : undefined
        }
        onAskVallu={() =>
          navigate({
            tab: 'home',
            screen: 'ai',
            prompt: recommendedReadyTemplate?.name
              ? `Why does ${formatWorkoutDisplayLabel(recommendedReadyTemplate.name)} fit me?`
              : 'Why does this plan fit me?',
          })
        }
      />
    );
  } else if (route.tab === 'profile' && route.screen === 'exercise_preferences') {
    content = (
      <ExercisePreferencesScreen
        preferences={preferences}
        onBack={() => navigateBack({ tab: 'profile', screen: 'plan_settings' })}
        onChange={(patch) => void handleTailoringPreferenceChange(patch)}
      />
    );
  } else if (route.tab === 'profile' && route.screen === 'equipment') {
    content = (
      <EquipmentPreferencesScreen
        preferences={preferences}
        onBack={() => navigateBack({ tab: 'profile', screen: 'plan_settings' })}
        onChange={(patch) => void handleTailoringPreferenceChange(patch)}
      />
    );
  } else if (route.tab === 'profile' && route.screen === 'joint_swaps') {
    content = (
      <JointFriendlySwapsScreen
        preferences={preferences}
        onBack={() => navigateBack({ tab: 'profile', screen: 'plan_settings' })}
        onChange={(patch) => void handleTailoringPreferenceChange(patch)}
      />
    );
  } else if (route.tab === 'profile' && route.screen === 'premium') {
    content = (
      <PremiumScreen
        previewUnlocked={preferences.adaptiveCoachPremiumUnlocked}
        hasActiveWorkout={Boolean(workout.activeSession)}
        activeWorkoutName={workout.activeSession?.templateName ?? null}
        onBack={() => navigateBack(ROOT_ROUTES.profile)}
        onTogglePreview={() =>
          void updatePreferences({
            adaptiveCoachPremiumUnlocked: !preferences.adaptiveCoachPremiumUnlocked,
          })
        }
        onOpenWorkout={
          workout.activeSession
            ? () =>
                navigate({
                  tab: 'workout',
                  screen: 'log',
                  workoutTemplateId: workout.activeSession?.templateId ?? preferences.recommendedProgramId ?? 'workout_upper',
                })
            : undefined
        }
        onOpenPlanSettings={handleOpenPlanSettings}
      />
    );
  } else if (route.tab === 'profile') {
    content = (
      <ProfileScreen
        preferences={preferences}
        latestBodyweightKg={bodyweightProgress.latest?.weight ?? null}
        recommendedProgramName={recommendedReadyTemplate?.name ?? null}
        onUnitPreferenceChange={async (nextUnit) => {
          await setUnitPreference(nextUnit);
          showToast(`Units set to ${nextUnit}`);
        }}
        onPreferencesChange={async (patch) => {
          await updatePreferences(patch);
        }}
        onOpenPlanSettings={handleOpenPlanSettings}
        onResetAllData={async () => {
          await resetAllData();
          setCompletionSummary(null);
          setFinishSaveState({ status: 'idle', sessionId: null, message: null });
          workout.clearCompletedWorkout();
          showToast('All data reset');
          resetToRoute(ROOT_ROUTES.home);
        }}
      />
    );
  } else if (route.tab === 'workout') {
    content = (
      <WorkoutsScreen
        customWorkouts={customWorkouts}
        programInsightsByTemplateId={programInsightsByTemplateId}
        recommendedReadyProgramId={recommendedReadyTemplate?.id ?? null}
        tailoringPreferences={tailoringPreferences}
        onOpenWorkout={(workoutTemplateId) => navigate({ tab: 'workout', screen: 'log', workoutTemplateId })}
        onOpenReadyProgram={handleOpenReadyProgramDetail}
        onStartReadyProgram={handleStartReadyProgram}
        onOpenCustomProgram={handleOpenCustomProgramDetail}
        onStartCustomWorkout={handleStartCustomProgram}
        onEditCustomWorkout={(workoutTemplateId) => navigate({ tab: 'workout', screen: 'editor', workoutTemplateId })}
        onDuplicateCustomWorkout={handleDuplicateCustomProgram}
        onDeleteCustomWorkout={handleDeleteCustomWorkout}
        onCreateWorkout={() => navigate({ tab: 'workout', screen: 'editor' })}
      />
    );
  } else {
    content = (
      <HomeScreen
        activeWorkoutSummary={homeActiveWorkoutSummary}
        primaryActionCard={primaryActionSelection.card}
        readyProgramCount={workout.templates.length}
        readyProgramBadgeLabel={readyProgramBadgeLabel}
        readyProgramTitle={readyProgramTitle}
        readyProgramSubtitle={readyProgramSubtitle}
        readyProgramMeta={readyProgramMeta}
        readyProgramCtaLabel={readyProgramCtaLabel}
        customProgramCount={customProgramCount}
        customProgramBadgeLabel={customProgramBadgeLabel}
        customProgramTitle={customProgramTitle}
        customProgramSubtitle={customProgramSubtitle}
        customProgramMeta={customProgramMeta}
        customProgramCtaLabel={customProgramCtaLabel}
        streak={homeSummary.streak}
        aiPromptSuggestions={homeAiPromptSuggestions}
        onPrimaryAction={handleOpenPrimaryAction}
        onOpenReadyPrograms={handleOpenReadyPrograms}
        onOpenCustomPrograms={handleOpenCustomPrograms}
        onOpenAICoach={handleOpenAICoach}
        onOpenStreak={() => navigate(ROOT_ROUTES.progress)}
        onResumeWorkout={handleResumeWorkout}
      />
    );
  }

  const showTabBar =
    !onboardingActive &&
    !(route.tab === 'workout' && (route.screen === 'log' || route.screen === 'summary'));
  const shellTone = onboardingActive ? 'home' : route.tab;

  return (
    <AppShell
      toastMessage={toastMessage}
      screenTone={shellTone}
      tabBar={showTabBar ? <BottomTabBar activeTab={route.tab} onTabPress={navigateToTab} /> : undefined}
    >
      {content}
    </AppShell>
  );
}

export default function App() {
  return (
    <AppProvider>
      <WorkoutProvider>
        <GymlogApp />
      </WorkoutProvider>
    </AppProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});











































