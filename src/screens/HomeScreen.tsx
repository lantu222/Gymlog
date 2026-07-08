import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

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

// Placeholder premium pitch — copy and purchase flow to be finalized later.
const PREMIUM_FEATURES = [
  'AI Coach with unlimited conversations',
  'Advanced progress analytics',
  'Unlimited custom plans & templates',
  'Early access to new features',
];

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
  const [premiumVisible, setPremiumVisible] = useState(false);
  const savedRoutineCount = customTemplates.length;
  const topCalendarDays = getHomeMiniCalendarDays().slice(0, 6);
  const trainingDayIndexes = activePlan ? [0, 3].slice(0, Math.min(Number.parseInt(activePlan.sessionsPerWeek, 10) || 2, 2)) : [0, 3];
  const nextPlanSession = activePlan?.nextSession ?? null;
  // Hero card leads with the plan's own name; the session ("Strength A") is
  // demoted to the "Next:" line below it.
  const planCardTitle = activePlan?.title ?? 'Workout plan';
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
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open premium subscription"
            onPress={() => setPremiumVisible(true)}
            hitSlop={8}
            style={styles.proBadge}
          >
            <Text style={styles.proBadgeText}>PRO</Text>
          </Pressable>
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
          <Text style={styles.continuePlanEyebrow}>CONTINUE PLAN</Text>
          <Text style={styles.continuePlanTitle} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.7}>
            {planCardTitle}
          </Text>
          <Text style={styles.continuePlanNextSession} numberOfLines={1}>
            Next: {nextPlanTitle}
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

      <Modal visible={premiumVisible} transparent animationType="fade" onRequestClose={() => setPremiumVisible(false)}>
        <View style={styles.premiumOverlay}>
          <View style={styles.premiumCard}>
            <View style={styles.premiumBadge}>
              <Text style={styles.premiumBadgeText}>GAINER PRO</Text>
            </View>
            <Text style={styles.premiumTitle}>Premium subscription</Text>
            <Text style={styles.premiumSubtitle}>Unlock everything Gainer has to offer.</Text>
            {PREMIUM_FEATURES.map((feature) => (
              <View key={feature} style={styles.premiumFeatureRow}>
                <View style={styles.premiumFeatureDot} />
                <Text style={styles.premiumFeatureText}>{feature}</Text>
              </View>
            ))}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Premium coming soon"
              onPress={() => setPremiumVisible(false)}
              style={styles.premiumPrimaryButton}
            >
              <Text style={styles.premiumPrimaryButtonText}>Coming soon</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => setPremiumVisible(false)} hitSlop={8} style={styles.premiumDismiss}>
              <Text style={styles.premiumDismissText}>Not now</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
    minHeight: 30,
    paddingHorizontal: 16,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: HOME_GREEN,
  },
  proBadgeText: {
    color: HOME_SURFACE,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  premiumOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(16, 24, 40, 0.45)',
  },
  premiumCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: HOME_BORDER,
    backgroundColor: HOME_SURFACE,
    padding: 24,
    gap: 10,
    shadowColor: HOME_SHADOW,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 8,
  },
  premiumBadge: {
    alignSelf: 'flex-start',
    minHeight: 24,
    paddingHorizontal: 12,
    borderRadius: 999,
    justifyContent: 'center',
    backgroundColor: HOME_PURPLE_LIGHT,
  },
  premiumBadgeText: {
    color: HOME_PURPLE_DARK,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  premiumTitle: {
    color: HOME_TEXT,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  premiumSubtitle: {
    color: HOME_TEXT_MUTED,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '600',
    marginBottom: 6,
  },
  premiumFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  premiumFeatureDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: HOME_PURPLE,
  },
  premiumFeatureText: {
    flex: 1,
    color: HOME_TEXT,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700',
  },
  premiumPrimaryButton: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: HOME_PURPLE,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  premiumPrimaryButtonText: {
    color: HOME_SURFACE,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
  },
  premiumDismiss: {
    alignSelf: 'center',
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  premiumDismissText: {
    color: HOME_TEXT_MUTED,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
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
    minHeight: 288,
    borderRadius: 18,
    backgroundColor: HOME_PURPLE_DARK,
    overflow: 'hidden',
    paddingHorizontal: 20,
    paddingVertical: 24,
    justifyContent: 'center',
    shadowColor: HOME_PURPLE_DARK,
    shadowOffset: { width: 0, height: 22 },
    shadowOpacity: 0.24,
    shadowRadius: 30,
    elevation: 12,
  },
  continuePlanEyebrow: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 12,
  },
  continuePlanTitle: {
    color: HOME_SURFACE,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  continuePlanNextSession: {
    color: HOME_SURFACE,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800',
    marginTop: 12,
  },
  continuePlanExercises: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    marginTop: 6,
  },
  continuePlanMeta: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
    marginTop: 5,
  },
  continuePlanButton: {
    minHeight: 54,
    borderRadius: 14,
    backgroundColor: HOME_SURFACE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 20,
  },
  continuePlanButtonText: {
    color: HOME_PURPLE_DARK,
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '800',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    // Breathing room below the (now much taller) continue-plan hero.
    marginTop: 10,
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
