import { getComparableLogSets } from './exerciseLog';
import { ExerciseLogWithSession, ExerciseProgressSummary } from './progression';

export interface PlateauResult {
  exerciseKey: string;
  name: string;
  sessionCount: number;
  stagnantSessions: number;
  isPlateau: boolean;
  topWeightHistory: number[];
}

/** The heaviest working set and its own reps (the most, at that weight). */
function getTopWorkingSet(log: ExerciseLogWithSession): { weight: number; reps: number } | null {
  let top: { weight: number; reps: number } | null = null;
  for (const set of getComparableLogSets(log)) {
    if (!(set.weight > 0)) continue;
    if (!top || set.weight > top.weight || (set.weight === top.weight && set.reps > top.reps)) {
      top = { weight: set.weight, reps: set.reps };
    }
  }
  return top;
}

/**
 * How many of the newest sessions are stuck: at the newest session's top
 * weight, with the reps at that weight not rising.
 *
 * It counted every session that was not heavier than the one before, so a
 * light day after two at 100 kg read "3 sessions at 60 kg without
 * improvement", and 100 × 5 → 100 × 6 → 100 × 8 — progress by the reps —
 * read as a plateau. The same rule the training history's stall count uses:
 * the sessions sharing the latest weight.
 */
function countStagnantSessions(sets: Array<{ weight: number; reps: number }>): number {
  // Newest first.
  let stuck = 1;
  for (let i = 1; i < sets.length; i++) {
    const newer = sets[i - 1];
    const older = sets[i];
    if (older.weight !== sets[0].weight || newer.reps > older.reps) {
      break;
    }
    stuck++;
  }
  return stuck;
}

export function detectPlateau(summary: ExerciseProgressSummary, threshold = 3): PlateauResult {
  const sortedLogs = [...summary.logs].sort(
    (a, b) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime(),
  );

  const topSets = sortedLogs
    .map((log) => getTopWorkingSet(log))
    .filter((set): set is { weight: number; reps: number } => set !== null);
  const topWeightHistory = topSets.map((set) => set.weight);

  const stagnantSessions = topSets.length > 0 ? countStagnantSessions(topSets) : 0;

  return {
    exerciseKey: summary.key,
    name: summary.name,
    sessionCount: topWeightHistory.length,
    stagnantSessions,
    isPlateau: topWeightHistory.length >= threshold && stagnantSessions >= threshold,
    topWeightHistory,
  };
}

export function detectPlateaus(summaries: ExerciseProgressSummary[], threshold = 3): PlateauResult[] {
  return summaries.map((s) => detectPlateau(s, threshold));
}
