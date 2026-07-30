/**
 * Turns the user's notification preferences plus what the app actually knows
 * about their training into a concrete list of local notifications to schedule.
 *
 * Everything here is local-only. There is no server and no push token, so every
 * message has to be written and dated in advance — which means a notification
 * may only ever say something that is still true when it fires:
 *
 * - The weekly summary quotes real numbers and is scheduled for *this* week's
 *   Sunday only. Sessions can only enter the app through the app, so every new
 *   session re-runs this planner and the numbers stay current.
 * - The personal-record note fires the morning after the session, when "you set
 *   a new best yesterday" is a fact rather than a duplicate of what is already
 *   on screen.
 * - The comeback nudge is anchored to the last session and nothing else, so a
 *   long gap produces exactly one ping instead of a daily drip.
 * - A declared training break silences everything. Somebody who told us they
 *   are injured or away does not need reminding.
 *
 * The level (quiet / normal / motivating) is a real per-day cap, matching what
 * the settings screen promises. When a day is over its cap the rarest message
 * wins: a record beats a comeback nudge beats a reminder beats a summary.
 */
import { getCalendarWeekStartTimestamp } from './completedSessions';
import { formatCompactVolume, formatVolume } from './format';
import { t } from './i18n';
import { AppLanguage, NotificationLevel, NotificationPrefs, SetupWeekday } from '../types/models';

export type NotificationCategory = 'record' | 'comeback' | 'reminder' | 'weekly';

export interface PlannedNotification {
  /** Stable across re-plans, so an unchanged plan re-schedules identically. */
  key: string;
  category: NotificationCategory;
  title: string;
  body: string;
  fireAtMs: number;
}

export interface LatestPrSignal {
  exerciseName: string;
  weightKg: number;
  reps: number;
  achievedAtMs: number;
}

export interface NotificationPlanInput {
  nowMs: number;
  prefs: NotificationPrefs;
  language: AppLanguage;
  /** Days the user picked in setup. Empty = unknown, so no reminders. */
  trainingDays: SetupWeekday[];
  lastSessionAtMs: number | null;
  weekSessionCount: number;
  weekVolumeKg: number;
  latestPr: LatestPrSignal | null;
  onTrainingBreak: boolean;
}

export const DAILY_CAP_BY_LEVEL: Record<NotificationLevel, number> = {
  quiet: 1,
  normal: 2,
  motivating: 3,
};

/** How far ahead reminders are laid down, so a quiet month still gets them. */
export const REMINDER_HORIZON_DAYS = 28;
/** Days of silence before the comeback nudge. */
export const COMEBACK_AFTER_DAYS = 5;
export const WEEKLY_SUMMARY_HOUR = 18;
export const RECORD_HOUR = 9;
/** iOS keeps at most 64 pending local notifications; stay well under it. */
export const MAX_SCHEDULED = 48;

const CATEGORY_PRIORITY: Record<NotificationCategory, number> = {
  record: 0,
  comeback: 1,
  reminder: 2,
  weekly: 3,
};

const JS_WEEKDAY: Record<SetupWeekday, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

const DEFAULT_REMINDER_HOUR = 17;
const DEFAULT_REMINDER_MINUTE = 30;

/** "17:30" -> { hour: 17, minute: 30 }. Anything malformed falls back. */
export function parseReminderTime(value: string | null | undefined) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(value ?? ''));
  if (!match) {
    return { hour: DEFAULT_REMINDER_HOUR, minute: DEFAULT_REMINDER_MINUTE };
  }
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

/**
 * Local wall-clock time `dayOffset` days from `reference`. Built through the
 * Date constructor so month ends and DST shifts land on the hour the user
 * picked rather than on a raw +24h arithmetic drift.
 */
function atLocalTime(reference: Date, dayOffset: number, hour: number, minute: number) {
  return new Date(
    reference.getFullYear(),
    reference.getMonth(),
    reference.getDate() + dayOffset,
    hour,
    minute,
    0,
    0,
  ).getTime();
}

