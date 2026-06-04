import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, radii, spacing } from '../theme';
import { UnitPreference } from '../types/models';
import { WorkoutSetEffort, WorkoutTrackingMode } from '../features/workout/workoutTypes';
import { canCompleteWorkoutSet, getWorkoutSetValidationMessage } from '../lib/workoutValidation';

const LOGGING_PURPLE = '#7C3AED';
const LOGGING_GREEN = '#16A34A';

interface WorkoutSetRowProps {
  setNumber: number;
  trackingMode: WorkoutTrackingMode;
  weightValue: string;
  repsValue: string;
  weightPlaceholder?: string;
  repsPlaceholder?: string;
  unitPreference: UnitPreference;
  active: boolean;
  completed: boolean;
  future?: boolean;
  effort?: WorkoutSetEffort | null;
  canRepeatLastSet: boolean;
  repeatLastLabel?: string | null;
  onActivate: () => void;
  onWeightChange: (value: string) => void;
  onRepsChange: (value: string) => void;
  onComplete: () => void;
  onRepeatLastSet: () => void;
  bindWeightInput: (input: TextInput | null) => void;
  bindRepsInput: (input: TextInput | null) => void;
  onWeightSubmit: () => void;
  onRepsSubmit: () => void;
}

function CompactValueCell({
  label,
  value,
  width,
  completed,
}: {
  label: string;
  value: string;
  width: number;
  completed?: boolean;
}) {
  return (
    <View style={[styles.valueCell, { width }, completed && styles.valueCellCompleted]}>
      <Text style={styles.valueLabel}>{label}</Text>
      <Text style={styles.valueText} numberOfLines={1}>{value}</Text>
    </View>
  );
}

