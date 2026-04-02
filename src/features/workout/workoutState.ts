import { createId } from '../../lib/ids';
import { convertWeightToKg, formatWeightInputValue, parseNumberInput } from '../../lib/format';
import { WorkoutTemplateExercise, WorkoutExerciseInsertInput, WorkoutExerciseInstance, WorkoutHistoryStore, WorkoutPersistenceBundle, WorkoutRestTimerState, WorkoutRuntimeTemplate, WorkoutSessionMaterializeOptions, WorkoutSessionRuntime, WorkoutSessionSummary, WorkoutSetDraftInput, WorkoutSetEffort, WorkoutSetInstance, WorkoutSlotHistoryEntry, WorkoutSlotHistorySet, WorkoutStatus, WorkoutUiState, WorkoutExerciseStatus } from './workoutTypes';
import { getWorkoutTemplateById } from './workoutCatalog';

export interface WorkoutFeatureState {
  hydrated: boolean;
  isRestoring: boolean;
  nowMs: number;
  history: WorkoutHistoryStore;
  activeSession: WorkoutSessionRuntime | null;
  completionSummary: WorkoutSessionSummary | null;
}

export type WorkoutAction =
  | { type: 'session/hydrate'; payload: WorkoutPersistenceBundle }
  | { type: 'session/markRestoring'; payload: { value: boolean } }
  | { type: 'session/startFromTemplate'; payload: { templateId: string; sessionOrderIndex: number; unitPreference: 'kg' | 'lb' } }
  | {
      type: 'session/startFromRuntimeTemplate';
      payload: { template: WorkoutRuntimeTemplate; sessionOrderIndex: number; unitPreference: 'kg' | 'lb' };
    }
  | { type: 'session/resume'; payload: { session: WorkoutSessionRuntime } }
  | { type: 'session/pause' }
  | { type: 'session/tick'; payload: { nowMs: number } }
  | { type: 'exercise/setActive'; payload: { slotId: string; setIndex?: number } }
  | { type: 'exercise/expand'; payload: { slotId: string } }
  | { type: 'exercise/collapse'; payload: { slotId: string } }
  | { type: 'set/updateDraft'; payload: { slotId: string; setIndex: number; patch: WorkoutSetDraftInput } }
  | { type: 'set/complete'; payload: { slotId: string; setIndex: number; nowMs: number; unitPreference: 'kg' | 'lb' } }
  | { type: 'set/recordEffort'; payload: { slotId: string; setIndex: number; effort: WorkoutSetEffort } }
  | { type: 'set/repeatLast'; payload: { slotId: string; setIndex: number; nowMs: number; unitPreference: 'kg' | 'lb' } }
  | { type: 'set/undo'; payload: { slotId: string; setIndex: number } }
  | { type: 'exercise/addSet'; payload: { slotId: string } }
  | { type: 'exercise/skip'; payload: { slotId: string; reason?: string } }
  | { type: 'exercise/insertAfter'; payload: { afterSlotId: string; exercise: WorkoutExerciseInsertInput } }
  | { type: 'exercise/swap'; payload: { slotId: string; exerciseName: string; substitutionGroup: string } }
  | { type: 'exercise/updateNotes'; payload: { slotId: string; notes: string } }
  | { type: 'timer/start'; payload: { slotId: string; setIndex: number; durationSeconds: number; nowMs: number } }
  | { type: 'timer/pause' }
  | { type: 'timer/resume'; payload: { nowMs: number } }
  | { type: 'timer/override'; payload: { durationSeconds: number; nowMs: number } }
  | { type: 'timer/clear' }
  | { type: 'session/openFinishSummary' }
  | { type: 'session/finishWorkout'; payload?: { performedAt?: string } }
  | { type: 'session/discardWorkout' }
  | { type: 'session/clearCompletedSession' };

function createInitialTimer(): WorkoutRestTimerState {
  return {
    status: 'idle',
    exerciseSlotId: null,
    setIndex: null,
    startedAtMs: null,
    endsAtMs: null,
    durationSeconds: 0,
  };
}

function createInitialUi(): WorkoutUiState {
  return {
    activeSlotId: null,
    activeSetIndex: 0,
    focusedField: null,
    noteEditorSlotId: null,
    swapSheetSlotId: null,
    expandedSlotIds: [],
    finishSummaryOpen: false,
  };
}

function cloneSet(set: WorkoutSetInstance): WorkoutSetInstance {
  return { ...set };
}

function cloneExercise(exercise: WorkoutExerciseInstance): WorkoutExerciseInstance {
  return {
    ...exercise,
    sets: exercise.sets.map(cloneSet),
  };
}

function parseInputNumber(value: string | undefined) {
  return parseNumberInput(value ?? '');
}

