import { findGuidedLibraryIndex } from './guidedPlayer';
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
export function isSameLift(left: string, right: string, libraryNames?: readonly string[]): boolean {
  const a = normalize(left);
  const b = normalize(right);
  if (!a || !b) {
    return false;
  }
  if (a === b) {
    return true;
  }
  if (!libraryNames || libraryNames.length === 0) {
    return false;
  }
  const names = [...libraryNames];
  const leftIndex = findGuidedLibraryIndex(left, names);
  const rightIndex = findGuidedLibraryIndex(right, names);
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
 * Order: the lift as a primary lift beats it as an accessory; more sessions of
 * it beat fewer; ties fall back to `preferredOrder` — the caller's own ranking
 * (the setup recommendation, the reader's level), so two equally squat-heavy
 * programmes sort the way the rest of the app already sorts them — and then to
 * catalog order, so the result is stable.
 */
export function rankProgrammesForLift(
  programmes: readonly GoalProgrammeCandidate[],
  liftName: string,
  options: { preferredOrder?: readonly string[]; libraryNames?: readonly string[] } = {},
): GoalProgrammeMatch[] {
  const preference = new Map((options.preferredOrder ?? []).map((id, index) => [id, index]));
  const catalogIndex = new Map(programmes.map((programme, index) => [programme.id, index]));
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
