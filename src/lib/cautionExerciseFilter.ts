import { WorkoutTemplateExercise } from '../features/workout/workoutTypes';
import { SetupCautionArea, SetupCautionFlag, SetupFocusArea } from '../types/models';
import { trackingModeAfterSwap } from './catalogExercisePools';
import { isHoldExerciseName } from './holdExercises';

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
 * Everything is exercise-NAME based, grounded in the catalog's names, so
 * composed and custom programs behave the same. A name is split into words
 * (hyphens, spaces and punctuation all separate them, so "Step-Up" and "Step
 * Ups" read alike) and a pattern matches when its words appear in a row, each
 * allowing the plain English endings s, es and ing ("run" matches "Running",
 * "dip" matches "Dipping"). It never matches inside a word: "run" is not in
 * "Crunch". Per-area EXCLUSION phrases mask words that appear in a name without
 * loading the joint ("curl" in "Leg Curl" is not an elbow lift) before the
 * patterns are tried. Swaps use the same word rule.
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
    'upright barbell row',
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
    'lower back curl',
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
  ankles: ['calf raise', 'calf press', 'jump', 'skipping', 'sprint', 'run', 'jog', 'treadmill', 'stride'],
};

// Phrases that contain a pattern word but do not load the area. Their words are
// masked out of the name before the patterns above are tried, so the rest of
// the name still counts ("Leg Curl and Triceps Pushdown" is still a triceps
// lift). Add one only for a name that is a real false positive.
const AREA_EXCLUDE_PATTERNS: Record<SetupCautionArea, string[]> = {
  shoulders: [],
  // A grip, and rows done upright or supported on a bench, are not a hinge.
  lower_back: ['clean grip', 'upright barbell row', 'lying cambered barbell row'],
  // The leg press of a calf press is done with straight legs.
  knees: ['calf press on the leg press'],
  // "curl" is also the hamstring curl and the prone back raise.
  elbows: ['leg curl', 'hamstring curl', 'lower back curl'],
  wrists: [],
  hips: [],
  neck: [],
  ankles: [],
};

