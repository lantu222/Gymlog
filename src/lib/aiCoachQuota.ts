/**
 * Who may ask the coach, how often, and what happens when they may not.
 *
 * The shape changed on 2026-08-29, and the reason is arithmetic rather than
 * product taste. One coach question costs about $0.027 at the heaviest
 * measured context (scripts/simulate-coach-cost.cjs, Sonnet 5). The free tier
 * used to grant three a week — 13 a month, ~$0.35 per free user per month,
 * which is roughly what a typical PAYING user costs. At any real install count
 * that is not a conversion cost, it is the largest variable cost in the app,
 * and it is spent on the people who are not paying for it.
 *
 * Worse, the ceiling is shared: the Anthropic Console spend limit is one
 * number for the whole app, so free usage could exhaust the budget that
 * paying users depend on. A non-payer being able to break a payer's product
 * is the one failure this design will not accept.
 *
 * So:
 *
 * - FREE asks nothing of its own accord. What a free reader gets instead is
 *   three coach answers at moments the app chooses (lib/coachDemoMoments),
 *   each one costing a single question and landing when there is enough log
 *   behind it to answer well. Three per install, ever — an acquisition cost,
 *   not a running one.
 * - PRO gets 25 a month. Not unlimited: lifetime buyers pay once and consume
 *   forever, so the cap is what keeps that arithmetic from inverting.
 *
 * The window is a calendar month, compared rather than timed, so nothing here
 * needs a clock and a phone that sleeps through midnight still resets.
 */

/** What a Pro membership includes each calendar month. */
export const PRO_COACH_QUESTIONS_PER_MONTH = 25;

export interface CoachQuotaState {
  /** First day of the counted month, YYYY-MM. */
  monthStart: string;
  used: number;
}

/** The month containing `now`, as YYYY-MM in local time. */
export function coachQuotaMonthStart(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${now.getFullYear()}-${month}`;
}

/**
 * When the allowance comes back, and how far away that is.
 *
 * Days are counted between local midnights, so a question asked at 23:55 on
 * the last day of the month still reports one day rather than none.
 */
export function coachQuotaReset(now: Date = new Date()): { at: Date; inDays: number } {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const at = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const inDays = Math.max(1, Math.round((at.getTime() - today.getTime()) / 86_400_000));
  return { at, inDays };
}

export function resolveCoachQuota(
  state: CoachQuotaState | null | undefined,
  now: Date = new Date(),
): { monthStart: string; used: number; remaining: number } {
  const monthStart = coachQuotaMonthStart(now);
  const used = state && state.monthStart === monthStart ? Math.max(0, state.used) : 0;
  return {
    monthStart,
    used,
    remaining: Math.max(0, PRO_COACH_QUESTIONS_PER_MONTH - used),
  };
}

export function recordCoachQuestion(
  state: CoachQuotaState | null | undefined,
  now: Date = new Date(),
): CoachQuotaState {
  const current = resolveCoachQuota(state, now);
  return { monthStart: current.monthStart, used: current.used + 1 };
}
