import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { NewProgramSheet } from '../components/NewProgramSheet';
import { ChevronIcon, SectionLabel, settingsStyles } from '../components/SettingsUi';
import { CsvLibraryEntry } from '../lib/csvProgramImport';
import { HG } from '../lightTheme';
import { layout } from '../theme';
import type { SetupWeekday, WorkoutTemplateDraft } from '../types/models';

const WEEKDAY_CHIPS: Array<{ day: SetupWeekday; label: string }> = [
  { day: 'mon', label: 'Mo' },
  { day: 'tue', label: 'Tu' },
  { day: 'wed', label: 'We' },
  { day: 'thu', label: 'Th' },
  { day: 'fri', label: 'Fr' },
  { day: 'sat', label: 'Sa' },
  { day: 'sun', label: 'Su' },
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
  onBack: () => void;
  onChangeTrainingDays: (days: SetupWeekday[]) => void;
  /** Present only for custom plans — ready programs are immutable. */
  onEditCustomPlan?: () => void;
  onAiAssisted: () => void;
  onBuildYourself: () => void;
  onImportProgram: (draft: WorkoutTemplateDraft) => Promise<void> | void;
}

function SessionTile({ title }: { title: string }) {
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
  onBack,
  onChangeTrainingDays,
  onEditCustomPlan,
  onAiAssisted,
  onBuildYourself,
  onImportProgram,
}: TrainingPlanScreenProps) {
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

  const scheduleCaption = editingSchedule
    ? draftValid || draftDays.length === 0
      ? `${draftDays.length} training days · ${7 - draftDays.length} rest`
      : `Pick ${MIN_TRAINING_DAYS}–${MAX_TRAINING_DAYS} training days`
    : trainingDays.length > 0
      ? `${trainingDays.length} training days · ${7 - trainingDays.length} rest`
      : 'No training days set — tap Edit to pick them.';

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={onBack}
          style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.7 }]}
        >
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path d="M15 5l-7 7 7 7" stroke={HG.ink} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
        <Text style={styles.headerTitle}>Training plan</Text>
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
                  <Text style={styles.activePillText}>ACTIVE</Text>
                </View>
                {planDaysPerWeek ? <Text style={styles.activeMeta}>{planDaysPerWeek}× / week</Text> : null}
              </View>
              <Text style={styles.activeName}>{planName}</Text>
              {planFocusCaption ? <Text style={styles.activeCaption}>{planFocusCaption}</Text> : null}
              {planExerciseCount ? (
                <View style={styles.badgeRow}>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{planExerciseCount} exercises</Text>
                  </View>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{planType === 'ready' ? 'Ready program' : 'Custom plan'}</Text>
                  </View>
                </View>
              ) : null}
            </View>

            {/* SCHEDULE */}
            <View style={settingsStyles.section}>
              <SectionLabel
                label="SCHEDULE"
                actionLabel={editingSchedule ? (draftDirty && !draftValid ? undefined : 'Done') : 'Edit'}
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
                          {chip.label}
                        </Text>
                      </View>
                    );

                    return editingSchedule ? (
                      <Pressable
                        key={chip.day}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={`Training day ${chip.label}`}
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
              <SectionLabel label="SESSIONS" />
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
                              <Text style={styles.nextBadgeText}>UP NEXT</Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={styles.sessionMeta}>
                          {session.exerciseCount} exercises · {session.totalSets} sets
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
                <Text style={styles.readOnlyNote}>
                  Ready program sessions are fixed. Build a custom plan to edit sessions freely.
                </Text>
              ) : null}
            </View>
          </>
        ) : (
          <View style={styles.emptyBlock}>
            <Text style={styles.emptyTitle}>No active plan</Text>
            <Text style={styles.emptyText}>Create a plan and it shows up here with its schedule and sessions.</Text>
          </View>
        )}

        {/* CREATE */}
        <Pressable
          accessibilityRole="button"
          onPress={() => setCreateOpen(true)}
          style={({ pressed }) => [styles.createButton, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.createButtonText}>Create new plan</Text>
        </Pressable>
        <Text style={styles.footNote}>One active plan at a time. Edits apply from your next session.</Text>
      </ScrollView>

      <NewProgramSheet
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

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: HG.bg,
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
    backgroundColor: HG.surface,
    borderWidth: 1,
    borderColor: HG.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: HG.ink,
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
    backgroundColor: HG.surface,
    borderWidth: 2,
    borderColor: HG.purple,
    borderRadius: 18,
    padding: 16,
    marginTop: 8,
    shadowColor: HG.purple,
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
    color: HG.muted,
    fontSize: 12.5,
    fontWeight: '700',
  },
  activeName: {
    color: HG.ink,
    fontSize: 21,
    fontWeight: '800',
    marginTop: 10,
  },
  activeCaption: {
    color: HG.muted,
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
    backgroundColor: HG.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: HG.purpleDark,
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
    backgroundColor: HG.purpleLight,
  },
  weekdayChipEditing: {
    borderWidth: 1.5,
    borderColor: HG.border,
  },
  weekdayChipText: {
    color: HG.faint,
    fontSize: 12.5,
    fontWeight: '800',
  },
  weekdayChipTextActive: {
    color: HG.purpleDark,
  },
  scheduleCaption: {
    color: HG.muted,
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
    borderBottomColor: HG.border,
  },
  sessionRowLast: {
    borderBottomWidth: 0,
  },
  sessionTile: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: HG.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionTileText: {
    color: HG.purpleDark,
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
    color: HG.ink,
    fontSize: 14.5,
    fontWeight: '800',
  },
  nextBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: HG.purpleLight,
  },
  nextBadgeText: {
    color: HG.purpleDark,
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  sessionMeta: {
    color: HG.muted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  readOnlyNote: {
    color: HG.faint,
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
    color: HG.ink,
    fontSize: 16,
    fontWeight: '800',
  },
  emptyText: {
    color: HG.muted,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 20,
  },
  createButton: {
    height: 50,
    borderRadius: 15,
    backgroundColor: HG.purple,
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
    color: HG.faint,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 10,
  },
});