function localDayKey(ms: number) {
  const date = new Date(ms);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function isSameLocalDay(left: number, right: number) {
  return localDayKey(left) === localDayKey(right);
}

function buildSessionReminders(input: NotificationPlanInput): PlannedNotification[] {
  const { prefs, language, nowMs } = input;
  if (!prefs.sessionReminders || input.trainingDays.length === 0) {
    return [];
  }

  const wantedWeekdays = new Set(
    input.trainingDays.map((day) => JS_WEEKDAY[day]).filter((index) => index !== undefined),
  );
  if (wantedWeekdays.size === 0) {
    return [];
  }

  const now = new Date(nowMs);
  const { hour, minute } = parseReminderTime(prefs.reminderTime);
  const reminders: PlannedNotification[] = [];

  for (let offset = 0; offset <= REMINDER_HORIZON_DAYS; offset += 1) {
    const fireAtMs = atLocalTime(now, offset, hour, minute);
    if (fireAtMs <= nowMs) {
      continue;
    }
    if (!wantedWeekdays.has(new Date(fireAtMs).getDay())) {
      continue;
    }
    // Already trained that day — the reminder has nothing left to ask for.
    if (input.lastSessionAtMs !== null && isSameLocalDay(input.lastSessionAtMs, fireAtMs)) {
      continue;
    }

    reminders.push({
      key: `reminder-${localDayKey(fireAtMs)}`,
      category: 'reminder',
      title: t(language, 'notif.msg.reminderTitle'),
      body: t(language, 'notif.msg.reminderBody'),
      fireAtMs,
    });
  }

  return reminders;
}

function buildComebackNudge(input: NotificationPlanInput): PlannedNotification | null {
  const { prefs, language, nowMs } = input;
  if (!prefs.comebackNudge || input.lastSessionAtMs === null) {
    return null;
  }

  const { hour, minute } = parseReminderTime(prefs.reminderTime);
  const fireAtMs = atLocalTime(new Date(input.lastSessionAtMs), COMEBACK_AFTER_DAYS, hour, minute);
  // Anchored to the last session only: once that moment has passed there is no
  // second nudge, and the next one needs a new session to hang off.
  if (fireAtMs <= nowMs) {
    return null;
  }

  return {
    key: 'comeback',
    category: 'comeback',
    title: t(language, 'notif.msg.comebackTitle'),
    body: t(language, 'notif.msg.comebackBody', { days: COMEBACK_AFTER_DAYS }),
    fireAtMs,
  };
}

function weeklyBodyKey(sessionCount: number, volumeKg: number) {
  if (volumeKg <= 0) {
    return 'notif.msg.weeklyBodyNoVolume' as const;
  }
  return sessionCount === 1 ? ('notif.msg.weeklyBodyOne' as const) : ('notif.msg.weeklyBody' as const);
}

function buildWeeklySummary(input: NotificationPlanInput): PlannedNotification | null {
  const { prefs, language, nowMs } = input;
  // Nothing logged this week: a summary of nothing is a guilt trip, not a recap.
  if (!prefs.weeklySummary || input.weekSessionCount < 1) {
    return null;
  }

  const now = new Date(nowMs);
  const daysUntilSunday = (7 - now.getDay()) % 7;
  const fireAtMs = atLocalTime(now, daysUntilSunday, WEEKLY_SUMMARY_HOUR, 0);
  // Only ever this week's Sunday. Scheduling next week's would ship numbers
  // that describe a week the summary does not claim to be about.
  if (fireAtMs <= nowMs || getCalendarWeekStartTimestamp(new Date(fireAtMs)) !== getCalendarWeekStartTimestamp(now)) {
    return null;
  }

  return {
    key: 'weekly',
    category: 'weekly',
    title: t(language, 'notif.msg.weeklyTitle'),
    // A cardio-only week has no lifted volume — quoting "0 kg" would read as a
    // failure rather than as a week that simply was not about the barbell.
    body: t(language, weeklyBodyKey(input.weekSessionCount, input.weekVolumeKg), {
      count: input.weekSessionCount,
      volume: formatCompactVolume(input.weekVolumeKg),
    }),
    fireAtMs,
  };
}

function buildRecordNote(input: NotificationPlanInput): PlannedNotification | null {
  const { prefs, language, nowMs, latestPr } = input;
  if (!prefs.personalRecords || !latestPr) {
    return null;
  }

  // The morning after: by then "yesterday" is true and the record card the user
  // already saw on the completion screen is no longer on screen.
  const fireAtMs = atLocalTime(new Date(latestPr.achievedAtMs), 1, RECORD_HOUR, 0);
  if (fireAtMs <= nowMs) {
    return null;
  }

  return {
    key: `record-${localDayKey(latestPr.achievedAtMs)}`,
    category: 'record',
    title: t(language, 'notif.msg.recordTitle'),
    body: t(language, 'notif.msg.recordBody', {
      exercise: latestPr.exerciseName,
      // A lift is never tonnes — formatVolume keeps "92.5 kg" as written.
      weight: formatVolume(latestPr.weightKg),
      reps: latestPr.reps,
    }),
    fireAtMs,
  };
}

/** Applies the level's per-day cap, keeping the rarest message on a busy day. */
function applyDailyCap(planned: PlannedNotification[], level: NotificationLevel) {
  const cap = DAILY_CAP_BY_LEVEL[level] ?? DAILY_CAP_BY_LEVEL.normal;
  const byDay = new Map<string, PlannedNotification[]>();

  planned.forEach((item) => {
    const dayKey = localDayKey(item.fireAtMs);
    const bucket = byDay.get(dayKey);
    if (bucket) {
      bucket.push(item);
    } else {
      byDay.set(dayKey, [item]);
    }
  });

  const kept: PlannedNotification[] = [];
  byDay.forEach((items) => {
    const ranked = [...items].sort(
      (left, right) =>
        CATEGORY_PRIORITY[left.category] - CATEGORY_PRIORITY[right.category] ||
        left.fireAtMs - right.fireAtMs,
    );
    kept.push(...ranked.slice(0, cap));
  });

  return kept.sort((left, right) => left.fireAtMs - right.fireAtMs);
}

export function buildNotificationPlan(input: NotificationPlanInput): PlannedNotification[] {
  if (!input.prefs.pushEnabled) {
    return [];
  }
  // Injured, on holiday, or otherwise out: silence until the break ends.
  if (input.onTrainingBreak) {
    return [];
  }

  const planned = [
    ...buildSessionReminders(input),
    buildComebackNudge(input),
    buildWeeklySummary(input),
    buildRecordNote(input),
  ].filter((item): item is PlannedNotification => item !== null);

  return applyDailyCap(planned, input.prefs.level).slice(0, MAX_SCHEDULED);
}
