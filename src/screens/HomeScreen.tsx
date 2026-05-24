import React, { useMemo, useState } from 'react';
import { ImageBackground, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { HomeUpcomingSessionSummary } from '../components/HomeStreakCard';
import { GymlogIcon } from '../components/GymlogIcon';
import { pluralize } from '../lib/format';
import { HomeStreakSummary } from '../lib/dashboard';
import { getCustomTemplatePresentation } from '../lib/templatePresentation';
import { colors, spacing } from '../theme';

const HOME_WORKOUT_HERO_IMAGE = require('../../assets/fitness/selected/step7-preview-male-mass.png');
const DAILY_TIP_IMAGE = require('../../assets/fitness/selected/endurance-cardio-goal-card.png');
const WEEKLY_OVERVIEW_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEKLY_OVERVIEW_CARD_HEIGHT = 124;
const PROGRESS_SUMMARY_CARD_HEIGHT = 178;
const HOME_CARD_BACKGROUND = '#17162F';
const HOME_CARD_BACKGROUND_DEEP = '#121127';
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
  title: string;
  subtitle: string;
  sessionsPerWeek: string;
  weeklyMinutes: string;
  nextSession: {
    label: string;
    title: string;
    duration: string;
    exercises: Array<{
      name: string;
      setsLabel: string;
    }>;
    hiddenExerciseCount: number;
  };
}

