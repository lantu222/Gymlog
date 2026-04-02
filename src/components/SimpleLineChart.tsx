import React from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';

import { removeTrailingZeros } from '../lib/format';
import { colors, radii, spacing } from '../theme';

interface SimpleLineChartProps {
  points: { label: string; value: number }[];
  accent?: string;
  unitLabel?: string;
}

export function SimpleLineChart({
  points,
  accent = colors.accent,
  unitLabel = 'kg',
}: SimpleLineChartProps) {
  const [width, setWidth] = React.useState(0);
  const height = 220;
  const leftAxisWidth = 44;
  const chartPadding = 16;
  const plotWidth = Math.max(width - leftAxisWidth - chartPadding, 1);
  const plotHeight = height - chartPadding * 2;
  const values = points.map((point) => point.value);
  const firstValue = values[0] ?? 0;
  const rawMax = values.length ? Math.max(...values) : firstValue;
  const rawMin = values.length ? Math.min(...values) : firstValue;
  const rawSpread = Math.max(Math.abs(rawMax - rawMin), Math.max(1, Math.abs(firstValue) * 0.08));
  const padding = Math.max(1, rawSpread * 0.18);
  const max = rawMax + padding;
  const min = Math.max(0, rawMin - padding);
  const spread = Math.max(max - min, 1);
  const plotLeft = leftAxisWidth;
  const tickRatios = [0, 1 / 3, 2 / 3, 1];
  const yTicks = tickRatios.map((ratio) => ({
    ratio,
    y: chartPadding + plotHeight * ratio,
    value: max - spread * ratio,
  }));

  function handleLayout(event: LayoutChangeEvent) {
    setWidth(event.nativeEvent.layout.width);
  }

  const coordinates = points.map((point, index) => {
    const x = plotLeft + (points.length === 1 ? plotWidth / 2 : (index / Math.max(points.length - 1, 1)) * plotWidth);
    const y = chartPadding + plotHeight - ((point.value - min) / spread) * plotHeight;
    return { ...point, x, y };
  });

  return (
    <View style={styles.wrapper} onLayout={handleLayout}>
      <View style={styles.chartGlow} />
      <View style={styles.chartFrame}>
        {width > 0 ? (
          <>
            <View pointerEvents="none" style={styles.axisLabels}>
              {yTicks.map((tick) => (
                <Text key={tick.ratio} style={[styles.valueLabel, { top: tick.y - 8 }]}> 
                  {removeTrailingZeros(tick.value)} {unitLabel}
                </Text>
              ))}
            </View>
            <Svg width={width} height={height}>
              {yTicks.map((tick) => (
                <Line
                  key={tick.ratio}
                  x1={plotLeft}
                  x2={width - chartPadding}
                  y1={tick.y}
                  y2={tick.y}
                  stroke={colors.chartGrid}
                  strokeWidth={1}
                />
              ))}
              <Polyline
                points={coordinates.map((point) => `${point.x},${point.y}`).join(' ')}
                fill="none"
                stroke={accent}
                strokeWidth={3}
              />
              {coordinates.map((point, index) => (
                <Circle
                  key={`${point.label}-${point.value}-${index}`}
                  cx={point.x}
                  cy={point.y}
                  r={4}
                  fill={accent}
                />
              ))}
            </Svg>
          </>
        ) : null}
      </View>
      <View style={styles.footer}>
        <Text style={styles.dateLabel}>{points[0]?.label ?? ''}</Text>
        <Text style={styles.dateLabel}>{points[points.length - 1]?.label ?? ''}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(85, 138, 189, 0.18)',
    backgroundColor: 'rgba(18, 24, 33, 0.84)',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  chartGlow: {
    position: 'absolute',
    top: -36,
    right: -24,
    width: 120,
    height: 120,
    borderRadius: 120,
    backgroundColor: 'rgba(85, 138, 189, 0.14)',
  },
  chartFrame: {
    minHeight: 220,
  },
  axisLabels: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 44,
    height: 220,
  },
  valueLabel: {
    position: 'absolute',
    left: 0,
    width: 40,
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingLeft: 44,
  },
  dateLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
});
