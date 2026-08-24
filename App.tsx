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
  buildFirstRunCustomProgramName,
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
  refreshHomeWidget,
  requestPinHomeWidget,
} from './modules/home-widget';
import { buildHomeWidgetPayload, findHomeWidgetNextSession, HomeWidgetTarget } from './src/lib/widgetPayload';
import { parseWidgetDeepLink } from './src/lib/widgetDeepLink';
import { planSetupHandoff } from './src/lib/setupHandoff';
import { SetupHandoffChoices, SetupHandoffScreen } from './src/screens/SetupHandoffScreen';
import { selectHomeCustomProgram } from './src/lib/homeProgramSelection';
import { selectHomePrimaryAction } from './src/lib/homePrimaryAction';
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
import { computePostSessionInsight, PostSessionInsight } from './src/lib/postSessionInsight';
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
import { recordCoachQuestion, resolveCoachQuota } from './src/lib/aiCoachQuota';
import { buildHomePlanProgress } from './src/lib/homePlanProgress';
import { buildHomeStatCardCatalog, buildHomeStatCards, resolveHomeStatCardKeys } from './src/lib/homeStatCards';
import {
  buildSessionEquipmentLabel,
  classifySessionFocus,
  getDefaultCooldown,
  getDefaultWarmup,
  getSessionBodyFocusLabel,
  getSessionFocusTitle,
  SessionFocusKind,
} from './src/lib/homeSessionHero';
import { estimateRoutineBlockSeconds } from './src/lib/guidedPlayer';
import { estimateSessionMinutes } from './src/lib/sessionDuration';
import { buildMuscleFocus, getTopSetLabel, getVolumeDeltaVsPrevious, MuscleFocusRow } from './src/lib/workoutCompleteView';
import { buildHomeQuickStats, buildHomeUpcomingSessions } from './src/lib/homeVisuals';
import { I18nKey, t } from './src/lib/i18n';
import { buildCoachModules } from './src/lib/aiCoachModules';
import { isProUnlocked, resolveProEntitlement, resolveProgressionOptions, resolveTrialProUntil } from './src/lib/proEntitlement';
import { isDemoBuild } from './src/lib/demoMode';
import { ThemeChoiceDialog } from './src/components/ThemeChoiceDialog';
import { buildCancelSurveyAnswer } from './src/lib/cancelSurvey';
import { MOCK_BILLING, nextChargeAt } from './src/lib/subscriptionView';
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
  ProgramSeason,
  getSeasonForDate,
  getSeasonProgramTitleKey,
  getSeasonProgramId,
  getSeasonProgramIds,
  orderSeasons,
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
import {
  computeSeasonProgress,
  countSeasonRecords,
  resolveSeasonBadges,
} from './src/lib/seasonScoring';
import { buildProgramCampaigns } from './src/lib/programCampaigns';
import { AFFINITY_REASON_KEYS, resolveProgramAffinity } from './src/lib/programAffinity';
import { suggestHomeStatCardKeys } from './src/lib/homeCardSuggestions';
import { isMeasurementCardKey } from './src/lib/homeStatCards';
import { resolveNextPlanEntryIndex } from './src/lib/planRotation';
import { cycleSchedule, weekdaySchedule } from './src/lib/trainingSchedule';
import {
  planWeekdayIndexes,
  resolveProgramTrainingDays,
  WEEKDAY_KEYS,
} from './src/lib/programTrainingDays';
import {
  planLabelsForProgramme,
  planLabelsFromWeekdays,
  weekdaysFromPlanLabels,
} from './src/lib/trainingWeekSync';
import { programCoverStyle } from './src/lib/programVisualIdentity';
import {
  countPlanSessionsInRange,
  countSessionsSince,
  resolveCompletionCard,
} from './src/lib/programCompletion';
import { resolveProgramEquipment } from './src/lib/programEquipment';
import { getTrendingEntries } from './src/lib/programTrendingDemo';
import { backfillRecommendations } from './src/lib/recommendationBackfill';
import { buildGoalPresetRows, STRENGTH_GOAL_PRESETS } from './src/lib/strengthGoalPresets';
import { describeGoalCoverage, GoalProgrammeSuggestionView, isSameLift, rankProgrammesForLift } from './src/lib/goalProgramme';
import { StrengthGoalPickerScreen } from './src/screens/StrengthGoalPickerScreen';
import {
  addSeasonEnrolment,
  daysUntil,
  isEnrolled,
  isJoinWindowOpen,
} from './src/lib/seasonEnrolment';
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
import { AiProgramComposerScreen } from './src/screens/AiProgramComposerScreen';
import { AboutYouScreen, AboutYouValues } from './src/screens/AboutYouScreen';
import { CreateTemplateScreen } from './src/screens/CreateTemplateScreen';
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
import { setNumberLanguage } from './src/lib/format';
import { buildPremiumHeroChart } from './src/lib/premiumHeroChart';
import { buildProChatHeroScript } from './src/lib/proChatHero';
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
import { DesignDemoScreen } from './src/screens/DesignDemoScreen';
import { FeatureRequestsScreen } from './src/screens/FeatureRequestsScreen';
import { AiTransparencyScreen } from './src/screens/AiTransparencyScreen';
import { LegalDocumentScreen } from './src/screens/LegalDocumentScreen';
import { ProOfferScreen } from './src/screens/ProOfferScreen';
import { AICoachChatScreen } from './src/screens/AICoachChatScreen';
import { buildCoachContextChips } from './src/lib/coachChat';
import { isAiCoachLiveConfigured, requestProgrammeComposition } from './src/lib/aiCoachClient';
import { buildProgrammeDraft, composeProgrammePreview, resolveLiveProposal } from './src/lib/programmeBrief';
import { ProgressScreen } from './src/screens/ProgressScreen';
import { ProgramDayScreen } from './src/screens/ProgramDayScreen';
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
import { isTimedTrackingMode, WorkoutRuntimeTemplate, WorkoutTemplateExercise } from './src/features/workout/workoutTypes';
import { AppProvider, useAppContext } from './src/state/AppProvider';
import {
  AppDatabase,
  AppLanguage,
  AppPreferences,
  ExerciseLibraryItem,
  ExerciseLog,
  ExerciseLogDraft,
  ExerciseTemplate,
  ExerciseTemplateDraft,
  SetupDaysPerWeek,
  SetupEquipment,
  SetupScheduleMode,
  SetupWeekday,
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
      topSetLabel: getTopSetLabel(exercise.sets, language, exercise.trackingMode),
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

function getBackRoute(route: AppRoute, workoutHome: AppRoute): AppRoute | null {
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
      route.screen === 'programDay' ||
      route.screen === 'template' ||
      route.screen === 'editor' ||
      route.screen === 'guided' ||
      route.screen === 'summary' ||
      route.screen === 'celebration')
  ) {
    return workoutHome;
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
    trainingCyclePattern: preferences.trainingCycle?.pattern ?? null,
    currentWeightKg: preferences.setupCurrentWeightKg,
    targetWeightKg: preferences.bodyweightGoalKg,
    unitPreference: preferences.unitPreference,
  };
}

