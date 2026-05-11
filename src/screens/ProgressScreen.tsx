import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg';

import { EmptyState } from '../components/EmptyState';
import { BadgePill, SurfaceCard } from '../components/MainScreenPrimitives';
import { ProgressCard } from '../components/ProgressCard';
import { ScreenHeader } from '../components/ScreenHeader';
import { SimpleLineChart } from '../components/SimpleLineChart';
import { formatLiftDisplayLabel } from '../lib/displayLabel';
import { getLogSetStatusCounts } from '../lib/exerciseLog';
import {
  convertWeightFromKg,
  convertWeightToKg,
  formatDate,
  formatDurationMinutes,
  formatLogSetSummary,
  formatShortDate,
  formatTime,
  formatVolume,
  formatWeight,
  formatWeightTrend,
  parseNumberInput,
  removeTrailingZeros,
} from '../lib/format';
import {
  BodyweightProgressSummary,
  ExerciseProgressSummary,
  getExerciseProgressSignal,
} from '../lib/progression';
import { colors, layout, radii, shadows, spacing } from '../theme';
import { MeasurementEntry, MeasurementKind, MeasurementUnit, UnitPreference, WorkoutSession } from '../types/models';
import { AICoachFatigueSummary, AICoachPlateauSummary } from '../types/aiCoach';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ProgressScreenProps {
  summaries: ExerciseProgressSummary[];
  bodyweightProgress: BodyweightProgressSummary;
  measurementEntries: MeasurementEntry[];
  workoutSessions: WorkoutSession[];
  activityCalendar: {
    monthLabel: string;
    weekdayLabels: string[];
    weeks: Array<
      Array<{
        dayStart: number;
        dayNumber: number;
        active: boolean;
        isToday: boolean;
        inCurrentMonth: boolean;
      }>
    >;
  };
  currentWeekStreak: number;
  unitPreference: UnitPreference;
  selectedExerciseKey?: string;
  showBodyweightDetail?: boolean;
  onSelectExercise: (exerciseKey: string) => void;
  onSelectBodyweight: () => void;
  onAddBodyweight: (weightKg: number) => void;
  onAddMeasurement: (kind: MeasurementKind, value: number, unit: MeasurementUnit) => Promise<void>;
  onBack: () => void;
  plateaus?: AICoachPlateauSummary[];
  fatigue?: AICoachFatigueSummary;
}

type ProgressFilter = 'all' | 'new_best' | 'moving_up' | 'building' | 'below_last';
type OverviewRange = '1m' | '3m' | '6m' | 'all';
type OverviewMetric = 'bodyweight' | 'duration' | 'volume' | 'workouts';
type ProgressSection = 'overview' | 'tracked' | 'measures';
type MeasureKey = 'photos' | 'bodyweight' | 'bodyfat' | 'shoulders' | 'chest' | 'waist' | 'hips' | 'thighs';
type MeasureRange = '3m' | '1y' | 'all';

type MeasureGuide = {
  title: string;
  subtitle: string;
  instructions: string[];
  reference?: string;
};

const PROGRESS_FILTERS: Array<{ key: ProgressFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'new_best', label: 'New' },
  { key: 'moving_up', label: 'Up' },
  { key: 'building', label: 'Building' },
  { key: 'below_last', label: 'Below' },
];

const OVERVIEW_RANGES: Array<{ key: OverviewRange; label: string }> = [
  { key: '1m', label: '1M' },
  { key: '3m', label: '3M' },
  { key: '6m', label: '6M' },
  { key: 'all', label: 'All' },
];

const OVERVIEW_METRICS: Array<{ key: OverviewMetric; label: string }> = [
  { key: 'bodyweight', label: 'Bodyweight' },
  { key: 'duration', label: 'Duration' },
  { key: 'workouts', label: '🔥 Workouts' },
];

const PROGRESS_SECTIONS: Array<{ key: ProgressSection; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'tracked', label: 'Tracked' },
  { key: 'measures', label: 'Measures' },
];

const MEASURE_RANGES: Array<{ key: MeasureRange; label: string }> = [
  { key: '3m', label: '3M' },
  { key: '1y', label: '1Y' },
  { key: 'all', label: 'All' },
];

const MEASURE_KEY_TO_KIND: Record<Exclude<MeasureKey, 'photos' | 'bodyweight'>, MeasurementKind> = {
  bodyfat: 'bodyfat',
  shoulders: 'shoulders',
  chest: 'chest',
  waist: 'waist',
  hips: 'hips',
  thighs: 'thighs',
};

const CM_TO_IN = 0.393700787;
const PROGRESS_GREEN = '#238B18';
const PROGRESS_LIME = '#B8FF6A';
const PROGRESS_PALE_GREEN = '#CDEFC0';
const PROGRESS_CARD_BORDER = '#E7E8EA';
const PROGRESS_MUTED = '#4B5563';
const PROGRESS_WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'SA', 'SU'];

const MEASURE_GUIDES: Record<MeasureKey, MeasureGuide> = {
  photos: {
    title: 'Progress photos',
    subtitle: 'Use the same setup every time.',
    instructions: [
      'Use the same light, pose, distance, and camera height.',
      'Front, side, and back photos work best once every 2 to 4 weeks.',
      'Take them relaxed, not flexed, if you want cleaner comparison.',
    ],
  },
  bodyweight: {
    title: 'Body weight',
    subtitle: 'Best tracked against your own baseline.',
    instructions: [
      'Weigh at the same time of day, ideally in the morning after using the bathroom.',
      'Use the same scale and similar clothing conditions each time.',
      'Watch the weekly trend more than any single reading.',
    ],
  },
  bodyfat: {
    title: 'Body fat',
    subtitle: 'Use the same method every time.',
    instructions: [
      'If you use a smart scale, measure under similar hydration and timing conditions.',
      'If you use calipers or a scan, keep the method consistent between check-ins.',
      'Body fat is best for long-term trend checks, not daily decisions.',
    ],
    reference: 'General ACE-style ranges: men about 18-24% average, women about 25-31% average.',
  },
  shoulders: {
    title: 'Shoulders',
    subtitle: 'Track change from your own starting point.',
    instructions: [
      'Wrap the tape around the widest part of the shoulders and upper delts.',
      'Keep the tape level and relaxed, not pulled tight.',
      'Measure in the same posture each time.',
    ],
  },
  chest: {
    title: 'Chest',
    subtitle: 'Use nipple-line or fullest chest line consistently.',
    instructions: [
      'Wrap the tape around the fullest part of the chest.',
      'Stand tall and measure after a normal exhale.',
      'Keep the tape level across the back.',
    ],
  },
  waist: {
    title: 'Waist',
    subtitle: 'One of the most useful health trend measures.',
    instructions: [
      'Measure around the abdomen after a normal exhale.',
      'Keep the tape level and place it around the waistline or just above the top of the hip bones.',
      'Use the same landmark each time.',
    ],
    reference: 'General cutoffs often used: above 102 cm for men and above 88 cm for women suggests higher risk.',
  },
  hips: {
    title: 'Hips',
    subtitle: 'Best used for body-composition trend checks.',
    instructions: [
      'Measure around the widest part of the hips and glutes.',
      'Keep feet together and the tape level.',
      'Use the same stance and placement each time.',
    ],
  },
  thighs: {
    title: 'Thighs',
    subtitle: 'Use one fixed point on the upper thigh.',
    instructions: [
      'Measure the same thigh each time.',
      'Pick one consistent point, such as mid-thigh or a set distance below the hip crease.',
      'Stand relaxed and keep the tape snug, not tight.',
    ],
  },
};

function getSessionDurationMinutes(session: WorkoutSession) {
  if (typeof session.durationMinutes === 'number' && Number.isFinite(session.durationMinutes)) {
    return Math.max(0, session.durationMinutes);
  }

  if (session.startedAt) {
    const duration = Math.round((new Date(session.performedAt).getTime() - new Date(session.startedAt).getTime()) / 60000);
    if (Number.isFinite(duration) && duration > 0) {
      return duration;
    }
  }

  return 0;
}

function getSessionVolumeKg(session: WorkoutSession) {
  if (typeof session.totalVolumeKg === 'number' && Number.isFinite(session.totalVolumeKg)) {
    return Math.max(0, session.totalVolumeKg);
  }

  return 0;
}

function getOverviewRangeStart(range: OverviewRange) {
  const now = new Date();
  const start = new Date(now);

  switch (range) {
    case '1m':
      start.setMonth(start.getMonth() - 1);
      return start;
    case '3m':
      start.setMonth(start.getMonth() - 3);
      return start;
    case '6m':
      start.setMonth(start.getMonth() - 6);
      return start;
    case 'all':
    default:
      return null;
  }
}

function getOverviewDurationTicks(maxValue: number) {
  const top = maxValue <= 15 ? 15 : maxValue <= 30 ? 30 : maxValue <= 45 ? 45 : maxValue <= 60 ? 60 : 90;
  const step = top === 90 ? 30 : 15;
  return Array.from({ length: top / step + 1 }, (_, index) => index * step);
}

function getOverviewBodyweightTicks(values: number[], unitPreference: UnitPreference, range: OverviewRange) {
  if (!values.length) {
    return unitPreference === 'lb' ? [100, 102, 104, 106] : [50, 50.5, 51, 51.5];
  }

  const spread = Math.max(...values) - Math.min(...values);
  const step =
    unitPreference === 'lb'
      ? spread <= 4
        ? 1
        : spread <= 10
          ? 2
          : spread <= 25
            ? 5
            : 10
      : spread <= 2
        ? 0.5
        : spread <= 5
          ? 1
          : spread <= 10
            ? 2
            : spread <= 25
              ? 5
              : 10;

  let minTick = Math.floor(Math.min(...values) / step) * step;
  let maxTick = Math.ceil(Math.max(...values) / step) * step;

  while (Math.round((maxTick - minTick) / step) + 1 < 4) {
    minTick -= step;
    maxTick += step;
  }

  const ticks: number[] = [];
  for (let tick = minTick; tick <= maxTick + step / 2; tick += step) {
    ticks.push(Number(tick.toFixed(2)));
  }

  return ticks;
}

function formatOverviewBodyweightTick(value: number, unitLabel: string) {
  return `${removeTrailingZeros(Number(value.toFixed(unitLabel === 'lb' ? 0 : 1)))} ${unitLabel}`;
}

function formatDayMonthLabel(dateString: string) {
  const date = new Date(dateString);
  const month = new Intl.DateTimeFormat(undefined, { month: 'short' }).format(date);
  return `${date.getDate()} ${month}`;
}

function formatMonthLabel(dateString: string) {
  return new Intl.DateTimeFormat(undefined, { month: 'short' }).format(new Date(dateString));
}

function formatMonthYearLabel(dateString: string) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', year: '2-digit' }).format(new Date(dateString));
}

function formatOverviewChartLabel(dateString: string, range: OverviewRange) {
  switch (range) {
    case '1m':
    case '3m':
      return formatDayMonthLabel(dateString);
    case '6m':
      return formatMonthLabel(dateString);
    case 'all':
    default:
      return formatMonthYearLabel(dateString);
  }
}

function getOverviewFooterLabels(
  points: Array<{ label: string; value: number }>,
  range: OverviewRange,
) {
  if (!points.length) {
    return [];
  }

  if (points.length === 1) {
    return [formatOverviewChartLabel(points[0].label, range)];
  }

  const middleIndex = Math.floor((points.length - 1) / 2);
  const labels = [points[0].label];

  if (middleIndex > 0 && middleIndex < points.length - 1) {
    labels.push(points[middleIndex].label);
  }

  labels.push(points[points.length - 1].label);

  const formattedLabels = [...new Set(labels)].map((label) => formatOverviewChartLabel(label, range));
  return formattedLabels;
}

function getOverviewRangeSummary(range: OverviewRange, pointCount: number, metric: OverviewMetric) {
  const periodLabel =
    range === '1m' ? 'Last month' : range === '3m' ? 'Last 3 months' : range === '6m' ? 'Last 6 months' : 'All time';
  const noun = metric === 'bodyweight' ? 'entries' : 'days';
  return `${periodLabel} · ${pointCount} ${noun}`;
}

