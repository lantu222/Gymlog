/**
 * "Bench 100 kg" — a number to aim at, and how far along you are.
 *
 * The browse design had a goals row with progress bars, and the app could not
 * draw them: it stores a goal CATEGORY from onboarding ('strength', 'muscle')
 * and no target anywhere. A bar with nothing behind it sits at 0% on day one
 * and stays there, which is a worse row than no row.
 *
 * So the target is stored, and the progress is measured against the user's own
 * best set for that lift — never against an estimate, a formula or a
 * projection. If they have not lifted it, the goal shows as not started rather
 * than as zero progress: those are different states and a bar cannot tell them
 * apart on its own.
 */

export interface StrengthGoal {
  /** Matches ExerciseProgressSummary.name — the stored English name. */
  exerciseName: string;
  targetKg: number;
  createdAt: string;
}

export interface StrengthGoalProgress {
  goal: StrengthGoal;
  /** Best working weight logged for this lift, or null if never lifted. */
  currentKg: number | null;
  /** 0..1, or null when there is nothing to measure. */
  ratio: number | null;
  reached: boolean;
}

/** Guards the one number a user types. */
export function isValidTarget(targetKg: number): boolean {
  return Number.isFinite(targetKg) && targetKg > 0 && targetKg <= 1000;
}

export function normalizeStrengthGoals(value: unknown): StrengthGoal[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set<string>();
  const goals: StrengthGoal[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }
    const candidate = entry as Partial<StrengthGoal>;
    const name = typeof candidate.exerciseName === 'string' ? candidate.exerciseName.trim() : '';
    const target = typeof candidate.targetKg === 'number' ? candidate.targetKg : NaN;
    if (!name || !isValidTarget(target) || seen.has(name)) {
      continue;
    }
    seen.add(name);
    goals.push({
      exerciseName: name,
      targetKg: target,
      createdAt: typeof candidate.createdAt === 'string' ? candidate.createdAt : new Date(0).toISOString(),
    });
  }
  return goals;
}

/**
 * Progress per goal, from the user's own logged bests.
 *
 * `currentKg` null means the lift has never been logged — the row says "not
 * started" rather than drawing an empty bar, because an empty bar reads as
 * "you have made no progress" when the truth is "you have not begun".
 */
export function resolveGoalProgress(
  goals: readonly StrengthGoal[],
  bests: ReadonlyMap<string, number | null>,
): StrengthGoalProgress[] {
  return goals.map((goal) => {
    const currentKg = bests.get(goal.exerciseName) ?? null;
    if (currentKg === null || !(currentKg > 0)) {
      return { goal, currentKg: null, ratio: null, reached: false };
    }
    const ratio = Math.max(0, Math.min(1, currentKg / goal.targetKg));
    return { goal, currentKg, ratio, reached: currentKg >= goal.targetKg };
  });
}

export function upsertStrengthGoal(
  goals: readonly StrengthGoal[],
  next: StrengthGoal,
): StrengthGoal[] {
  const withoutDuplicate = goals.filter((goal) => goal.exerciseName !== next.exerciseName);
  return [...withoutDuplicate, next];
}

export function removeStrengthGoal(
  goals: readonly StrengthGoal[],
  exerciseName: string,
): StrengthGoal[] {
  return goals.filter((goal) => goal.exerciseName !== exerciseName);
}
