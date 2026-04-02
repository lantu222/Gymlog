import { ExerciseLog, ExerciseLogDraft, ExerciseLogSet } from '../types/models';

function normalizeNumber(value: number | null | undefined, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizeRepsPerSet(repsPerSet: number[] | null | undefined) {
  return Array.isArray(repsPerSet)
    ? repsPerSet.filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0)
    : [];
}

function normalizeSetKind(value: ExerciseLogSet['kind'] | null | undefined): ExerciseLogSet['kind'] {
  return value === 'warmup' || value === 'drop' ? value : 'working';
}

function normalizeSetOutcome(value: ExerciseLogSet['outcome'] | null | undefined): ExerciseLogSet['outcome'] {
  if (value === 'failed' || value === 'skipped') {
    return value;
  }

  return value === null ? null : 'completed';
}

function normalizeSetStatus(value: ExerciseLogSet['status'] | null | undefined): ExerciseLogSet['status'] {
  if (value === 'pending' || value === 'skipped') {
    return value;
  }

  return 'completed';
}

function normalizeSetEffort(value: ExerciseLogSet['effort'] | null | undefined): ExerciseLogSet['effort'] {
  if (value === 'easy' || value === 'good' || value === 'hard') {
    return value;
  }

  return null;
}

export function sortExerciseSets<T extends Pick<ExerciseLogSet, 'orderIndex'>>(sets: T[]) {
  return [...sets].sort((left, right) => left.orderIndex - right.orderIndex);
}

export function synthesizeSetsFromLegacy(weight: number | null | undefined, repsPerSet: number[] | null | undefined) {
  const normalizedWeight = normalizeNumber(weight, 0);

  return normalizeRepsPerSet(repsPerSet).map<ExerciseLogSet>((reps, orderIndex) => ({
    orderIndex,
    weight: normalizedWeight,
    reps,
    kind: 'working',
    outcome: 'completed',
    status: 'completed',
  }));
}

export function normalizeExerciseSets(
  sets: ExerciseLogSet[] | null | undefined,
  legacyWeight?: number | null,
  legacyRepsPerSet?: number[] | null,
) {
  const normalizedSets = Array.isArray(sets)
    ? sortExerciseSets(
        sets
          .filter((set): set is ExerciseLogSet => Boolean(set))
          .map((set, index) => ({
            orderIndex:
              typeof set.orderIndex === 'number' && Number.isFinite(set.orderIndex) ? set.orderIndex : index,
            weight: normalizeNumber(set.weight, 0),
            reps: normalizeNumber(set.reps, 0),
            kind: normalizeSetKind(set.kind),
            outcome: normalizeSetOutcome(set.outcome),
            status: normalizeSetStatus(set.status),
            effort: normalizeSetEffort(set.effort),
            completedAt: typeof set.completedAt === 'string' ? set.completedAt : null,
            skippedReason: typeof set.skippedReason === 'string' ? set.skippedReason : null,
          }))
          .filter(
            (set) =>
              set.status !== 'completed' ||
              Boolean(set.completedAt) ||
              set.reps > 0 ||
              set.weight > 0,
          ),
      )
    : [];

  if (normalizedSets.length > 0) {
    return normalizedSets;
  }

  return synthesizeSetsFromLegacy(legacyWeight, legacyRepsPerSet);
}

export function getOrderedLogSets(
  log: Pick<ExerciseLog, 'sets' | 'weight' | 'repsPerSet' | 'skipped'> | null | undefined,
) {
  if (!log) {
    return [];
  }

  return normalizeExerciseSets(log.sets, log.weight, log.repsPerSet);
}

export function getComparableLogSets(
  log: Pick<ExerciseLog, 'sets' | 'weight' | 'repsPerSet' | 'skipped'> | null | undefined,
) {
  if (!log || log.skipped) {
    return [];
  }

  const orderedSets = getOrderedLogSets(log);
  const completedSets = orderedSets.filter((set) => set.status !== 'pending' && set.status !== 'skipped');
  const comparableSets = completedSets.length > 0 ? completedSets : orderedSets;
  const workingSets = comparableSets.filter((set) => set.kind === 'working');
  return workingSets.length > 0 ? workingSets : comparableSets;
}