export function WorkoutSetRow({
  setNumber,
  trackingMode,
  weightValue,
  repsValue,
  weightPlaceholder,
  repsPlaceholder,
  unitPreference,
  active,
  completed,
  future = false,
  effort,
  canRepeatLastSet,
  repeatLastLabel,
  onActivate,
  onWeightChange,
  onRepsChange,
  onComplete,
  onRepeatLastSet,
  bindWeightInput,
  bindRepsInput,
  onWeightSubmit,
  onRepsSubmit,
}: WorkoutSetRowProps) {
  const showLoadField = trackingMode !== 'bodyweight';
  const showEditableInputs = active && !completed;
  const showActionButton = completed || active;
  const readyToComplete = canCompleteWorkoutSet(trackingMode, weightValue, repsValue);
  const validationMessage = active && !completed
    ? getWorkoutSetValidationMessage(trackingMode, weightValue, repsValue)
    : null;
  const effortLabel = effort === 'easy' ? 'Easy' : effort === 'good' ? 'Good' : effort === 'hard' ? 'Hard' : null;

  return (
    <Pressable
      onPress={onActivate}
      style={[styles.row, active && styles.rowActive, completed && styles.rowCompleted, future && styles.rowFuture]}
    >
      <View style={styles.mainLine}>
        <View style={[styles.setBadge, active && styles.setBadgeActive, completed && styles.setBadgeCompleted]}>
          <Text style={[styles.setBadgeLabel, active && styles.setBadgeLabelActive]}>Set</Text>
          <Text style={styles.setBadgeValue}>{setNumber}</Text>
        </View>

        {showLoadField ? (
          showEditableInputs ? (
            <View style={[styles.inputWrap, styles.loadCell, styles.inputWrapActive]}>
              <TextInput
                ref={bindWeightInput}
                value={weightValue}
                onChangeText={onWeightChange}
                placeholder={weightPlaceholder || '0'}
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
                selectionColor={colors.accent}
                style={styles.input}
                returnKeyType="next"
                onSubmitEditing={onWeightSubmit}
                blurOnSubmit={false}
                selectTextOnFocus
              />
              <Text style={[styles.inputSuffix, styles.inputSuffixActive]}>{unitPreference}</Text>
            </View>
          ) : (
            <CompactValueCell
              label="Load"
              value={weightValue || weightPlaceholder || '--'}
              width={92}
              completed={completed}
            />
          )
        ) : (
          <CompactValueCell label="Load" value="Body" width={66} completed={completed} />
        )}

        {showEditableInputs ? (
          <View style={[styles.inputWrap, styles.repsCell, styles.inputWrapActive]}>
            <TextInput
              ref={bindRepsInput}
              value={repsValue}
              onChangeText={onRepsChange}
              placeholder={repsPlaceholder || '0'}
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              selectionColor={colors.accent}
              style={styles.input}
              returnKeyType="done"
              onSubmitEditing={onRepsSubmit}
              blurOnSubmit
              selectTextOnFocus
            />
            <Text style={[styles.inputSuffix, styles.inputSuffixActive]}>reps</Text>
          </View>
        ) : (
          <CompactValueCell label="Reps" value={repsValue || repsPlaceholder || '--'} width={76} completed={completed} />
        )}

        {showActionButton ? (
          <Pressable
            hitSlop={6}
            onPress={onComplete}
            disabled={!completed && !readyToComplete}
            style={[
              styles.doneButton,
              active && readyToComplete && styles.doneButtonReady,
              completed && styles.doneButtonCompleted,
              !completed && !readyToComplete && styles.doneButtonDisabled,
            ]}
          >
            <Text style={[styles.doneText, active && readyToComplete && styles.doneTextReady, completed && styles.doneTextCompleted]}>
              {completed ? 'Undo' : 'Done'}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {active && !completed ? (
        <View style={styles.activeHintRow}>
          <Text style={styles.activeHintText}>Fill the fields, then tap Done.</Text>
        </View>
      ) : null}

      {active && !completed && canRepeatLastSet ? (
        <View style={styles.repeatRow}>
          <Pressable onPress={onRepeatLastSet} style={styles.repeatButton}>
            <Text style={styles.repeatText} numberOfLines={1}>{repeatLastLabel ?? 'Repeat last set'}</Text>
          </Pressable>
        </View>
      ) : null}

      {completed && effortLabel ? (
        <View style={styles.effortRow}>
          <View
            style={[
              styles.effortPill,
              effort === 'easy' && styles.effortPillEasy,
              effort === 'good' && styles.effortPillGood,
              effort === 'hard' && styles.effortPillHard,
            ]}
          >
            <Text style={styles.effortText}>{effortLabel}</Text>
          </View>
        </View>
      ) : null}

      {validationMessage ? <Text style={styles.validationText}>{validationMessage}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    overflow: 'hidden',
    borderRadius: radii.sm,
    backgroundColor: '#FFFFFF',
    paddingVertical: 2,
    gap: 8,
  },
  rowActive: {
    backgroundColor: '#FFFFFF',
  },
  rowCompleted: {
    backgroundColor: '#ECFDF3',
  },
  rowFuture: {
    opacity: 0.56,
  },
  mainLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  setBadge: {
    width: 50,
    minHeight: 50,
    borderRadius: radii.pill,
    backgroundColor: '#F8F5FF',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  setBadgeActive: {
    backgroundColor: '#F3ECFF',
  },
  setBadgeCompleted: {
    backgroundColor: '#DCFCE7',
  },
  setBadgeLabel: {
    color: '#667085',
    fontSize: 8,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  setBadgeLabelActive: {
    color: LOGGING_PURPLE,
  },
  setBadgeValue: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  inputWrap: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.sm,
  },
  inputWrapActive: {
    borderColor: 'rgba(124, 58, 237, 0.24)',
    backgroundColor: '#FFFFFF',
  },
  loadCell: {
    flex: 1,
  },
  repsCell: {
    flex: 1,
  },
  input: {
    flex: 1,
    color: '#111827',
    fontSize: 17,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    paddingVertical: 0,
    textAlign: 'center',
  },
  inputSuffix: {
    color: '#667085',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  inputSuffixActive: {
    color: LOGGING_PURPLE,
  },
  valueCell: {
    minHeight: 50,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.xs,
    justifyContent: 'center',
    gap: 1,
  },
  valueCellCompleted: {
    borderColor: 'rgba(22, 163, 74, 0.24)',
    backgroundColor: '#F0FDF4',
  },
  valueLabel: {
    color: '#667085',
    fontSize: 8,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  valueText: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  doneButton: {
    width: 58,
    minHeight: 50,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 0,
  },
  doneButtonReady: {
    borderColor: 'rgba(124, 58, 237, 0.32)',
    backgroundColor: LOGGING_PURPLE,
    shadowColor: LOGGING_PURPLE,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  doneButtonCompleted: {
    backgroundColor: LOGGING_GREEN,
    borderColor: 'rgba(22, 163, 74, 0.34)',
  },
  doneButtonDisabled: {
    opacity: 0.52,
  },
  doneText: {
    color: '#94A3B8',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  doneTextReady: {
    color: '#FFFFFF',
    fontSize: 12,
  },
  doneTextCompleted: {
    color: '#FFFFFF',
    fontSize: 12,
  },
  activeHintRow: {
    paddingHorizontal: 2,
  },
  activeHintText: {
    color: '#667085',
    fontSize: 10,
    fontWeight: '700',
  },
  repeatRow: {
    alignItems: 'flex-start',
  },
  repeatButton: {
    minHeight: 30,
    maxWidth: '100%',
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3ECFF',
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.22)',
  },
  repeatText: {
    color: LOGGING_PURPLE,
    fontSize: 10,
    fontWeight: '800',
  },
  effortRow: {
    alignItems: 'flex-start',
  },
  effortPill: {
    minHeight: 28,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  effortPillEasy: {
    borderColor: 'rgba(85, 138, 189, 0.28)',
    backgroundColor: 'rgba(85, 138, 189, 0.16)',
  },
  effortPillGood: {
    borderColor: 'rgba(150, 216, 255, 0.30)',
    backgroundColor: 'rgba(150, 216, 255, 0.16)',
  },
  effortPillHard: {
    borderColor: 'rgba(191, 74, 105, 0.32)',
    backgroundColor: 'rgba(191, 74, 105, 0.18)',
  },
  effortText: {
    color: '#111827',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  validationText: {
    color: '#F0A286',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 2,
  },
});
