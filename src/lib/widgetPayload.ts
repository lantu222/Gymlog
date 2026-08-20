/**
 * The home-screen widget's contents, computed here and handed to Kotlin as
 * finished strings.
 *
 * The widget renders text, coloured date pips and nothing else: no dates, no
 * pluralisation, no translation on the native side. Every one of those has
 * already gone wrong once in this app, and a widget is the worst place to find
 * out — it is drawn by the launcher, in a process with none of the app's
 * context.
 *
 * The week and the session mapping come from `getHomeDayView`, the same
 * function Home renders, so the widget cannot claim a training day the app
 * would call a rest day.
 *
 * SHAPE (v5, "kuukausi" design). The calendar is a real month: the month's
 * name, the weekday letters, and its own numbers — trained days marked green,
 * days still ahead of the reader marked violet. Four widgets read this one
 * payload:
 *
 *   2×2  the month, and nothing else
 *   4×2  the month, with this month's workouts, duration and volume beside it
 *   2×1  the streak
 *   2×1  today's routine
 *
 * The four-week bar strip that came before it is gone: it drew two weeks of
 * marks that nobody could date, and the one number it anchored on ("2/3") said
 * less than a month of green does.
 */
import { formatCompactVolume, formatDurationMinutes } from './format';
import { getHomeDayView, getHomeMonthCalendar, getMondayFirstWeekdayLabels, HomeDaySessionSummary } from './homeCalendar';
import { t } from './i18n';
import { AppLanguage } from '../types/models';

/** Bumped whenever the shape changes, so a stale file is ignored, not misread. */
export const HOME_WIDGET_PAYLOAD_VERSION = 5;

/**
 * How many week rows the native layout holds.
 *
 * A month needs four, five or six of them depending on which weekday it starts
 * on, and RemoteViews cannot add a row — so the layout always has six and the
 * provider hides the ones this month does not use.
 */
export const HOME_WIDGET_MONTH_ROWS = 6;

/** How far ahead to look for the next training day before giving up. */
const LOOKAHEAD_DAYS = 14;

/**
 * What a date pip says. Three states, not four: "today" used to be one of them,
 * which meant a day could not be today *and* done at once — and "you already
 * did it" is the one thing you glance at a home screen to find out. Today is
 * now a separate flag the native side draws as a ring around the number.
 */
export type HomeWidgetDayState = 'done' | 'plan' | 'off';

/**
 * Where a tap goes. Slugs, not routes: the app resolves them against live
 * state when it opens, because the file the widget reads can be half an hour
 * old and an id baked into a link would be older still.
 */
export type HomeWidgetTarget = 'session' | 'suggestion' | 'calendar' | 'home' | 'programs' | 'schedule';

export interface HomeWidgetDay {
  /** Day of month, e.g. "30" — empty for the days either side of the month. */
  dateLabel: string;
  isToday: boolean;
  /** False for the leading and trailing days a Monday-first grid drags in. */
  inMonth: boolean;
  state: HomeWidgetDayState;
}

/** One of the three figures the 4×2 puts beside the calendar. */
export interface HomeWidgetStat {
  /** Pre-translated: "Workouts", "Duration", "Volume". */
  label: string;
  /** Already formatted: "6", "4 h 20 min", "12,4 t". */
  value: string;
}

export interface HomeWidgetPayload {
  version: number;
  updatedAt: string;
  /**
   * Which palette the native side should draw. The widget is rendered by the
   * launcher with none of the app's context, so the *resolved* theme travels
   * in the payload rather than being re-derived there.
   */
  theme: 'light' | 'dark';
  /** "August 2026" / "elokuu 2026" — the calendar's heading. */
  monthLabel: string;
  /** "MA".."SU" — the calendar's axis. */
  weekdayLabels: string[];
  /**
   * The month, Monday-first, four to six rows of seven. Shorter than
   * `HOME_WIDGET_MONTH_ROWS` for most months; the native side hides the rest.
   */
  monthWeeks: HomeWidgetDay[][];
  /** Exactly three, in the order the 4×2 draws them. */
  stats: HomeWidgetStat[];
  /** Consecutive weeks with something logged in them, as the app counts them. */
  streakValue: string;
  /** "weeks in a row", pre-translated and already plural-aware. */
  streakLabel: string;
  /** "Monday" — today's weekday, or the eyebrow of whatever prompt replaced it. */
  routineWhen: string;
  /** Today's session, "Rest day", or what to go and do instead. */
  routineTitle: string;
  /** Where the routine widget's arrow goes. */
  routineTarget: HomeWidgetTarget;
}

