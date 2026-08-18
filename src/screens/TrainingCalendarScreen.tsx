import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { CutSurface } from '../components/CutSurface';
import { I18nKey, t } from '../lib/i18n';
import {
  buildTrainingCalendar,
  summarizeTrainingMonth,
  TrainingCalendarDay,
} from '../lib/trainingCalendar';
import { Theme, useTheme, useThemedStyles } from '../theming';
import type { AppLanguage, WorkoutSession } from '../types/models';
import { removeTrailingZeros } from '../lib/format';

/**
 * The training month.
 *
 * A list answers "what did I do"; a calendar answers "how often, and where are
 * the gaps" — which is the question a streak is really about, and the one the
 * app could not answer anywhere. Tapping a day opens what was logged that day
 * rather than navigating away, so the month stays on screen while you read it.
 */

export interface CalendarDaySummary {
  sessionId: string;
  title: string;
  durationMinutes: number | null;
  exercises: number;
  sets: number;
  volumeKg: number;
  topLift: { name: string; weightKg: number; reps: number } | null;
  swaps: number;
  note: string | null;
}

interface TrainingCalendarScreenProps {
  language?: AppLanguage;
  sessions: WorkoutSession[];
  /** Resolves the detail for a tapped day. Null when nothing was logged. */
  resolveDay: (sessionIds: string[]) => CalendarDaySummary | null;
  onBack: () => void;
  onOpenSession: (sessionId: string) => void;
  onStartWorkout: () => void;
}

function formatVolume(kg: number, language: AppLanguage) {
  if (kg >= 1000) {
    const tons = Math.round(kg / 100) / 10;
    return `${removeTrailingZeros(tons)} t`;
  }
  return `${Math.round(kg)} kg`;
}

/** "15.7.2026 · keskiviikko" — the date, then the day it fell on. */
const FULL_WEEKDAY_KEYS: I18nKey[] = [
  'cal.day.sun',
  'cal.day.mon',
  'cal.day.tue',
  'cal.day.wed',
  'cal.day.thu',
  'cal.day.fri',
  'cal.day.sat',
];

