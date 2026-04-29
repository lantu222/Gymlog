import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { HomeUpcomingSessionSummary } from '../components/HomeStreakCard';
import { GymlogIcon } from '../components/GymlogIcon';
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
  activePlan = null,
  weeklySnapshot,
  customTemplates = [],
  onStartActivePlan,
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

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Training</Text>
        <Text style={styles.subtitle}>
          {hasActivePlan ? "Let's get stronger. You've got a plan." : 'Start with what the week needs next.'}
        </Text>
      </View>

      {activePlan ? (
        <View style={styles.activePlanSection}>
          <Text style={styles.sectionKicker}>Your plan</Text>
          <View style={styles.activePlanCard}>
            <View style={styles.activePlanTopRow}>
              <View style={styles.activePlanCopy}>
                <Text style={styles.activePlanEyebrow}>{activePlan.eyebrow}</Text>
                <Text style={styles.activePlanTitle} numberOfLines={2}>{activePlan.title}</Text>
                <Text style={styles.activePlanSubtitle} numberOfLines={2}>{activePlan.subtitle}</Text>
              </View>
              <View style={styles.activePlanIconMark}>
                <GymlogIcon name="strength" color="rgba(255,255,255,0.34)" size={44} />
              </View>
            </View>

            <View style={styles.activePlanStatsRow}>
              <View style={styles.activePlanStat}>
                <Text style={styles.activePlanStatValue}>{activePlan.weeklyMinutes}</Text>
                <Text style={styles.activePlanStatLabel}>Est. duration</Text>
              </View>
              <View style={styles.activePlanStat}>
                <Text style={styles.activePlanStatValue}>{activePlan.sessionsPerWeek}</Text>
                <Text style={styles.activePlanStatLabel}>Weekly days</Text>
              </View>
              <View style={styles.activePlanStat}>
                <Text style={styles.activePlanStatValue}>Week 1</Text>
                <Text style={styles.activePlanStatLabel}>Current block</Text>
              </View>
            </View>

            <View style={styles.nextUpBlock}>
              <View style={styles.nextUpHeader}>
                <Text style={styles.nextUpKicker}>Next up</Text>
                <Text style={styles.nextUpDuration}>{activePlan.nextSession.duration}</Text>
              </View>
              <Text style={styles.nextUpTitle} numberOfLines={1}>{activePlan.nextSession.title}</Text>
              <Text style={styles.nextUpMeta}>{activePlan.nextSession.label}</Text>
              <View style={styles.nextUpExerciseList}>
                {activePlan.nextSession.exercises.slice(0, 3).map((exercise) => (
                  <View key={exercise.name} style={styles.nextUpExerciseRow}>
                    <View style={styles.nextUpExerciseDot} />
                    <Text style={styles.nextUpExerciseText} numberOfLines={1}>
                      {exercise.name}
                    </Text>
                    <Text style={styles.nextUpExerciseSets}>{exercise.setsLabel}</Text>
                  </View>
                ))}
                {activePlan.nextSession.hiddenExerciseCount > 0 ? (
                  <Text style={styles.nextUpMoreExercises}>
                    +{activePlan.nextSession.hiddenExerciseCount} more exercises
                  </Text>
                ) : null}
              </View>
            </View>

            <Pressable onPress={onStartActivePlan} style={styles.startWorkoutButton}>
              <Text style={styles.startWorkoutButtonText}>Start workout</Text>
              <Text style={styles.startWorkoutButtonArrow}>{'>'}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

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

      <View style={styles.quickActionList}>
        <Pressable onPress={onCreateWorkoutFromExercises} style={styles.quickStartCard}>
          <View style={styles.quickStartIconPlay}>
            <View style={styles.quickStartPlayTriangle} />
          </View>
          <View style={styles.quickStartCopy}>
            <Text style={styles.quickStartTitle}>Start an empty workout</Text>
            <Text style={styles.quickStartBody}>Build a workout from scratch.</Text>
          </View>
          <Text style={styles.quickStartArrow}>{'>'}</Text>
        </Pressable>

        {hasTemplates ? null : (
          <Pressable onPress={onCreateTemplate} style={styles.quickStartCard}>
            <View style={styles.quickStartIconPlus}>
              <Text style={styles.quickStartIconPlusText}>+</Text>
            </View>
            <View style={styles.quickStartCopy}>
              <Text style={styles.quickStartTitle}>Create template</Text>
              <Text style={styles.quickStartBody}>Build your own weekly split.</Text>
            </View>
            <Text style={styles.quickStartArrow}>{'>'}</Text>
          </Pressable>
        )}

        <Pressable onPress={onBrowseReadyPlans} style={styles.quickStartCard}>
          <View style={styles.quickStartFileIcon}>
            <View style={styles.quickStartFileFold} />
          </View>
          <View style={styles.quickStartCopy}>
            <Text style={styles.quickStartTitle}>Browse ready plans</Text>
            <Text style={styles.quickStartBody}>Choose a plan from the library.</Text>
          </View>
          <Text style={styles.quickStartArrow}>{'>'}</Text>
        </Pressable>
      </View>

      {hasTemplates ? (
        <>
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionKicker}>Templates</Text>
          </View>

          <View style={styles.templatesHeaderRow}>
            <View style={styles.templatesHeaderCopy}>
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
                      {pluralize(template.sessionCount, 'session')} · {pluralize(template.exerciseCount, 'exercise')}
                    </Text>
                  </View>
                  <Text style={styles.templateCardArrow}>{'>'}</Text>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : hasNoProgramState && !activePlan ? (
        <View style={styles.emptyTemplateNote}>
          <Text style={styles.emptyTemplateTitle}>No plan yet</Text>
          <Text style={styles.emptyTemplateBody}>Create your first template or browse ready plans when you want more structure.</Text>
        </View>
      ) : null}
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
  activePlanSection: {
    gap: spacing.sm,
  },
  activePlanCard: {
    borderRadius: 26,
    backgroundColor: '#080808',
    padding: spacing.lg,
    gap: spacing.md,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 6,
  },
  activePlanTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  activePlanCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  activePlanEyebrow: {
    color: 'rgba(255,255,255,0.52)',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '900',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  activePlanTitle: {
    color: '#FFFFFF',
    fontSize: 25,
    lineHeight: 29,
    fontWeight: '900',
    letterSpacing: -0.7,
  },
  activePlanSubtitle: {
    color: 'rgba(255,255,255,0.66)',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  activePlanIconMark: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  activePlanStatsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    paddingVertical: spacing.sm,
  },
  activePlanStat: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  activePlanStatValue: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '900',
  },
  activePlanStatLabel: {
    color: 'rgba(255,255,255,0.48)',
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '800',
  },
  nextUpBlock: {
    gap: 5,
  },
  nextUpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  nextUpKicker: {
    color: 'rgba(255,255,255,0.50)',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  nextUpDuration: {
    color: '#FFFFFF',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
  },
  nextUpTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '900',
  },
  nextUpMeta: {
    color: 'rgba(255,255,255,0.56)',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
  },
  nextUpExerciseList: {
    gap: 5,
    paddingTop: 2,
  },
  nextUpExerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  nextUpExerciseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.46)',
  },
  nextUpExerciseText: {
    flex: 1,
    color: 'rgba(255,255,255,0.76)',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  nextUpExerciseSets: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
  },
  nextUpMoreExercises: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    paddingTop: 2,
  },
  startWorkoutButton: {
    alignSelf: 'flex-end',
    minHeight: 48,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  startWorkoutButtonText: {
    color: '#050505',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '900',
  },
  startWorkoutButtonArrow: {
    color: '#050505',
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '900',
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
  quickActionList: {
    gap: spacing.sm,
  },
  quickStartCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(5,5,5,0.10)',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 1,
  },
  quickStartIconPlay: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#050505',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickStartPlayTriangle: {
    width: 0,
    height: 0,
    borderTopWidth: 7,
    borderBottomWidth: 7,
    borderLeftWidth: 11,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: '#FFFFFF',
    marginLeft: 3,
  },
  quickStartIconPlus: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#050505',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickStartIconPlusText: {
    color: '#FFFFFF',
    fontSize: 19,
    lineHeight: 19,
    fontWeight: '900',
    marginTop: -1,
  },
  quickStartFileIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#050505',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickStartFileFold: {
    width: 15,
    height: 18,
    borderRadius: 3,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderTopRightRadius: 7,
  },
  quickStartCopy: {
    flex: 1,
    gap: 2,
  },
  quickStartTitle: {
    color: '#050505',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  quickStartBody: {
    color: 'rgba(5,5,5,0.54)',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
  },
  quickStartArrow: {
    color: 'rgba(5,5,5,0.40)',
    fontSize: 18,
    lineHeight: 20,
    fontWeight: '900',
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
  emptyTemplateNote: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(5,5,5,0.10)',
    backgroundColor: '#FFFFFF',
    padding: spacing.md,
    gap: 3,
  },
  emptyTemplateTitle: {
    color: '#050505',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
  },
  emptyTemplateBody: {
    color: 'rgba(5,5,5,0.56)',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
});
