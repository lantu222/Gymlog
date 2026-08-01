import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FitnessPhotoSurface } from '../components/FitnessPhotoSurface';
import { ScreenHeader } from '../components/ScreenHeader';
import {
  getSetupEquipmentHint,
  getSetupEquipmentTitle,
  summarizeExercisePreferences,
} from '../lib/tailoring';
import { t } from '../lib/i18n';
import { Theme, useThemedStyles } from '../theming';
import { layout, radii, spacing } from '../theme';
import { AppLanguage, AppPreferences, SetupEquipment } from '../types/models';

interface EquipmentPreferencesScreenProps {
  preferences: AppPreferences;
  language?: AppLanguage;
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
  const styles = useThemedStyles(makeStyles);

  return <Text style={styles.sectionLabel}>{label}</Text>;
}

function HeroPill({ label }: { label: string }) {
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.heroPill}>
      <Text style={styles.heroPillText}>{label}</Text>
    </View>
  );
}

function EquipmentOption({
  value,
  active,
  language,
  onPress,
}: {
  value: SetupEquipment;
  active: boolean;
  language: AppLanguage;
  onPress: () => void;
}) {
  const styles = useThemedStyles(makeStyles);

  return (
    <Pressable onPress={onPress} style={[styles.optionCard, active && styles.optionCardActive]}>
      <Text style={[styles.optionTitle, active && styles.optionTitleActive]}>
        {getSetupEquipmentTitle(value, language)}
      </Text>
      <Text style={[styles.optionBody, active && styles.optionBodyActive]}>
        {getSetupEquipmentHint(value, language)}
      </Text>
    </Pressable>
  );
}

export function EquipmentPreferencesScreen({
  preferences,
  language = 'en',
  onBack,
  onChange,
}: EquipmentPreferencesScreenProps) {
  const styles = useThemedStyles(makeStyles);
  const equipment = preferences.setupEquipment ?? 'gym';
  const exerciseSummary = summarizeExercisePreferences(
    {
      trainingFeel: preferences.setupTrainingFeel,
      workoutVariety: preferences.setupWorkoutVariety,
      freeWeights: preferences.setupFreeWeightsPreference,
      bodyweight: preferences.setupBodyweightPreference,
      machines: preferences.setupMachinesPreference,
    },
    language,
  );

  return (
    <>
      <ScreenHeader title={t(language, 'myData.equipment')} onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <FitnessPhotoSurface variant={getHeroPhotoKey(equipment)} style={styles.heroSurface}>
          <View style={styles.heroContent}>
            <Text style={styles.heroKicker}>{t(language, 'myData.equipment')}</Text>

            <View style={styles.heroBadgeRow}>
              <HeroPill label={getSetupEquipmentTitle(equipment, language)} />
              <HeroPill label={t(language, 'equip.discoveryAware')} />
            </View>

            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>{t(language, 'equip.pickSetup')}</Text>
              <Text style={styles.heroMeta}>{getSetupEquipmentHint(equipment, language)}</Text>
            </View>
          </View>
        </FitnessPhotoSurface>

        <SectionLabel label={t(language, 'equip.question')} />
        <View style={styles.optionGrid}>
          <View style={styles.questionCard}>
            <View style={styles.questionHeader}>
              <Text style={styles.questionTitle}>{t(language, 'equip.questionTitle')}</Text>
              <Text style={styles.questionBody}>{t(language, 'equip.questionBody')}</Text>
            </View>

            <View style={styles.optionGrid}>
              {EQUIPMENT_OPTIONS.map((option) => (
                <EquipmentOption
                  key={option}
                  value={option}
                  active={equipment === option}
                  language={language}
                  onPress={() => void onChange({ setupEquipment: option })}
                />
              ))}
            </View>
          </View>
        </View>

        <SectionLabel label={t(language, 'equip.currentBias')} />

        <View style={styles.signalCard}>
          <Text style={styles.signalLabel}>{t(language, 'equip.trainingModes')}</Text>
          <Text style={styles.signalValue}>
            {exerciseSummary}
          </Text>
        </View>

        <View style={styles.nextCard}>
          <Text style={styles.nextKicker}>{t(language, 'equip.alsoIn')}</Text>
          <Text style={styles.nextTitle}>{t(language, 'equip.alsoInTitle')}</Text>
          <Text style={styles.nextBody}>{t(language, 'equip.alsoInBody')}</Text>
        </View>
      </ScrollView>
    </>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
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
    color: theme.faint,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  questionCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    padding: spacing.lg,
    gap: spacing.md,
  },
  questionHeader: {
    gap: 2,
  },
  questionTitle: {
    color: theme.ink,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  questionBody: {
    color: theme.muted,
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
    borderColor: theme.border,
    backgroundColor: theme.surfaceSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  optionCardActive: {
    borderColor: theme.purple,
    backgroundColor: theme.purpleLight,
  },
  optionTitle: {
    color: theme.ink,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  optionTitleActive: {
    color: theme.purpleDark,
  },
  optionBody: {
    color: theme.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  optionBodyActive: {
    color: theme.purple,
  },
  signalCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    padding: spacing.md,
    gap: spacing.xs,
  },
  signalLabel: {
    color: theme.faint,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  signalValue: {
    color: theme.ink,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  nextCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    padding: spacing.md,
    gap: 4,
  },
  nextKicker: {
    color: theme.faint,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  nextTitle: {
    color: theme.ink,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  nextBody: {
    color: theme.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
});
