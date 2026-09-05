/**
 * What the coach has already told this reader, kept across conversations.
 *
 * lib/coachChatMemory holds the thread that is open right now: it lives eight
 * hours, in memory, and dies with the app. That is deliberate and stays. What
 * it cannot do is stop the coach repeating itself. Ask about the same stalled
 * lift a week apart and the second answer arrives with no idea the first one
 * happened, so the reader is told to add 2.5 kg for the second time — advice
 * they either already took or already rejected.
 *
 * This module is the other half: not the conversation, only its conclusions.
 * One line per answer — the takeaway and the date it was given — capped hard
 * enough that three weeks of coaching costs a few hundred tokens in the cached
 * prefix (scripts/simulate-coach-cost.cjs prices it).
 *
 * Three rules the shape enforces rather than hopes for:
 *
 * - It is bounded. MAX_ENTRIES lines of MAX_TAKEAWAY_CHARS each, so the block
 *   cannot grow with the reader's history the way the training context does.
 * - It expires by calendar date, not by elapsed milliseconds. Helsinki changes
 *   clocks twice a year and a 23-hour day would retire an entry early.
 * - It never claims to be current. Every line carries its date, and the coach
 *   rules in api/ai-coach.ts tell the model to read these as things it said
 *   once — not as facts about training that is happening now. Advice from
 *   three weeks ago may already have been outgrown, and a memory that is
 *   trusted as present tense makes answers worse rather than better.
 *
 * Pure, as everything in src/lib is: no storage, no clock of its own. The
 * caller passes `nowIso`, and storage/coachAdviceMemoryStore owns the disk.
 */

import { calendarDaysBetween } from './completedSessions';

/** One thing the coach said, and when it said it. */
export interface CoachAdviceMemoryEntry {
  /** ISO timestamp of the answer this came from. */
  at: string;
  /** The answer's takeaway, trimmed to MAX_TAKEAWAY_CHARS. */
  takeaway: string;
}

/**
 * One line as the coach is shown it: a local date and the takeaway.
 *
 * A different shape from the stored entry on purpose. The date has to be
 * resolved on the phone — buildAiCoachSystemContext runs on the endpoint,
 * where the timezone is the server's, so an instant turned into a date there
 * is a UTC date whatever the reader's clock says. Resolving it here and
 * sending the result means the coach reads the date the reader would have
 * read, and the payload carries a date instead of a timestamp it cannot
 * interpret.
 */
export interface CoachAdviceMemoryLine {
  /** Local calendar date, YYYY-MM-DD. */
  day: string;
  takeaway: string;
}

/**
 * "2026-08-20", in the device's own timezone.
 *
 * Not `at.slice(0, 10)`: that is the UTC date, and for a reader east of
 * Greenwich an answer given late in the evening is already stamped tomorrow.
 * The window these lines expire on is counted in local calendar days, so the
 * date shown beside them has to mean the same midnight — otherwise the coach
 * is told an answer is a day older or newer than the rule that retires it
 * believes. Same trap, and the same fix, as lib/widgetPayload's toDateKey.
 */
