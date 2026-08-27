import React, { useMemo, useState } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CardioIcon } from '../components/CardioIcon';
import { buildCardioStatsLine, getCardioActivity } from '../lib/cardio';
import { formatLiftDisplayLabel, formatWorkoutDisplayLabel } from '../lib/displayLabel';
import { exerciseNameLabel } from '../lib/exerciseNameLabel';
import { getLogSetStatusCounts } from '../lib/exerciseLog';
import {
  formatDurationMinutes,
  formatLogResult,
  formatSessionDate,
  formatShortDate,
  formatVolume,
  formatWeight,
} from '../lib/format';
import {
  buildHistorySessionViewModel,
  filterHistorySessionViewModels,
  HistorySessionViewModel,
} from '../lib/historyView';
import { SessionFeelSummary, sessionFeelColor, summariseSessionFeel } from '../lib/sessionFeel';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { I18nKey, t } from '../lib/i18n';
import { localizeSessionName } from '../lib/sessionNameLabel';
import { Theme, useTheme, useThemedStyles } from '../theming';
import { layout, spacing } from '../theme';
import { AppDatabase, AppLanguage, UnitPreference } from '../types/models';

/**
 * Rebuilt in the light HG language (2026-07-25). The old screen still wore the
 * dark ScreenHeader and stock photo heroes from an earlier phase, which left it
 * looking like a different app than the one that saved the session.
 *
 * The detail view is deliberately Workout Complete revisited — same purple
 * hero, same stat card, same lift rows — because that is what it is.
 */
const HAIRLINE = '#EEEAF7';
const HERO_STOPS = ['#8B5CF6', '#7C3AED', '#6D28D9'] as const;
// The gradient is drawn at a fixed size and clipped by the hero's overflow.
// A percentage-height Svg does not stretch to a dynamic parent on Android — it
// paints a partial rect and leaves white text sitting on the light background.
const HERO_GRADIENT_WIDTH = Dimensions.get('window').width;
const HERO_GRADIENT_HEIGHT = 320;

interface HistoryScreenProps {
  sessions: AppDatabase['workoutSessions'];
  cardioSessions?: AppDatabase['cardioSessions'];
  unitPreference: UnitPreference;
  language?: AppLanguage;
  selectedSessionId?: string;
  getSessionLogs: (sessionId: string) => AppDatabase['exerciseLogs'];
  onSelectSession: (sessionId: string) => void;
  /** Absent hides the delete affordance entirely rather than inerting it. */
  onDeleteSession?: (sessionId: string) => void;
  /** A run is a thing you logged, so it is a thing you can unlog. */
  onDeleteCardioSession?: (sessionId: string) => void;
  onBack: () => void;
}

/** Count-driven copy: Finnish has its own plural, so each case is a key. */
function countLabel(language: AppLanguage, count: number, one: I18nKey, many: I18nKey) {
  return count === 1 ? t(language, one) : t(language, many, { count });
}

function sessionTitle(name: string, language: AppLanguage) {
  return localizeSessionName(formatWorkoutDisplayLabel(name, t(language, 'history.workoutFallback')), language);
}

function formatTopLift(session: HistorySessionViewModel, unitPreference: UnitPreference, language: AppLanguage) {
  if (!session.topLiftName || session.topLiftWeightKg === null) {
    return null;
  }
  const name = exerciseNameLabel(language, formatLiftDisplayLabel(session.topLiftName));
  return `${name} ${formatWeight(session.topLiftWeightKg, unitPreference)}`;
}

function SectionLabel({ label }: { label: string }) {
  const styles = useThemedStyles(makeStyles);

  return <Text style={styles.sectionLabel}>{label}</Text>;
}

