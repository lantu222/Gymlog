import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AddExerciseSheet } from '../components/AddExerciseSheet';
import { ExerciseInfoSheet } from '../components/ExerciseInfoSheet';
import { InlineTip } from '../components/InlineTip';
import { ScreenHeader } from '../components/ScreenHeader';
import { WorkoutExerciseCard } from '../components/WorkoutExerciseCard';
import { WorkoutQueueItem } from '../components/WorkoutQueueItem';
import { WorkoutSceneGraphic } from '../components/WorkoutSceneGraphic';
import { WorkoutSummaryBar } from '../components/WorkoutSummaryBar';
import { AdaptiveCoachRecommendation, buildAdaptiveCoachRecommendation } from '../lib/adaptiveCoach';
import { getExerciseTemplateDefaults } from '../lib/exerciseSuggestions';
import { buildTailoredSwapOptions, buildTailoringBadgeLabels, TailoringPreferencesInput } from '../lib/tailoringFit';
import { formatWorkoutExerciseQueueMeta, getWorkoutFlowPhase, getWorkoutFlowTrail } from '../lib/workoutFlow';
import { getActiveSetAutoFocusTarget } from '../lib/workoutLoggingFocus';
import { getWorkoutLoggingSessionBootstrapResult } from '../lib/workoutLoggingSessionBootstrap';
import { colors, radii, spacing } from '../theme';
import { BadgePill, SurfaceAccent } from '../components/MainScreenPrimitives';
import { ExerciseLibraryItem, UnitPreference } from '../types/models';
import { CORE_WORKOUT_TEMPLATE_ID, WORKOUT_SUBSTITUTION_GROUPS, getWorkoutTemplateById } from '../features/workout/workoutCatalog';
import { useWorkoutContext } from '../features/workout/WorkoutProvider';
import {
  WorkoutExerciseInstance,
  WorkoutRuntimeTemplate,
  WorkoutSetEffort,
  WorkoutSlotHistoryEntry,
  WorkoutTrackingMode,
} from '../features/workout/workoutTypes';
import { getHistoryEntriesForExercise, selectActiveExercise, selectNextExercise } from '../features/workout/workoutState';

interface WorkoutLoggingScreenProps {
  sessionKey: string;
  unitPreference: UnitPreference;
  autoFocusNextInput: boolean;
  defaultRestSeconds: number;
  hasAdaptiveCoachPremium: boolean;
  tailoringPreferences?: TailoringPreferencesInput | null;
  exerciseLibrary: ExerciseLibraryItem[];
  recentExerciseLibraryItems: ExerciseLibraryItem[];
  customTemplate?: WorkoutRuntimeTemplate | null;
  onBack: () => void;
  onOpenAdaptiveCoachPremium?: () => void;
  onConfirmFinishWorkout: () => void;
  onDiscardWorkout: () => void;
  isSavingWorkout?: boolean;
  finishErrorMessage?: string | null;
  dismissedTipIds: string[];
  onDismissTip: (tipId: string) => void | Promise<void>;
  inlineTip?: {
    title: string;
    body: string;
    accent?: SurfaceAccent;
    onDismiss: () => void;
  } | null;
}

interface EffortPromptTarget {
  key: string;
  slotId: string;
  setIndex: number;
  setNumber: number;
  exerciseName: string;
}

interface PostEffortTransitionState {
  effort: WorkoutSetEffort;
  completedExerciseName: string;
  completedSetNumber: number;
  nextExercise: WorkoutExerciseInstance;
  nextSetNumber: number;
  adaptiveCoach: AdaptiveCoachRecommendation | null;
  adaptiveCoachLocked: boolean;
}

const LOGGER_FIRST_SET_GUIDE_TIP_ID = 'workout_logger_first_set';
const LOGGER_EFFORT_GUIDE_TIP_ID = 'workout_logger_effort';
const EFFORT_OPTIONS: { value: WorkoutSetEffort; label: string }[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'good', label: 'Good' },
  { value: 'hard', label: 'Hard' },
];

function normalizeName(value: string) {
  return value.trim().toLowerCase();
}

function readRemainingSeconds(status: string, endsAtMs: number | null, nowMs: number) {
  if (status !== 'running' || !endsAtMs) {
    return null;
  }
  return Math.max(0, Math.ceil((endsAtMs - nowMs) / 1000));
}

function readRestDisplaySeconds(
  status: string,
  endsAtMs: number | null,
  durationSeconds: number,
  nowMs: number,
) {
  if (status === 'paused') {
    return durationSeconds;
  }

  return readRemainingSeconds(status, endsAtMs, nowMs);
}

function getAllowedSwaps(substitutionGroup: string) {
  return WORKOUT_SUBSTITUTION_GROUPS.find((group) => group.id === substitutionGroup)?.allowedExerciseNames ?? [];
}

function getTrackingModeForLibraryItem(item: ExerciseLibraryItem): WorkoutTrackingMode {
  if (item.equipment === 'bodyweight') {
    return 'bodyweight';
  }

  if (item.category === 'core' || item.category === 'cardio') {
    return 'reps_first';
  }

  return 'load_and_reps';
}

function findFirstPendingSetIndex(exercise: WorkoutExerciseInstance) {
  const pendingIndex = exercise.sets.findIndex((set) => set.status === 'pending');
  return pendingIndex >= 0 ? pendingIndex : 0;
}

function buildEffortPromptKey(slotId: string, setIndex: number, completedAt?: string) {
  return `${slotId}:${setIndex}:${completedAt ?? 'pending'}`;
}

