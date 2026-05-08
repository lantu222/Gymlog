import React from 'react';
import { ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { HomeUpcomingSessionSummary } from '../components/HomeStreakCard';
import { GymlogIcon } from '../components/GymlogIcon';
import { pluralize } from '../lib/format';
import { HomeStreakSummary } from '../lib/dashboard';
import { getCustomTemplatePresentation } from '../lib/templatePresentation';
import { spacing } from '../theme';

const HOME_WORKOUT_HERO_IMAGE = require('../../assets/fitness/selected/step7-preview-male-mass.png');
const DAILY_TIP_IMAGE = require('../../assets/fitness/selected/endurance-cardio-goal-card.png');
const HOME_WORKOUT_COPY_OPTIONS = [
  'Build strength with focused compound work. Keep the session simple and repeatable.',
  'Train the main patterns with clean reps. Leave room to progress next time.',
  'Hit today\'s essentials with steady effort. Finish with confidence and control.',
];
const WEEKLY_OVERVIEW_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEKLY_OVERVIEW_CARD_HEIGHT = 124;
const PROGRESS_SUMMARY_CARD_HEIGHT = Math.round(WEEKLY_OVERVIEW_CARD_HEIGHT * 0.9);
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

function getHomeWorkoutCopy(activePlan: HomePlanCard) {
  const copyIndex = activePlan.nextSession.title.length % HOME_WORKOUT_COPY_OPTIONS.length;
  return HOME_WORKOUT_COPY_OPTIONS[copyIndex];
}

function formatHomePlanTitle(title: string) {
  return title.replace(/^\s*\d+\s*[- ]?\s*day\s+/i, '').trim();
}

function getWeeklyTrainingIndexes(activePlan: HomePlanCard | null) {
  const sessionsPerWeek = Number.parseInt(activePlan?.sessionsPerWeek ?? '0', 10);
  const clampedSessionsPerWeek = Math.max(0, Math.min(7, Number.isFinite(sessionsPerWeek) ? sessionsPerWeek : 0));

  return TRAINING_DAY_PATTERNS[clampedSessionsPerWeek] ?? [];
}

export function HomeScreen({
  hasNoProgramState = false,
  activePlan = null,
  streak,
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
  const homeWorkoutCopy = activePlan ? getHomeWorkoutCopy(activePlan) : '';
  const homePlanTitle = activePlan ? formatHomePlanTitle(activePlan.title) : '';
  const trainingDayIndexes = getWeeklyTrainingIndexes(activePlan);
  const recoveryDaysBuiltIn = Math.max(0, 7 - trainingDayIndexes.length);

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.greetingTitle}>Good morning, Name! 👋</Text>
          <Text style={styles.greetingSubtitle}>
            {hasActivePlan ? 'Consistency today, results tomorrow.' : 'Start with what the week needs next.'}
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

      {activePlan ? (
        <View style={styles.activePlanSection}>
          <View style={styles.planSummaryRow}>
            <View style={styles.planSummaryCopy}>
              <Text style={styles.sectionKicker}>YOUR PLAN</Text>
              <View style={styles.planSummaryTitleRow}>
                <Text style={styles.planSummaryTitle} numberOfLines={1}>{homePlanTitle}</Text>
              </View>
            </View>
            {onOpenActivePlan ? (
              <Pressable onPress={onOpenActivePlan} style={styles.planDetailsButton}>
                <GymlogIcon name="file" color="#FFFFFF" size={13} />
                <Text style={styles.planDetailsButtonText}>Plan details</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.todayWorkoutCard}>
            <ImageBackground
              source={HOME_WORKOUT_HERO_IMAGE}
              resizeMode="cover"
              style={styles.todayWorkoutBackground}
              imageStyle={styles.todayWorkoutImage}
            >
              <View style={styles.todayWorkoutScrim} />
              <View style={styles.todayWorkoutLeftFade} />
              <View style={styles.todayWorkoutGreenGlow} />
              <View style={styles.todayWorkoutMenuButton}>
                <Text style={styles.todayWorkoutMenuText}>...</Text>
              </View>
              <View style={styles.todayWorkoutContent}>
                <Text style={styles.todayWorkoutKicker}>TODAY'S WORKOUT</Text>
                <Text style={styles.todayWorkoutTitle} numberOfLines={1}>{activePlan.nextSession.title}</Text>
                <View style={styles.todayWorkoutMetaRow}>
                  <View style={styles.focusChip}>
                    <Text style={styles.focusChipText}>Upper focus</Text>
                  </View>
                  <View style={styles.durationChip}>
                    <GymlogIcon name="tempo" color="rgba(255,255,255,0.70)" size={14} />
                    <Text style={styles.durationChipText}>{activePlan.nextSession.duration}</Text>
                  </View>
                </View>
                <Text style={styles.todayWorkoutBody} numberOfLines={2}>
                  {homeWorkoutCopy}
                </Text>

                <View style={styles.heroActionStack}>
                  <Pressable onPress={onStartActivePlan} style={styles.startWorkoutButton}>
                    <Text style={styles.startWorkoutButtonText}>Start workout</Text>
                    <View style={styles.startWorkoutArrowTriangle} />
                  </Pressable>
                  {onOpenActivePlan ? (
                    <Pressable onPress={onOpenActivePlan} style={styles.viewWorkoutButton}>
                      <GymlogIcon name="eye" color="#FFFFFF" size={15} />
                      <Text style={styles.viewWorkoutButtonText}>View workout</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            </ImageBackground>
          </View>
        </View>
      ) : null}

      <View style={styles.weeklyOverviewCard}>
        <View style={styles.weeklyOverviewHeader}>
          <Text style={styles.weeklyOverviewTitle}>Weekly overview</Text>
          <Text style={styles.weeklyOverviewMeta}>{recoveryDaysBuiltIn} recovery days built in</Text>
        </View>

        <View style={styles.weeklyOverviewDays}>
          {WEEKLY_OVERVIEW_DAYS.map((day, index) => {
            const isTrainingDay = trainingDayIndexes.includes(index);

            return (
              <View key={day} style={styles.weeklyOverviewDay}>
                <Text style={[styles.weeklyOverviewDayLabel, isTrainingDay && styles.weeklyOverviewDayLabelActive]}>{day}</Text>
                <View style={[styles.weeklyOverviewDayMarker, isTrainingDay && styles.weeklyOverviewDayMarkerActive]}>
                  {isTrainingDay ? <Text style={styles.weeklyOverviewCheck}>✓</Text> : null}
                </View>
                <Text style={[styles.weeklyOverviewDayType, isTrainingDay && styles.weeklyOverviewDayTypeActive]}>
                  {isTrainingDay ? 'Train' : 'Recover'}
                </Text>
              </View>
            );
          })}
        </View>

        <View style={styles.weeklyOverviewLegend}>
          <View style={styles.weeklyOverviewLegendItem}>
            <View style={[styles.weeklyOverviewLegendDot, styles.weeklyOverviewLegendDotActive]} />
            <Text style={styles.weeklyOverviewLegendText}>Training day</Text>
          </View>
          <View style={styles.weeklyOverviewLegendItem}>
            <View style={styles.weeklyOverviewLegendDot} />
            <Text style={styles.weeklyOverviewLegendText}>Recovery day</Text>
          </View>
        </View>
      </View>

      <View style={styles.progressAndTipStack}>
        <View style={styles.progressSummaryCard}>
          <View style={styles.progressSummaryHeader}>
            <Text style={styles.progressSummaryTitle}>Your progress</Text>
            <Pressable onPress={onOpenStreak} style={styles.viewProgressButton}>
              <GymlogIcon name="progress" color="#B8FF6A" size={15} />
              <Text style={styles.viewProgressButtonText}>View progress</Text>
            </Pressable>
          </View>

          <View style={styles.progressStatGrid}>
            <View style={styles.progressStatCard}>
              <View style={styles.progressStatTopRow}>
                <GymlogIcon name="progress" color="#B8FF6A" size={16} />
                <Text style={styles.progressStatLabel} numberOfLines={1}>Workouts completed</Text>
              </View>
              <Text style={styles.progressStatValue}>{streak.sessionsThisWeek}</Text>
              <Text style={styles.progressStatMeta}>This week</Text>
            </View>
            <View style={styles.progressStatCard}>
              <View style={styles.progressStatTopRow}>
                <Text style={styles.progressStatEmojiIcon}>{'\uD83D\uDD25'}</Text>
                <Text style={styles.progressStatLabel} numberOfLines={1}>Current streak</Text>
              </View>
              <Text style={styles.progressStatValue}>{streak.value}</Text>
              <Text style={styles.progressStatMeta}>{streak.label}</Text>
            </View>
            <View style={styles.progressStatCard}>
              <View style={styles.progressStatTopRow}>
                <Text style={styles.progressStatEmojiIcon}>{'\uD83C\uDFC6'}</Text>
                <Text style={styles.progressStatLabel} numberOfLines={1}>Total workouts</Text>
              </View>
              <Text style={styles.progressStatValue}>{streak.sessionsLast30Days}</Text>
              <Text style={styles.progressStatMeta}>30 days</Text>
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
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: '#000000',
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
    gap: spacing.lg,
    backgroundColor: '#000000',
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
    borderColor: 'rgba(255,255,255,0.13)',
    backgroundColor: '#151515',
    overflow: 'hidden',
  },
  todayWorkoutBackground: {
    minHeight: 254,
    justifyContent: 'flex-start',
  },
  todayWorkoutImage: {
    opacity: 1,
    transform: [{ translateX: 78 }, { scale: 1.13 }],
  },
  todayWorkoutScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(21,21,21,0.42)',
  },
  todayWorkoutLeftFade: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: '74%',
    backgroundColor: 'rgba(21,21,21,0.58)',
    borderTopRightRadius: 150,
    borderBottomRightRadius: 150,
  },
  todayWorkoutGreenGlow: {
    position: 'absolute',
    top: -38,
    right: -34,
    width: 170,
    height: 88,
    borderRadius: 90,
    backgroundColor: 'rgba(184,255,106,0.14)',
    shadowColor: '#B8FF6A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.42,
    shadowRadius: 34,
    elevation: 5,
  },
  todayWorkoutMenuButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 34,
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.20)',
    backgroundColor: 'rgba(0,0,0,0.42)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayWorkoutMenuText: {
    color: '#FFFFFF',
    fontSize: 18,
    lineHeight: 18,
    fontWeight: '900',
    marginTop: -7,
  },
  todayWorkoutContent: {
    width: '60%',
    minHeight: 254,
    justifyContent: 'center',
    gap: 9,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  todayWorkoutKicker: {
    color: '#B8FF6A',
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  todayWorkoutTitle: {
    color: '#FFFFFF',
    fontSize: 25,
    lineHeight: 29,
    fontWeight: '900',
  },
  todayWorkoutMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  focusChip: {
    minHeight: 22,
    borderRadius: 999,
    backgroundColor: 'rgba(198,139,255,0.33)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  focusChipText: {
    color: '#D7B8FF',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '900',
  },
  durationChip: {
    minHeight: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  durationChipText: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 10.5,
    lineHeight: 13,
    fontWeight: '800',
  },
  todayWorkoutBody: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: '800',
  },
  heroActionStack: {
    gap: spacing.sm,
    paddingTop: spacing.xs,
    width: '118%',
  },
  startWorkoutButton: {
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: '#B8FF6A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    shadowColor: '#B8FF6A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 3,
  },
  startWorkoutButtonText: {
    color: '#06080B',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '900',
  },
  startWorkoutArrowTriangle: {
    width: 0,
    height: 0,
    borderTopWidth: 5,
    borderBottomWidth: 5,
    borderLeftWidth: 7,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: '#06080B',
    marginRight: 1,
  },
  viewWorkoutButton: {
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: '#151515',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  viewWorkoutButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '900',
  },
  weeklyOverviewCard: {
    height: WEEKLY_OVERVIEW_CARD_HEIGHT,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.13)',
    backgroundColor: '#151515',
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
    gap: 7,
  },
  progressSummaryCard: {
    height: PROGRESS_SUMMARY_CARD_HEIGHT,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.13)',
    backgroundColor: '#151515',
    paddingHorizontal: spacing.sm,
    paddingTop: 7,
    paddingBottom: 12,
    gap: 5,
  },
  progressSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  progressSummaryTitle: {
    color: 'rgba(255,255,255,0.76)',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  viewProgressButton: {
    minHeight: 20,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.07)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 8,
  },
  viewProgressButtonText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    lineHeight: 11,
    fontWeight: '900',
  },
  progressStatGrid: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 5,
  },
  progressStatCard: {
    flex: 1,
    minWidth: 0,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 8,
    paddingTop: 5,
    paddingBottom: 7,
    justifyContent: 'center',
    gap: 3,
  },
  progressStatTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  progressStatLabel: {
    flex: 1,
    color: 'rgba(255,255,255,0.66)',
    fontSize: 8,
    lineHeight: 10,
    fontWeight: '800',
  },
  progressStatEmojiIcon: {
    fontSize: 14,
    lineHeight: 16,
  },
  progressStatValue: {
    color: '#FFFFFF',
    fontSize: 22,
    lineHeight: 24,
    fontWeight: '900',
  },
  progressStatMeta: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 8,
    lineHeight: 9,
    fontWeight: '800',
  },
  dailyTipCard: {
    height: PROGRESS_SUMMARY_CARD_HEIGHT,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(198,139,255,0.46)',
    backgroundColor: '#151515',
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
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: '#151515',
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
