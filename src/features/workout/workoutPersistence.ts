import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizeFreestyleDraftSnapshot } from '../../lib/emptyWorkoutSession';

import { normalizeActiveCardioSession } from '../../lib/cardio';
import { scrubImpossibleSessionLoads } from '../../lib/impossibleLoads';
import { getLargeItem, MissingPartsError, removeLargeItem, setLargeItem } from '../../storage/largeItem';
import { getWorkoutTemplateById } from './workoutCatalog';
import {
  WorkoutHistoryStore,
  WorkoutPersistenceBundle,
  WorkoutRestTimerState,
  WorkoutSessionRuntime,
  WorkoutSessionSummary,
  WorkoutUiState,
} from './workoutTypes';

const STORAGE_KEY = '@vinha/workout/v1';
/** Pre-rename key; see the note in storage/database.ts. */
const LEGACY_STORAGE_KEY = '@gymlog/workout/v1';
/** Where an unreadable bundle is put before an empty one replaces it. */
const CORRUPT_STORAGE_KEY = '@vinha/workout/corrupt';

export function createEmptyWorkoutHistory(): WorkoutHistoryStore {
  return {
    sessions: [],
    slotHistory: {},
    lastSelectedTemplateId: null,
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function buildScopedSlotId(templateId: string, templateSessionId: string, slotId: string) {
  return `${templateId}:${templateSessionId}:${slotId}`;
}

function normalizeHistory(input: unknown): WorkoutHistoryStore {
  if (!isObject(input)) {
    return createEmptyWorkoutHistory();
  }

  const sessions = Array.isArray(input.sessions)
    ? input.sessions.filter(isObject).map((item) => item as unknown as WorkoutSessionSummary)
    : [];

  return {
    sessions,
    slotHistory: isObject(input.slotHistory) ? (input.slotHistory as unknown as WorkoutHistoryStore['slotHistory']) : {},
    lastSelectedTemplateId: typeof input.lastSelectedTemplateId === 'string' ? input.lastSelectedTemplateId : null,
  };
}

const IDLE_REST_TIMER: WorkoutRestTimerState = {
  status: 'idle',
  exerciseSlotId: null,
  setIndex: null,
  startedAtMs: null,
  endsAtMs: null,
  durationSeconds: 0,
};

const FRESH_UI: WorkoutUiState = {
  activeSlotId: null,
  activeSetIndex: 0,
  focusedField: null,
  noteEditorSlotId: null,
  swapSheetSlotId: null,
  expandedSlotIds: [],
  finishSummaryOpen: false,
};

/**
 * The parts of a stored session everything below and the player itself reach
 * into without asking, made safe to reach into.
 *
 * The session is the one part of the bundle nobody checked: three string
 * fields and a cast. A ready-programme session missing its lifts, its rest
 * timer or its screen state threw in the slot remap below, and the catch
 * around the whole bundle set aside the history, the run and the free workout
 * with it — every lift's "last time" gone over one field of a draft
 * (persistence audit, 2026-09-20; the database had the same hole, #157).
 *
 * The lifts are the session: without a list of them there is nothing to
 * resume, and a lift that is not an object with its sets is not one. The
 * timer and the screen state are where the player was, not what was done,
 * so a missing one starts fresh.
 */
function repairSessionShape(input: Record<string, unknown>): WorkoutSessionRuntime | null {
  if (!Array.isArray(input.exercises)) {
    return null;
  }
  const exercises = input.exercises.filter(
    (exercise): exercise is Record<string, unknown> => isObject(exercise) && Array.isArray(exercise.sets),
  );
  const ui = isObject(input.ui) ? input.ui : {};
  return {
    ...input,
    exercises,
    restTimer: { ...IDLE_REST_TIMER, ...(isObject(input.restTimer) ? input.restTimer : {}) },
    ui: {
      ...FRESH_UI,
      activeSlotId: typeof exercises[0]?.slotId === 'string' ? exercises[0].slotId : null,
      ...ui,
      expandedSlotIds: Array.isArray(ui.expandedSlotIds)
        ? ui.expandedSlotIds.filter((slotId): slotId is string => typeof slotId === 'string')
        : [],
    },
  } as unknown as WorkoutSessionRuntime;
}

function normalizeActiveSession(input: unknown): WorkoutSessionRuntime | null {
  if (!isObject(input)) {
    return null;
  }

  if (typeof input.sessionId !== 'string' || typeof input.templateId !== 'string' || typeof input.templateName !== 'string') {
    return null;
  }

  const repaired = repairSessionShape(input);
  if (!repaired) {
    return null;
  }

  const session = scrubImpossibleSessionLoads(repaired);
  const template = getWorkoutTemplateById(session.templateId);
  if (!template) {
    return session;
  }

  const templateExerciseMap = new Map(
    template.sessions.flatMap((templateSession) =>
      templateSession.exercises.map((exercise) => [
        exercise.id,
        {
          scopedSlotId: buildScopedSlotId(template.id, templateSession.id, exercise.slotId),
          templateSlotId: exercise.slotId,
        },
      ] as const),
    ),
  );

  const slotFallbackMap = new Map<string, string>();
  const exercises = session.exercises.map((exercise) => {
    const templateExercise = templateExerciseMap.get(exercise.templateExerciseId);
    const nextSlotId = templateExercise?.scopedSlotId ?? exercise.slotId;
    const templateSlotId = templateExercise?.templateSlotId ?? exercise.templateSlotId ?? exercise.slotId;

    if (!slotFallbackMap.has(exercise.slotId)) {
      slotFallbackMap.set(exercise.slotId, nextSlotId);
    }

    return {
      ...exercise,
      slotId: nextSlotId,
      templateSlotId,
    };
  });

  const remapSlotId = (value: string | null | undefined) => {
    if (!value) {
      return value ?? null;
    }

    return slotFallbackMap.get(value) ?? value;
  };

  return {
    ...session,
    templateSessionId: session.templateSessionId ?? null,
    exercises,
    restTimer: {
      ...session.restTimer,
      exerciseSlotId: remapSlotId(session.restTimer.exerciseSlotId),
    },
    ui: {
      ...session.ui,
      activeSlotId: remapSlotId(session.ui.activeSlotId),
      noteEditorSlotId: remapSlotId(session.ui.noteEditorSlotId),
      swapSheetSlotId: remapSlotId(session.ui.swapSheetSlotId),
      expandedSlotIds: session.ui.expandedSlotIds.map((slotId) => remapSlotId(slotId) ?? slotId),
      // The resume anchor names a slot too, and has to follow the same rename
      // as every other slot reference here or it points at nothing.
      guidedResumeAnchor:
        session.ui.guidedResumeAnchor?.slotId !== undefined
          ? {
              ...session.ui.guidedResumeAnchor,
              slotId: remapSlotId(session.ui.guidedResumeAnchor.slotId) ?? session.ui.guidedResumeAnchor.slotId,
            }
          : session.ui.guidedResumeAnchor,
    },
  };
}

export function normalizeWorkoutBundle(input: unknown): WorkoutPersistenceBundle {
  if (!isObject(input)) {
    return {
      activeSession: null,
      history: createEmptyWorkoutHistory(),
      activeCardio: null,
      freestyleDraft: null,
    };
  }

  return {
    activeSession: normalizeActiveSession(input.activeSession),
    history: normalizeHistory(input.history),
    activeCardio: normalizeActiveCardioSession(input.activeCardio),
    freestyleDraft: normalizeFreestyleDraftSnapshot(input.freestyleDraft),
  };
}

async function readStoredBundle(): Promise<string | null> {
  try {
    return (await getLargeItem(STORAGE_KEY)) ?? (await AsyncStorage.getItem(LEGACY_STORAGE_KEY));
  } catch (error) {
    // A split bundle with a part missing is as unreadable as one that will
    // not parse, and falls to the same empty bundle below. Thrown, it left
    // the provider restoring forever.
    if (error instanceof MissingPartsError) {
      return error.readable;
    }
    throw error;
  }
}

export async function loadWorkoutBundle() {
  const raw = await readStoredBundle();
  if (!raw) {
    return { activeSession: null, history: createEmptyWorkoutHistory(), activeCardio: null } satisfies WorkoutPersistenceBundle;
  }

  try {
    return normalizeWorkoutBundle(JSON.parse(raw));
  } catch {
    // Set aside before the empty bundle takes its place: the provider saves
    // what it loaded straight away, and this held every lift's "last time".
    // Same rule as the database's quarantine.
    try {
      await setLargeItem(CORRUPT_STORAGE_KEY, raw);
    } catch {
      // Out of space, most likely. Opening the app still matters more.
    }
    return { activeSession: null, history: createEmptyWorkoutHistory(), activeCardio: null } satisfies WorkoutPersistenceBundle;
  }
}

export async function saveWorkoutBundle(bundle: WorkoutPersistenceBundle) {
  // Slot history keeps ten entries per slot but gains slots with every
  // programme, so this value has no ceiling either (see lib/storageChunks).
  await setLargeItem(STORAGE_KEY, JSON.stringify(bundle));
}

export async function clearWorkoutBundle() {
  await removeLargeItem(STORAGE_KEY);
  await removeLargeItem(CORRUPT_STORAGE_KEY);
  await AsyncStorage.removeItem(LEGACY_STORAGE_KEY);
}
