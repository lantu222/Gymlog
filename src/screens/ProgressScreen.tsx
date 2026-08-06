import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Path, Polyline, Rect } from 'react-native-svg';

import { VinhaIcon } from '../components/VinhaIcon';
import { SimpleLineChart } from '../components/SimpleLineChart';
import type { HomeRecentSessionItem } from './HomeScreen';
import { formatLiftDisplayLabel } from '../lib/displayLabel';
import {
  convertWeightFromKg,
  convertWeightToKg,
  formatCompactVolume,
  formatDate,
  formatDurationMinutes,
  formatLogSetSummary,
  formatShortDate,
  formatTime,
  formatVolume,
  formatWeight,
  localeFor,
  parseNumberInput,
  removeTrailingZeros,
} from '../lib/format';
import { exerciseNameLabel } from '../lib/exerciseNameLabel';
import { I18nKey, t } from '../lib/i18n';
import { ProMomentContent, WeeklyReadRow } from '../lib/proInsights';
import { ProLockedCard } from '../components/ProLockedCard';
import { ProMomentSheet } from '../components/ProMomentSheet';
import { PW } from '../lightTheme';
import { Theme, useTheme, useThemedStyles } from '../theming';
import {
  isMeasureRangeLocked,
  isTrendRangeLocked,
  resolveMeasureRange,
  resolveTrendRange,
} from '../lib/historyWindow';
import { getProgressActivityDayStatus } from '../lib/progressActivity';
import type { PersonalRecord } from '../lib/personalRecords';
import { RecordRow } from './RecordsScreen';
import {
  BodyweightProgressSummary,
  ExerciseProgressSummary,
  getExerciseProgressSignal,
} from '../lib/progression';
import { TrainingRhythmSummary } from '../lib/trainingRhythm';
import { layout } from '../theme';
import {
  AppLanguage,
  MeasurementEntry,
  MeasurementKind,
  MeasurementUnit,
  SetupWeekday,
  UnitPreference,
  WorkoutSession,
} from '../types/models';

type ProgressSection = 'overview' | 'tracked' | 'measures';
type ProgressFilter = 'all' | 'new_best' | 'moving_up' | 'building' | 'below_last';
type OverviewMetric = 'volume' | 'duration' | 'bodyweight';
type OverviewRange = '1m' | '3m' | '6m' | 'all';
type MeasureKey = 'bodyweight' | 'bodyfat' | 'shoulders' | 'chest' | 'waist' | 'hips' | 'thighs';
type MeasureRange = '3m' | '1y' | 'all';
type MeasureIconName = 'scale' | 'drop' | 'tape';

interface ProgressScreenProps {
  language?: AppLanguage;
  summaries: ExerciseProgressSummary[];
  bodyweightProgress: BodyweightProgressSummary;
  measurementEntries: MeasurementEntry[];
  workoutSessions: WorkoutSession[];
  /** Weekdays the active plan schedules; drives missed vs rest in the calendar. */
  trainingDays?: SetupWeekday[];
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
  rhythm: TrainingRhythmSummary;
  weeklyTargetSessions?: number | null;
  unitPreference: UnitPreference;
  initialSection?: ProgressSection;
  selectedExerciseKey?: string;
  /**
   * The three most recent records, and how many there are in total.
   *
   * The overview shows the ones just set; the full list has its own screen,
   * because three kinds of "best" do not fit a section.
   */
  topRecords?: PersonalRecord[];
  recordCount?: number;
  onOpenRecords?: () => void;
  /**
   * The training calendar. The month below this is plan ADHERENCE — done,
   * missed, upcoming against the plan — which answers a different question
   * from "when did I train and what did I do", so both exist.
   */
  onOpenCalendar?: () => void;
  showBodyweightDetail?: boolean;
  onAddBodyweight: (weightKg: number) => void;
  onAddMeasurement: (kind: MeasurementKind, value: number, unit: MeasurementUnit) => Promise<void>;
  recentSessions?: HomeRecentSessionItem[];
  onOpenSessionHistory?: () => void;
  onOpenRecentSession?: (sessionId: string) => void;
  /** Paywall moment 3: traffic-light statuses (free) with Pro conclusions. */
  weeklyRead?: WeeklyReadRow[];
  readMoment?: ProMomentContent | null;
  proUnlocked?: boolean;
  onOpenPremium?: () => void;
}

// The activity grid is Monday-first, so these are the one-letter chips in that
// order — Finnish and English disagree on more of them than you would expect.
const PROGRESS_WEEKDAY_KEYS: I18nKey[] = [
  'onb.weekday.mon',
  'onb.weekday.tue',
  'onb.weekday.wed',
  'onb.weekday.thu',
  'onb.weekday.fri',
  'onb.weekday.sat',
  'onb.weekday.sun',
];

// Evaluated once at import, so the themed dots have to come from a call.
const calendarLegend = (theme: Theme): Array<{ key: string; labelKey: I18nKey; dotStyle: object }> => [
  // Each dot must be the same recipe as its bubble, or the legend explains a
  // calendar that does not exist. Four states, three distinguishing devices:
  // solid = trained, purple outline = planned, gold outline = missed, quiet
  // fill = rest.
  { key: 'done', labelKey: 'progress.legend.done', dotStyle: { backgroundColor: theme.purple } },
  {
    key: 'missed',
    labelKey: 'progress.legend.missed',
    dotStyle: { backgroundColor: theme.surfaceSoft, borderWidth: 1.5, borderColor: theme.gold },
  },
  {
    key: 'upcoming',
    labelKey: 'progress.legend.upcoming',
    dotStyle: { borderWidth: 1.5, borderColor: theme.purple },
  },
  { key: 'rest', labelKey: 'progress.legend.rest', dotStyle: { backgroundColor: theme.surfaceSoft } },
];

const PROGRESS_SECTIONS: Array<{ key: ProgressSection; labelKey: I18nKey }> = [
  { key: 'overview', labelKey: 'progress.section.overview' },
  { key: 'tracked', labelKey: 'progress.section.tracked' },
  { key: 'measures', labelKey: 'progress.section.measures' },
];

const PROGRESS_FILTERS: Array<{ key: ProgressFilter; labelKey: I18nKey }> = [
  { key: 'all', labelKey: 'progress.filter.all' },
  { key: 'new_best', labelKey: 'progress.filter.new' },
  { key: 'moving_up', labelKey: 'progress.filter.up' },
  { key: 'building', labelKey: 'progress.filter.building' },
  { key: 'below_last', labelKey: 'progress.filter.below' },
];

const OVERVIEW_METRICS: Array<{ key: OverviewMetric; labelKey: I18nKey }> = [
  { key: 'volume', labelKey: 'progress.metric.volume' },
  { key: 'duration', labelKey: 'progress.metric.duration' },
  { key: 'bodyweight', labelKey: 'progress.metric.bodyweight' },
];

// Range chips are numerals with a unit letter — the same in both languages
// except "All", which resolves through the dictionary at render.
const OVERVIEW_RANGES: Array<{ key: OverviewRange; label: string | null }> = [
  { key: '1m', label: '1M' },
  { key: '3m', label: '3M' },
  { key: '6m', label: '6M' },
  { key: 'all', label: null },
];

const MEASURE_RANGES: Array<{ key: MeasureRange; label: string | null }> = [
  { key: '3m', label: '3M' },
  { key: '1y', label: '1Y' },
  { key: 'all', label: null },
];

const MEASURE_CONFIG: Array<{
  key: MeasureKey;
  labelKey: I18nKey;
  icon: MeasureIconName;
  kind: MeasurementKind | null;
  lowerIsBetter: boolean;
}> = [
  { key: 'bodyweight', labelKey: 'progress.measure.bodyweight', icon: 'scale', kind: null, lowerIsBetter: false },
  { key: 'bodyfat', labelKey: 'progress.measure.bodyfat', icon: 'drop', kind: 'bodyfat', lowerIsBetter: true },
  { key: 'shoulders', labelKey: 'progress.measure.shoulders', icon: 'tape', kind: 'shoulders', lowerIsBetter: false },
  { key: 'chest', labelKey: 'progress.measure.chest', icon: 'tape', kind: 'chest', lowerIsBetter: false },
  { key: 'waist', labelKey: 'progress.measure.waist', icon: 'tape', kind: 'waist', lowerIsBetter: true },
  { key: 'hips', labelKey: 'progress.measure.hips', icon: 'tape', kind: 'hips', lowerIsBetter: false },
  { key: 'thighs', labelKey: 'progress.measure.thighs', icon: 'tape', kind: 'thighs', lowerIsBetter: false },
];

