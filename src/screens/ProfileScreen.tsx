import React, { useMemo } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { SectionLabel, settingsStyles } from '../components/SettingsUi';
import { formatLiftDisplayLabel } from '../lib/displayLabel';
import { formatCompactVolume, formatWeight } from '../lib/format';
import { LifetimeTrainingSummary } from '../lib/lifetimeSummary';
import {
  buildProfilePersonalRecords,
  countPersonalRecords,
  formatRecordWhenLabel,
} from '../lib/profileOverview';
import { ExerciseProgressSummary } from '../lib/progression';
import { HG } from '../lightTheme';
import { layout } from '../theme';
import { AppPreferences, ExerciseLibraryItem, UnitPreference } from '../types/models';

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
  onEditProfile: () => void;
  onManagePlan: () => void;
  onOpenProgress: () => void;
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

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function GearIcon() {
  return (
    <Svg width={21} height={21} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={3.2} stroke={HG.ink} strokeWidth={2} />
      <Path
        d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.88.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.33-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6h.08A1.7 1.7 0 0 0 10 3V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.51 1.7 1.7 0 0 0 1.88-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9v.08a1.7 1.7 0 0 0 1.56 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1z"
        stroke={HG.ink}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function PersonIcon() {
  return (
    <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={8} r={3.6} stroke="#FFFFFF" strokeWidth={2} />
      <Path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function ShareIcon() {
  return (
    <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 15V4m0 0L8.5 7.5M12 4l3.5 3.5M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"
        stroke={HG.ink}
        strokeWidth={2}
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
    <Svg width={19} height={19} viewBox="0 0 24 24" fill="none">
      <Path
        d="M7 4h10v5a5 5 0 0 1-10 0V4zM7 6H4.5a2.5 2.5 0 0 0 2.5 4M17 6h2.5a2.5 2.5 0 0 1-2.5 4M9.5 20h5M12 14v6"
        stroke={HG.purpleDark}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function SparkIcon() {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3z"
        stroke={HG.purpleDark}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function CalendarIcon() {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
      <Path
        d="M8 3v3M16 3v3M4 8h16M6 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"
        stroke={HG.purpleDark}
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
        stroke={HG.purpleDark}
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

function Badge({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <View style={styles.badge}>
      {icon}
      <Text style={styles.badgeText}>{label}</Text>
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
  onEditProfile,
  onManagePlan,
  onOpenProgress,
}: ProfileScreenProps) {
  const identityName = preferences.profileName?.trim() ? preferences.profileName.trim() : null;

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
    { key: 'sessions', value: `${lifetime.sessionCount}`, label: lifetime.sessionCount === 1 ? 'session' : 'sessions' },
    { key: 'weeks', value: `${lifetime.weeksActive}`, label: lifetime.weeksActive === 1 ? 'week' : 'weeks' },
    { key: 'prs', value: `${prCount}`, label: prCount === 1 ? 'PR' : 'PRs' },
  ];

  const lifetimeStats = [
    { label: 'Sessions', value: `${lifetime.sessionCount}`, meta: 'logged' },
    { label: 'Weeks active', value: `${lifetime.weeksActive}`, meta: `of ${lifetime.weeksSinceStart}` },
    { label: 'Total volume', value: formatCompactVolume(lifetime.totalVolumeKg, unitPreference), meta: 'lifted' },
    { label: 'Best rhythm', value: `${lifetime.bestWeekStreak} wk`, meta: 'in a row' },
  ];

  const resolvedPlanName = planName?.trim() ? planName.trim() : null;

  const handleShare = async () => {
    // OS share sheet only — the user picks the target and can edit the text.
    // Every number here comes from their own logged history.
    const line = lifetime.sessionCount > 0
      ? `${lifetime.sessionCount} sessions logged in GAINER, across ${lifetime.weeksActive} training weeks.`
      : 'Tracking my training with GAINER.';

    try {
      await Share.share({ message: line });
    } catch {
      // Sharing is optional; a dismissed or failed sheet is not an error worth
      // interrupting the user for.
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Text style={styles.topTitle}>Profile</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Settings"
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
        <Text style={styles.identityName}>{identityName ?? 'Guest athlete'}</Text>

        {/* ACTIONS */}
        <View style={styles.actionRow}>
          <Pressable
            accessibilityRole="button"
            onPress={onEditProfile}
            style={({ pressed }) => [styles.actionPrimary, pressed && styles.pressed]}
          >
            <PersonIcon />
            <Text style={styles.actionPrimaryText}>Edit profile</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => void handleShare()}
            style={({ pressed }) => [styles.actionSecondary, pressed && styles.pressed]}
          >
            <ShareIcon />
            <Text style={styles.actionSecondaryText}>Share</Text>
          </Pressable>
        </View>

        {/* TRAINING PLAN */}
        <View style={settingsStyles.section}>
          <SectionLabel label="TRAINING PLAN" actionLabel={resolvedPlanName ? 'Manage' : undefined} onAction={onManagePlan} />
          <Pressable onPress={onManagePlan} style={({ pressed }) => [settingsStyles.card, styles.planCard, pressed && styles.pressed]}>
            <View style={styles.planTop}>
              <Text numberOfLines={1} style={styles.planName}>
                {resolvedPlanName ?? 'No plan selected'}
              </Text>
              <ChevronIcon />
            </View>
            {resolvedPlanName ? (
              <>
                <View style={styles.badgeRow}>
                  {planIsAiBuilt ? <Badge icon={<SparkIcon />} label="AI" /> : null}
                  {planDaysPerWeek ? <Badge icon={<CalendarIcon />} label={`${planDaysPerWeek}× / week`} /> : null}
                  {planExerciseCount ? <Badge icon={<DumbbellIcon />} label={`${planExerciseCount} exercises`} /> : null}
                </View>
                {planFocusCaption ? (
                  <Text numberOfLines={1} style={styles.planCaption}>
                    {planFocusCaption}
                  </Text>
                ) : null}
              </>
            ) : (
              <Text style={styles.planCaption}>Pick a plan to guide your week.</Text>
            )}
          </Pressable>
        </View>

        {/* PERSONAL RECORDS */}
        <View style={settingsStyles.section}>
          <SectionLabel label="PERSONAL RECORDS" actionLabel="Progress" onAction={onOpenProgress} />
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
                      {bodyPart ? <Text style={styles.recordBodyPart}>{capitalize(bodyPart)}</Text> : null}
                    </View>
                    <View style={styles.recordValueBlock}>
                      <Text style={styles.recordValue}>{formatWeight(record.weightKg, unitPreference)}</Text>
                      <Text style={styles.recordMetaText}>
                        × {record.reps} · {formatRecordWhenLabel(record.achievedAt)}
                      </Text>
                    </View>
                  </View>
                );
              })
            ) : (
              <View style={styles.emptyBlock}>
                <Text style={styles.emptyTitle}>No records yet</Text>
                <Text style={styles.emptyText}>Log a few sets and your best lifts show up here.</Text>
              </View>
            )}
          </View>
        </View>

        {/* LIFETIME */}
        <View style={settingsStyles.section}>
          <SectionLabel label="LIFETIME" />
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
    gap: 16,
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
    marginTop: 2,
  },
  identityName: {
    color: HG.ink,
    fontSize: 20,
    fontWeight: '800',
    marginTop: 14,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  actionPrimary: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: HG.ink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionPrimaryText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '800',
  },
  actionSecondary: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: HG.surface,
    borderWidth: 1,
    borderColor: HG.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionSecondaryText: {
    color: HG.ink,
    fontSize: 14.5,
    fontWeight: '800',
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
    gap: 8,
    marginTop: 12,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: HG.purpleLight,
  },
  badgeText: {
    color: HG.purpleDark,
    fontSize: 12,
    fontWeight: '800',
  },
  planCaption: {
    color: HG.muted,
    fontSize: 12.5,
    fontWeight: '600',
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
    width: 36,
    height: 36,
    borderRadius: 11,
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
    fontWeight: '600',
    marginTop: 2,
  },
  recordValueBlock: {
    alignItems: 'flex-end',
  },
  recordValue: {
    color: HG.ink,
    fontSize: 15,
    fontWeight: '800',
  },
  recordMetaText: {
    color: HG.muted,
    fontSize: 11.5,
    fontWeight: '700',
    marginTop: 2,
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
  },
  statLabel: {
    color: HG.faint,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  statValue: {
    color: HG.ink,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: 6,
  },
  statMeta: {
    color: HG.muted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
});
