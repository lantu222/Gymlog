import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { getFitnessPhotoVariant } from '../assets/fitnessPhotos';
import { FitnessPhotoSurface } from '../components/FitnessPhotoSurface';
import { ScreenHeader } from '../components/ScreenHeader';
import {
  formatWeekdayList,
  getGuidanceModeLabel,
  getScheduleModeLabel,
  getSecondaryOutcomeTitle,
  getSetupEquipmentTitle,
  getSetupGoalTitle,
} from '../lib/firstRunSetup';
import {
  getExerciseModalityPreferenceTitle,
  getSetupEquipmentHint,
  getSetupEquipmentTitle as getTailoringSetupEquipmentTitle,
  getTrainingFeelTitle,
  getWorkoutVarietyTitle,
  summarizeExercisePreferences,
  summarizeJointSwapPreferences,
} from '../lib/tailoring';
import { HG } from '../lightTheme';
import { layout, radii, spacing } from '../theme';
import { AppPreferences, SetupScheduleMode } from '../types/models';

interface PlanSettingsScreenProps {
  preferences: AppPreferences;
  recommendedProgramName?: string | null;
  onBack: () => void;
  onRefineSetup: () => void;
  onOpenExercisePreferences: () => void;
  onOpenEquipment: () => void;
  onOpenJointSwaps: () => void;
  onOpenPremium: () => void;
  onScheduleModeChange: (mode: SetupScheduleMode) => void;
  onAutomatedProgressionChange?: (enabled: boolean) => void;
  onOpenWeek?: () => void;
  onOpenProgram?: () => void;
  onAskAiCoach?: () => void;
}

function compactOutcomes(preferences: AppPreferences) {
  if (preferences.setupSecondaryOutcomes.length === 0) {
    return 'No extra outcomes';
  }

  return preferences.setupSecondaryOutcomes
    .slice(0, 2)
    .map((outcome) => getSecondaryOutcomeTitle(outcome))
    .join(' | ');
}

function PlanGlyph() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M8 3v3M16 3v3M4 8h16M6 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"
        stroke={HG.purpleDark}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M9 14l2 2 4-4" stroke={HG.purpleDark} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function SlidersGlyph() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 8h10M18 8h2M4 16h4M12 16h8"
        stroke={HG.purpleDark}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Circle cx={16} cy={8} r={2.4} stroke={HG.purpleDark} strokeWidth={2} />
      <Circle cx={10} cy={16} r={2.4} stroke={HG.purpleDark} strokeWidth={2} />
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

function ShieldGlyph() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3l7 3v5c0 4.6-3 8.3-7 10-4-1.7-7-5.4-7-10V6l7-3z"
        stroke={HG.purpleDark}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M9 12l2 2 4-4" stroke={HG.purpleDark} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function SparkGlyph() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z"
        stroke={HG.purpleDark}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Path d="M18 16l.9 2.1L21 19l-2.1.9L18 22l-.9-2.1L15 19l2.1-.9L18 16z" fill={HG.purpleDark} />
    </Svg>
  );
}

function MoonGlyph() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20 13.5A8 8 0 0 1 10.5 4 8 8 0 1 0 20 13.5z"
        stroke={HG.purpleDark}
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

function SectionLabel({ label }: { label: string }) {
  return <Text style={styles.sectionLabel}>{label}</Text>;
}

function EntryBadge({ label }: { label: string }) {
  return (
    <View style={styles.entryBadge}>
      <Text style={styles.entryBadgeText}>{label}</Text>
    </View>
  );
}

function HeroPill({ label }: { label: string }) {
  return (
    <View style={styles.heroPill}>
      <Text style={styles.heroPillText}>{label}</Text>
    </View>
  );
}

function TailoringEntry({
  kicker,
  title,
  body,
  glyph,
  badgeLabel,
  onPress,
}: {
  kicker: string;
  title: string;
  body: string;
  glyph: React.ReactNode;
  badgeLabel?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.entryCard}>
      <View style={styles.entryIcon}>{glyph}</View>
      <View style={styles.entryCopy}>
        <View style={styles.entryTopRow}>
          <Text style={styles.entryKicker}>{kicker}</Text>
          {badgeLabel ? <EntryBadge label={badgeLabel} /> : null}
        </View>
        <Text style={styles.entryTitle}>{title}</Text>
        <Text style={styles.entryBody}>{body}</Text>
      </View>
      <ChevronIcon />
    </Pressable>
  );
}

