/**
 * When two exercise names mean the same lift.
 *
 * A strength target names one lift ("Barbell Deadlift"), and both the catalog
 * and the reader's log spell it however the program that day happened to spell
 * it: "Deadlift", "Conventional Deadlift", "Trap Bar Deadlift". Comparing the
 * strings found three programs out of fifty-seven that train the deadlift, and
 * a target whose bar could never move — progress was read from a map keyed by
 * the exact name, so anyone training the catalog's own "Conventional Deadlift"
 * had a deadlift target that said "not logged yet" forever.
 *
 * The groups below are the deliberate part. A variation of the same lift
 * counts — sumo and trap bar are deadlifts, a paused bench is a bench — while
 * a different movement does not, however close it sits: a Romanian deadlift is
 * a hinge accessory and must never fill a deadlift target, and an incline or
 * dumbbell bench is not the bench you are chasing.
 */

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Names that mean one lift. Every group is closed: a name outside its group is
 * a different lift, even when it shares a word.
 */
const SAME_LIFT_GROUPS: readonly (readonly string[])[] = [
  [
    // The competition lift and the ways a program writes it. Sumo and trap bar
    // are in by decision: they are the deadlift a lifter is chasing, pulled
    // from a different stance or handle.
    'deadlift',
    'barbell deadlift',
    'conventional deadlift',
    'competition deadlift',
    'sumo deadlift',
    'trap bar deadlift',
    'deficit deadlift',
    'block pull',
    'rack pull',
  ],
  [
    'back squat',
    'barbell back squat',
    'competition back squat',
    'squat',
    'barbell squat',
    'pause squat',
    'paused squat',
  ],
  [
    'bench press',
    'barbell bench press',
    'competition bench press',
    'paused bench press',
    'flat bench press',
  ],
  [
    'overhead press',
    'barbell overhead press',
    'standing overhead press',
    'military press',
    'standing military press',
    'strict press',
  ],
  [
    'barbell row',
    'bent-over barbell row',
    'bent over barbell row',
    'barbell bent-over row',
    'pendlay row',
  ],
];

const GROUP_BY_NAME = new Map<string, number>();
SAME_LIFT_GROUPS.forEach((group, index) => {
  for (const name of group) {
    GROUP_BY_NAME.set(name, index);
  }
});

/**
 * The group two names share, or null when neither is in one. Used to decide
 * sameness before falling back to the exercise library.
 */
export function liftGroupOf(name: string): number | null {
  return GROUP_BY_NAME.get(normalize(name)) ?? null;
}

/**
 * True when both names are the same lift by the groups above. Null-safe on
 * names the groups say nothing about — the caller then falls back to the
 * library, which is what it did before this existed.
 */
export function isSameLiftByGroup(left: string, right: string): boolean {
  const a = liftGroupOf(left);
  const b = liftGroupOf(right);
  return a !== null && a === b;
}

/**
 * The best of `bests` recorded against any spelling of this lift.
 *
 * A reader whose log holds "Trap Bar Deadlift 150" and "Sumo Deadlift 160" has
 * a 160 kg deadlift, and the target should say so instead of finding nothing
 * under the one name it was created with.
 */
export function bestForLift(
  liftName: string,
  bests: ReadonlyMap<string, number | null>,
  matches: (left: string, right: string) => boolean,
): number | null {
  let best: number | null = null;
  for (const [name, weight] of bests) {
    if (typeof weight !== 'number' || !(weight > 0)) {
      continue;
    }
    if (!matches(name, liftName)) {
      continue;
    }
    if (best === null || weight > best) {
      best = weight;
    }
  }
  return best;
}
