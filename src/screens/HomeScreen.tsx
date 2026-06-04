import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { HomeUpcomingSessionSummary } from '../components/HomeStreakCard';
import { GymlogIcon } from '../components/GymlogIcon';
import { HomeStreakSummary } from '../lib/dashboard';
import { getHomeMiniCalendarDays, HomeDaySessionSummary } from '../lib/homeCalendar';
import { spacing } from '../theme';

const HOME_BACKGROUND = '#F7F3FF';
const HOME_SURFACE = '#FFFFFF';
const HOME_SURFACE_SOFT = '#F2ECFF';
const HOME_TEXT = '#101828';
const HOME_TEXT_MUTED = '#667085';
const HOME_BORDER = '#E4D8FF';
const HOME_SHADOW = '#D8C7FF';
const HOME_PURPLE = '#7C3AED';
const HOME_PURPLE_DARK = '#5B21B6';
const HOME_PURPLE_LIGHT = '#EFE7FF';
const HOME_GREEN = '#16A34A';
const HOME_BLUE = '#0A84FF';

interface HomeQuickStat {
  value: string;
  label: string;
}

interface WeeklySnapshotItem {
  value: string;
  label: string;
  trendLabel: string;
  trendDirection: 'up' | 'down' | 'flat';
}

interface HomeTemplateItem {
  id: string;
  name: string;
  sessionCount: number;
  exerciseCount: number;
  updatedAt: string;
}

interface HomeRecentSessionItem {
  id: string;
  title: string;
  dateLabel: string;
  durationLabel: string;
  volumeLabel: string;
  detailLabel: string;
  exercisePreview: string;
  notePreview?: string | null;
}

interface HomePlanCard {
  programId: string;
  programType?: 'ready' | 'custom';
  eyebrow: string;
  goalLabel: string;
  title: string;
  subtitle: string;
  weekLabel: string;
  progressPercent: number;
  sessionsPerWeek: string;
  weeklyMinutes: string;
  sessions: HomeDaySessionSummary[];
  nextSession: HomeDaySessionSummary & {
    label: string;
  };
}

interface HomeScreenProps {
  hasNoProgramState?: boolean;
  profileName?: string | null;
  activePlan?: HomePlanCard | null;
  hasActiveWorkout?: boolean;
  streak: HomeStreakSummary;
  quickStats: HomeQuickStat[];
  weeklySnapshot: WeeklySnapshotItem[];
  upcomingSessions: HomeUpcomingSessionSummary[];
  recentSessions?: HomeRecentSessionItem[];
  customTemplates?: HomeTemplateItem[];
  readyTemplateCount?: number;
  onOpenActivePlan?: () => void;
  onStartActivePlanSession?: (sessionId: string) => void;
  onOpenTemplatesHub: () => void;
  onOpenCustomTemplate: (workoutTemplateId: string) => void;
  onCreateWorkoutFromExercises: () => void;
  onCreateTemplate: () => void;
  onBrowseReadyPlans: () => void;
  onOpenProgressOverview: () => void;
  onOpenTrackedProgress: () => void;
  onOpenBodyStats: () => void;
  onOpenSessionHistory: () => void;
  onOpenRecentSession: (sessionId: string) => void;
}

