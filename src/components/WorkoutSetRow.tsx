import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { colors, radii, spacing } from '../theme';
import { UnitPreference } from '../types/models';
import { WorkoutSetEffort, WorkoutTrackingMode } from '../features/workout/workoutTypes';
import { canCompleteWorkoutSet, getWorkoutSetValidationMessage } from '../lib/workoutValidation';

const LOGGING_PURPLE = '#7C3AED';
const SUCCESS_GREEN = '#16A34A';
const SUCCESS_GREEN_BG = '#ECF7F0';
const DANGER_RED = '#D64545';
const WORKOUT_FONT_FAMILY = 'Manrope';
const SET_BADGE_SIZE = 32;
const VALUE_CELL_WIDTH = 76;
const PREVIOUS_CELL_WIDTH = 86;

// Quick weight adjust chips shown under the active set (handoff §4). Easy to
// re-tune later.
const WEIGHT_STEPS = [-2.5, 1.25, 2.5, 5];

function formatStep(step: number) {
  const abs = Number.isInteger(step) ? String(Math.abs(step)) : String(Math.abs(step));
  return `${step > 0 ? '+' : '-'}${abs} kg`;
}

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
    <View style={[styles.valueCell, styles.valueCellFlex, completed && styles.valueCellCompleted]}>
      <Text style={[styles.valueText, completed && styles.valueTextCompleted, muted && styles.valueTextMuted]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function WeightConsole({ currentValue, onStep }: { currentValue: string; onStep: (next: string) => void }) {
  const applyStep = (delta: number) => {
    const parsed = Number.parseFloat(currentValue);
    const base = Number.isFinite(parsed) ? parsed : 0;
    const next = Math.max(0, base + delta);
    onStep(Number.isInteger(next) ? String(next) : String(Number(next.toFixed(2))));
  };

  return (
    <View style={styles.consoleWrap}>
      {WEIGHT_STEPS.map((step) => (
        <Pressable key={step} onPress={() => applyStep(step)} style={styles.consoleChip} hitSlop={4}>
          <Text style={[styles.consoleChipText, { color: step < 0 ? DANGER_RED : SUCCESS_GREEN }]}>{formatStep(step)}</Text>
        </Pressable>
      ))}
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
  const readyToComplete = canCompleteWorkoutSet(trackingMode, weightValue, repsValue);
  const validationMessage = active && !completed
    ? getWorkoutSetValidationMessage(trackingMode, weightValue, repsValue)
    : null;
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
        <View style={styles.setBadge}>
          <Text style={[styles.setBadgeValue, active && styles.setBadgeValueActive, completed && styles.setBadgeValueCompleted]}>
            {setNumber}
          </Text>
          {completed ? (
            <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
              <Path d="M5 12l5 5L19 7" stroke={SUCCESS_GREEN} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          ) : null}
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

      </View>

      {showEditableInputs ? (
        <>
          <WeightConsole currentValue={weightValue} onStep={onWeightChange} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Log set ${setNumber}`}
            onPress={onComplete}
            disabled={!readyToComplete}
            style={[styles.logSetButton, !readyToComplete && styles.logSetButtonDisabled]}
          >
            <Text style={styles.logSetText}>Log set</Text>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path d="M5 12h14M13 6l6 6-6 6" stroke="#FFFFFF" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>
        </>
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
    backgroundColor: SUCCESS_GREEN_BG,
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
    width: SET_BADGE_SIZE + 12,
    minHeight: SET_BADGE_SIZE,
    marginLeft: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 5,
  },
  setBadgeValue: {
    fontFamily: WORKOUT_FONT_FAMILY,
    color: '#111827',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  setBadgeValueActive: {
    color: LOGGING_PURPLE,
  },
  setBadgeValueCompleted: {
    color: SUCCESS_GREEN,
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
    width: 168,
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
  valueCellCompleted: {
    borderColor: 'transparent',
    backgroundColor: 'transparent',
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
  valueTextCompleted: {
    color: '#111827',
  },
  valueTextMuted: {
    color: '#9B93AD',
    fontWeight: '800',
  },
  consoleWrap: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 9,
    marginBottom: 2,
    borderRadius: 14,
    backgroundColor: '#EFE7FF',
    padding: 8,
  },
  consoleChip: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5DEF4',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  consoleChipText: {
    fontFamily: WORKOUT_FONT_FAMILY,
    fontSize: 13.5,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  logSetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 14,
    backgroundColor: LOGGING_PURPLE,
    marginTop: 2,
    marginBottom: 4,
    shadowColor: LOGGING_PURPLE,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 4,
  },
  logSetButtonDisabled: {
    opacity: 0.5,
  },
  logSetText: {
    fontFamily: WORKOUT_FONT_FAMILY,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
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
