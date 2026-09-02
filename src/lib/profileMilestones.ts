import { LifetimeTrainingSummary } from './lifetimeSummary';
import { UnitPreference } from '../types/models';

/**
 * The Profile's NEXT MILESTONE rows (design: "Vinha Profile — Training
 * planin tilalle", frame A; user 2026-09-02).
 *
 * Derived from the lifetime summary and the record count the screen already
 * receives — no new storage, no new query. Each family names its next
 * unreached rung; the three closest to being reached are shown, nearest
 * first. The copy is descriptive, never promissory: the numbers are what the
 * reader did, phrased as a distance.
 */
export type MilestoneFamily = 'volume' | 'sessions' | 'streak' | 'records';

export interface ProfileMilestone {
  family: MilestoneFamily;
  /** The rung being approached, in the family's own unit. */
  target: number;
  /** What the reader has, in the same unit. */
  current: number;
  /** 0–1, never above 1. */
  progress: number;
  /** Rounded up, at least 1 — a hit rung has already advanced to the next. */
  remaining: number;
}

export interface ProfileMilestoneInput {
  lifetime: Pick<LifetimeTrainingSummary, 'sessionCount' | 'totalVolumeKg' | 'currentWeekStreak'>;
  recordCount: number;
  unitPreference: UnitPreference;
}

export const VOLUME_RUNGS_KG = [1000, 5000, 10000, 25000, 50000, 100000] as const;
export const VOLUME_RUNGS_LB = [2500, 10000, 25000, 50000, 100000, 250000] as const;
export const SESSION_RUNGS = [5, 10, 25, 50, 100, 200, 365] as const;
export const STREAK_RUNGS = [2, 4, 8, 12, 26, 52] as const;
export const RECORD_RUNGS = [5, 10, 25, 50] as const;

export const MAX_PROFILE_MILESTONES = 3;

const KG_PER_LB = 0.45359237;

/** The first rung the value has not reached; null once every rung is passed. */
function nextRung(value: number, rungs: readonly number[]): number | null {
  return rungs.find((rung) => value < rung) ?? null;
}

function milestone(family: MilestoneFamily, current: number, rungs: readonly number[]): ProfileMilestone | null {
  const safe = Number.isFinite(current) ? Math.max(0, current) : 0;
  const target = nextRung(safe, rungs);
  if (target === null) {
    return null;
  }
  return {
    family,
    target,
    current: safe,
    progress: Math.min(1, safe / target),
    remaining: Math.max(1, Math.ceil(target - safe)),
  };
}

/**
 * Volume is measured in the reader's unit: the rungs are the round numbers
 * of that unit, and the current figure is converted to it, so "994 kg of
 * 1 000 kg" and "2 190 lb of 2 500 lb" are both a distance in the unit the
 * reader lifts in.
 */
export function volumeInUnit(totalVolumeKg: number, unitPreference: UnitPreference): number {
  const kg = Number.isFinite(totalVolumeKg) ? Math.max(0, totalVolumeKg) : 0;
  return unitPreference === 'lb' ? kg / KG_PER_LB : kg;
}

export function buildProfileMilestones(input: ProfileMilestoneInput): ProfileMilestone[] {
  const volumeRungs = input.unitPreference === 'lb' ? VOLUME_RUNGS_LB : VOLUME_RUNGS_KG;
  const candidates = [
    milestone('volume', volumeInUnit(input.lifetime.totalVolumeKg, input.unitPreference), volumeRungs),
    milestone('sessions', input.lifetime.sessionCount, SESSION_RUNGS),
    milestone('streak', input.lifetime.currentWeekStreak, STREAK_RUNGS),
    milestone('records', input.recordCount, RECORD_RUNGS),
  ].filter((item): item is ProfileMilestone => item !== null);

  return candidates
    // Nearest first; a tie keeps the family order above, which is the order
    // a reader is likeliest to care about them.
    .map((item, index) => ({ item, index }))
    .sort((left, right) => right.item.progress - left.item.progress || left.index - right.index)
    .map(({ item }) => item)
    .slice(0, MAX_PROFILE_MILESTONES);
}

/** No sessions yet: one row, an empty bar, and a plain sentence. */
export function hasMilestoneData(input: Pick<ProfileMilestoneInput, 'lifetime'>): boolean {
  return input.lifetime.sessionCount > 0;
}