interface HomeScreenProps {
  hasNoProgramState?: boolean;
  profileName?: string | null;
  activePlan?: HomePlanCard | null;
  streak: HomeStreakSummary;
  quickStats: HomeQuickStat[];
  weeklySnapshot: WeeklySnapshotItem[];
  upcomingSessions: HomeUpcomingSessionSummary[];
  customTemplates?: HomeTemplateItem[];
  onStartActivePlan?: () => void;
  onOpenActivePlan?: () => void;
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

function buildFallbackPreviewSessions(
  activePlan: HomePlanCard,
  trainingDayIndexes: number[],
  upcomingSessions: HomeUpcomingSessionSummary[],
) {
  const previewCount = Math.max(3, Math.min(trainingDayIndexes.length || 3, 6));
  const fallbackLabels = trainingDayIndexes.length ? trainingDayIndexes : [0, 2, 4];
  const titleMatch = activePlan.nextSession.title.match(/^(.*?)(?:\s+([A-Z]))$/);
  const titleBase = titleMatch?.[1]?.trim() || activePlan.nextSession.title;

  return Array.from({ length: previewCount }, (_, index) => {
    const existing = upcomingSessions[index];

    if (existing) {
      return existing;
    }

    const letter = String.fromCharCode(65 + index);
    const dayIndex = fallbackLabels[index % fallbackLabels.length];

    return {
      label: WEEKLY_OVERVIEW_DAYS[dayIndex] ?? 'Next',
      title: titleMatch ? `${titleBase} ${letter}` : index === 0 ? activePlan.nextSession.title : `${titleBase} ${letter}`,
      meta: activePlan.nextSession.duration,
    };
  });
}

export function HomeScreen({
  hasNoProgramState = false,
  profileName = null,
  activePlan = null,
  streak,
  upcomingSessions,
  customTemplates = [],
  onStartActivePlan,
  onOpenActivePlan,
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
  const [calendarVisible, setCalendarVisible] = useState(false);
  const greetingName = profileName?.trim() || 'there';
  const trainingDayIndexes = getWeeklyTrainingIndexes(activePlan);
  const todayIndex = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
  const completedTrainingIndexes = trainingDayIndexes
    .filter((index) => index <= todayIndex)
    .slice(0, Math.max(0, streak.sessionsThisWeek));
  const planPreviewSessions = activePlan
    ? buildFallbackPreviewSessions(activePlan, trainingDayIndexes, upcomingSessions)
    : [];
  const weekCalendarDays = useMemo(() => {
    const now = new Date();
    const monday = new Date(now);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(now.getDate() - todayIndex);

    return WEEKLY_OVERVIEW_DAYS.map((day, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);

      return {
        day,
        dateLabel: String(date.getDate()),
        isToday: index === todayIndex,
        isTrainingDay: trainingDayIndexes.includes(index),
        isCompleted: completedTrainingIndexes.includes(index),
      };
    });
  }, [completedTrainingIndexes, todayIndex, trainingDayIndexes]);

  return (
    <>
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

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open training calendar"
        onPress={() => setCalendarVisible(true)}
        style={styles.miniCalendarRow}
      >
        {weekCalendarDays.map((item) => (
          <View key={`mini-${item.day}`} style={styles.miniCalendarDay}>
            <Text style={[styles.miniCalendarDayLabel, item.isToday && styles.miniCalendarDayLabelActive]}>
              {item.day.slice(0, 1)}
            </Text>
            <View
              style={[
                styles.miniCalendarDateBubble,
                item.isTrainingDay && styles.miniCalendarDateBubbleTraining,
                item.isToday && styles.miniCalendarDateBubbleActive,
              ]}
            >
              <Text style={[styles.miniCalendarDateText, item.isTrainingDay && styles.miniCalendarDateTextTraining, item.isToday && styles.miniCalendarDateTextActive]}>
                {item.isCompleted && !item.isToday ? 'ðŸ”¥' : item.dateLabel}
              </Text>
            </View>
          </View>
        ))}
      </Pressable>

      {activePlan ? (
        <View style={styles.activePlanSection}>
          <View style={styles.todayWorkoutCard}>
            <ImageBackground
              source={HOME_WORKOUT_HERO_IMAGE}
              resizeMode="cover"
              style={styles.todayWorkoutBackground}
              imageStyle={styles.todayWorkoutImage}
            >
              <View style={styles.todayWorkoutScrim} />
              <View style={styles.todayWorkoutGreenGlow} />
              <Pressable accessibilityRole="button" accessibilityLabel="Start workout" onPress={onStartActivePlan} style={styles.startWorkoutFloatingButton}>
                <View style={styles.startWorkoutFloatingTriangle} />
              </Pressable>
              <View pointerEvents="none" style={styles.todayWorkoutCtaCopy}>
                <Text style={styles.todayWorkoutCtaEyebrow}>START YOUR</Text>
                <Text style={styles.todayWorkoutCtaTitle}>WORKOUT HERE</Text>
              </View>
            </ImageBackground>
          </View>

          <View style={styles.workoutPlanCard}>
            <View style={styles.workoutPlanHeader}>
              <View style={styles.workoutPlanHeaderCopy}>
                <Text style={styles.todayMissionKicker}>Today's workout</Text>
                <Text style={styles.todayMissionTitle} numberOfLines={1}>{activePlan.nextSession.title}</Text>
                <Text style={styles.todayMissionMeta} numberOfLines={1}>
                  {activePlan.nextSession.duration} - {pluralize(activePlan.nextSession.exercises.length, 'exercise')}
                </Text>
              </View>
              {onOpenActivePlan ? (
                <Pressable onPress={onOpenActivePlan} style={styles.todayMissionDetailsButton}>
                  <Text style={styles.todayMissionDetailsText}>Details</Text>
                </Pressable>
              ) : null}
            </View>

            <View style={styles.workoutPlanDivider} />

            <View style={styles.planPreviewHeader}>
              <View style={styles.planPreviewHeaderCopy}>
                <Text style={styles.planPreviewKicker}>Plan preview</Text>
                <Text style={styles.planPreviewTitle} numberOfLines={1}>{activePlan.title}</Text>
              </View>
              {onOpenActivePlan ? (
                <Pressable onPress={onOpenActivePlan} style={styles.planPreviewButton}>
                  <Text style={styles.planPreviewButtonText}>View plan</Text>
                </Pressable>
              ) : null}
            </View>

            <View style={styles.planPreviewList}>
              {planPreviewSessions.map((session, index) => (
                <View key={`${session.label}:${session.title}:${index}`} style={styles.planPreviewRow}>
                  <View style={styles.planPreviewDayChip}>
                    <Text style={styles.planPreviewDayChipText}>{session.label}</Text>
                  </View>
                  <View style={styles.planPreviewRowCopy}>
                    <Text style={styles.planPreviewRowTitle} numberOfLines={1}>{session.title}</Text>
                    {session.meta ? <Text style={styles.planPreviewRowMeta} numberOfLines={1}>{session.meta}</Text> : null}
                  </View>
                </View>
              ))}
            </View>
          </View>
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
    <Modal transparent visible={calendarVisible} animationType="fade" onRequestClose={() => setCalendarVisible(false)}>
      <Pressable style={styles.calendarModalBackdrop} onPress={() => setCalendarVisible(false)}>
        <Pressable style={styles.calendarSheet}>
          <View style={styles.calendarSheetHeader}>
            <View>
              <Text style={styles.calendarSheetKicker}>Training calendar</Text>
              <Text style={styles.calendarSheetTitle}>This week</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close calendar" onPress={() => setCalendarVisible(false)} style={styles.calendarCloseButton}>
              <Text style={styles.calendarCloseText}>Ã—</Text>
            </Pressable>
          </View>

          <View style={styles.calendarLargeGrid}>
            {weekCalendarDays.map((item) => (
              <View
                key={`calendar-${item.day}`}
                style={[
                  styles.calendarLargeDay,
                  item.isTrainingDay && styles.calendarLargeDayTraining,
                  item.isToday && styles.calendarLargeDayToday,
                ]}
              >
                <Text style={[styles.calendarLargeDayLabel, item.isToday && styles.calendarLargeDayLabelToday]}>{item.day}</Text>
                <Text style={[styles.calendarLargeDate, item.isTrainingDay && styles.calendarLargeDateTraining, item.isToday && styles.calendarLargeDateToday]}>
                  {item.isCompleted && !item.isToday ? 'ðŸ”¥' : item.dateLabel}
                </Text>
                <Text style={[styles.calendarLargeStatus, item.isTrainingDay && styles.calendarLargeStatusTraining, item.isToday && styles.calendarLargeStatusToday]}>
                  {item.isToday ? 'Today' : item.isCompleted ? 'Done' : item.isTrainingDay ? 'Train' : 'Recover'}
                </Text>
              </View>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
    gap: spacing.lg,
    backgroundColor: colors.background,
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
  miniCalendarRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginTop: -spacing.xs,
  },
  miniCalendarDay: {
    alignItems: 'center',
    gap: 6,
    minWidth: 34,
  },
  miniCalendarDayLabel: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '800',
  },
  miniCalendarDayLabelActive: {
    color: '#FFFFFF',
  },
  miniCalendarDateBubble: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  miniCalendarDateBubbleActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#C68BFF',
    shadowColor: '#C68BFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.62,
    shadowRadius: 16,
    elevation: 4,
  },
  miniCalendarDateBubbleTraining: {
    borderColor: 'rgba(184,255,106,0.52)',
    backgroundColor: 'rgba(184,255,106,0.10)',
  },
  miniCalendarDateText: {
    color: 'rgba(255,255,255,0.70)',
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '900',
  },
  miniCalendarDateTextTraining: {
    color: '#B8FF6A',
  },
  miniCalendarDateTextActive: {
    color: '#FFFFFF',
  },
  activePlanSection: {
    gap: spacing.md,
  },
  planSummaryRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  planSummaryCopy: {
    flex: 1,
    minWidth: 0,
    gap: 5,
  },
  planSummaryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  planSummaryTitle: {
    flexShrink: 1,
    color: '#FFFFFF',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '900',
  },
  planDetailsButton: {
    minHeight: 30,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.07)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
  },
  planDetailsButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '900',
  },
  sectionKicker: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  todayWorkoutCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(198,139,255,0.34)',
    backgroundColor: HOME_CARD_BACKGROUND_DEEP,
    overflow: 'hidden',
  },
  todayWorkoutBackground: {
    minHeight: 410,
    justifyContent: 'flex-start',
  },
  todayWorkoutImage: {
    opacity: 1,
    transform: [{ translateX: 0 }, { scale: 1 }],
  },
  todayWorkoutScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(7,8,24,0.16)',
  },
  todayWorkoutGreenGlow: {
    position: 'absolute',
    top: -18,
    right: -16,
    width: 178,
    height: 112,
    borderRadius: 999,
    backgroundColor: 'rgba(184,255,106,0.22)',
    shadowColor: '#B8FF6A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.34,
    shadowRadius: 28,
    elevation: 5,
  },
  todayWorkoutViewIconButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.38)',
    backgroundColor: 'rgba(18,17,39,0.74)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#C68BFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.42,
    shadowRadius: 16,
    elevation: 8,
  },
  startWorkoutFloatingButton: {
    position: 'absolute',
    left: 28,
    bottom: 34,
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#B8FF6A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.34)',
    shadowColor: '#B8FF6A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.34,
    shadowRadius: 22,
    elevation: 10,
  },
  startWorkoutFloatingTriangle: {
    width: 0,
    height: 0,
    borderTopWidth: 15,
    borderBottomWidth: 15,
    borderLeftWidth: 22,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: '#06080B',
    marginLeft: 6,
  },
  todayWorkoutCtaCopy: {
    position: 'absolute',
    left: 136,
    right: 10,
    bottom: 48,
  },
  todayWorkoutCtaEyebrow: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 21,
    lineHeight: 25,
    fontWeight: '500',
    letterSpacing: 1.1,
    textShadowColor: 'rgba(0,0,0,0.62)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  todayWorkoutCtaTitle: {
    color: '#B8FF6A',
    fontSize: 21,
    lineHeight: 26,
    fontWeight: '900',
    letterSpacing: 0.7,
    textShadowColor: 'rgba(0,0,0,0.74)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 7,
  },
  workoutPlanCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: HOME_CARD_BORDER,
    backgroundColor: HOME_CARD_BACKGROUND,
    padding: spacing.md,
    gap: spacing.md,
  },
  workoutPlanHeader: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  workoutPlanHeaderCopy: {
    flex: 1,
    minWidth: 0,
    gap: 5,
  },
  workoutPlanDivider: {
    height: 1,
    backgroundColor: 'rgba(198,139,255,0.14)',
  },
  todayMissionKicker: {
    color: '#B8FF6A',
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  todayMissionTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '900',
  },
  todayMissionMeta: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
  },
  todayMissionDetailsButton: {
    minHeight: 38,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.13)',
  },
  todayMissionDetailsText: {
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '900',
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
  calendarModalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(4,3,14,0.72)',
    padding: spacing.lg,
  },
  calendarSheet: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(198,139,255,0.30)',
    backgroundColor: '#17162F',
    padding: spacing.lg,
    gap: spacing.lg,
    shadowColor: '#C68BFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.20,
    shadowRadius: 24,
    elevation: 12,
  },
  calendarSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  calendarSheetKicker: {
    color: '#C68BFF',
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  calendarSheetTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '900',
  },
  calendarCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  calendarCloseText: {
    color: '#FFFFFF',
    fontSize: 24,
    lineHeight: 26,
    fontWeight: '700',
    marginTop: -2,
  },
  calendarLargeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  calendarLargeDay: {
    width: '31.8%',
    minHeight: 94,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.045)',
    padding: 10,
    justifyContent: 'space-between',
  },
  calendarLargeDayTraining: {
    borderColor: 'rgba(184,255,106,0.38)',
    backgroundColor: 'rgba(184,255,106,0.08)',
  },
  calendarLargeDayToday: {
    borderColor: 'rgba(198,139,255,0.82)',
    backgroundColor: 'rgba(124,58,237,0.24)',
    shadowColor: '#C68BFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.36,
    shadowRadius: 18,
    elevation: 8,
  },
  calendarLargeDayLabel: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '900',
  },
  calendarLargeDayLabelToday: {
    color: '#FFFFFF',
  },
  calendarLargeDate: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '900',
  },
  calendarLargeDateTraining: {
    color: '#B8FF6A',
  },
  calendarLargeDateToday: {
    color: '#FFFFFF',
  },
  calendarLargeStatus: {
    color: 'rgba(255,255,255,0.46)',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '800',
  },
  calendarLargeStatusTraining: {
    color: '#B8FF6A',
  },
  calendarLargeStatusToday: {
    color: '#C68BFF',
  },
});
