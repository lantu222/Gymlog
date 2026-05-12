import { formatWeight } from './format';
import { ExerciseLog, PostSessionInsightType, UnitPreference, WorkoutSession } from '../types/models';

export type InsightType = PostSessionInsightType;

export interface PostSessionInsight {
  type: InsightType;
  message: string;
  confidence: number;
  exerciseKey?: string;
}

export interface PostSessionInsightInput {
  completedSession: Pick<WorkoutSession, 'id' | 'performedAt' | 'totalVolumeKg' | 'setsCompleted'>;
  sessionExerciseLogs: ExerciseLog[];
  allPriorSessions: Pick<WorkoutSession, 'id' | 'performedAt' | 'totalVolumeKg' | 'setsCompleted'>[];
  allPriorExerciseLogs: ExerciseLog[];
  lastInsightSessionId: string | null;
  lastInsightType: InsightType | null;
  unitPreference: UnitPreference;
}

interface TopSet {
  exerciseKey: string;
  exerciseName: string;
  sessionId: string;
  weight: number;
  reps: number;
}

interface Candidate extends PostSessionInsight {
  priority: number;
}

const CONFIDENCE_THRESHOLD = 0.75;
const DAY_MS = 24 * 60 * 60 * 1000;

function getExerciseKey(log: ExerciseLog) {
  return log.exerciseTemplateId || log.templateExerciseId || null;
}

function getCompletedWorkingSets(log: ExerciseLog) {
  if (log.skipped || log.status === 'skipped' || log.status === 'swapped') {
    return [];
  }

  const sets = Array.isArray(log.sets) ? log.sets : [];
  if (sets.length > 0) {
    return sets.filter(
      (set) =>
        set.kind === 'working' &&
        set.outcome !== 'failed' &&
        set.outcome !== 'skipped' &&
        set.status !== 'skipped' &&
        set.weight > 0 &&
        set.reps > 0,
    );
  }

  return (log.repsPerSet ?? [])
    .filter((reps) => reps > 0 && log.weight > 0)
    .map((reps, orderIndex) => ({
      orderIndex,
      weight: log.weight,
      reps,
      kind: 'working' as const,
      outcome: 'completed' as const,
    }));
}

function getTrackedTopSets(logs: ExerciseLog[]): TopSet[] {
  return logs
    .filter((log) => log.tracked)
    .map((log) => {
      const exerciseKey = getExerciseKey(log);
      if (!exerciseKey) {
        return null;
      }

      const sets = getCompletedWorkingSets(log);
      if (sets.length === 0) {
        return null;
      }

      const best = sets.reduce((currentBest, set) => {
        const setScore = set.weight * set.reps;
        const bestScore = currentBest.weight * currentBest.reps;
        if (setScore > bestScore) return set;
        if (setScore === bestScore && set.weight > currentBest.weight) return set;
        return currentBest;
      }, sets[0]);

      return {
        exerciseKey,
        exerciseName: log.exerciseNameSnapshot,
        sessionId: log.sessionId,
        weight: best.weight,
        reps: best.reps,
      };
    })
    .filter((set): set is TopSet => Boolean(set));
}

function getSessionCompletionRate(logs: ExerciseLog[]) {
  let total = 0;
  let completed = 0;

  for (const log of logs) {
    if (!log.tracked) {
      continue;
    }

    const sets =
      Array.isArray(log.sets) && log.sets.length > 0
        ? log.sets.filter((set) => set.kind === 'working')
        : (log.repsPerSet ?? []).map((reps, orderIndex) => ({
            orderIndex,
            weight: log.weight,
            reps,
            kind: 'working' as const,
            outcome: 'completed' as const,
          }));

    total += sets.length;
    completed += sets.filter((set) => {
      const status = 'status' in set ? set.status : undefined;
      return (
        set.outcome !== 'failed' &&
        set.outcome !== 'skipped' &&
        status !== 'skipped' &&
        set.weight > 0 &&
        set.reps > 0
      );
    }).length;
  }

  return total > 0 ? completed / total : 0;
}

function getPriorSessionsBefore(input: PostSessionInsightInput) {
  const completedAt = new Date(input.completedSession.performedAt).getTime();
  return input.allPriorSessions
    .filter((session) => new Date(session.performedAt).getTime() < completedAt)
    .sort((left, right) => new Date(right.performedAt).getTime() - new Date(left.performedAt).getTime());
}

function buildLogsBySession(logs: ExerciseLog[]) {
  const map = new Map<string, ExerciseLog[]>();
  for (const log of logs) {
    map.set(log.sessionId, [...(map.get(log.sessionId) ?? []), log]);
  }
  return map;
}

