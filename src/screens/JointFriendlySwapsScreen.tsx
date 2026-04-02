import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BadgePill, SectionHeaderBlock, SurfaceCard } from '../components/MainScreenPrimitives';
import { ScreenHeader } from '../components/ScreenHeader';
import { WorkoutSceneGraphic } from '../components/WorkoutSceneGraphic';
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
        subtitle="Set how strongly quick swaps should protect each joint."
        onBack={onBack}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SurfaceCard accent="orange" emphasis="hero" style={styles.heroCard}>
          <View style={styles.heroRow}>
            <View style={styles.heroCopy}>
              <Text style={styles.heroKicker}>Tailoring</Text>
              <Text style={styles.heroTitle}>Protect the joints that matter</Text>
              <Text style={styles.heroBody}>
                Keep this light by default, or push swaps harder toward shoulder, elbow, or knee-friendlier paths.
              </Text>
            </View>
            <WorkoutSceneGraphic variant="build" accent="orange" compact style={styles.heroGraphic} />
          </View>

          <View style={styles.badgeRow}>
            <BadgePill accent="orange" label={summary} />
          </View>
        </SurfaceCard>

        <SectionHeaderBlock
          accent="orange"
          kicker="Question"
          title="How strongly should swaps protect each joint?"
          subtitle="Use quick preference levels instead of a big form."
        />

        <SurfaceCard accent="orange" emphasis="standard" style={styles.preferenceCard}>
          {JOINT_SWAP_BIAS_OPTIONS.map((bias) => (
            <JointPreferenceRow
              key={bias}
              bias={bias}
              value={readPreference(preferences, bias)}
              onChange={(nextValue) => void onChange(buildPatch(bias, nextValue))}
            />
          ))}
        </SurfaceCard>

        <SurfaceCard accent="blue" emphasis="flat" style={styles.explainCard}>
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
    gap: spacing.md,
  },
  heroCard: {
    gap: spacing.md,
  },
  heroRow: {
    gap: spacing.md,
  },
  heroCopy: {
    gap: spacing.xs,
  },
  heroKicker: {
    color: '#FFCBAA',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: colors.textPrimary,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.7,
  },
  heroBody: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  heroGraphic: {
    width: '100%',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  preferenceCard: {
    gap: spacing.md,
  },
  preferenceRow: {
    gap: spacing.sm,
  },
  preferenceRowHeader: {
    gap: spacing.xs,
  },
  preferenceRowCopy: {
    gap: 4,
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
    backgroundColor: 'rgba(11, 16, 22, 0.46)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
    gap: 4,
  },
  preferenceSegmentActive: {
    borderColor: 'rgba(255, 167, 112, 0.28)',
    backgroundColor: 'rgba(240, 106, 57, 0.16)',
  },
  preferenceSegmentText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '900',
  },
  preferenceSegmentTextActive: {
    color: '#FFF2E9',
  },
  preferenceSegmentHint: {
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
  },
  preferenceSegmentHintActive: {
    color: '#FFD9C0',
  },
  explainCard: {
    gap: spacing.xs,
  },
  explainKicker: {
    color: '#9ACCFF',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
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
