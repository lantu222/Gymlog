import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ConfirmDialog } from '../components/ConfirmDialog';
import { ProgramPhotoSlot } from '../components/ProgramPhotoSlot';
import { formatWorkoutDisplayLabel } from '../lib/displayLabel';
import { exerciseNameLabel } from '../lib/exerciseNameLabel';
import { I18nKey, t } from '../lib/i18n';
import { ProgramDetailViewModel } from '../lib/programDetails';
import { HG } from '../lightTheme';
import { localizeSessionName, localizeWorkoutFocus } from '../lib/sessionNameLabel';
import { layout, radii, spacing } from '../theme';
import type { AppLanguage } from '../types/models';

const DAY_KEYS: I18nKey[] = [
  'setup.day.mon',
  'setup.day.tue',
  'setup.day.wed',
  'setup.day.thu',
  'setup.day.fri',
  'setup.day.sat',
  'setup.day.sun',
];

const PLAN_BACKGROUND = HG.bg;
const PLAN_SURFACE = '#FFFFFF';
const PLAN_SURFACE_SOFT = '#F2ECFF';
const PLAN_TEXT = '#101828';
const PLAN_TEXT_MUTED = '#667085';
const PLAN_BORDER = '#E4D8FF';
const PLAN_PURPLE = '#7C3AED';
const PLAN_PURPLE_DARK = '#5B21B6';
const PLAN_PURPLE_SOFT = '#F1EAFF';
// Green now means one thing only on this screen: a recovery day.
const PLAN_GREEN = '#16A34A';

interface ProgramDetailScreenProps {
  program: ProgramDetailViewModel;
  onBack: () => void;
  onPrimaryAction: () => void;
  onStartSession: (sessionId: string) => void;
  onEdit?: () => void;
  destructiveActionLabel?: string;
  destructiveActionTitle?: string;
  destructiveActionMessage?: string;
  onDestructiveAction?: () => void;
  activePlanSummary?: {
    weekLabel: string;
    progressPercent: number;
    sessionsPerWeek: string;
    weeklyMinutes: string;
  } | null;
  language?: AppLanguage;
}

function parseMinutesFromBadges(badges: string[]) {
  const durationBadge = badges.find((badge) => badge.toLowerCase().includes('min'));
  return durationBadge ? Number.parseInt(durationBadge.replace(/\D/g, ''), 10) || 0 : 0;
}

function getWorkoutFocus(session: ProgramDetailViewModel['sessions'][number], language: AppLanguage) {
  const copy = session.focus || session.preview;
  return copy ? localizeWorkoutFocus(copy, language) : t(language, 'detail.defaultFocus');
}

function formatPlanSessionTitle(
  session: ProgramDetailViewModel['sessions'][number],
  index: number,
  programTitle: string,
  language: AppLanguage,
) {
  // The English name is what is stored and matched on; localizeSessionName only
  // rewrites the parts it recognises.
  const sessionName = formatWorkoutDisplayLabel(session.name, 'Workout');
  const normalizedProgram = programTitle.toLowerCase();
  const normalizedSession = sessionName.toLowerCase();

  if (normalizedProgram.includes('full body') && /^minimal\s+[a-z]$/.test(normalizedSession)) {
    return `${t(language, 'detail.day', { index: index + 1 })}. ${t(language, 'facet.fullBody')}`;
  }

  if (/^workout\s+[a-z]$/.test(normalizedSession)) {
    return `${t(language, 'detail.day', { index: index + 1 })}. ${t(language, 'ai.signal.workout')}`;
  }

  if (/^day\s+\d+/i.test(sessionName)) {
    return localizeSessionName(sessionName, language);
  }

  return `${t(language, 'detail.day', { index: index + 1 })}. ${localizeSessionName(sessionName, language)}`;
}

function isWarmupExercise(name: string) {
  return /warm|prep|activation/i.test(name);
}

function isCooldownExercise(name: string) {
  return /cooldown|stretch|breath|recovery/i.test(name);
}

