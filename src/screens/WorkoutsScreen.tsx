import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useEffect } from 'react';

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
  getDefaultReadyEquipmentFilter,
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
  const [readyEquipmentFilter, setReadyEquipmentFilter] = useState<ReadyEquipmentFilter>(
    getDefaultReadyEquipmentFilter(tailoringPreferences),
  );
  const [readyLevelFilter, setReadyLevelFilter] = useState<ReadyLevelFilter>('all');
  const [compareTemplateIds, setCompareTemplateIds] = useState<string[]>([]);
  const [showReadyLibrary, setShowReadyLibrary] = useState(false);
  const [showAllCustomWorkouts, setShowAllCustomWorkouts] = useState(false);
  const [showBrowseWorkouts, setShowBrowseWorkouts] = useState(false);

  const menuTemplate = customWorkouts.find((template) => template.id === menuTemplateId) ?? null;
  const confirmDeleteTemplate = customWorkouts.find((template) => template.id === confirmDeleteTemplateId) ?? null;
  const recommendedReadyTemplate = recommendedReadyProgramId
    ? templates.find((template) => template.id === recommendedReadyProgramId) ?? null
    : null;
  const recommendedKickoffSession = recommendedReadyTemplate?.sessions[0] ?? null;
  useEffect(() => {
    setReadyEquipmentFilter(getDefaultReadyEquipmentFilter(tailoringPreferences));
  }, [tailoringPreferences?.setupEquipment]);

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
      <ScreenHeader
        title="Workout"
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {activeSession ? (
          <SurfaceCard accent="neutral" emphasis="hero" style={styles.activeCard}>
            <Text style={styles.nextPlanKicker}>Today</Text>

            <View style={styles.nextPlanTokenRow}>
              <View style={styles.statusChip}>
                <Text style={styles.statusChipText}>Live</Text>
              </View>
              <View style={styles.nextPlanBadgeMuted}>
                <Text style={styles.nextPlanBadgeMutedText}>{activeSessionDurationMinutes} min</Text>
              </View>
            </View>

            <View style={styles.nextPlanHeaderCopy}>
              <Text style={styles.nextPlanTitle}>{formatWorkoutDisplayLabel(activeSession.templateName, 'Workout')}</Text>
            </View>

            <Pressable onPress={() => onOpenWorkout(activeSession.templateId)} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Resume workout</Text>
            </Pressable>
          </SurfaceCard>
        ) : recommendedReadyTemplate ? (
          <SurfaceCard accent="neutral" emphasis="hero" style={styles.nextPlanCard}>
            <Text style={styles.nextPlanKicker}>Today</Text>

            <View style={styles.nextPlanTokenRow}>
              <View style={styles.nextPlanBadge}>
                <Text style={styles.nextPlanBadgeText}>{formatLevel(recommendedReadyTemplate.level)}</Text>
              </View>
              <View style={styles.nextPlanBadgeMuted}>
                <Text style={styles.nextPlanBadgeMutedText}>{recommendedReadyTemplate.daysPerWeek} days</Text>
              </View>
            </View>

            <View style={styles.nextPlanHeaderCopy}>
              <Text style={styles.nextPlanTitle}>{getReadyTemplatePresentation(recommendedReadyTemplate).title}</Text>
              <Text style={styles.nextPlanMetaLine}>{getReadyTemplatePresentation(recommendedReadyTemplate).subtitle}</Text>
              <Text style={styles.nextPlanDuration}>{recommendedReadyTemplate.estimatedSessionDuration} min</Text>
            </View>

            <View style={styles.nextPlanActionRow}>
              <Pressable
                onPress={() => onStartReadyProgram(recommendedReadyTemplate.id)}
                style={styles.nextPlanPrimaryButton}
              >
                <Text style={styles.nextPlanPrimaryButtonText}>Start workout</Text>
              </Pressable>
            </View>
          </SurfaceCard>
        ) : primaryCustomWorkout ? (
          <SurfaceCard accent="neutral" emphasis="hero" style={styles.nextPlanCard}>
            <Text style={styles.nextPlanKicker}>Today</Text>

            <View style={styles.nextPlanTokenRow}>
              <View style={styles.nextPlanBadge}>
                <Text style={styles.nextPlanBadgeText}>Custom</Text>
              </View>
              <View style={styles.nextPlanBadgeMuted}>
                <Text style={styles.nextPlanBadgeMutedText}>
                  {pluralize(primaryCustomWorkout.sessionCount, 'session')}
                </Text>
              </View>
            </View>

            <View style={styles.nextPlanHeaderCopy}>
              <Text style={styles.nextPlanTitle}>{getCustomTemplatePresentation(primaryCustomWorkout).title}</Text>
              <Text style={styles.nextPlanMetaLine}>{getCustomTemplatePresentation(primaryCustomWorkout).subtitle}</Text>
              <Text style={styles.nextPlanDuration}>
                {pluralize(primaryCustomWorkout.exerciseCount, 'exercise')}
              </Text>
            </View>

            <View style={styles.nextPlanActionRow}>
              <Pressable
                onPress={() =>
                  primaryCustomWorkout.sessionCount <= 1
                    ? onStartCustomWorkout(primaryCustomWorkout.id)
                    : onOpenCustomProgram(primaryCustomWorkout.id)
                }
                style={styles.nextPlanPrimaryButton}
              >
                <Text style={styles.nextPlanPrimaryButtonText}>
                  {primaryCustomWorkout.sessionCount <= 1 ? 'Start workout' : 'Open workout'}
                </Text>
              </Pressable>
            </View>
          </SurfaceCard>
        ) : null}

        {todayFlowItems.length ? (
          <View style={styles.section}>
            <Text style={styles.todayFlowLabel}>Today flow</Text>
            <View style={styles.todayFlowList}>
              {todayFlowItems.map((item, index) => (
                <React.Fragment key={`${item.label}:${item.title}`}>
                  <SurfaceCard
                    accent="neutral"
                    emphasis="flat"
                    style={[styles.todayFlowCard, index === 0 && styles.todayFlowCardActive]}
                  >
                    <Text style={styles.todayFlowCardLabel}>{item.label}</Text>
                    <Text style={styles.todayFlowCardTitle}>{item.title}</Text>
                    <Text style={styles.todayFlowCardMeta}>{item.meta}</Text>
                  </SurfaceCard>
                  {index < todayFlowItems.length - 1 ? <Text style={styles.todayFlowConnector}>↓</Text> : null}
                </React.Fragment>
              ))}
            </View>
          </View>
        ) : null}

        {collapsedWorkoutShortcuts.length ? (
          <View style={styles.section}>
            <View style={styles.collapsedHeader}>
              <Text style={styles.todayFlowLabel}>Your workouts</Text>
              <Pressable onPress={() => setShowBrowseWorkouts((current) => !current)}>
                <Text style={styles.collapsedActionText}>{showBrowseWorkouts ? 'Hide' : 'Browse all'}</Text>
              </Pressable>
            </View>
            <View style={styles.collapsedWorkoutRow}>
              {collapsedWorkoutShortcuts.map((template) => (
                <Pressable
                  key={template.id}
                  onPress={() => onOpenCustomProgram(template.id)}
                  style={styles.collapsedWorkoutChip}
                >
                  <Text style={styles.collapsedWorkoutChipText}>
                    {getCustomTemplatePresentation(template).title}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {showBrowseWorkouts ? (
          <>
        <SurfaceCard accent="neutral" emphasis="standard" onPress={onCreateWorkout} style={styles.createCard}>
          <View style={styles.createTopRow}>
            <View style={styles.createCopy}>
              <Text style={styles.createKicker}>Own template</Text>
              <Text style={styles.createTitle}>Create your own split</Text>
              <Text style={styles.createMeta}>Build a reusable weekly template and keep every session editable.</Text>
            </View>
          </View>
          <View style={styles.secondaryPill}>
            <Text style={styles.secondaryPillText}>Create template</Text>
          </View>
        </SurfaceCard>

        {customWorkouts.length ? (
          <View style={styles.section}>
            <SectionHeaderBlock
              accent="neutral"
            kicker="Custom"
            title="Your workouts"
            subtitle="Open the split you already know or build a new one."
          />
            <View style={styles.list}>
              {visibleCustomWorkouts.map((template, index) => {
                const variant = getVariant(customCardVariants, index);
                const insights = programInsightsByTemplateId[template.id];
                const presentation = getCustomTemplatePresentation(template);
                return (
                  <View key={template.id} style={[styles.customCard, { borderColor: variant.borderColor }]}>
                    <Pressable onPress={() => onOpenCustomProgram(template.id)} style={styles.templateMainTap}>
                      <View style={styles.templateRow}>
                        <View style={styles.templateCopy}>
                          <View style={styles.templateTagRow}>
                            {presentation.tags.map((tag) => (
                              <View key={`${template.id}:${tag}`} style={styles.templateTagChip}>
                                <Text style={styles.templateTagChipText}>{tag}</Text>
                              </View>
                            ))}
                          </View>
                          <Text style={styles.templateName}>{presentation.title}</Text>
                          <Text style={styles.templateMeta}>
                            {pluralize(template.sessionCount, 'session')} | {pluralize(template.exerciseCount, 'exercise')}
                          </Text>
                          <Text style={styles.templateSupporting}>
                            {insights?.cardPrimary ?? presentation.subtitle}
                          </Text>
                          <Text style={styles.templateSecondaryMeta}>
                            {insights?.cardSecondary ?? `Updated ${formatShortDate(template.updatedAt)}`}
                          </Text>
                        </View>
                      </View>
                    </Pressable>
                    <View style={styles.customActions}>
                      <Pressable
                        onPress={() => onStartCustomWorkout(template.id)}
                        style={[styles.startPill, { backgroundColor: variant.startBackground, borderColor: variant.startBorder }]}
                      >
                        <Text style={[styles.startPillText, { color: variant.startText }]}>Start</Text>
                      </Pressable>
                      <Pressable onPress={() => setMenuTemplateId(template.id)} hitSlop={10} style={styles.menuButton}>
                        <Text style={styles.menuButtonText}>...</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
            {hiddenCustomWorkoutCount > 0 ? (
              <Pressable onPress={() => setShowAllCustomWorkouts(true)} style={styles.showMoreButton}>
                <Text style={styles.showMoreButtonText}>See all {filteredCustomWorkouts.length} workouts</Text>
              </Pressable>
            ) : null}
            {!filteredCustomWorkouts.length ? (
              <EmptyState
                title="No custom workouts match this search"
                description="Try a broader search or open the ready library instead."
              />
            ) : null}
          </View>
        ) : null}

        <View style={styles.section}>
          {shouldShowFeaturedReady ? (
            <SectionHeaderBlock
              accent="neutral"
              kicker="Ready"
              title="Featured plans"
              subtitle="Start with the clearest matches first."
            />
          ) : null}

          {shouldShowFeaturedReady && featuredReadyItems.length ? (
            <View style={styles.featuredReadyList}>
              {featuredReadyItems.map((item, index) => {
                const { template, content } = item;
                const current = template.id === activeTemplateId;
                const firstSession = template.sessions[0] ?? null;
                const phasePreview = firstSession ? getWorkoutFlowPhasePreview(firstSession.exercises) : [];
                const insight = programInsightsByTemplateId[template.id];
                const presentation = getReadyTemplatePresentation(template);

                return (
                  <SurfaceCard
                    key={`featured:${template.id}`}
                    accent="neutral"
                    emphasis="flat"
                    style={[styles.featuredReadyCard, current && styles.templateCardActive]}
                  >
                    <Pressable onPress={() => onOpenReadyProgram(template.id)} style={styles.featuredReadyMainTap}>
                      <View style={styles.featuredReadyCopy}>
                      <View style={styles.featuredReadyChipRow}>
                        {presentation.tags.map((tag) => (
                          <View key={`${template.id}:${tag}`} style={styles.featuredReadyChip}>
                            <Text style={styles.featuredReadyChipText}>{tag}</Text>
                          </View>
                        ))}
                        </View>
                        <Text style={styles.featuredReadyName}>{presentation.title}</Text>
                        <Text style={styles.featuredReadyMeta}>{presentation.subtitle}</Text>
                        <Text style={styles.featuredReadyBody}>{template.estimatedSessionDuration} min · {template.daysPerWeek} days</Text>
                      </View>

                      {phasePreview.length ? <WorkoutPhasePreview phases={phasePreview} compact /> : null}
                    </Pressable>

                    <View style={styles.featuredReadyActions}>
                      <Pressable
                        onPress={() => onStartReadyProgram(template.id)}
                        style={[styles.featuredStartButton, current && styles.currentPill]}
                      >
                        <Text style={[styles.featuredStartButtonText, current && styles.currentPillText]}>
                          {current ? 'Current' : 'Start'}
                        </Text>
                      </Pressable>
                    </View>
                  </SurfaceCard>
                );
              })}
            </View>
          ) : null}

          {!showReadyLibrary && hiddenReadyCount > 0 ? (
            <SurfaceCard accent="neutral" emphasis="flat" style={styles.libraryGateCard}>
              <Text style={styles.libraryGateKicker}>Library</Text>
              <Text style={styles.libraryGateTitle}>Browse the full library only when you need it</Text>
              <Text style={styles.libraryGateBody}>
                Keep this page focused. Open filters and the full ready-plan list only when you want more detail.
              </Text>
              <Pressable onPress={() => setShowReadyLibrary(true)} style={styles.libraryGateButton}>
                <Text style={styles.libraryGateButtonText}>Browse all {filteredReadyItems.length} ready plans</Text>
              </Pressable>
            </SurfaceCard>
          ) : null}

          {showReadyLibrary ? (
            <>
              <SurfaceCard accent="neutral" emphasis="flat" style={styles.discoveryCard}>
                <View style={styles.discoveryTopRow}>
                  <View style={styles.discoveryCopy}>
                    <Text style={styles.discoveryKicker}>Discovery</Text>
                    <Text style={styles.discoveryTitle}>Narrow the field fast</Text>
                  </View>
                </View>
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search ready plans or your workouts"
                  placeholderTextColor={colors.textMuted}
                  selectionColor={colors.accentAlt}
                  style={styles.searchInput}
                />
                <Text style={styles.discoveryMeta}>
                  {filteredReadyItems.length} ready {filteredReadyItems.length === 1 ? 'plan' : 'plans'} {'\u00b7'} {filteredCustomWorkouts.length}{' '}
                  custom {filteredCustomWorkouts.length === 1 ? 'workout' : 'workouts'}
                </Text>
              </SurfaceCard>

              <View style={styles.collectionSection}>
                <Text style={styles.collectionLabel}>Recommended for</Text>
                <View style={styles.filterRow}>
                  <Pressable
                    onPress={() => setReadyCollectionFilter('all')}
                    style={[styles.filterChip, readyCollectionFilter === 'all' && styles.filterChipActive]}
                  >
                    <Text style={[styles.filterChipText, readyCollectionFilter === 'all' && styles.filterChipTextActive]}>All programs</Text>
                  </Pressable>
                  {READY_PROGRAM_COLLECTIONS.map((collection) => {
                    const active = collection.key === readyCollectionFilter;
                    return (
                      <Pressable
                        key={collection.key}
                        onPress={() => setReadyCollectionFilter(collection.key as ReadyCollectionFilter)}
                        style={[styles.filterChip, active && styles.filterChipActive]}
                      >
                        <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{collection.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                {selectedCollection ? (
                  <SurfaceCard accent="neutral" emphasis="flat" style={styles.collectionCard}>
                    <Text style={styles.collectionTitle}>{selectedCollection.label}</Text>
                    <Text style={styles.collectionBody}>{selectedCollection.description}</Text>
                    <Text style={styles.collectionRecommendation}>{selectedCollection.recommendedFor}</Text>
                  </SurfaceCard>
                ) : null}
              </View>

              <View style={styles.filterSection}>
                <Text style={styles.collectionLabel}>Time</Text>
                <View style={styles.filterRow}>
                  {READY_TIME_FILTERS.map((filter) => {
                    const active = filter.key === readyTimeFilter;
                    return (
                      <Pressable
                        key={filter.key}
                        onPress={() => setReadyTimeFilter(filter.key)}
                        style={[styles.filterChip, active && styles.filterChipActive]}
                      >
                        <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{filter.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.filterSection}>
                <Text style={styles.collectionLabel}>Equipment</Text>
                <View style={styles.filterRow}>
                  {READY_EQUIPMENT_FILTERS.map((filter) => {
                    const active = filter.key === readyEquipmentFilter;
                    return (
                      <Pressable
                        key={filter.key}
                        onPress={() => setReadyEquipmentFilter(filter.key)}
                        style={[styles.filterChip, active && styles.filterChipActive]}
                      >
                        <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{filter.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.filterSection}>
                <Text style={styles.collectionLabel}>Experience</Text>
                <View style={styles.filterRow}>
                  {READY_LEVEL_FILTERS.map((filter) => {
                    const active = filter.key === readyLevelFilter;
                    return (
                      <Pressable
                        key={filter.key}
                        onPress={() => setReadyLevelFilter(filter.key)}
                        style={[styles.filterChip, active && styles.filterChipActive]}
                      >
                        <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{filter.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {compareItems.length ? (
                <SurfaceCard accent="neutral" emphasis="flat" style={styles.compareCard}>
                  <Text style={styles.collectionLabel}>Compare</Text>
                  <Text style={styles.compareTitle}>
                    {compareItems.length === 1 ? 'Pick one more plan to compare.' : 'Quick tradeoffs side by side'}
                  </Text>
                  <View style={styles.compareGrid}>
                    {compareItems.map((item) => (
                      <View key={item.template.id} style={styles.compareColumn}>
                        <Text style={styles.compareName}>{formatWorkoutDisplayLabel(item.template.name, 'Workout')}</Text>
                        <Text style={styles.compareMeta}>
                          {item.template.daysPerWeek} days {'\u00b7'} {item.template.estimatedSessionDuration} min {'\u00b7'} {formatLevel(item.template.level)}
                        </Text>
                        <Text style={styles.compareBody}>
                          {item.content?.audience ?? 'Built as a ready plan you can inspect before starting.'}
                        </Text>
                        <Text style={styles.compareSupport}>{getReadyProgramEquipmentLabel(item)}</Text>
                        <Text style={styles.compareTradeoff}>{getReadyProgramTradeoff(item.template.id)}</Text>
                        <Pressable onPress={() => toggleCompareTemplate(item.template.id)} style={styles.compareRemove}>
                          <Text style={styles.compareRemoveText}>Remove</Text>
                        </Pressable>
                      </View>
                    ))}
                  </View>
                </SurfaceCard>
              ) : null}

              <View style={styles.filterRow}>
                {READY_GOAL_FILTERS.map((filter) => {
                  const active = filter.key === readyGoalFilter;
                  return (
                    <Pressable
                      key={filter.key}
                      onPress={() => setReadyGoalFilter(filter.key)}
                      style={[styles.filterChip, active && styles.filterChipActive]}
                    >
                      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{filter.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {filteredReadyItems.length ? (
            <View style={styles.list}>
              {filteredReadyItems.map((item, index) => {
                const { template, content } = item;
                const current = template.id === activeTemplateId;
                const variant = getVariant(readyCardVariants, index);
                const insights = programInsightsByTemplateId[template.id];
                const comparing = compareTemplateIds.includes(template.id);
                return (
                  <View
                    key={template.id}
                    style={[
                      styles.templateCard,
                      { borderColor: current ? 'rgba(255,255,255,0.14)' : variant.borderColor },
                      current && styles.templateCardActive,
                    ]}
                  >
                    <Pressable onPress={() => onOpenReadyProgram(template.id)} style={styles.templateMainTap}>
                      <View style={styles.templateRow}>
                        <View style={styles.templateCopy}>
                          <Text style={styles.templateName}>{formatWorkoutDisplayLabel(template.name, 'Workout')}</Text>
                          <Text style={styles.templateMeta}>
                            {template.daysPerWeek} days | {formatGoal(template.goalType)} | {formatLevel(template.level)}
                          </Text>
                          <Text style={styles.templateSupporting}>
                            {content?.audience ?? `${template.sessions.length} sessions | ${template.estimatedSessionDuration} min`}
                          </Text>
                          <Text style={styles.templateSecondaryMeta}>
                            {insights?.cardPrimary ?? `${template.sessions.length} sessions | ${template.estimatedSessionDuration} min`}
                          </Text>
                          <Text style={styles.templateSecondaryMeta}>
                            {insights?.cardSecondary ?? `Equipment: ${content?.equipmentProfile ?? 'Gym ready'}`}
                          </Text>
                          <Text style={styles.tradeoffLine}>{getReadyProgramTradeoff(template.id)}</Text>
                        </View>
                      </View>
                    </Pressable>
                    <View style={styles.readyActions}>
                      <Pressable
                        onPress={() => toggleCompareTemplate(template.id)}
                        style={[styles.comparePill, comparing && styles.comparePillActive]}
                      >
                        <Text style={[styles.comparePillText, comparing && styles.comparePillTextActive]}>
                          {comparing ? 'Comparing' : 'Compare'}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => onStartReadyProgram(template.id)}
                        style={[
                          styles.startPill,
                          !current && { backgroundColor: variant.startBackground, borderColor: variant.startBorder },
                          current && styles.currentPill,
                        ]}
                      >
                        <Text style={[styles.startPillText, !current && { color: variant.startText }, current && styles.currentPillText]}>
                          Start
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
              ) : (
            <EmptyState
              title="No ready plans match these filters"
              description="Try a broader search or switch one of the discovery filters."
            />
              )}
            </>
          ) : null}
        </View>
          </>
        ) : null}
      </ScrollView>

      {menuTemplate ? (
        <View style={styles.sheetOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenuTemplateId(null)} />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{formatWorkoutDisplayLabel(menuTemplate.name)}</Text>
            <Pressable
              onPress={() => {
                setMenuTemplateId(null);
                onEditCustomWorkout(menuTemplate.id);
              }}
              style={styles.sheetRow}
            >
              <Text style={styles.sheetRowText}>Edit workout</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setMenuTemplateId(null);
                onDuplicateCustomWorkout(menuTemplate.id);
              }}
              style={styles.sheetRow}
            >
              <Text style={styles.sheetRowText}>Duplicate workout</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setMenuTemplateId(null);
                setConfirmDeleteTemplateId(menuTemplate.id);
              }}
              style={styles.sheetRow}
            >
              <Text style={[styles.sheetRowText, styles.deleteText]}>Delete workout</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <ConfirmDialog
        visible={Boolean(confirmDeleteTemplate)}
        title="Delete workout"
        message={confirmDeleteTemplate ? `Delete ${formatWorkoutDisplayLabel(confirmDeleteTemplate.name)}? This removes the template from the workout list.` : ''}
        confirmLabel="Delete"
        destructive
        onCancel={() => setConfirmDeleteTemplateId(null)}
        onConfirm={() => {
          if (confirmDeleteTemplate) {
            onDeleteCustomWorkout(confirmDeleteTemplate.id);
          }
          setConfirmDeleteTemplateId(null);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
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