// `careful` swaps: first matching pattern wins; unmatched exercises keep their
// place (there is no honest generic swap for every movement).
// Exposed (with AREA_BODYWEIGHT_SWAPS below) so a test can sweep every swap
// this filter can produce and check its tracking mode against the library.
export const AREA_CAREFUL_SWAPS: Record<SetupCautionArea, Array<[string, string]>> = {
  shoulders: [
    ['overhead press', 'Landmine Press'],
    ['shoulder press', 'Landmine Press'],
    ['push press', 'Landmine Press'],
    ['arnold press', 'Landmine Press'],
    ['upright row', 'Lateral Raise'],
    ['upright barbell row', 'Lateral Raise'],
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
    // A hold is a stretch held for seconds; its supported version is the
    // careful one. Listed before 'squat', which would turn it into a lift.
    ['deep squat hold', 'Supported Deep Squat Hold'],
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
export const AREA_BODYWEIGHT_SWAPS: Record<SetupCautionArea, Array<[string, string]>> = {
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
    ['deep squat hold', 'Supported Deep Squat Hold'],
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

function normalize(name: string) {
  return name.trim().toLowerCase();
}

/** Lowercase words; every run of non-letters/digits is one boundary. */
function words(text: string): string[] {
  return normalize(text)
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 0);
}

const phraseCache = new Map<string, string[]>();
function phraseWords(phrase: string): string[] {
  let cached = phraseCache.get(phrase);
  if (!cached) {
    cached = words(phrase);
    phraseCache.set(phrase, cached);
  }
  return cached;
}

/** `word` is `base` or `base` with a plain ending: s, es, ing (run -> running, lunge -> lunging). */
function wordMatches(word: string | null, base: string): boolean {
  if (word === null) {
    return false;
  }
  if (word === base || word === `${base}s` || word === `${base}es` || word === `${base}ing`) {
    return true;
  }
  if (word === `${base}${base.slice(-1)}ing`) {
    return true;
  }
  return base.endsWith('e') && word === `${base.slice(0, -1)}ing`;
}

/** Index of the first place `phrase`'s words appear in a row in `nameWords`, or -1. */
function findPhrase(nameWords: Array<string | null>, phrase: string[]): number {
  if (phrase.length === 0) {
    return -1;
  }
  for (let start = 0; start + phrase.length <= nameWords.length; start += 1) {
    if (phrase.every((base, offset) => wordMatches(nameWords[start + offset], base))) {
      return start;
    }
  }
  return -1;
}

export function exerciseHitsCautionArea(exerciseName: string, area: SetupCautionArea): boolean {
  const nameWords: Array<string | null> = words(exerciseName);
  for (const exclusion of AREA_EXCLUDE_PATTERNS[area]) {
    const phrase = phraseWords(exclusion);
    for (let at = findPhrase(nameWords, phrase); at !== -1; at = findPhrase(nameWords, phrase)) {
      for (let offset = 0; offset < phrase.length; offset += 1) {
        nameWords[at + offset] = null;
      }
    }
  }
  return AREA_AVOID_PATTERNS[area].some((pattern) => findPhrase(nameWords, phraseWords(pattern)) !== -1);
}

/**
 * The flagged area a lift loads, for the progression hold, or null.
 *
 * Only `careful` and `avoid` count — `info` promises nothing about training.
 * An `avoid` match normally never reaches a session (the filter removes it),
 * but a lift the reader added by hand can, and it is held the same way. The
 * same name patterns as the filter decide "loads this area", so a swap the
 * filter picked because it spares the area (Leg Press -> Hip Thrust for knees)
 * progresses normally, and one that still loads it (Box Squat) is held.
 */
export function cautionAreaLoadedBy(
  exerciseName: string,
  flags: SetupCautionFlag[] | null | undefined,
): SetupCautionArea | null {
  for (const flag of flags ?? []) {
    if (flag.level !== 'info' && exerciseHitsCautionArea(exerciseName, flag.area)) {
      return flag.area;
    }
  }
  return null;
}

function findSwap(exerciseName: string, table: Array<[string, string]>): string | null {
  const nameWords = words(exerciseName);
  for (const [pattern, replacement] of table) {
    if (findPhrase(nameWords, phraseWords(pattern)) !== -1) {
      return replacement;
    }
  }
  return null;
}

function isBannedByAnyAvoid(exerciseName: string, flags: SetupCautionFlag[]): boolean {
  return flags.some((flag) => flag.level === 'avoid' && exerciseHitsCautionArea(exerciseName, flag.area));
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

        // Never swap into something another flag bans outright. And never
        // swap a hold into a lift: its dose is seconds, and "60–90" carried
        // onto Box Squat read as 90 squats (2026-09-14). A hold with no hold
        // to go to keeps its place, the same as any unmatched movement.
        const holdIntoLift =
          replacement !== null &&
          (exercise.trackingMode === 'hold' || isHoldExerciseName(exercise.exerciseName)) &&
          !isHoldExerciseName(replacement);
        const sameLift = replacement !== null && normalize(replacement) === normalize(exercise.exerciseName);
        if (replacement && !holdIntoLift && !sameLift && !isBannedByAnyAvoid(replacement, seriousFlags)) {
          swapped.push({ from: exercise.exerciseName, to: replacement, area: flag.area });
          return {
            ...exercise,
            exerciseName: replacement,
            // The library's own data, not a name guess: a keyword match on the
            // replacement name called "Bench Dips" -> "Machine Chest Press"
            // bodyweight, leaving the set screen with no kg field for a machine
            // lift (found 2026-09-26). trackingModeAfterSwap is the same rule
            // the live player and Home use for every other swap — hold names
            // first, then the ready programmes' own prescriptions, then the
            // generated library's equipment field, and it only ever moves a
            // slot TOWARD needing a weight for a name none of those place, so
            // an unknown name never silently loses its weight field either.
            trackingMode: trackingModeAfterSwap(exercise.trackingMode, replacement),
          };
        }
      }

      return exercise;
    })
    .filter((exercise): exercise is WorkoutTemplateExercise => exercise !== null);

  return { exercises: adjusted, removed, swapped };
}
