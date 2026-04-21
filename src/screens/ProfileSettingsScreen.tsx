import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ConfirmDialog } from '../components/ConfirmDialog';
import { ScreenHeader } from '../components/ScreenHeader';
import { appInfo, layout, radii, spacing } from '../theme';
import { AppLanguage, AppPreferences, SignInMethod, UnitPreference } from '../types/models';

interface ProfileSettingsScreenProps {
  preferences: AppPreferences;
  onBack: () => void;
  onUnitPreferenceChange: (nextUnit: UnitPreference) => void;
  onPreferencesChange: (patch: Partial<AppPreferences>) => void;
  onSupportPress?: () => void;
  onResetAllData: () => void;
}

function SectionLabel({ label }: { label: string }) {
  return <Text style={styles.sectionLabel}>{label}</Text>;
}

function SoonBadge() {
  return (
    <View style={styles.soonBadge}>
      <Text style={styles.soonBadgeText}>Soon</Text>
    </View>
  );
}

function SettingsRow({
  title,
  subtitle,
  right,
  destructive = false,
  onPress,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  destructive?: boolean;
  onPress?: () => void;
}) {
  const content = (
    <View style={styles.row}>
      <View style={styles.rowCopy}>
        <Text style={[styles.rowTitle, destructive && styles.rowTitleDestructive]}>{title}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );

  if (!onPress) {
    return content;
  }

  return <Pressable onPress={onPress}>{content}</Pressable>;
}

function Divider() {
  return <View style={styles.divider} />;
}

function ListGroup({ children }: { children: React.ReactNode }) {
  return <View style={styles.listGroup}>{children}</View>;
}

function ChipGroup<T extends string>({
  options,
  selected,
  onSelect,
}: {
  options: Array<{ key: T; label: string }>;
  selected: T;
  onSelect: (value: T) => void;
}) {
  return (
    <View style={styles.chipGroup}>
      {options.map((option) => {
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

function signInLabel(method: SignInMethod | null) {
  switch (method) {
    case 'apple':
      return 'Apple';
    case 'google':
      return 'Google';
    case 'email':
      return 'Email';
    case 'local':
      return 'Local';
    default:
      return 'Guest';
  }
}

export function ProfileSettingsScreen({
  preferences,
  onBack,
  onUnitPreferenceChange,
  onPreferencesChange,
  onSupportPress,
  onResetAllData,
}: ProfileSettingsScreenProps) {
  const [confirmVisible, setConfirmVisible] = useState(false);

  return (
    <>
      <ScreenHeader title="Settings" tone="dark" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SectionLabel label="Account" />
        <ListGroup>
          <SettingsRow
            title="Account type"
            subtitle={signInLabel(preferences.selectedSignInMethod)}
            right={<SoonBadge />}
          />
          <Divider />
          <SettingsRow
            title="Name / email / avatar"
            subtitle="Profile identity"
            right={<SoonBadge />}
          />
          <Divider />
          <SettingsRow
            title="Synchronize workout data"
            subtitle="Cloud sync"
            right={<SoonBadge />}
          />
        </ListGroup>

        <SectionLabel label="Preferences" />
        <ListGroup>
          <SettingsRow
            title="Units"
            subtitle={preferences.unitPreference === 'kg' ? 'kg / cm' : 'lb / in'}
          />
          <ChipGroup<UnitPreference>
            options={[
              { key: 'kg', label: 'kg' },
              { key: 'lb', label: 'lb' },
            ]}
            selected={preferences.unitPreference}
            onSelect={onUnitPreferenceChange}
          />
          <Divider />
          <SettingsRow title="Theme" subtitle="Light" right={<SoonBadge />} />
          <Divider />
          <SettingsRow
            title="Language"
            subtitle={preferences.appLanguage === 'fi' ? 'Finnish' : 'English'}
          />
          <ChipGroup<AppLanguage>
            options={[
              { key: 'fi', label: 'FIN' },
              { key: 'en', label: 'ENG' },
            ]}
            selected={preferences.appLanguage}
            onSelect={(value) => onPreferencesChange({ appLanguage: value })}
          />
        </ListGroup>

        <SectionLabel label="More" />
        <ListGroup>
          <SettingsRow
            title="Support"
            subtitle="Get help"
            right={onSupportPress ? <Text style={styles.chevron}>{'>'}</Text> : <SoonBadge />}
            onPress={onSupportPress}
          />
          <Divider />
          <SettingsRow title="About" subtitle="App info" right={<SoonBadge />} />
          <Divider />
          <SettingsRow title="Rate us" subtitle="Share feedback" right={<SoonBadge />} />
          <Divider />
          <SettingsRow title="Account privacy" subtitle="Privacy controls" right={<SoonBadge />} />
          <Divider />
          <SettingsRow title="Import data" subtitle="Bring data in" right={<SoonBadge />} />
          <Divider />
          <SettingsRow title="Export data" subtitle="Export your data" right={<SoonBadge />} />
        </ListGroup>

        <SectionLabel label="Data" />
        <ListGroup>
          <SettingsRow
            title="Delete account"
            subtitle="Remove account access"
            destructive
            right={<SoonBadge />}
          />
          <Divider />
          <SettingsRow
            title="Log out"
            subtitle="End current session"
            destructive
            right={<SoonBadge />}
          />
          <Divider />
          <SettingsRow title="Version" subtitle={appInfo.version} />
          <Divider />
          <SettingsRow
            title="Reset all data"
            subtitle="This device only"
            destructive
            onPress={() => setConfirmVisible(true)}
          />
        </ListGroup>
      </ScrollView>

      <ConfirmDialog
        visible={confirmVisible}
        title="Reset all data"
        message="This clears workouts, sessions, bodyweight, progress, measurements, and saved preferences on this device."
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
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.lg,
    paddingBottom: layout.bottomTabBarReserve,
  },
  sectionLabel: {
    color: '#111111',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.9,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  listGroup: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
  },
  row: {
    minHeight: 64,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  rowCopy: {
    flex: 1,
    gap: 3,
  },
  rowTitle: {
    color: '#111111',
    fontSize: 18,
    fontWeight: '600',
  },
  rowTitleDestructive: {
    color: '#B91C1C',
  },
  rowSubtitle: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginLeft: spacing.xs,
  },
  soonBadge: {
    minHeight: 24,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: '#ECFDF3',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  soonBadgeText: {
    color: '#15803D',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  chevron: {
    color: '#9CA3AF',
    fontSize: 22,
    lineHeight: 22,
    fontWeight: '700',
  },
  chipGroup: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.md,
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
