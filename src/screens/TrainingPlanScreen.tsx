import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { NewProgramSheet } from '../components/NewProgramSheet';
import { ChevronIcon, SectionLabel, makeSettingsStyles } from '../components/SettingsUi';
import { CsvLibraryEntry } from '../lib/csvProgramImport';
import { I18nKey, t } from '../lib/i18n';
import { Theme, useTheme, useThemedStyles } from '../theming';
import { layout } from '../theme';
import type { AppLanguage, SetupWeekday, WorkoutTemplateDraft } from '../types/models';

const WEEKDAY_CHIPS: Array<{ day: SetupWeekday; labelKey: I18nKey }> = [
  { day: 'mon', labelKey: 'weekday.mon' },
  { day: 'tue', labelKey: 'weekday.tue' },
  { day: 'wed', labelKey: 'weekday.wed' },
  { day: 'thu', labelKey: 'weekday.thu' },
  { day: 'fri', labelKey: 'weekday.fri' },
  { day: 'sat', labelKey: 'weekday.sat' },
  { day: 'sun', labelKey: 'weekday.sun' },
];

/** Same bounds the onboarding day question enforces. */
const MIN_TRAINING_DAYS = 2;
const MAX_TRAINING_DAYS = 6;

export interface TrainingPlanSessionItem {
  id: string;
  title: string;
  exerciseCount: number;
  totalSets: number;
  isNext: boolean;
}

interface TrainingPlanScreenProps {
  planName: string | null;
  planType: 'ready' | 'custom' | null;
  planDaysPerWeek: number | null;
  planExerciseCount: number | null;
  planFocusCaption: string | null;
  sessions: TrainingPlanSessionItem[];
  trainingDays: SetupWeekday[];
  exerciseLibrary: CsvLibraryEntry[];
  language?: AppLanguage;
  onBack: () => void;
  onChangeTrainingDays: (days: SetupWeekday[]) => void;
  /** Present only for custom plans — ready programs are immutable. */
  onEditCustomPlan?: () => void;
  /** Equipment, swaps and progression live one level deeper. */
  onOpenPlanSettings: () => void;
  onAiAssisted: () => void;
  onBuildYourself: () => void;
  onImportProgram: (draft: WorkoutTemplateDraft) => Promise<void> | void;
}

function SessionTile({ title }: { title: string }) {
  const styles = useThemedStyles(makeStyles);

  const letter = title.trim().charAt(0).toUpperCase() || 'S';
  return (
    <View style={styles.sessionTile}>
      <Text style={styles.sessionTileText}>{letter}</Text>
    </View>
  );
}

/**
 * Screen 2 of the profile suite, V1 scope: view the active plan, edit the
 * weekly schedule (the single source of truth for training days), and start a
 * new plan. Session editing goes through the existing template editor and is
 * custom-only — ready programs stay immutable.
 */
