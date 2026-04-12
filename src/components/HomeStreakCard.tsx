import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SurfaceCard } from './MainScreenPrimitives';
import { HomeStreakSummary } from '../lib/dashboard';
import { formatWorkoutDisplayLabel } from '../lib/displayLabel';
import { colors, radii, spacing } from '../theme';

export interface HomeActiveWorkoutSummary {
  title: string;
  nextExercise: string | null;
  meta: string;
}

export interface HomeUpcomingSessionSummary {
  label: string;
  title: string;
  meta?: string;
}

interface HomeStreakCardProps {
  streak: HomeStreakSummary;
  upcomingSessions: HomeUpcomingSessionSummary[];
  onOpenStreak?: () => void;
  title?: string;
  subtitle?: string;
  pillLabel?: string;
  showActivity?: boolean;
  tone?: 'dark' | 'light';
}

export function HomeStreakCard({
  streak,
  upcomingSessions,
  onOpenStreak,
  title = 'This week',
  subtitle,
  pillLabel,
  showActivity = true,
  tone = 'dark',
}: HomeStreakCardProps) {
  const activityDays = streak.activity.days.slice(-7);
  const resolvedSubtitle = subtitle ?? `${streak.sessionsThisWeek} sessions so far`;
  const resolvedPillLabel = pillLabel ?? `${streak.sessionsLast30Days} in 30d`;
  const isLight = tone === 'light';

  return (
    <SurfaceCard
      accent="neutral"
      emphasis="flat"
      onPress={onOpenStreak}
      style={[styles.card, isLight && styles.cardLight]}
    >
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, isLight && styles.titleLight]}>{title}</Text>
          <Text style={[styles.meta, isLight && styles.metaLight]}>{resolvedSubtitle}</Text>
        </View>
        <View style={[styles.weeklyPill, isLight && styles.weeklyPillLight]}>
          <Text style={[styles.weeklyPillText, isLight && styles.weeklyPillTextLight]}>{resolvedPillLabel}</Text>
        </View>
      </View>

      <View style={styles.sessionList}>
        {upcomingSessions.length ? (
          upcomingSessions.map((session) => (
            <View key={`${session.label}:${session.title}`} style={[styles.sessionRow, isLight && styles.sessionRowLight]}>
              <View style={[styles.dayChip, isLight && styles.dayChipLight]}>
                <Text style={[styles.dayChipText, isLight && styles.dayChipTextLight]}>{session.label}</Text>
              </View>
              <View style={styles.sessionCopy}>
                <Text style={[styles.sessionTitle, isLight && styles.sessionTitleLight]}>
                  {formatWorkoutDisplayLabel(session.title, 'Workout')}
                </Text>
                {session.meta ? <Text style={[styles.sessionMeta, isLight && styles.sessionMetaLight]}>{session.meta}</Text> : null}
              </View>
            </View>
          ))
        ) : (
          <View style={[styles.emptyState, isLight && styles.emptyStateLight]}>
            <Text style={[styles.emptyTitle, isLight && styles.emptyTitleLight]}>No plan on deck</Text>
            <Text style={[styles.emptyMeta, isLight && styles.emptyMetaLight]}>Open a ready plan and your week will show up here.</Text>
          </View>
        )}
      </View>

      {showActivity ? (
        <View style={styles.activityRow}>
          {activityDays.map((day) => (
            <View key={day.dayStart} style={styles.activityItem}>
              <Text
                style={[
                  styles.activityLabel,
                  isLight && styles.activityLabelLight,
                  day.isToday && styles.activityLabelToday,
                  isLight && day.isToday && styles.activityLabelTodayLight,
                ]}
              >
                {day.weekdayLabel}
              </Text>
              <View
                style={[
                  styles.activityDot,
                  isLight && styles.activityDotLight,
                  day.active && styles.activityDotActive,
                  isLight && day.active && styles.activityDotActiveLight,
                  day.isToday && styles.activityDotToday,
                  isLight && day.isToday && styles.activityDotTodayLight,
                ]}
              />
            </View>
          ))}
        </View>
      ) : null}
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: '#050505',
    borderColor: 'rgba(255,255,255,0.10)',
  },
  cardLight: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(5,5,5,0.10)',
    shadowOpacity: 0.08,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  titleLight: {
    color: '#050505',
  },
  meta: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  metaLight: {
    color: 'rgba(5,5,5,0.56)',
  },
  weeklyPill: {
    minHeight: 32,
    borderRadius: radii.pill,
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  weeklyPillLight: {
    backgroundColor: '#F3F3F3',
    borderColor: 'rgba(5,5,5,0.08)',
  },
  weeklyPillText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  weeklyPillTextLight: {
    color: '#050505',
  },
  sessionList: {
    gap: spacing.sm,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sessionRowLight: {
    backgroundColor: '#F7F7F7',
    borderColor: 'rgba(5,5,5,0.08)',
  },
  dayChip: {
    width: 58,
    minHeight: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  dayChipLight: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(5,5,5,0.10)',
  },
  dayChipText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  dayChipTextLight: {
    color: '#050505',
  },
  sessionCopy: {
    flex: 1,
    gap: 3,
  },
  sessionTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  sessionTitleLight: {
    color: '#050505',
  },
  sessionMeta: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  sessionMetaLight: {
    color: 'rgba(5,5,5,0.54)',
  },
  emptyState: {
    gap: 4,
    padding: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  emptyStateLight: {
    backgroundColor: '#F7F7F7',
    borderColor: 'rgba(5,5,5,0.08)',
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  emptyTitleLight: {
    color: '#050505',
  },
  emptyMeta: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  emptyMetaLight: {
    color: 'rgba(5,5,5,0.56)',
  },
  activityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  activityItem: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  activityLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  activityLabelToday: {
    color: colors.textPrimary,
  },
  activityLabelLight: {
    color: 'rgba(5,5,5,0.42)',
  },
  activityLabelTodayLight: {
    color: '#050505',
  },
  activityDot: {
    width: '100%',
    height: 6,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  activityDotLight: {
    backgroundColor: 'rgba(5,5,5,0.10)',
  },
  activityDotActive: {
    backgroundColor: 'rgba(255,255,255,0.46)',
  },
  activityDotActiveLight: {
    backgroundColor: 'rgba(5,5,5,0.38)',
  },
  activityDotToday: {
    backgroundColor: '#FFFFFF',
  },
  activityDotTodayLight: {
    backgroundColor: '#050505',
  },
});
