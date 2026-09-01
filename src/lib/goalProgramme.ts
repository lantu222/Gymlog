import { findGuidedLibraryIndex } from './guidedPlayer';
import { isSameLiftByGroup, liftGroupOf } from './liftIdentity';
import { StrengthGoal } from './strengthGoals';

/**
 * A goal always has a programme that trains its lift.
 *
 * "Bench 100 kg" used to be a number on the Programs tab with a bar under it,
 * and nothing in the app connected the number to what the reader was about to
 * do on Tuesday. The user's rule (feedback round 2, #1): a target must come
 * with a programme that goes towards it.
 *
 * What this module claims is deliberately small and checkable: whether a
 * programme CONTAINS the lift, and how central it is there. It never estimates
 * how fast a programme would get you to the number — the app measures a goal
 * against the reader's own best set and nothing else, and a "recommended for
 * your 100 kg" claim would be the projection that rule refuses.
 */

/** The narrowest shape every programme source (catalog, custom, plan) can offer. */
export interface GoalProgrammeExercise {
  exerciseName: string;
  role?: 'primary' | 'secondary' | 'accessory';
}

export interface GoalProgrammeSession {
  exercises: GoalProgrammeExercise[];
}

export interface GoalProgrammeCandidate {
  id: string;
  sessions: GoalProgrammeSession[];
  /** Catalog level, when known. Absent on a programme the reader wrote. */
  level?: 'beginner' | 'intermediate' | 'advanced';
  /** Sessions a week, when known. */
  daysPerWeek?: number;
}

/** Who the suggestion is for. Without it the ranking is level-blind. */
export interface GoalProgrammeReader {
  /** Setup level, which maps onto the catalog's three tiers. */
  level?: 'beginner' | 'advanced' | 'pro' | null;
  daysPerWeek?: number | null;
}

const CATALOG_LEVEL_FOR_SETUP: Record<string, GoalProgrammeCandidate['level']> = {
  beginner: 'beginner',
  advanced: 'intermediate',
  pro: 'advanced',
};

/**
 * Setup's three tiers in the catalog's vocabulary.
 *
 * The two do not share words — setup says beginner/advanced/pro, the catalog
 * says beginner/intermediate/advanced — so "advanced" means different things
 * on either side of this line. Anywhere that compares a reader's level with a
 * template's has to come through here, or `advanced === 'advanced'` quietly
 * matches a Pro plan to an Amateur.
 */
export function catalogLevelForSetup(
  level: string | null | undefined,
): GoalProgrammeCandidate['level'] | undefined {
  return level ? CATALOG_LEVEL_FOR_SETUP[level] : undefined;
}

/**
 * How badly a programme fits the reader — lower is better, 0 is a match.
 *
 * A target answers "which programme gets me there", and the honest answer has
 * to be a programme they can actually run. Ranking on deadlift sessions alone
 * offered a six-day advanced split to someone training three days as a
 * beginner: more of the lift, in a week that is not theirs.
 */
function fitPenalty(candidate: GoalProgrammeCandidate, reader: GoalProgrammeReader | undefined): number {
  if (!reader) {
    return 0;
  }
  let penalty = 0;
  const wanted = catalogLevelForSetup(reader.level);
  if (wanted && candidate.level && candidate.level !== wanted) {
    // One tier away is a stretch; two is a different training life.
    const order: NonNullable<GoalProgrammeCandidate['level']>[] = ['beginner', 'intermediate', 'advanced'];
    penalty += Math.abs(order.indexOf(candidate.level) - order.indexOf(wanted)) * 2;
  }
  if (reader.daysPerWeek && candidate.daysPerWeek) {
    penalty += Math.abs(candidate.daysPerWeek - reader.daysPerWeek);
  }
  return penalty;
}

export interface GoalProgrammeMatch {
  id: string;
  /** Sessions in the programme that train the lift. */
  sessionCount: number;
  /** True when the lift is a primary lift in at least one of those sessions. */
  primary: boolean;
}

