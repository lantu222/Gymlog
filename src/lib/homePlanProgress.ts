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