export function coachAdviceDateLabel(at: string): string {
  const date = new Date(at);
  if (!Number.isFinite(date.getTime())) {
    return at.slice(0, 10);
  }
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * How long a takeaway stays worth showing the model.
 *
 * Three weeks is roughly a training block: long enough that "you already told
 * me this" covers the span a reader actually remembers being told something,
 * short enough that a progression cue cannot outlive the progression.
 */
export const COACH_ADVICE_MEMORY_DAYS = 21;

/**
 * How many lines the block may hold. Ten covers three weeks at the rate a Pro
 * user asks questions (25 a month), and bounds the payload at a size worth
 * paying for on every request.
 */
export const MAX_COACH_ADVICE_MEMORY_ENTRIES = 10;

/**
 * How much of one takeaway is kept.
 *
 * The takeaway is already the answer's one-sentence summary, so this is a
 * guard against a long one rather than a summarizer. Cutting at a word
 * boundary keeps the line readable to the model; cutting at all keeps ten of
 * them near a kilobyte.
 */
export const MAX_TAKEAWAY_CHARS = 100;

/**
 * One takeaway, bounded. Returns null for anything that would spend tokens
 * saying nothing — an empty answer, or whitespace.
 */
function condense(takeaway: string): string | null {
  const text = takeaway.replace(/\s+/g, ' ').trim();
  if (!text) {
    return null;
  }
  if (text.length <= MAX_TAKEAWAY_CHARS) {
    return text;
  }
  const cut = text.slice(0, MAX_TAKEAWAY_CHARS);
  const lastSpace = cut.lastIndexOf(' ');
  // A single very long word has no boundary to cut at; the hard slice is then
  // the only option, and it is still better than an unbounded line.
  return `${(lastSpace > MAX_TAKEAWAY_CHARS / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/**
 * Whether two lines say the same thing.
 *
 * The coach answers a repeated question with a repeated takeaway, and storing
 * both would spend the budget twice to tell the model one thing. Compared
 * case-insensitively on the condensed text, which is what the model reads.
 */
function sameAdvice(left: string, right: string): boolean {
  return left.toLocaleLowerCase() === right.toLocaleLowerCase();
}

/**
 * The entries still inside the window, oldest first.
 *
 * Also the read path: nothing outside this function decides what "still valid"
 * means, so a stored file that has been sitting on a phone for a month renders
 * as nothing rather than as three-week-old advice presented as current.
 *
 * A stamp that will not parse is dropped: it has no age, so it can never be
 * retired, and a line that outlives every window is worse than a missing one.
 * A future-dated stamp is kept — that is a clock that moved, not a stale
 * entry, which is the same call lib/coachChatMemory makes for its own window.
 */
export function activeCoachAdviceMemory(
  memory: CoachAdviceMemoryEntry[] | null | undefined,
  nowIso: string,
): CoachAdviceMemoryEntry[] {
  if (!memory || memory.length === 0) {
    return [];
  }
  const now = Date.parse(nowIso);
  if (!Number.isFinite(now)) {
    return [];
  }
  return memory.filter((entry) => {
    const at = Date.parse(entry.at);
    if (!Number.isFinite(at)) {
      return false;
    }
    const age = calendarDaysBetween(at, now);
    return age <= COACH_ADVICE_MEMORY_DAYS;
  });
}

/**
 * The memory after one more answer.
 *
 * Expiry runs on every write rather than on a schedule: the only moment this
 * file changes is when an answer arrives, so that is the only moment it needs
 * pruning, and a phone that never opens the coach again never carries a stale
 * block into a request it does not make.
 */
export function rememberCoachAdvice(
  memory: CoachAdviceMemoryEntry[] | null | undefined,
  takeaway: string,
  nowIso: string,
): CoachAdviceMemoryEntry[] {
  const condensed = condense(takeaway);
  if (!condensed) {
    return activeCoachAdviceMemory(memory, nowIso);
  }

  const kept = activeCoachAdviceMemory(memory, nowIso).filter(
    (entry) => !sameAdvice(entry.takeaway, condensed),
  );

  return [...kept, { at: nowIso, takeaway: condensed }].slice(-MAX_COACH_ADVICE_MEMORY_ENTRIES);
}

/**
 * Two lists of the same memory, made one.
 *
 * Needed for exactly one race: an answer recorded before the stored file has
 * finished loading. Assigning the file over the recorded entry loses the
 * answer, and keeping the recorded entry alone loses the file — so both go in,
 * ordered by when they were given, and the same dedupe, expiry and cap the
 * single-entry path applies are applied to the result.
 */
export function mergeCoachAdviceMemory(
  stored: CoachAdviceMemoryEntry[] | null | undefined,
  recorded: CoachAdviceMemoryEntry[] | null | undefined,
  nowIso: string,
): CoachAdviceMemoryEntry[] {
  const combined = [...(stored ?? []), ...(recorded ?? [])].sort(
    (left, right) => Date.parse(left.at) - Date.parse(right.at),
  );
  const deduped: CoachAdviceMemoryEntry[] = [];
  combined.forEach((entry) => {
    // Ascending order means a later duplicate replaces an earlier one, which is
    // the same "keep the newer date" rule rememberCoachAdvice applies.
    const existing = deduped.findIndex((kept) => sameAdvice(kept.takeaway, entry.takeaway));
    if (existing >= 0) {
      deduped.splice(existing, 1);
    }
    deduped.push(entry);
  });
  return activeCoachAdviceMemory(deduped, nowIso).slice(-MAX_COACH_ADVICE_MEMORY_ENTRIES);
}

/**
 * A stored file, made safe to use.
 *
 * src/storage/database.ts normalizes on load for the same reason this exists:
 * what is on the disk was written by an older build, or by a build that had a
 * bug, and a loader that trusts it is a crash on someone's install. Anything
 * that is not a usable entry is dropped rather than repaired — a memory with
 * one line missing is still a working memory.
 */
export function parseCoachAdviceMemory(raw: unknown): CoachAdviceMemoryEntry[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const entries: CoachAdviceMemoryEntry[] = [];
  raw.forEach((value) => {
    if (!value || typeof value !== 'object') {
      return;
    }
    const candidate = value as Partial<CoachAdviceMemoryEntry>;
    if (typeof candidate.at !== 'string' || !Number.isFinite(Date.parse(candidate.at))) {
      return;
    }
    if (typeof candidate.takeaway !== 'string') {
      return;
    }
    const condensed = condense(candidate.takeaway);
    if (!condensed) {
      return;
    }
    entries.push({ at: candidate.at, takeaway: condensed });
  });
  // A file written by a future build could hold more than this one sends.
  return entries.slice(-MAX_COACH_ADVICE_MEMORY_ENTRIES);
}

/**
 * The lines to send with a question, from the entries on the disk.
 *
 * Expiry runs here rather than being assumed: the file was last written when
 * the reader's last question was answered, which may have been long enough ago
 * that half of it has since aged out.
 */
export function buildCoachAdviceLines(
  memory: CoachAdviceMemoryEntry[] | null | undefined,
  nowIso: string,
): CoachAdviceMemoryLine[] {
  return activeCoachAdviceMemory(memory, nowIso).map((entry) => ({
    day: coachAdviceDateLabel(entry.at),
    takeaway: entry.takeaway,
  }));
}

/**
 * The same lines, arriving at the endpoint as whatever was posted.
 *
 * Re-parsed rather than trusted: the bound the device applies has to hold for
 * a request the device did not write. The date is checked for shape only —
 * what it means is the reader's business, and the model reads it as a label.
 */
export function parseCoachAdviceLines(raw: unknown): CoachAdviceMemoryLine[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const lines: CoachAdviceMemoryLine[] = [];
  raw.forEach((value) => {
    if (!value || typeof value !== 'object') {
      return;
    }
    const candidate = value as Partial<CoachAdviceMemoryLine>;
    if (typeof candidate.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(candidate.day)) {
      return;
    }
    if (typeof candidate.takeaway !== 'string') {
      return;
    }
    const condensed = condense(candidate.takeaway);
    if (!condensed) {
      return;
    }
    lines.push({ day: candidate.day, takeaway: condensed });
  });
  return lines.slice(-MAX_COACH_ADVICE_MEMORY_ENTRIES);
}
