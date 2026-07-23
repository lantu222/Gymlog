import { getComparableLogSets } from './exerciseLog';
import { t } from './i18n';
import { ExerciseLogWithSession, ExerciseProgressSummary } from './progression';
import { AppLanguage } from '../types/models';

/**
 * Profile home data: the identity stat trio and the personal-record rows.
 *
 * Both live here (not in the screen) so the counting rules are explicit and
 * testable. The rules are deliberately conservative — a stat the user cannot
 * reconstruct from their own history would be a lie on the most personal
 * screen in the app.
 */

export interface ProfilePersonalRecord {
  key: string;
  name: string;
  /** Heaviest comparable set ever logged for this lift, in kg. */
  weightKg: number;
  /** Reps performed in the heaviest set of the session that set the record. */
  reps: number;
  /** ISO timestamp of the session where the record was first reached. */
  achievedAt: string;
}

export function getTopComparableSet(log: Pick<ExerciseLogWithSession, 'weight' | 'repsPerSet' | 'sets' | 'skipped'>) {
  const sets = getComparableLogSets(log);
  if (sets.length === 0) {
    return null;
  }

  return sets.reduce((best, set) => {
    if (set.weight > best.weight) {
      return set;
    }
    // Same load, more reps is the better set.
    if (set.weight === best.weight && set.reps > best.reps) {
      return set;
    }
    return best;
  });
}

function sortLogsOldestFirst(logs: ExerciseLogWithSession[]) {
  return [...logs].sort(
    (left, right) => new Date(left.performedAt).getTime() - new Date(right.performedAt).getTime(),
  );
}

/**
 * A personal record is an improvement over a previous best — the first time a
 * lift is logged is a starting point, not a record. Counting the first entry
 * would hand every new user a pile of "PRs" they never earned.
 */
export function countPersonalRecords(trackedProgress: ExerciseProgressSummary[]): number {
  let total = 0;

  for (const summary of trackedProgress) {
    let best: number | null = null;

    for (const log of sortLogsOldestFirst(summary.logs)) {
      const topSet = getTopComparableSet(log);
      if (topSet === null) {
        continue;
      }

      if (best !== null && topSet.weight > best) {
        total += 1;
      }

      if (best === null || topSet.weight > best) {
        best = topSet.weight;
      }
    }
  }

  return total;
}

/**
 * Heaviest lifts, best first. `achievedAt` is the FIRST session that reached
 * the weight — that is the day the record was set; re-hitting it later does not
 * move the date.
 */
export function buildProfilePersonalRecords(
  trackedProgress: ExerciseProgressSummary[],
  limit = 3,
): ProfilePersonalRecord[] {
  const records: ProfilePersonalRecord[] = [];

  for (const summary of trackedProgress) {
    let record: ProfilePersonalRecord | null = null;

    for (const log of sortLogsOldestFirst(summary.logs)) {
      const topSet = getTopComparableSet(log);
      if (topSet === null || topSet.weight <= 0) {
        continue;
      }

      if (record === null || topSet.weight > record.weightKg) {
        record = {
          key: summary.key,
          name: summary.name,
          weightKg: topSet.weight,
          reps: topSet.reps,
          achievedAt: log.performedAt,
        };
      }
    }

    if (record !== null) {
      records.push(record);
    }
  }

  return records.sort((left, right) => right.weightKg - left.weightKg).slice(0, Math.max(0, limit));
}

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
}

/**
 * "Today" / "Yesterday" / "3 days ago" / "12 Jul" — calendar-day based, so a
 * session logged at 23:50 last night reads "Yesterday" rather than "0 days ago".
 * Finnish renders the same tiers as "Tänään" / "Eilen" / "3 pv sitten" / "12.7."
 */
export function formatRecordWhenLabel(iso: string, now: Date = new Date(), language: AppLanguage = 'en'): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const dayDelta = Math.round((startOfDay(now) - startOfDay(date)) / DAY_MS);

  if (dayDelta <= 0) {
    return t(language, 'common.today');
  }
  if (dayDelta === 1) {
    return t(language, 'common.yesterday');
  }
  if (dayDelta < 7) {
    return t(language, 'common.daysAgo', { count: dayDelta });
  }

  if (language === 'fi') {
    return `${date.getDate()}.${date.getMonth() + 1}.`;
  }

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${date.getDate()} ${months[date.getMonth()]}`;
}
