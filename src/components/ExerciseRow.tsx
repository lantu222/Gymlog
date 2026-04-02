import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { formatLogResult, formatTargetSets } from '../lib/format';
import { ExerciseTemplate, UnitPreference } from '../types/models';
import { colors, radii, spacing } from '../theme';

interface ExerciseRowProps {
  exercise: ExerciseTemplate;
  unitPreference: UnitPreference;
  previousResult?: {
    weight: number;
    repsPerSet: number[];
    skipped?: boolean;
  } | null;
  weightValue: string;
  repsValues: string[];
  tracked: boolean;
  onWeightChange: (value: string) => void;
  onRepChange: (index: number, value: string) => void;
  onTrackedToggle: () => void;
  bindWeightInput: (input: TextInput | null) => void;
  bindRepInput: (index: number, input: TextInput | null) => void;
  onWeightSubmit?: () => void;
  onRepSubmit: (index: number) => void;
  hasNextAfterWeight: boolean;
  hasNextAfterRep: (index: number) => boolean;
}

export function ExerciseRow({
  exercise,
  unitPreference,
  previousResult,
  weightValue,
  repsValues,
  tracked,
  onWeightChange,
  onRepChange,
  onTrackedToggle,
  bindWeightInput,
  bindRepInput,
  onWeightSubmit,
  onRepSubmit,
  hasNextAfterWeight,
  hasNextAfterRep,
}: ExerciseRowProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.name}>{exercise.name}</Text>
          <Text style={styles.target}>{formatTargetSets(exercise.targetSets, exercise.repMin, exercise.repMax)}</Text>
        </View>
        <Pressable
          onPress={onTrackedToggle}
          style={[styles.starButton, tracked && styles.starButtonActive]}
        >
          <Text style={[styles.starText, tracked && styles.starTextActive]}>
            {tracked ? '★' : '☆'}
          </Text>
        </Pressable>
      </View>

      <Text style={styles.previous}>Last: {formatLogResult(previousResult, unitPreference)}</Text>

      <View style={styles.weightSection}>
        <Text style={styles.sectionLabel}>Weight</Text>
        <View style={styles.weightInputWrap}>
          <TextInput
            ref={bindWeightInput}
            value={weightValue}
            onChangeText={onWeightChange}
            placeholder="0"
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
            selectionColor={colors.accent}
            style={styles.weightInput}
            returnKeyType={hasNextAfterWeight ? 'next' : 'done'}
            onSubmitEditing={onWeightSubmit}
            blurOnSubmit={!hasNextAfterWeight}
            selectTextOnFocus
          />
          <Text style={styles.weightSuffix}>{unitPreference}</Text>
        </View>
      </View>

      <View style={styles.setsSection}>
        <Text style={styles.sectionLabel}>Sets</Text>
        <View style={styles.setsRow}>
          {repsValues.map((value, index) => (
            <View key={`${exercise.id}-set-${index}`} style={styles.setField}>
              <Text style={styles.setLabel}>Set {index + 1}</Text>
              <TextInput
                ref={(input) => bindRepInput(index, input)}
                value={value}
                onChangeText={(nextValue) => onRepChange(index, nextValue)}
                placeholder="0"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                selectionColor={colors.accent}
                style={styles.repInput}
                returnKeyType={hasNextAfterRep(index) ? 'next' : 'done'}
                onSubmitEditing={() => onRepSubmit(index)}
                blurOnSubmit={!hasNextAfterRep(index)}
                selectTextOnFocus
              />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: spacing.lg,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  name: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  target: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  starButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  starButtonActive: {
    backgroundColor: colors.accentSoft,
    borderColor: 'rgba(110, 168, 254, 0.24)',
  },
  starText: {
    color: colors.textMuted,
    fontSize: 22,
    lineHeight: 24,
  },
  starTextActive: {
    color: colors.accent,
  },
  previous: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  weightSection: {
    gap: spacing.xs,
  },
  weightInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 66,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.input,
  },
  weightInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  weightSuffix: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
  setsSection: {
    gap: spacing.xs,
  },
  setsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  setField: {
    minWidth: 88,
    flexGrow: 1,
    gap: spacing.xs,
  },
  setLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  repInput: {
    height: 66,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.input,
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
});