function normalize(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Same lift, by name.
 *
 * Catalog programmes and the goal presets both use the canonical names ("Bench
 * Press"), so an exact match covers the ready catalog. Custom programmes may
 * carry library variants ("Barbell Bench Press - Medium Grip"); given the
 * library's names, both sides resolve through the alias matcher the guided
 * player already uses, so a variant of the lift still counts as the lift.
 */
/**
 * Per-library memo of the alias matcher.
 *
 * `findGuidedLibraryIndex` lower-cases every one of the ~870 library names on
 * every call. Ranking the catalog for one lift calls it twice per exercise per
 * programme — thousands of times — and the goal-programme memo in App ran that
 * for three lifts. Measured on a Galaxy A54: 4.8 seconds, on every preference
 * change, because the memo sat downstream of the setup selection. The
 * resolution of a name against a given library never changes, so it is looked
 * up once and kept for as long as that library array lives.
 */
const resolverCache = new WeakMap<readonly string[], { names: string[]; byName: Map<string, number | null> }>();

function resolveLibraryIndex(name: string, libraryNames: readonly string[]): number | null {
  let entry = resolverCache.get(libraryNames);
  if (!entry) {
    entry = { names: [...libraryNames], byName: new Map() };
    resolverCache.set(libraryNames, entry);
  }
  const key = normalize(name);
  const cached = entry.byName.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const index = findGuidedLibraryIndex(name, entry.names);
  entry.byName.set(key, index);
  return index;
}

export function isSameLift(left: string, right: string, libraryNames?: readonly string[]): boolean {
  const a = normalize(left);
  const b = normalize(right);
  if (!a || !b) {
    return false;
  }
  if (a === b) {
    return true;
  }
  // Spelled differently, same lift. Checked before the library because the
  // library resolves "Conventional Deadlift" and "Barbell Deadlift" to two
  // different entries — correctly, for a browser; wrongly, for a target.
  if (isSameLiftByGroup(left, right)) {
    return true;
  }
  // ...and the reverse: two names in DIFFERENT groups are different lifts, so
  // the library must not merge them. A Romanian deadlift resolving near a
  // deadlift would otherwise fill a deadlift target.
  const leftGroup = liftGroupOf(left);
  const rightGroup = liftGroupOf(right);
  if (leftGroup !== null && rightGroup !== null && leftGroup !== rightGroup) {
    return false;
  }
  if (!libraryNames || libraryNames.length === 0) {
    return false;
  }
  const leftIndex = resolveLibraryIndex(left, libraryNames);
  const rightIndex = resolveLibraryIndex(right, libraryNames);
  return leftIndex !== null && leftIndex === rightIndex;
}

/** How a programme relates to a lift, or null when it never trains it. */
export function matchProgrammeToLift(
  programme: GoalProgrammeCandidate,
  liftName: string,
  libraryNames?: readonly string[],
): GoalProgrammeMatch | null {
  let sessionCount = 0;
  let primary = false;
  for (const session of programme.sessions) {
    let inSession = false;
    for (const exercise of session.exercises) {
      if (isSameLift(exercise.exerciseName, liftName, libraryNames)) {
        inSession = true;
        if (exercise.role === 'primary') {
          primary = true;
        }
      }
    }
    if (inSession) {
      sessionCount += 1;
    }
  }
  return sessionCount > 0 ? { id: programme.id, sessionCount, primary } : null;
}

/**
 * The programmes that train the lift, best fit first.
 *
 * Order: the lift as a primary lift beats it as an accessory; then how well
 * the programme fits the reader's level and week, because a programme they
 * cannot run is not an answer; then more sessions of the lift beat fewer; ties
 * fall back to `preferredOrder` — the caller's own ranking — and then to
 * catalog order, so the result is stable.
 */
export function rankProgrammesForLift(
  programmes: readonly GoalProgrammeCandidate[],
  liftName: string,
  options: {
    preferredOrder?: readonly string[];
    libraryNames?: readonly string[];
    reader?: GoalProgrammeReader;
  } = {},
): GoalProgrammeMatch[] {
  const preference = new Map((options.preferredOrder ?? []).map((id, index) => [id, index]));
  const catalogIndex = new Map(programmes.map((programme, index) => [programme.id, index]));
  const fit = new Map(programmes.map((programme) => [programme.id, fitPenalty(programme, options.reader)]));
  const matches: GoalProgrammeMatch[] = [];
  for (const programme of programmes) {
    const match = matchProgrammeToLift(programme, liftName, options.libraryNames);
    if (match) {
      matches.push(match);
    }
  }
  return matches.sort((left, right) => {
    if (left.primary !== right.primary) {
      return left.primary ? -1 : 1;
    }
    const leftFit = fit.get(left.id) ?? 0;
    const rightFit = fit.get(right.id) ?? 0;
    if (leftFit !== rightFit) {
      return leftFit - rightFit;
    }
    if (left.sessionCount !== right.sessionCount) {
      return right.sessionCount - left.sessionCount;
    }
    const leftPref = preference.get(left.id) ?? Number.MAX_SAFE_INTEGER;
    const rightPref = preference.get(right.id) ?? Number.MAX_SAFE_INTEGER;
    if (leftPref !== rightPref) {
      return leftPref - rightPref;
    }
    return (catalogIndex.get(left.id) ?? 0) - (catalogIndex.get(right.id) ?? 0);
  });
}

/**
 * What the screens say next to a goal — resolved once in the shell from the
 * coverage and the ranking above, with titles already in the reader's language.
 *
 *  - `covered`: an active programme trains the lift; `programme` is it.
 *  - `suggest`: nothing active trains it (or nothing is active); `programme`
 *    is the best ready programme that does.
 *  - `none`: no ready programme trains the lift at all. The honest answer is
 *    "build your own", and the row says so rather than inventing a fit.
 */
export interface GoalProgrammeSuggestionView {
  status: 'covered' | 'suggest' | 'none';
  programme: {
    id: string;
    title: string;
    /** Sessions of the programme that train the lift, and its session count. */
    sessionCount: number;
    totalSessions: number;
  } | null;
}

export type GoalCoverageStatus =
  /** An active programme trains the lift. */
  | 'covered'
  /** There are active programmes and none of them trains the lift. */
  | 'uncovered'
  /** Nothing is active, so nothing can be said about it yet. */
  | 'noProgramme';

export interface GoalCoverage {
  goal: StrengthGoal;
  status: GoalCoverageStatus;
  /** The id of the active programme that covers the lift, when one does. */
  coveredBy: string | null;
}

/**
 * Whether the reader's ACTIVE programmes train the goal's lift.
 *
 * This is the sentence the goals row can say truthfully: "your current
 * programme trains this" or "your current programme does not train this".
 * The third state — no active programme — is not the same as "not covered",
 * and the row must not scold an empty account.
 */
export function describeGoalCoverage(
  goal: StrengthGoal,
  activeProgrammes: readonly GoalProgrammeCandidate[],
  libraryNames?: readonly string[],
): GoalCoverage {
  if (activeProgrammes.length === 0) {
    return { goal, status: 'noProgramme', coveredBy: null };
  }
  for (const programme of activeProgrammes) {
    if (matchProgrammeToLift(programme, goal.exerciseName, libraryNames)) {
      return { goal, status: 'covered', coveredBy: programme.id };
    }
  }
  return { goal, status: 'uncovered', coveredBy: null };
}