function evaluatePersonalRecord(input: PostSessionInsightInput): Candidate | null {
  const currentTopSets = getTrackedTopSets(input.sessionExerciseLogs);
  const priorTopSets = getTrackedTopSets(input.allPriorExerciseLogs);

  for (const current of currentTopSets) {
    const prior = priorTopSets.filter((set) => set.exerciseKey === current.exerciseKey);
    if (prior.length < 2) {
      continue;
    }

    const currentScore = current.weight * current.reps;
    const bestPriorScore = Math.max(...prior.map((set) => set.weight * set.reps));
    const bestPriorSameWeightReps = Math.max(0, ...prior.filter((set) => set.weight === current.weight).map((set) => set.reps));

    if (bestPriorSameWeightReps > 0 && current.reps > bestPriorSameWeightReps) {
      return {
        type: 'personal_record',
        message: `New best on ${current.exerciseName}: ${formatWeight(current.weight, input.unitPreference)} for ${current.reps} reps.`,
        confidence: 0.85,
        exerciseKey: current.exerciseKey,
        priority: 1,
      };
    }

    if (currentScore > bestPriorScore) {
      return {
        type: 'personal_record',
        message: `${current.exerciseName} hit a new high today: ${formatWeight(current.weight, input.unitPreference)} for ${current.reps} reps.`,
        confidence: 1,
        exerciseKey: current.exerciseKey,
        priority: 1,
      };
    }
  }

  return null;
}

function evaluatePlateauDetected(input: PostSessionInsightInput, priorSessions: ReturnType<typeof getPriorSessionsBefore>): Candidate | null {
  const currentTopSets = getTrackedTopSets(input.sessionExerciseLogs);
  const logsBySession = buildLogsBySession(input.allPriorExerciseLogs);

  for (const current of currentTopSets) {
    const run: TopSet[] = [current];

    for (const session of priorSessions) {
      const topSet = getTrackedTopSets(logsBySession.get(session.id) ?? []).find((set) => set.exerciseKey === current.exerciseKey);
      if (!topSet || topSet.weight !== current.weight) {
        break;
      }

      run.push(topSet);
    }

    if (run.length >= 3) {
      return {
        type: 'plateau_detected',
        message: `${current.exerciseName} has been at ${formatWeight(current.weight, input.unitPreference)} for three sessions.`,
        confidence: run.length === 3 ? 0.9 : 0.8,
        exerciseKey: current.exerciseKey,
        priority: 2,
      };
    }
  }

  return null;
}

function evaluateSessionVolumePeak(input: PostSessionInsightInput, priorSessions: ReturnType<typeof getPriorSessionsBefore>): Candidate | null {
  const completedAt = new Date(input.completedSession.performedAt).getTime();
  const windowStart = completedAt - 42 * DAY_MS;
  const priorInWindow = priorSessions.filter((session) => {
    const performedAt = new Date(session.performedAt).getTime();
    return performedAt >= windowStart && performedAt < completedAt;
  });

  if (priorInWindow.length < 4 || typeof input.completedSession.totalVolumeKg !== 'number') {
    return null;
  }

  const highestPrior = Math.max(...priorInWindow.map((session) => session.totalVolumeKg ?? 0));
  if (input.completedSession.totalVolumeKg <= highestPrior) {
    return null;
  }

  return {
    type: 'session_volume_peak',
    message: `Highest session volume in six weeks: ${formatWeight(input.completedSession.totalVolumeKg, input.unitPreference)}.`,
    confidence: 0.85,
    priority: 3,
  };
}

function evaluateReturnAfterGap(input: PostSessionInsightInput, priorSessions: ReturnType<typeof getPriorSessionsBefore>): Candidate | null {
  const latestPrior = priorSessions[0];
  if (!latestPrior) {
    return null;
  }

  const gapDays = Math.floor(
    (new Date(input.completedSession.performedAt).getTime() - new Date(latestPrior.performedAt).getTime()) / DAY_MS,
  );

  if (gapDays < 7) {
    return null;
  }

  return {
    type: 'return_after_gap',
    message: `First session back in ${gapDays} days. Good start.`,
    confidence: 0.95,
    priority: 4,
  };
}

export function computePostSessionInsight(input: PostSessionInsightInput, now: Date): PostSessionInsight | null {
  void now;

  const priorSessions = getPriorSessionsBefore(input);
  if (priorSessions.length < 3) {
    return null;
  }

  if (input.lastInsightSessionId && priorSessions[0]?.id === input.lastInsightSessionId) {
    return null;
  }

  if (getSessionCompletionRate(input.sessionExerciseLogs) < 0.7) {
    return null;
  }

  if (getTrackedTopSets(input.sessionExerciseLogs).length === 0) {
    return null;
  }

  const candidates = [
    evaluatePersonalRecord(input),
    evaluatePlateauDetected(input, priorSessions),
    evaluateSessionVolumePeak(input, priorSessions),
    evaluateReturnAfterGap(input, priorSessions),
  ]
    .filter((candidate): candidate is Candidate => Boolean(candidate))
    .filter((candidate) => candidate.confidence >= CONFIDENCE_THRESHOLD)
    .sort((left, right) => left.priority - right.priority);

  const selected = candidates[0];
  if (!selected || selected.type === input.lastInsightType) {
    return null;
  }

  const { priority, ...insight } = selected;
  return insight;
}