function buildScopedSlotId(templateId: string, templateSessionId: string, slotId: string) {
  return `${templateId}:${templateSessionId}:${slotId}`;
}

function getHistoryEntries(
  history: WorkoutHistoryStore,
  slotId: string,
  templateSlotId?: string,
) {
  const scopedEntries = history.slotHistory[slotId] ?? [];
  if (scopedEntries.length > 0 || !templateSlotId) {
    return scopedEntries;
  }

  return history.slotHistory[templateSlotId] ?? [];
}

export function getHistoryEntriesForExercise(
  history: WorkoutHistoryStore,
  exercise: Pick<WorkoutExerciseInstance, 'slotId' | 'templateSlotId'> | null | undefined,
) {
  if (!exercise) {
    return [];
  }

  return getHistoryEntries(history, exercise.slotId, exercise.templateSlotId);
}

function resolveHistoricalSetDraft(
  history: WorkoutHistoryStore,
  slotId: string,
  templateSlotId: string,
  setIndex: number,
  unitPreference: 'kg' | 'lb',
) {
  const latest = getHistoryEntries(history, slotId, templateSlotId)[0];
  const matched = latest?.sets.find((item) => item.setIndex === setIndex) ?? latest?.sets[setIndex] ?? null;

  if (!matched) {
    return { draftLoadText: '', draftRepsText: '', plannedLoadKg: undefined };
  }

  return {
    draftLoadText: formatWeightInputValue(matched.loadKg, unitPreference),
    draftRepsText: `${matched.reps}`,
    plannedLoadKg: matched.loadKg,
  };
}

function materializeExercise(
  templateId: string,
  templateSessionId: string,
  exercise: WorkoutTemplateExercise,
  options: WorkoutSessionMaterializeOptions,
  orderIndex: number,
): WorkoutExerciseInstance {
  const scopedSlotId = buildScopedSlotId(templateId, templateSessionId, exercise.slotId);
  const sets: WorkoutSetInstance[] = Array.from({ length: exercise.sets }, (_, setIndex) => {
    const resolved = resolveHistoricalSetDraft(options.history, scopedSlotId, exercise.slotId, setIndex, options.unitPreference);

    return {
      setIndex,
      plannedLoadKg: resolved.plannedLoadKg,
      plannedRepsMin: exercise.repsMin,
      plannedRepsMax: exercise.repsMax,
      draftLoadText: resolved.draftLoadText,
      draftRepsText: resolved.draftRepsText,
      status: 'pending',
      edited: false,
    };
  });

  return {
    templateExerciseId: exercise.id,
    persistedExerciseTemplateId: exercise.persistedExerciseTemplateId ?? null,
    slotId: scopedSlotId,
    templateSlotId: exercise.slotId,
    exerciseName: exercise.exerciseName,
    role: exercise.role,
    progressionPriority: exercise.progressionPriority,
    trackingMode: exercise.trackingMode,
    restSecondsMin: exercise.restSecondsMin,
    restSecondsMax: exercise.restSecondsMax,
    substitutionGroup: exercise.substitutionGroup,
    orderIndex,
    sets,
    status: 'pending',
    isExpanded: orderIndex === 0,
  };
}

function materializeInsertedExercise(
  input: WorkoutExerciseInsertInput,
  orderIndex: number,
): WorkoutExerciseInstance {
  const insertedSlotId = createId('workout_slot');

  return {
    templateExerciseId: createId('workout_exercise'),
    persistedExerciseTemplateId: null,
    slotId: insertedSlotId,
    templateSlotId: insertedSlotId,
    exerciseName: input.exerciseName,
    role: input.role ?? 'secondary',
    progressionPriority: input.progressionPriority ?? 'medium',
    trackingMode: input.trackingMode,
    restSecondsMin: input.restSecondsMin,
    restSecondsMax: input.restSecondsMax,
    substitutionGroup: input.substitutionGroup,
    orderIndex,
    sets: Array.from({ length: input.sets }, (_, setIndex) => ({
      setIndex,
      plannedRepsMin: input.repsMin,
      plannedRepsMax: input.repsMax,
      draftLoadText: '',
      draftRepsText: '',
      status: 'pending',
      edited: false,
    })),
    status: 'pending',
    libraryItemId: input.libraryItemId ?? null,
    sessionInserted: true,
    isExpanded: false,
  };
}