function formatDurationTick(value: number) {
  if (value === 60) {
    return '1h';
  }
  if (value > 60) {
    const hours = Math.floor(value / 60);
    const minutes = value % 60;
    return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return `${value}m`;
}

function getOverviewBucketKey(dateString: string, range: OverviewRange) {
  if (range === '6m' || range === 'all') {
    return new Date(dateString).toISOString().slice(0, 7);
  }

  return dateString.slice(0, 10);
}

function bucketOverviewPointsByRange(
  points: Array<{ label: string; value: number }>,
  range: OverviewRange,
  strategy: 'latest' | 'sum',
) {
  if ((range === '1m' || range === '3m') && strategy === 'sum') {
    return points;
  }

  const buckets = new Map<string, { label: string; value: number; timestamp: number }>();

  for (const point of points) {
    const bucketKey = getOverviewBucketKey(point.label, range);
    const timestamp = new Date(point.label).getTime();
    const current = buckets.get(bucketKey);

    if (!current) {
      buckets.set(bucketKey, {
        label: point.label,
        value: point.value,
        timestamp,
      });
      continue;
    }

    if (strategy === 'sum') {
      current.value += point.value;
      if (timestamp > current.timestamp) {
        current.timestamp = timestamp;
        current.label = point.label;
      }
      continue;
    }

    if (timestamp > current.timestamp) {
      current.timestamp = timestamp;
      current.label = point.label;
      current.value = point.value;
    }
  }

  return [...buckets.values()]
    .sort((left, right) => left.timestamp - right.timestamp)
    .map(({ label, value }) => ({ label, value }));
}

function convertMeasurementValue(value: number, fromUnit: MeasurementUnit, toUnit: MeasurementUnit) {
  if (fromUnit === toUnit) {
    return value;
  }

  if (fromUnit === '%' || toUnit === '%') {
    return value;
  }

  return fromUnit === 'cm' && toUnit === 'in' ? value * CM_TO_IN : value / CM_TO_IN;
}

function formatMeasurementValue(value: number | null | undefined, unit: MeasurementUnit) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '-';
  }

  const rounded = unit === '%' ? value.toFixed(1) : value >= 100 ? value.toFixed(0) : value.toFixed(1);
  return `${rounded.replace(/\.0$/, '')} ${unit}`;
}

function getMeasurementTicks(values: number[], unit: MeasurementUnit) {
  if (!values.length) {
    return unit === '%' ? [0, 5, 10, 15, 20, 25] : [0, 20, 40, 60, 80, 100];
  }

  const max = Math.max(...values);

  if (unit === '%') {
    const top = Math.max(25, Math.ceil(max / 5) * 5);
    return Array.from({ length: top / 5 + 1 }, (_, index) => index * 5);
  }

  if (unit === 'in') {
    const top = Math.max(40, Math.ceil(max / 5) * 5);
    return Array.from({ length: top / 5 + 1 }, (_, index) => index * 5);
  }

  const top = Math.max(100, Math.ceil(max / 10) * 10);
  return Array.from({ length: top / 10 + 1 }, (_, index) => index * 10);
}

function getMeasurementRangeStart(range: MeasureRange) {
  if (range === 'all') {
    return null;
  }

  const start = new Date();
  if (range === '3m') {
    start.setMonth(start.getMonth() - 3);
  } else {
    start.setFullYear(start.getFullYear() - 1);
  }
  return start;
}

function getMeasurementAxis(values: number[], unit: MeasurementUnit, range: MeasureRange) {
  if (!values.length) {
    const ticks = getMeasurementTicks(values, unit);
    return {
      ticks,
      minTick: ticks[0] ?? 0,
      maxTick: ticks[ticks.length - 1] ?? 1,
    };
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = max - min;

  let step = 5;
  if (unit === '%') {
    step = range === '3m' ? 5 : range === '1y' ? 10 : 25;
    if (spread <= 5) {
      step = Math.min(step, 5);
    }
  } else if (unit === 'cm') {
    step = range === '3m' ? 2 : range === '1y' ? 5 : 10;
    if (spread > 0 && spread <= step) {
      step = Math.max(1, Math.ceil(spread));
    }
  } else if (unit === 'in') {
    step = range === '3m' ? 1 : range === '1y' ? 2 : 5;
  }

  let minTick = Math.floor(min / step) * step;
  let maxTick = Math.ceil(max / step) * step;

  if (minTick === maxTick) {
    minTick -= step;
    maxTick += step;
  }

  if (unit === '%') {
    minTick = Math.max(0, minTick);
  }

  const ticks: number[] = [];
  for (let tick = minTick; tick <= maxTick; tick += step) {
    ticks.push(tick);
  }

  return { ticks, minTick, maxTick };
}

function SectionLabel({ label }: { label: string }) {
  return <Text style={styles.sectionLabel}>{label}</Text>;
}

function SignalCard({ label, value, meta }: { label: string; value: string; meta?: string | null }) {
  return (
    <View style={styles.signalCard}>
      <Text style={styles.signalLabel}>{label}</Text>
      <Text style={styles.signalValue}>{value}</Text>
      {meta ? <Text style={styles.signalMeta}>{meta}</Text> : null}
    </View>
  );
}

function RecentList({
  rows,
}: {
  rows: Array<{
    title: string;
    meta?: string | null;
    value: string;
  }>;
}) {
  return (
    <View style={styles.recentList}>
      {rows.map((row, rowIndex) => (
        <View key={`${row.title}:${rowIndex}`} style={[styles.recentRow, rowIndex > 0 && styles.recentRowBorder]}>
          <View style={styles.recentCopy}>
            <Text style={styles.recentTitle}>{row.title}</Text>
            {row.meta ? <Text style={styles.recentMeta}>{row.meta}</Text> : null}
          </View>
          <Text style={styles.recentValue}>{row.value}</Text>
        </View>
      ))}
    </View>
  );
}

function MeasureRow({
  icon,
  title,
  subtitle,
  value,
  onPress,
  active,
}: {
  icon: string;
  title: string;
  subtitle: string;
  value?: string;
  onPress?: () => void;
  active?: boolean;
}) {
  const content = (
    <View style={[styles.measureRow, active && styles.measureRowActive]}>
      <View style={[styles.measureRowIconShell, active && styles.measureRowIconShellActive]}>
        <Text style={styles.measureRowIconText}>{icon}</Text>
      </View>
      <View style={styles.measureRowCopy}>
        <Text style={styles.measureRowTitle}>{title}</Text>
        <Text style={styles.measureRowSubtitle}>{subtitle}</Text>
      </View>
      {value ? <Text style={styles.measureRowValue}>{value}</Text> : null}
    </View>
  );

  if (onPress) {
    return <Pressable onPress={onPress}>{content}</Pressable>;
  }

  return content;
}

function MeasureGuideCard({
  guide,
}: {
  guide: MeasureGuide;
}) {
  return (
    <View style={styles.measureGuideCard}>
      <Text style={styles.measureGuideSectionLabel}>How to measure</Text>

      <View style={styles.measureInstructionList}>
        {guide.instructions.map((instruction) => (
          <View key={instruction} style={styles.measureInstructionRow}>
            <View style={styles.measureInstructionDot} />
            <Text style={styles.measureInstructionText}>{instruction}</Text>
          </View>
        ))}
      </View>

      {guide.reference ? (
        <View style={styles.measureReferenceNote}>
          <Text style={styles.measureReferenceText}>{guide.reference}</Text>
        </View>
      ) : null}
    </View>
  );
}

function MeasurementHistoryRail({
  values,
  unit,
  range,
}: {
  values: number[];
  unit: MeasurementUnit;
  range: MeasureRange;
}) {
  const [chartWidth, setChartWidth] = useState(0);

  if (!values.length) {
    return (
      <View style={styles.measureHistoryEmpty}>
        <Text style={styles.measureHistoryEmptyText}>No entries yet</Text>
      </View>
    );
  }

  const { ticks, minTick, maxTick } = getMeasurementAxis(values, unit, range);
  const spread = Math.max(maxTick - minTick, 1);
  const chartHeight = 124;
  const labelWidth = 32;
  const contentLeft = labelWidth + spacing.sm;
  const plotWidth = Math.max(chartWidth - contentLeft, 0);
  const points = values.map((value, index) => {
    const x = values.length === 1 ? contentLeft + plotWidth / 2 : contentLeft + (index / (values.length - 1)) * plotWidth;
    const y = chartHeight - ((value - minTick) / spread) * chartHeight;
    return { x, y };
  });
  const polylinePoints = points.map((point) => `${point.x},${point.y}`).join(' ');

  return (
    <View style={styles.measureHistoryRailWrap}>
      <View
        style={styles.measureHistoryRail}
        onLayout={(event) => setChartWidth(event.nativeEvent.layout.width)}
      >
        {ticks
          .slice()
          .reverse()
          .map((tick) => {
            const y = chartHeight - ((tick - minTick) / spread) * chartHeight;
            return (
              <View key={`tick-${tick}`} style={[styles.measureHistoryTickRow, { top: y - 8 }]}>
                <Text style={styles.measureHistoryTickLabel}>{`${tick}${unit === '%' ? '%' : ''}`}</Text>
                <View style={styles.measureHistoryTickLine} />
              </View>
            );
          })}
        {chartWidth > 0 ? (
          <Svg style={styles.measureHistorySvg} width={chartWidth} height={chartHeight}>
            {points.length > 1 ? (
              <Polyline
                points={polylinePoints}
                fill="none"
                stroke="#16A34A"
                strokeWidth="2"
              />
            ) : null}
            {points.map((point, index) => (
              <Circle
                key={`point-${index}`}
                cx={point.x}
                cy={point.y}
                r="5"
                fill="#16A34A"
                stroke="#FFFFFF"
                strokeWidth="2"
              />
            ))}
          </Svg>
        ) : null}
      </View>
    </View>
  );
}

function getSignalPriority(kind: ReturnType<typeof getExerciseProgressSignal>['kind']) {
  switch (kind) {
    case 'new_best':
      return 0;
    case 'moving_up':
      return 1;
    case 'below_last':
      return 2;
    case 'building':
      return 3;
    case 'starting':
    default:
      return 4;
  }
}

function compareProgressSummaries(left: ExerciseProgressSummary, right: ExerciseProgressSummary) {
  const priorityDelta =
    getSignalPriority(getExerciseProgressSignal(left).kind) - getSignalPriority(getExerciseProgressSignal(right).kind);
  if (priorityDelta !== 0) {
    return priorityDelta;
  }

  const leftDate = left.latestLog ? new Date(left.latestLog.performedAt).getTime() : 0;
  const rightDate = right.latestLog ? new Date(right.latestLog.performedAt).getTime() : 0;
  return rightDate - leftDate;
}

function getPrimaryProgressMeta(summary: ExerciseProgressSummary | null, unitPreference: UnitPreference) {
  if (!summary) {
    return 'Track one lift while logging and it shows up here.';
  }

  const signal = getExerciseProgressSignal(summary);
  const parts = [
    signal.label,
    summary.latestWeight !== null ? formatWeight(summary.latestWeight, unitPreference) : null,
    summary.latestLog ? formatShortDate(summary.latestLog.performedAt) : null,
  ].filter(Boolean);

  return parts.join(' · ');
}

function ProgressCalendarIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Rect x="4" y="5.5" width="16" height="15" rx="3" stroke="#111111" strokeWidth={2} />
      <Path d="M8 3.5V8" stroke="#111111" strokeWidth={2} strokeLinecap="round" />
      <Path d="M16 3.5V8" stroke="#111111" strokeWidth={2} strokeLinecap="round" />
      <Path d="M4.8 10H19.2" stroke="#111111" strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function FlameMark({ size = 42, color = PROGRESS_GREEN }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <Path
        d="M25.2 44C15.9 44 9 37.7 9 28.8C9 20.2 16.2 15.6 18.5 8.2C19 6.6 21.3 6.7 21.8 8.3C22.6 11 24.1 13.4 26.3 15.3C27.9 12.5 28.8 9.3 28.5 5.8C28.4 4.2 30.3 3.3 31.4 4.5C36 9.5 40 16.3 40 25.2C40 36.1 33.5 44 25.2 44Z"
        fill={color}
      />
      <Path
        d="M24.4 42C20 42 16.8 39 16.8 34.9C16.8 31.7 18.9 29.2 20.9 26.6C21.7 29.1 23.3 31.2 25.5 32.7C27.1 30.8 28 28.5 28 25.8C31 28.3 32.6 31.4 32.6 34.8C32.6 39 29.3 42 24.4 42Z"
        fill="#DDF8D2"
      />
    </Svg>
  );
}

