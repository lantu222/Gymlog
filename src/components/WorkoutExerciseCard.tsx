import React from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { buildProgressionSuggestion, getBestComparableWorkingSet } from '../lib/workoutIntelligence';
import { formatRepRange, formatWeight, formatWeightInputValue } from '../lib/format';
import { colors, radii, spacing } from '../theme';
import { ExerciseLog } from '../types/models';
import { WorkoutExerciseInstance, WorkoutSetInstance, WorkoutSlotHistoryEntry } from '../features/workout/workoutTypes';
import { UnitPreference } from '../types/models';
import { WorkoutSetRow } from './WorkoutSetRow';

interface WorkoutExerciseCardProps {
  exercise: WorkoutExerciseInstance;
  previousEntries?: WorkoutSlotHistoryEntry[];
  unitPreference: UnitPreference;
  activeSetIndex: number;
  isActiveExercise: boolean;
  onLayout?: (event: LayoutChangeEvent) => void;
  onActivateExercise: () => void;
  onActivateRow: (rowIndex: number) => void;
  onWeightChange: (rowIndex: number, value: string) => void;
  onRepsChange: (rowIndex: number, value: string) => void;
  onCompleteRow: (rowIndex: number) => void;
  onUndoRow: (rowIndex: number) => void;
  onRepeatLastSet: (rowIndex: number) => void;
  onAddSet: () => void;
  bindWeightInput: (rowIndex: number, input: TextInput | null) => void;
  bindRepsInput: (rowIndex: number, input: TextInput | null) => void;
  onWeightSubmit: (rowIndex: number) => void;
  onRepsSubmit: (rowIndex: number) => void;
}

function toComparableLog(entry?: WorkoutSlotHistoryEntry | null): Pick<ExerciseLog, 'weight' | 'repsPerSet' | 'sets' | 'skipped'> | null {
  if (!entry || entry.skipped) {
    return null;
  }

  return {
    weight: entry.sets[0]?.loadKg ?? 0,
    repsPerSet: entry.sets.map((set) => set.reps),
    sets: entry.sets.map((set) => ({
      orderIndex: set.setIndex,
      weight: set.loadKg,
      reps: set.reps,
      kind: 'working' as const,
      outcome: 'completed' as const,
    })),
    skipped: entry.skipped,
  };
}

function formatBestSetLabel(set: ReturnType<typeof getBestComparableWorkingSet>, unitPreference: UnitPreference) {
  if (!set) {
    return null;
  }

  return `${formatWeight(set.weight, unitPreference)} x ${set.reps}`;
}

function formatSuggestedTarget(
  progressionSuggestion: NonNullable<ReturnType<typeof buildProgressionSuggestion>>,
  trackingMode: WorkoutExerciseInstance['trackingMode'],
  unitPreference: UnitPreference,
) {
  const nextReps = formatRepRange(progressionSuggestion.targetRepsMin, progressionSuggestion.targetRepsMax);
  if (trackingMode === 'bodyweight') {
    return nextReps;
  }
  return `${formatWeight(progressionSuggestion.targetWeightKg, unitPreference)} x ${nextReps}`;
}

function getDisplayLoadValue(set: WorkoutSetInstance, unitPreference: UnitPreference) {
  if (set.status === 'completed') {
    return formatWeightInputValue(set.actualLoadKg, unitPreference);
  }

  return set.draftLoadText;
}

function getDisplayRepsValue(set: WorkoutSetInstance) {
  if (set.status === 'completed' && typeof set.actualReps === 'number') {
    return `${set.actualReps}`;
  }

  return set.draftRepsText;
}

function getRepeatPreview(exercise: WorkoutExerciseInstance, rowIndex: number, unitPreference: UnitPreference) {
  if (rowIndex <= 0) {
    return null;
  }

  const source = [...exercise.sets]
    .filter((set) => set.setIndex < rowIndex)
    .reverse()
    .find((set) => set.status === 'completed' && typeof set.actualReps === 'number');

  if (!source) {
    return null;
  }

  if (exercise.trackingMode === 'bodyweight') {
    return `Repeat ${source.actualReps} reps`;
  }

  return `Repeat ${formatWeight(source.actualLoadKg ?? 0, unitPreference)} x ${source.actualReps}`;
}

function getLatestCompletedSetEffort(exercise: WorkoutExerciseInstance, activeSetIndex: number) {
  const previousCompletedSet = [...exercise.sets]
    .filter((set) => set.status === 'completed' && set.setIndex < activeSetIndex)
    .sort((left, right) => right.setIndex - left.setIndex)[0];

  return previousCompletedSet?.effort ?? null;
}

