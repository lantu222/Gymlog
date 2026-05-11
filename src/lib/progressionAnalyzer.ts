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

function getTopWorkingWeight(log: ExerciseLogWithSession): number | null {
  const sets = getComparableLogSets(log);
  if (sets.length === 0) return null;
  const top = sets.reduce((best, set) => Math.max(best, set.weight), 0);
  return top > 0 ? top : null;
}

function countStagnantSessions(weights: number[]): number {
  // weights: newest first
  // count consecutive non-improving pairs from the newest, then add 1 for the starting session
  let nonImprovingPairs = 0;
  for (let i = 0; i < weights.length - 1; i++) {
    if (weights[i] <= weights[i + 1]) {
      nonImprovingPairs++;
    } else {
      break;
    }
  }
  return nonImprovingPairs + 1;
}

export function detectPlateau(summary: ExerciseProgressSummary, threshold = 3): PlateauResult {
  const sortedLogs = [...summary.logs].sort(
    (a, b) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime(),
  );

  const topWeightHistory = sortedLogs
    .map((log) => getTopWorkingWeight(log))
    .filter((w): w is number => w !== null);

  const stagnantSessions = topWeightHistory.length > 0 ? countStagnantSessions(topWeightHistory) : 0;

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
