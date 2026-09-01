import React from 'react';
import { Linking, View } from 'react-native';

import { getWorkoutTemplateById } from '../features/workout/workoutCatalog';
import { buildFirstRunRecommendationReasons, FirstRunSetupSelection } from '../lib/firstRunSetup';
import { formatShortDate } from '../lib/format';
import { formatWorkoutDisplayLabel } from '../lib/displayLabel';
import { t } from '../lib/i18n';
import { AFFINITY_REASON_KEYS, resolveProgramAffinity } from '../lib/programAffinity';
import { composeProgramWeekForSelection } from '../lib/programDayComposer';
import { buildCustomProgramDetail, buildReadyProgramDetail } from '../lib/programDetails';
import { resolveProgramEquipment } from '../lib/programEquipment';
import { buildProgramFingerprint } from '../lib/programFingerprint';
import { getSeasonProgramId, ProgramSeason } from '../lib/programSeasons';
import { planWeekdayIndexes } from '../lib/programTrainingDays';
import {
  findCollectionInProgress,
  getExerciseCollection,
  getExerciseCollections,
  resolveCollectionProgress,
} from '../lib/exerciseCollections';
import { toggleTechniqueStatement } from '../lib/exerciseLearning';
import { getExerciseProgressForName } from '../lib/progression';
import { catalogLevelForSetup } from '../lib/goalProgramme';
import { getReadyProgramContent } from '../lib/readyProgramContent';
import { getReadyProgramBlockWeeks } from '../lib/readyProgramDuration';
import { nextSeasonWindow, resolveSeasonWindow } from '../lib/season';
import { computeSeasonProgress, countSeasonRecords, resolveSeasonBadges } from '../lib/seasonScoring';
import { removeStrengthGoal, upsertStrengthGoal } from '../lib/strengthGoals';
import { buildTailoringBadgeLabels } from '../lib/tailoringFit';
import { AppRoute, ROOT_ROUTES } from '../navigation/routes';
import { haptics } from '../utils/haptics';
import { CreateTemplateScreen } from '../screens/CreateTemplateScreen';
import { EmptyWorkoutScreen } from '../screens/EmptyWorkoutScreen';
import { ExerciseDetailScreen } from '../screens/ExerciseDetailScreen';
import { ExercisesScreen } from '../screens/ExercisesScreen';
import { CollectionScreen } from '../screens/CollectionScreen';
import { LearnIndexScreen } from '../screens/LearnIndexScreen';
import { GuidedPlayerScreen } from '../screens/GuidedPlayerScreen';
import { ProgramDayScreen } from '../screens/ProgramDayScreen';
import { ProgramPrescription } from '../lib/programSessionEdit';
import { ProgramDetailScreen } from '../screens/ProgramDetailScreen';
import { CatalogScreen, CatalogScreenItem } from '../screens/CatalogScreen';
import { ProgramsHomeScreen } from '../screens/ProgramsHomeScreen';
import { SeasonScreen } from '../screens/SeasonScreen';
import { GoalFlowProposal, StrengthGoalFlowScreen } from '../screens/StrengthGoalFlowScreen';
import { WorkoutEditorFinishSummary, WorkoutEditorScreen } from '../screens/WorkoutEditorScreen';
import { WorkoutsScreen } from '../screens/WorkoutsScreen';
import { AppDatabase, AppPreferences, WorkoutTemplateDraft } from '../types/models';

/** One empty array, so "nothing learned yet" is the same value every render. */
const NOTHING_LEARNED: string[] = [];

type ProgramDetailProps = React.ComponentProps<typeof ProgramDetailScreen>;
type ProgramsHomeProps = React.ComponentProps<typeof ProgramsHomeScreen>;
type WorkoutsProps = React.ComponentProps<typeof WorkoutsScreen>;
type GuidedProps = React.ComponentProps<typeof GuidedPlayerScreen>;

/**
 * The workout tab's route-pure branches, moved verbatim from App.tsx's render
 * chain in the phase-A split (2026-08-26). Two branches deliberately stayed
 * behind: `summary` and `celebration` are guarded on finish-flow state that
 * App.tsx owns, and their fall-through to the dashboard safety net is the
 * chain's business. This function returns null for them — and for any
 * workout route it does not claim — so the caller's fallback still runs.
 */
