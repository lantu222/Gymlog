import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { CARD_SHADOW, SectionLabel, ToggleSwitch } from '../components/SettingsUi';
import { HG } from '../lightTheme';
import { layout } from '../theme';
import { NotificationLevel, NotificationPrefs } from '../types/models';

interface NotificationsScreenProps {
  prefs: NotificationPrefs;
  onBack: () => void;
  onChange: (patch: Partial<NotificationPrefs>) => void;
}

const LEVELS: Array<{ key: NotificationLevel; title: string; sub: string }> = [
  { key: 'quiet', title: 'Quiet', sub: 'Only what matters, max 1 / day' },
  { key: 'normal', title: 'Normal', sub: 'Balanced, max 2 / day' },
  { key: 'motivating', title: 'Motivating', sub: 'Everything, max 3 / day' },
];

const TRAINING_TOGGLES: Array<{ key: keyof NotificationPrefs; title: string; sub: string }> = [
  { key: 'personalRecords', title: 'Personal records', sub: 'A note when you set a new best.' },
  { key: 'weeklySummary', title: 'Weekly summary', sub: 'Sunday recap of your week.' },
  {
    key: 'comebackNudge',
    title: 'Comeback nudge',
    sub: 'A gentle ping after a longer break — never guilt.',
  },
  { key: 'sessionReminders', title: 'Session reminders', sub: 'Off by default.' },
];

function RadioDot({ on }: { on: boolean }) {
  return (
    <View style={[styles.radioOuter, on && styles.radioOuterActive]}>
      {on ? <View style={styles.radioInner} /> : null}
    </View>
  );
}

/**
 * Notification settings (spec screen 4). The preferences are stored now; the
 * delivery engine comes later — the master defaults to off, and everything
 * below it dims and locks while it stays off.
 */
export function NotificationsScreen({ prefs, onBack, onChange }: NotificationsScreenProps) {
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={onBack}
          style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.75 }]}
        >
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path d="M15 5l-7 7 7 7" stroke={HG.ink} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
        <Text style={styles.headerTitle} pointerEvents="none">
          Notifications
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
        {/* master */}
        <View style={[styles.card, styles.masterCard]}>
          <View style={styles.masterCopy}>
            <Text style={styles.masterTitle}>Push notifications</Text>
            <Text style={styles.masterSub}>
              {prefs.pushEnabled ? 'On for this device.' : 'Off — everything below stays quiet.'}
            </Text>
          </View>
          <ToggleSwitch
            label="Push notifications"
            value={prefs.pushEnabled}
            onChange={(next) => onChange({ pushEnabled: next })}
          />
        </View>

        <View style={styles.dimmable} pointerEvents={prefs.pushEnabled ? 'auto' : 'none'}>
          <View style={prefs.pushEnabled ? null : styles.dimmed}>
            <View style={styles.section}>
              <SectionLabel label="HOW MUCH" />
              <View style={styles.card}>
                {LEVELS.map((level, index) => (
                  <Pressable
                    key={level.key}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: prefs.level === level.key }}
                    onPress={() => onChange({ level: level.key })}
                    style={({ pressed }) => [
                      styles.row,
                      index !== LEVELS.length - 1 && styles.rowDivider,
                      pressed && { opacity: 0.75 },
                    ]}
                  >
                    <View style={styles.rowCopy}>
                      <Text style={styles.rowTitle}>{level.title}</Text>
                      <Text style={styles.rowSub}>{level.sub}</Text>
                    </View>
                    <RadioDot on={prefs.level === level.key} />
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <SectionLabel label="TRAINING" />
              <View style={styles.card}>
                {TRAINING_TOGGLES.map((item, index) => (
                  <View key={item.key} style={[styles.row, index !== TRAINING_TOGGLES.length - 1 && styles.rowDivider]}>
                    <View style={styles.rowCopy}>
                      <Text style={styles.rowTitle}>{item.title}</Text>
                      <Text style={styles.rowSub}>{item.sub}</Text>
                    </View>
                    <ToggleSwitch
                      label={item.title}
                      value={Boolean(prefs[item.key])}
                      onChange={(next) => onChange({ [item.key]: next } as Partial<NotificationPrefs>)}
                    />
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>

        <Text style={styles.footer}>
          GAINER keeps notifications off until you turn them on. No streak pressure, no dark patterns.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: HG.bg,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
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
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    pointerEvents: 'none',
    zIndex: -1,
    color: HG.ink,
    fontSize: 17,
    fontWeight: '800',
  },
  body: {
    paddingTop: 4,
    paddingHorizontal: 18,
    paddingBottom: layout.bottomTabBarReserve,
  },
  card: {
    backgroundColor: HG.surface,
    borderWidth: 1,
    borderColor: HG.border,
    borderRadius: 18,
    ...CARD_SHADOW,
  },
  masterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    padding: 15,
    marginTop: 4,
  },
  masterCopy: {
    flex: 1,
    minWidth: 0,
  },
  masterTitle: {
    color: HG.ink,
    fontSize: 15.5,
    fontWeight: '800',
  },
  masterSub: {
    color: HG.muted,
    fontSize: 12.5,
    fontWeight: '600',
    marginTop: 2,
  },
  dimmable: {},
  dimmed: {
    opacity: 0.45,
  },
  section: {
    marginTop: 22,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingVertical: 13,
    paddingHorizontal: 15,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: HG.border,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    color: HG.ink,
    fontSize: 14.5,
    fontWeight: '800',
  },
  rowSub: {
    color: HG.muted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
    lineHeight: 17,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#D8D2E6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterActive: {
    borderColor: HG.purple,
  },
  radioInner: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: HG.purple,
  },
  footer: {
    color: HG.faint,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 24,
    paddingHorizontal: 10,
  },
});