export function TrainingPlanScreen({
  planName,
  planType,
  planDaysPerWeek,
  planExerciseCount,
  planFocusCaption,
  sessions,
  trainingDays,
  exerciseLibrary,
  language = 'en',
  onBack,
  onChangeTrainingDays,
  onEditCustomPlan,
  onOpenPlanSettings,
  onAiAssisted,
  onBuildYourself,
  onImportProgram,
}: TrainingPlanScreenProps) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const settingsStyles = useThemedStyles(makeSettingsStyles);
  const [editingSchedule, setEditingSchedule] = useState(false);
  const [draftDays, setDraftDays] = useState<SetupWeekday[]>(trainingDays);
  const [createOpen, setCreateOpen] = useState(false);

  const shownDays = editingSchedule ? draftDays : trainingDays;
  const draftValid = draftDays.length >= MIN_TRAINING_DAYS && draftDays.length <= MAX_TRAINING_DAYS;
  const draftDirty = [...draftDays].sort().join(',') !== [...trainingDays].sort().join(',');

  const startEditingSchedule = () => {
    setDraftDays(trainingDays);
    setEditingSchedule(true);
  };

  const finishEditingSchedule = () => {
    if (draftDirty) {
      if (!draftValid) {
        return; // Done stays disabled — the caption explains the 2–6 rule.
      }
      onChangeTrainingDays(draftDays);
    }
    setEditingSchedule(false);
  };

  const toggleDraftDay = (day: SetupWeekday) => {
    setDraftDays((current) =>
      current.includes(day) ? current.filter((item) => item !== day) : [...current, day],
    );
  };

  const dayCountCaption = (count: number) =>
    t(language, 'plan.dayCount', { days: count, rest: 7 - count });

  const scheduleCaption = editingSchedule
    ? draftValid || draftDays.length === 0
      ? dayCountCaption(draftDays.length)
      : t(language, 'plan.pickDays', { min: MIN_TRAINING_DAYS, max: MAX_TRAINING_DAYS })
    : trainingDays.length > 0
      ? dayCountCaption(trainingDays.length)
      : t(language, 'plan.noDays');

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(language, 'common.back')}
          onPress={onBack}
          style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.7 }]}
        >
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path d="M15 5l-7 7 7 7" stroke={theme.ink} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
        <Text style={styles.headerTitle}>{t(language, 'plan.title')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
        {planName ? (
          <>
            {/* ACTIVE PLAN */}
            <View style={styles.activeCard}>
              <View style={styles.activeTopRow}>
                <View style={styles.activePill}>
                  <View style={styles.activeDot} />
                  <Text style={styles.activePillText}>{t(language, 'plan.active')}</Text>
                </View>
                {planDaysPerWeek ? (
                  <Text style={styles.activeMeta}>
                    {t(language, 'plan.perWeek', { count: planDaysPerWeek })}
                  </Text>
                ) : null}
              </View>
              <Text style={styles.activeName}>{planName}</Text>
              {planFocusCaption ? <Text style={styles.activeCaption}>{planFocusCaption}</Text> : null}
              {planExerciseCount ? (
                <View style={styles.badgeRow}>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {t(language, 'plan.exerciseCount', { count: planExerciseCount })}
                    </Text>
                  </View>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {t(language, planType === 'ready' ? 'plan.readyProgram' : 'plan.customPlan')}
                    </Text>
                  </View>
                </View>
              ) : null}
            </View>

            {/* SCHEDULE */}
            <View style={settingsStyles.section}>
              <SectionLabel
                label={t(language, 'plan.schedule')}
                actionLabel={
                  editingSchedule
                    ? draftDirty && !draftValid
                      ? undefined
                      : t(language, 'plan.done')
                    : t(language, 'plan.edit')
                }
                onAction={editingSchedule ? finishEditingSchedule : startEditingSchedule}
              />
              <View style={[settingsStyles.card, styles.scheduleCard]}>
                <View style={styles.weekdayRow}>
                  {WEEKDAY_CHIPS.map((chip) => {
                    const active = shownDays.includes(chip.day);
                    const inner = (
                      <View
                        style={[
                          styles.weekdayChip,
                          active && styles.weekdayChipActive,
                          editingSchedule && styles.weekdayChipEditing,
                        ]}
                      >
                        <Text style={[styles.weekdayChipText, active && styles.weekdayChipTextActive]}>
                          {t(language, chip.labelKey)}
                        </Text>
                      </View>
                    );

                    return editingSchedule ? (
                      <Pressable
                        key={chip.day}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={t(language, 'plan.trainingDay', {
                          day: t(language, chip.labelKey),
                        })}
                        onPress={() => toggleDraftDay(chip.day)}
                        style={styles.weekdayCell}
                      >
                        {inner}
                      </Pressable>
                    ) : (
                      <View key={chip.day} style={styles.weekdayCell}>
                        {inner}
                      </View>
                    );
                  })}
                </View>
                <Text style={styles.scheduleCaption}>{scheduleCaption}</Text>
              </View>
            </View>

            {/* SESSIONS */}
            <View style={settingsStyles.section}>
              <SectionLabel label={t(language, 'plan.sessions')} />
              <View style={settingsStyles.card}>
                {sessions.map((session, index) => {
                  const row = (
                    <View
                      style={[styles.sessionRow, index === sessions.length - 1 && styles.sessionRowLast]}
                    >
                      <SessionTile title={session.title} />
                      <View style={styles.sessionCopy}>
                        <View style={styles.sessionTitleRow}>
                          <Text numberOfLines={1} style={styles.sessionTitle}>
                            {session.title}
                          </Text>
                          {session.isNext ? (
                            <View style={styles.nextBadge}>
                              <Text style={styles.nextBadgeText}>{t(language, 'plan.upNext')}</Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={styles.sessionMeta}>
                          {t(language, 'plan.sessionMeta', {
                            exercises: session.exerciseCount,
                            sets: session.totalSets,
                          })}
                        </Text>
                      </View>
                      {onEditCustomPlan ? <ChevronIcon /> : null}
                    </View>
                  );

                  return onEditCustomPlan ? (
                    <Pressable
                      key={session.id}
                      accessibilityRole="button"
                      onPress={onEditCustomPlan}
                      style={({ pressed }) => pressed && { opacity: 0.65 }}
                    >
                      {row}
                    </Pressable>
                  ) : (
                    <View key={session.id}>{row}</View>
                  );
                })}
              </View>
              {!onEditCustomPlan ? (
                <Text style={styles.readOnlyNote}>{t(language, 'plan.readOnlyNote')}</Text>
              ) : null}
            </View>

            {/* The one entry into equipment / swaps / progression — keeps every
                plan-related surface behind this single screen. */}
            <View style={settingsStyles.section}>
              <Pressable
                accessibilityRole="button"
                onPress={onOpenPlanSettings}
                style={({ pressed }) => [settingsStyles.card, styles.planSettingsRow, pressed && { opacity: 0.75 }]}
              >
                <View style={styles.planSettingsCopy}>
                  <Text style={styles.planSettingsTitle}>{t(language, 'plan.settings')}</Text>
                  <Text style={styles.planSettingsSub}>{t(language, 'plan.settingsSub')}</Text>
                </View>
                <ChevronIcon />
              </Pressable>
            </View>
          </>
        ) : (
          <View style={styles.emptyBlock}>
            <Text style={styles.emptyTitle}>{t(language, 'plan.emptyTitle')}</Text>
            <Text style={styles.emptyText}>{t(language, 'plan.emptyBody')}</Text>
          </View>
        )}

        {/* CREATE */}
        <Pressable
          accessibilityRole="button"
          onPress={() => setCreateOpen(true)}
          style={({ pressed }) => [styles.createButton, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.createButtonText}>{t(language, 'plan.createNew')}</Text>
        </Pressable>
        <Text style={styles.footNote}>{t(language, 'plan.footNote')}</Text>
      </ScrollView>

      <NewProgramSheet
        language={language}
        visible={createOpen}
        exerciseLibrary={exerciseLibrary}
        onClose={() => setCreateOpen(false)}
        onAiAssisted={() => {
          setCreateOpen(false);
          onAiAssisted();
        }}
        onBuildYourself={() => {
          setCreateOpen(false);
          onBuildYourself();
        }}
        onImportProgram={onImportProgram}
      />
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
    paddingHorizontal: 20,
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
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: theme.ink,
    fontSize: 17,
    fontWeight: '800',
  },
  headerSpacer: {
    width: 40,
  },
  body: {
    paddingHorizontal: 20,
    paddingBottom: layout.bottomTabBarReserve,
  },
  activeCard: {
    backgroundColor: theme.surface,
    borderWidth: 2,
    borderColor: theme.purple,
    borderRadius: 18,
    padding: 16,
    marginTop: 8,
    shadowColor: theme.purple,
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  activeTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#E4F6EA',
  },
  activeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#1FA64E',
  },
  activePillText: {
    color: '#157A3A',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  activeMeta: {
    color: theme.muted,
    fontSize: 12.5,
    fontWeight: '700',
  },
  activeName: {
    color: theme.ink,
    fontSize: 21,
    fontWeight: '800',
    marginTop: 10,
  },
  activeCaption: {
    color: theme.muted,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  badge: {
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: theme.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: theme.purpleDark,
    fontSize: 12,
    fontWeight: '800',
  },
  scheduleCard: {
    paddingVertical: 15,
  },
  weekdayRow: {
    flexDirection: 'row',
    gap: 6,
  },
  weekdayCell: {
    flex: 1,
  },
  weekdayChip: {
    height: 34,
    borderRadius: 10,
    backgroundColor: '#F1EDFA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekdayChipActive: {
    backgroundColor: theme.purpleLight,
  },
  weekdayChipEditing: {
    borderWidth: 1.5,
    borderColor: theme.border,
  },
  weekdayChipText: {
    color: theme.faint,
    fontSize: 12.5,
    fontWeight: '800',
  },
  weekdayChipTextActive: {
    color: theme.purpleDark,
  },
  scheduleCaption: {
    color: theme.muted,
    fontSize: 12.5,
    fontWeight: '600',
    marginTop: 12,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  sessionRowLast: {
    borderBottomWidth: 0,
  },
  sessionTile: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: theme.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionTileText: {
    color: theme.purpleDark,
    fontSize: 16,
    fontWeight: '800',
  },
  sessionCopy: {
    flex: 1,
    minWidth: 0,
  },
  sessionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sessionTitle: {
    flexShrink: 1,
    color: theme.ink,
    fontSize: 14.5,
    fontWeight: '800',
  },
  nextBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: theme.purpleLight,
  },
  nextBadgeText: {
    color: theme.purpleDark,
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  sessionMeta: {
    color: theme.muted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  readOnlyNote: {
    color: theme.faint,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
    paddingHorizontal: 2,
  },
  emptyBlock: {
    paddingVertical: 30,
    alignItems: 'center',
  },
  emptyTitle: {
    color: theme.ink,
    fontSize: 16,
    fontWeight: '800',
  },
  emptyText: {
    color: theme.muted,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 20,
  },
  planSettingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
  },
  planSettingsCopy: {
    flex: 1,
    minWidth: 0,
  },
  planSettingsTitle: {
    color: theme.ink,
    fontSize: 14.5,
    fontWeight: '800',
  },
  planSettingsSub: {
    color: theme.muted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  createButton: {
    height: 50,
    borderRadius: 15,
    backgroundColor: theme.purple,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  footNote: {
    color: theme.faint,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 10,
  },
});
