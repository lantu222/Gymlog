import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BadgePill, SectionHeaderBlock, SurfaceCard } from '../components/MainScreenPrimitives';
import { PremiumFeatureVisual } from '../components/PremiumFeatureVisual';
import { ScreenHeader } from '../components/ScreenHeader';
import { colors, layout, radii, spacing } from '../theme';

interface PremiumScreenProps {
  previewUnlocked: boolean;
  hasActiveWorkout: boolean;
  activeWorkoutName?: string | null;
  onBack: () => void;
  onTogglePreview: () => void;
  onOpenWorkout?: () => void;
  onOpenPlanSettings?: () => void;
}

const premiumLanes = [
  {
    title: 'Adaptive set coach',
    body: 'Reads your effort and tells you whether to hold, push, or back off.',
    accent: 'orange' as const,
    visual: 'coach' as const,
    live: true,
  },
  {
    title: 'Smart rest',
    body: 'Rest time shifts with the set instead of staying fixed every round.',
    accent: 'blue' as const,
    visual: 'rest' as const,
    live: true,
  },
  {
    title: 'Session rescue',
    body: 'When the day goes sideways, Gymlog will shorten or soften the session.',
    accent: 'rose' as const,
    visual: 'rescue' as const,
    live: false,
  },
  {
    title: 'Adaptive week',
    body: 'Hard weeks, missed sessions, and good streaks should reshape the next one.',
    accent: 'neutral' as const,
    visual: 'week' as const,
    live: false,
  },
];

const comparisonRows = [
  { label: 'Manual logging', free: 'Included', premium: 'Included' },
  { label: 'Ready plans', free: 'Included', premium: 'Included' },
  { label: 'Next-set guidance', free: 'Locked', premium: 'Live' },
  { label: 'Smart rest timing', free: 'Locked', premium: 'Live' },
  { label: 'Session adjustments', free: 'Locked', premium: 'Soon' },
  { label: 'Weekly adaptation', free: 'Locked', premium: 'Soon' },
];

