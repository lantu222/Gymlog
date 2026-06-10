import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AddExerciseSheet } from '../components/AddExerciseSheet';
import { ExerciseInfoSheet } from '../components/ExerciseInfoSheet';
import { InlineTip } from '../components/InlineTip';
import { WorkoutExerciseCard } from '../components/WorkoutExerciseCard';
import { AdaptiveCoachRecommendation, buildAdaptiveCoachRecommendation } from '../lib/adaptiveCoach';
import { getExerciseTemplateDefaults } from '../lib/exerciseSuggestions';
import { buildTailoredSwapOptions, buildTailoringBadgeLabels, TailoringPreferencesInput } from '../lib/tailoringFit';
import { formatWorkoutExerciseQueueMeta } from '../lib/workoutFlow';
import { getActiveSetAutoFocusTarget } from '../lib/workoutLoggingFocus';
import { getWorkoutLoggingSessionBootstrapResult } from '../lib/workoutLoggingSessionBootstrap';
import { formatVolume } from '../lib/format';
import { colors, radii, spacing, typography } from '../theme';
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
const LOGGING_BACKGROUND = '#F7F3FF';
const LOGGING_PURPLE = '#7C3AED';
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

function getActiveWorkoutDisplayName(templateName: string) {
  if (/Minimal A$/i.test(templateName)) {
    return 'Day 1. Full Body';
  }

  if (/Minimal B$/i.test(templateName)) {
    return 'Day 2. Full Body';
  }

  if (/push\s*a/i.test(templateName)) {
    return 'Push A';
  }

  if (/push\s*b/i.test(templateName)) {
    return 'Push B';
  }

  if (/pull\s*a/i.test(templateName)) {
    return 'Pull A';
  }

  if (/pull\s*b/i.test(templateName)) {
    return 'Pull B';
  }

  if (/legs?\s*a/i.test(templateName)) {
    return 'Legs A';
  }

  if (/legs?\s*b/i.test(templateName)) {
    return 'Legs B';
  }

  const compactName = templateName
    .replace(/^my\s+/i, '')
    .replace(/^\d+[-\s]?day\s+/i, '')
    .replace(/\bworkout\b/gi, '')
    .replace(/\bhamstrings\b/gi, 'Hams')
    .replace(/\s+/g, ' ')
    .trim();

  return compactName || templateName;
}

