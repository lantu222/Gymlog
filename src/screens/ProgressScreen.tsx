import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';

import { EmptyState } from '../components/EmptyState';
import { SectionHeaderBlock, SurfaceCard } from '../components/MainScreenPrimitives';
import { ProgressCard } from '../components/ProgressCard';
import { ScreenHeader } from '../components/ScreenHeader';
import { SegmentedControl } from '../components/SegmentedControl';
import { SimpleLineChart } from '../components/SimpleLineChart';
import { StatChip } from '../components/StatChip';
import { formatLiftDisplayLabel } from '../lib/displayLabel';
import { getLogSetStatusCounts } from '../lib/exerciseLog';
import {
  convertWeightFromKg,
  convertWeightToKg,
  formatDate,
  formatLogSetSummary,
  formatShortDate,
  formatWeight,
  formatWeightTrend,
  parseNumberInput,
} from '../lib/format';
import {
  BodyweightProgressSummary,
  ExerciseProgressSummary,
  getExerciseProgressSignal,
} from '../lib/progression';
import { colors, layout, radii, spacing } from '../theme';
import { UnitPreference } from '../types/models';

interface ProgressScreenProps {
  summaries: ExerciseProgressSummary[];
  bodyweightProgress: BodyweightProgressSummary;
  unitPreference: UnitPreference;
  selectedExerciseKey?: string;
  showBodyweightDetail?: boolean;
  onSelectExercise: (exerciseKey: string) => void;
  onSelectBodyweight: () => void;
  onAddBodyweight: (weightKg: number) => void;
  onBack: () => void;
}

const overviewTones = ['blue', 'rose', 'orange'] as const;

type ProgressFilter = 'all' | 'new_best' | 'moving_up' | 'building' | 'below_last';

const PROGRESS_FILTERS: Array<{ key: ProgressFilter; label: string }> = [
  { key: 'all', label: 'All lifts' },
  { key: 'new_best', label: 'New best' },
  { key: 'moving_up', label: 'Moving up' },
  { key: 'building', label: 'Building' },
  { key: 'below_last', label: 'Below last' },
];

