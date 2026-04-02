import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SurfaceCard } from './MainScreenPrimitives';
import { HomeStreakSummary } from '../lib/dashboard';
import { formatLiftDisplayLabel, formatWorkoutDisplayLabel } from '../lib/displayLabel';
import { colors, radii, spacing } from '../theme';

export interface HomeActiveWorkoutSummary {
  title: string;
  nextExercise: string | null;
  meta: string;
}

interface HomeStreakCardProps {
  streak: HomeStreakSummary;
  activeWorkoutSummary: HomeActiveWorkoutSummary | null;
  onOpenStreak?: () => void;
  onResumeWorkout?: () => void;
}

export function HomeStreakCard({ streak, activeWorkoutSummary, onOpenStreak, onResumeWorkout }: HomeStreakCardProps) {
  const body = (
    <>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.activityTitle}>Training rhythm</Text>
          <Text style={styles.activityMeta}>{streak.sessionsLast30Days} in 30 days</Text>
        </View>

        {activeWorkoutSummary && onResumeWorkout ? (
          <Pressable
            onPress={(event) => {
              event.stopPropagation();
              onResumeWorkout();
            }}
            style={styles.playButton}
          >
            <Text style={styles.playIcon}>Open</Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.activityStrip}>
        {streak.activity.days.map((day) => (
          <View key={day.dayStart} style={styles.activityItem}>
            <Text style={[styles.activityWeekday, day.isToday && styles.activityWeekdayToday]}>{day.weekdayLabel}</Text>
            <View
              style={[
                styles.activityBar,
                day.active && styles.activityBarActive,
                day.isToday && styles.activityBarToday,
              ]}
            />
            <Text style={[styles.activityDayNumber, day.active && styles.activityDayNumberActive]}>{day.dayNumber}</Text>
          </View>
        ))}
      </ScrollView>

      {activeWorkoutSummary ? (
        <View style={styles.liveRow}>
          <View style={styles.liveCopy}>
            <Text style={styles.liveTitle}>{formatWorkoutDisplayLabel(activeWorkoutSummary.title, 'Workout')}</Text>
            {activeWorkoutSummary.nextExercise ? (
              <Text style={styles.liveSubtitle}>Next: {formatLiftDisplayLabel(activeWorkoutSummary.nextExercise)}</Text>
            ) : null}
          </View>
          <Text style={styles.liveMeta}>{activeWorkoutSummary.meta}</Text>
        </View>
      ) : null}
    </>
  );

  return (
    <SurfaceCard accent="rose" emphasis="utility" onPress={onOpenStreak} style={styles.card}>
      {body}
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  activityTitle: {
    color: '#FFF4F8',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.95,
  },
  activityMeta: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
  },
  playButton: {
    minWidth: 54,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    backgroundColor: 'rgba(150, 216, 255, 0.20)',
    borderWidth: 1,
    borderColor: 'rgba(150, 216, 255, 0.42)',
    paddingHorizontal: spacing.sm,
  },
  playIcon: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  activityStrip: {
    gap: spacing.sm,
    paddingRight: spacing.md,
  },
  activityItem: {
    alignItems: 'center',
    gap: 6,
    width: 26,
  },
  activityWeekday: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'lowercase',
  },
  activityWeekdayToday: {
    color: '#A9DBFF',
  },
  activityBar: {
    width: 12,
    height: 26,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(216, 106, 134, 0.12)',
    backgroundColor: 'rgba(11, 15, 20, 0.22)',
  },
  activityBarActive: {
    borderColor: 'rgba(216, 106, 134, 0.42)',
    backgroundColor: 'rgba(216, 106, 134, 0.40)',
  },
  activityBarToday: {
    borderColor: 'rgba(150, 216, 255, 0.62)',
  },
  activityDayNumber: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  activityDayNumberActive: {
    color: '#FFF9FB',
  },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingTop: spacing.sm,
  },
  liveCopy: {
    flex: 1,
    gap: 2,
  },
  liveTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  liveSubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  liveMeta: {
    color: '#FFF9FB',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'right',
  },
});