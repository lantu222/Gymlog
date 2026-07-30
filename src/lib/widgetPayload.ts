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
export const HOME_WIDGET_PAYLOAD_VERSION = 1;

export interface HomeWidgetDay {
  /** "MA" / "MON". */
  label: string;
  /** Day of month, e.g. "30". */
  dateLabel: string;
  isToday: boolean;
  isTraining: boolean;
}

export interface HomeWidgetPayload {
  version: number;
  updatedAt: string;
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
}

/** How far ahead to look for the next training day before giving up. */
const LOOKAHEAD_DAYS = 14;

export interface HomeWidgetInput {
  nowMs: number;
  language: AppLanguage;
  planName: string | null;
  /** Monday-first indexes from setupAvailableDays. Empty = unknown. */
  trainingDayIndexes: number[];
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
  const { nowMs, language, trainingDayIndexes, sessions } = input;
  const labels = getMondayFirstWeekdayLabels(language);
  const now = new Date(nowMs);
  const weekStart = new Date(getCalendarWeekStartTimestamp(now));
  const todayIndex = weekdayIndexOf(now);

  const days: HomeWidgetDay[] = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + index);
    return {
      label: labels[index] ?? '',
      dateLabel: String(date.getDate()),
      isToday: index === todayIndex,
      isTraining: trainingDayIndexes.includes(index),
    };
  });

  const planName = input.planName?.trim() ? input.planName.trim() : t(language, 'widget.noPlan');

  // No days picked, or no sessions to name: say so rather than invent a rhythm.
  if (trainingDayIndexes.length === 0 || sessions.length === 0) {
    return {
      version: HOME_WIDGET_PAYLOAD_VERSION,
      updatedAt: new Date(nowMs).toISOString(),
      planName,
      days,
      hasNext: false,
      nextTitle: t(language, trainingDayIndexes.length === 0 ? 'widget.noDays' : 'widget.noSessions'),
      nextWhen: '',
      nextMeta: '',
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
      planName,
      days,
      hasNext: true,
      nextTitle: view.session.title,
      nextWhen: whenLabel(language, offset, labels[weekdayIndex] ?? ''),
      nextMeta: duration ? `${duration} · ${countLabel}` : countLabel,
    };
  }

  return {
    version: HOME_WIDGET_PAYLOAD_VERSION,
    updatedAt: new Date(nowMs).toISOString(),
    planName,
    days,
    hasNext: false,
    nextTitle: t(language, 'widget.noSessions'),
    nextWhen: '',
    nextMeta: '',
  };
}