function Badge({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'purple' | 'warn' }) {
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={[styles.badge, tone === 'purple' && styles.badgePurple, tone === 'warn' && styles.badgeWarn]}>
      <Text
        style={[
          styles.badgeText,
          tone === 'purple' && styles.badgeTextPurple,
          tone === 'warn' && styles.badgeTextWarn,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

function StatCell({ value, label }: { value: string; label: string }) {
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.statCell}>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  );
}

const FEEL_READ_LABEL_KEY = {
  demanding: 'history.feel.demanding',
  balanced: 'history.feel.balanced',
  light: 'history.feel.light',
} as const;

/**
 * How the recent training has felt, as one line above the list.
 *
 * Renders nothing at all when no session has been answered. A card saying
 * "answer a few more" to somebody who has never seen the question is an empty
 * box explaining an absence they did not notice; the prompt is only useful to
 * a reader who has started answering and is nearly at a read.
 */
function FeelSummaryCard({
  summary,
  language,
}: {
  summary: SessionFeelSummary;
  language: AppLanguage;
}) {
  const styles = useThemedStyles(makeStyles);
  const theme = useTheme();

  if (summary.answered === 0) {
    return null;
  }

  return (
    <View style={styles.feelSummary}>
      <Text style={styles.feelSummaryHeading}>{t(language, 'history.feel.heading')}</Text>
      {summary.read ? (
        <View style={styles.feelSummaryRow}>
          <Text style={styles.feelSummaryRead}>
            {t(language, FEEL_READ_LABEL_KEY[summary.read])}
          </Text>
          <Text style={styles.feelSummaryBasis}>
            {t(language, 'history.feel.basis', {
              answered: summary.answered,
              considered: summary.considered,
            })}
          </Text>
        </View>
      ) : (
        <Text style={styles.feelSummaryBasis}>{t(language, 'history.feel.tooFew')}</Text>
      )}
      {/* Counted separately because it does not average: two brutal sessions
          among ten comfortable ones is worth seeing, and a mean files them
          under "mixed" and hides them. */}
      {summary.tooHardCount > 0 ? (
        <View style={styles.feelSummaryRow}>
          <View
            style={[
              styles.feelSummaryDot,
              { backgroundColor: sessionFeelColor(theme, 'too_hard') },
            ]}
          />
          <Text style={styles.feelSummaryBasis}>
            {t(language, 'history.feel.tooHard', { count: summary.tooHardCount })}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function SessionRow({
  session,
  unitPreference,
  language,
  onPress,
  onDelete,
}: {
  session: HistorySessionViewModel;
  unitPreference: UnitPreference;
  language: AppLanguage;
  onPress: () => void;
  /** Absent means this row cannot be deleted, rather than an inert button. */
  onDelete?: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const theme = useTheme();

  const topLift = formatTopLift(session, unitPreference, language);
  const meta = [
    formatShortDate(session.performedAt, language),
    countLabel(language, session.exerciseCount, 'history.exerciseOne', 'history.exerciseMany'),
    session.durationMinutes ? formatDurationMinutes(session.durationMinutes) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  // Only an answered session is coloured. A default colour for the rest would
  // turn "never asked" into a verdict, and most sessions predate the question.
  const feelColor = session.feel ? sessionFeelColor(theme, session.feel) : null;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.sessionCard, pressed && styles.pressed]}>
      {feelColor ? (
        <View style={[styles.sessionFeelStripe, { backgroundColor: feelColor }]} />
      ) : null}
      <View style={styles.sessionCardTop}>
        <Text style={styles.sessionCardTitle} numberOfLines={1}>
          {sessionTitle(session.workoutName, language)}
        </Text>
        {onDelete ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(language, 'history.delete')}
            hitSlop={12}
            onPress={onDelete}
            style={({ pressed }) => [styles.sessionDelete, pressed && styles.pressed]}
          >
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path
                d="M6 6l12 12M18 6L6 18"
                stroke={theme.danger}
                strokeWidth={2.2}
                strokeLinecap="round"
              />
            </Svg>
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.sessionCardMeta}>{meta}</Text>
      <View style={styles.sessionCardFooter}>
        <Text style={styles.sessionCardVolume}>{formatVolume(session.totalVolume, unitPreference)}</Text>
        {topLift ? (
          <Text style={styles.sessionCardLift} numberOfLines={1}>
            {topLift}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export function HistoryScreen({
  sessions,
  cardioSessions = [],
  unitPreference,
  language = 'en',
  selectedSessionId,
  getSessionLogs,
  onSelectSession,
  onDeleteSession,
  onDeleteCardioSession,
  onBack,
}: HistoryScreenProps) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  // Held as the whole row, not an id: the dialog names the workout it is
  // about to delete, and an id cannot be read aloud.
  const [pendingDelete, setPendingDelete] = useState<HistorySessionViewModel | null>(null);
  const [pendingCardioDelete, setPendingCardioDelete] = useState<{ id: string; name: string } | null>(null);
  const selectedSession = sessions.find((session) => session.id === selectedSessionId);

  const sessionViewModels = useMemo(
    () =>
      sessions
        .map((session) => buildHistorySessionViewModel(session, getSessionLogs(session.id)))
        .sort((left, right) => new Date(right.performedAt).getTime() - new Date(left.performedAt).getTime()),
    [getSessionLogs, sessions],
  );
  const filteredSessions = useMemo(
    () => filterHistorySessionViewModels(sessionViewModels, { query: searchQuery, filter: 'all' }),
    [searchQuery, sessionViewModels],
  );
  const filtersActive = searchQuery.trim().length > 0;
  // Deliberately off the unfiltered list: this describes the training, and a
  // search for "penkki" must not change how demanding the last month was.
  const feelSummary = useMemo(() => summariseSessionFeel(sessionViewModels), [sessionViewModels]);

  /* ── session detail ─────────────────────────────────────────────────── */
  if (selectedSession) {
    const logs = [...getSessionLogs(selectedSession.id)].sort((left, right) => left.orderIndex - right.orderIndex);
    const view = buildHistorySessionViewModel(selectedSession, logs);
    const topLift = formatTopLift(view, unitPreference, language);

    return (
      <View style={styles.screen}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.detailContent, { paddingBottom: layout.bottomTabBarReserve }]}
        >
          <View style={[styles.hero, { paddingTop: insets.top + 14 }]}>
            <Svg
              style={StyleSheet.absoluteFill}
              width={HERO_GRADIENT_WIDTH}
              height={HERO_GRADIENT_HEIGHT}
              viewBox={`0 0 ${HERO_GRADIENT_WIDTH} ${HERO_GRADIENT_HEIGHT}`}
            >
              <Defs>
                <SvgLinearGradient id="historyHero" x1="0" y1="0" x2="0.55" y2="1">
                  <Stop offset="0" stopColor={HERO_STOPS[0]} />
                  <Stop offset="0.46" stopColor={HERO_STOPS[1]} />
                  <Stop offset="1" stopColor={HERO_STOPS[2]} />
                </SvgLinearGradient>
              </Defs>
              <Rect
                width={HERO_GRADIENT_WIDTH}
                height={HERO_GRADIENT_HEIGHT}
                fill="url(#historyHero)"
              />
            </Svg>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t(language, 'common.back')}
              onPress={onBack}
              hitSlop={10}
              style={({ pressed }) => [styles.heroBack, pressed && styles.pressed]}
            >
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M15 5l-7 7 7 7"
                  stroke="#FFFFFF"
                  strokeWidth={2.4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </Pressable>

            <Text style={styles.heroEyebrow}>{t(language, 'history.savedSession')}</Text>
            <Text style={styles.heroTitle} numberOfLines={2}>
              {sessionTitle(selectedSession.workoutNameSnapshot, language)}
            </Text>
            <Text style={styles.heroMeta}>{formatSessionDate(selectedSession.performedAt, language)}</Text>
          </View>

          <View style={styles.body}>
            <View style={styles.statsCard}>
              <StatCell value={`${view.setsCompleted}`} label={t(language, 'history.signal.sets')} />
              <View style={styles.statDivider} />
              <StatCell
                value={formatVolume(view.totalVolume, unitPreference)}
                label={t(language, 'history.signal.volume')}
              />
              <View style={styles.statDivider} />
              <StatCell value={`${view.exerciseCount}`} label={t(language, 'complete.stat.exercises')} />
              {view.durationMinutes ? (
                <>
                  <View style={styles.statDivider} />
                  <StatCell
                    value={formatDurationMinutes(view.durationMinutes)}
                    label={t(language, 'complete.stat.duration')}
                  />
                </>
              ) : null}
            </View>

            {topLift ? (
              <View style={styles.noteCard}>
                <View style={styles.noteIconTile}>
                  <Svg width={22} height={22} viewBox="0 0 24 24">
                    <Path
                      d="M12 2l2.5 5 5.5.8-4 3.9.95 5.5L12 20.5 7.05 17.2 8 11.7l-4-3.9L9.5 7z"
                      fill={theme.gold}
                    />
                  </Svg>
                </View>
                <View style={styles.noteCopy}>
                  <Text style={styles.noteEyebrow}>{t(language, 'history.worthNoting')}</Text>
                  <Text style={styles.noteTitle} numberOfLines={1}>
                    {topLift}
                  </Text>
                  <Text style={styles.noteBody}>{t(language, 'history.heaviestLift')}</Text>
                </View>
              </View>
            ) : null}

            <SectionLabel label={t(language, 'history.loggedLifts')} />
            <View style={styles.liftCard}>
              {logs.map((log, index) => {
                const counts = getLogSetStatusCounts(log);
                const flags = [
                  log.skipped ? t(language, 'history.badge.skipped') : null,
                  log.swappedFrom ? t(language, 'history.badge.swapped') : null,
                  log.status === 'active' ? t(language, 'history.badge.partial') : null,
                  log.sessionInserted ? t(language, 'history.badge.added') : null,
                ].filter((flag): flag is string => Boolean(flag));

                const statusSummary = [
                  counts.completed > 0
                    ? countLabel(language, counts.completed, 'history.completedSetOne', 'history.completedSetMany')
                    : null,
                  counts.skipped > 0
                    ? countLabel(language, counts.skipped, 'history.skippedSetOne', 'history.skippedSetMany')
                    : null,
                  counts.pending > 0
                    ? countLabel(language, counts.pending, 'history.pendingSetOne', 'history.pendingSetMany')
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ');

                return (
                  <View key={log.id} style={[styles.liftRow, index > 0 && styles.liftRowDivided]}>
                    <View style={styles.liftCopy}>
                      <View style={styles.liftNameRow}>
                        <Text style={styles.liftName} numberOfLines={1}>
                          {exerciseNameLabel(language, formatLiftDisplayLabel(log.exerciseNameSnapshot))}
                        </Text>
                        {/* Inverted: a chip that is on for nearly every row says
                            nothing, and being on for every row is exactly what
                            made a reader ask what it meant. It speaks only when
                            a lift is OUT of the trend — the case worth knowing. */}
                        {!log.tracked && !log.skipped ? (
                          <Badge label={t(language, 'history.badge.untracked')} />
                        ) : null}
                      </View>
                      <Text style={styles.liftResult}>{formatLogResult(log, unitPreference, language)}</Text>
                      {statusSummary ? <Text style={styles.liftMeta}>{statusSummary}</Text> : null}
                      {log.swappedFrom ? (
                        <Text style={styles.liftMeta}>
                          {t(language, 'history.swappedFrom', {
                            name: exerciseNameLabel(language, formatLiftDisplayLabel(log.swappedFrom)),
                          })}
                        </Text>
                      ) : null}
                      {log.notes ? <Text style={styles.liftNote}>{log.notes}</Text> : null}
                      {flags.length ? (
                        <View style={styles.liftFlagRow}>
                          {flags.map((flag) => (
                            <Badge key={`${log.id}:${flag}`} label={flag} />
                          ))}
                        </View>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  /* ── session list ───────────────────────────────────────────────────── */

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.listContent, { paddingBottom: layout.bottomTabBarReserve }]}
      >
        <Text style={styles.pageTitle}>{t(language, 'history.title')}</Text>
        <Text style={styles.pageSubtitle}>{t(language, 'history.subtitle')}</Text>

        {sessions.length === 0 ? (
          <EmptyState title={t(language, 'history.empty.title')} body={t(language, 'history.empty.body')} />
        ) : (
          <>
            <View style={styles.browseCard}>
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={t(language, 'history.searchPlaceholder')}
                placeholderTextColor={theme.faint}
                selectionColor={theme.purple}
                style={styles.searchInput}
              />
              {/* A list of what happened, and a search over it. The review /
                  tracked filter chips and their "N tarkistettavaa" count are
                  gone: they were a triage layer over a history, and a history
                  is not a to-do list. */}
              <Text style={styles.browseMeta}>
                {t(language, 'history.browse.meta', { sessions: filteredSessions.length })}
              </Text>
            </View>

            <FeelSummaryCard summary={feelSummary} language={language} />

            {filteredSessions.length ? (
              <View style={styles.sessionList}>
                {filteredSessions.map((session) => (
                  <SessionRow
                    key={session.sessionId}
                    session={session}
                    unitPreference={unitPreference}
                    language={language}
                    onPress={() => onSelectSession(session.sessionId)}
                    onDelete={onDeleteSession ? () => setPendingDelete(session) : undefined}
                  />
                ))}
              </View>
            ) : (
              <EmptyState
                title={t(language, 'history.emptyFiltered.title')}
                body={t(language, 'history.emptyFiltered.body')}
              />
            )}

            <ConfirmDialog
              language={language}
              visible={pendingDelete !== null}
              destructive
              title={t(language, 'history.delete.title')}
              message={t(language, 'history.delete.body')}
              confirmLabel={t(language, 'history.delete')}
              onCancel={() => setPendingDelete(null)}
              onConfirm={() => {
                const target = pendingDelete;
                setPendingDelete(null);
                if (target) {
                  onDeleteSession?.(target.sessionId);
                }
              }}
            />

            {cardioSessions.length > 0 && !filtersActive ? (
              <>
                <SectionLabel label={t(language, 'history.cardio')} />
                <View style={styles.liftCard}>
                  {cardioSessions.map((session, index) => {
                    const activity = getCardioActivity(session.activityType);
                    return (
                      <View key={session.id} style={[styles.cardioRow, index > 0 && styles.liftRowDivided]}>
                        <View style={styles.cardioIcon}>
                          <CardioIcon kind={activity.icon} size={19} color={theme.purple} />
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.liftName} numberOfLines={1}>
                            {activity.name}
                          </Text>
                          <Text style={styles.liftMeta}>
                            {formatShortDate(session.performedAt, language)} {'·'}{' '}
                            {buildCardioStatsLine(session.durationSec, session.distanceKm)}
                          </Text>
                        </View>
                        {/* The same affordance the workout rows above have. A
                            list where one kind of entry can be removed and the
                            one beside it cannot reads as a bug, and was one
                            (#bugs 2026-08-26). */}
                        {onDeleteCardioSession ? (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={t(language, 'history.deleteCardio')}
                            hitSlop={10}
                            onPress={() => setPendingCardioDelete({ id: session.id, name: activity.name })}
                            style={({ pressed }) => [styles.cardioDelete, pressed && { opacity: 0.6 }]}
                          >
                            <Text style={styles.cardioDeleteGlyph}>×</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              </>
            ) : null}

            <ConfirmDialog
              visible={pendingCardioDelete !== null}
              language={language}
              destructive
              title={t(language, 'history.deleteCardio.title')}
              message={t(language, 'history.deleteCardio.body')}
              confirmLabel={t(language, 'history.deleteCardio')}
              onCancel={() => setPendingCardioDelete(null)}
              onConfirm={() => {
                const target = pendingCardioDelete;
                setPendingCardioDelete(null);
                if (target) {
                  onDeleteCardioSession?.(target.id);
                }
              }}
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const CARD_SHADOW = {
  shadowColor: '#281C5A',
  shadowOffset: { width: 0, height: 12 },
  shadowOpacity: 0.07,
  shadowRadius: 26,
  elevation: 2,
} as const;

const makeStyles = (theme: Theme) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.995 }],
  },

  /* list */
  listContent: {
    paddingHorizontal: 18,
    paddingTop: spacing.lg,
    gap: 14,
  },
  pageTitle: {
    color: theme.ink,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  pageSubtitle: {
    marginTop: -8,
    color: theme.muted,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '600',
  },
  browseCard: {
    backgroundColor: theme.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: HAIRLINE,
    padding: 14,
    gap: 12,
    ...CARD_SHADOW,
  },
  searchInput: {
    height: 44,
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: theme.bg,
    color: theme.ink,
    fontSize: 14.5,
    fontWeight: '700',
  },
  browseMeta: {
    color: theme.faint,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  sessionList: {
    gap: 10,
  },
  sessionCard: {
    backgroundColor: theme.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: HAIRLINE,
    paddingVertical: 14,
    paddingHorizontal: 16,
    ...CARD_SHADOW,
  },
  /**
   * Inset rather than clipped to the card edge: `overflow: 'hidden'` on a
   * shadowed card drops the shadow on Android, so the stripe carries its own
   * radius and sits just inside the border instead.
   */
  sessionFeelStripe: {
    position: 'absolute',
    left: 5,
    top: 12,
    bottom: 12,
    width: 4,
    borderRadius: 2,
  },
  feelSummary: {
    backgroundColor: theme.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: HAIRLINE,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 6,
  },
  feelSummaryHeading: {
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: theme.faint,
    fontWeight: '700',
  },
  feelSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  feelSummaryRead: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.ink,
  },
  feelSummaryBasis: {
    fontSize: 13,
    color: theme.muted,
    flexShrink: 1,
  },
  feelSummaryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sessionDelete: {
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sessionCardTitle: {
    flex: 1,
    color: theme.ink,
    fontSize: 16.5,
    lineHeight: 21,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  sessionCardMeta: {
    marginTop: 3,
    color: theme.muted,
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '600',
  },
  sessionCardFooter: {
    marginTop: 9,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
  },
  sessionCardVolume: {
    color: theme.ink,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  sessionCardLift: {
    flex: 1,
    color: theme.faint,
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '700',
  },

  /* detail */
  detailContent: {
    paddingBottom: spacing.lg,
  },
  hero: {
    overflow: 'hidden',
    paddingHorizontal: 20,
    paddingBottom: 26,
  },
  heroBack: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -8,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  heroEyebrow: {
    marginTop: 16,
    color: 'rgba(255,255,255,0.78)',
    fontSize: 10.5,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  heroTitle: {
    marginTop: 6,
    color: '#FFFFFF',
    fontSize: 27,
    lineHeight: 33,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  heroMeta: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.82)',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  body: {
    paddingHorizontal: 18,
    paddingTop: 18,
    gap: 14,
  },
  statsCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    backgroundColor: theme.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: HAIRLINE,
    paddingVertical: 17,
    paddingHorizontal: 6,
    ...CARD_SHADOW,
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    color: theme.ink,
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    marginTop: 5,
    color: theme.faint,
    fontSize: 9.5,
    lineHeight: 13,
    fontWeight: '800',
    letterSpacing: 0.7,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  statDivider: {
    width: 1,
    height: 40,
    marginTop: 1,
    backgroundColor: HAIRLINE,
  },
  noteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    backgroundColor: theme.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: HAIRLINE,
    paddingVertical: 14,
    paddingHorizontal: 15,
    ...CARD_SHADOW,
  },
  noteIconTile: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FBF1DA',
  },
  noteCopy: {
    flex: 1,
    minWidth: 0,
  },
  noteEyebrow: {
    color: theme.gold,
    fontSize: 10.5,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  noteTitle: {
    marginTop: 2,
    color: theme.ink,
    fontSize: 16.5,
    lineHeight: 21,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  noteBody: {
    marginTop: 2,
    color: theme.muted,
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '600',
  },
  sectionLabel: {
    marginTop: 4,
    color: theme.faint,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  liftCard: {
    backgroundColor: theme.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: HAIRLINE,
    paddingHorizontal: 16,
    ...CARD_SHADOW,
  },
  liftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
  },
  liftRowDivided: {
    borderTopWidth: 1,
    borderTopColor: HAIRLINE,
  },
  liftCopy: {
    flex: 1,
    minWidth: 0,
  },
  liftNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liftName: {
    flexShrink: 1,
    color: theme.ink,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
  },
  liftResult: {
    marginTop: 2,
    color: theme.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  liftMeta: {
    marginTop: 2,
    color: theme.faint,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  liftNote: {
    marginTop: 4,
    color: theme.muted,
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '600',
    fontStyle: 'italic',
  },
  liftFlagRow: {
    marginTop: 7,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  cardioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
  },
  cardioDelete: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardioDeleteGlyph: {
    color: theme.faint,
    fontSize: 21,
    lineHeight: 23,
    fontWeight: '600',
  },
  cardioIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.purpleSoft,
  },

  /* shared bits */
  badge: {
    borderRadius: 8,
    paddingVertical: 3,
    paddingHorizontal: 8,
    backgroundColor: theme.bg,
  },
  badgePurple: {
    backgroundColor: theme.purpleSoft,
  },
  badgeWarn: {
    backgroundColor: '#FEF3C7',
  },
  badgeText: {
    color: theme.muted,
    fontSize: 10.5,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  badgeTextPurple: {
    color: theme.purple,
  },
  badgeTextWarn: {
    color: '#B45309',
  },
  emptyState: {
    backgroundColor: theme.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: HAIRLINE,
    paddingVertical: 26,
    paddingHorizontal: 20,
    alignItems: 'center',
    ...CARD_SHADOW,
  },
  emptyTitle: {
    color: theme.ink,
    fontSize: 16.5,
    lineHeight: 21,
    fontWeight: '800',
  },
  emptyBody: {
    marginTop: 5,
    color: theme.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
});
