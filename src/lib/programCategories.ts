import { WorkoutTemplateV1 } from '../features/workout/workoutTypes';
import { I18nKey } from './i18n';

/**
 * Nine ways into 55 programs.
 *
 * The catalog is currently one flat rail plus a search field, which is fine at
 * eight programs and unusable at fifty-five. Every category here is derived
 * from what a template actually declares — goal, level, split, and the family
 * its id belongs to — rather than a hand-kept list per category, so a new
 * program lands in the right places the day it is added and cannot be quietly
 * missing from all of them.
 *
 * Derivation has one cost worth naming: a program can appear under more than
 * one category, and that is correct. "Strength Foundations 5x5" is both
 * strength and beginner, and hiding it from one of them to keep the sets
 * disjoint would make both rows worse.
 */

export type ProgramCategoryKey =
  | 'strength'
  | 'balanced'
  | 'muscle'
  | 'fatloss'
  | 'conditioning'
  | 'home'
  | 'mobility'
  | 'focus'
  | 'beginner';

export interface ProgramCategory {
  key: ProgramCategoryKey;
  labelKey: I18nKey;
  /** Drives the tile tint — one hue per category, as in the browse design. */
  hue: number;
  /**
   * The tile's three colours, pre-converted from the design's oklch.
   *
   * React Native has no oklch, and eyeballing nine hues into hex by hand drifts
   * — two neighbouring categories end up the same colour and the tiles stop
   * being distinguishable at a glance, which is the only reason they are
   * coloured at all. These came out of an actual oklch→sRGB conversion of
   * `0.94/0.045`, `0.88/0.05` and `0.48/0.16` at the hue above.
   */
  tint: { bg: string; border: string; ink: string };
  /** 24×24 stroke path, drawn in `ink`. */
  icon: string;
}

export const PROGRAM_CATEGORIES: readonly ProgramCategory[] = [
  {
    key: 'strength',
    labelKey: 'programs.cat.strength',
    hue: 268,
    tint: { bg: '#DEEBFF', border: '#C9D7FA', ink: '#3853B6' },
    icon: 'M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10',
  },
  {
    key: 'balanced',
    labelKey: 'programs.cat.balanced',
    hue: 96,
    tint: { bg: '#F4ECCA', border: '#E1D8B3', ink: '#795900' },
    icon: 'M12 21a9 9 0 100-18 9 9 0 000 18zM8 12h8M12 8v8',
  },
  {
    key: 'muscle',
    labelKey: 'programs.cat.muscle',
    hue: 222,
    tint: { bg: '#CBF3FF', border: '#B4E0EF', ink: '#006D9D' },
    icon: 'M5 20V10M12 20V4M19 20v-7',
  },
  {
    key: 'fatloss',
    labelKey: 'programs.cat.fatloss',
    hue: 28,
    tint: { bg: '#FFE1DB', border: '#F7CCC5', ink: '#A52A24' },
    icon: 'M12 3s5 4 5 9a5 5 0 01-10 0c0-2 1-3 1-3s0 2 2 2 2-4 2-8z',
  },
  {
    key: 'conditioning',
    labelKey: 'programs.cat.conditioning',
    hue: 156,
    tint: { bg: '#D4F5DF', border: '#BEE2CA', ink: '#007633' },
    icon: 'M3 12h4l2-6 3 12 2-6h5',
  },
  {
    key: 'home',
    labelKey: 'programs.cat.home',
    hue: 62,
    tint: { bg: '#FFE5CD', border: '#F0D1B7', ink: '#994000' },
    icon: 'M3 10.5 12 3l9 7.5M5 9.5V20h14V9.5',
  },
  {
    key: 'mobility',
    labelKey: 'programs.cat.mobility',
    hue: 300,
    tint: { bg: '#EFE5FF', border: '#DCD1F4', ink: '#6D41A9' },
    icon: 'M12 4a2 2 0 100 4 2 2 0 000-4zM12 8v6M8 20l4-6 4 6M8 11h8',
  },
  {
    key: 'focus',
    labelKey: 'programs.cat.focus',
    hue: 200,
    tint: { bg: '#C9F5F7', border: '#B2E2E4', ink: '#007581' },
    icon: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 16a4 4 0 100-8 4 4 0 000 8z',
  },
  {
    key: 'beginner',
    labelKey: 'programs.cat.beginner',
    hue: 12,
    tint: { bg: '#FFE0E3', border: '#F7CBCF', ink: '#A32745' },
    icon: 'M12 4l2.3 4.7 5.2.8-3.8 3.7.9 5.1-4.6-2.4-4.6 2.4.9-5.1L4.5 9.5l5.2-.8z',
  },
];

