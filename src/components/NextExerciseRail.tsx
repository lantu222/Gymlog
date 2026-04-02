import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { pluralize } from '../lib/format';
import { colors, radii, spacing } from '../theme';

export interface NextExerciseRailPreview {
  name: string;
  remainingSets: number;
  previousLabel?: string | null;
}

interface NextExerciseRailProps {
  nextExercise: NextExerciseRailPreview | null;
  isFinalExercise?: boolean;
  currentExerciseName?: string;
}

export function NextExerciseRail({
  nextExercise,
  isFinalExercise = false,
  currentExerciseName,
}: NextExerciseRailProps) {
  if (!nextExercise) {
    return (
      <View style={[styles.rail, styles.railComplete]}>
        <View style={styles.copy}>
          <Text style={styles.eyebrow}>Next</Text>
          <Text style={styles.title}>{isFinalExercise ? 'Last exercise in workout' : 'Workout complete'}</Text>
          <Text style={styles.subtitle}>
            {isFinalExercise
              ? `${currentExerciseName ?? 'Current exercise'} is the last movement.`
              : 'Finish when you are ready.'}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.rail}>
      <View style={styles.copy}>
        <Text style={styles.eyebrow}>Next</Text>
        <Text style={styles.title}>{nextExercise.name}</Text>
        <Text style={styles.subtitle}>
          {pluralize(nextExercise.remainingSets, 'set')} left
          {nextExercise.previousLabel ? ` - Last ${nextExercise.previousLabel}` : ''}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardElevated,
    padding: spacing.md,
  },
  railComplete: {
    backgroundColor: colors.card,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  eyebrow: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
});
