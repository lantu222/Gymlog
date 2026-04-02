import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { WorkoutFlowPhase, WorkoutFlowPhasePreviewItem } from '../lib/workoutFlow';
import { colors, radii, spacing } from '../theme';

interface WorkoutPhasePreviewProps {
  phases: WorkoutFlowPhasePreviewItem[];
  compact?: boolean;
}

function getPhaseTone(phase: WorkoutFlowPhase) {
  if (phase === 'warmup') {
    return {
      border: 'rgba(226, 170, 119, 0.30)',
      fill: 'rgba(226, 170, 119, 0.12)',
      accent: '#F0C998',
    };
  }

  if (phase === 'main') {
    return {
      border: 'rgba(103, 168, 233, 0.32)',
      fill: 'rgba(103, 168, 233, 0.12)',
      accent: '#8FC1F2',
    };
  }

  if (phase === 'build') {
    return {
      border: 'rgba(191, 74, 105, 0.30)',
      fill: 'rgba(191, 74, 105, 0.12)',
      accent: '#E39AAF',
    };
  }

  return {
    border: 'rgba(162, 54, 18, 0.30)',
    fill: 'rgba(162, 54, 18, 0.12)',
    accent: '#E4A287',
  };
}

export function WorkoutPhasePreview({ phases, compact = false }: WorkoutPhasePreviewProps) {
  if (phases.length === 0) {
    return null;
  }

  return (
    <View style={[styles.grid, compact && styles.gridCompact]}>
      {phases.map((phase) => {
        const tone = getPhaseTone(phase.phase);
        return (
          <View
            key={`${phase.phase}:${phase.leadExerciseName}`}
            style={[
              styles.card,
              compact && styles.cardCompact,
              {
                borderColor: tone.border,
                backgroundColor: tone.fill,
              },
            ]}
          >
            <View style={styles.headerRow}>
              <View style={[styles.iconOrb, { borderColor: tone.border, backgroundColor: tone.fill }]}>
                <View style={[styles.iconCore, { backgroundColor: tone.accent }]} />
              </View>
              <Text style={[styles.kicker, { color: tone.accent }]}>{phase.label}</Text>
            </View>

            <Text style={[styles.title, compact && styles.titleCompact]} numberOfLines={1}>
              {phase.leadExerciseName}
            </Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaText}>
                {phase.exerciseCount} {phase.exerciseCount === 1 ? 'move' : 'moves'}
              </Text>
              {phase.trailingLabel ? <Text style={styles.metaText}>{phase.trailingLabel}</Text> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  gridCompact: {
    gap: spacing.xs,
  },
  card: {
    flexGrow: 1,
    minWidth: 132,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 6,
  },
  cardCompact: {
    minWidth: 118,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  iconOrb: {
    width: 18,
    height: 18,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCore: {
    width: 7,
    height: 7,
    borderRadius: 7,
  },
  kicker: {
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  titleCompact: {
    fontSize: 13,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  metaText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
  },
});
