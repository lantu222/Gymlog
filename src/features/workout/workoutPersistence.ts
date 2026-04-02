import AsyncStorage from '@react-native-async-storage/async-storage';

import { getWorkoutTemplateById } from './workoutCatalog';
import { WorkoutHistoryStore, WorkoutPersistenceBundle, WorkoutSessionRuntime, WorkoutSessionSummary } from './workoutTypes';

const STORAGE_KEY = '@gymlog/workout/v1';

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

function normalizeActiveSession(input: unknown): WorkoutSessionRuntime | null {
  if (!isObject(input)) {
    return null;
  }

  if (typeof input.sessionId !== 'string' || typeof input.templateId !== 'string' || typeof input.templateName !== 'string') {
    return null;
  }

  const session = input as unknown as WorkoutSessionRuntime;
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
    },
  };
}

export function normalizeWorkoutBundle(input: unknown): WorkoutPersistenceBundle {
  if (!isObject(input)) {
    return {
      activeSession: null,
      history: createEmptyWorkoutHistory(),
    };
  }

  return {
    activeSession: normalizeActiveSession(input.activeSession),
    history: normalizeHistory(input.history),
  };
}

export async function loadWorkoutBundle() {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return { activeSession: null, history: createEmptyWorkoutHistory() } satisfies WorkoutPersistenceBundle;
  }

  try {
    return normalizeWorkoutBundle(JSON.parse(raw));
  } catch {
    return { activeSession: null, history: createEmptyWorkoutHistory() } satisfies WorkoutPersistenceBundle;
  }
}

export async function saveWorkoutBundle(bundle: WorkoutPersistenceBundle) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(bundle));
}

export async function clearWorkoutBundle() {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
