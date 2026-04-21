import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ScreenHeader } from '../components/ScreenHeader';
import { radii, spacing } from '../theme';
import { AppLanguage, AppPreferences } from '../types/models';

interface ProfileScreenProps {
  preferences: AppPreferences;
  latestBodyweightKg: number | null;
  recommendedProgramName?: string | null;
  recommendedProgramDaysPerWeek?: number | null;
  onUnitPreferenceChange: (nextUnit: 'kg' | 'lb') => void;
  onPreferencesChange: (patch: Partial<AppPreferences>) => void;
  onOpenPlanSettings: () => void;
  onOpenSettings: () => void;
  onSupportPress?: () => void;
  onContactPress?: () => void;
  onResetAllData: () => void;
}

function ChipGroup({
  selected,
  onSelect,
}: {
  selected: AppLanguage;
  onSelect: (value: AppLanguage) => void;
}) {
  return (
    <View style={styles.chipGroup}>
      {[
        { key: 'fi' as const, label: 'FIN' },
        { key: 'en' as const, label: 'ENG' },
      ].map((option) => {
        const active = option.key === selected;
        return (
          <Pressable
            key={option.key}
            onPress={() => onSelect(option.key)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ProfileScreen({ preferences, onPreferencesChange, onOpenSettings }: ProfileScreenProps) {
  const signedIn = preferences.selectedSignInMethod !== null;

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Profile" tone="dark" rightActionLabel="⚙" onRightActionPress={onOpenSettings} />

      <Text style={styles.sectionLabel}>Account</Text>

      <View style={styles.accountCard}>
        <View style={styles.accountTopRow}>
          <View style={styles.accountLeft}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>G</Text>
            </View>
            <View style={styles.accountCopy}>
              <Text style={styles.accountTitle}>{signedIn ? 'Account' : 'Guest account'}</Text>
              <Text style={styles.accountSubtitle}>{signedIn ? 'Account linked.' : 'No email linked yet.'}</Text>
            </View>
          </View>

          <View style={styles.languageBlock}>
            <Text style={styles.languageLabel}>Language</Text>
            <ChipGroup
              selected={preferences.appLanguage}
              onSelect={(value) => onPreferencesChange({ appLanguage: value })}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.lg,
  },
  sectionLabel: {
    color: '#111111',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    marginBottom: spacing.sm,
  },
  accountCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    padding: spacing.lg,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
  },
  accountTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  accountLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
  },
  accountCopy: {
    flex: 1,
    gap: 2,
  },
  accountTitle: {
    color: '#111111',
    fontSize: 18,
    fontWeight: '800',
  },
  accountSubtitle: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '600',
  },
  languageBlock: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  languageLabel: {
    color: '#111111',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  chipGroup: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  chip: {
    minHeight: 38,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: '#111111',
    borderColor: '#111111',
  },
  chipText: {
    color: '#111111',
    fontSize: 13,
    fontWeight: '800',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
});
