import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BadgePill, SectionHeaderBlock, SurfaceCard } from '../components/MainScreenPrimitives';
import { PremiumFeatureVisual } from '../components/PremiumFeatureVisual';
import { ScreenHeader } from '../components/ScreenHeader';
import { WorkoutSceneGraphic } from '../components/WorkoutSceneGraphic';
import {
  formatFocusAreaList,
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
  summarizeJointSwapPreferences,
  getWorkoutVarietyTitle,
  summarizeExercisePreferences,
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
    .join(' · ');
}

function TailoringEntry({
  accent,
  kicker,
  title,
  body,
  visual,
  badgeLabel,
  onPress,
}: {
  accent: 'blue' | 'orange' | 'rose' | 'neutral';
  kicker: string;
  title: string;
  body: string;
  visual: React.ReactNode;
  badgeLabel?: string;
  onPress?: () => void;
}) {
  return (
    <SurfaceCard accent={accent} emphasis="flat" onPress={onPress} style={styles.entryCard}>
      <View style={styles.entryRow}>
        <View style={styles.entryVisual}>{visual}</View>
        <View style={styles.entryCopy}>
          <View style={styles.entryTopRow}>
            <Text style={styles.entryKicker}>{kicker}</Text>
            {badgeLabel ? <BadgePill accent={accent === 'neutral' ? 'blue' : accent} label={badgeLabel} /> : null}
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

  const badges = setupComplete
    ? [
        getSetupGoalTitle(preferences.setupGoal!),
        `${preferences.setupDaysPerWeek} days`,
        getSetupEquipmentTitle(preferences.setupEquipment!),
      ]
    : [];

  const scheduleMode = preferences.setupScheduleMode ?? 'app_managed';
  const weekdaySummary =
    scheduleMode === 'self_managed' && preferences.setupAvailableDays.length > 0
      ? formatWeekdayList(preferences.setupAvailableDays)
      : 'Gymlog places the rhythm';
  const focusSummary = preferences.setupFocusAreas.length > 0 ? formatFocusAreaList(preferences.setupFocusAreas) : 'No extra focus';
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

  return (
    <>
      <ScreenHeader
        title="Plan settings"
        subtitle="One hub for plan fit, exercise preferences, and premium adaptation."
        onBack={onBack}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SurfaceCard accent="orange" emphasis="hero" style={styles.heroCard}>
          <View style={styles.heroRow}>
            <View style={styles.heroCopy}>
              <Text style={styles.heroKicker}>{setupComplete ? 'Tailoring' : 'Finish setup'}</Text>
              <Text style={styles.heroTitle}>{recommendedProgramName ?? 'No plan locked in yet'}</Text>
              <Text style={styles.heroBody}>
                {setupComplete
                  ? 'This is the control center for how Gymlog should guide the week.'
                  : 'Finish the setup first, then shape how the week should feel and adapt.'}
              </Text>
            </View>
            <WorkoutSceneGraphic variant="build" accent="orange" compact style={styles.heroVisual} />
          </View>

          {badges.length ? (
            <View style={styles.badgeRow}>
              {badges.map((badge) => (
                <BadgePill key={badge} label={badge} accent="orange" />
              ))}
            </View>
          ) : null}

          <Text style={styles.heroSummary}>
            {exercisePreferenceSummary}
          </Text>
        </SurfaceCard>

        <SectionHeaderBlock
          accent="blue"
          kicker="Tailoring"
          title="Shape the plan"
          subtitle="Each part has its own entry now instead of one broad settings page."
        />

        <View style={styles.entryGrid}>
          <TailoringEntry
            accent="orange"
            kicker="Plan fit"
            title={setupComplete ? 'Review setup' : 'Finish setup'}
            body={
              setupComplete
                ? `${compactOutcomes(preferences)} · ${getGuidanceModeLabel(preferences.setupGuidanceMode!)}`
                : 'Lock in your goal, schedule, and how guided this should stay.'
            }
            badgeLabel={setupComplete ? 'Core' : 'Required'}
            visual={<WorkoutSceneGraphic variant="plan" accent="orange" compact />}
            onPress={onRefineSetup}
          />

          <TailoringEntry
            accent="blue"
            kicker="Exercise preferences"
            title={`${getTrainingFeelTitle(preferences.setupTrainingFeel)} · ${getWorkoutVarietyTitle(preferences.setupWorkoutVariety)}`}
            body={`Free weights ${getExerciseModalityPreferenceTitle(preferences.setupFreeWeightsPreference).toLowerCase()} · Bodyweight ${getExerciseModalityPreferenceTitle(preferences.setupBodyweightPreference).toLowerCase()} · Machines ${getExerciseModalityPreferenceTitle(preferences.setupMachinesPreference).toLowerCase()}`}
            badgeLabel="New"
            visual={<WorkoutSceneGraphic variant="today" accent="blue" compact />}
            onPress={onOpenExercisePreferences}
          />
        </View>

        <SectionHeaderBlock
          accent="orange"
          kicker="Tailoring"
          title="Equipment and swaps"
          subtitle="These settings now affect recommendation, discovery, and quick swaps."
        />

        <View style={styles.entryGrid}>
          <TailoringEntry
            accent="orange"
            kicker="Equipment"
            title={getTailoringSetupEquipmentTitle(preferences.setupEquipment)}
            body={getSetupEquipmentHint(preferences.setupEquipment)}
            badgeLabel="Live"
            visual={<WorkoutSceneGraphic variant="plan" accent="orange" compact />}
            onPress={onOpenEquipment}
          />

          <TailoringEntry
            accent="neutral"
            kicker="Joint-friendly swaps"
            title={jointSwapSummary}
            body="Set how strongly quick swaps should protect shoulders, elbows, or knees."
            badgeLabel={
              preferences.setupShoulderFriendlySwaps !== 'neutral' ||
              preferences.setupElbowFriendlySwaps !== 'neutral' ||
              preferences.setupKneeFriendlySwaps !== 'neutral'
                ? 'Active'
                : 'Default'
            }
            visual={<WorkoutSceneGraphic variant="today" accent="blue" compact />}
            onPress={onOpenJointSwaps}
          />
        </View>

        <SectionHeaderBlock
          accent="blue"
          kicker="Week control"
          title="Who should manage the schedule?"
          subtitle="Keep this simple here. Use setup review when you want to change actual days and weekly time."
        />

        <SurfaceCard accent="blue" emphasis="standard" style={styles.scheduleCard}>
          <View style={styles.scheduleHeader}>
            <View style={styles.scheduleCopy}>
              <Text style={styles.scheduleKicker}>Schedule</Text>
              <Text style={styles.scheduleTitle}>{getScheduleModeLabel(scheduleMode)}</Text>
              <Text style={styles.scheduleBody}>{weekdaySummary}</Text>
            </View>
            <BadgePill accent="blue" label={scheduleMode === 'app_managed' ? 'Managed' : 'Self-managed'} />
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

        <SectionHeaderBlock
          accent="rose"
          kicker="Premium"
          title="Smarter layers"
          subtitle="Keep the advanced adaptation here instead of scattering it across the app."
        />

        <View style={styles.entryGrid}>
          <TailoringEntry
            accent="rose"
            kicker="Adaptive progression"
            title={preferences.adaptiveCoachPremiumUnlocked ? 'Preview is on' : 'Premium'}
            body="Rate effort, then let Gymlog adjust the next set, rest, and session direction."
            badgeLabel={preferences.adaptiveCoachPremiumUnlocked ? 'Live now' : 'Locked'}
            visual={<PremiumFeatureVisual variant="coach" accent="rose" compact />}
            onPress={onOpenPremium}
          />

          <TailoringEntry
            accent="blue"
            kicker="Recovery / readiness"
            title="Coming into the same hub"
            body="Readiness checks and recovery-driven adjustments belong here next to schedule and progression."
            badgeLabel="Soon"
            visual={<PremiumFeatureVisual variant="rest" accent="blue" compact />}
            onPress={onOpenPremium}
          />
        </View>

        <SectionHeaderBlock
          accent="blue"
          kicker="Use this plan"
          title="Keep actions close"
          subtitle="Start from the week, the full plan, or Vallu without hunting around the app."
        />

        <View style={styles.actionGrid}>
          {onOpenWeek ? (
            <SurfaceCard accent="blue" emphasis="flat" onPress={onOpenWeek} style={styles.actionCard}>
              <Text style={styles.actionKicker}>Week</Text>
              <Text style={styles.actionTitle}>See updated week</Text>
              <Text style={styles.actionBody}>Open the live handoff instead of another settings layer.</Text>
            </SurfaceCard>
          ) : null}

          {onOpenProgram ? (
            <SurfaceCard accent="blue" emphasis="flat" onPress={onOpenProgram} style={styles.actionCard}>
              <Text style={styles.actionKicker}>Program</Text>
              <Text style={styles.actionTitle}>Open full plan</Text>
              <Text style={styles.actionBody}>Check the exact sessions and launch from the right place.</Text>
            </SurfaceCard>
          ) : null}

          {onAskVallu ? (
            <SurfaceCard accent="blue" emphasis="flat" onPress={onAskVallu} style={styles.actionCard}>
              <Text style={styles.actionKicker}>Vallu</Text>
              <Text style={styles.actionTitle}>Ask why this fits</Text>
              <Text style={styles.actionBody}>Open the plan context directly instead of starting from a blank prompt.</Text>
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
    gap: spacing.md,
  },
  heroCard: {
    gap: spacing.md,
  },
  heroRow: {
    gap: spacing.md,
  },
  heroCopy: {
    gap: spacing.xs,
  },
  heroKicker: {
    color: '#FFB389',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  heroTitle: {
    color: colors.textPrimary,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.7,
  },
  heroBody: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  heroVisual: {
    width: '100%',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  heroSummary: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
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
    color: '#9ACCFF',
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
    color: '#9ACCFF',
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
    borderColor: 'rgba(150, 216, 255, 0.36)',
    backgroundColor: 'rgba(34, 56, 74, 0.92)',
  },
  scheduleToggleTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  scheduleToggleTitleActive: {
    color: '#D8F0FF',
  },
  scheduleToggleMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  scheduleToggleMetaActive: {
    color: '#BFE1FF',
  },
  actionGrid: {
    gap: spacing.sm,
  },
  actionCard: {
    gap: 4,
  },
  actionKicker: {
    color: '#9ACCFF',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
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
    lineHeight: 19,
    fontWeight: '700',
  },
});
