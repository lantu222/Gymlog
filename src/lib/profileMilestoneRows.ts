import { t } from './i18n';
import { LifetimeTrainingSummary } from './lifetimeSummary';
import { ProfileMilestone, buildProfileMilestones, hasMilestoneData, volumeInUnit } from './profileMilestones';
import { AppLanguage, UnitPreference } from '../types/models';

/**
 * A NEXT MILESTONE row as the screen prints it: title, the remainder in the
 * corner, the bar's fill, and the meta line with the raw numbers.
 *
 * Copy is a distance, not a promise: "6 kg to go" is what is left, "994 kg
 * of 1 000 kg" is what was done. Nothing here says what the reader will
 * gain.
 */
export interface ProfileMilestoneRow {
  key: string;
  title: string;
  /** Empty for the first-session row, which has nothing to count down. */
  remainder: string;
  /** 4–100: an empty bar is still a bar, at four percent; zero data is zero. */
  fillPercent: number;
  meta: string;
}

/** "1 000 kg", "2 500 lb" — whole numbers, thousands grouped with a space. */
export function formatMilestoneVolume(value: number, unitPreference: UnitPreference): string {
  const whole = Math.round(Math.max(0, value));
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${grouped} ${unitPreference === 'lb' ? 'lb' : 'kg'}`;
}

function fillPercent(progress: number): number {
  return Math.max(4, Math.min(100, Math.round(progress * 100)));
}

export function buildProfileMilestoneRows(input: {
  lifetime: LifetimeTrainingSummary;
  recordCount: number;
  unitPreference: UnitPreference;
  language: AppLanguage;
}): ProfileMilestoneRow[] {
  const { lifetime, recordCount, unitPreference, language } = input;
  if (!hasMilestoneData({ lifetime })) {
    return [
      {
        key: 'first',
        title: t(language, 'profile.milestone.first.title'),
        remainder: '',
        fillPercent: 0,
        meta: t(language, 'profile.milestone.first.meta'),
      },
    ];
  }

  return buildProfileMilestones({ lifetime, recordCount, unitPreference }).map((item) => describe(item, input));
}

function describe(
  item: ProfileMilestone,
  input: { lifetime: LifetimeTrainingSummary; unitPreference: UnitPreference; language: AppLanguage },
): ProfileMilestoneRow {
  const { language, unitPreference, lifetime } = input;
  const key = `${item.family}-${item.target}`;
  switch (item.family) {
    case 'volume': {
      const current = volumeInUnit(lifetime.totalVolumeKg, unitPreference);
      return {
        key,
        title: t(language, 'profile.milestone.volume.title', { target: formatMilestoneVolume(item.target, unitPreference) }),
        remainder: t(language, 'profile.milestone.volume.toGo', {
          amount: formatMilestoneVolume(item.remaining, unitPreference),
        }),
        fillPercent: fillPercent(item.progress),
        meta: t(language, 'profile.milestone.volume.meta', {
          current: formatMilestoneVolume(current, unitPreference),
          target: formatMilestoneVolume(item.target, unitPreference),
        }),
      };
    }
    case 'sessions':
      return {
        key,
        title: t(language, 'profile.milestone.sessions.title', { target: item.target }),
        remainder: t(language, 'profile.milestone.toGo', { count: item.remaining }),
        fillPercent: fillPercent(item.progress),
        meta:
          lifetime.weeksSinceStart <= 1
            ? t(language, 'profile.milestone.sessions.metaOneWeek', { current: item.current, target: item.target })
            : t(language, 'profile.milestone.sessions.meta', {
                current: item.current,
                target: item.target,
                // "started N weeks ago": the weeks before this one.
                weeks: lifetime.weeksSinceStart - 1,
              }),
      };
    case 'streak':
      return {
        key,
        title: t(language, 'profile.milestone.streak.title', { target: item.target }),
        remainder: t(language, 'profile.milestone.toGo', { count: item.remaining }),
        fillPercent: fillPercent(item.progress),
        meta: t(language, 'profile.milestone.streak.meta', { best: lifetime.bestWeekStreak }),
      };
    case 'records':
      return {
        key,
        title: t(language, 'profile.milestone.records.title', { target: item.target }),
        remainder: t(language, 'profile.milestone.toGo', { count: item.remaining }),
        fillPercent: fillPercent(item.progress),
        meta: t(language, 'profile.milestone.records.meta', { current: item.current, target: item.target }),
      };
  }
}
