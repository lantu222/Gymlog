import { t } from './i18n';
import { AppLanguage } from '../types/models';

/**
 * Adding and removing whole days of a custom programme.
 *
 * The page offered two things to do with a programme: change a day, or delete
 * the whole programme. "Yhtä päivää ei voi lisätä eikä poistaa" — the reader
 * wanted a three-way split out of a five-day programme and had no way to get
 * there short of starting over (#bugs 2026-09-24).
 *
 * Two rules come from the rest of the app rather than from this feature:
 *
 * - A programme with an empty day is not a programme. The template editor
 *   will not save one, and the day page refuses to remove a day's last lift.
 *   So a day is added WITH its lifts, in one write, and never exists empty.
 * - A programme has at least one day. Removing the last one would be deleting
 *   the programme, which has its own button and its own question.
 */

/** Only the fields these read. Stored sessions carry more. */
export interface ListedSession {
  id: string;
  orderIndex: number;
}

export type RemoveProgramSessionOutcome<T> =
  | { kind: 'skip'; reason: 'sessionMissing' | 'lastSession' }
  | { kind: 'removed'; sessions: T[] };

export function removeProgramSession<T extends ListedSession>(
  sessions: ReadonlyArray<T>,
  sessionId: string,
): RemoveProgramSessionOutcome<T> {
  // Position is read from orderIndex, the same way the reorder reads it.
  const ordered = [...sessions].sort((left, right) => left.orderIndex - right.orderIndex);
  if (!ordered.some((session) => session.id === sessionId)) {
    return { kind: 'skip', reason: 'sessionMissing' };
  }
  if (ordered.length <= 1) {
    return { kind: 'skip', reason: 'lastSession' };
  }
  return {
    kind: 'removed',
    // Re-numbered from where the rows now sit, so the stored order has no gap.
    sessions: ordered
      .filter((session) => session.id !== sessionId)
      .map((session, orderIndex) => ({ ...session, orderIndex })),
  };
}

/**
 * A new day's stored name: the placeholder the template editor writes, "Päivä
 * N" in the reader's language. The day list prints a placeholder as "Treeni N"
 * by position, and Home names it from its lifts — both already know this
 * shape, so a new day reads like any other unnamed one until it is renamed.
 */
export function newProgramSessionName(existingCount: number, language: AppLanguage): string {
  return t(language, 'tpl.day', { index: Math.max(0, Math.floor(existingCount)) + 1 });
}