function buildSessionContentSections(session: ProgramDetailViewModel['sessions'][number]) {
  const warmupExercises = session.exercises.filter((exercise) => isWarmupExercise(exercise.name));
  const cooldownExercises = session.exercises.filter((exercise) => isCooldownExercise(exercise.name));
  const workoutExercises = session.exercises.filter(
    (exercise) => !isWarmupExercise(exercise.name) && !isCooldownExercise(exercise.name),
  );

  return [
    {
      titleKey: 'detail.warmup' as I18nKey,
      items: warmupExercises.length
        ? warmupExercises
        : [{ id: `${session.id}:warmup`, name: 'Dynamic Warm-Up', prescription: '5-8 min' }],
    },
    {
      titleKey: 'ai.signal.workout' as I18nKey,
      items: workoutExercises,
    },
    {
      titleKey: 'detail.cooldown' as I18nKey,
      items: cooldownExercises.length
        ? cooldownExercises
        : [{ id: `${session.id}:cooldown`, name: 'Cooldown Flow', prescription: '3-5 min' }],
    },
  ].filter((section) => section.items.length > 0);
}

function getTrainingDayIndexes(sessionCount: number) {
  if (sessionCount <= 1) {
    return new Set([0]);
  }

  const templates: Record<number, number[]> = {
    2: [0, 3],
    3: [0, 2, 4],
    4: [0, 1, 3, 5],
    5: [0, 1, 2, 4, 5],
  };

  return new Set(templates[sessionCount] ?? [0, 1, 2, 3, 4, 5].slice(0, Math.min(sessionCount, 6)));
}

