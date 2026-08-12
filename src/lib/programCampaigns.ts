import { I18nKey } from './i18n';
import { ProgramCategoryKey } from './programCategories';
import { ProgramSeason } from './programSeasons';
import { SEASON_COLORS } from './season';

/**
 * The rotating hero at the top of browsing.
 *
 * I cut this from the first build with the argument that the app has no
 * campaigns to run, and that was the wrong reading of what the slot is for. A
 * campaign hero does not need a marketing department; it needs somewhere real
 * to send you. Every slide here opens a set of programs that exists, and says
 * how many are in it — so the number on the card is checkable by tapping it.
 *
 * That constraint is what keeps the slot honest as it rotates. A slide whose
 * count is zero is not rendered at all rather than shown as an empty promise,
 * which means the hero shrinks to what is really there instead of advertising
 * a season with nothing in it.
 *
 * Rotation is the point: a page whose top third never changes stops being
 * looked at, and this one has four different reasons to open the catalog.
 */

export type CampaignTarget =
  | { kind: 'season'; season: ProgramSeason }
  | { kind: 'category'; category: ProgramCategoryKey }
  | { kind: 'library' }
  | { kind: 'create' };

export interface ProgramCampaign {
  key: string;
  kickerKey: I18nKey;
  titleKey: I18nKey;
  bodyKey: I18nKey;
  ctaKey: I18nKey;
  /** Substituted into body as {count}. Zero means the slide is dropped. */
  count: number;
  gradient: readonly [string, string];
  target: CampaignTarget;
}

/** oklch(0.62 0.15 h) → oklch(0.36 0.13 h) from the design, converted to sRGB. */
const GRADIENTS = {
  // The season slides take the season's own colours, from lib/season — the
  // hero and the card below it were two different oranges before.
  winter: SEASON_COLORS.winter,
  summer: SEASON_COLORS.summer,
  teal: ['#00A194', '#005047'],
  violet: ['#7C6BEA', '#38268F'],
  // The create slide used to reuse the summer gradient, and on device the two
  // were indistinguishable as the carousel turned — it read as the same card
  // coming back rather than as a fourth one.
  rose: ['#C65B93', '#6B1346'],
} as const;

export interface CampaignInputs {
  season: ProgramSeason;
  /** Weeks the season runs — the same 26 for everyone, every season. */
  seasonWeeks: number;
  /** Programs in the strength category — the catalog's biggest single promise. */
  strengthCount: number;
  exerciseCount: number;
}

/**
 * The slides to show, in order, current season first.
 *
 * The season leads because it is the only one that knows what month it is, and
 * that is the whole argument for the row existing.
 */
export function buildProgramCampaigns(inputs: CampaignInputs): ProgramCampaign[] {
  const isWinter = inputs.season === 'winter';

  const slides: ProgramCampaign[] = [
    {
      key: `season-${inputs.season}`,
      kickerKey: isWinter ? 'programs.campaign.winterKicker' : 'programs.campaign.summerKicker',
      titleKey: isWinter ? 'programs.campaign.winterTitle' : 'programs.campaign.summerTitle',
      bodyKey: isWinter ? 'programs.campaign.winterBody' : 'programs.campaign.summerBody',
      ctaKey: 'programs.campaign.seasonCta',
      // Weeks, not a programme count. A season has exactly ONE programme —
      // that is what makes it a competition — so "10 ohjelmaa kevyempään
      // työhön" advertised a shelf the season does not have.
      count: inputs.seasonWeeks,
      gradient: isWinter ? GRADIENTS.winter : GRADIENTS.summer,
      target: { kind: 'season', season: inputs.season },
    },
    {
      key: 'strength',
      kickerKey: 'programs.campaign.strengthKicker',
      titleKey: 'programs.campaign.strengthTitle',
      bodyKey: 'programs.campaign.strengthBody',
      ctaKey: 'programs.campaign.strengthCta',
      count: inputs.strengthCount,
      gradient: GRADIENTS.violet,
      target: { kind: 'category', category: 'strength' },
    },
    {
      key: 'library',
      kickerKey: 'programs.campaign.libraryKicker',
      titleKey: 'programs.campaign.libraryTitle',
      bodyKey: 'programs.campaign.libraryBody',
      ctaKey: 'programs.campaign.libraryCta',
      count: inputs.exerciseCount,
      gradient: GRADIENTS.teal,
      target: { kind: 'library' },
    },
    {
      key: 'create',
      kickerKey: 'programs.campaign.createKicker',
      titleKey: 'programs.campaign.createTitle',
      bodyKey: 'programs.campaign.createBody',
      ctaKey: 'programs.campaign.createCta',
      // Not a count of anything — the free program cap, which the sheet
      // enforces. Kept non-zero so the slide is never dropped for being empty.
      count: 3,
      gradient: GRADIENTS.rose,
      target: { kind: 'create' },
    },
  ];

  // A slide that would claim "0 programs" is worse than one fewer slide.
  return slides.filter((slide) => slide.count > 0);
}
