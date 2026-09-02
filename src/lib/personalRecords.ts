import { groupByMonth } from './monthGroups';

/**
 * Your bests, and when you set them.
 *
 * The app has counted records for a season badge and flashed one on the
 * post-workout screen, but there has never been a place to see them. That is
 * the first thing anyone asks a training log for, and every number is already
 * in it — this reads them out rather than deriving anything new.
 *
 * Three kinds, because "best" means three different things and a single list
 * would have to pick one: the heaviest set, the most reps in a set, and the
 * hardest single session for that lift. A bodyweight program produces no
 * weight records at all, which is why the reps kind exists.
 *
 * Every record carries the record BEFORE it, so the screen can say what
 * changed. That is walked chronologically rather than taken as "the
 * second-best value ever": a lift that went 80 → 85 → 82.5 has a previous
 * record of 80, not 82.5.
 */

export type RecordKind = 'weight' | 'reps' | 'volume';

export interface RecordSet {
  weight: number;
  reps: number;
}

export interface RecordEntry {
  /** ISO timestamp of the session this set belongs to. */
  performedAt: string;
  sets: RecordSet[];
}

export interface RecordSource {
  /** Stable identity — the tracked lift's key. */
  key: string;
  name: string;
  /** From the exercise library when the name matches; null when it does not. */
  bodyPart?: string | null;
  entries: RecordEntry[];
}

export interface PersonalRecord {
  key: string;
  name: string;
  bodyPart: string | null;
  kind: RecordKind;
  /** The record: kg for weight, reps for reps, kg of volume for volume. */
  value: number;
  /** Reps at the record set (weight kind), or the weight used (reps kind). */
  companion: number | null;
  /** ISO date the record was set. */
  performedAt: string;
  /** The record that stood before this one, or null if this is the first. */
  previous: number | null;
  /** Set within the freshness window — drives the "UUSI" badge. */
  fresh: boolean;
}

/** How recent a record has to be to read as new. */
export const FRESH_RECORD_DAYS = 30;

interface Candidate {
  value: number;
  companion: number | null;
  performedAt: string;
  stamp: number;
}

/** One candidate per entry, by kind. Null when the entry cannot produce one. */
function candidateFor(entry: RecordEntry, kind: RecordKind): Candidate | null {
  const stamp = Date.parse(entry.performedAt);
  if (!Number.isFinite(stamp)) {
    return null;
  }
  const sets = entry.sets.filter((set) => Number.isFinite(set.weight) && Number.isFinite(set.reps));
  if (sets.length === 0) {
    return null;
  }

  if (kind === 'volume') {
    // The whole session's work on this lift, which is what makes a session
    // "hard" in a way a single set cannot show.
    const volume = sets.reduce((total, set) => total + Math.max(0, set.weight) * Math.max(0, set.reps), 0);
    return volume > 0 ? { value: volume, companion: sets.length, performedAt: entry.performedAt, stamp } : null;
  }

  if (kind === 'weight') {
    const loaded = sets.filter((set) => set.weight > 0);
    if (loaded.length === 0) {
      return null;
    }
    const best = loaded.reduce((top, set) =>
      set.weight > top.weight || (set.weight === top.weight && set.reps > top.reps) ? set : top,
    );
    return { value: best.weight, companion: best.reps, performedAt: entry.performedAt, stamp };
  }

  const best = sets.reduce((top, set) => (set.reps > top.reps ? set : top));
  return best.reps > 0
    ? { value: best.reps, companion: best.weight > 0 ? best.weight : null, performedAt: entry.performedAt, stamp }
    : null;
}

/**
 * The record for one lift, or null when it has none of that kind.
 *
 * Walked in date order so `previous` is the record that actually stood before
 * this one — not the runner-up in the final sorted list.
 */
export function resolveRecord(
  source: RecordSource,
  kind: RecordKind,
  now: Date = new Date(),
): PersonalRecord | null {
  const candidates = source.entries
    .map((entry) => candidateFor(entry, kind))
    .filter((candidate): candidate is Candidate => candidate !== null)
    .sort((left, right) => left.stamp - right.stamp);

  if (candidates.length === 0) {
    return null;
  }

  let best: Candidate | null = null;
  let previous: number | null = null;

  for (const candidate of candidates) {
    if (best === null) {
      best = candidate;
      continue;
    }
    if (candidate.value > best.value) {
      previous = best.value;
      best = candidate;
    }
  }

  if (best === null) {
    return null;
  }

  return {
    key: source.key,
    name: source.name,
    bodyPart: source.bodyPart ?? null,
    kind,
    value: best.value,
    companion: best.companion,
    performedAt: best.performedAt,
    previous,
    fresh: now.getTime() - best.stamp <= FRESH_RECORD_DAYS * 86_400_000,
  };
}

/**
 * Every lift's record of one kind, best first.
 *
 * Sorted by how recently the record was set rather than by size: a list
 * ordered by kilos is a list of which lifts are heaviest, which the reader
 * already knows. Ordered by date it answers "what have I done lately", and
 * the new ones land at the top where the badge is.
 */
export function resolveRecords(
  sources: readonly RecordSource[],
  kind: RecordKind,
  now: Date = new Date(),
): PersonalRecord[] {
  return sources
    .map((source) => resolveRecord(source, kind, now))
    .filter((record): record is PersonalRecord => record !== null)
    .sort((left, right) => Date.parse(right.performedAt) - Date.parse(left.performedAt));
}

/** Records grouped by the month they were set, newest month first. */
export function groupRecordsByMonth(
  records: readonly PersonalRecord[],
): Array<{ year: number; month: number; records: PersonalRecord[] }> {
  // Delegates, so Records and History cannot disagree about which month a
  // midnight entry belongs to. The shape stays `records` for its callers.
  return groupByMonth(records, (record) => record.performedAt).map((group) => ({
    year: group.year,
    month: group.month,
    records: group.items,
  }));
}