export function getLogSetStatusCounts(
  log: Pick<ExerciseLog, 'sets' | 'weight' | 'repsPerSet' | 'skipped'> | null | undefined,
) {
  return getOrderedLogSets(log).reduce(
    (counts, set) => {
      counts[set.status ?? 'completed'] += 1;
      return counts;
    },
    {
      completed: 0,
      skipped: 0,
      pending: 0,
    },
  );
}

export function deriveLegacyLogFieldsFromSets(sets: ExerciseLogSet[]) {
  const comparableSets = getComparableLogSets({
    sets,
    weight: 0,
    repsPerSet: [],
    skipped: false,
  });

  return {
    weight: comparableSets.reduce((best, set) => Math.max(best, set.weight), 0),
    repsPerSet: comparableSets.map((set) => set.reps),
  };
}

export function normalizeExerciseLog(log: Partial<ExerciseLog> | null | undefined): ExerciseLog | null {
  if (
    !log ||
    typeof log.id !== 'string' ||
    typeof log.sessionId !== 'string' ||
    typeof log.exerciseNameSnapshot !== 'string' ||
    typeof log.orderIndex !== 'number' ||
    !Number.isFinite(log.orderIndex)
  ) {
    return null;
  }

  const skipped = log.skipped === true;
  const normalizedSets = normalizeExerciseSets(log.sets, log.weight, log.repsPerSet);
  const derived = deriveLegacyLogFieldsFromSets(normalizedSets);

  return {
    id: log.id,
    sessionId: log.sessionId,
    exerciseTemplateId:
      typeof log.exerciseTemplateId === 'string' || log.exerciseTemplateId === null
        ? log.exerciseTemplateId
        : null,
    exerciseNameSnapshot: log.exerciseNameSnapshot,
    weight: skipped ? 0 : derived.weight,
    repsPerSet: skipped ? [] : derived.repsPerSet,
    sets: normalizedSets,
    tracked: log.tracked === true,
    orderIndex: log.orderIndex,
    skipped,
    sessionInserted: log.sessionInserted === true,
    status:
      log.status === 'completed' || log.status === 'skipped' || log.status === 'swapped' || log.status === 'active'
        ? log.status
        : skipped
          ? 'skipped'
          : 'completed',
    slotId: typeof log.slotId === 'string' || log.slotId === null ? log.slotId : null,
    templateSlotId:
      typeof log.templateSlotId === 'string' || log.templateSlotId === null ? log.templateSlotId : null,
    templateExerciseId:
      typeof log.templateExerciseId === 'string' || log.templateExerciseId === null ? log.templateExerciseId : null,
    notes: typeof log.notes === 'string' ? log.notes.trim() || null : null,
    swappedFrom: typeof log.swappedFrom === 'string' ? log.swappedFrom.trim() || null : null,
  };
}

export function normalizeExerciseLogDraft(log: ExerciseLogDraft) {
  const skipped = log.skipped === true;
  const normalizedSets = normalizeExerciseSets(log.sets, log.weight, log.repsPerSet);
  const derived = deriveLegacyLogFieldsFromSets(normalizedSets);

  return {
    ...log,
    weight: skipped ? 0 : derived.weight,
    repsPerSet: skipped ? [] : derived.repsPerSet,
    sets: normalizedSets,
    skipped,
    sessionInserted: log.sessionInserted === true,
    status:
      log.status === 'completed' || log.status === 'skipped' || log.status === 'swapped' || log.status === 'active'
        ? log.status
        : skipped
          ? 'skipped'
          : 'completed',
    slotId: typeof log.slotId === 'string' || log.slotId === null ? log.slotId : null,
    templateSlotId:
      typeof log.templateSlotId === 'string' || log.templateSlotId === null ? log.templateSlotId : null,
    templateExerciseId:
      typeof log.templateExerciseId === 'string' || log.templateExerciseId === null ? log.templateExerciseId : null,
    notes: typeof log.notes === 'string' ? log.notes.trim() || null : null,
    swappedFrom: typeof log.swappedFrom === 'string' ? log.swappedFrom.trim() || null : null,
  };
}
