import { ProgramSeason } from './programSeasons';

/**
 * Signing up for a season — the list, kept on this device.
 *
 * "Ilmoittaudu" used to be a word on a button with nothing behind it, which is
 * why the card would not say it. Now it writes a row: which season, which year,
 * and when you signed. That is a real act with a real record, and it is the
 * reader's own — it is not a roster, it does not know about anybody else, and
 * no screen may count the rows and call the number "participants".
 *
 * Two things it makes possible that the programme-is-my-active-plan check could
 * not:
 *
 * 1. **Signing up early.** The winter season opens 1.10. Inside the join window
 *    you can be in it without swapping the programme you are training TODAY —
 *    the entry is the commitment, the programme swap happens when the season
 *    actually opens.
 * 2. **Staying in.** Changing programme mid-season used to silently un-join
 *    you, because "joined" was read off the active plan. It no longer can.
 */

export interface SeasonEnrolment {
  season: ProgramSeason;
  /** The season's START year — winter 2026 runs into 2027 and is still 2026. */
  year: number;
  /** ISO timestamp of the moment the reader signed up. */
  joinedAt: string;
}

/**
 * How early a season opens for sign-ups.
 *
 * The user's number. Before it, a season is a date on a calendar and the card
 * has nothing to offer; inside it, signing up is a thing you can do, and the
 * countdown on the card is counting down to something.
 */
export const SEASON_JOIN_WINDOW_DAYS = 40;

const DAY = 86_400_000;

export function normalizeSeasonEnrolments(value: unknown): SeasonEnrolment[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set<string>();
  const entries: SeasonEnrolment[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }
    const candidate = entry as Partial<SeasonEnrolment>;
    const season = candidate.season === 'summer' || candidate.season === 'winter' ? candidate.season : null;
    const year = typeof candidate.year === 'number' && Number.isFinite(candidate.year)
      ? Math.trunc(candidate.year)
      : null;
    if (!season || year === null) {
      continue;
    }
    const key = `${season}-${year}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    entries.push({
      season,
      year,
      joinedAt: typeof candidate.joinedAt === 'string' ? candidate.joinedAt : new Date(0).toISOString(),
    });
  }
  return entries;
}

export function isEnrolled(
  entries: readonly SeasonEnrolment[],
  season: ProgramSeason,
  year: number,
): boolean {
  return entries.some((entry) => entry.season === season && entry.year === year);
}

/** Idempotent: signing up twice is the same as signing up once. */
export function addSeasonEnrolment(
  entries: readonly SeasonEnrolment[],
  next: SeasonEnrolment,
): SeasonEnrolment[] {
  if (isEnrolled(entries, next.season, next.year)) {
    return [...entries];
  }
  return [...entries, next];
}

/**
 * Whether a season that has not opened yet is taking sign-ups.
 *
 * A season 148 days out is not something you can join; it is a date. Inside the
 * window it is, and that is also exactly when it earns a card on Home — the two
 * are the same question, so they are the same function.
 */
export function isJoinWindowOpen(daysUntilStart: number): boolean {
  return daysUntilStart >= 0 && daysUntilStart <= SEASON_JOIN_WINDOW_DAYS;
}

/** Whole days from `now` to `start`, rounded up; 0 once it has begun. */
export function daysUntil(start: Date, now: Date): number {
  return Math.max(0, Math.ceil((start.getTime() - now.getTime()) / DAY));
}
