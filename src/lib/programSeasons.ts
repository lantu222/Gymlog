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
  tpl_season_winter_v1: 'winter',

  // ── Summer: lean and outdoors ────────────────────────────────────────
  tpl_shred_v1: 'summer',
  tpl_shred_elite_v1: 'summer',
  tpl_gainer_lean_shred_v1: 'summer',
  tpl_gainer_fat_burn_hiit_v1: 'summer',
  tpl_3_day_run_mobility_v1: 'summer',
  tpl_season_summer_v1: 'summer',
  tpl_gainer_runners_strength_v1: 'summer',
  tpl_gainer_athlete_conditioning_v1: 'summer',
  tpl_gainer_calisthenics_mastery_v1: 'summer',
  tpl_gainer_at_home_beginner_v1: 'summer',
  tpl_gainer_mobility_flow_v1: 'summer',
};

/**
 * THE program for each season — one, not ten.
 *
 * A season is a competition, and a competition needs everyone doing the same
 * thing. Ten season programs meant ten different weeks, ten different day
 * counts and therefore ten different point ceilings; the ranking would have
 * sorted people by how many days their program prescribes rather than by how
 * they trained. One shared program is what makes "week 9" a sentence two
 * people can say to each other.
 *
 * The other seasonal programs do not disappear — they stay in the catalog,
 * under their categories, for anyone who wants to train something else. They
 * are simply not the season.
 */
export const SEASON_PROGRAM_IDS: Readonly<Record<ProgramSeason, string>> = {
  /**
   * Summer: lifts and run blocks in the same session, no barbell.
   *
   * It used to point at RUN, which never lifts anything, after SHRED — a cut
   * with a beach deadline, which is not a season. Both were borrowed. This one
   * was built for the window: three days, outdoors where you want it, and a
   * run block in every session so the summer half actually builds an engine.
   */
  summer: 'tpl_season_summer_v1',
  /**
   * Winter: four days indoors, a heavy anchor each, conditioning on the legs.
   *
   * It used to point at POWERBUILD, which is a good programme that never asks
   * what month it is. This one keeps the engine alive through the dark half
   * rather than handing it back.
   */
  winter: 'tpl_season_winter_v1',
};

export function getSeasonProgramId(season: ProgramSeason): string {
  return SEASON_PROGRAM_IDS[season];
}

/**
 * The name a season programme goes by, for every surface that shows it.
 *
 * The season screen calls tpl_3_day_run_mobility_v1 "Kesäkunto" while the
 * template itself is named "RUN", so the programme wears two names depending on
 * where you meet it — and Home listed the raw one straight after the reader had
 * joined something called Kesäkunto. Returns null for programmes that are not a
 * season's, which keep their catalogue name.
 *
 * This is a bridge, not the destination: renaming the templates themselves is
 * the real fix and would delete this function.
 */
export function getSeasonProgramTitleKey(templateId: string): 'season.programTitle.summer' | 'season.programTitle.winter' | null {
  const season = getProgramSeason(templateId);
  if (!season) {
    return null;
  }
  return season === 'winter' ? 'season.programTitle.winter' : 'season.programTitle.summer';
}

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
