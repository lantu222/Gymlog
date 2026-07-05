import React, { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import * as Font from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';

import { AppShell } from './src/components/AppShell';
import { BottomTabBar } from './src/components/BottomTabBar';
import { getHomeSummary } from './src/lib/dashboard';
import { formatDurationMinutes, formatShortDate, formatTime, formatVolume, formatWeight, pluralize } from './src/lib/format';
import { createId } from './src/lib/ids';
import {
  buildFirstRunCustomProgramName,
  buildFirstRunRecommendationReasons,
  buildFirstRunPromptSuggestions,
  DEFAULT_RHYTHM_BY_DAYS,
  DEFAULT_FIRST_RUN_SELECTION,
  FirstRunSetupSelection,
  resolveFirstRunRecommendationWithTailoring,
} from './src/lib/firstRunSetup';
import { getRecentExerciseLibraryItems } from './src/lib/exerciseSuggestions';
import { getExerciseProgressForName } from './src/lib/progression';
import { formatWorkoutDisplayLabel } from './src/lib/displayLabel';
import { selectHomeCustomProgram } from './src/lib/homeProgramSelection';
import { selectHomePrimaryAction } from './src/lib/homePrimaryAction';
import { buildAiTrainingContext } from './src/lib/aiTrainingContext';
import { computePostSessionInsight, PostSessionInsight } from './src/lib/postSessionInsight';
import {
  buildAiCoachRuntimeTemplate,
  buildAiCoachSetupHash,
  buildAiCoachWorkoutDraft,
  getAiCoachNextSessionId,
  getAiCoachTemplateId,
} from './src/lib/aiCoachPlan';
import { buildRecommendationPlanReadyPayload } from './src/lib/recommendationProgramme';
import { getReadyProgramContent } from './src/lib/readyProgramContent';
import { getCanonicalCompletedSessions } from './src/lib/completedSessions';
import { getLifetimeTrainingSummary } from './src/lib/lifetimeSummary';
import { buildHomePlanProgress } from './src/lib/homePlanProgress';
import { buildHomeQuickStats, buildHomeUpcomingSessions } from './src/lib/homeVisuals';
import { resolveWorkoutLoggerFallbackRoute } from './src/lib/workoutLoggerNavigation';
import { buildExerciseHistoryLookup } from './src/lib/workoutEditorTable';
import {
  buildExercisePrLookup,
  estimateOneRepMaxKg,
  resolvePreviousExercisePr,
  WorkoutCompletionExerciseCard,
  WorkoutCompletionPrCard,
} from './src/lib/workoutCompletionSummary';
import { buildDuplicatedCustomProgramDraft } from './src/lib/customProgramDuplication';
import { buildCustomDraftFromReadyProgram } from './src/lib/readyProgramDuplication';
import { buildCustomProgramDetail, buildCustomSessionRuntimeTemplate, buildReadyProgramDetail, buildReadySessionRuntimeTemplate } from './src/lib/programDetails';
import { buildProgramInsightMap } from './src/lib/programInsights';
import { buildTailoringBadgeLabels, buildTailoringPreferences } from './src/lib/tailoringFit';
import { popRoute, pushRoute } from './src/navigation/routeHistory';
import { AppRoute, ROOT_ROUTES, RootTabKey, WORKOUT_PLAN_ROUTE } from './src/navigation/routes';
import { AICoachScreen } from './src/screens/AICoachScreen';
import { AiModeSetupScreen } from './src/screens/AiModeSetupScreen';
import { CreateTemplateScreen } from './src/screens/CreateTemplateScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { LaunchScreen } from './src/screens/LaunchScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import { EquipmentPreferencesScreen } from './src/screens/EquipmentPreferencesScreen';
import { ExercisePreferencesScreen } from './src/screens/ExercisePreferencesScreen';
import { ExerciseDetailScreen } from './src/screens/ExerciseDetailScreen';
import { ExercisesScreen } from './src/screens/ExercisesScreen';
import { JointFriendlySwapsScreen } from './src/screens/JointFriendlySwapsScreen';
import { PlanSettingsScreen } from './src/screens/PlanSettingsScreen';
import { PremiumScreen } from './src/screens/PremiumScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { ProfileSettingsScreen } from './src/screens/ProfileSettingsScreen';
import { ProgressScreen } from './src/screens/ProgressScreen';
import { ProgramDetailScreen } from './src/screens/ProgramDetailScreen';
import { WorkoutCompletionScreen } from './src/screens/WorkoutCompletionScreen';
import { WorkoutCelebrationScreen } from './src/screens/WorkoutCelebrationScreen';
import { WorkoutEditorFinishSummary, WorkoutEditorScreen } from './src/screens/WorkoutEditorScreen';
import { WorkoutLoggingScreen } from './src/screens/WorkoutLoggingScreen';
import { WorkoutsScreen } from './src/screens/WorkoutsScreen';
import { WorkoutProvider, useWorkoutContext } from './src/features/workout/WorkoutProvider';
import { adaptLegacyWorkoutTemplateToRuntimeTemplate } from './src/features/workout/customWorkoutAdapter';
import { AdaptedCompletedWorkoutExercise, adaptCompletedWorkoutSessionForAppDatabase } from './src/features/workout/workoutAppAdapter';
import { getWorkoutTemplateById } from './src/features/workout/workoutCatalog';
import { WorkoutRuntimeTemplate, WorkoutTemplateExercise } from './src/features/workout/workoutTypes';
import { AppProvider, useAppContext } from './src/state/AppProvider';
import { colors } from './src/theme';
import {
  AppDatabase,
  AppPreferences,
  ExerciseLibraryItem,
  ExerciseLog,
  ExerciseLogDraft,
  ExerciseTemplate,
  SetupEquipment,
  SetupScheduleMode,
  SetupGender,
  SetupTrainingEnvironment,
  UnitPreference,
  WorkoutTemplateDraft,
} from './src/types/models';
import { AICoachAction } from './src/types/aiCoach';

void SplashScreen.preventAutoHideAsync().catch(() => {
  // Native splash may already be controlled by the host app during fast refresh.
});

interface CompletionSummaryState {
  sessionId: string;
  workoutName: string;
  performedAt: string;
  durationMinutes: number;
  setsCompleted: number;
  totalVolume: number;
  exercisesLogged: number;
  exerciseCards: WorkoutCompletionExerciseCard[];
  prCards: WorkoutCompletionPrCard[];
  insight: PostSessionInsight | null;
}

function isWorkoutCompletionPrCard(
  card: WorkoutCompletionPrCard | null,
): card is WorkoutCompletionPrCard {
  return card !== null;
}

function buildCompletionCardsFromAdaptedSession({
  exercises,
  exerciseTemplates,
  exerciseLibrary,
  exercisePrLookup,
}: {
  exercises: AdaptedCompletedWorkoutExercise[];
  exerciseTemplates: ExerciseTemplate[];
  exerciseLibrary: ExerciseLibraryItem[];
  exercisePrLookup: ReturnType<typeof buildExercisePrLookup>;
}) {
  const templatesById = new Map(exerciseTemplates.map((item) => [item.id, item] as const));
  const libraryById = new Map(exerciseLibrary.map((item) => [item.id, item] as const));

  const exerciseCards: WorkoutCompletionExerciseCard[] = exercises.map((exercise) => {
    const template = exercise.persistedExerciseTemplateId
      ? templatesById.get(exercise.persistedExerciseTemplateId) ?? null
      : null;
    const libraryItem = template?.libraryItemId ? libraryById.get(template.libraryItemId) ?? null : null;
    const completedSets = exercise.sets.filter((set) => set.status === 'completed').length;
    const totalVolumeKg = exercise.sets.reduce((total, set) => {
      if (set.status !== 'completed') {
        return total;
      }
      const weightKg = typeof set.weightKg === 'number' ? set.weightKg : 0;
      const reps = typeof set.reps === 'number' ? set.reps : 0;
      return total + weightKg * reps;
    }, 0);

    return {
      id: exercise.slotId,
      name: exercise.exerciseName,
      imageUrl: libraryItem?.imageUrls?.[0] ?? null,
      completedSets,
      totalSets: Math.max(1, exercise.sets.length),
      totalVolumeKg,
      notes: exercise.notes,
    };
  });

  const prCards: WorkoutCompletionPrCard[] = exercises
    .map((exercise): WorkoutCompletionPrCard | null => {
      const template = exercise.persistedExerciseTemplateId
        ? templatesById.get(exercise.persistedExerciseTemplateId) ?? null
        : null;
      const libraryItem = template?.libraryItemId ? libraryById.get(template.libraryItemId) ?? null : null;
      const bestSet = exercise.sets.reduce<{
        estimatedOneRepMaxKg: number;
        performedWeightKg: number;
        performedReps: number;
      } | null>((best, set) => {
        if (set.status !== 'completed' || typeof set.weightKg !== 'number' || typeof set.reps !== 'number') {
          return best;
        }

        const estimate = estimateOneRepMaxKg(set.weightKg, set.reps);
        if (estimate === null) {
          return best;
        }

        if (!best || estimate > best.estimatedOneRepMaxKg) {
          return {
            estimatedOneRepMaxKg: estimate,
            performedWeightKg: set.weightKg,
            performedReps: set.reps,
          };
        }

        return best;
      }, null);

      if (!bestSet) {
        return null;
      }

      const previousBestOneRepMaxKg = resolvePreviousExercisePr({
        libraryItemId: template?.libraryItemId ?? null,
        exerciseName: exercise.exerciseName,
        lookup: exercisePrLookup,
      });

      if (previousBestOneRepMaxKg !== null && bestSet.estimatedOneRepMaxKg <= previousBestOneRepMaxKg + 0.05) {
        return null;
      }

      return {
        id: `pr:${exercise.slotId}`,
        exerciseName: exercise.exerciseName,
        imageUrl: libraryItem?.imageUrls?.[0] ?? null,
        estimatedOneRepMaxKg: bestSet.estimatedOneRepMaxKg,
        previousBestOneRepMaxKg,
        performedWeightKg: bestSet.performedWeightKg,
        performedReps: bestSet.performedReps,
      };
    })
    .filter(isWorkoutCompletionPrCard)
    .slice(0, 3);

  return {
    exerciseCards,
    prCards,
  };
}

function buildExerciseLogsForCompletedSession(sessionId: string, drafts: ExerciseLogDraft[]): ExerciseLog[] {
  return drafts.map((draft, index) => ({
    id: `draft:${sessionId}:${index}`,
    sessionId,
    exerciseTemplateId: draft.exerciseTemplateId,
    exerciseNameSnapshot: draft.exerciseNameSnapshot,
    weight: draft.skipped ? 0 : draft.weight ?? 0,
    repsPerSet: draft.skipped ? [] : draft.repsPerSet ?? [],
    sets: draft.sets,
    tracked: draft.tracked,
    orderIndex: draft.orderIndex,
    skipped: draft.skipped,
    sessionInserted: draft.sessionInserted,
    status: draft.status,
    slotId: draft.slotId,
    templateSlotId: draft.templateSlotId,
    templateExerciseId: draft.templateExerciseId,
    notes: draft.notes,
    swappedFrom: draft.swappedFrom,
  }));
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

interface WorkoutCelebrationState {
  workoutName: string;
  heroImageUrl: string | null;
  workoutsThisWeek: number;
  totalLiftedKgThisWeek: number;
  totalDurationMinutesThisWeek: number;
  prCount: number;
}

function getStartOfWeek(date: Date) {
  const next = new Date(date);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setHours(0, 0, 0, 0);
  next.setDate(next.getDate() + diff);
  return next;
}

function getEndOfWeek(date: Date) {
  const start = getStartOfWeek(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return end;
}

function buildWorkoutCelebrationState({
  completionSummary,
  workoutSessions,
}: {
  completionSummary: CompletionSummaryState;
  workoutSessions: AppDatabase['workoutSessions'];
}): WorkoutCelebrationState {
  const performedAt = new Date(completionSummary.performedAt);
  const weekStart = getStartOfWeek(performedAt);
  const weekEnd = getEndOfWeek(performedAt);

  const hasCurrentSession = workoutSessions.some((session) => session.id === completionSummary.sessionId);
  const sessionsForCalculation = hasCurrentSession
    ? workoutSessions
    : [
        ...workoutSessions,
        {
          id: completionSummary.sessionId,
          workoutTemplateId: '__summary__',
          workoutNameSnapshot: completionSummary.workoutName,
          performedAt: completionSummary.performedAt,
          durationMinutes: completionSummary.durationMinutes,
          setsCompleted: completionSummary.setsCompleted,
          totalVolumeKg: completionSummary.totalVolume,
        },
      ];

  const sessionsThisWeek = sessionsForCalculation.filter((session) => {
    const performed = new Date(session.performedAt);
    return performed >= weekStart && performed < weekEnd;
  });

  return {
    workoutName: completionSummary.workoutName,
    heroImageUrl: completionSummary.prCards[0]?.imageUrl ?? completionSummary.exerciseCards[0]?.imageUrl ?? null,
    workoutsThisWeek: sessionsThisWeek.length,
    totalLiftedKgThisWeek: sessionsThisWeek.reduce((total, session) => total + (session.totalVolumeKg ?? 0), 0),
    totalDurationMinutesThisWeek: sessionsThisWeek.reduce((total, session) => total + (session.durationMinutes ?? 0), 0),
    prCount: completionSummary.prCards.length,
  };
}

const DEFAULT_HOME_AI_PROMPT_SUGGESTIONS = [
  'Best 3-day muscle plan?',
  'Bench stuck?',
  'Fix my split?',
  '30-day run challenge?',
];

const WORKOUT_LOGGER_TIP_ID = 'workout_logger_start';

function getBackRoute(route: AppRoute): AppRoute | null {
  if (
    route.tab === 'home' &&
    (route.screen === 'ai' || route.screen === 'ai_setup' || route.screen === 'history' || route.screen === 'session')
  ) {
    return ROOT_ROUTES.home;
  }

  if (route.tab === 'workout' && route.screen === 'detail') {
    return ROOT_ROUTES.workout;
  }

  if (
    route.tab === 'workout' &&
    (route.screen === 'plans' ||
      route.screen === 'program' ||
      route.screen === 'template' ||
      route.screen === 'editor' ||
      route.screen === 'log' ||
      route.screen === 'summary' ||
      route.screen === 'celebration')
  ) {
    return WORKOUT_PLAN_ROUTE;
  }

  if (route.tab === 'progress' && (route.screen === 'detail' || route.screen === 'bodyweight')) {
    return ROOT_ROUTES.progress;
  }

  if (route.tab === 'profile' && route.screen === 'setup') {
    return ROOT_ROUTES.profile;
  }

  if (route.tab === 'profile' && route.screen === 'settings') {
    return ROOT_ROUTES.profile;
  }

  if (route.tab === 'profile' && route.screen === 'plan_settings') {
    return { tab: 'profile', screen: 'settings' };
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

function getDefaultTrainingEnvironment(equipment: SetupEquipment): SetupTrainingEnvironment {
  switch (equipment) {
    case 'gym':
      return 'full_gym';
    case 'home':
      return 'home_gym';
    case 'minimal':
    default:
      return 'minimal_equipment';
  }
}

function buildSetupSelectionFromPreferences(preferences: AppPreferences): FirstRunSetupSelection | null {
  if (
    !preferences.setupCompleted ||
    !preferences.setupGoal ||
    !preferences.setupDaysPerWeek ||
    !preferences.setupEquipment
  ) {
    return null;
  }

  return {
    profileName: preferences.profileName,
    gender: preferences.setupGender ?? DEFAULT_FIRST_RUN_SELECTION.gender,
    age: preferences.setupAge ?? DEFAULT_FIRST_RUN_SELECTION.age,
    ageRange: preferences.setupAgeRange ?? DEFAULT_FIRST_RUN_SELECTION.ageRange,
    goal: preferences.setupGoal,
    goals:
      preferences.setupGoals.length > 0
        ? preferences.setupGoals
        : [preferences.setupGoal],
    level: preferences.setupLevel ?? DEFAULT_FIRST_RUN_SELECTION.level,
    daysPerWeek: preferences.setupDaysPerWeek,
    equipment: preferences.setupEquipment,
    trainingEnvironment:
      preferences.setupTrainingEnvironment ?? getDefaultTrainingEnvironment(preferences.setupEquipment),
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
    currentWeightKg: preferences.setupCurrentWeightKg,
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
    profileName: selection.profileName?.trim() ? selection.profileName.trim().slice(0, 32) : null,
    setupGender: selection.gender,
    setupAge: selection.age ?? null,
    setupAgeRange: selection.ageRange ?? null,
    setupGoal: selection.goal,
    setupGoals: selection.goals?.length ? selection.goals : [selection.goal],
    setupLevel: selection.level,
    setupDaysPerWeek: selection.daysPerWeek,
    setupEquipment: selection.equipment,
    setupTrainingEnvironment: selection.trainingEnvironment,
    setupSecondaryOutcomes: selection.secondaryOutcomes,
    setupFocusAreas: selection.focusAreas,
    setupGuidanceMode: selection.guidanceMode,
    setupScheduleMode: selection.scheduleMode,
    setupWeeklyMinutes: selection.weeklyMinutes ?? null,
    setupAvailableDays: selection.scheduleMode === 'self_managed' ? selection.availableDays : [],
    setupCurrentWeightKg: selection.currentWeightKg ?? null,
    bodyweightGoalKg: selection.targetWeightKg ?? null,
    recommendedProgramId,
    activePlanId: null,
    unitPreference: selection.unitPreference,
  };
}

function getOnboardingFallbackTrackingMode(name: string): WorkoutTemplateExercise['trackingMode'] {
  const normalized = name.toLowerCase();
  if (
    normalized.includes('bodyweight') ||
    normalized.includes('push-up') ||
    normalized.includes('plank') ||
    normalized.includes('mountain climber') ||
    normalized.includes('glute bridge') ||
    normalized.includes('lunge') ||
    normalized.includes('inverted row') ||
    normalized.includes('mobility') ||
    normalized.includes('run')
  ) {
    return 'bodyweight';
  }

  return 'load_and_reps';
}

function buildOnboardingFallbackExercise(
  name: string,
  sessionId: string,
  exerciseIndex: number,
): WorkoutTemplateExercise {
  const role = exerciseIndex === 0 ? 'primary' : exerciseIndex < 3 ? 'secondary' : 'accessory';

  return {
    id: `${sessionId}_exercise_${exerciseIndex + 1}`,
    exerciseName: name,
    slotId: `${role}_${exerciseIndex + 1}`,
    role,
    progressionPriority: exerciseIndex === 0 ? 'high' : exerciseIndex < 3 ? 'medium' : 'low',
    trackingMode: getOnboardingFallbackTrackingMode(name),
    sets: exerciseIndex === 0 ? 3 : 2,
    repsMin: name.toLowerCase().includes('plank') ? 20 : 10,
    repsMax: name.toLowerCase().includes('plank') ? 40 : 15,
    restSecondsMin: exerciseIndex === 0 ? 75 : 45,
    restSecondsMax: exerciseIndex === 0 ? 120 : 75,
    substitutionGroup: `onboarding_${role}_${exerciseIndex + 1}`,
  };
}

function buildSavedOnboardingPlan(
  selection: FirstRunSetupSelection,
  recommendedProgramId: string,
  savedTemplateId?: string,
) {
  const template = getWorkoutTemplateById(recommendedProgramId);
  const planReadyPayload = buildRecommendationPlanReadyPayload(selection, recommendedProgramId);
  const trainingDays = planReadyPayload.weeklySchedule.filter((day) => day.source === 'template' || day.keyLifts.length > 0);
  const sessions = trainingDays.map((day, dayIndex) => {
    const sourceSession = day.source === 'template'
      ? template?.sessions.find((session) => session.id === day.id) ?? null
      : null;
    const sessionId = `onboarding_${recommendedProgramId}_${dayIndex + 1}`;
    const exercises = sourceSession
      ? sourceSession.exercises.map((exercise) => ({
          ...exercise,
          id: `${sessionId}_${exercise.id}`,
          slotId: `${exercise.slotId}_${dayIndex + 1}`,
        }))
      : day.keyLifts.map((lift, exerciseIndex) => buildOnboardingFallbackExercise(lift, sessionId, exerciseIndex));

    return {
      id: sessionId,
      name: formatWorkoutDisplayLabel(day.name, 'Workout'),
      orderIndex: dayIndex,
      exercises,
    };
  });
  const draft: WorkoutTemplateDraft = {
    name: buildFirstRunCustomProgramName(selection),
    sessions: sessions.map((session) => ({
      id: session.id,
      name: session.name,
      exercises: session.exercises.map((exercise) => ({
        id: exercise.id,
        name: exercise.exerciseName,
        targetSets: exercise.sets,
        repMin: exercise.repsMin,
        repMax: exercise.repsMax,
        restSeconds: exercise.restSecondsMax,
        trackedDefault: true,
      })),
    })),
  };
  const runtimeTemplate: WorkoutRuntimeTemplate = {
    id: savedTemplateId ?? recommendedProgramId,
    name: draft.name,
    defaultScheduleMode: 'rolling_sequence',
    sessions,
  };

  return { draft, runtimeTemplate, firstSessionId: sessions[0]?.id ?? null };
}

function buildSavedOnboardingWorkoutPlan(
  selection: FirstRunSetupSelection,
  workoutTemplateId: string,
  sessionIds: string[],
) {
  const days = selection.scheduleMode === 'self_managed' && selection.availableDays.length > 0
    ? selection.availableDays
    : DEFAULT_RHYTHM_BY_DAYS[selection.daysPerWeek] ?? DEFAULT_RHYTHM_BY_DAYS[3];
  const timestamp = new Date().toISOString();
  const planId = `onboarding_plan_${workoutTemplateId}`;

  return {
    id: planId,
    name: buildFirstRunCustomProgramName(selection),
    mode: 'rotation' as const,
    entries: Array.from({ length: Math.max(1, sessionIds.length) }, (_, index) => ({
      id: `${planId}_entry_${index + 1}`,
      workoutTemplateId,
      workoutTemplateSessionId: sessionIds[index] ?? null,
      label: days[index % days.length] ?? `Day ${index + 1}`,
      orderIndex: index,
    })),
    isActive: true,
    createdAt: timestamp,
    updatedAt: timestamp,
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

function formatSplitLabel(splitType?: string) {
  if (!splitType) {
    return 'Workout plan';
  }

  return splitType
    .split('_')
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' / ');
}

function getExerciseFocusName(name: string) {
  const normalized = name.toLowerCase();
  if (/(squat|lunge|leg press|leg extension|quad)/.test(normalized)) {
    return 'Lower Focus';
  }
  if (/(deadlift|hip thrust|glute|leg curl|hamstring)/.test(normalized)) {
    return 'Posterior Focus';
  }
  if (/(bench|press|push-up|fly|dip)/.test(normalized)) {
    return 'Push Focus';
  }
  if (/(row|pull-up|pulldown|face pull)/.test(normalized)) {
    return 'Pull Focus';
  }
  if (/(run|mobility|stretch|yoga|conditioning|hiit)/.test(normalized)) {
    return 'Conditioning Focus';
  }
  return 'Full Body Focus';
}

function formatHomeSessionTitle(name: string, exercises: Array<{ name?: string; exerciseName?: string }>) {
  const displayName = formatWorkoutDisplayLabel(name, 'Workout');
  if (!/^(minimal\s+[abc]|workout\s+[abc]|day\s+\d+|session\s+\d+)$/i.test(displayName.trim())) {
    return displayName.length > 22 ? `${displayName.slice(0, 20).trim()}...` : displayName;
  }

  const primaryName = exercises[0]?.name ?? exercises[0]?.exerciseName ?? '';
  return getExerciseFocusName(primaryName);
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
    measurementEntries,
    getWorkoutExercises,
    getWorkoutTemplateSessions,
    getSessionLogs,
    setUnitPreference,
    updatePreferences,
    completeOnboarding,
    upsertWorkoutTemplate,
    upsertWorkoutPlan,
    deleteWorkoutTemplate,
    resetAllData,
    addBodyweightEntry,
    addMeasurementEntry,
    saveCompletedWorkoutSession,
    updateCompletedWorkoutSession,
  } = useAppContext();
  const workout = useWorkoutContext();

  const [navigationState, setNavigationState] = useState<NavigationState>({
    route: ROOT_ROUTES.home,
    history: [],
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [completionSummary, setCompletionSummary] = useState<CompletionSummaryState | null>(null);
  const [workoutCelebration, setWorkoutCelebration] = useState<WorkoutCelebrationState | null>(null);
  const [finishSaveState, setFinishSaveState] = useState<FinishSaveState>({
    status: 'idle',
    sessionId: null,
    message: null,
  });
  const [minimumSplashElapsed, setMinimumSplashElapsed] = useState(false);
  const [nativeSplashHidden, setNativeSplashHidden] = useState(false);
  const [fontsLoaded, setFontsLoaded] = useState(false);

  const exerciseBrowserItems = useMemo(
    () => exerciseLibrary.filter((item) => !item.id.startsWith('lib_')),
    [exerciseLibrary],
  );
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

  useEffect(() => {
    const timeout = setTimeout(() => setMinimumSplashElapsed(true), 1200);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadFonts() {
      await Font.loadAsync({
        Inter: require('./assets/fonts/Inter.ttf'),
        Manrope: require('./assets/fonts/Manrope.ttf'),
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

  function navigateToTab(tab: RootTabKey) {
    resetToRoute(ROOT_ROUTES[tab]);
  }

  function navigateToWorkoutLog(workoutTemplateId: string) {
    workoutLogNavigationAllowedAtRef.current = Date.now();
    navigate({ tab: 'workout', screen: 'log', workoutTemplateId });
  }

  async function openAiMode(preferencesPatch?: Partial<AppPreferences>) {
    const nextPreferences = preferencesPatch ? { ...preferences, ...preferencesPatch } : preferences;
    if (!nextPreferences.aiSetupCompleted) {
      navigate({ tab: 'home', screen: 'ai_setup' });
      return;
    }

    if (
      navigateToActiveWorkout(
        workout.activeSession ? 'Resume current workout before starting another.' : undefined,
      )
    ) {
      return;
    }

    try {
      const templateId = getAiCoachTemplateId(nextPreferences);
      const setupHash = buildAiCoachSetupHash(nextPreferences);
      const currentRuntimeTemplate = customWorkoutRuntimeMap[templateId] ?? null;
      const shouldRegenerate = !currentRuntimeTemplate || nextPreferences.aiCoachSetupHash !== setupHash;

      let runtimeTemplate = currentRuntimeTemplate;
      let persistedTemplateId = templateId;

      if (shouldRegenerate) {
        const draft = buildAiCoachWorkoutDraft(nextPreferences, exerciseLibrary);
        runtimeTemplate = buildAiCoachRuntimeTemplate(draft, exerciseLibrary, nextPreferences.defaultRestSeconds);
        persistedTemplateId = await upsertWorkoutTemplate(draft);
        await updatePreferences({
          aiCoachTemplateId: persistedTemplateId,
          aiCoachSetupHash: setupHash,
          aiCoachPlanGeneratedAt: new Date().toISOString(),
          trainingFirstRunDismissed: true,
        });
      }

      if (!runtimeTemplate) {
        navigate({
          tab: 'home',
          screen: 'ai',
          prompt: 'Build my next progressive workout.',
        });
        return;
      }

      const completedSessionCount = workoutSessions.filter(
        (session) => session.workoutTemplateId === persistedTemplateId,
      ).length;
      const nextSessionId = getAiCoachNextSessionId(
        persistedTemplateId,
        runtimeTemplate,
        completedSessionCount,
      );

      workout.startCustomWorkout(
        buildCustomSessionRuntimeTemplate(runtimeTemplate, nextSessionId),
        nextPreferences.unitPreference,
      );
      navigateToWorkoutLog(persistedTemplateId);
      showToast(shouldRegenerate ? 'GAINER AI plan ready' : 'GAINER AI next workout loaded');
    } catch (error) {
      console.error('Failed to open GAINER AI workout flow', error);
      showToast('Could not build the GAINER AI workout');
      navigate({
        tab: 'home',
        screen: 'ai',
        prompt: 'Build my next progressive workout.',
      });
    }
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
    if (route.tab === 'workout' && route.screen === 'log') {
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
      route.screen === 'log' &&
      !workout.templates.some((template) => template.id === route.workoutTemplateId) &&
      !workoutTemplates.some((template) => template.id === route.workoutTemplateId)
    ) {
      replaceRoute(WORKOUT_PLAN_ROUTE);
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
      route.screen === 'program' &&
      ((route.programType === 'ready' && !workout.templates.some((template) => template.id === route.workoutTemplateId)) ||
        (route.programType === 'custom' && !workoutTemplates.some((template) => template.id === route.workoutTemplateId)))
    ) {
      replaceRoute(WORKOUT_PLAN_ROUTE);
    }

    if (
      route.tab === 'workout' &&
      route.screen === 'editor' &&
      route.workoutTemplateId &&
      !workoutTemplates.some((template) => template.id === route.workoutTemplateId)
    ) {
      replaceRoute(WORKOUT_PLAN_ROUTE);
    }

    if (
      route.tab === 'workout' &&
      route.screen === 'template' &&
      route.workoutTemplateId &&
      !workoutTemplates.some((template) => template.id === route.workoutTemplateId)
    ) {
      replaceRoute(WORKOUT_PLAN_ROUTE);
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
      const nextRoute = summaryExitRouteRef.current ?? WORKOUT_PLAN_ROUTE;
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
      const nextRoute = getBackRoute(route);
      if (!nextRoute && navigationState.history.length === 0) {
        return false;
      }

      if (route.tab === 'workout' && route.screen === 'summary') {
        setCompletionSummary(null);
        setFinishSaveState({ status: 'idle', sessionId: null, message: null });
        workout.clearCompletedWorkout();
        navigateBack(summaryExitRouteRef.current ?? WORKOUT_PLAN_ROUTE);
        return true;
      }

      navigateBack(nextRoute);
      return true;
    });

    return () => subscription.remove();
  }, [navigationState.history.length, onboardingActive, route, workout]);

  const homeSummary = useMemo(() => getHomeSummary(database, unitPreference), [database, unitPreference]);
  const lifetimeSummary = useMemo(() => getLifetimeTrainingSummary(database), [database]);
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
    navigateToWorkoutLog(workout.activeSession.templateId);
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
    await updatePreferences({ trainingFirstRunDismissed: true });
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
    workout.finishWorkout(adaptedSession.performedAt);

    try {
      const summary = await saveCompletedWorkoutSession({
        ...adaptedSession,
        performedAt: adaptedSession.performedAt,
      });

      if (!summary.sessionId || !summary.performedAt) {
        throw new Error('Workout save did not produce a valid summary');
      }

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
      });
      setCompletionSummary({
        sessionId: adaptedSession.sessionId,
        workoutName: adaptedSession.workoutNameSnapshot,
        performedAt: summary.performedAt,
        durationMinutes: summary.durationMinutes,
        setsCompleted: summary.setsCompleted,
        totalVolume: summary.totalVolume,
        exercisesLogged: summary.exercisesLogged,
        exerciseCards: completionCards.exerciseCards,
        prCards: completionCards.prCards,
        insight,
      });
      summaryNavigationPendingRef.current = true;
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

  function waitForPlanSaveFeedback() {
    return new Promise<void>((resolve) => {
      setTimeout(resolve, 3000);
    });
  }

  function handleOpenReadyPrograms() {
    navigate(WORKOUT_PLAN_ROUTE);
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

  function handleSelectAiCoachAction(action: AICoachAction, prompt: string) {
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
        navigate(WORKOUT_PLAN_ROUTE);
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
          navigate(WORKOUT_PLAN_ROUTE);
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
          prefillName: action.prefillName ?? (prompt.trim() ? 'GAINER AI custom workout' : undefined),
        });
        return;

      default:
        navigate(ROOT_ROUTES.home);
    }
  }

  function handleOpenCustomPrograms() {
    navigate(WORKOUT_PLAN_ROUTE);
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

    void updatePreferences({ trainingFirstRunDismissed: true });
    const runtimeTemplate = buildReadySessionRuntimeTemplate(template, sessionId);
    workout.startCustomWorkout(runtimeTemplate, nextUnitPreference);
    navigateToWorkoutLog(workoutTemplateId);
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

    const selectedSession = customTemplate.sessions.find((session) => session.id === sessionId) ?? null;
    if (!selectedSession?.exercises.length) {
      showToast('Add exercises before starting this session');
      navigate({ tab: 'workout', screen: 'template', workoutTemplateId });
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

    void updatePreferences({ trainingFirstRunDismissed: true });
    const runtimeTemplate = buildCustomSessionRuntimeTemplate(customTemplate, sessionId);
    workout.startCustomWorkout(runtimeTemplate, unitPreference);
    navigateToWorkoutLog(workoutTemplateId);
  }

  function handleStartCustomProgram(workoutTemplateId: string) {
    const customTemplate = customWorkoutRuntimeMap[workoutTemplateId];
    const firstSessionId = customTemplate?.sessions.find((session) => session.exercises.length > 0)?.id;
    if (!firstSessionId) {
      showToast('Add exercises before starting this template');
      navigate({ tab: 'workout', screen: 'template', workoutTemplateId });
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

    navigate(WORKOUT_PLAN_ROUTE);
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
    navigate(WORKOUT_PLAN_ROUTE);
  }

  async function handleOnboardingSkip() {
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
    navigate(ROOT_ROUTES.home);
  }

  async function handleContinueEntry() {
    await updatePreferences({
      selectedSignInMethod: 'local',
      entryFlowCompleted: true,
      selectedAccessTier: 'free',
      adaptiveCoachPremiumUnlocked: false,
    });
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
    await waitForPlanSaveFeedback();
    await persistSetupSelection(selection, recommendedProgramId);
    const savedPlan = buildSavedOnboardingPlan(selection, recommendedProgramId);
    const savedTemplateId = await upsertWorkoutTemplate(savedPlan.draft);
    const activePlan = buildSavedOnboardingWorkoutPlan(
      selection,
      savedTemplateId,
      savedPlan.runtimeTemplate.sessions.map((session) => session.id),
    );
    await upsertWorkoutPlan(activePlan);
    await updatePreferences({ activePlanId: activePlan.id });
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

  function handleOpenPlanSettings() {
    navigate({ tab: 'profile', screen: 'plan_settings' });
  }

  function handleOpenProfileSettings() {
    navigate({ tab: 'profile', screen: 'settings' });
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
    showToast(nextMode === 'app_managed' ? 'GAINER manages the week' : 'You manage the days');
  }

  async function handleSetupCompleteToTraining(selection: FirstRunSetupSelection, recommendedProgramId: string) {
    await waitForPlanSaveFeedback();
    await persistSetupSelection(selection, recommendedProgramId);
    const savedPlan = buildSavedOnboardingPlan(selection, recommendedProgramId);
    const savedTemplateId = await upsertWorkoutTemplate(savedPlan.draft);
    const activePlan = buildSavedOnboardingWorkoutPlan(
      selection,
      savedTemplateId,
      savedPlan.runtimeTemplate.sessions.map((session) => session.id),
    );
    await upsertWorkoutPlan(activePlan);
    await updatePreferences({ activePlanId: activePlan.id });
    showToast('Setup updated');
    resetToRoute(ROOT_ROUTES.home);
  }

  async function handleSetupOpenProgramDetail(selection: FirstRunSetupSelection, recommendedProgramId: string) {
    await persistSetupSelection(selection, recommendedProgramId);
    showToast('Setup updated');
    const template = getWorkoutTemplateById(recommendedProgramId);
    if (!template) {
      navigate(WORKOUT_PLAN_ROUTE);
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
  const recentExerciseBrowserItems = useMemo(
    () => recentExerciseLibraryItems.filter((item) => !item.id.startsWith('lib_')),
    [recentExerciseLibraryItems],
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
  const exercisePrLookup = useMemo(
    () =>
      buildExercisePrLookup({
        exerciseLogs: database.exerciseLogs,
        workoutSessions: database.workoutSessions,
        exerciseTemplates: database.exerciseTemplates,
      }),
    [database.exerciseLogs, database.exerciseTemplates, database.workoutSessions],
  );
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
      homeSummary,
      selectedCustomProgram.title,
      selectedCustomProgram.workoutId,
      trackedProgress,
      unitPreference,
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
      workout.templates.length,
      workoutSessions,
      database.exerciseLogs,
    ],
  );
  const setupSelection = useMemo(() => buildSetupSelectionFromPreferences(preferences), [preferences]);
  const tailoringPreferences = useMemo(() => buildTailoringPreferences(preferences), [preferences]);
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
    () => (recommendedReadyTemplate ? getReadyProgramContent(recommendedReadyTemplate.id) : null),
    [recommendedReadyTemplate],
  );
  const homeActivePlanCard = useMemo(() => {
    const completedPlanSessions = getCanonicalCompletedSessions(database);
    const activeWorkoutPlan = database.workoutPlans.find((plan) => plan.id === preferences.activePlanId) ?? null;
    if (activeWorkoutPlan?.entries.length) {
      const sortedEntries = [...activeWorkoutPlan.entries].sort((left, right) => left.orderIndex - right.orderIndex);
      const firstEntry = sortedEntries[0];
      const activeTemplate = workoutTemplates.find((template) => template.id === firstEntry.workoutTemplateId) ?? null;
      const activeTemplateSessions = activeTemplate ? getWorkoutTemplateSessions(activeTemplate.id) : [];
      const orderedPlanSessions = sortedEntries
        .map((entry) => {
          if (entry.workoutTemplateSessionId) {
            return activeTemplateSessions.find((session) => session.id === entry.workoutTemplateSessionId) ?? null;
          }

          return activeTemplateSessions[entry.orderIndex] ?? null;
        })
        .filter((session): session is NonNullable<typeof session> => Boolean(session));
      const homeSessions = orderedPlanSessions.map((session) => {
        const exerciseCount = session.exercises.length;
        const estimatedDuration = Math.max(20, Math.round(exerciseCount * 10));

        return {
          id: session.id,
          title: formatHomeSessionTitle(session.name, session.exercises),
          duration: `~${estimatedDuration} min`,
          exercises: session.exercises.slice(0, 5).map((exercise) => ({
            name: exercise.name,
            setsLabel: `${exercise.targetSets} sets`,
          })),
          hiddenExerciseCount: Math.max(exerciseCount - 5, 0),
        };
      });
      const nextSession = homeSessions[0] ?? null;
      if (activeTemplate && nextSession) {
        const estimatedDuration = Number.parseInt(nextSession.duration.replace(/\D/g, ''), 10) || 20;
        const planTemplateIds = new Set(sortedEntries.map((entry) => entry.workoutTemplateId));
        const completedSessionCount = completedPlanSessions.filter((session) => planTemplateIds.has(session.workoutTemplateId)).length;
        const planProgress = buildHomePlanProgress({
          completedSessions: completedSessionCount,
          sessionsPerWeek: sortedEntries.length,
        });

        return {
          programId: activeTemplate.id,
          programType: 'custom' as const,
          eyebrow: `${sortedEntries.length} day custom plan`,
          goalLabel: formatGoalLabel(preferences.aiPlannerGoal || preferences.setupGoal || 'general'),
          title: formatWorkoutDisplayLabel(activeWorkoutPlan.name || activeTemplate.name, 'Workout plan'),
          subtitle: `${sortedEntries.length} workouts in rotation.`,
          weekLabel: planProgress.weekLabel,
          progressPercent: planProgress.progressPercent,
          sessionsPerWeek: `${sortedEntries.length}`,
          weeklyMinutes: `~${estimatedDuration * sortedEntries.length} min`,
          sessions: homeSessions,
          nextSession: {
            ...nextSession,
            label: 'Week 1 · Day 1',
          },
        };
      }
    }

    const nextSession = recommendedReadyTemplate?.sessions[0] ?? null;
    if (!recommendedReadyTemplate || !nextSession) {
      return null;
    }

    const weeklyMinutes = recommendedReadyTemplate.daysPerWeek * recommendedReadyTemplate.estimatedSessionDuration;
    const completedSessionCount = completedPlanSessions.filter(
      (session) => session.workoutTemplateId === recommendedReadyTemplate.id,
    ).length;
    const planProgress = buildHomePlanProgress({
      completedSessions: completedSessionCount,
      sessionsPerWeek: recommendedReadyTemplate.daysPerWeek,
    });
    const homeSessions = recommendedReadyTemplate.sessions.map((session) => ({
      id: session.id,
      title: formatHomeSessionTitle(session.name, session.exercises),
      duration: `~${recommendedReadyTemplate.estimatedSessionDuration} min`,
      exercises: session.exercises.map((exercise) => ({
        name: exercise.exerciseName,
        setsLabel: `${exercise.sets} sets`,
      })),
      hiddenExerciseCount: Math.max(session.exercises.length - 5, 0),
    }));
    const firstHomeSession = homeSessions[0];

    return {
      programId: recommendedReadyTemplate.id,
      programType: 'ready' as const,
      eyebrow: `${recommendedReadyTemplate.daysPerWeek} day ${formatSplitLabel(recommendedReadyTemplate.splitType)}`,
      goalLabel: formatGoalLabel(recommendedReadyTemplate.goalType),
      title: formatWorkoutDisplayLabel(recommendedReadyTemplate.name, 'Workout plan'),
      subtitle: recommendedReadyContent?.summary ?? 'Your recommended plan is ready to run.',
      weekLabel: planProgress.weekLabel,
      progressPercent: planProgress.progressPercent,
      sessionsPerWeek: `${recommendedReadyTemplate.daysPerWeek}`,
      weeklyMinutes: `~${weeklyMinutes} min`,
      sessions: homeSessions,
      nextSession: {
        ...firstHomeSession,
        label: 'Week 1 · Day 1',
      },
    };
  }, [database, getWorkoutTemplateSessions, preferences.activePlanId, preferences.aiPlannerGoal, preferences.setupGoal, recommendedReadyContent, recommendedReadyTemplate, workoutTemplates]);
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
            title: formatWorkoutDisplayLabel(session.workoutNameSnapshot, 'Workout'),
            dateLabel: formatShortDate(session.performedAt),
            durationLabel:
              typeof session.durationMinutes === 'number' && session.durationMinutes > 0
                ? formatDurationMinutes(session.durationMinutes)
                : '0 min',
            volumeLabel: formatVolume(session.totalVolumeKg ?? 0, unitPreference),
            detailLabel: completedSets !== null ? `${completedSets} sets` : `${completedExercises} exercises`,
            exercisePreview: exercisePreview || 'Workout completed',
            notePreview,
          };
        }),
    [getSessionLogs, unitPreference, workoutSessions],
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
  const readyTemplateCount = workout.templates.filter((template) => template.id.startsWith('tpl_gainer_')).length;
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
    if (entryFlowActive) {
      content = (
        <WelcomeScreen
          language={preferences.appLanguage}
          onContinue={() => void handleContinueEntry()}
        />
      );
    } else {
      content = (
        <OnboardingScreen
          initialUnitPreference={unitPreference}
          tailoringPreferences={tailoringPreferences}
          readyProgramCount={workout.templates.length}
          dismissedTipIds={dismissedTipIds}
          onDismissTip={handleDismissTip}
          onBackToEntry={handleBackToEntry}
          onSkip={handleOnboardingSkip}
          onCompleteToTraining={handleOnboardingCompleteToTraining}
          onCompleteToProgramDetail={handleOnboardingCompleteToProgramDetail}
          onCompleteToCustom={handleOnboardingCompleteToCustom}
        />
      );
    }
  } else if (route.tab === 'profile' && route.screen === 'setup') {
    content = (
      <OnboardingScreen
        key={`setup:${preferences.recommendedProgramId ?? 'none'}:${preferences.setupCompleted ? 'complete' : 'pending'}`}
        mode="edit"
        initialSelection={setupSelection ?? DEFAULT_FIRST_RUN_SELECTION}
        initialStage={setupSelection ? 'review' : 'location'}
        initialUnitPreference={unitPreference}
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
      const readyProgramTailoringBadges = buildTailoringBadgeLabels(tailoringPreferences).slice(0, 3);
      const program = readyTemplate
        ? buildReadyProgramDetail(
            readyTemplate,
            programInsightsByTemplateId[route.workoutTemplateId],
            readyProgramFitExplanation,
            readyProgramTailoringBadges,
          )
      : customTemplate
        ? buildCustomProgramDetail(customTemplate, programInsightsByTemplateId[route.workoutTemplateId])
        : null;

    content = program ? (
      <ProgramDetailScreen
        program={program}
        activePlanSummary={
          homeActivePlanCard?.programId === route.workoutTemplateId && homeActivePlanCard.programType === route.programType
            ? {
                weekLabel: homeActivePlanCard.weekLabel,
                progressPercent: homeActivePlanCard.progressPercent,
                sessionsPerWeek: homeActivePlanCard.sessionsPerWeek,
                weeklyMinutes: homeActivePlanCard.weeklyMinutes,
              }
            : null
        }
        onBack={() => navigateBack(WORKOUT_PLAN_ROUTE)}
        onPrimaryAction={() => {
          if (route.programType === 'ready') {
            handleStartReadyProgram(route.workoutTemplateId);
            return;
          }

          if (!customTemplate?.sessions.some((session) => session.exercises.length > 0)) {
            navigate({ tab: 'workout', screen: 'template', workoutTemplateId: route.workoutTemplateId });
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
        onEdit={route.programType === 'custom' ? () => navigate({ tab: 'workout', screen: 'template', workoutTemplateId: route.workoutTemplateId }) : undefined}
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
  } else if (route.tab === 'workout' && route.screen === 'template') {
    content = (
      <CreateTemplateScreen
        key={route.workoutTemplateId ?? 'new_template'}
        initialDraft={templateBuilderDraft}
        exerciseLibrary={exerciseBrowserItems}
        recentExerciseLibraryItems={recentExerciseBrowserItems}
        defaultRestSeconds={preferences.defaultRestSeconds}
        onBack={() => navigateBack(WORKOUT_PLAN_ROUTE)}
        onSave={async (draft) => {
          const isEditing = Boolean(draft.id);
          const workoutTemplateId = await upsertWorkoutTemplate(draft);
          showToast(isEditing ? 'Template updated' : 'Template saved');
          replaceRoute({ tab: 'workout', screen: 'program', programType: 'custom', workoutTemplateId });
        }}
      />
    );
  } else if (route.tab === 'workout' && (route.screen === 'editor' || route.screen === 'empty')) {
    content = (
      <WorkoutEditorScreen
        key={`${route.screen}:${route.screen === 'editor' ? route.workoutTemplateId ?? 'new' : 'empty'}:${route.screen === 'editor' ? route.prefillName ?? '' : ''}`}
        presentation={route.screen === 'empty' ? 'emptyWorkout' : 'editor'}
        initialDraft={editorDraft}
        exerciseLibrary={exerciseBrowserItems}
        recentExerciseLibraryItems={recentExerciseBrowserItems}
        defaultRestSeconds={preferences.defaultRestSeconds}
        unitPreference={unitPreference}
        exerciseHistoryLookup={editorExerciseHistoryLookup}
        exercisePrLookup={exercisePrLookup}
        inlineTip={null}
        onBack={() => navigateBack(route.screen === 'empty' ? ROOT_ROUTES.home : WORKOUT_PLAN_ROUTE)}
        onUseTemplate={() => navigate(WORKOUT_PLAN_ROUTE)}
        onSave={async (draft, summary: WorkoutEditorFinishSummary) => {
          const isNew = !draft.id;
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
          if (isNew && route.screen !== 'empty') {
            showToast('Workout created');
          }
          setCompletionSummary({
            sessionId,
            ...summary,
            insight: null,
          });
          summaryExitRouteRef.current = ROOT_ROUTES.home;
          replaceRoute({ tab: 'workout', screen: 'summary' });
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
        exerciseLibrary={exerciseBrowserItems}
        recentExerciseLibraryItems={recentExerciseBrowserItems}
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
        exerciseCards={completionSummary.exerciseCards}
        prCards={completionSummary.prCards}
        insight={completionSummary.insight}
        unitPreference={unitPreference}
        onDone={() => {
          setCompletionSummary(null);
          setWorkoutCelebration(null);
          setFinishSaveState({ status: 'idle', sessionId: null, message: null });
          workout.clearCompletedWorkout();
          resetToRoute(ROOT_ROUTES.home);
        }}
        onSaveSummary={async ({ sessionName, notes }) => {
          setFinishSaveState({
            status: 'saving',
            sessionId: completionSummary.sessionId,
            message: null,
          });
          try {
            await updateCompletedWorkoutSession(completionSummary.sessionId, {
              workoutNameSnapshot: sessionName.trim() || completionSummary.workoutName,
              sessionNotes: notes.trim() ? notes.trim() : null,
            });
            const nextCelebration = buildWorkoutCelebrationState({
              completionSummary: {
                ...completionSummary,
                workoutName: sessionName.trim() || completionSummary.workoutName,
              },
              workoutSessions,
            });
            setCompletionSummary(null);
            setWorkoutCelebration(nextCelebration);
            setFinishSaveState({ status: 'idle', sessionId: null, message: null });
            workout.clearCompletedWorkout();
            replaceRoute({ tab: 'workout', screen: 'celebration' });
          } catch (error) {
            console.error('Failed to save workout summary', error);
            setFinishSaveState({
              status: 'error',
              sessionId: completionSummary.sessionId,
              message: 'Could not save workout details',
            });
          }
        }}
        isSaving={finishSaveState.status === 'saving' && finishSaveState.sessionId === completionSummary.sessionId}
      />
    );
  } else if (route.tab === 'workout' && route.screen === 'celebration' && workoutCelebration) {
    content = (
      <WorkoutCelebrationScreen
        workoutName={workoutCelebration.workoutName}
        heroImageUrl={workoutCelebration.heroImageUrl}
        workoutsThisWeek={workoutCelebration.workoutsThisWeek}
        totalLiftedKgThisWeek={workoutCelebration.totalLiftedKgThisWeek}
        totalDurationMinutesThisWeek={workoutCelebration.totalDurationMinutesThisWeek}
        prCount={workoutCelebration.prCount}
        unitPreference={unitPreference}
        onDone={() => {
          setWorkoutCelebration(null);
          setFinishSaveState({ status: 'idle', sessionId: null, message: null });
          resetToRoute(ROOT_ROUTES.home);
        }}
        onViewProgress={() => {
          setWorkoutCelebration(null);
          setFinishSaveState({ status: 'idle', sessionId: null, message: null });
          resetToRoute(ROOT_ROUTES.progress);
        }}
      />
    );
  } else if (route.tab === 'progress') {
    content = (
        <ProgressScreen
          summaries={trackedProgress}
          bodyweightProgress={bodyweightProgress}
          measurementEntries={measurementEntries}
          workoutSessions={workoutSessions}
          activityCalendar={homeSummary.streak.calendar}
          currentWeekStreak={homeSummary.streak.currentWeekStreak}
          unitPreference={unitPreference}
          selectedExerciseKey={route.screen === 'detail' ? route.exerciseKey : undefined}
        initialSection={route.screen === 'list' ? route.section : undefined}
        showBodyweightDetail={route.screen === 'bodyweight'}
        onSelectExercise={(exerciseKey) => navigate({ tab: 'progress', screen: 'detail', exerciseKey })}
        onSelectBodyweight={() => navigate({ tab: 'progress', screen: 'bodyweight' })}
        onAddBodyweight={async (weightKg) => {
          await addBodyweightEntry(weightKg);
          showToast('Bodyweight saved');
        }}
        onAddMeasurement={async (kind, value, unit) => {
          await addMeasurementEntry(kind, value, unit);
          showToast('Measurement saved');
        }}
        onBack={() => navigateBack(ROOT_ROUTES.progress)}
        plateaus={aiCoachTrainingContext.plateaus}
        fatigue={aiCoachTrainingContext.fatigue}
        recentSessions={homeRecentSessions}
        onOpenSessionHistory={() => navigate({ tab: 'home', screen: 'history' })}
        onOpenRecentSession={(sessionId) => navigate({ tab: 'home', screen: 'session', sessionId })}
      />
    );
  } else if (route.tab === 'home' && route.screen === 'ai') {
    content = (
      <AICoachScreen
        initialPrompt={route.prompt}
        suggestions={homeAiPromptSuggestions}
        trainingContext={aiCoachTrainingContext}
        onBack={() => navigateBack(ROOT_ROUTES.home)}
        onSubmitPrompt={handleOpenAICoach}
        onSelectAction={handleSelectAiCoachAction}
      />
    );
  } else if (route.tab === 'home' && route.screen === 'ai_setup') {
    content = (
      <AiModeSetupScreen
        preferences={preferences}
        onBack={() => navigateBack(ROOT_ROUTES.home)}
        onSave={async (patch) => {
          const nextPatch: Partial<AppPreferences> = {
            ...patch,
            aiCoachSetupHash: null,
            aiCoachPlanGeneratedAt: null,
          };
          await updatePreferences(nextPatch);
          showToast('GAINER AI setup saved');
          await openAiMode(nextPatch);
        }}
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
  } else if (route.tab === 'profile' && route.screen === 'settings') {
    content = (
      <ProfileSettingsScreen
        preferences={preferences}
        onBack={() => navigateBack(ROOT_ROUTES.profile)}
        onUnitPreferenceChange={async (nextUnit) => {
          await setUnitPreference(nextUnit);
          showToast(`Units set to ${nextUnit}`);
        }}
        onPreferencesChange={async (patch) => {
          await updatePreferences(patch);
        }}
        onSupportPress={undefined}
        onResetAllData={async () => {
          await resetAllData();
          setCompletionSummary(null);
          setWorkoutCelebration(null);
          setFinishSaveState({ status: 'idle', sessionId: null, message: null });
          workout.clearCompletedWorkout();
          showToast('All data reset');
          resetToRoute(ROOT_ROUTES.home);
        }}
      />
    );
  } else if (route.tab === 'profile' && route.screen === 'plan_settings') {
    content = (
      <PlanSettingsScreen
        preferences={preferences}
        recommendedProgramName={currentFitReadyTemplate?.name ?? recommendedReadyTemplate?.name ?? null}
        onBack={() => navigateBack({ tab: 'profile', screen: 'settings' })}
        onRefineSetup={handleOpenSetupEditor}
        onOpenExercisePreferences={handleOpenExercisePreferences}
        onOpenEquipment={handleOpenEquipment}
        onOpenJointSwaps={handleOpenJointSwaps}
        onOpenPremium={handleOpenPremium}
        onScheduleModeChange={(mode) => void handleUpdateScheduleMode(mode)}
        onOpenProgram={
          (setupRecommendation?.featuredProgramId ?? preferences.recommendedProgramId)
            ? () => openRecommendedProgramDetail((setupRecommendation?.featuredProgramId ?? preferences.recommendedProgramId)!)
            : undefined
        }
        onAskAiCoach={() =>
          navigate({
            tab: 'home',
            screen: 'ai',
            prompt: (currentFitReadyTemplate?.name ?? recommendedReadyTemplate?.name)
              ? `Why does ${formatWorkoutDisplayLabel(currentFitReadyTemplate?.name ?? recommendedReadyTemplate?.name ?? '')} fit me?`
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
            ? () => navigateToWorkoutLog(workout.activeSession?.templateId ?? preferences.recommendedProgramId ?? 'workout_upper')
            : undefined
        }
        onOpenPlanSettings={handleOpenPlanSettings}
      />
    );
  } else if (route.tab === 'profile') {
    content = (
      <ProfileScreen
        preferences={preferences}
        lifetime={lifetimeSummary}
        trackedProgress={trackedProgress}
        exerciseLibrary={exerciseLibrary}
        unitPreference={unitPreference}
        recommendedProgramName={currentFitReadyTemplate?.name ?? recommendedReadyTemplate?.name ?? null}
        recommendedProgramDaysPerWeek={currentFitReadyTemplate?.daysPerWeek ?? recommendedReadyTemplate?.daysPerWeek ?? null}
        planNextLabel={
          homeSummary.nextWorkout?.workout
            ? formatWorkoutDisplayLabel(homeSummary.nextWorkout.workout.name)
            : null
        }
        onUnitPreferenceChange={async (nextUnit) => {
          await setUnitPreference(nextUnit);
          showToast(`Units set to ${nextUnit}`);
        }}
        onPreferencesChange={async (patch) => {
          await updatePreferences(patch);
        }}
        onManagePlan={handleOpenPlanSettings}
        onEditTraining={handleOpenSetupEditor}
        onOpenProgress={() => navigate(ROOT_ROUTES.progress)}
        onOpenPremium={handleOpenPremium}
        onOpenSettings={handleOpenProfileSettings}
        onResetAllData={async () => {
          await resetAllData();
          setCompletionSummary(null);
          setWorkoutCelebration(null);
          setFinishSaveState({ status: 'idle', sessionId: null, message: null });
          workout.clearCompletedWorkout();
          showToast('All data reset');
          resetToRoute(ROOT_ROUTES.home);
        }}
      />
    );
  } else if (route.tab === 'workout' && route.screen === 'plans') {
    content = (
      <WorkoutsScreen
        customWorkouts={customWorkouts}
        programInsightsByTemplateId={programInsightsByTemplateId}
        recommendedReadyProgramId={recommendedReadyTemplate?.id ?? null}
        tailoringPreferences={tailoringPreferences}
        onOpenWorkout={navigateToWorkoutLog}
        onOpenReadyProgram={handleOpenReadyProgramDetail}
        onStartReadyProgram={handleStartReadyProgram}
        onOpenCustomProgram={handleOpenCustomProgramDetail}
        onStartCustomWorkout={handleStartCustomProgram}
        onEditCustomWorkout={(workoutTemplateId) => navigate({ tab: 'workout', screen: 'template', workoutTemplateId })}
        onDuplicateCustomWorkout={handleDuplicateCustomProgram}
        onDeleteCustomWorkout={handleDeleteCustomWorkout}
        onCreateWorkout={() => navigate({ tab: 'workout', screen: 'template' })}
      />
    );
  } else if (route.tab === 'workout' && route.screen === 'detail') {
    const exercise = exerciseBrowserItems.find((item) => item.id === route.exerciseId) ?? null;
    content = exercise ? (
      <ExerciseDetailScreen
        item={exercise}
        history={getExerciseProgressForName(database, exercise.name)}
        unitPreference={unitPreference}
        tracked={preferences.trackedExerciseLibraryItemIds.includes(exercise.id)}
        onBack={() => navigateBack(ROOT_ROUTES.workout)}
        onToggleTracked={(item) => {
          const trackedIds = preferences.trackedExerciseLibraryItemIds;
          const nextTrackedIds = trackedIds.includes(item.id)
            ? trackedIds.filter((id) => id !== item.id)
            : [...trackedIds, item.id];

          void updatePreferences({ trackedExerciseLibraryItemIds: nextTrackedIds });
        }}
        onAddToWorkout={(item) => navigate({ tab: 'workout', screen: 'editor', prefillName: item.name })}
      />
    ) : (
      <View />
    );
  } else if (route.tab === 'workout') {
    content = (
      <ExercisesScreen
        items={exerciseBrowserItems}
        trackedIds={preferences.trackedExerciseLibraryItemIds}
        onOpenExercise={(item) => navigate({ tab: 'workout', screen: 'detail', exerciseId: item.id })}
        onAddToWorkout={(item) => navigate({ tab: 'workout', screen: 'editor', prefillName: item.name })}
        onToggleTracked={(item) => {
          const trackedIds = preferences.trackedExerciseLibraryItemIds;
          const nextTrackedIds = trackedIds.includes(item.id)
            ? trackedIds.filter((id) => id !== item.id)
            : [...trackedIds, item.id];

          void updatePreferences({ trackedExerciseLibraryItemIds: nextTrackedIds });
        }}
      />
    );
  } else {
    content = (
      <HomeScreen
        activePlan={homeActivePlanCard}
        streak={homeSummary.streak}
        customTemplates={customWorkouts}
        readyTemplateCount={readyTemplateCount}
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
        onOpenTemplatesHub={() => navigate(WORKOUT_PLAN_ROUTE)}
        onCreateWorkoutFromExercises={() => navigate({ tab: 'workout', screen: 'empty' })}
        onBrowseReadyPlans={() => navigate(WORKOUT_PLAN_ROUTE)}
      />
    );
  }

  const showTabBar =
    !onboardingActive &&
    !(
      route.tab === 'workout' &&
      (route.screen === 'detail' ||
        route.screen === 'empty' ||
        route.screen === 'log' ||
        route.screen === 'summary' ||
        route.screen === 'celebration')
    );
  const setupOnboardingActive = route.tab === 'profile' && route.screen === 'setup';
  const onboardingScreenActive = onboardingActive || setupOnboardingActive;
  const shellTone =
    onboardingActive ||
    route.tab === 'progress' ||
    (route.tab === 'workout' &&
      (route.screen === 'list' || route.screen === 'detail' || route.screen === 'summary' || route.screen === 'celebration'))
      ? 'home'
      : route.tab;
  const welcomeActive = onboardingActive && entryFlowActive;
  const emptyWorkoutActive = route.tab === 'workout' && route.screen === 'empty';
  const readyTemplatesActive = route.tab === 'workout' && route.screen === 'plans';
  const exerciseDetailActive = route.tab === 'workout' && route.screen === 'detail';
  const exercisesListActive = route.tab === 'workout' && route.screen === 'list';
  const profileListActive = route.tab === 'profile' && route.screen === 'list';

  return (
    <AppShell
      toastMessage={toastMessage}
      screenTone={shellTone}
      showBackgroundFrame={
        !welcomeActive && route.tab !== 'home' && route.tab !== 'workout' && route.tab !== 'progress' && route.tab !== 'profile'
      }
      safeAreaEdges={
        welcomeActive ? ['left', 'right'] : onboardingActive ? ['top', 'left', 'right'] : ['top', 'left', 'right', 'bottom']
      }
      statusBarStyleOverride={emptyWorkoutActive || readyTemplatesActive || exerciseDetailActive || exercisesListActive || profileListActive || onboardingScreenActive ? 'dark' : welcomeActive ? 'dark' : undefined}
      statusBarBackgroundColor={emptyWorkoutActive || readyTemplatesActive || exerciseDetailActive || exercisesListActive || profileListActive ? '#F7F3FF' : welcomeActive ? 'transparent' : undefined}
      statusBarTranslucent={welcomeActive}
      shellBackgroundColor={onboardingScreenActive ? '#F7F3FF' : emptyWorkoutActive || readyTemplatesActive || exerciseDetailActive || exercisesListActive || profileListActive ? '#F7F3FF' : undefined}
      tabBar={
        showTabBar ? (
          <BottomTabBar
            activeTab={route.tab === 'workout' && route.screen === 'plans' ? null : route.tab}
            aiActive={route.tab === 'home' && (route.screen === 'ai' || route.screen === 'ai_setup')}
            onTabPress={navigateToTab}
            onAiPress={() => {
              if (!navigateToActiveWorkout()) {
                navigateToTab('workout');
              }
            }}
          />
        ) : undefined
      }
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











