function materializeWorkoutSessionFromTemplate(
  template: WorkoutRuntimeTemplate,
  options: WorkoutSessionMaterializeOptions,
): WorkoutSessionRuntime {
  const exercises = template.sessions
    .slice()
    .sort((left, right) => left.orderIndex - right.orderIndex)
    .flatMap((templateSession) =>
      templateSession.exercises.map((exercise) => ({ exercise, templateSessionId: templateSession.id })),
    )
    .map(({ exercise, templateSessionId }, orderIndex) =>
      materializeExercise(template.id, templateSessionId, exercise, options, orderIndex),
    );

  const startedAt = new Date().toISOString();
  return {
    sessionId: createId('workout_session'),
    templateId: template.id,
    templateName: template.name,
    status: 'active',
    startedAt,
    updatedAt: startedAt,
    elapsedSeconds: 0,
    activePlanMode: template.defaultScheduleMode,
    exercises,
    restTimer: createInitialTimer(),
    ui: {
      ...createInitialUi(),
      activeSlotId: exercises[0]?.slotId ?? null,
    },
    sessionOrderIndex: options.sessionOrderIndex,
  };
}

export function materializeWorkoutSession(
  templateId: string,
  options: WorkoutSessionMaterializeOptions,
): WorkoutSessionRuntime {
  const template = getWorkoutTemplateById(templateId);
  if (!template) {
    throw new Error(`Unknown workout template: ${templateId}`);
  }

  return materializeWorkoutSessionFromTemplate(template, options);
}

function findExerciseIndex(session: WorkoutSessionRuntime, slotId: string) {
  return session.exercises.findIndex((exercise) => exercise.slotId === slotId);
}

function findFirstPendingSetIndex(exercise: WorkoutExerciseInstance) {
  return exercise.sets.findIndex((set) => set.status === 'pending');
}

function findNextIncompleteIndex(session: WorkoutSessionRuntime, startIndex: number) {
  for (let index = startIndex; index < session.exercises.length; index += 1) {
    const exercise = session.exercises[index];
    if (exercise.status !== 'completed' && exercise.status !== 'skipped' && findFirstPendingSetIndex(exercise) >= 0) {
      return index;
    }
  }

  for (let index = 0; index < startIndex; index += 1) {
    const exercise = session.exercises[index];
    if (exercise.status !== 'completed' && exercise.status !== 'skipped' && findFirstPendingSetIndex(exercise) >= 0) {
      return index;
    }
  }

  return -1;
}

function updateActiveExercise(session: WorkoutSessionRuntime, nextIndex: number, preferredSetIndex?: number) {
  if (nextIndex < 0) {
    session.ui.activeSlotId = null;
    session.ui.activeSetIndex = 0;
    return;
  }

  const nextExercise = session.exercises[nextIndex];
  const resolvedSetIndex =
    typeof preferredSetIndex === 'number' && nextExercise?.sets[preferredSetIndex]?.status === 'pending'
      ? preferredSetIndex
      : Math.max(0, findFirstPendingSetIndex(nextExercise));

  session.ui.activeSlotId = nextExercise?.slotId ?? null;
  session.ui.activeSetIndex = resolvedSetIndex;
  session.exercises = session.exercises.map((exercise, index) => ({
    ...exercise,
    isExpanded: index === nextIndex ? true : exercise.isExpanded,
  }));
}

function findNextPendingTarget(session: WorkoutSessionRuntime, exerciseIndex: number, setIndex: number) {
  for (let currentExerciseIndex = exerciseIndex; currentExerciseIndex < session.exercises.length; currentExerciseIndex += 1) {
    const exercise = session.exercises[currentExerciseIndex];
    const startSetIndex = currentExerciseIndex === exerciseIndex ? setIndex + 1 : 0;

    for (let currentSetIndex = startSetIndex; currentSetIndex < exercise.sets.length; currentSetIndex += 1) {
      if (exercise.sets[currentSetIndex]?.status === 'pending') {
        return { exerciseIndex: currentExerciseIndex, setIndex: currentSetIndex };
      }
    }
  }

  for (let currentExerciseIndex = 0; currentExerciseIndex < exerciseIndex; currentExerciseIndex += 1) {
    const exercise = session.exercises[currentExerciseIndex];

    for (let currentSetIndex = 0; currentSetIndex < exercise.sets.length; currentSetIndex += 1) {
      if (exercise.sets[currentSetIndex]?.status === 'pending') {
        return { exerciseIndex: currentExerciseIndex, setIndex: currentSetIndex };
      }
    }
  }

  return null;
}

function updateSessionTimestamp(session: WorkoutSessionRuntime, nowIso = new Date().toISOString()) {
  session.updatedAt = nowIso;
  return session;
}

