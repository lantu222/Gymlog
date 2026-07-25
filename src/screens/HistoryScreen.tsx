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
} from '../lib/format';
import { exerciseNameLabel } from '../lib/exerciseNameLabel';
import { I18nKey, t } from '../lib/i18n';
import { AppDatabase, AppLanguage, UnitPreference } from '../types/models';
import { CardioIcon } from '../components/CardioIcon';
import { buildCardioStatsLine, getCardioActivity } from '../lib/cardio';
import { HG } from '../lightTheme';
import { layout, radii, spacing } from '../theme';

interface HistoryScreenProps {
  sessions: AppDatabase['workoutSessions'];
  cardioSessions?: AppDatabase['cardioSessions'];
  unitPreference: UnitPreference;
  language?: AppLanguage;
  selectedSessionId?: string;
  getSessionLogs: (sessionId: string) => AppDatabase['exerciseLogs'];
  onSelectSession: (sessionId: string) => void;
  onBack: () => void;
}

const HISTORY_FILTERS: Array<{ key: HistoryFilter; labelKey: I18nKey }> = [
  { key: 'all', labelKey: 'history.filter.all' },
  { key: 'needs_review', labelKey: 'history.filter.review' },
  { key: 'tracked', labelKey: 'history.filter.tracked' },
];

/** Count-driven copy: Finnish has its own plural, so each case is a key. */
function countLabel(language: AppLanguage, count: number, one: I18nKey, many: I18nKey) {
  return count === 1 ? t(language, one) : t(language, many, { count });
}

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
  language,
  onPress,
}: {
  workoutName: string;
  performedAt: string;
  exerciseCount: number;
  summaryText?: string;
  highlightText?: string;
  badgeText?: string;
  language: AppLanguage;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.sessionRow}>
      <View style={styles.sessionRowLeft}>
        <Text style={styles.sessionRowKicker}>{t(language, 'history.savedSession')}</Text>
        <Text style={styles.sessionRowName}>{workoutName}</Text>
        <Text style={styles.sessionRowMeta}>
          {formatShortDate(performedAt, language)} {'·'} {countLabel(language, exerciseCount, 'history.exerciseOne', 'history.exerciseMany')}
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

function getReviewLabel(session: HistorySessionViewModel, language: AppLanguage) {
  if (session.legacyMismatchCount > 0) {
    return t(language, 'history.badge.legacy');
  }
  if (session.skippedExercises > 0 || session.partialExercises > 0) {
    return t(language, 'history.badge.needsReview');
  }
  if (session.trackedExercises > 0) {
    return t(language, 'history.badge.tracked');
  }
  return undefined;
}

function formatTopLift(session: HistorySessionViewModel, unitPreference: UnitPreference, language: AppLanguage) {
  if (!session.topLiftName || session.topLiftWeightKg === null) {
    return null;
  }
  const name = exerciseNameLabel(language, formatLiftDisplayLabel(session.topLiftName));
  return `${name} ${formatWeight(session.topLiftWeightKg, unitPreference)}`;
}

function getHistoryHeroMeta(
  session: HistorySessionViewModel,
  unitPreference: UnitPreference,
  language: AppLanguage,
) {
  const parts = [
    session.durationMinutes ? formatDurationMinutes(session.durationMinutes) : null,
    formatTopLift(session, unitPreference, language),
    formatShortDate(session.performedAt, language),
  ].filter(Boolean);

  return parts.join(' · ');
}

function getSessionHighlight(
  session: HistorySessionViewModel,
  unitPreference: UnitPreference,
  language: AppLanguage,
) {
  const flags = [
    session.swappedExercises > 0
      ? countLabel(language, session.swappedExercises, 'history.swapOne', 'history.swapMany')
      : null,
    session.noteCount > 0 ? countLabel(language, session.noteCount, 'history.noteOne', 'history.noteMany') : null,
    session.partialExercises > 0
      ? countLabel(language, session.partialExercises, 'history.partialOne', 'history.partialMany')
      : null,
  ].filter(Boolean);

  if (flags.length) {
    return flags.join(' · ');
  }

  const topLift = formatTopLift(session, unitPreference, language);
  if (topLift) {
    return topLift;
  }

  if (session.skippedExercises > 0) {
    return countLabel(
      language,
      session.skippedExercises,
      'history.skippedExerciseOne',
      'history.skippedExerciseMany',
    );
  }

  return t(language, 'history.savedSession');
}