export function PlanSettingsScreen({
  preferences,
  recommendedProgramName = null,
  onBack,
  onRefineSetup,
  onOpenExercisePreferences,
  onOpenEquipment,
  onOpenJointSwaps,
  onOpenPremium,
  onScheduleModeChange,
  onAutomatedProgressionChange,
  onOpenWeek,
  onOpenProgram,
  onAskAiCoach,
}: PlanSettingsScreenProps) {
  const setupComplete =
    preferences.setupCompleted &&
    preferences.setupGoal &&
    preferences.setupDaysPerWeek &&
    preferences.setupEquipment &&
    preferences.setupGuidanceMode &&
    preferences.setupScheduleMode;

  const heroTokens = setupComplete
    ? [
        getSetupGoalTitle(preferences.setupGoal!),
        `${preferences.setupDaysPerWeek} days`,
        getSetupEquipmentTitle(preferences.setupEquipment!),
      ]
    : ['Setup', 'Not finished'];

  const scheduleMode = preferences.setupScheduleMode ?? 'app_managed';
  const weekdaySummary =
    scheduleMode === 'self_managed' && preferences.setupAvailableDays.length > 0
      ? formatWeekdayList(preferences.setupAvailableDays)
      : 'GAINER places the week';
  const exercisePreferenceSummary = summarizeExercisePreferences({
    trainingFeel: preferences.setupTrainingFeel,
    workoutVariety: preferences.setupWorkoutVariety,
    freeWeights: preferences.setupFreeWeightsPreference,
    bodyweight: preferences.setupBodyweightPreference,
    machines: preferences.setupMachinesPreference,
  });
  const jointSwapSummary = summarizeJointSwapPreferences({
    shoulders: preferences.setupShoulderFriendlySwaps,
    elbows: preferences.setupElbowFriendlySwaps,
    knees: preferences.setupKneeFriendlySwaps,
  });
  const heroPhoto = getFitnessPhotoVariant({
    title: recommendedProgramName,
    goal: preferences.setupGoal ?? undefined,
  });
  const quickSignals = [
    { label: 'Schedule', value: getScheduleModeLabel(scheduleMode) },
    { label: 'Tone', value: getTrainingFeelTitle(preferences.setupTrainingFeel) },
    { label: 'Variety', value: getWorkoutVarietyTitle(preferences.setupWorkoutVariety) },
  ];

  return (
    <>
      <ScreenHeader title="Plan settings" tone="dark" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <FitnessPhotoSurface variant={heroPhoto} style={styles.heroSurface}>
          <View style={styles.heroContent}>
            <Text style={styles.heroKicker}>{setupComplete ? 'Control center' : 'Finish setup'}</Text>

            <View style={styles.heroTokenRow}>
              {heroTokens.map((token) => (
                <HeroPill key={token} label={token} />
              ))}
            </View>

            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>{recommendedProgramName ?? 'No plan locked in yet'}</Text>
              <Text style={styles.heroMeta}>{exercisePreferenceSummary}</Text>
            </View>
          </View>
        </FitnessPhotoSurface>

        <View style={styles.signalRow}>
          {quickSignals.map((signal) => (
            <View key={signal.label} style={styles.signalCard}>
              <Text style={styles.signalLabel}>{signal.label}</Text>
              <Text style={styles.signalValue}>{signal.value}</Text>
            </View>
          ))}
        </View>

        <SectionLabel label="Shape the plan" />

        <View style={styles.entryGrid}>
          <TailoringEntry
            kicker="Plan fit"
            title={setupComplete ? 'Review setup' : 'Finish setup'}
            body={
              setupComplete
                ? `${getGuidanceModeLabel(preferences.setupGuidanceMode!)} | ${compactOutcomes(preferences)}`
                : 'Lock in goal and schedule'
            }
            badgeLabel={setupComplete ? 'Core' : 'Required'}
            glyph={<PlanGlyph />}
            onPress={onRefineSetup}
          />

          <TailoringEntry
            kicker="Exercise preferences"
            title={`${getTrainingFeelTitle(preferences.setupTrainingFeel)} | ${getWorkoutVarietyTitle(preferences.setupWorkoutVariety)}`}
            body={`FW ${getExerciseModalityPreferenceTitle(preferences.setupFreeWeightsPreference).toLowerCase()} | BW ${getExerciseModalityPreferenceTitle(preferences.setupBodyweightPreference).toLowerCase()} | Machines ${getExerciseModalityPreferenceTitle(preferences.setupMachinesPreference).toLowerCase()}`}
            badgeLabel="Tone"
            glyph={<SlidersGlyph />}
            onPress={onOpenExercisePreferences}
          />
        </View>

        <SectionLabel label="Equipment and swaps" />

        <View style={styles.entryGrid}>
          <TailoringEntry
            kicker="Equipment"
            title={getTailoringSetupEquipmentTitle(preferences.setupEquipment)}
            body={getSetupEquipmentHint(preferences.setupEquipment)}
            badgeLabel="Live"
            glyph={<DumbbellGlyph />}
            onPress={onOpenEquipment}
          />

          <TailoringEntry
            kicker="Joint-friendly swaps"
            title={jointSwapSummary}
            body="Quick swaps protect shoulders, elbows, or knees."
            badgeLabel={
              preferences.setupShoulderFriendlySwaps !== 'neutral' ||
              preferences.setupElbowFriendlySwaps !== 'neutral' ||
              preferences.setupKneeFriendlySwaps !== 'neutral'
                ? 'Active'
                : 'Default'
            }
            glyph={<ShieldGlyph />}
            onPress={onOpenJointSwaps}
          />
        </View>

        <SectionLabel label="Who manages the week?" />

        <View style={styles.scheduleCard}>
          <View style={styles.scheduleHeader}>
            <View style={styles.scheduleCopy}>
              <Text style={styles.scheduleKicker}>Schedule</Text>
              <Text style={styles.scheduleTitle}>{getScheduleModeLabel(scheduleMode)}</Text>
              <Text style={styles.scheduleBody}>{weekdaySummary}</Text>
            </View>
            <EntryBadge label={scheduleMode === 'app_managed' ? 'Managed' : 'Self-managed'} />
          </View>

          <View style={styles.scheduleToggleRow}>
            <Pressable
              onPress={() => onScheduleModeChange('app_managed')}
              style={[styles.scheduleToggle, scheduleMode === 'app_managed' && styles.scheduleToggleActive]}
            >
              <Text style={[styles.scheduleToggleTitle, scheduleMode === 'app_managed' && styles.scheduleToggleTitleActive]}>
                GAINER manages this
              </Text>
              <Text style={[styles.scheduleToggleMeta, scheduleMode === 'app_managed' && styles.scheduleToggleMetaActive]}>
                App places the week.
              </Text>
            </Pressable>

            <Pressable
              onPress={() => onScheduleModeChange('self_managed')}
              style={[styles.scheduleToggle, scheduleMode === 'self_managed' && styles.scheduleToggleActive]}
            >
              <Text style={[styles.scheduleToggleTitle, scheduleMode === 'self_managed' && styles.scheduleToggleTitleActive]}>
                I manage this
              </Text>
              <Text style={[styles.scheduleToggleMeta, scheduleMode === 'self_managed' && styles.scheduleToggleMetaActive]}>
                You choose the days.
              </Text>
            </Pressable>
          </View>
        </View>

        <SectionLabel label="Automated progression" />

        <View style={styles.scheduleToggleRow}>
          <Pressable
            onPress={() => onAutomatedProgressionChange?.(true)}
            style={[styles.scheduleToggle, preferences.automatedProgressionEnabled && styles.scheduleToggleActive]}
          >
            <Text
              style={[styles.scheduleToggleTitle, preferences.automatedProgressionEnabled && styles.scheduleToggleTitleActive]}
            >
              On
            </Text>
            <Text
              style={[styles.scheduleToggleMeta, preferences.automatedProgressionEnabled && styles.scheduleToggleMetaActive]}
            >
              GAINER progresses loads and reps.
            </Text>
          </Pressable>

          <Pressable
            onPress={() => onAutomatedProgressionChange?.(false)}
            style={[styles.scheduleToggle, !preferences.automatedProgressionEnabled && styles.scheduleToggleActive]}
          >
            <Text
              style={[styles.scheduleToggleTitle, !preferences.automatedProgressionEnabled && styles.scheduleToggleTitleActive]}
            >
              Off
            </Text>
            <Text
              style={[styles.scheduleToggleMeta, !preferences.automatedProgressionEnabled && styles.scheduleToggleMetaActive]}
            >
              You control every load yourself.
            </Text>
          </Pressable>
        </View>

        <SectionLabel label="Smarter layers" />

        <View style={styles.entryGrid}>
          <TailoringEntry
            kicker="Adaptive progression"
            title={preferences.adaptiveCoachPremiumUnlocked ? 'Premium preview is on' : 'Premium'}
            body="Effort changes the next set, rest, and session direction."
            badgeLabel={preferences.adaptiveCoachPremiumUnlocked ? 'Live now' : 'Locked'}
            glyph={<SparkGlyph />}
            onPress={onOpenPremium}
          />

          <TailoringEntry
            kicker="Recovery / readiness"
            title="Recovery / readiness"
            body="Readiness checks and recovery-driven adjustments belong here next."
            badgeLabel="Soon"
            glyph={<MoonGlyph />}
            onPress={onOpenPremium}
          />
        </View>

        <SectionLabel label="Use this plan" />

        <View style={styles.actionGrid}>
          {onOpenWeek ? (
            <Pressable onPress={onOpenWeek} style={styles.actionCard}>
              <Text style={styles.actionKicker}>Week</Text>
              <Text style={styles.actionTitle}>See updated week</Text>
              <Text style={styles.actionBody}>Open the live handoff.</Text>
            </Pressable>
          ) : null}

          {onOpenProgram ? (
            <Pressable onPress={onOpenProgram} style={styles.actionCard}>
              <Text style={styles.actionKicker}>Program</Text>
              <Text style={styles.actionTitle}>Full plan</Text>
              <Text style={styles.actionBody}>Check sessions and launch.</Text>
            </Pressable>
          ) : null}

          {onAskAiCoach ? (
            <Pressable onPress={onAskAiCoach} style={styles.actionCard}>
              <Text style={styles.actionKicker}>GAINER AI</Text>
              <Text style={styles.actionTitle}>Ask why</Text>
              <Text style={styles.actionBody}>Open the plan context directly.</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: layout.bottomTabBarReserve,
    gap: spacing.lg,
  },
  heroSurface: {
    minHeight: 288,
    borderRadius: 28,
  },
  heroContent: {
    flex: 1,
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  heroKicker: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  heroTokenRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  heroPill: {
    minHeight: 28,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.30)',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  heroPillText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  heroCopy: {
    gap: spacing.xs,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 34,
    lineHeight: 36,
    fontWeight: '900',
    letterSpacing: -1,
    maxWidth: '84%',
  },
  heroMeta: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700',
    maxWidth: '80%',
  },
  signalRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  signalCard: {
    flex: 1,
    minHeight: 76,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: HG.border,
    backgroundColor: HG.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
    gap: 4,
  },
  signalLabel: {
    color: HG.faint,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  signalValue: {
    color: HG.ink,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  sectionLabel: {
    color: HG.faint,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  entryGrid: {
    gap: spacing.sm,
  },
  entryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: HG.border,
    backgroundColor: HG.surface,
    padding: spacing.md,
  },
  entryIcon: {
    width: 46,
    height: 46,
    borderRadius: 13,
    backgroundColor: HG.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryCopy: {
    flex: 1,
    gap: 4,
  },
  entryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  entryKicker: {
    color: HG.faint,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  entryTitle: {
    color: HG.ink,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  entryBody: {
    color: HG.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  entryBadge: {
    minHeight: 24,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    justifyContent: 'center',
    backgroundColor: HG.purpleLight,
  },
  entryBadgeText: {
    color: HG.purpleDark,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  scheduleCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: HG.border,
    backgroundColor: HG.surface,
    padding: spacing.lg,
    gap: spacing.md,
  },
  scheduleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  scheduleCopy: {
    flex: 1,
    gap: 4,
  },
  scheduleKicker: {
    color: HG.faint,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  scheduleTitle: {
    color: HG.ink,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  scheduleBody: {
    color: HG.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  scheduleToggleRow: {
    gap: spacing.sm,
  },
  scheduleToggle: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: HG.border,
    backgroundColor: HG.surfaceSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: 4,
  },
  scheduleToggleActive: {
    backgroundColor: HG.purpleLight,
    borderColor: HG.purple,
  },
  scheduleToggleTitle: {
    color: HG.ink,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  scheduleToggleTitleActive: {
    color: HG.purpleDark,
  },
  scheduleToggleMeta: {
    color: HG.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  scheduleToggleMetaActive: {
    color: HG.purple,
  },
  actionGrid: {
    gap: spacing.sm,
  },
  actionCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: HG.border,
    backgroundColor: HG.surface,
    padding: spacing.md,
    gap: spacing.xs,
  },
  actionKicker: {
    color: HG.faint,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  actionTitle: {
    color: HG.ink,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  actionBody: {
    color: HG.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
});
