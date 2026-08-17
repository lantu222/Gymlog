/**
 * The home-screen widget's contents, computed here and handed to Kotlin as
 * finished strings.
 *
 * The widget renders text and coloured bars, nothing else: no dates, no
 * pluralisation, no translation on the native side. Every one of those has
 * already gone wrong once in this app, and a widget is the worst place to find
 * out — it is drawn by the launcher, in a process with none of the app's
 * context.
 *
 * The week and the session mapping come from `getHomeDayView`, the same
 * function Home renders, so the widget cannot claim a training day the app
 * would call a rest day.
 *
 * SHAPE (v3, "kalenteri" design). The calendar is the whole widget: four weeks
 * — two past, the current one, the next one — where every day is `done`, `plan`
 * or `off`, and today is marked on a second axis (a double-height bar) so it
 * can be today *and* done. Everything the old version drew around the calendar
 * (wordmark, plan pill, duration + exercise count, Start button) is gone.
 */
import { getCalendarWeekStartTimestamp } from './completedSessions';
import { getHomeDayView, getMondayFirstWeekdayLabels, HomeDaySessionSummary } from './homeCalendar';
import { t } from './i18n';
import { AppLanguage } from '../types/models';

/** Bumped whenever the shape changes, so a stale file is ignored, not misread. */
export const HOME_WIDGET_PAYLOAD_VERSION = 4;

/** Two past weeks, this week, next week. */
export const HOME_WIDGET_WEEK_COUNT = 4;

/**
 * Which row of `weeks` is the current one. The small sizes draw only this row,
 * so the index is exported rather than spelled out again on the native side.
 */
export const HOME_WIDGET_CURRENT_WEEK_INDEX = 2;

/** How far ahead to look for the next training day before giving up. */
const LOOKAHEAD_DAYS = 14;

/**
 * What a bar says. Three states, not four: "today" used to be one of them,
 * which meant a day could not be today *and* done at once — and "you already
 * did it" is the one thing you glance at a home screen to find out. Today is
 * now a separate flag the native side draws as a taller bar.
 */
export type HomeWidgetDayState = 'done' | 'plan' | 'off';

/**
 * Where a tap goes. Slugs, not routes: the app resolves them against live
 * state when it opens, because the file the widget reads can be half an hour
 * old and an id baked into a link would be older still.
 */
export type HomeWidgetTarget = 'session' | 'calendar' | 'home' | 'programs' | 'schedule';

export interface HomeWidgetDay {
  /** Day of month, e.g. "30". */
  dateLabel: string;
  isToday: boolean;
  state: HomeWidgetDayState;
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
  /** "MA".."SU" — the calendar's axis, shared by all four rows. */
  weekdayLabels: string[];
  /** Four rows of seven. Index `HOME_WIDGET_CURRENT_WEEK_INDEX` is this week. */
  weeks: HomeWidgetDay[][];
  /**
   * The one element that is clearly the largest: "2/3" — sessions logged this
   * week against the days planned for it. Every widget on the phone anchors on
   * one big number and ours had none, which is what made a card full of small
   * even marks read as empty.
   *
   * Just the count ("2") when no days are planned: with no rhythm there is no
   * denominator, and "2/0" is not a fraction.
   */
  weekCount: string;
  /** "This week" — the label under it, pre-translated like everything else. */
  weekCountLabel: string;
  /** "Today" / "Tomorrow" / "Wednesday", or the plan's name in the setup states. */
  when: string;
  /** The session's name — or, when `isPrompt`, what to go and do instead. */
  title: string;
  /** True when `title` is an instruction rather than a workout. */
  isPrompt: boolean;
  /** Where tapping the named workout goes. */
  textTarget: HomeWidgetTarget;
  /**
   * Where tapping the 2×2 goes — the one size with no words, and therefore one
   * target rather than three. Differs from `textTarget` on a rest day and once
   * today is logged: there is nothing to start, so it opens Home rather than a
   * workout the reader is not doing today. The wider sizes name the workout in
   * text, so their card tap is always Home.
   */
  cardTarget: HomeWidgetTarget;
}

export interface HomeWidgetInput {
  nowMs: number;
  language: AppLanguage;
  /** The theme the app actually resolved — already through the Pro gate. */
  theme: 'light' | 'dark';
  planName: string | null;
  /** Monday-first indexes from setupAvailableDays. Empty = unknown. */
  trainingDayIndexes: number[];
  /**
   * Day-start timestamps of every logged activity, workouts and cardio alike —
   * the same set the app's own activity strip counts, so the calendar cannot
   * mark a day free that the app calls trained.
   */
  completedDayStarts?: number[];
  sessions: HomeDaySessionSummary[];
}