function formatWorkoutTotalTime(totalMinutes: number) {
  const safeMinutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;

  if (hours <= 0) {
    return `${minutes} min`;
  }

  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

export function HomeScreen({
  activePlan = null,
  streak,
  recentSessions = [],
  customTemplates = [],
  readyTemplateCount = 0,
  onOpenActivePlan,
  onOpenTemplatesHub,
  onOpenCustomTemplate,
  onCreateWorkoutFromExercises,
  onBrowseReadyPlans,
  onOpenProgressOverview,
  onOpenTrackedProgress,
  onOpenBodyStats,
  onOpenSessionHistory,
  onOpenRecentSession,
}: HomeScreenProps) {
  const primaryTemplate = customTemplates[0] ?? null;
  const planTitle = activePlan?.title ?? primaryTemplate?.name ?? 'Upper / Lower Split';
  const planWeekLabel = activePlan?.weekLabel ?? (primaryTemplate ? 'Week 1 of 8' : 'Week 1 of 8');
  const planProgressPercent = activePlan?.progressPercent ?? 0;
  const savedRoutineCount = customTemplates.length;
  const totalWorkoutTime = formatWorkoutTotalTime(streak.totalDurationMinutes);
  const planChartBars = [0.32, 0.56, 0.82, 1];
  const topCalendarDays = getHomeMiniCalendarDays().slice(0, 6);
  const trainingDayIndexes = activePlan ? [0, 3].slice(0, Math.min(Number.parseInt(activePlan.sessionsPerWeek, 10) || 2, 2)) : [0, 3];

  function handleOpenPrimaryRoutine() {
    if (activePlan && onOpenActivePlan) {
      onOpenActivePlan();
      return;
    }

    if (primaryTemplate) {
      onOpenCustomTemplate(primaryTemplate.id);
      return;
    }

    onOpenTemplatesHub();
  }

  return (
    <View style={styles.screenBackground}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text style={styles.greetingTitle}>Welcome back! {String.fromCodePoint(0x1f4aa)}</Text>
            <Text style={styles.greetingSubtitle}>Let's get after it today.</Text>
          </View>
          <View style={styles.proBadge}>
            <Text style={styles.proBadgeText}>PRO</Text>
          </View>
        </View>

        <View style={styles.homeCalendarStrip}>
          {topCalendarDays.map((day) => {
            const isTrainingDay = trainingDayIndexes.includes(day.weekdayIndex);
            const dayLabel = day.isToday ? day.dateLabel : day.weekdayLabel;

            return (
              <View key={day.dayStart} style={[styles.homeCalendarItem, day.isToday && styles.homeCalendarItemToday]}>
                <View style={[styles.homeCalendarDot, isTrainingDay ? styles.homeCalendarDotStrength : styles.homeCalendarDotRecovery]} />
                <Text style={[styles.homeCalendarDayLabel, day.isToday && styles.homeCalendarDayLabelToday]}>{dayLabel}</Text>
              </View>
            );
          })}
        </View>

        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <View style={styles.statIconTileGreen}>
              <GymlogIcon name="flame" color={HOME_GREEN} size={24} />
            </View>
            <View style={styles.statCopy}>
              <Text style={styles.statLabel}>Streak</Text>
              <Text style={styles.statValue}>{streak.value} <Text style={styles.statUnit}>days</Text></Text>
            </View>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <View style={styles.statIconTilePurple}>
              <GymlogIcon name="progress" color={HOME_GREEN} size={23} />
            </View>
            <View style={styles.statCopy}>
              <Text style={styles.statLabel}>Workouts</Text>
              <Text style={styles.statValue}>{streak.sessionsLast30Days} <Text style={styles.statUnit}>this month</Text></Text>
            </View>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <View style={styles.statIconTileGreen}>
              <GymlogIcon name="clock" color={HOME_GREEN} size={24} />
            </View>
            <View style={styles.statCopy}>
              <Text style={styles.statLabel}>Total time</Text>
              <Text style={styles.statValue}>{totalWorkoutTime}</Text>
            </View>
          </View>
        </View>

        <Pressable accessibilityRole="button" accessibilityLabel="View plan" onPress={handleOpenPrimaryRoutine} style={[styles.yourPlanCard, styles.fullBleedCard]}>
          <View style={styles.yourPlanMain}>
            <Text style={styles.yourPlanEyebrow}>YOUR PLAN</Text>
            <Text style={styles.yourPlanTitle} numberOfLines={1} adjustsFontSizeToFit>
              {planTitle}
            </Text>
            <Text style={styles.yourPlanWeek}>{planWeekLabel}</Text>

            <View style={styles.yourPlanProgressRow}>
              <Text style={styles.yourPlanProgressLabel}>Progress</Text>
              <View style={styles.yourPlanProgressTrack}>
                <View style={[styles.yourPlanProgressFill, { width: `${planProgressPercent}%` }]} />
              </View>
              <Text style={styles.yourPlanProgressPercent}>{planProgressPercent}%</Text>
            </View>
          </View>

          <View style={styles.yourPlanSide}>
            <View style={styles.yourPlanChart}>
              {planChartBars.map((height, index) => (
                <View key={`plan-chart-${index}`} style={[styles.yourPlanChartBar, { height: 56 * height, opacity: 0.42 + index * 0.14 }]} />
              ))}
            </View>

            <View style={styles.viewPlanButton}>
              <Text style={styles.viewPlanButtonText} numberOfLines={1}>
                VIEW PLAN
              </Text>
              <GymlogIcon name="chevronRight" color={HOME_GREEN} size={28} />
            </View>
          </View>
        </Pressable>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Routines</Text>
          <Pressable onPress={onOpenTemplatesHub} hitSlop={8}>
            <Text style={styles.seeAllText}>See all</Text>
          </Pressable>
        </View>

        <View style={styles.routineShortcutRow}>
          <Pressable onPress={onOpenTemplatesHub} style={styles.routineShortcutCard}>
            <View style={styles.routineShortcutIcon}>
              <GymlogIcon name="file" color={HOME_GREEN} size={21} />
            </View>
            <View style={styles.routineShortcutCopy}>
              <Text style={styles.routineShortcutTitle} numberOfLines={1} adjustsFontSizeToFit>
                Templates
              </Text>
              <Text style={styles.routineShortcutSubtitle}>{savedRoutineCount} saved</Text>
            </View>
            <GymlogIcon name="chevronRight" color={HOME_GREEN} size={20} />
          </Pressable>

          <Pressable onPress={onBrowseReadyPlans} style={styles.routineShortcutCard}>
            <View style={styles.routineShortcutIcon}>
              <GymlogIcon name="progress" color={HOME_GREEN} size={21} />
            </View>
            <View style={styles.routineShortcutCopy}>
              <Text style={styles.routineShortcutTitle} numberOfLines={1} adjustsFontSizeToFit>
                Explore
              </Text>
              <Text style={styles.routineShortcutSubtitle}>
                {readyTemplateCount > 0 ? `${readyTemplateCount} templates` : 'Find new Templates'}
              </Text>
            </View>
            <GymlogIcon name="chevronRight" color={HOME_GREEN} size={20} />
          </Pressable>
        </View>

        <Pressable accessibilityRole="button" accessibilityLabel="Start workout" onPress={onCreateWorkoutFromExercises} style={[styles.startWorkoutHero, styles.fullBleedCard]}>
          <View style={styles.startWorkoutAccentOne} />
          <View style={styles.startWorkoutAccentTwo} />
          <View style={styles.startWorkoutIconTile}>
            <GymlogIcon name="dumbbell" color={HOME_GREEN} size={26} />
          </View>
          <View style={styles.startWorkoutCopy}>
            <Text style={styles.startWorkoutTitle} numberOfLines={1} adjustsFontSizeToFit>
              Start Workout
            </Text>
            <Text style={styles.startWorkoutSubtitle}>Jump into an empty workout</Text>
          </View>
          <View style={styles.startWorkoutArrowCircle}>
            <GymlogIcon name="chevronRight" color={HOME_GREEN} size={20} />
          </View>
        </Pressable>

        <View style={styles.quickAccessSection}>
          <Text style={styles.sectionTitle}>Quick Access</Text>
          <View style={styles.quickAccessGrid}>
            <Pressable onPress={onOpenProgressOverview} style={styles.quickAccessCard}>
              <GymlogIcon name="progress" color={HOME_GREEN} size={24} />
              <Text style={styles.quickAccessText}>Progress</Text>
            </Pressable>
            <Pressable onPress={onOpenBodyStats} style={styles.quickAccessCard}>
              <GymlogIcon name="profile" color={HOME_GREEN} size={24} />
              <Text style={styles.quickAccessText}>Body Stats</Text>
            </Pressable>
            <Pressable onPress={onOpenTrackedProgress} style={styles.quickAccessCard}>
              <GymlogIcon name="check" color={HOME_GREEN} size={24} />
              <Text style={styles.quickAccessText}>PR Tracker</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.recentSessionsSection}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Recent Sessions</Text>
            <Pressable onPress={onOpenSessionHistory} hitSlop={8}>
              <Text style={styles.seeAllText}>See all</Text>
            </Pressable>
          </View>

          {recentSessions.length > 0 ? (
            <View style={styles.recentSessionsList}>
              {recentSessions.map((session, index) => {
                const isGreenTheme = index % 2 === 0;
                const accentColor = isGreenTheme ? HOME_GREEN : HOME_PURPLE;
                const themedCardStyle = isGreenTheme ? styles.recentSessionCardGreen : styles.recentSessionCardPurple;
                const themedIconStyle = isGreenTheme ? styles.recentSessionIconGreen : styles.recentSessionIconPurple;
                const themedMetricStyle = isGreenTheme ? styles.recentSessionMetricGreen : styles.recentSessionMetricPurple;

                return (
                <Pressable
                  key={session.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${session.title}`}
                  onPress={() => onOpenRecentSession(session.id)}
                  style={[styles.recentSessionCard, themedCardStyle]}
                >
                  <View style={styles.recentSessionTopRow}>
                    <View style={[styles.recentSessionIcon, themedIconStyle]}>
                      <GymlogIcon name="dumbbell" color={accentColor} size={20} />
                    </View>
                    <View style={styles.recentSessionCopy}>
                      <Text style={styles.recentSessionTitle} numberOfLines={1}>
                        {session.title}
                      </Text>
                      <Text style={styles.recentSessionDate}>{session.dateLabel}</Text>
                    </View>
                    <GymlogIcon name="chevronRight" color={accentColor} size={18} />
                  </View>
                  <View style={styles.recentSessionMetricRow}>
                    <Text style={[styles.recentSessionMetric, themedMetricStyle]}>{session.durationLabel}</Text>
                    <Text style={[styles.recentSessionMetric, themedMetricStyle]}>{session.volumeLabel}</Text>
                    <Text style={[styles.recentSessionMetric, themedMetricStyle]}>{session.detailLabel}</Text>
                  </View>
                  <Text style={styles.recentSessionPreview} numberOfLines={1}>
                    {session.exercisePreview}
                  </Text>
                  {session.notePreview ? (
                    <View style={[styles.recentSessionNoteRow, isGreenTheme ? styles.recentSessionNoteRowGreen : styles.recentSessionNoteRowPurple]}>
                      <GymlogIcon name="file" color={accentColor} size={13} />
                      <Text style={styles.recentSessionNoteText} numberOfLines={1}>
                        {session.notePreview}
                      </Text>
                    </View>
                  ) : null}
                </Pressable>
                );
              })}
            </View>
          ) : (
            <View style={styles.recentSessionEmptyCard}>
              <View>
                <Text style={styles.recentSessionTitle}>No sessions yet</Text>
                <Text style={styles.recentSessionPreview}>Start a workout and your latest sessions will appear here.</Text>
              </View>
            </View>
          )}
        </View>

        <View style={styles.bottomSafeFade} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screenBackground: {
    flex: 1,
    backgroundColor: HOME_BACKGROUND,
  },
  scrollView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    paddingHorizontal: 15,
    paddingTop: 20,
    paddingBottom: 132,
    gap: 11,
  },
  fullBleedCard: {
    marginHorizontal: -8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
    marginTop: 2,
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  greetingTitle: {
    color: HOME_TEXT,
    fontSize: 21,
    lineHeight: 25,
    fontWeight: '900',
    letterSpacing: 0,
  },
  greetingSubtitle: {
    color: HOME_TEXT_MUTED,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  proBadge: {
    minHeight: 23,
    paddingHorizontal: 10,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: HOME_GREEN,
  },
  proBadgeText: {
    color: HOME_SURFACE,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
  },
  homeCalendarStrip: {
    minHeight: 36,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.42)',
    borderWidth: 1,
    borderColor: 'rgba(228,216,255,0.62)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  homeCalendarItem: {
    minWidth: 39,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  homeCalendarItemToday: {
    minHeight: 29,
    borderRadius: 10,
    backgroundColor: HOME_SURFACE,
  },
  homeCalendarDot: {
    width: 11,
    height: 11,
    borderRadius: 999,
    borderWidth: 2,
  },
  homeCalendarDotRecovery: {
    borderColor: HOME_GREEN,
    backgroundColor: HOME_GREEN,
  },
  homeCalendarDotStrength: {
    borderColor: HOME_PURPLE,
    backgroundColor: HOME_PURPLE,
  },
  homeCalendarDayLabel: {
    color: HOME_TEXT_MUTED,
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '800',
  },
  homeCalendarDayLabelToday: {
    color: HOME_TEXT,
  },
  statsCard: {
    minHeight: 62,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: HOME_BORDER,
    backgroundColor: HOME_SURFACE,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    shadowColor: HOME_SHADOW,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 8,
  },
  statItem: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statIconTileGreen: {
    width: 25,
    height: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statIconTilePurple: {
    width: 25,
    height: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  statLabel: {
    color: HOME_TEXT_MUTED,
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '600',
  },
  statValue: {
    color: HOME_TEXT,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '900',
  },
  statUnit: {
    color: HOME_TEXT,
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '600',
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: HOME_BORDER,
    marginHorizontal: 5,
  },
  startWorkoutHero: {
    minHeight: 82,
    borderRadius: 18,
    backgroundColor: HOME_PURPLE,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    shadowColor: HOME_PURPLE,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.23,
    shadowRadius: 24,
    elevation: 10,
  },
  startWorkoutAccentOne: {
    position: 'absolute',
    top: -90,
    right: -42,
    width: 210,
    height: 210,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  startWorkoutAccentTwo: {
    position: 'absolute',
    right: -14,
    bottom: -92,
    width: 260,
    height: 260,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  startWorkoutIconTile: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: HOME_SURFACE,
  },
  startWorkoutCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  startWorkoutTitle: {
    color: HOME_SURFACE,
    fontSize: 19,
    lineHeight: 23,
    fontWeight: '900',
  },
  startWorkoutSubtitle: {
    color: 'rgba(255,255,255,0.86)',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  startWorkoutArrowCircle: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: HOME_SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startWorkoutArrow: {
    color: HOME_TEXT,
    fontSize: 32,
    lineHeight: 34,
    fontWeight: '500',
    marginTop: -2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: 0,
  },
  sectionTitle: {
    color: '#050505',
    fontSize: 19,
    lineHeight: 23,
    fontWeight: '900',
  },
  seeAllText: {
    color: HOME_PURPLE,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
  },
  routineShortcutRow: {
    flexDirection: 'row',
    gap: 9,
    marginTop: -6,
  },
  routineShortcutCard: {
    flex: 1,
    minHeight: 56,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: HOME_BORDER,
    backgroundColor: 'rgba(255,255,255,0.58)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 8,
  },
  routineShortcutIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: HOME_PURPLE_LIGHT,
  },
  routineShortcutCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  routineShortcutTitle: {
    color: HOME_TEXT,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '900',
  },
  routineShortcutSubtitle: {
    color: HOME_TEXT_MUTED,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '600',
  },
  cardArrow: {
    color: '#050505',
    fontSize: 27,
    lineHeight: 28,
    fontWeight: '400',
  },
  yourPlanCard: {
    minHeight: 134,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(228,216,255,0.74)',
    backgroundColor: HOME_SURFACE,
    paddingHorizontal: 16,
    paddingVertical: 15,
    flexDirection: 'row',
    gap: 10,
    shadowColor: HOME_SHADOW,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.22,
    shadowRadius: 28,
    elevation: 8,
  },
  yourPlanMain: {
    flex: 1,
    minWidth: 0,
  },
  yourPlanEyebrow: {
    color: HOME_PURPLE_DARK,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    letterSpacing: 1.8,
    marginBottom: 7,
  },
  yourPlanTitle: {
    color: HOME_TEXT,
    fontSize: 19,
    lineHeight: 23,
    fontWeight: '800',
  },
  yourPlanWeek: {
    color: HOME_TEXT_MUTED,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    marginTop: 9,
  },
  yourPlanProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 'auto',
  },
  yourPlanProgressLabel: {
    color: HOME_TEXT_MUTED,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '500',
  },
  yourPlanProgressTrack: {
    flex: 1,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#ECEEF5',
    overflow: 'hidden',
  },
  yourPlanProgressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: HOME_PURPLE,
  },
  yourPlanProgressPercent: {
    color: HOME_PURPLE_DARK,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    minWidth: 36,
    textAlign: 'right',
  },
  yourPlanSide: {
    width: 108,
    alignItems: 'stretch',
    justifyContent: 'space-between',
  },
  yourPlanChart: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    gap: 6,
    paddingRight: 5,
  },
  yourPlanChartBar: {
    width: 15,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    backgroundColor: HOME_PURPLE,
  },
  viewPlanButton: {
    minHeight: 38,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#A975FF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
    paddingLeft: 12,
    paddingRight: 6,
  },
  viewPlanButtonText: {
    color: HOME_PURPLE_DARK,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  myRoutineSection: {
    gap: 10,
    marginTop: 0,
  },
  myRoutineLabel: {
    color: HOME_PURPLE,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '600',
  },
  myRoutineCard: {
    minHeight: 154,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: HOME_BORDER,
    backgroundColor: HOME_SURFACE,
    paddingHorizontal: 17,
    paddingTop: 17,
    paddingBottom: 16,
    gap: 17,
    shadowColor: HOME_SHADOW,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 5,
  },
  myRoutineTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 13,
  },
  myRoutineInitialTile: {
    width: 54,
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: HOME_PURPLE_LIGHT,
  },
  myRoutineInitial: {
    color: HOME_PURPLE_DARK,
    fontSize: 26,
    lineHeight: 30,
    fontWeight: '900',
  },
  myRoutineCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  myRoutineTitle: {
    color: '#050505',
    fontSize: 20.5,
    lineHeight: 25,
    fontWeight: '900',
  },
  myRoutineDescription: {
    color: HOME_TEXT_MUTED,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '600',
  },
  myRoutineMenu: {
    color: '#050505',
    fontSize: 25,
    lineHeight: 25,
    fontWeight: '900',
    marginTop: -6,
  },
  myRoutineBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: 'auto',
  },
  routineInfoPill: {
    flexGrow: 0,
    flexShrink: 1,
    minWidth: 82,
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: HOME_SURFACE_SOFT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
  },
  routineInfoPillWide: {
    flexBasis: 104,
  },
  routineInfoPillCompact: {
    flexBasis: 86,
  },
  routineInfoText: {
    color: HOME_TEXT_MUTED,
    flexShrink: 1,
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '700',
  },
  startRoutineButton: {
    width: 86,
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: HOME_PURPLE,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  startRoutineButtonText: {
    width: '100%',
    color: HOME_SURFACE,
    fontSize: 13.5,
    lineHeight: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  quickAccessSection: {
    gap: 10,
  },
  quickAccessGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  quickAccessCard: {
    flex: 1,
    minHeight: 58,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: HOME_BORDER,
    backgroundColor: 'rgba(255,255,255,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: HOME_SHADOW,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.10,
    shadowRadius: 18,
    elevation: 4,
  },
  quickAccessText: {
    color: HOME_TEXT,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  recentSessionsSection: {
    gap: 9,
    marginTop: 2,
  },
  recentSessionsList: {
    gap: 12,
  },
  recentSessionCard: {
    minHeight: 126,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: HOME_BORDER,
    backgroundColor: HOME_SURFACE,
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 11,
    shadowColor: HOME_SHADOW,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 3,
  },
  recentSessionCardGreen: {
    borderColor: '#BBF7D0',
    backgroundColor: '#FBFFFC',
  },
  recentSessionCardPurple: {
    borderColor: HOME_BORDER,
    backgroundColor: '#FFFFFF',
  },
  recentSessionTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  recentSessionIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: HOME_PURPLE_LIGHT,
  },
  recentSessionIconGreen: {
    backgroundColor: '#E8F7EE',
  },
  recentSessionIconPurple: {
    backgroundColor: HOME_PURPLE_LIGHT,
  },
  recentSessionCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  recentSessionTitle: {
    color: HOME_TEXT,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '900',
  },
  recentSessionDate: {
    color: HOME_TEXT_MUTED,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '600',
  },
  recentSessionMetricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recentSessionMetric: {
    flex: 1,
    minHeight: 30,
    borderRadius: 10,
    backgroundColor: HOME_SURFACE_SOFT,
    color: HOME_TEXT,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    textAlign: 'center',
    textAlignVertical: 'center',
    paddingVertical: 8,
    paddingHorizontal: 5,
  },
  recentSessionMetricGreen: {
    backgroundColor: '#E8F7EE',
  },
  recentSessionMetricPurple: {
    backgroundColor: HOME_SURFACE_SOFT,
  },
  recentSessionPreview: {
    color: HOME_TEXT_MUTED,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  recentSessionNoteRow: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    backgroundColor: '#F0FDF4',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  recentSessionNoteRowGreen: {
    borderColor: '#BBF7D0',
    backgroundColor: '#F0FDF4',
  },
  recentSessionNoteRowPurple: {
    borderColor: HOME_BORDER,
    backgroundColor: HOME_PURPLE_LIGHT,
  },
  recentSessionNoteText: {
    flex: 1,
    color: HOME_TEXT,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
  },
  recentSessionEmptyCard: {
    minHeight: 74,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: HOME_BORDER,
    backgroundColor: HOME_SURFACE,
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  bottomSafeFade: {
    height: 16,
  },
});
