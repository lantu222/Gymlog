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
import { t } from '../lib/i18n';
import { isProUnlocked } from '../lib/proEntitlement';
import { HG } from '../lightTheme';
import { layout, radii, spacing } from '../theme';
import { AppLanguage, AppPreferences, SetupScheduleMode } from '../types/models';

interface PlanSettingsScreenProps {
  preferences: AppPreferences;
  recommendedProgramName?: string | null;
  language?: AppLanguage;
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

function compactOutcomes(preferences: AppPreferences, language: AppLanguage) {
  if (preferences.setupSecondaryOutcomes.length === 0) {
    return t(language, 'planSet.noExtras');
  }

  return preferences.setupSecondaryOutcomes
    .slice(0, 2)
    .map((outcome) => getSecondaryOutcomeTitle(outcome, language))
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
  language = 'en',
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
  // A redeemed promo is Pro too, so this cannot read the preview switch alone.
  const proUnlocked = isProUnlocked(preferences);
  const setupComplete =
    preferences.setupCompleted &&
    preferences.setupGoal &&
    preferences.setupDaysPerWeek &&
    preferences.setupEquipment &&
    preferences.setupGuidanceMode &&
    preferences.setupScheduleMode;

  const heroTokens = setupComplete
    ? [
        getSetupGoalTitle(preferences.setupGoal!, language),
        t(language, 'planSet.days', { count: preferences.setupDaysPerWeek ?? 0 }),
        getSetupEquipmentTitle(preferences.setupEquipment!, language),
      ]
    : [t(language, 'planSet.setup'), t(language, 'planSet.notFinished')];

  const scheduleMode = preferences.setupScheduleMode ?? 'app_managed';
  const weekdaySummary =
    scheduleMode === 'self_managed' && preferences.setupAvailableDays.length > 0
      ? formatWeekdayList(preferences.setupAvailableDays, language)
      : t(language, 'planSet.gainerPlaces');
  const exercisePreferenceSummary = summarizeExercisePreferences(
    {
      trainingFeel: preferences.setupTrainingFeel,
      workoutVariety: preferences.setupWorkoutVariety,
      freeWeights: preferences.setupFreeWeightsPreference,
      bodyweight: preferences.setupBodyweightPreference,
      machines: preferences.setupMachinesPreference,
    },
    language,
  );
  const jointSwapSummary = summarizeJointSwapPreferences(
    {
      shoulders: preferences.setupShoulderFriendlySwaps,
      elbows: preferences.setupElbowFriendlySwaps,
      knees: preferences.setupKneeFriendlySwaps,
    },
    language,
  );
  const heroPhoto = getFitnessPhotoVariant({
    title: recommendedProgramName,
    goal: preferences.setupGoal ?? undefined,
  });
  const quickSignals = [
    { label: t(language, 'planSet.scheduleLabel'), value: getScheduleModeLabel(scheduleMode, language) },
    { label: t(language, 'planSet.tone'), value: getTrainingFeelTitle(preferences.setupTrainingFeel, language) },
    {
      label: t(language, 'planSet.variety'),
      value: getWorkoutVarietyTitle(preferences.setupWorkoutVariety, language),
    },
  ];

  return (
    <>
      <ScreenHeader title={t(language, 'plan.settings')} tone="dark" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <FitnessPhotoSurface variant={heroPhoto} style={styles.heroSurface}>
          <View style={styles.heroContent}>
            <Text style={styles.heroKicker}>
              {t(language, setupComplete ? 'planSet.controlCenter' : 'planSet.finishSetup')}
            </Text>

            <View style={styles.heroTokenRow}>
              {heroTokens.map((token) => (
                <HeroPill key={token} label={token} />
              ))}
            </View>

            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>{recommendedProgramName ?? t(language, 'planSet.noPlan')}</Text>
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

        <SectionLabel label={t(language, 'planSet.shape')} />

        <View style={styles.entryGrid}>
          <TailoringEntry
            kicker={t(language, 'planSet.planFit')}
            title={t(language, setupComplete ? 'planSet.reviewSetup' : 'planSet.finishSetup')}
            body={
              setupComplete
                ? `${getGuidanceModeLabel(preferences.setupGuidanceMode!, language)} | ${compactOutcomes(preferences, language)}`
                : t(language, 'planSet.lockIn')
            }
            badgeLabel={t(language, setupComplete ? 'planSet.core' : 'planSet.required')}
            glyph={<PlanGlyph />}
            onPress={onRefineSetup}
          />

          <TailoringEntry
            kicker={t(language, 'planSet.exercisePrefs')}
            title={`${getTrainingFeelTitle(preferences.setupTrainingFeel, language)} | ${getWorkoutVarietyTitle(preferences.setupWorkoutVariety, language)}`}
            body={t(language, 'planSet.modalitySummary', {
              freeWeights: getExerciseModalityPreferenceTitle(
                preferences.setupFreeWeightsPreference,
                language,
              ).toLowerCase(),
              bodyweight: getExerciseModalityPreferenceTitle(
                preferences.setupBodyweightPreference,
                language,
              ).toLowerCase(),
              machines: getExerciseModalityPreferenceTitle(
                preferences.setupMachinesPreference,
                language,
              ).toLowerCase(),
            })}
            badgeLabel={t(language, 'planSet.tone')}
            glyph={<SlidersGlyph />}
            onPress={onOpenExercisePreferences}
          />
        </View>

        <SectionLabel label={t(language, 'planSet.equipSwaps')} />

        <View style={styles.entryGrid}>
          <TailoringEntry
            kicker={t(language, 'myData.equipment')}
            title={getTailoringSetupEquipmentTitle(preferences.setupEquipment, language)}
            body={getSetupEquipmentHint(preferences.setupEquipment, language)}
            badgeLabel={t(language, 'planSet.liveBadge')}
            glyph={<DumbbellGlyph />}
            onPress={onOpenEquipment}
          />

          <TailoringEntry
            kicker={t(language, 'planSet.jointSwaps')}
            title={jointSwapSummary}
            body={t(language, 'planSet.jointSwapsBody')}
            badgeLabel={t(
              language,
              preferences.setupShoulderFriendlySwaps !== 'neutral' ||
                preferences.setupElbowFriendlySwaps !== 'neutral' ||
                preferences.setupKneeFriendlySwaps !== 'neutral'
                ? 'planSet.activeBadge'
                : 'planSet.defaultBadge',
            )}
            glyph={<ShieldGlyph />}
            onPress={onOpenJointSwaps}
          />
        </View>

        <SectionLabel label={t(language, 'planSet.whoManages')} />

        <View style={styles.scheduleCard}>
          <View style={styles.scheduleHeader}>
            <View style={styles.scheduleCopy}>
              <Text style={styles.scheduleKicker}>{t(language, 'planSet.scheduleLabel')}</Text>
              <Text style={styles.scheduleTitle}>{getScheduleModeLabel(scheduleMode, language)}</Text>
              <Text style={styles.scheduleBody}>{weekdaySummary}</Text>
            </View>
            <EntryBadge
              label={t(language, scheduleMode === 'app_managed' ? 'planSet.managed' : 'planSet.selfManaged')}
            />
          </View>

          <View style={styles.scheduleToggleRow}>
            <Pressable
              onPress={() => onScheduleModeChange('app_managed')}
              style={[styles.scheduleToggle, scheduleMode === 'app_managed' && styles.scheduleToggleActive]}
            >
              <Text style={[styles.scheduleToggleTitle, scheduleMode === 'app_managed' && styles.scheduleToggleTitleActive]}>
                {t(language, 'planSet.gainerManages')}
              </Text>
              <Text style={[styles.scheduleToggleMeta, scheduleMode === 'app_managed' && styles.scheduleToggleMetaActive]}>
                {t(language, 'planSet.appPlaces')}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => onScheduleModeChange('self_managed')}
              style={[styles.scheduleToggle, scheduleMode === 'self_managed' && styles.scheduleToggleActive]}
            >
              <Text style={[styles.scheduleToggleTitle, scheduleMode === 'self_managed' && styles.scheduleToggleTitleActive]}>
                {t(language, 'planSet.iManage')}
              </Text>
              <Text style={[styles.scheduleToggleMeta, scheduleMode === 'self_managed' && styles.scheduleToggleMetaActive]}>
                {t(language, 'planSet.youChoose')}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Automated progression is Pro (user decision 2026-07-28). Locked,
            the row still shows the stored choice but "On" routes to the
            premium screen instead of pretending the toggle does something. */}
        <View style={styles.autoProgressionHead}>
          <SectionLabel label={t(language, 'planSet.autoProgression')} />
          {proUnlocked ? null : (
            <View style={styles.autoProgressionProPill}>
              <Text style={styles.autoProgressionProPillText}>PRO</Text>
            </View>
          )}
        </View>

