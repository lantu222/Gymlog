const DEFAULT_HOME_PLAN_TOTAL_WEEKS = 8;

export interface HomePlanProgressInput {
  completedSessions: number;
  sessionsPerWeek: number;
  totalWeeks?: number;
}

export interface HomePlanProgress {
  weekLabel: string;
  progressPercent: number;
}

export function buildHomePlanProgress({
  completedSessions,
  sessionsPerWeek,
  totalWeeks = DEFAULT_HOME_PLAN_TOTAL_WEEKS,
}: HomePlanProgressInput): HomePlanProgress {
  const safeSessionsPerWeek = Math.max(1, Math.round(sessionsPerWeek));
  const safeTotalWeeks = Math.max(1, Math.round(totalWeeks));
  const completedCount = Math.max(0, completedSessions);
  const totalPlannedSessions = safeSessionsPerWeek * safeTotalWeeks;
  const currentWeek = Math.min(safeTotalWeeks, Math.floor(completedCount / safeSessionsPerWeek) + 1);
  const rawProgressPercent = Math.round((completedCount / totalPlannedSessions) * 100);
  const progressPercent = Math.min(100, Math.max(1, rawProgressPercent));

  return {
    weekLabel: `Week ${currentWeek} of ${safeTotalWeeks}`,
    progressPercent,
  };
}
