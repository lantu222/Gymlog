import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BadgePill, SurfaceCard } from '../components/MainScreenPrimitives';
import { WorkoutSceneGraphic } from '../components/WorkoutSceneGraphic';
import { StartingWeekViewModel } from '../lib/startingWeek';
import { colors, layout, radii, spacing } from '../theme';

interface StartingWeekScreenProps {
  week: StartingWeekViewModel;
  hasActiveWorkout?: boolean;
  hasLiveWorkout?: boolean;
  onStart: () => void;
  onAdjust: () => void;
  onOpenProgram: () => void;
  onAskAiCoach: () => void;
}

export function StartingWeekScreen({
  week,
  hasActiveWorkout = false,
  hasLiveWorkout = false,
  onStart,
  onAdjust,
  onOpenProgram,
  onAskAiCoach,
}: StartingWeekScreenProps) {
  const kickoffSession = week.sessions[0] ?? null;
  const headerBadges = [
    week.source === 'edit' ? 'Updated' : 'Recommended',
    `${week.daysPerWeek} days`,
  ];
  const primaryLabel =
    hasLiveWorkout
      ? 'Resume workout'
      : week.source === 'edit'
        ? 'Start this week'
        : 'Start Day 1';
  const showLiveWorkoutNotice = hasLiveWorkout && !hasActiveWorkout;

  return (
    <View style={styles.root}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topHeader}>
          <Text style={styles.topHeaderTitle}>This week</Text>
        </View>

        <SurfaceCard accent="blue" emphasis="hero" style={styles.heroCard}>
          <View style={styles.heroIntroRow}>
            <View style={styles.heroIntroCopy}>
              <View style={styles.badgeRow}>
                {headerBadges.map((badge, index) => (
                  <BadgePill key={badge} label={badge} accent={index === 0 ? 'blue' : 'neutral'} />
                ))}
              </View>

              <Text style={styles.programTitle}>
                {kickoffSession ? kickoffSession.name : week.programName}
              </Text>
              <Text style={styles.programMeta}>{kickoffSession?.meta ?? `~${week.weeklyMinutes} min total`}</Text>
            </View>

            <WorkoutSceneGraphic variant="plan" accent="blue" style={styles.heroVisual} />
          </View>
        </SurfaceCard>

        <View style={styles.sectionBlock}>
          <Text style={styles.sectionLabel}>Coming up</Text>
          <SurfaceCard accent="blue" emphasis="flat" style={styles.weekListCard}>
            <View style={styles.weekList}>
              {week.sessions.map((session, index) => (
                <View
                  key={session.id}
                  style={[styles.weekRow, index === 0 && styles.weekRowActive]}
                >
                  <View style={styles.weekdayBadge}>
                    <Text style={styles.weekdayBadgeText}>{session.weekdayLabel}</Text>
                  </View>
                  <View style={styles.weekRowCopy}>
                    <Text style={styles.weekRowTitle}>{session.name}</Text>
                    <Text style={styles.weekRowMeta}>{session.meta}</Text>
                  </View>
                </View>
              ))}
            </View>
          </SurfaceCard>
        </View>

        {week.reasons.length ? (
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionLabel}>Why it fits</Text>
            <SurfaceCard accent="blue" emphasis="flat" style={styles.infoCard}>
              <View style={styles.reasonList}>
                {week.reasons.map((reason) => (
                  <View key={reason} style={styles.reasonRow}>
                    <View style={styles.reasonBullet} />
                    <Text style={styles.reasonText}>{reason}</Text>
                  </View>
                ))}
              </View>
            </SurfaceCard>
          </View>
        ) : null}

        {week.programmeSummary ? (
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionLabel}>Progression</Text>
            <SurfaceCard accent="blue" emphasis="flat" style={styles.infoCard}>
              <Text style={styles.infoText}>{week.programmeSummary}</Text>
            </SurfaceCard>
          </View>
        ) : null}

        <View style={styles.utilityActionRow}>
          <Pressable onPress={onOpenProgram} style={styles.utilityButton}>
            <Text style={styles.utilityButtonText}>Full plan</Text>
          </Pressable>
          <Pressable onPress={onAskAiCoach} style={styles.utilityButton}>
            <Text style={styles.utilityButtonText}>Ask why</Text>
          </Pressable>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {showLiveWorkoutNotice ? (
          <Text style={styles.liveWorkoutNotice}>
            Resume the live workout first.
          </Text>
        ) : null}
        <View style={styles.actionRow}>
          <Pressable onPress={onStart} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>{primaryLabel}</Text>
          </Pressable>
          <Pressable onPress={onAdjust} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Adjust this week</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  topHeader: {
    gap: spacing.xs,
  },
  topHeaderTitle: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  heroCard: {
    gap: spacing.md,
  },
  heroIntroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  heroVisual: {
    width: 126,
  },
  heroIntroCopy: {
    flex: 1,
    gap: spacing.sm,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  programTitle: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  programMeta: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  sectionLabel: {
    color: '#9ACCFF',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  sectionBlock: {
    gap: spacing.sm,
  },
  weekListCard: {
    padding: spacing.md,
  },
  infoCard: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  weekList: {
    gap: spacing.sm,
  },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(10, 15, 21, 0.34)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  weekRowActive: {
    borderColor: 'rgba(85, 138, 189, 0.22)',
    backgroundColor: 'rgba(18, 24, 33, 0.52)',
  },
  weekdayBadge: {
    minWidth: 56,
    minHeight: 34,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(150, 216, 255, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(150, 216, 255, 0.22)',
  },
  weekdayBadgeText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  weekRowCopy: {
    flex: 1,
    gap: 2,
  },
  weekRowTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  weekRowMeta: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  reasonList: {
    gap: spacing.sm,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  reasonBullet: {
    width: 8,
    height: 8,
    marginTop: 6,
    borderRadius: 999,
    backgroundColor: '#9ACCFF',
  },
  reasonText: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  infoText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  actionRow: {
    gap: spacing.sm,
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: radii.md,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  primaryButtonText: {
    color: '#081019',
    fontSize: 16,
    fontWeight: '900',
  },
  secondaryButton: {
    minHeight: 52,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(16, 23, 31, 0.36)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  secondaryButtonText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  liveWorkoutNotice: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  utilityActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  utilityButton: {
    minHeight: 42,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(240, 106, 57, 0.24)',
    backgroundColor: 'rgba(240, 106, 57, 0.10)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  utilityButtonText: {
    color: '#FFB389',
    fontSize: 13,
    fontWeight: '800',
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: layout.bottomTabBarReserve,
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
});
