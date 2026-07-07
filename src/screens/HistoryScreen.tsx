import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { getFitnessPhotoVariant } from '../assets/fitnessPhotos';
import { FitnessPhotoSurface } from '../components/FitnessPhotoSurface';
import { ScreenHeader } from '../components/ScreenHeader';
import { formatLiftDisplayLabel, formatWorkoutDisplayLabel } from '../lib/displayLabel';
import { getLogSetStatusCounts } from '../lib/exerciseLog';
import {
  buildHistorySessionViewModel,
  filterHistorySessionViewModels,
  HistoryFilter,
  HistorySessionViewModel,
} from '../lib/historyView';
import {
  formatDurationMinutes,
  formatLogResult,
  formatSessionDate,
  formatShortDate,
  formatVolume,
  formatWeight,
  pluralize,
} from '../lib/format';
import { AppDatabase, UnitPreference } from '../types/models';
import { HG } from '../lightTheme';
import { layout, radii, spacing } from '../theme';

interface HistoryScreenProps {
  sessions: AppDatabase['workoutSessions'];
  unitPreference: UnitPreference;
  selectedSessionId?: string;
  getSessionLogs: (sessionId: string) => AppDatabase['exerciseLogs'];
  onSelectSession: (sessionId: string) => void;
  onBack: () => void;
}

const HISTORY_FILTERS: Array<{ key: HistoryFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'needs_review', label: 'Review' },
  { key: 'tracked', label: 'Tracked' },
];

function SectionLabel({ label }: { label: string }) {
  return <Text style={styles.sectionLabel}>{label}</Text>;
}

function HeroPill({ label }: { label: string }) {
  return (
    <View style={styles.heroPill}>
      <Text style={styles.heroPillText}>{label}</Text>
    </View>
  );
}

function LightBadge({ label }: { label: string }) {
  return (
    <View style={styles.lightBadge}>
      <Text style={styles.lightBadgeText}>{label}</Text>
    </View>
  );
}

function LightEmptyState({ title, description }: { title: string; description: string }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateTitle}>{title}</Text>
      <Text style={styles.emptyStateDescription}>{description}</Text>
    </View>
  );
}