function buildSummary(session: WorkoutSessionRuntime): WorkoutSessionSummary {
  const completedSets = session.exercises.flatMap((exercise) => exercise.sets).filter((set) => set.status === 'completed');
  const performedAt = session.completedAt ?? new Date().toISOString();
  return {
    sessionId: session.sessionId,
    templateId: session.templateId,
    templateName: session.templateName,
    performedAt,
    durationMinutes: Math.max(1, Math.round((new Date(performedAt).getTime() - new Date(session.startedAt).getTime()) / 60000) || 1),
    setsCompleted: completedSets.length,
    exercisesCompleted: session.exercises.filter((exercise) => exercise.status === 'completed').length,
    exercisesSkipped: session.exercises.filter((exercise) => exercise.status === 'skipped').length,
    exercisesSwapped: session.exercises.filter((exercise) => exercise.status === 'swapped').length,
    totalVolumeKg: completedSets.reduce((sum, set) => sum + (set.actualLoadKg ?? 0) * (set.actualReps ?? 0), 0),
  };
}

function finalizeExerciseStatus(exercise: WorkoutExerciseInstance): WorkoutExerciseStatus {
  if (exercise.sets.every((set) => set.status === 'skipped')) {
    return 'skipped';
  }

  if (exercise.sets.every((set) => set.status === 'completed')) {
    return exercise.status === 'swapped' ? 'swapped' : 'completed';
  }

  if (exercise.status === 'swapped') {
    return 'swapped';
  }

  return 'active';
}

function advanceAfterMutation(session: WorkoutSessionRuntime, currentIndex: number) {
  const nextIndex = findNextIncompleteIndex(session, currentIndex + 1);
  updateActiveExercise(session, nextIndex >= 0 ? nextIndex : currentIndex);
}

function resolveDraftLoadKg(set: WorkoutSetInstance, unitPreference: 'kg' | 'lb') {
  const parsedLoad = parseInputNumber(set.draftLoadText);
  if (parsedLoad !== null) {
    return convertWeightToKg(parsedLoad, unitPreference);
  }

  return set.plannedLoadKg;
}

function resolveDraftReps(set: WorkoutSetInstance) {
  return parseInputNumber(set.draftRepsText);
}

export const workoutInitialState: WorkoutFeatureState = {
  hydrated: false,
  isRestoring: true,
  nowMs: Date.now(),
  history: { sessions: [], slotHistory: {}, lastSelectedTemplateId: null },
  activeSession: null,
  completionSummary: null,
};