export function ProgramDetailScreen({
  program,
  onBack,
  onStartSession,
  onEdit,
  destructiveActionLabel,
  destructiveActionTitle,
  destructiveActionMessage,
  onDestructiveAction,
  activePlanSummary = null,
  language = 'en',
}: ProgramDetailScreenProps) {
  const [confirmVisible, setConfirmVisible] = useState(false);
  const displayTitle = formatWorkoutDisplayLabel(program.title, 'Workout plan');
  const nextSession = program.sessions[0] ?? null;
  const durationMinutes = parseMinutesFromBadges(program.badges);
  const totalSessions = program.sessions.length * 8;
  const completedSessions = Math.max(0, Math.round(((activePlanSummary?.progressPercent ?? 1) / 100) * totalSessions));
  const progressPercent = activePlanSummary?.progressPercent ?? 1;
  const weekLabel = activePlanSummary?.weekLabel ?? t(language, 'detail.weekFallback');
  const sessionsPerWeek = activePlanSummary?.sessionsPerWeek ?? `${program.sessions.length}`;
  const weeklyMinutes =
    activePlanSummary?.weeklyMinutes ??
    (durationMinutes > 0
      ? `~${durationMinutes * Math.max(1, program.sessions.length)} min`
      : t(language, 'detail.workoutCount', { count: program.sessions.length }));
  const scheduleSlots = useMemo(
    () => {
      const trainingDayIndexes = getTrainingDayIndexes(program.sessions.length);

      return DAY_KEYS.map((dayKey, index) => ({
        dayKey,
        day: t(language, dayKey).toUpperCase(),
        isTraining: trainingDayIndexes.has(index),
      }));
    },
    [language, program.sessions.length],
  );
  const hasDestructiveAction = Boolean(
    destructiveActionLabel && destructiveActionTitle && destructiveActionMessage && onDestructiveAction,
  );

  function handleConfirmDelete() {
    setConfirmVisible(false);
    onDestructiveAction?.();
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable hitSlop={10} onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>{t(language, 'common.back')}</Text>
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1} adjustsFontSizeToFit>
          {t(language, 'detail.planOverview')}
        </Text>
        {program.source === 'custom' && onEdit ? (
          <Pressable hitSlop={10} onPress={onEdit} style={styles.headerAction}>
            <Text style={styles.headerActionText}>{t(language, 'plan.edit')}</Text>
          </Pressable>
        ) : (
          <View style={styles.headerActionSpacer} />
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {program.source === 'ready' ? <ProgramPhotoSlot label={t(language, 'detail.photoSoon')} aspectRatio={16 / 9} /> : null}

        <View style={styles.planCard}>
          <View style={styles.planCardTop}>
            <View style={styles.planCopy}>
              <Text style={styles.cardEyebrow}>{t(language, 'detail.yourPlan')}</Text>
              <Text style={styles.planTitle} numberOfLines={2} adjustsFontSizeToFit>
                {displayTitle}
              </Text>
              <Text style={styles.planWeek}>{weekLabel}</Text>
            </View>
            <View style={styles.planChart}>
              {[0.36, 0.58, 0.8, 1].map((height, index) => (
                <View key={`plan-bar-${index}`} style={[styles.planChartBar, { height: 62 * height, opacity: 0.45 + index * 0.15 }]} />
              ))}
            </View>
          </View>

          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>{t(language, 'progress.title')}</Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.max(1, Math.min(100, progressPercent))}%` }]} />
            </View>
            <Text style={styles.progressPercent}>{progressPercent}%</Text>
          </View>

          <View style={styles.planStats}>
            <View style={styles.planStat}>
              <Text style={styles.planStatValue}>{completedSessions}</Text>
              <Text style={styles.planStatLabel}>{t(language, 'detail.done')}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.planStat}>
              <Text style={styles.planStatValue}>{totalSessions}</Text>
              <Text style={styles.planStatLabel}>{t(language, 'detail.sessions')}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.planStat}>
              <Text style={styles.planStatValue}>{sessionsPerWeek}</Text>
              <Text style={styles.planStatLabel}>{t(language, 'detail.perWeek')}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.planStat}>
              <Text style={styles.planStatValue}>{weeklyMinutes}</Text>
              <Text style={styles.planStatLabel}>{t(language, 'detail.weekly')}</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t(language, 'progress.thisWeek')}</Text>
          <Text style={styles.sectionMeta}>
            {t(language, 'detail.trainingDays', { count: program.sessions.length })}
          </Text>
        </View>
        <View style={styles.scheduleCard}>
          {scheduleSlots.map((slot) => (
            <View key={slot.dayKey} style={styles.scheduleItem}>
              <View style={[styles.scheduleDot, slot.isTraining ? styles.scheduleDotTraining : styles.scheduleDotRecovery]} />
              <Text style={styles.scheduleDay}>{slot.day}</Text>
              <Text style={[styles.scheduleLabel, slot.isTraining ? styles.scheduleLabelTraining : styles.scheduleLabelRecovery]}>
                {t(language, slot.isTraining ? 'detail.train' : 'detail.recover')}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t(language, 'detail.workouts')}</Text>
          <Text style={styles.sectionMeta}>
            {t(language, 'detail.inRotation', { count: program.sessions.length })}
          </Text>
        </View>
        <View style={styles.workoutList}>
          {program.sessions.map((session, index) => {
            const contentSections = buildSessionContentSections(session);

            return (
              <View key={session.id} style={styles.workoutCard}>
                <View style={styles.workoutTopRow}>
                  <View style={styles.workoutIndexTile}>
                    <Text style={styles.workoutIndexText}>{index + 1}</Text>
                  </View>
                  <View style={styles.workoutCopy}>
                    <Text style={styles.workoutName} numberOfLines={1} adjustsFontSizeToFit>
                      {formatPlanSessionTitle(session, index, displayTitle, language)}
                    </Text>
                    <Text style={styles.workoutMeta}>
                      {durationMinutes > 0 ? `~${durationMinutes} min` : t(language, 'detail.flexible')} -{' '}
                      {t(
                        language,
                        session.exerciseCount === 1 ? 'tpl.exerciseOne' : 'tpl.exerciseMany',
                        { count: session.exerciseCount },
                      )}
                    </Text>
                  </View>
                  <Pressable onPress={() => onStartSession(session.id)} style={styles.workoutAction}>
                    <Text style={styles.workoutActionText}>{t(language, 'detail.start')}</Text>
                  </Pressable>
                </View>
                <Text style={styles.workoutFocus} numberOfLines={2}>
                  {getWorkoutFocus(session, language)}
                </Text>
                <View style={styles.sessionContentList}>
                  {contentSections.map((section) => (
                    <View key={`${session.id}:${section.titleKey}`} style={styles.sessionContentSection}>
                      <Text style={styles.sessionContentTitle}>{t(language, section.titleKey)}</Text>
                      {section.items.map((exercise) => (
                        <View key={exercise.id} style={styles.sessionContentRow}>
                          <Text style={styles.sessionContentName} numberOfLines={1}>
                            {exerciseNameLabel(language, exercise.name)}
                          </Text>
                          <Text style={styles.sessionContentMeta} numberOfLines={1}>
                            {exercise.prescription}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
        </View>

        {hasDestructiveAction ? (
          <Pressable onPress={() => setConfirmVisible(true)} style={styles.destructiveButton}>
            <Text style={styles.destructiveButtonText}>{destructiveActionLabel}</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <View style={styles.stickyFooter}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(language, 'detail.startNext')}
          disabled={!nextSession}
          onPress={() => {
            if (nextSession) {
              onStartSession(nextSession.id);
            }
          }}
          style={[styles.primaryButton, !nextSession && styles.primaryButtonDisabled]}
        >
          <Text style={styles.primaryButtonText}>{t(language, 'detail.startNext')}</Text>
        </Pressable>
      </View>

      {hasDestructiveAction ? (
        <ConfirmDialog
          visible={confirmVisible}
          title={destructiveActionTitle!}
          message={destructiveActionMessage!}
          confirmLabel={destructiveActionLabel!}
          destructive
          onCancel={() => setConfirmVisible(false)}
          onConfirm={handleConfirmDelete}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: PLAN_BACKGROUND,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  backButton: {
    minWidth: 54,
    minHeight: 40,
    justifyContent: 'center',
  },
  backText: {
    color: PLAN_TEXT,
    fontSize: 14,
    fontWeight: '800',
  },
  headerTitle: {
    flex: 1,
    color: PLAN_TEXT,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  headerAction: {
    minWidth: 54,
    minHeight: 40,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  headerActionSpacer: {
    width: 54,
  },
  headerActionText: {
    color: PLAN_PURPLE,
    fontSize: 14,
    fontWeight: '900',
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: layout.bottomTabBarReserve + 82,
    gap: spacing.md,
  },
  planCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: PLAN_BORDER,
    backgroundColor: PLAN_SURFACE,
    padding: spacing.lg,
    gap: spacing.md,
    shadowColor: '#D8C7FF',
    shadowOpacity: 0.32,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  planCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  planCopy: {
    flex: 1,
    gap: 5,
  },
  cardEyebrow: {
    color: PLAN_PURPLE,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  planTitle: {
    color: PLAN_TEXT,
    fontSize: 23,
    lineHeight: 28,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  planWeek: {
    color: PLAN_TEXT_MUTED,
    fontSize: 16,
    fontWeight: '700',
  },
  planChart: {
    width: 104,
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    gap: 8,
  },
  planChartBar: {
    width: 18,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    backgroundColor: '#A78BFA',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  progressLabel: {
    color: PLAN_TEXT_MUTED,
    fontSize: 13,
    fontWeight: '700',
  },
  progressTrack: {
    flex: 1,
    height: 10,
    overflow: 'hidden',
    borderRadius: radii.pill,
    backgroundColor: '#EEF0F5',
  },
  progressFill: {
    height: '100%',
    borderRadius: radii.pill,
    backgroundColor: PLAN_PURPLE,
  },
  progressPercent: {
    color: PLAN_PURPLE_DARK,
    fontSize: 15,
    fontWeight: '900',
  },
  planStats: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderTopWidth: 1,
    borderTopColor: PLAN_BORDER,
    paddingTop: spacing.md,
  },
  planStat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  planStatValue: {
    color: PLAN_TEXT,
    fontSize: 17,
    fontWeight: '900',
  },
  planStatLabel: {
    color: PLAN_TEXT_MUTED,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  statDivider: {
    width: 1,
    backgroundColor: PLAN_BORDER,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  sectionTitle: {
    color: PLAN_TEXT,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  sectionMeta: {
    color: PLAN_TEXT_MUTED,
    fontSize: 12,
    fontWeight: '800',
  },
  scheduleCard: {
    flexDirection: 'row',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: PLAN_BORDER,
    backgroundColor: PLAN_SURFACE,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
  },
  scheduleItem: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
  },
  scheduleDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  scheduleDotTraining: {
    backgroundColor: PLAN_PURPLE,
  },
  scheduleDotRecovery: {
    backgroundColor: PLAN_GREEN,
  },
  scheduleDay: {
    color: PLAN_TEXT,
    fontSize: 11,
    fontWeight: '900',
  },
  scheduleLabel: {
    fontSize: 9,
    fontWeight: '800',
  },
  scheduleLabelTraining: {
    color: PLAN_PURPLE,
  },
  scheduleLabelRecovery: {
    color: PLAN_GREEN,
  },
  workoutList: {
    gap: spacing.sm,
  },
  workoutCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: PLAN_BORDER,
    backgroundColor: PLAN_SURFACE,
    padding: spacing.md,
    gap: spacing.sm,
  },
  workoutTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  workoutIndexTile: {
    width: 48,
    height: 48,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PLAN_SURFACE_SOFT,
  },
  workoutIndexText: {
    color: PLAN_PURPLE,
    fontSize: 20,
    fontWeight: '900',
  },
  workoutCopy: {
    flex: 1,
    gap: 3,
  },
  workoutName: {
    color: PLAN_TEXT,
    fontSize: 17,
    fontWeight: '900',
  },
  workoutMeta: {
    color: PLAN_TEXT_MUTED,
    fontSize: 12,
    fontWeight: '800',
  },
  workoutAction: {
    minHeight: 38,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    justifyContent: 'center',
    // Actions wear the app purple; green here stays for recovery days only.
    backgroundColor: PLAN_PURPLE_SOFT,
  },
  workoutActionText: {
    color: PLAN_PURPLE,
    fontSize: 13,
    fontWeight: '900',
  },
  workoutFocus: {
    color: PLAN_TEXT_MUTED,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  sessionContentList: {
    overflow: 'hidden',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: PLAN_BORDER,
    backgroundColor: '#FAF8FF',
  },
  sessionContentSection: {
    borderBottomWidth: 1,
    borderBottomColor: PLAN_BORDER,
  },
  sessionContentTitle: {
    backgroundColor: '#ECE7F2',
    color: PLAN_TEXT,
    fontSize: 14,
    fontWeight: '900',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  sessionContentRow: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: PLAN_SURFACE,
    borderTopWidth: 1,
    borderTopColor: '#F0E8FF',
  },
  sessionContentName: {
    flex: 1,
    color: PLAN_TEXT,
    fontSize: 13,
    fontWeight: '800',
  },
  sessionContentMeta: {
    color: PLAN_TEXT_MUTED,
    fontSize: 12,
    fontWeight: '800',
  },
  destructiveButton: {
    minHeight: 48,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  destructiveButtonText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '900',
  },
  stickyFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    backgroundColor: 'rgba(247, 243, 255, 0.96)',
    borderTopWidth: 1,
    borderTopColor: PLAN_BORDER,
  },
  primaryButton: {
    minHeight: 58,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PLAN_PURPLE,
    shadowColor: PLAN_PURPLE,
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 7,
  },
  primaryButtonDisabled: {
    opacity: 0.45,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
});
