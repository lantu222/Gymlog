import { AppLanguage } from '../types/models';

const DAY_MS = 24 * 60 * 60 * 1000;
// Sunday-first, matching Date#getDay().
const WEEKDAY_LABELS: Record<AppLanguage, string[]> = {
  en: ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'],
  fi: ['SU', 'MA', 'TI', 'KE', 'TO', 'PE', 'LA'],
};
const MONTH_LABELS: Record<AppLanguage, string[]> = {
  en: [
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
  ],
  fi: [
    'Tammikuu',
    'Helmikuu',
    'Maaliskuu',
    'Huhtikuu',
    'Toukokuu',
    'Kesäkuu',
    'Heinäkuu',
    'Elokuu',
    'Syyskuu',
    'Lokakuu',
    'Marraskuu',
    'Joulukuu',
  ],
};
// Month grid runs Monday-first to match weekdayIndex (0 = Monday) elsewhere.
const MONTH_WEEKDAY_LABELS: Record<AppLanguage, string[]> = {
  en: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
  fi: ['MA', 'TI', 'KE', 'TO', 'PE', 'LA', 'SU'],
};

/**
 * Monday-first weekday abbreviations, indexed by the `weekdayIndex` convention
 * used across the app (0 = Monday). Shared so the home-screen widget cannot
 * drift into a second set of labels.
 */
export function getMondayFirstWeekdayLabels(language: AppLanguage = 'en') {
  return MONTH_WEEKDAY_LABELS[language] ?? MONTH_WEEKDAY_LABELS.en;
}

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
  /**
   * The plan's actual weekday label for this session (e.g. "Tue"), taken from
   * the saved plan entries — weekday truth. Null/absent = no fixed weekday.
   */
  dayLabel?: string | null;
  /** Total working sets across every exercise (Home v4 meta grid). */
  totalSets?: number;
  /**
   * The same number `duration` renders, carried as a number so Home does not
   * have to parse its own label back out of a string.
   */
  durationMinutes?: number;
  /**
   * What "Shorter session" would do, computed where the full session is still
   * in hand. Home only receives the first five exercises, so it cannot work
   * this out itself — and a trim preview built from a truncated list would
   * quote a shorter session than the one that starts.
   */
  trim?: { droppedSets: number; minutes: number } | null;
  exercises: Array<{
    name: string;
    setsLabel: string;
    /** Sets-by-reps scheme, e.g. "4 × 6–8" (Home v3 agenda list). */
    schemeLabel?: string;
    /**
     * Runtime slot this row will become, and the pool it can be swapped
     * within. Present only where both are known — Home offers the swap button
     * on a row exactly when it can identify what the choice would apply to.
     */
    slotId?: string;
    substitutionGroup?: string;
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

export function getHomeMiniCalendarDays(now = new Date(), language: AppLanguage = 'en'): HomeMiniCalendarDay[] {
  return getHomeCarouselCalendarDays(now, { daysBefore: 2, daysAfter: 4, language });
}

export function getHomeCarouselCalendarDays(
  now = new Date(),
  {
    daysBefore = 7,
    daysAfter = 14,
    language = 'en',
  }: { daysBefore?: number; daysAfter?: number; language?: AppLanguage } = {},
): HomeMiniCalendarDay[] {
  const todayStart = toDayStart(now);
  const todayTimestamp = todayStart.getTime();
  const totalDays = Math.max(1, daysBefore + daysAfter + 1);

  return Array.from({ length: totalDays }, (_, index) => {
    const offset = index - daysBefore;
    const date = new Date(todayTimestamp + offset * DAY_MS);
    const weekdayLabel = WEEKDAY_LABELS[language][date.getDay()] ?? '';
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

/**
 * @param monthOffset months away from the one containing `now` — negative goes
 *   back, positive forward. Only `isToday` is anchored to the real date, so a
 *   paged month never claims a day is today.
 */
export function getHomeMonthCalendar(
  now = new Date(),
  language: AppLanguage = 'en',
  monthOffset = 0,
): HomeMonthCalendar {
  const todayStart = toDayStart(now);
  // Normalising through day 1 avoids the month-end overflow that would turn
  // 31 January + 1 month into 3 March.
  const shifted = new Date(todayStart.getFullYear(), todayStart.getMonth() + monthOffset, 1);
  const year = shifted.getFullYear();
  const month = shifted.getMonth();
  const monthStart = new Date(year, month, 1);
  // Offset from the Monday that starts the grid to the 1st of the month.
  const gridStartOffset = monthStart.getDay() === 0 ? 6 : monthStart.getDay() - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weekCount = Math.ceil((gridStartOffset + daysInMonth) / 7);

  return {
    monthLabel: `${MONTH_LABELS[language][month]} ${year}`,
    weekdayLabels: [...MONTH_WEEKDAY_LABELS[language]],
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
