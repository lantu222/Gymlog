import { WorkoutSession } from '../types/models';

/**
 * "Jatka siitä mihin jäit" — programs with logged work that are not the one
 * running now.
 *
 * The browse design had this row and I skipped it, which was the wrong call:
 * it is the only row on the page whose contents the reader has already chosen
 * once, and a browse screen that cannot show you your own half-finished work is
 * a catalog, not a home.
 *
 * The row is built from completed sessions, never from "programs you tapped".
 * A program you opened and closed is not something you left off — it is
 * something you looked at. So the source is `workoutSessions`: real logged
 * work, most recently trained first.
 *
 * It is empty for a new install, and the row disappears rather than filling
 * with suggestions. "Continue" with nothing to continue is the seed-data lie
 * this project already removed once.
 */

export interface ContinueEntry {
  templateId: string;
  /** Sessions logged against this program, ever. */
  sessionCount: number;
  /** ISO timestamp of the most recent one — the sort key, and the copy. */
  lastPerformedAt: string;
  /** Days since that session, floored. Drives "3 päivää sitten". */
  daysSince: number;
}

/**
 * Programs to offer continuing, newest first.
 *
 * `excludeTemplateId` is the active program: it already has the hero and the
 * whole week at the top of the screen, and offering it again two rows down
 * makes the page look like it does not know what you are doing.
 */
export function resolveContinueEntries(
  sessions: readonly WorkoutSession[],
  options: {
    excludeTemplateId?: string | null;
    now?: Date;
    limit?: number;
  } = {},
): ContinueEntry[] {
  const { excludeTemplateId = null, now = new Date(), limit = 6 } = options;

  const byTemplate = new Map<string, { count: number; last: number; lastIso: string }>();
  for (const session of sessions) {
    const templateId = session.workoutTemplateId;
    if (!templateId || templateId === excludeTemplateId) {
      continue;
    }
    const stamp = Date.parse(session.performedAt);
    if (!Number.isFinite(stamp)) {
      // A corrupt timestamp cannot be sorted or counted against; dropping the
      // row is better than sorting the whole list by NaN.
      continue;
    }
    const existing = byTemplate.get(templateId);
    if (!existing) {
      byTemplate.set(templateId, { count: 1, last: stamp, lastIso: session.performedAt });
    } else {
      existing.count += 1;
      if (stamp > existing.last) {
        existing.last = stamp;
        existing.lastIso = session.performedAt;
      }
    }
  }

  const today = now.getTime();
  return [...byTemplate.entries()]
    .map(([templateId, entry]) => ({
      templateId,
      sessionCount: entry.count,
      lastPerformedAt: entry.lastIso,
      daysSince: Math.max(0, Math.floor((today - entry.last) / 86_400_000)),
    }))
    .sort((left, right) => Date.parse(right.lastPerformedAt) - Date.parse(left.lastPerformedAt))
    .slice(0, Math.max(0, limit));
}