/** Local midnight, the anchor a training cycle counts from. */
function localTodayStart(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

function buildSetupPreferencePatch(
  selection: FirstRunSetupSelection,
  recommendedProgramId: string | null,
  // The cycle already in preferences, so an unchanged pattern keeps its
  // anchor: re-anchoring "2 on, 1 off" to today would silently shift which
  // day of the rhythm today is for a reader who only re-ran the questions.
  previousCycle: AppPreferences['trainingCycle'] = null,
): Partial<AppPreferences> {
  const cyclePattern = selection.trainingCyclePattern ?? null;
  return {
    trainingCycle: cyclePattern
      ? previousCycle && previousCycle.pattern.join(',') === cyclePattern.join(',')
        ? previousCycle
        : { pattern: cyclePattern, anchorDayStart: localTodayStart() }
      : null,
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
    saveOnboardingResult,
    deleteWorkoutTemplate,
    resetAllData,
    addBodyweightEntry,
    addMeasurementEntry,
    saveCompletedWorkoutSession,
    updateCompletedWorkoutSession,
    deleteCompletedWorkoutSession,
    saveCardioSession,
  } = useAppContext();
  const workout = useWorkoutContext();

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
  /** The theme offer that follows a purchase — see the unlock screen's onDone. */
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
  /**
   * The Pro page's hero conversation, from this reader's own log.
   *
   * buildPremiumHeroChart came back for this: v3 had no chart and nothing
   * called it, v4 needs the same series to say which lift the coach is talking
   * about and what it has been doing. Null here is not a failure — the script
   * falls back to sample figures and labels itself as one.
   */
  const premiumHeroChart = useMemo(
    () => buildPremiumHeroChart(trackedProgress, unitPreference, preferences.appLanguage),
    [preferences.appLanguage, trackedProgress, unitPreference],
  );
  const premiumChatScript = useMemo(
    () =>
      buildProChatHeroScript(
        premiumHeroChart,
        unitPreference,
        preferences.setupDaysPerWeek,
        t(preferences.appLanguage, 'pro.v4.example.lift'),
      ),
    [premiumHeroChart, preferences.appLanguage, preferences.setupDaysPerWeek, unitPreference],
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

  navigateToActiveWorkoutRef.current = () => navigateToActiveWorkout();
  finishFromNotificationRef.current = () => {
    // "Finish workout" from the lock screen opens the session; ending it is a
    // confirmed step on that screen, not a silent write from a notification.
    navigateToActiveWorkout();
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
  async function handleAdoptReadyProgram(workoutTemplateId: string, options?: { lead?: boolean }) {
    const template = getWorkoutTemplateById(workoutTemplateId);
    if (!template) {
      return;
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
      return;
    }

    const planId = buildReadyProgramPlanId(workoutTemplateId);
    const decision = evaluateProgramAdoption({
      activePlanIds: preferences.activePlanIds,
      targetPlanId: planId,
      proUnlocked: resolveProEntitlement(preferences).unlocked,
    });

    if (decision.kind === 'already_active') {
      return;
    }

    if (decision.kind === 'blocked') {
      // Full on the free tier is a sale; full on Pro is not, and sending a
      // paying reader to the paywall would be selling them what they own.
      if (decision.canUpgrade) {
        navigate({ tab: 'profile', screen: 'premium', reason: 'program_cap' });
        return;
      }
      showToast(t(preferences.appLanguage, 'programs.cap.full', { cap: decision.cap }));
      return;
    }

    // The programme's own week leads. This read availability alone and fell
    // back to a three-day default, and the plan then dealt sessions round-robin
    // across whatever labels it got — so a six-session programme ran on three
    // days, twice over, and every programme became a three-day programme.
    const dayLabels = planLabelsForProgramme(
      template.sessions.length,
      preferences.setupAvailableDays,
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
    showToast(t(preferences.appLanguage, 'season.joined', { program: plan.name }));
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
   * Demo build only (the Settings row that calls this is behind isDemoBuild).
   *
   * One real session in a one-week block: logging it once genuinely reaches
   * 1/1, so the completion card can be walked on a device without faking a
   * single number. The plan id prefix is what makes the block one week —
   * see the demo_plan_ branch where Home counts the plan's weeks.
   */
  const DEMO_PROGRAM_NAME = 'Demo: yksi treeni';

  async function handleCreateDemoCompletionProgram() {
    const now = new Date().toISOString();
    // Idempotent on purpose. Pressing this twice used to author a second
    // template and then, at the free cap, `upsertWorkoutTemplate` threw
    // ProgramLimitReachedError — which nothing caught, so the row did nothing
    // and said nothing. A demo tool must be repeatable: an existing demo
    // programme is reused and its plan rebuilt, which also repairs the
    // entry-less plans the earlier build wrote.
    const existing = workoutTemplates.find((item) => item.name === DEMO_PROGRAM_NAME) ?? null;
    if (existing) {
      const sessions = getWorkoutTemplateSessions(existing.id);
      const planId = `demo_plan_${existing.id}`;
      await upsertWorkoutPlan({
        id: planId,
        name: DEMO_PROGRAM_NAME,
        mode: 'rotation',
        entries: sessions.map((session, index) => ({
          id: `${planId}_entry_${index + 1}`,
          workoutTemplateId: existing.id,
          workoutTemplateSessionId: session.id,
          label: `Day ${index + 1}`,
          orderIndex: index,
        })),
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      await updatePreferences({
        activePlanIds: addActiveProgram(preferences.activePlanIds, planId),
        activePlanId: planId,
        // A rebuilt round is a new block, so an answered completion card for
        // this plan must not keep the new one hidden.
        dismissedCompletionPlanIds: preferences.dismissedCompletionPlanIds.filter((id) => id !== planId),
      });
      resetToRoute(ROOT_ROUTES.home);
      return;
    }

    // The session id is minted here rather than read back after the write:
    // getWorkoutTemplateSessions reads the React `database` state, which is
    // still the pre-write copy inside this handler, so the read returned []
    // and the plan was created with no entries at all. Home skips an
    // entry-less plan, which is why pressing this button appeared to do
    // nothing.
    const demoSessionId = createId('template_session');
    const templateId = await upsertWorkoutTemplate({
      name: DEMO_PROGRAM_NAME,
      sessions: [
        {
          id: demoSessionId,
          name: 'Day 1: Full Body',
          exercises: [
            { name: 'Goblet Squat', targetSets: 2, repMin: 8, repMax: 10, restSeconds: 60, trackedDefault: true, libraryItemId: null },
            { name: 'Push-Up', targetSets: 2, repMin: 8, repMax: 12, restSeconds: 60, trackedDefault: true, libraryItemId: null },
          ],
        },
      ],
    });
    const planId = `demo_plan_${templateId}`;
    await upsertWorkoutPlan({
      id: planId,
      name: DEMO_PROGRAM_NAME,
      mode: 'rotation',
      entries: [
        {
          id: `${planId}_entry_1`,
          workoutTemplateId: templateId,
          workoutTemplateSessionId: demoSessionId,
          label: 'Day 1',
          orderIndex: 0,
        },
      ],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    await updatePreferences({
      activePlanIds: addActiveProgram(preferences.activePlanIds, planId),
      activePlanId: planId,
    });
    resetToRoute(ROOT_ROUTES.home);
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
    const entries = ordered.map((entry, index) => ({ ...entry, label: WEEKDAY_KEYS[dayIndexes[index]] }));
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
    await upsertWorkoutPlan({
      ...plan,
      entries: ordered.map((entry, index) => ({ ...entry, label: labels[index] })),
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
    const template = workoutTemplates.find((item) => item.id === workoutTemplateId);
    if (!template) {
      return;
    }
    const setsByExerciseId = new Map(updates.map((update) => [update.exerciseId, update.sets]));
    await upsertWorkoutTemplate({
      id: template.id,
      name: template.name,
      sessions: getWorkoutTemplateSessions(template.id).map((session) => ({
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
    });
    showToast(t(preferences.appLanguage, 'toast.emphasisSaved'));
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
    showToast(t(preferences.appLanguage, 'home.complete.restarted'));
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
    return preferences.activePlanIds
      .map((planId) => byId.get(planId)?.entries[0]?.workoutTemplateId ?? null)
      .filter((id): id is string => Boolean(id));
  }, [database.workoutPlans, preferences.activePlanIds]);

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
    showToast(t(preferences.appLanguage, 'season.joined', { program: plan.name }));
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
    const template = workoutTemplates.find((item) => item.id === templateId);
    if (!template) {
      return;
    }

    await upsertWorkoutTemplate({
      id: template.id,
      name: template.name,
      sessions: getWorkoutTemplateSessions(template.id).map((session) => ({
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
    });
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
    const dayLabels = planLabelsForProgramme(sessionIds.length, preferences.setupAvailableDays);

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
    showToast(t(preferences.appLanguage, 'season.joined', { program: plan.name }));
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
      preferences.appLanguage,
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
      preferences.appLanguage,
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
    showToast(
      t(
        preferences.appLanguage,
        nextMode === 'app_managed' ? 'toast.scheduleAppManaged' : 'toast.scheduleSelfManaged',
      ),
    );
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
    showToast(t(preferences.appLanguage, 'toast.setupUpdated'));
    resetToRoute(ROOT_ROUTES.home);
  }

  async function handleSetupOpenProgramDetail(selection: FirstRunSetupSelection, recommendedProgramId: string) {
    await persistSetupSelection(selection, recommendedProgramId);
    showToast(t(preferences.appLanguage, 'toast.setupUpdated'));
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
  // The AI composer is Pro (the Pro page table says so, so it must be true).
  // Every entry into it already gates, but the route itself must too — a
  // stale history entry or an entitlement that lapsed while the screen was
  // open would otherwise leave a free reader on a screen they cannot use.
  useEffect(() => {
    if (route.tab === 'home' && route.screen === 'ai_setup' && !coachProUnlocked) {
      navigate({ tab: 'profile', screen: 'premium' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coachProUnlocked, route]);
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
    (focus: SessionFocusKind) => ({
      warmupSeconds: estimateRoutineBlockSeconds(
        getDefaultWarmup(focus, preferences.appLanguage, availableEquipmentForDrills),
      ),
      cooldownSeconds: estimateRoutineBlockSeconds(
        getDefaultCooldown(focus, preferences.appLanguage, availableEquipmentForDrills),
      ),
    }),
    [preferences.appLanguage, availableEquipmentForDrills],
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
          trim: previewSessionTrim(durationInputs, routineSeconds),
          focusKind,
          exercises: session.exercises.slice(0, 5).map((exercise) => ({
            name: exercise.name,
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
          hiddenExerciseCount: Math.max(exerciseCount - 5, 0),
        };
      });
      // Was `homeSessions[0]`, always. Finishing day 1 offered day 1 again,
      // and the start button logged the wrong session against the plan.
      const nextSessionIndex = resolveNextPlanEntryIndex(sortedEntries, completedPlanSessions);
      // The reader's own answer wins for the day they gave it. The rotation
      // knows what comes next in the programme and cannot know that today is
      // legs — but it is right again tomorrow, so the override is dated rather
      // than sticky, and a stale one is ignored instead of cleared.
      const pickedToday =
        preferences.todaySession && preferences.todaySession.dayStart === todayDayStart
          ? homeSessions.find((session) => session.id === preferences.todaySession?.sessionId) ?? null
          : null;
      // A pick answers "what am I doing today", and once it is done the question
      // has changed. Left standing it offered the finished workout again —
      // reported straight after the first real session run through the picker,
      // with the counter already reading 1/48 behind it.
      const pickedDone =
        pickedToday !== null &&
        completedPlanSessions.some(
          (entry) =>
            entry.workoutTemplateSessionId === pickedToday.id &&
            toDayStartMs(entry.performedAt) === todayDayStart,
        );
      const nextSession =
        (pickedDone ? null : pickedToday) ?? homeSessions[nextSessionIndex] ?? homeSessions[0] ?? null;
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
  }, [database.workoutSessions, database.exerciseLogs, homeSummary.streak.currentWeekStreak]);
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
          })
        : null,
    [homePinnedStatCardKeys, homeWidgetState, preferences.setupFocusAreas, setupHandoffReady],
  );
  const setupHandoffActive = setupHandoffPlan?.shouldShow ?? false;

  // Nothing left to offer — a reader running onboarding a second time. Close the
  // door rather than leave it to open on some later launch.
  useEffect(() => {
    if (setupHandoffReady && setupHandoffPlan && !setupHandoffPlan.shouldShow) {
      void updatePreferences({ setupHandoffCompleted: true });
    }
  }, [setupHandoffPlan, setupHandoffReady, updatePreferences]);

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
      resetToRoute({ tab: 'progress', screen: 'calendar' });
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

    const next = findHomeWidgetNextSession({
      nowMs: Date.now(),
      schedule: homeTrainingSchedule,
      sessions: homeActivePlanCard?.sessions ?? [],
      completedWorkoutDayStarts: widgetCompletedWorkoutDayStarts,
    });
    // No session to open any more — the plan changed while the widget was
    // showing the old one. Home is the honest landing, not an empty screen.
    if (!next || !homeActivePlanCard) {
      resetToRoute(ROOT_ROUTES.home);
      return;
    }
    resetToRoute({
      tab: 'workout',
      screen: 'programDay',
      programType: homeActivePlanCard.programType,
      workoutTemplateId: homeActivePlanCard.programId,
      sessionId: next.session.id,
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
            cover: programCoverStyle(template.id, template.name),
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
  /**
   * "Sinulle" — two cards, and neither of them is something you already run.
   *
   * The questionnaire's two picks are the starting point, but adopting one
   * used to leave it in the row, so the tab kept recommending a programme the
   * reader was already training. A taken programme drops out and the gap is
   * filled from the catalog, measured from what is being trained NOW — see
   * lib/recommendationBackfill. The first reason the ranker reaches for is
   * "same goal, one level up", so the replacement is usually a step harder.
   */
  const programsRecommendations = useMemo(
    () => {
      const byId = new Map(workout.templates.map((template) => [template.id, template]));
      const waterfall = setupRecommendation?.waterfall;
      const anchor = homeActivePlanCard?.programId ? byId.get(homeActivePlanCard.programId) ?? null : null;
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
        // Without a questionnaire there are no picks at all and the whole row
        // is neighbours of the active programme, which is worth four cards.
        limit: waterfall ? 2 : 4,
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
        // These tiles sit under a year heading, so the range only spells a year
        // out when the season crosses into the next one.
        rangeLabel: formatSeasonDateRange(window, preferences.appLanguage, 'whenSpanning'),
        startLabel: label(window.start),
        weeksLeft: isCurrent ? seasonWeeksLeft(window, now) : SEASON_WEEKS,
        progress: isCurrent ? seasonProgressRatio(window, now) : 0,
        daysUntilStart: isCurrent
          ? 0
          : Math.max(0, Math.ceil((window.start.getTime() - now.getTime()) / 86_400_000)),
        // The card names the season's ONE program rather than counting ten.
        // A count was the right label when a season was a filter; it is the
        // wrong one now that the season is a thing you join.
        programName: (() => {
          const templateId = getSeasonProgramId(window.season);
          // The name the season's programme goes by, not its catalogue id:
          // this card said "RUN" under a card headed "Kesäkausi", while the
          // season screen one tap away called the same programme "Kesäkunto".
          const titleKey = getSeasonProgramTitleKey(templateId);
          if (titleKey) {
            return t(preferences.appLanguage, titleKey);
          }
          const template = workout.templates.find((entry) => entry.id === templateId);
          return template ? formatWorkoutDisplayLabel(template.name) : '';
        })(),
        programDays: workout.templates.find((entry) => entry.id === getSeasonProgramId(window.season))?.daysPerWeek ?? 0,
        current: isCurrent,
        enrolled: isEnrolled(preferences.seasonEnrolments, window.season, window.year),
        gradient: SEASON_COLORS[window.season],
      });
      // The running season, and the next one only once sign-ups are open. A
      // card counting down 148 days is a date nobody can act on, and when a
      // season closes the calendar has already moved the other one into
      // `current` — so the row swaps over on its own, both here and on Home.
      const cards = [build(current, true)];
      if (isJoinWindowOpen(daysUntil(next.start, now))) {
        cards.push(build(next, false));
      }
      return cards;
    },
    [preferences.appLanguage, preferences.seasonEnrolments, workout.templates],
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

  const programsCampaigns = useMemo(
    () =>
      buildProgramCampaigns({
        season: getSeasonForDate(),
        seasonWeeks: SEASON_WEEKS,
        strengthCount: programsCategoryCounts.strength ?? 0,
        exerciseCount: exerciseBrowserItems.length,
      }),
    [exerciseBrowserItems.length, programsCategoryCounts, programsSeasonTileCounts],
  );
  const libraryNames = useMemo(() => exerciseLibrary.map((item) => item.name), [exerciseLibrary]);

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
   * The ready-made targets, with the reader's own bests folded in.
   *
   * Every preset is always offered — unlike the old sheet, which could only
   * list lifts already logged and therefore showed nothing at all to the one
   * person a first target would help.
   */
  const goalPresetRows = useMemo(
    () =>
      buildGoalPresetRows(
        new Map(trackedProgress.map((summary) => [summary.name, summary.bestWeight ?? null])),
        preferences.strengthGoals,
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
    const activeIsAuthored = authored.some((item) => item.active);
    if (!homeActivePlanCard || activeIsAuthored) {
      return authored;
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
          onStartProTrial={handleOnboardingStartProTrial}
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
        onSkip={() => void handleSetupHandoffDone({ addWidget: false, pinTrackingCard: false, pinBodyweightCard: false })}
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
      // Membership is asked of the template, not the plan id — a programme
      // joined during onboarding carries a different plan id for the same
      // programme, and it is no less the reader's own.
      const programIsMine = activeProgramTemplateIds.includes(route.workoutTemplateId);
      // Held is not the same as leading. A programme you hold but do not lead
      // with has a third answer — put it on Home — and without it the only way
      // there was to remove whatever was leading.
      const programLeads = homeActivePlanCard?.programId === route.workoutTemplateId;
      const readyProgramIsMine = route.programType === 'ready' && programLeads;
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
            readyProgramIsMine,
            programIsMine && !programLeads,
          )
      : customTemplate
        ? buildCustomProgramDetail(
            customTemplate,
            programInsightsByTemplateId[route.workoutTemplateId],
            preferences.appLanguage,
            programIsMine && programLeads,
            programIsMine && !programLeads,
          )
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
        onBack={() => navigateBack(workoutHomeRoute)}
        onPrimaryAction={() => {
          if (readyProgramIsMine) {
            // Already the reader's. Adoption returns early for a programme it
            // already holds, so this button used to read like a decision and do
            // nothing but navigate Home. It now starts the session the rotation
            // actually offers next — the label says so.
            const nextSessionId = resolveNextSessionIdForTemplate(route.workoutTemplateId);
            if (nextSessionId) {
              handleStartReadyProgramSession(route.workoutTemplateId, nextSessionId);
              return;
            }
            navigate(ROOT_ROUTES.home);
            return;
          }

          if (route.programType === 'ready') {
            // The button says "Ota ohjelma käyttöön" and it now does that. It
            // called handleStartReadyProgram, which starts the first SESSION
            // and never touches the active plan — so a reader who pressed it
            // trained one workout and then found Home still running whatever
            // it ran before. handleAdoptReadyProgram existed the whole time
            // and was wired only to the season screen.
            void handleAdoptReadyProgram(route.workoutTemplateId, { lead: true });
            navigate(ROOT_ROUTES.home);
            return;
          }

          if (!customTemplate?.sessions.some((session) => session.exercises.length > 0)) {
            navigate({ tab: 'workout', screen: 'template', workoutTemplateId: route.workoutTemplateId });
            return;
          }

          // Already running it: start what the rotation offers next, the same
          // answer a ready programme gives. Otherwise put it on Home, which is
          // what the button now says and what it could not previously do.
          if (programLeads) {
            handleStartCustomProgram(route.workoutTemplateId);
            return;
          }

          // Held but not leading, or not held at all — both are answered by
          // adoption, which now promotes rather than returning early.
          void handleAdoptCustomProgram(route.workoutTemplateId, { lead: true });
          navigate(ROOT_ROUTES.home);
        }}
        onStartSession={(sessionId) => {
          if (route.programType === 'ready') {
            handleStartReadyProgramSession(route.workoutTemplateId, sessionId);
            return;
          }

          handleStartCustomProgramSession(route.workoutTemplateId, sessionId);
        }}
        // Every ready programme, not only the one being run: wanting a
        // programme changed is the buying moment, and it happens while
        // browsing as often as while training. The cap check and the paywall
        // live in the handler.
        onCopyToCustom={
          route.programType === 'ready'
            ? () => handleCopyReadyProgramToCustom(route.workoutTemplateId)
            : undefined
        }
        programBlockWeeks={readyTemplate ? getReadyProgramBlockWeeks(readyTemplate) : null}
        trainingDayIndexes={planWeekdayIndexes(
          database.workoutPlans.find((plan) => plan.entries[0]?.workoutTemplateId === route.workoutTemplateId)
            ?.entries ?? [],
        )}
        onSaveRhythm={
          database.workoutPlans.some((plan) => plan.entries[0]?.workoutTemplateId === route.workoutTemplateId)
            ? (dayIndexes) => void handleSaveRhythm(route.workoutTemplateId, dayIndexes)
            : undefined
        }
        onSaveEmphasis={
          route.programType === 'custom'
            ? (updates) => void handleSaveEmphasis(route.workoutTemplateId, updates)
            : undefined
        }
        onOpenSession={(sessionId) =>
          navigate({
            tab: 'workout',
            screen: 'programDay',
            programType: route.programType,
            workoutTemplateId: route.workoutTemplateId,
            sessionId,
          })
        }
        onEdit={route.programType === 'custom' ? () => navigate({ tab: 'workout', screen: 'template', workoutTemplateId: route.workoutTemplateId }) : undefined}
        destructiveActionLabel={
          route.programType === 'custom' ? t(preferences.appLanguage, 'detail.delete') : undefined
        }
        destructiveActionTitle={
          route.programType === 'custom' ? t(preferences.appLanguage, 'detail.delete.title') : undefined
        }
        destructiveActionMessage={
          route.programType === 'custom'
            ? t(preferences.appLanguage, 'detail.delete.message', { program: program.title })
            : undefined
        }
        onDestructiveAction={route.programType === 'custom' ? () => void handleDeleteCustomWorkout(route.workoutTemplateId) : undefined}
      />
    ) : (
      <View />
    );
  } else if (route.tab === 'workout' && route.screen === 'programDay') {
    const readyTemplate = route.programType === 'ready' ? getWorkoutTemplateById(route.workoutTemplateId) : null;
    const customTemplate = route.programType === 'custom' ? customWorkoutRuntimeMap[route.workoutTemplateId] ?? null : null;
    const program = readyTemplate
      ? buildReadyProgramDetail(
          readyTemplate,
          programInsightsByTemplateId[route.workoutTemplateId],
          null,
          [],
          preferences.recommendedProgramId === route.workoutTemplateId && setupSelection
            ? composeProgramWeekForSelection(setupSelection, route.workoutTemplateId)
            : null,
          preferences.appLanguage,
        )
      : customTemplate
        ? buildCustomProgramDetail(customTemplate, programInsightsByTemplateId[route.workoutTemplateId], preferences.appLanguage)
        : null;
    const daySession = program?.sessions.find((session) => session.id === route.sessionId) ?? null;
    const dayIndex = daySession ? program!.sessions.findIndex((session) => session.id === route.sessionId) : -1;

    content = program && daySession ? (
      <ProgramDayScreen
        language={preferences.appLanguage}
        programTitle={program.title}
        templateId={route.workoutTemplateId}
        session={daySession}
        dayNumber={dayIndex + 1}
        dayCount={program.sessions.length}
        availableEquipment={availableEquipmentForDrills}
        sessionSwaps={sessionSwaps}
        onSwapExercise={(slotId, exerciseName) =>
          setSessionSwaps((current) => ({ ...current, [slotId]: exerciseName }))
        }
        onAddExercise={
          route.programType === 'custom'
            ? () => navigate({ tab: 'workout', screen: 'template', workoutTemplateId: route.workoutTemplateId })
            : undefined
        }
        onCopyToCustom={
          route.programType === 'ready'
            ? () => handleCopyReadyProgramToCustom(route.workoutTemplateId)
            : undefined
        }
        tailoringPreferences={preferences}
        onBack={() => navigateBack({ tab: 'workout', screen: 'program', programType: route.programType, workoutTemplateId: route.workoutTemplateId })}
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
        onBack={() => navigateBack(workoutHomeRoute)}
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
        restAlerts={{
          alerts: preferences.notificationPrefs.restAlerts,
          warning: preferences.notificationPrefs.restWarning,
          ongoing: preferences.notificationPrefs.sessionOngoing,
          asked: preferences.notificationPrefs.restAlertsAsked,
        }}
        onRestAlertsAsked={() =>
          void updatePreferences({
            notificationPrefs: { ...preferences.notificationPrefs, restAlertsAsked: true },
          })
        }
        onOpenSystemSettings={() => void Linking.openSettings()}
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
        onBack={() => navigateBack(workoutHomeRoute)}
        onUseTemplate={() => navigate(workoutHomeRoute)}
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
        restAlerts={{
          alerts: preferences.notificationPrefs.restAlerts,
          warning: preferences.notificationPrefs.restWarning,
          ongoing: preferences.notificationPrefs.sessionOngoing,
        }}
      />
    );
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
          // Every lift with its heaviest set, so the day card can answer
          // without the session being opened (user 2026-08-23).
          const lifts = logs.map((log) => {
            const sets = getComparableLogSets(log);
            let best: { weight: number; reps: number } | null = null;
            for (const set of sets) {
              if (
                best === null ||
                set.weight > best.weight ||
                (set.weight === best.weight && set.reps > best.reps)
              ) {
                best = set;
              }
            }
            return {
              name: exerciseNameLabel(preferences.appLanguage, log.exerciseNameSnapshot),
              sets: sets.length,
              top: best
                ? best.weight > 0
                  ? `${removeTrailingZeros(best.weight)} kg × ${best.reps}`
                  : t(preferences.appLanguage, 'cal.liftReps', { reps: best.reps })
                : null,
            };
          });
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
            lifts,
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
        initialMeasure={route.screen === 'list' ? route.measure : undefined}
        showBodyweightDetail={route.screen === 'bodyweight'}
        onAddBodyweight={async (weightKg) => {
          await addBodyweightEntry(weightKg);
          showToast(t(preferences.appLanguage, 'toast.bodyweightSaved'));
        }}
        // The same height the questionnaire asks for and the profile stores —
        // the BMI card edits that field rather than keeping a second copy.
        heightCm={preferences.setupHeightCm}
        onSaveHeight={(nextHeightCm) => void updatePreferences({ setupHeightCm: nextHeightCm })}
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
    // "AI assisted", rebuilt as one text field (feedback round 2, #3). Live
    // when a coach server is configured, the deterministic composer
    // otherwise — the same proposal shape either way, and every exercise in
    // it a library exercise. Saving makes a programme of the reader's own,
    // which the free-tier cap counts like any other.
    content = (
      <AiProgramComposerScreen
        language={preferences.appLanguage}
        preferences={preferences}
        liveConfigured={isAiCoachLiveConfigured()}
        onBack={() => navigateBack(ROOT_ROUTES.home)}
        compose={async (brief) => {
          const live = await requestProgrammeComposition({
            brief,
            context: aiCoachTrainingContext,
            language: preferences.appLanguage,
          });
          if (live) {
            return resolveLiveProposal(live, brief, exerciseLibrary, preferences.defaultRestSeconds);
          }
          return composeProgrammePreview(brief, preferences, exerciseLibrary);
        }}
        onSave={async (proposal) => {
          if (!programSlots.canCreate) {
            setProgramLimitVisible(true);
            return;
          }
          const draft = buildProgrammeDraft(
            proposal,
            workoutTemplates.map((item) => item.name),
          );
          try {
            const workoutTemplateId = await upsertWorkoutTemplate(draft);
            showToast(t(preferences.appLanguage, 'toast.aiProgrammeSaved'));
            navigate({ tab: 'workout', screen: 'program', programType: 'custom', workoutTemplateId });
          } catch (error) {
            if (error instanceof ProgramLimitReachedError) {
              setProgramLimitVisible(true);
              return;
            }
            console.error('Failed to save composed programme', error);
            showToast(t(preferences.appLanguage, 'toast.aiBuildFailed'));
          }
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
        onDeleteSession={(sessionId) => void deleteCompletedWorkoutSession(sessionId)}
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
        onAskAiCoach={() => {
          // The coach answers in Finnish; the question it was handed was an
          // English literal, and the chat shows it as the reader's own message.
          const askProgramName = currentFitReadyTemplate?.name ?? recommendedReadyTemplate?.name;
          navigate({
            tab: 'home',
            screen: 'ai',
            prompt: askProgramName
              ? t(preferences.appLanguage, 'plan.askFit', {
                  program: formatWorkoutDisplayLabel(askProgramName),
                })
              : t(preferences.appLanguage, 'plan.askFitGeneric'),
          });
        }}
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
        reason={route.reason ?? null}
        language={preferences.appLanguage}
        previewUnlocked={preferences.adaptiveCoachPremiumUnlocked}
        proUnlocked={coachProUnlocked}
        chatScript={premiumChatScript}
        onManageSubscription={() => navigate({ tab: 'profile', screen: 'subscription' })}
        onBack={() => navigateBack(ROOT_ROUTES.profile)}
        onTogglePreview={(plan) => {
          // The CTA sells a subscription the app cannot take money for (demo
          // build). What it actually does is flip the preview switch — and if
          // that turns Pro ON, the unlock moment follows, which is the point.
          const turningOn = !preferences.adaptiveCoachPremiumUnlocked;
          void updatePreferences({
            adaptiveCoachPremiumUnlocked: turningOn,
            // The purchase instant and the chosen term, stored together. Every
            // renewal date in the app is counted from these rather than written
            // — the requirement #bugs locked after the receipt shipped a
            // hardcoded "15.9.2026". Billing replaces this one write.
            ...(turningOn
              ? { mockSubscriptionPurchasedAt: new Date().toISOString(), mockSubscriptionTerm: plan }
              : {}),
          });
          if (turningOn) {
            navigate({ tab: 'profile', screen: 'premium_unlock', plan });
          }
        }}
        onOpenLegal={(document) => navigate({ tab: 'profile', screen: 'legal', document })}
      />
    );
  } else if (route.tab === 'profile' && route.screen === 'premium_unlock') {
    content = (
      <PremiumUnlockScreen
        language={preferences.appLanguage}
        plan={route.plan}
        // The reads just unlocked; this is the first one, from their own log.
        coachSpecimen={proCoachSpecimen}
        onOpenAnalysis={() => navigate({ tab: 'progress', screen: 'list' })}
        onManageSubscription={() => navigate({ tab: 'profile', screen: 'subscription' })}
        // Counted here, from the instant the purchase was recorded plus the
        // term's own length. One function, shared with the subscription screen.
        renewsAt={nextChargeAt(
          route.plan ?? preferences.mockSubscriptionTerm,
          preferences.mockSubscriptionPurchasedAt ?? MOCK_BILLING.lastChargedAt,
        )}
        // "Takaisin treeniin" goes to Home, not back to the tab the purchase
        // happened to start from. The route lives under `profile` because the
        // paywall does, but the button names a destination and the reader takes
        // it literally: Home is where training starts.
        //
        // On the way, the theme offer. The unlock screen lists the dark theme
        // as one of the six things that just changed, and without this the
        // reader has to go and find it three rows into Settings — a perk you
        // have to hunt for reads as one you did not really get.
        onDone={() => setThemeChoiceVisible(true)}
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
        trainingCycle={preferences.trainingCycle}
        exerciseLibrary={exerciseBrowserItems}
        onBack={() => navigateBack(ROOT_ROUTES.profile)}
        onOpenPlanSettings={handleOpenPlanSettings}
        onChangeTrainingDays={(days) => void handleChangeTrainingDays(days)}
        onChangeTrainingCycle={(cycle) => void updatePreferences({ trainingCycle: cycle })}
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
        entitlement={proEntitlement}
        // Only an *expired* promo means "lapsed". A live one is active Pro and
        // resolveSubscriptionView reads it from the entitlement instead.
        lapsedPromoUntil={proEntitlement.unlocked ? null : preferences.promoProUntil}
        mockTerm={preferences.mockSubscriptionTerm}
        mockCancelled={preferences.mockSubscriptionCancelled}
        purchasedAt={preferences.mockSubscriptionPurchasedAt}
        onChangeMockTerm={(term) => void updatePreferences({ mockSubscriptionTerm: term })}
        onChangeMockCancelled={(cancelled) =>
          void updatePreferences({ mockSubscriptionCancelled: cancelled })
        }
        demoBuild={isDemoBuild()}
        onBack={() => navigateBack({ tab: 'profile', screen: 'settings' })}
        onManageMembership={() => navigate({ tab: 'profile', screen: 'membership_end' })}
        onOpenPremium={() => navigate({ tab: 'profile', screen: 'premium' })}
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
        periodEndsAt={nextChargeAt(preferences.mockSubscriptionTerm, MOCK_BILLING.lastChargedAt)}
        onBack={() => navigateBack({ tab: 'profile', screen: 'subscription' })}
        onKeep={() => navigateBack({ tab: 'profile', screen: 'subscription' })}
        // Cancelling leaves Pro switched ON until the period ends — that is what
        // the page promises two lines above the button, so ending it on the spot
        // would contradict the screen the reader is standing on.
        onEndNow={() => void updatePreferences({ mockSubscriptionCancelled: true })}
        onSurveyDone={(reasons, note) => {
          const answer = buildCancelSurveyAnswer(reasons, note, new Date().toISOString());
          if (answer) {
            void updatePreferences({ cancelSurveyAnswer: answer });
          }
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
  } else if (route.tab === 'profile' && route.screen === 'design_demo') {
    content = (
      <DesignDemoScreen
        language={preferences.appLanguage}
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
        onCreateDemoProgram={() => {
          // upsertWorkoutTemplate THROWS at the program cap. Without this the
          // row was a button that did nothing and said nothing.
          handleCreateDemoCompletionProgram().catch((error) => {
            if (error instanceof ProgramLimitReachedError) {
              setProgramLimitVisible(true);
              return;
            }
            console.error('Demo program failed', error);
            showToast(t(preferences.appLanguage, 'toast.programCopyFailed'));
          });
        }}
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
        onOpenPremium={() => navigate({ tab: 'profile', screen: 'premium' })}
        onOpenSupport={() => navigate({ tab: 'profile', screen: 'support' })}
        onOpenFeatures={() => navigate({ tab: 'profile', screen: 'features' })}
        onOpenDesignDemo={() => navigate({ tab: 'profile', screen: 'design_demo' })}
        onOpenAiInfo={() => navigate({ tab: 'profile', screen: 'ai_transparency' })}
        onOpenLegal={(document) => navigate({ tab: 'profile', screen: 'legal', document })}
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
        onEditProfile={() => navigate({ tab: 'profile', screen: 'edit_profile' })}
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
  } else if (route.tab === 'workout' && route.screen === 'goalPicker') {
    content = (
      <StrengthGoalPickerScreen
        language={preferences.appLanguage}
        rows={goalPresetRows}
        unitLabel={preferences.unitPreference}
        suggestions={goalProgrammeSuggestions}
        // Stays on the picker: the panel flips to "your current programme
        // trains this" by itself once the adoption lands, and a blocked
        // adoption (cap) routes to the paywall on its own.
        onAdoptProgramme={(templateId) => void handleAdoptReadyProgram(templateId, { lead: true })}
        onOpenProgramme={(templateId) =>
          navigate({ tab: 'workout', screen: 'program', programType: 'ready', workoutTemplateId: templateId })
        }
        onBuildOwn={() =>
          programSlots.canCreate
            ? navigate({ tab: 'workout', screen: 'template' })
            : setProgramLimitVisible(true)
        }
        onBack={() => navigateBack(ROOT_ROUTES.workout)}
        onPick={(exerciseName, targetKg) =>
          void updatePreferences({
            strengthGoals: upsertStrengthGoal(preferences.strengthGoals, {
              exerciseName,
              targetKg,
              createdAt: new Date().toISOString(),
            }),
          })
        }
        onClear={(exerciseName) =>
          void updatePreferences({
            strengthGoals: removeStrengthGoal(preferences.strengthGoals, exerciseName),
          })
        }
      />
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
        // "Start season" used to open the season programme's page and stop
        // there, so the button's own sentence was never true and the season
        // could not be joined at all. It joins now, and joining ADDS: the
        // reader's own programme stays exactly where it was.
        running={activeProgramTemplateIds.includes(seasonProgramId)}
        onJoinSeason={() => {
          // Two things, and they are genuinely two: the row that says you are
          // in the season, and the programme swap that makes it trainable.
          const window = resolveSeasonWindow();
          handleEnrolSeason(window.season, window.year);
          void handleAdoptReadyProgram(seasonProgramId);
        }}
        onBack={() => navigateBack({ tab: 'workout', screen: 'programs_home' })}
        onOpenProgram={handleOpenReadyProgramDetail}
        onStartToday={() => {
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
        seasonCards={programsSeasonCards}
        onOpenSeason={(season) => navigate({ tab: 'workout', screen: 'season', season })}
        goals={programsGoals}
        goalProgrammes={goalProgrammeSuggestions}
        onOpenGoalPicker={() => navigate({ tab: 'workout', screen: 'goalPicker' })}
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
    /**
     * Named, not a catch-all.
     *
     * This was `route.tab === 'workout'` with no screen check, which made the
     * exercise browser the silent destination for *any* workout route that
     * matched nothing above it — including a real one mid-transition. That is
     * how the summary dismissal came out as a flash of the browser rather than
     * as a visible routing bug: the fallback swallowed it and looked plausible.
     *
     * `list` is ROOT_ROUTES.workout, so this is still someone's real
     * destination. Anything else now falls to the Home branch at the end,
     * where the route guard above can correct it.
     */
  } else if (route.tab === 'workout' && route.screen === 'list') {
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
        onOpenSubscription={() => navigate({ tab: 'profile', screen: 'subscription' })}
        profileName={preferences.profileName}
        activePlan={homeActivePlanCard}
        onCompletionStartNext={(planId, templateId) => void handleCompletionStartNext(planId, templateId)}
        onCompletionRestart={(planId) => void handleCompletionRestart(planId)}
        onCompletionDismiss={(planId) => void dismissCompletionCard(planId)}
        onCompletionBrowse={(planId) => {
          void dismissCompletionCard(planId);
          navigate(ROOT_ROUTES.workout);
        }}
        otherPrograms={homeOtherPrograms}
        onOpenOtherProgram={(planId) => {
          const plan = database.workoutPlans.find((entry) => entry.id === planId);
          const templateId = plan?.entries[0]?.workoutTemplateId;
          if (templateId) {
            handleOpenReadyProgramDetail(templateId);
          }
        }}
        onRemoveOtherProgram={(planId) => void handleRemoveActiveProgram(planId)}
        onRemoveActivePlan={
          preferences.activePlanId
            ? () => void handleRemoveActiveProgram(preferences.activePlanId as string)
            : undefined
        }
        onRedoOnboarding={() => void handleRedoOnboarding()}
        greetingState={homeGreetingState}
        widgetPrompt={
          homeWidgetState?.supported && !homeWidgetState.added && !preferences.homeWidgetPromptDismissed
            ? {
                onAdd: () => void handleAddHomeWidget(),
                onDismiss: () => void updatePreferences({ homeWidgetPromptDismissed: true }),
              }
            : null
        }
        trainingSchedule={homeTrainingSchedule}
        doneThisWeekSessionIds={homeDoneThisWeekSessionIds}
        statCatalogCards={homeStatCatalogCards}
        suggestedStatCardKeys={suggestHomeStatCardKeys({
          focusAreas: preferences.setupFocusAreas,
          goals: [preferences.setupGoal, ...preferences.setupGoals],
          pinnedKeys: homePinnedStatCardKeys,
          dismissedKeys: preferences.dismissedCardSuggestionKeys,
        })}
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
      route.screen === 'design_demo' ||
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
        // A saved workout drops the TOP edge so its gradient runs under the
        // status bar — and used to drop the bottom one with it, which put the
        // floating tab bar on top of the phone's own navigation buttons.
        historySessionActive
          ? ['left', 'right', 'bottom']
          : welcomeActive || workoutSummaryActive || fullBleedReview !== null
            ? ['left', 'right']
            : onboardingActive
              ? ['top', 'left', 'right']
              : ['top', 'left', 'right', 'bottom']
      }
      // Only the gradient-hero screens want light icons; everything else takes
      // the shell's light default.
      statusBarStyleOverride={
        // The workout summary is off this list since its hero turned gold: a
        // pale gold bar needs dark icons, and the shell already derives that
        // from the theme.
        fullBleedReview ? fullBleedReview : historySessionActive ? 'light' : undefined
      }
      statusBarBackgroundColor={
        // The saved workout's hero scrolls, and under a transparent bar its
        // date ended up printed across the phone's clock. Painted with the
        // hero's own top colour it is invisible at rest and a clean cap once
        // the screen moves.
        historySessionActive
          ? '#8B5CF6'
          : workoutSummaryActive || welcomeActive || fullBleedReview !== null
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
      <ThemeChoiceDialog
        visible={themeChoiceVisible}
        language={preferences.appLanguage}
        darkEnabled={preferences.darkThemeEnabled}
        // Written straight to preferences, so the dialog repaints itself along
        // with everything behind it. That IS the preview.
        onChange={(dark) => void updatePreferences({ darkThemeEnabled: dark })}
        onDone={() => {
          setThemeChoiceVisible(false);
          resetToRoute(ROOT_ROUTES.home);
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


