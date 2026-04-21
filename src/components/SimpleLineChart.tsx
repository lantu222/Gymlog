import React from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';

import { removeTrailingZeros } from '../lib/format';
import { colors, radii, spacing } from '../theme';

interface SimpleLineChartProps {
  points: { label: string; value: number }[];
  accent?: string;
  unitLabel?: string;
  yTickValues?: number[];
  formatValueLabel?: (value: number, unitLabel: string) => string;
  emptyLabel?: string;
  showLine?: boolean;
  footerLabels?: string[];
  tooltipFormatter?: (point: { label: string; value: number; index: number }) => { title: string; value?: string };
  showFooter?: boolean;
}

export function SimpleLineChart({
  points,
  accent = '#16A34A',
  unitLabel = 'kg',
  yTickValues,
  formatValueLabel,
  emptyLabel = 'No data yet',
  showLine = true,
  footerLabels,
  tooltipFormatter,
  showFooter = true,
}: SimpleLineChartProps) {
  const [width, setWidth] = React.useState(0);
  const [selectedPointIndex, setSelectedPointIndex] = React.useState<number | null>(null);
  const height = 220;
  const leftAxisWidth = 44;
  const chartPadding = 16;
  const plotWidth = Math.max(width - leftAxisWidth - chartPadding, 1);
  const plotHeight = height - chartPadding * 2;
  const values = points.map((point) => point.value);
  const firstValue = values[0] ?? 0;
  const explicitTickMin = yTickValues?.length ? Math.min(...yTickValues) : null;
  const explicitTickMax = yTickValues?.length ? Math.max(...yTickValues) : null;
  const rawMax = values.length ? Math.max(...values) : firstValue;
  const rawMin = values.length ? Math.min(...values) : firstValue;
  const rawSpread = Math.max(Math.abs(rawMax - rawMin), Math.max(1, Math.abs(firstValue) * 0.08));
  const padding = Math.max(1, rawSpread * 0.18);
  const max = explicitTickMax ?? rawMax + padding;
  const min = explicitTickMin ?? Math.max(0, rawMin - padding);
  const spread = Math.max(max - min, 1);
  const plotLeft = leftAxisWidth;
  const tickRatios = [0, 1 / 3, 2 / 3, 1];
  const yTicks =
    yTickValues && yTickValues.length > 1
      ? yTickValues.map((value) => ({
          y: chartPadding + plotHeight - ((value - min) / spread) * plotHeight,
          value,
        }))
      : tickRatios.map((ratio) => ({
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
  const selectedPoint = selectedPointIndex !== null ? coordinates[selectedPointIndex] : null;
  const tooltip = selectedPoint && tooltipFormatter
    ? tooltipFormatter({ label: selectedPoint.label, value: selectedPoint.value, index: selectedPointIndex ?? 0 })
    : null;
  const resolvedFooterLabels = footerLabels?.filter(Boolean).length
    ? footerLabels.filter(Boolean)
    : [points[0]?.label ?? '', points[points.length - 1]?.label ?? ''].filter(Boolean);

  React.useEffect(() => {
    setSelectedPointIndex(null);
  }, [points]);

  return (
    <View style={styles.wrapper} onLayout={handleLayout}>
      <View style={styles.chartFrame}>
        {width > 0 ? (
          <>
            {points.length ? (
              <>
                <View pointerEvents="none" style={styles.axisLabels}>
                  {yTicks.map((tick) => (
                    <Text key={`${tick.value}`} style={[styles.valueLabel, { top: tick.y - 8 }]}>
                      {formatValueLabel ? formatValueLabel(tick.value, unitLabel) : `${removeTrailingZeros(tick.value)} ${unitLabel}`}
                    </Text>
                  ))}
                </View>
                <Svg width={width} height={height}>
                  {yTicks.map((tick) => (
                    <Line
                      key={`${tick.value}`}
                      x1={plotLeft}
                      x2={width - chartPadding}
                      y1={tick.y}
                      y2={tick.y}
                      stroke="#E5E7EB"
                      strokeWidth={1}
                    />
                  ))}
                  {showLine ? (
                    <Polyline
                      points={coordinates.map((point) => `${point.x},${point.y}`).join(' ')}
                      fill="none"
                      stroke={accent}
                      strokeWidth={3}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                  ) : null}
                  {coordinates.map((point, index) => (
                    <Circle
                      key={`${point.label}-${point.value}-${index}`}
                      cx={point.x}
                      cy={point.y}
                      r={showLine ? 4 : 5}
                      fill={accent}
                      onPress={() => setSelectedPointIndex((current) => (current === index ? null : index))}
                    />
                  ))}
                </Svg>
                {tooltip && selectedPoint ? (
                  <Pressable
                    style={[
                      styles.tooltipBubble,
                      {
                        left: Math.min(Math.max(selectedPoint.x - 52, plotLeft), Math.max(plotLeft, width - 112)),
                        top: Math.max(4, selectedPoint.y - 58),
                      },
                    ]}
                    onPress={() => setSelectedPointIndex(null)}
                  >
                    <Text style={styles.tooltipTitle}>{tooltip.title}</Text>
                    {tooltip.value ? <Text style={styles.tooltipValue}>{tooltip.value}</Text> : null}
                  </Pressable>
                ) : null}
              </>
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>{emptyLabel}</Text>
              </View>
            )}
          </>
        ) : null}
      </View>
      {points.length && showFooter ? (
        <View
          style={[
            styles.footer,
            resolvedFooterLabels.length === 1 && styles.footerSingle,
            resolvedFooterLabels.length === 3 && styles.footerThreeUp,
          ]}
        >
          {resolvedFooterLabels.map((label, index) => (
            <Text
              key={`${label}-${index}`}
              style={[
                styles.dateLabel,
                resolvedFooterLabels.length === 3 && index === 1 && styles.dateLabelCentered,
              ]}
            >
              {label}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  chartFrame: {
    minHeight: 220,
  },
  emptyState: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '700',
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
    color: '#6B7280',
    fontSize: 11,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingLeft: 44,
  },
  footerSingle: {
    justifyContent: 'center',
    paddingLeft: 0,
  },
  footerThreeUp: {
    alignItems: 'center',
  },
  tooltipBubble: {
    position: 'absolute',
    minWidth: 96,
    maxWidth: 128,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCFCE7',
    backgroundColor: '#F0FDF4',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  tooltipTitle: {
    color: '#166534',
    fontSize: 11,
    fontWeight: '800',
  },
  tooltipValue: {
    color: '#111827',
    fontSize: 12,
    fontWeight: '900',
    marginTop: 2,
  },
  dateLabel: {
    color: '#4B5563',
    fontSize: 12,
    fontWeight: '600',
  },
  dateLabelCentered: {
    textAlign: 'center',
  },
});
