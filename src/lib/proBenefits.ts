import { I18nKey } from './i18n';

/**
 * What Pro actually gives you today — the live half of the Pro page.
 *
 * This exists so the "what you lose" screen cannot invent a loss. Every entry
 * here is a benefit the code really gates: strike through something the app
 * never enforced and the screen becomes a threat about nothing, which is worse
 * than not showing it at all. Items the Pro page marks SOON are deliberately
 * absent — you cannot lose what you never had.
 *
 * The keys are the Pro page's own, and tests/lib/proBenefits pins every one of
 * them to a GROUPS entry with no `soon` flag. When a SOON feature ships, add it
 * in both places; when a gate is removed, this list has to shrink with it.
 */
export interface ProBenefit {
  titleKey: I18nKey;
  bodyKey: I18nKey;
  /** The module that enforces it, so the claim can be checked against code. */
  gate: string;
}

export const PRO_LIVE_BENEFITS: ProBenefit[] = [
  {
    titleKey: 'pro.v2.coach.progression.t',
    bodyKey: 'pro.v2.coach.progression.b',
    gate: 'resolveProgressionOptions',
  },
  { titleKey: 'pro.v2.plan.coach.t', bodyKey: 'pro.v2.plan.coach.b', gate: 'aiCoachQuota' },
  { titleKey: 'pro.v2.plan.builder.t', bodyKey: 'pro.v2.plan.builder.b', gate: 'coachProUnlocked' },
  { titleKey: 'pro.v2.read.analysis.t', bodyKey: 'pro.v2.read.analysis.b', gate: 'coachProUnlocked' },
  { titleKey: 'pro.v2.read.why.t', bodyKey: 'pro.v2.read.why.b', gate: 'proInsights' },
  { titleKey: 'pro.v2.read.recovery.t', bodyKey: 'pro.v2.read.recovery.b', gate: 'proInsights' },
  { titleKey: 'pro.v2.read.theme.t', bodyKey: 'pro.v2.read.theme.b', gate: 'resolveThemeName' },
];

/**
 * How Pro is being kept on, which decides what "ending it" can honestly offer.
 *
 * A promo cannot be cancelled — it runs out. The demo switch can be flipped
 * back. A paid subscription would be neither: it lives in the store. Modelling
 * this as one enum keeps the screen from offering a button that does nothing.
 */
export type MembershipSource = 'promo' | 'preview' | 'none';

export interface MembershipEndPlan {
  /** True when the user can end Pro from inside the app, right now. */
  canEndNow: boolean;
  /** ISO date it lapses on its own; null when nothing is scheduled. */
  lapsesOn: string | null;
}

export function resolveMembershipEndPlan(
  source: MembershipSource,
  promoUntil: string | null,
): MembershipEndPlan {
  if (source === 'promo') {
    return { canEndNow: false, lapsesOn: promoUntil };
  }
  if (source === 'preview') {
    return { canEndNow: true, lapsesOn: null };
  }
  return { canEndNow: false, lapsesOn: null };
}