export function workoutReducer(state: WorkoutFeatureState, action: WorkoutAction): WorkoutFeatureState {
  switch (action.type) {
    case 'session/hydrate':
      return {
        hydrated: true,
        isRestoring: false,
        nowMs: Date.now(),
        history: action.payload.history,
        activeSession: action.payload.activeSession,
        completionSummary: null,
      };

    case 'session/markRestoring':
      return { ...state, isRestoring: action.payload.value };

    case 'session/startFromTemplate': {
      const session = materializeWorkoutSession(action.payload.templateId, {
        history: state.history,
        unitPreference: action.payload.unitPreference,
        sessionOrderIndex: action.payload.sessionOrderIndex,
      });

      return {
        ...state,
        activeSession: session,
        completionSummary: null,
        history: {
          ...state.history,
          lastSelectedTemplateId: action.payload.templateId,
        },
        nowMs: Date.now(),
      };
    }

    case 'session/startFromRuntimeTemplate': {
      const session = materializeWorkoutSessionFromTemplate(action.payload.template, {
        history: state.history,
        unitPreference: action.payload.unitPreference,
        sessionOrderIndex: action.payload.sessionOrderIndex,
      });

      return {
        ...state,
        activeSession: session,
        completionSummary: null,
        history: {
          ...state.history,
          lastSelectedTemplateId: action.payload.template.id,
        },
        nowMs: Date.now(),
      };
    }

    case 'session/resume':
      return { ...state, activeSession: action.payload.session, completionSummary: null };

    case 'session/pause':
      if (!state.activeSession) {
        return state;
      }
      return {
        ...state,
        activeSession: { ...state.activeSession, status: 'paused', updatedAt: new Date().toISOString() },
      };

    case 'session/tick':
      if (!state.activeSession) {
        return { ...state, nowMs: action.payload.nowMs };
      }
      return {
        ...state,
        nowMs: action.payload.nowMs,
        activeSession: {
          ...state.activeSession,
          elapsedSeconds: Math.max(0, Math.floor((action.payload.nowMs - new Date(state.activeSession.startedAt).getTime()) / 1000)),
          restTimer:
            state.activeSession.restTimer.status === 'running' && state.activeSession.restTimer.endsAtMs
              ? action.payload.nowMs >= state.activeSession.restTimer.endsAtMs
                ? createInitialTimer()
                : state.activeSession.restTimer
              : state.activeSession.restTimer,
          updatedAt: new Date(action.payload.nowMs).toISOString(),
        },
      };

    case 'exercise/setActive':
      if (!state.activeSession) {
        return state;
      }
      return {
        ...state,
        activeSession: {
          ...state.activeSession,
          ui: {
            ...state.activeSession.ui,
            activeSlotId: action.payload.slotId,
            activeSetIndex: (() => {
              const exercise = state.activeSession?.exercises.find((item) => item.slotId === action.payload.slotId);
              if (!exercise) {
                return 0;
              }

              const requestedSet = typeof action.payload.setIndex === 'number' ? exercise.sets[action.payload.setIndex] : null;
              if (requestedSet?.status === 'pending') {
                return action.payload.setIndex ?? 0;
              }

              return Math.max(0, findFirstPendingSetIndex(exercise));
            })(),
          },
          exercises: state.activeSession.exercises.map((exercise) =>
            exercise.slotId === action.payload.slotId ? { ...exercise, isExpanded: true } : exercise,
          ),
          updatedAt: new Date().toISOString(),
        },
      };

    case 'exercise/expand':
      if (!state.activeSession) {
        return state;
      }
      return {
        ...state,
        activeSession: {
          ...state.activeSession,
          ui: {
            ...state.activeSession.ui,
            expandedSlotIds: Array.from(new Set([...state.activeSession.ui.expandedSlotIds, action.payload.slotId])),
          },
        },
      };

    case 'exercise/collapse':
      if (!state.activeSession) {
        return state;
      }
      return {
        ...state,
        activeSession: {
          ...state.activeSession,
          ui: {
            ...state.activeSession.ui,
            expandedSlotIds: state.activeSession.ui.expandedSlotIds.filter((slotId) => slotId !== action.payload.slotId),
          },
        },
      };

    case 'set/updateDraft':
      if (!state.activeSession) {
        return state;
      }
      return {
        ...state,
        activeSession: {
          ...state.activeSession,
          exercises: state.activeSession.exercises.map((exercise) => {
            if (exercise.slotId !== action.payload.slotId) {
              return exercise;
            }
            return {
              ...exercise,
              sets: exercise.sets.map((set) =>
                set.setIndex === action.payload.setIndex
                  ? {
                      ...set,
                      draftLoadText: action.payload.patch.loadText ?? set.draftLoadText,
                      draftRepsText: action.payload.patch.repsText ?? set.draftRepsText,
                      edited: true,
                    }
                  : set,
              ),
            };
          }),
          updatedAt: new Date().toISOString(),
        },
      };

    case 'set/complete': {
      if (!state.activeSession) {
        return state;
      }

      const session = cloneSession(state.activeSession);
      const exerciseIndex = findExerciseIndex(session, action.payload.slotId);
      if (exerciseIndex < 0) {
        return state;
      }

      const exercise = session.exercises[exerciseIndex];
      const set = exercise.sets.find((item) => item.setIndex === action.payload.setIndex);
      if (!set || set.status === 'completed') {
        return state;
      }

      const actualReps = resolveDraftReps(set);
      if (!actualReps || actualReps <= 0) {
        return state;
      }

      const actualLoadKg = resolveDraftLoadKg(set, action.payload.unitPreference);
      if (exercise.trackingMode !== 'bodyweight' && (actualLoadKg === null || actualLoadKg === undefined)) {
        return state;
      }

      set.status = 'completed';
      set.actualReps = actualReps;
      set.actualLoadKg = actualLoadKg ?? 0;
      set.effort = set.effort ?? null;
      set.completedAt = new Date(action.payload.nowMs).toISOString();
      set.edited = true;

      exercise.status = finalizeExerciseStatus(exercise);
      const nextTarget = findNextPendingTarget(session, exerciseIndex, action.payload.setIndex);
      if (nextTarget) {
        updateActiveExercise(session, nextTarget.exerciseIndex, nextTarget.setIndex);
      } else {
        session.ui.activeSlotId = exercise.slotId;
        session.ui.activeSetIndex = action.payload.setIndex;
      }
      session.restTimer = {
        status: 'running',
        exerciseSlotId: exercise.slotId,
        setIndex: action.payload.setIndex,
        startedAtMs: action.payload.nowMs,
        endsAtMs: action.payload.nowMs + exercise.restSecondsMin * 1000,
        durationSeconds: exercise.restSecondsMin,
      };
      session.ui.focusedField = null;
      session.updatedAt = new Date(action.payload.nowMs).toISOString();

      return { ...state, activeSession: session, nowMs: action.payload.nowMs };
    }

    case 'set/recordEffort': {
      if (!state.activeSession) {
        return state;
      }

      const session = cloneSession(state.activeSession);
      const exerciseIndex = findExerciseIndex(session, action.payload.slotId);
      if (exerciseIndex < 0) {
        return state;
      }

      const exercise = session.exercises[exerciseIndex];
      const set = exercise.sets.find((item) => item.setIndex === action.payload.setIndex);
      if (!set || set.status !== 'completed') {
        return state;
      }

      set.effort = action.payload.effort;
      session.updatedAt = new Date().toISOString();
      return { ...state, activeSession: session };
    }

    case 'set/repeatLast': {
      if (!state.activeSession) {
        return state;
      }

      const session = cloneSession(state.activeSession);
      const exerciseIndex = findExerciseIndex(session, action.payload.slotId);
      if (exerciseIndex < 0) {
        return state;
      }

      const exercise = session.exercises[exerciseIndex];
      const targetSet = exercise.sets.find((item) => item.setIndex === action.payload.setIndex);
      if (!targetSet || targetSet.status !== 'pending') {
        return state;
      }

      const sourceSet = [...exercise.sets]
        .filter((item) => item.setIndex < action.payload.setIndex)
        .reverse()
        .find((item) => item.status === 'completed' && typeof item.actualReps === 'number');

      if (!sourceSet || (exercise.trackingMode !== 'bodyweight' && typeof sourceSet.actualLoadKg !== 'number')) {
        return state;
      }

      targetSet.draftLoadText =
        exercise.trackingMode === 'bodyweight'
          ? ''
          : formatWeightInputValue(sourceSet.actualLoadKg ?? 0, action.payload.unitPreference);
      targetSet.draftRepsText = String(sourceSet.actualReps ?? '');
      targetSet.actualLoadKg = sourceSet.actualLoadKg ?? 0;
      targetSet.actualReps = sourceSet.actualReps;
      targetSet.effort = sourceSet.effort ?? null;
      targetSet.completedAt = new Date(action.payload.nowMs).toISOString();
      targetSet.status = 'completed';
      targetSet.edited = true;

      exercise.status = finalizeExerciseStatus(exercise);
      const nextTarget = findNextPendingTarget(session, exerciseIndex, action.payload.setIndex);
      if (nextTarget) {
        updateActiveExercise(session, nextTarget.exerciseIndex, nextTarget.setIndex);
      } else {
        session.ui.activeSlotId = exercise.slotId;
        session.ui.activeSetIndex = action.payload.setIndex;
      }
      session.restTimer = {
        status: 'running',
        exerciseSlotId: exercise.slotId,
        setIndex: action.payload.setIndex,
        startedAtMs: action.payload.nowMs,
        endsAtMs: action.payload.nowMs + exercise.restSecondsMin * 1000,
        durationSeconds: exercise.restSecondsMin,
      };
      session.ui.focusedField = null;
      session.updatedAt = new Date(action.payload.nowMs).toISOString();

      return { ...state, activeSession: session, nowMs: action.payload.nowMs };
    }

    case 'set/undo': {
      if (!state.activeSession) {
        return state;
      }
      const session = cloneSession(state.activeSession);
      const exerciseIndex = findExerciseIndex(session, action.payload.slotId);
      if (exerciseIndex < 0) {
        return state;
      }

      const exercise = session.exercises[exerciseIndex];
      const set = exercise.sets.find((item) => item.setIndex === action.payload.setIndex);
      if (!set) {
        return state;
      }

      set.status = 'pending';
      set.actualLoadKg = undefined;
      set.actualReps = undefined;
      set.effort = null;
      set.completedAt = undefined;
      exercise.status = 'active';
      session.restTimer = createInitialTimer();
      updateActiveExercise(session, exerciseIndex, action.payload.setIndex);
      session.updatedAt = new Date().toISOString();

      return { ...state, activeSession: session };
    }

    case 'exercise/addSet': {
      if (!state.activeSession) {
        return state;
      }

      const session = cloneSession(state.activeSession);
      const exerciseIndex = findExerciseIndex(session, action.payload.slotId);
      if (exerciseIndex < 0) {
        return state;
      }

      const exercise = session.exercises[exerciseIndex];
      const sourceSet = exercise.sets[exercise.sets.length - 1];
      const nextSetIndex = exercise.sets.reduce((maxValue, set) => Math.max(maxValue, set.setIndex), -1) + 1;

      exercise.sets = [
        ...exercise.sets,
        {
          setIndex: nextSetIndex,
          plannedLoadKg: sourceSet?.actualLoadKg ?? sourceSet?.plannedLoadKg,
          plannedRepsMin: sourceSet?.plannedRepsMin ?? exercise.sets[0]?.plannedRepsMin ?? 1,
          plannedRepsMax: sourceSet?.plannedRepsMax ?? exercise.sets[0]?.plannedRepsMax ?? 1,
          draftLoadText: '',
          draftRepsText: '',
          status: 'pending',
          effort: null,
          edited: false,
        },
      ];
      exercise.status = 'active';
      updateActiveExercise(session, exerciseIndex, nextSetIndex);
      session.restTimer = createInitialTimer();
      session.updatedAt = new Date().toISOString();
      return { ...state, activeSession: session };
    }

    case 'exercise/skip': {
      if (!state.activeSession) {
        return state;
      }
      const session = cloneSession(state.activeSession);
      const exerciseIndex = findExerciseIndex(session, action.payload.slotId);
      if (exerciseIndex < 0) {
        return state;
      }

      const exercise = session.exercises[exerciseIndex];
      exercise.sets = exercise.sets.map((set) =>
        set.status === 'completed'
          ? set
          : {
              ...set,
              status: 'skipped',
              skippedReason: action.payload.reason ?? 'Skipped by user',
            },
      );
      exercise.status = 'skipped';
      session.restTimer = createInitialTimer();
      advanceAfterMutation(session, exerciseIndex);
      session.updatedAt = new Date().toISOString();
      return { ...state, activeSession: session };
    }

    case 'exercise/insertAfter': {
      if (!state.activeSession) {
        return state;
      }

      const session = cloneSession(state.activeSession);
      const exerciseIndex = findExerciseIndex(session, action.payload.afterSlotId);
      if (exerciseIndex < 0) {
        return state;
      }

      const insertIndex = exerciseIndex + 1;
      const insertedExercise = materializeInsertedExercise(action.payload.exercise, insertIndex);
      session.exercises.splice(insertIndex, 0, insertedExercise);
      session.exercises = session.exercises.map((exercise, index) => ({
        ...exercise,
        orderIndex: index,
      }));
      session.updatedAt = new Date().toISOString();
      return { ...state, activeSession: session };
    }

    case 'exercise/swap': {
      if (!state.activeSession) {
        return state;
      }
      const session = cloneSession(state.activeSession);
      const exerciseIndex = findExerciseIndex(session, action.payload.slotId);
      if (exerciseIndex < 0) {
        return state;
      }
      const exercise = session.exercises[exerciseIndex];
      exercise.sourceExerciseName = exercise.sourceExerciseName ?? exercise.exerciseName;
      exercise.exerciseName = action.payload.exerciseName;
      exercise.substitutionGroup = action.payload.substitutionGroup;
      exercise.status = 'swapped';
      session.ui.swapSheetSlotId = null;
      session.updatedAt = new Date().toISOString();
      return { ...state, activeSession: session };
    }

    case 'exercise/updateNotes':
      if (!state.activeSession) {
        return state;
      }
      return {
        ...state,
        activeSession: {
          ...state.activeSession,
          exercises: state.activeSession.exercises.map((exercise) =>
            exercise.slotId === action.payload.slotId ? { ...exercise, notes: action.payload.notes } : exercise,
          ),
          ui: { ...state.activeSession.ui, noteEditorSlotId: null },
        },
      };

    case 'timer/start':
      if (!state.activeSession) {
        return state;
      }
      return {
        ...state,
        activeSession: {
          ...state.activeSession,
          restTimer: {
            status: 'running',
            exerciseSlotId: action.payload.slotId,
            setIndex: action.payload.setIndex,
            startedAtMs: action.payload.nowMs,
            endsAtMs: action.payload.nowMs + action.payload.durationSeconds * 1000,
            durationSeconds: action.payload.durationSeconds,
          },
        },
        nowMs: action.payload.nowMs,
      };

    case 'timer/pause':
      if (!state.activeSession || state.activeSession.restTimer.status !== 'running' || !state.activeSession.restTimer.endsAtMs) {
        return state;
      }
      return {
        ...state,
        activeSession: {
          ...state.activeSession,
          restTimer: {
            ...state.activeSession.restTimer,
            status: 'paused',
            durationSeconds: Math.max(0, Math.ceil((state.activeSession.restTimer.endsAtMs - state.nowMs) / 1000)),
          },
        },
      };

    case 'timer/resume':
      if (!state.activeSession || state.activeSession.restTimer.status !== 'paused') {
        return state;
      }
      return {
        ...state,
        activeSession: {
          ...state.activeSession,
          restTimer: {
            ...state.activeSession.restTimer,
            status: 'running',
            startedAtMs: action.payload.nowMs,
            endsAtMs: action.payload.nowMs + state.activeSession.restTimer.durationSeconds * 1000,
          },
        },
        nowMs: action.payload.nowMs,
      };

    case 'timer/override':
      if (!state.activeSession || state.activeSession.restTimer.status === 'idle') {
        return state;
      }
      return {
        ...state,
        activeSession: {
          ...state.activeSession,
          restTimer:
            state.activeSession.restTimer.status === 'paused'
              ? {
                  ...state.activeSession.restTimer,
                  durationSeconds: action.payload.durationSeconds,
                  startedAtMs: null,
                  endsAtMs: null,
                }
              : {
                  ...state.activeSession.restTimer,
                  durationSeconds: action.payload.durationSeconds,
                  startedAtMs: action.payload.nowMs,
                  endsAtMs: action.payload.nowMs + action.payload.durationSeconds * 1000,
                },
        },
        nowMs: action.payload.nowMs,
      };

    case 'timer/clear':
      if (!state.activeSession) {
        return state;
      }
      return {
        ...state,
        activeSession: {
          ...state.activeSession,
          restTimer: createInitialTimer(),
        },
      };

    case 'session/openFinishSummary':
      if (!state.activeSession) {
        return state;
      }
      return {
        ...state,
        activeSession: {
          ...state.activeSession,
          ui: {
            ...state.activeSession.ui,
            finishSummaryOpen: true,
          },
        },
      };

    case 'session/finishWorkout':
      return completeWorkoutSession(state, action.payload?.performedAt);

    case 'session/discardWorkout':
      return {
        ...state,
        activeSession: null,
        completionSummary: null,
      };

    case 'session/clearCompletedSession':
      return {
        ...state,
        activeSession: null,
        completionSummary: null,
      };

    default:
      return state;
  }
}

