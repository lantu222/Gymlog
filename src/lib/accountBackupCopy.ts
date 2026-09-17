/**
 * The words of the restore-or-keep question, built here so a test can read
 * them: both sides' contents, the date in the app's language, and the second
 * question that guards "Use the data on this phone".
 */
import type { AppLanguage } from '../types/models';
import type { BackupContents, RestoreChoiceSummary } from './accountBackup';
import { formatDateNumeric } from './format';
import { I18nKey, t } from './i18n';

export interface RestoreQuestionCopy {
  title: string;
  body: string;
  keepLocal: string;
  useBackup: string;
  /**
   * Asked after "Use the data on this phone" when that choice would replace
   * a cloud copy holding far more (keepingLocalShrinksCloud); null otherwise.
   */
  replace: { title: string; body: string; confirm: string; back: string } | null;
}

function count(value: number, language: AppLanguage, many: I18nKey, one: I18nKey): string {
  return value === 1 ? t(language, one) : t(language, many, { count: value });
}

/**
 * Everything one side holds, named, and the same list for both sides. The
 * shrink line that raises the second question counts weigh-ins, cardio and
 * measurements too, so naming workouts alone made a backup of three hundred
 * weigh-ins read "0 workouts" — and a phone of them read as empty beside it.
 */
function contentsList(contents: BackupContents & { workoutInProgress?: boolean }, language: AppLanguage): string {
  const parts = [
    contents.workoutCount > 0 ? count(contents.workoutCount, language, 'account.count.workouts', 'account.count.workouts.one') : null,
    // Built and adopted alike: to the reader both are "my programmes".
    contents.customProgramCount + contents.readyProgramCount > 0
      ? count(contents.customProgramCount + contents.readyProgramCount, language, 'account.count.programs', 'account.count.programs.one')
      : null,
    contents.cardioCount > 0 ? count(contents.cardioCount, language, 'account.count.cardio', 'account.count.cardio.one') : null,
    contents.bodyweightCount > 0
      ? count(contents.bodyweightCount, language, 'account.count.weighIns', 'account.count.weighIns.one')
      : null,
    contents.measurementCount > 0
      ? count(contents.measurementCount, language, 'account.count.measurements', 'account.count.measurements.one')
      : null,
    // Restoring puts it away, so it is on the scale with the rest.
    contents.workoutInProgress ? t(language, 'account.count.inProgress') : null,
  ].filter((part): part is string => part !== null);
  return parts.length > 0 ? parts.join(', ') : t(language, 'account.count.workouts', { count: 0 });
}

export function restoreQuestionCopy(summary: RestoreChoiceSummary, language: AppLanguage): RestoreQuestionCopy {
  const contents = {
    cloudContents: contentsList(summary.cloud, language),
    localContents: contentsList(summary.local, language),
  };
  return {
    title: t(language, 'account.restore.title'),
    body: t(language, 'account.restore.body', {
      // The app's language, not the phone's: toLocaleDateString() wrote an
      // English phone's "9/12/2026" into a Finnish sentence.
      date: formatDateNumeric(new Date(summary.cloud.exportedAt), language),
      ...contents,
    }),
    keepLocal: t(language, 'account.restore.keepLocal'),
    useBackup: t(language, 'account.restore.useBackup'),
    replace: summary.keepingLocalShrinksCloud
      ? {
          title: t(language, 'account.restore.replace.title'),
          body: t(language, 'account.restore.replace.body', contents),
          confirm: t(language, 'account.restore.replace.confirm'),
          back: t(language, 'common.back'),
        }
      : null,
  };
}
