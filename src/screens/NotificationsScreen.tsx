import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { ScreenHeaderTitle } from '../components/ScreenHeaderTitle';
import { CARD_SHADOW, SectionLabel, ToggleSwitch } from '../components/SettingsUi';
import { I18nKey, t } from '../lib/i18n';
import { HG } from '../lightTheme';
import { layout } from '../theme';
import { AppLanguage, NotificationLevel, NotificationPrefs } from '../types/models';

interface NotificationsScreenProps {
  prefs: NotificationPrefs;
  language?: AppLanguage;
  onBack: () => void;
  onChange: (patch: Partial<NotificationPrefs>) => void;
}

const LEVELS: Array<{ key: NotificationLevel; titleKey: I18nKey; subKey: I18nKey }> = [
  { key: 'quiet', titleKey: 'notif.level.quiet', subKey: 'notif.level.quietSub' },
  { key: 'normal', titleKey: 'notif.level.normal', subKey: 'notif.level.normalSub' },
  { key: 'motivating', titleKey: 'notif.level.motivating', subKey: 'notif.level.motivatingSub' },
];

const TRAINING_TOGGLES: Array<{ key: keyof NotificationPrefs; titleKey: I18nKey; subKey: I18nKey }> = [
  { key: 'personalRecords', titleKey: 'notif.records', subKey: 'notif.recordsSub' },
  { key: 'weeklySummary', titleKey: 'notif.weekly', subKey: 'notif.weeklySub' },
  { key: 'comebackNudge', titleKey: 'notif.comeback', subKey: 'notif.comebackSub' },
  { key: 'sessionReminders', titleKey: 'notif.reminders', subKey: 'notif.remindersSub' },
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
export function NotificationsScreen({ prefs, language = 'en', onBack, onChange }: NotificationsScreenProps) {
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(language, 'common.back')}
          onPress={onBack}
          style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.75 }]}
        >
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path d="M15 5l-7 7 7 7" stroke={HG.ink} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
        <ScreenHeaderTitle title={t(language, 'notif.title')} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
        {/* master */}
        <View style={[styles.card, styles.masterCard]}>
          <View style={styles.masterCopy}>
            <Text style={styles.masterTitle}>{t(language, 'notif.push')}</Text>
            <Text style={styles.masterSub}>
              {t(language, prefs.pushEnabled ? 'notif.pushOn' : 'notif.pushOff')}
            </Text>
          </View>
          <ToggleSwitch
            label={t(language, 'notif.push')}
            value={prefs.pushEnabled}
            onChange={(next) => onChange({ pushEnabled: next })}
          />
        </View>

        <View style={styles.dimmable} pointerEvents={prefs.pushEnabled ? 'auto' : 'none'}>
          <View style={prefs.pushEnabled ? null : styles.dimmed}>
            <View style={styles.section}>
              <SectionLabel label={t(language, 'notif.howMuch')} />
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
                      <Text style={styles.rowTitle}>{t(language, level.titleKey)}</Text>
                      <Text style={styles.rowSub}>{t(language, level.subKey)}</Text>
                    </View>
                    <RadioDot on={prefs.level === level.key} />
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <SectionLabel label={t(language, 'notif.training')} />
              <View style={styles.card}>
                {TRAINING_TOGGLES.map((item, index) => (
                  <View key={item.key} style={[styles.row, index !== TRAINING_TOGGLES.length - 1 && styles.rowDivider]}>
                    <View style={styles.rowCopy}>
                      <Text style={styles.rowTitle}>{t(language, item.titleKey)}</Text>
                      <Text style={styles.rowSub}>{t(language, item.subKey)}</Text>
                    </View>
                    <ToggleSwitch
                      label={t(language, item.titleKey)}
                      value={Boolean(prefs[item.key])}
                      onChange={(next) => onChange({ [item.key]: next } as Partial<NotificationPrefs>)}
                    />
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>

        <Text style={styles.footer}>{t(language, 'notif.footer')}</Text>
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
