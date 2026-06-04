import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { SectionHeaderBlock, SurfaceCard } from '../components/MainScreenPrimitives';
import { ScreenHeader } from '../components/ScreenHeader';
import { WorkoutPhasePreview } from '../components/WorkoutPhasePreview';
import { CORE_WORKOUT_TEMPLATE_ID } from '../features/workout/workoutCatalog';
import { useWorkoutContext } from '../features/workout/WorkoutProvider';
import { WorkoutExerciseInstance, WorkoutTemplateExercise } from '../features/workout/workoutTypes';
import { formatWorkoutDisplayLabel } from '../lib/displayLabel';
import { formatShortDate, pluralize } from '../lib/format';
import { getReadyProgramCollection, READY_PROGRAM_COLLECTIONS } from '../lib/readyProgramCollections';
import { getReadyProgramContent } from '../lib/readyProgramContent';
import { getCustomTemplatePresentation, getReadyTemplatePresentation } from '../lib/templatePresentation';
import { getWorkoutFlowPhasePreview } from '../lib/workoutFlow';
import {
  filterAndSortReadyDiscoveryItems,
  getReadyProgramEquipmentLabel,
  getReadyProgramTradeoff,
  ReadyEquipmentFilter,
  ReadyLevelFilter,
  ReadyTimeFilter,
} from '../lib/workoutDiscovery';
import { ProgramInsightSummary } from '../lib/programInsights';
import { TailoringPreferencesInput } from '../lib/tailoringFit';
import { colors, layout, radii, spacing } from '../theme';

interface CustomWorkoutListItem {
  id: string;
  name: string;
  sessionCount: number;
  exerciseCount: number;
  updatedAt: string;
}

interface WorkoutsScreenProps {
  customWorkouts: CustomWorkoutListItem[];
  programInsightsByTemplateId: Record<string, ProgramInsightSummary>;
  onOpenWorkout: (workoutTemplateId: string) => void;
  onOpenReadyProgram: (workoutTemplateId: string) => void;
  onStartReadyProgram: (workoutTemplateId: string) => void;
  onOpenCustomProgram: (workoutTemplateId: string) => void;
  onStartCustomWorkout: (workoutTemplateId: string) => void;
  onEditCustomWorkout: (workoutTemplateId: string) => void;
  onDuplicateCustomWorkout: (workoutTemplateId: string) => void;
  onDeleteCustomWorkout: (workoutTemplateId: string) => void;
  onCreateWorkout: () => void;
  recommendedReadyProgramId?: string | null;
  tailoringPreferences?: TailoringPreferencesInput | null;
}

type CardVariant = {
  borderColor: string;
  accentColor: string;
  orbColor: string;
  startBackground: string;
  startBorder: string;
  startText: string;
};

type ReadyGoalFilter = 'all' | 'strength' | 'hypertrophy' | 'general';
type ReadyCollectionFilter = 'all' | 'starter' | 'strength' | 'muscle' | 'balanced';
type TodayFlowItem = {
  label: 'Next' | 'Then' | 'Finish';
  title: string;
  meta: string;
};

const READY_GOAL_FILTERS: Array<{ key: ReadyGoalFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'strength', label: 'Strength' },
  { key: 'hypertrophy', label: 'Hypertrophy' },
  { key: 'general', label: 'General' },
];

const READY_TIME_FILTERS: Array<{ key: ReadyTimeFilter; label: string }> = [
  { key: 'all', label: 'Any time' },
  { key: 'short', label: '45 min or less' },
  { key: 'balanced', label: '46-60 min' },
  { key: 'long', label: '60+ min' },
];

const READY_EQUIPMENT_FILTERS: Array<{ key: ReadyEquipmentFilter; label: string }> = [
  { key: 'all', label: 'Any equipment' },
  { key: 'full_gym', label: 'Full gym' },
  { key: 'low_equipment', label: 'Low equipment' },
];

const READY_LEVEL_FILTERS: Array<{ key: ReadyLevelFilter; label: string }> = [
  { key: 'all', label: 'Any level' },
  { key: 'beginner', label: 'Beginner' },
  { key: 'intermediate', label: 'Intermediate' },
];

