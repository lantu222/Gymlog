import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FitnessPhotoSurface } from '../components/FitnessPhotoSurface';
import { ScreenHeader } from '../components/ScreenHeader';
import {
  getSetupEquipmentHint,
  getSetupEquipmentTitle,
  summarizeExercisePreferences,
} from '../lib/tailoring';
import { HG } from '../lightTheme';
import { layout, radii, spacing } from '../theme';
import { AppPreferences, SetupEquipment } from '../types/models';

interface EquipmentPreferencesScreenProps {
  preferences: AppPreferences;
  onBack: () => void;
  onChange: (patch: Partial<AppPreferences>) => void | Promise<void>;
}

const EQUIPMENT_OPTIONS: SetupEquipment[] = ['gym', 'home', 'minimal'];

function getHeroPhotoKey(equipment: SetupEquipment) {
  if (equipment === 'minimal') {
    return 'running' as const;
  }

  if (equipment === 'home') {
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
      <ScreenHeader title="Equipment" tone="dark" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <FitnessPhotoSurface variant={getHeroPhotoKey(equipment)} style={styles.heroSurface}>
          <View style={styles.heroContent}>
            <Text style={styles.heroKicker}>Equipment</Text>

            <View style={styles.heroBadgeRow}>
              <HeroPill label={getSetupEquipmentTitle(equipment)} />
              <HeroPill label="Discovery aware" />
            </View>

            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>Pick the weekly setup</Text>
              <Text style={styles.heroMeta}>
                {getSetupEquipmentHint(equipment)}
              </Text>
            </View>
          </View>
        </FitnessPhotoSurface>

        <SectionLabel label="Question" />
        <View style={styles.optionGrid}>
          <View style={styles.questionCard}>
            <View style={styles.questionHeader}>
              <Text style={styles.questionTitle}>What setup should GAINER assume most weeks?</Text>
              <Text style={styles.questionBody}>This steers recommendation, discovery, and quick swaps.</Text>
            </View>

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
          </View>
        </View>

        <SectionLabel label="Current mode bias" />

        <View style={styles.signalCard}>
          <Text style={styles.signalLabel}>Training modes</Text>
          <Text style={styles.signalValue}>
            {exerciseSummary}
          </Text>
        </View>

        <View style={styles.nextCard}>
          <Text style={styles.nextKicker}>Also in tailoring</Text>
          <Text style={styles.nextTitle}>Exercise feel and joint-friendly swaps</Text>
          <Text style={styles.nextBody}>Tune the tone first, then decide how protective quick swaps should be.</Text>
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
  questionCard: {
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
  optionGrid: {
    gap: spacing.sm,
  },
  optionCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: HG.border,
    backgroundColor: HG.surfaceSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  optionCardActive: {
    borderColor: HG.purple,
    backgroundColor: HG.purpleLight,
  },
  optionTitle: {
    color: HG.ink,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  optionTitleActive: {
    color: HG.purpleDark,
  },
  optionBody: {
    color: HG.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  optionBodyActive: {
    color: HG.purple,
  },
  signalCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: HG.border,
    backgroundColor: HG.surface,
    padding: spacing.md,
    gap: spacing.xs,
  },
  signalLabel: {
    color: HG.faint,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  signalValue: {
    color: HG.ink,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  nextCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: HG.border,
    backgroundColor: HG.surface,
    padding: spacing.md,
    gap: 4,
  },
  nextKicker: {
    color: HG.faint,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  nextTitle: {
    color: HG.ink,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  nextBody: {
    color: HG.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
});