function ProgressTrendMiniChart({ points }: { points: Array<{ label: string; value: number }> }) {
  const values = points.map((point) => point.value);
  const chartWidth = 266;
  const chartHeight = 112;

  if (values.length < 2) {
    return (
      <View style={styles.trendChartEmpty}>
        <Text style={styles.trendChartEmptyText}>Log more workouts to draw the trend.</Text>
      </View>
    );
  }

  const min = Math.min(0, ...values);
  const max = Math.max(...values, 1);
  const spread = Math.max(max - min, 1);
  const coordinates = values.map((value, index) => {
    const x = values.length === 1 ? chartWidth / 2 : (index / (values.length - 1)) * chartWidth;
    const y = chartHeight - ((value - min) / spread) * (chartHeight - 12) - 6;
    return { x, y };
  });
  const polyline = coordinates.map((point) => `${point.x},${point.y}`).join(' ');
  const fillPoints = `0,${chartHeight} ${polyline} ${chartWidth},${chartHeight}`;

  return (
    <View style={styles.trendChartWrap}>
      <Svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none">
        {[0.25, 0.5, 0.75].map((line) => (
          <Line
            key={line}
            x1={0}
            x2={chartWidth}
            y1={chartHeight * line}
            y2={chartHeight * line}
            stroke="#E5E7EB"
            strokeWidth={1}
          />
        ))}
        <Polyline points={fillPoints} fill="rgba(35, 139, 24, 0.14)" stroke="none" />
        <Polyline points={polyline} fill="none" stroke="#159A31" strokeWidth={4} strokeLinejoin="round" strokeLinecap="round" />
      </Svg>
      <View style={styles.trendFooterLabels}>
        <Text style={styles.trendFooterText}>Mar</Text>
        <Text style={styles.trendFooterText}>Apr</Text>
        <Text style={styles.trendFooterText}>May</Text>
      </View>
    </View>
  );
}

function PlateauAlertCard({ plateaus, unitPreference }: { plateaus: AICoachPlateauSummary[]; unitPreference: UnitPreference }) {
  const primary = plateaus[0];
  const extra = plateaus.length - 1;
  const weightLabel = primary.topWeightKg !== null ? `${primary.topWeightKg} ${unitPreference}` : null;

  return (
    <View style={styles.alertCard}>
      <View style={[styles.alertAccentBar, styles.alertAccentOrange]} />
      <View style={styles.alertRow}>
        <Text style={styles.alertKickerOrange}>Plateau detected</Text>
        <View style={styles.alertBadgeOrange}>
          <Text style={styles.alertBadgeTextOrange}>{primary.stagnantSessions} sessions</Text>
        </View>
      </View>
      <Text style={styles.alertTitle}>{primary.name}</Text>
      <Text style={styles.alertBody}>
        {weightLabel ? `Stuck at ${weightLabel} with no improvement.` : 'No weight increase detected.'}
        {extra > 0 ? ` Plus ${extra} more lift${extra === 1 ? '' : 's'}.` : ''}
        {' '}Try a deload week or variation.
      </Text>
    </View>
  );
}

function FatigueAlertCard({ fatigue }: { fatigue: AICoachFatigueSummary }) {
  const isHigh = fatigue.signal === 'high';
  return (
    <View style={styles.alertCard}>
      <View style={[styles.alertAccentBar, isHigh ? styles.alertAccentRose : styles.alertAccentOrange]} />
      <View style={styles.alertRow}>
        <Text style={isHigh ? styles.alertKickerRose : styles.alertKickerOrange}>
          {isHigh ? 'High load' : 'Elevated load'}
        </Text>
        <View style={isHigh ? styles.alertBadgeRose : styles.alertBadgeOrange}>
          <Text style={isHigh ? styles.alertBadgeTextRose : styles.alertBadgeTextOrange}>ACWR {fatigue.acwr}</Text>
        </View>
      </View>
      <Text style={styles.alertTitle}>Recovery score {fatigue.recoveryScore}/100</Text>
      <Text style={styles.alertBody}>
        Load is above the safe zone (0.8–1.3). Consider a lighter week before it compounds.
      </Text>
    </View>
  );
}

