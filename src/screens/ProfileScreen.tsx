import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ConfirmDialog } from '../components/ConfirmDialog';
import { BadgePill, SurfaceCard } from '../components/MainScreenPrimitives';
import { ScreenHeader } from '../components/ScreenHeader';
import { SegmentedControl } from '../components/SegmentedControl';
import { convertWeightToKg, formatWeight, formatWeightInputValue, parseNumberInput } from '../lib/format';
import {
  getGuidanceModeLabel,
  getScheduleModeLabel,
  getSetupEquipmentTitle,
  getSetupGoalTitle,
} from '../lib/firstRunSetup';
import { appInfo, colors, layout, radii, spacing } from '../theme';
import { AppPreferences, UnitPreference } from '../types/models';

interface ProfileScreenProps {
  preferences: AppPreferences;
  latestBodyweightKg: number | null;
  recommendedProgramName?: string | null;
  recommendedProgramDaysPerWeek?: number | null;
  onUnitPreferenceChange: (nextUnit: UnitPreference) => void;
  onPreferencesChange: (patch: Partial<AppPreferences>) => void;
  onOpenPlanSettings: () => void;
  onSupportPress?: () => void;
  onContactPress?: () => void;
  onResetAllData: () => void;
}

interface ToggleRowProps {
  title: string;
  description: string;
  value: boolean;
  onPress: () => void;
}

function SectionLabel({ label }: { label: string }) {
  return <Text style={styles.sectionLabel}>{label}</Text>;
}

function SignalCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.signalCard}>
      <Text style={styles.signalLabel}>{label}</Text>
      <Text style={styles.signalValue}>{value}</Text>
    </View>
  );
}

function ToggleRow({ title, description, value, onPress }: ToggleRowProps) {
  return (
    <Pressable onPress={onPress} style={styles.preferenceRow}>
      <View style={styles.preferenceCopy}>
        <Text style={styles.preferenceTitle}>{title}</Text>
        <Text style={styles.preferenceDescription}>{description}</Text>
      </View>
      <View style={[styles.toggle, value && styles.toggleActive]}>
        <Text style={[styles.toggleText, value && styles.toggleTextActive]}>{value ? 'On' : 'Off'}</Text>
      </View>
    </Pressable>
  );
}

