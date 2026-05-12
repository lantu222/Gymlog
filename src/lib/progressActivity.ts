export type ProgressActivityDayStatus = 'workout' | 'rest' | 'outside';

export interface ProgressActivityDayInput {
  dayStart: number;
  dayNumber: number;
  active: boolean;
  isToday: boolean;
  inCurrentMonth: boolean;
}

export function getProgressActivityDayStatus(day: ProgressActivityDayInput): ProgressActivityDayStatus {
  if (!day.inCurrentMonth) {
    return 'outside';
  }

  return day.active ? 'workout' : 'rest';
}