/**
 * Ids whose family cannot be read off goalType alone.
 *
 * Kept small and explicit. Cutting programs are `general` like a dozen others,
 * and running programs are `general` with a hybrid split like the single-muscle
 * days — the catalog simply does not encode "this is a cut" or "this is a run
 * block", so those two categories name their members. Everything else derives.
 */
const FAT_LOSS_IDS = new Set([
  'tpl_shred_v1',
  'tpl_shred_elite_v1',
  'tpl_gainer_lean_shred_v1',
  'tpl_gainer_fat_burn_hiit_v1',
]);

const CONDITIONING_IDS = new Set([
  'tpl_3_day_run_mobility_v1',
  'tpl_gainer_runners_strength_v1',
  'tpl_gainer_athlete_conditioning_v1',
  'tpl_gainer_calisthenics_mastery_v1',
]);

const HOME_IDS = new Set([
  'tpl_2_day_minimal_full_body_v1',
  'tpl_gainer_at_home_beginner_v1',
]);

const MOBILITY_IDS = new Set([
  'tpl_2_day_mobility_reset_v1',
  'tpl_2_day_yoga_recovery_v1',
  'tpl_gainer_mobility_flow_v1',
  'tpl_gainer_joint_friendly_v1',
]);

export function isInCategory(template: WorkoutTemplateV1, key: ProgramCategoryKey): boolean {
  switch (key) {
    case 'strength':
      return template.goalType === 'strength';
    case 'balanced':
      // The FIT family and everything else built for general fitness rather
      // than one outcome. Added after a test found FIT Elite in no category
      // at all: FIT and FIT Lite were only reachable through "beginner", so
      // the moment the family had an advanced entry it fell off the screen.
      // Overlap with fat loss and mobility is correct — SHRED really is both
      // a general-fitness program and a cut.
      return template.goalType === 'general' && !template.id.startsWith('tpl_focus_');
    case 'muscle':
      // The single-muscle days are hypertrophy too, but they belong under
      // "muscle group" — a one-day add-on is not a growth program.
      return template.goalType === 'hypertrophy' && !template.id.startsWith('tpl_focus_');
    case 'fatloss':
      return FAT_LOSS_IDS.has(template.id);
    case 'conditioning':
      return CONDITIONING_IDS.has(template.id);
    case 'home':
      return HOME_IDS.has(template.id);
    case 'mobility':
      return MOBILITY_IDS.has(template.id);
    case 'focus':
      return template.id.startsWith('tpl_focus_');
    case 'beginner':
      return template.level === 'beginner';
    default:
      return false;
  }
}

export function filterByCategory(
  templates: readonly WorkoutTemplateV1[],
  key: ProgramCategoryKey | null,
): WorkoutTemplateV1[] {
  if (!key) {
    return [...templates];
  }
  return templates.filter((template) => isInCategory(template, key));
}

/** How many programs each category would show — the tile can say so. */
export function countByCategory(
  templates: readonly WorkoutTemplateV1[],
): Record<ProgramCategoryKey, number> {
  const counts = {} as Record<ProgramCategoryKey, number>;
  for (const category of PROGRAM_CATEGORIES) {
    counts[category.key] = templates.filter((template) => isInCategory(template, category.key)).length;
  }
  return counts;
}
