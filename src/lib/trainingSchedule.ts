/**
 * Which calendar days are training days.
 *
 * The app used to answer this with a set of weekdays — `mon`, `tue`, `wed` —
 * and that set is a rhythm with a period of seven. A reader who trains two days
 * on, one day off has a rhythm with a period of three, and no weekday set can
 * express it: the same weekday is a training day on one turn of the cycle and a
 * rest day on the next. Reported from a gym floor 2026-08-21, with the note
 * that this is the rhythm they always use.
 *
 * So a schedule is one of two shapes, and everything downstream asks this file
 * rather than counting weekdays for itself. That is deliberate: the schedule
 * already had two truths and three editors before this, and a third truth would
 * have been the end of it.
 */

/** Day-of-week indexes, Monday first, matching the rest of the app. */
export interface WeekdaySchedule {
  kind: 'weekdays';
  weekdayIndexes: number[];
}

/**
 * A repeating pattern of training and rest days, anchored to a real date.
 *
 * `pattern` is read cyclically from `anchorDayStart`: `[true, true, false]` is
 * two on, one off. The anchor is a local day start, because a cycle that drifts
 * by an hour drifts by a day twice a year.
 */
export interface CycleSchedule {
  kind: 'cycle';
  pattern: boolean[];
  anchorDayStart: number;
}

export type TrainingSchedule = WeekdaySchedule | CycleSchedule;

/** Nothing is known about the rhythm — draw no dots rather than guess. */
export const UNKNOWN_SCHEDULE: TrainingSchedule = { kind: 'weekdays', weekdayIndexes: [] };

const DAY_MS = 24 * 60 * 60 * 1000;

function dayStartOf(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * Whole days between two local midnights.
 *
 * Not `(a - b) / DAY_MS`: the day a clock changes is 23 or 25 hours long, and
 * across one of those the division lands on 0.96 of a day and truncates to the
 * wrong side. Rounding is exact for local midnights either side of a change.
 */
function daysBetween(fromDayStart: number, toDayStart: number) {
  return Math.round((toDayStart - fromDayStart) / DAY_MS);
}

export function weekdaySchedule(weekdayIndexes: number[]): TrainingSchedule {
  return { kind: 'weekdays', weekdayIndexes: [...weekdayIndexes] };
}

export function cycleSchedule(pattern: boolean[], anchor: Date | number): TrainingSchedule {
  const anchorDayStart = dayStartOf(new Date(anchor));
  // A pattern with no training day in it is not a rhythm, it is a stopped app.
  return pattern.some(Boolean)
    ? { kind: 'cycle', pattern: [...pattern], anchorDayStart }
    : UNKNOWN_SCHEDULE;
}

/** `[true, true, false]` from "two on, one off". */
export function patternFromOnOff(onDays: number, offDays: number): boolean[] {
  const on = Math.max(1, Math.round(onDays));
  const off = Math.max(0, Math.round(offDays));
  return [...Array.from({ length: on }, () => true), ...Array.from({ length: off }, () => false)];
}

/** False when the reader has told us nothing, so nothing may be claimed. */
export function isScheduleKnown(schedule: TrainingSchedule): boolean {
  return schedule.kind === 'cycle' ? schedule.pattern.some(Boolean) : schedule.weekdayIndexes.length > 0;
}

function weekdayIndexOf(date: Date) {
  return date.getDay() === 0 ? 6 : date.getDay() - 1;
}

/** Where a date falls inside the cycle, counting from the anchor. */
function cycleOffset(schedule: CycleSchedule, date: Date) {
  const length = schedule.pattern.length;
  const offset = daysBetween(schedule.anchorDayStart, dayStartOf(date)) % length;
  // JS keeps the sign of the dividend, so a date before the anchor lands on a
  // negative index — and the day before the anchor is the last day of the
  // previous turn, not an error.
  return (offset + length) % length;
}

export function trainsOn(schedule: TrainingSchedule, date: Date): boolean {
  if (!isScheduleKnown(schedule)) {
    return false;
  }
  if (schedule.kind === 'weekdays') {
    return schedule.weekdayIndexes.includes(weekdayIndexOf(date));
  }
  return schedule.pattern[cycleOffset(schedule, date)] === true;
}

/**
 * Which session a training day gets, as an index into the programme's list.
 *
 * For weekdays this is the position in the chosen set, which is what the app
 * has always done. For a cycle it is the count of training days since the
 * anchor: the programme rotates through its sessions in order, and the cycle
 * decides only which calendar days it lands on.
 *
 * Null on a rest day, and on a day no schedule can speak for.
 */
export function sessionSlotOn(schedule: TrainingSchedule, date: Date): number | null {
  if (!trainsOn(schedule, date)) {
    return null;
  }

  if (schedule.kind === 'weekdays') {
    const slot = schedule.weekdayIndexes.indexOf(weekdayIndexOf(date));
    return slot >= 0 ? slot : null;
  }

  const length = schedule.pattern.length;
  const perTurn = schedule.pattern.filter(Boolean).length;
  const elapsed = daysBetween(schedule.anchorDayStart, dayStartOf(date));
  // Turns can be negative for a date before the anchor; floor keeps the count
  // walking backwards in the same direction the calendar does.
  const turns = Math.floor(elapsed / length);
  const within = schedule.pattern.slice(0, cycleOffset(schedule, date)).filter(Boolean).length;
  return turns * perTurn + within;
}