export interface WorkoutTabDeps {
  route: AppRoute;
  navigate: (route: AppRoute) => void;
  navigateBack: (fallback?: AppRoute | null) => void;
  replaceRoute: (route: AppRoute) => void;
  workoutHomeRoute: AppRoute;
  preferences: AppPreferences;
  updatePreferences: (patch: Partial<AppPreferences>) => Promise<unknown>;
  unitPreference: React.ComponentProps<typeof WorkoutEditorScreen>['unitPreference'];
  database: AppDatabase;
  workout: { templates: Parameters<typeof resolveProgramAffinity>[1] };
  customWorkoutRuntimeMap: Record<string, Parameters<typeof buildCustomProgramDetail>[0] | undefined>;
  setupSelection: FirstRunSetupSelection | null;
  setupRecommendation: { featuredProgramId?: string | null; mismatchNote?: string | null } | null;
  tailoringPreferences: Parameters<typeof buildTailoringBadgeLabels>[0];
  activeProgramTemplateIds: string[];
  homeActivePlanCard: {
    programId: string;
    programType: 'ready' | 'custom';
    title: string;
    weekLabel: string;
    progressPercent: number;
    sessionsPerWeek: string;
    weeklyMinutes: string;
    nextSession: { id: string };
  } | null;
  programInsightsByTemplateId: WorkoutsProps['programInsightsByTemplateId'];
  availableEquipmentForDrills: ProgramDetailProps['availableEquipment'];
  resolveNextSessionIdForTemplate: (workoutTemplateId: string) => string | null;
  handleStartReadyProgramSession: (workoutTemplateId: string, sessionId: string, trimSets?: boolean) => void;
  handleAdoptReadyProgram: (workoutTemplateId: string, options?: { lead?: boolean }) => Promise<void>;
  handleStartCustomProgram: (workoutTemplateId: string) => void;
  handleAdoptCustomProgram: (workoutTemplateId: string, options?: { lead?: boolean }) => Promise<void>;
  handleStartCustomProgramSession: (workoutTemplateId: string, sessionId: string, trimSets?: boolean) => void;
  /**
   * Change what a programme's day holds, for good — drop a lift, keep a swap,
   * or add from the library. A ready programme is copied underneath this: the
   * reader asked to change a lift, not to learn how the catalog is stored.
   *
   * `exerciseId` names the row being changed and is empty for an add, which
   * has no row yet.
   */
  editProgramExercise: (
    programType: 'ready' | 'custom',
    programId: string,
    sessionId: string,
    exerciseId: string,
    edit:
      | { kind: 'remove' }
      | { kind: 'replace'; exerciseName: string }
      | { kind: 'add'; exerciseNames: string[] }
      | { kind: 'prescribe'; prescription: ProgramPrescription }
      | { kind: 'reorder'; toIndex: number },
  ) => Promise<void>;
  handleReorderProgramSession: (
    workoutTemplateId: string,
    sessionId: string,
    toIndex: number,
  ) => Promise<void>;
  handleSaveRhythm: (workoutTemplateId: string, dayIndexes: number[]) => Promise<void>;
  handleSaveEmphasis: (
    workoutTemplateId: string,
    updates: Parameters<NonNullable<ProgramDetailProps['onSaveEmphasis']>>[0],
  ) => Promise<void>;
  handleDeleteCustomWorkout: (workoutTemplateId: string) => Promise<void>;
  sessionSwaps: React.ComponentProps<typeof ProgramDayScreen>['sessionSwaps'];
  setSessionSwaps: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  templateBuilderDraft: React.ComponentProps<typeof CreateTemplateScreen>['initialDraft'];
  exerciseBrowserItems: React.ComponentProps<typeof ExercisesScreen>['items'];
  recentExerciseBrowserItems: React.ComponentProps<typeof CreateTemplateScreen>['recentExerciseLibraryItems'];
  upsertWorkoutTemplate: (draft: WorkoutTemplateDraft) => Promise<string>;
  showToast: (message: string) => void;
  exercisePrLookup: React.ComponentProps<typeof EmptyWorkoutScreen>['exercisePrLookup'];
  finishLoggedWorkoutSave: (draft: WorkoutTemplateDraft, summary: WorkoutEditorFinishSummary) => Promise<unknown>;
  editorDraft: React.ComponentProps<typeof WorkoutEditorScreen>['initialDraft'];
  editorExerciseHistoryLookup: React.ComponentProps<typeof WorkoutEditorScreen>['exerciseHistoryLookup'];
  exerciseLibrary: AppDatabase['exerciseLibrary'];
  guidedEntryEyebrow: GuidedProps['entryEyebrow'];
  guidedWeekProgress: GuidedProps['weekProgress'];
  guidedNextUp: GuidedProps['nextUp'];
  getWorkoutLoggerFallbackRoute: () => AppRoute;
  handleDiscardWorkout: () => Promise<void>;
  handleConfirmFinishWorkout: () => Promise<void>;
  finishSaveState: { status: 'idle' | 'saving' | 'error' };
  customWorkouts: WorkoutsProps['customWorkouts'];
  recommendedReadyProgramId: string | null;
  navigateToGuidedWorkout: WorkoutsProps['onOpenWorkout'];
  handleOpenReadyProgramDetail: (workoutTemplateId: string) => void;
  handleStartReadyProgram: WorkoutsProps['onStartReadyProgram'];
  handleOpenCustomProgramDetail: WorkoutsProps['onOpenCustomProgram'];
  handleDuplicateCustomWorkout: WorkoutsProps['onDuplicateCustomWorkout'];
  goalProgrammeSuggestions: ProgramsHomeProps['goalProgrammes'];
  goalFlowLifts: React.ComponentProps<typeof StrengthGoalFlowScreen>['lifts'];
  getGoalProposal: (exerciseName: string) => GoalFlowProposal | null;
  handleAcceptTargetProposal: (input: {
    exerciseName: string;
    targetKg: number;
    templateId: string;
  }) => Promise<void>;
  programSlots: { canCreate: boolean };
  setProgramLimitVisible: (visible: boolean) => void;
  trackedProgress: Array<{ logs: Array<{ weight: number; repsPerSet: number[]; performedAt: string }> }>;
  workoutSessions: Parameters<typeof computeSeasonProgress>[0];
  handleEnrolSeason: (season: ProgramSeason, year: number) => void;
  programsCatalogItems: ProgramsHomeProps['catalogItems'];
  /** The same programmes with their categories, for the catalog's goal chips. */
  catalogScreenItems: CatalogScreenItem[];
  programsCategoryCounts: ProgramsHomeProps['categoryCounts'];
  programsCategoryMembers: ProgramsHomeProps['categoryMembers'];
  programsTrendingItems: ProgramsHomeProps['trendingItems'];
  programsRecommendations: ProgramsHomeProps['recommendations'];
  programsGoals: ProgramsHomeProps['goals'];
  programsCustomItems: ProgramsHomeProps['customPrograms'];
  exerciseNameBook: ProgramsHomeProps['nameBook'];
  teachExerciseName: (wrote: string, target: { name: string; libraryItemId: string }) => void;
  handlePickProgramImage: () => Promise<string | null>;
  coachProUnlocked: boolean;
}

