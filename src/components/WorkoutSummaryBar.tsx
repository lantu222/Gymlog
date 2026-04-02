import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatVolume } from '../lib/format';
import { WorkoutFlowTrailItem } from '../lib/workoutFlow';
import { colors, radii, spacing } from '../theme';
import { UnitPreference } from '../types/models';

interface WorkoutSummaryBarProps {
  elapsedSeconds: number;
  completedSets: number;
  totalVolume: number;
  unitPreference: UnitPreference;
  flowTrail?: WorkoutFlowTrailItem[];
  currentPhaseLabel?: string | null;
  statusMeta?: string | null;
  restSecondsRemaining?: number | null;
  restPaused?: boolean;
  onDismissRest?: () => void;
  onPauseRest?: () => void;
  onResumeRest?: () => void;
}

function formatClock(totalSeconds: number) {
  const safeValue = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeValue / 60);
  const seconds = safeValue % 60;

  return `${minutes}:${`${seconds}`.padStart(2, '0')}`;
}

export function WorkoutSummaryBar({
  elapsedSeconds,
  completedSets,
  totalVolume,
  unitPreference,
  flowTrail = [],
  currentPhaseLabel = null,
  statusMeta = null,
  restSecondsRemaining,
  restPaused,
  onDismissRest,
  onPauseRest,
  onResumeRest,
}: WorkoutSummaryBarProps) {
  const restUrgent = typeof restSecondsRemaining === 'number' && restSecondsRemaining <= 10;
  const restVisible = typeof restSecondsRemaining === 'number';

  return (
    <View style={[styles.wrapper, restUrgent && styles.wrapperUrgent]}>
      <View style={[styles.topAccent, restUrgent && styles.topAccentUrgent]} />
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          {currentPhaseLabel ? (
            <View style={[styles.phaseChip, restUrgent && styles.phaseChipUrgent]}>
              <Text style={[styles.phaseChipText, restUrgent && styles.phaseChipTextUrgent]}>
                {currentPhaseLabel}
              </Text>
            </View>
          ) : null}
          {statusMeta ? <Text style={styles.headerMeta}>{statusMeta}</Text> : null}
        </View>
        {restVisible ? (
          <View style={styles.restRow}>
            <Pressable onPress={onDismissRest} style={[styles.restPill, restUrgent && styles.restPillUrgent]}>
              <Text style={[styles.restLabel, restUrgent && styles.restLabelUrgent]}>
                {restPaused ? 'Rest paused' : 'Rest'}
              </Text>
              <Text style={[styles.restValue, restUrgent && styles.restValueUrgent]}>
                {formatClock(restSecondsRemaining ?? 0)}
              </Text>
            </Pressable>
            {restPaused ? (
              <Pressable onPress={onResumeRest} style={styles.restActionButton}>
                <Text style={styles.restActionText}>Resume</Text>
              </Pressable>
            ) : (
              <Pressable onPress={onPauseRest} style={styles.restActionButton}>
                <Text style={styles.restActionText}>Pause</Text>
              </Pressable>
            )}
          </View>
        ) : null}
      </View>

      <View style={styles.metrics}>
        <View style={[styles.metricPill, restUrgent && styles.metricPillUrgent]}>
          <Text style={[styles.label, restUrgent && styles.labelUrgent]}>Duration</Text>
          <Text style={styles.value}>{formatClock(elapsedSeconds)}</Text>
        </View>
        <View style={styles.metricPill}>
          <Text style={styles.label}>Sets</Text>
          <Text style={styles.value}>{completedSets}</Text>
        </View>
        <View style={styles.metricPill}>
          <Text style={styles.label}>Volume</Text>
          <Text style={styles.value} numberOfLines={1}>{formatVolume(totalVolume, unitPreference)}</Text>
        </View>
      </View>

      {flowTrail.length > 0 ? (
        <View style={styles.trailRow}>
          {flowTrail.map((item) => (
            <View
              key={item.phase}
              style={[
                styles.trailChip,
                item.state === 'current' && styles.trailChipCurrent,
                item.state === 'complete' && styles.trailChipComplete,
              ]}
            >
              <Text
                style={[
                  styles.trailChipText,
                  item.state === 'current' && styles.trailChipTextCurrent,
                  item.state === 'complete' && styles.trailChipTextComplete,
                ]}
              >
                {item.label}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(85, 138, 189, 0.18)',
    backgroundColor: 'rgba(18, 24, 33, 0.78)',
    gap: spacing.xs,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 6,
  },
  wrapperUrgent: {
    borderColor: 'rgba(162, 54, 18, 0.28)',
  },
  topAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.accent,
  },
  topAccentUrgent: {
    backgroundColor: colors.warning,
  },
  glowOrangeUrgent: {
    width: 132,
    height: 132,
    borderRadius: 132,
    backgroundColor: 'rgba(162, 54, 18, 0.18)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  phaseChip: {
    alignSelf: 'flex-start',
    minHeight: 24,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(85, 138, 189, 0.24)',
    backgroundColor: 'rgba(85, 138, 189, 0.12)',
    justifyContent: 'center',
  },
  phaseChipUrgent: {
    borderColor: 'rgba(162, 54, 18, 0.34)',
    backgroundColor: 'rgba(162, 54, 18, 0.12)',
  },
  phaseChipText: {
    color: '#9ACCFF',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  phaseChipTextUrgent: {
    color: '#E37A58',
  },
  headerMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  metrics: {
    flexDirection: 'row',
    gap: 6,
  },
  metricPill: {
    flex: 1,
    minHeight: 38,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(15, 21, 29, 0.86)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 1,
    justifyContent: 'center',
  },
  metricPillUrgent: {
    borderColor: 'rgba(162, 54, 18, 0.20)',
  },
  label: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  labelUrgent: {
    color: '#E37A58',
  },
  value: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  restPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(85, 138, 189, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(85, 138, 189, 0.30)',
  },
  restPillUrgent: {
    backgroundColor: 'rgba(162, 54, 18, 0.20)',
    borderColor: 'rgba(162, 54, 18, 0.42)',
    shadowColor: colors.warning,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 5,
  },
  restLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  restLabelUrgent: {
    color: '#E37A58',
  },
  restValue: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  restValueUrgent: {
    color: '#FFFFFF',
  },
  restRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  restActionButton: {
    minHeight: 30,
    paddingHorizontal: 10,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(85, 138, 189, 0.28)',
    backgroundColor: 'rgba(15, 21, 29, 0.92)',
  },
  restActionText: {
    color: colors.textPrimary,
    fontSize: 10,
    fontWeight: '800',
  },
  trailRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  trailChip: {
    minHeight: 24,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(60, 92, 119, 0.24)',
    backgroundColor: 'rgba(13, 19, 27, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trailChipCurrent: {
    borderColor: 'rgba(85, 138, 189, 0.34)',
    backgroundColor: 'rgba(85, 138, 189, 0.14)',
  },
  trailChipComplete: {
    opacity: 0.56,
  },
  trailChipText: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
  },
  trailChipTextCurrent: {
    color: '#8FC1F2',
  },
  trailChipTextComplete: {
    color: colors.textSecondary,
  },
});
