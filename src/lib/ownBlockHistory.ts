/**
 * What the app remembers about warming up your own way.
 *
 * The free timer counts up because the app does not know how long your warm-up
 * takes. It can know how long it took you last time, though, and that is the
 * only number that makes an open-ended clock readable: 2:14 means nothing on
 * its own and quite a lot next to "last time you took 4:20".
 *
 * The count is here for the same reason. Someone who has now started three
 * sessions their own way is telling the app something, and the app can stop
 * asking — see `shouldOfferAlwaysOwn`.
 */
import { t } from './i18n';
import { AppLanguage } from '../types/models';

export type OwnBlockPhase = 'warmup' | 'cooldown';

export interface OwnBlockStat {
  /** Seconds the last self-run block took. */
  lastSeconds: number;
  /** How many have been run this way, ever. */
  count: number;
}

export type OwnBlockStats = Partial<Record<OwnBlockPhase, OwnBlockStat>>;

/** After this many, the app offers to stop asking. */
export const OWN_BLOCK_OFFER_AFTER = 3;

function normalizeStat(input: unknown): OwnBlockStat | null {
  if (!input || typeof input !== 'object') {
    return null;
  }
  const record = input as Record<string, unknown>;
  const lastSeconds =
    typeof record.lastSeconds === 'number' && Number.isFinite(record.lastSeconds) && record.lastSeconds > 0
      ? Math.round(record.lastSeconds)
      : 0;
  const count =
    typeof record.count === 'number' && Number.isFinite(record.count) && record.count > 0
      ? Math.round(record.count)
      : 0;
  return lastSeconds === 0 && count === 0 ? null : { lastSeconds, count };
}

/**
 * Stored shape → a shape the screen can read.
 *
 * Every loader in this app normalizes, because the field it is reading was
 * written by a version of the app that no longer exists.
 */
export function normalizeOwnBlockStats(input: unknown): OwnBlockStats {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {};
  }
  const record = input as Record<string, unknown>;
  const out: OwnBlockStats = {};
  (['warmup', 'cooldown'] as OwnBlockPhase[]).forEach((phase) => {
    const stat = normalizeStat(record[phase]);
    if (stat) {
      out[phase] = stat;
    }
  });
  return out;
}

/**
 * One finished self-run block, folded in.
 *
 * A block ended in under ten seconds is a mis-tap, not a warm-up: it neither
 * sets the "last time" mark nor counts towards the offer.
 */
export function recordOwnBlock(stats: OwnBlockStats, phase: OwnBlockPhase, seconds: number): OwnBlockStats {
  if (!Number.isFinite(seconds) || seconds < 10) {
    return stats;
  }
  const previous = stats[phase];
  return {
    ...stats,
    [phase]: {
      lastSeconds: Math.round(seconds),
      count: (previous?.count ?? 0) + 1,
    },
  };
}

/**
 * Whether to offer "always start with my own warm-up".
 *
 * Offered on the third, not the first: twice is a preference the reader has
 * not made yet, and an app that asks after one is an app that assumes.
 */
export function shouldOfferAlwaysOwn(
  stats: OwnBlockStats,
  phase: OwnBlockPhase,
  alreadyAlways: boolean,
): boolean {
  if (alreadyAlways) {
    return false;
  }
  return (stats[phase]?.count ?? 0) >= OWN_BLOCK_OFFER_AFTER;
}

/** "Last time you took 4:20", or null the first time through. */
export function formatLastOwnBlock(
  stats: OwnBlockStats,
  phase: OwnBlockPhase,
  language: AppLanguage,
): string | null {
  const seconds = stats[phase]?.lastSeconds ?? 0;
  if (seconds <= 0) {
    return null;
  }
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return t(language, 'guided.own.lastTime', { clock: `${minutes}:${`${rest}`.padStart(2, '0')}` });
}
