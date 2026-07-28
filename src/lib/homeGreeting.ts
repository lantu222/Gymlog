import { I18nKey } from './i18n';

/**
 * Which greeting Home opens with.
 *
 * "Welcome back" was shown to everyone, including an account that had never
 * logged a single session — the app greeting a stranger like an old friend.
 * The state decides the line now, and the returning variants rotate so the
 * screen does not read like a static banner.
 *
 * Every claim has to be earned by the log: the streak line only appears when
 * the sessions are actually there, and "session logged" only after one today.
 * Nothing here invents a number.
 */
export interface HomeGreeting {
  titleKey: I18nKey;
  subtitleKey: I18nKey;
  /** Interpolation values for the title, when it takes any. */
  titleVars?: Record<string, string | number>;
}

export interface HomeGreetingInput {
  /** Sessions ever logged. Zero means this account has no history at all. */
  totalSessions: number;
  /** True when a session was already logged today. */
  trainedToday: boolean;
  /** Consecutive weeks with at least one session. */
  weekStreak: number;
  /**
   * Rotates the returning greeting. Callers pass something that changes per
   * day (a day number), not per render — a greeting that reshuffles while you
   * look at it reads as a glitch.
   */
  rotation: number;
}

const RETURNING: Array<{ titleKey: I18nKey; subtitleKey: I18nKey }> = [
  { titleKey: 'home.greet.back1.title', subtitleKey: 'home.greet.back1.sub' },
  { titleKey: 'home.greet.back2.title', subtitleKey: 'home.greet.back2.sub' },
  { titleKey: 'home.greet.back3.title', subtitleKey: 'home.greet.back3.sub' },
  { titleKey: 'home.greet.back4.title', subtitleKey: 'home.greet.back4.sub' },
  { titleKey: 'home.greet.back5.title', subtitleKey: 'home.greet.back5.sub' },
  { titleKey: 'home.greet.back6.title', subtitleKey: 'home.greet.back6.sub' },
];

/** A streak is only worth calling out once it is genuinely a streak. */
const STREAK_WEEKS_WORTH_SAYING = 3;

export function selectHomeGreeting({
  totalSessions,
  trainedToday,
  weekStreak,
  rotation,
}: HomeGreetingInput): HomeGreeting {
  if (totalSessions <= 0) {
    return { titleKey: 'home.greet.first.title', subtitleKey: 'home.greet.first.sub' };
  }

  if (trainedToday) {
    return { titleKey: 'home.greet.done.title', subtitleKey: 'home.greet.done.sub' };
  }

  if (weekStreak >= STREAK_WEEKS_WORTH_SAYING) {
    return {
      titleKey: 'home.greet.streak.title',
      subtitleKey: 'home.greet.streak.sub',
      titleVars: { count: weekStreak },
    };
  }

  const index = ((Math.trunc(rotation) % RETURNING.length) + RETURNING.length) % RETURNING.length;
  return RETURNING[index];
}

/** Days since the epoch — stable for a whole day, so the greeting is too. */
export function getGreetingRotation(now: Date = new Date()): number {
  return Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 86400000);
}
