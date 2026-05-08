import { ExerciseLibraryItem } from '../types/models';

function normalizeMuscle(value: string) {
  return value.trim().toLowerCase();
}

function toMuscleSet(values?: string[]) {
  return new Set((values ?? []).map(normalizeMuscle).filter(Boolean));
}

function countOverlap(left: Set<string>, right: Set<string>) {
  let count = 0;
  left.forEach((value) => {
    if (right.has(value)) {
      count += 1;
    }
  });
  return count;
}

function scoreMuscleMatch(target: ExerciseLibraryItem, candidate: ExerciseLibraryItem) {
  const targetPrimary = toMuscleSet(target.primaryMuscles);
  const targetSecondary = toMuscleSet(target.secondaryMuscles);
  const candidatePrimary = toMuscleSet(candidate.primaryMuscles);
  const candidateSecondary = toMuscleSet(candidate.secondaryMuscles);

  const hasTargetMuscles = targetPrimary.size > 0 || targetSecondary.size > 0;
  const hasCandidateMuscles = candidatePrimary.size > 0 || candidateSecondary.size > 0;

  if (!hasTargetMuscles || !hasCandidateMuscles) {
    return 0;
  }

  return (
    countOverlap(targetPrimary, candidatePrimary) * 100 +
    countOverlap(targetPrimary, candidateSecondary) * 70 +
    countOverlap(targetSecondary, candidatePrimary) * 45 +
    countOverlap(targetSecondary, candidateSecondary) * 25
  );
}

function hasMuscleData(item: ExerciseLibraryItem) {
  return (item.primaryMuscles?.length ?? 0) > 0 || (item.secondaryMuscles?.length ?? 0) > 0;
}

export function rankExerciseAlternatives(
  target: ExerciseLibraryItem,
  items: ExerciseLibraryItem[],
  limit = 6,
) {
  const targetHasMuscleData = hasMuscleData(target);
  const scored = items
    .map((item, index) => {
      if (item.id === target.id) {
        return null;
      }

      const muscleScore = scoreMuscleMatch(target, item);
      const fallbackScore = !targetHasMuscleData && muscleScore === 0 && item.bodyPart === target.bodyPart ? 1 : 0;
      const score = muscleScore + fallbackScore;

      if (score <= 0) {
        return null;
      }

      return { item, score, index };
    })
    .filter((entry): entry is { item: ExerciseLibraryItem; score: number; index: number } => Boolean(entry));

  return scored
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.index - right.index;
    })
    .slice(0, limit)
    .map((entry) => entry.item);
}
