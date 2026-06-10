import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, radii, spacing, typography } from '../theme';
import { UnitPreference } from '../types/models';
import { WorkoutSetEffort, WorkoutTrackingMode } from '../features/workout/workoutTypes';
import { canCompleteWorkoutSet, getWorkoutSetValidationMessage } from '../lib/workoutValidation';

const LOGGING_PURPLE = '#7C3AED';
const SET_BADGE_SIZE = 30;
const VALUE_CELL_FLEX = 0.5;
const VALUE_CELL_WIDTH = 96;
const CHECK_BUTTON_SIZE = 38;

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
  value,
  completed,
}: {
  value: string;
  completed?: boolean;
}) {
  return (
    <View style={[styles.valueCell, styles.valueCellFlex, completed && styles.valueCellCompletedPurple]}>
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
  const showActionButton = true;
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
        <View style={[styles.setBadge, active && styles.setBadgeActive, completed && styles.setBadgeCompletedPurple]}>
          <Text style={[styles.setBadgeValue, (active || completed) && styles.setBadgeValueOnPurple]}>{setNumber}</Text>
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
            </View>
          ) : (
            <CompactValueCell
              value={weightValue || weightPlaceholder || '--'}
              completed={completed}
            />
          )
        ) : (
          <CompactValueCell value="Body" completed={completed} />
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
          </View>
        ) : (
          <CompactValueCell value={repsValue || repsPlaceholder || '--'} completed={completed} />
        )}

        {showActionButton ? (
          <Pressable
            hitSlop={6}
            onPress={onComplete}
            disabled={!completed && !readyToComplete}
            style={[
              styles.doneButton,
              active && readyToComplete && styles.doneButtonReady,
              completed && styles.doneButtonCompletedPurple,
              !completed && !readyToComplete && styles.doneButtonDisabled,
            ]}
          >
            <Text style={[styles.doneText, active && readyToComplete && styles.doneTextReady, completed && styles.doneTextCompleted]}>
              ✓
            </Text>
          </Pressable>
        ) : null}
      </View>

      {active && !completed ? (
        null
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
    paddingVertical: 0,
    gap: 5,
  },
  rowActive: {
    backgroundColor: '#FFFFFF',
  },
  rowCompleted: {
    backgroundColor: '#FFFFFF',
  },
  rowFuture: {
    opacity: 0.76,
  },
  mainLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  setBadge: {
    width: SET_BADGE_SIZE,
    minHeight: SET_BADGE_SIZE,
    borderRadius: radii.pill,
    backgroundColor: '#F3ECFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  setBadgeActive: {
    backgroundColor: LOGGING_PURPLE,
  },
  setBadgeCompletedPurple: {
    backgroundColor: LOGGING_PURPLE,
  },
  setBadgeValue: {
    fontFamily: typography.fontFamily,
    color: LOGGING_PURPLE,
    fontSize: 14,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  setBadgeValueOnPurple: {
    color: '#FFFFFF',
  },
  inputWrap: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.18)',
    backgroundColor: '#F3ECFF',
    paddingHorizontal: spacing.sm,
  },
  inputWrapActive: {
    borderColor: LOGGING_PURPLE,
    backgroundColor: '#F3ECFF',
  },
  loadCell: {
    width: VALUE_CELL_WIDTH,
  },
  repsCell: {
    width: VALUE_CELL_WIDTH,
  },
  input: {
    fontFamily: typography.fontFamily,
    flex: 1,
    color: '#111827',
    fontSize: 16,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    paddingVertical: 0,
    paddingHorizontal: 0,
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  valueCell: {
    minHeight: 44,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.16)',
    backgroundColor: '#F3ECFF',
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueCellCompletedPurple: {
    borderColor: 'rgba(124, 58, 237, 0.20)',
    backgroundColor: '#EDE4FF',
  },
  valueCellFlex: {
    width: VALUE_CELL_WIDTH,
  },
  valueText: {
    fontFamily: typography.fontFamily,
    color: '#111827',
    fontSize: 15,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    width: '100%',
    includeFontPadding: false,
  },
  doneButton: {
    width: CHECK_BUTTON_SIZE,
    minHeight: CHECK_BUTTON_SIZE,
    borderRadius: 10,
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
  doneButtonCompletedPurple: {
    backgroundColor: LOGGING_PURPLE,
    borderColor: 'rgba(124, 58, 237, 0.34)',
  },
  doneButtonDisabled: {
    opacity: 0.86,
  },
  doneText: {
    fontFamily: typography.fontFamily,
    color: '#94A3B8',
    fontSize: 16,
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
    fontFamily: typography.fontFamily,
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
    fontFamily: typography.fontFamily,
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
    fontFamily: typography.fontFamily,
    color: '#111827',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  validationText: {
    fontFamily: typography.fontFamily,
    color: '#F0A286',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 2,
  },
});