export function ProfileScreen({
  preferences,
  latestBodyweightKg,
  recommendedProgramName,
  recommendedProgramDaysPerWeek = null,
  onUnitPreferenceChange,
  onPreferencesChange,
  onOpenPlanSettings,
  onSupportPress,
  onContactPress,
  onResetAllData,
}: ProfileScreenProps) {
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [restDraft, setRestDraft] = useState(`${preferences.defaultRestSeconds}`);
  const [goalWeightDraft, setGoalWeightDraft] = useState(
    formatWeightInputValue(preferences.bodyweightGoalKg, preferences.unitPreference),
  );

  useEffect(() => {
    setRestDraft(`${preferences.defaultRestSeconds}`);
  }, [preferences.defaultRestSeconds]);

  useEffect(() => {
    setGoalWeightDraft(formatWeightInputValue(preferences.bodyweightGoalKg, preferences.unitPreference));
  }, [preferences.bodyweightGoalKg, preferences.unitPreference]);

  function commitRestDraft() {
    const parsed = Number(restDraft.trim());
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setRestDraft(`${preferences.defaultRestSeconds}`);
      return;
    }

    onPreferencesChange({ defaultRestSeconds: Math.round(parsed) });
  }

  function commitGoalWeightDraft() {
    const parsed = parseNumberInput(goalWeightDraft);

    if (parsed === null) {
      setGoalWeightDraft('');
      onPreferencesChange({ bodyweightGoalKg: null });
      return;
    }

    if (parsed <= 0) {
      setGoalWeightDraft(formatWeightInputValue(preferences.bodyweightGoalKg, preferences.unitPreference));
      return;
    }

    onPreferencesChange({
      bodyweightGoalKg: convertWeightToKg(parsed, preferences.unitPreference),
    });
  }

  const setupComplete = preferences.setupCompleted;
  const setupBadges = setupComplete
    ? [
        getSetupGoalTitle(preferences.setupGoal!),
        `${preferences.setupDaysPerWeek} days`,
        getSetupEquipmentTitle(preferences.setupEquipment!),
      ]
    : [];

  const fallbackSetupTitle = setupComplete
    ? (() => {
        switch (preferences.setupGoal) {
          case 'strength':
            return `${preferences.setupDaysPerWeek}-day strength fit`;
          case 'muscle':
            return `${preferences.setupDaysPerWeek}-day muscle fit`;
          case 'general':
            return `${preferences.setupDaysPerWeek}-day general fit`;
          case 'run_mobility':
            return `${preferences.setupDaysPerWeek}-day run + mobility fit`;
          default:
            return 'Current fit';
        }
      })()
    : 'No setup locked in yet';

  const setupTitle =
    setupComplete &&
    recommendedProgramName &&
    recommendedProgramDaysPerWeek === preferences.setupDaysPerWeek
      ? recommendedProgramName
      : fallbackSetupTitle;

  const heroMeta = setupComplete
    ? `${getGuidanceModeLabel(preferences.setupGuidanceMode!)} · ${getScheduleModeLabel(preferences.setupScheduleMode!)}`
    : 'Lock in your plan and keep your defaults tight.';

  const quickSignals = [
    { label: 'Units', value: preferences.unitPreference.toUpperCase() },
    { label: 'Rest', value: `${preferences.defaultRestSeconds}s` },
    { label: 'Focus', value: preferences.autoFocusNextInput ? 'On' : 'Off' },
  ];

  return (
    <>
      <ScreenHeader title="Profile" subtitle="Quiet controls, defaults, and data." />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SurfaceCard accent="neutral" emphasis="hero" style={styles.heroSurface}>
          <View style={styles.heroContent}>
            <Text style={styles.heroKicker}>{setupComplete ? 'Profile control' : 'Finish setup'}</Text>

            <View style={styles.setupBadgeRow}>
              {(setupBadges.length > 0 ? setupBadges : ['Setup', 'Not finished']).map((badge) => (
                <BadgePill key={badge} label={badge} accent="neutral" />
              ))}
            </View>

            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>{setupTitle}</Text>
              <Text style={styles.heroMeta}>{heroMeta}</Text>
            </View>

            <Pressable onPress={onOpenPlanSettings} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>{setupComplete ? 'Open plan settings' : 'Finish setup'}</Text>
            </Pressable>
          </View>
        </SurfaceCard>

        <View style={styles.signalRow}>
          {quickSignals.map((signal) => (
            <SignalCard key={signal.label} label={signal.label} value={signal.value} />
          ))}
        </View>

        <SectionLabel label="Defaults" />

        <SurfaceCard accent="neutral" emphasis="standard" style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardKicker}>Units + logging</Text>
            <Text style={styles.cardTitle}>Workout defaults</Text>
            <Text style={styles.cardBody}>Keep logging tight and consistent.</Text>
          </View>

          <SegmentedControl
            options={[
              { key: 'kg', label: 'kg' },
              { key: 'lb', label: 'lb' },
            ]}
            selectedKey={preferences.unitPreference}
            onSelect={(key) => onUnitPreferenceChange(key as UnitPreference)}
            tone="neutral"
          />

          <View style={styles.utilityRow}>
            <View style={styles.preferenceCopy}>
              <Text style={styles.preferenceTitle}>Default rest timer</Text>
              <Text style={styles.preferenceDescription}>Starting rest for new exercises.</Text>
            </View>
            <TextInput
              value={restDraft}
              onChangeText={setRestDraft}
              onBlur={commitRestDraft}
              onSubmitEditing={commitRestDraft}
              keyboardType="number-pad"
              placeholder="120"
              placeholderTextColor={colors.textMuted}
              style={styles.restInput}
              selectionColor={colors.accent}
            />
          </View>

          <View style={styles.divider} />

          <ToggleRow
            title="Auto-focus next input"
            description="Move through weight and reps faster."
            value={preferences.autoFocusNextInput}
            onPress={() => onPreferencesChange({ autoFocusNextInput: !preferences.autoFocusNextInput })}
          />
        </SurfaceCard>

        <SectionLabel label="Bodyweight" />

        <SurfaceCard accent="neutral" emphasis="standard" style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardKicker}>Progress</Text>
            <Text style={styles.cardTitle}>Latest and target</Text>
            <Text style={styles.cardBody}>Keep one lightweight bodyweight direction in reach.</Text>
          </View>

          <View style={styles.metricRow}>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Latest</Text>
              <Text style={styles.metricValue}>{formatWeight(latestBodyweightKg, preferences.unitPreference)}</Text>
            </View>

            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Target</Text>
              <Text style={styles.metricValue}>
                {preferences.bodyweightGoalKg === null
                  ? 'None'
                  : formatWeight(preferences.bodyweightGoalKg, preferences.unitPreference)}
              </Text>
            </View>
          </View>

          <View style={styles.utilityRow}>
            <View style={styles.preferenceCopy}>
              <Text style={styles.preferenceTitle}>Target bodyweight</Text>
              <Text style={styles.preferenceDescription}>Optional. Leave blank if you do not want one.</Text>
            </View>
            <TextInput
              value={goalWeightDraft}
              onChangeText={setGoalWeightDraft}
              onBlur={commitGoalWeightDraft}
              onSubmitEditing={commitGoalWeightDraft}
              keyboardType="decimal-pad"
              placeholder={preferences.unitPreference === 'kg' ? '80' : '176'}
              placeholderTextColor={colors.textMuted}
              style={styles.restInput}
              selectionColor={colors.accent}
            />
          </View>
        </SurfaceCard>

        {onSupportPress && onContactPress ? (
          <>
            <SectionLabel label="Support" />

            <SurfaceCard accent="neutral" emphasis="standard" style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardKicker}>Keep it free</Text>
                <Text style={styles.cardTitle}>Free core app</Text>
                <Text style={styles.cardBody}>Optional support, no locked core logging.</Text>
              </View>

              <View style={styles.supportActions}>
                <Pressable onPress={onSupportPress} style={styles.primaryButtonCompact}>
                  <Text style={styles.primaryButtonCompactText}>Support Gymlog</Text>
                </Pressable>
                <Pressable onPress={onContactPress} style={styles.secondaryButtonCompact}>
                  <Text style={styles.secondaryButtonCompactText}>Contact</Text>
                </Pressable>
              </View>
            </SurfaceCard>
          </>
        ) : null}

        <SectionLabel label="Data" />

        <SurfaceCard accent="neutral" emphasis="standard" style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardKicker}>This device</Text>
            <Text style={styles.cardTitle}>Reset local data</Text>
            <Text style={styles.cardBody}>Clear workouts, progress, history, and preferences on this device.</Text>
          </View>

          <Pressable onPress={() => setConfirmVisible(true)} style={styles.destructiveButton}>
            <Text style={styles.destructiveButtonText}>Reset all data</Text>
          </Pressable>
        </SurfaceCard>

        <SurfaceCard accent="neutral" emphasis="flat" style={styles.metaCard}>
          <Text style={styles.metaKicker}>App</Text>
          <Text style={styles.metaLine}>{appInfo.name}</Text>
          <Text style={styles.metaLineMuted}>Version {appInfo.version}</Text>
        </SurfaceCard>
      </ScrollView>
      <ConfirmDialog
        visible={confirmVisible}
        title="Reset all data"
        message="This clears workouts, sessions, bodyweight, progress, and saved preferences on this device."
        confirmLabel="Reset"
        destructive
        onCancel={() => setConfirmVisible(false)}
        onConfirm={() => {
          onResetAllData();
          setConfirmVisible(false);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: layout.bottomTabBarReserve,
    gap: spacing.md,
  },
  heroSurface: {
    minHeight: 310,
  },
  heroContent: {
    gap: spacing.md,
    padding: spacing.lg,
  },
  heroKicker: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  setupBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  heroCopy: {
    gap: spacing.xs,
  },
  heroTitle: {
    color: colors.textPrimary,
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  heroMeta: {
    color: 'rgba(244,250,255,0.74)',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  primaryButton: {
    minHeight: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4FAFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.24,
    shadowRadius: 24,
    elevation: 8,
  },
  primaryButtonText: {
    color: '#0B0F14',
    fontSize: 15,
    fontWeight: '900',
  },
  signalRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  signalCard: {
    flex: 1,
    minHeight: 76,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(18, 26, 35, 0.82)',
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    gap: 2,
  },
  signalLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  signalValue: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '900',
  },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: spacing.sm,
  },
  card: {
    gap: spacing.md,
  },
  cardHeader: {
    gap: 2,
  },
  cardKicker: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  cardBody: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  utilityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  preferenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  preferenceCopy: {
    flex: 1,
    gap: 3,
  },
  preferenceTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  preferenceDescription: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  restInput: {
    width: 96,
    minHeight: 52,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(10, 14, 19, 0.84)',
    textAlign: 'center',
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  toggle: {
    minWidth: 68,
    minHeight: 38,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10, 14, 19, 0.82)',
  },
  toggleActive: {
    backgroundColor: '#F4FAFF',
    borderColor: '#F4FAFF',
  },
  toggleText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  toggleTextActive: {
    color: '#0B0F14',
  },
  metricRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  metricCard: {
    flex: 1,
    minHeight: 108,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(10, 14, 19, 0.64)',
    padding: spacing.md,
    justifyContent: 'space-between',
  },
  metricLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  metricValue: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  supportActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  primaryButtonCompact: {
    flex: 1,
    minHeight: 50,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4FAFF',
  },
  primaryButtonCompactText: {
    color: '#0B0F14',
    fontSize: 14,
    fontWeight: '900',
  },
  secondaryButtonCompact: {
    minHeight: 50,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  secondaryButtonCompactText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  destructiveButton: {
    minHeight: 52,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  destructiveButtonText: {
    color: '#F4B39C',
    fontSize: 14,
    fontWeight: '900',
  },
  metaCard: {
    gap: 2,
    marginTop: spacing.xs,
  },
  metaKicker: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  metaLine: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  metaLineMuted: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
});
