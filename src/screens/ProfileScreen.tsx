import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { ConfirmDialog } from '../components/ConfirmDialog';
import { formatLiftDisplayLabel } from '../lib/displayLabel';
import {
  getFocusAreaTitle,
  getSetupEquipmentTitle,
  getSetupGoalTitle,
} from '../lib/firstRunSetup';
import { convertWeightFromKg, formatWeight, removeTrailingZeros } from '../lib/format';
import { LifetimeTrainingSummary } from '../lib/lifetimeSummary';
import { ExerciseProgressSummary } from '../lib/progression';
import { HG } from '../lightTheme';
import { appInfo, layout } from '../theme';
import { AppLanguage, AppPreferences, ExerciseLibraryItem, UnitPreference } from '../types/models';

interface ProfileScreenProps {
  preferences: AppPreferences;
  lifetime: LifetimeTrainingSummary;
  trackedProgress: ExerciseProgressSummary[];
  exerciseLibrary: ExerciseLibraryItem[];
  unitPreference: UnitPreference;
  recommendedProgramName?: string | null;
  recommendedProgramDaysPerWeek?: number | null;
  planNextLabel?: string | null;
  onUnitPreferenceChange: (nextUnit: UnitPreference) => void;
  onPreferencesChange: (patch: Partial<AppPreferences>) => void;
  onManagePlan: () => void;
  onEditTraining: () => void;
  onOpenProgress: () => void;
  onOpenPremium: () => void;
  onOpenSettings: () => void;
  onResetAllData: () => void;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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

function formatTrainingSince(firstSessionAt: string | null) {
  if (!firstSessionAt) {
    return null;
  }
  const date = new Date(firstSessionAt);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return `Training since ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

function formatCompactVolume(totalKg: number, unitPreference: UnitPreference) {
  const value = convertWeightFromKg(totalKg, unitPreference);
  if (unitPreference === 'kg' && value >= 1000) {
    const tonnes = value / 1000;
    return `${removeTrailingZeros(Number(tonnes.toFixed(tonnes >= 100 ? 0 : 1)))} t`;
  }
  if (unitPreference === 'lb' && value >= 1000) {
    const thousands = value / 1000;
    return `${removeTrailingZeros(Number(thousands.toFixed(thousands >= 100 ? 0 : 1)))}k lb`;
  }
  return `${removeTrailingZeros(Math.round(value))} ${unitPreference}`;
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function ChevronIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M9 6l6 6-6 6" stroke={HG.faint} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function SettingsGlyph() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={3} stroke={HG.purpleDark} strokeWidth={2} />
      <Path
        d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"
        stroke={HG.purpleDark}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function DumbbellGlyph() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10"
        stroke={HG.purpleDark}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function StarGlyph() {
  return (
    <Svg width={17} height={17} viewBox="0 0 24 24" fill="#C9B6FF">
      <Path d="M12 2l2.4 6.4L21 9l-5 4.2L17.6 21 12 17.3 6.4 21 8 13.2 3 9l6.6-.6z" />
    </Svg>
  );
}

function AccountActionIcon({ path, color }: { path: string; color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d={path} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function SectionLabel({ label, actionLabel, onAction }: { label: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {actionLabel ? (
        <Text onPress={onAction} style={styles.sectionAction}>
          {actionLabel}
        </Text>
      ) : null}
    </View>
  );
}

function Seg<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ key: T; label: string }>;
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <View style={styles.seg}>
      {options.map((option) => {
        const active = option.key === value;
        return (
          <Pressable key={option.key} onPress={() => onChange(option.key)} style={[styles.segItem, active && styles.segItemActive]}>
            <Text style={[styles.segText, active && styles.segTextActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function StatCard({ label, value, meta }: { label: string; value: string; meta: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statMeta}>{meta}</Text>
    </View>
  );
}

export function ProfileScreen({
  preferences,
  lifetime,
  trackedProgress,
  exerciseLibrary,
  unitPreference,
  recommendedProgramName,
  recommendedProgramDaysPerWeek,
  planNextLabel,
  onUnitPreferenceChange,
  onPreferencesChange,
  onManagePlan,
  onEditTraining,
  onOpenProgress,
  onOpenPremium,
  onOpenSettings,
  onResetAllData,
}: ProfileScreenProps) {
  const [resetVisible, setResetVisible] = useState(false);

  const identityName = preferences.profileName?.trim() ? preferences.profileName.trim() : null;
  const trainingSince = formatTrainingSince(lifetime.firstSessionAt);

  const bodyPartByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of exerciseLibrary) {
      map.set(item.name.trim().toLowerCase(), item.bodyPart);
    }
    return map;
  }, [exerciseLibrary]);

  const personalRecords = useMemo(
    () =>
      trackedProgress
        .filter((summary) => summary.bestWeight !== null)
        .sort((left, right) => (right.bestWeight ?? 0) - (left.bestWeight ?? 0))
        .slice(0, 5),
    [trackedProgress],
  );

  const goalLabel = preferences.setupGoal ? getSetupGoalTitle(preferences.setupGoal) : 'Not set';
  const experienceLabel = preferences.setupLevel ? capitalize(preferences.setupLevel) : 'Not set';
  const equipmentLabel = preferences.setupEquipment ? getSetupEquipmentTitle(preferences.setupEquipment) : 'Not set';
  const focusAreas = preferences.setupFocusAreas.map((area) => getFocusAreaTitle(area));

  const planName = recommendedProgramName?.trim() ? recommendedProgramName.trim() : null;
  const planMeta = planName
    ? [recommendedProgramDaysPerWeek ? `${recommendedProgramDaysPerWeek} sessions / week` : null, goalLabel !== 'Not set' ? goalLabel : null]
        .filter(Boolean)
        .join(' · ')
    : 'Pick a plan to guide your week.';

  const lifetimeStats = [
    { label: 'Sessions', value: `${lifetime.sessionCount}`, meta: 'logged' },
    { label: 'Weeks active', value: `${lifetime.weeksActive}`, meta: `of ${lifetime.weeksSinceStart}` },
    { label: 'Total volume', value: formatCompactVolume(lifetime.totalVolumeKg, unitPreference), meta: 'lifted' },
    { label: 'Best rhythm', value: `${lifetime.bestWeekStreak} wk`, meta: 'in a row' },
  ];

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>Profile</Text>
          <Text style={styles.headerSubtitle}>Your training identity.</Text>
        </View>
        <Pressable onPress={onOpenSettings} style={styles.headerButton}>
          <SettingsGlyph />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
      >
        {/* IDENTITY */}
        <View style={styles.identityCard}>
          <View style={styles.identityTop}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials(identityName)}</Text>
            </View>
            <View style={styles.identityCopy}>
              <Text style={styles.identityName}>{identityName ?? 'Guest athlete'}</Text>
              <Text numberOfLines={1} style={styles.identitySub}>
                {identityName ? 'Signed in on this device.' : 'Your training lives on this device.'}
              </Text>
            </View>
          </View>
          <View style={styles.identityFooter}>
            <View style={styles.sincePill}>
              <View style={styles.sinceDot} />
              <Text style={styles.sinceText}>{trainingSince ?? 'New here'}</Text>
            </View>
            <Text style={styles.deviceText}>· On this device</Text>
          </View>
        </View>

        {/* LIFETIME */}
        <View style={styles.section}>
          <SectionLabel label="LIFETIME" />
          <View style={styles.statGrid}>
            {lifetimeStats.map((stat) => (
              <StatCard key={stat.label} label={stat.label} value={stat.value} meta={stat.meta} />
            ))}
          </View>
        </View>

        {/* YOUR PLAN */}
        <View style={styles.section}>
          <SectionLabel label="YOUR PLAN" actionLabel={planName ? 'Manage' : undefined} onAction={onManagePlan} />
          <Pressable onPress={onManagePlan} style={styles.card}>
            <View style={styles.planTop}>
              <View style={styles.planIcon}>
                <DumbbellGlyph />
              </View>
              <View style={styles.planCopy}>
                <Text numberOfLines={1} style={styles.planName}>
                  {planName ?? 'No plan selected'}
                </Text>
                <Text numberOfLines={1} style={styles.planMeta}>
                  {planMeta}
                </Text>
              </View>
              <ChevronIcon />
            </View>
            {planName && planNextLabel ? (
              <View style={styles.planNextRow}>
                <Text style={styles.planNextLabel}>Up next</Text>
                <Text style={styles.planNextValue}>{planNextLabel}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        {/* TRAINING PROFILE */}
        <View style={styles.section}>
          <SectionLabel label="TRAINING PROFILE" actionLabel="Edit" onAction={onEditTraining} />
          <View style={styles.card}>
            <View style={styles.trainingRow}>
              <Text style={styles.trainingKey}>Goal</Text>
              <Text style={styles.trainingValue}>{goalLabel}</Text>
            </View>
            <View style={styles.trainingRow}>
              <Text style={styles.trainingKey}>Experience</Text>
              <Text style={styles.trainingValue}>{experienceLabel}</Text>
            </View>
            <View style={[styles.trainingRow, focusAreas.length === 0 && styles.trainingRowLast]}>
              <Text style={styles.trainingKey}>Equipment</Text>
              <Text style={styles.trainingValue}>{equipmentLabel}</Text>
            </View>
            {focusAreas.length > 0 ? (
              <View style={styles.focusBlock}>
                <Text style={styles.focusLabel}>Focus areas</Text>
                <View style={styles.focusChips}>
                  {focusAreas.map((area) => (
                    <View key={area} style={styles.focusChip}>
                      <Text style={styles.focusChipText}>{area}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        </View>

        {/* PERSONAL RECORDS */}
        <View style={styles.section}>
          <SectionLabel label="PERSONAL RECORDS" actionLabel="Progress" onAction={onOpenProgress} />
          <View style={styles.card}>
            {personalRecords.length > 0 ? (
              personalRecords.map((record, index) => {
                const bodyPart = bodyPartByName.get(record.name.trim().toLowerCase());
                return (
                  <View
                    key={record.key}
                    style={[styles.recordRow, index === personalRecords.length - 1 && styles.recordRowLast]}
                  >
                    <View style={styles.recordCopy}>
                      <Text numberOfLines={1} style={styles.recordName}>
                        {formatLiftDisplayLabel(record.name)}
                      </Text>
                      {bodyPart ? <Text style={styles.recordBodyPart}>{capitalize(bodyPart)}</Text> : null}
                    </View>
                    <View style={styles.recordValueBlock}>
                      <Text style={styles.recordValue}>{formatWeight(record.bestWeight, unitPreference)}</Text>
                      <Text style={styles.recordMetaText}>Personal best</Text>
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

        {/* PREMIUM */}
        <View style={styles.section}>
          <Pressable onPress={onOpenPremium} style={styles.premiumCard}>
            <View style={styles.premiumKicker}>
              <StarGlyph />
              <Text style={styles.premiumKickerText}>GAINER PREMIUM</Text>
            </View>
            <Text style={styles.premiumTitle}>Adaptive Coach</Text>
            <Text style={styles.premiumBody}>
              Reads your fatigue and progress, then adjusts each week&apos;s load for you. The longer you train, the sharper it gets.
            </Text>
            <View style={styles.premiumCta}>
              <Text style={styles.premiumCtaText}>See what&apos;s inside</Text>
            </View>
          </Pressable>
        </View>

        {/* PREFERENCES */}
        <View style={styles.section}>
          <SectionLabel label="PREFERENCES" />
          <View style={styles.card}>
            <View style={styles.prefRow}>
              <View style={styles.prefCopy}>
                <Text style={styles.prefLabel}>Units</Text>
              </View>
              <Seg
                options={[
                  { key: 'kg', label: 'kg' },
                  { key: 'lb', label: 'lb' },
                ]}
                value={unitPreference}
                onChange={onUnitPreferenceChange}
              />
            </View>
            <View style={styles.prefRow}>
              <View style={styles.prefCopy}>
                <Text style={styles.prefLabel}>Language</Text>
              </View>
              <Seg
                options={[
                  { key: 'fi', label: 'FIN' },
                  { key: 'en', label: 'ENG' },
                ]}
                value={preferences.appLanguage}
                onChange={(next: AppLanguage) => onPreferencesChange({ appLanguage: next })}
              />
            </View>
            <View style={[styles.prefRow, styles.prefRowLast]}>
              <View style={styles.prefCopy}>
                <Text style={styles.prefLabel}>Theme</Text>
                <Text style={styles.prefSub}>Dark mode is coming later.</Text>
              </View>
              <View style={styles.themeControl}>
                <View style={[styles.segItem, styles.segItemActive]}>
                  <Text style={[styles.segText, styles.segTextActive]}>Light</Text>
                </View>
                <View style={styles.themeSoon}>
                  <Text style={styles.themeSoonText}>Dark · Soon</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* ACCOUNT */}
        <View style={styles.section}>
          <SectionLabel label="ACCOUNT" />
          <View style={styles.card}>
            <View style={styles.accountRow}>
              <AccountActionIcon path="M12 3v12M7 10l5 5 5-5M5 21h14" color={HG.faint} />
              <View style={styles.accountCopy}>
                <Text style={styles.accountLabel}>Export my data</Text>
                <Text style={styles.accountSub}>Download a local copy.</Text>
              </View>
              <View style={styles.soonBadge}>
                <Text style={styles.soonBadgeText}>Soon</Text>
              </View>
            </View>
            <View style={styles.accountRow}>
              <AccountActionIcon path="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z" color={HG.faint} />
              <View style={styles.accountCopy}>
                <Text style={styles.accountLabel}>Privacy</Text>
                <Text style={styles.accountSub}>How your data is handled.</Text>
              </View>
              <View style={styles.soonBadge}>
                <Text style={styles.soonBadgeText}>Soon</Text>
              </View>
            </View>
            <Pressable onPress={() => setResetVisible(true)} style={[styles.accountRow, styles.accountRowLast]}>
              <AccountActionIcon
                path="M4 7h16M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2M6 7l1 13a2 2 0 002 2h6a2 2 0 002-2l1-13"
                color="#C0392B"
              />
              <View style={styles.accountCopy}>
                <Text style={[styles.accountLabel, styles.accountLabelDanger]}>Reset all data</Text>
                <Text style={styles.accountSub}>Clear everything on this device.</Text>
              </View>
            </Pressable>
          </View>
          <Text style={styles.versionText}>GAINER · v{appInfo.version}</Text>
        </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 8,
    gap: 12,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    color: HG.ink,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    color: HG.muted,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: HG.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: layout.bottomTabBarReserve,
  },
  section: {
    marginTop: 22,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    paddingBottom: 11,
  },
  sectionLabel: {
    color: HG.faint,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  sectionAction: {
    color: HG.purple,
    fontSize: 12.5,
    fontWeight: '800',
  },
  card: {
    backgroundColor: HG.surface,
    borderWidth: 1,
    borderColor: HG.border,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  identityCard: {
    backgroundColor: HG.surface,
    borderWidth: 1,
    borderColor: HG.border,
    borderRadius: 18,
    padding: 18,
  },
  identityTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 999,
    backgroundColor: HG.purpleDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
  },
  identityCopy: {
    flex: 1,
    minWidth: 0,
  },
  identityName: {
    color: HG.ink,
    fontSize: 19,
    fontWeight: '800',
  },
  identitySub: {
    color: HG.muted,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  identityFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: HG.border,
  },
  sincePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: HG.purpleLight,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
  },
  sinceDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: HG.purple,
  },
  sinceText: {
    color: HG.purpleDark,
    fontSize: 12,
    fontWeight: '800',
  },
  deviceText: {
    color: HG.muted,
    fontSize: 12.5,
    fontWeight: '700',
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: HG.surface,
    borderWidth: 1,
    borderColor: HG.border,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  statLabel: {
    color: HG.faint,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  statValue: {
    color: HG.ink,
    fontSize: 25,
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
  planTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingVertical: 12,
  },
  planIcon: {
    width: 46,
    height: 46,
    borderRadius: 13,
    backgroundColor: HG.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planCopy: {
    flex: 1,
    minWidth: 0,
  },
  planName: {
    color: HG.ink,
    fontSize: 16,
    fontWeight: '800',
  },
  planMeta: {
    color: HG.muted,
    fontSize: 12.5,
    fontWeight: '700',
    marginTop: 2,
  },
  planNextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
    marginBottom: 4,
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: HG.border,
  },
  planNextLabel: {
    color: HG.muted,
    fontSize: 12.5,
    fontWeight: '700',
  },
  planNextValue: {
    color: HG.ink,
    fontSize: 13.5,
    fontWeight: '800',
  },
  trainingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: HG.border,
  },
  trainingRowLast: {
    borderBottomWidth: 0,
  },
  trainingKey: {
    color: HG.muted,
    fontSize: 14,
    fontWeight: '700',
  },
  trainingValue: {
    color: HG.ink,
    fontSize: 14.5,
    fontWeight: '800',
  },
  focusBlock: {
    paddingTop: 13,
    paddingBottom: 14,
  },
  focusLabel: {
    color: HG.muted,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  focusChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  focusChip: {
    backgroundColor: HG.purpleLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  focusChipText: {
    color: HG.purpleDark,
    fontSize: 13,
    fontWeight: '700',
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
    marginTop: 2,
  },
  recordValueBlock: {
    alignItems: 'flex-end',
  },
  recordValue: {
    color: HG.ink,
    fontSize: 16,
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
    fontSize: 15,
    fontWeight: '800',
  },
  emptyText: {
    color: HG.muted,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
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
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: HG.border,
  },
  prefRowLast: {
    borderBottomWidth: 0,
  },
  prefCopy: {
    flex: 1,
    minWidth: 0,
  },
  prefLabel: {
    color: HG.ink,
    fontSize: 14.5,
    fontWeight: '800',
  },
  prefSub: {
    color: HG.muted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 3,
  },
  seg: {
    flexDirection: 'row',
    backgroundColor: HG.surfaceSoft,
    borderRadius: 10,
    padding: 3,
    gap: 2,
  },
  segItem: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 7,
  },
  segItemActive: {
    backgroundColor: '#FFFFFF',
  },
  segText: {
    color: HG.muted,
    fontSize: 13,
    fontWeight: '800',
  },
  segTextActive: {
    color: HG.purpleDark,
  },
  themeControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: HG.surfaceSoft,
    borderRadius: 10,
    padding: 3,
  },
  themeSoon: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  themeSoonText: {
    color: HG.faint,
    fontSize: 12.5,
    fontWeight: '700',
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: HG.border,
  },
  accountRowLast: {
    borderBottomWidth: 0,
  },
  accountCopy: {
    flex: 1,
    minWidth: 0,
  },
  accountLabel: {
    color: HG.ink,
    fontSize: 14.5,
    fontWeight: '800',
  },
  accountLabelDanger: {
    color: '#C0392B',
  },
  accountSub: {
    color: HG.muted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  soonBadge: {
    backgroundColor: HG.surfaceSoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  soonBadgeText: {
    color: HG.faint,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  versionText: {
    textAlign: 'center',
    color: HG.faint,
    fontSize: 11.5,
    fontWeight: '600',
    marginTop: 16,
  },
});
