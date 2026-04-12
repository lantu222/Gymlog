import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { HomeStreakCard, HomeUpcomingSessionSummary } from '../components/HomeStreakCard';
import { ResumeWorkoutCard, ResumeWorkoutCardData } from '../components/ResumeWorkoutCard';
import { HomeStreakSummary } from '../lib/dashboard';
import { HomeHeroVisual } from '../lib/homeVisuals';
import { layout, spacing } from '../theme';

interface HomeQuickStat {
  value: string;
  label: string;
}

interface HomeScreenProps {
  heroVisual: HomeHeroVisual;
  primaryActionCard: ResumeWorkoutCardData;
  hasNoProgramState?: boolean;
  streak: HomeStreakSummary;
  quickStats: HomeQuickStat[];
  upcomingSessions: HomeUpcomingSessionSummary[];
  aiPromptSuggestions?: string[];
  onPrimaryAction: () => void;
  onOpenPlanOptions: () => void;
  onCreateWorkoutFromExercises: () => void;
  onOpenStreak: () => void;
  onOpenAICoach: (prompt: string) => void;
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) {
    return 'Good morning';
  }

  if (hour < 18) {
    return 'Good afternoon';
  }

  return 'Good evening';
}

export function HomeScreen({
  heroVisual,
  primaryActionCard,
  hasNoProgramState = false,
  streak,
  upcomingSessions,
  onPrimaryAction,
  onOpenPlanOptions,
  onCreateWorkoutFromExercises,
  onOpenStreak,
}: HomeScreenProps) {
  const greeting = useMemo(() => getGreeting(), []);
  const comingUpSubtitle = upcomingSessions.length
    ? `${upcomingSessions.length} sessions lined up`
    : 'No sessions lined up yet';
  const comingUpPill = streak.sessionsThisWeek > 0 ? `${streak.sessionsThisWeek} done` : 'Week ready';

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>{greeting}</Text>
        <Text style={styles.title}>Training</Text>
        <Text style={styles.subtitle}>Start with what the week needs next.</Text>
      </View>

      {hasNoProgramState ? (
        <>
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionKicker}>Get started</Text>
          </View>
          <View style={styles.getStartedCard}>
            <Text style={styles.getStartedTitle}>Hey, let&apos;s get you started.</Text>
            <Text style={styles.getStartedBody}>Pick the fastest way in. You can still change everything later.</Text>
          </View>

          <View style={styles.optionStack}>
            <Pressable onPress={onPrimaryAction} style={[styles.optionCard, styles.optionCardPrimary]}>
              <View style={styles.optionTopRow}>
                <Text style={[styles.optionTitle, styles.optionTitlePrimary]}>Start simple plan</Text>
                <Text style={[styles.optionArrow, styles.optionArrowPrimary]}>&gt;</Text>
              </View>
              <Text style={[styles.optionBody, styles.optionBodyPrimary]}>Open the easiest proven starting plan.</Text>
            </Pressable>

            <Pressable onPress={onOpenPlanOptions} style={styles.optionCard}>
              <View style={styles.optionTopRow}>
                <Text style={styles.optionTitle}>Explore workouts</Text>
                <Text style={styles.optionArrow}>&gt;</Text>
              </View>
              <Text style={styles.optionBody}>Browse all plans and pick exactly what you want.</Text>
            </Pressable>

            <Pressable onPress={onCreateWorkoutFromExercises} style={styles.optionCard}>
              <View style={styles.optionTopRow}>
                <Text style={styles.optionTitle}>Create your own</Text>
                <Text style={styles.optionArrow}>&gt;</Text>
              </View>
              <Text style={styles.optionBody}>Build a session from exercises, search, or a saved list.</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <>
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionKicker}>This week</Text>
          </View>
          <ResumeWorkoutCard card={primaryActionCard} heroVisual={heroVisual} onPress={onPrimaryAction} />

          <View style={styles.sectionBlock}>
            <Text style={styles.sectionKicker}>Adjust</Text>
          </View>
          <View style={styles.optionStack}>
            <Pressable onPress={onOpenPlanOptions} style={styles.optionCard}>
              <View style={styles.optionTopRow}>
                <Text style={styles.optionTitle}>Adjust workout</Text>
                <Text style={styles.optionArrow}>&gt;</Text>
              </View>
              <Text style={styles.optionBody}>Swap the day or change what this week is doing.</Text>
            </Pressable>

            <Pressable onPress={onCreateWorkoutFromExercises} style={styles.optionCard}>
              <View style={styles.optionTopRow}>
                <Text style={styles.optionTitle}>Choose exercises</Text>
                <Text style={styles.optionArrow}>&gt;</Text>
              </View>
              <Text style={styles.optionBody}>Build your own session from search or a saved list.</Text>
            </Pressable>
          </View>

          <View style={styles.sectionBlock}>
            <Text style={styles.sectionKicker}>Week plan</Text>
          </View>
          <HomeStreakCard
            streak={streak}
            upcomingSessions={upcomingSessions}
            onOpenStreak={onOpenStreak}
            title="Next sessions"
            subtitle={comingUpSubtitle}
            pillLabel={comingUpPill}
            showActivity={false}
            tone="light"
          />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: layout.bottomTabBarReserve,
    gap: spacing.lg,
    backgroundColor: '#FFFFFF',
  },
  header: {
    gap: spacing.xs,
  },
  eyebrow: {
    color: 'rgba(5,5,5,0.48)',
    fontSize: 14,
    fontWeight: '600',
  },
  title: {
    color: '#050505',
    fontSize: 36,
    lineHeight: 38,
    fontWeight: '900',
    letterSpacing: -1.4,
  },
  subtitle: {
    color: 'rgba(5,5,5,0.56)',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  sectionBlock: {
    marginBottom: -8,
  },
  sectionKicker: {
    color: 'rgba(5,5,5,0.42)',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  getStartedCard: {
    borderRadius: 24,
    backgroundColor: '#050505',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    gap: spacing.xs,
  },
  getStartedTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    lineHeight: 30,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  getStartedBody: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    maxWidth: '92%',
  },
  optionStack: {
    gap: spacing.sm,
  },
  optionCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(5,5,5,0.10)',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.xs,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 1,
  },
  optionCardPrimary: {
    backgroundColor: '#050505',
    borderColor: '#050505',
    shadowOpacity: 0.12,
    elevation: 3,
  },
  optionTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  optionTitle: {
    color: '#050505',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  optionTitlePrimary: {
    color: '#FFFFFF',
  },
  optionArrow: {
    color: 'rgba(5,5,5,0.70)',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '900',
  },
  optionArrowPrimary: {
    color: 'rgba(255,255,255,0.82)',
  },
  optionBody: {
    color: 'rgba(5,5,5,0.54)',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    maxWidth: '94%',
  },
  optionBodyPrimary: {
    color: 'rgba(255,255,255,0.64)',
  },
});
