import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';

import { SurfaceCard } from './MainScreenPrimitives';
import { getComparableLogSets } from '../lib/exerciseLog';
import { formatLiftDisplayLabel } from '../lib/displayLabel';
import { formatLogSetSummary, formatShortDate, formatWeight, formatWeightTrend } from '../lib/format';
import { ExerciseProgressSummary, getExerciseProgressSignal } from '../lib/progression';
import { colors, radii, spacing } from '../theme';
import { UnitPreference } from '../types/models';

interface ProgressCardProps {
  summary: ExerciseProgressSummary;
  unitPreference: UnitPreference;
  onPress: () => void;
}

const signalStyles: Record<
  ReturnType<typeof getExerciseProgressSignal>['kind'],
  { backgroundColor: string; borderColor: string; textColor: string }
> = {
  new_best: {
    backgroundColor: 'rgba(244,250,255,0.12)',
    borderColor: 'rgba(244,250,255,0.18)',
    textColor: '#F4FAFF',
  },
  moving_up: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.14)',
    textColor: '#F4FAFF',
  },
  below_last: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.10)',
    textColor: colors.textPrimary,
  },
  building: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.10)',
    textColor: colors.textPrimary,
  },
  starting: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.10)',
    textColor: colors.textMuted,
  },
};

function buildSparkCoordinates(values: number[], width: number, height: number) {
  if (!values.length) {
    return '';
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = Math.max(max - min, 1);

  return values
    .map((value, index) => {
      const x = values.length === 1 ? width / 2 : (index / Math.max(values.length - 1, 1)) * width;
      const y = height - ((value - min) / spread) * height;
      return `${x},${y}`;
    })
    .join(' ');
}

export function ProgressCard({ summary, unitPreference, onPress }: ProgressCardProps) {
  const signal = getExerciseProgressSignal(summary);
  const signalStyle = signalStyles[signal.kind];
  const sparkValues = useMemo(
    () =>
      [...summary.logs]
        .slice(0, 5)
        .reverse()
        .map((log) => getComparableLogSets(log).reduce((best, set) => Math.max(best, set.weight), 0))
        .filter((value) => Number.isFinite(value)),
    [summary.logs],
  );

  const sparkPolyline = buildSparkCoordinates(sparkValues, 88, 28);
  const displayName = formatLiftDisplayLabel(summary.name);
  const latestPerformedAt = summary.latestLog ? formatShortDate(summary.latestLog.performedAt) : null;
  const latestContext = summary.latestLog?.swappedFrom
    ? `Swapped from ${formatLiftDisplayLabel(summary.latestLog.swappedFrom)}${latestPerformedAt ? ` · ${latestPerformedAt}` : ''}`
    : summary.latestLog?.notes
      ? `Latest log has notes${latestPerformedAt ? ` · ${latestPerformedAt}` : ''}`
      : latestPerformedAt
        ? `Last logged ${latestPerformedAt}`
        : null;

  return (
    <SurfaceCard onPress={onPress} accent="neutral" emphasis="utility" style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.copy}>
          <Text style={styles.name} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={styles.reps} numberOfLines={1}>
            {formatLogSetSummary(summary.latestLog, unitPreference)}
          </Text>
          {latestContext ? (
            <Text style={styles.sessionMeta} numberOfLines={1}>
              {latestContext}
            </Text>
          ) : null}
        </View>
        <View style={styles.pillColumn}>
          <View
            style={[
              styles.signalPill,
              { backgroundColor: signalStyle.backgroundColor, borderColor: signalStyle.borderColor },
            ]}
          >
            <Text style={[styles.signalText, { color: signalStyle.textColor }]}>{signal.label}</Text>
          </View>
          <View
            style={[
              styles.trendPill,
              styles.trendPillNeutral,
            ]}
          >
            <Text style={styles.trend}>
              {formatWeightTrend(summary.latestWeight, summary.previousWeight, unitPreference)}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.bottomRow}>
        <View style={styles.metricStrip}>
          <View style={styles.metricCell}>
            <Text style={styles.metricLabel}>Latest</Text>
            <Text style={styles.metricValue} numberOfLines={1}>
              {formatWeight(summary.latestWeight, unitPreference)}
            </Text>
          </View>
          <View style={styles.metricCell}>
            <Text style={styles.metricLabel}>Best</Text>
            <Text style={styles.metricValue} numberOfLines={1}>
              {formatWeight(summary.bestWeight, unitPreference)}
            </Text>
          </View>
        </View>

        <View style={styles.sparkWrap}>
          {sparkValues.length > 1 ? (
            <Svg width={88} height={28}>
              <Polyline
                points={sparkPolyline}
                fill="none"
                stroke="#F4FAFF"
                strokeWidth={3}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {sparkValues.map((value, index) => {
                const min = Math.min(...sparkValues);
                const max = Math.max(...sparkValues);
                const spread = Math.max(max - min, 1);
                const x = sparkValues.length === 1 ? 44 : (index / Math.max(sparkValues.length - 1, 1)) * 88;
                const y = 28 - ((value - min) / spread) * 28;
                return <Circle key={`${summary.key}:${index}`} cx={x} cy={y} r={3} fill="#F4FAFF" />;
              })}
            </Svg>
          ) : (
            <Text style={styles.sparkHint}>Need more logs</Text>
          )}
        </View>
      </View>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 132,
    gap: spacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  name: {
    color: colors.textPrimary,
    fontSize: 18,
    lineHeight: 20,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  reps: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  sessionMeta: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  pillColumn: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  signalPill: {
    minHeight: 28,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  signalText: {
    fontSize: 11,
    fontWeight: '900',
  },
  trendPill: {
    minHeight: 28,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  trendPillNeutral: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.10)',
  },
  trend: {
    color: '#F4FAFF',
    fontSize: 11,
    fontWeight: '900',
  },
  bottomRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'stretch',
  },
  metricStrip: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.xs,
  },
  metricCell: {
    flex: 1,
    minHeight: 48,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(11, 15, 20, 0.34)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    justifyContent: 'center',
    gap: 1,
  },
  metricLabel: {
    color: colors.textMuted,
    fontSize: 8,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  metricValue: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  sparkWrap: {
    width: 100,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  sparkHint: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
  },
});
