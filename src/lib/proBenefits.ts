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
 * The unlock moment's cards, defined next to the list they announce.
 *
 * The unlock screen used to carry its own parallel card list, and that is how
 * it kept selling the adaptive set coach for a day after the feature was
 * deleted — the removal sweep cleaned every surface that read from here and
 * missed the one that did not. Each card names the benefits it covers, and the
 * test asserts the union of `gates` equals PRO_LIVE_BENEFITS exactly: remove a
 * benefit and the card announcing it fails loudly instead of lying quietly.
 */
export interface ProUnlockCard {
  titleKey: I18nKey;
  bodyKey: I18nKey;
  /** Where the feature lives, so "what happens next" answers itself. */
  placeKey: I18nKey;
  /** titleKeys of the PRO_LIVE_BENEFITS entries this card announces. */
  gates: I18nKey[];
}

export const PRO_UNLOCK_CARDS: ProUnlockCard[] = [
  {
    titleKey: 'unlock.progression.t',
    bodyKey: 'unlock.progression.b',
    placeKey: 'unlock.progression.to',
    gates: ['pro.v2.coach.progression.t'],
  },
  {
    titleKey: 'unlock.ai.t',
    bodyKey: 'unlock.ai.b',
    placeKey: 'unlock.ai.to',
    gates: ['pro.v2.plan.coach.t', 'pro.v2.plan.builder.t'],
  },
  {
    titleKey: 'unlock.reads.t',
    bodyKey: 'unlock.reads.b',
    placeKey: 'unlock.reads.to',
    gates: ['pro.v2.read.analysis.t', 'pro.v2.read.why.t', 'pro.v2.read.recovery.t'],
  },
  {
    titleKey: 'unlock.theme.t',
    bodyKey: 'unlock.theme.b',
    placeKey: 'unlock.theme.to',
    gates: ['pro.v2.read.theme.t'],
  },
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