// Honest signal palette (light) keyed by getExerciseProgressSignal kinds.
const SIGNAL_STYLES: Record<
  ReturnType<typeof getExerciseProgressSignal>['kind'],
  { fg: string; bg: string; dot: string }
> = {
  new_best: { fg: '#157A3A', bg: '#E4F6EA', dot: '#1FA64E' },
  moving_up: { fg: '#157A3A', bg: '#E9F6EE', dot: '#37C46B' },
  building: { fg: '#5B21B6', bg: '#EFE7FF', dot: '#8B5CF6' },
  below_last: { fg: '#9A5B16', bg: '#FBEFDD', dot: '#E0922F' },
  starting: { fg: '#667085', bg: '#EEF0F4', dot: '#98A2B3' },
};

const CM_TO_IN = 0.393700787;

// ── session/date helpers preserved from the previous Progress implementation ──

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

function formatDayMonthLabel(dateString: string, language: AppLanguage) {
  const date = new Date(dateString);
  const month = new Intl.DateTimeFormat(localeFor(language), { month: 'short' }).format(date);
  return `${date.getDate()} ${month}`;
}

function formatMonthLabel(dateString: string, language: AppLanguage) {
  return new Intl.DateTimeFormat(localeFor(language), { month: 'short' }).format(new Date(dateString));
}

function formatMonthYearLabel(dateString: string, language: AppLanguage) {
  return new Intl.DateTimeFormat(localeFor(language), { month: 'short', year: '2-digit' }).format(
    new Date(dateString),
  );
}

function formatOverviewChartLabel(dateString: string, range: OverviewRange, language: AppLanguage) {
  switch (range) {
    case '1m':
    case '3m':
      return formatDayMonthLabel(dateString, language);
    case '6m':
      return formatMonthLabel(dateString, language);
    case 'all':
    default:
      return formatMonthYearLabel(dateString, language);
  }
}

function getOverviewFooterLabels(
  points: Array<{ label: string; value: number }>,
  range: OverviewRange,
  language: AppLanguage,
) {
  if (!points.length) {
    return [];
  }

  if (points.length === 1) {
    return [formatOverviewChartLabel(points[0].label, range, language)];
  }

  const middleIndex = Math.floor((points.length - 1) / 2);
  const labels = [points[0].label];

  if (middleIndex > 0 && middleIndex < points.length - 1) {
    labels.push(points[middleIndex].label);
  }

  labels.push(points[points.length - 1].label);

  return [...new Set(labels)].map((label) => formatOverviewChartLabel(label, range, language));
}

function getOverviewDurationTicks(maxValue: number) {
  const top = maxValue <= 15 ? 15 : maxValue <= 30 ? 30 : maxValue <= 45 ? 45 : maxValue <= 60 ? 60 : 90;
  const step = top === 90 ? 30 : 15;
  return Array.from({ length: top / step + 1 }, (_, index) => index * step);
}

/**
 * Volume ticks on round numbers.
 *
 * Without these the chart interpolated its own axis and printed things like
 * "1730.8 kg" and "496.7 kg" — a decimal on a number nobody lifts to a tenth
 * of a kilo, under a headline that already reads "2,2 t". The axis steps in
 * halves and thousands instead, and the labels use the same compact unit as
 * the headline so the two agree.
 */
function getOverviewVolumeTicks(maxValue: number) {
  if (maxValue <= 0) {
    return [0, 250, 500];
  }

  // Step from a 1 / 2.5 / 5 ladder so every tick lands on a readable number.
  const magnitude = Math.pow(10, Math.floor(Math.log10(maxValue / 3)));
  const step = [1, 2.5, 5, 10].map((factor) => factor * magnitude).find((candidate) => maxValue / candidate <= 4)
    ?? 10 * magnitude;
  const top = Math.ceil(maxValue / step) * step;
  const ticks: number[] = [];
  for (let tick = 0; tick <= top + step / 2; tick += step) {
    ticks.push(Number(tick.toFixed(2)));
  }
  return ticks;
}

function formatOverviewVolumeTick(value: number, ticks: number[]) {
  const top = ticks.length ? ticks[ticks.length - 1] : 0;
  if (top >= 1000) {
    const tonnes = value / 1000;
    return `${removeTrailingZeros(Number(tonnes.toFixed(tonnes >= 10 ? 0 : 1)))} t`;
  }
  return `${removeTrailingZeros(Math.round(value))} kg`;
}

