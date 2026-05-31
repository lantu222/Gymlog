const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function toDayStart(dateInput: Date) {
  const date = new Date(dateInput);
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatTwoDigitDatePart(value: number) {
  return String(value).padStart(2, '0');
}

function formatDayMonth(date: Date) {
  return `${formatTwoDigitDatePart(date.getDate())}/${formatTwoDigitDatePart(date.getMonth() + 1)}`;
}

export interface HomeMiniCalendarDay {
  dayStart: number;
  label: string;
  weekdayLabel: string;
  weekdayIndex: number;
  dateLabel: string;
  isToday: boolean;
}

export interface HomeDaySessionSummary {
  id: string;
  title: string;
  duration: string;
  exercises: Array<{
    name: string;
    setsLabel: string;
  }>;
  hiddenExerciseCount: number;
}

export interface HomeDayView {
  kind: 'training' | 'recovery';
  eyebrow: string;
  title: string;
  subtitle: string;
  ctaEyebrow: string;
  ctaTitle: string;
  session: HomeDaySessionSummary | null;
}

export function getHomeMiniCalendarDays(now = new Date()): HomeMiniCalendarDay[] {
  return getHomeCarouselCalendarDays(now, { daysBefore: 2, daysAfter: 4 });
}

export function getHomeCarouselCalendarDays(
  now = new Date(),
  { daysBefore = 7, daysAfter = 14 }: { daysBefore?: number; daysAfter?: number } = {},
): HomeMiniCalendarDay[] {
  const todayStart = toDayStart(now);
  const todayTimestamp = todayStart.getTime();
  const totalDays = Math.max(1, daysBefore + daysAfter + 1);

  return Array.from({ length: totalDays }, (_, index) => {
    const offset = index - daysBefore;
    const date = new Date(todayTimestamp + offset * DAY_MS);
    const weekdayLabel = WEEKDAY_LABELS[date.getDay()] ?? '';
    const isToday = date.getTime() === todayTimestamp;

    return {
      dayStart: date.getTime(),
      label: isToday ? formatDayMonth(date) : weekdayLabel,
      weekdayLabel,
      weekdayIndex: date.getDay() === 0 ? 6 : date.getDay() - 1,
      dateLabel: isToday ? formatDayMonth(date) : '',
      isToday,
    };
  });
}

export function getHomeDayView(
  day: Pick<HomeMiniCalendarDay, 'weekdayIndex' | 'weekdayLabel' | 'dateLabel' | 'label' | 'isToday'>,
  trainingDayIndexes: number[],
  sessions: HomeDaySessionSummary[],
): HomeDayView {
  const trainingSlotIndex = trainingDayIndexes.indexOf(day.weekdayIndex);
  const session = trainingSlotIndex >= 0 ? sessions[trainingSlotIndex % Math.max(sessions.length, 1)] ?? null : null;

  if (session) {
    return {
      kind: 'training',
      eyebrow: day.dateLabel || day.weekdayLabel,
      title: session.title,
      subtitle: `${session.duration} - ${session.exercises.length} ${session.exercises.length === 1 ? 'exercise' : 'exercises'}`,
      ctaEyebrow: day.isToday ? 'NO EXCUSES' : 'TRAINING',
      ctaTitle: day.isToday ? 'JUST RESULTS' : 'TODAY',
      session,
    };
  }

  return {
    kind: 'recovery',
    eyebrow: day.dateLabel || day.weekdayLabel,
    title: 'Recovery day',
    subtitle: 'Keep it easy: walk, mobility, light stretching, or full rest.',
    ctaEyebrow: 'RECOVERY',
    ctaTitle: 'MOVE EASY',
    session: null,
  };
}
