import React from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { buildProgressionSuggestion, getBestComparableWorkingSet } from '../lib/workoutIntelligence';
import { formatRepRange, formatWeight, formatWeightInputValue } from '../lib/format';
import { radii, spacing, typography } from '../theme';
import { ExerciseLog } from '../types/models';
import { WorkoutExerciseInstance, WorkoutSetInstance, WorkoutSlotHistoryEntry } from '../features/workout/workoutTypes';
import { UnitPreference } from '../types/models';
import { WorkoutSetRow } from './WorkoutSetRow';
import { canCompleteWorkoutSet } from '../lib/workoutValidation';

const LOGGING_BACKGROUND = '#F7F3FF';
const LOGGING_PURPLE = '#7C3AED';
const VALUE_CELL_WIDTH = 96;

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
  const exerciseCompleted = exercise.status === 'completed' || exercise.status === 'skipped';
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
  const activeSetLoadValue = activeSet ? getDisplayLoadValue(activeSet, unitPreference) : '';
  const activeSetRepsValue = activeSet ? getDisplayRepsValue(activeSet) : '';
  const activeSetCanLog = activeSet
    ? activeSet.status !== 'completed' && canCompleteWorkoutSet(exercise.trackingMode, activeSetLoadValue, activeSetRepsValue)
    : false;
  const notePreview = exercise.notes?.trim() ?? '';
  const latestSetEffort = getLatestCompletedSetEffort(exercise, activeSetIndex);
  const effortHelperText = getEffortHelperText(latestSetEffort);
  const activeStepLabel =
    isActiveExercise && activeSet
      ? exerciseCompleted
        ? 'Done'
        : activeSet.status === 'completed'
        ? `Review set ${activeSetIndex + 1}`
        : `Set ${Math.min(activeSetIndex + 1, exercise.sets.length)} / ${exercise.sets.length}`
      : null;
  const activeTargetText =
    isActiveExercise && activeSet
      ? `Target ${activeSet.plannedRepsMin}-${activeSet.plannedRepsMax} reps${
          previousBestLabel ? ` - last time ${previousBestLabel}` : ''
        }`
      : null;

  const helperText = isActiveExercise
    ? effortHelperText && activeSet?.status === 'pending' && !activeSetHasValues
      ? effortHelperText
      : progressionSuggestion && activeSet?.status === 'pending' && !activeSetHasValues
        ? `Target ${formatSuggestedTarget(progressionSuggestion, exercise.trackingMode, unitPreference)}`
        : `Set ${Math.min(activeSetIndex + 1, exercise.sets.length)}/${exercise.sets.length}`
    : null;

  return (
    <View onLayout={onLayout} style={[styles.card, isActiveExercise && styles.cardActive, exerciseCompleted && styles.cardCompleted]}>
      <Pressable onPress={onActivateExercise} style={styles.header}>
        <View style={styles.headerCopy}>
          <View style={styles.headerTopRow}>
            <Text style={styles.name} numberOfLines={1}>{exercise.exerciseName}</Text>
            {isActiveExercise ? (
              <View style={styles.activeChip}>
                <Text style={styles.activeChipText}>{activeStepLabel}</Text>
              </View>
            ) : null}
          </View>
          {previousBestLabel && !isActiveExercise ? <Text style={styles.contextText} numberOfLines={1}>Best {previousBestLabel}</Text> : null}
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
          {activeTargetText ? (
            <Text style={styles.activeTargetLine} numberOfLines={1}>
              {activeTargetText}
            </Text>
          ) : null}

          <View style={styles.tableHeader}>
            <Text style={styles.tableSetHeader}>SET</Text>
            <Text style={styles.tableCellHeader}>KG</Text>
            <Text style={styles.tableCellHeader}>REPS</Text>
            <Text style={styles.tableCheckHeader}>CHECK</Text>
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
              <Text style={styles.addSetPlus}>+</Text>
              <Text style={styles.addSetText}>Add set</Text>
            </Pressable>
            <Pressable
              onPress={() => activeSet ? onCompleteRow(activeSetIndex) : undefined}
              disabled={!activeSetCanLog}
              style={[styles.logSetButton, !activeSetCanLog && styles.logSetButtonDisabled]}
            >
              <Text style={styles.logSetText}>
                Log set {Math.min(activeSetIndex + 1, exercise.sets.length)}
              </Text>
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
    borderColor: 'rgba(124, 58, 237, 0.16)',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: 6,
    shadowColor: LOGGING_PURPLE,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 5,
  },
  cardActive: {
    borderColor: 'rgba(124, 58, 237, 0.18)',
    backgroundColor: '#FFFFFF',
  },
  cardCompleted: {
    borderColor: 'rgba(124, 58, 237, 0.36)',
    backgroundColor: '#FBF8FF',
  },
  header: {
    gap: 2,
  },
  headerCopy: {
    gap: 2,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  name: {
    fontFamily: typography.fontFamily,
    flex: 1,
    color: '#111827',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '900',
  },
  activeChip: {
    minHeight: 28,
    paddingHorizontal: 12,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3ECFF',
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.18)',
  },
  activeChipText: {
    fontFamily: typography.fontFamily,
    color: LOGGING_PURPLE,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  contextText: {
    fontFamily: typography.fontFamily,
    color: '#667085',
    fontSize: 12,
    fontWeight: '700',
  },
  helperText: {
    fontFamily: typography.fontFamily,
    color: '#667085',
    fontSize: 11,
    fontWeight: '700',
  },
  helperTextActive: {
    color: '#667085',
  },
  activeGuideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.14)',
    backgroundColor: LOGGING_BACKGROUND,
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
    backgroundColor: '#F3ECFF',
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.20)',
  },
  activeGuideBadgeText: {
    fontFamily: typography.fontFamily,
    color: LOGGING_PURPLE,
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
    fontFamily: typography.fontFamily,
    color: '#111827',
    fontSize: 14,
    fontWeight: '900',
  },
  activeGuideBody: {
    fontFamily: typography.fontFamily,
    color: '#667085',
    fontSize: 11,
    fontWeight: '700',
  },
  activeTargetLine: {
    fontFamily: typography.fontFamily,
    color: '#667085',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
  },
  noteBox: {
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.16)',
    backgroundColor: '#F3ECFF',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  noteText: {
    fontFamily: typography.fontFamily,
    color: '#111827',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
  },
  rows: {
    gap: 11,
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    paddingTop: 4,
  },
  tableSetHeader: {
    fontFamily: typography.fontFamily,
    width: 30,
    color: '#667085',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  tableCellHeader: {
    fontFamily: typography.fontFamily,
    width: VALUE_CELL_WIDTH,
    color: '#667085',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  tableCheckHeader: {
    fontFamily: typography.fontFamily,
    width: 38,
    color: '#667085',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  footerRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingTop: 5,
  },
  addSetButton: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
    backgroundColor: '#F3ECFF',
  },
  addSetPlus: {
    fontFamily: typography.fontFamily,
    color: LOGGING_PURPLE,
    fontSize: 26,
    lineHeight: 28,
    fontWeight: '900',
  },
  addSetText: {
    fontFamily: typography.fontFamily,
    color: LOGGING_PURPLE,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  logSetButton: {
    flex: 1.65,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: LOGGING_PURPLE,
  },
  logSetButtonDisabled: {
    opacity: 0.54,
  },
  logSetText: {
    fontFamily: typography.fontFamily,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
});
