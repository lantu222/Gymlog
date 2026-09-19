/**
 * The rhythm the training-day reminders follow, as one function.
 *
 * The reminders read the reader's cycle when they keep one, otherwise the
 * weekdays their own plan names, otherwise the days setup said they had free.
 * That rule lived inside the scheduling hook, and the two screens that talk
 * about reminders read `setupAvailableDays` on their own — so a reader whose
 * plan named its weekdays, or who trains on a cycle, was told "No training
 * days picked yet" on the very screen whose reminders were firing on those
 * days. The screens now ask this, and cannot say anything else.
 */
import { SetupWeekday } from '../types/models';
import { planWeekdayIndexes, WEEKDAY_KEYS } from './programTrainingDays';
import { cycleSchedule, TrainingSchedule, weekdaySchedule } from './trainingSchedule';

export interface ReminderScheduleInput {
  trainingCycle: { pattern: boolean[]; anchorDayStart: number } | null;
  /** The active plan's entries; their labels are weekdays when the plan names them. */
  planEntries: ReadonlyArray<{ label?: string | null }>;
  availableDays: readonly SetupWeekday[];
}

export function resolveReminderSchedule(input: ReminderScheduleInput): TrainingSchedule {
  if (input.trainingCycle) {
    return cycleSchedule(input.trainingCycle.pattern, input.trainingCycle.anchorDayStart);
  }
  // Availability is not a plan: the days the plan names win over it.
  const named = planWeekdayIndexes(input.planEntries);
  return weekdaySchedule(
    named.length > 0
      ? named
      : input.availableDays.map((day) => WEEKDAY_KEYS.indexOf(day)).filter((index) => index >= 0),
  );
}

/**
 * The weekdays a weekday schedule trains on, Monday first. A cycle has no
 * weekdays to name — the same Tuesday trains on one turn and rests on the
 * next — so it answers with none.
 */
export function reminderWeekdays(schedule: TrainingSchedule): SetupWeekday[] {
  if (schedule.kind !== 'weekdays') {
    return [];
  }
  return [...new Set(schedule.weekdayIndexes)]
    .filter((index) => index >= 0 && index < WEEKDAY_KEYS.length)
    .sort((left, right) => left - right)
    .map((index) => WEEKDAY_KEYS[index]);
}
