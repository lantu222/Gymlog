import { WorkoutTemplateExercise } from '../features/workout/workoutTypes';

/**
 * Equipment chips filter the actual exercises (onboarding truth plan P4).
 *
 * The chips chosen on step 1 (`selection.equipmentItems`) are the complete set
 * of available gear. Exercises whose requirements aren't met swap to the first
 * fallback the gear allows, or drop when nothing honest remains. Name-based,
 * grounded in the catalog + chip labels, so composed and custom programs
 * behave the same.
 */

type RequirementGroup = string[]; // any-of

interface EquipmentRule {
  pattern: string;
  /** Every group must be satisfied by at least one available item. */
  requires: RequirementGroup[];
}

const BARBELL = ['Barbells', 'Barbell & plates'];

const EQUIPMENT_RULES: EquipmentRule[] = [
  { pattern: 'back squat', requires: [BARBELL, ['Squat rack']] },
  { pattern: 'front squat', requires: [BARBELL, ['Squat rack']] },
  { pattern: 'box squat', requires: [BARBELL, ['Squat rack']] },
  { pattern: 'bench press', requires: [BARBELL, ['Bench']] },
  { pattern: 'barbell', requires: [BARBELL] },
  { pattern: 'skull crusher', requires: [[...BARBELL, 'Dumbbells']] },
  { pattern: 'overhead press', requires: [[...BARBELL, 'Dumbbells']] },
  { pattern: 'dumbbell', requires: [['Dumbbells']] },
  { pattern: 'goblet', requires: [['Dumbbells', 'Kettlebells']] },
  { pattern: 'kettlebell', requires: [['Kettlebells']] },
  { pattern: 'cable', requires: [['Cables', 'Machines']] },
  { pattern: 'pulldown', requires: [['Cables', 'Machines']] },
  { pattern: 'pushdown', requires: [['Cables', 'Machines']] },
  { pattern: 'machine', requires: [['Machines']] },
  { pattern: 'leg press', requires: [['Machines']] },
  { pattern: 'hack squat', requires: [['Machines']] },
  { pattern: 'leg curl', requires: [['Machines']] },
  { pattern: 'leg extension', requires: [['Machines']] },
  { pattern: 'seated calf raise', requires: [['Machines']] },
  { pattern: 'preacher curl', requires: [['Bench', 'Machines']] },
  { pattern: 'lateral raise', requires: [['Dumbbells', 'Cables', 'Resistance bands']] },
  { pattern: 'rear delt', requires: [['Dumbbells', 'Cables', 'Resistance bands']] },
  { pattern: 'curl', requires: [[...BARBELL, 'Dumbbells', 'Resistance bands']] },
  { pattern: 'treadmill', requires: [['Cardio machines']] },
  { pattern: 'bike', requires: [['Cardio machines']] },
  { pattern: 'rowing machine', requires: [['Cardio machines']] },
  { pattern: 'elliptical', requires: [['Cardio machines']] },
  { pattern: 'pull-up', requires: [['Pull-up bar']] },
  { pattern: 'chin-up', requires: [['Pull-up bar']] },
  { pattern: 'hanging', requires: [['Pull-up bar']] },
  { pattern: 'band', requires: [['Resistance bands']] },
  { pattern: 'hip thrust', requires: [['Bench', ...BARBELL, 'Dumbbells']] },
];

