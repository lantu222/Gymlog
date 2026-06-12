import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, radii, spacing } from '../theme';
import { UnitPreference } from '../types/models';
import { WorkoutSetEffort, WorkoutTrackingMode } from '../features/workout/workoutTypes';
import { canCompleteWorkoutSet, getWorkoutSetValidationMessage } from '../lib/workoutValidation';

const LOGGING_PURPLE = '#7C3AED';
const WORKOUT_FONT_FAMILY = 'Manrope';
const SET_BADGE_SIZE = 32;
const VALUE_CELL_FLEX = 0.5;
const VALUE_CELL_WIDTH = 66;
const PREVIOUS_CELL_WIDTH = 86;
const CHECK_BUTTON_SIZE = 34;

interface WorkoutSetRowProps {
  setNumber: number;
  trackingMode: WorkoutTrackingMode;
  weightValue: string;
  repsValue: string;
  previousValue?: string | null;
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
  muted,
}: {
  value: string;
  completed?: boolean;
  muted?: boolean;
}) {
  return (
    <View style={[styles.valueCell, styles.valueCellFlex, completed && styles.valueCellCompletedPurple]}>
      <Text style={[styles.valueText, muted && styles.valueTextMuted]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

export function WorkoutSetRow({
  setNumber,
  trackingMode,
  weightValue,
  repsValue,
  previousValue,
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
  const loadDisplayValue = weightValue || weightPlaceholder || '0';
  const repsDisplayValue = repsValue || repsPlaceholder || '6-8';
  const loadMuted = !completed && !weightValue;
  const repsMuted = !completed && !repsValue;

  return (
    <Pressable
      onPress={onActivate}
      style={[styles.row, active && styles.rowActive, completed && styles.rowCompleted, future && styles.rowFuture]}
    >
      <View style={styles.mainLine}>
        <View style={[styles.setBadge, active && styles.setBadgeActive, completed && styles.setBadgeCompletedPurple]}>
          <Text style={[styles.setBadgeValue, (active || completed) && styles.setBadgeValueOnPurple]}>{setNumber}</Text>
        </View>

        <View style={styles.setMiddleGroup}>
          <Text style={styles.previousValue} numberOfLines={1}>
            {previousValue || '--'}
          </Text>

          <View style={styles.valueCellsGroup}>
            {showLoadField ? (
              showEditableInputs ? (
                <View style={[styles.inputWrap, styles.loadCell, styles.inputWrapActive]}>
                  <TextInput
                    ref={bindWeightInput}
                    value={weightValue}
                    onChangeText={onWeightChange}
                    placeholder={weightPlaceholder || '0'}
                    placeholderTextColor="#9B93AD"
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
                  value={loadDisplayValue}
                  completed={completed}
                  muted={loadMuted}
                />
              )
            ) : (
              <CompactValueCell value="Body" completed={completed} muted={!completed} />
            )}

            {showEditableInputs ? (
              <View style={[styles.inputWrap, styles.repsCell, styles.inputWrapActive]}>
                <TextInput
                  ref={bindRepsInput}
                  value={repsValue}
                  onChangeText={onRepsChange}
                  placeholder={repsPlaceholder || '0'}
                  placeholderTextColor="#9B93AD"
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
              <CompactValueCell value={repsDisplayValue} completed={completed} muted={repsMuted} />
            )}
          </View>
        </View>

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
    minHeight: 46,
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
    justifyContent: 'flex-start',
    gap: 0,
    width: '100%',
  },
  setBadge: {
    width: SET_BADGE_SIZE,
    minHeight: SET_BADGE_SIZE,
    marginLeft: 5,
    borderRadius: 0,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  setBadgeActive: {
    backgroundColor: 'transparent',
  },
  setBadgeCompletedPurple: {
    backgroundColor: 'transparent',
  },
  setBadgeValue: {
    fontFamily: WORKOUT_FONT_FAMILY,
    color: '#111827',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  setBadgeValueOnPurple: {
    color: '#111827',
  },
  previousValue: {
    fontFamily: WORKOUT_FONT_FAMILY,
    width: PREVIOUS_CELL_WIDTH,
    paddingLeft: 10,
    color: '#80768F',
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    textAlign: 'left',
  },
  setMiddleGroup: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 6,
    paddingRight: 14,
  },
  valueCellsGroup: {
    width: 146,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputWrap: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F5F5F7',
    paddingHorizontal: spacing.sm,
  },
  inputWrapActive: {
    borderColor: LOGGING_PURPLE,
    backgroundColor: '#F5F5F7',
  },
  loadCell: {
    width: VALUE_CELL_WIDTH,
  },
  repsCell: {
    width: VALUE_CELL_WIDTH,
  },
  input: {
    fontFamily: WORKOUT_FONT_FAMILY,
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
    minHeight: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F5F5F7',
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueCellCompletedPurple: {
    borderColor: '#E5E7EB',
    backgroundColor: '#F5F5F7',
  },
  valueCellFlex: {
    width: VALUE_CELL_WIDTH,
  },
  valueText: {
    fontFamily: WORKOUT_FONT_FAMILY,
    color: '#111827',
    fontSize: 17,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    width: '100%',
    includeFontPadding: false,
  },
  valueTextMuted: {
    color: '#9B93AD',
    fontWeight: '800',
  },
  doneButton: {
    width: CHECK_BUTTON_SIZE,
    minHeight: CHECK_BUTTON_SIZE,
    marginRight: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 0,
  },
  doneButtonReady: {
    borderColor: 'rgba(124, 58, 237, 0.34)',
    backgroundColor: '#F5F5F7',
  },
  doneButtonCompletedPurple: {
    backgroundColor: LOGGING_PURPLE,
    borderColor: 'rgba(124, 58, 237, 0.34)',
  },
  doneButtonDisabled: {
    opacity: 0.86,
  },
  doneText: {
    fontFamily: WORKOUT_FONT_FAMILY,
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
  },
  doneTextReady: {
    color: LOGGING_PURPLE,
    fontSize: 16,
  },
  doneTextCompleted: {
    color: '#FFFFFF',
    fontSize: 12,
  },
  activeHintRow: {
    paddingHorizontal: 2,
  },
  activeHintText: {
    fontFamily: WORKOUT_FONT_FAMILY,
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
    fontFamily: WORKOUT_FONT_FAMILY,
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
    fontFamily: WORKOUT_FONT_FAMILY,
    color: '#111827',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  validationText: {
    fontFamily: WORKOUT_FONT_FAMILY,
    color: '#F0A286',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 2,
  },
});