function getBarHeights(values: number[]) {
  if (!values.length) {
    return [];
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = Math.max(max - min, 1);

  return values.map((value) => 10 + ((value - min) / spread) * 30);
}

function DataTable({
  header,
  rows,
}: {
  header: string[];
  rows: Array<Array<string>>;
}) {
  return (
    <View style={styles.table}>
      <View style={styles.tableHeader}>
        {header.map((cell, index) => (
          <Text key={`${cell}:${index}`} style={[styles.tableHeaderText, index === 0 && styles.dateColumn]}>
            {cell}
          </Text>
        ))}
      </View>
      {rows.map((row, rowIndex) => (
        <View key={`row:${rowIndex}`} style={styles.tableRow}>
          {row.map((cell, cellIndex) => (
            <Text key={`${rowIndex}:${cellIndex}`} style={[styles.tableCell, cellIndex === 0 && styles.dateColumn]}>
              {cell}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

export function ProgressScreen({
  summaries,
  bodyweightProgress,
  unitPreference,
  selectedExerciseKey,
  showBodyweightDetail,
  onSelectExercise,
  onSelectBodyweight,
  onAddBodyweight,
  onBack,
}: ProgressScreenProps) {
  const { width } = useWindowDimensions();
  const [viewMode, setViewMode] = useState<'overview' | 'table' | 'chart'>('overview');
  const [bodyweightInput, setBodyweightInput] = useState('');
  const [progressQuery, setProgressQuery] = useState('');
  const [progressFilter, setProgressFilter] = useState<ProgressFilter>('all');
  const selectedSummary = summaries.find((summary) => summary.key === selectedExerciseKey);
  const selectedSummaryDisplayName = selectedSummary ? formatLiftDisplayLabel(selectedSummary.name) : '';
  const stackSummaryTiles = width < 390;
  const stackSummaryHeader = width < 480;

  useEffect(() => {
    setViewMode('overview');
  }, [selectedExerciseKey, showBodyweightDetail]);

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
          label: formatShortDate(entry.recordedAt),
          value: convertWeightFromKg(entry.weight, unitPreference),
        })),
    [bodyweightProgress.entries, unitPreference],
  );

  const bodyweightBars = useMemo(
    () =>
      getBarHeights(
        [...bodyweightProgress.entries]
          .slice(0, 6)
          .reverse()
          .map((entry) => convertWeightFromKg(entry.weight, unitPreference)),
      ),
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
      .join(' \u00b7 ');

    if (!selectedSummary.latestLog.swappedFrom && !selectedSummary.latestLog.notes && !statusSummary) {
      return null;
    }

    return {
      sessionLabel: `${selectedSummary.latestLog.workoutNameSnapshot} \u00b7 ${formatShortDate(selectedSummary.latestLog.performedAt)}`,
      swapLine: selectedSummary.latestLog.swappedFrom
        ? `Swapped from ${formatLiftDisplayLabel(selectedSummary.latestLog.swappedFrom)}`
        : null,
      notesLine: selectedSummary.latestLog.notes ?? null,
      statusLine: statusSummary ? `Set detail: ${statusSummary}` : null,
    };
  }, [selectedSummary]);

  if (showBodyweightDetail) {
    const latest = bodyweightProgress.latest;
    const previous = bodyweightProgress.previous;

    return (
      <>
        <ScreenHeader title="Bodyweight" subtitle="Lightweight progress tracking without clutter." onBack={onBack} />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <SegmentedControl
            options={[
              { key: 'overview', label: 'Overview' },
              { key: 'table', label: 'Table' },
              { key: 'chart', label: 'Chart' },
            ]}
            selectedKey={viewMode}
            onSelect={(key) => setViewMode(key as 'overview' | 'table' | 'chart')}
          />

          <SurfaceCard accent="blue" emphasis="standard" style={styles.detailCard}>
            <SectionHeaderBlock
              accent="blue"
              kicker="Bodyweight"
              title="Log a new entry"
              subtitle="Add one number and it flows into overview, table, and chart."
            />
            <View style={styles.bodyweightEntryRow}>
              <TextInput
                value={bodyweightInput}
                onChangeText={setBodyweightInput}
                keyboardType="decimal-pad"
                placeholder={`0 ${unitPreference}`}
                placeholderTextColor={colors.textMuted}
                style={styles.bodyweightInput}
                selectionColor={colors.accent}
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

          {viewMode === 'overview' ? (
            <View style={styles.metricsRow}>
              <StatChip label="Latest" value={formatWeight(latest?.weight, unitPreference)} tone="accent" />
              <StatChip label="Previous" value={formatWeight(previous?.weight, unitPreference)} />
              <StatChip
                label="Change"
                value={formatWeightTrend(latest?.weight ?? null, previous?.weight ?? null, unitPreference)}
              />
            </View>
          ) : null}

          {viewMode === 'table' ? (
            <SurfaceCard accent="blue" emphasis="utility" style={styles.tableCard}>
              <DataTable
                header={['Date', 'Weight']}
                rows={bodyweightProgress.entries.map((entry) => [
                  formatDate(entry.recordedAt),
                  formatWeight(entry.weight, unitPreference),
                ])}
              />
            </SurfaceCard>
          ) : null}

          {viewMode === 'chart' ? (
            <SurfaceCard accent="blue" emphasis="utility" style={styles.chartCard}>
              <SimpleLineChart points={bodyweightChartPoints} unitLabel={unitPreference} accent={colors.accentAlt} />
            </SurfaceCard>
          ) : null}
        </ScrollView>
      </>
    );
  }

  if (selectedSummary) {
    return (
      <>
        <ScreenHeader title={selectedSummaryDisplayName} subtitle="Tracked lift history" onBack={onBack} />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <SegmentedControl
            options={[
              { key: 'overview', label: 'Overview' },
              { key: 'table', label: 'Table' },
              { key: 'chart', label: 'Chart' },
            ]}
            selectedKey={viewMode}
            onSelect={(key) => setViewMode(key as 'overview' | 'table' | 'chart')}
          />

          {viewMode === 'overview' ? (
            <>
              {selectedSummaryLatestContext ? (
                <SurfaceCard accent="rose" emphasis="flat" style={styles.contextCard}>
                  <Text style={styles.contextKicker}>Latest session context</Text>
                  <Text style={styles.contextTitle}>{selectedSummaryLatestContext.sessionLabel}</Text>
                  {selectedSummaryLatestContext.swapLine ? (
                    <Text style={styles.contextBody}>{selectedSummaryLatestContext.swapLine}</Text>
                  ) : null}
                  {selectedSummaryLatestContext.statusLine ? (
                    <Text style={styles.contextBody}>{selectedSummaryLatestContext.statusLine}</Text>
                  ) : null}
                  {selectedSummaryLatestContext.notesLine ? (
                    <Text style={styles.contextNote}>{selectedSummaryLatestContext.notesLine}</Text>
                  ) : null}
                </SurfaceCard>
              ) : null}

              <View style={styles.metricsRow}>
                <StatChip label="Latest" value={formatWeight(selectedSummary.latestWeight, unitPreference)} tone="accent" />
                <StatChip label="Previous" value={formatWeight(selectedSummary.previousWeight, unitPreference)} />
                <StatChip label="Latest sets" value={formatLogSetSummary(selectedSummary.latestLog, unitPreference)} />
                <StatChip label="Best weight" value={formatWeight(selectedSummary.bestWeight, unitPreference)} tone="success" />
                <StatChip label="Best reps" value={`${selectedSummary.bestReps}`} />
              </View>
            </>
          ) : null}

          {viewMode === 'table' ? (
            <SurfaceCard accent="blue" emphasis="utility" style={styles.tableCard}>
              <DataTable
                header={['Date', 'Top weight', 'Sets']}
                rows={selectedSummary.logs.map((log) => [
                  formatDate(log.performedAt),
                  formatWeight(log.weight, unitPreference),
                  formatLogSetSummary(log, unitPreference),
                ])}
              />
            </SurfaceCard>
          ) : null}

          {viewMode === 'chart' ? (
            <SurfaceCard accent="blue" emphasis="utility" style={styles.chartCard}>
              <SimpleLineChart points={chartPoints} unitLabel={unitPreference} />
            </SurfaceCard>
          ) : null}
        </ScrollView>
      </>
    );
  }

  return (
    <>
      <ScreenHeader title="Progress" subtitle="Data first. Signals, trends, and details on tap." />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.summaryRow, stackSummaryTiles && styles.summaryRowStacked]}>
          <SurfaceCard accent="blue" emphasis="utility" onPress={onSelectBodyweight} style={styles.summaryTile}>
            <View style={[styles.summaryHeaderRow, stackSummaryHeader && styles.summaryHeaderRowStacked]}>
              <Text style={styles.tileTitle}>Bodyweight</Text>
              <View style={[styles.tileBadgeBlue, stackSummaryHeader && styles.tileBadgeBlueStacked]}>
                <Text style={styles.tileBadgeBlueText}>
                  {formatWeightTrend(
                    bodyweightProgress.latest?.weight ?? null,
                    bodyweightProgress.previous?.weight ?? null,
                    unitPreference,
                  )}
                </Text>
              </View>
            </View>
            <View style={styles.summaryMetricRow}>
              <View style={styles.summaryMetricBox}>
                <Text style={styles.tileMetricLabel}>Latest</Text>
                <Text style={styles.tileMetricValue}>{formatWeight(bodyweightProgress.latest?.weight, unitPreference)}</Text>
              </View>
              <View style={styles.summaryMetricBox}>
                <Text style={styles.tileMetricLabel}>Entries</Text>
                <Text style={styles.tileMetricValue}>{bodyweightProgress.entries.length}</Text>
              </View>
            </View>
            <View style={styles.barRow}>
              {bodyweightBars.length ? (
                bodyweightBars.map((height, index) => <View key={`bw:${index}`} style={[styles.bar, { height }]} />)
              ) : (
                <Text style={styles.noBarText}>Add your first entry.</Text>
              )}
            </View>
          </SurfaceCard>

          <SurfaceCard accent="rose" emphasis="utility" style={[styles.summaryTile, styles.trackedTile]}>
            <Text style={styles.tileLabel}>Tracked lifts</Text>
            <Text style={styles.trackedValue}>{summaries.length}</Text>
            <Text style={styles.tileBody}>
              {summaries[0]
                ? `${signalCounts.new_best} new best \u00b7 ${signalCounts.moving_up} moving up`
                : 'Mark exercises as tracked while logging.'}
            </Text>
            {summaries[0] ? (
              <Text style={styles.tileSubtle}>Most recent: {formatLiftDisplayLabel(summaries[0].name)}</Text>
            ) : null}
          </SurfaceCard>
        </View>

        {summaries.length === 0 ? (
          <EmptyState
            title="No tracked lifts yet"
            description="Mark an exercise as tracked while logging and it will show up here with a clean progression view."
          />
        ) : (
          <>
            <SurfaceCard accent="blue" emphasis="flat" style={styles.discoveryCard}>
              <Text style={styles.discoveryLabel}>Signals</Text>
              <Text style={styles.discoveryTitle}>Find the next useful change</Text>
              <TextInput
                value={progressQuery}
                onChangeText={setProgressQuery}
                placeholder="Search tracked lifts"
                placeholderTextColor={colors.textMuted}
                selectionColor={colors.accentAlt}
                style={styles.searchInput}
              />
              <Text style={styles.discoveryMeta}>
                {filteredSummaries.length} lifts {'\u00b7'} {signalCounts.new_best} new best {'\u00b7'} {signalCounts.moving_up} moving up
              </Text>
              <View style={styles.filterRow}>
                {PROGRESS_FILTERS.map((filter) => {
                  const active = filter.key === progressFilter;
                  return (
                    <Pressable
                      key={filter.key}
                      onPress={() => setProgressFilter(filter.key)}
                      style={[styles.filterChip, active && styles.filterChipActive]}
                    >
                      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{filter.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </SurfaceCard>

            {filteredSummaries.length ? (
              <View style={styles.progressList}>
                <SectionHeaderBlock
                  accent="rose"
                  kicker="Tracked progress"
                  title="Interesting numbers first"
                  subtitle="Tap a lift to inspect the details behind the latest trend."
                />
                {filteredSummaries.map((summary, index) => (
                  <ProgressCard
                    key={summary.key}
                    summary={summary}
                    unitPreference={unitPreference}
                    onPress={() => onSelectExercise(summary.key)}
                    tone={overviewTones[index % overviewTones.length]}
                  />
                ))}
              </View>
            ) : (
              <EmptyState
                title="No tracked lifts match this view"
                description="Try a broader search or switch the signal filter."
              />
            )}
          </>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: layout.bottomTabBarReserve,
    gap: spacing.lg,
  },
  detailCard: {
    gap: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  summaryRowStacked: {
    flexDirection: 'column',
  },
  summaryTile: {
    flex: 1,
    minHeight: 168,
    gap: spacing.sm,
  },
  trackedTile: {
    justifyContent: 'space-between',
  },
  summaryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  summaryHeaderRowStacked: {
    flexDirection: 'column',
  },
  tileTitle: {
    color: colors.textPrimary,
    fontSize: 19,
    lineHeight: 21,
    fontWeight: '900',
    letterSpacing: -0.3,
    flex: 1,
  },
  tileBadgeBlue: {
    minHeight: 28,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(85, 138, 189, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(85, 138, 189, 0.28)',
  },
  tileBadgeBlueStacked: {
    alignSelf: 'flex-start',
  },
  tileBadgeBlueText: {
    color: '#9ACCFF',
    fontSize: 11,
    fontWeight: '900',
  },
  summaryMetricRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  summaryMetricBox: {
    flex: 1,
    minHeight: 54,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(11, 15, 20, 0.34)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    justifyContent: 'center',
    gap: 2,
  },
  tileMetricLabel: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  tileMetricValue: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  barRow: {
    marginTop: 'auto',
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  bar: {
    width: 12,
    borderRadius: radii.pill,
    backgroundColor: colors.accentAlt,
  },
  noBarText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  tileLabel: {
    color: '#F39AB2',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  trackedValue: {
    color: colors.textPrimary,
    fontSize: 44,
    lineHeight: 44,
    fontWeight: '900',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  tileBody: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  tileSubtle: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  discoveryCard: {
    gap: spacing.sm,
  },
  discoveryLabel: {
    color: '#9ACCFF',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  discoveryTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '900',
  },
  discoveryMeta: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  searchInput: {
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.input,
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
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.accentSoft,
    borderColor: 'rgba(85, 138, 189, 0.30)',
  },
  filterChipText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  filterChipTextActive: {
    color: colors.textPrimary,
  },
  progressList: {
    gap: spacing.md,
  },
  contextCard: {
    gap: spacing.xs,
  },
  contextKicker: {
    color: '#F39AB2',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  contextTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '900',
  },
  contextBody: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  contextNote: {
    color: colors.textPrimary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tableCard: {
    padding: 0,
  },
  table: {
    overflow: 'hidden',
    borderRadius: radii.lg,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
  },
  tableHeaderText: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  tableCell: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  dateColumn: {
    flex: 1.4,
  },
  chartCard: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
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
    borderColor: colors.border,
    backgroundColor: colors.input,
    paddingHorizontal: spacing.md,
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  bodyweightButton: {
    minWidth: 88,
    minHeight: 52,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentAlt,
    borderWidth: 1,
    borderColor: 'rgba(85, 138, 189, 0.30)',
  },
  bodyweightButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