function formatLoggerClock(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${minutes}:${`${seconds}`.padStart(2, '0')}`;
}

function formatExercisePrescription(exercise: WorkoutExerciseInstance) {
  const firstSet = exercise.sets[0] ?? null;
  const setCount = Math.max(1, exercise.sets.length);

  if (!firstSet) {
    return `${setCount} sets`;
  }

  return `${setCount} x ${firstSet.plannedRepsMin}-${firstSet.plannedRepsMax}`;
}

function getExerciseCompletionMeta(exercise: WorkoutExerciseInstance) {
  const completedSets = exercise.sets.filter((set) => set.status === 'completed').length;
  const totalSets = Math.max(1, exercise.sets.length);

  return `${completedSets}/${totalSets} sets`;
}

function formatRestLoggedSummary(
  activeSession: ReturnType<typeof useWorkoutContext>['activeSession'],
  target: EffortPromptTarget | null,
  unitPreference: UnitPreference,
) {
  if (!activeSession || !target) {
    return 'Set logged';
  }

  const exercise = activeSession.exercises.find((item) => item.slotId === target.slotId);
  const set = exercise?.sets.find((item) => item.setIndex === target.setIndex);

  if (!set) {
    return `Set ${target.setNumber} logged`;
  }

  const loadText = typeof set.actualLoadKg === 'number' ? `${set.actualLoadKg} ${unitPreference}` : null;
  const repsText = typeof set.actualReps === 'number' ? `${set.actualReps}` : null;
  const detailText = loadText && repsText ? ` - ${loadText} x ${repsText}` : '';

  return `Set ${target.setNumber} logged${detailText}`;
}

const WARMUP_FLOW_ITEMS = [
  { label: 'Shoulder circles', meta: '1 min - controlled range' },
  { label: 'Scapular push-up', meta: '2 x 8 slow reps' },
  { label: 'Band pull-apart', meta: '2 x 12 light tension' },
];

const COOLDOWN_FLOW_ITEMS = [
  { label: 'Doorway chest stretch', meta: '60 sec each side' },
  { label: 'Overhead triceps stretch', meta: '45 sec each side' },
  { label: 'Slow breathing reset', meta: '2 min nasal breathing' },
];

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
    expandExercise,
    collapseExercise,
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
  const restProgressValue = useRef(new Animated.Value(0)).current;

  const [showAddExercise, setShowAddExercise] = useState(false);
  const [showMoreActions, setShowMoreActions] = useState(false);
  const [exerciseInfoSlotId, setExerciseInfoSlotId] = useState<string | null>(null);
  const [swapSlotId, setSwapSlotId] = useState<string | null>(null);
  const [noteSlotId, setNoteSlotId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState('');
  const [finishReviewVisible, setFinishReviewVisible] = useState(false);
  const [skippedEffortKeys, setSkippedEffortKeys] = useState<string[]>([]);
  const [postEffortTransition, setPostEffortTransition] = useState<PostEffortTransitionState | null>(null);
  const [collapsedExerciseSlotIds, setCollapsedExerciseSlotIds] = useState<string[]>([]);
  const [warmupExpanded, setWarmupExpanded] = useState(false);
  const [cooldownExpanded, setCooldownExpanded] = useState(false);
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
  const animatedRestDurationSeconds = Math.max(1, activeSession?.restTimer.durationSeconds || defaultRestSeconds);
  const animatedRestProgressRatio =
    typeof remainingSeconds === 'number' ? Math.max(0, Math.min(1, 1 - remainingSeconds / animatedRestDurationSeconds)) : 0;

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
  const nextExercise = useMemo(() => selectNextExercise(activeSession), [activeSession]);
  const nextUpExercise = nextExercise;
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
  const showRestTransition =
    Boolean(postEffortTransition) &&
    !overlaySurfaceOpen;
  const showGenericInlineTip =
    Boolean(inlineTip) && !isFirstSession && !showFirstSessionCoach && !showRestTransition;

  useEffect(() => {
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
  }, [activeSlotId]);

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
    setCollapsedExerciseSlotIds([]);
    setWarmupExpanded(false);
    setCooldownExpanded(false);
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

  useEffect(() => {
    Animated.timing(restProgressValue, {
      toValue: animatedRestProgressRatio,
      duration: 650,
      useNativeDriver: true,
    }).start();
  }, [animatedRestProgressRatio, restProgressValue]);

  if (!hydrated || isRestoring || !activeSession) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>Loading workout...</Text>
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
    setCollapsedExerciseSlotIds((current) => current.filter((slotId) => slotId !== exercise.slotId));
    expandExercise(exercise.slotId);
    setActiveExercise(exercise.slotId, typeof setIndex === 'number' ? setIndex : findFirstPendingSetIndex(exercise));
  }

  function handleToggleExercise(exercise: WorkoutExerciseInstance) {
    Keyboard.dismiss();
    setPostEffortTransition(null);

    const isOpen = activeSlotId === exercise.slotId && !collapsedExerciseSlotIds.includes(exercise.slotId);
    if (isOpen) {
      setCollapsedExerciseSlotIds((current) =>
        current.includes(exercise.slotId) ? current : [...current, exercise.slotId],
      );
      collapseExercise(exercise.slotId);
      return;
    }

    setCollapsedExerciseSlotIds((current) => current.filter((slotId) => slotId !== exercise.slotId));
    expandExercise(exercise.slotId);
    setActiveExercise(exercise.slotId, findFirstPendingSetIndex(exercise));
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
  const workoutExerciseRows = activeSession.exercises;
  const restingVisible = typeof remainingSeconds === 'number';
  const restDurationSeconds = Math.max(1, activeSession.restTimer.durationSeconds || defaultRestSeconds);
  const restLoggedSummary = formatRestLoggedSummary(activeSession, activeEffortPrompt, unitPreference);
  const restOrbitRotation = restProgressValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const elapsedText = formatLoggerClock(activeSession.elapsedSeconds);
  const volumeText = formatVolume(totalVolume, unitPreference);
  const elapsedIsLong = elapsedText.length >= 7;
  const volumeIsLong = volumeText.length >= 7;

  if (restingVisible) {
    return (
      <View style={styles.fullRestTimerScreen}>
        <View style={styles.fullRestTimerTop}>
          <View style={styles.fullRestTimerTitleBlock}>
            <Text style={styles.fullRestTimerWorkoutName}>{getActiveWorkoutDisplayName(activeSession.templateName)}</Text>
            <Text style={styles.fullRestTimerLoggedText} numberOfLines={1}>
              {restLoggedSummary}
            </Text>
          </View>
        </View>

        <View style={styles.fullRestTimerCenter}>
          <View style={styles.fullRestTimerRing}>
            <Animated.View style={[styles.fullRestTimerOrbit, { transform: [{ rotate: restOrbitRotation }] }]}>
              <View style={styles.fullRestTimerOrbitDot} />
            </Animated.View>
            <Text style={styles.fullRestTimerKicker}>REST</Text>
            <Text style={styles.fullRestTimerValue}>{formatLoggerClock(remainingSeconds)}</Text>
            <Text style={styles.fullRestTimerTotal}>of {formatLoggerClock(restDurationSeconds)} rest</Text>
          </View>
        </View>

        <View style={styles.fullRestTimerBottom}>
          <Pressable accessibilityRole="button" accessibilityLabel="Skip rest and start next set" onPress={clearRestTimer} style={styles.fullRestTimerSkipButton}>
            <Text style={styles.fullRestTimerSkipText}>Skip Rest</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.activeWorkoutHeader}>
        <View style={styles.activeWorkoutTitleBlock}>
          <Text style={styles.activeWorkoutKicker}>ACTIVE WORKOUT</Text>
          <Text style={styles.activeWorkoutTitle} numberOfLines={1}>
            {getActiveWorkoutDisplayName(activeSession.templateName)}
          </Text>
        </View>
      </View>

      <View style={styles.liveStatsCard}>
        <View style={[styles.liveStat, styles.liveStatDuration]}>
          <Text style={[styles.liveStatValue, elapsedIsLong && styles.liveStatValueLong]} numberOfLines={1}>
            {elapsedText}
          </Text>
          <Text style={styles.liveStatLabel}>Duration</Text>
        </View>
        <View style={styles.liveStatDivider} />
        <View style={[styles.liveStat, styles.liveStatSets]}>
          <Text style={styles.liveStatValue} numberOfLines={1}>{completedSets}</Text>
          <Text style={styles.liveStatLabel}>Sets</Text>
        </View>
        <View style={styles.liveStatDivider} />
        <View style={[styles.liveStat, styles.liveStatVolume]}>
          <Text style={[styles.liveStatValue, volumeIsLong && styles.liveStatValueLong]} numberOfLines={1}>
            {volumeText}
          </Text>
          <Text style={styles.liveStatLabel}>Volume</Text>
        </View>
      </View>

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
          <Pressable onPress={() => setWarmupExpanded((current) => !current)} style={styles.sessionQueueRow}>
            <View style={[styles.sessionQueueBadge, styles.sessionWarmupBadge]}>
              <Text style={styles.sessionWarmupText}>WU</Text>
            </View>
            <View style={styles.sessionQueueCopy}>
              <View style={styles.sessionQueueTitleRow}>
                <Text style={styles.sessionQueueTitle}>Warm-up</Text>
              </View>
              <Text style={styles.sessionQueueMeta}>5 min - Mobility + activation</Text>
            </View>
          </Pressable>
          {warmupExpanded ? (
            <View style={styles.sessionFlowDetails}>
              {WARMUP_FLOW_ITEMS.map((item, itemIndex) => (
                <View key={item.label} style={styles.sessionFlowStep}>
                  <View style={styles.sessionFlowStepBadge}>
                    <Text style={styles.sessionFlowStepBadgeText}>{itemIndex + 1}</Text>
                  </View>
                  <View style={styles.sessionQueueCopy}>
                    <Text style={styles.sessionFlowStepTitle}>{item.label}</Text>
                    <Text style={styles.sessionFlowStepMeta}>{item.meta}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          {workoutExerciseRows.map((exercise, exerciseIndex) => {
            const isActiveRow = exercise.slotId === activeSlotId;
            const isExpandedRow = isActiveRow && !collapsedExerciseSlotIds.includes(exercise.slotId);
            const isNextRow = exercise.slotId === nextUpExercise?.slotId;

            if (isExpandedRow) {
              return (
                <WorkoutExerciseCard
                  key={exercise.slotId}
                  exercise={exercise}
                  previousEntries={previousEntriesBySlot[exercise.slotId]}
                  unitPreference={unitPreference}
                  activeSetIndex={activeSession.ui.activeSetIndex}
                  isActiveExercise
                  onLayout={(event) => {
                    exerciseOffsets.current[exercise.slotId] = event.nativeEvent.layout.y;
                  }}
                  onActivateExercise={() => handleToggleExercise(exercise)}
                  onActivateRow={(rowIndex) => handleOpenExercise(exercise, rowIndex)}
                  onWeightChange={(rowIndex, value) => updateSetDraft(exercise.slotId, rowIndex, { loadText: value })}
                  onRepsChange={(rowIndex, value) => updateSetDraft(exercise.slotId, rowIndex, { repsText: value })}
                  onCompleteRow={(rowIndex) => {
                    Keyboard.dismiss();
                    completeSet(exercise.slotId, rowIndex, unitPreference);
                  }}
                  onUndoRow={(rowIndex) => undoSet(exercise.slotId, rowIndex)}
                  onRepeatLastSet={(rowIndex) => {
                    Keyboard.dismiss();
                    repeatLastSet(exercise.slotId, rowIndex, unitPreference);
                  }}
                  onAddSet={() => {
                    Keyboard.dismiss();
                    addSet(exercise.slotId);
                  }}
                  bindWeightInput={(rowIndex, input) => bindWeightInput(exercise.slotId, rowIndex, input)}
                  bindRepsInput={(rowIndex, input) => bindRepsInput(exercise.slotId, rowIndex, input)}
                  onWeightSubmit={(rowIndex) => handleWeightSubmit(exercise, rowIndex)}
                  onRepsSubmit={(rowIndex) => handleRepsSubmit(exercise, rowIndex)}
                />
              );
            }

            const completed = exercise.status === 'completed' || exercise.status === 'skipped';
            const started = exercise.sets.some((set) => set.status === 'completed');

            return (
              <Pressable
                key={exercise.slotId}
                onPress={() => handleToggleExercise(exercise)}
                style={[styles.sessionQueueRow, completed && styles.sessionExerciseDoneRow]}
              >
                <View style={[styles.sessionQueueBadge, completed && styles.sessionQueueBadgeDone]}>
                  <Text style={[styles.sessionQueueBadgeText, completed && styles.sessionQueueBadgeTextDone]}>{exerciseIndex + 1}</Text>
                </View>
                <View style={styles.sessionQueueCopy}>
                  <View style={styles.sessionQueueTitleRow}>
                    <Text style={styles.sessionQueueTitle} numberOfLines={1}>{exercise.exerciseName}</Text>
                    {isNextRow ? (
                      <View style={styles.sessionNextChip}>
                        <Text style={styles.sessionNextChipText}>NEXT</Text>
                      </View>
                    ) : null}
                    {started && !completed ? (
                      <View style={styles.sessionLaterChip}>
                        <Text style={styles.sessionLaterChipText}>{getExerciseCompletionMeta(exercise)}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.sessionQueueMeta}>
                    {completed || started ? getExerciseCompletionMeta(exercise) : formatExercisePrescription(exercise)}
                  </Text>
                </View>
              </Pressable>
            );
          })}

          <Pressable onPress={() => setCooldownExpanded((current) => !current)} style={[styles.sessionQueueRow, styles.cooldownRow]}>
            <View style={styles.sessionQueueBadge}>
              <Text style={styles.sessionCooldownIcon}>CD</Text>
            </View>
            <View style={styles.sessionQueueCopy}>
              <View style={styles.sessionQueueTitleRow}>
                <Text style={styles.sessionQueueTitle}>Cool-down</Text>
                <View style={styles.sessionLaterChip}>
                  <Text style={styles.sessionLaterChipText}>LATER</Text>
                </View>
              </View>
              <Text style={styles.sessionQueueMeta}>5 min - Stretch & breathe</Text>
            </View>
          </Pressable>
          {cooldownExpanded ? (
            <View style={styles.sessionFlowDetails}>
              {COOLDOWN_FLOW_ITEMS.map((item, itemIndex) => (
                <View key={item.label} style={styles.sessionFlowStep}>
                  <View style={styles.sessionFlowStepBadge}>
                    <Text style={styles.sessionFlowStepBadgeText}>{itemIndex + 1}</Text>
                  </View>
                  <View style={styles.sessionQueueCopy}>
                    <Text style={styles.sessionFlowStepTitle}>{item.label}</Text>
                    <Text style={styles.sessionFlowStepMeta}>{item.meta}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          <Pressable
            onPress={() => {
              Keyboard.dismiss();
              setShowAddExercise(true);
            }}
            style={styles.addExerciseButton}
          >
            <Text style={styles.addExerciseButtonText}>+ Add exercise</Text>
          </Pressable>
        </View>
      </ScrollView>

      <View style={styles.bottomStack}>
        <Pressable
          onPress={() => {
            Keyboard.dismiss();
            setFinishReviewVisible(true);
          }}
          style={styles.finishWorkoutButton}
        >
          <Text style={styles.finishWorkoutButtonText}>Finish workout</Text>
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
              GAINER is using your equipment fit and joint-friendly preferences to push the best-matching swaps up first.
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
    backgroundColor: LOGGING_BACKGROUND,
  },
  loadingText: {
    fontFamily: typography.fontFamily,
    color: '#111827',
    fontSize: 16,
    fontWeight: '700',
  },
  screen: {
    flex: 1,
    backgroundColor: LOGGING_BACKGROUND,
  },
  fullRestTimerScreen: {
    flex: 1,
    backgroundColor: '#4C1D95',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  fullRestTimerTop: {
    minHeight: 86,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  fullRestTimerTitleBlock: {
    alignItems: 'center',
    paddingTop: 6,
  },
  fullRestTimerWorkoutName: {
    fontFamily: typography.fontFamily,
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  fullRestTimerLoggedText: {
    fontFamily: typography.fontFamily,
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
  },
  fullRestTimerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullRestTimerRing: {
    width: 274,
    height: 274,
    borderRadius: 137,
    borderWidth: 13,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullRestTimerOrbit: {
    position: 'absolute',
    width: 274,
    height: 274,
    borderRadius: 137,
    alignItems: 'center',
  },
  fullRestTimerOrbitDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    marginTop: -1,
  },
  fullRestTimerKicker: {
    fontFamily: typography.fontFamily,
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    letterSpacing: 2.4,
  },
  fullRestTimerValue: {
    fontFamily: typography.fontFamily,
    color: '#FFFFFF',
    fontSize: 66,
    lineHeight: 76,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  fullRestTimerTotal: {
    fontFamily: typography.fontFamily,
    color: 'rgba(255,255,255,0.66)',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  fullRestTimerBottom: {
    gap: 0,
  },
  fullRestTimerSkipButton: {
    minHeight: 58,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  fullRestTimerSkipText: {
    fontFamily: typography.fontFamily,
    color: '#5B21B6',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
  },
  activeWorkoutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
  },
  activeWorkoutTitleBlock: {
    flex: 1,
    gap: 3,
  },
  activeWorkoutKicker: {
    fontFamily: typography.fontFamily,
    color: LOGGING_PURPLE,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '900',
    letterSpacing: 1.6,
  },
  activeWorkoutTitle: {
    fontFamily: typography.fontFamily,
    color: '#111827',
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '800',
  },
  liveStatsCard: {
    minHeight: 88,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E4D8FF',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  liveStat: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 2,
    minWidth: 0,
  },
  liveStatDuration: {
    flex: 1.35,
  },
  liveStatSets: {
    flex: 0.58,
  },
  liveStatVolume: {
    flex: 0.92,
  },
  liveStatDivider: {
    width: 1,
    height: 54,
    backgroundColor: '#E4D8FF',
  },
  liveStatValue: {
    fontFamily: typography.fontFamily,
    color: '#111827',
    fontSize: 21,
    lineHeight: 26,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    maxWidth: '100%',
    textAlign: 'center',
  },
  liveStatValueLong: {
    fontSize: 18,
    lineHeight: 24,
  },
  liveStatLabel: {
    fontFamily: typography.fontFamily,
    color: '#8D7FA9',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 124,
    paddingTop: spacing.sm,
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
  sessionQueueRow: {
    minHeight: 74,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.24)',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  sessionExerciseDoneRow: {
    borderColor: 'rgba(124, 58, 237, 0.38)',
    backgroundColor: '#F4ECFF',
  },
  sessionQueueBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#F3ECFF',
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionWarmupBadge: {
    backgroundColor: '#F3ECFF',
  },
  sessionWarmupText: {
    fontFamily: typography.fontFamily,
    color: LOGGING_PURPLE,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  sessionQueueBadgeDone: {
    backgroundColor: LOGGING_PURPLE,
    borderColor: 'rgba(124, 58, 237, 0.34)',
  },
  sessionQueueBadgeText: {
    fontFamily: typography.fontFamily,
    color: LOGGING_PURPLE,
    fontSize: 14,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  sessionCooldownIcon: {
    fontFamily: typography.fontFamily,
    color: LOGGING_PURPLE,
    fontSize: 17,
    fontWeight: '900',
  },
  sessionQueueCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  sessionQueueTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sessionQueueTitle: {
    fontFamily: typography.fontFamily,
    color: '#111827',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
  },
  sessionQueueMeta: {
    fontFamily: typography.fontFamily,
    color: '#667085',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  sessionQueueBadgeTextDone: {
    color: '#FFFFFF',
  },
  sessionNextChip: {
    minHeight: 20,
    paddingHorizontal: 7,
    borderRadius: radii.pill,
    backgroundColor: LOGGING_PURPLE,
    justifyContent: 'center',
  },
  sessionNextChipText: {
    fontFamily: typography.fontFamily,
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  sessionLaterChip: {
    minHeight: 20,
    paddingHorizontal: 7,
    borderRadius: radii.pill,
    backgroundColor: '#F3ECFF',
    justifyContent: 'center',
  },
  sessionLaterChipText: {
    fontFamily: typography.fontFamily,
    color: '#8D7FA9',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  cooldownRow: {
    marginTop: 2,
  },
  sessionFlowDetails: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.18)',
    backgroundColor: 'rgba(255,255,255,0.58)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    marginTop: -8,
  },
  sessionFlowStep: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sessionFlowStepBadge: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: '#F3ECFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionFlowStepBadgeText: {
    fontFamily: typography.fontFamily,
    color: LOGGING_PURPLE,
    fontSize: 11,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  sessionFlowStepTitle: {
    fontFamily: typography.fontFamily,
    color: '#111827',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
  },
  sessionFlowStepMeta: {
    fontFamily: typography.fontFamily,
    color: '#667085',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
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
  addExerciseButton: {
    minHeight: 28,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#D8C7FF',
    backgroundColor: 'rgba(255,255,255,0.32)',
  },
  addExerciseButtonText: {
    fontFamily: typography.fontFamily,
    color: LOGGING_PURPLE,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  finishWorkoutButton: {
    minHeight: 54,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111827',
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 8,
  },
  finishWorkoutButtonText: {
    fontFamily: typography.fontFamily,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  sheetOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(17, 24, 39, 0.34)',
  },
  sheet: {
    margin: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.16)',
    backgroundColor: '#FFFFFF',
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
    color: '#111827',
    fontSize: 18,
    fontWeight: '800',
  },
  sheetClose: {
    color: LOGGING_PURPLE,
    fontSize: 13,
    fontWeight: '700',
  },
  sheetContent: {
    gap: spacing.sm,
  },
  sheetBodyText: {
    color: '#667085',
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
    borderColor: 'rgba(124, 58, 237, 0.12)',
    backgroundColor: '#F8F5FF',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  sheetRowText: {
    color: '#111827',
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
    borderColor: 'rgba(124, 58, 237, 0.18)',
    backgroundColor: '#FFFFFF',
    padding: spacing.md,
    color: '#111827',
    fontSize: 15,
    textAlignVertical: 'top',
  },
  sheetButton: {
    minHeight: 48,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: LOGGING_PURPLE,
  },
  sheetButtonText: {
    color: '#FFFFFF',
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
    borderColor: 'rgba(124, 58, 237, 0.14)',
    backgroundColor: '#F8F5FF',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: 3,
    justifyContent: 'center',
  },
  finishStatLabel: {
    color: '#667085',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  finishStatValue: {
    color: '#111827',
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






