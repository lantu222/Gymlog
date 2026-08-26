import { TailoredSwapOption } from './tailoringFit';

/**
 * A swap option carrying the label the reader actually sees.
 *
 * The pool's names are English and the reader types Finnish, so a search over
 * `exerciseName` alone finds nothing for "kyykky". The caller localises once
 * and passes it along rather than this module learning about languages.
 */
export type SearchableSwapOption = TailoredSwapOption & { searchLabel?: string };

/**
 * The swap list, cut down to a choice a reader can actually make.
 *
 * The pool a substitution group holds is the set of lifts that are VALID here,
 * which is not the same as the set worth reading. "Lantionnosto tangolla"
 * offered nine, all of them some hip thrust or glute bridge, and the reader's
 * verdict was that there were far too many — and the actions below the list had
 * been pushed off the bottom of the sheet (user 2026-08-26).
 *
 * So the pool is split the way the question is actually asked. Someone who
 * cannot do this lift today wants either the same movement with different gear
 * — a machine instead of a bar — or something else that trains the same thing.
 * Those are two different answers and the list used to interleave them by
 * score, so the machine version could sit fourth behind three glute bridges.
 *
 * Ranking inside each half is left exactly as `buildTailoredSwapOptions` made
 * it: that is where equipment, joints and stated preferences are weighed, and
 * re-sorting here would be a second opinion competing with it.
 */

/** Enough to choose between, few enough to read without scrolling. */
const MAX_VARIATIONS = 3;
const MAX_RELATED = 3;

/**
 * Words that name the gear or the manner, not the movement.
 *
 * Stripping them leaves the head: "Barbell Hip Thrust", "Machine Hip Thrust"
 * and "Single-Leg Hip Thrust" all reduce to "hip thrust", while "Glute Bridge
 * Hold" reduces to "glute bridge" and stays a different movement.
 */
const QUALIFIERS =
  /\b(barbell|dumbbell|machine|cable|banded|band|smith|kettlebell|bodyweight|assisted|weighted|light|heavy|paused|pause|competition|standing|seated|lying|incline|decline|single leg|single arm|one arm|alternating|reverse|wide|close|neutral|grip|deficit|sumo|conventional|explosive|slow|tempo)\b/g;

export function movementHead(name: string): string {
  return (
    name
      .toLowerCase()
      // "(Bodyweight or Light Bar)" is gear talk in brackets; the head is outside.
      .replace(/\([^)]*\)/g, ' ')
      // Hyphens go first, so "Single-Leg" can be matched as the two words the
      // qualifier list holds. The other order left it unmatched and put the
      // single-leg version in with the different movements.
      .replace(/[-–]/g, ' ')
      .replace(/[^a-zåäö ]/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(QUALIFIERS, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

export interface SwapShortlist {
  /** The same movement, different gear or loading. */
  variations: SearchableSwapOption[];
  /** A different movement from the same pool — same area, other angle. */
  related: SearchableSwapOption[];
  /** How many the pool held before the cut, so the sheet can offer the rest. */
  total: number;
}

/**
 * The same exercise written two ways.
 *
 * The pool holds both "Glute Bridge (Banded)" and "Banded Glute Bridge" —
 * catalogs that were imported separately, and the reader gets two rows that do
 * the same thing. Word-set equality catches it without guessing: the same words
 * in another order name the same lift, while "Glute Bridge Hold" keeps a word
 * the others do not have and stays its own row.
 */
function identityKey(name: string): string {
  return name
    .toLowerCase()
    // Brackets are punctuation here, not gear talk to discard: "(Banded)" is
    // exactly the word that makes this the same lift as "Banded Glute Bridge".
    .replace(/[-–]/g, ' ')
    .replace(/[^a-zåäö ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(' ');
}

export interface SwapShortlistOptions {
  /**
   * Every lift already in today's session.
   *
   * The pool offered "taljapotku" as a replacement for a slot in a session that
   * already had taljapotku two rows down (#bugs 2026-08-26). Swapping to it
   * would mean doing the same exercise twice and calling it a change.
   */
  alreadyInSession?: readonly string[];
  /** What the reader typed to narrow the list. */
  query?: string;
}

export function buildSwapShortlist(
  currentExerciseName: string,
  options: readonly SearchableSwapOption[],
  { alreadyInSession = [], query = '' }: SwapShortlistOptions = {},
): SwapShortlist {
  const head = movementHead(currentExerciseName);
  // Matched on identity, not on the exact string: the session may hold the
  // other spelling of the same lift.
  const inSession = new Set(alreadyInSession.map(identityKey));
  const needle = query.trim().toLowerCase();
  const variations: SearchableSwapOption[] = [];
  const related: SearchableSwapOption[] = [];
  // First wins, so the tailoring pass's ranking decides which spelling shows.
  const seen = new Set<string>();

  for (const option of options) {
    const identity = identityKey(option.exerciseName);
    if (seen.has(identity) || inSession.has(identity)) {
      continue;
    }
    // Searched on the English name AND on whatever the caller passes as a
    // label, because the reader types Finnish and the pool is English.
    if (needle && !`${option.exerciseName} ${option.searchLabel ?? ''}`.toLowerCase().includes(needle)) {
      continue;
    }
    seen.add(identity);
    // An empty head means the name was all qualifiers — rare, and it must not
    // silently match every other empty one, so it counts as related.
    const optionHead = movementHead(option.exerciseName);
    if (head && optionHead === head) {
      variations.push(option);
    } else {
      related.push(option);
    }
  }

  return {
    variations: variations.slice(0, MAX_VARIATIONS),
    // When the movement has no siblings, the whole shortlist is related lifts —
    // and a list of three where nine were valid would be hiding choices for the
    // sake of symmetry.
    related: related.slice(0, variations.length === 0 ? MAX_VARIATIONS + MAX_RELATED : MAX_RELATED),
    // Counted after the duplicate spellings are dropped: the reader is never
    // told a pool holds nine when two of them were the same lift twice.
    total: seen.size,
  };
}
