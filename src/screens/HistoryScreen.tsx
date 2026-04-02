import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { EmptyState } from '../components/EmptyState';
import { ScreenHeader } from '../components/ScreenHeader';
import { SessionListItem } from '../components/SessionListItem';
import { formatLiftDisplayLabel, formatWorkoutDisplayLabel } from '../lib/displayLabel';
import { getLogSetStatusCounts } from '../lib/exerciseLog';
import {
  buildHistorySessionViewModel,
  filterHistorySessionViewModels,
  HistoryFilter,
} from '../lib/historyView';
import {
  formatDate,
  formatLogResult,
  formatSessionDate,
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
  { key: 'all', label: 'All sessions' },
  { key: 'needs_review', label: 'Needs review' },
  { key: 'tracked', label: 'Tracked work' },
];

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

  if (selectedSession) {
    const logs = [...getSessionLogs(selectedSession.id)].sort((left, right) => left.orderIndex - right.orderIndex);
    const sessionView = buildHistorySessionViewModel(selectedSession, logs);

    return (
      <>
        <ScreenHeader
          title={formatWorkoutDisplayLabel(selectedSession.workoutNameSnapshot, 'Workout')}
          subtitle={formatSessionDate(selectedSession.performedAt)}
          onBack={onBack}
        />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>{formatDate(selectedSession.performedAt)}</Text>
            <Text style={styles.summaryMeta}>
              {sessionView.durationMinutes ? `${sessionView.durationMinutes} min \u00b7 ` : ''}
              {pluralize(sessionView.exerciseCount, 'logged exercise')} {'\u00b7'} {pluralize(sessionView.setsCompleted, 'set')}{' '}
              {'\u00b7'} {formatVolume(sessionView.totalVolume, unitPreference)} volume
            </Text>
            <View style={styles.metricGrid}>
              <View style={styles.metricBox}>
                <Text style={styles.metricLabel}>Tracked</Text>
                <Text style={styles.metricValue}>{sessionView.trackedExercises}</Text>
              </View>
              <View style={styles.metricBox}>
                <Text style={styles.metricLabel}>Skipped</Text>
                <Text style={styles.metricValue}>{sessionView.skippedExercises}</Text>
              </View>
              <View style={styles.metricBox}>
                <Text style={styles.metricLabel}>Sets</Text>
                <Text style={styles.metricValue}>{sessionView.setsCompleted}</Text>
              </View>
              <View style={styles.metricBox}>
                <Text style={styles.metricLabel}>Volume</Text>
                <Text style={styles.metricValue}>{formatVolume(sessionView.totalVolume, unitPreference)}</Text>
              </View>
              <View style={styles.metricBox}>
                <Text style={styles.metricLabel}>Swaps</Text>
                <Text style={styles.metricValue}>{sessionView.swappedExercises}</Text>
              </View>
              <View style={styles.metricBox}>
                <Text style={styles.metricLabel}>Notes</Text>
                <Text style={styles.metricValue}>{sessionView.noteCount}</Text>
              </View>
            </View>
            <Text style={styles.summaryHighlight}>
              {sessionView.topLiftName && sessionView.topLiftWeightKg !== null
                ? `Top lift: ${formatLiftDisplayLabel(sessionView.topLiftName)} ${formatWeight(sessionView.topLiftWeightKg, unitPreference)}`
                : 'No loaded top lift in this session.'}
            </Text>
          </View>

          <View style={styles.list}>
            {logs.map((log) => (
              <View key={log.id} style={styles.logCard}>
                <View style={styles.logHeader}>
                  <Text style={styles.logName}>{formatLiftDisplayLabel(log.exerciseNameSnapshot)}</Text>
                  <View style={styles.badgeRow}>
                    {log.skipped ? <Text style={styles.skippedBadge}>Skipped</Text> : null}
                    {log.swappedFrom ? <Text style={styles.swapBadge}>Swapped</Text> : null}
                    {log.status === 'active' ? <Text style={styles.partialBadge}>Partial</Text> : null}
                    {log.sessionInserted ? <Text style={styles.insertedBadge}>Added in session</Text> : null}
                    {log.tracked ? <Text style={styles.trackedBadge}>Tracked</Text> : null}
                  </View>
                </View>
                <Text style={styles.logValue}>{log.skipped ? 'Skipped' : formatLogResult(log, unitPreference)}</Text>
                {(() => {
                  const statusCounts = getLogSetStatusCounts(log);
                  const statusParts = [
                    statusCounts.completed > 0 ? `${pluralize(statusCounts.completed, 'completed set')}` : null,
                    statusCounts.skipped > 0 ? `${pluralize(statusCounts.skipped, 'skipped set')}` : null,
                    statusCounts.pending > 0 ? `${pluralize(statusCounts.pending, 'pending set')}` : null,
                  ]
                    .filter(Boolean)
                    .join(' \u00b7 ');

                  return statusParts ? <Text style={styles.logSupport}>{statusParts}</Text> : null;
                })()}
                {log.swappedFrom ? (
                  <Text style={styles.logSupport}>Swapped from {formatLiftDisplayLabel(log.swappedFrom)}</Text>
                ) : null}
                {log.notes ? <Text style={styles.logNote}>{log.notes}</Text> : null}
              </View>
            ))}
          </View>
        </ScrollView>
      </>
    );
  }

  return (
    <>
      <ScreenHeader title="History" subtitle="Every saved session stays readable even after templates change." />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {sessions.length === 0 ? (
          <EmptyState
            title="No sessions yet"
            description="Once you save a workout, the session appears here with its original exercise names and values."
          />
        ) : (
          <>
            <View style={styles.discoveryCard}>
              <Text style={styles.discoveryLabel}>Session search</Text>
              <Text style={styles.discoveryTitle}>Find the session worth opening</Text>
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search by workout or top lift"
                placeholderTextColor={colors.textMuted}
                selectionColor={colors.accentAlt}
                style={styles.searchInput}
              />
              <Text style={styles.discoveryMeta}>
                {filteredSessions.length} sessions {'\u00b7'}{' '}
                {sessionViewModels.filter((session) => session.skippedExercises > 0).length} need review
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
              <View style={styles.list}>
                {filteredSessions.map((session) => (
                  <SessionListItem
                    key={session.sessionId}
                    workoutName={formatWorkoutDisplayLabel(session.workoutName, 'Workout')}
                    performedAt={session.performedAt}
                    exerciseCount={session.exerciseCount}
                    summaryText={`${session.durationMinutes ? `${session.durationMinutes} min \u00b7 ` : ''}${pluralize(session.setsCompleted, 'set')} \u00b7 ${formatVolume(session.totalVolume, unitPreference)} volume`}
                    highlightText={
                      session.swappedExercises > 0 || session.noteCount > 0 || session.partialExercises > 0
                        ? [
                            session.swappedExercises > 0 ? `${pluralize(session.swappedExercises, 'swap')}` : null,
                            session.noteCount > 0 ? `${pluralize(session.noteCount, 'note')}` : null,
                            session.partialExercises > 0 ? `${pluralize(session.partialExercises, 'partial exercise')}` : null,
                          ]
                            .filter(Boolean)
                            .join(' \u00b7 ')
                        : session.topLiftName && session.topLiftWeightKg !== null
                          ? `Top: ${formatLiftDisplayLabel(session.topLiftName)} ${formatWeight(session.topLiftWeightKg, unitPreference)}`
                        : session.skippedExercises
                          ? `${pluralize(session.skippedExercises, 'skipped exercise')}`
                          : 'No tracked lift yet'
                    }
                    badgeText={
                      session.legacyMismatchCount > 0
                        ? 'Legacy save'
                        : session.skippedExercises > 0
                          ? 'Needs review'
                          : session.trackedExercises > 0
                            ? 'Tracked'
                            : undefined
                    }
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
  list: {
    gap: spacing.md,
  },
  discoveryCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(85, 138, 189, 0.18)',
    backgroundColor: 'rgba(18, 24, 33, 0.72)',
    padding: spacing.lg,
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
  summaryCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  summaryTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
  },
  summaryMeta: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  metricBox: {
    flexGrow: 1,
    minWidth: 132,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(11, 15, 20, 0.34)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 2,
  },
  metricLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  metricValue: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '900',
  },
  summaryHighlight: {
    color: colors.textPrimary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  logCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  logName: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  skippedBadge: {
    color: '#FFD4C3',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  insertedBadge: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  trackedBadge: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  swapBadge: {
    color: '#F39AB2',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  partialBadge: {
    color: '#9ACCFF',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  logValue: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
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
    fontWeight: '600',
  },
});
