import { I18nKey } from './i18n';

/**
 * The carousel under "Aloita treeni".
 *
 * Every slide is an offer, and every offer has to be true when it is shown:
 * a season that is actually running, a programme that actually exists and is
 * not already the one you train, a target you have the lifts to set. A promo
 * strip that advertises something the app cannot deliver is the seed-data lie
 * with a swipe gesture on it.
 *
 * So the slides are built from state, not from a fixed list, and each one
 * disappears the moment its reason does — including "you already did this".
 */

export type HomePromoKind = 'season' | 'program' | 'goal';

export interface HomePromoSlide {
  kind: HomePromoKind;
  /** Eyebrow above the headline. */
  eyebrowKey: I18nKey;
  /** Filled by the caller for the programme slide; the others carry none. */
  title: string;
  bodyKey: I18nKey;
  bodyVars?: Record<string, string | number>;
  ctaKey: I18nKey;
  /** Programme slide only — what the tap opens. */
  templateId?: string;
}

export interface HomePromoInput {
  season: {
    /** 'summer' | 'winter' — chooses the wording, never invented. */
    kind: 'summer' | 'winter';
    weeksLeft: number;
    /** True once the reader runs the season's programme. */
    joined: boolean;
  } | null;
  /**
   * One recommendation worth showing, already filtered by the caller to
   * exclude programmes the reader is running.
   */
  recommendation: { templateId: string; title: string } | null;
  /** Strength targets the reader has set. */
  goalCount: number;
  /** Lifts with logged work — a target is measured from your own best set. */
  trackedLiftCount: number;
}

const SEASON_EYEBROW: Record<'summer' | 'winter', I18nKey> = {
  summer: 'home.promo.season.summer',
  winter: 'home.promo.season.winter',
};

export function buildHomePromoSlides(input: HomePromoInput): HomePromoSlide[] {
  const slides: HomePromoSlide[] = [];

  // A season the reader has already joined is not news. The scoreboard lives
  // on the season screen, and repeating it here would be a second, worse copy.
  if (input.season && !input.season.joined && input.season.weeksLeft > 0) {
    slides.push({
      kind: 'season',
      eyebrowKey: SEASON_EYEBROW[input.season.kind],
      title: '',
      bodyKey: 'home.promo.season.body',
      bodyVars: { weeks: input.season.weeksLeft },
      ctaKey: 'home.promo.season.cta',
    });
  }

  if (input.recommendation) {
    slides.push({
      kind: 'program',
      eyebrowKey: 'home.promo.program.eyebrow',
      title: input.recommendation.title,
      bodyKey: 'home.promo.program.body',
      ctaKey: 'home.promo.program.cta',
      templateId: input.recommendation.templateId,
    });
  }

  // A target is measured from your own best set, so there has to be one. With
  // no logged lifts the goal sheet can only ask for a number to compare
  // against nothing.
  if (input.goalCount === 0 && input.trackedLiftCount > 0) {
    slides.push({
      kind: 'goal',
      eyebrowKey: 'home.promo.goal.eyebrow',
      title: '',
      bodyKey: 'home.promo.goal.body',
      ctaKey: 'home.promo.goal.cta',
    });
  }

  return slides;
}
