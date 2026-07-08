import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { GymlogIcon } from '../components/GymlogIcon';
import { getHomeMiniCalendarDays, HomeDaySessionSummary } from '../lib/homeCalendar';
import { spacing } from '../theme';

const HOME_BACKGROUND = '#F7F3FF';
const HOME_SURFACE = '#FFFFFF';
const HOME_TEXT = '#101828';
const HOME_TEXT_MUTED = '#667085';
const HOME_BORDER = '#E4D8FF';
const HOME_SHADOW = '#D8C7FF';
const HOME_PURPLE = '#7C3AED';
const HOME_PURPLE_DARK = '#5B21B6';
const HOME_PURPLE_LIGHT = '#EFE7FF';
const HOME_GREEN = '#16A34A';
interface HomeTemplateItem {
  id: string;
  name: string;
  sessionCount: number;
  exerciseCount: number;
  updatedAt: string;
}

export interface HomeRecentSessionItem {
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
  activePlan?: HomePlanCard | null;
  customTemplates?: HomeTemplateItem[];
  readyTemplateCount?: number;
  onStartActivePlanSession?: (sessionId: string) => void;
  onOpenTemplatesHub: () => void;
  onCreateWorkoutFromExercises: () => void;
  onBrowseReadyPlans: () => void;
}