function getOverviewBodyweightTicks(values: number[], unitPreference: UnitPreference) {
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

function convertMeasurementValue(value: number, fromUnit: MeasurementUnit, toUnit: MeasurementUnit) {
  if (fromUnit === toUnit) {
    return value;
  }

  if (fromUnit === '%' || toUnit === '%') {
    return value;
  }

  return fromUnit === 'cm' && toUnit === 'in' ? value * CM_TO_IN : value / CM_TO_IN;
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

function getSummaryChartPoints(
  summary: ExerciseProgressSummary,
  unitPreference: UnitPreference,
  language: AppLanguage,
) {
  return [...summary.logs].reverse().map((log) => ({
    label: formatShortDate(log.performedAt, language),
    value: convertWeightFromKg(log.weight, unitPreference),
  }));
}

function fmtDelta(value: number) {
  return removeTrailingZeros(Number(value.toFixed(1)));
}

// ── glyphs ──

function SearchIcon({ color: colorProp, size = 17 }: { color?: string; size?: number }) {
  const theme = useTheme();
  const color = colorProp ?? theme.faint;

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="11" cy="11" r="7" stroke={color} strokeWidth={2} />
      <Path d="M21 21l-4-4" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function ChevronDown({ open }: { open: boolean }) {
  const theme = useTheme();

  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" style={open ? { transform: [{ rotate: '180deg' }] } : undefined}>
      <Path d="M6 9l6 6 6-6" stroke={theme.faint} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function MeasureIcon({ name }: { name: MeasureIconName }) {
  const theme = useTheme();

  const common = { stroke: theme.purpleDark, strokeWidth: 2, fill: 'none' as const, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (name === 'scale') {
    return (
      <Svg width={18} height={18} viewBox="0 0 24 24">
        <Rect x={3} y={3} width={18} height={18} rx={4} {...common} />
        <Path d="M8 8l4 4M8 8h4" {...common} />
      </Svg>
    );
  }
  if (name === 'drop') {
    return (
      <Svg width={18} height={18} viewBox="0 0 24 24">
        <Path d="M12 3c3 4 6 7 6 11a6 6 0 01-12 0c0-4 3-7 6-11z" {...common} />
      </Svg>
    );
  }
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Rect x={3} y={8} width={18} height={8} rx={2} {...common} />
      <Path d="M7 8v4M11 8v4M15 8v4M19 8v4" {...common} />
    </Svg>
  );
}

function ArrowGlyph({ up, color }: { up: boolean; color: string }) {
  return (
    <Svg width={9} height={9} viewBox="0 0 12 12">
      <Path d={up ? 'M6 3l4 5H2z' : 'M6 9L2 4h8z'} fill={color} />
    </Svg>
  );
}

// ── shared light widgets ──

function SectionLabel({ label, right }: { label: string; right?: React.ReactNode }) {
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionHeadLabel}>{label}</Text>
      {typeof right === 'string' ? (
        <Text style={styles.sectionHeadRight}>{right}</Text>
      ) : (
        right ?? null
      )}
    </View>
  );
}

function SignalBadge({ summary, language }: { summary: ExerciseProgressSummary; language: AppLanguage }) {
  const styles = useThemedStyles(makeStyles);

  const signal = getExerciseProgressSignal(summary, language);
  const palette = SIGNAL_STYLES[signal.kind];
  return (
    <View style={[styles.signalBadge, { backgroundColor: palette.bg }]}>
      <View style={[styles.signalBadgeDot, { backgroundColor: palette.dot }]} />
      <Text style={[styles.signalBadgeText, { color: palette.fg }]}>{signal.label}</Text>
    </View>
  );
}

function DeltaPill({ delta, unit, lowerIsBetter = false }: { delta: number; unit: string; lowerIsBetter?: boolean }) {
  const styles = useThemedStyles(makeStyles);

  const up = delta > 0;
  const good = lowerIsBetter ? !up : up;
  const color = good ? '#157A3A' : '#9A5B16';
  const background = good ? '#E7F6EC' : '#FBEFDD';
  return (
    <View style={[styles.deltaPill, { backgroundColor: background }]}>
      <ArrowGlyph up={up} color={color} />
      <Text style={[styles.deltaPillText, { color }]}>
        {up ? '+' : ''}
        {fmtDelta(delta)}
        {unit ? ` ${unit}` : ''}
      </Text>
    </View>
  );
}

function Sparkline({ values, color, width = 62, height = 28 }: { values: number[]; color: string; width?: number; height?: number }) {
  if (values.length < 2) {
    return <View style={{ width, height }} />;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = Math.max(max - min, 0.001);
  const x = (index: number) => (index / (values.length - 1)) * (width - 4) + 2;
  const y = (value: number) => height - 3 - ((value - min) / spread) * (height - 6);
  const line = values.map((value, index) => `${x(index)},${y(value)}`).join(' ');

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Polyline points={line} fill="none" stroke={color} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
      <Circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r={2.6} fill={color} />
    </Svg>
  );
}

function Seg<T extends string>({
  options,
  value,
  onChange,
  grow,
  lockedKeys,
  onLockedPress,
}: {
  options: Array<{ key: T; label: string }>;
  value: T;
  onChange: (next: T) => void;
  grow?: boolean;
  /**
   * Options that exist but are not this reader's to pick.
   *
   * Shown with a lock rather than removed: hiding them would make the free
   * tier look like the whole product, and a reader who never learns the long
   * view exists cannot want it. Pressing one opens the Pro page instead of
   * selecting — it is not a broken control, it is a door.
   */
  lockedKeys?: readonly T[];
  onLockedPress?: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const theme = useTheme();

  return (
    <View style={[styles.seg, grow && styles.segGrow]}>
      {options.map((option) => {
        const locked = lockedKeys?.includes(option.key) ?? false;
        const active = !locked && option.key === value;
        return (
          <Pressable
            key={option.key}
            accessibilityRole="button"
            accessibilityState={{ selected: active, disabled: false }}
            onPress={() => (locked ? onLockedPress?.() : onChange(option.key))}
            style={[styles.segItem, grow && styles.segItemGrow, active && styles.segItemActive]}
          >
            {locked ? (
              <Svg width={11} height={11} viewBox="0 0 24 24" fill="none">
                <Rect x={5} y={11} width={14} height={9} rx={2.5} stroke={theme.faint} strokeWidth={2.4} />
                <Path
                  d="M8.5 11V8a3.5 3.5 0 017 0v3"
                  stroke={theme.faint}
                  strokeWidth={2.4}
                  strokeLinecap="round"
                />
              </Svg>
            ) : null}
            <Text style={[styles.segText, active && styles.segTextActive, locked && styles.segTextLocked]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ProgressScreen({
  summaries,
  bodyweightProgress,
  measurementEntries,
  workoutSessions,
  activityCalendar,
  trainingDays,
  rhythm,
  weeklyTargetSessions = null,
  unitPreference,
  language = 'en',
  initialSection,
  selectedExerciseKey,
  topRecords = [],
  recordCount = 0,
  onOpenRecords,
  onOpenCalendar,
  showBodyweightDetail,
  onAddBodyweight,
  onAddMeasurement,
  recentSessions = [],
  onOpenSessionHistory,
  onOpenRecentSession,
  weeklyRead = [],
  readMoment = null,
  proUnlocked = false,
  onOpenPremium,
}: ProgressScreenProps) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [readSheetVisible, setReadSheetVisible] = useState(false);
  const [progressSection, setProgressSection] = useState<ProgressSection>(initialSection ?? 'overview');
  const [progressQuery, setProgressQuery] = useState('');
  const [progressFilter, setProgressFilter] = useState<ProgressFilter>('all');
  const [expandedKey, setExpandedKey] = useState<string | null>(selectedExerciseKey ?? null);
  const [overviewMetric, setOverviewMetric] = useState<OverviewMetric>('volume');
  const [overviewRange, setOverviewRange] = useState<OverviewRange>('3m');
  const [selectedMeasure, setSelectedMeasure] = useState<MeasureKey>(showBodyweightDetail ? 'bodyweight' : 'bodyweight');
  const [measureRange, setMeasureRange] = useState<MeasureRange>('3m');
  /**
   * Pro can lapse while this screen is mounted — a promo code expires, the
   * preview switch goes off — and the selected range is component state that
   * knows nothing about it. Resolving on every render means the chart narrows
   * instead of quietly still drawing the paid window.
   */
  const resolvedOverviewRange = resolveTrendRange(overviewRange, proUnlocked);
  const resolvedMeasureRange = resolveMeasureRange(measureRange, proUnlocked);
  const lockedTrendRanges = OVERVIEW_RANGES.map((option) => option.key).filter((key) =>
    isTrendRangeLocked(key, proUnlocked),
  );
  const lockedMeasureRanges = MEASURE_RANGES.map((option) => option.key).filter((key) =>
    isMeasureRangeLocked(key, proUnlocked),
  );
  const [measureUnit, setMeasureUnit] = useState<MeasurementUnit>('cm');
  const [measureInput, setMeasureInput] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (initialSection) {
      setProgressSection(initialSection);
    }
  }, [initialSection]);

  // Deep links: AI coach opens progress/detail with a lift key; the old
  // bodyweight detail route now lands on the Measures tab.
  useEffect(() => {
    if (selectedExerciseKey) {
      setProgressSection('tracked');
      setExpandedKey(selectedExerciseKey);
    }
  }, [selectedExerciseKey]);

  useEffect(() => {
    if (showBodyweightDetail) {
      setProgressSection('measures');
      setSelectedMeasure('bodyweight');
    }
  }, [showBodyweightDetail]);

  function switchSection(section: ProgressSection) {
    setProgressSection(section);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }

  // ── overview data ──

  const prioritizedSummaries = useMemo(() => [...summaries].sort(compareProgressSummaries), [summaries]);
  const heroSummary = prioritizedSummaries[0] ?? null;
  const heroPoints = useMemo(
    () => (heroSummary ? getSummaryChartPoints(heroSummary, unitPreference, language) : []),
    [heroSummary, language, unitPreference],
  );
  const heroSignalDot = heroSummary ? SIGNAL_STYLES[getExerciseProgressSignal(heroSummary).kind].dot : theme.purple;
  const heroLatest = heroPoints.length ? heroPoints[heroPoints.length - 1].value : null;
  const heroStart = heroPoints.length ? heroPoints[0].value : null;
  const heroDelta = heroLatest !== null && heroStart !== null && heroPoints.length > 1 ? heroLatest - heroStart : null;
  const heroReps = heroSummary?.latestReps?.split(',')[0] ?? null;

  const calendarMonthLabel = useMemo(() => {
    const currentMonthDay = activityCalendar.weeks.flat().find((day) => day.inCurrentMonth);

    if (!currentMonthDay) {
      return activityCalendar.monthLabel;
    }

    // Hardcoded en-US put "August 2026" above a Finnish calendar, under a
    // Finnish heading, in an otherwise Finnish app.
    return new Intl.DateTimeFormat(language === 'fi' ? 'fi-FI' : 'en-US', {
      month: 'long',
      year: 'numeric',
    }).format(new Date(currentMonthDay.dayStart));
  }, [activityCalendar.monthLabel, activityCalendar.weeks, language]);

  const monthStats = useMemo(() => {
    const currentMonthDay = activityCalendar.weeks.flat().find((day) => day.inCurrentMonth);
    const monthStart = currentMonthDay ? new Date(currentMonthDay.dayStart) : new Date();
    const monthEnd = new Date(monthStart);
    monthEnd.setMonth(monthEnd.getMonth() + 1);

    const currentMonthSessions = workoutSessions.filter((session) => {
      const performedAt = new Date(session.performedAt);
      return performedAt >= monthStart && performedAt < monthEnd;
    });

    const volumeKg = currentMonthSessions.reduce((sum, session) => sum + getSessionVolumeKg(session), 0);
    const totalDuration = currentMonthSessions.reduce((sum, session) => sum + getSessionDurationMinutes(session), 0);
    const averageDuration = currentMonthSessions.length ? Math.round(totalDuration / currentMonthSessions.length) : 0;

    return {
      sessions: currentMonthSessions.length,
      volumeKg,
      averageDuration,
    };
  }, [activityCalendar.weeks, workoutSessions]);

  const overviewChart = useMemo(() => {
    const start = getOverviewRangeStart(resolvedOverviewRange);

    if (overviewMetric === 'bodyweight') {
      const entries = [...bodyweightProgress.entries]
        .filter((entry) => !start || new Date(entry.recordedAt) >= start)
        .reverse();

      const points = bucketOverviewPointsByRange(
        entries.map((entry) => ({
          label: entry.recordedAt,
          value: convertWeightFromKg(entry.weight, unitPreference),
        })),
        resolvedOverviewRange,
        'latest',
      );

      return {
        valueLabel: points.length ? formatWeight(bodyweightProgress.latest?.weight, unitPreference) : t(language, 'progress.noEntries'),
        unitLabel: unitPreference,
        points,
        footerLabels: getOverviewFooterLabels(points, resolvedOverviewRange, language),
        yTickValues: getOverviewBodyweightTicks(points.map((point) => point.value), unitPreference),
        formatValueLabel: (value: number, unitLabel: string) => formatOverviewBodyweightTick(value, unitLabel),
        tooltipFormatter: (point: { label: string; value: number }) => ({
          title: formatDate(point.label, language),
          value: `${formatTime(point.label)} · ${formatWeight(
            unitPreference === 'lb' ? convertWeightToKg(point.value, 'lb') : point.value,
            unitPreference,
          )}`,
        }),
        emptyLabel: t(language, 'progress.noBodyweight'),
      };
    }

    const grouped = new Map<string, { performedAt: string; duration: number; volume: number }>();
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
      };

      bucket.duration += getSessionDurationMinutes(session);
      bucket.volume += getSessionVolumeKg(session);
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
        resolvedOverviewRange,
        'sum',
      );
      const totalDuration = points.reduce((sum, point) => sum + point.value, 0);
      return {
        valueLabel: formatDurationMinutes(totalDuration),
        unitLabel: 'min',
        points,
        footerLabels: getOverviewFooterLabels(points, resolvedOverviewRange, language),
        yTickValues: getOverviewDurationTicks(Math.max(...points.map((point) => point.value), 0)),
        formatValueLabel: (value: number) => formatDurationTick(value),
        tooltipFormatter: (point: { label: string; value: number }) => ({
          title: formatDate(point.label, language),
          value: formatDurationMinutes(point.value),
        }),
        emptyLabel: t(language, 'progress.noDurations'),
      };
    }

    const points = bucketOverviewPointsByRange(
      rows.map((row) => ({
        label: row.performedAt,
        value: convertWeightFromKg(row.volume, unitPreference),
      })),
      resolvedOverviewRange,
      'sum',
    );
    const volumeTicks = getOverviewVolumeTicks(Math.max(...points.map((point) => point.value), 0));
    return {
      valueLabel: formatCompactVolume(rows.reduce((sum, row) => sum + row.volume, 0), unitPreference),
      unitLabel: unitPreference,
      points,
      footerLabels: getOverviewFooterLabels(points, resolvedOverviewRange, language),
      yTickValues: volumeTicks,
      // One unit for the whole axis: formatCompactVolume alone would mix
      // "500 kg" and "1 t" on the same scale. The top tick decides.
      formatValueLabel: (value: number) => formatOverviewVolumeTick(value, volumeTicks),
      tooltipFormatter: (point: { label: string; value: number }) => ({
        title: formatDate(point.label, language),
        value: formatVolume(
          unitPreference === 'lb' ? convertWeightToKg(point.value, 'lb') : point.value,
          unitPreference,
        ),
      }),
      emptyLabel: t(language, 'progress.noVolume'),
    };
  }, [bodyweightProgress.entries, bodyweightProgress.latest?.weight, overviewMetric, resolvedOverviewRange, unitPreference, workoutSessions]);

  const activityCalendarDays = useMemo(() => activityCalendar.weeks.flat(), [activityCalendar.weeks]);
  // Start of today, so a planned day that has already gone by can be told
  // apart from one still ahead. Recomputed per render is fine — the calendar
  // only re-renders on data changes, and a stale midnight would mislabel a day.
  const todayStartTimestamp = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  }, [activityCalendar.weeks]);

  // ── tracked data ──

  const filteredSummaries = useMemo(() => {
    const normalizedQuery = progressQuery.trim().toLowerCase();

    return prioritizedSummaries.filter((summary) => {
      const signal = getExerciseProgressSignal(summary);
      if (progressFilter !== 'all' && signal.kind !== progressFilter) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      // Search both spellings: a Finnish user may type "kyykky", but the stored
      // name is still the English one the library and the logs are keyed on.
      return (
        formatLiftDisplayLabel(exerciseNameLabel(language, summary.name))
          .toLowerCase()
          .includes(normalizedQuery) ||
        formatLiftDisplayLabel(summary.name).toLowerCase().includes(normalizedQuery)
      );
    });
  }, [language, prioritizedSummaries, progressFilter, progressQuery]);

  // ── measures data ──

  const measureModels = useMemo(() => {
    return MEASURE_CONFIG.map((config) => {
      if (config.kind === null) {
        const entries = bodyweightProgress.entries;
        const values = [...entries].reverse().map((entry) => convertWeightFromKg(entry.weight, unitPreference));
        const dates = [...entries].reverse().map((entry) => entry.recordedAt);
        return {
          ...config,
          unit: unitPreference as string,
          values,
          dates,
        };
      }

      const kindEntries = measurementEntries
        .filter((entry) => entry.kind === config.kind)
        .sort((left, right) => new Date(left.recordedAt).getTime() - new Date(right.recordedAt).getTime());
      const unit: MeasurementUnit =
        config.key === 'bodyfat' ? '%' : kindEntries[kindEntries.length - 1]?.unit === 'in' ? 'in' : 'cm';
      return {
        ...config,
        unit: unit as string,
        values: kindEntries.map((entry) => convertMeasurementValue(entry.value, entry.unit, unit)),
        dates: kindEntries.map((entry) => entry.recordedAt),
      };
    });
  }, [bodyweightProgress.entries, measurementEntries, unitPreference]);

  const selectedMeasureModel = measureModels.find((model) => model.key === selectedMeasure) ?? measureModels[0];

  useEffect(() => {
    // Input unit follows the selected measure (fixed for bodyweight/bodyfat).
    setMeasureUnit(
      selectedMeasureModel.key === 'bodyfat' ? '%' : selectedMeasureModel.unit === 'in' ? 'in' : 'cm',
    );
    setMeasureInput('');
  }, [selectedMeasureModel.key, selectedMeasureModel.unit]);

  const selectedMeasureRangePoints = useMemo(() => {
    const start = getMeasurementRangeStart(resolvedMeasureRange);
    const points: Array<{ label: string; value: number }> = [];
    selectedMeasureModel.values.forEach((value, index) => {
      const recordedAt = selectedMeasureModel.dates[index];
      if (start && new Date(recordedAt).getTime() < start.getTime()) {
        return;
      }
      points.push({ label: formatShortDate(recordedAt), value });
    });
    return points;
  }, [resolvedMeasureRange, selectedMeasureModel]);

  const selectedMeasureLatest = selectedMeasureModel.values.length
    ? selectedMeasureModel.values[selectedMeasureModel.values.length - 1]
    : null;
  const selectedMeasureDelta =
    selectedMeasureRangePoints.length >= 2
      ? selectedMeasureRangePoints[selectedMeasureRangePoints.length - 1].value - selectedMeasureRangePoints[0].value
      : null;

  async function handleSaveMeasure() {
    const parsed = parseNumberInput(measureInput);
    if (!parsed || parsed <= 0) {
      return;
    }

    if (selectedMeasureModel.kind === null) {
      onAddBodyweight(convertWeightToKg(parsed, unitPreference));
    } else {
      await onAddMeasurement(selectedMeasureModel.kind, parsed, measureUnit);
    }
    setMeasureInput('');
  }

  // ── sections ──

  function renderWeeklyRead() {
    if (weeklyRead.length === 0) {
      return null;
    }
    return (
      <View style={styles.readBlock}>
        <Text style={styles.readTitle}>{t(language, 'pro.read.title')}</Text>
        <View style={styles.readList}>
          {weeklyRead.map((row) => {
            const tone =
              row.tone === 'green'
                ? { dot: PW.green, soft: PW.greenSoft }
                : row.tone === 'amber'
                  ? { dot: PW.amber, soft: PW.amberSoft }
                  : { dot: PW.red, soft: PW.redSoft };
            return (
              <View key={row.key} style={styles.readRow}>
                <View style={styles.readRowHead}>
                  <View style={[styles.readDotRing, { backgroundColor: tone.soft }]}>
                    <View style={[styles.readDot, { backgroundColor: tone.dot }]} />
                  </View>
                  <View style={styles.readCopy}>
                    <Text style={styles.readName} numberOfLines={1}>
                      {row.name} — <Text style={{ color: tone.dot }}>{row.status}</Text>
                    </Text>
                    <Text style={styles.readMeta}>{row.meta}</Text>
                  </View>
                  <View style={styles.readBars}>
                    {row.bars.map((bar, index) => (
                      <View
                        key={index}
                        style={[
                          styles.readBar,
                          {
                            height: `${Math.round(bar * 100)}%`,
                            backgroundColor: index === row.bars.length - 1 ? tone.dot : tone.soft,
                          },
                        ]}
                      />
                    ))}
                  </View>
                </View>
                {row.locked ? (
                  <View style={styles.readLock}>
                    {proUnlocked ? (
                      <View style={styles.readFix}>
                        <Text style={styles.readFixLine}>{row.locked.body}</Text>
                      </View>
                    ) : (
                      <ProLockedCard
                        language={language}
                        compact
                        teaser={t(language, 'pro.read.lockedTeaser')}
                        body={row.locked.body}
                        cta={t(language, 'pro.read.lockedCta')}
                        onPress={() => {
                          if (readMoment) {
                            setReadSheetVisible(true);
                          } else {
                            onOpenPremium?.();
                          }
                        }}
                      />
                    )}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
        <Text style={styles.readFooter}>{t(language, 'pro.read.footer')}</Text>
      </View>
    );
  }

  function renderOverview() {
    const maxWeekSessions = Math.max(4, ...rhythm.sessionsPerWeek);

    return (
      <>
        {renderWeeklyRead()}
        {heroSummary ? (
          <View style={styles.heroBlock}>
            <View style={styles.heroCard}>
              <View style={styles.heroHead}>
                <Text numberOfLines={1} style={styles.heroLabel}>
                  {t(language, 'progress.workingWeight')} ·{' '}
                  {formatLiftDisplayLabel(exerciseNameLabel(language, heroSummary.name))}
                </Text>
                <SignalBadge summary={heroSummary} language={language} />
              </View>
              <View style={styles.heroValueRow}>
                <Text style={styles.heroValue}>{heroLatest !== null ? removeTrailingZeros(heroLatest) : '-'}</Text>
                <Text style={styles.heroUnit}>
                  {unitPreference}
                  {heroReps ? ` × ${heroReps}` : ''}
                </Text>
              </View>
              {heroDelta !== null ? (
                <Text style={styles.heroSince}>
                  {t(language, 'progress.heroSince', {
                    delta: `${heroDelta >= 0 ? '+' : ''}${fmtDelta(heroDelta)} ${unitPreference}`,
                    from: removeTrailingZeros(heroStart ?? 0),
                    to: `${removeTrailingZeros(heroLatest ?? 0)} ${unitPreference}`,
                  })}
                </Text>
              ) : (
                <Text style={styles.heroSinceMuted}>{t(language, 'progress.trendStarts')}</Text>
              )}
            </View>
            <SimpleLineChart
              points={heroPoints}
              unitLabel={unitPreference}
              accent={heroSignalDot}
              emptyLabel={t(language, 'progress.noEntries')}
              tooltipFormatter={(point) => ({
                title: point.label,
                value: formatWeight(
                  unitPreference === 'lb' ? convertWeightToKg(point.value, 'lb') : point.value,
                  unitPreference,
                ),
              })}
            />
          </View>
        ) : (
          <View style={styles.emptyHeroCard}>
            <Text style={styles.emptyTitle}>{t(language, 'progress.noTracked.title')}</Text>
            <Text style={styles.emptyText}>{t(language, 'progress.noTracked.body')}</Text>
          </View>
        )}

        {/* The trend chart. overviewChart, OVERVIEW_METRICS and OVERVIEW_RANGES
            were all built and none of them rendered: the chart was computed
            into a const nobody read, and the metric/range state had setters
            nobody called. So three metrics and four ranges existed in code and
            no user could see any of them. */}
        <SectionLabel label={t(language, 'progress.section.trend')} />
        <View style={styles.card}>
          <View style={styles.trendMetricRow}>
            <Seg
              options={OVERVIEW_METRICS.map((option) => ({
                key: option.key,
                label: t(language, option.labelKey),
              }))}
              value={overviewMetric}
              onChange={setOverviewMetric}
            />
          </View>
          {/* valueLabel already carries its own unit ("2,2 t", "13 h 21 min"),
              so printing unitLabel beside it reads as "13 h 21 min min". */}
          <View style={styles.trendValueRow}>
            <Text style={styles.trendValue}>{overviewChart.valueLabel}</Text>
          </View>
          <SimpleLineChart
            points={overviewChart.points}
            unitLabel={overviewChart.unitLabel}
            accent={theme.purple}
            emptyLabel={overviewChart.emptyLabel}
            footerLabels={overviewChart.footerLabels}
            yTickValues={overviewChart.yTickValues}
            formatValueLabel={overviewChart.formatValueLabel}
            tooltipFormatter={overviewChart.tooltipFormatter}
          />
          <View style={styles.trendRangeRow}>
            <Seg
              options={OVERVIEW_RANGES.map((option) => ({
                key: option.key,
                label: option.label ?? t(language, 'progress.range.all'),
              }))}
              value={resolvedOverviewRange}
              onChange={setOverviewRange}
              lockedKeys={lockedTrendRanges}
              onLockedPress={onOpenPremium}
            />
          </View>
        </View>

        <SectionLabel label={t(language, 'progress.section.thisMonth')} />
        <View style={styles.monthGrid}>
          <View style={styles.monthCard}>
            <Text style={styles.monthLabel}>{t(language, 'progress.stat.sessions')}</Text>
            <Text style={styles.monthValue}>{monthStats.sessions}</Text>
            <Text style={styles.monthMeta}>{t(language, 'progress.meta.thisMonth')}</Text>
          </View>
          <View style={styles.monthCard}>
            <Text style={styles.monthLabel}>{t(language, 'progress.stat.volume')}</Text>
            <Text style={styles.monthValue}>{formatCompactVolume(monthStats.volumeKg, unitPreference)}</Text>
            <Text style={styles.monthMeta}>{t(language, 'progress.meta.lifted')}</Text>
          </View>
          <View style={styles.monthCard}>
            <Text style={styles.monthLabel}>{t(language, 'progress.stat.avgTime')}</Text>
            <Text style={styles.monthValue}>{monthStats.averageDuration} min</Text>
            <Text style={styles.monthMeta}>{t(language, 'progress.meta.perSession')}</Text>
          </View>
        </View>

        {topRecords.length > 0 && onOpenRecords ? (
          <>
            <SectionLabel
              label={t(language, 'pr.records')}
              right={
                <Pressable onPress={onOpenRecords} hitSlop={8}>
                  <Text style={styles.recordsLink}>
                    {t(language, 'pr.allRecords', { count: recordCount })}
                  </Text>
                </Pressable>
              }
            />
            <View style={styles.recordsList}>
              {topRecords.map((record) => (
                <RecordRow key={`${record.key}-${record.kind}`} record={record} language={language} />
              ))}
            </View>
          </>
        ) : null}

        <SectionLabel
          label={t(language, 'progress.section.activity')}
          right={
            onOpenCalendar ? (
              <Pressable onPress={onOpenCalendar} hitSlop={8}>
                <Text style={styles.recordsLink}>{t(language, 'cal.open')}</Text>
              </Pressable>
            ) : (
              calendarMonthLabel
            )
          }
        />
        <View style={styles.card}>
          <View style={styles.calendarWeekdayRow}>
            {PROGRESS_WEEKDAY_KEYS.map((weekdayKey, index) => (
              <Text key={`${weekdayKey}:${index}`} style={styles.calendarWeekday}>
                {t(language, weekdayKey)}
              </Text>
            ))}
          </View>
          <View style={styles.calendarGrid}>
            {activityCalendarDays.map((day) => {
              const status = getProgressActivityDayStatus(day, {
                trainingDays,
                todayStart: todayStartTimestamp,
              });
              if (status === 'outside') {
                return <View key={day.dayStart} style={styles.calendarCell} />;
              }

              return (
                <View key={day.dayStart} style={styles.calendarCell}>
                  <View
                    style={[
                      styles.calendarBubble,
                      status === 'done' && styles.calendarBubbleDone,
                      status === 'missed' && styles.calendarBubbleMissed,
                      status === 'upcoming' && styles.calendarBubbleUpcoming,
                      status !== 'done' && day.isToday && styles.calendarBubbleToday,
                    ]}
                  >
                    <Text
                      style={[
                        styles.calendarBubbleText,
                        status === 'done' && styles.calendarBubbleTextDone,
                        status === 'missed' && styles.calendarBubbleTextMissed,
                        status === 'upcoming' && styles.calendarBubbleTextUpcoming,
                        status !== 'done' && day.isToday && styles.calendarBubbleTextToday,
                      ]}
                    >
                      {day.dayNumber}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>

          <View style={styles.calendarLegend}>
            {calendarLegend(theme).map((entry) => (
              <View key={entry.key} style={styles.legendItem}>
                <View style={[styles.legendDot, entry.dotStyle]} />
                <Text style={styles.legendText}>{t(language, entry.labelKey)}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.progressHistoryCard}>
          <View style={styles.historyHeadRow}>
            <Text style={styles.referenceCardTitle}>{t(language, 'progress.history')}</Text>
            {onOpenSessionHistory ? (
              <Pressable onPress={onOpenSessionHistory} hitSlop={8}>
                <Text style={styles.historySeeAll}>{t(language, 'progress.seeAll')}</Text>
              </Pressable>
            ) : null}
          </View>
          {recentSessions.length > 0 ? (
            <View style={styles.historyList}>
              {recentSessions.slice(0, 3).map((session) => (
                <Pressable
                  key={session.id}
                  onPress={() => onOpenRecentSession?.(session.id)}
                  disabled={!onOpenRecentSession}
                  style={styles.historyRow}
                >
                  <View style={styles.historyIcon}>
                    <VinhaIcon name="dumbbell" color={theme.purpleDark} size={17} />
                  </View>
                  <View style={styles.historyCopy}>
                    <Text numberOfLines={1} style={styles.historyTitle}>
                      {session.title}
                    </Text>
                    <Text numberOfLines={1} style={styles.historyMeta}>
                      {session.dateLabel} · {session.durationLabel} · {session.volumeLabel}
                    </Text>
                  </View>
                  <VinhaIcon name="chevronRight" color={theme.faint} size={16} />
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={styles.historyEmpty}>
              <Text style={styles.emptyTitle}>{t(language, 'progress.noSessions.title')}</Text>
              <Text style={styles.emptyText}>{t(language, 'progress.noSessions.body')}</Text>
            </View>
          )}
        </View>
      </>
    );
  }

  function renderTracked() {
    return (
      <>
        <View style={styles.searchShell}>
          <SearchIcon />
          <TextInput
            value={progressQuery}
            onChangeText={setProgressQuery}
            placeholder={t(language, 'progress.searchTracked')}
            placeholderTextColor={theme.faint}
            style={styles.searchInput}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.filterRail}
        >
          {PROGRESS_FILTERS.map((filter) => {
            const active = filter.key === progressFilter;
            return (
              <Pressable
                key={filter.key}
                onPress={() => setProgressFilter(filter.key)}
                style={[styles.filterChip, active && styles.filterChipActive]}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                  {t(language, filter.labelKey)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {summaries.length === 0 ? (
          <View style={styles.emptyBlock}>
            <Text style={styles.emptyTitle}>{t(language, 'progress.noTracked.title')}</Text>
            <Text style={styles.emptyText}>{t(language, 'progress.noTrackedFilter.body')}</Text>
          </View>
        ) : filteredSummaries.length === 0 ? (
          <View style={styles.emptyBlock}>
            <Text style={styles.emptyTitle}>{t(language, 'progress.noMatch.title')}</Text>
            <Text style={styles.emptyText}>{t(language, 'progress.noMatch.body')}</Text>
          </View>
        ) : (
          <View style={styles.trackedList}>
            {filteredSummaries.map((summary) => {
              const isOpen = expandedKey === summary.key;
              const signalDot = SIGNAL_STYLES[getExerciseProgressSignal(summary).kind].dot;
              const points = getSummaryChartPoints(summary, unitPreference, language);
              const start = points[0]?.value ?? null;
              const latest = points.length ? points[points.length - 1].value : null;
              const delta = start !== null && latest !== null && points.length > 1 ? latest - start : null;
              return (
                <View key={summary.key} style={styles.trackedCard}>
                  <Pressable onPress={() => setExpandedKey(isOpen ? null : summary.key)} style={styles.trackedHead}>
                    <View style={styles.trackedCopy}>
                      <Text numberOfLines={1} style={styles.trackedName}>
                        {formatLiftDisplayLabel(exerciseNameLabel(language, summary.name))}
                      </Text>
                      <View style={styles.trackedMetaRow}>
                        <SignalBadge summary={summary} language={language} />
                        <Text numberOfLines={1} style={styles.trackedMeta}>
                          {formatWeight(summary.latestWeight, unitPreference)}
                          {summary.latestReps && summary.latestReps !== '-' ? ` × ${summary.latestReps.split(',')[0]}` : ''}
                          {summary.latestLog ? ` · ${formatShortDate(summary.latestLog.performedAt, language)}` : ''}
                        </Text>
                      </View>
                    </View>
                    <Sparkline values={points.map((point) => point.value)} color={signalDot} />
                    <ChevronDown open={isOpen} />
                  </Pressable>
                  {isOpen ? (
                    <View style={styles.trackedDetail}>
                      {delta !== null ? (
                        <Text style={styles.trackedDelta}>
                          {delta >= 0 ? '+' : ''}
                          {fmtDelta(delta)} {unitPreference} · {removeTrailingZeros(start ?? 0)} →{' '}
                          {removeTrailingZeros(latest ?? 0)} {unitPreference}
                        </Text>
                      ) : (
                        <Text style={styles.trackedDeltaMuted}>{t(language, 'progress.trendStarts')}</Text>
                      )}
                      <SimpleLineChart
                        points={points}
                        unitLabel={unitPreference}
                        accent={signalDot}
                        emptyLabel={t(language, 'progress.noEntries')}
                        tooltipFormatter={(point) => ({
                          title: point.label,
                          value: formatWeight(
                            unitPreference === 'lb' ? convertWeightToKg(point.value, 'lb') : point.value,
                            unitPreference,
                          ),
                        })}
                      />
                      {summary.logs.length ? (
                        <View style={styles.trackedLogList}>
                          {summary.logs.slice(0, 3).map((log) => (
                            <View key={log.id} style={styles.trackedLogRow}>
                              <View style={styles.trackedLogCopy}>
                                <Text style={styles.trackedLogTitle}>{formatDate(log.performedAt)}</Text>
                                <Text numberOfLines={1} style={styles.trackedLogMeta}>
                                  {formatLogSetSummary(log, unitPreference)}
                                </Text>
                              </View>
                              <Text style={styles.trackedLogValue}>{formatWeight(log.weight, unitPreference)}</Text>
                            </View>
                          ))}
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
      </>
    );
  }

  function renderMeasures() {
    const model = selectedMeasureModel;

    return (
      <>
        <View style={styles.measureDetailBlock}>
          <View style={styles.card}>
            <View style={styles.measureDetailHead}>
              <Text style={styles.measureDetailLabel}>{t(language, model.labelKey)}</Text>
              {selectedMeasureDelta !== null && selectedMeasureDelta !== 0 ? (
                <DeltaPill delta={selectedMeasureDelta} unit={model.unit} lowerIsBetter={model.lowerIsBetter} />
              ) : null}
            </View>
            <View style={styles.measureValueRow}>
              <Text style={styles.measureValue}>
                {selectedMeasureLatest !== null ? removeTrailingZeros(Number(selectedMeasureLatest.toFixed(1))) : '—'}
              </Text>
              <Text style={styles.measureUnit}>{model.unit}</Text>
            </View>
            <Text style={styles.measureCaption}>
              {model.values.length
                ? t(language, 'progress.ownBaseline')
                : t(language, 'progress.addFirst')}
            </Text>

            <View style={styles.measureEntryRow}>
              <TextInput
                value={measureInput}
                onChangeText={setMeasureInput}
                keyboardType="decimal-pad"
                placeholder={`0 ${model.kind === null ? unitPreference : measureUnit}`}
                placeholderTextColor={theme.faint}
                style={styles.measureInput}
              />
              {model.kind !== null && model.key !== 'bodyfat' ? (
                <Seg
                  options={[
                    { key: 'cm' as MeasurementUnit, label: 'cm' },
                    { key: 'in' as MeasurementUnit, label: 'in' },
                  ]}
                  value={measureUnit}
                  onChange={setMeasureUnit}
                />
              ) : null}
              <Pressable onPress={() => void handleSaveMeasure()} style={styles.measureSaveButton}>
                <Text style={styles.measureSaveText}>{t(language, 'progress.save')}</Text>
              </Pressable>
            </View>
          </View>

          <SimpleLineChart
            points={selectedMeasureRangePoints}
            unitLabel={model.unit}
            accent={theme.purple}
            emptyLabel={t(language, 'progress.noEntriesRange')}
            tooltipFormatter={(point) => ({
              title: point.label,
              value: `${removeTrailingZeros(Number(point.value.toFixed(1)))} ${model.unit}`,
            })}
          />
          <View style={styles.trendRangeRow}>
            <Seg
              options={MEASURE_RANGES.map((option) => ({
                key: option.key,
                label: option.label ?? t(language, 'progress.range.all'),
              }))}
              value={resolvedMeasureRange}
              onChange={setMeasureRange}
              lockedKeys={lockedMeasureRanges}
              onLockedPress={onOpenPremium}
            />
          </View>
        </View>

        <SectionLabel label={t(language, 'progress.section.allMeasures')} />
        <View style={styles.measureList}>
          {measureModels.map((item) => {
            const active = item.key === selectedMeasure;
            const latest = item.values.length ? item.values[item.values.length - 1] : null;
            const delta = item.values.length >= 2 ? item.values[item.values.length - 1] - item.values[0] : null;
            const good = delta === null ? true : item.lowerIsBetter ? delta < 0 : delta > 0;
            return (
              <Pressable
                key={item.key}
                onPress={() => setSelectedMeasure(item.key)}
                style={[styles.measureRow, active && styles.measureRowActive]}
              >
                <View style={styles.measureRowIcon}>
                  <MeasureIcon name={item.icon} />
                </View>
                <View style={styles.measureRowCopy}>
                  <Text style={styles.measureRowTitle}>{t(language, item.labelKey)}</Text>
                  <Text style={styles.measureRowMeta}>
                    {latest !== null ? `${removeTrailingZeros(Number(latest.toFixed(1)))} ${item.unit}` : t(language, 'progress.noEntriesYet')}
                  </Text>
                </View>
                <Sparkline
                  values={item.values.slice(-8)}
                  color={delta === null ? theme.faint : good ? '#37C46B' : '#E0922F'}
                  width={58}
                />
                {delta !== null && delta !== 0 ? (
                  <DeltaPill delta={delta} unit={item.unit} lowerIsBetter={item.lowerIsBetter} />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t(language, 'progress.title')}</Text>
        <Text style={styles.headerSubtitle}>{t(language, 'progress.subtitle')}</Text>
        <View style={styles.tabsRow}>
          {PROGRESS_SECTIONS.map((section) => {
            const active = section.key === progressSection;
            return (
              <Pressable
                key={section.key}
                onPress={() => switchSection(section.key)}
                style={[styles.tab, active && styles.tabActive]}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>
                  {t(language, section.labelKey)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        {progressSection === 'overview' ? renderOverview() : null}
        {progressSection === 'tracked' ? renderTracked() : null}
        {progressSection === 'measures' ? renderMeasures() : null}
      </ScrollView>

      <ProMomentSheet
        visible={readSheetVisible}
        content={readMoment}
        language={language}
        onClose={() => setReadSheetVisible(false)}
        onSeePro={() => {
          setReadSheetVisible(false);
          onOpenPremium?.();
        }}
      />
    </View>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  readBlock: {
    marginBottom: 18,
  },
  readTitle: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1,
    color: theme.faint,
    marginBottom: 11,
  },
  readList: {
    gap: 10,
  },
  readRow: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 18,
    paddingVertical: 15,
    paddingHorizontal: 16,
  },
  readRowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  readDotRing: {
    width: 20,
    height: 20,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
  },
  readCopy: {
    flex: 1,
    minWidth: 0,
  },
  readName: {
    fontSize: 15.5,
    fontWeight: '800',
    color: theme.ink,
  },
  readMeta: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.muted,
    marginTop: 2,
  },
  readBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    height: 30,
    width: 52,
  },
  readBar: {
    flex: 1,
    borderRadius: 3,
  },
  readLock: {
    marginTop: 13,
  },
  readFix: {
    backgroundColor: theme.surfaceSoft,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  readFixLine: {
    fontSize: 13.5,
    fontWeight: '700',
    color: theme.ink,
    lineHeight: 20,
  },
  readFooter: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.faint,
    lineHeight: 18,
    marginTop: 14,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 10,
  },
  headerTitle: {
    color: theme.ink,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    color: theme.muted,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: theme.surfaceSoft,
    borderRadius: 12,
    padding: 3,
    marginTop: 14,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: 9,
  },
  tabActive: {
    backgroundColor: theme.surface,
    shadowColor: '#5028A0',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.16,
    shadowRadius: 5,
    elevation: 2,
  },
  tabText: {
    color: theme.muted,
    fontSize: 14,
    fontWeight: '800',
  },
  tabTextActive: {
    color: theme.purpleDark,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: layout.bottomTabBarReserve,
  },
  recordsLink: {
    color: theme.purple,
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: '800',
  },
  recordsList: {
    gap: 9,
    marginBottom: 4,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    paddingBottom: 11,
    marginTop: 22,
  },
  sectionHeadLabel: {
    color: theme.faint,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  sectionHeadRight: {
    color: theme.purple,
    fontSize: 12.5,
    fontWeight: '800',
  },
  card: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 18,
    padding: 16,
  },
  heroBlock: {
    gap: 10,
  },
  heroCard: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 18,
    padding: 18,
  },
  heroHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  heroLabel: {
    flex: 1,
    minWidth: 0,
    color: theme.muted,
    fontSize: 13,
    fontWeight: '800',
  },
  heroValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
    marginTop: 8,
  },
  heroValue: {
    color: theme.ink,
    fontSize: 46,
    fontWeight: '800',
    letterSpacing: -1,
    lineHeight: 48,
  },
  heroUnit: {
    color: theme.muted,
    fontSize: 18,
    fontWeight: '800',
  },
  heroSince: {
    color: '#157A3A',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 7,
  },
  heroSinceMuted: {
    color: theme.muted,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 7,
  },
  emptyHeroCard: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 26,
  },
  signalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
  },
  signalBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
  },
  signalBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  deltaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  deltaPillText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  monthGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  monthCard: {
    flex: 1,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 13,
  },
  monthLabel: {
    color: theme.faint,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  monthValue: {
    color: theme.ink,
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginTop: 5,
  },
  monthMeta: {
    color: theme.muted,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  trendValue: {
    flexShrink: 1,
    color: theme.ink,
    fontSize: 22,
    fontWeight: '800',
  },
  trendRangeRow: {
    alignItems: 'center',
  },
  trendMetricRow: {
    alignItems: 'center',
    marginBottom: 12,
  },
  trendValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
    marginBottom: 6,
  },
  seg: {
    flexDirection: 'row',
    backgroundColor: theme.surfaceSoft,
    borderRadius: 10,
    padding: 3,
    gap: 2,
  },
  segGrow: {
    alignSelf: 'stretch',
  },
  segItem: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 7,
  },
  segItemGrow: {
    flex: 1,
    alignItems: 'center',
  },
  segItemActive: {
    backgroundColor: theme.surface,
    shadowColor: '#5028A0',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.14,
    shadowRadius: 4,
    elevation: 2,
  },
  segTextLocked: {
    color: theme.faint,
  },
  segText: {
    color: theme.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  segTextActive: {
    color: theme.purpleDark,
  },
  calendarWeekdayRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
  },
  calendarWeekday: {
    flex: 1,
    textAlign: 'center',
    color: theme.faint,
    fontSize: 10,
    fontWeight: '800',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 6,
  },
  calendarCell: {
    width: `${100 / 7}%`,
    paddingHorizontal: 3,
  },
  // Rest is the default and by far the most common cell, so it has to be the
  // quietest thing on screen. A hardcoded pale lavender made it the loudest
  // under the dark theme — a grid of white blobs with the states that matter
  // lost among them.
  calendarBubble: {
    aspectRatio: 1,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.surfaceSoft,
  },
  calendarBubbleDone: {
    backgroundColor: theme.purple,
  },
  // Missed reads as a quiet outline, not an alarm: the point is to show the
  // shape of the month, not to scold anyone for a skipped Thursday.
  calendarBubbleMissed: {
    backgroundColor: theme.surfaceSoft,
    borderWidth: 1,
    borderColor: theme.gold,
  },
  calendarBubbleUpcoming: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: theme.purple,
  },
  calendarBubbleToday: {
    backgroundColor: theme.purpleLight,
    borderWidth: 1.5,
    borderColor: theme.purple,
    borderStyle: 'dashed',
  },
  calendarBubbleText: {
    color: theme.faint,
    fontSize: 11.5,
    fontWeight: '700',
  },
  calendarBubbleTextDone: {
    color: '#FFFFFF',
  },
  calendarBubbleTextMissed: {
    color: theme.gold,
  },
  calendarBubbleTextUpcoming: {
    color: theme.purpleDark,
  },
  calendarLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginTop: 14,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 11,
    height: 11,
    borderRadius: 4,
  },
  legendText: {
    color: theme.muted,
    fontSize: 11.5,
    fontWeight: '700',
  },
  calendarBubbleTextToday: {
    color: theme.purpleDark,
  },
  progressHistoryCard: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 18,
    padding: 16,
    marginTop: 22,
  },
  historyHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  referenceCardTitle: {
    color: theme.ink,
    fontSize: 16,
    fontWeight: '800',
  },
  historySeeAll: {
    color: theme.highlight,
    fontSize: 12.5,
    fontWeight: '800',
  },
  historyList: {
    marginTop: 6,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  historyIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: theme.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyCopy: {
    flex: 1,
    minWidth: 0,
  },
  historyTitle: {
    color: theme.ink,
    fontSize: 14,
    fontWeight: '800',
  },
  historyMeta: {
    color: theme.muted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  historyEmpty: {
    paddingTop: 12,
    paddingBottom: 4,
  },
  searchShell: {
    height: 44,
    borderRadius: 13,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 13,
    marginBottom: 11,
  },
  searchInput: {
    flex: 1,
    color: theme.ink,
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: 0,
  },
  filterRail: {
    gap: 8,
    paddingBottom: 14,
    paddingRight: 8,
  },
  filterChip: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
  },
  filterChipActive: {
    backgroundColor: theme.purple,
    borderColor: theme.purple,
  },
  filterChipText: {
    color: theme.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  trackedList: {
    gap: 10,
  },
  trackedCard: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 18,
    padding: 14,
  },
  trackedHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  trackedCopy: {
    flex: 1,
    minWidth: 0,
  },
  trackedName: {
    color: theme.ink,
    fontSize: 15.5,
    fontWeight: '800',
  },
  trackedMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 5,
  },
  trackedMeta: {
    flexShrink: 1,
    color: theme.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  trackedDetail: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    gap: 10,
  },
  trackedDelta: {
    color: '#157A3A',
    fontSize: 12.5,
    fontWeight: '700',
    textAlign: 'right',
  },
  trackedDeltaMuted: {
    color: theme.muted,
    fontSize: 12.5,
    fontWeight: '600',
    textAlign: 'right',
  },
  trackedLogList: {
    gap: 0,
  },
  trackedLogRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  trackedLogCopy: {
    flex: 1,
    minWidth: 0,
  },
  trackedLogTitle: {
    color: theme.ink,
    fontSize: 13,
    fontWeight: '800',
  },
  trackedLogMeta: {
    color: theme.muted,
    fontSize: 11.5,
    fontWeight: '600',
    marginTop: 2,
  },
  trackedLogValue: {
    color: theme.ink,
    fontSize: 13.5,
    fontWeight: '800',
  },
  emptyBlock: {
    alignItems: 'center',
    paddingVertical: 34,
    paddingHorizontal: 10,
  },
  emptyTitle: {
    color: theme.ink,
    fontSize: 15,
    fontWeight: '800',
  },
  emptyText: {
    color: theme.muted,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  measureDetailBlock: {
    gap: 10,
  },
  measureDetailHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  measureDetailLabel: {
    color: theme.muted,
    fontSize: 13,
    fontWeight: '800',
  },
  measureValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginTop: 8,
  },
  measureValue: {
    color: theme.ink,
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: -1,
    lineHeight: 44,
  },
  measureUnit: {
    color: theme.muted,
    fontSize: 17,
    fontWeight: '800',
  },
  measureCaption: {
    color: theme.muted,
    fontSize: 12.5,
    fontWeight: '600',
    marginTop: 6,
  },
  measureEntryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: 14,
  },
  measureInput: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: theme.bg,
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: 13,
    color: theme.ink,
    fontSize: 14.5,
    fontWeight: '700',
  },
  measureSaveButton: {
    height: 44,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: theme.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  measureSaveText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  measureList: {
    gap: 9,
  },
  measureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 13,
    paddingVertical: 11,
    backgroundColor: theme.surface,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: theme.border,
  },
  measureRowActive: {
    borderColor: theme.purple,
  },
  measureRowIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: theme.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  measureRowCopy: {
    flex: 1,
    minWidth: 0,
  },
  measureRowTitle: {
    color: theme.ink,
    fontSize: 14.5,
    fontWeight: '800',
  },
  measureRowMeta: {
    color: theme.muted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
});