export function HistoryScreen({
  sessions,
  cardioSessions = [],
  unitPreference,
  language = 'en',
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
          title={formatWorkoutDisplayLabel(selectedSession.workoutNameSnapshot, t(language, 'history.workoutFallback'))}
          subtitle={t(language, 'history.sessionSubtitle')}
          tone="dark"
          onBack={onBack}
        />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <FitnessPhotoSurface variant={heroVariant} style={styles.heroSurface}>
            <View style={styles.heroContent}>
              <Text style={styles.heroKicker}>{t(language, 'history.savedSession')}</Text>

              <View style={styles.heroBadgeRow}>
                <HeroPill label={formatShortDate(selectedSession.performedAt, language)} />
                {sessionView.durationMinutes ? (
                  <HeroPill label={formatDurationMinutes(sessionView.durationMinutes)} />
                ) : null}
                <HeroPill label={countLabel(language, sessionView.exerciseCount, 'history.exerciseOne', 'history.exerciseMany')} />
              </View>

              <View style={styles.heroCopy}>
                <Text style={styles.heroTitle}>
                  {formatWorkoutDisplayLabel(selectedSession.workoutNameSnapshot, t(language, 'history.workoutFallback'))}
                </Text>
                <Text style={styles.heroMeta}>
                  {formatTopLift(sessionView, unitPreference, language)
                    ? t(language, 'history.topLift', {
                        lift: exerciseNameLabel(language, formatLiftDisplayLabel(sessionView.topLiftName ?? '')),
                        weight: formatWeight(sessionView.topLiftWeightKg ?? 0, unitPreference),
                      })
                    : formatSessionDate(selectedSession.performedAt, language)}
                </Text>
              </View>
            </View>
          </FitnessPhotoSurface>

          <View style={styles.signalRow}>
            <SignalCard
              label={t(language, 'history.signal.sets')}
              value={`${sessionView.setsCompleted}`}
              meta={countLabel(language, sessionView.exerciseCount, 'history.loggedExerciseOne', 'history.loggedExerciseMany')}
            />
            <SignalCard
              label={t(language, 'history.signal.volume')}
              value={formatVolume(sessionView.totalVolume, unitPreference)}
              meta={
                sessionView.trackedExercises > 0
                  ? t(language, 'history.trackedLifts', { count: sessionView.trackedExercises })
                  : t(language, 'history.noTrackedLift')
              }
            />
            <SignalCard
              label={t(language, 'history.signal.review')}
              value={
                sessionView.swappedExercises > 0 || sessionView.noteCount > 0 || sessionView.partialExercises > 0
                  ? [
                      sessionView.swappedExercises > 0
                        ? t(language, 'history.swaps', { count: sessionView.swappedExercises })
                        : null,
                      sessionView.noteCount > 0 ? t(language, 'history.notes', { count: sessionView.noteCount }) : null,
                      sessionView.partialExercises > 0
                        ? t(language, 'history.partial', { count: sessionView.partialExercises })
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  : t(language, 'history.cleanSession')
              }
              meta={getReviewLabel(sessionView, language) ?? t(language, 'history.saved')}
            />
          </View>

          {sessionView.topLiftName && sessionView.topLiftWeightKg !== null ? (
            <View style={styles.contextCard}>
              <Text style={styles.contextKicker}>{t(language, 'history.worthNoting')}</Text>
              <Text style={styles.contextTitle}>
                {exerciseNameLabel(language, formatLiftDisplayLabel(sessionView.topLiftName))}{' '}
                {formatWeight(sessionView.topLiftWeightKg, unitPreference)}
              </Text>
              <Text style={styles.contextBody}>{t(language, 'history.heaviestLift')}</Text>
            </View>
          ) : null}

          <View style={styles.logList}>
            <SectionLabel label={t(language, 'history.loggedLifts')} />
            {logs.map((log) => {
              const statusCounts = getLogSetStatusCounts(log);
              const logFlags = [
                log.skipped ? t(language, 'history.badge.skipped') : null,
                log.swappedFrom ? t(language, 'history.badge.swapped') : null,
                log.status === 'active' ? t(language, 'history.badge.partial') : null,
                log.sessionInserted ? t(language, 'history.badge.added') : null,
                log.tracked ? t(language, 'history.badge.tracked') : null,
              ].filter(Boolean);

              const statusSummary = [
                statusCounts.completed > 0
                  ? countLabel(language, statusCounts.completed, 'history.completedSetOne', 'history.completedSetMany')
                  : null,
                statusCounts.skipped > 0
                  ? countLabel(language, statusCounts.skipped, 'history.skippedSetOne', 'history.skippedSetMany')
                  : null,
                statusCounts.pending > 0
                  ? countLabel(language, statusCounts.pending, 'history.pendingSetOne', 'history.pendingSetMany')
                  : null,
              ]
                .filter(Boolean)
                .join(' · ');

              return (
                <View key={log.id} style={styles.logCard}>
                  <View style={styles.logCardHeader}>
                    <View style={styles.logCardCopy}>
                      <Text style={styles.logName}>{exerciseNameLabel(language, formatLiftDisplayLabel(log.exerciseNameSnapshot))}</Text>
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
                    <Text style={styles.logSupport}>{t(language, 'history.swappedFrom', { name: exerciseNameLabel(language, formatLiftDisplayLabel(log.swappedFrom)) })}</Text>
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
      <ScreenHeader title={t(language, 'history.title')} subtitle={t(language, 'history.subtitle')} tone="dark" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {sessions.length === 0 ? (
          <LightEmptyState
            title={t(language, 'history.empty.title')}
            description={t(language, 'history.empty.body')}
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
                  <Text style={styles.heroKicker}>{t(language, 'history.latestSave')}</Text>

                  <View style={styles.heroBadgeRow}>
                    <HeroPill label={t(language, 'history.sessionCount', { count: sessionViewModels.length })} />
                    {latestSession.durationMinutes ? (
                      <HeroPill label={formatDurationMinutes(latestSession.durationMinutes)} />
                    ) : null}
                    {getReviewLabel(latestSession, language) ? (
                      <HeroPill label={getReviewLabel(latestSession, language)!} />
                    ) : null}
                  </View>

                  <View style={styles.heroCopy}>
                    <Text style={styles.heroTitle}>
                      {formatWorkoutDisplayLabel(latestSession.workoutName, t(language, 'history.workoutFallback'))}
                    </Text>
                    <Text style={styles.heroMeta}>{getHistoryHeroMeta(latestSession, unitPreference, language)}</Text>
                  </View>

                  <View style={styles.heroActionRow}>
                    <Pressable
                      onPress={() => onSelectSession(latestSession.sessionId)}
                      style={styles.heroPrimaryButton}
                    >
                      <Text style={styles.heroPrimaryButtonText}>{t(language, 'history.openSession')}</Text>
                    </Pressable>
                  </View>
                </View>
              </FitnessPhotoSurface>
            ) : null}

            <View style={styles.discoveryCard}>
              <View style={styles.discoveryHeaderRow}>
                <View style={styles.discoveryCopy}>
                  <Text style={styles.discoveryLabel}>{t(language, 'history.browse.label')}</Text>
                  <Text style={styles.discoveryTitle}>{t(language, 'history.browse.title')}</Text>
                </View>
              </View>

              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={t(language, 'history.searchPlaceholder')}
                placeholderTextColor={HG.faint}
                selectionColor={HG.purple}
                style={styles.searchInput}
              />
              <Text style={styles.discoveryMeta}>
                {t(language, 'history.browse.meta', {
                  sessions: filteredSessions.length,
                  review: sessionViewModels.filter(
                    (session) => session.skippedExercises > 0 || session.partialExercises > 0,
                  ).length,
                })}
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
                      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{t(language, filter.labelKey)}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {filteredSessions.length ? (
              <View style={styles.logList}>
                <SectionLabel label={t(language, 'history.recentSessions')} />
                {filteredSessions.map((session) => (
                  <SessionRow
                    key={session.sessionId}
                    workoutName={formatWorkoutDisplayLabel(session.workoutName, t(language, 'history.workoutFallback'))}
                    performedAt={session.performedAt}
                    exerciseCount={session.exerciseCount}
                    summaryText={
                      `${session.durationMinutes ? `${formatDurationMinutes(session.durationMinutes)} · ` : ''}${formatVolume(
                        session.totalVolume,
                        unitPreference,
                      )}`
                    }
                    highlightText={getSessionHighlight(session, unitPreference, language)}
                    badgeText={getReviewLabel(session, language)}
                    language={language}
                    onPress={() => onSelectSession(session.sessionId)}
                  />
                ))}
              </View>
            ) : (
              <LightEmptyState
                title={t(language, 'history.emptyFiltered.title')}
                description={t(language, 'history.emptyFiltered.body')}
              />
            )}

            {cardioSessions.length > 0 && historyFilter === 'all' && !searchQuery.trim() ? (
              <View style={styles.logList}>
                <SectionLabel label={t(language, 'history.cardio')} />
                {cardioSessions.map((session) => {
                  const activity = getCardioActivity(session.activityType);
                  return (
                    <View key={session.id} style={styles.cardioRow}>
                      <View style={styles.cardioRowIcon}>
                        <CardioIcon kind={activity.icon} size={20} color={HG.purple} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cardioRowName}>{activity.name}</Text>
                        <Text style={styles.cardioRowMeta}>
                          {formatShortDate(session.performedAt, language)} {'·'}{' '}
                          {buildCardioStatsLine(session.durationSec, session.distanceKm)}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
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
  cardioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: HG.surface,
    borderWidth: 1,
    borderColor: HG.border,
    borderRadius: radii.md,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  cardioRowIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: HG.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardioRowName: {
    color: HG.ink,
    fontSize: 14.5,
    fontWeight: '800',
  },
  cardioRowMeta: {
    color: HG.muted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 3,
    fontVariant: ['tabular-nums'],
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