export function PremiumScreen({
  previewUnlocked,
  hasActiveWorkout,
  activeWorkoutName = null,
  onBack,
  onTogglePreview,
  onOpenWorkout,
  onOpenPlanSettings,
}: PremiumScreenProps) {
  return (
    <>
      <ScreenHeader
        title="Gymlog Premium"
        subtitle="A premium layer for adaptive coaching, smarter rest, and the next step after each set."
        onBack={onBack}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SurfaceCard accent="orange" emphasis="hero" style={styles.heroCard}>
          <View style={styles.heroCopy}>
            <Text style={styles.heroKicker}>Adaptive Coach</Text>
            <Text style={styles.heroTitle}>Train with a live coaching layer</Text>
            <Text style={styles.heroBody}>
              Gymlog Premium reads the set you just did, adjusts rest, and tells you how the next one should feel.
            </Text>
          </View>

          <PremiumFeatureVisual variant="hero" accent="orange" style={styles.heroVisual} />

          <View style={styles.badgeRow}>
            <BadgePill accent="orange" label="Live now" />
            <BadgePill accent="blue" label="Smart rest" />
            <BadgePill accent="rose" label="Session rescue soon" />
          </View>

          <View style={styles.heroStrip}>
            <PremiumFeatureVisual variant="coach" accent="orange" compact style={styles.heroStripTile} />
            <PremiumFeatureVisual variant="rest" accent="blue" compact style={styles.heroStripTile} />
            <PremiumFeatureVisual variant="week" accent="rose" compact style={styles.heroStripTile} />
          </View>

          <View style={styles.heroSignals}>
            <View style={styles.heroSignal}>
              <Text style={styles.heroSignalLabel}>Right after effort</Text>
              <Text style={styles.heroSignalValue}>Next set target</Text>
            </View>
            <View style={styles.heroSignal}>
              <Text style={styles.heroSignalLabel}>Rest adapts</Text>
              <Text style={styles.heroSignalValue}>Not fixed anymore</Text>
            </View>
            <View style={styles.heroSignal}>
              <Text style={styles.heroSignalLabel}>Week keeps learning</Text>
              <Text style={styles.heroSignalValue}>Premium roadmap</Text>
            </View>
          </View>
        </SurfaceCard>

        <SectionHeaderBlock
          accent="orange"
          kicker="Included"
          title="What Premium changes"
          subtitle="Keep the free tier clean. Put the adaptive layer here."
        />

        <View style={styles.laneGrid}>
          {premiumLanes.map((lane) => (
            <SurfaceCard key={lane.title} accent={lane.accent} emphasis="flat" style={styles.laneCard}>
              <View style={styles.laneRow}>
                <PremiumFeatureVisual variant={lane.visual} accent={lane.accent} compact style={styles.laneVisual} />
                <View style={styles.laneCopy}>
                  <View style={styles.laneHeader}>
                    <Text style={styles.laneTitle}>{lane.title}</Text>
                    <BadgePill accent={lane.live ? lane.accent : 'neutral'} label={lane.live ? 'Live' : 'Soon'} />
                  </View>
                  <Text style={styles.laneBody}>{lane.body}</Text>
                </View>
              </View>
            </SurfaceCard>
          ))}
        </View>

        <SectionHeaderBlock
          accent="blue"
          kicker="Compare"
          title="Free vs Premium"
          subtitle="Free stays useful. Premium adds the adaptive coaching layer."
        />

        <SurfaceCard accent="blue" emphasis="flat" style={styles.compareCard}>
          <PremiumFeatureVisual variant="compare" accent="blue" style={styles.compareVisual} />
          <View style={styles.compareHeader}>
            <Text style={styles.compareHeaderGhost}>Free</Text>
            <Text style={styles.compareHeaderPremium}>Premium</Text>
          </View>
          {comparisonRows.map((row) => (
            <View key={row.label} style={styles.compareRow}>
              <Text style={styles.compareLabel}>{row.label}</Text>
              <Text style={styles.compareFree}>{row.free}</Text>
              <Text style={styles.comparePremium}>{row.premium}</Text>
            </View>
          ))}
        </SurfaceCard>

        <SurfaceCard accent="orange" emphasis="hero" style={styles.ctaCard}>
          <View style={styles.ctaHeader}>
            <View style={styles.ctaCopy}>
              <Text style={styles.heroKicker}>Preview access</Text>
              <Text style={styles.ctaTitle}>{previewUnlocked ? 'Premium preview is on' : 'Unlock the premium preview'}</Text>
              <Text style={styles.ctaBody}>
                {previewUnlocked
                  ? 'Adaptive Coach is active on this device. The logger will now show real next-set guidance after effort input.'
                  : 'Billing is not live yet, so this first paywall unlocks preview access on this device for testing.'}
              </Text>
            </View>
            <BadgePill accent="orange" label={previewUnlocked ? 'Preview on' : 'Preview off'} />
          </View>

          <View style={styles.ctaVisualRow}>
            <PremiumFeatureVisual variant="coach" accent="orange" compact style={styles.ctaVisual} />
            <PremiumFeatureVisual variant="compare" accent="blue" compact style={styles.ctaVisual} />
          </View>

          <Pressable onPress={onTogglePreview} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>{previewUnlocked ? 'Turn preview off' : 'Unlock premium preview'}</Text>
          </Pressable>

          {previewUnlocked && hasActiveWorkout && onOpenWorkout ? (
            <Pressable onPress={onOpenWorkout} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>
                {activeWorkoutName ? `Open ${activeWorkoutName}` : 'Open live workout'}
              </Text>
            </Pressable>
          ) : null}

          {onOpenPlanSettings ? (
            <Pressable onPress={onOpenPlanSettings} style={styles.textAction}>
              <Text style={styles.textActionText}>Back to plan settings</Text>
            </Pressable>
          ) : null}
        </SurfaceCard>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: layout.bottomTabBarReserve,
    gap: spacing.md,
  },
  heroCard: {
    gap: spacing.md,
  },
  heroCopy: {
    gap: spacing.xs,
  },
  heroVisual: {
    height: 144,
  },
  heroKicker: {
    color: '#FFB389',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  heroTitle: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.7,
  },
  heroBody: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    rowGap: spacing.sm,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  heroStrip: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  heroStripTile: {
    flex: 1,
  },
  heroSignals: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  heroSignal: {
    flexGrow: 1,
    minWidth: 140,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(11, 16, 22, 0.38)',
    padding: spacing.md,
    gap: 4,
  },
  heroSignalLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  heroSignalValue: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 20,
  },
  laneGrid: {
    gap: spacing.sm,
  },
  laneCard: {
    gap: spacing.sm,
  },
  laneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  laneVisual: {
    width: 112,
    height: 96,
  },
  laneCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  laneHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  laneTitle: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  laneBody: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  compareCard: {
    gap: spacing.xs,
  },
  compareVisual: {
    height: 126,
    marginBottom: spacing.xs,
  },
  compareHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.lg,
    paddingBottom: spacing.xs,
  },
  compareHeaderGhost: {
    width: 72,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'right',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  compareHeaderPremium: {
    width: 88,
    color: '#FFB389',
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'right',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  compareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  compareLabel: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  compareFree: {
    width: 72,
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'right',
  },
  comparePremium: {
    width: 88,
    color: '#FFC39E',
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'right',
  },
  ctaCard: {
    gap: spacing.md,
  },
  ctaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  ctaCopy: {
    flex: 1,
    gap: 4,
  },
  ctaTitle: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  ctaBody: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  ctaVisualRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  ctaVisual: {
    flex: 1,
    height: 96,
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: radii.md,
    backgroundColor: colors.warning,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  primaryButtonText: {
    color: '#120D0A',
    fontSize: 15,
    fontWeight: '900',
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(150, 216, 255, 0.28)',
    backgroundColor: 'rgba(150, 216, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  secondaryButtonText: {
    color: '#B8E4FF',
    fontSize: 14,
    fontWeight: '900',
  },
  textAction: {
    alignSelf: 'center',
    minHeight: 36,
    paddingHorizontal: spacing.sm,
    justifyContent: 'center',
  },
  textActionText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
});
