import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { ConfirmDialog } from '../components/ConfirmDialog';
import {
  ChevronIcon,
  SectionLabel,
  SettingsRow,
  ToggleSwitch,
  settingsStyles,
} from '../components/SettingsUi';
import { getHealthProviderLabel } from '../integrations/health';
import { HG } from '../lightTheme';
import { appInfo, layout } from '../theme';
import { AppPreferences } from '../types/models';

interface SettingsScreenProps {
  preferences: AppPreferences;
  /** ISO timestamp of the first completed session — the honest "member since". */
  firstSessionAt: string | null;
  onBack: () => void;
  onPreferencesChange: (patch: Partial<AppPreferences>) => void;
  onManagePlan: () => void;
  onEditTraining: () => void;
  onOpenMyData: () => void;
  onOpenEditProfile: () => void;
  onOpenPremium: () => void;
  onConnectHealth: () => void;
  onResetAllData: () => void;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function memberSinceLabel(firstSessionAt: string | null) {
  if (!firstSessionAt) {
    return 'New here';
  }
  const date = new Date(firstSessionAt);
  if (Number.isNaN(date.getTime())) {
    return 'New here';
  }
  return `Training since ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

function getInitials(name: string | null) {
  if (!name?.trim()) {
    return 'G';
  }
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.charAt(0) ?? 'G';
  const second = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
  return (first + second).toUpperCase();
}

function HealthHeartGlyph() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 20s-7-4.35-7-9a4 4 0 0 1 7-2.65A4 4 0 0 1 19 11c0 4.65-7 9-7 9z"
        stroke="#FF2D55"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function StarGlyph() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3l2.4 5.1 5.6.8-4 4 .9 5.6-4.9-2.7-4.9 2.7.9-5.6-4-4 5.6-.8L12 3z"
        stroke="#C9B6FF"
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * Settings, pushed from the Profile gear.
 *
 * Everything on this screen is wired to something real. Rows for features that
 * do not exist yet (accounts, sync, notifications, subscriptions, language,
 * dark theme) are deliberately absent rather than shown as dead toggles or
 * "Soon" badges — mvp-launch-scope.md §7.4.
 */
export function SettingsScreen({
  preferences,
  firstSessionAt,
  onBack,
  onPreferencesChange,
  onManagePlan,
  onEditTraining,
  onOpenMyData,
  onOpenEditProfile,
  onOpenPremium,
  onConnectHealth,
  onResetAllData,
}: SettingsScreenProps) {
  const [resetVisible, setResetVisible] = useState(false);
  const displayName = preferences.profileName?.trim() ? preferences.profileName.trim() : 'Guest athlete';

  return (
    <View style={styles.screen}>
      {/* Pushed-screen header per the profile-suite spec: 40x40 back button on
          the left, title centred. Own header rather than ScreenHeader — that
          one's default tone paints light text for dark backgrounds. */}
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={onBack}
          style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.7 }]}
        >
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path d="M15 5l-7 7 7 7" stroke={HG.ink} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
        {/* PROFILE CHIP → Edit profile */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Edit profile"
          onPress={onOpenEditProfile}
          style={({ pressed }) => [styles.profileChip, pressed && { opacity: 0.8 }]}
        >
          <View style={styles.profileChipAvatar}>
            <Text style={styles.profileChipInitials}>{getInitials(preferences.profileName)}</Text>
          </View>
          <View style={styles.profileChipCopy}>
            <View style={styles.profileChipNameRow}>
              <Text numberOfLines={1} style={styles.profileChipName}>
                {displayName}
              </Text>
              {preferences.adaptiveCoachPremiumUnlocked ? (
                <View style={styles.proBadge}>
                  <Text style={styles.proBadgeText}>PRO</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.profileChipMeta}>{memberSinceLabel(firstSessionAt)}</Text>
          </View>
          <ChevronIcon />
        </Pressable>

        {/* WORKOUT FEEDBACK */}
        <View style={settingsStyles.section}>
          <SectionLabel label="WORKOUT FEEDBACK" />
          <View style={settingsStyles.card}>
            <SettingsRow
              title="Cue sounds"
              subtitle="Countdown, set logged, rest over"
              right={
                <ToggleSwitch
                  label="Cue sounds"
                  value={preferences.soundCuesEnabled}
                  onChange={(next) => onPreferencesChange({ soundCuesEnabled: next })}
                />
              }
            />
            <SettingsRow
              title="Haptics"
              subtitle="Vibration for the same moments"
              isLast
              right={
                <ToggleSwitch
                  label="Haptics"
                  value={preferences.hapticsEnabled}
                  onChange={(next) => onPreferencesChange({ hapticsEnabled: next })}
                />
              }
            />
          </View>
        </View>

        {/* TRAINING */}
        <View style={settingsStyles.section}>
          <SectionLabel label="TRAINING" />
          <View style={settingsStyles.card}>
            {/* Automated progression lives in Plan settings — one write surface. */}
            <SettingsRow title="Plan settings" subtitle="Schedule, equipment, progression" onPress={onManagePlan} right={<ChevronIcon />} />
            <SettingsRow
              title="Training profile"
              subtitle="Goal, experience, focus areas"
              onPress={onEditTraining}
              right={<ChevronIcon />}
            />
            <SettingsRow
              title="My data"
              subtitle="Basics, preferences, limitations"
              isLast
              onPress={onOpenMyData}
              right={<ChevronIcon />}
            />
          </View>
        </View>

        {/* UNITS */}
        <View style={settingsStyles.section}>
          <SectionLabel label="UNITS" />
          <View style={settingsStyles.card}>
            <SettingsRow title="Weight" subtitle="Used everywhere you log" isLast right={<Text style={settingsStyles.value}>kg</Text>} />
          </View>
        </View>

        {/* CONNECTIONS */}
        <View style={settingsStyles.section}>
          <SectionLabel label="CONNECTIONS" />
          <View style={settingsStyles.card}>
            <View style={styles.connectionRow}>
              <View style={styles.connectionTile}>
                <HealthHeartGlyph />
              </View>
              <View style={styles.connectionCopy}>
                <Text style={styles.connectionTitle}>{getHealthProviderLabel()}</Text>
                <Text style={styles.connectionSub}>Sync weight and workouts both ways.</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Connect ${getHealthProviderLabel()}`}
                onPress={onConnectHealth}
                style={({ pressed }) => [styles.connectAction, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.connectActionText}>Connect</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* PREMIUM */}
        <View style={settingsStyles.section}>
          <Pressable onPress={onOpenPremium} style={styles.premiumCard}>
            <View style={styles.premiumKicker}>
              <StarGlyph />
              <Text style={styles.premiumKickerText}>GAINER PREMIUM</Text>
            </View>
            <Text style={styles.premiumTitle}>Adaptive Coach</Text>
            <Text style={styles.premiumBody}>
              Reads your fatigue and progress, then adjusts each week&apos;s load for you. The longer you train, the sharper
              it gets.
            </Text>
            <View style={styles.premiumCta}>
              <Text style={styles.premiumCtaText}>See what&apos;s inside</Text>
            </View>
          </Pressable>
        </View>

