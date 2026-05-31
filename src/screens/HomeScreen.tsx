import React, { useMemo, useState } from 'react';
import { ImageBackground, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { HomeUpcomingSessionSummary } from '../components/HomeStreakCard';
import { GymlogIcon } from '../components/GymlogIcon';
import { pluralize } from '../lib/format';
import { HomeStreakSummary } from '../lib/dashboard';
import { getHomeCarouselCalendarDays, getHomeDayView, HomeDaySessionSummary } from '../lib/homeCalendar';
import { getCustomTemplatePresentation } from '../lib/templatePresentation';
import { colors, spacing } from '../theme';

const HOME_TRAINING_BACKGROUND_IMAGE = require('../../assets/fitness/selected/home-training-background.png');
const HOME_RECOVERY_BACKGROUND_IMAGE = require('../../assets/fitness/selected/home-recovery-background.png');
const DAILY_TIP_IMAGE = require('../../assets/fitness/selected/endurance-cardio-goal-card.png');
const WEEKLY_OVERVIEW_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEKLY_OVERVIEW_CARD_HEIGHT = 124;
const PROGRESS_SUMMARY_CARD_HEIGHT = 178;
const HOME_CARD_BACKGROUND = '#17162F';
const HOME_CARD_BORDER = 'rgba(198,139,255,0.24)';
const TRAINING_DAY_PATTERNS: Record<number, number[]> = {
  1: [0],
  2: [0, 3],
  3: [0, 2, 4],
  4: [0, 1, 3, 5],
  5: [0, 1, 2, 4, 5],
  6: [0, 1, 2, 3, 4, 5],
  7: [0, 1, 2, 3, 4, 5, 6],
};

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

interface HomePlanCard {
  programId: string;
  programType?: 'ready' | 'custom';
  eyebrow: string;
  goalLabel: string;
  title: string;
  subtitle: string;
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
  customTemplates?: HomeTemplateItem[];
  onOpenActivePlan?: () => void;
  onStartActivePlanSession?: (sessionId: string) => void;
  onOpenTemplatesHub: () => void;
  onOpenCustomTemplate: (workoutTemplateId: string) => void;
  onCreateWorkoutFromExercises: () => void;
  onCreateTemplate: () => void;
  onBrowseReadyPlans: () => void;
  onOpenStreak: () => void;
  onOpenAICoach: (prompt: string) => void;
}

function getWeeklyTrainingIndexes(activePlan: HomePlanCard | null) {
  const sessionsPerWeek = Number.parseInt(activePlan?.sessionsPerWeek ?? '0', 10);
  const clampedSessionsPerWeek = Math.max(0, Math.min(7, Number.isFinite(sessionsPerWeek) ? sessionsPerWeek : 0));

  return TRAINING_DAY_PATTERNS[clampedSessionsPerWeek] ?? [];
}

export function HomeScreen({
  hasNoProgramState = false,
  profileName = null,
  activePlan = null,
  streak,
  customTemplates = [],
  onStartActivePlanSession,
  onOpenTemplatesHub,
  onOpenCustomTemplate,
  onCreateWorkoutFromExercises,
  onCreateTemplate,
  onBrowseReadyPlans,
  onOpenStreak,
}: HomeScreenProps) {
  const visibleTemplates = customTemplates.slice(0, 3);
  const hasTemplates = customTemplates.length > 0;
  const hasActivePlan = Boolean(activePlan);
  const [selectedDayStart, setSelectedDayStart] = useState<number | null>(null);
  const { width: screenWidth } = useWindowDimensions();
  const miniCalendarDayWidth = (screenWidth - spacing.lg * 2) / 7;
  const miniCalendarPageWidth = miniCalendarDayWidth * 7;
  const greetingName = profileName?.trim() || 'there';
  const trainingDayIndexes = getWeeklyTrainingIndexes(activePlan);
  const todayIndex = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
  const completedTrainingIndexes = trainingDayIndexes
    .filter((index) => index <= todayIndex)
    .slice(0, Math.max(0, streak.sessionsThisWeek));
  const weekCalendarDays = useMemo(() => {
    return getHomeCarouselCalendarDays(undefined, { daysBefore: 7, daysAfter: 13 }).map((day) => ({
      ...day,
      isTrainingDay: trainingDayIndexes.includes(day.weekdayIndex),
      isCompleted: completedTrainingIndexes.includes(day.weekdayIndex),
    }));
  }, [completedTrainingIndexes, trainingDayIndexes]);
  const selectedCalendarDay =
    weekCalendarDays.find((day) => day.dayStart === selectedDayStart) ??
    weekCalendarDays.find((day) => day.isToday) ??
    weekCalendarDays[0];
  const todayCalendarDay = weekCalendarDays.find((day) => day.isToday) ?? selectedCalendarDay;
  const activePlanSessions = activePlan?.sessions ?? (activePlan ? [activePlan.nextSession] : []);
  const selectedDayView = getHomeDayView(selectedCalendarDay, trainingDayIndexes, activePlanSessions);
  const isRecoveryDay = selectedDayView.kind === 'recovery';
  const homeModeAccent = isRecoveryDay ? '#9DFF4F' : '#A86BFF';
  const homeModeBackground = isRecoveryDay ? HOME_RECOVERY_BACKGROUND_IMAGE : HOME_TRAINING_BACKGROUND_IMAGE;
  const homeModeTitle = isRecoveryDay ? 'RECOVERY' : activePlan?.goalLabel.toUpperCase() ?? 'TRAINING';
  const homeModeSubtitle = isRecoveryDay ? 'REST. REPAIR. COME BACK STRONGER.' : 'FOCUS. LIFT. GET STRONGER.';
  const planExerciseCount = activePlan?.nextSession.exercises.length ?? 0;
  const selectedPlanExercises = selectedDayView.session?.exercises.slice(0, 3) ?? activePlan?.nextSession.exercises.slice(0, 3) ?? [];

  return (
    <>
    <ImageBackground
      source={homeModeBackground}
      resizeMode="cover"
      style={styles.screenBackground}
      imageStyle={styles.screenBackgroundImage}
    >
    <View style={styles.screenBackgroundWash} />
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.greetingTitle}>Welcome back, {greetingName}.</Text>
          <Text style={styles.greetingSubtitle}>
            {hasActivePlan ? "Let's crush today." : 'Start with what the week needs next.'}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <View style={styles.headerActionButton}>
            <GymlogIcon name="bell" color="#FFFFFF" size={18} />
            <View style={styles.notificationDot} />
          </View>
          <View style={styles.headerActionButton}>
            <GymlogIcon name="profile" color="#FFFFFF" size={18} />
          </View>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.miniCalendarScroller}
        contentContainerStyle={styles.miniCalendarRow}
        contentOffset={{ x: miniCalendarPageWidth, y: 0 }}
        snapToInterval={miniCalendarPageWidth}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum
      >
        {weekCalendarDays.map((item) => {
          const selected = item.dayStart === selectedCalendarDay.dayStart;
          const futureTrainingDay = item.isTrainingDay && item.dayStart > todayCalendarDay.dayStart;

          return (
            <Pressable
              key={`mini-${item.dayStart}`}
              accessibilityRole="button"
              accessibilityLabel={`Show ${item.label}`}
              onPress={(event) => {
                event.stopPropagation();
                setSelectedDayStart(item.dayStart);
              }}
              style={[styles.miniCalendarDay, { width: miniCalendarDayWidth }]}
            >
              <View
                style={[
                  styles.miniCalendarDateBubble,
                  styles.miniCalendarDateBubbleEmpty,
                  futureTrainingDay && styles.miniCalendarDateBubbleFutureTraining,
                  selected && styles.miniCalendarDateBubbleActive,
                ]}
              />
              <Text style={[styles.miniCalendarDayLabel, selected && styles.miniCalendarDayLabelActive]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {activePlan ? (
        <View style={styles.activePlanSection}>
          <View style={styles.homeModeHero}>
            <View style={styles.homeModeHeroBackground}>
              <View style={styles.homeModeHeroScrim} />
              <View style={styles.homeModeHeroCopy}>
                <Text style={[styles.homeModeKicker, { color: homeModeAccent }]}>TODAY</Text>
                <Text style={[styles.homeModeTitle, { color: homeModeAccent }]} numberOfLines={1} adjustsFontSizeToFit>
                  {homeModeTitle}
                </Text>
                <Text style={styles.homeModeSubtitle}>{homeModeSubtitle}</Text>
              </View>
            </View>
          </View>

          <View style={styles.homeModeFocusCard}>
            <View style={styles.homeModeFocusTop}>
              <View style={styles.homeModeFocusCopy}>
                <Text style={[styles.homeModeSectionLabel, { color: homeModeAccent }]}>Today's focus</Text>
                <Text style={styles.homeModeFocusText}>
                  {isRecoveryDay
                    ? 'Prioritize recovery to rebuild your body and improve performance.'
                    : 'Maximize strength and performance through heavy compound lifts.'}
                </Text>
              </View>
              <View style={styles.homeModeGoalBlock}>
                <View style={[styles.homeModeGoalIcon, { backgroundColor: isRecoveryDay ? 'rgba(157,255,79,0.13)' : 'rgba(168,107,255,0.22)' }]}>
                  <GymlogIcon name={isRecoveryDay ? 'restDay' : 'strength'} color={homeModeAccent} size={30} />
                </View>
                <View style={styles.homeModeGoalCopy}>
                  <Text style={styles.homeModeGoalLabel}>Primary goal</Text>
                  <Text style={styles.homeModeGoalTitle}>{isRecoveryDay ? 'Improve recovery' : `Increase ${activePlan.goalLabel.toLowerCase()}`}</Text>
                  <Text style={[styles.homeModeGoalAccent, { color: homeModeAccent }]}>{isRecoveryDay ? 'Reduce fatigue' : 'Build power'}</Text>
                </View>
              </View>
            </View>
            <View style={styles.homeModeDivider} />
            <View style={styles.homeModeProgressRow}>
              <View style={styles.homeModeProgressCopy}>
                <Text style={[styles.homeModeSectionLabel, { color: homeModeAccent }]}>
                  {isRecoveryDay ? 'Recovery score' : 'Weekly progress'}
                </Text>
                <Text style={[styles.homeModeProgressValue, { color: homeModeAccent }]}>{isRecoveryDay ? '82%' : '78%'}</Text>
                <Text style={styles.homeModeProgressMeta}>{isRecoveryDay ? 'Great recovery' : 'Overall completion'}</Text>
              </View>
              <View style={styles.homeModeChart}>
                {[38, 50, 64, 52, 60, 78, 68].map((height, index) => (
                  <View key={`home-chart-${index}`} style={styles.homeModeChartColumn}>
                    <View style={[styles.homeModeChartDot, { bottom: height, backgroundColor: homeModeAccent }]} />
                    <View style={[styles.homeModeChartLine, { height, backgroundColor: homeModeAccent }]} />
                    <Text style={styles.homeModeChartLabel}>{WEEKLY_OVERVIEW_DAYS[index]?.toUpperCase().slice(0, 3)}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          <View style={styles.homeModeMetricsCard}>
            {(isRecoveryDay
              ? [
                  { icon: 'recovery' as const, label: 'HRV', value: '68 ms', meta: '+12% from last week' },
                  { icon: 'moon' as const, label: 'Sleep', value: '7h 48m', meta: 'Good quality' },
                  { icon: 'lightning' as const, label: 'Muscle soreness', value: 'Low', meta: 'Optimal' },
                ]
              : [
                  { icon: 'strength' as const, label: 'Volume', value: activePlan.weeklyMinutes, meta: '+8% from last week' },
                  { icon: 'progress' as const, label: 'PR lifts', value: String(Math.max(1, streak.sessionsThisWeek)), meta: 'New personal bests' },
                  { icon: 'tempo' as const, label: 'Sessions', value: `${activePlan.sessionsPerWeek}/wk`, meta: `${pluralize(planExerciseCount, 'exercise')}` },
                ]).map((metric, index) => (
                <View key={metric.label} style={[styles.homeModeMetricItem, index > 0 && styles.homeModeMetricDivider]}>
                  <View style={styles.homeModeMetricIcon}>
                    <GymlogIcon name={metric.icon} color={homeModeAccent} size={17} />
                </View>
                  <Text style={styles.homeModeMetricLabel}>{metric.label}</Text>
                  <Text style={styles.homeModeMetricValue}>{metric.value}</Text>
                  <Text style={[styles.homeModeMetricMeta, { color: homeModeAccent }]} numberOfLines={1}>{metric.meta}</Text>
                </View>
              ))}
          </View>

          {isRecoveryDay ? (
            <View style={styles.homeModeListCard}>
              <Text style={[styles.homeModeSectionLabel, { color: homeModeAccent }]}>Recovery tips</Text>
              {[
                { icon: 'mobility' as const, title: 'Mobility & stretching', body: '10-15 min to improve flexibility' },
                { icon: 'recovery' as const, title: 'Hydration', body: 'Stay hydrated and support recovery' },
                { icon: 'moon' as const, title: 'Sleep focus', body: 'Aim for 7-9 hours of quality sleep' },
              ].map((tip) => (
                <View key={tip.title} style={styles.homeModeListRow}>
                  <View style={styles.homeModeListIcon}>
                    <GymlogIcon name={tip.icon} color={homeModeAccent} size={22} />
                  </View>
                  <View style={styles.homeModeListCopy}>
                    <Text style={styles.homeModeListTitle}>{tip.title}</Text>
                    <Text style={styles.homeModeListBody}>{tip.body}</Text>
                  </View>
                  <Text style={styles.homeModeListArrow}>{'>'}</Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.homeModeListCard}>
              <Text style={[styles.homeModeSectionLabel, { color: homeModeAccent }]}>Today's plan</Text>
              {selectedPlanExercises.map((exercise) => (
                <View key={exercise.name} style={styles.homeModePlanRow}>
                  <View>
                    <Text style={styles.homeModeListTitle}>{exercise.name}</Text>
                    <Text style={styles.homeModeListBody}>{exercise.setsLabel}</Text>
                  </View>
                  <Text style={[styles.homeModePlanMeta, { color: homeModeAccent }]}>1RM</Text>
                </View>
              ))}
              {selectedDayView.session && onStartActivePlanSession ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Start workout"
                  onPress={() => onStartActivePlanSession(selectedDayView.session?.id ?? activePlan.nextSession.id)}
                  style={styles.homeModeStartButton}
                >
                  <Text style={styles.homeModeStartButtonText}>Start Workout</Text>
                  <Text style={styles.homeModeStartButtonArrow}>{'>'}</Text>
                </Pressable>
              ) : null}
            </View>
          )}
          </View>
      ) : null}


      <View style={styles.progressAndTipStack}>
        <View style={styles.progressSummaryCard}>
          <View style={styles.progressSummaryHeader}>
            <Text style={styles.progressSummaryTitle}>At a glance</Text>
            <Pressable onPress={onOpenStreak} style={styles.viewProgressButton}>
              <GymlogIcon name="progress" color="#B8FF6A" size={15} />
              <Text style={styles.viewProgressButtonText}>View all</Text>
            </Pressable>
          </View>

          <View style={styles.progressStatGrid}>
            <View style={styles.progressStatCard}>
              <View style={styles.progressStatTopRow}>
                <Text style={styles.progressStatEmojiIcon}>{'\uD83D\uDC4D'}</Text>
                <Text style={styles.progressStatLabel} numberOfLines={2}>Workouts completed</Text>
              </View>
              <Text style={styles.progressStatValue}>{streak.sessionsThisWeek}</Text>
            </View>
            <View style={styles.progressStatCard}>
              <View style={styles.progressStatTopRow}>
                <Text style={styles.progressStatEmojiIcon}>{'\uD83D\uDD25'}</Text>
                <Text style={styles.progressStatLabel} numberOfLines={2}>Current streak</Text>
              </View>
              <Text style={styles.progressStatValue}>{streak.value}</Text>
            </View>
            <View style={styles.progressStatCard}>
              <View style={styles.progressStatTopRow}>
                <Text style={styles.progressStatEmojiIcon}>{'\uD83C\uDFC6'}</Text>
                <Text style={styles.progressStatLabel} numberOfLines={2}>Total workouts</Text>
              </View>
              <Text style={styles.progressStatValue}>{streak.sessionsLast30Days}</Text>
            </View>
          </View>
        </View>


        <ImageBackground
          source={DAILY_TIP_IMAGE}
          resizeMode="cover"
          style={styles.dailyTipCard}
          imageStyle={styles.dailyTipImage}
        >
          <View style={styles.dailyTipImageScrim} />
          <View style={styles.dailyTipPurpleWashBase} />
          <View style={styles.dailyTipPurpleWashStrong} />
          <View style={styles.dailyTipPurpleWashSoft} />
          <View style={styles.dailyTipContent}>
            <View style={styles.dailyTipIcon}>
              <GymlogIcon name="lightning" color="#FFFFFF" size={17} />
            </View>
            <View style={styles.dailyTipCopy}>
              <Text style={styles.dailyTipTitle}>Daily tip</Text>
              <Text style={styles.dailyTipBody} numberOfLines={3}>
                Focus on quality over quantity. Good reps, better results.
              </Text>
            </View>
          </View>
        </ImageBackground>
      </View>

      {hasTemplates ? (
        <View style={styles.templatesSection}>
          <View style={styles.templatesHeaderRow}>
            <View style={styles.templatesHeaderCopy}>
              <Text style={styles.sectionKicker}>TEMPLATES</Text>
              <Text style={styles.templatesTitle}>Your templates</Text>
              <Text style={styles.templatesSubtitle}>Reusable weekly splits you can run again.</Text>
            </View>
            <Pressable onPress={onOpenTemplatesHub} hitSlop={8}>
              <Text style={styles.templatesHubLink}>See all</Text>
            </Pressable>
          </View>

          <View style={styles.templatesList}>
            {visibleTemplates.map((template) => {
              const presentation = getCustomTemplatePresentation(template);

              return (
                <Pressable key={template.id} onPress={() => onOpenCustomTemplate(template.id)} style={styles.templateCard}>
                  <View style={styles.templateCardVisual}>
                    <Text style={styles.templateCardVisualText}>{presentation.tags[0]?.slice(0, 1) ?? 'T'}</Text>
                  </View>
                  <View style={styles.templateCardCopy}>
                    <View style={styles.templateCardTagRow}>
                      {presentation.tags.map((tag) => (
                        <View key={`${template.id}:${tag}`} style={styles.templateTag}>
                          <Text style={styles.templateTagText}>{tag}</Text>
                        </View>
                      ))}
                    </View>
                    <Text style={styles.templateCardTitle}>{presentation.title}</Text>
                    <Text style={styles.templateCardSubtitle}>{presentation.subtitle}</Text>
                    <Text style={styles.templateCardMeta}>
                      {pluralize(template.sessionCount, 'session')} - {pluralize(template.exerciseCount, 'exercise')}
                    </Text>
                  </View>
                  <Text style={styles.templateCardArrow}>{'>'}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : hasNoProgramState && !activePlan ? (
        <View style={styles.emptyTemplateNote}>
          <Text style={styles.emptyTemplateTitle}>No plan yet</Text>
          <Text style={styles.emptyTemplateBody}>Create your first template or browse ready plans when you want more structure.</Text>
        </View>
      ) : null}

      <View style={styles.quickActionSection}>
        <Text style={styles.quickActionKicker}>Quick actions</Text>
        <View style={styles.quickActionList}>
          <Pressable onPress={onCreateWorkoutFromExercises} style={styles.quickStartCard}>
            <View style={[styles.quickStartIcon, styles.quickStartIconPlay]}>
              <View style={styles.quickStartPlayTriangle} />
            </View>
            <View style={styles.quickStartCopy}>
              <Text style={styles.quickStartTitle}>Start empty workout</Text>
              <Text style={styles.quickStartBody}>Log a custom session from scratch.</Text>
            </View>
            <Text style={styles.quickStartArrow}>{'>'}</Text>
          </Pressable>

          <Pressable onPress={onBrowseReadyPlans} style={styles.quickStartCard}>
            <View style={[styles.quickStartIcon, styles.quickStartIconPlus]}>
              <Text style={styles.quickStartIconPlusText}>+</Text>
            </View>
            <View style={styles.quickStartCopy}>
              <Text style={styles.quickStartTitle}>Explore workout plans</Text>
              <Text style={styles.quickStartBody}>Browse structured programs and templates.</Text>
            </View>
            <Text style={styles.quickStartArrow}>{'>'}</Text>
          </Pressable>

          <Pressable onPress={onCreateTemplate} style={styles.quickStartCard}>
            <View style={[styles.quickStartIcon, styles.quickStartFileIcon]}>
              <View style={styles.quickStartFileFold} />
            </View>
            <View style={styles.quickStartCopy}>
              <Text style={styles.quickStartTitle}>Build your own split</Text>
              <Text style={styles.quickStartBody}>Create and save your own weekly structure.</Text>
            </View>
            <Text style={styles.quickStartArrow}>{'>'}</Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.bottomSafeFade}>
        <View style={styles.bottomSafeFadeLine} />
        <View style={styles.bottomSafeFadeSoft} />
      </View>
    </ScrollView>
    </ImageBackground>
    </>
  );
}

const styles = StyleSheet.create({
  screenBackground: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screenBackgroundImage: {
    opacity: 1,
  },
  screenBackgroundWash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(4,3,13,0.26)',
  },
  scrollView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
    gap: spacing.lg,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  greetingTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '900',
  },
  greetingSubtitle: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerActionButton: {
    width: 42,
    height: 42,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#B8FF6A',
    borderWidth: 1,
    borderColor: '#000000',
  },
  miniCalendarScroller: {
    minHeight: 52,
    marginTop: -spacing.xs,
  },
  miniCalendarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
  },
  miniCalendarDay: {
    alignItems: 'center',
    gap: 6,
  },
  miniCalendarDayLabel: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  miniCalendarDayLabelActive: {
    color: '#FFFFFF',
  },
  miniCalendarDateBubble: {
    width: 24,
    height: 24,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  miniCalendarDateBubbleEmpty: {
    backgroundColor: 'transparent',
    borderColor: 'rgba(255,255,255,0.86)',
  },
  miniCalendarDateBubbleActive: {
    borderColor: '#C68BFF',
    backgroundColor: '#7C3AED',
    shadowColor: '#C68BFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.54,
    shadowRadius: 12,
    elevation: 4,
  },
  miniCalendarDateBubbleFutureTraining: {
    borderColor: '#B8FF6A',
    backgroundColor: '#B8FF6A',
  },
  activePlanSection: {
    gap: spacing.md,
  },
  homeModeHero: {
    marginHorizontal: -spacing.lg,
    marginTop: -spacing.md,
    overflow: 'hidden',
  },
  homeModeHeroBackground: {
    minHeight: 430,
    justifyContent: 'flex-start',
  },
  homeModeHeroScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2,2,8,0.04)',
  },
  homeModeHeroCopy: {
    paddingHorizontal: spacing.xl,
    paddingTop: 64,
    gap: 8,
  },
  homeModeKicker: {
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '900',
    fontStyle: 'italic',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  homeModeTitle: {
    fontSize: 72,
    lineHeight: 78,
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: 0,
    textTransform: 'uppercase',
    textShadowColor: 'rgba(0,0,0,0.42)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  homeModeSubtitle: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '900',
    fontStyle: 'italic',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  homeModeFocusCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(198,139,255,0.26)',
    backgroundColor: 'rgba(11,11,27,0.92)',
    padding: spacing.lg,
    gap: spacing.md,
  },
  homeModeFocusTop: {
    flexDirection: 'row',
    gap: spacing.lg,
    alignItems: 'center',
  },
  homeModeFocusCopy: {
    flex: 1,
    gap: 10,
  },
  homeModeSectionLabel: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  homeModeFocusText: {
    color: '#FFFFFF',
    fontSize: 21,
    lineHeight: 29,
    fontWeight: '700',
  },
  homeModeGoalBlock: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.12)',
    paddingLeft: spacing.lg,
  },
  homeModeGoalIcon: {
    width: 56,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeModeGoalCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  homeModeGoalLabel: {
    color: 'rgba(255,255,255,0.50)',
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  homeModeGoalTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '900',
  },
  homeModeGoalAccent: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '900',
  },
  homeModeDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  homeModeProgressRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.lg,
  },
  homeModeProgressCopy: {
    width: 118,
    gap: 4,
  },
  homeModeProgressValue: {
    fontSize: 48,
    lineHeight: 54,
    fontWeight: '900',
  },
  homeModeProgressMeta: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  homeModeChart: {
    flex: 1,
    height: 98,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  homeModeChartColumn: {
    width: 25,
    height: 92,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  homeModeChartLine: {
    width: 2,
    opacity: 0.22,
    borderRadius: 999,
  },
  homeModeChartDot: {
    position: 'absolute',
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  homeModeChartLabel: {
    color: 'rgba(255,255,255,0.50)',
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '900',
    marginTop: 8,
  },
  homeModeMetricsCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(198,139,255,0.18)',
    backgroundColor: 'rgba(11,11,27,0.92)',
    flexDirection: 'row',
    paddingVertical: spacing.md,
  },
  homeModeMetricItem: {
    flex: 1,
    paddingHorizontal: spacing.md,
    gap: 6,
  },
  homeModeMetricDivider: {
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.12)',
  },
  homeModeMetricIcon: {
    width: 30,
    height: 30,
    borderRadius: 999,
    backgroundColor: 'rgba(124,58,237,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeModeMetricLabel: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  homeModeMetricValue: {
    color: '#FFFFFF',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '900',
  },
  homeModeMetricMeta: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '800',
  },
  homeModeListCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(198,139,255,0.26)',
    backgroundColor: 'rgba(11,11,27,0.92)',
    padding: spacing.lg,
    gap: spacing.md,
  },
  homeModeListRow: {
    minHeight: 70,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.045)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  homeModeListIcon: {
    width: 46,
    height: 46,
    borderRadius: 10,
    backgroundColor: 'rgba(157,255,79,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeModeListCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  homeModeListTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '900',
  },
  homeModeListBody: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
  },
  homeModeListArrow: {
    color: 'rgba(255,255,255,0.56)',
    fontSize: 26,
    lineHeight: 28,
    fontWeight: '300',
  },
  homeModePlanRow: {
    minHeight: 72,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    backgroundColor: 'rgba(255,255,255,0.045)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  homeModePlanMeta: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
  },
  homeModeStartButton: {
    minHeight: 58,
    borderRadius: 18,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
    shadowColor: '#A86BFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.36,
    shadowRadius: 16,
    elevation: 8,
  },
  homeModeStartButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '900',
  },
  homeModeStartButtonArrow: {
    color: '#FFFFFF',
    fontSize: 28,
    lineHeight: 30,
    fontWeight: '300',
  },
  sectionKicker: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  workoutPlanCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: HOME_CARD_BORDER,
    backgroundColor: HOME_CARD_BACKGROUND,
    padding: spacing.md,
    gap: spacing.md,
  },
  planPreviewCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: HOME_CARD_BORDER,
    backgroundColor: HOME_CARD_BACKGROUND,
    padding: spacing.md,
    gap: spacing.sm,
  },
  planPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  planPreviewHeaderCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  planPreviewKicker: {
    color: 'rgba(255,255,255,0.56)',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  planPreviewTitle: {
    color: '#FFFFFF',
    fontSize: 19,
    lineHeight: 23,
    fontWeight: '900',
  },
  planPreviewButton: {
    minHeight: 30,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    backgroundColor: 'rgba(198,139,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(198,139,255,0.28)',
  },
  planPreviewButtonText: {
    color: '#C68BFF',
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '900',
  },
  planPreviewList: {
    gap: 9,
  },
  planPreviewRow: {
    minHeight: 50,
    borderRadius: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  planPreviewDayChip: {
    minWidth: 46,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(184,255,106,0.12)',
  },
  planPreviewDayChipText: {
    color: '#B8FF6A',
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '900',
  },
  planPreviewRowCopy: {
    flex: 1,
    minWidth: 0,
  },
  planPreviewRowTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 17,
    fontWeight: '900',
  },
  planPreviewRowMeta: {
    color: 'rgba(255,255,255,0.54)',
    fontSize: 11.5,
    lineHeight: 14,
    fontWeight: '700',
  },
  weeklyOverviewCard: {
    height: WEEKLY_OVERVIEW_CARD_HEIGHT,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: HOME_CARD_BORDER,
    backgroundColor: HOME_CARD_BACKGROUND,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  weeklyOverviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  weeklyOverviewTitle: {
    color: 'rgba(255,255,255,0.76)',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  weeklyOverviewMeta: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '800',
  },
  weeklyOverviewDays: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 5,
  },
  weeklyOverviewDay: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: 4,
  },
  weeklyOverviewDayLabel: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '800',
  },
  weeklyOverviewDayLabelActive: {
    color: '#B8FF6A',
  },
  weeklyOverviewDayMarker: {
    width: 25,
    height: 25,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weeklyOverviewDayMarkerActive: {
    backgroundColor: '#B8FF6A',
    borderColor: '#B8FF6A',
  },
  weeklyOverviewCheck: {
    color: '#050505',
    fontSize: 15,
    lineHeight: 17,
    fontWeight: '900',
  },
  weeklyOverviewDayType: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '800',
  },
  weeklyOverviewDayTypeActive: {
    color: '#B8FF6A',
  },
  weeklyOverviewLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginTop: -1,
  },
  weeklyOverviewLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  weeklyOverviewLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  weeklyOverviewLegendDotActive: {
    backgroundColor: '#B8FF6A',
  },
  weeklyOverviewLegendText: {
    color: 'rgba(255,255,255,0.66)',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
  },
  progressAndTipStack: {
    gap: spacing.md,
  },
  progressSummaryCard: {
    height: PROGRESS_SUMMARY_CARD_HEIGHT,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: HOME_CARD_BORDER,
    backgroundColor: HOME_CARD_BACKGROUND,
    paddingHorizontal: spacing.md,
    paddingTop: 11,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  progressSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  progressSummaryTitle: {
    color: 'rgba(255,255,255,0.76)',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  viewProgressButton: {
    minHeight: 28,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.07)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
  },
  viewProgressButtonText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    lineHeight: 13,
    fontWeight: '900',
  },
  progressStatGrid: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.sm,
  },
  progressStatCard: {
    flex: 1,
    minWidth: 0,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 10,
    paddingTop: 13,
    paddingBottom: 13,
    justifyContent: 'center',
    gap: 9,
  },
  progressStatTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
  },
  progressStatLabel: {
    flex: 1,
    color: 'rgba(255,255,255,0.66)',
    fontSize: 9.5,
    lineHeight: 12,
    fontWeight: '800',
  },
  progressStatEmojiIcon: {
    fontSize: 21,
    lineHeight: 23,
  },
  progressStatValue: {
    color: '#FFFFFF',
    fontSize: 30,
    lineHeight: 33,
    fontWeight: '900',
  },
  dailyTipCard: {
    height: PROGRESS_SUMMARY_CARD_HEIGHT,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(198,139,255,0.46)',
    backgroundColor: HOME_CARD_BACKGROUND,
    overflow: 'hidden',
  },
  dailyTipImage: {
    opacity: 1,
    transform: [{ translateX: 34 }, { scale: 1.22 }],
  },
  dailyTipImageScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  dailyTipPurpleWashBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(54,28,88,0.18)',
  },
  dailyTipPurpleWashStrong: {
    position: 'absolute',
    top: -62,
    bottom: -62,
    left: -118,
    width: '108%',
    borderRadius: 999,
    backgroundColor: 'rgba(54,28,88,0.34)',
  },
  dailyTipPurpleWashSoft: {
    position: 'absolute',
    top: -74,
    bottom: -74,
    left: -12,
    width: '116%',
    borderRadius: 999,
    backgroundColor: 'rgba(54,28,88,0.10)',
  },
  dailyTipContent: {
    minHeight: PROGRESS_SUMMARY_CARD_HEIGHT,
    width: '68%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  dailyTipIcon: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: 'rgba(151,101,214,0.70)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dailyTipCopy: {
    flex: 1,
    minWidth: 0,
    gap: 5,
  },
  dailyTipTitle: {
    color: '#C68BFF',
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  dailyTipBody: {
    color: 'rgba(255,255,255,0.84)',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  templatesSection: {
    gap: spacing.md,
  },
  templatesHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  templatesHeaderCopy: {
    flex: 1,
    gap: 3,
  },
  templatesTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '900',
  },
  templatesSubtitle: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  templatesHubLink: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 12,
    fontWeight: '800',
  },
  templatesList: {
    gap: spacing.sm,
  },
  templateCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  templateCardVisual: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(184,255,106,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(184,255,106,0.22)',
  },
  templateCardVisualText: {
    color: '#B8FF6A',
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '900',
  },
  templateCardCopy: {
    flex: 1,
    gap: 4,
  },
  templateCardTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  templateTag: {
    minHeight: 22,
    paddingHorizontal: 8,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  templateTagText: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  templateCardTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '900',
  },
  templateCardSubtitle: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  templateCardMeta: {
    color: 'rgba(255,255,255,0.50)',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  templateCardArrow: {
    color: 'rgba(255,255,255,0.40)',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '900',
  },
  emptyTemplateNote: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: spacing.md,
    gap: 3,
  },
  emptyTemplateTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
  },
  emptyTemplateBody: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  quickActionSection: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: HOME_CARD_BORDER,
    backgroundColor: HOME_CARD_BACKGROUND,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  quickActionKicker: {
    color: 'rgba(255,255,255,0.48)',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
    paddingHorizontal: spacing.xs,
    paddingTop: 2,
  },
  quickActionList: {
    gap: 4,
  },
  quickStartCard: {
    minHeight: 58,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    backgroundColor: 'rgba(255,255,255,0.035)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  quickStartIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickStartIconPlay: {
    backgroundColor: 'rgba(184,255,106,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(184,255,106,0.42)',
  },
  quickStartPlayTriangle: {
    width: 0,
    height: 0,
    borderTopWidth: 7,
    borderBottomWidth: 7,
    borderLeftWidth: 11,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: '#B8FF6A',
    marginLeft: 3,
  },
  quickStartIconPlus: {
    backgroundColor: 'rgba(198,139,255,0.20)',
    borderWidth: 1,
    borderColor: 'rgba(198,139,255,0.42)',
  },
  quickStartIconPlusText: {
    color: '#C68BFF',
    fontSize: 20,
    lineHeight: 20,
    fontWeight: '900',
    marginTop: -1,
  },
  quickStartFileIcon: {
    backgroundColor: 'rgba(242,183,5,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(242,183,5,0.42)',
  },
  quickStartFileFold: {
    width: 15,
    height: 16,
    borderRadius: 3,
    borderWidth: 2,
    borderColor: '#F2B705',
    borderTopRightRadius: 7,
  },
  quickStartCopy: {
    flex: 1,
    gap: 2,
  },
  quickStartTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '900',
  },
  quickStartBody: {
    color: 'rgba(255,255,255,0.56)',
    fontSize: 10.5,
    lineHeight: 14,
    fontWeight: '700',
  },
  quickStartArrow: {
    color: 'rgba(255,255,255,0.48)',
    fontSize: 18,
    lineHeight: 20,
    fontWeight: '900',
  },
  bottomSafeFade: {
    height: 16,
    marginTop: -spacing.sm,
    overflow: 'hidden',
  },
  bottomSafeFadeLine: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  bottomSafeFadeSoft: {
    height: 15,
    backgroundColor: 'rgba(21,21,21,0.18)',
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
});
