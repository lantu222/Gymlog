/**
 * Winter and summer training, as they are actually lived in Finland.
 *
 * Not a filter dressed up as a theme. October to March the sun is gone, the
 * gym is where training happens, and the honest thing to do with those months
 * is build — mass and strength, higher volume, longer blocks. April to
 * September the training moves outdoors and gets leaner: running, conditioning,
 * cutting. This is the one piece of content a global competitor cannot copy per
 * market, because it is not a marketing season, it is the weather.
 *
 * It is also a retention feature before it is a merchandising one. The reason
 * to open a training app in November is different from the reason in June, and
 * "the winter season starts now" is a better one than a notification.
 *
 * Free, always. Seasonal programs ARE ready programs, and the comparison table
 * says every ready program is free in both columns. A paywalled reason to come
 * back does not bring anyone back.
 */

export type ProgramSeason = 'winter' | 'summer';

/**
 * Which season a date falls in.
 *
 * October–March is winter. The split is the daylight, not the calendar
 * quarters: by October in Helsinki the evenings are dark enough that outdoor
 * training stops being the default, and it does not come back until April.
 */
export function getSeasonForDate(date: Date = new Date()): ProgramSeason {
  const month = date.getMonth();
  return month >= 9 || month <= 2 ? 'winter' : 'summer';
}

/**
 * Programs that genuinely belong to a season, by id.
 *
 * Deliberately NOT derived from goalType. That rule looks tidy and puts all 26
 * hypertrophy programs in winter and all 21 general ones in summer — which
 * files "Prenatal Fitness" and "Postpartum Recovery" under a summer cutting
 * row, and "Chest Day" as a seasonal commitment. Most of the catalog is not
 * seasonal at all, and saying so by leaving it out is more useful than sorting
 * everything into one of two buckets.
 */
export const PROGRAM_SEASONS: Readonly<Record<string, ProgramSeason>> = {
  // ── Winter: build ────────────────────────────────────────────────────
  tpl_3_day_strength_base_v1: 'winter',
  tpl_4_day_powerbuilding_v1: 'winter',
  tpl_2_day_beginner_strength_v1: 'winter',
  tpl_4_day_strength_size_v1: 'winter',
  tpl_strong_elite_v1: 'winter',
  tpl_gainer_expert_powerbuilding_v1: 'winter',
  tpl_gainer_strength_5x5_v1: 'winter',
  tpl_4_day_upper_lower_v1: 'winter',
  tpl_5_day_hybrid_v1: 'winter',
  tpl_3_day_push_pull_legs_v1: 'winter',
  tpl_4_day_muscle_builder_v1: 'winter',
  tpl_4_day_ppl_plus_v1: 'winter',
  tpl_5_day_ppl_v1: 'winter',
  tpl_5_day_upper_lower_full_v1: 'winter',
  tpl_6_day_ppl_v1: 'winter',
  tpl_6_day_arnold_v1: 'winter',
  tpl_huge_starter_v1: 'winter',
  tpl_gainer_dream_body_man_v1: 'winter',
  tpl_gainer_dream_body_female_v1: 'winter',
  tpl_gainer_beginner_bro_split_v1: 'winter',
  tpl_gainer_advanced_ppl_v1: 'winter',

  // ── Summer: lean and outdoors ────────────────────────────────────────
  tpl_shred_v1: 'summer',
  tpl_shred_elite_v1: 'summer',
  tpl_gainer_lean_shred_v1: 'summer',
  tpl_gainer_fat_burn_hiit_v1: 'summer',
  tpl_3_day_run_mobility_v1: 'summer',
  tpl_gainer_runners_strength_v1: 'summer',
  tpl_gainer_athlete_conditioning_v1: 'summer',
  tpl_gainer_calisthenics_mastery_v1: 'summer',
  tpl_gainer_at_home_beginner_v1: 'summer',
  tpl_gainer_mobility_flow_v1: 'summer',
};

export function getProgramSeason(templateId: string): ProgramSeason | null {
  return PROGRAM_SEASONS[templateId] ?? null;
}

/** Template ids in a season, in catalog order — the caller resolves them. */
export function getSeasonProgramIds(season: ProgramSeason): string[] {
  return Object.keys(PROGRAM_SEASONS).filter((id) => PROGRAM_SEASONS[id] === season);
}

/**
 * The season to lead with, and the one to offer second.
 *
 * Both rows are always reachable — someone cutting for a holiday in January is
 * not doing anything wrong — but the current season goes first, because the
 * point of the row is that it knows what month it is.
 */
export function orderSeasons(date: Date = new Date()): ProgramSeason[] {
  return getSeasonForDate(date) === 'winter' ? ['winter', 'summer'] : ['summer', 'winter'];
}