const customCardVariants: CardVariant[] = [
  {
    borderColor: 'rgba(255,255,255,0.08)',
    accentColor: '#D8ECFF',
    orbColor: 'rgba(255,255,255,0.10)',
    startBackground: '#F3F7FF',
    startBorder: 'rgba(255,255,255,0.24)',
    startText: '#06080B',
  },
  {
    borderColor: 'rgba(255,255,255,0.08)',
    accentColor: '#D8ECFF',
    orbColor: 'rgba(255,255,255,0.08)',
    startBackground: '#F3F7FF',
    startBorder: 'rgba(255,255,255,0.24)',
    startText: '#06080B',
  },
  {
    borderColor: 'rgba(255,255,255,0.08)',
    accentColor: '#D8ECFF',
    orbColor: 'rgba(255,255,255,0.08)',
    startBackground: '#F3F7FF',
    startBorder: 'rgba(255,255,255,0.24)',
    startText: '#06080B',
  },
];

const readyCardVariants: CardVariant[] = [
  {
    borderColor: 'rgba(255,255,255,0.08)',
    accentColor: '#D8ECFF',
    orbColor: 'rgba(255,255,255,0.08)',
    startBackground: '#F3F7FF',
    startBorder: 'rgba(255,255,255,0.24)',
    startText: '#06080B',
  },
  {
    borderColor: 'rgba(255,255,255,0.08)',
    accentColor: '#D8ECFF',
    orbColor: 'rgba(255,255,255,0.08)',
    startBackground: '#F3F7FF',
    startBorder: 'rgba(255,255,255,0.24)',
    startText: '#06080B',
  },
  {
    borderColor: 'rgba(255,255,255,0.08)',
    accentColor: '#D8ECFF',
    orbColor: 'rgba(255,255,255,0.08)',
    startBackground: '#F3F7FF',
    startBorder: 'rgba(255,255,255,0.24)',
    startText: '#06080B',
  },
];

function getVariant(variants: CardVariant[], index: number): CardVariant {
  return variants[index % variants.length];
}

function formatGoal(value: string) {
  return value ? value[0].toUpperCase() + value.slice(1) : value;
}

function formatLevel(value: string) {
  return value ? value[0].toUpperCase() + value.slice(1) : value;
}

function formatReps(min: number, max: number) {
  return min === max ? `${max}` : `${min}-${max}`;
}

function formatFlowExerciseMeta(exercise: WorkoutTemplateExercise | WorkoutExerciseInstance) {
  if (Array.isArray(exercise.sets)) {
    const firstSet = exercise.sets[0];
    if (!firstSet) {
      return '';
    }
    if (typeof firstSet.plannedLoadKg === 'number') {
      return `${firstSet.plannedLoadKg} kg × ${formatReps(firstSet.plannedRepsMin, firstSet.plannedRepsMax)}`;
    }
    return `${exercise.sets.length} ${exercise.sets.length === 1 ? 'set' : 'sets'}`;
  }

  const templateExercise = exercise as WorkoutTemplateExercise;

  if (templateExercise.trackingMode === 'load_and_reps') {
    return `${templateExercise.sets} ${templateExercise.sets === 1 ? 'set' : 'sets'} · ${formatReps(templateExercise.repsMin, templateExercise.repsMax)} reps`;
  }

  return `${templateExercise.sets} ${templateExercise.sets === 1 ? 'set' : 'sets'}`;
}

function buildTodayFlowItems(exercises: Array<WorkoutTemplateExercise | WorkoutExerciseInstance>): TodayFlowItem[] {
  if (!exercises.length) {
    return [];
  }

  const picks =
    exercises.length <= 3
      ? exercises
      : [exercises[0], exercises[1], exercises[exercises.length - 1]].filter(Boolean);

  return picks.map((exercise, index) => {
    const isLast = index === picks.length - 1;
    return {
      label: index === 0 ? 'Next' : isLast ? 'Finish' : 'Then',
      title: exercise.exerciseName,
      meta: formatFlowExerciseMeta(exercise),
    };
  });
}

