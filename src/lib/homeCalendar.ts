const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
// Month grid runs Monday-first to match weekdayIndex (0 = Monday) elsewhere.
const MONTH_WEEKDAY_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

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
  /** Total working sets across every exercise (Home v4 meta grid). */
  totalSets?: number;
  exercises: Array<{
    name: string;
    setsLabel: string;
    /** Sets-by-reps scheme, e.g. "4 × 6–8" (Home v3 agenda list). */
    schemeLabel?: string;
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

export interface HomeMonthCalendarDay {
  dayStart: number;
  dayOfMonth: number;
  weekdayIndex: number;
  inMonth: boolean;
  isToday: boolean;
}

export interface HomeMonthCalendar {
  monthLabel: string;
  weekdayLabels: string[];
  weeks: HomeMonthCalendarDay[][];
}

export function getHomeMonthCalendar(now = new Date()): HomeMonthCalendar {
  const todayStart = toDayStart(now);
  const year = todayStart.getFullYear();
  const month = todayStart.getMonth();
  const monthStart = new Date(year, month, 1);
  // Offset from the Monday that starts the grid to the 1st of the month.
  const gridStartOffset = monthStart.getDay() === 0 ? 6 : monthStart.getDay() - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weekCount = Math.ceil((gridStartOffset + daysInMonth) / 7);

  return {
    monthLabel: `${MONTH_LABELS[month]} ${year}`,
    weekdayLabels: [...MONTH_WEEKDAY_LABELS],
    weeks: Array.from({ length: weekCount }, (_, weekIndex) =>
      Array.from({ length: 7 }, (_, weekdayIndex) => {
        // Calendar-arithmetic construction keeps day starts DST-safe.
        const date = new Date(year, month, 1 - gridStartOffset + weekIndex * 7 + weekdayIndex);

        return {
          dayStart: date.getTime(),
          dayOfMonth: date.getDate(),
          weekdayIndex,
          inMonth: date.getMonth() === month,
          isToday: date.getTime() === todayStart.getTime(),
        };
      }),
    ),
  };
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
