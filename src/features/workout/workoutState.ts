import { createId } from '../../lib/ids';
import { convertWeightToKg, formatWeightInputValue, parseNumberInput } from '../../lib/format';
import {
  ActiveCardioSession,
  pauseCardioSession,
  resumeCardioSession,
  startCardioSession,
} from '../../lib/cardio';
import { CardioActivityType } from '../../types/models';
import { isUnloadedTrackingMode } from './workoutTypes';
import { GuidedResumeAnchor, WorkoutTemplateExercise, WorkoutExerciseInsertInput, WorkoutExerciseInstance, WorkoutHistoryStore, WorkoutPersistenceBundle, WorkoutProgressionOptions, WorkoutRestTimerState, WorkoutRuntimeTemplate, WorkoutSessionMaterializeOptions, WorkoutSessionRuntime, WorkoutSessionSummary, WorkoutSetDraftInput, WorkoutSetEffort, WorkoutSetInstance, WorkoutSlotHistoryEntry, WorkoutSlotHistorySet, WorkoutStatus, WorkoutUiState, WorkoutExerciseStatus } from './workoutTypes';
import { getWorkoutTemplateById } from './workoutCatalog';
import { resolveProgressedLoadKg, resolveProgressedReps } from '../../lib/progressionGate';
import { findHistoricalSetForIndex, findLatestEntryForExerciseName } from '../../lib/exerciseHistoryLookup';

export interface WorkoutFeatureState {
  hydrated: boolean;
  isRestoring: boolean;
  nowMs: number;
  history: WorkoutHistoryStore;
  activeSession: WorkoutSessionRuntime | null;
  activeCardio: ActiveCardioSession | null;
  completionSummary: WorkoutSessionSummary | null;
}

