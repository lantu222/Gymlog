import React, { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';

import { WeightWindowDay, buildWeightAxisTicks } from '../lib/bodyweightCard';
import { removeTrailingZeros } from '../lib/format';
import { Theme, useTheme, useThemedStyles } from '../theming';

/**
 * The weight curve over a run of CALENDAR days.
 *
 * Its own chart rather than `SimpleLineChart`, for one reason the shared one
 * cannot give: a day with no weigh-in has to keep its slot on the axis and
 * carry no point. The shared chart takes `{label, value}[]` and spaces the
 * entries evenly, so a gap of three weeks drew the same as a gap of one day —
 * and a single entry drew a flat line from edge to edge instead of one dot.
 */

const HEIGHT = 190;
const AXIS_WIDTH = 38;
const PAD_TOP = 12;
const PAD_BOTTOM = 26;

interface WeightTrendChartProps {
  days: WeightWindowDay[];
  /**
   * Unit for the axis labels. The weight card omits it (the card already says
   * kg); the measures section and the trends tab pass cm, % or kg.
   */
  unitLabel?: string;
}

export function WeightTrendChart({ days, unitLabel }: WeightTrendChartProps) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [width, setWidth] = useState(0);

  const onLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    setWidth((current) => (Math.abs(current - next) < 1 ? current : next));
  };

  const values = days.map((day) => day.value).filter((value): value is number => value !== null);
  const ticks = buildWeightAxisTicks(values);
  // "104 cm" needs more shoulder than "82,5".
  const axisWidth = unitLabel ? AXIS_WIDTH + 16 : AXIS_WIDTH;
  const plotWidth = Math.max(width - axisWidth, 1);
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const max = ticks.length ? ticks[0] : 1;
  const min = ticks.length ? ticks[ticks.length - 1] : 0;
  const span = Math.max(max - min, 0.1);

  // Each day owns a slot and sits in its middle, so the first and last dots do
  // not hug the card's edges.
  const slot = plotWidth / days.length;
  const xFor = (index: number) => axisWidth + slot * index + slot / 2;
  const yFor = (value: number) => PAD_TOP + plotHeight - ((value - min) / span) * plotHeight;

  const plotted = days
    .map((day, index) => (day.value === null ? null : { x: xFor(index), y: yFor(day.value) }))
    .filter((point): point is { x: number; y: number } => point !== null);

  // A week labels every day; a three-month window cannot — 90 day numbers
  // overlap into a smear. Thin to roughly eight, keeping today's.
  const labelStride = Math.max(1, Math.ceil(days.length / 8));
  const showLabel = (day: WeightWindowDay, index: number) => day.isToday || index % labelStride === 0;

  return (
    <View style={styles.wrap} onLayout={onLayout}>
      {width > 0 ? (
        <>
          <Svg width={width} height={HEIGHT}>
            {ticks.map((tick) => (
              <Line
                key={tick}
                x1={axisWidth}
                x2={width}
                y1={yFor(tick)}
                y2={yFor(tick)}
                stroke={theme.border}
                strokeWidth={1}
              />
            ))}
            {/* Two or more days with entries make a line; one makes a dot. */}
            {plotted.length > 1 ? (
              <Polyline
                points={plotted.map((point) => `${point.x},${point.y}`).join(' ')}
                fill="none"
                stroke={theme.highlight}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null}
            {plotted.map((point) => (
              <Circle
                key={`${point.x}-${point.y}`}
                cx={point.x}
                cy={point.y}
                r={5}
                fill={theme.surface}
                stroke={theme.highlight}
                strokeWidth={3}
              />
            ))}
          </Svg>

          <View style={styles.axisLabels} pointerEvents="none">
            {ticks.map((tick) => (
              <Text key={tick} style={[styles.axisLabel, { top: yFor(tick) - 8, width: axisWidth - 8 }]}>
                {unitLabel ? `${removeTrailingZeros(tick)} ${unitLabel}` : removeTrailingZeros(tick)}
              </Text>
            ))}
          </View>

          <View style={styles.footer} pointerEvents="none">
            {days.map((day, index) =>
              showLabel(day, index) ? (
                <Text
                  key={day.dayStart}
                  style={[styles.footerLabel, day.isToday && styles.footerLabelToday, { left: xFor(index) - 16 }]}
                >
                  {day.label}
                </Text>
              ) : null,
            )}
          </View>
        </>
      ) : null}
    </View>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  wrap: {
    height: HEIGHT,
    marginTop: 12,
  },
  axisLabels: {
    ...StyleSheet.absoluteFillObject,
  },
  axisLabel: {
    position: 'absolute',
    left: 0,
    width: AXIS_WIDTH - 8,
    textAlign: 'right',
    fontSize: 11.5,
    fontWeight: '600',
    color: theme.muted,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 2,
    height: 18,
  },
  footerLabel: {
    position: 'absolute',
    top: 0,
    width: 32,
    textAlign: 'center',
    fontSize: 11.5,
    fontWeight: '600',
    color: theme.faint,
  },
  footerLabelToday: {
    color: theme.highlight,
    fontWeight: '800',
  },
});
