/**
 * The home-screen widget's contents, computed here and handed to Kotlin as
 * finished strings.
 *
 * The widget renders text and nothing else: no dates, no pluralisation, no
 * translation on the native side. Every one of those has already gone wrong
 * once in this app, and a widget is the worst place to find out — it is drawn
 * by the launcher, in a process with none of the app's context.
 *
 * The week and the session mapping come from `getHomeDayView`, the same
 * function Home renders, so the widget cannot claim a training day the app
 * would call a rest day.
 */
import { getCalendarWeekStartTimestamp } from './completedSessions';
import { getHomeDayView, getMondayFirstWeekdayLabels, HomeDaySessionSummary } from './homeCalendar';
import { t } from './i18n';
import { AppLanguage } from '../types/models';

/** Bumped whenever the shape changes, so a stale file is ignored, not misread. */
export const HOME_WIDGET_PAYLOAD_VERSION = 2;

/**
 * What a bar in the week strip says. Four states, because a widget that only
 * knows "training day / not" cannot tell you whether you already did it — and
 * that is the one thing you glance at a home screen to find out.
 */
export type HomeWidgetDayState = 'done' | 'today' | 'plan' | 'off';

export interface HomeWidgetDay {
  /** "MA" / "MON". */
  label: string;
  /** Day of month, e.g. "30". */
  dateLabel: string;
  isToday: boolean;
  isTraining: boolean;
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
  /** Plan name, or an honest stand-in when there is no plan. */
  planName: string;
  days: HomeWidgetDay[];
  /** False when there is nothing upcoming to name. */
  hasNext: boolean;
  nextTitle: string;
  /** "Today" / "Tomorrow" / "Thursday". */
  nextWhen: string;
  /** "~45 min · 6 exercises", or just the count when no duration is known. */
  nextMeta: string;
  /** "TODAY · THURSDAY" — the line above the title. Empty when not today. */
  dayLine: string;
  /** The button's own words, so the launcher never has to translate. */
  ctaLabel: string;
}

/** How far ahead to look for the next training day before giving up. */
const LOOKAHEAD_DAYS = 14;

export interface HomeWidgetInput {
  nowMs: number;
  language: AppLanguage;
  /** The theme the app actually resolved — already through the Pro gate. */
  theme: 'light' | 'dark';
  planName: string | null;
  /** Monday-first indexes from setupAvailableDays. Empty = unknown. */
  trainingDayIndexes: number[];
  /** Monday-first indexes of days already trained this calendar week. */
  completedWeekdayIndexes?: number[];
  sessions: HomeDaySessionSummary[];
}

function weekdayIndexOf(date: Date) {
  // 0 = Monday, matching the rest of the app.
  return date.getDay() === 0 ? 6 : date.getDay() - 1;
}

function exerciseCountLabel(language: AppLanguage, count: number) {
  return count === 1
    ? t(language, 'widget.exercise')
    : t(language, 'widget.exercises', { count });
}

function whenLabel(language: AppLanguage, offset: number, weekdayLabel: string) {
  if (offset === 0) {
    return t(language, 'widget.today');
  }
  if (offset === 1) {
    return t(language, 'widget.tomorrow');
  }
  return weekdayLabel;
}

export function buildHomeWidgetPayload(input: HomeWidgetInput): HomeWidgetPayload {
  const { nowMs, language, theme, trainingDayIndexes, sessions } = input;
  const completed = input.completedWeekdayIndexes ?? [];
  const labels = getMondayFirstWeekdayLabels(language);
  const now = new Date(nowMs);
  const weekStart = new Date(getCalendarWeekStartTimestamp(now));
  const todayIndex = weekdayIndexOf(now);

  const days: HomeWidgetDay[] = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + index);
    const isToday = index === todayIndex;
    const isTraining = trainingDayIndexes.includes(index);
    // Done outranks today: once the session is logged, "you already did it" is
    // the more useful thing for the bar to say.
    const state: HomeWidgetDayState = completed.includes(index)
      ? 'done'
      : isToday
        ? 'today'
        : isTraining
          ? 'plan'
          : 'off';
    return { label: labels[index] ?? '', dateLabel: String(date.getDate()), isToday, isTraining, state };
  });

  const planName = input.planName?.trim() ? input.planName.trim() : t(language, 'widget.noPlan');
  const ctaLabel = t(language, 'widget.start');
  const todayLine = `${t(language, 'widget.today')} · ${labels[todayIndex] ?? ''}`.trim();

  // No days picked, or no sessions to name: say so rather than invent a rhythm.
  if (trainingDayIndexes.length === 0 || sessions.length === 0) {
    return {
      version: HOME_WIDGET_PAYLOAD_VERSION,
      updatedAt: new Date(nowMs).toISOString(),
      theme,
      planName,
      days,
      hasNext: false,
      nextTitle: t(language, trainingDayIndexes.length === 0 ? 'widget.noDays' : 'widget.noSessions'),
      nextWhen: '',
      nextMeta: '',
      dayLine: '',
      ctaLabel: t(language, 'widget.openApp'),
    };
  }

  for (let offset = 0; offset <= LOOKAHEAD_DAYS; offset += 1) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    const weekdayIndex = weekdayIndexOf(date);
    if (!trainingDayIndexes.includes(weekdayIndex)) {
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

    const count = view.session.exercises.length;
    const duration = view.session.duration?.trim() ?? '';
    const countLabel = exerciseCountLabel(language, count);

    return {
      version: HOME_WIDGET_PAYLOAD_VERSION,
      updatedAt: new Date(nowMs).toISOString(),
      theme,
      planName,
      days,
      hasNext: true,
      nextTitle: view.session.title,
      nextWhen: whenLabel(language, offset, labels[weekdayIndex] ?? ''),
      nextMeta: duration ? `${duration} · ${countLabel}` : countLabel,
      // The hero line only claims 'today' when it really is today.
      dayLine: offset === 0 ? todayLine : whenLabel(language, offset, labels[weekdayIndex] ?? ''),
      ctaLabel,
    };
  }

  return {
    version: HOME_WIDGET_PAYLOAD_VERSION,
    updatedAt: new Date(nowMs).toISOString(),
    theme,
    planName,
    days,
    hasNext: false,
    nextTitle: t(language, 'widget.noSessions'),
    nextWhen: '',
    nextMeta: '',
    dayLine: '',
    ctaLabel: t(language, 'widget.openApp'),
  };
}
