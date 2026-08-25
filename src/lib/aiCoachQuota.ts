/**
 * The free coach quota (design: Vinha Pro Page, table row "AI Coach — 3 / wk").
 *
 * The Pro page promises free users three coach questions a week, so this makes
 * the promise true rather than letting the table lie. The week key is the local
 * Monday; the counter lives in preferences and resets by comparison, never by a
 * timer. Pure so the arithmetic is testable without a clock.
 */

export const FREE_COACH_QUESTIONS_PER_WEEK = 3;

export interface CoachQuotaState {
  /** Local Monday of the counted week, YYYY-MM-DD. */
  weekStart: string;
  used: number;
}

/** Local Monday of the week containing `now`, as YYYY-MM-DD. */
export function coachQuotaWeekStart(now: Date = new Date()): string {
  const local = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = local.getDay(); // 0 = Sunday
  const sinceMonday = (day + 6) % 7;
  local.setDate(local.getDate() - sinceMonday);
  const month = String(local.getMonth() + 1).padStart(2, '0');
  const date = String(local.getDate()).padStart(2, '0');
  return `${local.getFullYear()}-${month}-${date}`;
}

/**
 * When the free questions come back, and how far away that is.
 *
 * The line under an empty quota used to say "your 3 free questions reset on
 * Monday" — the number you started with, and a weekday that could be tomorrow
 * or six days out. Neither is what someone out of questions wants to know
 * (user, 2026-08-25).
 *
 * Days are counted between local midnights, so a question asked at 23:55 on
 * Sunday still reports one day rather than none.
 */
export function coachQuotaReset(now: Date = new Date()): { at: Date; inDays: number } {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = today.getDay(); // 0 = Sunday
  const untilMonday = day === 1 ? 7 : (8 - day) % 7;
  const at = new Date(today.getFullYear(), today.getMonth(), today.getDate() + untilMonday);
  return { at, inDays: untilMonday };
}

export function resolveCoachQuota(
  state: CoachQuotaState | null | undefined,
  now: Date = new Date(),
): { weekStart: string; used: number; remaining: number } {
  const weekStart = coachQuotaWeekStart(now);
  const used = state && state.weekStart === weekStart ? Math.max(0, state.used) : 0;
  return {
    weekStart,
    used,
    remaining: Math.max(0, FREE_COACH_QUESTIONS_PER_WEEK - used),
  };
}

export function recordCoachQuestion(
  state: CoachQuotaState | null | undefined,
  now: Date = new Date(),
): CoachQuotaState {
  const current = resolveCoachQuota(state, now);
  return { weekStart: current.weekStart, used: current.used + 1 };
}
