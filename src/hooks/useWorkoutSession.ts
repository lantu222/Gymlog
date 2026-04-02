import { useEffect, useMemo, useRef, useState } from 'react';

import { normalizeExerciseLogDraft } from '../lib/exerciseLog';
import { getBestComparableWorkingSet } from '../lib/workoutIntelligence';
import { convertWeightToKg, formatWeightInputValue, parseNumberInput } from '../lib/format';
import {
  ExerciseLog,
  ExerciseLogDraft,
  ExerciseLogSet,
  ExerciseTemplate,
  UnitPreference,
} from '../types/models';

export type PreviousExerciseResult = Pick<ExerciseLog, 'weight' | 'repsPerSet' | 'sets' | 'skipped'>;

export interface WorkoutRowState {
  weight: string;
  reps: string;
  kind: ExerciseLogSet['kind'];
  outcome: ExerciseLogSet['outcome'];
  completed: boolean;
}

export interface WorkoutExerciseState {
  tracked: boolean;
  rows: WorkoutRowState[];
}

interface UseWorkoutSessionOptions {
  sessionKey: string;
  exercises: ExerciseTemplate[];
  unitPreference: UnitPreference;
  defaultRestSeconds: number;
  getPreviousResult: (exercise: ExerciseTemplate) => PreviousExerciseResult | null | undefined;
}

interface RowTarget {
  exerciseIndex: number;
  rowIndex: number;
}

export interface NextExercisePreview {
  exercise: ExerciseTemplate;
  exerciseIndex: number;
  remainingSets: number;
  previousResult: PreviousExerciseResult | null;
}

function initializeEntries(
  exercises: ExerciseTemplate[],
  unitPreference: UnitPreference,
  previousResults: Record<string, PreviousExerciseResult | null>,
) {
  return Object.fromEntries(
    exercises.map((exercise) => {
      const previous = previousResults[exercise.id];
      const previousBestSet = getBestComparableWorkingSet(previous);

      return [
        exercise.id,
        {
          tracked: exercise.trackedDefault,
          rows: Array.from({ length: exercise.targetSets }, (_, rowIndex) => {
            const previousSet = rowIndex === 0 ? previousBestSet : null;

            return {
              weight: formatWeightInputValue(previousSet?.weight ?? null, unitPreference),
              reps: typeof previousSet?.reps === 'number' ? `${previousSet.reps}` : '',
              kind: 'working',
              outcome: 'completed',
              completed: false,
            } satisfies WorkoutRowState;
          }),
        } satisfies WorkoutExerciseState,
      ] as const;
    }),
  );
}

function findFirstIncomplete(
  entries: Record<string, WorkoutExerciseState>,
  exercises: ExerciseTemplate[],
  startExerciseIndex = 0,
  startRowIndex = 0,
): RowTarget | null {
  for (let exerciseIndex = startExerciseIndex; exerciseIndex < exercises.length; exerciseIndex += 1) {
    const exercise = exercises[exerciseIndex];
    const rows = entries[exercise.id]?.rows ?? [];
    const rowStart = exerciseIndex === startExerciseIndex ? startRowIndex : 0;

    for (let rowIndex = rowStart; rowIndex < rows.length; rowIndex += 1) {
      if (!rows[rowIndex]?.completed) {
        return { exerciseIndex, rowIndex };
      }
    }
  }

  return null;
}

function findNextIncomplete(
  entries: Record<string, WorkoutExerciseState>,
  exercises: ExerciseTemplate[],
  exerciseIndex: number,
  rowIndex: number,
) {
  return (
    findFirstIncomplete(entries, exercises, exerciseIndex, rowIndex + 1) ??
    findFirstIncomplete(entries, exercises, 0, 0)
  );
}

