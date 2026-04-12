import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { getFitnessPhotoVariant } from '../assets/fitnessPhotos';
import { EmptyState } from '../components/EmptyState';
import { FitnessPhotoSurface } from '../components/FitnessPhotoSurface';
import { BadgePill, SurfaceCard } from '../components/MainScreenPrimitives';
import { ScreenHeader } from '../components/ScreenHeader';
import { SessionListItem } from '../components/SessionListItem';
import { formatLiftDisplayLabel, formatWorkoutDisplayLabel } from '../lib/displayLabel';
import { getLogSetStatusCounts } from '../lib/exerciseLog';
import {
  buildHistorySessionViewModel,
  filterHistorySessionViewModels,
  HistoryFilter,
  HistorySessionViewModel,
} from '../lib/historyView';
import {
  formatDate,
  formatDurationMinutes,
  formatLogResult,
  formatSessionDate,
  formatShortDate,
  formatVolume,
  formatWeight,
  pluralize,
} from '../lib/format';
import { AppDatabase, UnitPreference } from '../types/models';
import { colors, layout, radii, spacing } from '../theme';

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
          onBack={onBack}
        />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <FitnessPhotoSurface variant={heroVariant} style={styles.heroSurface}>
            <View style={styles.heroContent}>
              <Text style={styles.heroKicker}>Saved session</Text>

              <View style={styles.heroBadgeRow}>
                <BadgePill accent="neutral" label={formatShortDate(selectedSession.performedAt)} />
                {sessionView.durationMinutes ? (
                  <BadgePill accent="neutral" label={formatDurationMinutes(sessionView.durationMinutes)} />
                ) : null}
                <BadgePill accent="neutral" label={pluralize(sessionView.exerciseCount, 'exercise')} />
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
            <SurfaceCard accent="neutral" emphasis="flat" style={styles.contextCard}>
              <Text style={styles.contextKicker}>Worth noting</Text>
              <Text style={styles.contextTitle}>
                {formatLiftDisplayLabel(sessionView.topLiftName)} {formatWeight(sessionView.topLiftWeightKg, unitPreference)}
              </Text>
              <Text style={styles.contextBody}>Heaviest completed lift from this saved session.</Text>
            </SurfaceCard>
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
                <SurfaceCard key={log.id} accent="neutral" emphasis="utility" style={styles.logCard}>
                  <View style={styles.logCardHeader}>
                    <View style={styles.logCardCopy}>
                      <Text style={styles.logName}>{formatLiftDisplayLabel(log.exerciseNameSnapshot)}</Text>
                      <Text style={styles.logMeta}>{formatLogResult(log, unitPreference)}</Text>
                    </View>
                    {logFlags.length ? (
                      <View style={styles.logBadgeRow}>
                        {logFlags.slice(0, 2).map((flag) => (
                          <BadgePill key={`${log.id}:${flag}`} accent="neutral" label={flag ?? ''} />
                        ))}
                      </View>
                    ) : null}
                  </View>

                  {statusSummary ? <Text style={styles.logSupport}>{statusSummary}</Text> : null}
                  {log.swappedFrom ? (
                    <Text style={styles.logSupport}>Swapped from {formatLiftDisplayLabel(log.swappedFrom)}</Text>
                  ) : null}
                  {log.notes ? <Text style={styles.logNote}>{log.notes}</Text> : null}
                </SurfaceCard>
              );
            })}
          </View>
        </ScrollView>
      </>
    );
  }

  return (
    <>
      <ScreenHeader title="History" subtitle="Open the session worth keeping." />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {sessions.length === 0 ? (
          <EmptyState
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
                    <BadgePill accent="neutral" label={`${sessionViewModels.length} sessions`} />
                    {latestSession.durationMinutes ? (
                      <BadgePill accent="neutral" label={formatDurationMinutes(latestSession.durationMinutes)} />
                    ) : null}
                    {getReviewLabel(latestSession) ? (
                      <BadgePill accent="neutral" label={getReviewLabel(latestSession)!} />
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

            <SurfaceCard accent="neutral" emphasis="standard" style={styles.discoveryCard}>
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
                placeholderTextColor={colors.textMuted}
                selectionColor="#F4FAFF"
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
            </SurfaceCard>

            {filteredSessions.length ? (
              <View style={styles.logList}>
                <SectionLabel label="Recent sessions" />
                {filteredSessions.map((session) => (
                  <SessionListItem
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
              <EmptyState
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
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
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
  discoveryLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
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
  searchInput: {
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(10, 14, 19, 0.84)',
    paddingHorizontal: spacing.md,
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
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
  signalRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  signalCard: {
    flex: 1,
    minHeight: 92,
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
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
  },
  signalMeta: {
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
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
  logList: {
    gap: spacing.md,
  },
  logCard: {
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
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  logMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  logBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    justifyContent: 'flex-end',
    maxWidth: '44%',
  },
  logSupport: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  logNote: {
    color: colors.textPrimary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
});
