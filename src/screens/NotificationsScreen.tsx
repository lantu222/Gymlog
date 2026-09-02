import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { ScreenHeaderTitle } from '../components/ScreenHeaderTitle';
import { CARD_SHADOW, SectionLabel, ToggleSwitch } from '../components/SettingsUi';
import { MEASUREMENT_LABEL_KEYS } from '../lib/homeStatCards';
import { I18nKey, t } from '../lib/i18n';
import { MEASUREMENT_KIND_ORDER } from '../lib/measurementKinds';
import { WEIGH_IN_HOUR, WEIGH_IN_MINUTE } from '../lib/notificationPlan';
import { Theme, useTheme, useThemedStyles } from '../theming';
import { layout } from '../theme';
import { AppLanguage, NotificationLevel, NotificationPrefs, SetupWeekday } from '../types/models';

interface NotificationsScreenProps {
  prefs: NotificationPrefs;
  language?: AppLanguage;
  /** Days picked in setup. Empty = reminders have no days to fire on. */
  trainingDays?: SetupWeekday[];
  onTrainingBreak?: boolean;
  onBack: () => void;
  onChange: (patch: Partial<NotificationPrefs>) => void;
  /** Shows the system dialog when possible; resolves with what we ended up with. */
  requestPermission?: () => Promise<boolean>;
  /** Reads the current OS permission without prompting. */
  checkPermission?: () => Promise<boolean>;
  onOpenTrainingPlan?: () => void;
}