export function renderWorkoutTab(deps: WorkoutTabDeps): React.ReactElement | null {
  const {
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
    editProgramExercise,
    handleReorderProgramSession,
    handleSaveRhythm,
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
    recommendedReadyProgramId,
    navigateToGuidedWorkout,
    handleOpenReadyProgramDetail,
    handleStartReadyProgram,
    handleOpenCustomProgramDetail,
    handleDuplicateCustomWorkout,
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
    programsCategoryCounts,
    programsCategoryMembers,
    programsTrendingItems,
    programsRecommendations,
    programsGoals,
    programsCustomItems,
    exerciseNameBook,
    teachExerciseName,
    handlePickProgramImage,
    coachProUnlocked,
  } = deps;

  /**
   * Learned is stored by library item id; a course lists library names. The
   * lookup happens here rather than in the pure module, which has no business
   * knowing about the library.
   *
   * Above every branch, because three of them read it — the Learn rail on the
   * tab, the Learn index and the library. It used to sit beside the first of
   * those readers, and adding the rail put a reader above the declaration: in
   * a release bundle `const` becomes `var`, so that was not a ReferenceError
   * naming the variable but `undefined` reaching a callback, and the app died
   * two frames away in resolveCollectionProgress.
   *
   * Being above every branch means it runs for every workout screen, so it
   * has to be cheap for the screens that never read it. The guided player is
   * one of those and re-renders on every rest-timer tick; the naive version
   * walked all 876 browser items calling `.includes` on an array for each,
   * which is 876 × learned comparisons per tick. Nothing learned yet is the
   * common case and costs nothing now, and the worst case is 876 hash
   * lookups.
   */
  const learnedIds = new Set(preferences.learnedExerciseLibraryItemIds);
  const learnedExerciseNames =
    learnedIds.size === 0
      ? NOTHING_LEARNED
      : exerciseBrowserItems.filter((item) => learnedIds.has(item.id)).map((item) => item.name);

  if (route.tab !== 'workout') {
    return null;
  }

  if (route.screen === 'program') {
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

    return program ? (
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
        programBlockWeeks={readyTemplate ? getReadyProgramBlockWeeks(readyTemplate) : null}
        trainingDayIndexes={planWeekdayIndexes(
          database.workoutPlans.find((plan) => plan.entries[0]?.workoutTemplateId === route.workoutTemplateId)
            ?.entries ?? [],
        )}
        // Custom only: reordering a catalog programme would mean copying it,
        // and nobody asks for a copy by dragging.
        onReorderSession={
          route.programType === 'custom'
            ? (sessionId, toIndex) =>
                void handleReorderProgramSession(route.workoutTemplateId, sessionId, toIndex)
            : undefined
        }
        onSaveRhythm={
          database.workoutPlans.some((plan) => plan.entries[0]?.workoutTemplateId === route.workoutTemplateId)
            ? (dayIndexes) => void handleSaveRhythm(route.workoutTemplateId, dayIndexes)
            : undefined
        }
        // The cycle is the app's one schedule, so it is offered exactly where
        // the weekday rhythm is: on a programme that has a plan behind it.
        trainingCycle={preferences.trainingCycle}
        onChangeTrainingCycle={
          database.workoutPlans.some((plan) => plan.entries[0]?.workoutTemplateId === route.workoutTemplateId)
            ? (cycle) => void updatePreferences({ trainingCycle: cycle })
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
  }

  if (route.screen === 'programDay') {
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

    return program && daySession ? (
      <ProgramDayScreen
        language={preferences.appLanguage}
        programTitle={program.title}
        session={daySession}
        dayNumber={dayIndex + 1}
        dayCount={program.sessions.length}
        availableEquipment={availableEquipmentForDrills}
        routineDrillOverrides={preferences.routineDrillOverrides}
        // Permanent by nature: the drills are generated from the session
        // focus, so a choice belongs to every day with that focus rather
        // than to this one. There is no "just this time" to offer.
        onSwapRoutineDrill={(slotKey: string, drillKey: string) =>
          void updatePreferences({
            routineDrillOverrides: { ...preferences.routineDrillOverrides, [slotKey]: drillKey },
          })
        }
        sessionSwaps={sessionSwaps}
        onSwapExercise={(slotId, exerciseName) =>
          setSessionSwaps((current) => ({ ...current, [slotId]: exerciseName }))
        }
        exerciseLibrary={exerciseBrowserItems}
        recentExerciseLibraryItems={recentExerciseBrowserItems}
        onAddExercises={(exerciseNames) =>
          void editProgramExercise(route.programType, route.workoutTemplateId, daySession.id, '', {
            kind: 'add',
            exerciseNames,
          })
        }
        onRemoveExercise={(exerciseId) =>
          void editProgramExercise(route.programType, route.workoutTemplateId, daySession.id, exerciseId, {
            kind: 'remove',
          })
        }
        onKeepSwap={(exerciseId, exerciseName) =>
          void editProgramExercise(route.programType, route.workoutTemplateId, daySession.id, exerciseId, {
            kind: 'replace',
            exerciseName,
          })
        }
        onPrescribe={(exerciseId, prescription) =>
          void editProgramExercise(route.programType, route.workoutTemplateId, daySession.id, exerciseId, {
            kind: 'prescribe',
            prescription,
          })
        }
        onReorderExercise={(exerciseId, toIndex) =>
          void editProgramExercise(route.programType, route.workoutTemplateId, daySession.id, exerciseId, {
            kind: 'reorder',
            toIndex,
          })
        }
        tailoringPreferences={preferences}
        onBack={() => navigateBack({ tab: 'workout', screen: 'program', programType: route.programType, workoutTemplateId: route.workoutTemplateId })}
      />
    ) : (
      <View />
    );
  }

  if (route.screen === 'template') {
    return (
      <CreateTemplateScreen
        language={preferences.appLanguage}
        key={route.workoutTemplateId ?? 'new_template'}
        initialDraft={templateBuilderDraft}
        exerciseLibrary={exerciseBrowserItems}
        recentExerciseLibraryItems={recentExerciseBrowserItems}
        defaultRestSeconds={preferences.defaultRestSeconds}
        onBack={() => navigateBack(workoutHomeRoute)}
        onSave={async (draft) => {
          const workoutTemplateId = await upsertWorkoutTemplate(draft);
          // Was an untranslated "Template saved" — English on a Finnish
          // screen, saying what the programme page opening right after it
          // already says. The haptic carries it now (user 2026-08-26).
          void haptics.success();
          replaceRoute({ tab: 'workout', screen: 'program', programType: 'custom', workoutTemplateId });
        }}
      />
    );
  }

  if (route.screen === 'empty') {
    return (
      <EmptyWorkoutScreen
        language={preferences.appLanguage}
        exerciseLibrary={exerciseBrowserItems}
        recentExerciseLibraryItems={recentExerciseBrowserItems}
        defaultRestSeconds={preferences.defaultRestSeconds}
        keepScreenAwake={preferences.keepScreenAwakeDuringWorkout}
        exercisePrLookup={exercisePrLookup}
        restAlerts={{
          // The master notifications switch silences these too — three lit
          // switches after "off" were the visual half of the same lie.
          alerts: preferences.notificationPrefs.pushEnabled && preferences.notificationPrefs.restAlerts,
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
  }

  if (route.screen === 'editor') {
    return (
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
            void haptics.success();
          }
        }}
      />
    );
  }

  if (route.screen === 'guided') {
    return (
      <GuidedPlayerScreen
        keepScreenAwake={preferences.keepScreenAwakeDuringWorkout}
        unitPreference={unitPreference}
        availableEquipment={availableEquipmentForDrills}
        routineDrillOverrides={preferences.routineDrillOverrides}
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
        // Set by navigateToActiveWorkout — the reader pressed "resume", so the
        // player opens on the set instead of the session overview.
        autoResume={route.resume === true}
        restAlerts={{
          // The master notifications switch silences these too — three lit
          // switches after "off" were the visual half of the same lie.
          alerts: preferences.notificationPrefs.pushEnabled && preferences.notificationPrefs.restAlerts,
          warning: preferences.notificationPrefs.restWarning,
          ongoing: preferences.notificationPrefs.sessionOngoing,
        }}
      />
    );
  }

  if (route.screen === 'plans') {
    return (
      <WorkoutsScreen
        language={preferences.appLanguage}
        customWorkouts={customWorkouts}
        programInsightsByTemplateId={programInsightsByTemplateId}
        recommendedReadyProgramId={recommendedReadyProgramId}
        tailoringPreferences={tailoringPreferences}
        onOpenWorkout={navigateToGuidedWorkout}
        onOpenReadyProgram={handleOpenReadyProgramDetail}
        onStartReadyProgram={handleStartReadyProgram}
        onOpenCustomProgram={handleOpenCustomProgramDetail}
        onStartCustomWorkout={handleStartCustomProgram}
        onEditCustomWorkout={(workoutTemplateId) => navigate({ tab: 'workout', screen: 'template', workoutTemplateId })}
        onDuplicateCustomWorkout={handleDuplicateCustomWorkout}
        onDeleteCustomWorkout={handleDeleteCustomWorkout}
        onCreateWorkout={() => navigate({ tab: 'workout', screen: 'template' })}
      />
    );
  }

  if (route.screen === 'detail') {
    const exercise = exerciseBrowserItems.find((item) => item.id === route.exerciseId) ?? null;
    return exercise ? (
      <ExerciseDetailScreen
        language={preferences.appLanguage}
        item={exercise}
        history={getExerciseProgressForName(database, exercise.name)}
        unitPreference={unitPreference}
        tracked={preferences.trackedExerciseLibraryItemIds.includes(exercise.id)}
        // Decides whether this lift's caution is for this reader.
        cautionFlags={preferences.setupCautionFlags}
        checkedStatements={preferences.exerciseTechniqueChecks[exercise.id] ?? []}
        onToggleStatement={(index) => {
          void updatePreferences({
            exerciseTechniqueChecks: toggleTechniqueStatement(
              preferences.exerciseTechniqueChecks,
              exercise.id,
              index,
            ),
          });
        }}
        learned={preferences.learnedExerciseLibraryItemIds.includes(exercise.id)}
        onToggleLearned={() => {
          const current = preferences.learnedExerciseLibraryItemIds;
          void updatePreferences({
            learnedExerciseLibraryItemIds: current.includes(exercise.id)
              ? current.filter((id) => id !== exercise.id)
              : [...current, exercise.id],
          });
        }}
        // An easier/harder row opens that lift's own screen. Resolved by name
        // because the teaching content names lifts the way the library does;
        // a name with no entry simply does not navigate rather than opening a
        // blank screen.
        onOpenExercise={(exerciseName) => {
          const target = exerciseBrowserItems.find((candidate) => candidate.name === exerciseName);
          if (target) {
            navigate({ tab: 'workout', screen: 'detail', exerciseId: target.id });
          }
        }}
        onBack={() => navigateBack(ROOT_ROUTES.workout)}
        onToggleTracked={(item) => {
          const trackedIds = preferences.trackedExerciseLibraryItemIds;
          const nextTrackedIds = trackedIds.includes(item.id)
            ? trackedIds.filter((id) => id !== item.id)
            : [...trackedIds, item.id];

          void updatePreferences({ trackedExerciseLibraryItemIds: nextTrackedIds });
        }}
      />
    ) : (
      <View />
    );
  }

  if (route.screen === 'catalog') {
    return (
      <CatalogScreen
        language={preferences.appLanguage}
        items={catalogScreenItems}
        onBack={() => navigateBack(workoutHomeRoute)}
        onOpenProgram={(programId) =>
          navigate({ tab: 'workout', screen: 'program', programType: 'ready', workoutTemplateId: programId })
        }
      />
    );
  }

  if (route.screen === 'goalFlow') {
    return (
      <StrengthGoalFlowScreen
        language={preferences.appLanguage}
        lifts={goalFlowLifts}
        unitLabel={preferences.unitPreference}
        getProposal={getGoalProposal}
        onBack={() => navigateBack(ROOT_ROUTES.workout)}
        // The cap is the adoption's business, not this screen's: full on the
        // free tier routes to the paywall and full on Pro says so, both from
        // inside handleAdoptReadyProgram.
        onCreate={(input) => void handleAcceptTargetProposal(input)}
      />
    );
  }

  if (route.screen === 'season') {
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
    return (
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
  }

  if (route.screen === 'programs_home') {
    /**
     * Learn, out of the library and onto the tab.
     *
     * Progress is resolved here because it needs the learned-exercise set and
     * the screen has no business reading it. Built once per render of this
     * branch rather than inline in the JSX, where it minted a new array and
     * six new row objects every time.
     */
    const learnedNames = new Set(learnedExerciseNames);
    const learnRows = getExerciseCollections(preferences.appLanguage).map((collection) => {
      const progress = resolveCollectionProgress(collection, (name) => learnedNames.has(name));
      return {
        id: collection.id,
        title: collection.title,
        blurb: collection.blurb,
        done: progress.done,
        total: progress.total,
        percent: progress.percent,
        cover: collection.cover,
      };
    });

    return (
      <ProgramsHomeScreen
        language={preferences.appLanguage}
        activeProgramTitle={homeActivePlanCard?.title ?? null}
        // What setup was told, not what the plan happens to run: the sheet is
        // for choosing a programme, so the week to match is the reader's own.
        // Null when setup never asked, and then no row is recommended.
        readerDaysPerWeek={preferences.setupDaysPerWeek}
        // Setup's tier in the catalog's words. The two vocabularies collide on
        // "advanced", so this goes through the shared map rather than across
        // as-is.
        readerLevel={catalogLevelForSetup(preferences.setupLevel) ?? null}
        catalogItems={programsCatalogItems}
        categoryCounts={programsCategoryCounts}
        categoryMembers={programsCategoryMembers}
        trendingItems={programsTrendingItems}
        recommendations={programsRecommendations}
        learnRows={learnRows}
        onOpenCollection={(collectionId) =>
          navigate({ tab: 'workout', screen: 'collection', collectionId })
        }
        onOpenLearnIndex={() => navigate({ tab: 'workout', screen: 'learn' })}
        goals={programsGoals}
        goalProgrammes={goalProgrammeSuggestions}
        onOpenGoalPicker={() => navigate({ tab: 'workout', screen: 'goalFlow' })}
        onRemoveGoal={(exerciseName) =>
          void updatePreferences({
            strengthGoals: removeStrengthGoal(preferences.strengthGoals, exerciseName),
          })
        }
        customPrograms={programsCustomItems}
        exerciseLibraryCount={exerciseBrowserItems.length}
        exerciseLibraryEntries={exerciseBrowserItems}
        nameBook={exerciseNameBook}
        onTeachName={(wrote, exercise) => teachExerciseName(wrote, { name: exercise.name, libraryItemId: exercise.id })}
        onPickImage={handlePickProgramImage}
        onAiAssisted={() => navigate({ tab: 'home', screen: 'ai_chat' })}
        onBrowseCatalog={() => navigate({ tab: 'workout', screen: 'catalog' })}
        catalogCount={programsCatalogItems.length}
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
  }

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
   * destination. Anything else — including a summary whose guard state was
   * just cleared — returns null and falls to the dashboard safety net.
   */
  if (route.screen === 'learn') {
    return (
      <LearnIndexScreen
        language={preferences.appLanguage}
        collections={getExerciseCollections(preferences.appLanguage)}
        learnedExerciseNames={learnedExerciseNames}
        onBack={() => navigateBack(ROOT_ROUTES.workout)}
        onOpenCollection={(collectionId) =>
          navigate({ tab: 'workout', screen: 'collection', collectionId })
        }
      />
    );
  }

  if (route.screen === 'collection') {
    const collection = getExerciseCollection(route.collectionId, preferences.appLanguage);
    // An id with no course behind it renders nothing, which drops through to
    // the caller's dashboard safety net — the same thing every unclaimed
    // route in this file does. It does NOT navigate back, and saying so would
    // be a comment describing behaviour the code has not got.
    if (!collection) {
      return null;
    }
    return (
      <CollectionScreen
        language={preferences.appLanguage}
        collection={collection}
        learnedExerciseNames={learnedExerciseNames}
        onBack={() => navigateBack(ROOT_ROUTES.workout)}
        onOpenExercise={(exerciseName) => {
          const target = exerciseBrowserItems.find((candidate) => candidate.name === exerciseName);
          if (target) {
            navigate({ tab: 'workout', screen: 'detail', exerciseId: target.id });
          }
        }}
      />
    );
  }

  if (route.screen === 'list') {
    return (
      /*
       * No onAddToWorkout.
       *
       * The "+" on a library card opened the logger prefilled with that lift,
       * so browsing the library was a way to start a workout. Removed on
       * request (user 2026-08-31) — the routing only, with a replacement to
       * come. The button renders only when it has an action, so the card is
       * now a card rather than a dead orange circle.
       */
      <ExercisesScreen
        language={preferences.appLanguage}
        onBack={() => navigateBack({ tab: 'workout', screen: 'programs_home' })}
        items={exerciseBrowserItems}
        trackedIds={preferences.trackedExerciseLibraryItemIds}
        onOpenExercise={(item) => navigate({ tab: 'workout', screen: 'detail', exerciseId: item.id })}
        collectionInProgress={(() => {
          const started = findCollectionInProgress(
            getExerciseCollections(preferences.appLanguage),
            (name) => learnedExerciseNames.includes(name),
          );
          return started
            ? {
                id: started.collection.id,
                title: started.collection.title,
                done: started.progress.done,
                total: started.progress.total,
                percent: started.progress.percent,
              }
            : null;
        })()}
        onOpenCollection={(collectionId) =>
          navigate({ tab: 'workout', screen: 'collection', collectionId })
        }
        onOpenLearnIndex={() => navigate({ tab: 'workout', screen: 'learn' })}
        onToggleTracked={(item) => {
          const trackedIds = preferences.trackedExerciseLibraryItemIds;
          const nextTrackedIds = trackedIds.includes(item.id)
            ? trackedIds.filter((id) => id !== item.id)
            : [...trackedIds, item.id];

          void updatePreferences({ trackedExerciseLibraryItemIds: nextTrackedIds });
        }}
      />
    );
  }

  return null;
}
