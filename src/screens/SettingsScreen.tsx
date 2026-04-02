import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ConfirmDialog } from '../components/ConfirmDialog';
import { ScreenHeader } from '../components/ScreenHeader';
import { SegmentedControl } from '../components/SegmentedControl';
import { appInfo, colors, radii, spacing } from '../theme';
import { UnitPreference } from '../types/models';

interface SettingsScreenProps {
  unitPreference: UnitPreference;
  onUnitPreferenceChange: (nextUnit: UnitPreference) => void;
  onResetAllData: () => void;
}

export function SettingsScreen({
  unitPreference,
  onUnitPreferenceChange,
  onResetAllData,
}: SettingsScreenProps) {
  const [confirmVisible, setConfirmVisible] = useState(false);

  return (
    <>
      <ScreenHeader
        title="Settings"
        subtitle="Keep the app minimal and practical."
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.label}>App</Text>
          <Text style={styles.value}>{appInfo.name}</Text>
          <Text style={styles.subtle}>Version {appInfo.version}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Preferences</Text>
          <View style={styles.preferenceRow}>
            <View style={styles.preferenceCopy}>
              <Text style={styles.preferenceTitle}>Theme</Text>
              <Text style={styles.subtle}>Dark</Text>
            </View>
          </View>
          <View style={styles.preferenceRow}>
            <View style={styles.preferenceCopy}>
              <Text style={styles.preferenceTitle}>Units</Text>
              <Text style={styles.subtle}>Choose the display unit for weights</Text>
            </View>
          </View>
          <SegmentedControl
            options={[
              { key: 'kg', label: 'kg' },
              { key: 'lb', label: 'lb' },
            ]}
            selectedKey={unitPreference}
            onSelect={(key) => onUnitPreferenceChange(key as UnitPreference)}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Export</Text>
          <Text style={styles.preferenceTitle}>Local export</Text>
          <Text style={styles.subtle}>Placeholder for export in a later version</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Reset</Text>
          <Text style={styles.subtle}>Clear workouts, history, progress, and saved logs on this device.</Text>
          <Text style={styles.resetLink} onPress={() => setConfirmVisible(true)}>
            Reset all data
          </Text>
        </View>
      </ScrollView>
      <ConfirmDialog
        visible={confirmVisible}
        title="Reset all data"
        message="This clears workouts, history, progress, and saved logs on this device."
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
    paddingBottom: spacing.xxl + 100,
    gap: spacing.md,
  },
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  value: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
  },
  subtle: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  preferenceRow: {
    gap: spacing.xs,
  },
  preferenceCopy: {
    gap: 2,
  },
  preferenceTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  resetLink: {
    color: colors.danger,
    fontSize: 15,
    fontWeight: '800',
    marginTop: spacing.xs,
  },
});
