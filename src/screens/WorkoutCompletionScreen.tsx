import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ScreenHeader } from '../components/ScreenHeader';
import { formatDurationMinutes, formatSessionDate, formatVolume } from '../lib/format';
import { colors, radii, spacing } from '../theme';
import { UnitPreference } from '../types/models';

interface WorkoutCompletionScreenProps {
  workoutName: string;
  performedAt: string;
  durationMinutes: number;
  setsCompleted: number;
  totalVolume: number;
  exercisesLogged: number;
  unitPreference: UnitPreference;
  onDone: () => void;
  onViewProgress: () => void;
}

export function WorkoutCompletionScreen({
  workoutName,
  performedAt,
  durationMinutes,
  setsCompleted,
  totalVolume,
  exercisesLogged,
  unitPreference,
  onDone,
  onViewProgress,
}: WorkoutCompletionScreenProps) {
  return (
    <>
      <ScreenHeader title="Workout saved" subtitle={formatSessionDate(performedAt)} />
      <View style={styles.content}>
        <View style={styles.heroCard}>
          <View style={styles.heroAccent} />
          <View style={styles.heroSheen} />
          <View style={styles.heroGlowBlue} />
          <View style={styles.heroGlowOrange} />

          <View style={styles.heroTopRow}>
            <Text style={styles.heroLabel}>Session locked</Text>
            <View style={styles.savedBadge}>
              <Text style={styles.savedBadgeText}>Saved</Text>
            </View>
          </View>

          <Text style={styles.title}>{workoutName}</Text>
          <Text style={styles.subtitle}>Clean save, clear numbers, and one fast route into progress.</Text>

          <View style={styles.heroHighlight}>
            <Text style={styles.heroHighlightLabel}>Standout stat</Text>
            <Text style={styles.heroHighlightValue}>{formatVolume(totalVolume, unitPreference)}</Text>
          </View>
        </View>

        <View style={styles.metricsRow}>
          <View style={[styles.metricCard, styles.metricCardBlue]}>
            <View style={styles.metricAccentBlue} />
            <Text style={styles.metricLabel}>Duration</Text>
            <Text style={styles.metricValue}>{formatDurationMinutes(durationMinutes)}</Text>
          </View>
          <View style={[styles.metricCard, styles.metricCardRose]}>
            <View style={styles.metricAccentRose} />
            <Text style={styles.metricLabel}>Exercises</Text>
            <Text style={styles.metricValue}>{exercisesLogged}</Text>
          </View>
        </View>

        <View style={styles.metricsRow}>
          <View style={[styles.metricCard, styles.metricCardOrange]}>
            <View style={styles.metricAccentOrange} />
            <Text style={styles.metricLabel}>Sets completed</Text>
            <Text style={styles.metricValue}>{setsCompleted}</Text>
          </View>
          <View style={[styles.metricCard, styles.metricCardBlue]}>
            <View style={styles.metricAccentBlue} />
            <Text style={styles.metricLabel}>Total volume</Text>
            <Text style={styles.metricValue}>{formatVolume(totalVolume, unitPreference)}</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable onPress={onDone} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Done</Text>
          </Pressable>
          <Pressable onPress={onViewProgress} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>View progress</Text>
          </Pressable>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  heroCard: {
    overflow: 'hidden',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(85, 138, 189, 0.30)',
    backgroundColor: 'rgba(22, 32, 43, 0.90)',
    padding: spacing.xl,
    gap: spacing.sm,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.32,
    shadowRadius: 30,
    elevation: 10,
  },
  heroAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: colors.accent,
  },
  heroSheen: {
    position: 'absolute',
    top: 1,
    left: 18,
    right: 18,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  heroGlowBlue: {
    position: 'absolute',
    top: -46,
    right: -26,
    width: 160,
    height: 160,
    borderRadius: 160,
    backgroundColor: 'rgba(85, 138, 189, 0.18)',
  },
  heroGlowOrange: {
    position: 'absolute',
    bottom: -56,
    left: -26,
    width: 146,
    height: 146,
    borderRadius: 146,
    backgroundColor: 'rgba(162, 54, 18, 0.16)',
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  heroLabel: {
    color: '#8FC1F2',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  savedBadge: {
    minHeight: 30,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(191, 74, 105, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(191, 74, 105, 0.32)',
  },
  savedBadgeText: {
    color: '#E58AA2',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.9,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  heroHighlight: {
    marginTop: spacing.xs,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(162, 54, 18, 0.24)',
    backgroundColor: 'rgba(11, 15, 20, 0.28)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 2,
  },
  heroHighlightLabel: {
    color: '#F0997A',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  heroHighlightValue: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  metricCard: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: radii.lg,
    borderWidth: 1,
    backgroundColor: 'rgba(22, 32, 43, 0.90)',
    padding: spacing.lg,
    gap: spacing.xs,
  },
  metricCardBlue: {
    borderColor: 'rgba(85, 138, 189, 0.26)',
  },
  metricCardRose: {
    borderColor: 'rgba(191, 74, 105, 0.26)',
  },
  metricCardOrange: {
    borderColor: 'rgba(162, 54, 18, 0.28)',
  },
  metricAccentBlue: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: colors.accent,
  },
  metricAccentRose: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: colors.feature,
  },
  metricAccentOrange: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#C24E2A',
  },
  metricLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  metricValue: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  actions: {
    marginTop: 'auto',
    gap: spacing.sm,
  },
  primaryButton: {
    minHeight: 56,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentAlt,
    borderWidth: 1,
    borderColor: 'rgba(85, 138, 189, 0.40)',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.26,
    shadowRadius: 18,
    elevation: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  secondaryButton: {
    minHeight: 54,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(191, 74, 105, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(191, 74, 105, 0.30)',
  },
  secondaryButtonText: {
    color: '#E58AA2',
    fontSize: 15,
    fontWeight: '800',
  },
});
