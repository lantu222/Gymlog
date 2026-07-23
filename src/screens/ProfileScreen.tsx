import React, { useMemo } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { CARD_SHADOW, SectionLabel, settingsStyles } from '../components/SettingsUi';
import { formatLiftDisplayLabel } from '../lib/displayLabel';
import { formatCompactVolume, formatWeight } from '../lib/format';
import { LifetimeTrainingSummary } from '../lib/lifetimeSummary';
import { bodyPartLabel, I18nKey, t } from '../lib/i18n';
import {
  buildProfilePersonalRecords,
  countPersonalRecords,
  formatRecordWhenLabel,
} from '../lib/profileOverview';
import { ExerciseProgressSummary } from '../lib/progression';
import { HG } from '../lightTheme';
import { layout } from '../theme';
import { AppPreferences, ExerciseLibraryItem, SetupWeekday, UnitPreference } from '../types/models';

const WEEKDAY_CHIPS: Array<{ day: SetupWeekday; labelKey: I18nKey }> = [
  { day: 'mon', labelKey: 'weekday.mon' },
  { day: 'tue', labelKey: 'weekday.tue' },
  { day: 'wed', labelKey: 'weekday.wed' },
  { day: 'thu', labelKey: 'weekday.thu' },
  { day: 'fri', labelKey: 'weekday.fri' },
  { day: 'sat', labelKey: 'weekday.sat' },
  { day: 'sun', labelKey: 'weekday.sun' },
];

interface ProfileScreenProps {
  preferences: AppPreferences;
  lifetime: LifetimeTrainingSummary;
  trackedProgress: ExerciseProgressSummary[];
  exerciseLibrary: ExerciseLibraryItem[];
  unitPreference: UnitPreference;
  planName?: string | null;
  planDaysPerWeek?: number | null;
  planExerciseCount?: number | null;
  planFocusCaption?: string | null;
  planIsAiBuilt?: boolean;
  onOpenSettings: () => void;
  onManagePlan: () => void;
}

function getInitials(name: string | null | undefined) {
  if (!name) {
    return 'G';
  }
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return 'G';
  }
  const first = parts[0].charAt(0);
  const second = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
  return (first + second).toUpperCase();
}

