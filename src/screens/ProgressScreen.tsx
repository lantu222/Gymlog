import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Path, Polyline, Rect } from 'react-native-svg';

import { VinhaIcon } from '../components/VinhaIcon';
import { SimpleLineChart } from '../components/SimpleLineChart';
import { WeightTrendChart } from '../components/WeightTrendChart';
import { BmiEditSheet, MeasureLogSheet, WeightLogSheet } from '../components/MeasureRulerSheet';
import { WeightBmiCards } from '../components/WeightBmiCards';
import { buildBodyweightCardStats, buildValueWindow, buildWeightWindow } from '../lib/bodyweightCard';
import type { HomeRecentSessionItem } from './HomeScreen';
import { formatLiftDisplayLabel } from '../lib/displayLabel';
import {
  convertWeightFromKg,
  convertWeightToKg,
  formatCompactVolume,
  formatDate,
  formatDurationMinutes,
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
import { CutSurface } from '../components/CutSurface';
import { ProMomentSheet } from '../components/ProMomentSheet';
import { SetLogSheet } from '../components/SetLogSheet';
import { buildExerciseSetLog, ExerciseSetLog } from '../lib/exerciseSetLog';
import { weeklyTrainingStreak } from '../lib/trainingCalendar';
import { PW } from '../lightTheme';
import { Theme, useTheme, useThemedStyles } from '../theming';
import {
  isMeasureRangeLocked,
  isRecordLocked,
  isSetLogLocked,
  isTrendRangeLocked,
  resolveMeasureRange,
  resolveTrendRange,
} from '../lib/historyWindow';
import { getProgressActivityDayStatus } from '../lib/progressActivity';
import type { TrainingSchedule } from '../lib/trainingSchedule';
import type { PersonalRecord, RecordKind, RecordSource } from '../lib/personalRecords';
import { RecordRow, RecordsList } from './RecordsScreen';
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
  UnitPreference,
  WorkoutSession,
} from '../types/models';

type ProgressSection = 'overview' | 'records' | 'tracked' | 'measures';
type ProgressFilter = 'all' | 'new_best' | 'moving_up' | 'building' | 'below_last';
type OverviewMetric = 'volume' | 'duration' | 'bodyweight';
type OverviewRange = '7d' | '1m' | '3m' | '6m' | 'all';
type MeasureKey =
  | 'bodyweight'
  | 'bodyfat'
  | 'shoulders'
  | 'chest'
  | 'arms'
  | 'waist'
  | 'hips'
  | 'thighs'
  | 'calves';
type MeasureRange = '7d' | '3m' | '1y' | 'all';
type MeasureIconName = 'scale' | 'drop' | 'tape';

interface ProgressScreenProps {
  language?: AppLanguage;
  summaries: ExerciseProgressSummary[];
  bodyweightProgress: BodyweightProgressSummary;
  measurementEntries: MeasurementEntry[];
  workoutSessions: WorkoutSession[];
  /**
   * The plan's rhythm — cycle or weekdays — the same schedule Home and the
   * widget mark their calendars from, so all three agree on which day trains.
   */
  trainingSchedule?: TrainingSchedule;
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
  /** The measurement the measures section should select on arrival. */
  initialMeasure?: string;
  selectedExerciseKey?: string;
  /**
   * The three most recent records, and how many there are in total.
   *
   * The overview shows the ones just set; the full list has its own screen,
   * because three kinds of "best" do not fit a section.
   */
  topRecords?: PersonalRecord[];
  recordCount?: number;
  /** Every lift's record, per kind — the Records tab's whole content. */
  records?: Record<RecordKind, PersonalRecord[]>;
  /** One entry per tracked lift, for the set log behind each curve. */
  setLogSources?: RecordSource[];
  onStartWorkout?: () => void;
  showBodyweightDetail?: boolean;
  onAddBodyweight: (weightKg: number) => void;
  /** Stated height, in cm. Null until the reader gives one — BMI waits for it. */
  heightCm?: number | null;
  onSaveHeight?: (heightCm: number) => void;
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
  // calendar that does not exist. One logic for every calendar in the app
  // (user 2026-08-25): a training day is orange, a rest day is green. Solid
  // orange = trained, orange outline = a scheduled training day, green = rest.
  { key: 'done', labelKey: 'progress.legend.done', dotStyle: { backgroundColor: theme.highlight } },
  {
    key: 'planned',
    labelKey: 'progress.legend.upcoming',
    dotStyle: { borderWidth: 1.5, borderColor: theme.highlight },
  },
  { key: 'rest', labelKey: 'progress.legend.rest', dotStyle: { backgroundColor: theme.greenSoft } },
];