function buildCustomTodayFlowItems(workout: CustomWorkoutListItem): TodayFlowItem[] {
  return [
    {
      label: 'Next',
      title: formatWorkoutDisplayLabel(workout.name, 'Workout'),
      meta: pluralize(workout.exerciseCount, 'exercise'),
    },
    {
      label: 'Then',
      title: 'Log the first lift',
      meta: workout.sessionCount <= 1 ? 'Single-session split' : `${workout.sessionCount} sessions ready`,
    },
    {
      label: 'Finish',
      title: 'Save the session',
      meta: 'Keep the week moving',
    },
  ];
}

export function WorkoutsScreen({
  customWorkouts,
  programInsightsByTemplateId,
  onOpenWorkout,
  onOpenReadyProgram,
  onStartReadyProgram,
  onOpenCustomProgram,
  onStartCustomWorkout,
  onEditCustomWorkout,
  onDuplicateCustomWorkout,
  onDeleteCustomWorkout,
  onCreateWorkout,
  recommendedReadyProgramId,
  tailoringPreferences = null,
}: WorkoutsScreenProps) {
  const { activeSession, history, templates } = useWorkoutContext();
  const activeTemplateId = activeSession?.templateId ?? history.lastSelectedTemplateId ?? CORE_WORKOUT_TEMPLATE_ID;
  const [menuTemplateId, setMenuTemplateId] = useState<string | null>(null);
  const [confirmDeleteTemplateId, setConfirmDeleteTemplateId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [readyCollectionFilter, setReadyCollectionFilter] = useState<ReadyCollectionFilter>('all');
  const [readyGoalFilter, setReadyGoalFilter] = useState<ReadyGoalFilter>('all');
  const [readyTimeFilter, setReadyTimeFilter] = useState<ReadyTimeFilter>('all');
  const [readyEquipmentFilter, setReadyEquipmentFilter] = useState<ReadyEquipmentFilter>('all');
  const [readyLevelFilter, setReadyLevelFilter] = useState<ReadyLevelFilter>('all');
  const [compareTemplateIds, setCompareTemplateIds] = useState<string[]>([]);
  const [showReadyLibrary, setShowReadyLibrary] = useState(true);
  const [showAllCustomWorkouts, setShowAllCustomWorkouts] = useState(false);
  const [showBrowseWorkouts, setShowBrowseWorkouts] = useState(true);

  const menuTemplate = customWorkouts.find((template) => template.id === menuTemplateId) ?? null;
  const confirmDeleteTemplate = customWorkouts.find((template) => template.id === confirmDeleteTemplateId) ?? null;
  const recommendedReadyTemplate = recommendedReadyProgramId
    ? templates.find((template) => template.id === recommendedReadyProgramId) ?? null
    : null;
  const recommendedKickoffSession = recommendedReadyTemplate?.sessions[0] ?? null;
  const activeSessionDurationMinutes = activeSession ? Math.max(1, Math.round(activeSession.elapsedSeconds / 60)) : null;
  const primaryCustomWorkout =
    customWorkouts.find((template) => template.id === activeTemplateId) ??
    customWorkouts[0] ??
    null;
  const todayFlowItems = useMemo(() => {
    if (activeSession?.exercises?.length) {
      const activeIndex = activeSession.ui.activeSlotId
        ? activeSession.exercises.findIndex((exercise) => exercise.slotId === activeSession.ui.activeSlotId)
        : 0;
      const remainingExercises =
        activeIndex >= 0 ? activeSession.exercises.slice(activeIndex) : activeSession.exercises.slice(0, 3);
      return buildTodayFlowItems(remainingExercises);
    }

    if (recommendedKickoffSession?.exercises?.length) {
      return buildTodayFlowItems(recommendedKickoffSession.exercises);
    }

    if (primaryCustomWorkout) {
      return buildCustomTodayFlowItems(primaryCustomWorkout);
    }

    return [];
  }, [activeSession, primaryCustomWorkout, recommendedKickoffSession]);
  const selectedCollection = getReadyProgramCollection(readyCollectionFilter);
  const readyDiscoveryItems = useMemo(() => {
    const byCollection = selectedCollection
      ? templates.filter((template) => selectedCollection.templateIds.includes(template.id))
      : templates;

    return byCollection.map((template) => ({
      template,
      content: getReadyProgramContent(template.id),
    }));
  }, [selectedCollection, templates]);
  const filteredReadyItems = useMemo(
    () =>
      filterAndSortReadyDiscoveryItems(
        readyDiscoveryItems,
        {
        query: searchQuery,
        goal: readyGoalFilter,
        level: readyLevelFilter,
        time: readyTimeFilter,
        equipment: readyEquipmentFilter,
        },
        tailoringPreferences,
      ),
    [
      readyDiscoveryItems,
      readyEquipmentFilter,
      readyGoalFilter,
      readyLevelFilter,
      readyTimeFilter,
      searchQuery,
      tailoringPreferences,
    ],
  );
  const filteredCustomWorkouts = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return customWorkouts;
    }

    return customWorkouts.filter((template) => {
      const presentation = getCustomTemplatePresentation(template);

      return (
        formatWorkoutDisplayLabel(template.name, 'Workout').toLowerCase().includes(normalizedQuery) ||
        presentation.title.toLowerCase().includes(normalizedQuery) ||
        presentation.subtitle.toLowerCase().includes(normalizedQuery) ||
        presentation.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery))
      );
    });
  }, [customWorkouts, searchQuery]);
  const compareItems = useMemo(
    () =>
      compareTemplateIds
        .map((templateId) => templates.find((template) => template.id === templateId) ?? null)
        .filter((template): template is NonNullable<typeof template> => Boolean(template))
        .map((template) => ({
          template,
          content: getReadyProgramContent(template.id),
        })),
    [compareTemplateIds, templates],
  );
  const featuredReadyItems = filteredReadyItems.slice(0, 2);
  const allGainerProgramItems = readyDiscoveryItems.filter((item) => item.template.id.startsWith('tpl_gainer_'));
  const gainerProgramItems = filteredReadyItems.filter((item) => item.template.id.startsWith('tpl_gainer_'));
  const hiddenReadyCount = Math.max(filteredReadyItems.length - featuredReadyItems.length, 0);
  const visibleCustomWorkouts = showAllCustomWorkouts ? filteredCustomWorkouts : filteredCustomWorkouts.slice(0, 2);
  const hiddenCustomWorkoutCount = Math.max(filteredCustomWorkouts.length - visibleCustomWorkouts.length, 0);
  const shouldShowFeaturedReady = !recommendedReadyTemplate || showReadyLibrary;
  const collapsedWorkoutShortcuts = customWorkouts.slice(0, 3);

  function toggleCompareTemplate(templateId: string) {
    setCompareTemplateIds((current) => {
      if (current.includes(templateId)) {
        return current.filter((id) => id !== templateId);
      }

      if (current.length >= 2) {
        return [current[1], templateId];
      }

      return [...current, templateId];
    });
  }

  return (
    <>
      <ScreenHeader title="Ready Templates" />
      <ScrollView contentContainerStyle={styles.readyTemplateContent} showsVerticalScrollIndicator={false}>
        <View style={styles.readyTemplateIntro}>
          <Text style={styles.readyTemplateCount}>{allGainerProgramItems.length} templates</Text>
          <Text style={styles.readyTemplateSubtitle}>Pick a ready-made plan, inspect the days, then start when it fits.</Text>
        </View>

        <View style={styles.readyTemplateSearchCard}>
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search ready templates"
            placeholderTextColor={colors.textMuted}
            selectionColor={colors.accentAlt}
            style={styles.readyTemplateSearchInput}
          />
        </View>

        {gainerProgramItems.length ? (
          <View style={styles.readyTemplateList}>
            {gainerProgramItems.map((item, index) => {
              const { template, content } = item;
              const current = template.id === activeTemplateId;
              const firstSession = template.sessions[0] ?? null;
              const firstExercise = firstSession?.exercises[0]?.exerciseName ?? null;
              const accentStyle = index % 2 === 0 ? styles.readyTemplateAccentPurple : styles.readyTemplateAccentGreen;

              return (
                <View key={`ready-template:${template.id}`} style={[styles.readyTemplateCard, current && styles.readyTemplateCardCurrent]}>
                  <Pressable onPress={() => onOpenReadyProgram(template.id)} style={styles.readyTemplateCardMain}>
                    <View style={[styles.readyTemplateAccent, accentStyle]} />
                    <View style={styles.readyTemplateHeaderRow}>
                      <View style={styles.readyTemplateIconTile}>
                        <Text style={styles.readyTemplateIconText}>{template.daysPerWeek}</Text>
                      </View>
                      <View style={styles.readyTemplateTitleBlock}>
                        <Text style={styles.readyTemplateName} numberOfLines={1} adjustsFontSizeToFit>
                          {formatWorkoutDisplayLabel(template.name, 'Template')}
                        </Text>
                        <Text style={styles.readyTemplateMeta} numberOfLines={1}>
                          {template.daysPerWeek} days | {formatGoal(template.goalType)} | {formatLevel(template.level)}
                        </Text>
                      </View>
                      <Text style={styles.readyTemplateChevron}>{'>'}</Text>
                    </View>

                    <Text style={styles.readyTemplateBody} numberOfLines={2}>
                      {content?.summary ?? content?.audience ?? `${template.sessions.length} sessions built for ${template.goalType} training.`}
                    </Text>

                    <View style={styles.readyTemplateFooterRow}>
                      <View style={styles.readyTemplatePill}>
                        <Text style={styles.readyTemplatePillText}>{template.sessions.length} sessions</Text>
                      </View>
                      <View style={styles.readyTemplatePill}>
                        <Text style={styles.readyTemplatePillText}>{template.estimatedSessionDuration} min</Text>
                      </View>
                      {firstExercise ? (
                        <View style={[styles.readyTemplatePill, styles.readyTemplatePillWide]}>
                          <Text style={styles.readyTemplatePillText} numberOfLines={1}>
                            Next: {firstExercise}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </Pressable>

                  <Pressable
                    onPress={() => onStartReadyProgram(template.id)}
                    style={[styles.readyTemplateStartButton, current && styles.readyTemplateStartButtonCurrent]}
                  >
                    <Text style={styles.readyTemplateStartText}>{current ? 'Current' : 'Start'}</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        ) : (
          <EmptyState
            title="No ready templates match this search"
            description="Clear the search field or try a shorter keyword."
          />
        )}
      </ScrollView>
    </>
  );
}


const styles = StyleSheet.create({
  readyTemplateContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: layout.bottomTabBarReserve,
    gap: spacing.md,
  },
  readyTemplateIntro: {
    gap: 4,
  },
  readyTemplateCount: {
    color: colors.textPrimary,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  readyTemplateSubtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  readyTemplateSearchCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(18, 24, 33, 0.72)',
    padding: spacing.md,
  },
  readyTemplateSearchInput: {
    minHeight: 52,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.input,
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
    paddingHorizontal: spacing.md,
  },
  readyTemplateList: {
    gap: spacing.md,
  },
  readyTemplateCard: {
    overflow: 'hidden',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#050505',
    padding: spacing.lg,
    gap: spacing.md,
  },
  readyTemplateCardCurrent: {
    borderColor: 'rgba(124,58,237,0.42)',
    backgroundColor: '#10101C',
  },
  readyTemplateCardMain: {
    gap: spacing.sm,
  },
  readyTemplateAccent: {
    position: 'absolute',
    left: -spacing.lg,
    top: -spacing.lg,
    bottom: -spacing.lg,
    width: 5,
  },
  readyTemplateAccentPurple: {
    backgroundColor: '#7C3AED',
  },
  readyTemplateAccentGreen: {
    backgroundColor: '#16A34A',
  },
  readyTemplateHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  readyTemplateIconTile: {
    width: 46,
    height: 46,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(124,58,237,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.30)',
  },
  readyTemplateIconText: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '900',
  },
  readyTemplateTitleBlock: {
    flex: 1,
    gap: 2,
  },
  readyTemplateName: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  readyTemplateMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  readyTemplateChevron: {
    color: colors.textSecondary,
    fontSize: 28,
    fontWeight: '900',
  },
  readyTemplateBody: {
    color: colors.textPrimary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  readyTemplateFooterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  readyTemplatePill: {
    minHeight: 30,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  readyTemplatePillWide: {
    maxWidth: '100%',
  },
  readyTemplatePillText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '900',
  },
  readyTemplateStartButton: {
    minHeight: 44,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F7FF',
  },
  readyTemplateStartButtonCurrent: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  readyTemplateStartText: {
    color: '#06080B',
    fontSize: 14,
    fontWeight: '900',
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: layout.bottomTabBarReserve,
    gap: spacing.lg,
  },
  activeCard: {
    overflow: 'hidden',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: '#050505',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  nextPlanCard: {
    overflow: 'hidden',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: '#050505',
    padding: spacing.xl,
    gap: spacing.md,
  },
  nextPlanTokenRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  heroVisual: {
    width: 128,
  },
  activeVisualPhoto: {
    width: 120,
    height: 132,
    borderRadius: radii.md,
  },
  activeHeroCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  nextPlanHeaderCopy: {
    gap: 2,
  },
  nextPlanHeroPhoto: {
    width: '100%',
    height: 178,
    borderRadius: radii.md,
  },
  nextPlanKicker: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  nextPlanTitle: {
    color: colors.textPrimary,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.7,
  },
  nextPlanDuration: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  nextPlanMetaLine: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  nextPlanBadge: {
    minHeight: 28,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  nextPlanBadgeText: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: '900',
  },
  nextPlanBadgeMuted: {
    minHeight: 28,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  nextPlanBadgeMutedText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
  },
  nextPlanActionRow: {
    gap: spacing.sm,
  },
  nextPlanPrimaryButton: {
    minHeight: 54,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
  },
  nextPlanPrimaryButtonText: {
    color: '#06080B',
    fontSize: 15,
    fontWeight: '900',
  },
  nextPlanSecondaryButton: {
    minHeight: 46,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(18, 24, 33, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  nextPlanSecondaryButtonText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  createCard: {
    overflow: 'hidden',
    gap: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: '#050505',
    padding: spacing.xl,
  },
  createTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  createVisual: {
    width: 112,
    height: 96,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  activeLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  activeTitle: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  activeMeta: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  statusChip: {
    minHeight: 28,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  statusChipText: {
    color: colors.textPrimary,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  primaryButton: {
    marginTop: spacing.xs,
    minHeight: 54,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F7FF',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
  },
  primaryButtonText: {
    color: '#06080B',
    fontSize: 15,
    fontWeight: '900',
  },
  createCopy: {
    flex: 1,
    gap: 4,
  },
  createKicker: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  createTitle: {
    color: colors.textPrimary,
    fontSize: 25,
    fontWeight: '900',
    letterSpacing: -0.7,
  },
  createMeta: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  secondaryPill: {
    minHeight: 42,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  secondaryPillText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  section: {
    gap: spacing.md,
  },
  todayFlowLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  todayFlowList: {
    gap: spacing.xs,
  },
  todayFlowCard: {
    gap: 4,
    borderRadius: radii.lg,
    backgroundColor: '#050505',
    borderColor: 'rgba(255,255,255,0.10)',
  },
  todayFlowCardActive: {
    borderColor: 'rgba(255,255,255,0.20)',
    backgroundColor: '#111111',
  },
  todayFlowCardLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  todayFlowCardTitle: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  todayFlowCardMeta: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  todayFlowConnector: {
    color: 'rgba(255,255,255,0.34)',
    fontSize: 20,
    textAlign: 'center',
    marginVertical: -2,
  },
  collapsedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  collapsedActionText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  collapsedWorkoutRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  collapsedWorkoutChip: {
    minHeight: 46,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  collapsedWorkoutChipText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  showMoreButton: {
    minHeight: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  showMoreButtonText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  sectionCopy: {
    flex: 1,
    gap: 2,
  },
  sectionKicker: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionKickerOrange: {
    color: colors.textMuted,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.7,
  },
  sectionSubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  collectionSection: {
    gap: spacing.sm,
  },
  filterSection: {
    gap: spacing.xs,
  },
  discoveryCard: {
    gap: spacing.sm,
  },
  discoveryTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  discoveryCopy: {
    flex: 1,
    gap: 2,
  },
  discoveryVisual: {
    width: 120,
  },
  discoveryKicker: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  discoveryTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '900',
  },
  discoveryMeta: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  searchInput: {
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.input,
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    paddingHorizontal: spacing.md,
  },
  recommendedCard: {
    gap: spacing.sm,
  },
  recommendedTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  recommendedKicker: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  collectionLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  collectionCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(18, 24, 33, 0.72)',
    padding: spacing.md,
    gap: 4,
  },
  collectionTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  collectionBody: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  collectionRecommendation: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  filterChip: {
    minHeight: 34,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderColor: 'rgba(255,255,255,0.20)',
  },
  filterChipText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  filterChipTextActive: {
    color: colors.textPrimary,
  },
  list: {
    gap: spacing.md,
  },
  customCard: {
    overflow: 'hidden',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    backgroundColor: '#050505',
    padding: spacing.lg,
  },
  templateCard: {
    overflow: 'hidden',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    backgroundColor: '#050505',
    padding: spacing.lg,
  },
  templateCardActive: {
    backgroundColor: '#111111',
  },
  templateMainTap: {
    flex: 1,
  },
  templateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  listVisual: {
    width: 96,
  },
  templateCopy: {
    flex: 1,
    gap: 4,
  },
  templateTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  templateTagChip: {
    minHeight: 24,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  templateTagChipText: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.45,
  },
  templateName: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  templateMeta: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  templateSupporting: {
    color: colors.textPrimary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  templateSecondaryMeta: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  tradeoffLine: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  customActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  readyActions: {
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  startPill: {
    minHeight: 42,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  startPillText: {
    fontSize: 13,
    fontWeight: '900',
  },
  comparePill: {
    minHeight: 34,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(18, 24, 33, 0.62)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  comparePillActive: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderColor: 'rgba(255,255,255,0.20)',
  },
  comparePillText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '900',
  },
  comparePillTextActive: {
    color: colors.textPrimary,
  },
  featuredReadyList: {
    gap: spacing.sm,
  },
  featuredReadyCard: {
    gap: spacing.sm,
  },
  featuredReadyMainTap: {
    gap: spacing.sm,
  },
  featuredReadyPhoto: {
    height: 184,
    borderRadius: radii.md,
  },
  featuredReadyVisual: {
    width: 104,
  },
  featuredReadyCopy: {
    gap: 6,
  },
  featuredReadyChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  featuredReadyChip: {
    minHeight: 28,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  featuredReadyChipText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  featuredReadyName: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.7,
  },
  featuredReadyMeta: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  featuredReadyBody: {
    color: colors.textPrimary,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
  },
  featuredReadyTradeoff: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  featuredReadyActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  featuredStartButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F7FF',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
  },
  featuredStartButtonText: {
    color: '#06080B',
    fontSize: 13,
    fontWeight: '900',
  },
  libraryGateCard: {
    gap: spacing.sm,
  },
  libraryGateKicker: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  libraryGateTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '900',
  },
  libraryGateBody: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  libraryGateButton: {
    minHeight: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F7FF',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
  },
  libraryGateButtonText: {
    color: '#06080B',
    fontSize: 13,
    fontWeight: '900',
  },
  currentPill: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderColor: 'rgba(255,255,255,0.22)',
  },
  currentPillText: {
    color: '#FFFFFF',
  },
  compareCard: {
    gap: spacing.sm,
  },
  compareTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  compareGrid: {
    gap: spacing.sm,
  },
  compareColumn: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(18, 24, 33, 0.58)',
    padding: spacing.md,
    gap: spacing.xs,
  },
  compareName: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '900',
  },
  compareMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  compareBody: {
    color: colors.textPrimary,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  compareSupport: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  compareTradeoff: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  compareRemove: {
    alignSelf: 'flex-start',
    minHeight: 32,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(11, 15, 20, 0.34)',
  },
  compareRemoveText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
  },
  menuButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(18, 24, 33, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  menuButtonText: {
    color: colors.textPrimary,
    fontSize: 18,
    lineHeight: 18,
    fontWeight: '900',
    marginTop: -4,
  },
  sheetOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  sheet: {
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    backgroundColor: 'rgba(12, 17, 24, 0.98)',
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  sheetTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '900',
    marginBottom: spacing.xs,
  },
  sheetRow: {
    minHeight: 48,
    justifyContent: 'center',
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
  },
  sheetRowText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  deleteText: {
    color: colors.danger,
  },
});

