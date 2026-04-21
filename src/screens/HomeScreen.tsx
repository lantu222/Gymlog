import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { HomeUpcomingSessionSummary } from '../components/HomeStreakCard';
import { pluralize } from '../lib/format';
import { HomeStreakSummary } from '../lib/dashboard';
import { getCustomTemplatePresentation } from '../lib/templatePresentation';
import { layout, spacing } from '../theme';

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

interface HomeScreenProps {
  hasNoProgramState?: boolean;
  streak: HomeStreakSummary;
  quickStats: HomeQuickStat[];
  weeklySnapshot: WeeklySnapshotItem[];
  upcomingSessions: HomeUpcomingSessionSummary[];
  customTemplates?: HomeTemplateItem[];
  onOpenTemplatesHub: () => void;
  onOpenCustomTemplate: (workoutTemplateId: string) => void;
  onCreateWorkoutFromExercises: () => void;
  onCreateTemplate: () => void;
  onBrowseReadyPlans: () => void;
  onOpenStreak: () => void;
  onOpenAICoach: (prompt: string) => void;
}

function buildTrendDisplay(item: WeeklySnapshotItem) {
  if (item.trendDirection === 'flat' || item.trendLabel === '-') {
    return { text: '—', negative: false, flat: true };
  }

  const normalizedLabel = item.trendLabel.replace(/^[+-]/, '');

  return {
    text: `${item.trendDirection === 'up' ? '↑' : '↓'} ${normalizedLabel}`,
    negative: item.trendDirection === 'down',
    flat: false,
  };
}