        <View style={styles.scheduleToggleRow}>
          <Pressable
            onPress={() => (proUnlocked ? onAutomatedProgressionChange?.(true) : onOpenPremium())}
            style={[styles.scheduleToggle, preferences.automatedProgressionEnabled && styles.scheduleToggleActive]}
          >
            <Text
              style={[styles.scheduleToggleTitle, preferences.automatedProgressionEnabled && styles.scheduleToggleTitleActive]}
            >
              {t(language, 'planSet.on')}
            </Text>
            <Text
              style={[styles.scheduleToggleMeta, preferences.automatedProgressionEnabled && styles.scheduleToggleMetaActive]}
            >
              {t(language, 'planSet.autoOn')}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => onAutomatedProgressionChange?.(false)}
            style={[styles.scheduleToggle, !preferences.automatedProgressionEnabled && styles.scheduleToggleActive]}
          >
            <Text
              style={[styles.scheduleToggleTitle, !preferences.automatedProgressionEnabled && styles.scheduleToggleTitleActive]}
            >
              {t(language, 'planSet.off')}
            </Text>
            <Text
              style={[styles.scheduleToggleMeta, !preferences.automatedProgressionEnabled && styles.scheduleToggleMetaActive]}
            >
              {t(language, 'planSet.autoOff')}
            </Text>
          </Pressable>
        </View>

        <SectionLabel label={t(language, 'planSet.smarterLayers')} />

        <View style={styles.entryGrid}>
          <TailoringEntry
            kicker={t(language, 'planSet.adaptive')}
            title={t(language, proUnlocked ? 'planSet.previewOn' : 'planSet.premium')}
            body={t(language, 'planSet.adaptiveBody')}
            badgeLabel={t(language, proUnlocked ? 'planSet.liveNow' : 'planSet.locked')}
            glyph={<SparkGlyph />}
            onPress={onOpenPremium}
          />

          <TailoringEntry
            kicker={t(language, 'planSet.recovery')}
            title={t(language, 'planSet.recovery')}
            body={t(language, 'planSet.recoveryBody')}
            badgeLabel={t(language, 'premium.soonCell')}
            glyph={<MoonGlyph />}
            onPress={onOpenPremium}
          />
        </View>

        <SectionLabel label={t(language, 'planSet.useThisPlan')} />

        <View style={styles.actionGrid}>
          {onOpenWeek ? (
            <Pressable onPress={onOpenWeek} style={styles.actionCard}>
              <Text style={styles.actionKicker}>{t(language, 'planSet.week')}</Text>
              <Text style={styles.actionTitle}>{t(language, 'planSet.seeWeek')}</Text>
              <Text style={styles.actionBody}>{t(language, 'planSet.seeWeekBody')}</Text>
            </Pressable>
          ) : null}

          {onOpenProgram ? (
            <Pressable onPress={onOpenProgram} style={styles.actionCard}>
              <Text style={styles.actionKicker}>{t(language, 'planSet.program')}</Text>
              <Text style={styles.actionTitle}>{t(language, 'planSet.fullPlan')}</Text>
              <Text style={styles.actionBody}>{t(language, 'planSet.fullPlanBody')}</Text>
            </Pressable>
          ) : null}

          {onAskAiCoach ? (
            <Pressable onPress={onAskAiCoach} style={styles.actionCard}>
              <Text style={styles.actionKicker}>GAINER AI</Text>
              <Text style={styles.actionTitle}>{t(language, 'planSet.askWhy')}</Text>
              <Text style={styles.actionBody}>{t(language, 'planSet.askWhyBody')}</Text>
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
  autoProgressionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  autoProgressionProPill: {
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderRadius: 999,
    backgroundColor: HG.purpleLight,
    marginBottom: 8,
  },
  autoProgressionProPillText: {
    color: HG.purpleDark,
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.6,
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
