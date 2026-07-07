import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FitnessPhotoSurface } from '../components/FitnessPhotoSurface';
import { ScreenHeader } from '../components/ScreenHeader';
import {
  getJointSwapBiasHint,
  getJointSwapBiasTitle,
  getJointSwapPreferenceHint,
  getJointSwapPreferenceTitle,
  JOINT_SWAP_BIAS_OPTIONS,
  JOINT_SWAP_PREFERENCE_OPTIONS,
  summarizeJointSwapPreferences,
} from '../lib/tailoring';
import { HG } from '../lightTheme';
import { layout, radii, spacing } from '../theme';
import { AppPreferences, JointSwapBias, JointSwapPreference } from '../types/models';

interface JointFriendlySwapsScreenProps {
  preferences: AppPreferences;
  onBack: () => void;
  onChange: (patch: Partial<AppPreferences>) => void | Promise<void>;
}

function readPreference(preferences: AppPreferences, bias: JointSwapBias): JointSwapPreference {
  if (bias === 'shoulders') {
    return preferences.setupShoulderFriendlySwaps;
  }

  if (bias === 'elbows') {
    return preferences.setupElbowFriendlySwaps;
  }

  return preferences.setupKneeFriendlySwaps;
}

function buildPatch(bias: JointSwapBias, value: JointSwapPreference): Partial<AppPreferences> {
  if (bias === 'shoulders') {
    return { setupShoulderFriendlySwaps: value };
  }

  if (bias === 'elbows') {
    return { setupElbowFriendlySwaps: value };
  }

  return { setupKneeFriendlySwaps: value };
}

function getHeroPhotoKey(preferences: AppPreferences) {
  if (preferences.setupKneeFriendlySwaps === 'prioritize') {
    return 'running' as const;
  }

  if (preferences.setupShoulderFriendlySwaps === 'prioritize' || preferences.setupElbowFriendlySwaps === 'prioritize') {
    return 'recovery' as const;
  }

  return 'strength' as const;
}

function SectionLabel({ label }: { label: string }) {
  return <Text style={styles.sectionLabel}>{label}</Text>;
}

function HeroPill({ label }: { label: string }) {
  return (
    <View style={styles.heroPill}>
      <Text style={styles.heroPillText}>{label}</Text>
    </View>
  );
}

function StateBadge({ value }: { value: JointSwapPreference }) {
  return (
    <View
      style={[
        styles.stateBadge,
        value === 'prefer' && styles.stateBadgePrefer,
        value === 'prioritize' && styles.stateBadgePrioritize,
      ]}
    >
      <Text
        style={[
          styles.stateBadgeText,
          value === 'prefer' && styles.stateBadgeTextPrefer,
          value === 'prioritize' && styles.stateBadgeTextPrioritize,
        ]}
      >
        {getJointSwapPreferenceTitle(value)}
      </Text>
    </View>
  );
}

