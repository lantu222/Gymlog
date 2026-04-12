import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';

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

type ProgressFilter = 'all' | 'new_best' | 'moving_up' | 'building' | 'below_last';

const PROGRESS_FILTERS: Array<{ key: ProgressFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'new_best', label: 'New' },
  { key: 'moving_up', label: 'Up' },
  { key: 'building', label: 'Building' },
  { key: 'below_last', label: 'Below' },
];

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
  const [bodyweightInput, setBodyweightInput] = useState('');
  const [progressQuery, setProgressQuery] = useState('');
  const [progressFilter, setProgressFilter] = useState<ProgressFilter>('all');
  const [browseExpanded, setBrowseExpanded] = useState(false);
  const selectedSummary = summaries.find((summary) => summary.key === selectedExerciseKey);
  const selectedSummaryDisplayName = selectedSummary ? formatLiftDisplayLabel(selectedSummary.name) : '';
  const stackSignalRow = width < 420;

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
  const primarySignal = primarySummary ? getExerciseProgressSignal(primarySummary) : null;
  const primarySummaryName = primarySummary ? formatLiftDisplayLabel(primarySummary.name) : 'Start tracking one lift';
  const primarySummaryMeta = useMemo(
    () => getPrimaryProgressMeta(primarySummary, unitPreference),
    [primarySummary, unitPreference],
  );
  const nextSummaries = useMemo(
    () => prioritizedSummaries.filter((summary) => summary.key !== primarySummary?.key).slice(0, 2),
    [primarySummary?.key, prioritizedSummaries],
  );
  const showBrowseList = browseExpanded || progressQuery.trim().length > 0 || progressFilter !== 'all';
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

  if (showBodyweightDetail) {
    const latest = bodyweightProgress.latest;
    const previous = bodyweightProgress.previous;

    return (
      <>
        <ScreenHeader title="Bodyweight" subtitle="Latest trend and next entry." onBack={onBack} />
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
            <SimpleLineChart points={bodyweightChartPoints} unitLabel={unitPreference} accent="#F4FAFF" />
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
        <ScreenHeader title={selectedSummaryDisplayName} subtitle="What changed last." onBack={onBack} />
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
            <SimpleLineChart points={chartPoints} unitLabel={unitPreference} accent="#F4FAFF" />
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
      <ScreenHeader title="Progress" subtitle="See what moved last." />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SurfaceCard accent="neutral" emphasis="hero" style={styles.heroSurface}>
          <View style={styles.heroContent}>
            <Text style={styles.heroKicker}>Worth a look</Text>

            <View style={styles.heroBadgeRow}>
              <BadgePill accent="neutral" label={formatWeight(bodyweightProgress.latest?.weight, unitPreference)} />
              <BadgePill accent="neutral" label={`${summaries.length} lifts`} />
              <BadgePill accent="neutral" label={signalCounts.new_best > 0 ? `${signalCounts.new_best} new best` : 'Tracked'} />
            </View>

            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>{primarySummaryName}</Text>
              <Text style={styles.heroMeta}>{primarySummaryMeta}</Text>
            </View>

            <View style={styles.heroActionRow}>
              {primarySummary ? (
                <Pressable onPress={() => onSelectExercise(primarySummary.key)} style={styles.heroPrimaryButton}>
                  <Text style={styles.heroPrimaryButtonText}>Open lift</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={onSelectBodyweight} style={styles.heroSecondaryButton}>
                <Text style={styles.heroSecondaryButtonText}>Bodyweight</Text>
              </Pressable>
            </View>
          </View>
        </SurfaceCard>

        <View style={[styles.signalRow, stackSignalRow && styles.signalRowStacked]}>
          <Pressable onPress={onSelectBodyweight} style={styles.signalCardPressable}>
            <SignalCard
              label="Bodyweight"
              value={formatWeight(bodyweightProgress.latest?.weight, unitPreference)}
              meta={formatWeightTrend(
                bodyweightProgress.latest?.weight ?? null,
                bodyweightProgress.previous?.weight ?? null,
                unitPreference,
              )}
            />
          </Pressable>
          <SignalCard
            label="Signals"
            value={signalCounts.new_best > 0 ? `${signalCounts.new_best} new best` : `${signalCounts.moving_up} moving`}
            meta={`${summaries.length} tracked lifts`}
          />
        </View>

        {summaries.length === 0 ? (
          <EmptyState
            title="No tracked lifts yet"
            description="Mark an exercise as tracked while logging and it will show up here."
          />
        ) : (
          <>
            {nextSummaries.length ? (
              <View style={styles.progressList}>
                <SectionLabel label="Next up" />
                {nextSummaries.map((summary) => (
                  <ProgressCard
                    key={summary.key}
                    summary={summary}
                    unitPreference={unitPreference}
                    onPress={() => onSelectExercise(summary.key)}
                  />
                ))}
              </View>
            ) : null}

            <SurfaceCard accent="neutral" emphasis="standard" style={styles.discoveryCard}>
              <View style={styles.discoveryHeaderRow}>
                <View style={styles.discoveryCopy}>
                  <Text style={styles.discoveryTitle}>Browse all lifts</Text>
                  <Text style={styles.discoveryMeta}>Search or filter.</Text>
                </View>
                {!showBrowseList ? (
                  <Pressable onPress={() => setBrowseExpanded(true)} style={styles.discoveryExpandButton}>
                    <Text style={styles.discoveryExpandText}>Show all</Text>
                  </Pressable>
                ) : null}
              </View>

              {showBrowseList ? (
                <>
                  <TextInput
                    value={progressQuery}
                    onChangeText={setProgressQuery}
                    placeholder="Search tracked lifts"
                    placeholderTextColor={colors.textMuted}
                    selectionColor="#F4FAFF"
                    style={styles.searchInput}
                  />
                  <Text style={styles.discoveryMeta}>
                    {filteredSummaries.length} lifts · {signalCounts.new_best} new best · {signalCounts.moving_up} moving up
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
                </>
              ) : null}
            </SurfaceCard>

            {showBrowseList ? (
              filteredSummaries.length ? (
                <View style={styles.progressList}>
                  <SectionLabel label="Lift list" />
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
                <EmptyState
                  title="No tracked lifts match this view"
                  description="Try a broader search or switch the signal filter."
                />
              )
            ) : null}
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
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(18, 24, 33, 0.74)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
    gap: 3,
  },
  signalLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  signalValue: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '900',
  },
  signalMeta: {
    color: colors.textSecondary,
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
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  detailTitle: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  detailBody: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  detailSectionLabel: {
    color: colors.textMuted,
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
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(10, 14, 19, 0.84)',
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
    backgroundColor: '#F4FAFF',
    borderWidth: 1,
    borderColor: '#F4FAFF',
  },
  bodyweightButtonText: {
    color: '#0B0F14',
    fontSize: 14,
    fontWeight: '900',
  },
  contextCard: {
    gap: spacing.xs,
  },
  contextKicker: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
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
});