export function HomeScreen({
  hasNoProgramState = false,
  weeklySnapshot,
  customTemplates = [],
  onOpenTemplatesHub,
  onOpenCustomTemplate,
  onCreateWorkoutFromExercises,
  onCreateTemplate,
  onBrowseReadyPlans,
  onOpenStreak,
}: HomeScreenProps) {
  const visibleTemplates = customTemplates.slice(0, 3);
  const hasTemplates = customTemplates.length > 0;

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Training</Text>
        <Text style={styles.subtitle}>Start with what the week needs next.</Text>
      </View>

      <View style={styles.snapshotCard}>
        <View style={styles.snapshotHeader}>
          <Text style={styles.snapshotTitle}>Week rhythm</Text>
          <Pressable onPress={onOpenStreak} hitSlop={8}>
            <Text style={styles.snapshotLink}>See more</Text>
          </Pressable>
        </View>

        <View style={styles.snapshotGrid}>
          {weeklySnapshot.map((item) => {
            const trendDisplay = buildTrendDisplay(item);

            return (
              <View key={item.label} style={styles.snapshotItem}>
                <Text style={styles.snapshotValue}>{item.value}</Text>
                <View
                  style={[
                    styles.snapshotMetaRow,
                  ]}
                >
                  <Text style={styles.snapshotLabel}>{item.label}</Text>
                  <Text
                    style={[
                      styles.snapshotTrendInline,
                      trendDisplay.flat
                        ? styles.snapshotTrendInlineFlat
                        : trendDisplay.negative
                          ? styles.snapshotTrendInlineNegative
                          : styles.snapshotTrendInlinePositive,
                    ]}
                  >
                    {trendDisplay.text}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.sectionBlock}>
        <Text style={styles.sectionKicker}>Quick start</Text>
      </View>

      <Pressable onPress={onCreateWorkoutFromExercises} style={styles.quickStartCard}>
        <View style={styles.quickStartIcon}>
          <Text style={styles.quickStartIconText}>+</Text>
        </View>
        <View style={styles.quickStartCopy}>
          <Text style={styles.quickStartTitle}>Start an empty workout</Text>
          <Text style={styles.quickStartBody}>Add exercises as you go.</Text>
        </View>
      </Pressable>

      <View style={styles.sectionBlock}>
        <Text style={styles.sectionKicker}>Templates</Text>
      </View>

      <View style={styles.templatesHeaderRow}>
        <View style={styles.templatesHeaderCopy}>
          <Text style={styles.templatesTitle}>Your templates</Text>
          <Text style={styles.templatesSubtitle}>
            {hasTemplates
              ? 'Reusable weekly splits you can run again.'
              : hasNoProgramState
                ? 'Create your first template or browse ready plans.'
                : 'Build and keep the splits you want to run.'}
          </Text>
        </View>
        <Pressable onPress={onOpenTemplatesHub} hitSlop={8}>
          <Text style={styles.templatesHubLink}>{hasTemplates ? 'See all' : 'Open'}</Text>
        </Pressable>
      </View>

      {hasTemplates ? (
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
                    {pluralize(template.sessionCount, 'session')} · {pluralize(template.exerciseCount, 'exercise')}
                  </Text>
                </View>
                <Text style={styles.templateCardArrow}>{'>'}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <Pressable onPress={onCreateTemplate} style={styles.templateTile}>
          <Text style={styles.templateTilePlus}>+</Text>
          <Text style={styles.templateTileTitle}>Create template</Text>
          <Text style={styles.templateTileBody}>Build a weekly split you can run again.</Text>
        </Pressable>
      )}

      <Pressable onPress={onBrowseReadyPlans} style={styles.quickStartCard}>
        <View style={styles.quickStartIcon}>
          <Text style={styles.quickStartIconText}>+</Text>
        </View>
        <View style={styles.quickStartCopy}>
          <Text style={styles.quickStartTitle}>Browse ready plans</Text>
          <Text style={styles.quickStartBody}>Open the library and pick a plan to run.</Text>
        </View>
      </Pressable>
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
  snapshotCard: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(5,5,5,0.10)',
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  snapshotHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  snapshotTitle: {
    color: '#050505',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  snapshotLink: {
    color: 'rgba(5,5,5,0.62)',
    fontSize: 12,
    fontWeight: '800',
  },
  snapshotGrid: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  snapshotItem: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  snapshotValue: {
    color: '#050505',
    fontSize: 18,
    lineHeight: 20,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  snapshotLabel: {
    color: 'rgba(5,5,5,0.60)',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '700',
  },
  snapshotMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  snapshotTrendInline: {
    fontSize: 10,
    fontWeight: '900',
  },
  snapshotTrendInlinePositive: {
    color: '#1E8E3E',
  },
  snapshotTrendInlineNegative: {
    color: '#C5221F',
  },
  snapshotTrendInlineFlat: {
    color: 'rgba(5,5,5,0.38)',
  },
  sectionKicker: {
    color: 'rgba(5,5,5,0.42)',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  quickStartCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(5,5,5,0.10)',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 1,
  },
  quickStartIcon: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: 'rgba(30, 142, 62, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(30, 142, 62, 0.22)',
  },
  quickStartIconText: {
    color: '#1E8E3E',
    fontSize: 24,
    lineHeight: 24,
    fontWeight: '700',
    marginTop: -2,
  },
  quickStartCopy: {
    flex: 1,
    gap: 2,
  },
  quickStartTitle: {
    color: '#050505',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  quickStartBody: {
    color: 'rgba(5,5,5,0.54)',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  templatesHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  templatesHeaderCopy: {
    flex: 1,
    gap: 2,
  },
  templatesTitle: {
    color: '#050505',
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  templatesSubtitle: {
    color: 'rgba(5,5,5,0.56)',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  templatesHubLink: {
    color: 'rgba(5,5,5,0.62)',
    fontSize: 12,
    fontWeight: '800',
  },
  templatesList: {
    gap: spacing.sm,
  },
  templateCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(5,5,5,0.10)',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 1,
  },
  templateCardVisual: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(30, 142, 62, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(30, 142, 62, 0.18)',
  },
  templateCardVisualText: {
    color: '#1E8E3E',
    fontSize: 22,
    lineHeight: 22,
    fontWeight: '900',
    letterSpacing: -0.4,
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
    minHeight: 24,
    paddingHorizontal: 8,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(5,5,5,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(5,5,5,0.08)',
  },
  templateTagText: {
    color: 'rgba(5,5,5,0.70)',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.45,
  },
  templateCardTitle: {
    color: '#050505',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  templateCardSubtitle: {
    color: 'rgba(5,5,5,0.72)',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  templateCardMeta: {
    color: 'rgba(5,5,5,0.54)',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  templateCardArrow: {
    color: 'rgba(5,5,5,0.38)',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '900',
  },
  templateTile: {
    minHeight: 164,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(5,5,5,0.10)',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 1,
  },
  templateTilePlus: {
    color: '#1E8E3E',
    fontSize: 36,
    lineHeight: 36,
    fontWeight: '500',
  },
  templateTileTitle: {
    color: '#050505',
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    letterSpacing: -0.6,
    textAlign: 'center',
  },
  templateTileBody: {
    color: 'rgba(5,5,5,0.54)',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    textAlign: 'center',
    maxWidth: '78%',
  },
});
