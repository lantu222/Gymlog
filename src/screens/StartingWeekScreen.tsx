import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BadgePill, SectionHeaderBlock, SurfaceCard } from '../components/MainScreenPrimitives';
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
  onAskVallu: () => void;
}

export function StartingWeekScreen({
  week,
  hasActiveWorkout = false,
  hasLiveWorkout = false,
  onStart,
  onAdjust,
  onOpenProgram,
  onAskVallu,
}: StartingWeekScreenProps) {
  const kickoffSession = week.sessions[0] ?? null;
  const laterSessions = week.sessions.slice(1);
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
        <SectionHeaderBlock
          kicker={week.source === 'edit' ? 'Week updated' : 'Week ready'}
          title={week.title}
          subtitle={week.subtitle}
          accent="blue"
        />

        <SurfaceCard accent="blue" emphasis="hero" style={styles.heroCard}>
          <View style={styles.heroIntroRow}>
            <View style={styles.heroIntroCopy}>
              <View style={styles.badgeRow}>
                <BadgePill label="Recommended" accent="blue" />
                <BadgePill label={`${week.daysPerWeek} days`} accent="neutral" />
                <BadgePill label={`~${week.weeklyMinutes} min`} accent="neutral" />
              </View>

              <Text style={styles.programTitle}>{week.programName}</Text>
              <Text style={styles.programSubtitle}>{week.scheduleFitNote}</Text>
            </View>

            <WorkoutSceneGraphic variant="plan" accent="blue" style={styles.heroVisual} />
          </View>

          {week.reasons.length ? (
            <View style={styles.fitChipGrid}>
              {week.reasons.map((reason) => (
                <View key={reason} style={styles.fitChip}>
                  <Text style={styles.fitChipText}>{reason}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.signalRow}>
            <View style={styles.signalCard}>
              <Text style={styles.sectionLabel}>Week at a glance</Text>
              <View style={styles.rhythmRow}>
                {week.rhythm.map((day) => (
                  <View key={day} style={styles.dayPill}>
                    <Text style={styles.dayPillText}>{day}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.signalCard}>
              <Text style={styles.sectionLabel}>Schedule</Text>
              <Text style={styles.signalValue}>{week.scheduleModeLabel}</Text>
              <Text style={styles.signalMeta}>~{week.weeklyMinutes} min total</Text>
            </View>
          </View>

          {kickoffSession ? (
            <View style={styles.kickoffCard}>
              <View style={styles.kickoffHeaderRow}>
                <View>
                  <Text style={styles.kickoffKicker}>Starts with</Text>
                  <Text style={styles.kickoffTitle}>{kickoffSession.name}</Text>
                </View>
                <BadgePill label={kickoffSession.weekdayLabel} accent="orange" />
              </View>
              <Text style={styles.kickoffMeta}>{kickoffSession.meta}</Text>
              <Text style={styles.kickoffLifts}>{kickoffSession.keyLifts.join(' | ')}</Text>
            </View>
          ) : null}

          {laterSessions.length ? (
            <View style={styles.sessionsBlock}>
              <Text style={styles.sectionLabel}>Later this week</Text>
              <View style={styles.sessionsColumn}>
                {laterSessions.map((session) => (
                  <View key={session.id} style={styles.sessionCard}>
                    <View style={styles.sessionTopRow}>
                      <WorkoutSceneGraphic variant="today" accent="blue" compact style={styles.sessionVisual} />
                      <View style={styles.sessionHeaderBlock}>
                        <View style={styles.sessionHeaderRow}>
                          <BadgePill label={session.weekdayLabel} accent="neutral" />
                          <Text style={styles.sessionMeta}>{session.meta}</Text>
                        </View>
                        <Text style={styles.sessionTitle}>{session.name}</Text>
                        <Text style={styles.sessionLiftLine}>{session.keyLifts.join(' | ')}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </SurfaceCard>

        <SurfaceCard accent="orange" emphasis="flat" style={styles.utilityCard}>
          <Text style={styles.utilityTitle}>Need one more look?</Text>
          <Text style={styles.utilityBody}>Open the full plan or ask Vallu about this exact week.</Text>
          <View style={styles.utilityActionRow}>
            <Pressable onPress={onOpenProgram} style={styles.utilityButton}>
              <Text style={styles.utilityButtonText}>Open full plan</Text>
            </Pressable>
            <Pressable onPress={onAskVallu} style={styles.utilityButton}>
              <Text style={styles.utilityButtonText}>Ask Vallu why</Text>
            </Pressable>
          </View>
        </SurfaceCard>
      </ScrollView>

      <View style={styles.footer}>
        {showLiveWorkoutNotice ? (
          <Text style={styles.liveWorkoutNotice}>
            Finish or resume the live session first. Your updated week is ready right after it.
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
  programSubtitle: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
  },
  sectionLabel: {
    color: '#9ACCFF',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  fitChipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  fitChip: {
    minHeight: 40,
    maxWidth: '100%',
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(150, 216, 255, 0.18)',
    backgroundColor: 'rgba(11, 16, 22, 0.42)',
    justifyContent: 'center',
  },
  fitChipText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '800',
  },
  signalRow: {
    gap: spacing.sm,
  },
  signalCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(85, 138, 189, 0.24)',
    backgroundColor: 'rgba(12, 18, 25, 0.32)',
    padding: spacing.md,
    gap: spacing.sm,
  },
  rhythmRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  dayPill: {
    minWidth: 48,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(150, 216, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(150, 216, 255, 0.22)',
    alignItems: 'center',
  },
  dayPillText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  signalValue: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '900',
  },
  signalMeta: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  kickoffCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(240, 106, 57, 0.20)',
    backgroundColor: 'rgba(20, 15, 12, 0.42)',
    padding: spacing.md,
    gap: spacing.xs,
  },
  kickoffHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  kickoffKicker: {
    color: '#FFB389',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  kickoffTitle: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  kickoffMeta: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  kickoffLifts: {
    color: colors.textPrimary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  sessionsColumn: {
    gap: spacing.sm,
  },
  sessionsBlock: {
    gap: spacing.sm,
  },
  sessionCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(10, 15, 21, 0.34)',
    padding: spacing.md,
    gap: spacing.xs,
  },
  sessionTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  sessionVisual: {
    width: 92,
  },
  sessionHeaderBlock: {
    flex: 1,
    gap: spacing.xs,
  },
  sessionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  sessionMeta: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  sessionTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  sessionLiftLine: {
    color: colors.textSecondary,
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
  utilityCard: {
    gap: spacing.sm,
  },
  utilityTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  utilityBody: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
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
