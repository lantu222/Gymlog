import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ConfirmDialog } from '../components/ConfirmDialog';
import { BadgePill, SectionHeaderBlock, SurfaceCard } from '../components/MainScreenPrimitives';
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
  onUnitPreferenceChange,
  onPreferencesChange,
  onOpenPlanSettings,
  onSupportPress,
  onContactPress,
  onResetAllData,
}: ProfileScreenProps) {
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [restDraft, setRestDraft] = useState(`${preferences.defaultRestSeconds}`);
  const [goalWeightDraft, setGoalWeightDraft] = useState(formatWeightInputValue(preferences.bodyweightGoalKg, preferences.unitPreference));

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

  return (
    <>
      <ScreenHeader title="Profile" subtitle="Preferences, privacy, and quiet utility surfaces." />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SurfaceCard accent="blue" emphasis="utility" style={styles.metaCard}>
          <Text style={styles.metaKicker}>App</Text>
          <Text style={styles.appName}>{appInfo.name}</Text>
          <Text style={styles.muted}>Version {appInfo.version}</Text>
        </SurfaceCard>

        <SectionHeaderBlock
          accent="blue"
          kicker="Preferences"
          title="Your setup"
          subtitle="Keep this screen clean and utility-first while matching the main shell."
        />

        <SurfaceCard accent="orange" emphasis="utility" style={styles.card}>
          <SectionHeaderBlock
            accent="orange"
            kicker="Plan settings"
            title={setupComplete ? 'Open plan settings' : 'Finish your setup'}
            subtitle={
              setupComplete
                ? 'Tailoring, week fit, and the next plan action now live in one place.'
                : 'Gymlog works better once it knows what kind of plan should fit your real week.'
            }
          />

          {setupComplete ? (
            <View style={styles.setupBadgeRow}>
              {setupBadges.map((badge) => (
                <BadgePill key={badge} label={badge} accent="orange" />
              ))}
            </View>
          ) : null}

          <View style={styles.preferenceBlock}>
            <Text style={styles.preferenceTitle}>
              {setupComplete ? (recommendedProgramName ?? 'No saved recommendation yet') : 'No setup locked in yet'}
            </Text>
            <Text style={styles.preferenceDescription}>
              {setupComplete
                ? `${getGuidanceModeLabel(preferences.setupGuidanceMode!)}. ${getScheduleModeLabel(preferences.setupScheduleMode!)}.`
                : 'Goal, days per week, equipment, guidance mode, and focus live in one tailoring path.'}
            </Text>
          </View>

          <Pressable onPress={onOpenPlanSettings} style={styles.setupButton}>
            <Text style={styles.setupButtonText}>{setupComplete ? 'Open plan settings' : 'Finish setup'}</Text>
          </Pressable>
        </SurfaceCard>

        <SurfaceCard accent="blue" emphasis="utility" style={styles.card}>
          <View style={styles.preferenceBlock}>
            <Text style={styles.preferenceTitle}>Units</Text>
            <Text style={styles.preferenceDescription}>Choose how workout and bodyweight values are displayed.</Text>
          </View>
          <SegmentedControl
            options={[
              { key: 'kg', label: 'kg' },
              { key: 'lb', label: 'lb' },
            ]}
            selectedKey={preferences.unitPreference}
            onSelect={(key) => onUnitPreferenceChange(key as UnitPreference)}
          />

          <View style={styles.preferenceRowStatic}>
            <View style={styles.preferenceCopy}>
              <Text style={styles.preferenceTitle}>Default rest timer</Text>
              <Text style={styles.preferenceDescription}>Used as the starting rest value when adding new exercises.</Text>
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

          <ToggleRow
            title="Auto-focus next input"
            description="Move through weight and reps fields faster during logging."
            value={preferences.autoFocusNextInput}
            onPress={() => onPreferencesChange({ autoFocusNextInput: !preferences.autoFocusNextInput })}
          />
        </SurfaceCard>

        <SurfaceCard accent="blue" emphasis="utility" style={styles.card}>
          <View style={styles.preferenceBlock}>
            <Text style={styles.preferenceTitle}>Bodyweight target</Text>
            <Text style={styles.preferenceDescription}>Keep a lightweight bodyweight direction available without turning Gymlog into a full nutrition app.</Text>
          </View>

          <View style={styles.preferenceRowStatic}>
            <View style={styles.preferenceCopy}>
              <Text style={styles.preferenceTitle}>Latest bodyweight</Text>
              <Text style={styles.preferenceDescription}>Pulled from your saved progress entries.</Text>
            </View>
            <Text style={styles.staticValue}>{formatWeight(latestBodyweightKg, preferences.unitPreference)}</Text>
          </View>

          <View style={styles.preferenceRowStatic}>
            <View style={styles.preferenceCopy}>
              <Text style={styles.preferenceTitle}>Target bodyweight</Text>
              <Text style={styles.preferenceDescription}>Optional. Leave empty if you do not want a target in the setup context.</Text>
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
          <SurfaceCard accent="orange" emphasis="utility" style={styles.card}>
            <SectionHeaderBlock
              accent="orange"
              kicker="Support"
              title="Free core app"
              subtitle="Optional support later without gating logging, workouts, or progress."
            />
            <View style={styles.supportActions}>
              <Pressable onPress={onSupportPress} style={styles.supportButton}>
                <Text style={styles.supportButtonText}>Support Gymlog</Text>
              </Pressable>
              <Pressable onPress={onContactPress} style={styles.supportButtonSecondary}>
                <Text style={styles.supportButtonSecondaryText}>Contact</Text>
              </Pressable>
            </View>
          </SurfaceCard>
        ) : null}

        <SurfaceCard accent="rose" emphasis="utility" style={styles.card}>
          <SectionHeaderBlock
            accent="rose"
            kicker="Data"
            title="Reset local data"
            subtitle="Clear workouts, progress, history, and preferences on this device."
          />
          <Pressable onPress={() => setConfirmVisible(true)}>
            <Text style={styles.resetText}>Reset all data</Text>
          </Pressable>
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
  metaCard: {
    gap: spacing.xs,
  },
  card: {
    gap: spacing.md,
  },
  setupBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  metaKicker: {
    color: '#9ACCFF',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  appName: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '900',
  },
  muted: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  preferenceBlock: {
    gap: 3,
  },
  preferenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  preferenceRowStatic: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  preferenceCopy: {
    gap: 3,
    flex: 1,
  },
  preferenceTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  preferenceDescription: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  restInput: {
    width: 82,
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.input,
    textAlign: 'center',
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  staticValue: {
    minWidth: 82,
    textAlign: 'center',
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  setupButton: {
    minHeight: 46,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(240, 106, 57, 0.34)',
    backgroundColor: 'rgba(240, 106, 57, 0.18)',
  },
  setupButtonText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '900',
  },
  toggle: {
    minWidth: 60,
    minHeight: 36,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  toggleActive: {
    backgroundColor: colors.accentSoft,
    borderColor: 'rgba(110, 168, 254, 0.24)',
  },
  toggleText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  toggleTextActive: {
    color: colors.accent,
  },
  supportActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  supportButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentAlt,
    borderWidth: 1,
    borderColor: 'rgba(85, 138, 189, 0.34)',
  },
  supportButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  supportButtonSecondary: {
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(191, 74, 105, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(191, 74, 105, 0.30)',
  },
  supportButtonSecondaryText: {
    color: '#E58AA2',
    fontSize: 14,
    fontWeight: '700',
  },
  resetText: {
    color: '#F0997A',
    fontSize: 15,
    fontWeight: '800',
  },
});
