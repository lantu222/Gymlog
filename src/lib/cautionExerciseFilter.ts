import { WorkoutTemplateExercise } from '../features/workout/workoutTypes';
import { SetupCautionArea, SetupCautionFlag, SetupFocusArea } from '../types/models';

/**
 * Caution flags become real training changes (onboarding truth plan P2).
 *
 * - `avoid`   — the area is left out entirely: matching exercises are removed.
 * - `careful` — joint-friendly swaps: matching exercises with a known swap are
 *               replaced; sets/reps/rest keep their prescription.
 * - `info`    — no change.
 * - flagged area picked as a FOCUS on step 6 (careful only) — that area's
 *   exercises swap to bodyweight variants instead (the step-6 promise).
 *
 * Everything is exercise-NAME based (lowercased substring match), grounded in
 * the catalog's names, so composed and custom programs behave the same.
 */

/** Caution areas → the focus areas they touch (mirrors the onboarding UI). */
export const CAUTION_TO_FOCUS_AREAS: Record<SetupCautionArea, SetupFocusArea[]> = {
  neck: ['shoulders'],
  shoulders: ['shoulders'],
  elbows: ['arms'],
  wrists: ['arms'],
  lower_back: ['back', 'core'],
  hips: ['glutes'],
  knees: ['legs', 'quads', 'hamstrings'],
  ankles: ['calves'],
};

// Broad per-area stress patterns. `avoid` removes every match.
const AREA_AVOID_PATTERNS: Record<SetupCautionArea, string[]> = {
  shoulders: [
    'overhead press',
    'shoulder press',
    'push press',
    'arnold press',
    'upright row',
    'lateral raise',
    'rear delt',
    'handstand',
    'dip',
  ],
  lower_back: [
    'deadlift',
    'romanian',
    'good morning',
    'bent-over',
    'barbell row',
    'pendlay',
    'back extension',
    'kettlebell swing',
    'clean',
    'snatch',
  ],
  knees: [
    'squat',
    'lunge',
    'leg press',
    'leg extension',
    'step-up',
    'pistol',
    'box jump',
    'wall sit',
  ],
  elbows: ['curl', 'skull crusher', 'triceps', 'close-grip', 'pushdown', 'dip'],
  wrists: ['barbell curl', 'push-up', 'front squat', 'handstand', 'wrist'],
  hips: ['hip thrust', 'sumo', 'adductor', 'abductor', 'bulgarian', 'pistol'],
  neck: ['shrug', 'neck', 'behind-the-neck'],
  ankles: ['calf raise', 'jump', 'skipping', 'sprint', 'run', 'treadmill', 'stride'],
};

// `careful` swaps: first matching pattern wins; unmatched exercises keep their
// place (there is no honest generic swap for every movement).
const AREA_CAREFUL_SWAPS: Record<SetupCautionArea, Array<[string, string]>> = {
  shoulders: [
    ['overhead press', 'Landmine Press'],
    ['shoulder press', 'Landmine Press'],
    ['push press', 'Landmine Press'],
    ['arnold press', 'Landmine Press'],
    ['upright row', 'Lateral Raise'],
    ['incline bench press', 'Machine Chest Press'],
    ['bench press', 'Machine Chest Press'],
    ['dip', 'Machine Chest Press'],
  ],
  lower_back: [
    ['romanian deadlift', 'Hip Thrust'],
    ['deadlift', 'Hip Thrust'],
    ['good morning', 'Back Extension'],
    ['bent-over', 'Chest-Supported Row'],
    ['barbell row', 'Chest-Supported Row'],
    ['pendlay', 'Chest-Supported Row'],
    ['kettlebell swing', 'Glute Bridge'],
  ],
  knees: [
    ['bulgarian split squat', 'Box Squat'],
    ['squat', 'Box Squat'],
    ['lunge', 'Glute Bridge'],
    ['leg press', 'Hip Thrust'],
    ['leg extension', 'Leg Curl'],
    ['step-up', 'Glute Bridge'],
  ],
  elbows: [
    ['skull crusher', 'Triceps Pushdown'],
    ['overhead triceps extension', 'Triceps Pushdown'],
    ['close-grip bench press', 'Machine Chest Press'],
    ['preacher curl', 'Hammer Curl'],
    ['barbell curl', 'Hammer Curl'],
    ['dumbbell curl', 'Hammer Curl'],
  ],
  wrists: [
    ['barbell curl', 'Hammer Curl'],
    ['push-up', 'Incline Push-Up'],
    ['front squat', 'Back Squat'],
  ],
  hips: [
    ['hip thrust', 'Glute Bridge'],
    ['bulgarian split squat', 'Leg Press'],
  ],
  neck: [],
  ankles: [
    ['standing calf raise', 'Seated Calf Raise'],
    ['treadmill hiit', 'Bike HIIT (45s sprint / 15s rest)'],
  ],
};