function readCompletedAtMs(completedAt?: string) {
  if (!completedAt) {
    return -1;
  }

  const parsed = Date.parse(completedAt);
  return Number.isFinite(parsed) ? parsed : -1;
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function getLatestCompletedSetWithoutEffort(activeSession: ReturnType<typeof useWorkoutContext>['activeSession']): EffortPromptTarget | null {
  if (!activeSession) {
    return null;
  }

  let latestTarget: EffortPromptTarget | null = null;
  let latestCompletedAtMs = -1;

  for (const exercise of activeSession.exercises) {
    for (const set of exercise.sets) {
      if (set.status !== 'completed' || set.effort) {
        continue;
      }

      const completedAtMs = readCompletedAtMs(set.completedAt);
      const isLaterSet =
        !latestTarget ||
        completedAtMs > latestCompletedAtMs ||
        (completedAtMs === latestCompletedAtMs && set.setIndex > latestTarget.setIndex);

      if (!isLaterSet) {
        continue;
      }

      latestCompletedAtMs = completedAtMs;
      latestTarget = {
        key: buildEffortPromptKey(exercise.slotId, set.setIndex, set.completedAt),
        slotId: exercise.slotId,
        setIndex: set.setIndex,
        setNumber: set.setIndex + 1,
        exerciseName: exercise.exerciseName,
      };
    }
  }

  return latestTarget;
}

function getPendingSetNumber(exercise: WorkoutExerciseInstance | null | undefined) {
  if (!exercise) {
    return null;
  }

  const pendingIndex = exercise.sets.findIndex((set) => set.status === 'pending');
  return pendingIndex >= 0 ? pendingIndex + 1 : null;
}

function formatEffortSignal(effort: WorkoutSetEffort) {
  if (effort === 'easy') {
    return 'Easy';
  }

  if (effort === 'good') {
    return 'Good';
  }

  return 'Hard';
}

export function WorkoutLoggingScreen({
  sessionKey,
  unitPreference,
  autoFocusNextInput,
  defaultRestSeconds,
  hasAdaptiveCoachPremium,
  tailoringPreferences = null,
  exerciseLibrary,
  recentExerciseLibraryItems,
  customTemplate,
  onBack,
  onOpenAdaptiveCoachPremium,
  onConfirmFinishWorkout,
  onDiscardWorkout,
  isSavingWorkout = false,
  finishErrorMessage = null,
  dismissedTipIds,
  onDismissTip,
  inlineTip,
}: WorkoutLoggingScreenProps) {
  const {
    hydrated,
    isRestoring,
    state,
    activeSession,
    history,
    startWorkout,
    startCustomWorkout,
    clearRestTimer,
    pauseRestTimer,
    resumeRestTimer,
    overrideRestTimer,
    setActiveExercise,
    insertExerciseAfter,
    updateSetDraft,
    completeSet,
    recordSetEffort,
    repeatLastSet,
    undoSet,
    addSet,
    skipExercise,
    swapExercise,
    updateNotes,
  } = useWorkoutContext();

  const scrollRef = useRef<ScrollView | null>(null);
  const weightInputRefs = useRef<Record<string, TextInput | null>>({});
  const repsInputRefs = useRef<Record<string, TextInput | null>>({});
  const exerciseOffsets = useRef<Record<string, number>>({});
  const previousCompletedSetsRef = useRef<number | null>(null);
  const previousActiveSlotIdRef = useRef<string | null>(null);
  const autoDismissedFirstGuideSessionRef = useRef<string | null>(null);

  const [showAddExercise, setShowAddExercise] = useState(false);
  const [showMoreActions, setShowMoreActions] = useState(false);
  const [exerciseInfoSlotId, setExerciseInfoSlotId] = useState<string | null>(null);
  const [swapSlotId, setSwapSlotId] = useState<string | null>(null);
  const [noteSlotId, setNoteSlotId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState('');
  const [finishReviewVisible, setFinishReviewVisible] = useState(false);
  const [skippedEffortKeys, setSkippedEffortKeys] = useState<string[]>([]);
  const [postEffortTransition, setPostEffortTransition] = useState<PostEffortTransitionState | null>(null);
  const bootstrappedTargetKeyRef = useRef<string | null>(null);

  const bootstrapTargetKey = customTemplate ? `custom:${customTemplate.id}` : `template:${sessionKey}`;

  useEffect(() => {
    const bootstrapResult = getWorkoutLoggingSessionBootstrapResult({
      hydrated,
      activeSessionId: activeSession?.sessionId ?? null,
      targetKey: bootstrapTargetKey,
      lastBootstrappedTargetKey: bootstrappedTargetKeyRef.current,
    });

    bootstrappedTargetKeyRef.current = bootstrapResult.nextBootstrappedTargetKey;

    if (!bootstrapResult.shouldStartWorkout) {
      return;
    }

    if (customTemplate) {
      startCustomWorkout(customTemplate, unitPreference);
      return;
    }

    const templateId = getWorkoutTemplateById(sessionKey) ? sessionKey : CORE_WORKOUT_TEMPLATE_ID;
    startWorkout(templateId, unitPreference);
  }, [activeSession?.sessionId, bootstrapTargetKey, customTemplate, hydrated, sessionKey, startCustomWorkout, startWorkout, unitPreference]);

  const activeExercise = selectActiveExercise(activeSession);
  const activeSlotId = activeSession?.ui.activeSlotId ?? activeExercise?.slotId ?? activeSession?.exercises[0]?.slotId ?? null;
  const restTimerStatus = activeSession?.restTimer.status ?? 'idle';
  const restTimerPaused = restTimerStatus === 'paused';
  const remainingSeconds = readRestDisplaySeconds(
    restTimerStatus,
    activeSession?.restTimer.endsAtMs ?? null,
    activeSession?.restTimer.durationSeconds ?? 0,
    state.nowMs,
  );

  const libraryIdByName = useMemo(
    () => new Map(exerciseLibrary.map((item) => [normalizeName(item.name), item.id] as const)),
    [exerciseLibrary],
  );
  const libraryItemById = useMemo(
    () => new Map(exerciseLibrary.map((item) => [item.id, item] as const)),
    [exerciseLibrary],
  );

  const currentItemIds = useMemo(
    () =>
      activeSession?.exercises
        .map((exercise) => exercise.libraryItemId ?? libraryIdByName.get(normalizeName(exercise.exerciseName)) ?? null)
        .filter((value): value is string => Boolean(value)) ?? [],
    [activeSession?.exercises, libraryIdByName],
  );

  const previousEntriesBySlot = useMemo(
    () =>
      Object.fromEntries(
        (activeSession?.exercises ?? []).map((exercise) => [exercise.slotId, getHistoryEntriesForExercise(history, exercise)] as const),
      ) as Record<string, WorkoutSlotHistoryEntry[]>,
    [activeSession?.exercises, history.slotHistory],
  );

  const completedSets = useMemo(
    () => activeSession?.exercises.flatMap((exercise) => exercise.sets).filter((set) => set.status === 'completed').length ?? 0,
    [activeSession?.exercises],
  );
  const isFirstSession = history.sessions.length === 0;
  const loggedExercises = useMemo(
    () =>
      activeSession?.exercises.filter(
        (exercise) => exercise.status === 'skipped' || exercise.sets.some((set) => set.status === 'completed'),
      ).length ?? 0,
    [activeSession?.exercises],
  );

  const totalVolume = useMemo(
    () =>
      activeSession?.exercises.reduce((sum, exercise) => {
        const exerciseVolume = exercise.sets.reduce((setSum, set) => setSum + (set.actualLoadKg ?? 0) * (set.actualReps ?? 0), 0);
        return sum + exerciseVolume;
      }, 0) ?? 0,
    [activeSession?.exercises],
  );
  const flowTrail = useMemo(
    () => getWorkoutFlowTrail(activeSession?.exercises ?? [], activeSlotId),
    [activeSession?.exercises, activeSlotId],
  );
  const nextExercise = useMemo(() => selectNextExercise(activeSession), [activeSession]);
  const incompleteQueueExercises = useMemo(
    () =>
      activeSession?.exercises.filter(
        (exercise) => exercise.slotId !== activeSlotId && exercise.status !== 'completed' && exercise.status !== 'skipped',
      ) ?? [],
    [activeSession?.exercises, activeSlotId],
  );
  const nextUpExercise = nextExercise ?? incompleteQueueExercises[0] ?? null;
  const nextUpIndex = nextUpExercise
    ? activeSession?.exercises.findIndex((exercise) => exercise.slotId === nextUpExercise.slotId) ?? -1
    : -1;
  const laterQueueExercises = useMemo(
    () =>
      incompleteQueueExercises.filter((exercise) => exercise.slotId !== (nextUpExercise?.slotId ?? null)),
    [incompleteQueueExercises, nextUpExercise?.slotId],
  );
  const completedExerciseCount = useMemo(
    () =>
      activeSession?.exercises.filter(
        (exercise) =>
          exercise.slotId !== activeSlotId &&
          (exercise.status === 'completed' ||
            exercise.status === 'swapped' ||
            exercise.sets.some((set) => set.status === 'completed')),
      ).length ?? 0,
    [activeSession?.exercises, activeSlotId],
  );
  const currentPhase = flowTrail.find((item) => item.state === 'current') ?? flowTrail[0] ?? null;
  const remainingMoveCount = Math.max(0, incompleteQueueExercises.length + (activeExercise ? 1 : 0));
  const activePendingSet = activeExercise
    ? activeExercise.sets.find((set) => set.setIndex === activeSession?.ui.activeSetIndex && set.status === 'pending') ??
      activeExercise.sets.find((set) => set.status === 'pending') ??
      null
    : null;
  const activePendingSetNumber = activePendingSet ? activePendingSet.setIndex + 1 : null;
  const statusMeta = nextUpExercise
    ? `${pluralize(remainingMoveCount, 'move')} left | Next ${nextUpExercise.exerciseName}`
    : completedExerciseCount > 0
      ? `${pluralize(completedExerciseCount, 'exercise')} logged`
      : 'One move at a time';
  const latestEffortTarget = useMemo(() => getLatestCompletedSetWithoutEffort(activeSession), [activeSession]);
  const overlaySurfaceOpen =
    showAddExercise ||
    showMoreActions ||
    Boolean(exerciseInfoSlotId) ||
    Boolean(swapSlotId) ||
    Boolean(noteSlotId) ||
    finishReviewVisible;
  const showFirstSessionCoach =
    isFirstSession &&
    completedSets === 0 &&
    !dismissedTipIds.includes(LOGGER_FIRST_SET_GUIDE_TIP_ID) &&
    !overlaySurfaceOpen;
  const activeEffortPrompt =
    latestEffortTarget && !skippedEffortKeys.includes(latestEffortTarget.key) ? latestEffortTarget : null;
  const showEffortPrompt = Boolean(activeEffortPrompt) && !overlaySurfaceOpen;
  const showRestTransition =
    Boolean(postEffortTransition) &&
    !showEffortPrompt &&
    !overlaySurfaceOpen;
  const showSessionStartCard =
    Boolean(activeExercise) &&
    completedSets === 0 &&
    !showEffortPrompt &&
    !showRestTransition &&
    !overlaySurfaceOpen;
  const showGenericInlineTip =
    Boolean(inlineTip) && !isFirstSession && !showFirstSessionCoach && !showEffortPrompt && !showRestTransition;

  useEffect(() => {
    if (showSessionStartCard) {
      const timeout = setTimeout(() => {
        scrollRef.current?.scrollTo({ y: 0, animated: false });
      }, 16);

      return () => clearTimeout(timeout);
    }

    if (!activeSlotId) {
      return;
    }

    const targetOffset = exerciseOffsets.current[activeSlotId];
    if (typeof targetOffset !== 'number') {
      return;
    }

    const timeout = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, targetOffset - 16), animated: true });
    }, 48);

    return () => clearTimeout(timeout);
  }, [activeSlotId, showSessionStartCard]);

  useEffect(() => {
    if (!autoFocusNextInput || !activeSession || !activeExercise) {
      previousCompletedSetsRef.current = completedSets;
      previousActiveSlotIdRef.current = activeExercise?.slotId ?? null;
      return;
    }

    const activeSet = activeExercise.sets.find((set) => set.setIndex === activeSession.ui.activeSetIndex);
    if (!activeSet || activeSet.status !== 'pending') {
      previousCompletedSetsRef.current = completedSets;
      previousActiveSlotIdRef.current = activeExercise.slotId;
      return;
    }

    const completedSetsIncreased =
      previousCompletedSetsRef.current !== null && completedSets > previousCompletedSetsRef.current;
    const movedToNewExercise =
      completedSetsIncreased &&
      previousActiveSlotIdRef.current !== null &&
      previousActiveSlotIdRef.current !== activeExercise.slotId;

    previousCompletedSetsRef.current = completedSets;
    previousActiveSlotIdRef.current = activeExercise.slotId;

    const nextFocusTarget = getActiveSetAutoFocusTarget({
      autoFocusNextInput,
      completedSetsIncreased,
      movedToNewExercise,
      trackingMode: activeExercise.trackingMode,
      draftLoadText: activeSet.draftLoadText,
      draftRepsText: activeSet.draftRepsText,
    });

    if (!nextFocusTarget) {
      return;
    }

    const inputKey = `${activeExercise.slotId}:${activeSet.setIndex}`;
    const timeout = setTimeout(() => {
      if (nextFocusTarget === 'load') {
        weightInputRefs.current[inputKey]?.focus();
        return;
      }

      repsInputRefs.current[inputKey]?.focus();
    }, 70);

    return () => clearTimeout(timeout);
  }, [activeExercise, activeSession, autoFocusNextInput, completedSets]);

  useEffect(() => {
    setSkippedEffortKeys([]);
    autoDismissedFirstGuideSessionRef.current = null;
    setPostEffortTransition(null);
    setExerciseInfoSlotId(null);
  }, [activeSession?.sessionId]);

  useEffect(() => {
    if (!activeEffortPrompt) {
      return;
    }

    setPostEffortTransition(null);
  }, [activeEffortPrompt?.key]);

  useEffect(() => {
    if (
      completedSets === 0 ||
      dismissedTipIds.includes(LOGGER_FIRST_SET_GUIDE_TIP_ID) ||
      autoDismissedFirstGuideSessionRef.current === activeSession?.sessionId
    ) {
      return;
    }

    autoDismissedFirstGuideSessionRef.current = activeSession?.sessionId ?? null;
    void onDismissTip(LOGGER_FIRST_SET_GUIDE_TIP_ID);
  }, [activeSession?.sessionId, completedSets, dismissedTipIds, onDismissTip]);

  if (!hydrated || isRestoring || !activeSession) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>Loading workout...</Text>
      </View>
    );
  }

  if (isSavingWorkout) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>Saving workout...</Text>
      </View>
    );
  }

  function bindWeightInput(slotId: string, rowIndex: number, input: TextInput | null) {
    weightInputRefs.current[`${slotId}:${rowIndex}`] = input;
  }

  function bindRepsInput(slotId: string, rowIndex: number, input: TextInput | null) {
    repsInputRefs.current[`${slotId}:${rowIndex}`] = input;
  }

  function handleOpenExercise(exercise: WorkoutExerciseInstance, setIndex?: number) {
    Keyboard.dismiss();
    setPostEffortTransition(null);
    setActiveExercise(exercise.slotId, typeof setIndex === 'number' ? setIndex : findFirstPendingSetIndex(exercise));
  }

  function handleWeightSubmit(exercise: WorkoutExerciseInstance, rowIndex: number) {
    repsInputRefs.current[`${exercise.slotId}:${rowIndex}`]?.focus();
  }

  function handleRepsSubmit(exercise: WorkoutExerciseInstance, rowIndex: number) {
    Keyboard.dismiss();
    completeSet(exercise.slotId, rowIndex, unitPreference);
  }

  function handleAddExercise(item: ExerciseLibraryItem) {
    if (!activeSession) {
      return;
    }

    const afterSlotId = activeSlotId ?? activeSession.exercises[activeSession.exercises.length - 1]?.slotId;
    if (!afterSlotId) {
      return;
    }

    const defaults = getExerciseTemplateDefaults(item, defaultRestSeconds);

    Keyboard.dismiss();
    insertExerciseAfter(afterSlotId, {
      exerciseName: item.name,
      role: item.category === 'compound' ? 'secondary' : 'accessory',
      progressionPriority: item.category === 'compound' ? 'medium' : 'low',
      trackingMode: getTrackingModeForLibraryItem(item),
      sets: defaults.targetSets,
      repsMin: defaults.repMin,
      repsMax: defaults.repMax,
      restSecondsMin: defaults.restSeconds,
      restSecondsMax: defaults.restSeconds,
      substitutionGroup: `session_added_${item.id}`,
      libraryItemId: item.id,
    });
    setShowAddExercise(false);
  }

  function handleRecordEffort(effort: WorkoutSetEffort) {
    if (!activeEffortPrompt || !activeSession) {
      return;
    }

    const completedExercise = activeSession.exercises.find((exercise) => exercise.slotId === activeEffortPrompt.slotId) ?? null;
    const completedSet =
      completedExercise?.sets.find((set) => set.setIndex === activeEffortPrompt.setIndex && set.status === 'completed') ?? null;
    const nextTransitionExercise =
      activeExercise && getPendingSetNumber(activeExercise) ? activeExercise : nextUpExercise;
    const nextSetNumber = getPendingSetNumber(nextTransitionExercise);
    const adaptiveCoach =
      hasAdaptiveCoachPremium && completedExercise && completedSet && nextTransitionExercise && nextSetNumber
        ? buildAdaptiveCoachRecommendation({
            completedExercise,
            completedSet,
            effort,
            nextExercise: nextTransitionExercise,
            nextSetNumber,
            unitPreference,
            previousEntries: previousEntriesBySlot[completedExercise.slotId] ?? [],
          })
        : null;

    if (adaptiveCoach && (restTimerStatus === 'running' || restTimerStatus === 'paused')) {
      overrideRestTimer(adaptiveCoach.suggestedRestSeconds);
    }

    if (nextTransitionExercise && nextSetNumber) {
      setPostEffortTransition({
        effort,
        completedExerciseName: activeEffortPrompt.exerciseName,
        completedSetNumber: activeEffortPrompt.setNumber,
        nextExercise: nextTransitionExercise,
        nextSetNumber,
        adaptiveCoach,
        adaptiveCoachLocked: !hasAdaptiveCoachPremium,
      });
    } else {
      setPostEffortTransition(null);
    }

    recordSetEffort(activeEffortPrompt.slotId, activeEffortPrompt.setIndex, effort);
    if (!dismissedTipIds.includes(LOGGER_EFFORT_GUIDE_TIP_ID)) {
      void onDismissTip(LOGGER_EFFORT_GUIDE_TIP_ID);
    }
  }

  function handleSkipEffortPrompt() {
    if (!activeEffortPrompt) {
      return;
    }

    setPostEffortTransition(null);
    setSkippedEffortKeys((current) =>
      current.includes(activeEffortPrompt.key) ? current : [...current, activeEffortPrompt.key],
    );
    if (!dismissedTipIds.includes(LOGGER_EFFORT_GUIDE_TIP_ID)) {
      void onDismissTip(LOGGER_EFFORT_GUIDE_TIP_ID);
    }
  }

  const swapTarget = activeSession.exercises.find((exercise) => exercise.slotId === swapSlotId) ?? null;
  const noteTarget = activeSession.exercises.find((exercise) => exercise.slotId === noteSlotId) ?? null;
  const exerciseInfoTarget = activeSession.exercises.find((exercise) => exercise.slotId === exerciseInfoSlotId) ?? null;
  const activeSwapOptions = activeExercise
    ? buildTailoredSwapOptions(getAllowedSwaps(activeExercise.substitutionGroup), tailoringPreferences)
    : [];
  const swapTargetOptions = swapTarget
    ? buildTailoredSwapOptions(getAllowedSwaps(swapTarget.substitutionGroup), tailoringPreferences)
    : [];
  const swapBadgeLabels = useMemo(
    () => buildTailoringBadgeLabels(tailoringPreferences).slice(0, 3),
    [tailoringPreferences],
  );
  const exerciseInfoLibraryItem = exerciseInfoTarget
    ? libraryItemById.get(
        exerciseInfoTarget.libraryItemId ??
          libraryIdByName.get(normalizeName(exerciseInfoTarget.exerciseName)) ??
          '',
      ) ?? null
    : null;
  const hasPersistableWorkoutData = loggedExercises > 0;
  const durationMinutes = Math.max(
    1,
    Math.round((new Date().getTime() - new Date(activeSession.startedAt).getTime()) / 60000) || 1,
  );

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title={activeSession.templateName}
        onBack={onBack}
        rightActionLabel="Finish"
        onRightActionPress={() => {
          Keyboard.dismiss();
          setFinishReviewVisible(true);
        }}
      />

      <WorkoutSummaryBar
        elapsedSeconds={activeSession.elapsedSeconds}
        completedSets={completedSets}
        totalVolume={totalVolume}
        unitPreference={unitPreference}
        flowTrail={flowTrail}
        currentPhaseLabel={currentPhase ? `${currentPhase.label} now` : 'Workout'}
        statusMeta={statusMeta}
        restSecondsRemaining={remainingSeconds}
        restPaused={restTimerPaused}
        onDismissRest={clearRestTimer}
        onPauseRest={restTimerStatus === 'running' ? pauseRestTimer : undefined}
        onResumeRest={restTimerPaused ? resumeRestTimer : undefined}
      />

      {showSessionStartCard && activeExercise ? (
        <View style={styles.inlineTipWrap}>
          <Pressable
            onPress={() => {
              handleOpenExercise(activeExercise, activeSession.ui.activeSetIndex);
              if (showFirstSessionCoach) {
                void onDismissTip(LOGGER_FIRST_SET_GUIDE_TIP_ID);
              }
            }}
            style={styles.sessionStartCard}
          >
            <View style={styles.sessionStartTopRow}>
              <View style={styles.sessionStartCopy}>
                <Text style={styles.sessionStartKicker}>Today starts here</Text>
                <Text style={styles.sessionStartTitle}>{activeExercise.exerciseName}</Text>
                <Text style={styles.sessionStartBody}>
                  {activePendingSetNumber
                    ? `Set ${activePendingSetNumber} of ${activeExercise.sets.length} | ${activePendingSet?.plannedRepsMin}-${activePendingSet?.plannedRepsMax} reps`
                    : `${activeExercise.sets.length} sets queued`}
                </Text>
              </View>
              <WorkoutSceneGraphic variant="today" accent="blue" compact style={styles.sessionStartVisual} />
            </View>

            <View style={styles.sessionStartSignalRow}>
              <View style={styles.sessionStartSignalCard}>
                <Text style={styles.sessionStartSignalLabel}>Do now</Text>
                <Text style={styles.sessionStartSignalValue}>Load + reps</Text>
                <Text style={styles.sessionStartSignalMeta}>Then tap Done</Text>
              </View>
              <View style={styles.sessionStartSignalCard}>
                <Text style={styles.sessionStartSignalLabel}>Then</Text>
                <Text style={styles.sessionStartSignalValue}>
                  {nextUpExercise ? nextUpExercise.exerciseName : 'Keep moving'}
                </Text>
                <Text style={styles.sessionStartSignalMeta}>
                  {nextUpExercise ? formatWorkoutExerciseQueueMeta(nextUpExercise) : 'One move at a time'}
                </Text>
              </View>
            </View>

            {showFirstSessionCoach ? (
              <Text style={styles.sessionStartHint}>First workout: just finish the set cleanly. The rest unfolds from there.</Text>
            ) : null}
          </Pressable>
        </View>
      ) : null}

      {showEffortPrompt && activeEffortPrompt ? (
        <View style={styles.inlineTipWrap}>
          <View style={[styles.coachCard, styles.coachCardEffort]}>
            <Text style={styles.coachKicker}>Quick effort check</Text>
            <Text style={styles.coachTitle}>How was that?</Text>
            <Text style={styles.coachBody} numberOfLines={2}>
              {activeEffortPrompt.exerciseName} | Set {activeEffortPrompt.setNumber}
            </Text>
            {!dismissedTipIds.includes(LOGGER_EFFORT_GUIDE_TIP_ID) ? (
              <Text style={styles.coachSupport}>Quick signal for the next week.</Text>
            ) : null}
            <View style={styles.effortOptionsRow}>
              {EFFORT_OPTIONS.map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() => handleRecordEffort(option.value)}
                  hitSlop={8}
                  style={[
                    styles.effortOptionButton,
                    option.value === 'easy' && styles.effortOptionButtonEasy,
                    option.value === 'good' && styles.effortOptionButtonGood,
                    option.value === 'hard' && styles.effortOptionButtonHard,
                  ]}
                >
                  <Text style={styles.effortOptionText}>{option.label}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable hitSlop={8} onPress={handleSkipEffortPrompt} style={styles.effortSkipButton}>
              <Text style={styles.effortSkipText}>Skip for now</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {showRestTransition && postEffortTransition ? (
        <View style={styles.inlineTipWrap}>
          <Pressable
            onPress={() => handleOpenExercise(postEffortTransition.nextExercise, postEffortTransition.nextSetNumber - 1)}
            style={styles.restTransitionCard}
          >
            <View style={styles.restTransitionHeader}>
              <View>
                <Text style={styles.restTransitionKicker}>Reset, then go</Text>
                <Text style={styles.restTransitionTitle}>
                  {typeof remainingSeconds === 'number'
                    ? `Rest, then ${postEffortTransition.nextExercise.exerciseName}`
                    : `${postEffortTransition.nextExercise.exerciseName} is ready`}
                </Text>
              </View>
              <View style={styles.restTransitionTimerPill}>
                <Text style={styles.restTransitionTimerLabel}>
                  {typeof remainingSeconds === 'number' ? (restTimerPaused ? 'Paused' : 'Rest') : 'Next'}
                </Text>
                <Text style={styles.restTransitionTimerValue}>
                  {typeof remainingSeconds === 'number' ? `${remainingSeconds}s` : 'Ready'}
                </Text>
              </View>
            </View>

            <View style={styles.restTransitionBody}>
              {postEffortTransition.adaptiveCoach || postEffortTransition.adaptiveCoachLocked ? (
                <View
                  style={[
                    styles.adaptiveCoachCard,
                    postEffortTransition.adaptiveCoach?.tone === 'push' && styles.adaptiveCoachCardPush,
                    postEffortTransition.adaptiveCoach?.tone === 'steady' && styles.adaptiveCoachCardSteady,
                    postEffortTransition.adaptiveCoach?.tone === 'recovery' && styles.adaptiveCoachCardRecovery,
                    postEffortTransition.adaptiveCoachLocked && styles.adaptiveCoachCardLocked,
                  ]}
                >
                  <View style={styles.adaptiveCoachHeader}>
                    <View style={styles.adaptiveCoachCopy}>
                      <Text style={styles.adaptiveCoachKicker}>
                        {postEffortTransition.adaptiveCoachLocked ? 'Adaptive Coach Premium' : 'Adaptive Coach'}
                      </Text>
                      <Text style={styles.adaptiveCoachTitle}>
                        {postEffortTransition.adaptiveCoachLocked
                          ? 'Unlock next-set guidance'
                          : postEffortTransition.adaptiveCoach?.title}
                      </Text>
                    </View>
                    <View style={styles.adaptiveCoachBadge}>
                      <Text style={styles.adaptiveCoachBadgeText}>
                        {postEffortTransition.adaptiveCoachLocked
                          ? 'Locked'
                          : `${postEffortTransition.adaptiveCoach?.suggestedRestSeconds ?? 0}s`}
                      </Text>
                    </View>
                  </View>

                  {postEffortTransition.adaptiveCoachLocked ? (
                    <>
                      <Text style={styles.adaptiveCoachMeta}>
                        Premium adds smarter rest, next-set targets, and quick session adjustments after each effort check.
                      </Text>
                      <Text style={styles.adaptiveCoachRationale}>Open Premium to unlock the preview and test it live in the logger.</Text>
                      {onOpenAdaptiveCoachPremium ? (
                        <Pressable
                          onPress={(event) => {
                            event.stopPropagation();
                            onOpenAdaptiveCoachPremium();
                          }}
                          style={styles.adaptiveCoachAction}
                        >
                          <Text style={styles.adaptiveCoachActionText}>See premium</Text>
                        </Pressable>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <Text style={styles.adaptiveCoachMeta}>{postEffortTransition.adaptiveCoach?.targetLine}</Text>
                      <Text style={styles.adaptiveCoachMeta}>{postEffortTransition.adaptiveCoach?.restLine}</Text>
                      <Text style={styles.adaptiveCoachRationale}>{postEffortTransition.adaptiveCoach?.rationale}</Text>
                    </>
                  )}
                </View>
              ) : null}

              <View style={styles.restTransitionSignalCard}>
                <Text style={styles.restTransitionSignalLabel}>Last set</Text>
                <Text style={styles.restTransitionSignalValue}>
                  {postEffortTransition.completedExerciseName} | Set {postEffortTransition.completedSetNumber}
                </Text>
                <View style={styles.restTransitionEffortPill}>
                  <Text style={styles.restTransitionEffortText}>
                    {formatEffortSignal(postEffortTransition.effort)}
                  </Text>
                </View>
              </View>

              <View style={styles.restTransitionSignalCard}>
                <Text style={styles.restTransitionSignalLabel}>Next lift</Text>
                <Text style={styles.restTransitionSignalValue}>
                  {postEffortTransition.nextExercise.exerciseName}
                </Text>
                <Text style={styles.restTransitionSignalMeta}>
                  Set {postEffortTransition.nextSetNumber} of {postEffortTransition.nextExercise.sets.length} |{' '}
                  {formatWorkoutExerciseQueueMeta(postEffortTransition.nextExercise)}
                </Text>
              </View>
            </View>
          </Pressable>
        </View>
      ) : null}

      {showGenericInlineTip && inlineTip ? (
        <View style={styles.inlineTipWrap}>
          <InlineTip
            title={inlineTip.title}
            body={inlineTip.body}
            accent={inlineTip.accent}
            onDismiss={inlineTip.onDismiss}
            compact
          />
        </View>
      ) : null}

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={styles.exerciseList}>
          {activeExercise ? (
            <WorkoutExerciseCard
              key={activeExercise.slotId}
              exercise={activeExercise}
              previousEntries={previousEntriesBySlot[activeExercise.slotId]}
              unitPreference={unitPreference}
              activeSetIndex={activeSession.ui.activeSetIndex}
              isActiveExercise
              onLayout={(event) => {
                exerciseOffsets.current[activeExercise.slotId] = event.nativeEvent.layout.y;
              }}
              onActivateExercise={() => handleOpenExercise(activeExercise)}
              onActivateRow={(rowIndex) => handleOpenExercise(activeExercise, rowIndex)}
              onWeightChange={(rowIndex, value) => updateSetDraft(activeExercise.slotId, rowIndex, { loadText: value })}
              onRepsChange={(rowIndex, value) => updateSetDraft(activeExercise.slotId, rowIndex, { repsText: value })}
              onCompleteRow={(rowIndex) => {
                Keyboard.dismiss();
                completeSet(activeExercise.slotId, rowIndex, unitPreference);
              }}
              onUndoRow={(rowIndex) => undoSet(activeExercise.slotId, rowIndex)}
              onRepeatLastSet={(rowIndex) => {
                Keyboard.dismiss();
                repeatLastSet(activeExercise.slotId, rowIndex, unitPreference);
              }}
              onAddSet={() => {
                Keyboard.dismiss();
                addSet(activeExercise.slotId);
              }}
              bindWeightInput={(rowIndex, input) => bindWeightInput(activeExercise.slotId, rowIndex, input)}
              bindRepsInput={(rowIndex, input) => bindRepsInput(activeExercise.slotId, rowIndex, input)}
              onWeightSubmit={(rowIndex) => handleWeightSubmit(activeExercise, rowIndex)}
              onRepsSubmit={(rowIndex) => handleRepsSubmit(activeExercise, rowIndex)}
            />
          ) : null}

          {nextUpExercise ? (
            <View style={styles.queueSection}>
              <View style={styles.queueSectionHeader}>
                <Text style={styles.queueSectionTitle}>Next up</Text>
                <Text style={styles.queueSectionMeta}>
                  {nextUpIndex >= 0 ? `Move ${nextUpIndex + 1}` : 'Tap to open'}
                </Text>
              </View>
              <WorkoutQueueItem
                exercise={nextUpExercise}
                phase={getWorkoutFlowPhase(activeSession.exercises, nextUpExercise.slotId)}
                summary={formatWorkoutExerciseQueueMeta(nextUpExercise)}
                positionLabel={nextUpIndex >= 0 ? `Move ${nextUpIndex + 1}` : 'Queued'}
                isNextUp
                onPress={() => handleOpenExercise(nextUpExercise)}
              />
            </View>
          ) : null}

          {laterQueueExercises.length > 0 ? (
            <View style={styles.queueSection}>
              <View style={styles.queueSectionHeader}>
                <Text style={styles.queueSectionTitle}>Later in workout</Text>
                <Text style={styles.queueSectionMeta}>{pluralize(laterQueueExercises.length, 'move')} queued</Text>
              </View>
              <View style={styles.queueList}>
                {laterQueueExercises.map((exercise) => (
                  <WorkoutQueueItem
                    key={exercise.slotId}
                    exercise={exercise}
                    phase={getWorkoutFlowPhase(activeSession.exercises, exercise.slotId)}
                    summary={formatWorkoutExerciseQueueMeta(exercise)}
                    positionLabel={
                      activeSession.exercises.findIndex((item) => item.slotId === exercise.slotId) >= 0
                        ? `Move ${activeSession.exercises.findIndex((item) => item.slotId === exercise.slotId) + 1}`
                        : 'Queued'
                    }
                    onPress={() => handleOpenExercise(exercise)}
                  />
                ))}
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View style={styles.bottomStack}>
        <Pressable
          onPress={() => {
            Keyboard.dismiss();
            setShowMoreActions(true);
          }}
          disabled={!activeExercise}
          style={[styles.moreButton, !activeExercise && styles.moreButtonDisabled]}
        >
          <Text style={[styles.moreButtonText, !activeExercise && styles.moreButtonTextDisabled]}>More</Text>
        </Pressable>
      </View>

      <AddExerciseSheet
        visible={showAddExercise}
        items={exerciseLibrary}
        recentItems={recentExerciseLibraryItems}
        currentItemIds={currentItemIds}
        selectedIds={currentItemIds}
        title="Add Exercise"
        subtitle={activeExercise ? `Insert after ${activeExercise.exerciseName}` : 'Insert into this session'}
        actionLabel="Insert"
        onClose={() => setShowAddExercise(false)}
        onSelectItem={handleAddExercise}
      />

      {showMoreActions && activeExercise ? (
        <InlineSheet title={activeExercise.exerciseName} onClose={() => setShowMoreActions(false)}>
          <Pressable
            onPress={() => {
              Keyboard.dismiss();
              setShowMoreActions(false);
              setExerciseInfoSlotId(activeExercise.slotId);
            }}
            style={styles.sheetRow}
          >
            <Text style={styles.sheetRowText}>Exercise info</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              Keyboard.dismiss();
              setShowMoreActions(false);
              setShowAddExercise(true);
            }}
            style={styles.sheetRow}
          >
            <Text style={styles.sheetRowText}>Add exercise after this</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              Keyboard.dismiss();
              setShowMoreActions(false);
              setNoteSlotId(activeExercise.slotId);
              setNotesDraft(activeExercise.notes ?? '');
            }}
            style={styles.sheetRow}
          >
            <Text style={styles.sheetRowText}>{activeExercise.notes ? 'Edit note' : 'Add note'}</Text>
          </Pressable>
          {activeSwapOptions.length > 0 ? (
            <Pressable
              onPress={() => {
                Keyboard.dismiss();
                setShowMoreActions(false);
                setSwapSlotId(activeExercise.slotId);
              }}
              style={styles.sheetRow}
            >
              <Text style={styles.sheetRowText}>Swap exercise</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => {
              Keyboard.dismiss();
              skipExercise(activeExercise.slotId);
              setShowMoreActions(false);
            }}
            style={styles.sheetRow}
          >
            <Text style={styles.sheetRowText}>Skip exercise</Text>
          </Pressable>
        </InlineSheet>
      ) : null}

      {exerciseInfoTarget ? (
        <ExerciseInfoSheet
          exercise={exerciseInfoTarget}
          previousEntries={previousEntriesBySlot[exerciseInfoTarget.slotId] ?? []}
          libraryItem={exerciseInfoLibraryItem}
          unitPreference={unitPreference}
          activeSetIndex={
            exerciseInfoTarget.slotId === activeSlotId
              ? activeSession.ui.activeSetIndex
              : findFirstPendingSetIndex(exerciseInfoTarget)
          }
          onClose={() => setExerciseInfoSlotId(null)}
        />
      ) : null}

      {swapTarget ? (
        <InlineSheet title={`Swap ${swapTarget.exerciseName}`} onClose={() => setSwapSlotId(null)}>
          <View style={styles.swapSheetHeader}>
            <Text style={styles.swapSheetTitle}>Ranked for your setup</Text>
            <Text style={styles.swapSheetBody}>
              Gymlog is using your equipment fit and joint-friendly preferences to push the best-matching swaps up first.
            </Text>
            {swapBadgeLabels.length ? (
              <View style={styles.swapSheetBadgeRow}>
                {swapBadgeLabels.map((label) => (
                  <BadgePill key={label} accent="orange" label={label} />
                ))}
              </View>
            ) : null}
          </View>
          {swapTargetOptions.length ? (
            swapTargetOptions.map((option) => (
              <Pressable
                key={option.exerciseName}
                onPress={() => {
                  Keyboard.dismiss();
                  swapExercise(swapTarget.slotId, option.exerciseName, swapTarget.substitutionGroup);
                  setSwapSlotId(null);
                }}
                style={styles.sheetRow}
              >
                <Text style={styles.sheetRowText}>{option.exerciseName}</Text>
                {option.reason ? (
                  <View style={styles.sheetRowMetaBlock}>
                    <Text style={styles.sheetRowMetaKicker}>Why this fits you</Text>
                    <Text style={styles.sheetRowMeta}>{option.reason}</Text>
                  </View>
                ) : null}
              </Pressable>
            ))
          ) : (
            <Text style={styles.sheetEmpty}>No quick swaps for this exercise yet.</Text>
          )}
        </InlineSheet>
      ) : null}

      {noteTarget ? (
        <InlineSheet title={`Notes for ${noteTarget.exerciseName}`} onClose={() => setNoteSlotId(null)}>
          <TextInput
            value={notesDraft}
            onChangeText={setNotesDraft}
            placeholder="Add a short note"
            placeholderTextColor={colors.textMuted}
            multiline
            style={styles.notesInput}
            selectionColor={colors.accent}
          />
          <Pressable
            onPress={() => {
              if (!noteSlotId) {
                return;
              }
              Keyboard.dismiss();
              updateNotes(noteSlotId, notesDraft.trim());
              setNoteSlotId(null);
            }}
            style={styles.sheetButton}
          >
            <Text style={styles.sheetButtonText}>Save note</Text>
          </Pressable>
        </InlineSheet>
      ) : null}

      {finishReviewVisible ? (
        <InlineSheet
          title={hasPersistableWorkoutData ? 'Finish workout' : 'Discard empty workout'}
          onClose={() => {
            if (isSavingWorkout) {
              return;
            }
            setFinishReviewVisible(false);
          }}
        >
          <Text style={styles.sheetBodyText}>
            {hasPersistableWorkoutData
              ? 'Save this workout now. The completion screen only appears after persistence succeeds.'
              : 'Nothing has been logged yet. Discard this workout and return to the workout tab.'}
          </Text>

          {hasPersistableWorkoutData ? (
            <View style={styles.finishStatsRow}>
              <View style={styles.finishStatCard}>
                <Text style={styles.finishStatLabel}>Duration</Text>
                <Text style={styles.finishStatValue}>{durationMinutes} min</Text>
              </View>
              <View style={styles.finishStatCard}>
                <Text style={styles.finishStatLabel}>Sets</Text>
                <Text style={styles.finishStatValue}>{completedSets}</Text>
              </View>
              <View style={styles.finishStatCard}>
                <Text style={styles.finishStatLabel}>Exercises</Text>
                <Text style={styles.finishStatValue}>{loggedExercises}</Text>
              </View>
            </View>
          ) : null}

          {finishErrorMessage ? <Text style={styles.finishErrorText}>{finishErrorMessage}</Text> : null}

          {hasPersistableWorkoutData ? (
            <Pressable
              onPress={onConfirmFinishWorkout}
              disabled={isSavingWorkout}
              style={[styles.sheetButton, isSavingWorkout && styles.sheetButtonDisabled]}
            >
              <Text style={styles.sheetButtonText}>{isSavingWorkout ? 'Saving...' : 'Save workout'}</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={onDiscardWorkout}
              disabled={isSavingWorkout}
              style={[styles.sheetDestructiveButton, isSavingWorkout && styles.sheetButtonDisabled]}
            >
              <Text style={styles.sheetDestructiveButtonText}>Discard workout</Text>
            </Pressable>
          )}

          <Pressable
            onPress={() => setFinishReviewVisible(false)}
            disabled={isSavingWorkout}
            style={styles.sheetRow}
          >
            <Text style={styles.sheetRowText}>Keep logging</Text>
          </Pressable>
        </InlineSheet>
      ) : null}
    </View>
  );
}

function InlineSheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <View style={styles.sheetOverlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>{title}</Text>
          <Pressable onPress={onClose}>
            <Text style={styles.sheetClose}>Close</Text>
          </Pressable>
        </View>
        <View style={styles.sheetContent}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 156,
  },
  inlineTipWrap: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 6,
  },
  sessionStartCard: {
    overflow: 'hidden',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(85, 138, 189, 0.26)',
    backgroundColor: 'rgba(16, 22, 31, 0.96)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  sessionStartTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  sessionStartCopy: {
    flex: 1,
    gap: 4,
  },
  sessionStartVisual: {
    width: 104,
  },
  sessionStartKicker: {
    color: '#9ACCFF',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sessionStartTitle: {
    color: colors.textPrimary,
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  sessionStartBody: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  sessionStartSignalRow: {
    gap: spacing.sm,
  },
  sessionStartSignalCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(10, 14, 20, 0.42)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: 3,
  },
  sessionStartSignalLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sessionStartSignalValue: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '900',
  },
  sessionStartSignalMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  sessionStartHint: {
    color: '#CFEFFF',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  coachCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 4,
  },
  coachCardGuide: {
    borderColor: 'rgba(85, 138, 189, 0.26)',
    backgroundColor: 'rgba(18, 26, 36, 0.96)',
  },
  coachCardEffort: {
    borderColor: 'rgba(191, 74, 105, 0.24)',
    backgroundColor: 'rgba(26, 20, 29, 0.96)',
  },
  coachKicker: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  coachTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  coachBody: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  coachSupport: {
    color: '#C8B7C6',
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
  },
  coachButton: {
    alignSelf: 'flex-start',
    minHeight: 34,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(85, 138, 189, 0.32)',
    backgroundColor: 'rgba(85, 138, 189, 0.16)',
    marginTop: spacing.xs,
  },
  coachButtonText: {
    color: '#8FC1F2',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  effortOptionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  effortOptionButton: {
    flex: 1,
    minHeight: 52,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  effortOptionButtonEasy: {
    borderColor: 'rgba(85, 138, 189, 0.28)',
    backgroundColor: 'rgba(85, 138, 189, 0.16)',
  },
  effortOptionButtonGood: {
    borderColor: 'rgba(150, 216, 255, 0.32)',
    backgroundColor: 'rgba(150, 216, 255, 0.16)',
  },
  effortOptionButtonHard: {
    borderColor: 'rgba(191, 74, 105, 0.30)',
    backgroundColor: 'rgba(191, 74, 105, 0.18)',
  },
  effortOptionText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '900',
  },
  effortSkipButton: {
    alignSelf: 'flex-start',
    minHeight: 36,
    paddingHorizontal: spacing.xs,
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  effortSkipText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  restTransitionCard: {
    overflow: 'hidden',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(85, 138, 189, 0.24)',
    backgroundColor: 'rgba(16, 22, 31, 0.96)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  restTransitionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  restTransitionKicker: {
    color: '#9ACCFF',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  restTransitionTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  restTransitionTimerPill: {
    minWidth: 74,
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(85, 138, 189, 0.28)',
    backgroundColor: 'rgba(85, 138, 189, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  restTransitionTimerLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  restTransitionTimerValue: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '900',
  },
  restTransitionBody: {
    gap: spacing.sm,
  },
  adaptiveCoachCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: 5,
  },
  adaptiveCoachCardPush: {
    borderColor: 'rgba(255, 167, 112, 0.28)',
    backgroundColor: 'rgba(44, 24, 12, 0.72)',
  },
  adaptiveCoachCardSteady: {
    borderColor: 'rgba(85, 138, 189, 0.28)',
    backgroundColor: 'rgba(18, 30, 42, 0.72)',
  },
  adaptiveCoachCardRecovery: {
    borderColor: 'rgba(191, 74, 105, 0.28)',
    backgroundColor: 'rgba(38, 17, 24, 0.72)',
  },
  adaptiveCoachCardLocked: {
    borderColor: 'rgba(255,255,255,0.09)',
    backgroundColor: 'rgba(10, 14, 20, 0.52)',
  },
  adaptiveCoachHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  adaptiveCoachCopy: {
    flex: 1,
    gap: 2,
  },
  adaptiveCoachKicker: {
    color: '#FFC39E',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  adaptiveCoachTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  adaptiveCoachBadge: {
    minHeight: 28,
    minWidth: 56,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(10, 14, 20, 0.42)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adaptiveCoachBadgeText: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: '900',
  },
  adaptiveCoachMeta: {
    color: colors.textPrimary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  adaptiveCoachRationale: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  adaptiveCoachAction: {
    alignSelf: 'flex-start',
    minHeight: 34,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 167, 112, 0.26)',
    backgroundColor: 'rgba(255, 167, 112, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  adaptiveCoachActionText: {
    color: '#FFC39E',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  restTransitionSignalCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(10, 14, 20, 0.42)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: 3,
  },
  restTransitionSignalLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  restTransitionSignalValue: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '900',
  },
  restTransitionSignalMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  restTransitionEffortPill: {
    alignSelf: 'flex-start',
    minHeight: 26,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(191, 74, 105, 0.26)',
    backgroundColor: 'rgba(191, 74, 105, 0.14)',
    justifyContent: 'center',
  },
  restTransitionEffortText: {
    color: '#E7A4B8',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  exerciseList: {
    gap: spacing.md,
  },
  flowCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(85, 138, 189, 0.22)',
    backgroundColor: 'rgba(18, 24, 33, 0.72)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  flowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: spacing.md,
  },
  flowKicker: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  flowTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  flowMeta: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  flowTrailRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  flowTrailPill: {
    minHeight: 30,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(60, 92, 119, 0.24)',
    backgroundColor: 'rgba(13, 19, 27, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flowTrailPillCurrent: {
    borderColor: 'rgba(85, 138, 189, 0.34)',
    backgroundColor: 'rgba(85, 138, 189, 0.14)',
  },
  flowTrailPillComplete: {
    opacity: 0.56,
  },
  flowTrailText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
  },
  flowTrailTextCurrent: {
    color: '#8FC1F2',
  },
  flowTrailTextComplete: {
    color: colors.textSecondary,
  },
  queueSection: {
    gap: spacing.sm,
  },
  queueSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  queueSectionTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  queueSectionMeta: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  queueList: {
    gap: spacing.sm,
  },
  bottomStack: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.md,
  },
  moreButton: {
    minHeight: 46,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(85, 138, 189, 0.18)',
    backgroundColor: 'rgba(18, 24, 33, 0.90)',
  },
  moreButtonDisabled: {
    opacity: 0.48,
  },
  moreButtonText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  moreButtonTextDisabled: {
    color: colors.textMuted,
  },
  sheetOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay,
  },
  sheet: {
    margin: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(85, 138, 189, 0.18)',
    backgroundColor: 'rgba(18, 24, 33, 0.92)',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    alignItems: 'center',
  },
  sheetTitle: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  sheetClose: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  sheetContent: {
    gap: spacing.sm,
  },
  sheetBodyText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  swapSheetHeader: {
    gap: spacing.xs,
  },
  swapSheetTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  swapSheetBody: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  swapSheetBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingTop: spacing.xs,
  },
  sheetRow: {
    minHeight: 54,
    justifyContent: 'center',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  sheetRowText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  sheetRowMetaBlock: {
    marginTop: spacing.xs,
    gap: 2,
  },
  sheetRowMetaKicker: {
    color: '#FFB389',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sheetRowMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  sheetEmpty: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  notesInput: {
    minHeight: 112,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    color: colors.textPrimary,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  sheetButton: {
    minHeight: 48,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentAlt,
    borderWidth: 1,
    borderColor: 'rgba(85, 138, 189, 0.28)',
  },
  sheetButtonText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  sheetButtonDisabled: {
    opacity: 0.6,
  },
  sheetDestructiveButton: {
    minHeight: 48,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: 'rgba(191, 74, 105, 0.34)',
  },
  sheetDestructiveButtonText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  finishStatsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  finishStatCard: {
    flex: 1,
    minHeight: 64,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: 3,
    justifyContent: 'center',
  },
  finishStatLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  finishStatValue: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '900',
  },
  finishErrorText: {
    color: '#F3A489',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
});






