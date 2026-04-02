import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { AICoachCard } from '../components/AICoachCard';
import { HomePathSection } from '../components/HomePathSection';
import { HomeActiveWorkoutSummary, HomeStreakCard } from '../components/HomeStreakCard';
import { ResumeWorkoutCard, ResumeWorkoutCardData } from '../components/ResumeWorkoutCard';
import { HomeStreakSummary } from '../lib/dashboard';
import { layout, spacing } from '../theme';

interface HomeScreenProps {
  activeWorkoutSummary: HomeActiveWorkoutSummary | null;
  primaryActionCard: ResumeWorkoutCardData;
  readyProgramCount: number;
  readyProgramBadgeLabel: string;
  readyProgramTitle: string;
  readyProgramSubtitle: string;
  readyProgramMeta: string;
  readyProgramCtaLabel: string;
  customProgramCount: number;
  customProgramBadgeLabel: string;
  customProgramTitle: string;
  customProgramSubtitle: string;
  customProgramMeta: string;
  customProgramCtaLabel: string;
  streak: HomeStreakSummary;
  aiPromptSuggestions?: string[];
  onPrimaryAction: () => void;
  onOpenReadyPrograms: () => void;
  onOpenCustomPrograms: () => void;
  onOpenStreak: () => void;
  onOpenAICoach: (prompt: string) => void;
  onResumeWorkout: () => void;
}

export function HomeScreen({
  activeWorkoutSummary,
  primaryActionCard,
  readyProgramCount,
  readyProgramBadgeLabel,
  readyProgramTitle,
  readyProgramSubtitle,
  readyProgramMeta,
  readyProgramCtaLabel,
  customProgramCount,
  customProgramBadgeLabel,
  customProgramTitle,
  customProgramSubtitle,
  customProgramMeta,
  customProgramCtaLabel,
  streak,
  aiPromptSuggestions,
  onPrimaryAction,
  onOpenReadyPrograms,
  onOpenCustomPrograms,
  onOpenStreak,
  onOpenAICoach,
  onResumeWorkout,
}: HomeScreenProps) {
  const safePromptSuggestions = Array.isArray(aiPromptSuggestions) ? aiPromptSuggestions : [];

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <ResumeWorkoutCard card={primaryActionCard} onPress={onPrimaryAction} />

      <HomePathSection
        readyProgramCount={readyProgramCount}
        readyProgramBadgeLabel={readyProgramBadgeLabel}
        readyProgramTitle={readyProgramTitle}
        readyProgramSubtitle={readyProgramSubtitle}
        readyProgramMeta={readyProgramMeta}
        readyProgramCtaLabel={readyProgramCtaLabel}
        customProgramCount={customProgramCount}
        customProgramBadgeLabel={customProgramBadgeLabel}
        customProgramTitle={customProgramTitle}
        customProgramSubtitle={customProgramSubtitle}
        customProgramMeta={customProgramMeta}
        customProgramCtaLabel={customProgramCtaLabel}
        onOpenReadyPrograms={onOpenReadyPrograms}
        onOpenCustomPrograms={onOpenCustomPrograms}
      />

      <HomeStreakCard
        streak={streak}
        activeWorkoutSummary={activeWorkoutSummary}
        onOpenStreak={onOpenStreak}
        onResumeWorkout={onResumeWorkout}
      />

      <AICoachCard
        variant="compact"
        suggestions={safePromptSuggestions}
        activeWorkoutTitle={activeWorkoutSummary?.title ?? null}
        onSubmit={onOpenAICoach}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: layout.bottomTabBarReserve,
    gap: spacing.md,
  },
});
