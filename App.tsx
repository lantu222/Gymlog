import './src/globalFont';

import React, { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, BackHandler, View } from 'react-native';
import * as Font from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';

import { AppShell } from './src/components/AppShell';
import { BottomTabBar } from './src/components/BottomTabBar';
import { getHomeSummary } from './src/lib/dashboard';
import { formatDurationMinutes, formatRepRange, formatShortDate, formatTime, formatVolume, formatWeight, pluralize } from './src/lib/format';
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
import { getExerciseTemplateDefaults, getRecentExerciseLibraryItems } from './src/lib/exerciseSuggestions';
import { getExerciseProgressForName } from './src/lib/progression';
import { formatWorkoutDisplayLabel } from './src/lib/displayLabel';
import { buildCardioStatsLine, getCardioActivity } from './src/lib/cardio';
import { setSoundCuesEnabled } from './src/utils/sound';
import { setHapticsEnabled } from './src/utils/haptics';
import {
  getNotificationPermissionGranted,
  requestNotificationPermission,
} from './src/utils/appNotifications';
import { useScheduledNotifications } from './src/hooks/useScheduledNotifications';
import { ThemeProvider, themeForName, useTheme } from './src/theming';
import { writeHomeWidgetPayload } from './src/utils/homeWidget';
import {
  isHomeWidgetAdded,
  isHomeWidgetSupported,
  requestPinHomeWidget,
} from './modules/home-widget';
import { buildHomeWidgetPayload } from './src/lib/widgetPayload';
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
import { composeProgramWeekForSelection } from './src/lib/programDayComposer';
import { resolveAvailableEquipment } from './src/lib/equipmentExerciseFilter';
import { getReadyProgramBlockWeeks } from './src/lib/readyProgramDuration';
import { getReadyProgramContent } from './src/lib/readyProgramContent';
import { getCalendarWeekStartTimestamp, getCanonicalCompletedSessions } from './src/lib/completedSessions';
import { getLifetimeTrainingSummary } from './src/lib/lifetimeSummary';
import { getTrainingRhythm } from './src/lib/trainingRhythm';
import { buildPremiumHeroChart } from './src/lib/premiumHeroChart';
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
import { recordCoachQuestion, resolveCoachQuota } from './src/lib/aiCoachQuota';
import { buildHomePlanProgress } from './src/lib/homePlanProgress';
import { buildHomeStatCardCatalog, buildHomeStatCards, resolveHomeStatCardKeys } from './src/lib/homeStatCards';
import { buildSessionEquipmentLabel, getDefaultCooldown, getDefaultWarmup, getSessionBodyFocusLabel, getSessionFocusTitle } from './src/lib/homeSessionHero';
import { estimateRoutineBlockSeconds } from './src/lib/guidedPlayer';
import { estimateSessionMinutes } from './src/lib/sessionDuration';
import { buildMuscleFocus, getTopSetLabel, getVolumeDeltaVsPrevious, MuscleFocusRow } from './src/lib/workoutCompleteView';
import { buildHomeQuickStats, buildHomeUpcomingSessions } from './src/lib/homeVisuals';
import { I18nKey, t } from './src/lib/i18n';
import { buildCoachModules } from './src/lib/aiCoachModules';
import { isProUnlocked, resolveProEntitlement, resolveProgressionOptions, resolveTrialProUntil } from './src/lib/proEntitlement';
import { toProgressionFatigueSignal } from './src/lib/progressionGate';
import { resolveThemeName } from './src/lib/themePreference';
import { localizeSessionName, localizeWorkoutFocus } from './src/lib/sessionNameLabel';

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
import { ProgramLimitReachedError } from './src/lib/programSlots';
import {
  getSeasonForDate,
  getSeasonProgramId,
  getSeasonProgramIds,
  orderSeasons,
} from './src/lib/programSeasons';
import {
  SEASON_COLORS,
  SEASON_WEEKS,
  nextSeasonWindow,
  resolveSeasonWindow,
  seasonWeeksLeft,
} from './src/lib/season';
import {
  computeSeasonProgress,
  countSeasonRecords,
  resolveSeasonBadges,
} from './src/lib/seasonScoring';
import { buildProgramCampaigns } from './src/lib/programCampaigns';
import { resolveContinueEntries } from './src/lib/programContinue';
import { AFFINITY_REASON_KEYS, resolveProgramAffinity } from './src/lib/programAffinity';
import { resolveProgramEquipment } from './src/lib/programEquipment';
import { getTrendingEntries } from './src/lib/programTrendingDemo';
import { exerciseNameLabel } from './src/lib/exerciseNameLabel';
import { buildProgramFingerprint } from './src/lib/programFingerprint';
import { resolveRecords } from './src/lib/personalRecords';
import { getComparableLogSets } from './src/lib/exerciseLog';
import { TrainingCalendarScreen } from './src/screens/TrainingCalendarScreen';
import { removeStrengthGoal, resolveGoalProgress, upsertStrengthGoal } from './src/lib/strengthGoals';
import {
  countByCategory,
  filterByCategory,
  PROGRAM_CATEGORIES,
  ProgramCategoryKey,
} from './src/lib/programCategories';
import { ProgramLimitSheet } from './src/components/ProgramLimitSheet';
import { buildCustomProgramDetail, buildCustomSessionRuntimeTemplate, buildReadyProgramDetail, buildReadySessionRuntimeTemplate } from './src/lib/programDetails';
import { applySessionAdaptation, previewSessionTrim } from './src/lib/sessionAdaptation';
import { buildProgramInsightMap } from './src/lib/programInsights';
import { buildTailoringBadgeLabels, buildTailoringPreferences } from './src/lib/tailoringFit';
import { popRoute, pushRoute } from './src/navigation/routeHistory';
import { AppRoute, ROOT_ROUTES, RootTabKey, WORKOUT_PLAN_ROUTE } from './src/navigation/routes';
import { SessionAnalysisScreen } from './src/screens/SessionAnalysisScreen';
import { buildSessionAnalysis } from './src/lib/sessionAnalysis';
import { AICoachScreen } from './src/screens/AICoachScreen';
import { AiModeSetupScreen } from './src/screens/AiModeSetupScreen';
import { AboutYouScreen, AboutYouValues } from './src/screens/AboutYouScreen';
import { CreateTemplateScreen } from './src/screens/CreateTemplateScreen';
import { HealthConnectScreen } from './src/screens/HealthConnectScreen';
import { HealthSyncedScreen } from './src/screens/HealthSyncedScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { LaunchScreen } from './src/screens/LaunchScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { OnboardingReadyCatalogScreen } from './src/screens/OnboardingReadyCatalogScreen';
import { StartPathScreen } from './src/screens/StartPathScreen';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import { EquipmentPreferencesScreen } from './src/screens/EquipmentPreferencesScreen';
import { ExercisePreferencesScreen } from './src/screens/ExercisePreferencesScreen';
import { ExerciseDetailScreen } from './src/screens/ExerciseDetailScreen';
import { ExercisesScreen } from './src/screens/ExercisesScreen';
import { JointFriendlySwapsScreen } from './src/screens/JointFriendlySwapsScreen';
import { PlanSettingsScreen } from './src/screens/PlanSettingsScreen';
import { PremiumScreen } from './src/screens/PremiumScreen';
import { PremiumUnlockScreen } from './src/screens/PremiumUnlockScreen';
import { VinhaSplashScreen } from './src/screens/VinhaSplashScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { MyDataScreen } from './src/screens/MyDataScreen';
import { ExportPlanScreen, ExportablePlan } from './src/screens/ExportPlanScreen';
import { NewProgramSheet } from './src/components/NewProgramSheet';
import { EditProfileScreen } from './src/screens/EditProfileScreen';
import { TrainingPlanScreen } from './src/screens/TrainingPlanScreen';
import { NotificationsScreen } from './src/screens/NotificationsScreen';
import { TrainingBreakScreen } from './src/screens/TrainingBreakScreen';
import { PromoCodeScreen } from './src/screens/PromoCodeScreen';
import { SubscriptionScreen } from './src/screens/SubscriptionScreen';
import { MembershipEndScreen } from './src/screens/MembershipEndScreen';
import { SupportScreen } from './src/screens/SupportScreen';
import { FeatureRequestsScreen } from './src/screens/FeatureRequestsScreen';
import { AiTransparencyScreen } from './src/screens/AiTransparencyScreen';
import { LegalDocumentScreen } from './src/screens/LegalDocumentScreen';
import { ProOfferScreen } from './src/screens/ProOfferScreen';
import { AICoachChatScreen } from './src/screens/AICoachChatScreen';
import { buildCoachContextChips } from './src/lib/coachChat';
import { isAiCoachLiveConfigured } from './src/lib/aiCoachClient';
import { ProgressScreen } from './src/screens/ProgressScreen';
import { ProgramDetailScreen } from './src/screens/ProgramDetailScreen';
import { ProgramsHomeScreen, ProgramsExploreItem } from './src/screens/ProgramsHomeScreen';
import { SeasonScreen } from './src/screens/SeasonScreen';
import { WorkoutCompletionScreen } from './src/screens/WorkoutCompletionScreen';
import { WorkoutCelebrationScreen } from './src/screens/WorkoutCelebrationScreen';
import { WorkoutEditorFinishSummary, WorkoutEditorScreen } from './src/screens/WorkoutEditorScreen';
import { EmptyWorkoutScreen } from './src/screens/EmptyWorkoutScreen';
import { GuidedPlayerScreen } from './src/screens/GuidedPlayerScreen';
import { CardioScreen } from './src/screens/CardioScreen';
import { WorkoutsScreen } from './src/screens/WorkoutsScreen';
import { WorkoutProvider, useWorkoutContext } from './src/features/workout/WorkoutProvider';
import { adaptLegacyWorkoutTemplateToRuntimeTemplate } from './src/features/workout/customWorkoutAdapter';
import { AdaptedCompletedWorkoutExercise, adaptCompletedWorkoutSessionForAppDatabase } from './src/features/workout/workoutAppAdapter';
import { getWorkoutTemplateById, WORKOUT_TEMPLATES_V1 } from './src/features/workout/workoutCatalog';
import { WorkoutRuntimeTemplate, WorkoutTemplateExercise } from './src/features/workout/workoutTypes';
import { AppProvider, useAppContext } from './src/state/AppProvider';
import {
  getAgeFromDateOfBirth,
  getHealthProviderLabel,
  hasAnyHealthBasics,
  HealthBasics,
  requestHealthBasics,
} from './src/integrations/health';
import {
  AppDatabase,
  AppLanguage,
  AppPreferences,
  ExerciseLibraryItem,
  ExerciseLog,
  ExerciseLogDraft,
  ExerciseTemplate,
  ExerciseTemplateDraft,
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
  volumeDeltaKg: number | null;
  muscles: MuscleFocusRow[];
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
  language,
}: {
  exercises: AdaptedCompletedWorkoutExercise[];
  exerciseTemplates: ExerciseTemplate[];
  exerciseLibrary: ExerciseLibraryItem[];
  exercisePrLookup: ReturnType<typeof buildExercisePrLookup>;
  language: AppLanguage;
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
      topSetLabel: getTopSetLabel(exercise.sets, language),
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

  // Mark the recap rows whose exercise earned a PR this session.
  const prSlotIds = new Set(prCards.map((card) => card.id.replace(/^pr:/, '')));
  const exerciseCardsWithPr = exerciseCards.map((card) =>
    prSlotIds.has(card.id) ? { ...card, isPr: true } : card,
  );

  return {
    exerciseCards: exerciseCardsWithPr,
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

function getBackRoute(route: AppRoute): AppRoute | null {
  if (
    route.tab === 'home' &&
    (route.screen === 'ai' ||
      route.screen === 'ai_chat' ||
      route.screen === 'pro_offer' ||
      route.screen === 'ai_setup' ||
      route.screen === 'history' ||
      route.screen === 'session' ||
      route.screen === 'analysis' ||
      route.screen === 'cardio')
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
      route.screen === 'guided' ||
      route.screen === 'summary' ||
      route.screen === 'celebration')
  ) {
    return WORKOUT_PLAN_ROUTE;
  }

  if (
    route.tab === 'progress' &&
    (route.screen === 'detail' ||
      route.screen === 'bodyweight' ||
      route.screen === 'calendar')
  ) {
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

  // Back out of the unlock moment lands on Profile, not on the paywall you
  // just came through — going 'back' to a page selling what you now own.
  if (route.tab === 'profile' && route.screen === 'premium_unlock') {
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
    heightCm: preferences.setupHeightCm,
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
    equipmentItems: preferences.setupEquipmentItems,
    secondaryOutcomes:
      preferences.setupSecondaryOutcomes.length > 0
        ? preferences.setupSecondaryOutcomes
        : DEFAULT_FIRST_RUN_SELECTION.secondaryOutcomes,
    focusAreas: preferences.setupFocusAreas.length > 0 ? preferences.setupFocusAreas : DEFAULT_FIRST_RUN_SELECTION.focusAreas,
    cautionFlags: preferences.setupCautionFlags,
    guidanceMode: preferences.setupGuidanceMode ?? DEFAULT_FIRST_RUN_SELECTION.guidanceMode,
    scheduleMode: preferences.setupScheduleMode ?? DEFAULT_FIRST_RUN_SELECTION.scheduleMode,
    automatedProgression: preferences.automatedProgressionEnabled,
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
    setupHeightCm: selection.heightCm ?? null,
    setupGoal: selection.goal,
    setupGoals: selection.goals?.length ? selection.goals : [selection.goal],
    setupLevel: selection.level,
    setupDaysPerWeek: selection.daysPerWeek,
    setupEquipment: selection.equipment,
    setupTrainingEnvironment: selection.trainingEnvironment,
    setupEquipmentItems: selection.equipmentItems ?? [],
    setupSecondaryOutcomes: selection.secondaryOutcomes,
    setupFocusAreas: selection.focusAreas,
    setupCautionFlags: selection.cautionFlags ?? [],
    setupGuidanceMode: selection.guidanceMode,
    setupScheduleMode: selection.scheduleMode,
    automatedProgressionEnabled: selection.automatedProgression ?? true,
    setupWeeklyMinutes: selection.weeklyMinutes ?? null,
    setupAvailableDays: selection.scheduleMode === 'self_managed' ? selection.availableDays : [],
    setupCurrentWeightKg: selection.currentWeightKg ?? null,
    bodyweightGoalKg: selection.targetWeightKg ?? null,
    recommendedProgramId,
    activePlanId: null,
    unitPreference: selection.unitPreference,
  };
}

function buildSavedOnboardingPlan(
  selection: FirstRunSetupSelection,
  recommendedProgramId: string,
  // The name is written into the template at creation time, so it has to be
  // written in the reader's language. Omitting this defaulted to English and
  // put "Strong Chest Advanced" on a Finnish Home screen.
  language: AppLanguage,
  savedTemplateId?: string,
) {
  // Single source of truth with the onboarding previews (days-per-week truth):
  // the same composed week the picker and plan overview showed is what saves.
  const composedWeek = composeProgramWeekForSelection(selection, recommendedProgramId);
  const sessions = (composedWeek?.sessions ?? []).map((session) => ({
    id: session.id,
    name: formatWorkoutDisplayLabel(session.name, 'Workout'),
    orderIndex: session.orderIndex,
    exercises: session.exercises,
  }));
  const draft: WorkoutTemplateDraft = {
    name: buildFirstRunCustomProgramName(selection, language),
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
  language: AppLanguage,
) {
  const days = selection.scheduleMode === 'self_managed' && selection.availableDays.length > 0
    ? selection.availableDays
    : DEFAULT_RHYTHM_BY_DAYS[selection.daysPerWeek] ?? DEFAULT_RHYTHM_BY_DAYS[3];
  const timestamp = new Date().toISOString();
  const planId = `onboarding_plan_${workoutTemplateId}`;

  return {
    id: planId,
    name: buildFirstRunCustomProgramName(selection, language),
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

/**
 * The goal tag on a program cover.
 *
 * Returned hardcoded English until an emulator pass found "Muscle" and
 * "Strength" sitting on cards in a Finnish app, directly under category chips
 * reading "Lihaskasvu" and "Voima". It reuses those same keys now, so the tag
 * and the chip that filters for it cannot say different words.
 */
function formatGoalLabel(goalType: string, language: AppLanguage = 'en') {
  if (goalType === 'hypertrophy') {
    return t(language, 'programs.cat.muscle');
  }
  if (goalType === 'strength') {
    return t(language, 'programs.cat.strength');
  }
  return t(language, 'programs.cat.balanced');
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
    getWorkoutExercises,
    getWorkoutTemplateSessions,
    getSessionLogs,
    updatePreferences,
    completeOnboarding,
    upsertWorkoutTemplate,
    programSlots,
    upsertWorkoutPlan,
    deleteWorkoutTemplate,
    resetAllData,
    addBodyweightEntry,
    addMeasurementEntry,
    saveCompletedWorkoutSession,
    updateCompletedWorkoutSession,
    saveCardioSession,
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
  const [cardioSaving, setCardioSaving] = useState(false);
  // Settings' "Import plan (CSV)" opens the same sheet the Programs tab uses,
  // straight into its paste view. One importer, two doors.
  const [settingsImportVisible, setSettingsImportVisible] = useState(false);
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

  // Mirrors the notification preferences onto the OS clock: reminders, the
  // comeback nudge, the Sunday summary and the morning-after record note.
  useScheduledNotifications(database);

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

  function navigateToTab(tab: RootTabKey) {
    // Programs-tab redesign (flagged): the workout tab lands on the Programs
    // home instead of the legacy exercise list.
    if (tab === 'workout' && preferences.programsTabEnabled) {
      resetToRoute({ tab: 'workout', screen: 'programs_home' });
      return;
    }
    resetToRoute(ROOT_ROUTES[tab]);
  }

  // Guided player (design_handoff_guided_player) is the default way to run a
  // session; the table logger stays reachable via "Switch to list view".
  function navigateToGuidedWorkout(workoutTemplateId: string) {
    workoutLogNavigationAllowedAtRef.current = Date.now();
    navigate({ tab: 'workout', screen: 'guided', workoutTemplateId });
  }

  async function openAiMode(preferencesPatch?: Partial<AppPreferences>) {
    const nextPreferences = preferencesPatch ? { ...preferences, ...preferencesPatch } : preferences;
    // The AI program builder is Pro (the Pro page table says so, so it must be
    // true). Free users land on the Pro page instead of a generator they
    // cannot run.
    if (!isProUnlocked(nextPreferences)) {
      navigate({ tab: 'profile', screen: 'premium' });
      return;
    }
    if (!nextPreferences.aiSetupCompleted) {
      navigate({ tab: 'home', screen: 'ai_setup' });
      return;
    }

    if (navigateToActiveWorkout()) {
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

      const aiRuntimeTemplate = runtimeTemplate;
      guardStrengthStartOverCardio(() => {
        workout.startCustomWorkout(
          buildCustomSessionRuntimeTemplate(aiRuntimeTemplate, nextSessionId),
          nextPreferences.unitPreference,
          { ...resolveProgressionOptions(nextPreferences), fatigueSignal: progressionFatigueSignal },
        );
        navigateToGuidedWorkout(persistedTemplateId);
        showToast(shouldRegenerate ? 'Vinha AI plan ready' : 'Vinha AI next workout loaded');
      });
    } catch (error) {
      console.error('Failed to open Vinha AI workout flow', error);
      showToast(t(preferences.appLanguage, 'toast.aiBuildFailed'));
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
  // Pre-questionnaire flow: after Welcome the user picks a path (01b); the
  // build path then runs Health connect (01c) → synced (01d) → about-you (01e)
  // before the questionnaire. The ready path exits onboarding to the catalog.
  const [onboardingStep, setOnboardingStep] = useState<
    'path' | 'health_connect' | 'health_synced' | 'about' | 'questionnaire' | 'ready_catalog'
  >('path');
  // Both start paths share health + about (profile creation); they fork after.
  const [onboardingPath, setOnboardingPath] = useState<'build' | 'ready'>('build');
  const [onboardingHealthBasics, setOnboardingHealthBasics] = useState<HealthBasics | null>(null);
  const [busySavingReadyPick, setBusySavingReadyPick] = useState(false);

  // The onboarding flow state lives in memory; when the gate closes (finished)
  // or the app returns to the Welcome entry (e.g. after a data reset), start
  // the next run from the path screen — never mid-questionnaire.
  useEffect(() => {
    if (preferences.onboardingCompleted || !preferences.entryFlowCompleted) {
      setOnboardingStep('path');
      setOnboardingPath('build');
      setOnboardingHealthBasics(null);
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
  const progressTrainingRhythm = useMemo(() => getTrainingRhythm(database), [database]);
  const premiumHeroChart = useMemo(
    () => buildPremiumHeroChart(trackedProgress, unitPreference),
    [trackedProgress, unitPreference],
  );
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
   * passed a signal in — so `paywall.benefit.recover.b` ("Pro reads your load
   * and eases off before fatigue costs you a week") described something that
   * never happened on a single set. This is the wire.
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
  function navigateToActiveWorkout(message?: string) {
    if (!workout.activeSession) {
      return false;
    }

    if (message) {
      showToast(message);
    }

    workout.resumeWorkout();
    navigateToGuidedWorkout(workout.activeSession.templateId);
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
        exercisesLogged: summary.exercisesLogged,
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
    trimSets = false,
  ) {
    const template = getWorkoutTemplateById(workoutTemplateId);
    if (!template) {
      return;
    }

    if (navigateToActiveWorkout()) {
      return;
    }

    guardStrengthStartOverCardio(() => {
      void updatePreferences({ trainingFirstRunDismissed: true });
      const runtimeTemplate = applySessionAdaptation(
        buildReadySessionRuntimeTemplate(template, sessionId),
        { swaps: sessionSwaps, trimSets },
      );
      workout.startCustomWorkout(runtimeTemplate, nextUnitPreference, {
        ...resolveProgressionOptions(preferences),
        fatigueSignal: progressionFatigueSignal,
      });
      // Today's changes are spent the moment they are applied — an adaptation
      // is an answer about right now, and a stale one is worse than none.
      setSessionSwaps({});
      navigateToGuidedWorkout(workoutTemplateId);
    });
  }

  function handleStartReadyProgramSession(workoutTemplateId: string, sessionId: string, trimSets = false) {
    startReadyProgramSessionWithUnit(workoutTemplateId, sessionId, unitPreference, trimSets);
  }

  function handleStartReadyProgram(workoutTemplateId: string) {
    const template = getWorkoutTemplateById(workoutTemplateId);
    const firstSessionId = template?.sessions[0]?.id;
    if (!firstSessionId) {
      return;
    }

    handleStartReadyProgramSession(workoutTemplateId, firstSessionId);
  }

  function handleStartCustomProgramSession(workoutTemplateId: string, sessionId: string, trimSets = false) {
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

    if (navigateToActiveWorkout()) {
      return;
    }

    guardStrengthStartOverCardio(() => {
      void updatePreferences({ trainingFirstRunDismissed: true });
      const runtimeTemplate = applySessionAdaptation(
        buildCustomSessionRuntimeTemplate(customTemplate, sessionId),
        { swaps: sessionSwaps, trimSets },
      );
      workout.startCustomWorkout(runtimeTemplate, unitPreference, {
        ...resolveProgressionOptions(preferences),
        fatigueSignal: progressionFatigueSignal,
      });
      setSessionSwaps({});
      navigateToGuidedWorkout(workoutTemplateId);
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


  /**
   * "Make my own copy" on a ready program.
   *
   * This is the whole shape of the free tier in one function: the catalog is
   * free to browse and free to run, and the moment you want one CHANGED it
   * becomes a program of your own — which is what the cap counts. Everyone who
   * reaches this button is by definition past "let me look around" and into
   * "I want it my way", which is the moment their paying users describe.
   */
  function handleCopyReadyProgramToCustom(programId?: string) {
    // Defaults to the active program, which is where this started; the detail
    // screen passes the one being looked at.
    const resolvedId =
      programId ??
      (homeActivePlanCard?.programType === 'ready' ? homeActivePlanCard.programId : null);
    if (!resolvedId) {
      return;
    }
    if (!programSlots.canCreate) {
      setProgramLimitVisible(true);
      return;
    }
    const template = WORKOUT_TEMPLATES_V1.find((item) => item.id === resolvedId);
    if (!template) {
      return;
    }
    // The catalog's shape is not the database's, so the ready session is
    // mapped into the same one duplication already takes from a custom
    // program. One duplication path, two sources.
    const draft = buildDuplicatedCustomProgramDraft(
      template.name,
      template.sessions.map((session, sessionIndex) => ({
        id: session.id,
        workoutTemplateId: template.id,
        name: session.name,
        orderIndex: sessionIndex,
        exerciseIds: session.exercises.map((exercise) => exercise.id),
        exercises: session.exercises.map((exercise, exerciseIndex) => ({
          id: exercise.id,
          workoutTemplateId: template.id,
          workoutTemplateSessionId: session.id,
          name: exercise.exerciseName,
          targetSets: exercise.sets,
          repMin: exercise.repsMin,
          repMax: exercise.repsMax,
          restSeconds: exercise.restSecondsMin,
          trackedDefault: false,
          orderIndex: exerciseIndex,
          libraryItemId: null,
        })),
      })),
      workoutTemplates.map((item) => item.name),
    );
    Promise.resolve(upsertWorkoutTemplate(draft))
      .then((workoutTemplateId) => {
        showToast(t(preferences.appLanguage, 'toast.programCopied'));
        navigate({ tab: 'workout', screen: 'program', programType: 'custom', workoutTemplateId });
      })
      .catch((error) => {
        if (error instanceof ProgramLimitReachedError) {
          setProgramLimitVisible(true);
          return;
        }
        console.error('Failed to copy ready program', error);
        showToast(t(preferences.appLanguage, 'toast.programCopyFailed'));
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
        showToast(t(preferences.appLanguage, 'toast.workoutDuplicated'));
        navigate({ tab: 'workout', screen: 'program', programType: 'custom', workoutTemplateId: nextWorkoutTemplateId });
      })
      .catch((error) => {
        console.error('Failed to duplicate custom program', error);
        showToast(t(preferences.appLanguage, 'toast.workoutDuplicateFailed'));
      });
  }

  async function handleDeleteCustomWorkout(workoutTemplateId: string) {
    await deleteWorkoutTemplate(workoutTemplateId);
    showToast(t(preferences.appLanguage, 'toast.workoutDeleted'));
    navigate(WORKOUT_PLAN_ROUTE);
  }

  async function handleOnboardingPickReadyProgram(programId: string) {
    if (busySavingReadyPick) {
      return;
    }
    setBusySavingReadyPick(true);
    try {
      // Profile was created on the About screen; persist its basics alongside
      // the picked program. No questionnaire ran, so setup stays incomplete.
      await completeOnboarding({
        onboardingCompleted: true,
        setupCompleted: false,
        trainingFirstRunDismissed: false,
        profileName: aboutYouValues?.name ?? null,
        setupGender: aboutYouValues?.gender ?? null,
        setupHeightCm: aboutYouValues?.heightCm ?? null,
        setupCurrentWeightKg: aboutYouValues?.weightKg ?? null,
        recommendedProgramId: programId,
        activePlanId: null,
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

  // Profile → CONNECTIONS: same permission flow as the onboarding Health step.
  // Imported basics only fill setup fields that are still empty.
  async function handleProfileConnectHealth() {
    const providerLabel = getHealthProviderLabel();
    const result = await requestHealthBasics();
    if (result.status !== 'connected') {
      showToast(
        result.status === 'denied'
          ? `${providerLabel} permission was denied`
          : `${providerLabel} isn't available on this device`,
      );
      return;
    }

    const patch: Partial<AppPreferences> = {};
    if (result.basics.sex && !preferences.setupGender) {
      patch.setupGender = result.basics.sex;
    }
    const healthAge = getAgeFromDateOfBirth(result.basics.dateOfBirth);
    if (healthAge !== null && preferences.setupAge === null) {
      patch.setupAge = healthAge;
    }
    if (result.basics.heightCm !== null && preferences.setupHeightCm === null) {
      patch.setupHeightCm = result.basics.heightCm;
    }
    if (result.basics.weightKg !== null && preferences.setupCurrentWeightKg === null) {
      patch.setupCurrentWeightKg = result.basics.weightKg;
    }
    if (Object.keys(patch).length > 0) {
      await updatePreferences(patch);
    }
    showToast(`Connected to ${providerLabel}`);
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
    const savedPlan = buildSavedOnboardingPlan(
      selection,
      recommendedProgramId,
      preferences.appLanguage,
    );
    const savedTemplateId = await upsertWorkoutTemplate(savedPlan.draft);
    const activePlan = buildSavedOnboardingWorkoutPlan(
      selection,
      savedTemplateId,
      savedPlan.runtimeTemplate.sessions.map((session) => session.id),
      preferences.appLanguage,
    );
    await upsertWorkoutPlan(activePlan);
    await updatePreferences({ activePlanId: activePlan.id });
    // This used to hop to the standalone pro_offer screen. The Pro sale now
    // happens INSIDE onboarding, as its last step, so keeping the hop would
    // put two paywalls back to back — the same duplication the plan-ready
    // screens had. The pro_offer route and screen are left in place but no
    // longer reached from here.
    resetToRoute(ROOT_ROUTES.home);
  }

  /**
   * The paywall's CTA: grant the seven days, then finish onboarding exactly as
   * "Maybe later" does. The grant is what makes the button's own sentence true
   * — and what makes it a different button from the one beside it.
   */
  async function handleOnboardingStartProTrial(
    selection: FirstRunSetupSelection,
    recommendedProgramId: string,
  ) {
    // Null when the trial is switched off. Writing it would clear a promo the
    // user might already be holding, so nothing is written at all.
    const trialUntil = resolveTrialProUntil();
    if (trialUntil !== null) {
      await updatePreferences({ promoProUntil: trialUntil });
    }
    await handleOnboardingCompleteToTraining(selection, recommendedProgramId);
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
    showToast(nextMode === 'app_managed' ? 'Vinha manages the week' : 'You manage the days');
  }

  async function handleSetupCompleteToTraining(selection: FirstRunSetupSelection, recommendedProgramId: string) {
    await waitForPlanSaveFeedback();
    await persistSetupSelection(selection, recommendedProgramId);
    const savedPlan = buildSavedOnboardingPlan(
      selection,
      recommendedProgramId,
      preferences.appLanguage,
    );
    const savedTemplateId = await upsertWorkoutTemplate(savedPlan.draft);
    const activePlan = buildSavedOnboardingWorkoutPlan(
      selection,
      savedTemplateId,
      savedPlan.runtimeTemplate.sessions.map((session) => session.id),
      preferences.appLanguage,
    );
    await upsertWorkoutPlan(activePlan);
    await updatePreferences({ activePlanId: activePlan.id });
    showToast(t(preferences.appLanguage, 'toast.setupUpdated'));
    resetToRoute(ROOT_ROUTES.home);
  }

  async function handleSetupOpenProgramDetail(selection: FirstRunSetupSelection, recommendedProgramId: string) {
    await persistSetupSelection(selection, recommendedProgramId);
    showToast(t(preferences.appLanguage, 'toast.setupUpdated'));
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
    showToast(t(preferences.appLanguage, 'toast.setupUpdated'));
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
  const proEntitlement = resolveProEntitlement(preferences);
  const coachProUnlocked = proEntitlement.unlocked;
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
        // Same source the Training plan screen edits, so planned-versus-actual
        // in the context cannot disagree with the schedule the user set.
        trainingDays: preferences.setupAvailableDays,
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
      preferences.setupAvailableDays,
      workout.templates.length,
      workoutSessions,
      database.exerciseLogs,
    ],
  );
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
    (sessionTitle: string, planTitle: string) => {
      const focus = getSessionFocusTitle(sessionTitle, planTitle);
      return {
        warmupSeconds: estimateRoutineBlockSeconds(
          getDefaultWarmup(focus, preferences.appLanguage, availableEquipmentForDrills),
        ),
        cooldownSeconds: estimateRoutineBlockSeconds(
          getDefaultCooldown(focus, preferences.appLanguage, availableEquipmentForDrills),
        ),
      };
    },
    [preferences.appLanguage, availableEquipmentForDrills],
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
    () => (recommendedReadyTemplate ? getReadyProgramContent(recommendedReadyTemplate.id, preferences.appLanguage) : null),
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
      // The runtime template is where a custom exercise gets its slot id and
      // substitution group; read them from there rather than rebuilding the
      // rule here, so Home and the session cannot disagree about a slot.
      const activeRuntimeExercises = new Map(
        (activeTemplate ? customWorkoutRuntimeMap[activeTemplate.id]?.sessions ?? [] : [])
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
          restSeconds: activeRuntimeExercises.get(exercise.id)?.restSecondsMin ?? 90,
        }));
        const routineSeconds = routineBlockSeconds(session.name, activeTemplate?.name ?? '');
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
          trim: previewSessionTrim(durationInputs, routineSeconds),
          exercises: session.exercises.slice(0, 5).map((exercise) => ({
            name: exercise.name,
            setsLabel: `${exercise.targetSets} sets`,
            schemeLabel: `${exercise.targetSets} × ${formatRepRange(exercise.repMin, exercise.repMax)}`,
            slotId: activeRuntimeExercises.get(exercise.id)?.slotId,
            substitutionGroup: activeRuntimeExercises.get(exercise.id)?.substitutionGroup,
          })),
          hiddenExerciseCount: Math.max(exerciseCount - 5, 0),
        };
      });
      const nextSession = homeSessions[0] ?? null;
      if (activeTemplate && nextSession) {
        const estimatedDuration = Number.parseInt(nextSession.duration.replace(/\D/g, ''), 10) || 20;
        const planTemplateIds = new Set(sortedEntries.map((entry) => entry.workoutTemplateId));
        const completedSessionCount = completedPlanSessions.filter((session) => planTemplateIds.has(session.workoutTemplateId)).length;
        // Onboarding-built plans promised a specific block length ("4-week
        // plan") — the Home hero must count the same total, not the generic
        // 8-week default.
        const onboardingBlockWeeks =
          activeWorkoutPlan.id.startsWith('onboarding_plan_') && setupSelection && preferences.recommendedProgramId
            ? composeProgramWeekForSelection(setupSelection, preferences.recommendedProgramId)?.weeks
            : undefined;
        const planProgress = buildHomePlanProgress({ language: preferences.appLanguage,
          completedSessions: completedSessionCount,
          sessionsPerWeek: sortedEntries.length,
          totalWeeks: onboardingBlockWeeks,
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
    const planProgress = buildHomePlanProgress({ language: preferences.appLanguage,
      completedSessions: completedSessionCount,
      sessionsPerWeek: recommendedReadyTemplate.daysPerWeek,
      // Ready programs count their catalog block (4-12 wk by tier), not the
      // generic 8-week default.
      totalWeeks: getReadyProgramBlockWeeks(recommendedReadyTemplate),
    });
    const homeSessions = recommendedReadyTemplate.sessions.map((session) => {
      const durationInputs = session.exercises.map((exercise) => ({
        slotId: exercise.slotId,
        role: exercise.role,
        sets: exercise.sets,
        reps: exercise.repsMax,
        restSeconds: exercise.restSecondsMin,
      }));
      const routineSeconds = routineBlockSeconds(session.name, recommendedReadyTemplate.name);
      // The catalog's `estimatedSessionDuration` describes the PROGRAM (its
      // longest day, hand-written). Today's session gets the same treatment
      // every other session gets, from its own sets and rests.
      const durationMinutes = estimateSessionMinutes({ exercises: durationInputs, ...routineSeconds });
      return {
      id: session.id,
      title: formatHomeSessionTitle(session.name, session.exercises),
      duration: `~${durationMinutes} min`,
      durationMinutes,
      trim: previewSessionTrim(durationInputs, routineSeconds),
      totalSets: session.exercises.reduce((sum, exercise) => sum + exercise.sets, 0),
      exercises: session.exercises.map((exercise) => ({
        name: exercise.exerciseName,
        setsLabel: `${exercise.sets} sets`,
        schemeLabel: `${exercise.sets} × ${formatRepRange(exercise.repsMin, exercise.repsMax)}`,
        // Carried so Home can offer the swap: a ready template's slot id is
        // the same one the session materializes with.
        slotId: exercise.slotId,
        substitutionGroup: exercise.substitutionGroup,
      })),
      hiddenExerciseCount: Math.max(session.exercises.length - 5, 0),
      };
    });
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
      sessionsDone: planProgress.sessionsDone,
      sessionsTotal: planProgress.sessionsTotal,
      currentWeek: planProgress.currentWeek,
      planTotalWeeks: planProgress.totalWeeks,
      focusLabel: getSessionBodyFocusLabel(recommendedReadyTemplate.splitType),
      equipmentLabel: buildSessionEquipmentLabel(
        (recommendedReadyTemplate.sessions[0]?.exercises ?? []).map((exercise) => exercise.exerciseName),
        exerciseLibrary,
      ),
      sessionsPerWeek: `${recommendedReadyTemplate.daysPerWeek}`,
      weeklyMinutes: `~${weeklyMinutes} min`,
      sessions: homeSessions,
      nextSession: {
        ...firstHomeSession,
        label: 'Week 1 · Day 1',
      },
    };
  }, [database, exerciseLibrary, getWorkoutTemplateSessions, preferences.activePlanId, preferences.aiPlannerGoal, preferences.recommendedProgramId, preferences.setupGoal, recommendedReadyContent, recommendedReadyTemplate, setupSelection, workoutTemplates]);
  // The AI tab's opening state. Deterministic, so the most valuable-looking
  // part of the coach costs nothing to render and works offline.
  const coachChatIntro = useMemo(
    () => ({
      todaySessionTitle: homeActivePlanCard?.nextSession
        ? localizeSessionName(
            formatWorkoutDisplayLabel(homeActivePlanCard.nextSession.title),
            preferences.appLanguage,
          )
        : null,
      sessionsThisWeek: homeSummary.streak.sessionsThisWeek,
      weeklyRead: proWeeklyRead,
      fatigue: proFatigue,
    }),
    [homeActivePlanCard, homeSummary.streak.sessionsThisWeek, preferences.appLanguage, proFatigue, proWeeklyRead],
  );
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
  // What Home's greeting is allowed to claim. Every field is read from the
  // log — an account with no sessions gets the first-run line, not "welcome
  // back", and the streak is only named when the weeks are really there.
  const homeGreetingState = useMemo(() => {
    const todayStart = new Date().setHours(0, 0, 0, 0);
    const sessions = getCanonicalCompletedSessions(database);
    return {
      totalSessions: sessions.length,
      trainedToday: sessions.some((session) => {
        const performed = new Date(session.performedAt).getTime();
        return Number.isFinite(performed) && performed >= todayStart;
      }),
      weekStreak: homeSummary.streak.currentWeekStreak,
    };
  }, [database, homeSummary.streak.currentWeekStreak]);
  // Same equipment truth the composer filters exercises with, for the default
  // warmup/cooldown drills: null = setup never said, [] = no equipment at all.
  // Week-strip training dots from the days the user actually picked
  // (Monday-first indexes). Empty = unknown → no dots, no invented rhythm.
  const homeTrainingDayIndexes = useMemo(() => {
    const order: Record<string, number> = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 };
    return preferences.setupAvailableDays.map((day) => order[day]).filter((index) => index !== undefined);
  }, [preferences.setupAvailableDays]);
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
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void refresh();
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
  useEffect(() => {
    if (!appHydrated) {
      return;
    }
    const nowMs = Date.now();
    // Which weekdays already have a logged session this calendar week. The
    // widget's bars need it to say "done" rather than only "training day".
    const weekStart = getCalendarWeekStartTimestamp(new Date(nowMs));
    const completedWeekdayIndexes = getCanonicalCompletedSessions(database)
      .map((session) => new Date(session.performedAt))
      .filter((date) => Number.isFinite(date.getTime()) && date.getTime() >= weekStart)
      .map((date) => (date.getDay() === 0 ? 6 : date.getDay() - 1));

    writeHomeWidgetPayload(
      buildHomeWidgetPayload({
        nowMs,
        language: preferences.appLanguage,
        // The widget shows whatever the app resolved, Pro gate included — it
        // cannot re-derive this, it is drawn in the launcher's process.
        theme: resolveThemeName(preferences),
        planName: homeActivePlanCard?.title ?? null,
        trainingDayIndexes: homeTrainingDayIndexes,
        completedWeekdayIndexes,
        sessions: homeActivePlanCard?.sessions ?? [],
      }),
    );
  }, [appHydrated, preferences, database, homeActivePlanCard, homeTrainingDayIndexes]);

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
      return { name: null, daysPerWeek: null, exerciseCount: null, focusCaption: null };
    }

    const exerciseNames = new Set<string>();
    for (const session of homeActivePlanCard.sessions) {
      for (const exercise of session.exercises) {
        exerciseNames.add(exercise.name.trim().toLowerCase());
      }
    }

    // Distinct focuses only — a 2-day Full Body plan should read "Full Body",
    // not "Full Body · Full Body".
    const focusTitles: string[] = [];
    for (const session of homeActivePlanCard.sessions) {
      const focus = getSessionFocusTitle(session.title, homeActivePlanCard.title);
      const localized = focus ? localizeWorkoutFocus(focus, preferences.appLanguage) : focus;
      if (localized && !focusTitles.includes(localized)) {
        focusTitles.push(localized);
      }
    }
    const focusCaption = focusTitles.slice(0, 3).join(' · ');

    return {
      name: homeActivePlanCard.title,
      daysPerWeek: Number.parseInt(homeActivePlanCard.sessionsPerWeek, 10) || homeActivePlanCard.sessions.length || null,
      // Hidden exercises are counted too — the card claims the plan's size, not
      // the size of the Home preview.
      exerciseCount:
        exerciseNames.size +
        homeActivePlanCard.sessions.reduce((sum, session) => sum + (session.hiddenExerciseCount ?? 0), 0),
      focusCaption: focusCaption.length > 0 ? focusCaption : null,
    };
  }, [homeActivePlanCard, preferences.appLanguage]);
  // Guided-player context props (entry eyebrow + finish-screen cards).
  const guidedEntryEyebrow = useMemo(() => {
    const weekday = t(preferences.appLanguage, `guided.weekday.${new Date().getDay()}` as I18nKey);
    const week = homeActivePlanCard?.currentWeek;
    return week ? t(preferences.appLanguage, 'guided.entry.eyebrow', { weekday, week }) : weekday;
  }, [homeActivePlanCard?.currentWeek, preferences.appLanguage]);
  const guidedWeekProgress = useMemo(() => {
    if (!progressWeeklyTarget) {
      return null;
    }
    const now = new Date();
    const weekStart = getStartOfWeek(now);
    const weekEnd = getEndOfWeek(now);
    const savedThisWeek = workoutSessions.filter((session) => {
      const performed = new Date(session.performedAt);
      return performed >= weekStart && performed < weekEnd;
    }).length;
    // The in-flight session counts too — the finish screen shows before save.
    return {
      weekLabel: homeActivePlanCard
        ? t(preferences.appLanguage, 'guided.finish.week', { week: homeActivePlanCard.currentWeek })
        : t(preferences.appLanguage, 'guided.finish.thisWeek'),
      done: savedThisWeek + 1,
      target: progressWeeklyTarget,
    };
  }, [homeActivePlanCard, preferences.appLanguage, progressWeeklyTarget, workoutSessions]);
  // Home history section: strength + cardio merged, newest first.
  const homeHistoryItems = useMemo(() => {
    const language = preferences.appLanguage;
    const strength = workoutSessions.map((session) => ({
      id: session.id,
      kind: 'strength' as const,
      title: localizeSessionName(
        formatWorkoutDisplayLabel(session.workoutNameSnapshot, t(language, 'history.workoutFallback')),
        language,
      ),
      meta: [
        formatShortDate(session.performedAt, language),
        session.durationMinutes ? formatDurationMinutes(session.durationMinutes) : null,
        session.totalVolumeKg ? formatVolume(session.totalVolumeKg, unitPreference) : null,
      ]
        .filter(Boolean)
        .join(' · '),
      performedAt: session.performedAt,
    }));
    const cardio = cardioSessions.map((session) => {
      const activity = getCardioActivity(session.activityType);
      return {
        id: session.id,
        kind: 'cardio' as const,
        title: activity.name,
        cardioIcon: activity.icon,
        meta: `${formatShortDate(session.performedAt, language)} · ${buildCardioStatsLine(session.durationSec, session.distanceKm)}`,
        performedAt: session.performedAt,
      };
    });
    return [...strength, ...cardio]
      .sort((left, right) => new Date(right.performedAt).getTime() - new Date(left.performedAt).getTime())
      .slice(0, 5);
  }, [workoutSessions, cardioSessions, unitPreference, preferences.appLanguage]);

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
  /**
   * The season rows.
   *
   * Same card shape as Explore, so a program looks the same wherever it is
   * met — and built from the same templates rather than a parallel list, so a
   * season cannot drift into offering something the catalog no longer has.
   *
   * Free, like every ready program. Seasonal content is the reason to open
   * this app in November; a paywalled reason to come back brings nobody back.
   */
  const programsSeasonRows = useMemo(
    () => {
      const byId = new Map(workout.templates.map((template) => [template.id, template]));
      return orderSeasons().map((season) => ({
        season,
        items: getSeasonProgramIds(season)
          .map((id) => byId.get(id))
          .filter((template): template is NonNullable<typeof template> => Boolean(template))
          .map((template, index) => ({
            id: template.id,
            name: formatWorkoutDisplayLabel(template.name),
            goal: formatGoalLabel(template.goalType, preferences.appLanguage),
            blurb: getReadyProgramContent(template.id, preferences.appLanguage)?.summary ?? '',
            days: template.daysPerWeek,
            minutes: template.estimatedSessionDuration,
            coverIndex: index % 5,
            fingerprint: buildProgramFingerprint(template),
            level: template.level,
            weeks: getReadyProgramBlockWeeks(template),
          })),
      }));
    },
    [preferences.appLanguage, workout.templates],
  );
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
        coverIndex: index % 5,
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
   * Trending: demo only, and null the moment the build stops being one.
   *
   * The row is here so the layout can be judged. The numbers are invented,
   * and getTrendingEntries returns null in a release build rather than
   * falling back to something — there is no honest fallback for social proof
   * on a device that only knows what one person did.
   */
  const programsTrendingItems = useMemo(
    () => {
      const entries = getTrendingEntries();
      if (!entries) {
        return null;
      }
      const byId = new Map(workout.templates.map((template) => [template.id, template]));
      return entries
        .map((entry) => {
          const template = byId.get(entry.templateId);
          return template
            ? {
                id: template.id,
                name: formatWorkoutDisplayLabel(template.name),
                weeks: getReadyProgramBlockWeeks(template),
                starts: entry.starts.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' '),
              }
            : null;
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
    },
    // The language arrives with the hydrated database, AFTER the first
    // render. Without it in the deps this memo keeps the English blurbs it
    // computed against the seed default — which is exactly what shipped:
    // the season rows read Finnish and this rail read English, from the
    // same dictionary.
    [preferences.appLanguage, workout.templates],
  );
  /**
   * "For you" — the programs the recommendation engine actually picked, each
   * with the reason it picked them.
   *
   * Only the two the waterfall gives a reason for. The scorer ranks every
   * program, so a row of five is easy and three of them would arrive with no
   * "why" — and a recommendation without a reason is the thing this app has
   * repeatedly refused to ship. One or two cards that can explain themselves
   * beat five that cannot.
   *
   * NOT labelled AI, deliberately. aiInfo.never.2 states that the model is
   * "never used to pick your programme — that is a scored, testable decision",
   * and it is: recommendationScoring plus a waterfall, covered by tests. An AI
   * badge here would contradict the app's own privacy page.
   */
  const programsRecommendations = useMemo(
    () => {
      const byId = new Map(workout.templates.map((template) => [template.id, template]));
      const waterfall = setupRecommendation?.waterfall;
      if (!waterfall) {
        // No questionnaire: recommend neighbours of the program being run.
        const active = homeActivePlanCard?.programId ? byId.get(homeActivePlanCard.programId) : null;
        return resolveProgramAffinity(active, workout.templates, 4)
          .map((match, index) => {
            const template = byId.get(match.templateId);
            return template
              ? {
                  id: template.id,
                  name: formatWorkoutDisplayLabel(template.name),
                  goal: formatGoalLabel(template.goalType, preferences.appLanguage),
                  blurb: getReadyProgramContent(template.id, preferences.appLanguage)?.summary ?? '',
                  why: t(preferences.appLanguage, AFFINITY_REASON_KEYS[match.reason], {
                    days: template.daysPerWeek,
                  }),
                  days: template.daysPerWeek,
                  minutes: template.estimatedSessionDuration,
                  coverIndex: index % 5,
                  fingerprint: buildProgramFingerprint(template),
                  level: template.level,
                  weeks: getReadyProgramBlockWeeks(template),
                }
              : null;
          })
          .filter((item): item is NonNullable<typeof item> => Boolean(item));
      }
      return [
        { id: waterfall.primaryProgramId, whyKey: waterfall.whyPrimary },
        { id: waterfall.alternativeProgramId, whyKey: waterfall.whyAlternative },
      ]
        .filter((entry): entry is { id: string; whyKey: I18nKey } => Boolean(entry.id && entry.whyKey))
        .map((entry, index) => {
          const template = byId.get(entry.id);
          return template
            ? {
                id: template.id,
                name: formatWorkoutDisplayLabel(template.name),
                goal: formatGoalLabel(template.goalType, preferences.appLanguage),
                blurb: getReadyProgramContent(template.id, preferences.appLanguage)?.summary ?? '',
                why: t(preferences.appLanguage, entry.whyKey, { days: template.daysPerWeek }),
                days: template.daysPerWeek,
                minutes: template.estimatedSessionDuration,
                coverIndex: index % 5,
                fingerprint: buildProgramFingerprint(template),
                level: template.level,
                weeks: getReadyProgramBlockWeeks(template),
              }
            : null;
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
    },
    [
      homeActivePlanCard?.programId,
      preferences.appLanguage,
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

  const programsSeasonTileCounts = useMemo(
    () => ({
      winter: getSeasonProgramIds('winter').length,
      summer: getSeasonProgramIds('summer').length,
    }),
    [],
  );
  /**
   * The two seasons the row shows: the one running and the one after it.
   *
   * Four tiles over two blocks treated a season as a filter. It is a dated
   * commitment — it opens, runs 26 weeks and closes — so the card carries the
   * dates and the countdown rather than a month range and a count.
   */
  const programsSeasonCards = useMemo(
    () => {
      const now = new Date();
      const current = resolveSeasonWindow(now);
      const next = nextSeasonWindow(now);
      const label = (date: Date) =>
        preferences.appLanguage === 'fi'
          ? `${date.getDate()}.${date.getMonth() + 1}.`
          : `${date.getDate()}/${date.getMonth() + 1}`;
      const build = (window: typeof current, isCurrent: boolean) => ({
        season: window.season,
        labelKey: (window.season === 'winter' ? 'season.winter' : 'season.summer') as I18nKey,
        year: window.year,
        rangeLabel: `${label(window.start)}${preferences.appLanguage === 'fi' ? '' : ''}–${label(
          new Date(window.end.getTime() - 86_400_000),
        )}${window.year !== window.end.getFullYear() ? window.end.getFullYear() : ''}`,
        startLabel: label(window.start),
        weeksLeft: isCurrent ? seasonWeeksLeft(window, now) : SEASON_WEEKS,
        // The card names the season's ONE program rather than counting ten.
        // A count was the right label when a season was a filter; it is the
        // wrong one now that the season is a thing you join.
        programName: (() => {
          const template = workout.templates.find(
            (entry) => entry.id === getSeasonProgramId(window.season),
          );
          return template ? formatWorkoutDisplayLabel(template.name) : '';
        })(),
        current: isCurrent,
        gradient: SEASON_COLORS[window.season],
      });
      return [build(current, true), build(next, false)];
    },
    [preferences.appLanguage, workout.templates],
  );
  const programsCampaigns = useMemo(
    () =>
      buildProgramCampaigns({
        season: getSeasonForDate(),
        seasonCount: programsSeasonTileCounts[getSeasonForDate()],
        strengthCount: programsCategoryCounts.strength ?? 0,
        exerciseCount: exerciseBrowserItems.length,
      }),
    [exerciseBrowserItems.length, programsCategoryCounts, programsSeasonTileCounts],
  );
  /**
   * Programs with real logged work, most recently trained first.
   *
   * Built from completed sessions rather than from "programs you opened": a
   * program you looked at is not one you left off.
   */
  const programsContinueItems = useMemo(
    () => {
      const byId = new Map(workout.templates.map((template) => [template.id, template]));
      const customById = new Map(customWorkouts.map((template) => [template.id, template]));
      return resolveContinueEntries(workoutSessions, {
        excludeTemplateId: homeActivePlanCard?.programId ?? null,
        limit: 6,
      })
        .map((entry, index) => {
          const template = byId.get(entry.templateId);
          if (template) {
            return {
              id: template.id,
              name: formatWorkoutDisplayLabel(template.name),
              goal: formatGoalLabel(template.goalType, preferences.appLanguage),
              blurb: '',
              days: template.daysPerWeek,
              minutes: template.estimatedSessionDuration,
              coverIndex: index % 5,
              fingerprint: buildProgramFingerprint(template),
              level: template.level,
              weeks: getReadyProgramBlockWeeks(template),
              sessionCount: entry.sessionCount,
              daysSince: entry.daysSince,
            };
          }
          // A custom program the reader built. It has no ready-program content
          // behind it, so the card carries only what the template really says.
          const custom = customById.get(entry.templateId);
          return custom
            ? {
                id: custom.id,
                name: formatWorkoutDisplayLabel(custom.name),
                goal: t(preferences.appLanguage, 'programs.yourPrograms'),
                blurb: '',
                days: custom.sessionCount,
                minutes: 0,
                coverIndex: index % 5,
                fingerprint: [],
                // A program the reader built has no declared level and no
                // block length. Saying "beginner, 4 weeks" would be inventing
                // both, so the row shows neither.
                level: 'beginner' as const,
                weeks: 0,
                sessionCount: entry.sessionCount,
                daysSince: entry.daysSince,
              }
            : null;
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
    },
    [
      customWorkouts,
      homeActivePlanCard?.programId,
      preferences.appLanguage,
      workout.templates,
      workoutSessions,
    ],
  );
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
      ),
    [preferences.strengthGoals, trackedProgress],
  );
  /** Lifts with logged work, for the goal picker — you cannot aim at nothing. */
  const programsGoalCandidates = useMemo(
    () =>
      trackedProgress
        .filter((summary) => (summary.bestWeight ?? 0) > 0)
        .map((summary) => ({
          name: summary.name,
          label: exerciseNameLabel(preferences.appLanguage, summary.name),
          bestKg: summary.bestWeight ?? 0,
        })),
    [preferences.appLanguage, trackedProgress],
  );
  const programsCustomItems = useMemo(
    () =>
      customWorkouts.map((template) => ({
        id: template.id,
        name: formatWorkoutDisplayLabel(template.name),
        subtitle: `${template.sessionCount} ${template.sessionCount === 1 ? 'session' : 'sessions'} · ${template.exerciseCount} exercises`,
      })),
    [customWorkouts],
  );
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
      const prefillExercise = route.prefillExerciseLibraryId
        ? exerciseBrowserItems.find((item) => item.id === route.prefillExerciseLibraryId) ?? null
        : null;
      const prefillExercises: ExerciseTemplateDraft[] = prefillExercise
        ? [
            {
              name: prefillExercise.name,
              libraryItemId: prefillExercise.id,
              ...getExerciseTemplateDefaults(prefillExercise, preferences.defaultRestSeconds),
            },
          ]
        : [];

      return {
        name: route.prefillName ?? '',
        sessions: [{ name: 'Session 1', exercises: prefillExercises }],
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
      insight: null,
    });
    summaryExitRouteRef.current = ROOT_ROUTES.home;
    replaceRoute({ tab: 'workout', screen: 'summary' });
  };

  let content: React.ReactNode;

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
          onGuidedOnboarding={() => {
            setOnboardingPath('build');
            setOnboardingStep('health_connect');
          }}
          onBrowsePrograms={() => {
            // The ready path also creates the profile (health + about) before
            // opening the catalog — same front door, different fork.
            setOnboardingPath('ready');
            setOnboardingStep('health_connect');
          }}
          onBack={() => void handleBackToEntry()}
        />
      );
    } else if (onboardingStep === 'health_connect' || (onboardingStep === 'health_synced' && !onboardingHealthBasics)) {
      content = (
        <HealthConnectScreen
          language={preferences.appLanguage}
          onConnected={(basics) => {
            setOnboardingHealthBasics(basics);
            setOnboardingStep('health_synced');
          }}
          onSkip={() => {
            setOnboardingHealthBasics(null);
            setOnboardingStep('about');
          }}
        />
      );
    } else if (onboardingStep === 'health_synced' && onboardingHealthBasics) {
      content = (
        <HealthSyncedScreen
          basics={onboardingHealthBasics}
          language={preferences.appLanguage}
          onContinue={() => setOnboardingStep('about')}
          onBack={() => setOnboardingStep('health_connect')}
        />
      );
    } else if (onboardingStep === 'about') {
      const healthAge = getAgeFromDateOfBirth(onboardingHealthBasics?.dateOfBirth ?? null);
      content = (
        <AboutYouScreen
          // "We imported these" only when something was actually imported — a
          // connection that read nothing must not claim otherwise.
          healthConnected={hasAnyHealthBasics(onboardingHealthBasics)}
          language={preferences.appLanguage}
          initialValues={
            aboutYouValues ??
            (onboardingHealthBasics
              ? {
                  gender: onboardingHealthBasics.sex,
                  ...(healthAge !== null ? { age: healthAge } : null),
                  ...(onboardingHealthBasics.heightCm !== null
                    ? { heightCm: onboardingHealthBasics.heightCm }
                    : null),
                  ...(onboardingHealthBasics.weightKg !== null
                    ? { weightKg: onboardingHealthBasics.weightKg }
                    : null),
                }
              : null)
          }
          onContinue={(values) => {
            setAboutYouValues(values);
            setOnboardingStep(onboardingPath === 'ready' ? 'ready_catalog' : 'questionnaire');
          }}
          onBack={() => setOnboardingStep(onboardingHealthBasics ? 'health_synced' : 'path')}
        />
      );
    } else if (onboardingStep === 'ready_catalog') {
      content = (
        <OnboardingReadyCatalogScreen
          language={preferences.appLanguage}
          busy={busySavingReadyPick}
          onPick={(programId) => void handleOnboardingPickReadyProgram(programId)}
          onBack={() => setOnboardingStep('about')}
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
          onStartProTrial={handleOnboardingStartProTrial}
          onFullBleedReviewChange={setFullBleedReview}
          onCompleteToProgramDetail={handleOnboardingCompleteToProgramDetail}
          onCompleteToCustom={handleOnboardingCompleteToCustom}
        />
      );
    }
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
        onStartProTrial={handleSetupCompleteToTraining}
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
            // Truth rule: when this is the user's active program, the detail
            // shows the composed week they actually run, not the raw catalog.
            preferences.recommendedProgramId === route.workoutTemplateId && setupSelection
              ? composeProgramWeekForSelection(setupSelection, route.workoutTemplateId)
              : null,
            preferences.appLanguage,
          )
      : customTemplate
        ? buildCustomProgramDetail(customTemplate, programInsightsByTemplateId[route.workoutTemplateId])
        : null;

    content = program ? (
      <ProgramDetailScreen
        language={preferences.appLanguage}
        program={program}
        // The template's own progression rules and audience. Custom programs
        // have neither — they are the reader's own sessions with no rule
        // attached, and inventing one would invent the whole section.
        progressionRules={readyTemplate?.progressionRules ?? null}
        audience={
          readyTemplate
            ? getReadyProgramContent(readyTemplate.id, preferences.appLanguage)?.audience ?? null
            : null
        }
        availableDays={
          preferences.setupAvailableDays.length > 0 ? preferences.setupAvailableDays.length : null
        }
        equipment={
          readyTemplate
            ? resolveProgramEquipment(
                readyTemplate.sessions.flatMap((session) =>
                  session.exercises.map((exercise) => exercise.exerciseName),
                ),
              )
            : []
        }
        availableEquipment={availableEquipmentForDrills}
        fitReason={
          // Why this program, relative to the one being run. The reason was
          // computed for the browse row and stopped there; the screen with
          // room to explain it never received it.
          readyTemplate && homeActivePlanCard?.programId
            ? (() => {
                const match = resolveProgramAffinity(
                  workout.templates.find((entry) => entry.id === homeActivePlanCard.programId),
                  workout.templates,
                  8,
                ).find((entry) => entry.templateId === readyTemplate.id);
                return match
                  ? t(preferences.appLanguage, AFFINITY_REASON_KEYS[match.reason], {
                      days: readyTemplate.daysPerWeek,
                    })
                  : null;
              })()
            : null
        }
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
        onMakeOwnVersion={
          route.programType === 'ready'
            ? () => handleCopyReadyProgramToCustom(route.workoutTemplateId)
            : undefined
        }
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
        language={preferences.appLanguage}
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
  } else if (route.tab === 'workout' && route.screen === 'empty') {
    content = (
      <EmptyWorkoutScreen
        language={preferences.appLanguage}
        exerciseLibrary={exerciseBrowserItems}
        recentExerciseLibraryItems={recentExerciseBrowserItems}
        defaultRestSeconds={preferences.defaultRestSeconds}
        keepScreenAwake={preferences.keepScreenAwakeDuringWorkout}
        exercisePrLookup={exercisePrLookup}
        onBack={() => navigateBack(ROOT_ROUTES.home)}
        onSave={async (draft, summary) => {
          try {
            // Freestyle logging is not authoring: the template exists only so
            // the session has something to hang on, so it carries the flag
            // that keeps it out of the free cap. The date is what makes three
            // of them tellable apart in a list.
            await finishLoggedWorkoutSave(
              {
                ...draft,
                name: `${draft.name.trim()} ${formatShortDate(
                  summary.performedAt,
                  preferences.appLanguage,
                )}`,
                origin: 'freestyle',
              },
              summary,
            );
          } catch (error) {
            console.error('Failed to save freestyle workout', error);
            showToast(t(preferences.appLanguage, 'toast.saveWorkoutFailed'));
            throw error;
          }
        }}
      />
    );
  } else if (route.tab === 'workout' && route.screen === 'editor') {
    content = (
      <WorkoutEditorScreen
        language={preferences.appLanguage}
        key={`editor:${route.workoutTemplateId ?? 'new'}:${route.prefillName ?? ''}:${route.prefillExerciseLibraryId ?? ''}`}
        initialDraft={editorDraft}
        exerciseLibrary={exerciseBrowserItems}
        recentExerciseLibraryItems={recentExerciseBrowserItems}
        defaultRestSeconds={preferences.defaultRestSeconds}
        unitPreference={unitPreference}
        exerciseHistoryLookup={editorExerciseHistoryLookup}
        exercisePrLookup={exercisePrLookup}
        onBack={() => navigateBack(WORKOUT_PLAN_ROUTE)}
        onUseTemplate={() => navigate(WORKOUT_PLAN_ROUTE)}
        onSave={async (draft, summary: WorkoutEditorFinishSummary) => {
          const isNew = !draft.id;
          try {
            await finishLoggedWorkoutSave(draft, summary);
          } catch (error) {
            console.error('Failed to save workout', error);
            showToast(t(preferences.appLanguage, 'toast.saveWorkoutFailed'));
            throw error;
          }
          if (isNew) {
            showToast(t(preferences.appLanguage, 'toast.workoutCreated'));
          }
        }}
      />
    );
  } else if (route.tab === 'home' && route.screen === 'cardio') {
    content = (
      <CardioScreen
        language={preferences.appLanguage}
        keepScreenAwake={preferences.keepScreenAwakeDuringWorkout}
        cardioSessions={cardioSessions}
        hasActiveStrengthSession={Boolean(workout.activeSession)}
        isSaving={cardioSaving}
        onResumeStrengthSession={() => {
          navigateToActiveWorkout();
        }}
        onDiscardStrengthSession={() => {
          workout.discardWorkout();
          setFinishSaveState({ status: 'idle', sessionId: null, message: null });
        }}
        onSaveCardioSession={async (input) => {
          setCardioSaving(true);
          try {
            await saveCardioSession(input);
            showToast(t(preferences.appLanguage, 'toast.cardioSaved'));
          } catch (error) {
            console.error('Failed to save cardio session', error);
            showToast(t(preferences.appLanguage, 'toast.cardioSaveFailed'));
            throw error;
          } finally {
            setCardioSaving(false);
          }
        }}
        onLeave={() => navigateBack(ROOT_ROUTES.home)}
      />
    );
  } else if (route.tab === 'workout' && route.screen === 'guided') {
    content = (
      <GuidedPlayerScreen
        keepScreenAwake={preferences.keepScreenAwakeDuringWorkout}
        unitPreference={unitPreference}
        availableEquipment={availableEquipmentForDrills}
        tailoringPreferences={tailoringPreferences}
        exerciseLibrary={exerciseLibrary}
        soundCuesEnabled={preferences.soundCuesEnabled}
        onToggleSoundCues={(next) => void updatePreferences({ soundCuesEnabled: next })}
        language={preferences.appLanguage}
        entryEyebrow={guidedEntryEyebrow}
        weekProgress={guidedWeekProgress}
        nextUp={guidedNextUp}
        onLeave={() => navigateBack(getWorkoutLoggerFallbackRoute())}
        onEndSession={() => void handleDiscardWorkout()}
        onFinishSession={() => void handleConfirmFinishWorkout()}
        isSavingWorkout={finishSaveState.status === 'saving'}
      />
    );
  } else if (route.tab === 'workout' && route.screen === 'summary' && completionSummary) {
    content = (
      <WorkoutCompletionScreen
        language={preferences.appLanguage}
        weekProgress={guidedWeekProgress}
        nextUp={guidedNextUp}
        workoutName={completionSummary.workoutName}
        performedAt={completionSummary.performedAt}
        durationMinutes={completionSummary.durationMinutes}
        setsCompleted={completionSummary.setsCompleted}
        totalVolume={completionSummary.totalVolume}
        exercisesLogged={completionSummary.exercisesLogged}
        volumeDeltaKg={completionSummary.volumeDeltaKg}
        muscles={completionSummary.muscles}
        exerciseCards={completionSummary.exerciseCards}
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
        onDone={() => {
          setCompletionSummary(null);
          setWorkoutCelebration(null);
          setFinishSaveState({ status: 'idle', sessionId: null, message: null });
          workout.clearCompletedWorkout();
          resetToRoute(ROOT_ROUTES.home);
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
  } else if (route.tab === 'progress' && route.screen === 'calendar') {
    content = (
      <TrainingCalendarScreen
        language={preferences.appLanguage}
        sessions={workoutSessions}
        resolveDay={(sessionIds) => {
          // The day's own record, from what the session stored. Two sessions
          // on one date is real, and the first one is what the card shows.
          const session = workoutSessions.find((entry) => entry.id === sessionIds[0]);
          if (!session) {
            return null;
          }
          const logs = getSessionLogs(session.id).filter((log) => !log.skipped);
          let topLift: { name: string; weightKg: number; reps: number } | null = null;
          for (const log of logs) {
            for (const set of getComparableLogSets(log)) {
              if (set.weight > 0 && (topLift === null || set.weight > topLift.weightKg)) {
                topLift = {
                  name: exerciseNameLabel(preferences.appLanguage, log.exerciseNameSnapshot),
                  weightKg: set.weight,
                  reps: set.reps,
                };
              }
            }
          }
          return {
            sessionId: session.id,
            title: localizeSessionName(
              formatWorkoutDisplayLabel(session.workoutNameSnapshot),
              preferences.appLanguage,
            ),
            durationMinutes: session.durationMinutes ?? null,
            exercises: session.exercisesCompleted ?? logs.length,
            sets: session.setsCompleted ?? 0,
            volumeKg: session.totalVolumeKg ?? 0,
            topLift,
            swaps: session.exercisesSwapped ?? 0,
            note: session.sessionNotes?.trim() ? session.sessionNotes.trim() : null,
          };
        }}
        onBack={() => navigateBack(ROOT_ROUTES.progress)}
        onOpenSession={(sessionId) => navigate({ tab: 'home', screen: 'session', sessionId })}
        onStartWorkout={() => resetToRoute(ROOT_ROUTES.home)}
      />
    );
  } else if (route.tab === 'progress') {
    content = (
        <ProgressScreen
          topRecords={personalRecords.weight.slice(0, 3)}
          recordCount={distinctRecordCount}
          records={personalRecords}
          setLogSources={recordSources}
          onStartWorkout={() => resetToRoute(ROOT_ROUTES.home)}
          onOpenCalendar={() => navigate({ tab: 'progress', screen: 'calendar' })}
          summaries={trackedProgress}
          bodyweightProgress={bodyweightProgress}
          measurementEntries={measurementEntries}
          workoutSessions={workoutSessions}
          activityCalendar={homeSummary.streak.calendar}
          // Same source the Training plan screen edits, so the calendar cannot
          // disagree with the schedule the user set. Empty when Vinha places
          // the week, and then nothing is ever called missed.
          trainingDays={preferences.setupAvailableDays}
          rhythm={progressTrainingRhythm}
          weeklyTargetSessions={progressWeeklyTarget}
          unitPreference={unitPreference}
          weeklyRead={proWeeklyRead}
          readMoment={proPlateau?.moment ?? null}
          proUnlocked={coachProUnlocked}
          onOpenPremium={() => navigate({ tab: 'profile', screen: 'premium' })}
          language={preferences.appLanguage}
          selectedExerciseKey={route.screen === 'detail' ? route.exerciseKey : undefined}
        initialSection={route.screen === 'list' ? route.section : undefined}
        showBodyweightDetail={route.screen === 'bodyweight'}
        onAddBodyweight={async (weightKg) => {
          await addBodyweightEntry(weightKg);
          showToast(t(preferences.appLanguage, 'toast.bodyweightSaved'));
        }}
        onAddMeasurement={async (kind, value, unit) => {
          await addMeasurementEntry(kind, value, unit);
          showToast(t(preferences.appLanguage, 'toast.measurementSaved'));
        }}
        recentSessions={homeRecentSessions}
        onOpenSessionHistory={() => navigate({ tab: 'home', screen: 'history' })}
        onOpenRecentSession={(sessionId) => navigate({ tab: 'home', screen: 'session', sessionId })}
      />
    );
  } else if (route.tab === 'home' && route.screen === 'ai') {
    content = (
      <AICoachScreen
        language={preferences.appLanguage}
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
        language={preferences.appLanguage}
        preferences={preferences}
        onBack={() => navigateBack(ROOT_ROUTES.home)}
        onSave={async (patch) => {
          const nextPatch: Partial<AppPreferences> = {
            ...patch,
            aiCoachSetupHash: null,
            aiCoachPlanGeneratedAt: null,
          };
          await updatePreferences(nextPatch);
          showToast(t(preferences.appLanguage, 'toast.aiSetupSaved'));
          await openAiMode(nextPatch);
        }}
      />
    );
  } else if (route.tab === 'home' && (route.screen === 'history' || route.screen === 'session')) {
    content = (
      <HistoryScreen
        sessions={workoutSessions}
        cardioSessions={cardioSessions}
        unitPreference={unitPreference}
        language={preferences.appLanguage}
        selectedSessionId={route.screen === 'session' ? route.sessionId : undefined}
        getSessionLogs={getSessionLogs}
        onSelectSession={(sessionId) => navigate({ tab: 'home', screen: 'session', sessionId })}
        onBack={() => navigateBack(ROOT_ROUTES.home)}
      />
    );
  } else if (route.tab === 'home' && route.screen === 'ai_chat') {
    content = (
      <AICoachChatScreen
        language={preferences.appLanguage}
        proUnlocked={coachProUnlocked}
        freeQuestionsRemaining={resolveCoachQuota(preferences.aiCoachFreeQuota).remaining}
        onFreeQuestionUsed={() =>
          void updatePreferences({ aiCoachFreeQuota: recordCoachQuestion(preferences.aiCoachFreeQuota) })
        }
        trainingContext={aiCoachTrainingContext}
        intro={coachChatIntro}
        sessionCount={database.workoutSessions.length}
        quickAskKeys={['coach.chip.analyze', 'coach.chip.program', 'coach.chip.protein']}
        lastSession={coachLastSession}
        onOpenAnalysis={(sessionId) => navigate({ tab: 'home', screen: 'analysis', sessionId })}
        onOpenPremium={() => navigate({ tab: 'profile', screen: 'premium' })}
      />
    );
  } else if (route.tab === 'home' && route.screen === 'pro_offer') {
    content = (
      <ProOfferScreen
        language={preferences.appLanguage}
        onContinueFree={() => resetToRoute(ROOT_ROUTES.home)}
        onSeePro={() => navigate({ tab: 'profile', screen: 'premium' })}
      />
    );
  } else if (route.tab === 'home' && route.screen === 'analysis') {
    content = (
      <SessionAnalysisScreen
        analysis={sessionAnalysis}
        language={preferences.appLanguage}
        onBack={() => navigateBack(ROOT_ROUTES.home)}
        onAskCoach={() => navigate({ tab: 'home', screen: 'ai_chat' })}
      />
    );
  } else if (route.tab === 'profile' && route.screen === 'plan_settings') {
    content = (
      <PlanSettingsScreen
        language={preferences.appLanguage}
        preferences={preferences}
        recommendedProgramName={currentFitReadyTemplate?.name ?? recommendedReadyTemplate?.name ?? null}
        onBack={() => navigateBack(ROOT_ROUTES.profile)}
        onRefineSetup={handleOpenSetupEditor}
        onOpenExercisePreferences={handleOpenExercisePreferences}
        onOpenEquipment={handleOpenEquipment}
        onOpenJointSwaps={handleOpenJointSwaps}
        onOpenPremium={handleOpenPremium}
        onScheduleModeChange={(mode) => void handleUpdateScheduleMode(mode)}
        onAutomatedProgressionChange={(enabled) => void updatePreferences({ automatedProgressionEnabled: enabled })}
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
        language={preferences.appLanguage}
        preferences={preferences}
        onBack={() => navigateBack({ tab: 'profile', screen: 'plan_settings' })}
        onChange={(patch) => void handleTailoringPreferenceChange(patch)}
      />
    );
  } else if (route.tab === 'profile' && route.screen === 'equipment') {
    content = (
      <EquipmentPreferencesScreen
        language={preferences.appLanguage}
        preferences={preferences}
        onBack={() => navigateBack({ tab: 'profile', screen: 'plan_settings' })}
        onChange={(patch) => void handleTailoringPreferenceChange(patch)}
      />
    );
  } else if (route.tab === 'profile' && route.screen === 'joint_swaps') {
    content = (
      <JointFriendlySwapsScreen
        language={preferences.appLanguage}
        preferences={preferences}
        onBack={() => navigateBack({ tab: 'profile', screen: 'plan_settings' })}
        onChange={(patch) => void handleTailoringPreferenceChange(patch)}
      />
    );
  } else if (route.tab === 'profile' && route.screen === 'premium') {
    content = (
      <PremiumScreen
        language={preferences.appLanguage}
        previewUnlocked={preferences.adaptiveCoachPremiumUnlocked}
        proUnlocked={coachProUnlocked}
        heroChart={premiumHeroChart}
        unitPreference={unitPreference}
        sessionCount={database.workoutSessions.length}
        coachSpecimen={proCoachSpecimen}
        onManageSubscription={() => navigate({ tab: 'profile', screen: 'subscription' })}
        onBack={() => navigateBack(ROOT_ROUTES.profile)}
        onTogglePreview={() => {
          // The CTA sells a trial the app cannot deliver (demo build). What it
          // actually does is flip the preview switch — and if that turns Pro
          // ON, the unlock moment follows, which is the whole point of it.
          const turningOn = !preferences.adaptiveCoachPremiumUnlocked;
          void updatePreferences({ adaptiveCoachPremiumUnlocked: turningOn });
          if (turningOn) {
            navigate({ tab: 'profile', screen: 'premium_unlock' });
          }
        }}
        onOpenLegal={(document) => navigate({ tab: 'profile', screen: 'legal', document })}
      />
    );
  } else if (route.tab === 'profile' && route.screen === 'premium_unlock') {
    content = (
      <PremiumUnlockScreen
        language={preferences.appLanguage}
        trialEndsAt={premiumTrialEndsAt}
        // The reads just unlocked; this is the first one, from their own log.
        coachSpecimen={proCoachSpecimen}
        onDone={() => resetToRoute(ROOT_ROUTES.profile)}
      />
    );
  } else if (route.tab === 'profile' && route.screen === 'training_plan') {
    content = (
      <TrainingPlanScreen
        language={preferences.appLanguage}
        startEditingSchedule={route.editSchedule === true}
        planName={profilePlanSummary.name}
        planType={homeActivePlanCard?.programType ?? null}
        planDaysPerWeek={profilePlanSummary.daysPerWeek}
        planExerciseCount={profilePlanSummary.exerciseCount}
        planFocusCaption={profilePlanSummary.focusCaption}
        sessions={(homeActivePlanCard?.sessions ?? []).map((session) => ({
          id: session.id,
          title: localizeSessionName(formatWorkoutDisplayLabel(session.title), preferences.appLanguage),
          exerciseCount: session.exercises.length + (session.hiddenExerciseCount ?? 0),
          totalSets: session.totalSets ?? 0,
          isNext: session.id === homeActivePlanCard?.nextSession.id,
        }))}
        trainingDays={preferences.setupAvailableDays}
        exerciseLibrary={exerciseBrowserItems}
        onBack={() => navigateBack(ROOT_ROUTES.profile)}
        onOpenPlanSettings={handleOpenPlanSettings}
        onChangeTrainingDays={(days) => {
          // Same invariants as the onboarding day question: picking specific
          // days makes the schedule self-managed and the count follows, 2–6.
          const clamped = Math.min(6, Math.max(2, days.length)) as 2 | 3 | 4 | 5 | 6;
          void updatePreferences({
            setupAvailableDays: days,
            setupDaysPerWeek: clamped,
            setupScheduleMode: 'self_managed',
          });
        }}
        onEditCustomPlan={
          homeActivePlanCard?.programType === 'custom'
            ? () =>
                navigate({ tab: 'workout', screen: 'template', workoutTemplateId: homeActivePlanCard.programId })
            : undefined
        }
        onCopyToCustomPlan={
          homeActivePlanCard?.programType === 'ready' ? handleCopyReadyProgramToCustom : undefined
        }
        onAiAssisted={() => navigate(coachProUnlocked ? { tab: 'home', screen: 'ai_setup' } : { tab: 'profile', screen: 'premium' })}
        onBuildYourself={() =>
          programSlots.canCreate
            ? navigate({ tab: 'workout', screen: 'template' })
            : setProgramLimitVisible(true)
        }
        onImportProgram={async (draft) => {
          const workoutTemplateId = await upsertWorkoutTemplate(draft);
          navigate({ tab: 'workout', screen: 'program', programType: 'custom', workoutTemplateId });
        }}
      />
    );
  } else if (route.tab === 'profile' && route.screen === 'notifications') {
    content = (
      <NotificationsScreen
        language={preferences.appLanguage}
        prefs={preferences.notificationPrefs}
        trainingDays={preferences.setupAvailableDays}
        onTrainingBreak={preferences.trainingBreak !== null}
        onBack={() => navigateBack({ tab: 'profile', screen: 'settings' })}
        onChange={(patch) =>
          void updatePreferences({ notificationPrefs: { ...preferences.notificationPrefs, ...patch } })
        }
        requestPermission={requestNotificationPermission}
        checkPermission={getNotificationPermissionGranted}
        onOpenTrainingPlan={() => navigate({ tab: 'profile', screen: 'training_plan' })}
      />
    );
  } else if (route.tab === 'profile' && route.screen === 'training_break') {
    content = (
      <TrainingBreakScreen
        language={preferences.appLanguage}
        trainingBreak={preferences.trainingBreak}
        onBack={() => navigateBack({ tab: 'profile', screen: 'settings' })}
        onStartBreak={(reason, note) =>
          void updatePreferences({ trainingBreak: { reason, note, startedAt: new Date().toISOString() } })
        }
        onEndBreak={() => void updatePreferences({ trainingBreak: null })}
      />
    );
  } else if (route.tab === 'profile' && route.screen === 'promo') {
    content = (
      <PromoCodeScreen
        language={preferences.appLanguage}
        promoProUntil={preferences.promoProUntil}
        onBack={() => navigateBack({ tab: 'profile', screen: 'settings' })}
        // Only the promo date is stored. Flipping the preview switch here too
        // would make a 30-day code permanent Pro, because nothing ever turns
        // that switch back off — resolveProEntitlement reads the date itself.
        onRedeemed={(proUntilIso) => void updatePreferences({ promoProUntil: proUntilIso })}
      />
    );
  } else if (route.tab === 'profile' && route.screen === 'subscription') {
    content = (
      <SubscriptionScreen
        language={preferences.appLanguage}
        promoProUntil={preferences.promoProUntil}
        onBack={() => navigateBack({ tab: 'profile', screen: 'settings' })}
        onManageMembership={() => navigate({ tab: 'profile', screen: 'membership_end' })}
      />
    );
  } else if (route.tab === 'profile' && route.screen === 'membership_end') {
    content = (
      <MembershipEndScreen
        language={preferences.appLanguage}
        // The entitlement names its own source, so the screen never has to
        // guess which of promo / demo switch is keeping Pro on.
        source={proEntitlement.source ?? 'none'}
        promoUntil={proEntitlement.promoUntil}
        onBack={() => navigateBack({ tab: 'profile', screen: 'subscription' })}
        onKeep={() => navigate({ tab: 'profile', screen: 'premium' })}
        onEndNow={() => {
          void updatePreferences({ adaptiveCoachPremiumUnlocked: false });
          navigateBack({ tab: 'profile', screen: 'subscription' });
        }}
      />
    );
  } else if (route.tab === 'profile' && route.screen === 'support') {
    content = (
      <SupportScreen
        language={preferences.appLanguage}
        profileName={preferences.profileName}
        onBack={() => navigateBack({ tab: 'profile', screen: 'settings' })}
      />
    );
  } else if (route.tab === 'profile' && route.screen === 'features') {
    content = (
      <FeatureRequestsScreen
        language={preferences.appLanguage}
        votedIds={preferences.featureVotedIds}
        onBack={() => navigateBack({ tab: 'profile', screen: 'settings' })}
        onToggleVote={(id) =>
          void updatePreferences({
            featureVotedIds: preferences.featureVotedIds.includes(id)
              ? preferences.featureVotedIds.filter((votedId) => votedId !== id)
              : [...preferences.featureVotedIds, id],
          })
        }
      />
    );
  } else if (route.tab === 'profile' && route.screen === 'ai_transparency') {
    content = (
      <AiTransparencyScreen
        language={preferences.appLanguage}
        liveModeConfigured={isAiCoachLiveConfigured()}
        onBack={() => navigateBack({ tab: 'profile', screen: 'settings' })}
      />
    );
  } else if (route.tab === 'profile' && route.screen === 'legal') {
    content = (
      <LegalDocumentScreen
        document={route.document}
        language={preferences.appLanguage}
        onBack={() => navigateBack({ tab: 'profile', screen: 'settings' })}
      />
    );
  } else if (route.tab === 'profile' && route.screen === 'edit_profile') {
    content = (
      <EditProfileScreen
        language={preferences.appLanguage}
        initialName={preferences.profileName}
        onBack={() => navigateBack({ tab: 'profile', screen: 'settings' })}
        onSave={(name) => void updatePreferences({ profileName: name })}
      />
    );
  } else if (route.tab === 'profile' && route.screen === 'my_data') {
    content = (
      <MyDataScreen
        language={preferences.appLanguage}
        preferences={preferences}
        onBack={() => navigateBack({ tab: 'profile', screen: 'settings' })}
        onSaveBasics={(patch) => void updatePreferences(patch)}
        onEditLimitations={() => navigate({ tab: 'profile', screen: 'setup', stage: 'avoid' })}
        onCreateNewPlan={() => navigate({ tab: 'profile', screen: 'setup', stage: 'location' })}
      />
    );
  } else if (route.tab === 'profile' && route.screen === 'export_plan') {
    content = (
      <ExportPlanScreen
        language={preferences.appLanguage}
        plans={exportablePlans}
        log={{ sessions: database.workoutSessions, logs: database.exerciseLogs }}
        onBack={() => navigateBack({ tab: 'profile', screen: 'settings' })}
      />
    );
  } else if (route.tab === 'profile' && route.screen === 'settings') {
    content = (
      <SettingsScreen
        preferences={preferences}
        firstSessionAt={lifetimeSummary.firstSessionAt}
        onOpenEditProfile={() => navigate({ tab: 'profile', screen: 'edit_profile' })}
        onBack={() => navigateBack(ROOT_ROUTES.profile)}
        onPreferencesChange={async (patch) => {
          await updatePreferences(patch);
        }}
        onOpenMyData={() => navigate({ tab: 'profile', screen: 'my_data' })}
        onImportPlan={() => setSettingsImportVisible(true)}
        onExportPlan={() => navigate({ tab: 'profile', screen: 'export_plan' })}
        homeWidget={
          homeWidgetState?.supported
            ? { added: homeWidgetState.added, onAdd: () => void handleAddHomeWidget() }
            : null
        }
        onOpenNotifications={() => navigate({ tab: 'profile', screen: 'notifications' })}
        onOpenTrainingBreak={() => navigate({ tab: 'profile', screen: 'training_break' })}
        onOpenPromo={() => navigate({ tab: 'profile', screen: 'promo' })}
        onOpenSubscription={() => navigate({ tab: 'profile', screen: 'subscription' })}
        onOpenSupport={() => navigate({ tab: 'profile', screen: 'support' })}
        onOpenFeatures={() => navigate({ tab: 'profile', screen: 'features' })}
        onOpenAiInfo={() => navigate({ tab: 'profile', screen: 'ai_transparency' })}
        onOpenLegal={(document) => navigate({ tab: 'profile', screen: 'legal', document })}
        onConnectHealth={() => void handleProfileConnectHealth()}
        onResetAllData={async () => {
          await resetAllData();
          setCompletionSummary(null);
          setWorkoutCelebration(null);
          setFinishSaveState({ status: 'idle', sessionId: null, message: null });
          workout.clearCompletedWorkout();
          resetToRoute(ROOT_ROUTES.home);
        }}
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
        planName={profilePlanSummary.name}
        planDaysPerWeek={profilePlanSummary.daysPerWeek}
        planExerciseCount={profilePlanSummary.exerciseCount}
        planFocusCaption={profilePlanSummary.focusCaption}
        onOpenSettings={() => navigate({ tab: 'profile', screen: 'settings' })}
        recordCount={distinctRecordCount}
        onOpenRecords={() => navigate({ tab: 'progress', screen: 'list', section: 'records' })}
        onManagePlan={() => navigate({ tab: 'profile', screen: 'training_plan' })}
      />
    );
  } else if (route.tab === 'workout' && route.screen === 'plans') {
    content = (
      <WorkoutsScreen
        language={preferences.appLanguage}
        customWorkouts={customWorkouts}
        programInsightsByTemplateId={programInsightsByTemplateId}
        recommendedReadyProgramId={recommendedReadyTemplate?.id ?? null}
        tailoringPreferences={tailoringPreferences}
        onOpenWorkout={navigateToGuidedWorkout}
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
        language={preferences.appLanguage}
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
        onAddToWorkout={(item) => navigate({ tab: 'workout', screen: 'editor', prefillName: item.name, prefillExerciseLibraryId: item.id })}
      />
    ) : (
      <View />
    );
  } else if (route.tab === 'workout' && route.screen === 'season') {
    /**
     * The season screen.
     *
     * Every number on it is the reader's own: points from their logged
     * sessions against a stated rule, the weekly requirement from their own
     * program's days, records from their own bests. The one section that
     * needs other people — the series — says so instead of inventing names.
     */
    const seasonInView = route.season;
    // The window of the season being looked at. Resolving from today meant an
    // upcoming season's points were counted against the CURRENT season's
    // dates — a screen full of numbers belonging to a different season.
    const currentWindow = resolveSeasonWindow();
    const seasonWindow = currentWindow.season === seasonInView ? currentWindow : nextSeasonWindow();
    // THE season program: one per season, the same one for everyone, and it
    // does not change mid-season. Ten of them meant ten different point
    // ceilings and a ranking sorted by how many days a program prescribes.
    const seasonProgramId = getSeasonProgramId(seasonInView);
    const seasonProgramTemplate = workout.templates.find((template) => template.id === seasonProgramId);
    const seasonRecords = countSeasonRecords(
      trackedProgress.map((summary) => ({
        logs: summary.logs.map((log) => ({
          weight: log.weight,
          // The best single set, so a rep record on an unloaded lift counts.
          reps: log.repsPerSet.length > 0 ? Math.max(...log.repsPerSet) : 0,
          performedAt: log.performedAt,
        })),
      })),
      seasonWindow,
    );
    const seasonProgress = computeSeasonProgress(workoutSessions, seasonWindow, {
      // The target is the SEASON program's week, not whatever the reader
      // happens to be running. Measuring a three-day season against someone's
      // own six-day split would call four workouts a missed week.
      weeklyTarget: seasonProgramTemplate?.daysPerWeek ?? null,
      records: seasonRecords,
      programId: seasonProgramId,
    });
    const seasonBadges = resolveSeasonBadges(seasonProgress, {
      // The current window is by definition the one containing today, so it
      // is never over. The finished badge belongs to a past season.
      seasonEnded: false,
      personalRecords: seasonRecords,
    });
    content = (
      <SeasonScreen
        season={seasonInView}
        language={preferences.appLanguage}
        progress={seasonProgress}
        badges={seasonBadges}
        seasonProgram={{
          id: seasonProgramId,
          name: seasonProgramTemplate
            ? formatWorkoutDisplayLabel(seasonProgramTemplate.name)
            : seasonProgramId,
          blurb: getReadyProgramContent(seasonProgramId, preferences.appLanguage)?.summary ?? '',
          days: seasonProgramTemplate?.daysPerWeek ?? 0,
          fingerprint: seasonProgramTemplate ? buildProgramFingerprint(seasonProgramTemplate) : [],
        }}
        running={homeActivePlanCard?.programId === seasonProgramId}
        onBack={() => navigateBack({ tab: 'workout', screen: 'programs_home' })}
        onOpenProgram={handleOpenReadyProgramDetail}
        onStartToday={() => {
          // Already on it: start today's session. Not on it yet: open the
          // season program so joining is a deliberate choice rather than a
          // button that silently replaces whatever they were running.
          if (homeActivePlanCard?.programId === seasonProgramId && homeActivePlanCard.nextSession?.id) {
            handleStartReadyProgramSession(seasonProgramId, homeActivePlanCard.nextSession.id);
            return;
          }
          handleOpenReadyProgramDetail(seasonProgramId);
        }}
      />
    );
  } else if (route.tab === 'workout' && route.screen === 'programs_home') {
    content = (
      <ProgramsHomeScreen
        language={preferences.appLanguage}
        activeProgramTitle={homeActivePlanCard?.title ?? null}
        seasonRows={programsSeasonRows}
        catalogItems={programsCatalogItems}
        categoryCounts={programsCategoryCounts}
        categoryMembers={programsCategoryMembers}
        trendingItems={programsTrendingItems}
        recommendations={programsRecommendations}
        campaigns={programsCampaigns}
        continueItems={programsContinueItems}
        seasonCards={programsSeasonCards}
        onOpenSeason={(season) => navigate({ tab: 'workout', screen: 'season', season })}
        goals={programsGoals}
        goalCandidates={programsGoalCandidates}
        onSetGoal={(exerciseName, targetKg) =>
          void updatePreferences({
            strengthGoals: upsertStrengthGoal(preferences.strengthGoals, {
              exerciseName,
              targetKg,
              createdAt: new Date().toISOString(),
            }),
          })
        }
        onRemoveGoal={(exerciseName) =>
          void updatePreferences({
            strengthGoals: removeStrengthGoal(preferences.strengthGoals, exerciseName),
          })
        }
        customPrograms={programsCustomItems}
        exerciseLibraryCount={exerciseBrowserItems.length}
        exerciseLibraryEntries={exerciseBrowserItems}
        onAiAssisted={() => navigate(coachProUnlocked ? { tab: 'home', screen: 'ai_setup' } : { tab: 'profile', screen: 'premium' })}
        onImportProgram={async (draft) => {
          const workoutTemplateId = await upsertWorkoutTemplate(draft);
          navigate({ tab: 'workout', screen: 'program', programType: 'custom', workoutTemplateId });
        }}
        onOpenExploreProgram={handleOpenReadyProgramDetail}
        onOpenCustomProgram={handleOpenCustomProgramDetail}
        onCreateProgram={() =>
          programSlots.canCreate
            ? navigate({ tab: 'workout', screen: 'template' })
            : setProgramLimitVisible(true)
        }
        onOpenLibrary={() => navigate({ tab: 'workout', screen: 'list' })}
      />
    );
  } else if (route.tab === 'workout') {
    content = (
      <ExercisesScreen
        language={preferences.appLanguage}
        onBack={() => navigateBack({ tab: 'workout', screen: 'programs_home' })}
        items={exerciseBrowserItems}
        trackedIds={preferences.trackedExerciseLibraryItemIds}
        onOpenExercise={(item) => navigate({ tab: 'workout', screen: 'detail', exerciseId: item.id })}
        onAddToWorkout={(item) => navigate({ tab: 'workout', screen: 'editor', prefillName: item.name, prefillExerciseLibraryId: item.id })}
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
        language={preferences.appLanguage}
        activePlan={homeActivePlanCard}
        availableEquipment={availableEquipmentForDrills}
        greetingState={homeGreetingState}
        widgetPrompt={
          homeWidgetState?.supported && !homeWidgetState.added && !preferences.homeWidgetPromptDismissed
            ? {
                onAdd: () => void handleAddHomeWidget(),
                onDismiss: () => void updatePreferences({ homeWidgetPromptDismissed: true }),
              }
            : null
        }
        trainingDayIndexes={homeTrainingDayIndexes}
        statCatalogCards={homeStatCatalogCards}
        pinnedStatCardKeys={homePinnedStatCardKeys}
        onChangePinnedStatCardKeys={(next) => void updatePreferences({ homeStatCardKeys: next })}
        onOpenStatCard={(key) => {
          // Each card opens the surface where its data is tracked and logged.
          if (key === 'bodyweight') {
            navigate({ tab: 'progress', screen: 'bodyweight' });
            return;
          }
          if (key === 'bodyfat' || key === 'waist') {
            navigate({ tab: 'progress', screen: 'list', section: 'measures' });
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
        tailoringPreferences={preferences}
        onStartTrimmedSession={(sessionId) => {
          if (!homeActivePlanCard) {
            return;
          }
          if (homeActivePlanCard.programType === 'custom') {
            handleStartCustomProgramSession(homeActivePlanCard.programId, sessionId, true);
            return;
          }
          handleStartReadyProgramSession(homeActivePlanCard.programId, sessionId, true);
        }}
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
        onOpenCardio={() => navigate({ tab: 'home', screen: 'cardio' })}
        onOpenPremium={() => navigate({ tab: 'profile', screen: 'premium' })}
        plateau={proPlateau ? { headline: proPlateau.detection.headline, meta: proPlateau.detection.meta, locked: proPlateau.conclusion, moment: proPlateau.moment } : null}
        proUnlocked={coachProUnlocked}
        historyItems={homeHistoryItems}
        onOpenHistory={() => navigate({ tab: 'home', screen: 'history' })}
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
        onSelectHistorySession={(sessionId) => navigate({ tab: 'home', screen: 'session', sessionId })}
      />
    );
  }

  const showTabBar =
    !onboardingActive &&
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
    !(route.tab === 'profile' && (route.screen === 'premium' || route.screen === 'membership_end')) &&
    // Third screen with a pinned footer that the floating bar sat on top of —
    // and the worst of the three, because this one is the post-onboarding
    // paywall and the bar covered its primary button outright. Any new screen
    // that pins a CTA to the bottom belongs on this list.
    !(route.tab === 'home' && route.screen === 'pro_offer');
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
      route.screen === 'support' ||
      route.screen === 'features' ||
      route.screen === 'ai_transparency' ||
      route.screen === 'legal');
  const premiumActive = route.tab === 'profile' && route.screen === 'premium';
  const planSettingsActive = route.tab === 'profile' && route.screen === 'plan_settings';
  const exercisePreferencesActive = route.tab === 'profile' && route.screen === 'exercise_preferences';
  const equipmentActive = route.tab === 'profile' && route.screen === 'equipment';
  const jointSwapsActive = route.tab === 'profile' && route.screen === 'joint_swaps';
  const aiCoachActive = route.tab === 'home' && route.screen === 'ai';
  const aiSetupActive = route.tab === 'home' && route.screen === 'ai_setup';
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
        welcomeActive || workoutSummaryActive || historySessionActive || fullBleedReview !== null
          ? ['left', 'right']
          : onboardingActive
            ? ['top', 'left', 'right']
            : ['top', 'left', 'right', 'bottom']
      }
      // Only the gradient-hero screens want light icons; everything else takes
      // the shell's light default.
      statusBarStyleOverride={
        fullBleedReview
          ? fullBleedReview
          : workoutSummaryActive || historySessionActive
            ? 'light'
            : undefined
      }
      statusBarBackgroundColor={
        workoutSummaryActive || historySessionActive || welcomeActive || fullBleedReview !== null
          ? 'transparent'
          : aiSetupActive
            ? theme.surface
            : undefined
      }
      statusBarTranslucent={
        welcomeActive || workoutSummaryActive || historySessionActive || fullBleedReview !== null
      }
      shellBackgroundColor={aiSetupActive ? theme.surface : undefined}
      tabBar={
        showTabBar ? (
          <BottomTabBar
            language={preferences.appLanguage}
            activeTab={route.tab === 'workout' && route.screen === 'plans' ? null : route.tab}
            aiActive={
              route.tab === 'home' &&
              (route.screen === 'ai_chat' || route.screen === 'ai' || route.screen === 'ai_setup')
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
        onClose={() => setSettingsImportVisible(false)}
        onAiAssisted={() =>
          navigate(coachProUnlocked ? { tab: 'home', screen: 'ai_setup' } : { tab: 'profile', screen: 'premium' })
        }
        onBuildYourself={() => navigate({ tab: 'workout', screen: 'template' })}
        onImportProgram={async (draft) => {
          const workoutTemplateId = await upsertWorkoutTemplate(draft);
          setSettingsImportVisible(false);
          navigate({ tab: 'workout', screen: 'program', programType: 'custom', workoutTemplateId });
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


