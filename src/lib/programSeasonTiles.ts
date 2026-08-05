import { I18nKey } from './i18n';
import { getSeasonForDate, ProgramSeason } from './programSeasons';

/**
 * Four season tiles over two training blocks.
 *
 * The browse design shows four tiles — Syksy, Talvi, Kevät, Kesä — and the
 * catalog has two seasonal blocks, because in Finland the training year really
 * does split in two: October to March it is indoors and building, April to
 * September it is outdoors and leaner. Inventing two more blocks to fill two
 * more tiles would give the extra tiles nothing real to open.
 *
 * So the tiles are four and they name their months, while two of them lead into
 * the same block. The month ranges are NOT the calendar quarters: they are cut
 * at the same October/April boundary `getSeasonForDate` uses, so a tile can
 * never send you to a block its own months disagree with. That is why autumn is
 * two months and summer is four.
 *
 * None of this is a compromise; it is the truth stated at the resolution people
 * think in. Nobody plans training in half-years — they plan it in "autumn" and
 * "spring" — and the month range printed on each tile makes the mapping visible
 * rather than surprising.
 */

export type SeasonTileKey = 'autumn' | 'winter' | 'spring' | 'summer';

export interface SeasonTile {
  key: SeasonTileKey;
  labelKey: I18nKey;
  /** "LOKA–MARRAS" — makes it obvious which tile covers today. */
  monthsKey: I18nKey;
  /** The block this tile opens. Autumn and winter share one; spring and summer the other. */
  block: ProgramSeason;
  /** Months it covers, 0-indexed, for resolving "which tile is now". */
  months: readonly number[];
  gradient: readonly [string, string];
}

export const SEASON_TILES: readonly SeasonTile[] = [
  {
    key: 'autumn',
    labelKey: 'programs.seasonTile.autumn',
    monthsKey: 'programs.seasonTile.autumnMonths',
    block: 'winter',
    months: [9, 10],
    gradient: ['#BE563F', '#621706'],
  },
  {
    key: 'winter',
    labelKey: 'programs.seasonTile.winter',
    monthsKey: 'programs.seasonTile.winterMonths',
    block: 'winter',
    months: [11, 0, 1, 2],
    gradient: ['#0086BE', '#003C63'],
  },
  {
    key: 'spring',
    labelKey: 'programs.seasonTile.spring',
    monthsKey: 'programs.seasonTile.springMonths',
    block: 'summer',
    months: [3, 4],
    gradient: ['#2A904B', '#004411'],
  },
  {
    key: 'summer',
    labelKey: 'programs.seasonTile.summer',
    monthsKey: 'programs.seasonTile.summerMonths',
    block: 'summer',
    months: [5, 6, 7, 8],
    gradient: ['#A76D00', '#532A00'],
  },
];

/** The tile covering today, so it can be marked "nyt". */
export function currentSeasonTile(date: Date = new Date()): SeasonTileKey {
  const month = date.getMonth();
  const tile = SEASON_TILES.find((entry) => entry.months.includes(month));
  // Every month is covered above; the fallback keeps the block correct rather
  // than defaulting to a fixed tile if that list is ever edited badly.
  return tile?.key ?? (getSeasonForDate(date) === 'winter' ? 'winter' : 'summer');
}

/** Tiles in calendar order starting from the one covering today. */
export function orderSeasonTiles(date: Date = new Date()): SeasonTile[] {
  const current = currentSeasonTile(date);
  const index = SEASON_TILES.findIndex((tile) => tile.key === current);
  if (index <= 0) {
    return [...SEASON_TILES];
  }
  return [...SEASON_TILES.slice(index), ...SEASON_TILES.slice(0, index)];
}
