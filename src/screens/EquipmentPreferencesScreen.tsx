import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BadgePill, SectionHeaderBlock, SurfaceCard } from '../components/MainScreenPrimitives';
import { ScreenHeader } from '../components/ScreenHeader';
import { WorkoutSceneGraphic } from '../components/WorkoutSceneGraphic';
import {
  getExerciseModalityPreferenceTitle,
  getSetupEquipmentHint,
  getSetupEquipmentTitle,
  summarizeExercisePreferences,
} from '../lib/tailoring';
import { colors, layout, radii, spacing } from '../theme';
import { AppPreferences, SetupEquipment } from '../types/models';

interface EquipmentPreferencesScreenProps {
  preferences: AppPreferences;
  onBack: () => void;
  onChange: (patch: Partial<AppPreferences>) => void | Promise<void>;
}

const EQUIPMENT_OPTIONS: SetupEquipment[] = ['gym', 'home', 'minimal'];

function EquipmentOption({
  value,
  active,
  onPress,
}: {
  value: SetupEquipment;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.optionCard, active && styles.optionCardActive]}>
      <Text style={[styles.optionTitle, active && styles.optionTitleActive]}>{getSetupEquipmentTitle(value)}</Text>
      <Text style={[styles.optionBody, active && styles.optionBodyActive]}>{getSetupEquipmentHint(value)}</Text>
    </Pressable>
  );
}

export function EquipmentPreferencesScreen({
  preferences,
  onBack,
  onChange,
}: EquipmentPreferencesScreenProps) {
  const equipment = preferences.setupEquipment ?? 'gym';
  const exerciseSummary = summarizeExercisePreferences({
    trainingFeel: preferences.setupTrainingFeel,
    workoutVariety: preferences.setupWorkoutVariety,
    freeWeights: preferences.setupFreeWeightsPreference,
    bodyweight: preferences.setupBodyweightPreference,
    machines: preferences.setupMachinesPreference,
  });

  return (
    <>
      <ScreenHeader
        title="Equipment"
        subtitle="Tell Gymlog what setup should win most weeks. This now affects recommendation, discovery, and quick swaps."
        onBack={onBack}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SurfaceCard accent="orange" emphasis="hero" style={styles.heroCard}>
          <View style={styles.heroRow}>
            <View style={styles.heroCopy}>
              <Text style={styles.heroKicker}>Tailoring</Text>
              <Text style={styles.heroTitle}>{getSetupEquipmentTitle(equipment)}</Text>
              <Text style={styles.heroBody}>
                Gymlog will bias the plan library and swap options toward this setup first.
              </Text>
            </View>
            <WorkoutSceneGraphic variant="plan" accent="orange" compact style={styles.heroGraphic} />
          </View>

          <View style={styles.badgeRow}>
            <BadgePill accent="orange" label={getSetupEquipmentTitle(equipment)} />
            <BadgePill accent="blue" label="Discovery aware" />
            <BadgePill accent="blue" label="Swap aware" />
          </View>

          <Text style={styles.heroSummary}>{exerciseSummary}</Text>
        </SurfaceCard>

        <SectionHeaderBlock
          accent="orange"
          kicker="Question"
          title="What setup should Gymlog assume most weeks?"
          subtitle="Keep this separate from training style. This is the hardware assumption first."
        />

        <View style={styles.optionGrid}>
          {EQUIPMENT_OPTIONS.map((option) => (
            <EquipmentOption
              key={option}
              value={option}
              active={equipment === option}
              onPress={() => void onChange({ setupEquipment: option })}
            />
          ))}
        </View>

        <SurfaceCard accent="blue" emphasis="flat" style={styles.explainCard}>
          <Text style={styles.explainKicker}>What changes</Text>
          <Text style={styles.explainTitle}>This is no longer just stored data</Text>
          <Text style={styles.explainBody}>
            Ready plans rank closer to this setup, and quick swaps prefer options that still make sense when your equipment is lighter.
          </Text>
        </SurfaceCard>

        <SurfaceCard accent="neutral" emphasis="flat" style={styles.signalCard}>
          <Text style={styles.signalLabel}>Current training mode bias</Text>
          <Text style={styles.signalValue}>
            Free weights {getExerciseModalityPreferenceTitle(preferences.setupFreeWeightsPreference).toLowerCase()} | Bodyweight{' '}
            {getExerciseModalityPreferenceTitle(preferences.setupBodyweightPreference).toLowerCase()} | Machines{' '}
            {getExerciseModalityPreferenceTitle(preferences.setupMachinesPreference).toLowerCase()}
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
  heroSummary: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  optionGrid: {
    gap: spacing.sm,
  },
  optionCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(17, 25, 34, 0.82)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  optionCardActive: {
    borderColor: 'rgba(255, 167, 112, 0.28)',
    backgroundColor: 'rgba(73, 38, 23, 0.92)',
  },
  optionTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  optionTitleActive: {
    color: '#FFF2E9',
  },
  optionBody: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  optionBodyActive: {
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
  },
  explainBody: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  signalCard: {
    gap: spacing.xs,
  },
  signalLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  signalValue: {
    color: colors.textPrimary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '800',
  },
});
