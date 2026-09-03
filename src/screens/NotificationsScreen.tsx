import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { ScreenHeaderTitle } from '../components/ScreenHeaderTitle';
import { Seg } from '../components/Seg';
import { CARD_SHADOW, SectionLabel, ToggleSwitch } from '../components/SettingsUi';
import { MEASUREMENT_LABEL_KEYS } from '../lib/homeStatCards';
import { I18nKey, t } from '../lib/i18n';
import { MEASUREMENT_REMINDER_KINDS } from '../lib/measurementReminder';
import {
  DEFAULT_MEASUREMENT_KIND,
  NOTIFICATION_GROUPS,
  NotificationGroup,
  NotificationGroupKey,
  NotificationGroupMemo,
  NotificationSwitch,
  notificationGroupSummary,
  readNotificationGroup,
  rememberNotificationGroup,
  toggleNotificationGroup,
} from '../lib/notificationGroups';
import { WEEKDAY_KEYS } from '../lib/programTrainingDays';
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

/** One glyph per group, from the design. */
const GROUP_ICONS: Record<NotificationGroupKey, string> = {
  workout: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2',
  wins: 'M7 4h10v4a5 5 0 01-10 0zM7 6H4v1a3 3 0 003 3M17 6h3v1a3 3 0 01-3 3M9 15h6M8 20h8M12 15v5',
  nudges: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
};

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
const MEASURE_TIME = `${String(WEIGH_IN_HOUR).padStart(2, '0')}:${String(WEIGH_IN_MINUTE).padStart(2, '0')}`;