// Fallbacks tried in order; the first candidate the gear allows wins.
const EQUIPMENT_FALLBACKS: Array<[string, string[]]> = [
  ['bench press', ['Machine Chest Press', 'Dumbbell Floor Press', 'Push-Up Wide']],
  ['back squat', ['Goblet Squat', 'Bodyweight Squat']],
  ['front squat', ['Goblet Squat', 'Bodyweight Squat']],
  ['box squat', ['Goblet Squat', 'Bodyweight Squat']],
  ['hack squat', ['Goblet Squat', 'Bodyweight Squat']],
  ['leg press', ['Goblet Squat', 'Bodyweight Squat']],
  ['romanian deadlift', ['Dumbbell Romanian Deadlift', 'Glute Bridge']],
  ['deadlift', ['Dumbbell Romanian Deadlift', 'Glute Bridge']],
  ['barbell row', ['Chest-Supported Row', 'Inverted Row']],
  ['seated cable row', ['Chest-Supported Row', 'Inverted Row']],
  ['lat pulldown', ['Pull-Up', 'Inverted Row']],
  ['overhead press', ['Dumbbell Shoulder Press', 'Incline Push-Up']],
  ['dumbbell shoulder press', ['Incline Push-Up']],
  ['cable fly', ['Dumbbell Fly', 'Push-Up Wide']],
  ['dumbbell fly', ['Push-Up Wide']],
  ['skull crusher', ['Triceps Pushdown', 'Incline Push-Up']],
  ['overhead triceps extension', ['Triceps Pushdown', 'Incline Push-Up']],
  ['triceps pushdown', ['Incline Push-Up']],
  ['preacher curl', ['Dumbbell Curl', 'Band Curl']],
  ['barbell curl', ['Dumbbell Curl', 'Band Curl']],
  ['dumbbell curl', ['Band Curl']],
  ['hammer curl', ['Band Curl']],
  ['lateral raise', ['Band Lateral Raise']],
  ['rear delt', ['Band Pull-Apart']],
  ['kettlebell swing', ['Glute Bridge']],
  ['leg curl', ['Glute Bridge']],
  ['leg extension', ['Bodyweight Squat']],
  ['seated calf raise', ['Standing Calf Raise']],
  ['treadmill', ['Burpee']],
  ['bike', ['Burpee']],
  ['machine chest press', ['Push-Up Wide']],
  ['hanging knee raise', ['Plank']],
  ['pull-up', ['Inverted Row']],
  ['hip thrust', ['Glute Bridge']],
  ['cable crunch', ['Plank']],
];

const BODYWEIGHT_PATTERNS = ['push-up', 'plank', 'glute bridge', 'bodyweight', 'inverted row', 'burpee', 'mountain climber'];

function normalize(name: string) {
  return name.trim().toLowerCase();
}

/**
 * `null` = unconstrained (unknown setups stay untouched). Chosen chips are the
 * full truth; a bodyweight-only setup with no chips means "no equipment".
 */
export function resolveAvailableEquipment(selection: {
  trainingEnvironment?: string | null;
  equipmentItems?: string[];
}): string[] | null {
  if (selection.equipmentItems && selection.equipmentItems.length > 0) {
    return selection.equipmentItems;
  }
  if (selection.trainingEnvironment === 'bodyweight_only') {
    return [];
  }
  return null;
}

export function isExerciseAllowedWithEquipment(exerciseName: string, available: string[] | null): boolean {
  if (available === null) {
    return true;
  }
  const normalized = normalize(exerciseName);
  return EQUIPMENT_RULES.filter((rule) => normalized.includes(rule.pattern)).every((rule) =>
    rule.requires.every((group) => group.some((item) => available.includes(item))),
  );
}

function findEquipmentFallback(exerciseName: string, available: string[]): string | null {
  const normalized = normalize(exerciseName);
  for (const [pattern, candidates] of EQUIPMENT_FALLBACKS) {
    if (!normalized.includes(pattern)) {
      continue;
    }
    for (const candidate of candidates) {
      if (isExerciseAllowedWithEquipment(candidate, available)) {
        return candidate;
      }
    }
  }
  return null;
}

export interface EquipmentAdjustedExercises {
  exercises: WorkoutTemplateExercise[];
  removed: string[];
  swapped: Array<{ from: string; to: string }>;
}

export function applyEquipmentToExercises(
  exercises: WorkoutTemplateExercise[],
  available: string[] | null,
): EquipmentAdjustedExercises {
  if (available === null) {
    return { exercises, removed: [], swapped: [] };
  }

  const removed: string[] = [];
  const swapped: Array<{ from: string; to: string }> = [];

  const adjusted = exercises
    .map((exercise) => {
      if (isExerciseAllowedWithEquipment(exercise.exerciseName, available)) {
        return exercise;
      }

      const fallback = findEquipmentFallback(exercise.exerciseName, available);
      if (!fallback) {
        removed.push(exercise.exerciseName);
        return null;
      }

      swapped.push({ from: exercise.exerciseName, to: fallback });
      const normalized = normalize(fallback);
      return {
        ...exercise,
        exerciseName: fallback,
        trackingMode: BODYWEIGHT_PATTERNS.some((pattern) => normalized.includes(pattern))
          ? ('bodyweight' as const)
          : exercise.trackingMode,
      };
    })
    .filter((exercise): exercise is WorkoutTemplateExercise => exercise !== null);

  return { exercises: adjusted, removed, swapped };
}