/**
 * Four sections, four marks, no words.
 *
 * Four text labels in a 351px row means the selected state is read word by word;
 * four marks are seen at a glance. The label survives as the accessibility name
 * on every tab, which is the part a screen reader needs and the part the eye
 * does not.
 *
 * Same 24-unit drawing language as the program category discs, in stroke-on-light
 * at tab weight. The barbell appears in both families on purpose — it means
 * "exercise" everywhere in this app, and the two rows never meet.
 */
const PROGRESS_SECTIONS: Array<{ key: ProgressSection; labelKey: I18nKey; icon: string }> = [
  {
    key: 'overview',
    labelKey: 'progress.section.overview',
    // A rising trend with a corner arrowhead: the summary answers one question.
    icon: 'M3.4 17.4 9.2 11.4l3.4 3 7.6-7.4M20.6 6.4h-4.4M20.6 6.4v4.4',
  },
  {
    key: 'records',
    labelKey: 'progress.section.records',
    // Trophy with both handles. A star would read as "favourite", and a medal
    // disc collides with the crosshair in the category set.
    icon: 'M7.8 4.2h8.4v3.2a4.2 4.2 0 0 1-8.4 0zM7.8 5.4H5.4a2.4 2.4 0 0 0 2.4 2.4M16.2 5.4h2.4a2.4 2.4 0 0 1-2.4 2.4M12 11.6v3.6M8.8 19.4h6.4',
  },
  {
    key: 'tracked',
    labelKey: 'progress.section.tracked',
    icon: 'M3.6 9.8v4.4M7 7.8v8.4M17 7.8v8.4M20.4 9.8v4.4M7 12h10',
  },
  {
    key: 'measures',
    labelKey: 'progress.section.measures',
    // A ruler edge, drawn open: a closed box fills in and goes solid at 22px.
    icon: 'M2.6 10.2h18.8M6.2 10.2v3.8M10.6 10.2v2.3M15 10.2v3.8M19.4 10.2v2.3',
  },
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
// `label` is a language-neutral abbreviation where one exists; the two ranges
// that need a word carry the key instead, so neither can ship untranslated.
const OVERVIEW_RANGES: Array<{ key: OverviewRange; label: string | null; labelKey?: I18nKey }> = [
  { key: '7d', label: null, labelKey: 'progress.range.week' },
  { key: '1m', label: '1M' },
  { key: '3m', label: '3M' },
  { key: '6m', label: '6M' },
  { key: 'all', label: null, labelKey: 'progress.range.all' },
];

const MEASURE_RANGES: Array<{ key: MeasureRange; label: string | null; labelKey?: I18nKey }> = [
  { key: '7d', label: null, labelKey: 'progress.range.week' },
  { key: '3m', label: '3M' },
  { key: '1y', label: '1Y' },
  { key: 'all', label: null, labelKey: 'progress.range.all' },
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
  { key: 'arms', labelKey: 'progress.measure.arms', icon: 'tape', kind: 'arms', lowerIsBetter: false },
  { key: 'waist', labelKey: 'progress.measure.waist', icon: 'tape', kind: 'waist', lowerIsBetter: true },
  { key: 'hips', labelKey: 'progress.measure.hips', icon: 'tape', kind: 'hips', lowerIsBetter: false },
  { key: 'thighs', labelKey: 'progress.measure.thighs', icon: 'tape', kind: 'thighs', lowerIsBetter: false },
  { key: 'calves', labelKey: 'progress.measure.calves', icon: 'tape', kind: 'calves', lowerIsBetter: false },
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
    case '7d':
      // Six days back plus today — the same seven the weight card draws.
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      return start;
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
  if ((range === '7d' || range === '1m' || range === '3m') && strategy === 'sum') {
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
    case '7d':
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

function ChevronRight({ color }: { color: string }) {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
      <Path d="M9 6l6 6-6 6" stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
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
    // A3: the shell and the selected option both take the cut. Every selector
    // in the app goes through this one component, so the shape lands on the
    // metric switch, the trend range and the measure range at once.
    <CutSurface size="sm" fill={theme.surfaceSoft} style={[styles.seg, grow && styles.segGrow]}>
      {options.map((option) => {
        const locked = lockedKeys?.includes(option.key) ?? false;
        const active = !locked && option.key === value;
        const inner = (
          <>
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
          </>
        );

        return (
          <Pressable
            key={option.key}
            accessibilityRole="button"
            accessibilityState={{ selected: active, disabled: false }}
            onPress={() => (locked ? onLockedPress?.() : onChange(option.key))}
            style={grow && styles.segItemGrow}
          >
            {active ? (
              <CutSurface size="chip" fill={theme.surface} style={[styles.segItem, styles.segItemActive]}>
                {inner}
              </CutSurface>
            ) : (
              <View style={styles.segItem}>{inner}</View>
            )}
          </Pressable>
        );
      })}
    </CutSurface>
  );
}

export function ProgressScreen({
  summaries,
  bodyweightProgress,
  measurementEntries,
  workoutSessions,
  activityCalendar,
  trainingSchedule,
  rhythm,
  weeklyTargetSessions = null,
  unitPreference,
  language = 'en',
  initialSection,
  initialMeasure,
  selectedExerciseKey,
  topRecords = [],
  recordCount = 0,
  records = { weight: [], reps: [], volume: [] },
  setLogSources = [],
  onStartWorkout,
  showBodyweightDetail,
  onAddBodyweight,
  heightCm = null,
  onSaveHeight,
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
  const [setLogKey, setSetLogKey] = useState<string | null>(null);
  const [progressQuery, setProgressQuery] = useState('');
  const [progressFilter, setProgressFilter] = useState<ProgressFilter>('all');
  const [expandedKey, setExpandedKey] = useState<string | null>(selectedExerciseKey ?? null);
  const [overviewMetric, setOverviewMetric] = useState<OverviewMetric>('volume');
  // The week opens both charts (user 2026-08-25) — see TrendRange.
  const [overviewRange, setOverviewRange] = useState<OverviewRange>('7d');
  const [selectedMeasure, setSelectedMeasure] = useState<MeasureKey>(showBodyweightDetail ? 'bodyweight' : 'bodyweight');
  const [measureRange, setMeasureRange] = useState<MeasureRange>('7d');
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
  const [measureSheetVisible, setMeasureSheetVisible] = useState(false);
  const [weightSheetVisible, setWeightSheetVisible] = useState(false);
  const [bmiSheetVisible, setBmiSheetVisible] = useState(false);
  const bodyweightStats = useMemo(
    () => buildBodyweightCardStats(bodyweightProgress.entries),
    [bodyweightProgress.entries],
  );
  const weightWindowDays = useMemo(
    () => buildWeightWindow(bodyweightProgress.entries, Date.now()),
    [bodyweightProgress.entries],
  );
  /**
   * What the rulers open on. Not a default the reader has to correct: their
   * last weigh-in, or the weight onboarding recorded, and only then a middle-
   * of-the-range number that at least costs a short drag rather than a long one.
   */
  const rulerWeightKg = bodyweightStats.currentKg ?? 75;
  const rulerHeightCm = heightCm ?? 175;
  const scrollRef = useRef<ScrollView>(null);

  const trainingStreak = useMemo(() => weeklyTrainingStreak(workoutSessions), [workoutSessions]);

  const openSetLog: ExerciseSetLog | null = useMemo(() => {
    if (setLogKey === null) {
      return null;
    }
    const source = setLogSources.find((entry) => entry.key === setLogKey);
    return source ? buildExerciseSetLog(source) : null;
  }, [setLogKey, setLogSources]);

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

  /**
   * The trend tab's bodyweight grid, on the same calendar-days axis as the
   * weight card. The user put the two side by side and asked why the same
   * weight looks different on different tabs (2026-08-25) — there was no
   * answer, so now it cannot.
   */
  const overviewWeightWindow = useMemo(() => {
    const nowMs = Date.now();
    const daysByRange: Record<string, number> = { '7d': 7, '1m': 31, '3m': 91, '6m': 183 };
    let days = daysByRange[resolvedOverviewRange];
    if (!days) {
      const first = bodyweightProgress.entries.length
        ? Math.min(...bodyweightProgress.entries.map((entry) => new Date(entry.recordedAt).getTime()))
        : nowMs;
      days = Math.min(730, Math.max(14, Math.ceil((nowMs - first) / 86_400_000) + 1));
    }
    return buildValueWindow(
      bodyweightProgress.entries.map((entry) => ({ recordedAt: entry.recordedAt, value: entry.weight })),
      nowMs,
      days,
    );
  }, [bodyweightProgress.entries, resolvedOverviewRange]);

  const overviewChart = useMemo(() => {
    const start = getOverviewRangeStart(resolvedOverviewRange);
    // Seen with the clock 100 days ahead of one logged session: the 3-month
    // window held nothing, and the chart said "no volume data yet" over a log
    // that had some. "Yet" is the empty account's word. When the range is the
    // only thing empty, the chart says that instead — which is also the one
    // honest place to hint at what the longer ranges are for.
    const isBefore = (iso: string) => Boolean(start) && new Date(iso) < (start as Date);

    if (overviewMetric === 'bodyweight') {
      const entries = [...bodyweightProgress.entries]
        .filter((entry) => !start || new Date(entry.recordedAt) >= start)
        .reverse();
      const olderEntriesExist = !entries.length && bodyweightProgress.entries.some((entry) => isBefore(entry.recordedAt));

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
        emptyLabel: t(language, olderEntriesExist ? 'progress.noEntriesRange' : 'progress.noBodyweight'),
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
    const olderSessionsExist = !rows.length && workoutSessions.some((session) => isBefore(session.performedAt));

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
        emptyLabel: t(language, olderSessionsExist ? 'progress.noSessionsRange' : 'progress.noDurations'),
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
      emptyLabel: t(language, olderSessionsExist ? 'progress.noSessionsRange' : 'progress.noVolume'),
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

  // A stat card names its measurement; arriving from one selects it, so the
  // input the reader came to use is the one on screen. Only keys this screen
  // knows are honoured — an unknown one leaves the selection alone.
  useEffect(() => {
    if (initialMeasure && measureModels.some((model) => model.key === initialMeasure)) {
      setSelectedMeasure(initialMeasure as MeasureKey);
    }
    // measureModels is stable per language; the key is what changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMeasure]);
  const selectedMeasureModel = measureModels.find((model) => model.key === selectedMeasure) ?? measureModels[0];

  // The unit-follows-the-measure effect went with the text field: the ruler
  // dials the measure's own unit and there is no draft to clear between them.

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

  /**
   * The same calendar-days axis the weight card draws (the photo the user
   * sent, 2026-08-25, is the reference): orange line, hollow dots, a day per
   * slot so a gap stays a gap. The range picker sets the window's length;
   * "all" reaches back to the first entry.
   */
  const selectedMeasureWindow = useMemo(() => {
    const entries = selectedMeasureModel.values.map((value, index) => ({
      recordedAt: selectedMeasureModel.dates[index],
      value,
    }));
    const nowMs = Date.now();
    let days: number;
    if (resolvedMeasureRange === '7d') {
      days = 7;
    } else if (resolvedMeasureRange === '3m') {
      days = 91;
    } else if (resolvedMeasureRange === '1y') {
      days = 365;
    } else {
      const first = entries.length ? new Date(entries[0].recordedAt).getTime() : nowMs;
      days = Math.min(730, Math.max(14, Math.ceil((nowMs - first) / 86_400_000) + 1));
    }
    return buildValueWindow(entries, nowMs, days);
  }, [resolvedMeasureRange, selectedMeasureModel]);

  const selectedMeasureLatest = selectedMeasureModel.values.length
    ? selectedMeasureModel.values[selectedMeasureModel.values.length - 1]
    : null;
  const selectedMeasureDelta =
    selectedMeasureRangePoints.length >= 2
      ? selectedMeasureRangePoints[selectedMeasureRangePoints.length - 1].value - selectedMeasureRangePoints[0].value
      : null;

  async function handleSaveMeasure(value: number) {
    if (!Number.isFinite(value) || value <= 0) {
      return;
    }

    if (selectedMeasureModel.kind === null) {
      onAddBodyweight(convertWeightToKg(value, unitPreference));
    } else {
      // Always centimetres: the ruler dials the unit the app stores, so there
      // is no reading to convert on the way in.
      await onAddMeasurement(selectedMeasureModel.kind, value, 'cm');
    }
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
          {overviewMetric === 'bodyweight' ? (
            overviewWeightWindow.some((day) => day.value !== null) ? (
              <WeightTrendChart days={overviewWeightWindow} />
            ) : (
              <Text style={styles.measureChartEmpty}>{overviewChart.emptyLabel}</Text>
            )
          ) : (
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
          )}
          <View style={styles.trendRangeRow}>
            <Seg
              options={OVERVIEW_RANGES.map((option) => ({
                key: option.key,
                label: option.label ?? t(language, option.labelKey ?? 'progress.range.all'),
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

        {topRecords.length > 0 ? (
          <>
            <SectionLabel
              label={t(language, 'pr.records')}
              right={
                <Pressable
                  onPress={() => switchSection('records')}
                  hitSlop={8}
                  style={styles.recordsLinkRow}
                >
                  <Text style={styles.recordsLink}>
                    {t(language, 'pr.allRecords', { count: recordCount })}
                  </Text>
                  <ChevronRight color={theme.purple} />
                </Pressable>
              }
            />
            <View style={styles.recordsList}>
              {topRecords.map((record) => {
                const locked = isRecordLocked(record.performedAt, proUnlocked);
                return (
                  <RecordRow
                    key={`${record.key}-${record.kind}`}
                    record={record}
                    language={language}
                    locked={locked}
                    onPress={locked ? onOpenPremium : undefined}
                  />
                );
              })}
            </View>
          </>
        ) : null}

        <SectionLabel
          label={t(language, 'progress.section.activity')}
          right={calendarMonthLabel}
        />
        <View style={styles.card}>
          {/* The streak the calendar is really about, above the grid it is
              counted from. The current week never breaks it — see
              weeklyTrainingStreak. */}
          <View style={styles.streakRow}>
            <View style={styles.streakValueLine}>
              <Text style={styles.streakValue}>{trainingStreak}</Text>
              {/* Finnish takes the nominative after one and the partitive
                  after anything else: "1 viikko", "2 viikkoa". */}
              <Text style={styles.streakLabel}>
                {t(language, trainingStreak === 1 ? 'cal.streakOne' : 'cal.streak')}
              </Text>
            </View>
            <Text style={styles.streakCount}>
              {monthStats.sessions === 1
                ? t(language, 'cal.monthSessionsOne')
                : t(language, 'cal.monthSessions', { count: monthStats.sessions })}
            </Text>
          </View>
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
                schedule: trainingSchedule,
                todayStart: todayStartTimestamp,
              });
              if (status === 'outside') {
                return <View key={day.dayStart} style={styles.calendarCell} />;
              }

              // Two colours, one logic, every calendar (user 2026-08-25):
              // a training day is orange, a rest day is green. Trained gets
              // the solid fill; a scheduled day — behind or ahead — gets the
              // outline. Missed is not singled out: the history records what
              // happened, not what did not.
              const planned = status === 'missed' || status === 'upcoming';
              return (
                <View key={day.dayStart} style={styles.calendarCell}>
                  <View
                    style={[
                      styles.calendarBubble,
                      status === 'done' && styles.calendarBubbleDone,
                      planned && styles.calendarBubblePlanned,
                      status !== 'done' && day.isToday && styles.calendarBubbleToday,
                    ]}
                  >
                    <Text
                      style={[
                        styles.calendarBubbleText,
                        status === 'done' && styles.calendarBubbleTextDone,
                        planned && styles.calendarBubbleTextPlanned,
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

  function renderRecords() {
    return (
      <RecordsList
        records={records}
        language={language}
        proUnlocked={proUnlocked}
        onOpenPro={() => onOpenPremium?.()}
        onStartWorkout={() => onStartWorkout?.()}
        onOpenExercise={(key) => setSetLogKey(key)}
      />
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
              <Pressable key={filter.key} onPress={() => setProgressFilter(filter.key)}>
                <CutSurface
                  size="chip"
                  fill={active ? theme.purple : theme.surface}
                  stroke={active ? theme.purple : theme.border}
                  strokeWidth={1}
                  style={styles.filterChip}
                >
                  <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                    {t(language, filter.labelKey)}
                  </Text>
                </CutSurface>
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
                  {/* The row opens the set log; the chevron still expands the
                      chart in place, so the curve stays one tap away without
                      going through the sheet. */}
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setSetLogKey(summary.key)}
                    style={styles.trackedHead}
                  >
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
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ expanded: isOpen }}
                      onPress={() => setExpandedKey(isOpen ? null : summary.key)}
                      hitSlop={10}
                    >
                      <ChevronDown open={isOpen} />
                    </Pressable>
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
                      {/* The three most recent sessions used to be listed here
                          with their sets. That is the set log, and it now
                          lives on the sheet behind the Pro gate — leaving a
                          free copy of it three rows deep would make the lock
                          decorative. */}
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => setSetLogKey(summary.key)}
                        style={({ pressed }) => [styles.trackedLogLink, pressed && { opacity: 0.85 }]}
                      >
                        <Text style={styles.trackedLogLinkText}>{t(language, 'setlog.open')}</Text>
                        <ChevronRight color={theme.purple} />
                      </Pressable>
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

    // Body weight gets the dedicated card pair (current + extremes + BMI
    // gauge) instead of the generic measure detail. Every other measure keeps
    // the numeric field: they have no BMI, no record-high/low worth naming,
    // and a ruler for "waist, in cm" would be a dial with nothing to dial to.
    if (model.kind === null) {
      return (
        <>
          <View style={styles.measureDetailBlock}>
            <WeightBmiCards
              language={language}
              currentKg={bodyweightStats.currentKg}
              heaviestKg={bodyweightStats.heaviestKg}
              lightestKg={bodyweightStats.lightestKg}
              heightCm={heightCm}
              chartDays={weightWindowDays}
              onLogWeight={() => setWeightSheetVisible(true)}
              onEditBmi={() => setBmiSheetVisible(true)}
            />
            {/* No range selector here, on purpose. The weight curve is a fixed
                week centred on today — a 3-month window would put the reader's
                first weigh-in against the right-hand edge instead of in the
                middle, which is the whole point of the card. The long view is
                one tab over: Summary → Trend → Body weight, where the range
                selector still applies. */}
          </View>
          {renderMeasureList()}
        </>
      );
    }

    return (
      <>
        <View style={styles.measureDetailBlock}>
          <View style={styles.card}>
            <View style={styles.measureDetailHead}>
              <Text style={styles.measureDetailLabel}>{t(language, model.labelKey)}</Text>
              <View style={styles.measureHeadActions}>
                {selectedMeasureDelta !== null && selectedMeasureDelta !== 0 ? (
                  <DeltaPill delta={selectedMeasureDelta} unit={model.unit} lowerIsBetter={model.lowerIsBetter} />
                ) : null}
                {/* The same pill the weight card carries, opening the same
                    kind of ruler — user 2026-08-25 asked for one way to log a
                    number, not two. */}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t(language, 'weightCard.log')}
                  onPress={() => setMeasureSheetVisible(true)}
                  style={({ pressed }) => [styles.measureLogPill, pressed && { opacity: 0.75 }]}
                >
                  <Text style={styles.measureLogPillText}>{t(language, 'weightCard.log')}</Text>
                </Pressable>
              </View>
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

          </View>

          {selectedMeasureWindow.some((day) => day.value !== null) ? (
            <WeightTrendChart days={selectedMeasureWindow} />
          ) : (
            <Text style={styles.measureChartEmpty}>{t(language, 'progress.noEntriesRange')}</Text>
          )}
          <View style={styles.trendRangeRow}>
            <Seg
              options={MEASURE_RANGES.map((option) => ({
                key: option.key,
                label: option.label ?? t(language, option.labelKey ?? 'progress.range.all'),
              }))}
              value={resolvedMeasureRange}
              onChange={setMeasureRange}
              lockedKeys={lockedMeasureRanges}
              onLockedPress={onOpenPremium}
            />
          </View>
        </View>

        {renderMeasureList()}
      </>
    );
  }

  /** Shared by both measure layouts — the picker has to stay reachable. */
  function renderMeasureList() {
    return (
      <>
        <SectionLabel label={t(language, 'progress.section.allMeasures')} />
        <View style={styles.measureList}>
          {/* Measures with entries first, outlined (user 2026-08-23): the
              catalog order buried "Rinta · 93,5 cm" under three empty rows.
              The sort is stable, so within each half the catalog order holds. */}
          {[...measureModels]
            .sort((left, right) => Number(right.values.length > 0) - Number(left.values.length > 0))
            .map((item) => {
            const active = item.key === selectedMeasure;
            const latest = item.values.length ? item.values[item.values.length - 1] : null;
            const delta = item.values.length >= 2 ? item.values[item.values.length - 1] - item.values[0] : null;
            const good = delta === null ? true : item.lowerIsBetter ? delta < 0 : delta > 0;
            return (
              <Pressable
                key={item.key}
                onPress={() => setSelectedMeasure(item.key)}
                style={[
                  styles.measureRow,
                  latest !== null && styles.measureRowLogged,
                  active && styles.measureRowActive,
                ]}
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
        {/* A3: the selector carries the cut, and so does the selected tab —
            the design's VALITSIN. The inner tab sits inside the shell's
            padding, so the two cuts are not in the same corner. */}
        <CutSurface size="md" fill={theme.surfaceSoft} style={styles.tabsRow}>
          {PROGRESS_SECTIONS.map((section) => {
            const active = section.key === progressSection;
            return (
              <Pressable
                key={section.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                // The word moved out of the tab, so it has to live here.
                accessibilityLabel={t(language, section.labelKey)}
                onPress={() => switchSection(section.key)}
                style={styles.tab}
              >
                {/* Both states are the same height, or the selected one grows
                    the row and pushes itself out of the shell. */}
                {active ? (
                  <CutSurface size="sm" fill={theme.surface} style={[styles.tabInner, styles.tabActive]}>
                    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                      <Path
                        d={section.icon}
                        stroke={theme.purpleDark}
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
                  </CutSurface>
                ) : (
                  <View style={styles.tabInner}>
                    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                      <Path
                        d={section.icon}
                        stroke={theme.muted}
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
                  </View>
                )}
              </Pressable>
            );
          })}
        </CutSurface>
      </View>

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        {progressSection === 'overview' ? renderOverview() : null}
        {progressSection === 'records' ? renderRecords() : null}
        {progressSection === 'tracked' ? renderTracked() : null}
        {progressSection === 'measures' ? renderMeasures() : null}
      </ScrollView>

      <WeightLogSheet
        visible={weightSheetVisible}
        language={language}
        initialKg={rulerWeightKg}
        dateIso={new Date().toISOString()}
        onCancel={() => setWeightSheetVisible(false)}
        onSave={(weightKg) => {
          onAddBodyweight(weightKg);
          setWeightSheetVisible(false);
        }}
      />
      {/* Tape measures and body fat, on the same ruler. Opens on the last
          reading, or mid-scale when there is nothing to open on. */}
      <MeasureLogSheet
        visible={measureSheetVisible}
        language={language}
        title={t(language, selectedMeasureModel.labelKey)}
        unit={selectedMeasureModel.unit}
        initialValue={
          selectedMeasureLatest ?? (selectedMeasureModel.unit === '%' ? 20 : 90)
        }
        dateIso={new Date().toISOString()}
        onCancel={() => setMeasureSheetVisible(false)}
        onSave={(value) => {
          void handleSaveMeasure(value);
          setMeasureSheetVisible(false);
        }}
      />
      <BmiEditSheet
        visible={bmiSheetVisible}
        language={language}
        initialKg={rulerWeightKg}
        initialHeightCm={rulerHeightCm}
        onCancel={() => setBmiSheetVisible(false)}
        onSave={({ weightKg, heightCm: nextHeight }) => {
          onSaveHeight?.(nextHeight);
          // Only writes a weigh-in when the reader actually moved the weight
          // dial. Editing your height should not silently stamp today with a
          // weight you did not step on a scale for.
          if (Math.abs(weightKg - rulerWeightKg) >= 0.05) {
            onAddBodyweight(weightKg);
          }
          setBmiSheetVisible(false);
        }}
      />

      {/* One lift's sets, over the curve they belong to. */}
      <SetLogSheet
        visible={setLogKey !== null}
        log={openSetLog}
        language={language}
        locked={isSetLogLocked(proUnlocked)}
        onClose={() => setSetLogKey(null)}
        onStartWorkout={
          onStartWorkout
            ? () => {
                setSetLogKey(null);
                onStartWorkout();
              }
            : undefined
        }
        onOpenPro={() => {
          setSetLogKey(null);
          onOpenPremium?.();
        }}
      />

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
    padding: 3,
    marginTop: 14,
  },
  tab: {
    flex: 1,
  },
  tabInner: {
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
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
  streakRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 13,
  },
  streakValueLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 7,
  },
  streakValue: {
    color: theme.ink,
    fontSize: 24,
    lineHeight: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  streakLabel: {
    color: theme.muted,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
  },
  streakCount: {
    color: theme.purple,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  recordsLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
    padding: 3,
    gap: 2,
  },
  segGrow: {
    alignSelf: 'stretch',
  },
  segItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  segItemGrow: {
    flex: 1,
    alignItems: 'center',
  },
  segItemActive: {
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
  // Rest is the default and by far the most common cell, so it carries the
  // quiet green tint — loud enough to say "rest is green" (user 2026-08-25),
  // soft enough that the orange training days still lead the eye.
  calendarBubble: {
    aspectRatio: 1,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.greenSoft,
  },
  calendarBubbleDone: {
    backgroundColor: theme.highlight,
  },
  // One outline for behind and ahead alike: it marks a scheduled training
  // day, and the history is no place to be scolded for a skipped Thursday.
  calendarBubblePlanned: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: theme.highlight,
  },
  calendarBubbleToday: {
    borderWidth: 1.5,
    borderColor: theme.highlight,
    borderStyle: 'dashed',
  },
  calendarBubbleText: {
    color: theme.greenInk,
    fontSize: 11.5,
    fontWeight: '700',
  },
  calendarBubbleTextDone: {
    color: theme.onHighlight,
  },
  calendarBubbleTextPlanned: {
    color: theme.highlight,
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
    color: theme.highlight,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipActive: {
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
  trackedLogLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.bg,
  },
  trackedLogLinkText: {
    color: theme.purple,
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '800',
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
  measureChartEmpty: {
    marginTop: 16,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    color: theme.faint,
  },
  measureHeadActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  // The weight card's action pill, same shape and same accent, because it
  // opens the same kind of sheet.
  measureLogPill: {
    backgroundColor: theme.highlight,
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 20,
  },
  measureLogPillText: {
    color: theme.onHighlight,
    fontSize: 14.5,
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
  // A row that holds data wears a quiet outline; the selected row keeps the
  // full-strength purple so the two states stay tellable apart.
  measureRowLogged: {
    borderColor: theme.purpleBright,
    borderWidth: 1,
  },
  measureRowActive: {
    borderColor: theme.purple,
    borderWidth: 1.5,
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
