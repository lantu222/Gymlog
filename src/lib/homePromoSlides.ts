import { I18nKey } from './i18n';

/**
 * The carousel under "Aloita treeni" (design: GAINER Kausikaruselli).
 *
 * Every slide is an offer, and every offer has to be true when it is shown:
 * a season that is actually running, a programme that actually exists and is
 * not already the one you train, a target you have the lifts to set. A promo
 * strip that advertises something the app cannot deliver is the seed-data lie
 * with a swipe gesture on it.
 *
 * So the slides are built from state, not from a fixed list, and each one
 * disappears the moment its reason does.
 *
 * What the design asked for and this file deliberately does NOT build: a
 * participant count ("1 480 mukana", "412 ilmoittautunut") and pre-registration
 * for the season that has not opened. There is no server and there are no other
 * users — a number under a season card would be invented, and "ilmoittaudu"
 * would promise a roster that nothing writes to. The card counts down instead,
 * which is calendar arithmetic and checkable.
 */

export type HomePromoKind = 'season' | 'program' | 'goal';

/** The season card's own numbers — all of them calendar arithmetic. */
export interface HomePromoSeason {
  season: 'summer' | 'winter';
  /** The one the calendar is inside, or the one that opens when it closes. */
  state: 'running' | 'upcoming';
  /** 1..26 while running, 0 while upcoming. */
  week: number;
  weeksLeft: number;
  /** 0..1 — how much of the track is filled. */
  progress: number;
  /** Whole days until it opens; 0 while running. */
  daysUntilStart: number;
  /** The last day points can be scored, for the card's right-hand meta. */
  endLabel: string;
  /** True once the season programme is the reader's active plan. */
  joined: boolean;
}

export interface HomePromoSlide {
  /** Stable and unique: two season slides can sit in the rail at once. */
  id: string;
  kind: HomePromoKind;
  /** The pill at the top of the card. */
  badgeKey: I18nKey;
  badgeVars?: Record<string, string | number>;
  /** Solid states a fact about now; ghost points at something ahead. */
  badgeTone: 'solid' | 'ghost';
  /** Exactly one of the two — a key when the app owns the words, a string
      when the value is the reader's own programme name. */
  titleKey?: I18nKey;
  title?: string;
  subtitleKey?: I18nKey;
  subtitleVars?: Record<string, string | number>;
  /** Already-formatted, for the date range the caller built. */
  subtitle?: string;
  ctaKey: I18nKey;
  /** The ghost button beside the primary one — only where there are two
      different things to do with the card. */
  secondaryCtaKey?: I18nKey;
  /**
   * The programme the card is about: what a programme slide opens, and what
   * the season card's ghost button opens.
   */
  templateId?: string;
  season?: HomePromoSeason;
}

export interface HomePromoSeasonInput {
  season: 'summer' | 'winter';
  state: 'running' | 'upcoming';
  week: number;
  weeksLeft: number;
  progress: number;
  daysUntilStart: number;
  joined: boolean;
  /** "1.4.–30.9.2026", built by the caller because dates are language work. */
  rangeLabel: string;
  /** The season's last day, for "PISTEET 30.9.". */
  endLabel: string;
  /** The season's first day, for "ALKAA 1.10.". */
  startLabel: string;
  /** The season's one programme — the ghost button's destination. */
  templateId: string;
}

export interface HomePromoInput {
  /** The running season and the next one, in that order. */
  seasons: HomePromoSeasonInput[];
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

const SEASON_TITLE: Record<'summer' | 'winter', I18nKey> = {
  summer: 'season.summer',
  winter: 'season.winter',
};

/**
 * How early the next season is worth a card on Home.
 *
 * The design puts the coming season permanently second in the rail. At 148
 * days out that card is a fact nobody can act on, sitting in the most valuable
 * strip on the screen. Two months is close enough that "which season am I
 * training into" is a real question.
 */
export const UPCOMING_SEASON_ANNOUNCE_DAYS = 60;

export function buildHomePromoSlides(input: HomePromoInput): HomePromoSlide[] {
  const slides: HomePromoSlide[] = [];

  for (const season of input.seasons) {
    if (season.state === 'running') {
      if (season.weeksLeft <= 0) {
        continue;
      }
      slides.push({
        id: `season-${season.season}`,
        kind: 'season',
        // Week 9 / 26 is the SEASON's progress, not the reader's points. The
        // scoreboard stays on the season screen; this card only says how much
        // of the window is left to score in.
        badgeKey: 'home.promo.season.running',
        badgeVars: { week: season.week, total: season.week + season.weeksLeft },
        badgeTone: 'solid',
        titleKey: SEASON_TITLE[season.season],
        subtitle: season.rangeLabel,
        // The design's primary is "Liity kauteen". Joining swaps the reader's
        // active programme, and the swap is explained on the season screen and
        // nowhere else — a promo card is the wrong place to do it silently. So
        // both buttons open something: the season, and the season's programme.
        ctaKey: 'home.promo.season.cta',
        secondaryCtaKey: 'home.promo.season.program',
        templateId: season.templateId,
        season: {
          season: season.season,
          state: 'running',
          week: season.week,
          weeksLeft: season.weeksLeft,
          progress: season.progress,
          daysUntilStart: 0,
          endLabel: season.endLabel,
          joined: season.joined,
        },
      });
      continue;
    }

    if (season.daysUntilStart > UPCOMING_SEASON_ANNOUNCE_DAYS) {
      continue;
    }
    slides.push({
      id: `season-${season.season}`,
      kind: 'season',
      badgeKey: 'season.upcoming',
      badgeVars: { date: season.startLabel },
      badgeTone: 'ghost',
      titleKey: SEASON_TITLE[season.season],
      subtitle: season.rangeLabel,
      ctaKey: 'home.promo.season.cta',
      secondaryCtaKey: 'home.promo.season.program',
      templateId: season.templateId,
      season: {
        season: season.season,
        state: 'upcoming',
        week: 0,
        weeksLeft: season.weeksLeft,
        progress: 0,
        daysUntilStart: season.daysUntilStart,
        endLabel: season.endLabel,
        joined: season.joined,
      },
    });
  }

  if (input.recommendation) {
    slides.push({
      id: `program-${input.recommendation.templateId}`,
      kind: 'program',
      badgeKey: 'home.promo.program.eyebrow',
      badgeTone: 'ghost',
      title: input.recommendation.title,
      subtitleKey: 'home.promo.program.body',
      ctaKey: 'home.promo.program.cta',
      templateId: input.recommendation.templateId,
    });
  }

  // A target is measured from your own best set, so there has to be one. With
  // no logged lifts the goal sheet can only ask for a number to compare
  // against nothing.
  if (input.goalCount === 0 && input.trackedLiftCount > 0) {
    slides.push({
      id: 'goal',
      kind: 'goal',
      badgeKey: 'home.promo.goal.eyebrow',
      badgeTone: 'ghost',
      titleKey: 'home.promo.goal.title',
      subtitleKey: 'home.promo.goal.body',
      ctaKey: 'home.promo.goal.cta',
    });
  }

  return slides;
}
