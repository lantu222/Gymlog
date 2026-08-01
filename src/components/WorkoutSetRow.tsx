import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Theme, useTheme, useThemedStyles } from '../theming';
import { radii, spacing } from '../theme';
import { AppLanguage, UnitPreference } from '../types/models';
import { WorkoutSetEffort, WorkoutTrackingMode } from '../features/workout/workoutTypes';
import { getWorkoutSetValidationMessage } from '../lib/workoutValidation';
import { I18nKey, t } from '../lib/i18n';

const WORKOUT_FONT_FAMILY = 'Manrope';
const SET_BADGE_SIZE = 32;
const VALUE_CELL_WIDTH = 76;
const PREVIOUS_CELL_WIDTH = 86;

interface WorkoutSetRowProps {
  setNumber: number;
  trackingMode: WorkoutTrackingMode;
  weightValue: string;
  repsValue: string;
  previousValue?: string | null;
  weightPlaceholder?: string;
  repsPlaceholder?: string;
  unitPreference: UnitPreference;
  language?: AppLanguage;
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
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={[styles.valueCell, styles.valueCellFlex, completed && styles.valueCellCompleted]}>
      <Text style={[styles.valueText, completed && styles.valueTextCompleted, muted && styles.valueTextMuted]} numberOfLines={1}>
        {value}
      </Text>
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
  language = 'en',
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
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const showLoadField = trackingMode !== 'bodyweight';
  const showEditableInputs = active && !completed;
  const validationMessage = active && !completed
    ? getWorkoutSetValidationMessage(trackingMode, weightValue, repsValue, language)
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
              <Path d="M5 12l5 5L19 7" stroke={theme.green} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />
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
                    placeholderTextColor={theme.faint}
                    keyboardType="decimal-pad"
                    selectionColor={theme.purple}
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
                  placeholderTextColor={theme.faint}
                  keyboardType="number-pad"
                  selectionColor={theme.purple}
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

      {/* A recorded effort reads back on the row. The prop and these styles
          existed unused — the rating had nowhere to land, and nothing showed
          that a set had been rated at all. */}
      {completed && effort ? (
        <View style={styles.effortRow}>
          <View
            style={[
              styles.effortPill,
              effort === 'easy' ? styles.effortPillEasy : effort === 'hard' ? styles.effortPillHard : styles.effortPillGood,
            ]}
          >
            <Text style={styles.effortText}>{t(language, `logger.effort.${effort}` as I18nKey)}</Text>
          </View>
        </View>
      ) : null}

      {validationMessage ? <Text style={styles.validationText}>{validationMessage}</Text> : null}
    </Pressable>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  row: {
    minHeight: 46,
    overflow: 'hidden',
    borderRadius: radii.sm,
    backgroundColor: theme.surface,
    paddingVertical: 0,
    gap: 5,
  },
  rowActive: {
    backgroundColor: theme.surface,
  },
  rowCompleted: {
    backgroundColor: theme.greenSoft,
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
    color: theme.ink,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  setBadgeValueActive: {
    color: theme.purpleBright,
  },
  setBadgeValueCompleted: {
    color: theme.green,
  },
  previousValue: {
    fontFamily: WORKOUT_FONT_FAMILY,
    width: PREVIOUS_CELL_WIDTH,
    paddingLeft: 10,
    color: theme.faint,
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
    borderColor: theme.border,
    backgroundColor: theme.surfaceSoft,
    paddingHorizontal: spacing.sm,
  },
  inputWrapActive: {
    borderColor: theme.purpleBright,
    backgroundColor: theme.surfaceSoft,
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
    color: theme.ink,
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
    borderColor: theme.border,
    backgroundColor: theme.surfaceSoft,
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
    color: theme.ink,
    fontSize: 17,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    width: '100%',
    includeFontPadding: false,
  },
  valueTextCompleted: {
    color: theme.ink,
  },
  valueTextMuted: {
    color: theme.faint,
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
    color: theme.ink,
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
    // Lines up under the columns it is talking about, not the card edge.
    paddingLeft: SET_BADGE_SIZE + 17,
    paddingBottom: 4,
  },
});