// Careful + the area chosen as a focus: bodyweight-first variants (step-6 note).
const AREA_BODYWEIGHT_SWAPS: Record<SetupCautionArea, Array<[string, string]>> = {
  shoulders: [
    ['overhead press', 'Incline Push-Up'],
    ['shoulder press', 'Incline Push-Up'],
    ['bench press', 'Push-Up Wide'],
  ],
  lower_back: [
    ['deadlift', 'Glute Bridge'],
    ['barbell row', 'Inverted Row'],
    ['bent-over', 'Inverted Row'],
    ['kettlebell swing', 'Glute Bridge'],
  ],
  knees: [
    ['squat', 'Bodyweight Squat'],
    ['lunge', 'Bodyweight Walking Lunge'],
    ['leg press', 'Bodyweight Squat'],
  ],
  elbows: [],
  wrists: [],
  hips: [['hip thrust', 'Glute Bridge']],
  neck: [],
  ankles: [],
};

const BODYWEIGHT_NAME_PATTERNS = [
  'bodyweight',
  'push-up',
  'glute bridge',
  'inverted row',
  'plank',
  'mountain climber',
];

function normalize(name: string) {
  return name.trim().toLowerCase();
}

export function exerciseHitsCautionArea(exerciseName: string, area: SetupCautionArea): boolean {
  const normalized = normalize(exerciseName);
  return AREA_AVOID_PATTERNS[area].some((pattern) => normalized.includes(pattern));
}

function findSwap(exerciseName: string, table: Array<[string, string]>): string | null {
  const normalized = normalize(exerciseName);
  for (const [pattern, replacement] of table) {
    if (normalized.includes(pattern)) {
      return replacement;
    }
  }
  return null;
}

function isBannedByAnyAvoid(exerciseName: string, flags: SetupCautionFlag[]): boolean {
  return flags.some((flag) => flag.level === 'avoid' && exerciseHitsCautionArea(exerciseName, flag.area));
}

function resolveTrackingMode(
  replacementName: string,
  original: WorkoutTemplateExercise['trackingMode'],
): WorkoutTemplateExercise['trackingMode'] {
  const normalized = normalize(replacementName);
  return BODYWEIGHT_NAME_PATTERNS.some((pattern) => normalized.includes(pattern)) ? 'bodyweight' : original;
}

export interface CautionExerciseSwap {
  from: string;
  to: string;
  area: SetupCautionArea;
}

export interface CautionAdjustedExercises {
  exercises: WorkoutTemplateExercise[];
  removed: Array<{ name: string; area: SetupCautionArea }>;
  swapped: CautionExerciseSwap[];
}

export function applyCautionFlagsToExercises(
  exercises: WorkoutTemplateExercise[],
  flags: SetupCautionFlag[],
  focusAreas: SetupFocusArea[] = [],
): CautionAdjustedExercises {
  const seriousFlags = flags.filter((flag) => flag.level !== 'info');
  if (seriousFlags.length === 0) {
    return { exercises, removed: [], swapped: [] };
  }

  const removed: CautionAdjustedExercises['removed'] = [];
  const swapped: CautionExerciseSwap[] = [];

  const adjusted = exercises
    .map((exercise) => {
      const matching = seriousFlags.filter((flag) => exerciseHitsCautionArea(exercise.exerciseName, flag.area));
      if (matching.length === 0) {
        return exercise;
      }

      const avoidFlag = matching.find((flag) => flag.level === 'avoid');
      if (avoidFlag) {
        removed.push({ name: exercise.exerciseName, area: avoidFlag.area });
        return null;
      }

      for (const flag of matching) {
        const focusOverlap = CAUTION_TO_FOCUS_AREAS[flag.area].some((area) => focusAreas.includes(area));
        const replacement =
          (focusOverlap ? findSwap(exercise.exerciseName, AREA_BODYWEIGHT_SWAPS[flag.area]) : null) ??
          findSwap(exercise.exerciseName, AREA_CAREFUL_SWAPS[flag.area]);

        // Never swap into something another flag bans outright.
        if (replacement && !isBannedByAnyAvoid(replacement, seriousFlags)) {
          swapped.push({ from: exercise.exerciseName, to: replacement, area: flag.area });
          return {
            ...exercise,
            exerciseName: replacement,
            trackingMode: resolveTrackingMode(replacement, exercise.trackingMode),
          };
        }
      }

      return exercise;
    })
    .filter((exercise): exercise is WorkoutTemplateExercise => exercise !== null);

  return { exercises: adjusted, removed, swapped };
}

/** Short human summary for the plan overview, e.g. "Knees left out · Shoulders swapped". */
export function buildCautionSummaryLabel(flags: SetupCautionFlag[], areaLabels: Record<SetupCautionArea, string>) {
  const parts = flags
    .filter((flag) => flag.level !== 'info')
    .map((flag) => `${areaLabels[flag.area]} ${flag.level === 'avoid' ? 'left out' : 'joint-friendly'}`);
  return parts.length > 0 ? `Trains around: ${parts.join(' · ')}` : null;
}