export function HomeScreen({
  activePlan = null,
  customTemplates = [],
  readyTemplateCount = 0,
  onStartActivePlanSession,
  onOpenTemplatesHub,
  onCreateWorkoutFromExercises,
  onBrowseReadyPlans,
}: HomeScreenProps) {
  const savedRoutineCount = customTemplates.length;
  const topCalendarDays = getHomeMiniCalendarDays().slice(0, 6);
  const trainingDayIndexes = activePlan ? [0, 3].slice(0, Math.min(Number.parseInt(activePlan.sessionsPerWeek, 10) || 2, 2)) : [0, 3];
  const nextPlanSession = activePlan?.nextSession ?? null;
  const nextPlanTitle = nextPlanSession?.title ?? 'Day 1 - Full Body';
  const nextPlanExerciseLine =
    nextPlanSession?.exercises
      .slice(0, 3)
      .map((exercise) => exercise.name)
      .join(' - ') || 'Squat - Push-Up - Row';
  const nextPlanMeta = `${nextPlanSession?.duration ?? '~45 min'} - ${nextPlanSession?.exercises.length ?? 4} ${
    (nextPlanSession?.exercises.length ?? 4) === 1 ? 'exercise' : 'exercises'
  }`;

  return (
    <View style={styles.screenBackground}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text style={styles.greetingTitle}>Welcome back</Text>
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

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Start next plan workout"
          onPress={() => {
            if (nextPlanSession && onStartActivePlanSession) {
              onStartActivePlanSession(nextPlanSession.id);
              return;
            }
            onCreateWorkoutFromExercises();
          }}
          style={[styles.continuePlanCard, styles.fullBleedCard]}
        >
          <View style={styles.continuePlanGlow} />
          <Text style={styles.continuePlanEyebrow}>CONTINUE PLAN</Text>
          <Text style={styles.continuePlanTitle} numberOfLines={1} adjustsFontSizeToFit>
            {nextPlanTitle}
          </Text>
          <Text style={styles.continuePlanExercises} numberOfLines={1}>
            {nextPlanExerciseLine}
          </Text>
          <Text style={styles.continuePlanMeta}>{nextPlanMeta}</Text>
          <View style={styles.continuePlanButton}>
            <Text style={styles.continuePlanButtonText}>Start workout</Text>
            <GymlogIcon name="chevronRight" color={HOME_PURPLE_DARK} size={24} />
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
              <GymlogIcon name="file" color={HOME_PURPLE} size={21} />
            </View>
            <View style={styles.routineShortcutCopy}>
              <Text style={styles.routineShortcutTitle} numberOfLines={1} adjustsFontSizeToFit>
                Templates
              </Text>
              <Text style={styles.routineShortcutSubtitle}>{savedRoutineCount} saved</Text>
            </View>
          </Pressable>

          <Pressable onPress={onBrowseReadyPlans} style={styles.routineShortcutCard}>
            <View style={styles.routineShortcutIcon}>
              <GymlogIcon name="progress" color={HOME_PURPLE} size={21} />
            </View>
            <View style={styles.routineShortcutCopy}>
              <Text style={styles.routineShortcutTitle} numberOfLines={1} adjustsFontSizeToFit>
                Explore
              </Text>
              <Text style={styles.routineShortcutSubtitle}>
                {readyTemplateCount > 0 ? `${readyTemplateCount} plans` : 'Find new plans'}
              </Text>
            </View>
          </Pressable>
        </View>

        <Pressable accessibilityRole="button" accessibilityLabel="Start empty workout" onPress={onCreateWorkoutFromExercises} style={styles.emptyWorkoutRow}>
          <View style={styles.emptyWorkoutIcon}>
            <GymlogIcon name="plus" color={HOME_PURPLE} size={20} />
          </View>
          <Text style={styles.emptyWorkoutTitle}>Empty workout</Text>
          <Text style={styles.emptyWorkoutMeta}>Log freestyle</Text>
        </Pressable>

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
    paddingTop: 24,
    paddingBottom: 132,
    gap: 10,
  },
  fullBleedCard: {
    marginHorizontal: -1,
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
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '800',
    letterSpacing: 0,
  },
  greetingSubtitle: {
    color: HOME_TEXT_MUTED,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
  },
  proBadge: {
    minHeight: 22,
    paddingHorizontal: 11,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: HOME_GREEN,
  },
  proBadgeText: {
    color: HOME_SURFACE,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '800',
  },
  homeCalendarStrip: {
    minHeight: 58,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.42)',
    borderWidth: 1,
    borderColor: 'rgba(228,216,255,0.62)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  homeCalendarItem: {
    minWidth: 39,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  homeCalendarItemToday: {
    minHeight: 36,
    borderRadius: 11,
  },
  homeCalendarDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
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
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '800',
  },
  homeCalendarDayLabelToday: {
    color: HOME_TEXT,
  },
  continuePlanCard: {
    minHeight: 203,
    borderRadius: 18,
    backgroundColor: HOME_PURPLE,
    overflow: 'hidden',
    paddingHorizontal: 18,
    paddingVertical: 20,
    justifyContent: 'center',
    shadowColor: HOME_PURPLE,
    shadowOffset: { width: 0, height: 22 },
    shadowOpacity: 0.24,
    shadowRadius: 30,
    elevation: 12,
  },
  continuePlanGlow: {
    position: 'absolute',
    top: -70,
    right: -58,
    width: 190,
    height: 190,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  continuePlanEyebrow: {
    color: 'rgba(255,255,255,0.74)',
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 13,
  },
  continuePlanTitle: {
    color: HOME_SURFACE,
    fontSize: 25,
    lineHeight: 30,
    fontWeight: '800',
    letterSpacing: 0,
  },
  continuePlanExercises: {
    color: 'rgba(255,255,255,0.84)',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
    marginTop: 9,
  },
  continuePlanMeta: {
    color: 'rgba(255,255,255,0.84)',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
    marginTop: 4,
  },
  continuePlanButton: {
    minHeight: 48,
    borderRadius: 13,
    backgroundColor: HOME_SURFACE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 17,
  },
  continuePlanButtonText: {
    color: HOME_PURPLE_DARK,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
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
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
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
    minHeight: 96,
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
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '800',
  },
  routineShortcutSubtitle: {
    color: HOME_TEXT_MUTED,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '600',
  },
  emptyWorkoutRow: {
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: HOME_BORDER,
    backgroundColor: 'rgba(255,255,255,0.58)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 15,
  },
  emptyWorkoutIcon: {
    width: 23,
    height: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyWorkoutTitle: {
    flex: 1,
    color: HOME_TEXT,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  emptyWorkoutMeta: {
    color: HOME_TEXT_MUTED,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  bottomSafeFade: {
    height: 16,
  },
});