function JointPreferenceRow({
  bias,
  value,
  onChange,
}: {
  bias: JointSwapBias;
  value: JointSwapPreference;
  onChange: (nextValue: JointSwapPreference) => void;
}) {
  return (
    <View style={styles.preferenceRow}>
      <View style={styles.preferenceRowHeader}>
        <View style={styles.preferenceRowCopy}>
          <Text style={styles.preferenceRowTitle}>{getJointSwapBiasTitle(bias)}</Text>
          <Text style={styles.preferenceRowBody}>{getJointSwapBiasHint(bias)}</Text>
        </View>
        <StateBadge value={value} />
      </View>

      <View style={styles.preferenceSegmentRow}>
        {JOINT_SWAP_PREFERENCE_OPTIONS.map((option) => {
          const active = option === value;
          return (
            <Pressable
              key={option}
              onPress={() => onChange(option)}
              style={[styles.preferenceSegment, active && styles.preferenceSegmentActive]}
            >
              <Text style={[styles.preferenceSegmentText, active && styles.preferenceSegmentTextActive]}>
                {getJointSwapPreferenceTitle(option)}
              </Text>
              <Text style={[styles.preferenceSegmentHint, active && styles.preferenceSegmentHintActive]}>
                {getJointSwapPreferenceHint(option)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function JointFriendlySwapsScreen({
  preferences,
  onBack,
  onChange,
}: JointFriendlySwapsScreenProps) {
  const summary = summarizeJointSwapPreferences({
    shoulders: preferences.setupShoulderFriendlySwaps,
    elbows: preferences.setupElbowFriendlySwaps,
    knees: preferences.setupKneeFriendlySwaps,
  });

  return (
    <>
      <ScreenHeader
        title="Joint-friendly swaps"
        subtitle="Bias quick swaps toward joints that need more protection."
        tone="dark"
        onBack={onBack}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <FitnessPhotoSurface variant={getHeroPhotoKey(preferences)} style={styles.heroSurface}>
          <View style={styles.heroContent}>
            <Text style={styles.heroKicker}>Tailoring</Text>

            <View style={styles.heroBadgeRow}>
              <HeroPill label={summary} />
            </View>

            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>Protect the joints that matter</Text>
              <Text style={styles.heroMeta}>Shift quick swaps toward shoulder, elbow, or knee-friendlier paths.</Text>
            </View>
          </View>
        </FitnessPhotoSurface>

        <SectionLabel label="Quick swap bias" />

        <View style={styles.preferenceCard}>
          <View style={styles.questionHeader}>
            <Text style={styles.questionTitle}>How strongly should swaps protect each joint?</Text>
            <Text style={styles.questionBody}>Keep this light by default or push friendlier options higher.</Text>
          </View>

          {JOINT_SWAP_BIAS_OPTIONS.map((bias) => (
            <JointPreferenceRow
              key={bias}
              bias={bias}
              value={readPreference(preferences, bias)}
              onChange={(nextValue) => void onChange(buildPatch(bias, nextValue))}
            />
          ))}
        </View>

        <View style={styles.explainCard}>
          <Text style={styles.explainKicker}>What changes</Text>
          <Text style={styles.explainTitle}>Recommendation, discovery, and quick swaps all listen now</Text>
          <Text style={styles.explainBody}>
            Higher protection moves friendlier options up sooner when the movement pattern and your equipment still fit.
          </Text>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: layout.bottomTabBarReserve,
    gap: spacing.lg,
  },
  heroSurface: {
    minHeight: 272,
  },
  heroContent: {
    flex: 1,
    justifyContent: 'space-between',
    padding: spacing.lg,
    gap: spacing.md,
  },
  heroKicker: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  heroBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  heroPill: {
    minHeight: 28,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.30)',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  heroPillText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  heroCopy: {
    gap: spacing.xs,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 32,
    lineHeight: 34,
    fontWeight: '900',
    letterSpacing: -1,
    maxWidth: '78%',
  },
  heroMeta: {
    color: 'rgba(255,255,255,0.74)',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    maxWidth: '84%',
  },
  sectionLabel: {
    color: HG.faint,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  preferenceCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: HG.border,
    backgroundColor: HG.surface,
    padding: spacing.lg,
    gap: spacing.md,
  },
  questionHeader: {
    gap: 2,
  },
  questionTitle: {
    color: HG.ink,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  questionBody: {
    color: HG.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  preferenceRow: {
    gap: spacing.sm,
  },
  preferenceRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  preferenceRowCopy: {
    gap: 4,
    flex: 1,
  },
  preferenceRowTitle: {
    color: HG.ink,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  preferenceRowBody: {
    color: HG.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  stateBadge: {
    minHeight: 24,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    justifyContent: 'center',
    backgroundColor: HG.surfaceSoft,
  },
  stateBadgePrefer: {
    backgroundColor: HG.purpleLight,
  },
  stateBadgePrioritize: {
    backgroundColor: HG.purple,
  },
  stateBadgeText: {
    color: HG.muted,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  stateBadgeTextPrefer: {
    color: HG.purpleDark,
  },
  stateBadgeTextPrioritize: {
    color: '#FFFFFF',
  },
  preferenceSegmentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  preferenceSegment: {
    flexBasis: '31%',
    flexGrow: 1,
    minHeight: 72,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: HG.border,
    backgroundColor: HG.surfaceSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
    gap: 4,
  },
  preferenceSegmentActive: {
    borderColor: HG.purple,
    backgroundColor: HG.purpleLight,
  },
  preferenceSegmentText: {
    color: HG.ink,
    fontSize: 13,
    fontWeight: '800',
  },
  preferenceSegmentTextActive: {
    color: HG.purpleDark,
  },
  preferenceSegmentHint: {
    color: HG.muted,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
  },
  preferenceSegmentHintActive: {
    color: HG.purple,
  },
  explainCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: HG.border,
    backgroundColor: HG.surface,
    padding: spacing.md,
    gap: spacing.xs,
  },
  explainKicker: {
    color: HG.faint,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  explainTitle: {
    color: HG.ink,
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 24,
  },
  explainBody: {
    color: HG.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
});