function cloneSession(session: WorkoutSessionRuntime) {
  return {
    ...session,
    exercises: session.exercises.map(cloneExercise),
    restTimer: { ...session.restTimer },
    ui: { ...session.ui },
  };
}

export function completeWorkoutSession(state: WorkoutFeatureState, performedAt = new Date().toISOString()) {
  if (!state.activeSession) {
    return state;
  }

  const session = cloneSession(state.activeSession);
  session.status = 'completed';
  session.completedAt = performedAt;
  session.updatedAt = performedAt;
  session.restTimer = createInitialTimer();
  session.ui.finishSummaryOpen = true;

  const summary = buildSummary(session);
  const slotHistory: WorkoutHistoryStore['slotHistory'] = { ...state.history.slotHistory };

  session.exercises.forEach((exercise) => {
    const sets = exercise.sets
      .filter((set) => set.status === 'completed' && typeof set.actualLoadKg === 'number' && typeof set.actualReps === 'number')
      .map((set) => ({
        setIndex: set.setIndex,
        loadKg: set.actualLoadKg ?? 0,
        reps: set.actualReps ?? 0,
        completedAt: set.completedAt ?? performedAt,
        effort: set.effort ?? null,
      }));

    const entry: WorkoutSlotHistoryEntry = {
      slotId: exercise.slotId,
      templateId: session.templateId,
      templateName: session.templateName,
      exerciseName: exercise.exerciseName,
      substitutionGroup: exercise.substitutionGroup,
      performedAt,
      sessionId: session.sessionId,
      sets,
      skipped: exercise.status === 'skipped',
      swappedFrom: exercise.sourceExerciseName,
    };

    slotHistory[exercise.slotId] = [entry, ...(slotHistory[exercise.slotId] ?? [])].slice(0, 10);
  });

  return {
    ...state,
    activeSession: session,
    completionSummary: summary,
    history: {
      ...state.history,
      sessions: [summary, ...state.history.sessions].slice(0, 20),
      slotHistory,
    },
  };
}

