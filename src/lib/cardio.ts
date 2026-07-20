/**
 * Cardio v1 domain logic (Home → Cardio list → player → finish).
 *
 * Offline-first and timer-based: no GPS, distance is optional manual entry at
 * the finish screen, and avg pace is always derived — never stored. The live
 * session itself is a pair of timestamps + accumulated milliseconds so the
 * clock survives backgrounding and app kills.
 */

import { CardioActivityType, CardioFeel, CardioSession } from '../types/models';
import { getCalendarWeekStartTimestamp } from './completedSessions';

export type CardioIconKind = 'run' | 'walk' | 'treadmill' | 'cycle' | 'row';

export interface CardioActivity {
  id: CardioActivityType;
  name: string;
  /** Uppercase chip label; null hides the chip ("NO EQUIPMENT" is shown). */
  equipmentLabel: string;
  icon: CardioIconKind;
}

export const CARDIO_ACTIVITIES: CardioActivity[] = [
  { id: 'run', name: 'Free Run', equipmentLabel: 'No equipment', icon: 'run' },
  { id: 'tread-run', name: 'Free Treadmill Run', equipmentLabel: 'Treadmill', icon: 'treadmill' },
  { id: 'tread-walk', name: 'Free Treadmill Walk', equipmentLabel: 'Treadmill', icon: 'walk' },
  { id: 'cycle-in', name: 'Free Indoor Cycle', equipmentLabel: 'Exercise bike', icon: 'cycle' },
  { id: 'cycle-out', name: 'Free Outdoor Cycle', equipmentLabel: 'Outdoor bike', icon: 'cycle' },
  { id: 'row', name: 'Free Row', equipmentLabel: 'Rower', icon: 'row' },
];

export function getCardioActivity(activityType: string): CardioActivity {
  return CARDIO_ACTIVITIES.find((activity) => activity.id === activityType) ?? CARDIO_ACTIVITIES[0];
}

export const CARDIO_FEEL_OPTIONS: Array<{ key: CardioFeel; label: string }> = [
  { key: 'easy', label: 'Easy' },
  { key: 'steady', label: 'Steady' },
  { key: 'hard', label: 'Hard' },
  { key: 'max', label: 'Max effort' },
];

/** MM:SS under an hour, H:MM:SS past it. */
export function formatCardioDuration(durationSec: number): string {
  const total = Math.max(0, Math.floor(durationSec));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Parses the manual distance input ("4.2" or "4,2") into km. Returns null for
 * empty/invalid/nonpositive/absurd values so the caller can skip saving it.
 */
export function parseCardioDistanceKm(input: string): number | null {
  const normalized = input.replace(',', '.').trim();
  if (!normalized) {
    return null;
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed >= 1000) {
    return null;
  }
  return Math.round(parsed * 100) / 100;
}

/** Derived avg pace in seconds per km; null without a usable distance. */
export function getCardioAvgPaceSecPerKm(durationSec: number, distanceKm: number | null | undefined): number | null {
  if (!distanceKm || distanceKm <= 0 || durationSec <= 0) {
    return null;
  }
  return durationSec / distanceKm;
}

/** "5:50 /km" from seconds-per-km. */
export function formatCardioPace(paceSecPerKm: number): string {
  const total = Math.max(1, Math.round(paceSecPerKm));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')} /km`;
}

function formatDistanceKm(distanceKm: number): string {
  const rounded = Math.round(distanceKm * 100) / 100;
  return `${rounded} km`;
}

/**
 * History stats line: `24:31 · 4.2 km · 5:50 /km` with distance entered,
 * plain `24:31` without.
 */
export function buildCardioStatsLine(durationSec: number, distanceKm?: number | null): string {
  const duration = formatCardioDuration(durationSec);
  const pace = getCardioAvgPaceSecPerKm(durationSec, distanceKm ?? null);
  if (!distanceKm || pace === null) {
    return duration;
  }
  return `${duration} · ${formatDistanceKm(distanceKm)} · ${formatCardioPace(pace)}`;
}

/** Total cardio minutes in the current calendar week (Monday start). */
export function getWeekCardioMinutes(
  sessions: Array<Pick<CardioSession, 'performedAt' | 'durationSec'>>,
  now = new Date(),
): number {
  const weekStart = getCalendarWeekStartTimestamp(now);
  const totalSec = sessions
    .filter((session) => getCalendarWeekStartTimestamp(session.performedAt) === weekStart)
    .reduce((sum, session) => sum + Math.max(0, session.durationSec), 0);
  return Math.round(totalSec / 60);
}

/**
 * Live cardio session state. Elapsed time is derived from timestamps so it
 * survives backgrounding and process death: accumulatedMs counts finished
 * running stretches, resumedAt marks the current one (null = paused).
 */
export interface ActiveCardioSession {
  activityType: CardioActivityType;
  startedAt: string;
  accumulatedMs: number;
  resumedAt: string | null;
}

export function startCardioSession(activityType: CardioActivityType, nowMs: number): ActiveCardioSession {
  const iso = new Date(nowMs).toISOString();
  return { activityType, startedAt: iso, accumulatedMs: 0, resumedAt: iso };
}

export function getCardioElapsedMs(session: ActiveCardioSession, nowMs: number): number {
  const runningMs = session.resumedAt ? Math.max(0, nowMs - new Date(session.resumedAt).getTime()) : 0;
  return Math.max(0, session.accumulatedMs + runningMs);
}

export function pauseCardioSession(session: ActiveCardioSession, nowMs: number): ActiveCardioSession {
  if (!session.resumedAt) {
    return session;
  }
  return {
    ...session,
    accumulatedMs: getCardioElapsedMs(session, nowMs),
    resumedAt: null,
  };
}

export function resumeCardioSession(session: ActiveCardioSession, nowMs: number): ActiveCardioSession {
  if (session.resumedAt) {
    return session;
  }
  return { ...session, resumedAt: new Date(nowMs).toISOString() };
}

/** Normalizes a persisted active-cardio blob; null when unusable. */
export function normalizeActiveCardioSession(input: unknown): ActiveCardioSession | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return null;
  }
  const raw = input as Record<string, unknown>;
  if (typeof raw.activityType !== 'string' || typeof raw.startedAt !== 'string') {
    return null;
  }
  if (Number.isNaN(new Date(raw.startedAt).getTime())) {
    return null;
  }
  const resumedAt =
    typeof raw.resumedAt === 'string' && !Number.isNaN(new Date(raw.resumedAt).getTime()) ? raw.resumedAt : null;
  return {
    activityType: getCardioActivity(raw.activityType).id,
    startedAt: raw.startedAt,
    accumulatedMs: typeof raw.accumulatedMs === 'number' && Number.isFinite(raw.accumulatedMs) ? Math.max(0, raw.accumulatedMs) : 0,
    resumedAt,
  };
}