function toDayStartMs(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function weekdayIndexOf(date: Date) {
  // 0 = Monday, matching the rest of the app.
  return date.getDay() === 0 ? 6 : date.getDay() - 1;
}

function whenLabel(language: AppLanguage, offset: number, weekdayIndex: number) {
  if (offset === 0) {
    return t(language, 'widget.today');
  }
  if (offset === 1) {
    return t(language, 'widget.tomorrow');
  }
  return t(language, `widget.weekdayOn.${weekdayIndex}` as 'widget.weekdayOn.0');
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
 * it. Today is skipped once it has been logged — pointing at a workout that is
 * already done is worse than pointing at the next one.
 */
export function findHomeWidgetNextSession(input: {
  nowMs: number;
  trainingDayIndexes: number[];
  sessions: HomeDaySessionSummary[];
  completedDayStarts?: number[];
}): HomeWidgetNextSession | null {
  const { nowMs, trainingDayIndexes, sessions } = input;
  if (trainingDayIndexes.length === 0 || sessions.length === 0) {
    return null;
  }

  const now = new Date(nowMs);
  const doneDays = new Set((input.completedDayStarts ?? []).map((ms) => toDayStartMs(new Date(ms))));
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

export function buildHomeWidgetPayload(input: HomeWidgetInput): HomeWidgetPayload {
  const { nowMs, language, theme, trainingDayIndexes, sessions } = input;
  const now = new Date(nowMs);
  const todayStart = toDayStartMs(now);
  const doneDays = new Set((input.completedDayStarts ?? []).map((ms) => toDayStartMs(new Date(ms))));

  // A rhythm is only real when there is something to do on those days. Without
  // sessions, a "planned" bar would promise a workout that does not exist.
  const scheduleKnown = trainingDayIndexes.length > 0 && sessions.length > 0;

  // The grid starts two Mondays before this week's Monday.
  const weekStart = new Date(getCalendarWeekStartTimestamp(now));
  const gridStart = new Date(
    weekStart.getFullYear(),
    weekStart.getMonth(),
    weekStart.getDate() - 7 * HOME_WIDGET_CURRENT_WEEK_INDEX,
  );

  const weeks: HomeWidgetDay[][] = Array.from({ length: HOME_WIDGET_WEEK_COUNT }, (_, weekIndex) =>
    Array.from({ length: 7 }, (_, dayIndex) => {
      // Calendar-arithmetic construction, so a DST boundary cannot shift a day.
      const date = new Date(
        gridStart.getFullYear(),
        gridStart.getMonth(),
        gridStart.getDate() + weekIndex * 7 + dayIndex,
      );
      const dayStart = date.getTime();
      const isPast = dayStart < todayStart;
      const isTraining = scheduleKnown && trainingDayIndexes.includes(dayIndex);

      // A past training day that was never logged draws as free. The history is
      // a record of what happened, and the home screen is no place to be
      // reminded of what did not.
      const state: HomeWidgetDayState = doneDays.has(dayStart) ? 'done' : !isPast && isTraining ? 'plan' : 'off';

      return { dateLabel: String(date.getDate()), isToday: dayStart === todayStart, state };
    }),
  );

  // Counted off the row the widget draws, so the number and the bars can never
  // disagree: whatever is green in this week's row is what the count counts.
  const currentWeek = weeks[HOME_WIDGET_CURRENT_WEEK_INDEX] ?? [];
  const doneThisWeek = currentWeek.filter((day) => day.state === 'done').length;
  const plannedThisWeek = scheduleKnown ? trainingDayIndexes.length : 0;

  const base = {
    version: HOME_WIDGET_PAYLOAD_VERSION,
    updatedAt: new Date(nowMs).toISOString(),
    theme,
    weekdayLabels: [...getMondayFirstWeekdayLabels(language)],
    weeks,
    weekCount: plannedThisWeek > 0 ? `${doneThisWeek}/${plannedThisWeek}` : `${doneThisWeek}`,
    weekCountLabel: t(language, 'widget.thisWeek'),
  };
  const planName = input.planName?.trim() ?? '';

  // No program: the plan name line has nothing to say, so it says that.
  if (sessions.length === 0 && !planName) {
    return {
      ...base,
      when: t(language, 'widget.noPlan'),
      title: t(language, 'widget.pickPlan'),
      isPrompt: true,
      textTarget: 'programs',
      cardTarget: 'programs',
    };
  }

  // A named plan with nothing in it: the name is true, the rhythm is not.
  if (sessions.length === 0) {
    return {
      ...base,
      when: planName,
      title: t(language, 'widget.noSessions'),
      isPrompt: true,
      textTarget: 'programs',
      cardTarget: 'programs',
    };
  }

  // A program, but no days picked. The plan name borrows the "when" line — the
  // only place in the family it appears — and the prompt points at the editor.
  if (trainingDayIndexes.length === 0) {
    return {
      ...base,
      when: planName || t(language, 'widget.noPlan'),
      title: t(language, 'widget.noDays'),
      isPrompt: true,
      textTarget: 'schedule',
      cardTarget: 'schedule',
    };
  }

  const next = findHomeWidgetNextSession({
    nowMs,
    trainingDayIndexes,
    sessions,
    completedDayStarts: input.completedDayStarts,
  });

  if (!next) {
    return {
      ...base,
      when: planName || t(language, 'widget.noPlan'),
      title: t(language, 'widget.noSessions'),
      isPrompt: true,
      textTarget: 'programs',
      cardTarget: 'programs',
    };
  }

  return {
    ...base,
    when: whenLabel(language, next.offset, next.weekdayIndex),
    title: next.session.title,
    isPrompt: false,
    textTarget: 'session',
    // The card has no words of its own, so it only offers a workout when the
    // workout is today's. Otherwise it opens Home.
    cardTarget: next.offset === 0 ? 'session' : 'home',
  };
}
