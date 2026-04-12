import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FitnessPhotoSurface } from '../components/FitnessPhotoSurface';
import { BadgePill, SurfaceCard } from '../components/MainScreenPrimitives';
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
import { colors, layout, radii, spacing } from '../theme';
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
        <BadgePill accent={value === 'prioritize' ? 'orange' : value === 'prefer' ? 'blue' : 'neutral'} label={getJointSwapPreferenceTitle(value)} />
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
        onBack={onBack}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <FitnessPhotoSurface variant={getHeroPhotoKey(preferences)} style={styles.heroSurface}>
          <View style={styles.heroContent}>
            <Text style={styles.heroKicker}>Tailoring</Text>

            <View style={styles.heroBadgeRow}>
              <BadgePill accent="neutral" label={summary} />
            </View>

            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>Protect the joints that matter</Text>
              <Text style={styles.heroMeta}>Shift quick swaps toward shoulder, elbow, or knee-friendlier paths.</Text>
            </View>
          </View>
        </FitnessPhotoSurface>

        <SectionLabel label="Quick swap bias" />

        <SurfaceCard accent="neutral" emphasis="standard" style={styles.preferenceCard}>
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
        </SurfaceCard>

        <SurfaceCard accent="neutral" emphasis="flat" style={styles.explainCard}>
          <Text style={styles.explainKicker}>What changes</Text>
          <Text style={styles.explainTitle}>Recommendation, discovery, and quick swaps all listen now</Text>
          <Text style={styles.explainBody}>
            Higher protection moves friendlier options up sooner when the movement pattern and your equipment still fit.
          </Text>
        </SurfaceCard>
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
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  heroContent: {
    flex: 1,
    justifyContent: 'space-between',
    padding: spacing.lg,
    gap: spacing.md,
  },
  heroKicker: {
    color: 'rgba(255,255,255,0.58)',
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
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  preferenceCard: {
    gap: spacing.md,
  },
  questionHeader: {
    gap: 2,
  },
  questionTitle: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  questionBody: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
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
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  preferenceRowBody: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
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
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(10, 14, 19, 0.82)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
    gap: 4,
  },
  preferenceSegmentActive: {
    borderColor: '#F4FAFF',
    backgroundColor: '#F4FAFF',
  },
  preferenceSegmentText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '900',
  },
  preferenceSegmentTextActive: {
    color: '#0B0F14',
  },
  preferenceSegmentHint: {
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
  },
  preferenceSegmentHintActive: {
    color: '#44515C',
  },
  explainCard: {
    gap: spacing.xs,
  },
  explainKicker: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  explainTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 24,
  },
  explainBody: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
});
