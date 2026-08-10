import { getComparableLogSets } from './exerciseLog';
import { t } from './i18n';
import { ExerciseLogWithSession, ExerciseProgressSummary } from './progression';
import { AppLanguage } from '../types/models';

/**
 * Profile home data.
 *
 * The record LIST used to live here too. It moved to the Records tab, which
 * has three kinds, month groups and a Pro window — and keeping a second,
 * thinner copy meant two definitions of "a record" and two numbers that could
 * disagree. What is left is the shared top-set reader and the "when" label.
 */

const DAY_MS = 86_400_000;

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
