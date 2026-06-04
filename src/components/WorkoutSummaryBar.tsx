import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatVolume } from '../lib/format';
import { WorkoutFlowTrailItem } from '../lib/workoutFlow';
import { radii, spacing } from '../theme';
import { UnitPreference } from '../types/models';

const LOGGING_BACKGROUND = '#F7F3FF';
const LOGGING_PURPLE = '#7C3AED';
const LOGGING_GREEN = '#16A34A';

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
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.16)',
    backgroundColor: '#FFFFFF',
    gap: spacing.sm,
    shadowColor: LOGGING_PURPLE,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 6,
  },
  wrapperUrgent: {
    borderColor: 'rgba(22, 163, 74, 0.24)',
  },
  topAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: LOGGING_PURPLE,
  },
  topAccentUrgent: {
    backgroundColor: LOGGING_GREEN,
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
    borderColor: 'rgba(124, 58, 237, 0.20)',
    backgroundColor: '#F3ECFF',
    justifyContent: 'center',
  },
  phaseChipUrgent: {
    borderColor: 'rgba(22, 163, 74, 0.24)',
    backgroundColor: '#ECFDF3',
  },
  phaseChipText: {
    color: LOGGING_PURPLE,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  phaseChipTextUrgent: {
    color: LOGGING_GREEN,
  },
  headerMeta: {
    color: '#667085',
    fontSize: 12,
    fontWeight: '700',
  },
  metrics: {
    flexDirection: 'row',
    gap: 0,
  },
  metricPill: {
    flex: 1,
    minHeight: 62,
    borderRightWidth: 1,
    borderRightColor: 'rgba(124, 58, 237, 0.14)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    gap: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricPillUrgent: {
    borderRightColor: 'rgba(22, 163, 74, 0.16)',
  },
  label: {
    color: '#667085',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  labelUrgent: {
    color: LOGGING_GREEN,
  },
  value: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  restPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    backgroundColor: '#F3ECFF',
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.22)',
  },
  restPillUrgent: {
    backgroundColor: '#ECFDF3',
    borderColor: 'rgba(22, 163, 74, 0.28)',
    shadowColor: LOGGING_GREEN,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 5,
  },
  restLabel: {
    color: '#667085',
    fontSize: 11,
    fontWeight: '700',
  },
  restLabelUrgent: {
    color: LOGGING_GREEN,
  },
  restValue: {
    color: '#111827',
    fontSize: 12,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  restValueUrgent: {
    color: LOGGING_GREEN,
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
    borderColor: 'rgba(124, 58, 237, 0.18)',
    backgroundColor: LOGGING_BACKGROUND,
  },
  restActionText: {
    color: LOGGING_PURPLE,
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
    borderColor: 'rgba(124, 58, 237, 0.12)',
    backgroundColor: LOGGING_BACKGROUND,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trailChipCurrent: {
    borderColor: 'rgba(124, 58, 237, 0.24)',
    backgroundColor: '#F3ECFF',
  },
  trailChipComplete: {
    opacity: 0.56,
  },
  trailChipText: {
    color: '#667085',
    fontSize: 10,
    fontWeight: '800',
  },
  trailChipTextCurrent: {
    color: LOGGING_PURPLE,
  },
  trailChipTextComplete: {
    color: '#667085',
  },
});
