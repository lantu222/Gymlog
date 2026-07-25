import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ScreenHeader } from '../components/ScreenHeader';
import { t } from '../lib/i18n';
import { radii, spacing } from '../theme';
import {
  AiPlannerDaysPerWeek,
  AiPlannerEquipment,
  AiPlannerExperience,
  AiPlannerGoal,
  AiPlannerRecovery,
  AppLanguage,
  AppPreferences,
} from '../types/models';

interface AiModeSetupScreenProps {
  preferences: AppPreferences;
  language?: AppLanguage;
  onBack: () => void;
  onSave: (patch: Partial<AppPreferences>) => void | Promise<void>;
}

function SectionLabel({ label }: { label: string }) {
  return <Text style={styles.sectionLabel}>{label}</Text>;
}

function ChoiceChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.choiceChip, active && styles.choiceChipActive]}>
      <Text style={[styles.choiceChipText, active && styles.choiceChipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function OptionRow<T extends string | number>({
  options,
  selected,
  onSelect,
}: {
  options: Array<{ key: T; label: string }>;
  selected: T | null;
  onSelect: (value: T) => void;
}) {
  return (
    <View style={styles.optionRow}>
      {options.map((option) => (
        <ChoiceChip
          key={String(option.key)}
          label={option.label}
          active={selected === option.key}
          onPress={() => onSelect(option.key)}
        />
      ))}
    </View>
  );
}

function splitCsv(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function AiModeSetupScreen({ preferences, language = 'en', onBack, onSave }: AiModeSetupScreenProps) {
  const [goal, setGoal] = useState<AiPlannerGoal | null>(preferences.aiPlannerGoal);
  const [daysPerWeek, setDaysPerWeek] = useState<AiPlannerDaysPerWeek | null>(preferences.aiPlannerDaysPerWeek);
  const [experience, setExperience] = useState<AiPlannerExperience | null>(preferences.aiPlannerExperience);
  const [sessionMinutes, setSessionMinutes] = useState<number | null>(preferences.aiPlannerSessionMinutes);
  const [equipment, setEquipment] = useState<AiPlannerEquipment | null>(preferences.aiPlannerEquipment);
  const [recovery, setRecovery] = useState<AiPlannerRecovery | null>(preferences.aiPlannerRecovery);
  const [mustInclude, setMustInclude] = useState(preferences.aiPlannerMustInclude);
  const [avoid, setAvoid] = useState(preferences.aiPlannerAvoid);
  const [limitations, setLimitations] = useState(preferences.aiPlannerLimitations);

  const readyToSave = useMemo(
    () => Boolean(goal && daysPerWeek && experience && sessionMinutes && equipment && recovery),
    [daysPerWeek, equipment, experience, goal, recovery, sessionMinutes],
  );

  return (
    <>
      <ScreenHeader
        title={t(language, 'aiSetup.title')}
        subtitle={t(language, 'aiSetup.subtitle')}
        onBack={onBack}
        tone="dark"
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.noteCard}>
          <Text style={styles.noteTitle}>{t(language, 'aiSetup.paidTitle')}</Text>
          <Text style={styles.noteBody}>
            Keep the app free. Charge only the AI layer. This setup is saved once, then the center AI button can open the next workout flow directly.
          </Text>
          <Text style={styles.noteMeta}>{t(language, 'aiSetup.paidMeta')}</Text>
        </View>

        <SectionLabel label={t(language, 'aiSetup.primaryGoal')} />
        <OptionRow<AiPlannerGoal>
          options={[
            { key: 'strength', label: t(language, 'ready.goal.strength') },
            { key: 'muscle', label: t(language, 'setup.goal.muscle') },
            { key: 'fat_loss', label: t(language, 'ready.goal.fatLoss') },
            { key: 'fitness', label: t(language, 'aiSetup.fitness') },
          ]}
          selected={goal}
          onSelect={setGoal}
        />

        <SectionLabel label={t(language, 'tpl.daysPerWeek')} />
        <OptionRow<AiPlannerDaysPerWeek>
          options={[
            { key: 1, label: t(language, 'aiSetup.dayOne') },
            { key: 2, label: t(language, 'planSet.days', { count: 2 }) },
            { key: 3, label: t(language, 'planSet.days', { count: 3 }) },
            { key: 4, label: t(language, 'planSet.days', { count: 4 }) },
          ]}
          selected={daysPerWeek}
          onSelect={setDaysPerWeek}
        />

        <SectionLabel label={t(language, 'myData.experience')} />
        <OptionRow<AiPlannerExperience>
          options={[
            { key: 'beginner', label: t(language, 'myData.level.beginner') },
            { key: 'intermediate', label: t(language, 'ready.level.intermediate') },
            { key: 'advanced', label: t(language, 'myData.level.advanced') },
          ]}
          selected={experience}
          onSelect={setExperience}
        />

        <SectionLabel label={t(language, 'aiSetup.sessionLength')} />
        <OptionRow<number>
          options={[
            { key: 30, label: '30 min' },
            { key: 45, label: '45 min' },
            { key: 60, label: '60 min' },
            { key: 75, label: '75 min' },
            { key: 90, label: '90 min' },
          ]}
          selected={sessionMinutes}
          onSelect={setSessionMinutes}
        />

        <SectionLabel label={t(language, 'myData.equipment')} />
        <OptionRow<AiPlannerEquipment>
          options={[
            { key: 'full_gym', label: t(language, 'setup.equip.gym') },
            { key: 'home_gym', label: t(language, 'aiSetup.homeGym') },
            { key: 'minimal', label: t(language, 'aiSetup.minimal') },
            { key: 'bodyweight', label: t(language, 'facet.bodyweight') },
          ]}
          selected={equipment}
          onSelect={setEquipment}
        />

        <SectionLabel label={t(language, 'aiSetup.recovery')} />
        <OptionRow<AiPlannerRecovery>
          options={[
            { key: 'low', label: t(language, 'aiSetup.low') },
            { key: 'moderate', label: t(language, 'aiSetup.moderate') },
            { key: 'high', label: t(language, 'aiSetup.high') },
          ]}
          selected={recovery}
          onSelect={setRecovery}
        />

        <SectionLabel label={t(language, 'aiSetup.mustInclude')} />
        <TextInput
          value={mustInclude}
          onChangeText={setMustInclude}
          placeholder={t(language, 'aiSetup.mustIncludeHint')}
          placeholderTextColor="#9CA3AF"
          style={styles.input}
        />

        <SectionLabel label={t(language, 'aiSetup.avoid')} />
        <TextInput
          value={avoid}
          onChangeText={setAvoid}
          placeholder={t(language, 'aiSetup.avoidHint')}
          placeholderTextColor="#9CA3AF"
          style={styles.input}
        />

        <SectionLabel label={t(language, 'aiSetup.limitations')} />
        <TextInput
          value={limitations}
          onChangeText={setLimitations}
          placeholder={t(language, 'aiSetup.limitationsHint')}
          placeholderTextColor="#9CA3AF"
          style={[styles.input, styles.multilineInput]}
          multiline
          textAlignVertical="top"
        />

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>{t(language, 'aiSetup.summaryTitle')}</Text>
          <Text style={styles.summaryBody}>{t(language, 'aiSetup.summaryBody')}</Text>
          <Text style={styles.summaryMeta}>
            {t(language, 'aiSetup.includes', {
              list: splitCsv(mustInclude).slice(0, 3).join(' / ') || t(language, 'aiSetup.noRequired'),
            })}
          </Text>
        </View>

        <Pressable
          disabled={!readyToSave}
          onPress={() =>
            onSave({
              aiSetupCompleted: true,
              aiPlannerGoal: goal,
              aiPlannerDaysPerWeek: daysPerWeek,
              aiPlannerExperience: experience,
              aiPlannerSessionMinutes: sessionMinutes,
              aiPlannerEquipment: equipment,
              aiPlannerRecovery: recovery,
              aiPlannerMustInclude: mustInclude.trim(),
              aiPlannerAvoid: avoid.trim(),
              aiPlannerLimitations: limitations.trim(),
            })
          }
          style={[styles.primaryButton, !readyToSave && styles.primaryButtonDisabled]}
        >
          <Text style={styles.primaryButtonText}>{t(language, 'aiSetup.save')}</Text>
        </Pressable>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 140,
    gap: spacing.md,
    backgroundColor: '#FFFFFF',
  },
  noteCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#E9D5FF',
    backgroundColor: '#FAF5FF',
    padding: spacing.lg,
    gap: spacing.xs,
  },
  noteTitle: {
    color: '#111111',
    fontSize: 16,
    fontWeight: '900',
  },
  noteBody: {
    color: '#374151',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  noteMeta: {
    color: '#7C3AED',
    fontSize: 12,
    fontWeight: '800',
  },
  sectionLabel: {
    color: '#111111',
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginTop: spacing.sm,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  choiceChip: {
    minHeight: 42,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceChipActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  choiceChipText: {
    color: '#111111',
    fontSize: 13,
    fontWeight: '800',
  },
  choiceChipTextActive: {
    color: '#FFFFFF',
  },
  input: {
    minHeight: 54,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.md,
    color: '#111111',
    fontSize: 14,
    fontWeight: '600',
  },
  multilineInput: {
    minHeight: 104,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  summaryCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    padding: spacing.lg,
    gap: spacing.xs,
  },
  summaryTitle: {
    color: '#111111',
    fontSize: 16,
    fontWeight: '900',
  },
  summaryBody: {
    color: '#374151',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  summaryMeta: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '700',
  },
  primaryButton: {
    minHeight: 56,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111111',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  primaryButtonDisabled: {
    opacity: 0.4,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
});