/**
 * Notification settings (spec screen 4, restructured 2026-09-03). The master
 * defaults to off, and everything below it dims and locks while it stays off.
 *
 * The master is the OS permission, not a wish: turning it on asks Android for
 * permission and only stores "on" if we got it. If the user later revokes it in
 * system settings, the mount check flips this back off rather than letting the
 * screen claim notifications are running when nothing can be delivered.
 *
 * Below it, ten switches in two flat lists became three groups (design "Vinha
 * — Settings, Notifications & My data"): each says what it sends, carries one
 * switch, and keeps every original switch one tap in behind Details. Nothing
 * about what gets scheduled changed — see src/lib/notificationGroups.ts.
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
  const [openGroup, setOpenGroup] = useState<NotificationGroupKey | null>(null);
  /**
   * What each group held when it was switched off, so switching it back on
   * restores that rather than lighting everything up. Screen state, not a
   * stored preference: leaving the screen forgets it, and a restore with
   * nothing remembered falls back to the app's own defaults.
   */
  const [memos, setMemos] = useState<Partial<Record<NotificationGroupKey, NotificationGroupMemo>>>({});

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

  const handleGroupToggle = (group: NotificationGroup, next: boolean) => {
    setMemos((current) => ({
      ...current,
      [group.key]: next ? current[group.key] : rememberNotificationGroup(group, prefs),
    }));
    onChange(toggleNotificationGroup(group, next, next ? memos[group.key] ?? null : null));
    if (!next) {
      setOpenGroup((open) => (open === group.key ? null : open));
    }
  };

  /**
   * One switch inside a group.
   *
   * Turning off the last one empties the group, which closes the card — and
   * the reader's choices have to survive that, or tapping the group back on
   * would restore the defaults and re-enable the very switches they just
   * turned off. So the state BEFORE this change is remembered whenever the
   * group is about to empty, exactly as the group toggle does.
   */
  const handleSwitchToggle = (group: NotificationGroup, item: NotificationSwitch, next: boolean) => {
    const emptying = !next && readNotificationGroup(group, prefs).onCount === 1 && item.isOn(prefs);
    if (emptying) {
      setMemos((current) => ({ ...current, [group.key]: rememberNotificationGroup(group, prefs) }));
      setOpenGroup((open) => (open === group.key ? null : open));
    }
    onChange(item.patch(next));
  };

  const remindersWithoutDays = prefs.sessionReminders && trainingDays.length === 0;
  const measureKind = prefs.measurementReminderKind;
  const levelSub = LEVELS.find((level) => level.key === prefs.level)?.subKey ?? 'notif.level.normalSub';

  /**
   * The pickers that belong to one switch: a reminder needs a time, and a
   * measurement reminder needs a kind and a morning. They sit under their own
   * switch inside the group rather than in a section of their own.
   */
  const renderSwitchExtras = (item: NotificationSwitch) => {
    if (item.key === 'sessionReminders' && prefs.sessionReminders) {
      return (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(language, 'notif.reminderTime')}
            onPress={() => setTimePickerOpen((open) => !open)}
            style={({ pressed }) => [styles.detailRow, styles.rowDivider, pressed && { opacity: 0.75 }]}
          >
            <View style={styles.rowCopy}>
              <Text style={styles.detailTitle}>{t(language, 'notif.reminderTime')}</Text>
              <Text style={styles.detailSub}>{t(language, 'notif.reminderTimeSub')}</Text>
            </View>
            <Text style={styles.timeValue}>{prefs.reminderTime}</Text>
          </Pressable>

          {timePickerOpen ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timeStrip}>
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
                    style={({ pressed }) => [styles.timeChip, active && styles.timeChipActive, pressed && { opacity: 0.75 }]}
                  >
                    <Text style={[styles.timeChipText, active && styles.timeChipTextActive]}>{time}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}

          {/* No days picked = nothing to fire on. Say so instead of leaving a
              switch that quietly does nothing. */}
          {remindersWithoutDays ? (
            <View style={[styles.detailRow, styles.rowDivider]}>
              <View style={styles.rowCopy}>
                <Text style={styles.detailTitle}>{t(language, 'notif.noDaysTitle')}</Text>
                <Text style={styles.detailSub}>{t(language, 'notif.noDaysBody')}</Text>
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
      );
    }

    if (item.key === 'measurement' && measureKind) {
      return (
        <>
          <Text style={styles.pickerLabel}>{t(language, 'notif.measure.kind')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timeStrip}>
            {MEASUREMENT_REMINDER_KINDS.map((kind) => {
              const active = kind === measureKind;
              return (
                <Pressable
                  key={kind}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  onPress={() => onChange({ measurementReminderKind: kind })}
                  style={({ pressed }) => [styles.timeChip, active && styles.timeChipActive, pressed && { opacity: 0.75 }]}
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
            {WEEKDAY_KEYS.map((day) => {
              const active = day === prefs.measurementReminderDay;
              return (
                <Pressable
                  key={day}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  onPress={() => onChange({ measurementReminderDay: day })}
                  style={({ pressed }) => [styles.timeChip, active && styles.timeChipActive, pressed && { opacity: 0.75 }]}
                >
                  <Text style={[styles.timeChipText, active && styles.timeChipTextActive]}>
                    {t(language, WEEKDAY_NAME_KEYS[day])}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </>
      );
    }

    return null;
  };

  const renderGroup = (group: NotificationGroup) => {
    const reading = readNotificationGroup(group, prefs);
    // A break silences the lot, so the card reads off while it lasts — the
    // same rule the individual switches follow.
    const groupOn = effectiveEnabled && reading.isOn;
    const open = openGroup === group.key;
    const summary = groupOn
      ? notificationGroupSummary(group, prefs, language, t)
      : t(language, group.blurbKey);
    // The measurement's own line names what and when, which the summary cannot.
    const measureLine =
      group.key === 'nudges' && measureKind
        ? `${t(language, MEASUREMENT_LABEL_KEYS[measureKind])} · ${t(
            language,
            WEEKDAY_NAME_KEYS[prefs.measurementReminderDay],
          )} ${MEASURE_TIME}`
        : null;

    return (
      <View key={group.key} style={[styles.card, styles.groupCard, groupOn && styles.groupCardOn]}>
        <View style={styles.groupHead}>
          <View style={[styles.groupIcon, groupOn && styles.groupIconOn]}>
            <Svg width={19} height={19} viewBox="0 0 24 24" fill="none">
              <Path
                d={GROUP_ICONS[group.key]}
                stroke={groupOn ? theme.highlight : theme.faint}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>
          <View style={styles.rowCopy}>
            <Text style={styles.groupTitle}>{t(language, group.titleKey)}</Text>
            <Text numberOfLines={1} style={[styles.rowSub, !groupOn && styles.rowSubOff]}>
              {summary}
            </Text>
          </View>
          <ToggleSwitch
            label={t(language, group.titleKey)}
            value={groupOn}
            onChange={(next) => handleGroupToggle(group, next)}
          />
        </View>

        {groupOn ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: open }}
            onPress={() => setOpenGroup(open ? null : group.key)}
            style={({ pressed }) => [styles.disclosure, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.disclosureText}>
              {open
                ? t(language, 'notif.group.hide')
                : t(language, 'notif.group.details', { on: reading.onCount, total: reading.total })}
            </Text>
            <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
              <Path
                d={open ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'}
                stroke={theme.highlight}
                strokeWidth={2.4}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </Pressable>
        ) : null}

        {groupOn && open ? (
          <View style={styles.details}>
            {group.switches.map((item, index) => (
              <React.Fragment key={item.key}>
                <View style={[styles.detailRow, index !== group.switches.length - 1 && styles.rowDivider]}>
                  <View style={styles.rowCopy}>
                    <Text style={styles.detailTitle}>{t(language, item.titleKey)}</Text>
                    <Text style={styles.detailSub}>
                      {item.key === 'measurement' && measureLine ? measureLine : t(language, item.subKey)}
                    </Text>
                  </View>
                  <ToggleSwitch
                    label={t(language, item.titleKey)}
                    value={effectiveEnabled && item.isOn(prefs)}
                    onChange={(next) => handleSwitchToggle(group, item, next)}
                  />
                </View>
                {renderSwitchExtras(item)}
              </React.Fragment>
            ))}
          </View>
        ) : null}
      </View>
    );
  };

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
        <View style={[styles.card, styles.masterCard, prefs.pushEnabled && styles.masterCardOn]}>
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
              <SectionLabel label={t(language, 'notif.section.what')} />
              {NOTIFICATION_GROUPS.map(renderGroup)}
            </View>

            <View style={styles.section}>
              <SectionLabel label={t(language, 'notif.howMuch')} />
              <View style={[styles.card, styles.levelCard]}>
                <Seg
                  grow
                  options={LEVELS.map((level) => ({ key: level.key, label: t(language, level.titleKey) }))}
                  value={prefs.level}
                  onChange={(next) => onChange({ level: next })}
                />
                <Text style={styles.levelLine}>
                  {`${t(language, levelSub)} ${t(language, 'notif.level.restNote')}`}
                </Text>
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
  masterCardOn: {
    borderColor: theme.purple,
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
  groupCard: {
    marginBottom: 10,
    overflow: 'hidden',
  },
  groupCardOn: {
    borderColor: theme.purpleBright,
  },
  groupHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    padding: 15,
  },
  groupIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: theme.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupIconOn: {
    backgroundColor: theme.highlightSoft,
  },
  groupTitle: {
    color: theme.ink,
    fontSize: 15,
    fontWeight: '800',
  },
  disclosure: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 15,
    paddingTop: 9,
    paddingBottom: 11,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  disclosureText: {
    color: theme.highlight,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  details: {
    borderTopWidth: 1,
    borderTopColor: theme.border,
    backgroundColor: theme.surfaceSoft,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingRight: 15,
    paddingLeft: 22,
  },
  detailTitle: {
    color: theme.ink,
    fontSize: 13.5,
    fontWeight: '800',
  },
  detailSub: {
    color: theme.faint,
    fontSize: 11.5,
    fontWeight: '600',
    marginTop: 2,
    lineHeight: 16,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
  },
  rowSub: {
    color: theme.muted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 3,
    lineHeight: 17,
  },
  rowSubOff: {
    color: theme.faint,
  },
  rowAction: {
    color: theme.purple,
    fontSize: 12.5,
    fontWeight: '800',
  },
  levelCard: {
    padding: 15,
  },
  levelLine: {
    color: theme.muted,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17.5,
    marginTop: 11,
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
    paddingHorizontal: 22,
    paddingTop: 12,
  },
  timeStrip: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 22,
    paddingBottom: 14,
    paddingTop: 8,
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
