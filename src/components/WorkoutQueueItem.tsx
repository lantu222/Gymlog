import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { WorkoutExerciseInstance } from '../features/workout/workoutTypes';
import { WorkoutFlowPhase, getWorkoutFlowPhaseMeta } from '../lib/workoutFlow';
import { radii, spacing } from '../theme';

const LOGGING_PURPLE = '#7C3AED';
const LOGGING_GREEN = '#16A34A';

interface WorkoutQueueItemProps {
  exercise: WorkoutExerciseInstance;
  phase: WorkoutFlowPhase;
  summary: string;
  positionLabel?: string | null;
  isNextUp?: boolean;
  onPress: () => void;
}

function getPhaseColors(phase: WorkoutFlowPhase) {
  if (phase === 'warmup') {
    return {
      border: 'rgba(124, 58, 237, 0.16)',
      background: '#F3ECFF',
      text: LOGGING_PURPLE,
      accent: 'rgba(124, 58, 237, 0.72)',
    };
  }

  if (phase === 'main') {
    return {
      border: 'rgba(22, 163, 74, 0.18)',
      background: '#ECFDF3',
      text: LOGGING_GREEN,
      accent: 'rgba(22, 163, 74, 0.72)',
    };
  }

  if (phase === 'build') {
    return {
      border: 'rgba(124, 58, 237, 0.16)',
      background: '#F3ECFF',
      text: LOGGING_PURPLE,
      accent: 'rgba(124, 58, 237, 0.72)',
    };
  }

  return {
    border: 'rgba(22, 163, 74, 0.18)',
    background: '#ECFDF3',
    text: LOGGING_GREEN,
    accent: 'rgba(22, 163, 74, 0.72)',
  };
}

export function WorkoutQueueItem({
  exercise,
  phase,
  summary,
  positionLabel = null,
  isNextUp = false,
  onPress,
}: WorkoutQueueItemProps) {
  const phaseMeta = getWorkoutFlowPhaseMeta(phase);
  const phaseColors = getPhaseColors(phase);
  const completedSets = exercise.sets.filter((set) => set.status === 'completed').length;
  const pendingSetIndex = exercise.sets.findIndex((set) => set.status === 'pending');
  const nextSetNumber = pendingSetIndex >= 0 ? pendingSetIndex + 1 : null;
  const nextSet = pendingSetIndex >= 0 ? exercise.sets[pendingSetIndex] : null;
  const setLine = nextSetNumber
    ? `Set ${nextSetNumber} of ${exercise.sets.length}`
    : `${completedSets}/${exercise.sets.length} complete`;
  const repLine = nextSet ? `${nextSet.plannedRepsMin}-${nextSet.plannedRepsMax} reps` : 'Ready to review';
  const visualBars = exercise.sets.slice(0, 5);

  return (
    <Pressable onPress={onPress} style={[styles.card, isNextUp && styles.cardNext, !isNextUp && styles.cardLater]}>
      <View style={[styles.leftAccent, { backgroundColor: phaseColors.accent }]} />
      <View style={styles.headerRow}>
        <View style={styles.headerChips}>
          <View style={[styles.phaseChip, { borderColor: phaseColors.border, backgroundColor: phaseColors.background }]}>
            <Text style={[styles.phaseChipText, { color: phaseColors.text }]}>{phaseMeta.kicker}</Text>
          </View>
          {positionLabel ? (
            <View style={styles.positionChip}>
              <Text style={styles.positionChipText}>{positionLabel}</Text>
            </View>
          ) : null}
        </View>
        {isNextUp ? (
          <View style={styles.nextChip}>
            <Text style={styles.nextChipText}>Next</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.mainRow}>
        <View style={styles.copy}>
          <Text style={styles.title} numberOfLines={1}>
            {exercise.exerciseName}
          </Text>
          <Text style={styles.setLine}>{setLine}</Text>
          <Text style={styles.summary} numberOfLines={2}>
            {summary}
          </Text>
          <View style={styles.metaRow}>
            <View style={styles.metaPill}>
              <Text style={styles.metaPillText}>{repLine}</Text>
            </View>
            <View style={styles.metaPill}>
              <Text style={styles.metaPillText}>{exercise.sets.length} sets</Text>
            </View>
          </View>
        </View>

        <View style={[styles.visualPanel, isNextUp && styles.visualPanelNext]}>
          <View style={styles.visualStack}>
            {visualBars.map((set) => (
              <View
                key={set.setIndex}
                style={[
                  styles.visualBar,
                  set.status === 'completed' && styles.visualBarCompleted,
                  set.status === 'pending' && set.setIndex === pendingSetIndex && styles.visualBarCurrent,
                  set.status === 'pending' && set.setIndex !== pendingSetIndex && styles.visualBarFuture,
                ]}
              />
            ))}
          </View>
          <Text style={styles.visualLabel}>{isNextUp ? 'Tap to open' : 'Queued'}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.14)',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 6,
    shadowColor: LOGGING_PURPLE,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
  },
  cardNext: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(124, 58, 237, 0.20)',
    paddingVertical: spacing.md,
  },
  cardLater: {
    opacity: 0.92,
  },
  leftAccent: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 3,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  headerChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
  },
  phaseChip: {
    minHeight: 24,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phaseChipText: {
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  positionChip: {
    minHeight: 24,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.12)',
    backgroundColor: '#F8F5FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  positionChipText: {
    color: '#667085',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  nextChip: {
    minHeight: 24,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.18)',
    backgroundColor: '#F3ECFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextChipText: {
    color: LOGGING_PURPLE,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.sm,
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  setLine: {
    color: LOGGING_PURPLE,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  summary: {
    color: '#667085',
    fontSize: 12,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingTop: 2,
  },
  metaPill: {
    minHeight: 26,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.12)',
    backgroundColor: '#F8F5FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaPillText: {
    color: '#667085',
    fontSize: 11,
    fontWeight: '800',
  },
  visualPanel: {
    width: 72,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.12)',
    backgroundColor: '#F8F5FF',
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.xs,
  },
  visualPanelNext: {
    borderColor: 'rgba(124, 58, 237, 0.16)',
    backgroundColor: '#F3ECFF',
  },
  visualStack: {
    width: '100%',
    gap: 5,
  },
  visualBar: {
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: '#E9D5FF',
  },
  visualBarCompleted: {
    backgroundColor: 'rgba(22, 163, 74, 0.48)',
  },
  visualBarCurrent: {
    backgroundColor: LOGGING_PURPLE,
  },
  visualBarFuture: {
    backgroundColor: 'rgba(66, 84, 102, 0.32)',
  },
  visualLabel: {
    color: '#667085',
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
  },
});
