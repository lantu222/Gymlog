import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { AddExerciseSheet } from '../components/AddExerciseSheet';
import { ExerciseInfoSheet } from '../components/ExerciseInfoSheet';
import { InlineTip } from '../components/InlineTip';
import { WorkoutSetRow } from '../components/WorkoutSetRow';
import { AdaptiveCoachRecommendation, buildAdaptiveCoachRecommendation } from '../lib/adaptiveCoach';
import { getExerciseTemplateDefaults } from '../lib/exerciseSuggestions';
import { buildTailoredSwapOptions, buildTailoringBadgeLabels, TailoringPreferencesInput } from '../lib/tailoringFit';
import { formatWorkoutExerciseQueueMeta } from '../lib/workoutFlow';
import { getActiveSetAutoFocusTarget } from '../lib/workoutLoggingFocus';
import { getWorkoutLoggingSessionBootstrapResult } from '../lib/workoutLoggingSessionBootstrap';
import { formatVolume, formatWeight, formatWeightInputValue } from '../lib/format';
import { canCompleteWorkoutSet } from '../lib/workoutValidation';
import { radii, spacing, typography } from '../theme';
import { SurfaceAccent } from '../components/MainScreenPrimitives';
import { ExerciseLibraryItem, UnitPreference } from '../types/models';
import { CORE_WORKOUT_TEMPLATE_ID, WORKOUT_SUBSTITUTION_GROUPS, getWorkoutTemplateById } from '../features/workout/workoutCatalog';
import { useWorkoutContext } from '../features/workout/WorkoutProvider';
import {
  WorkoutExerciseInstance,
  WorkoutRuntimeTemplate,
  WorkoutSetInstance,
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
const LOGGING_BACKGROUND = '#FFFFFF';
const LOGGING_PURPLE = '#7C3AED';
const WORKOUT_FONT_FAMILY = 'Manrope';
const REST_TIMER_OPTIONS: { label: string; seconds: number | null }[] = [
  { label: 'Off', seconds: null },
  { label: '30s', seconds: 30 },
  { label: '1:00 min', seconds: 60 },
  { label: '1:30 min', seconds: 90 },
  { label: '2:00 min', seconds: 120 },
  { label: '2:30 min', seconds: 150 },
  { label: '3:00 min', seconds: 180 },
];
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

  return `${completedSets}/${totalSets} done`;
}

function formatWorkoutListExerciseName(name: string) {
  return name.replace(/\bDumbbell\b/i, 'DB');
}

function formatRestDurationLabel(seconds: number | null) {
  if (!seconds) {
    return 'Off';
  }

  if (seconds < 60) {
    return `${seconds}s`;
  }

  return `${Math.floor(seconds / 60)}:${`${seconds % 60}`.padStart(2, '0')} min`;
}

function getDisplayLoadValue(set: WorkoutSetInstance, unitPreference: UnitPreference) {
  if (set.status === 'completed') {
    return formatWeightInputValue(set.actualLoadKg, unitPreference);
  }

  return set.draftLoadText;
}

function getDisplayRepsValue(set: WorkoutSetInstance) {
  if (set.status === 'completed' && typeof set.actualReps === 'number') {
    return `${set.actualReps}`;
  }

  return set.draftRepsText;
}

function getRepeatPreview(exercise: WorkoutExerciseInstance, rowIndex: number, unitPreference: UnitPreference) {
  if (rowIndex <= 0) {
    return null;
  }

  const source = [...exercise.sets]
    .filter((set) => set.setIndex < rowIndex)
    .reverse()
    .find((set) => set.status === 'completed' && typeof set.actualReps === 'number');

  if (!source) {
    return null;
  }

  if (exercise.trackingMode === 'bodyweight') {
    return `Repeat ${source.actualReps} reps`;
  }

  return `Repeat ${formatWeight(source.actualLoadKg ?? 0, unitPreference)} x ${source.actualReps}`;
}

