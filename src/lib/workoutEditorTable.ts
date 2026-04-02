import { getExerciseTemplateDefaults } from './exerciseSuggestions';
import { formatReps, formatWeight, parseNumberInput } from './format';
import {
  ExerciseLibraryItem,
  ExerciseLog,
  ExerciseTemplate,
  UnitPreference,
  WorkoutSession,
} from '../types/models';

export interface EditorExerciseHistorySummary {
  lastWeight: string;
  lastReps: string;
  performedAt: string | null;
}

export interface EditorExerciseHistoryLookup {
  byLibraryItemId: Record<string, EditorExerciseHistorySummary>;
  byName: Record<string, EditorExerciseHistorySummary>;
}

export interface EditorTableExerciseDraft {
  localKey: string;
  name: string;
  targetSets: string;
  repRangeText: string;
  restSeconds: string;
  trackedDefault: boolean;
  libraryItemId?: string | null;
}

export interface EditorTableRow {
  key: string;
  source: 'custom' | 'library-backed';
  exerciseName: string;
  setsText: string;
  repRangeText: string;
  restSecondsText: string;
  trackedDefault: boolean;
  history: EditorExerciseHistorySummary;
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function createEmptyHistory(): EditorExerciseHistorySummary {
  return {
    lastWeight: '-',
    lastReps: '-',
    performedAt: null,
  };
}

function toHistorySummary(log: ExerciseLog, performedAt: string, unitPreference: UnitPreference): EditorExerciseHistorySummary {
  return {
    lastWeight: formatWeight(log.weight, unitPreference),
    lastReps: formatReps(log.repsPerSet),
    performedAt,
  };
}

export function buildExerciseHistoryLookup({
  exerciseLogs,
  workoutSessions,
  exerciseTemplates,
  unitPreference,
}: {
  exerciseLogs: ExerciseLog[];
  workoutSessions: WorkoutSession[];
  exerciseTemplates: ExerciseTemplate[];
  unitPreference: UnitPreference;
}): EditorExerciseHistoryLookup {
  const sessionsById = new Map(workoutSessions.map((session) => [session.id, session] as const));
  const templatesById = new Map(exerciseTemplates.map((exercise) => [exercise.id, exercise] as const));

  const latestByLibraryItemId = new Map<string, EditorExerciseHistorySummary>();
  const latestByName = new Map<string, EditorExerciseHistorySummary>();

  const rankedLogs = exerciseLogs
    .map((log) => ({
      log,
      session: sessionsById.get(log.sessionId) ?? null,
      template: log.exerciseTemplateId ? templatesById.get(log.exerciseTemplateId) ?? null : null,
    }))
    .filter((entry) => Boolean(entry.session))
    .sort(
      (left, right) =>
        new Date(right.session!.performedAt).getTime() - new Date(left.session!.performedAt).getTime() ||
        left.log.orderIndex - right.log.orderIndex,
    );

  rankedLogs.forEach(({ log, session, template }) => {
    if (!session || log.skipped) {
      return;
    }

    const summary = toHistorySummary(log, session.performedAt, unitPreference);
    const normalizedName = normalize(log.exerciseNameSnapshot);

    if (!latestByName.has(normalizedName)) {
      latestByName.set(normalizedName, summary);
    }

    if (template?.libraryItemId && !latestByLibraryItemId.has(template.libraryItemId)) {
      latestByLibraryItemId.set(template.libraryItemId, summary);
    }
  });

  return {
    byLibraryItemId: Object.fromEntries(latestByLibraryItemId),
    byName: Object.fromEntries(latestByName),
  };
}

export function resolveExerciseHistory(
  exercise: Pick<EditorTableExerciseDraft, 'name' | 'libraryItemId'>,
  lookup: EditorExerciseHistoryLookup,
): EditorExerciseHistorySummary {
  if (exercise.libraryItemId && lookup.byLibraryItemId[exercise.libraryItemId]) {
    return lookup.byLibraryItemId[exercise.libraryItemId];
  }

  const normalizedName = normalize(exercise.name);
  if (normalizedName && lookup.byName[normalizedName]) {
    return lookup.byName[normalizedName];
  }

  return createEmptyHistory();
}

export function formatDraftRepRange(repMin: string, repMax: string) {
  const left = repMin.trim();
  const right = repMax.trim();

  if (!left && !right) {
    return '';
  }

  if (!right || left === right) {
    return left || right;
  }

  if (!left) {
    return right;
  }

  return `${left}-${right}`;
}

export function parseDraftRepRangeInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return { repMin: '', repMax: '' };
  }

  const [rawMin, rawMax] = trimmed.split('-').map((part) => part.trim());
  const minValue = rawMin ?? '';
  const maxValue = rawMax ?? '';

  if (!maxValue) {
    return { repMin: minValue, repMax: minValue };
  }

  const minNumber = parseNumberInput(minValue);
  const maxNumber = parseNumberInput(maxValue);

  if (minNumber !== null && maxNumber !== null && minNumber > maxNumber) {
    return { repMin: `${maxNumber}`, repMax: `${minNumber}` };
  }

  return {
    repMin: minValue,
    repMax: maxValue,
  };
}

export function buildEditorTableRows(
  exercises: EditorTableExerciseDraft[],
  lookup: EditorExerciseHistoryLookup,
): EditorTableRow[] {
  return exercises.map((exercise) => ({
    key: exercise.localKey,
    source: exercise.libraryItemId ? 'library-backed' : 'custom',
    exerciseName: exercise.name,
    setsText: exercise.targetSets,
    repRangeText: exercise.repRangeText,
    restSecondsText: exercise.restSeconds,
    trackedDefault: exercise.trackedDefault,
    history: resolveExerciseHistory(exercise, lookup),
  }));
}

export function buildEditorExercisePatchFromLibraryItem(
  item: ExerciseLibraryItem,
  defaultRestSeconds: number,
) {
  const defaults = getExerciseTemplateDefaults(item, defaultRestSeconds);

  return {
    name: item.name,
    targetSets: `${defaults.targetSets}`,
    repRangeText: formatDraftRepRange(`${defaults.repMin}`, `${defaults.repMax}`),
    restSeconds: `${defaults.restSeconds}`,
    trackedDefault: defaults.trackedDefault,
    libraryItemId: item.id,
  };
}