function formatSelectedDay(
  day: TrainingCalendarDay | null,
  monthLabel: string,
  language: AppLanguage,
) {
  if (!day) {
    return monthLabel;
  }
  const date = new Date(day.dayStart);
  const stamp =
    language === 'fi'
      ? `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}`
      : `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
  return `${stamp} · ${t(language, FULL_WEEKDAY_KEYS[date.getDay()])}`;
}

export function TrainingCalendarScreen({
  language = 'en',
  sessions,
  resolveDay,
  onBack,
  onOpenSession,
  onStartWorkout,
}: TrainingCalendarScreenProps) {
  const styles = useThemedStyles(makeStyles);
  const theme = useTheme();
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const calendar = buildTrainingCalendar(sessions, { language, monthOffset });
  const summary = summarizeTrainingMonth(sessions, calendar.year, calendar.month);
  const days = calendar.weeks.flat();
  const selected = selectedDay === null ? null : days.find((day) => day.dayStart === selectedDay) ?? null;
  const detail = selected ? resolveDay(selected.sessionIds) : null;

  const arrow = (direction: 'prev' | 'next') => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t(language, direction === 'prev' ? 'common.back' : 'common.next')}
      onPress={() => {
        setSelectedDay(null);
        setMonthOffset((value) => value + (direction === 'prev' ? -1 : 1));
      }}
      hitSlop={8}
      style={styles.arrow}
    >
      <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
        <Path
          d={direction === 'prev' ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'}
          stroke={theme.ink}
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </Pressable>
  );

  const dayStyle = (day: TrainingCalendarDay) => {
    if (day.dayStart === selectedDay) {
      return [styles.day, styles.daySelected];
    }
    if (day.sessionIds.length > 0) {
      return [styles.day, styles.dayTrained];
    }
    if (day.isToday) {
      return [styles.day, styles.dayToday];
    }
    return [styles.day, styles.dayRest];
  };

  const dayTextStyle = (day: TrainingCalendarDay) => {
    if (day.dayStart === selectedDay || day.sessionIds.length > 0) {
      return [styles.dayText, styles.dayTextOn];
    }
    if (day.isToday) {
      return [styles.dayText, styles.dayTextToday];
    }
    return [styles.dayText];
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(language, 'common.back')}
          onPress={onBack}
          hitSlop={10}
          style={styles.backButton}
        >
          <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
            <Path d="M15 6l-6 6 6 6" stroke={theme.ink} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
        <Text style={styles.headerTitle}>{t(language, 'cal.screen')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.monthRow}>
            {arrow('prev')}
            <Text style={styles.monthLabel}>{calendar.monthLabel}</Text>
            {arrow('next')}
          </View>

          <View style={styles.weekdayRow}>
            {calendar.weekdayLabels.map((label, index) => (
              <Text key={index} style={styles.weekdayLabel}>
                {label.toLowerCase()}
              </Text>
            ))}
          </View>

          {calendar.weeks.map((week, weekIndex) => (
            <View key={weekIndex} style={styles.weekRow}>
              {week.map((day) =>
                // A day from the neighbouring month is padding. Drawing its
                // number puts a date on screen that belongs to a month the
                // reader is not looking at — and it rendered as the boldest
                // thing in the grid.
                !day.inMonth ? (
                  <View key={day.dayStart} style={styles.day} />
                ) : (
                <Pressable
                  key={day.dayStart}
                  accessibilityRole="button"
                  disabled={!day.inMonth || day.sessionIds.length === 0}
                  onPress={() => setSelectedDay(day.dayStart === selectedDay ? null : day.dayStart)}
                  style={dayStyle(day)}
                >
                  <Text style={dayTextStyle(day)}>{day.dayOfMonth}</Text>
                </Pressable>
                ),
              )}
            </View>
          ))}

          <View style={styles.summaryRow}>
            {[
              { label: 'cal.stat.sessions' as const, value: `${summary.sessions}` },
              { label: 'cal.stat.volume' as const, value: formatVolume(summary.volumeKg, language) },
              {
                label: 'cal.stat.avg' as const,
                value: summary.averageMinutes === null ? '—' : `${summary.averageMinutes} min`,
              },
            ].map((stat) => (
              <View key={stat.label} style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>{t(language, stat.label)}</Text>
                <Text style={styles.summaryValue}>{stat.value}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* The day you tapped, from what the session actually recorded. */}
        {detail ? (
          <View style={styles.daySection}>
            <View style={styles.dayHeadRow}>
              {/* The day, not the month: the month is already the header two
                  inches above, and this card is about one square in it. */}
              <Text style={styles.sectionLabel}>
                {formatSelectedDay(selected, calendar.monthLabel, language).toUpperCase()}
              </Text>
              <Pressable onPress={() => onOpenSession(detail.sessionId)} hitSlop={8}>
                <Text style={styles.link}>{t(language, 'cal.openSession')}</Text>
              </Pressable>
            </View>
            <View style={styles.card}>
              <View style={styles.dayTopRow}>
                <View style={styles.dayCopy}>
                  <Text style={styles.dayTitle} numberOfLines={1}>
                    {detail.title}
                  </Text>
                  <Text style={styles.dayMeta}>
                    {t(language, 'cal.dayMeta', {
                      minutes: detail.durationMinutes ?? 0,
                      exercises: detail.exercises,
                      sets: detail.sets,
                    })}
                  </Text>
                </View>
                <View style={styles.dayVolume}>
                  <Text style={styles.dayVolumeValue}>{formatVolume(detail.volumeKg, language)}</Text>
                  <Text style={styles.dayVolumeLabel}>{t(language, 'cal.volume')}</Text>
                </View>
              </View>

              {detail.topLift ? (
                <View style={styles.chipRow}>
                  <View style={styles.chip}>
                    <Text style={styles.chipText}>
                      {t(language, 'cal.topLift', {
                        name: detail.topLift.name,
                        weight: removeTrailingZeros(detail.topLift.weightKg),
                        reps: detail.topLift.reps,
                      })}
                    </Text>
                  </View>
                </View>
              ) : null}

              {detail.swaps > 0 ? (
                <View style={styles.chipRow}>
                  <View style={[styles.chip, styles.chipAmber]}>
                    <Text style={[styles.chipText, styles.chipTextAmber]}>
                      {t(language, 'cal.swaps', { count: detail.swaps })}
                    </Text>
                  </View>
                </View>
              ) : null}

              {detail.note ? <Text style={styles.dayNote}>{`”${detail.note}”`}</Text> : null}
            </View>
          </View>
        ) : null}

        {/* A month with nothing in it says so rather than showing a bare grid. */}
        {summary.sessions === 0 ? (
          <View style={[styles.card, styles.emptyCard]}>
            <View style={styles.emptyIcon}>
              <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M3.5 8.5a3.5 3.5 0 013.5-3.5h10a3.5 3.5 0 013.5 3.5v8a3.5 3.5 0 01-3.5 3.5H7a3.5 3.5 0 01-3.5-3.5z M3.5 10h17M8 3v4M16 3v4"
                  stroke={theme.purple}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </View>
            <Text style={styles.emptyTitle}>
              {t(language, 'cal.empty.title', { month: calendar.monthLabel })}
            </Text>
            <Text style={styles.emptyBody}>{t(language, 'cal.empty.body')}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={onStartWorkout}
              style={({ pressed }) => [pressed && styles.pressed]}
            >
              <CutSurface size="lg" fill={theme.purple} style={styles.emptyCta}>
                <Text style={styles.emptyCtaText}>{t(language, 'pr.empty.cta')}</Text>
              </CutSurface>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 12,
  },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: theme.ink,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 132,
  },
  pressed: {
    opacity: 0.85,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    padding: 15,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  arrow: {
    width: 30,
    height: 30,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabel: {
    color: theme.ink,
    fontSize: 15.5,
    lineHeight: 20,
    fontWeight: '800',
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    color: theme.faint,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '800',
  },
  weekRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  day: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 11,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayRest: {
    backgroundColor: '#F1ECFB',
  },
  dayTrained: {
    backgroundColor: theme.purple,
  },
  daySelected: {
    backgroundColor: '#5B21B6',
    // A halo, so the selected day reads as selected next to the trained days
    // it shares a colour family with.
    borderWidth: 3,
    borderColor: 'rgba(124, 58, 237, 0.22)',
  },
  dayToday: {
    backgroundColor: '#EFE7FF',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: theme.purple,
  },
  dayText: {
    color: theme.faint,
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: '700',
  },
  dayTextOn: {
    color: '#FFFFFF',
  },
  dayTextToday: {
    color: '#5B21B6',
  },
  summaryRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: theme.border,
    marginTop: 5,
    paddingTop: 13,
  },
  summaryItem: {
    flex: 1,
  },
  summaryLabel: {
    color: theme.faint,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  summaryValue: {
    color: theme.ink,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginTop: 3,
  },
  daySection: {
    marginTop: 18,
  },
  dayHeadRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    marginBottom: 10,
  },
  sectionLabel: {
    color: theme.faint,
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: '800',
    letterSpacing: 1,
  },
  link: {
    color: theme.purple,
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: '800',
  },
  dayTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dayCopy: {
    flex: 1,
    minWidth: 0,
  },
  dayTitle: {
    color: theme.ink,
    fontSize: 15.5,
    lineHeight: 20,
    fontWeight: '800',
  },
  dayMeta: {
    color: theme.muted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    marginTop: 2,
  },
  dayVolume: {
    alignItems: 'flex-end',
  },
  dayVolumeValue: {
    color: theme.ink,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
  },
  dayVolumeLabel: {
    color: theme.faint,
    fontSize: 10.5,
    lineHeight: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 11,
  },
  chip: {
    borderRadius: 999,
    backgroundColor: '#EFE7FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipAmber: {
    backgroundColor: '#FBEFDD',
  },
  chipText: {
    color: '#5B21B6',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  chipTextAmber: {
    color: '#9A5B16',
  },
  dayNote: {
    color: theme.muted,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
    fontStyle: 'italic',
    marginTop: 11,
  },
  emptyCard: {
    alignItems: 'center',
    marginTop: 18,
    paddingVertical: 30,
  },
  emptyIcon: {
    width: 62,
    height: 62,
    borderRadius: 20,
    backgroundColor: '#EFE7FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    color: theme.ink,
    fontSize: 17.5,
    lineHeight: 23,
    fontWeight: '800',
    letterSpacing: -0.2,
    marginTop: 16,
    textAlign: 'center',
  },
  emptyBody: {
    color: theme.muted,
    fontSize: 13.5,
    lineHeight: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 260,
  },
  emptyCta: {
    marginTop: 18,
    height: 46,
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCtaText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    lineHeight: 19,
    fontWeight: '800',
  },
});
