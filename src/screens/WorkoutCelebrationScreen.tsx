import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ScreenHeader } from '../components/ScreenHeader';
import { formatDurationMinutes, formatVolume } from '../lib/format';
import { t } from '../lib/i18n';
import { localizeSessionName } from '../lib/sessionNameLabel';
import { radii, shadows, spacing } from '../theme';
import { AppLanguage, UnitPreference } from '../types/models';

interface WorkoutCelebrationScreenProps {
  workoutName: string;
  heroImageUrl?: string | null;
  workoutsThisWeek: number;
  totalLiftedKgThisWeek: number;
  totalDurationMinutesThisWeek: number;
  prCount: number;
  unitPreference: UnitPreference;
  language?: AppLanguage;
  onDone: () => void;
  onViewProgress: () => void;
}

interface CelebrationStatCardProps {
  label: string;
  value: string;
  accent?: 'default' | 'success';
}

function CelebrationStatCard({ label, value, accent = 'default' }: CelebrationStatCardProps) {
  return (
    <View style={[styles.statCard, accent === 'success' ? styles.statCardSuccess : null]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

export function WorkoutCelebrationScreen({
  workoutName,
  heroImageUrl,
  workoutsThisWeek,
  totalLiftedKgThisWeek,
  totalDurationMinutesThisWeek,
  prCount,
  unitPreference,
  language = 'en',
  onDone,
  onViewProgress,
}: WorkoutCelebrationScreenProps) {
  return (
    <View style={styles.screen}>
      <ScreenHeader
        title={t(language, 'celebrate.title')}
        subtitle={t(language, 'celebrate.subtitle')}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          {heroImageUrl ? (
            <View style={styles.heroMediaWrap}>
              <Image source={{ uri: heroImageUrl }} style={styles.heroMedia} resizeMode="cover" />
              <View style={styles.heroOverlay} />
            </View>
          ) : null}
          <View style={styles.heroCopy}>
            <Text style={styles.heroEyebrow}>{t(language, 'celebrate.eyebrow')}</Text>
            <Text style={styles.heroTitle}>{localizeSessionName(workoutName, language)}</Text>
            <Text style={styles.heroBody}>{t(language, 'celebrate.body')}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t(language, 'progress.thisWeek')}</Text>
          <View style={styles.statsGrid}>
            <CelebrationStatCard
              label={t(language, 'detail.workouts')}
              value={t(language, workoutsThisWeek === 1 ? 'celebrate.workoutOne' : 'celebrate.workoutMany', {
                count: workoutsThisWeek,
              })}
            />
            <CelebrationStatCard
              label={t(language, 'celebrate.totalLifted')}
              value={formatVolume(totalLiftedKgThisWeek, unitPreference)}
            />
            <CelebrationStatCard
              label={t(language, 'celebrate.totalTime')}
              value={formatDurationMinutes(totalDurationMinutesThisWeek)}
            />
            <CelebrationStatCard
              label={t(language, 'celebrate.prs')}
              value={
            prCount > 0
              ? t(language, prCount === 1 ? 'celebrate.prOne' : 'celebrate.prMany', { count: prCount })
              : t(language, 'celebrate.noPrs')
          }
              accent={prCount > 0 ? 'success' : 'default'}
            />
          </View>
        </View>

        <View style={styles.messageCard}>
          <Text style={styles.messageTitle}>{t(language, 'celebrate.whatChanged')}</Text>
          <Text style={styles.messageBody}>
            {prCount > 0
              ? t(language, prCount === 1 ? 'celebrate.changedPrOne' : 'celebrate.changedPrMany', {
                  count: prCount,
                })
              : t(language, 'celebrate.changedNoPr')}
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable onPress={onDone} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>{t(language, 'plan.done')}</Text>
        </Pressable>
        <Pressable onPress={onViewProgress} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>{t(language, 'celebrate.viewProgress')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl + 120,
    gap: spacing.xl,
  },
  heroCard: {
    minHeight: 220,
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: '#111111',
    ...shadows.card,
  },
  heroMediaWrap: {
    ...StyleSheet.absoluteFillObject,
  },
  heroMedia: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(17, 17, 17, 0.62)',
  },
  heroCopy: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: spacing.lg,
    gap: spacing.xs,
  },
  heroEyebrow: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  heroBody: {
    color: 'rgba(255,255,255,0.84)',
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    color: '#111111',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statCard: {
    width: '48%',
    minHeight: 104,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    padding: spacing.md,
    justifyContent: 'space-between',
  },
  statCardSuccess: {
    borderColor: 'rgba(34, 197, 94, 0.28)',
    backgroundColor: '#F0FDF4',
  },
  statLabel: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '700',
  },
  statValue: {
    color: '#111111',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  messageCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    padding: spacing.lg,
    gap: spacing.xs,
  },
  messageTitle: {
    color: '#111111',
    fontSize: 16,
    fontWeight: '900',
  },
  messageBody: {
    color: '#4B5563',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  primaryButton: {
    minHeight: 56,
    borderRadius: radii.lg,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#111111',
    fontSize: 15,
    fontWeight: '800',
  },
});
