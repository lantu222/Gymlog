import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getFitnessPhotoVariant } from '../assets/fitnessPhotos';
import { FitnessPhotoSurface } from '../components/FitnessPhotoSurface';
import { BadgePill, SurfaceCard } from '../components/MainScreenPrimitives';
import { PremiumFeatureVisual } from '../components/PremiumFeatureVisual';
import { ScreenHeader } from '../components/ScreenHeader';
import { WorkoutSceneGraphic } from '../components/WorkoutSceneGraphic';
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
import { colors, layout, radii, spacing } from '../theme';
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
  onOpenWeek?: () => void;
  onOpenProgram?: () => void;
  onAskVallu?: () => void;
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

function SectionLabel({ label }: { label: string }) {
  return <Text style={styles.sectionLabel}>{label}</Text>;
}

function TailoringEntry({
  kicker,
  title,
  body,
  visual,
  badgeLabel,
  onPress,
}: {
  kicker: string;
  title: string;
  body: string;
  visual: React.ReactNode;
  badgeLabel?: string;
  onPress?: () => void;
}) {
  return (
    <SurfaceCard accent="neutral" emphasis="flat" onPress={onPress} style={styles.entryCard}>
      <View style={styles.entryRow}>
        <View style={styles.entryVisual}>{visual}</View>
        <View style={styles.entryCopy}>
          <View style={styles.entryTopRow}>
            <Text style={styles.entryKicker}>{kicker}</Text>
            {badgeLabel ? <BadgePill accent="neutral" label={badgeLabel} /> : null}
          </View>
          <Text style={styles.entryTitle}>{title}</Text>
          <Text style={styles.entryBody}>{body}</Text>
        </View>
      </View>
    </SurfaceCard>
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
  onOpenWeek,
  onOpenProgram,
  onAskVallu,
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
      : 'Gymlog places the week';
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
      <ScreenHeader title="Plan settings" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <FitnessPhotoSurface variant={heroPhoto} style={styles.heroSurface}>
          <View style={styles.heroContent}>
            <Text style={styles.heroKicker}>{setupComplete ? 'Control center' : 'Finish setup'}</Text>

            <View style={styles.heroTokenRow}>
              {heroTokens.map((token) => (
                <BadgePill key={token} accent="neutral" label={token} />
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
            visual={<WorkoutSceneGraphic variant="plan" accent="neutral" compact />}
            onPress={onRefineSetup}
          />

          <TailoringEntry
            kicker="Exercise preferences"
            title={`${getTrainingFeelTitle(preferences.setupTrainingFeel)} | ${getWorkoutVarietyTitle(preferences.setupWorkoutVariety)}`}
            body={`FW ${getExerciseModalityPreferenceTitle(preferences.setupFreeWeightsPreference).toLowerCase()} | BW ${getExerciseModalityPreferenceTitle(preferences.setupBodyweightPreference).toLowerCase()} | Machines ${getExerciseModalityPreferenceTitle(preferences.setupMachinesPreference).toLowerCase()}`}
            badgeLabel="Tone"
            visual={<WorkoutSceneGraphic variant="today" accent="neutral" compact />}
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
            visual={<WorkoutSceneGraphic variant="plan" accent="neutral" compact />}
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
            visual={<WorkoutSceneGraphic variant="today" accent="neutral" compact />}
            onPress={onOpenJointSwaps}
          />
        </View>

        <SectionLabel label="Who manages the week?" />

        <SurfaceCard accent="neutral" emphasis="standard" style={styles.scheduleCard}>
          <View style={styles.scheduleHeader}>
            <View style={styles.scheduleCopy}>
              <Text style={styles.scheduleKicker}>Schedule</Text>
              <Text style={styles.scheduleTitle}>{getScheduleModeLabel(scheduleMode)}</Text>
              <Text style={styles.scheduleBody}>{weekdaySummary}</Text>
            </View>
            <BadgePill accent="neutral" label={scheduleMode === 'app_managed' ? 'Managed' : 'Self-managed'} />
          </View>

          <View style={styles.scheduleToggleRow}>
            <Pressable
              onPress={() => onScheduleModeChange('app_managed')}
              style={[styles.scheduleToggle, scheduleMode === 'app_managed' && styles.scheduleToggleActive]}
            >
              <Text style={[styles.scheduleToggleTitle, scheduleMode === 'app_managed' && styles.scheduleToggleTitleActive]}>
                Gymlog manages this
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
        </SurfaceCard>

        <SectionLabel label="Smarter layers" />

        <View style={styles.entryGrid}>
          <TailoringEntry
            kicker="Adaptive progression"
            title={preferences.adaptiveCoachPremiumUnlocked ? 'Premium preview is on' : 'Premium'}
            body="Effort changes the next set, rest, and session direction."
            badgeLabel={preferences.adaptiveCoachPremiumUnlocked ? 'Live now' : 'Locked'}
            visual={<PremiumFeatureVisual variant="coach" accent="neutral" compact />}
            onPress={onOpenPremium}
          />

          <TailoringEntry
            kicker="Recovery / readiness"
            title="Recovery / readiness"
            body="Readiness checks and recovery-driven adjustments belong here next."
            badgeLabel="Soon"
            visual={<PremiumFeatureVisual variant="rest" accent="neutral" compact />}
            onPress={onOpenPremium}
          />
        </View>

        <SectionLabel label="Use this plan" />

        <View style={styles.actionGrid}>
          {onOpenWeek ? (
            <SurfaceCard accent="neutral" emphasis="flat" onPress={onOpenWeek} style={styles.actionCard}>
              <Text style={styles.actionKicker}>Week</Text>
              <Text style={styles.actionTitle}>See updated week</Text>
              <Text style={styles.actionBody}>Open the live handoff.</Text>
            </SurfaceCard>
          ) : null}

          {onOpenProgram ? (
            <SurfaceCard accent="neutral" emphasis="flat" onPress={onOpenProgram} style={styles.actionCard}>
              <Text style={styles.actionKicker}>Program</Text>
              <Text style={styles.actionTitle}>Full plan</Text>
              <Text style={styles.actionBody}>Check sessions and launch.</Text>
            </SurfaceCard>
          ) : null}

          {onAskVallu ? (
            <SurfaceCard accent="neutral" emphasis="flat" onPress={onAskVallu} style={styles.actionCard}>
              <Text style={styles.actionKicker}>Gymlog AI</Text>
              <Text style={styles.actionTitle}>Ask why</Text>
              <Text style={styles.actionBody}>Open the plan context directly.</Text>
            </SurfaceCard>
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
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  heroContent: {
    flex: 1,
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  heroKicker: {
    color: 'rgba(255,255,255,0.58)',
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
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(18, 21, 26, 0.94)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
    gap: 4,
  },
  signalLabel: {
    color: 'rgba(255,255,255,0.56)',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  signalValue: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  entryGrid: {
    gap: spacing.sm,
  },
  entryCard: {
    padding: spacing.sm,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  entryVisual: {
    width: 116,
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
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  entryTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  entryBody: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  scheduleCard: {
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
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  scheduleTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  scheduleBody: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  scheduleToggleRow: {
    gap: spacing.sm,
  },
  scheduleToggle: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(11, 16, 22, 0.40)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: 4,
  },
  scheduleToggleActive: {
    backgroundColor: '#F3F7FF',
    borderColor: 'rgba(255,255,255,0.24)',
  },
  scheduleToggleTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  scheduleToggleTitleActive: {
    color: '#06080B',
  },
  scheduleToggleMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  scheduleToggleMetaActive: {
    color: '#3F4A54',
  },
  actionGrid: {
    gap: spacing.sm,
  },
  actionCard: {
    gap: spacing.xs,
  },
  actionKicker: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  actionTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  actionBody: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
});