        {/* DATA */}
        <View style={settingsStyles.section}>
          <SectionLabel label="DATA" />
          <View style={settingsStyles.card}>
            <SettingsRow title="Version" isLast={false} right={<Text style={settingsStyles.value}>{appInfo.version}</Text>} />
            <SettingsRow
              title="Reset all data"
              subtitle="Clear everything on this device."
              destructive
              isLast
              onPress={() => setResetVisible(true)}
            />
          </View>
        </View>

        <Text style={styles.footer}>GAINER · {appInfo.version}</Text>
      </ScrollView>

      <ConfirmDialog
        visible={resetVisible}
        title="Reset all data"
        message="This clears workouts, sessions, bodyweight, progress, measurements, and saved preferences on this device."
        confirmLabel="Reset"
        destructive
        onCancel={() => setResetVisible(false)}
        onConfirm={() => {
          setResetVisible(false);
          onResetAllData();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: HG.bg,
  },
  profileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    backgroundColor: HG.surface,
    borderWidth: 1,
    borderColor: HG.border,
    borderRadius: 18,
    padding: 14,
    marginTop: 8,
  },
  profileChipAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#3B2670',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileChipInitials: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  profileChipCopy: {
    flex: 1,
    minWidth: 0,
  },
  profileChipNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profileChipName: {
    flexShrink: 1,
    color: HG.ink,
    fontSize: 16,
    fontWeight: '800',
  },
  proBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: HG.purpleLight,
  },
  proBadgeText: {
    color: HG.purpleDark,
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  profileChipMeta: {
    color: HG.muted,
    fontSize: 12.5,
    fontWeight: '600',
    marginTop: 2,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: HG.surface,
    borderWidth: 1,
    borderColor: HG.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: HG.ink,
    fontSize: 17,
    fontWeight: '800',
  },
  headerSpacer: {
    width: 40,
  },
  body: {
    paddingHorizontal: 20,
    paddingBottom: layout.bottomTabBarReserve,
  },
  connectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
  },
  connectionTile: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: HG.surface,
    borderWidth: 1.5,
    borderColor: HG.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectionCopy: {
    flex: 1,
    minWidth: 0,
  },
  connectionTitle: {
    color: HG.ink,
    fontSize: 14.5,
    fontWeight: '800',
  },
  connectionSub: {
    color: HG.muted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  connectAction: {
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  connectActionText: {
    color: HG.purpleDark,
    fontSize: 13.5,
    fontWeight: '800',
  },
  premiumCard: {
    borderRadius: 18,
    padding: 18,
    backgroundColor: '#33206B',
  },
  premiumKicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  premiumKickerText: {
    color: '#C9B6FF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  premiumTitle: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '800',
    marginTop: 10,
  },
  premiumBody: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 13.5,
    fontWeight: '600',
    lineHeight: 20,
    marginTop: 6,
  },
  premiumCta: {
    alignSelf: 'flex-start',
    height: 44,
    justifyContent: 'center',
    paddingHorizontal: 20,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    marginTop: 16,
  },
  premiumCtaText: {
    color: '#33206B',
    fontSize: 14.5,
    fontWeight: '800',
  },
  footer: {
    color: HG.faint,
    fontSize: 11.5,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 26,
  },
});