export interface HomeWidgetInput {
  nowMs: number;
  language: AppLanguage;
  /** The theme the app actually resolved — already through the Pro gate. */
  theme: 'light' | 'dark';
  planName: string | null;
  /**
   * The programme the app would recommend, already presented — the curated
   * title, resolved by the caller because the catalog and its presentation
   * dictionary are not this function's business.
   *
   * Null when onboarding never produced a recommendation, and the empty state
   * falls back to asking rather than naming something it does not have.
   */
  suggestion?: { title: string } | null;
  /** Monday-first indexes from setupAvailableDays. Empty = unknown. */
  trainingDayIndexes: number[];
  /**
   * Day-start timestamps of every logged activity, workouts and cardio alike —
   * the same set the app's own activity strip counts, so the calendar cannot
   * mark a day free that the app calls trained.
   */
  completedDayStarts?: number[];
  /**
   * Day-start timestamps of completed *workouts* only. Narrower than the set
   * above on purpose: the pips answer "did anything happen that day", and a run
   * is an answer to that. Whether today's session is behind you is a different
   * question, and a run is not an answer to it — counted there, a morning of
   * cardio would make the widget name tomorrow's workout while Home still
   * offers today's.
   */
  completedWorkoutDayStarts?: number[];
  sessions: HomeDaySessionSummary[];
  /**
   * This month's totals, from `getMonthTrainingTotals`. Absent means zeroes:
   * the stats are drawn either way, because a month with nothing in it is a
   * true answer and a blank column is not.
   */
  monthTotals?: { workouts: number; durationMinutes: number; volumeKg: number };
  /** From `getCurrentWeekStreak`. Absent counts as no streak. */
  weekStreak?: number;
}

function toDayStartMs(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function weekdayIndexOf(date: Date) {
  // 0 = Monday, matching the rest of the app.
  return date.getDay() === 0 ? 6 : date.getDay() - 1;
}

export interface HomeWidgetNextSession {
  session: HomeDaySessionSummary;
  /** Days from today. 0 only when today is a training day still to be done. */
  offset: number;
  weekdayIndex: number;
}

/**
 * The session the widget names, and how far away it is.
 *
 * Shared with the app so a tap on the widget opens the same workout the widget
 * was showing: the link says "the session you named", and this is what names
 * it. Today is skipped once its workout has been logged — pointing at a session
 * that is already done is worse than pointing at the next one. Workouts only:
 * cardio marks the day on the calendar without finishing what was planned for
 * it.
 */
export function findHomeWidgetNextSession(input: {
  nowMs: number;
  trainingDayIndexes: number[];
  sessions: HomeDaySessionSummary[];
  completedWorkoutDayStarts?: number[];
}): HomeWidgetNextSession | null {
  const { nowMs, trainingDayIndexes, sessions } = input;
  if (trainingDayIndexes.length === 0 || sessions.length === 0) {
    return null;
  }

  const now = new Date(nowMs);
  const doneDays = new Set((input.completedWorkoutDayStarts ?? []).map((ms) => toDayStartMs(new Date(ms))));
  const labels = getMondayFirstWeekdayLabels();

  for (let offset = 0; offset <= LOOKAHEAD_DAYS; offset += 1) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    const weekdayIndex = weekdayIndexOf(date);
    if (!trainingDayIndexes.includes(weekdayIndex)) {
      continue;
    }
    if (offset === 0 && doneDays.has(toDayStartMs(date))) {
      continue;
    }

    const view = getHomeDayView(
      {
        weekdayIndex,
        weekdayLabel: labels[weekdayIndex] ?? '',
        dateLabel: '',
        label: '',
        isToday: offset === 0,
      },
      trainingDayIndexes,
      sessions,
    );

    if (view.kind !== 'training' || !view.session) {
      continue;
    }

    return { session: view.session, offset, weekdayIndex };
  }

  return null;
}

/**
 * Today's session, or null on a rest day. The same mapping Home draws, so the
 * two cannot disagree about what today is for.
 */
function todaySession(
  nowMs: number,
  trainingDayIndexes: number[],
  sessions: HomeDaySessionSummary[],
): HomeDaySessionSummary | null {
  if (trainingDayIndexes.length === 0 || sessions.length === 0) {
    return null;
  }

  const weekdayIndex = weekdayIndexOf(new Date(nowMs));
  const view = getHomeDayView(
    {
      weekdayIndex,
      weekdayLabel: getMondayFirstWeekdayLabels()[weekdayIndex] ?? '',
      dateLabel: '',
      label: '',
      isToday: true,
    },
    trainingDayIndexes,
    sessions,
  );

  return view.kind === 'training' ? view.session : null;
}