function getEffortHelperText(effort: WorkoutSetInstance['effort']) {
  if (effort === 'easy') {
    return 'Last set felt easy. Keep the line clean.';
  }

  if (effort === 'good') {
    return 'Last set felt good. Stay on this line.';
  }

  if (effort === 'hard') {
    return 'Last set felt hard. Keep this one tidy.';
  }

  return null;
}

export function WorkoutExerciseCard({
  exercise,
  previousEntries = [],
  unitPreference,
  activeSetIndex,
  isActiveExercise,
  onLayout,
  onActivateExercise,
  onActivateRow,
  onWeightChange,
  onRepsChange,
  onCompleteRow,
  onUndoRow,
  onRepeatLastSet,
  onAddSet,
  bindWeightInput,
  bindRepsInput,
  onWeightSubmit,
  onRepsSubmit,
}: WorkoutExerciseCardProps) {
  const latestPreviousLog = toComparableLog(previousEntries[0]);
  const previousSessionLog = toComparableLog(previousEntries[1]);
  const previousBestSet = getBestComparableWorkingSet(latestPreviousLog);
  const previousBestLabel = formatBestSetLabel(previousBestSet, unitPreference);
  const progressionSuggestion = buildProgressionSuggestion(
    [latestPreviousLog, previousSessionLog],
    exercise.sets[0]?.plannedRepsMin ?? 0,
    exercise.sets[0]?.plannedRepsMax ?? 0,
    unitPreference,
  );
  const activeSet = exercise.sets[activeSetIndex];
  const activeSetHasValues = Boolean(activeSet?.draftLoadText.trim() || activeSet?.draftRepsText.trim());
  const notePreview = exercise.notes?.trim() ?? '';
  const latestSetEffort = getLatestCompletedSetEffort(exercise, activeSetIndex);
  const effortHelperText = getEffortHelperText(latestSetEffort);
  const activeStepLabel =
    isActiveExercise && activeSet
      ? activeSet.status === 'completed'
        ? `Review set ${activeSetIndex + 1}`
        : `Set ${Math.min(activeSetIndex + 1, exercise.sets.length)} of ${exercise.sets.length}`
      : null;

  const helperText = isActiveExercise
    ? effortHelperText && activeSet?.status === 'pending' && !activeSetHasValues
      ? effortHelperText
      : progressionSuggestion && activeSet?.status === 'pending' && !activeSetHasValues
        ? `Target ${formatSuggestedTarget(progressionSuggestion, exercise.trackingMode, unitPreference)}`
        : `Set ${Math.min(activeSetIndex + 1, exercise.sets.length)}/${exercise.sets.length}`
    : null;

  return (
    <View onLayout={onLayout} style={[styles.card, isActiveExercise && styles.cardActive]}>
      {isActiveExercise ? <View style={styles.cardAccent} /> : null}
      {isActiveExercise ? <View style={styles.cardGlowBlue} /> : null}
      {isActiveExercise ? <View style={styles.cardGlowRose} /> : null}
      {isActiveExercise ? <View style={styles.cardGlowOrange} /> : null}

      <Pressable onPress={onActivateExercise} style={styles.header}>
        <View style={styles.headerCopy}>
          <View style={styles.headerTopRow}>
            <Text style={styles.name} numberOfLines={1}>{exercise.exerciseName}</Text>
            {isActiveExercise ? (
              <View style={styles.activeChip}>
                <Text style={styles.activeChipText}>Active</Text>
              </View>
            ) : null}
          </View>
          {previousBestLabel ? <Text style={styles.contextText} numberOfLines={1}>Best {previousBestLabel}</Text> : null}
          {!isActiveExercise && helperText ? (
            <Text style={[styles.helperText, isActiveExercise && styles.helperTextActive]} numberOfLines={1}>
              {helperText}
            </Text>
          ) : null}
          {notePreview ? (
            <View style={styles.noteBox}>
              <Text style={styles.noteText} numberOfLines={2}>Note: {notePreview}</Text>
            </View>
          ) : null}
        </View>
      </Pressable>

      {isActiveExercise ? (
        <>
          <View style={styles.activeGuideRow}>
            <View style={styles.activeGuideBadge}>
              <Text style={styles.activeGuideBadgeText}>Now</Text>
            </View>
            <View style={styles.activeGuideCopy}>
              {activeStepLabel ? <Text style={styles.activeGuideTitle}>{activeStepLabel}</Text> : null}
              {helperText ? <Text style={styles.activeGuideBody}>{helperText}</Text> : null}
            </View>
          </View>

          <View style={styles.rows}>
            {exercise.sets.map((set, rowIndex) => {
              const weightValue = getDisplayLoadValue(set, unitPreference);
              const repsValue = getDisplayRepsValue(set);
              const repeatPreview = getRepeatPreview(exercise, rowIndex, unitPreference);

              return (
                <WorkoutSetRow
                  key={`${exercise.slotId}:${set.setIndex}`}
                  setNumber={rowIndex + 1}
                  trackingMode={exercise.trackingMode}
                  weightValue={weightValue}
                  repsValue={repsValue}
                  weightPlaceholder={
                    exercise.trackingMode === 'bodyweight' ? '' : formatWeightInputValue(set.plannedLoadKg, unitPreference)
                  }
                  repsPlaceholder={`${set.plannedRepsMin}-${set.plannedRepsMax}`}
                  unitPreference={unitPreference}
                  active={isActiveExercise && activeSetIndex === rowIndex && set.status === 'pending'}
                  completed={set.status === 'completed'}
                  future={isActiveExercise && rowIndex > activeSetIndex && set.status === 'pending'}
                  effort={set.effort ?? null}
                  canRepeatLastSet={Boolean(
                    isActiveExercise &&
                      activeSetIndex === rowIndex &&
                      repeatPreview &&
                      !set.draftLoadText &&
                      !set.draftRepsText,
                  )}
                  repeatLastLabel={repeatPreview}
                  onActivate={() => onActivateRow(rowIndex)}
                  onWeightChange={(value) => onWeightChange(rowIndex, value)}
                  onRepsChange={(value) => onRepsChange(rowIndex, value)}
                  onComplete={() => (set.status === 'completed' ? onUndoRow(rowIndex) : onCompleteRow(rowIndex))}
                  onRepeatLastSet={() => onRepeatLastSet(rowIndex)}
                  bindWeightInput={(input) => bindWeightInput(rowIndex, input)}
                  bindRepsInput={(input) => bindRepsInput(rowIndex, input)}
                  onWeightSubmit={() => onWeightSubmit(rowIndex)}
                  onRepsSubmit={() => onRepsSubmit(rowIndex)}
                />
              );
            })}
          </View>

          <View style={styles.footerRow}>
            <Pressable onPress={onAddSet} style={styles.addSetButton}>
              <Text style={styles.addSetText}>Add set</Text>
            </Pressable>
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(18, 24, 33, 0.84)',
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardActive: {
    borderColor: 'rgba(85, 138, 189, 0.36)',
    backgroundColor: colors.cardElevated,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
    elevation: 8,
  },
  cardAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: colors.accent,
  },
  cardGlowBlue: {
    position: 'absolute',
    top: -36,
    right: -18,
    width: 132,
    height: 132,
    borderRadius: 132,
    backgroundColor: 'rgba(85, 138, 189, 0.14)',
  },
  cardGlowRose: {
    position: 'absolute',
    bottom: -50,
    left: -20,
    width: 120,
    height: 120,
    borderRadius: 120,
    backgroundColor: 'rgba(191, 74, 105, 0.10)',
  },
  cardGlowOrange: {
    position: 'absolute',
    bottom: -44,
    right: -16,
    width: 110,
    height: 110,
    borderRadius: 110,
    backgroundColor: 'rgba(162, 54, 18, 0.12)',
  },
  header: {
    gap: 6,
  },
  headerCopy: {
    gap: 4,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  activeChip: {
    minHeight: 24,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(85, 138, 189, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(85, 138, 189, 0.30)',
  },
  activeChipText: {
    color: '#7FB3E6',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  contextText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  helperText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  helperTextActive: {
    color: '#A7B7C7',
  },
  activeGuideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(85, 138, 189, 0.26)',
    backgroundColor: 'rgba(15, 22, 30, 0.76)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  activeGuideBadge: {
    minWidth: 52,
    minHeight: 28,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(85, 138, 189, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(85, 138, 189, 0.34)',
  },
  activeGuideBadgeText: {
    color: '#8FC1F2',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  activeGuideCopy: {
    flex: 1,
    gap: 2,
  },
  activeGuideTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '900',
  },
  activeGuideBody: {
    color: '#A7B7C7',
    fontSize: 11,
    fontWeight: '700',
  },
  noteBox: {
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: 'rgba(191, 74, 105, 0.22)',
    backgroundColor: 'rgba(191, 74, 105, 0.12)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  noteText: {
    color: colors.textPrimary,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
  },
  rows: {
    gap: spacing.sm,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    paddingTop: 2,
  },
  addSetButton: {
    minHeight: 34,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(85, 138, 189, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(85, 138, 189, 0.28)',
  },
  addSetText: {
    color: '#7FB3E6',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
});