function getPreviousSetLabel(previousEntries: WorkoutSlotHistoryEntry[], rowIndex: number, unitPreference: UnitPreference) {
  const previousSet = previousEntries[0]?.sets[rowIndex] ?? null;
  if (!previousSet || typeof previousSet.reps !== 'number') {
    return null;
  }

  if (typeof previousSet.loadKg === 'number' && previousSet.loadKg > 0) {
    return `${formatWeight(previousSet.loadKg, unitPreference)} x ${previousSet.reps}`;
  }

  return `${previousSet.reps} reps`;
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
  const lastAutoScrollSlotIdRef = useRef<string | null>(null);
  const previousCompletedSetsRef = useRef<number | null>(null);
  const previousActiveSlotIdRef = useRef<string | null>(null);
  const autoDismissedFirstGuideSessionRef = useRef<string | null>(null);

  const [showAddExercise, setShowAddExercise] = useState(false);
  const [showMoreActions, setShowMoreActions] = useState(false);
  const [exerciseInfoSlotId, setExerciseInfoSlotId] = useState<string | null>(null);
  const [swapSlotId, setSwapSlotId] = useState<string | null>(null);
  const [noteSlotId, setNoteSlotId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState('');
  const [discardConfirmVisible, setDiscardConfirmVisible] = useState(false);
  const [restTimerMenuOpen, setRestTimerMenuOpen] = useState(false);
  const [skippedEffortKeys, setSkippedEffortKeys] = useState<string[]>([]);
  const [postEffortTransition, setPostEffortTransition] = useState<PostEffortTransitionState | null>(null);
  const [collapsedExerciseSlotIds, setCollapsedExerciseSlotIds] = useState<string[]>([]);
  const bootstrappedTargetKeyRef = useRef<string | null>(null);

  const bootstrapTargetKey = customTemplate ? `custom:${customTemplate.id}` : `template:${sessionKey}`;

  useEffect(() => {
    const bootstrapResult = getWorkoutLoggingSessionBootstrapResult({
      hydrated,
      activeSessionId: activeSession?.status === 'active' ? activeSession.sessionId : null,
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
  }, [activeSession?.sessionId, activeSession?.status, bootstrapTargetKey, customTemplate, hydrated, sessionKey, startCustomWorkout, startWorkout, unitPreference]);

  const activeExercise = selectActiveExercise(activeSession);
  const activeSlotId = activeSession?.ui.activeSlotId ?? activeExercise?.slotId ?? activeSession?.exercises[0]?.slotId ?? null;
  const restTimerStatus = activeSession?.restTimer.status ?? 'idle';

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
  // Must stay above the loading-state early return: a hook below it renders
  // one fewer hook when the session clears mid-save and React throws
  // ("recovered by synchronously rendering the entire root").
  const swapBadgeLabels = useMemo(
    () => buildTailoringBadgeLabels(tailoringPreferences).slice(0, 3),
    [tailoringPreferences],
  );
  const overlaySurfaceOpen =
    showAddExercise ||
    showMoreActions ||
    Boolean(exerciseInfoSlotId) ||
    Boolean(swapSlotId) ||
    Boolean(noteSlotId) ||
    discardConfirmVisible;
  const showFirstSessionCoach =
    isFirstSession &&
    completedSets === 0 &&
    !dismissedTipIds.includes(LOGGER_FIRST_SET_GUIDE_TIP_ID) &&
    !overlaySurfaceOpen;
  const activeEffortPrompt =
    latestEffortTarget && !skippedEffortKeys.includes(latestEffortTarget.key) ? latestEffortTarget : null;
  const showGenericInlineTip =
    Boolean(inlineTip) && !isFirstSession && !showFirstSessionCoach;

  useEffect(() => {
    if (!activeSlotId) {
      return;
    }

    if (lastAutoScrollSlotIdRef.current === null) {
      lastAutoScrollSlotIdRef.current = activeSlotId;
      return;
    }

    if (lastAutoScrollSlotIdRef.current === activeSlotId) {
      return;
    }

    const targetOffset = exerciseOffsets.current[activeSlotId];
    if (typeof targetOffset !== 'number') {
      return;
    }

    const timeout = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, targetOffset - 16), animated: true });
      lastAutoScrollSlotIdRef.current = activeSlotId;
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
    lastAutoScrollSlotIdRef.current = activeSlotId ?? null;
    scrollRef.current?.scrollTo({ y: 0, animated: false });
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

  function handleSelectRestDuration(seconds: number | null) {
    setRestTimerMenuOpen(false);
    if (!seconds) {
      clearRestTimer();
      return;
    }

    overrideRestTimer(seconds);
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
  const exerciseInfoLibraryItem = exerciseInfoTarget
    ? libraryItemById.get(
        exerciseInfoTarget.libraryItemId ??
          libraryIdByName.get(normalizeName(exerciseInfoTarget.exerciseName)) ??
          '',
      ) ?? null
    : null;
  const hasPersistableWorkoutData = loggedExercises > 0;
  const workoutExerciseRows = activeSession.exercises;
  const elapsedText = formatLoggerClock(activeSession.elapsedSeconds);
  const volumeText = formatVolume(totalVolume, unitPreference);
  const selectedRestDurationSeconds = activeSession.restTimer.durationSeconds || defaultRestSeconds;
  const liveStats = (
    <View style={styles.metaStrip}>
      <Text style={styles.metaStripText}>{elapsedText}</Text>
      <View style={styles.metaStripDot} />
      <Text style={styles.metaStripText}>{completedSets} sets</Text>
      <View style={styles.metaStripDot} />
      <Text style={styles.metaStripText}>{volumeText} volume</Text>
    </View>
  );

  return (
    <View key="active-workout" style={styles.screen}>
      <View style={styles.activeWorkoutHeader}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Finish workout"
          disabled={isSavingWorkout}
          onPress={() => {
            Keyboard.dismiss();
            if (hasPersistableWorkoutData) {
              // Something is logged: save straight away, no confirm step.
              onConfirmFinishWorkout();
            } else {
              // Nothing logged yet: ask before throwing the session away.
              setDiscardConfirmVisible(true);
            }
          }}
          style={[styles.headerFinishButton, isSavingWorkout && styles.headerFinishButtonDisabled]}
        >
          <Text style={styles.headerFinishButtonText}>Finish</Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {liveStats}

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

        <View style={styles.exerciseList}>
          {workoutExerciseRows.map((exercise) => {
            const isOpen = activeSlotId === exercise.slotId && !collapsedExerciseSlotIds.includes(exercise.slotId);
            const activeSetIndex = isOpen ? activeSession.ui.activeSetIndex : findFirstPendingSetIndex(exercise);
            const activeSet = exercise.sets[activeSetIndex] ?? null;
            const activeSetLoadValue = activeSet ? getDisplayLoadValue(activeSet, unitPreference) : '';
            const activeSetRepsValue = activeSet ? getDisplayRepsValue(activeSet) : '';
            const activeSetCanLog = activeSet
              ? activeSet.status !== 'completed' && canCompleteWorkoutSet(exercise.trackingMode, activeSetLoadValue, activeSetRepsValue)
              : false;

            return (
              <React.Fragment key={exercise.slotId}>
                <Pressable
                  onPress={() => handleToggleExercise(exercise)}
                  onLayout={(event) => {
                    exerciseOffsets.current[exercise.slotId] = event.nativeEvent.layout.y;
                  }}
                  style={[styles.exerciseListRow, isOpen && styles.exerciseListRowOpen]}
                >
                  <View style={styles.exerciseListCopy}>
                    <Text style={styles.exerciseListTitle} numberOfLines={1}>
                      {formatWorkoutListExerciseName(exercise.exerciseName)}
                    </Text>
                    {!isOpen ? (
                      <Text style={styles.exerciseListMeta}>
                        {getExerciseCompletionMeta(exercise)}
                      </Text>
                    ) : null}
                  </View>
                  <Pressable
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`More actions for ${exercise.exerciseName}`}
                    onPress={(event) => {
                      event.stopPropagation();
                      Keyboard.dismiss();
                      setActiveExercise(exercise.slotId, findFirstPendingSetIndex(exercise));
                      setShowMoreActions(true);
                    }}
                    style={styles.exerciseListMore}
                  >
                    <Text style={styles.exerciseListMoreText}>...</Text>
                  </Pressable>
                </Pressable>

                {isOpen ? (
                  <View style={styles.activeExercisePanel}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Rest timer"
                      onPress={() => setRestTimerMenuOpen((current) => !current)}
                      style={styles.restTimerControl}
                    >
                      <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
                        <Circle cx={12} cy={13} r={8} stroke={LOGGING_PURPLE} strokeWidth={2} />
                        <Path d="M12 9v5l3 2M9 3h6" stroke={LOGGING_PURPLE} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                      </Svg>
                      <Text style={styles.restTimerText}>Rest Timer: {formatRestDurationLabel(selectedRestDurationSeconds)}</Text>
                    </Pressable>

                    {restTimerMenuOpen ? (
                      <View style={styles.restTimerMenu}>
                        {REST_TIMER_OPTIONS.map((option) => {
                          const selected =
                            option.seconds === null
                              ? restTimerStatus === 'idle'
                              : selectedRestDurationSeconds === option.seconds && restTimerStatus !== 'idle';

                          return (
                            <Pressable
                              key={option.label}
                              onPress={() => handleSelectRestDuration(option.seconds)}
                              style={[styles.restTimerMenuItem, selected && styles.restTimerMenuItemSelected]}
                            >
                              <Text style={[styles.restTimerMenuText, selected && styles.restTimerMenuTextSelected]}>
                                {option.label}
                              </Text>
                              {selected ? <Text style={styles.restTimerMenuCheck}>✓</Text> : null}
                            </Pressable>
                          );
                        })}
                      </View>
                    ) : null}

                    <View style={styles.setTableHeader}>
                      <Text style={styles.setHeaderSet}>SET</Text>
                      <View style={styles.setHeaderMiddleGroup}>
                        <Text style={styles.setHeaderPrevious} numberOfLines={1}>PREVIOUS</Text>
                        <View style={styles.setHeaderValueGroup}>
                          <Text style={styles.setHeaderCell}>KG</Text>
                          <Text style={styles.setHeaderCell}>REPS</Text>
                        </View>
                      </View>
                    </View>

                    <View style={styles.setRows}>
                      {exercise.sets.map((set, rowIndex) => {
                        const weightValue = getDisplayLoadValue(set, unitPreference);
                        const repsValue = getDisplayRepsValue(set);
                        const repeatPreview = getRepeatPreview(exercise, rowIndex, unitPreference);
                        const previousValue = getPreviousSetLabel(previousEntriesBySlot[exercise.slotId] ?? [], rowIndex, unitPreference);

                        return (
                          <WorkoutSetRow
                            key={`${exercise.slotId}:${set.setIndex}`}
                            setNumber={rowIndex + 1}
                            trackingMode={exercise.trackingMode}
                            weightValue={weightValue}
                            repsValue={repsValue}
                            previousValue={previousValue}
                            weightPlaceholder={
                              exercise.trackingMode === 'bodyweight' ? '' : formatWeightInputValue(set.plannedLoadKg, unitPreference)
                            }
                            repsPlaceholder={`${set.plannedRepsMin}-${set.plannedRepsMax}`}
                            unitPreference={unitPreference}
                            active={activeSetIndex === rowIndex && set.status === 'pending'}
                            completed={set.status === 'completed'}
                            future={rowIndex > activeSetIndex && set.status === 'pending'}
                            effort={set.effort ?? null}
                            canRepeatLastSet={Boolean(
                              activeSetIndex === rowIndex &&
                                repeatPreview &&
                                !set.draftLoadText &&
                                !set.draftRepsText,
                            )}
                            repeatLastLabel={repeatPreview}
                            onActivate={() => setActiveExercise(exercise.slotId, rowIndex)}
                            onWeightChange={(value) => updateSetDraft(exercise.slotId, rowIndex, { loadText: value })}
                            onRepsChange={(value) => updateSetDraft(exercise.slotId, rowIndex, { repsText: value })}
                            onComplete={() => (set.status === 'completed' ? undoSet(exercise.slotId, rowIndex) : completeSet(exercise.slotId, rowIndex, unitPreference))}
                            onRepeatLastSet={() => repeatLastSet(exercise.slotId, rowIndex, unitPreference)}
                            bindWeightInput={(input) => bindWeightInput(exercise.slotId, rowIndex, input)}
                            bindRepsInput={(input) => bindRepsInput(exercise.slotId, rowIndex, input)}
                            onWeightSubmit={() => handleWeightSubmit(exercise, rowIndex)}
                            onRepsSubmit={() => handleRepsSubmit(exercise, rowIndex)}
                          />
                        );
                      })}
                    </View>

                    <Pressable onPress={() => addSet(exercise.slotId)} style={styles.addSetButton}>
                      <Text style={styles.addSetText}>+ Add set</Text>
                    </Pressable>
                  </View>
                ) : null}
              </React.Fragment>
            );
          })}
        </View>

        <Pressable
          onPress={() => {
            Keyboard.dismiss();
            setShowAddExercise(true);
          }}
          style={styles.addExerciseButton}
        >
          <Text style={styles.addExerciseButtonText}>+ Add exercise</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel workout"
          onPress={onDiscardWorkout}
          style={styles.cancelWorkoutButton}
        >
          <Text style={styles.cancelWorkoutText}>Cancel workout</Text>
        </Pressable>
      </ScrollView>

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
                  <View key={label} style={styles.swapSheetBadge}>
                    <Text style={styles.swapSheetBadgeText}>{label}</Text>
                  </View>
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
            placeholderTextColor="#9A93AC"
            multiline
            style={styles.notesInput}
            selectionColor={LOGGING_PURPLE}
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

      {discardConfirmVisible ? (
        <View style={styles.dialogOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setDiscardConfirmVisible(false)} />
          <View style={styles.dialogCard}>
            <Text style={styles.dialogTitle}>Discard workout?</Text>
            <Text style={styles.dialogBody}>
              Nothing has been logged yet. Are you sure you want to discard this workout?
            </Text>
            <Pressable
              onPress={() => {
                setDiscardConfirmVisible(false);
                onDiscardWorkout();
              }}
              style={styles.sheetDestructiveButton}
            >
              <Text style={styles.sheetDestructiveButtonText}>Discard workout</Text>
            </Pressable>
            <Pressable onPress={() => setDiscardConfirmVisible(false)} style={styles.sheetRow}>
              <Text style={styles.sheetRowText}>Keep logging</Text>
            </Pressable>
          </View>
        </View>
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
  activeWorkoutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 26,
    paddingTop: 42,
    paddingBottom: 18,
  },
  headerFinishButton: {
    minHeight: 38,
    paddingHorizontal: 22,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: LOGGING_PURPLE,
    shadowColor: LOGGING_PURPLE,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.26,
    shadowRadius: 14,
    elevation: 8,
  },
  headerFinishButtonText: {
    fontFamily: WORKOUT_FONT_FAMILY,
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
  },
  metaStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
    marginBottom: 14,
    marginHorizontal: 26,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEAF7',
  },
  metaStripText: {
    fontFamily: WORKOUT_FONT_FAMILY,
    color: '#101828',
    fontSize: 15.5,
    lineHeight: 20,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  metaStripDot: {
    width: 4,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#C0B8D4',
  },
  liveStatsCard: {
    minHeight: 72,
    marginTop: 0,
    marginBottom: 20,
    marginHorizontal: 26,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EFEAF9',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingVertical: 13,
    paddingHorizontal: 6,
  },
  liveStat: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 2,
    minWidth: 0,
  },
  liveStatDuration: {
    flex: 1,
  },
  liveStatSets: {
    flex: 1,
  },
  liveStatVolume: {
    flex: 1,
  },
  liveStatValue: {
    fontFamily: WORKOUT_FONT_FAMILY,
    color: '#101828',
    fontSize: 22,
    lineHeight: 30,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    maxWidth: '100%',
    textAlign: 'center',
  },
  liveStatValueLong: {
    fontSize: 19,
    lineHeight: 27,
  },
  liveStatDurationValue: {
    color: LOGGING_PURPLE,
  },
  liveStatLabel: {
    fontFamily: WORKOUT_FONT_FAMILY,
    color: '#8D7FA9',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
    letterSpacing: 0,
    textAlign: 'center',
  },
  content: {
    paddingHorizontal: 0,
    paddingBottom: 44,
    paddingTop: 0,
  },
  inlineTipWrap: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 6,
  },
  exerciseListRow: {
    minHeight: 73,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 26,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EAF8',
    gap: 13,
  },
  exerciseListRowOpen: {
    borderBottomWidth: 0,
  },
  exerciseListCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  exerciseListTitle: {
    fontFamily: WORKOUT_FONT_FAMILY,
    color: '#101828',
    fontSize: 19,
    lineHeight: 26,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  exerciseListMeta: {
    fontFamily: WORKOUT_FONT_FAMILY,
    color: '#344054',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  exerciseListMore: {
    width: 36,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseListMoreText: {
    fontFamily: WORKOUT_FONT_FAMILY,
    color: LOGGING_PURPLE,
    fontSize: 23,
    lineHeight: 24,
    fontWeight: '900',
    letterSpacing: 1,
  },
  activeExercisePanel: {
    marginHorizontal: 0,
    paddingTop: 13,
    paddingRight: 14,
    paddingBottom: 6,
    paddingLeft: 14,
    backgroundColor: '#FFFFFF',
  },
  restTimerControl: {
    minHeight: 18,
    maxWidth: 180,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 16,
  },
  restTimerText: {
    fontFamily: WORKOUT_FONT_FAMILY,
    color: LOGGING_PURPLE,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  restTimerMenu: {
    position: 'absolute',
    top: 38,
    left: 14,
    width: 180,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    zIndex: 10,
    shadowColor: '#101828',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 22,
    elevation: 8,
  },
  restTimerMenuItem: {
    minHeight: 37,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  restTimerMenuItemSelected: {
    marginHorizontal: 6,
    borderRadius: 9,
    backgroundColor: '#F3ECFF',
  },
  restTimerMenuText: {
    fontFamily: WORKOUT_FONT_FAMILY,
    color: '#101828',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  restTimerMenuTextSelected: {
    color: LOGGING_PURPLE,
    fontWeight: '700',
  },
  restTimerMenuCheck: {
    fontFamily: WORKOUT_FONT_FAMILY,
    color: LOGGING_PURPLE,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  setTableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
    marginBottom: 5,
  },
  setHeaderSet: {
    width: 32,
    marginLeft: 5,
    fontFamily: WORKOUT_FONT_FAMILY,
    color: '#9B93AD',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  setHeaderPrevious: {
    width: 86,
    paddingLeft: 10,
    fontFamily: WORKOUT_FONT_FAMILY,
    color: '#9B93AD',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  setHeaderCell: {
    width: 76,
    fontFamily: WORKOUT_FONT_FAMILY,
    color: '#9B93AD',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: 0.7,
    textAlign: 'center',
  },
  setHeaderMiddleGroup: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 6,
    paddingRight: 14,
  },
  setHeaderValueGroup: {
    width: 168,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  setRows: {
    gap: 8,
  },
  addSetButton: {
    minHeight: 38,
    marginTop: 10,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1EDFA',
  },
  addSetText: {
    fontFamily: WORKOUT_FONT_FAMILY,
    color: '#101828',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '900',
  },
  cancelWorkoutButton: {
    minHeight: 50,
    marginHorizontal: 26,
    marginTop: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelWorkoutText: {
    fontFamily: WORKOUT_FONT_FAMILY,
    color: '#DC2626',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  exerciseList: {
    gap: 0,
    backgroundColor: '#FFFFFF',
  },
  addExerciseButton: {
    minHeight: 46,
    marginHorizontal: 26,
    marginTop: 24,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3ECFF',
  },
  addExerciseButtonText: {
    fontFamily: WORKOUT_FONT_FAMILY,
    color: '#5B21B6',
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '800',
    letterSpacing: 0,
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
    color: '#111827',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  swapSheetBody: {
    color: '#667085',
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
  swapSheetBadge: {
    minHeight: 26,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    justifyContent: 'center',
    backgroundColor: '#FFF1E7',
    borderWidth: 1,
    borderColor: 'rgba(194, 65, 12, 0.24)',
  },
  swapSheetBadgeText: {
    color: '#C2410C',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
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
    color: '#C2410C',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sheetRowMeta: {
    color: '#667085',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  sheetEmpty: {
    color: '#667085',
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
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.28)',
  },
  sheetDestructiveButtonText: {
    color: '#B91C1C',
    fontSize: 14,
    fontWeight: '800',
  },
  headerFinishButtonDisabled: {
    opacity: 0.6,
  },
  dialogOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: 'rgba(17, 24, 39, 0.45)',
  },
  dialogCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: radii.lg,
    backgroundColor: '#FFFFFF',
    padding: spacing.xl,
    gap: spacing.md,
  },
  dialogTitle: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  dialogBody: {
    color: '#667085',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
});