function buildStats(language: AppLanguage, totals: HomeWidgetInput['monthTotals']): HomeWidgetStat[] {
  const workouts = totals?.workouts ?? 0;
  const minutes = totals?.durationMinutes ?? 0;
  const volume = totals?.volumeKg ?? 0;

  return [
    { label: t(language, 'widget.stat.workouts'), value: `${workouts}` },
    { label: t(language, 'widget.stat.duration'), value: formatDurationMinutes(minutes) },
    { label: t(language, 'widget.stat.volume'), value: formatCompactVolume(volume) },
  ];
}

export function buildHomeWidgetPayload(input: HomeWidgetInput): HomeWidgetPayload {
  const { nowMs, language, theme, trainingDayIndexes, sessions } = input;
  const now = new Date(nowMs);
  const todayStart = toDayStartMs(now);
  const doneDays = new Set((input.completedDayStarts ?? []).map((ms) => toDayStartMs(new Date(ms))));

  // A rhythm is only real when there is something to do on those days. Without
  // sessions, a "planned" pip would promise a workout that does not exist.
  const scheduleKnown = trainingDayIndexes.length > 0 && sessions.length > 0;

  // The month the reader is in, built by the same function the app's own
  // calendar screen uses — including which days belong to the neighbouring
  // months, which a Monday-first grid always drags in.
  const month = getHomeMonthCalendar(now, language);
  const monthWeeks: HomeWidgetDay[][] = month.weeks.map((week) =>
    week.map((day) => {
      const isPast = day.dayStart < todayStart;
      const isTraining = scheduleKnown && trainingDayIndexes.includes(day.weekdayIndex);

      // A past training day that was never logged draws as free. The history is
      // a record of what happened, and the home screen is no place to be
      // reminded of what did not.
      const state: HomeWidgetDayState = doneDays.has(day.dayStart)
        ? 'done'
        : !isPast && isTraining
          ? 'plan'
          : 'off';

      // The days either side of the month are drawn as nothing at all. They are
      // there to keep the columns honest, not to be read.
      return {
        dateLabel: day.inMonth ? `${day.dayOfMonth}` : '',
        isToday: day.isToday,
        inMonth: day.inMonth,
        state: day.inMonth ? state : 'off',
      };
    }),
  );

  const streak = Math.max(0, Math.round(input.weekStreak ?? 0));

  const base = {
    version: HOME_WIDGET_PAYLOAD_VERSION,
    updatedAt: new Date(nowMs).toISOString(),
    theme,
    monthLabel: month.monthLabel,
    weekdayLabels: [...month.weekdayLabels],
    monthWeeks,
    stats: buildStats(language, input.monthTotals),
    streakValue: `${streak}`,
    streakLabel: t(language, streak === 1 ? 'cal.streakOne' : 'cal.streak'),
  };
  const planName = input.planName?.trim() ?? '';

  // No program. The widget knows which one the app would recommend, so it names
  // that instead of asking an empty question — and the tap opens that programme
  // rather than the catalog it came from.
  const suggestion = input.suggestion?.title.trim() ? input.suggestion : null;
  if (sessions.length === 0 && !planName) {
    if (suggestion) {
      return {
        ...base,
        routineWhen: t(language, 'widget.suggested'),
        routineTitle: suggestion.title,
        routineTarget: 'suggestion',
      };
    }

    return {
      ...base,
      routineWhen: t(language, 'widget.noPlan'),
      routineTitle: t(language, 'widget.pickPlan'),
      routineTarget: 'programs',
    };
  }

  // A named plan with nothing in it: the name is true, the rhythm is not.
  if (sessions.length === 0) {
    return {
      ...base,
      routineWhen: planName,
      routineTitle: t(language, 'widget.noSessions'),
      routineTarget: 'programs',
    };
  }

  // A program, but no days picked. The plan name borrows the eyebrow — the only
  // place in the family it appears — and the prompt points at the editor.
  if (trainingDayIndexes.length === 0) {
    return {
      ...base,
      routineWhen: planName || t(language, 'widget.noPlan'),
      routineTitle: t(language, 'widget.noDays'),
      routineTarget: 'schedule',
    };
  }

  // The ordinary day. The eyebrow names the weekday rather than saying "today",
  // because the widget sits on a home screen the reader is not reading closely:
  // the day it is is the fact that dates the rest of the card.
  const weekdayIndex = weekdayIndexOf(now);
  const session = todaySession(nowMs, trainingDayIndexes, sessions);

  return {
    ...base,
    routineWhen: t(language, `widget.weekday.${weekdayIndex}` as 'widget.weekday.0'),
    routineTitle: session ? session.title : t(language, 'widget.restDay'),
    // Nothing to start on a rest day, and the next session is two days of rest
    // away as often as not — so the arrow opens Home rather than a workout the
    // reader is not doing today.
    routineTarget: session ? 'session' : 'home',
  };
}