function SessionRow({
  workoutName,
  performedAt,
  exerciseCount,
  summaryText,
  highlightText,
  badgeText,
  onPress,
}: {
  workoutName: string;
  performedAt: string;
  exerciseCount: number;
  summaryText?: string;
  highlightText?: string;
  badgeText?: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.sessionRow}>
      <View style={styles.sessionRowLeft}>
        <Text style={styles.sessionRowKicker}>Saved session</Text>
        <Text style={styles.sessionRowName}>{workoutName}</Text>
        <Text style={styles.sessionRowMeta}>
          {formatShortDate(performedAt)} {'·'} {pluralize(exerciseCount, 'exercise')}
        </Text>
        {summaryText ? <Text style={styles.sessionRowSummary}>{summaryText}</Text> : null}
      </View>
      <View style={styles.sessionRowRight}>
        {badgeText ? <LightBadge label={badgeText} /> : null}
        {highlightText ? (
          <Text style={styles.sessionRowHighlight} numberOfLines={2}>
            {highlightText}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
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

function getReviewLabel(session: HistorySessionViewModel) {
  if (session.legacyMismatchCount > 0) {
    return 'Legacy save';
  }
  if (session.skippedExercises > 0 || session.partialExercises > 0) {
    return 'Needs review';
  }
  if (session.trackedExercises > 0) {
    return 'Tracked';
  }
  return undefined;
}

function getHistoryHeroMeta(session: HistorySessionViewModel, unitPreference: UnitPreference) {
  const parts = [
    session.durationMinutes ? formatDurationMinutes(session.durationMinutes) : null,
    session.topLiftName && session.topLiftWeightKg !== null
      ? `${formatLiftDisplayLabel(session.topLiftName)} ${formatWeight(session.topLiftWeightKg, unitPreference)}`
      : null,
    formatShortDate(session.performedAt),
  ].filter(Boolean);

  return parts.join(' · ');
}

function getSessionHighlight(session: HistorySessionViewModel, unitPreference: UnitPreference) {
  const flags = [
    session.swappedExercises > 0 ? `${pluralize(session.swappedExercises, 'swap')}` : null,
    session.noteCount > 0 ? `${pluralize(session.noteCount, 'note')}` : null,
    session.partialExercises > 0 ? `${pluralize(session.partialExercises, 'partial')}` : null,
  ].filter(Boolean);

  if (flags.length) {
    return flags.join(' · ');
  }

  if (session.topLiftName && session.topLiftWeightKg !== null) {
    return `${formatLiftDisplayLabel(session.topLiftName)} ${formatWeight(session.topLiftWeightKg, unitPreference)}`;
  }

  if (session.skippedExercises > 0) {
    return pluralize(session.skippedExercises, 'skipped exercise');
  }

  return 'Saved session';
}

export function HistoryScreen({
  sessions,
  unitPreference,
  selectedSessionId,
  getSessionLogs,
  onSelectSession,
  onBack,
}: HistoryScreenProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');
  const selectedSession = sessions.find((session) => session.id === selectedSessionId);
  const sessionViewModels = useMemo(
    () =>
      sessions
        .map((session) => buildHistorySessionViewModel(session, getSessionLogs(session.id)))
        .sort((left, right) => new Date(right.performedAt).getTime() - new Date(left.performedAt).getTime()),
    [getSessionLogs, sessions],
  );
  const filteredSessions = useMemo(
    () => filterHistorySessionViewModels(sessionViewModels, { query: searchQuery, filter: historyFilter }),
    [historyFilter, searchQuery, sessionViewModels],
  );
  const latestSession = sessionViewModels[0] ?? null;

  if (selectedSession) {
    const logs = [...getSessionLogs(selectedSession.id)].sort((left, right) => left.orderIndex - right.orderIndex);
    const sessionView = buildHistorySessionViewModel(selectedSession, logs);
    const heroVariant = getFitnessPhotoVariant({
      title: sessionView.topLiftName ?? selectedSession.workoutNameSnapshot,
      goal: selectedSession.workoutNameSnapshot,
    });

    return (
      <>
        <ScreenHeader
          title={formatWorkoutDisplayLabel(selectedSession.workoutNameSnapshot, 'Workout')}
          subtitle="What happened in this session."
          tone="dark"
          onBack={onBack}
        />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <FitnessPhotoSurface variant={heroVariant} style={styles.heroSurface}>
            <View style={styles.heroContent}>
              <Text style={styles.heroKicker}>Saved session</Text>

              <View style={styles.heroBadgeRow}>
                <HeroPill label={formatShortDate(selectedSession.performedAt)} />
                {sessionView.durationMinutes ? (
                  <HeroPill label={formatDurationMinutes(sessionView.durationMinutes)} />
                ) : null}
                <HeroPill label={pluralize(sessionView.exerciseCount, 'exercise')} />
              </View>

              <View style={styles.heroCopy}>
                <Text style={styles.heroTitle}>
                  {formatWorkoutDisplayLabel(selectedSession.workoutNameSnapshot, 'Workout')}
                </Text>
                <Text style={styles.heroMeta}>
                  {sessionView.topLiftName && sessionView.topLiftWeightKg !== null
                    ? `Top lift · ${formatLiftDisplayLabel(sessionView.topLiftName)} ${formatWeight(
                        sessionView.topLiftWeightKg,
                        unitPreference,
                      )}`
                    : formatSessionDate(selectedSession.performedAt)}
                </Text>
              </View>
            </View>
          </FitnessPhotoSurface>

          <View style={styles.signalRow}>
            <SignalCard
              label="Sets"
              value={`${sessionView.setsCompleted}`}
              meta={pluralize(sessionView.exerciseCount, 'logged exercise')}
            />
            <SignalCard
              label="Volume"
              value={formatVolume(sessionView.totalVolume, unitPreference)}
              meta={sessionView.trackedExercises > 0 ? `${sessionView.trackedExercises} tracked lifts` : 'No tracked lift'}
            />
            <SignalCard
              label="Review"
              value={
                sessionView.swappedExercises > 0 || sessionView.noteCount > 0 || sessionView.partialExercises > 0
                  ? [
                      sessionView.swappedExercises > 0 ? `${sessionView.swappedExercises} swaps` : null,
                      sessionView.noteCount > 0 ? `${sessionView.noteCount} notes` : null,
                      sessionView.partialExercises > 0 ? `${sessionView.partialExercises} partial` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  : 'Clean session'
              }
              meta={getReviewLabel(sessionView) ?? 'Saved'}
            />
          </View>

          {sessionView.topLiftName && sessionView.topLiftWeightKg !== null ? (
            <View style={styles.contextCard}>
              <Text style={styles.contextKicker}>Worth noting</Text>
              <Text style={styles.contextTitle}>
                {formatLiftDisplayLabel(sessionView.topLiftName)} {formatWeight(sessionView.topLiftWeightKg, unitPreference)}
              </Text>
              <Text style={styles.contextBody}>Heaviest completed lift from this saved session.</Text>
            </View>
          ) : null}

          <View style={styles.logList}>
            <SectionLabel label="Logged lifts" />
            {logs.map((log) => {
              const statusCounts = getLogSetStatusCounts(log);
              const logFlags = [
                log.skipped ? 'Skipped' : null,
                log.swappedFrom ? 'Swapped' : null,
                log.status === 'active' ? 'Partial' : null,
                log.sessionInserted ? 'Added' : null,
                log.tracked ? 'Tracked' : null,
              ].filter(Boolean);

              const statusSummary = [
                statusCounts.completed > 0 ? `${pluralize(statusCounts.completed, 'completed set')}` : null,
                statusCounts.skipped > 0 ? `${pluralize(statusCounts.skipped, 'skipped set')}` : null,
                statusCounts.pending > 0 ? `${pluralize(statusCounts.pending, 'pending set')}` : null,
              ]
                .filter(Boolean)
                .join(' · ');

              return (
                <View key={log.id} style={styles.logCard}>
                  <View style={styles.logCardHeader}>
                    <View style={styles.logCardCopy}>
                      <Text style={styles.logName}>{formatLiftDisplayLabel(log.exerciseNameSnapshot)}</Text>
                      <Text style={styles.logMeta}>{formatLogResult(log, unitPreference)}</Text>
                    </View>
                    {logFlags.length ? (
                      <View style={styles.logBadgeRow}>
                        {logFlags.slice(0, 2).map((flag) => (
                          <LightBadge key={`${log.id}:${flag}`} label={flag ?? ''} />
                        ))}
                      </View>
                    ) : null}
                  </View>

                  {statusSummary ? <Text style={styles.logSupport}>{statusSummary}</Text> : null}
                  {log.swappedFrom ? (
                    <Text style={styles.logSupport}>Swapped from {formatLiftDisplayLabel(log.swappedFrom)}</Text>
                  ) : null}
                  {log.notes ? <Text style={styles.logNote}>{log.notes}</Text> : null}
                </View>
              );
            })}
          </View>
        </ScrollView>
      </>
    );
  }

  return (
    <>
      <ScreenHeader title="History" subtitle="Open the session worth keeping." tone="dark" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {sessions.length === 0 ? (
          <LightEmptyState
            title="No sessions yet"
            description="Once you save a workout, the session appears here."
          />
        ) : (
          <>
            {latestSession ? (
              <FitnessPhotoSurface
                variant={getFitnessPhotoVariant({
                  title: latestSession.topLiftName ?? latestSession.workoutName,
                  goal: latestSession.workoutName,
                })}
                style={styles.heroSurface}
              >
                <View style={styles.heroContent}>
                  <Text style={styles.heroKicker}>Latest save</Text>

                  <View style={styles.heroBadgeRow}>
                    <HeroPill label={`${sessionViewModels.length} sessions`} />
                    {latestSession.durationMinutes ? (
                      <HeroPill label={formatDurationMinutes(latestSession.durationMinutes)} />
                    ) : null}
                    {getReviewLabel(latestSession) ? (
                      <HeroPill label={getReviewLabel(latestSession)!} />
                    ) : null}
                  </View>

                  <View style={styles.heroCopy}>
                    <Text style={styles.heroTitle}>
                      {formatWorkoutDisplayLabel(latestSession.workoutName, 'Workout')}
                    </Text>
                    <Text style={styles.heroMeta}>{getHistoryHeroMeta(latestSession, unitPreference)}</Text>
                  </View>

                  <View style={styles.heroActionRow}>
                    <Pressable
                      onPress={() => onSelectSession(latestSession.sessionId)}
                      style={styles.heroPrimaryButton}
                    >
                      <Text style={styles.heroPrimaryButtonText}>Open session</Text>
                    </Pressable>
                  </View>
                </View>
              </FitnessPhotoSurface>
            ) : null}

            <View style={styles.discoveryCard}>
              <View style={styles.discoveryHeaderRow}>
                <View style={styles.discoveryCopy}>
                  <Text style={styles.discoveryLabel}>Browse sessions</Text>
                  <Text style={styles.discoveryTitle}>Find the one worth opening</Text>
                </View>
              </View>

              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search by workout or top lift"
                placeholderTextColor={HG.faint}
                selectionColor={HG.purple}
                style={styles.searchInput}
              />
              <Text style={styles.discoveryMeta}>
                {filteredSessions.length} sessions ·{' '}
                {sessionViewModels.filter((session) => session.skippedExercises > 0 || session.partialExercises > 0).length} review
              </Text>
              <View style={styles.filterRow}>
                {HISTORY_FILTERS.map((filter) => {
                  const active = filter.key === historyFilter;
                  return (
                    <Pressable
                      key={filter.key}
                      onPress={() => setHistoryFilter(filter.key)}
                      style={[styles.filterChip, active && styles.filterChipActive]}
                    >
                      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{filter.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {filteredSessions.length ? (
              <View style={styles.logList}>
                <SectionLabel label="Recent sessions" />
                {filteredSessions.map((session) => (
                  <SessionRow
                    key={session.sessionId}
                    workoutName={formatWorkoutDisplayLabel(session.workoutName, 'Workout')}
                    performedAt={session.performedAt}
                    exerciseCount={session.exerciseCount}
                    summaryText={
                      `${session.durationMinutes ? `${formatDurationMinutes(session.durationMinutes)} · ` : ''}${formatVolume(
                        session.totalVolume,
                        unitPreference,
                      )}`
                    }
                    highlightText={getSessionHighlight(session, unitPreference)}
                    badgeText={getReviewLabel(session)}
                    onPress={() => onSelectSession(session.sessionId)}
                  />
                ))}
              </View>
            ) : (
              <LightEmptyState
                title="No sessions match this view"
                description="Try a broader search or switch the history filter."
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
  sectionLabel: {
    color: HG.faint,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroSurface: {
    minHeight: 276,
  },
  heroContent: {
    flex: 1,
    justifyContent: 'space-between',
    padding: spacing.lg,
    gap: spacing.md,
  },
  heroKicker: {
    color: 'rgba(255,255,255,0.72)',
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
  heroPill: {
    minHeight: 28,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.30)',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  heroPillText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
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
    backgroundColor: HG.purple,
  },
  heroPrimaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  lightBadge: {
    minHeight: 24,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: HG.purpleLight,
  },
  lightBadgeText: {
    color: HG.purpleDark,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  emptyState: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: HG.border,
    backgroundColor: HG.surface,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  emptyStateTitle: {
    color: HG.ink,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  emptyStateDescription: {
    color: HG.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  sessionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: HG.border,
    backgroundColor: HG.surface,
    padding: spacing.lg,
  },
  sessionRowLeft: {
    gap: spacing.xs,
    flex: 1,
  },
  sessionRowKicker: {
    color: HG.faint,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sessionRowRight: {
    maxWidth: 150,
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  sessionRowName: {
    color: HG.ink,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  sessionRowMeta: {
    color: HG.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  sessionRowSummary: {
    color: HG.faint,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  sessionRowHighlight: {
    color: HG.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
    textAlign: 'right',
  },
  discoveryCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: HG.border,
    backgroundColor: HG.surface,
    padding: spacing.lg,
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
  discoveryLabel: {
    color: HG.faint,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  discoveryTitle: {
    color: HG.ink,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  discoveryMeta: {
    color: HG.faint,
    fontSize: 12,
    fontWeight: '600',
  },
  searchInput: {
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: HG.border,
    backgroundColor: HG.surfaceSoft,
    paddingHorizontal: spacing.md,
    color: HG.ink,
    fontSize: 14,
    fontWeight: '600',
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
    backgroundColor: HG.surfaceSoft,
    borderWidth: 1,
    borderColor: HG.border,
  },
  filterChipActive: {
    backgroundColor: HG.purpleLight,
    borderColor: HG.purple,
  },
  filterChipText: {
    color: HG.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  filterChipTextActive: {
    color: HG.purpleDark,
  },
  signalRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  signalCard: {
    flex: 1,
    minHeight: 92,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: HG.border,
    backgroundColor: HG.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
    gap: 3,
  },
  signalLabel: {
    color: HG.faint,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  signalValue: {
    color: HG.ink,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
  },
  signalMeta: {
    color: HG.muted,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
  },
  contextCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: HG.border,
    backgroundColor: HG.surface,
    padding: spacing.md,
    gap: spacing.xs,
  },
  contextKicker: {
    color: HG.faint,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  contextTitle: {
    color: HG.ink,
    fontSize: 16,
    fontWeight: '800',
  },
  contextBody: {
    color: HG.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  logList: {
    gap: spacing.md,
  },
  logCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: HG.border,
    backgroundColor: HG.surface,
    padding: spacing.md,
    gap: spacing.sm,
  },
  logCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  logCardCopy: {
    flex: 1,
    gap: 2,
  },
  logName: {
    color: HG.ink,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  logMeta: {
    color: HG.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  logBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    justifyContent: 'flex-end',
    maxWidth: '44%',
  },
  logSupport: {
    color: HG.faint,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  logNote: {
    color: HG.ink,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
});