function GearIcon() {
  // The prototype's ray-style cog (psuite-screens1.jsx top bar).
  return (
    <Svg width={21} height={21} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={3} stroke={HG.ink} strokeWidth={2} />
      <Path
        d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"
        stroke={HG.ink}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function GiftIcon() {
  return (
    <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 12v8h16v-8M2 7h20v5H2V7zM12 7v13M12 7c-1.5 0-4.5-.6-4.5-2.7C7.5 2.6 9 2 10 2c1.8 0 2 2.6 2 5zM12 7c1.5 0 4.5-.6 4.5-2.7C16.5 2.6 15 2 14 2c-1.8 0-2 2.6-2 5z"
        stroke={HG.ink}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ChevronIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M9 6l6 6-6 6" stroke={HG.faint} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function TrophyIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M7 4h10v4a5 5 0 0 1-10 0zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M9 15h6M8 20h8M12 15v5"
        stroke={HG.purpleDark}
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function SparkIcon() {
  // Filled spark, prototype's AI badge glyph.
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24">
      <Path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" fill={HG.purpleDark} />
    </Svg>
  );
}

function CalendarIcon() {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 6h16v15H4zM4 10h16M8 3v4M16 3v4"
        stroke={HG.muted}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function DumbbellIcon() {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10"
        stroke={HG.muted}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function Avatar({ initials }: { initials: string }) {
  return (
    <View style={styles.avatarWrap}>
      <Svg width={82} height={82} viewBox="0 0 82 82">
        <Defs>
          <LinearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#7C3AED" />
            <Stop offset="1" stopColor="#C4B0FF" />
          </LinearGradient>
          <LinearGradient id="inner" x1="0" y1="0" x2="0.6" y2="1">
            <Stop offset="0" stopColor="#2A1B4E" />
            <Stop offset="1" stopColor="#5B21B6" />
          </LinearGradient>
        </Defs>
        <Circle cx={41} cy={41} r={41} fill="url(#ring)" />
        <Circle cx={41} cy={41} r={38} fill="url(#inner)" />
      </Svg>
      <View style={styles.avatarTextWrap} pointerEvents="none">
        <Text style={styles.avatarText}>{initials}</Text>
      </View>
    </View>
  );
}

function Badge({ icon, label, accent = false }: { icon: React.ReactNode; label: string; accent?: boolean }) {
  return (
    <View style={[styles.badge, accent && styles.badgeAccent]}>
      {icon}
      <Text style={[styles.badgeText, accent && styles.badgeTextAccent]}>{label}</Text>
    </View>
  );
}

export function ProfileScreen({
  preferences,
  lifetime,
  trackedProgress,
  exerciseLibrary,
  unitPreference,
  planName,
  planDaysPerWeek,
  planExerciseCount,
  planFocusCaption,
  planIsAiBuilt = false,
  onOpenSettings,
  onManagePlan,
}: ProfileScreenProps) {
  const identityName = preferences.profileName?.trim() ? preferences.profileName.trim() : null;
  const language = preferences.appLanguage;

  const bodyPartByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of exerciseLibrary) {
      map.set(item.name.trim().toLowerCase(), item.bodyPart);
    }
    return map;
  }, [exerciseLibrary]);

  const personalRecords = useMemo(() => buildProfilePersonalRecords(trackedProgress, 3), [trackedProgress]);
  const prCount = useMemo(() => countPersonalRecords(trackedProgress), [trackedProgress]);

  const identityStats = [
    {
      key: 'sessions',
      value: `${lifetime.sessionCount}`,
      label: t(language, lifetime.sessionCount === 1 ? 'profile.stat.session' : 'profile.stat.sessions'),
    },
    {
      key: 'weeks',
      value: `${lifetime.weeksActive}`,
      label: t(language, lifetime.weeksActive === 1 ? 'profile.stat.week' : 'profile.stat.weeks'),
    },
    { key: 'prs', value: `${prCount}`, label: t(language, prCount === 1 ? 'profile.stat.pr' : 'profile.stat.prs') },
  ];

  const lifetimeStats = [
    {
      label: t(language, 'profile.lifetime.sessions'),
      value: `${lifetime.sessionCount}`,
      meta: t(language, 'profile.lifetime.sessionsMeta'),
    },
    {
      label: t(language, 'profile.lifetime.weeksActive'),
      value: `${lifetime.weeksActive}`,
      meta: t(language, 'profile.lifetime.weeksActiveMeta', { total: lifetime.weeksSinceStart }),
    },
    {
      label: t(language, 'profile.lifetime.totalVolume'),
      value: formatCompactVolume(lifetime.totalVolumeKg, unitPreference),
      meta: t(language, 'profile.lifetime.totalVolumeMeta'),
    },
    {
      label: t(language, 'profile.lifetime.bestRhythm'),
      value: t(language, 'profile.lifetime.bestRhythmValue', { count: lifetime.bestWeekStreak }),
      meta: t(language, 'profile.lifetime.bestRhythmMeta'),
    },
  ];

  const resolvedPlanName = planName?.trim() ? planName.trim() : null;

  const handleInvite = async () => {
    // OS share sheet only — the user picks the target and can edit the text.
    // The link is the app's store page (live once GAINER is published).
    try {
      await Share.share({
        message: t(language, 'profile.inviteMessage'),
      });
    } catch {
      // Sharing is optional; a dismissed or failed sheet is not an error worth
      // interrupting the user for.
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Text style={styles.topTitle}>{t(language, 'profile.title')}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(language, 'profile.a11y.settings')}
          onPress={onOpenSettings}
          style={({ pressed }) => [styles.gearButton, pressed && styles.pressed]}
        >
          <GearIcon />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
        {/* IDENTITY */}
        <View style={styles.identityRow}>
          <Avatar initials={getInitials(identityName)} />
          <View style={styles.identityStats}>
            {identityStats.map((stat) => (
              <View key={stat.key} style={styles.identityStat}>
                <Text style={styles.identityStatValue}>{stat.value}</Text>
                <Text style={styles.identityStatLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>
        </View>
        <Text style={styles.identityName}>{identityName ?? t(language, 'profile.guestName')}</Text>

        {/* INVITE */}
        <Pressable
          accessibilityRole="button"
          onPress={() => void handleInvite()}
          style={({ pressed }) => [styles.inviteButton, pressed && styles.pressed]}
        >
          <GiftIcon />
          <Text style={styles.inviteButtonText}>{t(language, 'profile.invite')}</Text>
        </Pressable>

        {/* TRAINING PLAN */}
        <View style={settingsStyles.section}>
          <SectionLabel
            label={t(language, 'profile.section.trainingPlan')}
            actionLabel={resolvedPlanName ? t(language, 'profile.manage') : undefined}
            onAction={onManagePlan}
          />
          <Pressable onPress={onManagePlan} style={({ pressed }) => [settingsStyles.card, styles.planCard, pressed && styles.pressed]}>
            <View style={styles.planTop}>
              <Text numberOfLines={1} style={styles.planName}>
                {resolvedPlanName ?? t(language, 'profile.noPlan')}
              </Text>
              <ChevronIcon />
            </View>
            {resolvedPlanName ? (
              <>
                <View style={styles.badgeRow}>
                  {/* Mock parity: AI badge always on — engine wiring comes later.
                      Only the AI badge is purple; the meta badges are grey. */}
                  <Badge accent icon={<SparkIcon />} label="AI" />
                  {planDaysPerWeek ? (
                    <Badge icon={<CalendarIcon />} label={t(language, 'profile.badge.perWeek', { count: planDaysPerWeek })} />
                  ) : null}
                  {planExerciseCount ? (
                    <Badge icon={<DumbbellIcon />} label={t(language, 'profile.badge.exercises', { count: planExerciseCount })} />
                  ) : null}
                </View>
                {/* Weekday chips only when the questionnaire actually captured
                    training days — no invented rhythm. */}
                {preferences.setupAvailableDays.length > 0 ? (
                  <View style={styles.weekdayRow}>
                    {WEEKDAY_CHIPS.map((chip) => {
                      const active = preferences.setupAvailableDays.includes(chip.day);
                      return (
                        <View key={chip.day} style={[styles.weekdayChip, active && styles.weekdayChipActive]}>
                          <Text style={[styles.weekdayChipText, active && styles.weekdayChipTextActive]}>
                            {t(language, chip.labelKey)}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                ) : null}
                {planFocusCaption ? (
                  <Text numberOfLines={1} style={styles.planCaption}>
                    {planFocusCaption}
                  </Text>
                ) : null}
              </>
            ) : (
              <Text style={styles.planCaption}>{t(language, 'profile.noPlanCaption')}</Text>
            )}
          </Pressable>
        </View>

        {/* PERSONAL RECORDS */}
        <View style={settingsStyles.section}>
          <SectionLabel label={t(language, 'profile.section.records')} />
          <View style={settingsStyles.card}>
            {personalRecords.length > 0 ? (
              personalRecords.map((record, index) => {
                const bodyPart = bodyPartByName.get(record.name.trim().toLowerCase());
                return (
                  <View
                    key={record.key}
                    style={[styles.recordRow, index === personalRecords.length - 1 && styles.recordRowLast]}
                  >
                    <View style={styles.recordTile}>
                      <TrophyIcon />
                    </View>
                    <View style={styles.recordCopy}>
                      <Text numberOfLines={1} style={styles.recordName}>
                        {formatLiftDisplayLabel(record.name)}
                      </Text>
                      {bodyPart ? <Text style={styles.recordBodyPart}>{bodyPartLabel(language, bodyPart)}</Text> : null}
                    </View>
                    <View style={styles.recordValueBlock}>
                      <Text style={styles.recordValue}>{formatWeight(record.weightKg, unitPreference)}</Text>
                      <Text style={styles.recordMetaText}>
                        × {record.reps} · {formatRecordWhenLabel(record.achievedAt, new Date(), language)}
                      </Text>
                    </View>
                  </View>
                );
              })
            ) : (
              <View style={styles.emptyBlock}>
                <Text style={styles.emptyTitle}>{t(language, 'profile.records.emptyTitle')}</Text>
                <Text style={styles.emptyText}>{t(language, 'profile.records.emptyBody')}</Text>
              </View>
            )}
          </View>
        </View>

        {/* LIFETIME */}
        <View style={settingsStyles.section}>
          <SectionLabel label={t(language, 'profile.section.lifetime')} />
          <View style={styles.statGrid}>
            {lifetimeStats.map((stat) => (
              <View key={stat.label} style={styles.statCard}>
                <Text style={styles.statLabel}>{stat.label.toUpperCase()}</Text>
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statMeta}>{stat.meta}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: HG.bg,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 14,
  },
  topTitle: {
    color: HG.ink,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  gearButton: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: HG.surface,
    borderWidth: 1,
    borderColor: HG.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  body: {
    paddingHorizontal: 20,
    paddingBottom: layout.bottomTabBarReserve,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  avatarWrap: {
    width: 82,
    height: 82,
  },
  avatarTextWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 27,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  identityStats: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  identityStat: {
    alignItems: 'center',
  },
  identityStatValue: {
    color: HG.ink,
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  identityStatLabel: {
    color: HG.muted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 1,
  },
  identityName: {
    color: HG.ink,
    fontSize: 20,
    fontWeight: '800',
    marginTop: 14,
  },
  inviteButton: {
    height: 48,
    borderRadius: 14,
    backgroundColor: HG.surface,
    borderWidth: 1,
    borderColor: HG.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    ...CARD_SHADOW,
  },
  inviteButtonText: {
    color: HG.ink,
    fontSize: 14.5,
    fontWeight: '800',
  },
  weekdayRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 14,
  },
  weekdayChip: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 9,
    backgroundColor: '#F1EDFA',
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekdayChipActive: {
    backgroundColor: HG.purpleLight,
    borderColor: HG.border,
  },
  weekdayChipText: {
    color: HG.faint,
    fontSize: 11.5,
    fontWeight: '800',
  },
  weekdayChipTextActive: {
    color: HG.purpleDark,
  },
  planCard: {
    paddingVertical: 15,
  },
  planTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  planName: {
    flex: 1,
    color: HG.ink,
    fontSize: 17,
    fontWeight: '800',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 10,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: '#F1EDFA',
  },
  badgeAccent: {
    backgroundColor: HG.purpleLight,
  },
  badgeText: {
    color: HG.muted,
    fontSize: 11.5,
    fontWeight: '800',
  },
  badgeTextAccent: {
    color: HG.purpleDark,
  },
  planCaption: {
    color: HG.muted,
    fontSize: 12.5,
    fontWeight: '700',
    marginTop: 12,
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: HG.border,
  },
  recordRowLast: {
    borderBottomWidth: 0,
  },
  recordTile: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: HG.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordCopy: {
    flex: 1,
    minWidth: 0,
  },
  recordName: {
    color: HG.ink,
    fontSize: 14.5,
    fontWeight: '800',
  },
  recordBodyPart: {
    color: HG.muted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 1,
  },
  recordValueBlock: {
    alignItems: 'flex-end',
  },
  recordValue: {
    color: HG.ink,
    fontSize: 15.5,
    fontWeight: '800',
  },
  recordMetaText: {
    color: HG.muted,
    fontSize: 11.5,
    fontWeight: '700',
    marginTop: 1,
  },
  emptyBlock: {
    paddingVertical: 18,
  },
  emptyTitle: {
    color: HG.ink,
    fontSize: 14.5,
    fontWeight: '800',
  },
  emptyText: {
    color: HG.muted,
    fontSize: 12.5,
    fontWeight: '600',
    marginTop: 4,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    flexGrow: 1,
    flexBasis: '47%',
    backgroundColor: HG.surface,
    borderWidth: 1,
    borderColor: HG.border,
    borderRadius: 18,
    padding: 14,
    ...CARD_SHADOW,
  },
  statLabel: {
    color: HG.faint,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.44,
  },
  statValue: {
    color: HG.ink,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: 5,
  },
  statMeta: {
    color: HG.muted,
    fontSize: 11.5,
    fontWeight: '600',
    marginTop: 2,
  },
});
