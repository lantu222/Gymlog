import { t } from './i18n';
import { AppLanguage } from '../types/models';

const DEFAULT_HOME_PLAN_TOTAL_WEEKS = 8;

export interface HomePlanProgressInput {
  completedSessions: number;
  sessionsPerWeek: number;
  totalWeeks?: number;
  language?: AppLanguage;
}

export interface HomePlanProgress {
  weekLabel: string;
  progressPercent: number;
  weekProgressLabel: string;
  weekProgressPercent: number;
  currentWeek: number;
  totalWeeks: number;
  sessionsDone: number;
  sessionsTotal: number;
}

export function buildHomePlanProgress({
  completedSessions,
  sessionsPerWeek,
  totalWeeks = DEFAULT_HOME_PLAN_TOTAL_WEEKS,
  language = 'en',
}: HomePlanProgressInput): HomePlanProgress {
  const safeSessionsPerWeek = Math.max(1, Math.round(sessionsPerWeek));
  const safeTotalWeeks = Math.max(1, Math.round(totalWeeks));
  const completedCount = Math.max(0, completedSessions);
  const totalPlannedSessions = safeSessionsPerWeek * safeTotalWeeks;
  const currentWeek = Math.min(safeTotalWeeks, Math.floor(completedCount / safeSessionsPerWeek) + 1);
  const rawProgressPercent = Math.round((completedCount / totalPlannedSessions) * 100);
  const progressPercent = Math.min(100, Math.max(1, rawProgressPercent));
  // Sessions done within the current week; a fully completed plan shows the
  // final week as full rather than rolling over to 0.
  const doneThisWeek =
    completedCount >= totalPlannedSessions ? safeSessionsPerWeek : completedCount % safeSessionsPerWeek;
  const weekProgressPercent = Math.round((doneThisWeek / safeSessionsPerWeek) * 100);

  return {
    weekLabel: t(language, 'plan.weekOf', { week: currentWeek, total: safeTotalWeeks }),
    progressPercent,
    weekProgressLabel: t(language, 'plan.weekProgress', {
      week: currentWeek,
      done: doneThisWeek,
      total: safeSessionsPerWeek,
    }),
    weekProgressPercent,
    currentWeek,
    totalWeeks: safeTotalWeeks,
    // Plan-wide session counts for the Home v4 hero ("0 of 24 sessions").
    sessionsDone: Math.min(completedCount, totalPlannedSessions),
    sessionsTotal: totalPlannedSessions,
  };
}

/**
 * The week the session that was just logged belongs to.
 *
 * `currentWeek` is the week the reader is IN, and the moment the last session
 * of a week is saved that is already the next one — so the summary for the
 * third session of week 1 read "WEEK 2 · 3/3", a week label over a count that
 * belongs to the week before it. The summary is about the session that was
 * logged, so it names the week that session filled. The finish view, which
 * renders before the save, still asks for `currentWeek`: there the session is
 * not in the log yet and the reader is genuinely still in that week.
 */
export function weekOfLastLoggedSession({
  sessionsDone,
  sessionsTotal,
  totalWeeks,
}: {
  sessionsDone: number;
  sessionsTotal: number;
  totalWeeks: number;
}): number {
  const weeks = Math.max(1, Math.round(totalWeeks));
  const perWeek = Math.max(1, Math.round(sessionsTotal / weeks));
  const done = Math.max(0, Math.round(sessionsDone));
  if (done === 0) {
    return 1;
  }

  return Math.min(weeks, Math.floor((done - 1) / perWeek) + 1);
}