export type WorkoutAction =
  | { type: 'session/hydrate'; payload: WorkoutPersistenceBundle }
  | { type: 'session/markRestoring'; payload: { value: boolean } }
  | {
      type: 'session/startFromTemplate';
      payload: {
        templateId: string;
        sessionOrderIndex: number;
        unitPreference: 'kg' | 'lb';
        progression?: WorkoutProgressionOptions;
      };
    }
  | {
      type: 'session/startFromRuntimeTemplate';
      payload: {
        template: WorkoutRuntimeTemplate;
        sessionOrderIndex: number;
        unitPreference: 'kg' | 'lb';
        progression?: WorkoutProgressionOptions;
      };
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
  | { type: 'exercise/removeSet'; payload: { slotId: string } }
  /**
   * A session logged outside the guided player, remembered for next time.
   *
   * The weight a set opens on comes from `slotHistory`, and the only writer
   * was finishWorkout — the guided player's own finish. A lift done in an
   * empty workout therefore left no trace the prefill could see, and opened at
   * nothing the next time ("paino automaattisesti siihen mitä on viimeksi
   * tehnyt", #bugs 2026-08-27), even though the app had the numbers in the
   * database all along. The named lookup already reads across every slot, so
   * this only has to put the entry somewhere.
   */
  | {
      type: 'history/recordLogged';
      payload: {
        performedAt: string;
        sessionId: string;
        templateName: string;
        exercises: Array<{
          exerciseName: string;
          sets: Array<{ setIndex: number; loadKg: number; reps: number; completedAt?: string | null }>;
        }>;
      };
    }
  | { type: 'exercise/skip'; payload: { slotId: string; reason?: string } }
  | { type: 'exercise/insertAfter'; payload: { afterSlotId: string; exercise: WorkoutExerciseInsertInput } }
  | {
      type: 'exercise/swap';
      payload: {
        slotId: string;
        exerciseName: string;
        substitutionGroup: string;
        // The swapped-in lift's own history seeds the remaining sets, so the
        // reducer has to write the draft in the unit the logger reads back.
        unitPreference: 'kg' | 'lb';
      };
    }
  | { type: 'exercise/updateNotes'; payload: { slotId: string; notes: string } }
  | { type: 'timer/start'; payload: { slotId: string; setIndex: number; durationSeconds: number; nowMs: number } }
  | { type: 'timer/pause' }
  | { type: 'timer/resume'; payload: { nowMs: number } }
  | { type: 'timer/override'; payload: { durationSeconds: number; nowMs: number } }
  | { type: 'timer/clear' }
  | { type: 'session/setGuidedStep'; payload: { stepIndex: number; anchor?: GuidedResumeAnchor } }
  | { type: 'cardio/start'; payload: { activityType: CardioActivityType; nowMs: number } }
  | { type: 'cardio/pause'; payload: { nowMs: number } }
  | { type: 'cardio/resume'; payload: { nowMs: number } }
  | { type: 'cardio/clear' }
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

/**
 * What a set's prefill resolved to, named rather than inferred.
 *
 * Spelling it out is what keeps `materializeExercise` honest: it builds the
 * set by listing fields by hand, and while this shape was a union inferred
 * from three separate returns, a field that existed on only one branch could
 * be — and was — silently left off that list. `heldForFatigue` was that field,
 * and the recovery badge it drives never once appeared.
 */
interface ResolvedSetDraft {
  draftLoadText: string;
  draftRepsText: string;
  plannedLoadKg: number | undefined;
  autoProgressedFromKg: number | undefined;
  heldForFatigue: boolean | undefined;
  prefilledFromPerformedAt: string | undefined;
  plannedTargetReps: number | undefined;
  autoProgressedFromReps: number | undefined;
}

/**
 * Nothing on this slot — but the same lift may have been done somewhere else:
 * another program, another day, an empty workout. That weight is recorded, not
 * estimated, so it seeds the prefill instead of opening at zero.
 *
 * What it deliberately does NOT do is feed the progression gate. The gate
 * decides "rep ceiling cleared on every working set" against THIS template's
 * rep range, and those other sessions were performed under a different
 * prescription — a load increase computed from them would be a Pro feature
 * moving weights off sessions it never watched. So: the gate moves weights it
 * has seen, and this lookup only stops you starting from nothing.
 * `autoProgressedFromKg` stays undefined here, which is what keeps the AUTO
 * badge off a weight the gate did not choose.
 */
function resolveNamedHistoryDraft(
  history: WorkoutHistoryStore,
  setIndex: number,
  unitPreference: 'kg' | 'lb',
  exercise: WorkoutTemplateExercise,
): ResolvedSetDraft {
  const blank: ResolvedSetDraft = {
    draftLoadText: '',
    draftRepsText: '',
    plannedLoadKg: undefined,
    autoProgressedFromKg: undefined,
    heldForFatigue: undefined,
    prefilledFromPerformedAt: undefined,
    // Borrowed history does not feed the rep gate either — see above.
    plannedTargetReps: undefined,
    autoProgressedFromReps: undefined,
  };

  const entry = findLatestEntryForExerciseName(history.slotHistory, exercise.exerciseName, {
    // 0 kg is a real answer for bodyweight work and a missing one for a loaded
    // lift — the guided player used to hide the weight field, so zeroes exist.
    requireLoaded: !isUnloadedTrackingMode(exercise.trackingMode),
  });
  const matched = findHistoricalSetForIndex(entry, setIndex);
  if (!entry || !matched) {
    return blank;
  }

  return {
    draftLoadText: formatWeightInputValue(matched.loadKg, unitPreference),
    draftRepsText: '',
    plannedLoadKg: matched.loadKg,
    autoProgressedFromKg: undefined,
    // The gate never looked at this weight, so it has no hold to report on it.
    heldForFatigue: undefined,
    // Where it came from, so the logger can say so rather than presenting a
    // weight from another program as if it belonged to this slot.
    prefilledFromPerformedAt: entry.performedAt,
    plannedTargetReps: undefined,
    autoProgressedFromReps: undefined,
  };
}

function resolveHistoricalSetDraft(
  history: WorkoutHistoryStore,
  slotId: string,
  templateSlotId: string,
  setIndex: number,
  unitPreference: 'kg' | 'lb',
  exercise: WorkoutTemplateExercise,
  options: WorkoutSessionMaterializeOptions,
): ResolvedSetDraft {
  const entries = getHistoryEntries(history, slotId, templateSlotId);
  const latest = entries[0];
  const matched = findHistoricalSetForIndex(latest, setIndex);

  if (!matched) {
    // This slot has been trained before, this set index just was not reached
    // (a template that added a set). Unchanged: the slot is the better source
    // and it has nothing for this index.
    if (entries.length > 0) {
      return {
        draftLoadText: '',
        draftRepsText: '',
        plannedLoadKg: undefined,
        autoProgressedFromKg: undefined,
        heldForFatigue: undefined,
        prefilledFromPerformedAt: undefined,
        plannedTargetReps: undefined,
        autoProgressedFromReps: undefined,
      };
    }
    return resolveNamedHistoryDraft(history, setIndex, unitPreference, exercise);
  }

  // Automated progression (ADR-004): when the last session cleared the rep
  // ceiling on every working set, the prefill moves up by the level's
  // increment. Every other outcome repeats last time's load, which is what
  // this function did unconditionally before the gate existed.
  const { loadKg, fromLoadKg, heldForFatigue } = resolveProgressedLoadKg({
    history: entries,
    repsMin: exercise.repsMin,
    repsMax: exercise.repsMax,
    targetSets: exercise.sets,
    level: options.setupLevel,
    trackingMode: exercise.trackingMode,
    automatedProgressionEnabled: options.automatedProgressionEnabled ?? false,
    // Recovery, read once at session start. The gate has had these holds
    // since it was written; until now nothing passed a signal in, so they
    // never fired on a single set.
    fatigueSignal: options.fatigueSignal,
    fallbackLoadKg: matched.loadKg,
  });

  // Bodyweight progresses by reps where the load gate stays silent — same
  // options, same history, and the same Pro gate riding in on
  // automatedProgressionEnabled.
  const repsResolution = resolveProgressedReps({
    history: entries,
    templateTargetReps: exercise.repsMax,
    targetSets: exercise.sets,
    level: options.setupLevel,
    trackingMode: exercise.trackingMode,
    automatedProgressionEnabled: options.automatedProgressionEnabled ?? false,
    fatigueSignal: options.fatigueSignal,
  });

  // Prefill the weight so the user usually just adjusts it with the console
  // and types reps; reps stay empty so entering them is the signal that logs
  // the set (handoff §5).
  return {
    draftLoadText: formatWeightInputValue(loadKg, unitPreference),
    draftRepsText: '',
    plannedLoadKg: loadKg,
    autoProgressedFromKg: fromLoadKg ?? undefined,
    heldForFatigue: (heldForFatigue || repsResolution.heldForFatigue) || undefined,
    // This slot's own history — the ordinary case, nothing to explain.
    prefilledFromPerformedAt: undefined,
    plannedTargetReps: repsResolution.progressed ? repsResolution.targetReps : undefined,
    autoProgressedFromReps: repsResolution.fromReps ?? undefined,
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
    const resolved = resolveHistoricalSetDraft(
      options.history,
      scopedSlotId,
      exercise.slotId,
      setIndex,
      options.unitPreference,
      exercise,
      options,
    );

    return {
      setIndex,
      plannedLoadKg: resolved.plannedLoadKg,
      plannedRepsMin: exercise.repsMin,
      plannedRepsMax: exercise.repsMax,
      draftLoadText: resolved.draftLoadText,
      draftRepsText: resolved.draftRepsText,
      autoProgressedFromKg: resolved.autoProgressedFromKg,
      // These two were computed, carried all the way here by
      // resolveHistoricalSetDraft, and then dropped: this object lists its
      // fields by hand, and neither was ever on the list. So the gate held
      // loads for recovery and the badge never once appeared — a Pro
      // behaviour the paywall sells by name, invisible since it was wired.
      heldForFatigue: resolved.heldForFatigue,
      prefilledFromPerformedAt: resolved.prefilledFromPerformedAt,
      plannedTargetReps: resolved.plannedTargetReps,
      autoProgressedFromReps: resolved.autoProgressedFromReps,
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
  const orderedSessions = template.sessions.slice().sort((left, right) => left.orderIndex - right.orderIndex);
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
    templateSessionId: orderedSessions.length === 1 ? orderedSessions[0]?.id ?? null : null,
    templateName: template.name,
    status: 'active',
    startedAt,
    updatedAt: startedAt,
    elapsedSeconds: 0,
    pausedMs: 0,
    pausedAt: null,
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

/**
 * Closes any open pause and puts the session back to running.
 *
 * Called on resume and on finish, so a workout paused and then ended does not
 * carry an open pause window that nothing ever closes.
 */
function closePause(session: WorkoutSessionRuntime): WorkoutSessionRuntime {
  if (!session.pausedAt) {
    return session.status === 'paused' ? { ...session, status: 'active' } : session;
  }
  const held = Math.max(0, Date.now() - new Date(session.pausedAt).getTime());
  return {
    ...session,
    status: 'active',
    pausedMs: (session.pausedMs ?? 0) + held,
    pausedAt: null,
  };
}

/** Wall time since the start, less every pause — including one still open. */
export function elapsedSecondsOf(session: WorkoutSessionRuntime, nowMs: number): number {
  const open = session.pausedAt ? Math.max(0, nowMs - new Date(session.pausedAt).getTime()) : 0;
  const wall = nowMs - new Date(session.startedAt).getTime();
  return Math.max(0, Math.floor((wall - (session.pausedMs ?? 0) - open) / 1000));
}

function buildSummary(session: WorkoutSessionRuntime): WorkoutSessionSummary {
  const completedSets = session.exercises.flatMap((exercise) => exercise.sets).filter((set) => set.status === 'completed');
  const performedAt = session.completedAt ?? new Date().toISOString();
  return {
    sessionId: session.sessionId,
    templateId: session.templateId,
    templateSessionId: session.templateSessionId,
    templateName: session.templateName,
    performedAt,
    // Less the pauses, so the number written to history is the same one the
    // player showed while the workout was running.
    durationMinutes: Math.max(1, Math.round(elapsedSecondsOf(session, new Date(performedAt).getTime()) / 60) || 1),
    setsCompleted: completedSets.length,
    exercisesCompleted: session.exercises.filter((exercise) => exercise.status === 'completed').length,
    exercisesSkipped: session.exercises.filter((exercise) => exercise.status === 'skipped').length,
    exercisesSwapped: session.exercises.filter((exercise) => exercise.status === 'swapped').length,
    totalVolumeKg: completedSets.reduce((sum, set) => sum + (set.actualLoadKg ?? 0) * (set.actualReps ?? 0), 0),
  };
}

/**
 * The exercise's status, derived from its sets.
 *
 * `skipped` means nothing was done — every set skipped. An exercise with one
 * logged set and the rest skipped is *done*, not skipped: the set happened,
 * and downstream `skipped` is what drops a log from volume, set counts and
 * records. That distinction used to be lost on "skip this exercise", which
 * hard-set `skipped` regardless of what had been logged, so a set the
 * completion screen celebrated as a record was gone from every stat ten
 * seconds later.
 */
function finalizeExerciseStatus(exercise: WorkoutExerciseInstance): WorkoutExerciseStatus {
  if (exercise.sets.every((set) => set.status === 'skipped')) {
    return 'skipped';
  }

  const hasPendingSet = exercise.sets.some((set) => set.status === 'pending');
  if (!hasPendingSet) {
    // Every set is settled and at least one was completed.
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
  activeCardio: null,
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
        activeCardio: action.payload.activeCardio ?? null,
        completionSummary: null,
      };

    case 'session/markRestoring':
      return { ...state, isRestoring: action.payload.value };

    case 'session/startFromTemplate': {
      const session = materializeWorkoutSession(action.payload.templateId, {
        history: state.history,
        unitPreference: action.payload.unitPreference,
        sessionOrderIndex: action.payload.sessionOrderIndex,
        automatedProgressionEnabled: action.payload.progression?.automatedProgressionEnabled ?? false,
        fatigueSignal: action.payload.progression?.fatigueSignal,
        setupLevel: action.payload.progression?.setupLevel ?? null,
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
        automatedProgressionEnabled: action.payload.progression?.automatedProgressionEnabled ?? false,
        fatigueSignal: action.payload.progression?.fatigueSignal,
        setupLevel: action.payload.progression?.setupLevel ?? null,
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
      return {
        ...state,
        // Status and the open pause window are closed here, not left to the
        // caller: resume used to hand the session straight back with
        // `status: 'paused'` still on it, so the tick stayed asleep and the
        // clock never restarted.
        activeSession: closePause(action.payload.session),
        completionSummary: null,
      };

    case 'session/pause': {
      if (!state.activeSession || state.activeSession.pausedAt) {
        return state;
      }
      const pausedAt = new Date().toISOString();
      return {
        ...state,
        activeSession: {
          ...state.activeSession,
          status: 'paused',
          pausedAt,
          updatedAt: pausedAt,
        },
      };
    }

    case 'session/tick':
      if (!state.activeSession) {
        return { ...state, nowMs: action.payload.nowMs };
      }
      if (state.activeSession.status !== 'active') {
        return { ...state, nowMs: action.payload.nowMs };
      }
      return {
        ...state,
        nowMs: action.payload.nowMs,
        activeSession: {
          ...state.activeSession,
          elapsedSeconds: elapsedSecondsOf(state.activeSession, action.payload.nowMs),
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
      if (!isUnloadedTrackingMode(exercise.trackingMode) && (actualLoadKg === null || actualLoadKg === undefined)) {
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
        // Carry the weight just used forward to the next set in the SAME
        // exercise (if it has no weight yet), so the user usually only types
        // reps for the following sets.
        if (nextTarget.exerciseIndex === exerciseIndex) {
          const nextSet = exercise.sets.find((item) => item.setIndex === nextTarget.setIndex);
          if (nextSet && !nextSet.draftLoadText.trim()) {
            nextSet.draftLoadText = formatWeightInputValue(set.actualLoadKg ?? 0, action.payload.unitPreference);
          }
        }
      } else {
        session.ui.activeSlotId = exercise.slotId;
        session.ui.activeSetIndex = action.payload.setIndex;
      }
      // Rest is the gap before the next set. `nextTarget` is null only when
      // nothing anywhere in the session is still pending, and starting a timer
      // there counts down to a set that does not exist — while the floating bar
      // sits over the finish button.
      session.restTimer = nextTarget
        ? {
            status: 'running',
            exerciseSlotId: exercise.slotId,
            setIndex: action.payload.setIndex,
            startedAtMs: action.payload.nowMs,
            endsAtMs: action.payload.nowMs + exercise.restSecondsMin * 1000,
            durationSeconds: exercise.restSecondsMin,
          }
        : createInitialTimer();
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

      if (!sourceSet || (!isUnloadedTrackingMode(exercise.trackingMode) && typeof sourceSet.actualLoadKg !== 'number')) {
        return state;
      }

      targetSet.draftLoadText =
        isUnloadedTrackingMode(exercise.trackingMode)
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
      // Same rule as set/logSet: no next set, no rest.
      session.restTimer = nextTarget
        ? {
            status: 'running',
            exerciseSlotId: exercise.slotId,
            setIndex: action.payload.setIndex,
            startedAtMs: action.payload.nowMs,
            endsAtMs: action.payload.nowMs + exercise.restSecondsMin * 1000,
            durationSeconds: exercise.restSecondsMin,
          }
        : createInitialTimer();
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

    /**
     * A logged session that never went through the player, filed where the
     * prefill can find it.
     *
     * Additive by construction: it writes under its own slot key and touches
     * no existing entry, so a lift with guided history keeps it and only gains
     * a newer entry when the freestyle session really is newer — which is what
     * "what you last did" means.
     */
    case 'history/recordLogged': {
      const { performedAt, sessionId, templateName, exercises } = action.payload;
      const slotHistory: WorkoutHistoryStore['slotHistory'] = { ...state.history.slotHistory };

      exercises.forEach((exercise) => {
        const name = exercise.exerciseName?.trim();
        // A row with no sets is an exercise that was listed and not done. It
        // is not a weight, and prefilling from it would open the next session
        // on nothing while claiming a source.
        if (!name || exercise.sets.length === 0) {
          return;
        }
        // Keyed by the lift, not by a slot it never had. The named lookup
        // reads across every key, so this only has to be stable and its own.
        const slotId = `logged:${name.toLowerCase()}`;
        const entry: WorkoutSlotHistoryEntry = {
          slotId,
          templateId: '',
          templateName,
          exerciseName: name,
          substitutionGroup: '',
          performedAt,
          sessionId,
          sets: exercise.sets.map((set) => ({
            setIndex: set.setIndex,
            loadKg: set.loadKg,
            reps: set.reps,
            completedAt: set.completedAt ?? performedAt,
            effort: null,
          })),
          skipped: false,
        };
        slotHistory[slotId] = [entry, ...(slotHistory[slotId] ?? [])].slice(0, 10);
      });

      return { ...state, history: { ...state.history, slotHistory } };
    }

    /**
     * One set fewer, the other half of addSet.
     *
     * Only ever the last PENDING set, and never the last set standing:
     * removing a set you have already logged would throw away work through a
     * control meant for planning, and an exercise with no sets is not an
     * exercise. Both refusals are silent — the row simply does not change, and
     * the caller hides the control when there is nothing to take.
     */
    case 'exercise/removeSet': {
      if (!state.activeSession) {
        return state;
      }

      const session = cloneSession(state.activeSession);
      const exerciseIndex = findExerciseIndex(session, action.payload.slotId);
      if (exerciseIndex < 0) {
        return state;
      }

      const exercise = session.exercises[exerciseIndex];
      if (exercise.sets.length <= 1) {
        return state;
      }

      const last = exercise.sets[exercise.sets.length - 1];
      if (last.status !== 'pending') {
        return state;
      }

      exercise.sets = exercise.sets.slice(0, -1);
      const nextIndex = exercise.sets[exercise.sets.length - 1]?.setIndex ?? 0;
      updateActiveExercise(session, exerciseIndex, nextIndex);
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
      // Derived, not hard-set: a set logged before the skip keeps the
      // exercise out of `skipped`, and with it out of the filter that would
      // drop that set from every stat.
      exercise.status = finalizeExerciseStatus(exercise);
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
      // The prefilled load belongs to the lift you just swapped AWAY from — it
      // came from this slot's history, and a leg-press weight is not a front-
      // squat weight. Sets already logged keep what was actually done; the ones
      // still ahead are re-resolved for the lift you are actually about to do:
      // if you have squatted before — anywhere — that weight appears, otherwise
      // the field opens empty. `autoProgressedFromKg` is dropped either way,
      // because the progression gate did not choose a weight for this lift and
      // the badge must not say it did.
      const swappedInEntry = findLatestEntryForExerciseName(state.history.slotHistory, action.payload.exerciseName, {
        requireLoaded: !isUnloadedTrackingMode(exercise.trackingMode),
      });
      // Sets logged before this moment were a different lift. Clearing their
      // drafts is not enough on its own: the logger also carries forward from
      // the last COMPLETED set, which walked straight back over the swap and
      // put the old lift's weight on the new one (seen on device: 2.5 kg of
      // front squat reappearing on a back squat). This is the line it may not
      // cross. A second swap keeps the later line.
      const completedIndexes = exercise.sets
        .filter((set) => set.status === 'completed')
        .map((set) => set.setIndex);
      if (completedIndexes.length > 0) {
        exercise.swappedAfterSetIndex = Math.max(
          exercise.swappedAfterSetIndex ?? -1,
          ...completedIndexes,
        );
      }
      exercise.sets.forEach((set) => {
        if (set.status !== 'pending') {
          return;
        }
        const historical = findHistoricalSetForIndex(swappedInEntry, set.setIndex);
        set.draftLoadText = historical ? formatWeightInputValue(historical.loadKg, action.payload.unitPreference) : '';
        set.plannedLoadKg = historical?.loadKg;
        set.autoProgressedFromKg = undefined;
        // The rep target the gate picked belongs to the swapped-away lift too.
        set.plannedTargetReps = undefined;
        set.autoProgressedFromReps = undefined;
        set.prefilledFromPerformedAt = historical ? swappedInEntry?.performedAt : undefined;
      });
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

    case 'session/setGuidedStep': {
      if (!state.activeSession) {
        return state;
      }
      const { ui } = state.activeSession;
      const sameAnchor =
        JSON.stringify(ui.guidedResumeAnchor ?? null) === JSON.stringify(action.payload.anchor ?? null);
      if (ui.guidedStepIndex === action.payload.stepIndex && sameAnchor) {
        return state;
      }
      return {
        ...state,
        activeSession: {
          ...state.activeSession,
          ui: {
            ...ui,
            guidedStepIndex: action.payload.stepIndex,
            guidedResumeAnchor: action.payload.anchor,
          },
        },
      };
    }

    case 'cardio/start':
      return {
        ...state,
        activeCardio: startCardioSession(action.payload.activityType, action.payload.nowMs),
        nowMs: action.payload.nowMs,
      };

    case 'cardio/pause':
      if (!state.activeCardio) {
        return state;
      }
      return {
        ...state,
        activeCardio: pauseCardioSession(state.activeCardio, action.payload.nowMs),
        nowMs: action.payload.nowMs,
      };

    case 'cardio/resume':
      if (!state.activeCardio) {
        return state;
      }
      return {
        ...state,
        activeCardio: resumeCardioSession(state.activeCardio, action.payload.nowMs),
        nowMs: action.payload.nowMs,
      };

    case 'cardio/clear':
      if (!state.activeCardio) {
        return state;
      }
      return { ...state, activeCardio: null };

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