export function ProgressScreen({
  summaries,
  bodyweightProgress,
  measurementEntries,
  workoutSessions,
  activityCalendar,
  currentWeekStreak,
  unitPreference,
  selectedExerciseKey,
  showBodyweightDetail,
  onSelectExercise,
  onSelectBodyweight,
  onAddBodyweight,
  onAddMeasurement,
  onBack,
  plateaus,
  fatigue,
}: ProgressScreenProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [bodyweightInput, setBodyweightInput] = useState('');
  const [progressQuery, setProgressQuery] = useState('');
  const [progressFilter, setProgressFilter] = useState<ProgressFilter>('all');
  const [overviewRange, setOverviewRange] = useState<OverviewRange>('3m');
  const [overviewMetric, setOverviewMetric] = useState<OverviewMetric>('duration');
  const [progressSection, setProgressSection] = useState<ProgressSection>('overview');
  const [selectedMeasure, setSelectedMeasure] = useState<Exclude<MeasureKey, 'photos' | 'bodyweight'> | null>(null);
  const [measureInput, setMeasureInput] = useState('');
  const [measureUnit, setMeasureUnit] = useState<MeasurementUnit>('cm');
  const [measureRange, setMeasureRange] = useState<MeasureRange>('3m');
  const selectedSummary = summaries.find((summary) => summary.key === selectedExerciseKey);
  const selectedSummaryDisplayName = selectedSummary ? formatLiftDisplayLabel(selectedSummary.name) : '';
  const stackSignalRow = width < 420;
  const calendarMonthLabel = useMemo(() => {
    const currentMonthDay = activityCalendar.weeks
      .flat()
      .find((day) => day.inCurrentMonth);

    if (!currentMonthDay) {
      return activityCalendar.monthLabel;
    }

    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      year: 'numeric',
    }).format(new Date(currentMonthDay.dayStart));
  }, [activityCalendar.monthLabel, activityCalendar.weeks]);

  const chartPoints = useMemo(
    () =>
      selectedSummary
        ? [...selectedSummary.logs]
            .reverse()
            .map((log) => ({
              label: formatShortDate(log.performedAt),
              value: convertWeightFromKg(log.weight, unitPreference),
            }))
        : [],
    [selectedSummary, unitPreference],
  );

  const bodyweightChartPoints = useMemo(
    () =>
      [...bodyweightProgress.entries]
        .reverse()
        .map((entry) => ({
          label: entry.recordedAt,
          value: convertWeightFromKg(entry.weight, unitPreference),
        })),
    [bodyweightProgress.entries, unitPreference],
  );

  const signalCounts = useMemo(
    () =>
      summaries.reduce(
        (counts, summary) => {
          const signal = getExerciseProgressSignal(summary);
          counts[signal.kind] += 1;
          return counts;
        },
        {
          new_best: 0,
          moving_up: 0,
          below_last: 0,
          building: 0,
          starting: 0,
        },
      ),
    [summaries],
  );

  const filteredSummaries = useMemo(() => {
    const normalizedQuery = progressQuery.trim().toLowerCase();

    return summaries.filter((summary) => {
      const signal = getExerciseProgressSignal(summary);
      if (progressFilter !== 'all' && signal.kind !== progressFilter) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return formatLiftDisplayLabel(summary.name).toLowerCase().includes(normalizedQuery);
    });
  }, [progressFilter, progressQuery, summaries]);

  const prioritizedSummaries = useMemo(() => [...summaries].sort(compareProgressSummaries), [summaries]);
  const primarySummary = prioritizedSummaries[0] ?? null;
  const primarySummaryName = primarySummary ? formatLiftDisplayLabel(primarySummary.name) : 'Start tracking one lift';
  const primarySummaryMeta = useMemo(
    () => getPrimaryProgressMeta(primarySummary, unitPreference),
    [primarySummary, unitPreference],
  );
  const selectedSummaryLatestContext = useMemo(() => {
    if (!selectedSummary?.latestLog) {
      return null;
    }

    const statusCounts = getLogSetStatusCounts(selectedSummary.latestLog);
    const statusSummary = [
      statusCounts.completed > 0 ? `${statusCounts.completed} completed` : null,
      statusCounts.skipped > 0 ? `${statusCounts.skipped} skipped` : null,
      statusCounts.pending > 0 ? `${statusCounts.pending} pending` : null,
    ]
      .filter(Boolean)
      .join(' · ');

    if (!selectedSummary.latestLog.swappedFrom && !selectedSummary.latestLog.notes && !statusSummary) {
      return null;
    }

    return {
      sessionLabel: `${selectedSummary.latestLog.workoutNameSnapshot} · ${formatShortDate(selectedSummary.latestLog.performedAt)}`,
      swapLine: selectedSummary.latestLog.swappedFrom
        ? `Swapped from ${formatLiftDisplayLabel(selectedSummary.latestLog.swappedFrom)}`
        : null,
      notesLine: selectedSummary.latestLog.notes ?? null,
      statusLine: statusSummary ? `Set detail: ${statusSummary}` : null,
    };
  }, [selectedSummary]);

  const overviewChart = useMemo(() => {
    const start = getOverviewRangeStart(overviewRange);

    if (overviewMetric === 'bodyweight') {
      const entries = [...bodyweightProgress.entries]
        .filter((entry) => !start || new Date(entry.recordedAt) >= start)
        .reverse();

      const points = bucketOverviewPointsByRange(
        entries.map((entry) => ({
          label: entry.recordedAt,
          value: convertWeightFromKg(entry.weight, unitPreference),
        })),
        overviewRange,
        'latest',
      );

      return {
        title: overviewMetric,
        valueLabel: points.length ? formatWeight(bodyweightProgress.latest?.weight, unitPreference) : 'No entries',
        unitLabel: unitPreference,
        points,
        footerLabels: getOverviewFooterLabels(points, overviewRange),
        rangeSummary: getOverviewRangeSummary(overviewRange, points.length, overviewMetric),
        yTickValues: getOverviewBodyweightTicks(points.map((point) => point.value), unitPreference, overviewRange),
        formatValueLabel: (value: number, unitLabel: string) => formatOverviewBodyweightTick(value, unitLabel),
        tooltipFormatter: (point: { label: string; value: number }) => ({
          title: formatDate(point.label),
          value: `${formatTime(point.label)} · ${formatWeight(
            unitPreference === 'lb' ? convertWeightToKg(point.value, 'lb') : point.value,
            unitPreference,
          )}`,
        }),
        accent: '#5B9AF2',
        emptyLabel: 'No bodyweight entries yet',
      };
    }

    const grouped = new Map<string, { performedAt: string; duration: number; volume: number; workouts: number }>();
    for (const session of workoutSessions) {
      const performedAt = new Date(session.performedAt);
      if (start && performedAt < start) {
        continue;
      }

      const key = performedAt.toISOString().slice(0, 10);
      const bucket = grouped.get(key) ?? {
        performedAt: session.performedAt,
        duration: 0,
        volume: 0,
        workouts: 0,
      };

      bucket.duration += getSessionDurationMinutes(session);
      bucket.volume += getSessionVolumeKg(session);
      bucket.workouts += 1;
      grouped.set(key, bucket);
    }

    const rows = [...grouped.values()].sort(
      (left, right) => new Date(left.performedAt).getTime() - new Date(right.performedAt).getTime(),
    );

    if (overviewMetric === 'duration') {
      const points = bucketOverviewPointsByRange(
        rows.map((row) => ({
          label: row.performedAt,
          value: row.duration,
        })),
        overviewRange,
        'sum',
      );
      const totalDuration = points.reduce((sum, point) => sum + point.value, 0);
      return {
        title: overviewMetric,
        valueLabel: formatDurationMinutes(totalDuration),
        unitLabel: 'min',
        points,
        footerLabels: getOverviewFooterLabels(points, overviewRange),
        rangeSummary: getOverviewRangeSummary(overviewRange, points.length, overviewMetric),
        yTickValues: getOverviewDurationTicks(Math.max(...points.map((point) => point.value), 0)),
        formatValueLabel: (value: number) => formatDurationTick(value),
        tooltipFormatter: (point: { label: string; value: number }) => ({
          title: formatDate(point.label),
          value: formatDurationMinutes(point.value),
        }),
        accent: '#5B9AF2',
        emptyLabel: 'No workout durations yet',
      };
    }

    if (overviewMetric === 'volume') {
      const points = bucketOverviewPointsByRange(
        rows.map((row) => ({
          label: row.performedAt,
          value: convertWeightFromKg(row.volume, unitPreference),
        })),
        overviewRange,
        'sum',
      );
      return {
        title: overviewMetric,
        valueLabel: formatVolume(rows.reduce((sum, row) => sum + row.volume, 0), unitPreference),
        unitLabel: unitPreference,
        points,
        footerLabels: getOverviewFooterLabels(points, overviewRange),
        rangeSummary: getOverviewRangeSummary(overviewRange, points.length, overviewMetric),
        yTickValues: undefined,
        formatValueLabel: undefined,
        tooltipFormatter: (point: { label: string; value: number }) => ({
          title: formatDate(point.label),
          value: formatVolume(
            unitPreference === 'lb' ? convertWeightToKg(point.value, 'lb') : point.value,
            unitPreference,
          ),
        }),
        accent: '#5B9AF2',
        emptyLabel: 'No volume data yet',
      };
    }

    const points = bucketOverviewPointsByRange(
      rows.map((row) => ({
        label: row.performedAt,
        value: row.workouts,
      })),
      overviewRange,
      'sum',
    );
    return {
      title: overviewMetric,
      valueLabel: `${rows.reduce((sum, row) => sum + row.workouts, 0)}`,
      unitLabel: 'sessions',
      points,
      footerLabels: getOverviewFooterLabels(points, overviewRange),
      rangeSummary: getOverviewRangeSummary(overviewRange, points.length, overviewMetric),
      yTickValues: [0, 1, 2, 3, 4, 5, 6],
      formatValueLabel: (value: number) => `${value}`,
      tooltipFormatter: (point: { label: string; value: number }) => ({
        title: formatDate(point.label),
        value: `${point.value} workouts`,
      }),
      accent: '#F97316',
      emptyLabel: 'No workouts completed yet',
    };
  }, [bodyweightProgress.entries, bodyweightProgress.latest?.weight, overviewMetric, overviewRange, unitPreference, workoutSessions]);

  const progressOverviewStats = useMemo(() => {
    const currentMonthDay = activityCalendar.weeks.flat().find((day) => day.inCurrentMonth);
    const monthStart = currentMonthDay ? new Date(currentMonthDay.dayStart) : new Date();
    const monthEnd = new Date(monthStart);
    monthEnd.setMonth(monthEnd.getMonth() + 1);
    const previousMonthStart = new Date(monthStart);
    previousMonthStart.setMonth(previousMonthStart.getMonth() - 1);

    const currentMonthSessions = workoutSessions.filter((session) => {
      const performedAt = new Date(session.performedAt);
      return performedAt >= monthStart && performedAt < monthEnd;
    });
    const previousMonthSessions = workoutSessions.filter((session) => {
      const performedAt = new Date(session.performedAt);
      return performedAt >= previousMonthStart && performedAt < monthStart;
    });

    const totalDuration = workoutSessions.reduce((sum, session) => sum + getSessionDurationMinutes(session), 0);
    const averageDuration = workoutSessions.length ? Math.round(totalDuration / workoutSessions.length) : 0;
    const monthDelta =
      previousMonthSessions.length > 0
        ? Math.round(((currentMonthSessions.length - previousMonthSessions.length) / previousMonthSessions.length) * 100)
        : currentMonthSessions.length > 0
          ? 100
          : 0;

    return {
      workoutsThisMonth: currentMonthSessions.length,
      previousMonthWorkouts: previousMonthSessions.length,
      totalWorkouts: workoutSessions.length,
      totalDuration,
      averageDuration,
      monthDelta,
    };
  }, [activityCalendar.weeks, workoutSessions]);

  const activityCalendarDays = useMemo(() => activityCalendar.weeks.flat(), [activityCalendar.weeks]);

  const progressOverTimePoints = useMemo(() => {
    const start = new Date();
    start.setMonth(start.getMonth() - 3);
    const grouped = new Map<string, number>();

    workoutSessions.forEach((session) => {
      const performedAt = new Date(session.performedAt);
      if (performedAt < start) {
        return;
      }
      const key = performedAt.toISOString().slice(0, 10);
      grouped.set(key, (grouped.get(key) ?? 0) + 1);
    });

    let runningTotal = 0;
    return [...grouped.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([label, count]) => {
        runningTotal += count;
        return { label, value: runningTotal };
      });
  }, [workoutSessions]);

  const recentHighlight = useMemo(() => {
    const best = prioritizedSummaries.find((summary) => getExerciseProgressSignal(summary).kind === 'new_best') ?? prioritizedSummaries[0] ?? null;
    if (!best) {
      return null;
    }

    return {
      title: getExerciseProgressSignal(best).kind === 'new_best' ? 'New personal best' : 'Best tracked lift',
      lift: formatLiftDisplayLabel(best.name),
      value: best.bestReps ? `${best.bestReps} reps` : formatWeight(best.bestWeight, unitPreference),
      meta: best.latestLog ? formatShortDate(best.latestLog.performedAt) : 'Latest log',
    };
  }, [prioritizedSummaries, unitPreference]);

  const topLiftRows = useMemo(
    () =>
      prioritizedSummaries.slice(0, 3).map((summary) => ({
        key: summary.key,
        title: formatLiftDisplayLabel(summary.name),
        value: summary.bestReps ? `${summary.bestReps} reps` : formatWeight(summary.bestWeight, unitPreference),
        meta: summary.latestLog ? formatShortDate(summary.latestLog.performedAt) : 'Best set',
      })),
    [prioritizedSummaries, unitPreference],
  );

  const selectedMeasureKind = selectedMeasure ? MEASURE_KEY_TO_KIND[selectedMeasure] : null;
  const selectedMeasureEntries = useMemo(() => {
    if (!selectedMeasureKind) {
      return [];
    }

    return [...measurementEntries]
      .filter((entry) => entry.kind === selectedMeasureKind)
      .sort((left, right) => new Date(right.recordedAt).getTime() - new Date(left.recordedAt).getTime());
  }, [measurementEntries, selectedMeasureKind]);
  const selectedMeasureGuide = selectedMeasure ? MEASURE_GUIDES[selectedMeasure] : null;
  const selectedMeasureLatest = selectedMeasureEntries[0] ?? null;
  const selectedMeasureVisibleEntries = useMemo(() => {
    const start = getMeasurementRangeStart(measureRange);
    const filtered = start
      ? selectedMeasureEntries.filter((entry) => new Date(entry.recordedAt).getTime() >= start.getTime())
      : selectedMeasureEntries;
    return filtered.slice().reverse();
  }, [measureRange, selectedMeasureEntries]);
  const selectedMeasureDisplayValue = selectedMeasureLatest
    ? formatMeasurementValue(
        convertMeasurementValue(selectedMeasureLatest.value, selectedMeasureLatest.unit, measureUnit),
        measureUnit,
      )
    : undefined;
  const selectedMeasureHistory = selectedMeasureVisibleEntries
    .map((entry) => convertMeasurementValue(entry.value, entry.unit, measureUnit));
  const selectedMeasureChange = selectedMeasureHistory.length >= 2 ? selectedMeasureHistory[selectedMeasureHistory.length - 1] - selectedMeasureHistory[0] : null;

  function openMeasureSheet(key: Exclude<MeasureKey, 'photos' | 'bodyweight'>) {
    const latest = [...measurementEntries]
      .filter((entry) => entry.kind === MEASURE_KEY_TO_KIND[key])
      .sort((left, right) => new Date(right.recordedAt).getTime() - new Date(left.recordedAt).getTime())[0];
    const nextUnit: MeasurementUnit = key === 'bodyfat' ? '%' : latest?.unit === 'in' ? 'in' : 'cm';
    setSelectedMeasure(key);
    setMeasureRange('3m');
    setMeasureUnit(nextUnit);
    setMeasureInput(latest ? removeTrailingZeros(convertMeasurementValue(latest.value, latest.unit, nextUnit)) : '');
  }

  async function handleSaveMeasurement() {
    if (!selectedMeasureKind || !selectedMeasure) {
      return;
    }

    const parsed = parseNumberInput(measureInput);
    if (!parsed || parsed <= 0) {
      return;
    }

    await onAddMeasurement(selectedMeasureKind, parsed, measureUnit);
    setMeasureInput('');
  }

  if (showBodyweightDetail) {
    const latest = bodyweightProgress.latest;
    const previous = bodyweightProgress.previous;

    return (
      <>
        <ScreenHeader title="Bodyweight" subtitle="Latest change." onBack={onBack} tone="dark" />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <SurfaceCard accent="neutral" emphasis="hero" style={styles.heroSurface}>
            <View style={styles.heroContent}>
              <Text style={styles.heroKicker}>Bodyweight</Text>

              <View style={styles.heroBadgeRow}>
                <BadgePill accent="neutral" label={formatWeight(latest?.weight, unitPreference)} />
                <BadgePill
                  accent="neutral"
                  label={formatWeightTrend(latest?.weight ?? null, previous?.weight ?? null, unitPreference)}
                />
                <BadgePill accent="neutral" label={`${bodyweightProgress.entries.length} entries`} />
              </View>

              <View style={styles.heroCopy}>
                <Text style={styles.heroTitle}>Keep the trend clean</Text>
                <Text style={styles.heroMeta}>
                  {latest ? `Latest ${formatShortDate(latest.recordedAt)}` : 'Add one number to start the line.'}
                </Text>
              </View>
            </View>
          </SurfaceCard>

          <SurfaceCard accent="neutral" emphasis="standard" style={styles.detailEntryCard}>
            <View style={styles.detailHeader}>
              <Text style={styles.detailKicker}>Bodyweight</Text>
              <Text style={styles.detailTitle}>Log a new entry</Text>
              <Text style={styles.detailBody}>Add one number and keep the trend clean.</Text>
            </View>

            <View style={styles.bodyweightEntryRow}>
              <TextInput
                value={bodyweightInput}
                onChangeText={setBodyweightInput}
                keyboardType="decimal-pad"
                placeholder={`0 ${unitPreference}`}
                placeholderTextColor={colors.textMuted}
                style={styles.bodyweightInput}
                selectionColor="#F4FAFF"
              />
              <Pressable
                onPress={() => {
                  const parsed = parseNumberInput(bodyweightInput);
                  if (!parsed) {
                    return;
                  }

                  onAddBodyweight(convertWeightToKg(parsed, unitPreference));
                  setBodyweightInput('');
                }}
                style={styles.bodyweightButton}
              >
                <Text style={styles.bodyweightButtonText}>Add</Text>
              </Pressable>
            </View>
          </SurfaceCard>

          <View style={[styles.signalRow, stackSignalRow && styles.signalRowStacked]}>
            <SignalCard
              label="Latest"
              value={formatWeight(latest?.weight, unitPreference)}
              meta={latest ? formatShortDate(latest.recordedAt) : null}
            />
            <SignalCard
              label="Change"
              value={formatWeightTrend(latest?.weight ?? null, previous?.weight ?? null, unitPreference)}
              meta={previous ? `Previous ${formatWeight(previous.weight, unitPreference)}` : 'Need one more entry'}
            />
          </View>

          <SurfaceCard accent="neutral" emphasis="utility" style={styles.chartCard}>
            <Text style={styles.detailSectionLabel}>Trend</Text>
            <SimpleLineChart
              points={bodyweightChartPoints}
              unitLabel={unitPreference}
              accent="#5B9AF2"
              showLine={false}
              showFooter={false}
              tooltipFormatter={(point) => ({
                title: formatDate(point.label),
                value: `${formatTime(point.label)} · ${formatWeight(
                  unitPreference === 'lb' ? convertWeightToKg(point.value, 'lb') : point.value,
                  unitPreference,
                )}`,
              })}
            />
          </SurfaceCard>

          <SurfaceCard accent="neutral" emphasis="utility" style={styles.recentCard}>
            <Text style={styles.detailSectionLabel}>Recent entries</Text>
            <RecentList
              rows={bodyweightProgress.entries.slice(0, 5).map((entry) => ({
                title: formatDate(entry.recordedAt),
                value: formatWeight(entry.weight, unitPreference),
              }))}
            />
          </SurfaceCard>
        </ScrollView>
      </>
    );
  }

  if (selectedSummary) {
    const selectedSignal = getExerciseProgressSignal(selectedSummary);
    return (
      <>
        <ScreenHeader title={selectedSummaryDisplayName} subtitle="Latest change." onBack={onBack} tone="dark" />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <SurfaceCard accent="neutral" emphasis="hero" style={styles.heroSurface}>
            <View style={styles.heroContent}>
              <Text style={styles.heroKicker}>Lift detail</Text>

              <View style={styles.heroBadgeRow}>
                <BadgePill accent="neutral" label={selectedSignal.label} />
                <BadgePill accent="neutral" label={formatWeight(selectedSummary.latestWeight, unitPreference)} />
                <BadgePill accent="neutral" label={formatWeight(selectedSummary.bestWeight, unitPreference)} />
              </View>

              <View style={styles.heroCopy}>
                <Text style={styles.heroTitle}>{selectedSummaryDisplayName}</Text>
                <Text style={styles.heroMeta}>
                  {selectedSummary.latestLog
                    ? `${formatLogSetSummary(selectedSummary.latestLog, unitPreference)} · ${formatShortDate(selectedSummary.latestLog.performedAt)}`
                    : 'No tracked sets yet.'}
                </Text>
              </View>
            </View>
          </SurfaceCard>

          {selectedSummaryLatestContext ? (
            <SurfaceCard accent="neutral" emphasis="flat" style={styles.contextCard}>
              <Text style={styles.contextKicker}>Last session</Text>
              <Text style={styles.contextTitle}>{selectedSummaryLatestContext.sessionLabel}</Text>
              {selectedSummaryLatestContext.swapLine ? (
                <Text style={styles.contextBody}>{selectedSummaryLatestContext.swapLine}</Text>
              ) : null}
              {selectedSummaryLatestContext.statusLine ? (
                <Text style={styles.contextBody}>{selectedSummaryLatestContext.statusLine}</Text>
              ) : null}
              {selectedSummaryLatestContext.notesLine ? (
                <Text style={styles.contextBody}>{selectedSummaryLatestContext.notesLine}</Text>
              ) : null}
            </SurfaceCard>
          ) : null}

          <View style={[styles.signalRow, stackSignalRow && styles.signalRowStacked]}>
            <SignalCard
              label="Latest"
              value={formatWeight(selectedSummary.latestWeight, unitPreference)}
              meta={selectedSummary.latestLog ? formatShortDate(selectedSummary.latestLog.performedAt) : null}
            />
            <SignalCard
              label="Best"
              value={formatWeight(selectedSummary.bestWeight, unitPreference)}
              meta={selectedSummary.bestReps ? `${selectedSummary.bestReps} total reps` : null}
            />
            <SignalCard
              label="Change"
              value={formatWeightTrend(selectedSummary.latestWeight, selectedSummary.previousWeight, unitPreference)}
              meta={selectedSummary.previousWeight !== null ? 'vs previous log' : 'Need one more log'}
            />
          </View>

          <SurfaceCard accent="neutral" emphasis="utility" style={styles.chartCard}>
            <Text style={styles.detailSectionLabel}>Trend</Text>
            <SimpleLineChart points={chartPoints} unitLabel={unitPreference} accent="#5B9AF2" />
          </SurfaceCard>

          <SurfaceCard accent="neutral" emphasis="utility" style={styles.recentCard}>
            <Text style={styles.detailSectionLabel}>Recent logs</Text>
            <RecentList
              rows={selectedSummary.logs.slice(0, 5).map((log) => ({
                title: formatDate(log.performedAt),
                meta: formatLogSetSummary(log, unitPreference),
                value: formatWeight(log.weight, unitPreference),
              }))}
            />
          </SurfaceCard>
        </ScrollView>
      </>
    );
  }

  return (
    <>
      <View style={styles.progressHeader}>
        <View style={styles.progressHeaderCopy}>
          <Text style={styles.progressHeaderTitle}>Progress</Text>
          <Text style={styles.progressHeaderSubtitle}>Track your consistency. See your progress.</Text>
        </View>
        <Pressable style={styles.progressHeaderAction}>
          <ProgressCalendarIcon />
        </Pressable>
      </View>
      <View style={styles.sectionRail}>
        {PROGRESS_SECTIONS.map((section) => {
          const active = section.key === progressSection;
          return (
            <Pressable
              key={section.key}
              onPress={() => setProgressSection(section.key)}
              style={styles.sectionChip}
            >
              <Text style={[styles.sectionChipText, active && styles.sectionChipTextActive]}>{section.label}</Text>
              {active ? <View style={styles.sectionChipUnderline} /> : null}
            </Pressable>
          );
        })}
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {progressSection === 'overview' ? (
          <>
            {plateaus && plateaus.length > 0 ? <PlateauAlertCard plateaus={plateaus} unitPreference={unitPreference} /> : null}
            {fatigue && (fatigue.signal === 'elevated' || fatigue.signal === 'high') ? <FatigueAlertCard fatigue={fatigue} /> : null}
            <View style={styles.streakHeroCard}>
              <View style={styles.streakHeroCopy}>
                <Text style={styles.streakHeroKicker}>This is your progress</Text>
                <Text style={styles.streakHeroTitle}>{currentWeekStreak || 0} week streak</Text>
                <Text style={styles.streakHeroBody}>You're building momentum. Keep it up!</Text>
              </View>
              <FlameMark />
            </View>

            <View style={styles.activityCard}>
              <View style={styles.referenceCardHeader}>
                <Text style={styles.referenceCardTitle}>Activity</Text>
                <Text style={styles.referenceCardAction}>{calendarMonthLabel} 〉</Text>
              </View>
              <View style={styles.activityStatsRow}>
                <View>
                  <Text style={styles.activityStatLabel}>Workouts this month</Text>
                  <Text style={styles.activityStatValue}>{progressOverviewStats.workoutsThisMonth}</Text>
                </View>
                <View style={styles.activityDeltaBlock}>
                  <Text style={styles.activityStatLabel}>vs last month</Text>
                  <Text style={styles.activityDeltaValue}>
                    {progressOverviewStats.monthDelta >= 0 ? '+' : ''}
                    {progressOverviewStats.monthDelta}%
                  </Text>
                </View>
              </View>
              <View style={styles.activityHeatmap}>
                <View style={styles.activityHeatmapLabelRow}>
                  {PROGRESS_WEEKDAY_LABELS.map((label, index) => (
                    <Text key={`${label}:${index}`} style={styles.activityHeatmapLabel}>
                      {label}
                    </Text>
                  ))}
                </View>
                <View style={styles.activityCalendarGrid}>
                  {activityCalendarDays.map((day) => {
                    const workout = day.active;
                    const planned = !workout && day.inCurrentMonth && day.dayNumber % 2 === 1;
                    return (
                      <View key={day.dayStart} style={styles.activityCalendarCell}>
                        <View
                          style={[
                            styles.activityCalendarBubble,
                            workout && styles.activityCalendarWorkout,
                            planned && styles.activityCalendarPlanned,
                            !day.inCurrentMonth && styles.activityCalendarOutside,
                            day.isToday && styles.activityCalendarToday,
                          ]}
                        >
                          <Text style={[styles.activityCalendarText, !day.inCurrentMonth && styles.activityCalendarTextMuted]}>
                            {day.dayNumber}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
              <View style={styles.referenceLegend}>
                <View style={styles.referenceLegendItem}>
                  <View style={[styles.referenceLegendDot, styles.referenceLegendWorkout]} />
                  <Text style={styles.referenceLegendText}>Workout</Text>
                </View>
                <View style={styles.referenceLegendItem}>
                  <View style={[styles.referenceLegendDot, styles.referenceLegendPlanned]} />
                  <Text style={styles.referenceLegendText}>Planned</Text>
                </View>
                <View style={styles.referenceLegendItem}>
                  <View style={[styles.referenceLegendDot, styles.referenceLegendRest]} />
                  <Text style={styles.referenceLegendText}>Rest</Text>
                </View>
              </View>
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.referenceCardTitle}>Summary</Text>
              <View style={styles.summaryMetricGrid}>
                <View style={styles.summaryMetricTile}>
                  <Text style={styles.summaryMetricIcon}>◷</Text>
                  <View>
                    <Text style={styles.summaryMetricLabel}>Total duration</Text>
                    <Text style={styles.summaryMetricValue}>{formatDurationMinutes(progressOverviewStats.totalDuration)}</Text>
                    <Text style={styles.summaryMetricDelta}>+1h 20m</Text>
                  </View>
                </View>
                <View style={styles.summaryMetricTile}>
                  <Text style={styles.summaryMetricIcon}>▣</Text>
                  <View>
                    <Text style={styles.summaryMetricLabel}>Workouts</Text>
                    <Text style={styles.summaryMetricValue}>{progressOverviewStats.totalWorkouts}</Text>
                    <Text style={styles.summaryMetricDelta}>+{progressOverviewStats.workoutsThisMonth}</Text>
                  </View>
                </View>
                <View style={styles.summaryMetricTile}>
                  <Text style={styles.summaryMetricIcon}>↯</Text>
                  <View>
                    <Text style={styles.summaryMetricLabel}>Avg. workout time</Text>
                    <Text style={styles.summaryMetricValue}>{progressOverviewStats.averageDuration} min</Text>
                    <Text style={styles.summaryMetricDelta}>+4 min</Text>
                  </View>
                </View>
                <View style={styles.summaryMetricTile}>
                  <Text style={styles.summaryMetricIcon}>☆</Text>
                  <View>
                    <Text style={styles.summaryMetricLabel}>Tracked lifts</Text>
                    <Text style={styles.summaryMetricValue}>{summaries.length}</Text>
                    <Text style={styles.summaryMetricDelta}>
                      {signalCounts.new_best > 0 ? `+${signalCounts.new_best}` : `${signalCounts.moving_up} moving`}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {recentHighlight ? (
              <View style={styles.highlightCard}>
                <View style={styles.referenceCardHeader}>
                  <Text style={styles.referenceCardTitle}>Recent highlights</Text>
                  <Text style={styles.referenceSeeAll}>See all</Text>
                </View>
                <View style={styles.highlightRow}>
                  <View style={styles.prBadge}>
                    <Text style={styles.prBadgeText}>PR</Text>
                  </View>
                  <View style={styles.highlightCopy}>
                    <Text style={styles.highlightTitle}>{recentHighlight.title}</Text>
                    <Text style={styles.highlightMeta}>{recentHighlight.lift}</Text>
                  </View>
                  <View style={styles.highlightValueBlock}>
                    <Text style={styles.highlightValue}>{recentHighlight.value}</Text>
                    <Text style={styles.highlightMeta}>{recentHighlight.meta}</Text>
                  </View>
                </View>
              </View>
            ) : null}

            <View style={styles.calendarCard}>
              <Text style={styles.calendarMonthTitle}>{calendarMonthLabel}</Text>
              <View style={styles.calendarWeekdayRow}>
                {PROGRESS_WEEKDAY_LABELS.map((label, index) => (
                  <Text key={`${label}:${index}`} style={styles.calendarWeekdayLabel}>
                    {label}
                  </Text>
                ))}
              </View>
              <View style={styles.calendarGrid}>
                {activityCalendar.weeks.flat().map((day) => {
                  const dayPillStyles = [styles.calendarDayPill, day.isToday && styles.calendarDayPillToday];
                  const dayTextStyles = [
                    styles.calendarDayText,
                    !day.inCurrentMonth && styles.calendarDayTextMuted,
                    day.isToday && styles.calendarDayTextToday,
                  ];

                  return (
                    <View key={day.dayStart} style={styles.calendarDayCell}>
                      <View style={dayPillStyles}>
                        <Text style={dayTextStyles}>{day.dayNumber}</Text>
                        {day.active ? <Text style={styles.calendarFlame}>🔥</Text> : null}
                      </View>
                    </View>
                  );
                })}
              </View>
              <View style={styles.calendarFooter}>
                <Text style={styles.calendarFooterLabel}>Your streak</Text>
                <Text style={styles.calendarFooterValue}>
                  {currentWeekStreak} {currentWeekStreak === 1 ? 'week' : 'weeks'}
                </Text>
              </View>
            </View>

            <View style={styles.snapshotGrid}>
              <Pressable onPress={onSelectBodyweight} style={[styles.snapshotCard, styles.snapshotCardLarge]}>
                <Text style={styles.snapshotLabel}>Bodyweight</Text>
                <Text style={styles.snapshotValue}>{formatWeight(bodyweightProgress.latest?.weight, unitPreference)}</Text>
                <Text style={styles.snapshotTrend}>
                  {formatWeightTrend(
                    bodyweightProgress.latest?.weight ?? null,
                    bodyweightProgress.previous?.weight ?? null,
                    unitPreference,
                  )}
                </Text>
              </Pressable>

              <View style={styles.snapshotCard}>
                <Text style={styles.snapshotLabel}>Tracked lifts</Text>
                <Text style={styles.snapshotValue}>{summaries.length}</Text>
                <Text style={styles.snapshotTrend}>
                  {signalCounts.new_best > 0 ? `${signalCounts.new_best} new best` : `${signalCounts.moving_up} moving`}
                </Text>
              </View>
            </View>

            <View style={styles.weekStreakCard}>
              <View style={styles.weekStreakHeader}>
                <FlameMark size={34} />
                <View>
                  <Text style={styles.weekStreakTitle}>{currentWeekStreak || 0} week streak</Text>
                  <Text style={styles.weekStreakMeta}>Keep it going!</Text>
                </View>
              </View>
              <View style={styles.weekStreakSteps}>
                {['Apr 14-20', 'Apr 21-27', 'Apr 28-May 4', 'May 5-11', 'This week'].map((label, index) => {
                  const complete = index < Math.min(currentWeekStreak, 4);
                  return (
                    <View key={label} style={styles.weekStep}>
                      <View style={[styles.weekStepCircle, complete ? styles.weekStepComplete : styles.weekStepPending]}>
                        <Text style={styles.weekStepCheck}>{complete ? '✓' : ''}</Text>
                      </View>
                      <Text style={styles.weekStepLabel}>{label}</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            <View style={styles.progressOverTimeCard}>
              <View style={styles.referenceCardHeader}>
                <Text style={styles.referenceCardTitle}>Progress over time</Text>
                <Pressable style={styles.chartMetricPill}>
                  <Text style={styles.chartMetricPillText}>Workouts⌄</Text>
                </Pressable>
              </View>
              <View style={styles.progressTrendStats}>
                <View>
                  <Text style={styles.progressTrendValue}>{progressOverviewStats.totalWorkouts}</Text>
                  <Text style={styles.progressTrendMeta}>Last 3 months</Text>
                </View>
                <View style={styles.activityDeltaBlock}>
                  <Text style={styles.activityDeltaValue}>
                    {progressOverviewStats.monthDelta >= 0 ? '+' : ''}
                    {progressOverviewStats.monthDelta}%
                  </Text>
                  <Text style={styles.progressTrendMeta}>vs previous 3 months</Text>
                </View>
              </View>
              <ProgressTrendMiniChart points={progressOverTimePoints} />
            </View>

            {topLiftRows.length ? (
              <View style={styles.topLiftsCard}>
                <View style={styles.referenceCardHeader}>
                  <Text style={styles.referenceCardTitle}>Top lifts</Text>
                  <Text style={styles.referenceSeeAll}>See all</Text>
                </View>
                {topLiftRows.map((row) => (
                  <Pressable key={row.key} onPress={() => onSelectExercise(row.key)} style={styles.topLiftRow}>
                    <Text style={styles.topLiftIcon}>↗</Text>
                    <View style={styles.topLiftCopy}>
                      <Text style={styles.topLiftTitle}>{row.title}</Text>
                      <Text style={styles.topLiftMeta}>Best set</Text>
                    </View>
                    <View style={styles.highlightValueBlock}>
                      <Text style={styles.highlightValue}>{row.value}</Text>
                      <Text style={styles.highlightMeta}>{row.meta}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : null}

          </>
        ) : null}

        {progressSection === 'tracked' ? (
          <>
            <Pressable
              onPress={() => {
                if (primarySummary) {
                  onSelectExercise(primarySummary.key);
                }
              }}
              style={[styles.primarySignalCard, !primarySummary && styles.primarySignalCardEmpty]}
            >
              <Text style={styles.primarySignalKicker}>Tracking</Text>
              <Text style={styles.primarySignalTitle}>{primarySummaryName}</Text>
              <Text style={styles.primarySignalBody}>{primarySummaryMeta}</Text>
            </Pressable>

            <View style={styles.browseSurface}>
              <TextInput
                value={progressQuery}
                onChangeText={setProgressQuery}
                placeholder="Search tracked lifts"
                placeholderTextColor="#6B7280"
                selectionColor="#16A34A"
                style={styles.searchInputLight}
              />
              <View style={styles.filterRow}>
                {PROGRESS_FILTERS.map((filter) => {
                  const active = filter.key === progressFilter;
                  return (
                    <Pressable
                      key={filter.key}
                      onPress={() => setProgressFilter(filter.key)}
                      style={[styles.filterChipLight, active && styles.filterChipLightActive]}
                    >
                      <Text style={[styles.filterChipTextLight, active && styles.filterChipTextLightActive]}>
                        {filter.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {summaries.length === 0 ? (
              <View style={styles.trackedEmptyState}>
                <Text style={styles.trackedEmptyTitle}>No tracked lifts yet</Text>
                <Text style={styles.trackedEmptyBody}>Star one exercise or track it while logging and it shows up here.</Text>
              </View>
            ) : filteredSummaries.length ? (
              <View style={styles.progressList}>
                <View style={styles.listHeaderRow}>
                  <SectionLabel label="Tracked progress" />
                  <Text style={styles.listMetaText}>{filteredSummaries.length} lifts</Text>
                </View>
                {filteredSummaries.map((summary) => (
                  <ProgressCard
                    key={summary.key}
                    summary={summary}
                    unitPreference={unitPreference}
                    onPress={() => onSelectExercise(summary.key)}
                  />
                ))}
              </View>
            ) : (
              <View style={styles.trackedEmptyState}>
                <Text style={styles.trackedEmptyTitle}>No tracked lifts match this view</Text>
                <Text style={styles.trackedEmptyBody}>Try a broader search or switch the signal filter.</Text>
              </View>
            )}
          </>
        ) : null}

        {progressSection === 'measures' ? (
          <>
            <View style={styles.measureSection}>
              <Text style={styles.measureSectionLabel}>Progress Photos</Text>
              <View style={styles.measureListCard}>
                <MeasureRow
                  icon="PH"
                  title="Progress Photos"
                  subtitle="Add photo"
                />
              </View>
            </View>

            <View style={styles.measureSection}>
              <Text style={styles.measureSectionLabel}>My Measurements</Text>
              <View style={styles.measureListCard}>
                <MeasureRow
                  icon="BW"
                  title="Body weight"
                  subtitle={bodyweightProgress.entries.length > 0 ? 'Open tracking' : 'Add measurement'}
                  value={bodyweightChartPoints.length ? formatWeight(bodyweightProgress.latest?.weight, unitPreference) : undefined}
                  onPress={onSelectBodyweight}
                />
                <View style={styles.measureDivider} />
                <MeasureRow
                  icon="BF"
                  title="Body fat"
                  subtitle="Add measurement"
                  active={selectedMeasure === 'bodyfat'}
                  onPress={() => openMeasureSheet('bodyfat')}
                />
                <View style={styles.measureDivider} />
                <MeasureRow
                  icon="SH"
                  title="Shoulders"
                  subtitle="Add measurement"
                  active={selectedMeasure === 'shoulders'}
                  onPress={() => openMeasureSheet('shoulders')}
                />
                <View style={styles.measureDivider} />
                <MeasureRow
                  icon="CH"
                  title="Chest"
                  subtitle="Add measurement"
                  active={selectedMeasure === 'chest'}
                  onPress={() => openMeasureSheet('chest')}
                />
                <View style={styles.measureDivider} />
                <MeasureRow
                  icon="WS"
                  title="Waist"
                  subtitle="Add measurement"
                  active={selectedMeasure === 'waist'}
                  onPress={() => openMeasureSheet('waist')}
                />
                <View style={styles.measureDivider} />
                <MeasureRow
                  icon="HP"
                  title="Hips"
                  subtitle="Add measurement"
                  active={selectedMeasure === 'hips'}
                  onPress={() => openMeasureSheet('hips')}
                />
                <View style={styles.measureDivider} />
                <MeasureRow
                  icon="TH"
                  title="Thighs"
                  subtitle="Add measurement"
                  active={selectedMeasure === 'thighs'}
                  onPress={() => openMeasureSheet('thighs')}
                />
              </View>
            </View>
          </>
        ) : null}
      </ScrollView>
      <Modal visible={Boolean(selectedMeasure)} transparent animationType="slide" onRequestClose={() => setSelectedMeasure(null)}>
        <View style={styles.sheetBackdrop}>
          <Pressable style={styles.sheetBackdropHit} onPress={() => setSelectedMeasure(null)} />
          <View style={[styles.sheetSurface, { paddingTop: insets.top + spacing.md, paddingBottom: Math.max(insets.bottom, spacing.xl) }]}>
            {selectedMeasureGuide ? (
              <>
                <View style={styles.sheetHeader}>
                  <View style={styles.sheetHeaderCopy}>
                    <Text style={styles.sheetTitle}>{selectedMeasureGuide.title}</Text>
                    <Text style={styles.sheetSubtitle}>{selectedMeasureGuide.subtitle}</Text>
                  </View>
                  <Pressable onPress={() => setSelectedMeasure(null)} style={styles.sheetCloseButton}>
                    <Text style={styles.sheetCloseButtonText}>X</Text>
                  </Pressable>
                </View>

                <ScrollView
                  style={styles.sheetScroll}
                  contentContainerStyle={styles.sheetScrollContent}
                  showsVerticalScrollIndicator={false}
                >
                  <MeasureGuideCard guide={selectedMeasureGuide} />

                  <View style={styles.measureEntryCard}>
                    <View style={styles.measureEntryHeader}>
                      <Text style={styles.measureEntryTitle}>Add measurement</Text>
                      <View style={styles.measureUnitRail}>
                        {(selectedMeasure === 'bodyfat' ? ['%'] : ['cm', 'in']).map((unit) => {
                          const active = measureUnit === unit;
                          return (
                            <Pressable
                              key={unit}
                              onPress={() => setMeasureUnit(unit as MeasurementUnit)}
                              style={[styles.measureUnitChip, active && styles.measureUnitChipActive]}
                            >
                              <Text style={[styles.measureUnitChipText, active && styles.measureUnitChipTextActive]}>{unit}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>

                    <View style={styles.measureInputRow}>
                      <TextInput
                        value={measureInput}
                        onChangeText={setMeasureInput}
                        keyboardType="decimal-pad"
                        placeholder={`0 ${measureUnit}`}
                        placeholderTextColor="#9CA3AF"
                        selectionColor="#16A34A"
                        style={styles.measureTextInput}
                      />
                      <Pressable onPress={() => void handleSaveMeasurement()} style={styles.measureSaveButton}>
                        <Text style={styles.measureSaveButtonText}>Save</Text>
                      </Pressable>
                    </View>

                    <View style={styles.measureSummaryRow}>
                      <View style={styles.measureSummaryItem}>
                        <Text style={styles.measureSummaryLabel}>Latest</Text>
                        <Text style={styles.measureSummaryValue}>{selectedMeasureDisplayValue ?? '-'}</Text>
                      </View>
                      <View style={styles.measureSummaryItem}>
                        <Text style={styles.measureSummaryLabel}>Change</Text>
                        <Text style={styles.measureSummaryValue}>
                          {selectedMeasureChange === null
                            ? '-'
                            : `${selectedMeasureChange > 0 ? '+' : ''}${removeTrailingZeros(selectedMeasureChange)}${measureUnit}`}
                        </Text>
                      </View>
                      <View style={styles.measureSummaryItem}>
                        <Text style={styles.measureSummaryLabel}>Entries</Text>
                        <Text style={styles.measureSummaryValue}>{selectedMeasureVisibleEntries.length}</Text>
                      </View>
                    </View>

                    <View style={styles.measureRangeRail}>
                      {MEASURE_RANGES.map((range) => {
                        const active = measureRange === range.key;
                        return (
                          <Pressable
                            key={range.key}
                            onPress={() => setMeasureRange(range.key)}
                            style={[styles.measureRangeChip, active && styles.measureRangeChipActive]}
                          >
                            <Text style={[styles.measureRangeChipText, active && styles.measureRangeChipTextActive]}>{range.label}</Text>
                          </Pressable>
                        );
                      })}
                    </View>

                    {!selectedMeasureHistory.length ? (
                      <Text style={styles.measureEntryMeta}>
                        {`Start with your first ${selectedMeasureGuide.title.toLowerCase()} entry.`}
                      </Text>
                    ) : null}

                    <MeasurementHistoryRail values={selectedMeasureHistory} unit={measureUnit} range={measureRange} />
                  </View>
                </ScrollView>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    backgroundColor: '#FFFFFF',
  },
  progressHeaderCopy: {
    flex: 1,
    gap: 6,
  },
  progressHeaderTitle: {
    color: '#050505',
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  progressHeaderSubtitle: {
    color: PROGRESS_MUTED,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '600',
  },
  progressHeaderAction: {
    width: 54,
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2F3F5',
  },
  sectionRail: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  sectionChip: {
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  sectionChipText: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '700',
  },
  sectionChipTextActive: {
    color: '#111111',
    fontWeight: '900',
  },
  sectionChipUnderline: {
    height: 3,
    borderRadius: 999,
    backgroundColor: '#0E2B16',
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: layout.bottomTabBarReserve,
    paddingTop: spacing.sm,
    gap: spacing.md,
    backgroundColor: '#FFFFFF',
  },
  streakHeroCard: {
    minHeight: 120,
    borderRadius: 16,
    backgroundColor: '#0D0D0D',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
    ...shadows.card,
  },
  streakHeroCopy: {
    flex: 1,
    gap: 6,
  },
  streakHeroKicker: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  streakHeroTitle: {
    color: '#FFFFFF',
    fontSize: 32,
    lineHeight: 36,
    fontWeight: '900',
    letterSpacing: -1,
  },
  streakHeroBody: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
  referenceCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  referenceCardTitle: {
    color: '#111111',
    fontSize: 18,
    fontWeight: '900',
  },
  referenceCardAction: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '800',
  },
  referenceSeeAll: {
    color: '#058226',
    fontSize: 13,
    fontWeight: '900',
  },
  activityCard: {
    gap: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PROGRESS_CARD_BORDER,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    ...shadows.card,
  },
  activityStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  activityStatLabel: {
    color: PROGRESS_MUTED,
    fontSize: 13,
    fontWeight: '700',
  },
  activityStatValue: {
    color: '#050505',
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  activityDeltaBlock: {
    alignItems: 'flex-end',
    gap: 4,
  },
  activityDeltaValue: {
    color: '#0B9A36',
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  activityHeatmap: {
    gap: spacing.sm,
  },
  activityHeatmapLabelRow: {
    flexDirection: 'row',
  },
  activityHeatmapGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.xs,
  },
  activityCalendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.xs,
  },
  activityHeatmapLabel: {
    width: `${100 / 7}%`,
    color: '#374151',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  activityHeatmapCell: {
    width: `${100 / 7}%`,
    alignItems: 'center',
  },
  activityCalendarCell: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 34,
  },
  activityCalendarBubble: {
    width: 31,
    height: 31,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityCalendarWorkout: {
    backgroundColor: PROGRESS_PALE_GREEN,
  },
  activityCalendarPlanned: {
    backgroundColor: '#E5F7DD',
  },
  activityCalendarOutside: {
    backgroundColor: 'transparent',
  },
  activityCalendarToday: {
    borderWidth: 2,
    borderColor: '#EF4444',
  },
  activityCalendarText: {
    color: '#111111',
    fontSize: 13,
    fontWeight: '900',
  },
  activityCalendarTextMuted: {
    color: '#9CA3AF',
  },
  activityHeatmapSquare: {
    width: 18,
    height: 18,
    borderRadius: 5,
  },
  activityHeatmapWorkout: {
    backgroundColor: PROGRESS_GREEN,
  },
  activityHeatmapActive: {
    backgroundColor: PROGRESS_PALE_GREEN,
  },
  activityHeatmapRest: {
    backgroundColor: '#ECEEF1',
  },
  referenceLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  referenceLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  referenceLegendDot: {
    width: 13,
    height: 13,
    borderRadius: 999,
  },
  referenceLegendWorkout: {
    backgroundColor: PROGRESS_GREEN,
  },
  referenceLegendPlanned: {
    backgroundColor: PROGRESS_PALE_GREEN,
  },
  referenceLegendRest: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
  },
  referenceLegendText: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '700',
  },
  summaryCard: {
    gap: spacing.lg,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: PROGRESS_CARD_BORDER,
    backgroundColor: '#FFFFFF',
    padding: spacing.xl,
    ...shadows.card,
  },
  summaryMetricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  summaryMetricTile: {
    width: '47.8%',
    minHeight: 128,
    borderRadius: 14,
    backgroundColor: '#F6F7F9',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  summaryMetricIcon: {
    color: PROGRESS_GREEN,
    fontSize: 30,
    fontWeight: '900',
  },
  summaryMetricLabel: {
    color: PROGRESS_MUTED,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  summaryMetricValue: {
    color: '#050505',
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '900',
    letterSpacing: -0.7,
  },
  summaryMetricDelta: {
    color: '#0B9A36',
    fontSize: 13,
    fontWeight: '900',
  },
  highlightCard: {
    gap: spacing.lg,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: PROGRESS_CARD_BORDER,
    backgroundColor: '#FFFFFF',
    padding: spacing.xl,
    ...shadows.card,
  },
  highlightRow: {
    minHeight: 92,
    borderRadius: 14,
    backgroundColor: '#F7F8FA',
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  prBadge: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  prBadgeText: {
    color: '#0B9A36',
    fontSize: 18,
    fontWeight: '900',
  },
  highlightCopy: {
    flex: 1,
    gap: 4,
  },
  highlightTitle: {
    color: '#111111',
    fontSize: 17,
    fontWeight: '900',
  },
  highlightMeta: {
    color: PROGRESS_MUTED,
    fontSize: 14,
    fontWeight: '700',
  },
  highlightValueBlock: {
    alignItems: 'flex-end',
    gap: 4,
  },
  highlightValue: {
    color: '#111111',
    fontSize: 16,
    fontWeight: '900',
  },
  summaryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  summaryHeaderCopy: {
    flex: 1,
    gap: 2,
  },
  summaryTitle: {
    color: '#111111',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  summaryMeta: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '700',
  },
  rangeRail: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: '#F3F4F6',
  },
  rangeChip: {
    flex: 1,
    minHeight: 42,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rangeChipActive: {
    backgroundColor: '#FFFFFF',
  },
  rangeChipText: {
    color: '#4B5563',
    fontSize: 13,
    fontWeight: '800',
  },
  rangeChipTextActive: {
    color: '#111111',
  },
  chartOverviewCard: {
    gap: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    padding: spacing.lg,
    ...shadows.card,
  },
  chartOverviewTitle: {
    color: '#111111',
    fontSize: 16,
    fontWeight: '800',
  },
  chartOverviewValue: {
    color: '#111111',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  chartOverviewMeta: {
    color: '#4B5563',
    fontSize: 13,
    fontWeight: '600',
    marginTop: -4,
  },
  calendarCard: {
    display: 'none',
    gap: spacing.sm,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    padding: spacing.lg,
    ...shadows.card,
  },
  calendarMonthTitle: {
    color: '#111111',
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  calendarWeekdayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  calendarWeekdayLabel: {
    flex: 1,
    color: '#6B7280',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDayCell: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 3,
  },
  calendarDayPill: {
    width: 34,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  calendarDayPillToday: {
    backgroundColor: '#F3F4F6',
  },
  calendarDayText: {
    color: '#111111',
    fontSize: 15,
    fontWeight: '700',
  },
  calendarDayTextMuted: {
    color: '#9CA3AF',
  },
  calendarDayTextToday: {
    color: '#111111',
  },
  calendarFlame: {
    fontSize: 11,
    lineHeight: 12,
  },
  calendarFooter: {
    gap: 2,
    paddingTop: spacing.sm,
  },
  calendarFooterLabel: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '700',
  },
  calendarFooterValue: {
    color: '#111111',
    fontSize: 18,
    fontWeight: '900',
  },
  calendarGridLarge: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.sm,
  },
  calendarDayCellLarge: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  calendarDayBubble: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarDayWorkout: {
    backgroundColor: PROGRESS_PALE_GREEN,
  },
  calendarDayActive: {
    backgroundColor: '#DFF5D6',
  },
  calendarDayToday: {
    borderWidth: 2,
    borderColor: PROGRESS_GREEN,
  },
  calendarDayLargeText: {
    color: '#111111',
    fontSize: 16,
    fontWeight: '900',
  },
  calendarDayLargeTextActive: {
    color: '#111111',
  },
  weekStreakCard: {
    gap: spacing.lg,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: PROGRESS_CARD_BORDER,
    backgroundColor: '#FFFFFF',
    padding: spacing.xl,
    ...shadows.card,
  },
  weekStreakHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  weekStreakTitle: {
    color: '#111111',
    fontSize: 18,
    fontWeight: '900',
  },
  weekStreakMeta: {
    color: PROGRESS_MUTED,
    fontSize: 14,
    fontWeight: '700',
  },
  weekStreakSteps: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  weekStep: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.sm,
  },
  weekStepCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekStepComplete: {
    backgroundColor: PROGRESS_PALE_GREEN,
  },
  weekStepPending: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  weekStepCheck: {
    color: '#0D4F1B',
    fontSize: 24,
    fontWeight: '900',
  },
  weekStepLabel: {
    color: PROGRESS_MUTED,
    fontSize: 11,
    lineHeight: 14,
    textAlign: 'center',
    fontWeight: '700',
  },
  progressOverTimeCard: {
    gap: spacing.lg,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: PROGRESS_CARD_BORDER,
    backgroundColor: '#FFFFFF',
    padding: spacing.xl,
    ...shadows.card,
  },
  chartMetricPill: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartMetricPillText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '800',
  },
  progressTrendStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  progressTrendValue: {
    color: '#050505',
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '900',
  },
  progressTrendMeta: {
    color: PROGRESS_MUTED,
    fontSize: 13,
    fontWeight: '700',
  },
  trendChartWrap: {
    gap: spacing.sm,
  },
  trendChartEmpty: {
    minHeight: 112,
    borderRadius: 14,
    backgroundColor: '#F7F8FA',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  trendChartEmptyText: {
    color: PROGRESS_MUTED,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  trendFooterLabels: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  trendFooterText: {
    color: PROGRESS_MUTED,
    fontSize: 13,
    fontWeight: '700',
  },
  topLiftsCard: {
    gap: spacing.lg,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: PROGRESS_CARD_BORDER,
    backgroundColor: '#FFFFFF',
    padding: spacing.xl,
    ...shadows.card,
  },
  topLiftRow: {
    minHeight: 74,
    borderRadius: 14,
    backgroundColor: '#F7F8FA',
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  topLiftIcon: {
    color: '#159A31',
    fontSize: 30,
    fontWeight: '900',
  },
  topLiftCopy: {
    flex: 1,
    gap: 4,
  },
  topLiftTitle: {
    color: '#111111',
    fontSize: 17,
    fontWeight: '900',
  },
  topLiftMeta: {
    color: PROGRESS_MUTED,
    fontSize: 14,
    fontWeight: '700',
  },
  metricRail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  metricChip: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  metricChipActive: {
    borderColor: '#CFEED8',
    backgroundColor: '#ECFDF3',
  },
  metricChipText: {
    color: '#4B5563',
    fontSize: 12,
    fontWeight: '800',
  },
  metricChipTextActive: {
    color: '#1A7F3C',
  },
  snapshotGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  snapshotCard: {
    flex: 1,
    minHeight: 120,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    padding: spacing.lg,
    justifyContent: 'space-between',
    ...shadows.card,
  },
  snapshotCardLarge: {
    flex: 1.1,
  },
  snapshotLabel: {
    color: '#6B7280',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  snapshotValue: {
    color: '#111111',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  snapshotTrend: {
    color: '#16A34A',
    fontSize: 13,
    fontWeight: '800',
  },
  measureCard: {
    gap: spacing.xs,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    padding: spacing.lg,
    ...shadows.card,
  },
  measureCardTitle: {
    color: '#6B7280',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  measureCardValue: {
    color: '#111111',
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  measureCardMeta: {
    color: '#4B5563',
    fontSize: 13,
    fontWeight: '700',
  },
  measureSection: {
    gap: spacing.sm,
  },
  measureSectionLabel: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '800',
  },
  measureListCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    ...shadows.card,
  },
  measureRow: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: '#FFFFFF',
  },
  measureRowActive: {
    backgroundColor: '#F5FFF8',
  },
  measureRowIconShell: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7F8FA',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  measureRowIconShellActive: {
    borderColor: '#86EFAC',
    backgroundColor: '#ECFDF3',
  },
  measureRowIconText: {
    color: '#111111',
    fontSize: 12,
    fontWeight: '900',
  },
  measureRowCopy: {
    flex: 1,
    gap: 2,
  },
  measureRowTitle: {
    color: '#111111',
    fontSize: 17,
    fontWeight: '800',
  },
  measureRowSubtitle: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '600',
  },
  measureRowValue: {
    color: '#111111',
    fontSize: 14,
    fontWeight: '800',
  },
  measureDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginLeft: spacing.lg + 40 + spacing.md,
  },
  measureGuideCard: {
    gap: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    padding: spacing.lg,
    ...shadows.card,
  },
  measureGuideSectionLabel: {
    color: '#111111',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  measureGuideHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  measureGuideCopy: {
    flex: 1,
    gap: 4,
  },
  measureGuideTitle: {
    color: '#111111',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  measureGuideSubtitle: {
    color: '#4B5563',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  measureGuideValue: {
    color: '#111111',
    fontSize: 18,
    fontWeight: '900',
  },
  measureInstructionList: {
    gap: spacing.sm,
  },
  measureInstructionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  measureInstructionDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    marginTop: 6,
    backgroundColor: '#16A34A',
  },
  measureInstructionText: {
    flex: 1,
    color: '#111111',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  measureReferenceNote: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  measureReferenceText: {
    color: '#166534',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  sheetBackdropHit: {
    display: 'none',
  },
  sheetSurface: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  sheetScroll: {
    flex: 1,
  },
  sheetScrollContent: {
    gap: spacing.lg,
    paddingBottom: layout.bottomTabBarReserve,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sheetHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  sheetTitle: {
    color: '#111111',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.7,
  },
  sheetSubtitle: {
    color: '#4B5563',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  sheetCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  sheetCloseButtonText: {
    color: '#111111',
    fontSize: 13,
    fontWeight: '900',
  },
  measureEntryCard: {
    gap: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    padding: spacing.lg,
    ...shadows.card,
  },
  measureEntryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  measureEntryTitle: {
    color: '#111111',
    fontSize: 16,
    fontWeight: '800',
  },
  measureUnitRail: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  measureUnitChip: {
    minHeight: 34,
    minWidth: 46,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  measureUnitChipActive: {
    borderColor: '#86EFAC',
    backgroundColor: '#ECFDF3',
  },
  measureUnitChipText: {
    color: '#4B5563',
    fontSize: 12,
    fontWeight: '800',
  },
  measureUnitChipTextActive: {
    color: '#15803D',
  },
  measureInputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  measureTextInput: {
    flex: 1,
    minHeight: 52,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.md,
    color: '#111111',
    fontSize: 16,
    fontWeight: '800',
  },
  measureSaveButton: {
    minWidth: 92,
    minHeight: 52,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#111111',
  },
  measureSaveButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  measureEntryMeta: {
    color: '#4B5563',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  measureSummaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  measureSummaryItem: {
    flex: 1,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 2,
  },
  measureSummaryLabel: {
    color: '#6B7280',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  measureSummaryValue: {
    color: '#111111',
    fontSize: 15,
    fontWeight: '900',
  },
  measureRangeRail: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  measureRangeChip: {
    minHeight: 32,
    minWidth: 54,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  measureRangeChipActive: {
    borderColor: '#86EFAC',
    backgroundColor: '#ECFDF3',
  },
  measureRangeChipText: {
    color: '#4B5563',
    fontSize: 12,
    fontWeight: '800',
  },
  measureRangeChipTextActive: {
    color: '#15803D',
  },
  measureHistoryRailWrap: {
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  measureHistoryRail: {
    height: 148,
    position: 'relative',
    paddingLeft: 44,
  },
  measureHistorySvg: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  measureHistoryTickRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  measureHistoryTickLabel: {
    width: 32,
    color: '#6B7280',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'right',
  },
  measureHistoryTickLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#D1D5DB',
  },
  measureHistoryEmpty: {
    minHeight: 120,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  measureHistoryEmptyText: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '700',
  },
  primarySignalCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    padding: spacing.lg,
    gap: spacing.xs,
    ...shadows.card,
  },
  primarySignalCardEmpty: {
    borderColor: '#BBF7D0',
    backgroundColor: '#F0FDF4',
  },
  primarySignalKicker: {
    color: '#15803D',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  primarySignalTitle: {
    color: '#111111',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.7,
  },
  primarySignalBody: {
    color: '#4B5563',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  browseSurface: {
    gap: spacing.sm,
  },
  searchInputLight: {
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    color: '#111111',
    fontSize: 14,
    fontWeight: '700',
    paddingHorizontal: spacing.md,
  },
  filterChipLight: {
    minHeight: 34,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterChipLightActive: {
    backgroundColor: '#ECFDF3',
    borderColor: '#86EFAC',
  },
  filterChipTextLight: {
    color: '#4B5563',
    fontSize: 12,
    fontWeight: '800',
  },
  filterChipTextLightActive: {
    color: '#15803D',
  },
  trackedEmptyState: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    padding: spacing.xl,
    gap: spacing.sm,
    ...shadows.card,
  },
  trackedEmptyTitle: {
    color: '#111111',
    fontSize: 18,
    fontWeight: '900',
  },
  trackedEmptyBody: {
    color: '#4B5563',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  listHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  listMetaText: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '700',
  },
  heroSurface: {
    minHeight: 276,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  heroContent: {
    flex: 1,
    justifyContent: 'space-between',
    padding: spacing.lg,
    gap: spacing.md,
  },
  heroKicker: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  heroCopy: {
    gap: spacing.xs,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 32,
    lineHeight: 34,
    fontWeight: '900',
    letterSpacing: -1,
    maxWidth: '84%',
  },
  heroMeta: {
    color: 'rgba(255,255,255,0.74)',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    maxWidth: '88%',
  },
  heroActionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  heroPrimaryButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4FAFF',
    borderWidth: 1,
    borderColor: '#F4FAFF',
  },
  heroPrimaryButtonText: {
    color: '#0B0F14',
    fontSize: 14,
    fontWeight: '900',
  },
  heroSecondaryButton: {
    minWidth: 126,
    minHeight: 52,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(7, 10, 14, 0.52)',
    paddingHorizontal: spacing.md,
  },
  heroSecondaryButtonText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  signalRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  signalRowStacked: {
    flexDirection: 'column',
  },
  signalCardPressable: {
    flex: 1,
  },
  signalCard: {
    flex: 1,
    minHeight: 82,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
    gap: 3,
  },
  signalLabel: {
    color: '#6B7280',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  signalValue: {
    color: '#111111',
    fontSize: 18,
    fontWeight: '900',
  },
  signalMeta: {
    color: '#4B5563',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
  },
  discoveryCard: {
    gap: spacing.sm,
  },
  discoveryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  discoveryCopy: {
    flex: 1,
    gap: 2,
  },
  discoveryTitle: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  discoveryMeta: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  discoveryExpandButton: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  discoveryExpandText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '800',
  },
  searchInput: {
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(10, 14, 19, 0.84)',
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    paddingHorizontal: spacing.md,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  filterChip: {
    minHeight: 34,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  filterChipActive: {
    backgroundColor: '#F4FAFF',
    borderColor: '#F4FAFF',
  },
  filterChipText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  filterChipTextActive: {
    color: '#0B0F14',
  },
  progressList: {
    gap: spacing.md,
  },
  detailEntryCard: {
    gap: spacing.md,
  },
  detailHeader: {
    gap: 2,
  },
  detailKicker: {
    color: '#6B7280',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  detailTitle: {
    color: '#111111',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  detailBody: {
    color: '#4B5563',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  detailSectionLabel: {
    color: '#6B7280',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  bodyweightEntryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  bodyweightInput: {
    flex: 1,
    minHeight: 52,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.md,
    color: '#111111',
    fontSize: 16,
    fontWeight: '800',
  },
  bodyweightButton: {
    minWidth: 88,
    minHeight: 52,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#111111',
  },
  bodyweightButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  contextCard: {
    gap: spacing.xs,
  },
  contextKicker: {
    color: '#6B7280',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  contextTitle: {
    color: '#111111',
    fontSize: 16,
    fontWeight: '900',
  },
  contextBody: {
    color: '#4B5563',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  recentCard: {
    padding: 0,
  },
  recentList: {
    overflow: 'hidden',
    borderRadius: radii.lg,
  },
  recentRow: {
    minHeight: 72,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  recentRowBorder: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  recentCopy: {
    flex: 1,
    gap: 2,
  },
  recentTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  recentMeta: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  recentValue: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  chartCard: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  alertCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E7E8EA',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: 6,
    overflow: 'hidden',
    ...shadows.card,
  },
  alertAccentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  alertAccentOrange: {
    backgroundColor: '#EA580C',
  },
  alertAccentRose: {
    backgroundColor: '#E11D48',
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  alertKickerOrange: {
    color: '#EA580C',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  alertKickerRose: {
    color: '#E11D48',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  alertBadgeOrange: {
    backgroundColor: '#FFF7ED',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  alertBadgeRose: {
    backgroundColor: '#FFF1F2',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  alertBadgeTextOrange: {
    color: '#EA580C',
    fontSize: 12,
    fontWeight: '700',
  },
  alertBadgeTextRose: {
    color: '#E11D48',
    fontSize: 12,
    fontWeight: '700',
  },
  alertTitle: {
    color: '#111111',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  alertBody: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
});