export function selectActiveExercise(session: WorkoutSessionRuntime | null) {
  if (!session || !session.ui.activeSlotId) {
    return null;
  }
  return session.exercises.find((exercise) => exercise.slotId === session.ui.activeSlotId) ?? null;
}

export function selectNextExercise(session: WorkoutSessionRuntime | null) {
  if (!session) {
    return null;
  }
  const activeIndex = session.exercises.findIndex((exercise) => exercise.slotId === session.ui.activeSlotId);
  const nextIndex = session.exercises.findIndex((exercise, index) => index > activeIndex && exercise.status !== 'completed' && exercise.status !== 'skipped');
  return session.exercises[nextIndex >= 0 ? nextIndex : -1] ?? null;
}

export function selectWorkoutSummary(state: WorkoutFeatureState) {
  return state.completionSummary;
}

export function selectProgressionHint(state: WorkoutFeatureState, slotId: string) {
  const exercise = state.activeSession?.exercises.find((item) => item.slotId === slotId);
  const history = exercise ? getHistoryEntries(state.history, slotId, exercise.templateSlotId)[0] : null;
  if (!exercise || !history) {
    return null;
  }

  const lastSet = history.sets[history.sets.length - 1];
  if (!lastSet) {
    return null;
  }

  if (lastSet.reps >= exercise.sets[0].plannedRepsMax) {
    return 'Increase load next time';
  }

  if (lastSet.reps >= exercise.sets[0].plannedRepsMin) {
    return 'Repeat load and beat reps';
  }

  return 'Repeat last load';
}















