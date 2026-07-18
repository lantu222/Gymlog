import { WorkoutTemplateExercise } from '../features/workout/workoutTypes';
import { SetupFocusArea } from '../types/models';

/**
 * Focus areas add real training emphasis (onboarding truth plan P3):
 * +1 weekly accessory for small areas, +2 for big muscle groups. Additions run
 * BEFORE the caution filter in the composer, so a flagged area can still veto
 * or swap what the emphasis added — safety wins over emphasis.
 */

const BIG_FOCUS_AREAS: SetupFocusArea[] = ['chest', 'back', 'quads', 'glutes', 'hamstrings', 'legs'];

// Accessory pool per area, grounded in catalog exercise names.
const FOCUS_ACCESSORIES: Record<SetupFocusArea, string[]> = {
  chest: ['Cable Fly', 'Incline Dumbbell Press'],
  back: ['Lat Pulldown', 'Seated Cable Row'],
  shoulders: ['Lateral Raise', 'Rear Delt Fly'],
  arms: ['Hammer Curl', 'Triceps Pushdown'],
  core: ['Plank', 'Hanging Knee Raise'],
  quads: ['Leg Press', 'Bulgarian Split Squat'],
  glutes: ['Hip Thrust', 'Glute Bridge'],
  hamstrings: ['Leg Curl', 'Romanian Deadlift'],
  calves: ['Standing Calf Raise', 'Seated Calf Raise'],
  legs: ['Leg Press', 'Walking Lunge'],
  mobility: ['Mobility Flow', 'Recovery Stretch Flow'],
  conditioning: ['Kettlebell Swing', 'Bike HIIT (45s sprint / 15s rest)'],
  bodyweight: ['Push-Up Wide', 'Plank'],
};

const BODYWEIGHT_PATTERNS = ['plank', 'glute bridge', 'push-up', 'bodyweight', 'mobility', 'stretch', 'flow', 'knee raise'];

export function getFocusEmphasisCount(area: SetupFocusArea): number {
  return BIG_FOCUS_AREAS.includes(area) ? 2 : 1;
}

function buildEmphasisExercise(name: string, sessionId: string, index: number): WorkoutTemplateExercise {
  const normalized = name.toLowerCase();
  return {
    id: `${sessionId}_focus_${index + 1}`,
    exerciseName: name,
    slotId: `focus_accessory_${index + 1}`,
    role: 'accessory',
    progressionPriority: 'low',
    trackingMode: BODYWEIGHT_PATTERNS.some((pattern) => normalized.includes(pattern)) ? 'bodyweight' : 'load_and_reps',
    sets: 2,
    repsMin: 10,
    repsMax: 15,
    restSecondsMin: 45,
    restSecondsMax: 75,
    substitutionGroup: `focus_${name.replace(/\W+/g, '_').toLowerCase()}`,
  };
}

export interface FocusEmphasisSessionInput {
  id: string;
  exercises: WorkoutTemplateExercise[];
}

export interface FocusEmphasisAddition {
  area: SetupFocusArea;
  exerciseName: string;
  sessionId: string;
}

/**
 * Spreads each focus area's accessories across the week (round-robin over
 * sessions, offset per area) and never duplicates a movement a session
 * already holds. Mutates nothing — returns per-session additions.
 */
export function buildFocusEmphasisAdditions(
  sessions: FocusEmphasisSessionInput[],
  focusAreas: SetupFocusArea[],
): { bySessionId: Map<string, WorkoutTemplateExercise[]>; additions: FocusEmphasisAddition[] } {
  const bySessionId = new Map<string, WorkoutTemplateExercise[]>();
  const additions: FocusEmphasisAddition[] = [];
  if (sessions.length === 0) {
    return { bySessionId, additions };
  }

  focusAreas.forEach((area, areaIndex) => {
    const pool = FOCUS_ACCESSORIES[area] ?? [];
    const count = Math.min(getFocusEmphasisCount(area), pool.length);

    for (let step = 0; step < count; step += 1) {
      const name = pool[step % pool.length];
      // Offset per area so two focus areas don't stack on the same day.
      const startIndex = (areaIndex + step) % sessions.length;

      for (let probe = 0; probe < sessions.length; probe += 1) {
        const session = sessions[(startIndex + probe) % sessions.length];
        const existingNames = [
          ...session.exercises.map((exercise) => exercise.exerciseName.toLowerCase()),
          ...(bySessionId.get(session.id) ?? []).map((exercise) => exercise.exerciseName.toLowerCase()),
        ];
        const pendingCount = (bySessionId.get(session.id) ?? []).length;
        // Session time budget: at most two added accessories per session.
        if (existingNames.includes(name.toLowerCase()) || pendingCount >= 2) {
          continue;
        }

        const exercise = buildEmphasisExercise(name, session.id, pendingCount);
        bySessionId.set(session.id, [...(bySessionId.get(session.id) ?? []), exercise]);
        additions.push({ area, exerciseName: name, sessionId: session.id });
        break;
      }
    }
  });

  return { bySessionId, additions };
}