/** 05:00–22:00 in half hours — the window a reminder is worth sending in. */
const REMINDER_TIMES = Array.from({ length: 35 }, (_, index) => {
  const minutes = 5 * 60 + index * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${minutes % 60 === 0 ? '00' : '30'}`;
});

const LEVELS: Array<{ key: NotificationLevel; titleKey: I18nKey; subKey: I18nKey }> = [
  { key: 'quiet', titleKey: 'notif.level.quiet', subKey: 'notif.level.quietSub' },
  { key: 'normal', titleKey: 'notif.level.normal', subKey: 'notif.level.normalSub' },
  { key: 'motivating', titleKey: 'notif.level.motivating', subKey: 'notif.level.motivatingSub' },
];

// Rest & alerts (design: Background Timer). The first section on the page:
// the workout timer is the one notification every reader meets, and it is not
// gated on the marketing-style "push" master switch below — a rest alert is
// the app doing its job, not the app asking for attention.
const REST_TOGGLES: Array<{ key: keyof NotificationPrefs; titleKey: I18nKey; subKey: I18nKey }> = [
  { key: 'restAlerts', titleKey: 'notif.rest.alerts', subKey: 'notif.rest.alertsSub' },
  { key: 'restWarning', titleKey: 'notif.rest.warning', subKey: 'notif.rest.warningSub' },
  { key: 'sessionOngoing', titleKey: 'notif.rest.ongoing', subKey: 'notif.rest.ongoingSub' },
  { key: 'idleNudge', titleKey: 'notif.rest.idle', subKey: 'notif.rest.idleSub' },
];

const TRAINING_TOGGLES: Array<{ key: keyof NotificationPrefs; titleKey: I18nKey; subKey: I18nKey }> = [
  { key: 'personalRecords', titleKey: 'notif.records', subKey: 'notif.recordsSub' },
  { key: 'weeklySummary', titleKey: 'notif.weekly', subKey: 'notif.weeklySub' },
  { key: 'comebackNudge', titleKey: 'notif.comeback', subKey: 'notif.comebackSub' },
  { key: 'sessionReminders', titleKey: 'notif.reminders', subKey: 'notif.remindersSub' },
  { key: 'weighInReminder', titleKey: 'notif.weighIn', subKey: 'notif.weighInSub' },
];

/** Monday-first, the order every other weekday row in the app reads in. */
const WEEKDAYS: SetupWeekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
/** Full weekday names live under the widget's keys, Monday = 0. */
const WEEKDAY_NAME_KEYS: Record<SetupWeekday, I18nKey> = {
  mon: 'widget.weekday.0',
  tue: 'widget.weekday.1',
  wed: 'widget.weekday.2',
  thu: 'widget.weekday.3',
  fri: 'widget.weekday.4',
  sat: 'widget.weekday.5',
  sun: 'widget.weekday.6',
};
/** The kind a fresh switch-on picks — the one the request named. */
const DEFAULT_MEASUREMENT_KIND = 'hips' as const;
const MEASURE_TIME = `${String(WEIGH_IN_HOUR).padStart(2, '0')}:${String(WEIGH_IN_MINUTE).padStart(2, '0')}`;

function RadioDot({ on }: { on: boolean }) {
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={[styles.radioOuter, on && styles.radioOuterActive]}>
      {on ? <View style={styles.radioInner} /> : null}
    </View>
  );
}

/**
 * Notification settings (spec screen 4). The master defaults to off, and
 * everything below it dims and locks while it stays off.
 *
 * The master is the OS permission, not a wish: turning it on asks Android for
 * permission and only stores "on" if we got it. If the user later revokes it in
 * system settings, the mount check flips this back off rather than letting the
 * screen claim notifications are running when nothing can be delivered.
 */
export function NotificationsScreen({
  prefs,
  language = 'en',
  trainingDays = [],
  onTrainingBreak = false,
  onBack,
  onChange,
  requestPermission,
  checkPermission,
  onOpenTrainingPlan,
}: NotificationsScreenProps) {
  // A training break silences everything until it ends, so the switches show
  // exactly that instead of staying lit under a note (user, 2026-08-22).
  const effectiveEnabled = prefs.pushEnabled && !onTrainingBreak;
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [systemBlocked, setSystemBlocked] = useState(false);
  const [timePickerOpen, setTimePickerOpen] = useState(false);

  // Permission can be revoked while the app is closed, so trust the OS over
  // what we stored. Runs once: re-running on every prefs change would fight
  // the user's own toggling.
  useEffect(() => {
    if (!prefs.pushEnabled || !checkPermission) {
      return undefined;
    }
    let cancelled = false;
    void checkPermission().then((granted) => {
      if (cancelled || granted) {
        return;
      }
      setSystemBlocked(true);
      onChange({ pushEnabled: false });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMasterChange = (next: boolean) => {
    if (!next) {
      setSystemBlocked(false);
      onChange({ pushEnabled: false });
      return;
    }
    if (!requestPermission) {
      onChange({ pushEnabled: true });
      return;
    }
    void requestPermission().then((granted) => {
      setSystemBlocked(!granted);
      onChange({ pushEnabled: granted });
    });
  };

  const remindersWithoutDays = prefs.sessionReminders && trainingDays.length === 0;
  const measureKind = prefs.measurementReminderKind;

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
            <Path d="M15 5l-7 7 7 7" stroke={theme.ink} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
        <ScreenHeaderTitle title={t(language, 'notif.title')} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
        {/* master */}
        <View style={[styles.card, styles.masterCard]}>
          <View style={styles.masterCopy}>
            <Text style={styles.masterTitle}>{t(language, 'notif.push')}</Text>
            <Text style={[styles.masterSub, systemBlocked && styles.masterSubBlocked]}>
              {systemBlocked
                ? t(language, 'notif.blocked')
                : t(language, prefs.pushEnabled ? 'notif.pushOn' : 'notif.pushOff')}
            </Text>
          </View>
          <ToggleSwitch
            label={t(language, 'notif.push')}
            value={prefs.pushEnabled}
            onChange={handleMasterChange}
          />
        </View>

        {prefs.pushEnabled && onTrainingBreak ? (
          <Text style={styles.note}>{t(language, 'notif.breakNote')}</Text>
        ) : null}

        {/* Everything below obeys the master switch — including the rest
            alerts, which used to sit outside the dimmed area and stay lit
            after the reader turned notifications off (user, 2026-08-22). */}
        <View style={styles.dimmable} pointerEvents={effectiveEnabled ? 'auto' : 'none'}>
          <View style={effectiveEnabled ? null : styles.dimmed}>
            <View style={styles.section}>
              <SectionLabel label={t(language, 'notif.rest.section')} />
              <View style={styles.card}>
                {REST_TOGGLES.map((item, index) => (
                  <View key={item.key} style={[styles.row, index !== REST_TOGGLES.length - 1 && styles.rowDivider]}>
                    <View style={styles.rowCopy}>
                      <Text style={styles.rowTitle}>{t(language, item.titleKey)}</Text>
                      <Text style={styles.rowSub}>{t(language, item.subKey)}</Text>
                    </View>
                    <ToggleSwitch
                      label={t(language, item.titleKey)}
                      value={effectiveEnabled && Boolean(prefs[item.key])}
                      onChange={(next) => onChange({ [item.key]: next } as Partial<NotificationPrefs>)}
                    />
                  </View>
                ))}
              </View>
            </View>
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
                  <View
                    key={item.key}
                    style={[styles.row, styles.rowDivider]}
                  >
                    <View style={styles.rowCopy}>
                      <Text style={styles.rowTitle}>{t(language, item.titleKey)}</Text>
                      <Text style={styles.rowSub}>{t(language, item.subKey)}</Text>
                    </View>
                    <ToggleSwitch
                      label={t(language, item.titleKey)}
                      value={effectiveEnabled && Boolean(prefs[item.key])}
                      onChange={(next) => onChange({ [item.key]: next } as Partial<NotificationPrefs>)}
                    />
                  </View>
                ))}

                {/* Reminders are the only setting with a clock, so the picker
                    lives with them instead of in a section of its own. */}
                {prefs.sessionReminders ? (
                  <>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t(language, 'notif.reminderTime')}
                      onPress={() => setTimePickerOpen((open) => !open)}
                      style={({ pressed }) => [styles.row, styles.rowDivider, pressed && { opacity: 0.75 }]}
                    >
                      <View style={styles.rowCopy}>
                        <Text style={styles.rowTitle}>{t(language, 'notif.reminderTime')}</Text>
                        <Text style={styles.rowSub}>{t(language, 'notif.reminderTimeSub')}</Text>
                      </View>
                      <Text style={styles.timeValue}>{prefs.reminderTime}</Text>
                    </Pressable>

                    {timePickerOpen ? (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.timeStrip}
                      >
                        {REMINDER_TIMES.map((time) => {
                          const active = time === prefs.reminderTime;
                          return (
                            <Pressable
                              key={time}
                              accessibilityRole="radio"
                              accessibilityState={{ selected: active }}
                              onPress={() => {
                                onChange({ reminderTime: time });
                                setTimePickerOpen(false);
                              }}
                              style={({ pressed }) => [
                                styles.timeChip,
                                active && styles.timeChipActive,
                                pressed && { opacity: 0.75 },
                              ]}
                            >
                              <Text style={[styles.timeChipText, active && styles.timeChipTextActive]}>
                                {time}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    ) : null}

                    {/* No days picked = nothing to fire on. Say so instead of
                        leaving a switch that quietly does nothing. */}
                    {remindersWithoutDays ? (
                      <View style={[styles.row, styles.rowDivider]}>
                        <View style={styles.rowCopy}>
                          <Text style={styles.rowTitle}>{t(language, 'notif.noDaysTitle')}</Text>
                          <Text style={styles.rowSub}>{t(language, 'notif.noDaysBody')}</Text>
                        </View>
                        {onOpenTrainingPlan ? (
                          <Pressable
                            accessibilityRole="button"
                            onPress={onOpenTrainingPlan}
                            hitSlop={8}
                            style={({ pressed }) => pressed && { opacity: 0.65 }}
                          >
                            <Text style={styles.rowAction}>{t(language, 'notif.noDaysAction')}</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    ) : null}
                  </>
                ) : null}

                {/* The weekly measurement (user 2026-08-29: "kerran viikossa
                    esim lantion mittaus tai sen mitä itse haluaa"). One
                    switch; when it is on, the kind and the morning sit right
                    under it, because a reminder that cannot say what to
                    measure is not one. */}
                <View style={[styles.row, measureKind && styles.rowDivider]}>
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowTitle}>{t(language, 'notif.measure')}</Text>
                    <Text style={styles.rowSub}>
                      {measureKind
                        ? `${t(language, MEASUREMENT_LABEL_KEYS[measureKind])} · ${t(
                            language,
                            WEEKDAY_NAME_KEYS[prefs.measurementReminderDay],
                          )} ${MEASURE_TIME}`
                        : t(language, 'notif.measureSub')}
                    </Text>
                  </View>
                  <ToggleSwitch
                    label={t(language, 'notif.measure')}
                    value={effectiveEnabled && measureKind !== null}
                    onChange={(next) =>
                      onChange({ measurementReminderKind: next ? DEFAULT_MEASUREMENT_KIND : null })
                    }
                  />
                </View>

                {measureKind ? (
                  <>
                    <Text style={styles.pickerLabel}>{t(language, 'notif.measure.kind')}</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timeStrip}>
                      {MEASUREMENT_KIND_ORDER.map((kind) => {
                        const active = kind === measureKind;
                        return (
                          <Pressable
                            key={kind}
                            accessibilityRole="radio"
                            accessibilityState={{ selected: active }}
                            onPress={() => onChange({ measurementReminderKind: kind })}
                            style={({ pressed }) => [
                              styles.timeChip,
                              active && styles.timeChipActive,
                              pressed && { opacity: 0.75 },
                            ]}
                          >
                            <Text style={[styles.timeChipText, active && styles.timeChipTextActive]}>
                              {t(language, MEASUREMENT_LABEL_KEYS[kind])}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                    <Text style={styles.pickerLabel}>{t(language, 'notif.measure.day')}</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timeStrip}>
                      {WEEKDAYS.map((day) => {
                        const active = day === prefs.measurementReminderDay;
                        return (
                          <Pressable
                            key={day}
                            accessibilityRole="radio"
                            accessibilityState={{ selected: active }}
                            onPress={() => onChange({ measurementReminderDay: day })}
                            style={({ pressed }) => [
                              styles.timeChip,
                              active && styles.timeChipActive,
                              pressed && { opacity: 0.75 },
                            ]}
                          >
                            <Text style={[styles.timeChipText, active && styles.timeChipTextActive]}>
                              {t(language, WEEKDAY_NAME_KEYS[day])}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  </>
                ) : null}
              </View>
            </View>
          </View>
        </View>

        <Text style={styles.footer}>{t(language, 'notif.footer')}</Text>
      </ScrollView>
    </View>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.bg,
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
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    paddingTop: 4,
    paddingHorizontal: 18,
    paddingBottom: layout.bottomTabBarReserve,
  },
  card: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
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
    color: theme.ink,
    fontSize: 15.5,
    fontWeight: '800',
  },
  masterSub: {
    color: theme.muted,
    fontSize: 12.5,
    fontWeight: '600',
    marginTop: 2,
  },
  masterSubBlocked: {
    color: '#C0392B',
  },
  note: {
    color: theme.muted,
    fontSize: 12.5,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: 12,
    paddingHorizontal: 4,
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
    borderBottomColor: theme.border,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    color: theme.ink,
    fontSize: 14.5,
    fontWeight: '800',
  },
  rowSub: {
    color: theme.muted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
    lineHeight: 17,
  },
  rowAction: {
    color: theme.purple,
    fontSize: 12.5,
    fontWeight: '800',
  },
  timeValue: {
    color: theme.purple,
    fontSize: 15,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  pickerLabel: {
    color: theme.muted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  timeStrip: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 15,
    paddingBottom: 14,
  },
  timeChip: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.bg,
  },
  timeChipActive: {
    borderColor: theme.purple,
    backgroundColor: theme.purple,
  },
  timeChipText: {
    color: theme.muted,
    fontSize: 13,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  timeChipTextActive: {
    color: '#FFFFFF',
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
    borderColor: theme.purple,
  },
  radioInner: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: theme.purple,
  },
  footer: {
    color: theme.faint,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 24,
    paddingHorizontal: 10,
  },
});