export function useWorkoutSession({
  sessionKey,
  exercises,
  unitPreference,
  defaultRestSeconds,
  getPreviousResult,
}: UseWorkoutSessionOptions) {
  const previousResults = useMemo<Record<string, PreviousExerciseResult | null>>(
    () =>
      Object.fromEntries(
        exercises.map((exercise) => [exercise.id, getPreviousResult(exercise) ?? null] as const),
      ),
    [exercises, getPreviousResult],
  );

  const [entries, setEntries] = useState<Record<string, WorkoutExerciseState>>({});
  const [activeExerciseIndex, setActiveExerciseIndex] = useState(0);
  const [activeRowIndex, setActiveRowIndex] = useState(0);
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [nowTs, setNowTs] = useState(Date.now());
  const startedAtRef = useRef(new Date().toISOString());

  useEffect(() => {
    startedAtRef.current = new Date().toISOString();
    const nextEntries = initializeEntries(exercises, unitPreference, previousResults);
    const firstRow = findFirstIncomplete(nextEntries, exercises, 0, 0);

    setEntries(nextEntries);
    setActiveExerciseIndex(firstRow?.exerciseIndex ?? 0);
    setActiveRowIndex(firstRow?.rowIndex ?? 0);
    setRestEndsAt(null);
    setNowTs(Date.now());
  }, [sessionKey]);

  useEffect(() => {
    setEntries((current) => {
      const initializedEntries = initializeEntries(exercises, unitPreference, previousResults);

      if (Object.keys(current).length === 0) {
        return initializedEntries;
      }

      const nextEntries = Object.fromEntries(
        exercises.map((exercise) => [
          exercise.id,
          current[exercise.id] ?? initializedEntries[exercise.id],
        ] as const),
      );

      return nextEntries;
    });
  }, [exercises, previousResults, unitPreference]);

  useEffect(() => {
    const interval = setInterval(() => {
      setNowTs(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const elapsedSeconds = useMemo(
    () => Math.max(0, Math.floor((nowTs - new Date(startedAtRef.current).getTime()) / 1000)),
    [nowTs],
  );

  const restSecondsRemaining = useMemo(() => {
    if (!restEndsAt) {
      return null;
    }

    return Math.max(0, Math.ceil((restEndsAt - nowTs) / 1000));
  }, [nowTs, restEndsAt]);

  useEffect(() => {
    if (restSecondsRemaining === 0) {
      setRestEndsAt(null);
    }
  }, [restSecondsRemaining]);

  const completedSetCount = useMemo(
    () =>
      Object.values(entries).reduce(
        (sum, entry) => sum + entry.rows.filter((row) => row.completed).length,
        0,
      ),
    [entries],
  );

  const totalVolume = useMemo(
    () =>
      exercises.reduce((sum, exercise) => {
        const entry = entries[exercise.id];
        if (!entry) {
          return sum;
        }

        const exerciseVolume = entry.rows.reduce((rowSum, row) => {
          if (!row.completed) {
            return rowSum;
          }

          const weight = convertWeightToKg(parseNumberInput(row.weight) ?? 0, unitPreference);
          const reps = parseNumberInput(row.reps) ?? 0;
          return rowSum + weight * reps;
        }, 0);

        return sum + exerciseVolume;
      }, 0),
    [entries, exercises, unitPreference],
  );

  const canSave = completedSetCount > 0;

  const nextExercise = useMemo<NextExercisePreview | null>(() => {
    const orderedIndexes = [
      ...Array.from({ length: Math.max(0, exercises.length - activeExerciseIndex - 1) }, (_, offset) =>
        activeExerciseIndex + 1 + offset,
      ),
      ...Array.from({ length: activeExerciseIndex }, (_, index) => index),
    ];

    for (const index of orderedIndexes) {
      const exercise = exercises[index];
      const entry = entries[exercise.id];
      const remainingSets = entry?.rows.filter((row) => !row.completed).length ?? 0;

      if (remainingSets > 0) {
        return {
          exercise,
          exerciseIndex: index,
          remainingSets,
          previousResult: previousResults[exercise.id] ?? null,
        };
      }
    }

    return null;
  }, [activeExerciseIndex, entries, exercises, previousResults]);

  function activateRow(exerciseIndex: number, rowIndex: number) {
    const exercise = exercises[exerciseIndex];
    if (!exercise) {
      return;
    }

    const row = entries[exercise.id]?.rows[rowIndex];
    if (!row || row.completed) {
      return;
    }

    setActiveExerciseIndex(exerciseIndex);
    setActiveRowIndex(rowIndex);
  }

  function setWeight(exerciseId: string, rowIndex: number, weight: string) {
    setEntries((current) => {
      const entry = current[exerciseId];
      if (!entry) {
        return current;
      }

      return {
        ...current,
        [exerciseId]: {
          ...entry,
          rows: entry.rows.map((row, index) =>
            index === rowIndex ? { ...row, weight } : row,
          ),
        },
      };
    });
  }

  function setReps(exerciseId: string, rowIndex: number, reps: string) {
    setEntries((current) => {
      const entry = current[exerciseId];
      if (!entry) {
        return current;
      }

      return {
        ...current,
        [exerciseId]: {
          ...entry,
          rows: entry.rows.map((row, index) =>
            index === rowIndex ? { ...row, reps } : row,
          ),
        },
      };
    });
  }

  function toggleTracked(exerciseId: string) {
    setEntries((current) => {
      const entry = current[exerciseId];
      if (!entry) {
        return current;
      }

      return {
        ...current,
        [exerciseId]: {
          ...entry,
          tracked: !entry.tracked,
        },
      };
    });
  }

  function startRest(seconds?: number | null) {
    const durationSeconds = seconds && seconds > 0 ? seconds : defaultRestSeconds;
    if (!durationSeconds || durationSeconds <= 0) {
      setRestEndsAt(null);
      return;
    }

    setRestEndsAt(Date.now() + durationSeconds * 1000);
  }

  function dismissRestTimer() {
    setRestEndsAt(null);
  }

  function activateNextRow() {
    const nextTarget = findNextIncomplete(entries, exercises, activeExerciseIndex, activeRowIndex);
    if (!nextTarget) {
      return null;
    }

    setActiveExerciseIndex(nextTarget.exerciseIndex);
    setActiveRowIndex(nextTarget.rowIndex);
    return nextTarget;
  }

  function completeRow(exerciseIndex: number, rowIndex: number) {
    const exercise = exercises[exerciseIndex];
    if (!exercise) {
      return false;
    }

    let completed = false;
    let nextTarget: RowTarget | null = null;

    setEntries((current) => {
      const entry = current[exercise.id];
      const row = entry?.rows[rowIndex];
      const repsValue = parseNumberInput(row?.reps ?? '');

      if (!entry || !row || row.completed || !repsValue || repsValue <= 0) {
        return current;
      }

      const nextRows: WorkoutRowState[] = entry.rows.map((item, index) =>
        index === rowIndex ? { ...item, completed: true, outcome: 'completed' as const } : item,
      );
      const nextEntries: Record<string, WorkoutExerciseState> = {
        ...current,
        [exercise.id]: {
          ...entry,
          rows: nextRows,
        },
      };

      completed = true;
      nextTarget = findNextIncomplete(nextEntries, exercises, exerciseIndex, rowIndex);
      return nextEntries;
    });

    if (!completed) {
      return false;
    }

    const resolvedNextTarget = nextTarget as RowTarget | null;
    if (resolvedNextTarget) {
      setActiveExerciseIndex(resolvedNextTarget.exerciseIndex);
      setActiveRowIndex(resolvedNextTarget.rowIndex);
    }
    startRest(exercise.restSeconds);
    return true;
  }

  function canRepeatLastSet(exerciseIndex: number, rowIndex: number) {
    const exercise = exercises[exerciseIndex];
    if (!exercise) {
      return false;
    }

    const entry = entries[exercise.id];
    if (!entry || rowIndex <= 0) {
      return false;
    }

    const row = entry.rows[rowIndex];
    if (!row || row.completed || parseNumberInput(row.weight) !== null || parseNumberInput(row.reps) !== null) {
      return false;
    }

    for (let index = rowIndex - 1; index >= 0; index -= 1) {
      const sourceRow = entry.rows[index];
      if (
        sourceRow?.completed &&
        parseNumberInput(sourceRow.weight) !== null &&
        parseNumberInput(sourceRow.reps) !== null
      ) {
        return true;
      }
    }

    return false;
  }

  function repeatLastSet(exerciseIndex: number, rowIndex: number) {
    const exercise = exercises[exerciseIndex];
    if (!exercise) {
      return false;
    }

    let repeated = false;
    let nextTarget: RowTarget | null = null;

    setEntries((current) => {
      const entry = current[exercise.id];
      if (!entry || rowIndex <= 0) {
        return current;
      }

      let sourceRow: WorkoutRowState | null = null;
      for (let index = rowIndex - 1; index >= 0; index -= 1) {
        const candidate = entry.rows[index];
        if (
          candidate?.completed &&
          parseNumberInput(candidate.weight) !== null &&
          parseNumberInput(candidate.reps) !== null
        ) {
          sourceRow = candidate;
          break;
        }
      }

      if (!sourceRow) {
        return current;
      }

      const nextRows: WorkoutRowState[] = entry.rows.map((item, index) =>
        index === rowIndex
          ? {
              ...item,
              weight: sourceRow.weight,
              reps: sourceRow.reps,
              kind: sourceRow.kind,
              completed: true,
              outcome: 'completed' as const,
            }
          : item,
      );
      const nextEntries: Record<string, WorkoutExerciseState> = {
        ...current,
        [exercise.id]: {
          ...entry,
          rows: nextRows,
        },
      };

      repeated = true;
      nextTarget = findNextIncomplete(nextEntries, exercises, exerciseIndex, rowIndex);
      return nextEntries;
    });

    if (!repeated) {
      return false;
    }

    const resolvedNextTarget = nextTarget as RowTarget | null;
    if (resolvedNextTarget) {
      setActiveExerciseIndex(resolvedNextTarget.exerciseIndex);
      setActiveRowIndex(resolvedNextTarget.rowIndex);
    }
    startRest(exercise.restSeconds);
    return true;
  }

  function buildLogs(): ExerciseLogDraft[] {
    return exercises.map((exercise, orderIndex) => {
      const entry = entries[exercise.id];
      const sets = (entry?.rows ?? [])
        .map((row, rowIndex) => {
          if (!row.completed) {
            return null;
          }

          const reps = parseNumberInput(row.reps);
          if (!reps || reps <= 0) {
            return null;
          }

          return {
            orderIndex: rowIndex,
            weight: convertWeightToKg(parseNumberInput(row.weight) ?? 0, unitPreference),
            reps,
            kind: row.kind,
            outcome: row.outcome,
          } satisfies ExerciseLogSet;
        })
        .filter((set): set is ExerciseLogSet => Boolean(set));

      return normalizeExerciseLogDraft({
        exerciseTemplateId:
          exercise.persistedExerciseTemplateId === undefined
            ? exercise.id
            : exercise.persistedExerciseTemplateId,
        exerciseNameSnapshot: exercise.name,
        sets,
        tracked: entry?.tracked ?? exercise.trackedDefault,
        orderIndex,
        skipped: false,
      });
    });
  }

  return {
    startedAt: startedAtRef.current,
    previousResults,
    entries,
    activeExerciseIndex,
    activeRowIndex,
    elapsedSeconds,
    completedSetCount,
    totalVolume,
    canSave,
    restSecondsRemaining,
    nextExercise,
    activateRow,
    activateNextRow,
    setWeight,
    setReps,
    toggleTracked,
    completeRow,
    canRepeatLastSet,
    repeatLastSet,
    deriveNextExercise: () => nextExercise,
    dismissRestTimer,
    buildLogs,
  };
}

