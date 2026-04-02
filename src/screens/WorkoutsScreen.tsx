import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useEffect } from 'react';

import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { SectionHeaderBlock, SurfaceCard } from '../components/MainScreenPrimitives';
import { ScreenHeader } from '../components/ScreenHeader';
import { WorkoutSceneGraphic } from '../components/WorkoutSceneGraphic';
import { WorkoutPhasePreview } from '../components/WorkoutPhasePreview';
import { CORE_WORKOUT_TEMPLATE_ID } from '../features/workout/workoutCatalog';
import { useWorkoutContext } from '../features/workout/WorkoutProvider';
import { formatWorkoutDisplayLabel } from '../lib/displayLabel';
import { formatShortDate, pluralize } from '../lib/format';
import { getReadyProgramCollection, READY_PROGRAM_COLLECTIONS } from '../lib/readyProgramCollections';
import { getReadyProgramContent } from '../lib/readyProgramContent';
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
    borderColor: 'rgba(191, 74, 105, 0.24)',
    accentColor: colors.feature,
    orbColor: 'rgba(191, 74, 105, 0.16)',
    startBackground: 'rgba(191, 74, 105, 0.42)',
    startBorder: 'rgba(231, 116, 150, 0.48)',
    startText: '#FFF7FB',
  },
  {
    borderColor: 'rgba(162, 54, 18, 0.28)',
    accentColor: colors.warning,
    orbColor: 'rgba(162, 54, 18, 0.18)',
    startBackground: 'rgba(162, 54, 18, 0.44)',
    startBorder: 'rgba(240, 106, 57, 0.46)',
    startText: '#FFF5F0',
  },
  {
    borderColor: 'rgba(85, 138, 189, 0.26)',
    accentColor: colors.accent,
    orbColor: 'rgba(85, 138, 189, 0.18)',
    startBackground: 'rgba(85, 138, 189, 0.42)',
    startBorder: 'rgba(135, 198, 255, 0.44)',
    startText: '#F4FAFF',
  },
];

const readyCardVariants: CardVariant[] = [
  {
    borderColor: 'rgba(85, 138, 189, 0.24)',
    accentColor: colors.accent,
    orbColor: 'rgba(85, 138, 189, 0.14)',
    startBackground: 'rgba(85, 138, 189, 0.40)',
    startBorder: 'rgba(135, 198, 255, 0.42)',
    startText: '#F4FAFF',
  },
  {
    borderColor: 'rgba(85, 138, 189, 0.24)',
    accentColor: colors.accent,
    orbColor: 'rgba(162, 54, 18, 0.09)',
    startBackground: 'rgba(162, 54, 18, 0.42)',
    startBorder: 'rgba(240, 106, 57, 0.44)',
    startText: '#FFF5F0',
  },
  {
    borderColor: 'rgba(85, 138, 189, 0.24)',
    accentColor: colors.accentPressed,
    orbColor: 'rgba(191, 74, 105, 0.08)',
    startBackground: 'rgba(191, 74, 105, 0.40)',
    startBorder: 'rgba(231, 116, 150, 0.42)',
    startText: '#FFF7FB',
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

  const menuTemplate = customWorkouts.find((template) => template.id === menuTemplateId) ?? null;
  const confirmDeleteTemplate = customWorkouts.find((template) => template.id === confirmDeleteTemplateId) ?? null;
  const recommendedReadyTemplate = recommendedReadyProgramId
    ? templates.find((template) => template.id === recommendedReadyProgramId) ?? null
    : null;
  const recommendedReadyInsight = recommendedReadyTemplate
    ? programInsightsByTemplateId[recommendedReadyTemplate.id]
    : null;
  const recommendedReadyContent = recommendedReadyTemplate
    ? getReadyProgramContent(recommendedReadyTemplate.id)
    : null;
  const recommendedKickoffSession = recommendedReadyTemplate?.sessions[0] ?? null;
  const recommendedKickoffExercises = recommendedKickoffSession?.exercises.slice(0, 3) ?? [];
  const recommendedKickoffPhasePreview = useMemo(
    () => (recommendedKickoffSession ? getWorkoutFlowPhasePreview(recommendedKickoffSession.exercises) : []),
    [recommendedKickoffSession],
  );
  useEffect(() => {
    setReadyEquipmentFilter(getDefaultReadyEquipmentFilter(tailoringPreferences));
  }, [tailoringPreferences?.setupEquipment]);

  const activeSessionPhasePreview = useMemo(
    () => (activeSession ? getWorkoutFlowPhasePreview(activeSession.exercises) : []),
    [activeSession],
  );
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

    return customWorkouts.filter((template) =>
      formatWorkoutDisplayLabel(template.name, 'Workout').toLowerCase().includes(normalizedQuery),
    );
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
  const featuredReadyItems = filteredReadyItems.slice(0, 3);
  const hiddenReadyCount = Math.max(filteredReadyItems.length - featuredReadyItems.length, 0);

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
        subtitle="Ready programs, your own splits, and one fast route back into logging."
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {activeSession ? (
          <SurfaceCard accent="blue" emphasis="hero" style={styles.activeCard}>
            <View style={styles.heroRow}>
              <View style={styles.activeHeroCopy}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.activeLabel}>Today workout</Text>
                  <View style={styles.statusChip}>
                    <Text style={styles.statusChipText}>Live</Text>
                  </View>
                </View>
                <Text style={styles.activeTitle}>{formatWorkoutDisplayLabel(activeSession.templateName, 'Workout')}</Text>
                <Text style={styles.activeMeta}>
                  {pluralize(activeSession.exercises.length, 'exercise')} | Started {formatShortDate(activeSession.startedAt)}
                </Text>
              </View>
              <WorkoutSceneGraphic variant="today" accent="blue" style={styles.heroVisual} />
            </View>

            <WorkoutPhasePreview phases={activeSessionPhasePreview} compact />

            <Pressable onPress={() => onOpenWorkout(activeSession.templateId)} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Resume workout</Text>
            </Pressable>
          </SurfaceCard>
        ) : null}

        {recommendedReadyTemplate ? (
          <SurfaceCard accent="blue" emphasis="hero" style={styles.nextPlanCard}>
            <View style={styles.heroRow}>
              <View style={styles.nextPlanHeaderCopy}>
                <Text style={styles.nextPlanKicker}>{activeSession ? 'Next plan after this' : 'Your next plan'}</Text>
                <Text style={styles.nextPlanTitle}>{formatWorkoutDisplayLabel(recommendedReadyTemplate.name, 'Workout')}</Text>
                <Text style={styles.nextPlanBody}>
                  {recommendedReadyContent?.summary ?? 'A ready plan set up to be the next fast start.'}
                </Text>
              </View>
              <View style={styles.nextPlanVisualStack}>
                <View style={styles.nextPlanBadgeStack}>
                  <View style={styles.nextPlanBadge}>
                    <Text style={styles.nextPlanBadgeText}>{recommendedReadyTemplate.daysPerWeek} days</Text>
                  </View>
                  <View style={styles.nextPlanBadgeMuted}>
                    <Text style={styles.nextPlanBadgeMutedText}>{recommendedReadyTemplate.estimatedSessionDuration} min</Text>
                  </View>
                </View>
                <WorkoutSceneGraphic variant="plan" accent="blue" style={styles.nextPlanVisual} />
              </View>
            </View>

            <WorkoutPhasePreview phases={recommendedKickoffPhasePreview} compact />

            <View style={styles.nextPlanSignalRow}>
              <View style={styles.nextPlanSignalCard}>
                <Text style={styles.nextPlanSignalLabel}>Starts with</Text>
                <Text style={styles.nextPlanSignalValue}>
                  {recommendedKickoffSession ? recommendedKickoffSession.name : 'Session 1'}
                </Text>
                <Text style={styles.nextPlanSignalMeta}>
                  {recommendedKickoffSession
                    ? `${recommendedKickoffSession.exercises.length} exercises`
                    : 'Open the first session fast'}
                </Text>
              </View>
              <View style={styles.nextPlanSignalCard}>
                <Text style={styles.nextPlanSignalLabel}>Why now</Text>
                <Text style={styles.nextPlanSignalValue}>
                  {recommendedReadyInsight?.cardPrimary ?? `${formatGoal(recommendedReadyTemplate.goalType)} focus`}
                </Text>
                <Text style={styles.nextPlanSignalMeta}>
                  {activeSession
                    ? 'Ready when the live workout is done.'
                    : `Built for ${formatLevel(recommendedReadyTemplate.level).toLowerCase()} lifters`}
                </Text>
              </View>
            </View>

            {recommendedKickoffExercises.length ? (
              <View style={styles.nextPlanExerciseRow}>
                {recommendedKickoffExercises.map((exercise, index) => (
                  <View key={exercise.id} style={styles.nextPlanExercisePill}>
                    <Text style={styles.nextPlanExerciseText}>
                      {index + 1}. {exercise.exerciseName}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={styles.nextPlanActionRow}>
              <Pressable
                onPress={() =>
                  activeSession ? onOpenReadyProgram(recommendedReadyTemplate.id) : onStartReadyProgram(recommendedReadyTemplate.id)
                }
                style={styles.nextPlanPrimaryButton}
              >
                <Text style={styles.nextPlanPrimaryButtonText}>
                  {activeSession ? 'Open next plan' : 'Start this plan'}
                </Text>
              </Pressable>
              <Pressable onPress={() => onOpenReadyProgram(recommendedReadyTemplate.id)} style={styles.nextPlanSecondaryButton}>
                <Text style={styles.nextPlanSecondaryButtonText}>See full plan</Text>
              </Pressable>
            </View>
          </SurfaceCard>
        ) : null}

        <SurfaceCard accent="orange" emphasis="standard" onPress={onCreateWorkout} style={styles.createCard}>
          <View style={styles.createTopRow}>
            <View style={styles.createCopy}>
              <Text style={styles.createKicker}>Own split</Text>
              <Text style={styles.createTitle}>Create your own workout</Text>
              <Text style={styles.createMeta}>Build a custom program with separate sessions, then open or start exactly what you need.</Text>
            </View>
            <WorkoutSceneGraphic variant="build" accent="orange" style={styles.createVisual} />
          </View>
          <View style={styles.secondaryPill}>
            <Text style={styles.secondaryPillText}>Create</Text>
          </View>
        </SurfaceCard>

        <SurfaceCard accent="blue" emphasis="flat" style={styles.discoveryCard}>
          <View style={styles.discoveryTopRow}>
            <View style={styles.discoveryCopy}>
              <Text style={styles.discoveryKicker}>Discovery</Text>
              <Text style={styles.discoveryTitle}>Narrow the field fast</Text>
            </View>
            <WorkoutSceneGraphic variant="search" accent="blue" compact style={styles.discoveryVisual} />
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

        {customWorkouts.length ? (
          <View style={styles.section}>
            <SectionHeaderBlock
            accent="orange"
            kicker="Custom"
            title="Your workouts"
            subtitle="Open, duplicate, edit, or start the exact split you want."
          />
            <View style={styles.list}>
              {filteredCustomWorkouts.map((template, index) => {
                const variant = getVariant(customCardVariants, index);
                const insights = programInsightsByTemplateId[template.id];
                return (
                  <View key={template.id} style={[styles.customCard, { borderColor: variant.borderColor }]}>
                    <Pressable onPress={() => onOpenCustomProgram(template.id)} style={styles.templateMainTap}>
                      <View style={styles.templateRow}>
                        <WorkoutSceneGraphic variant="build" accent={index % 2 === 0 ? 'rose' : 'orange'} compact style={styles.listVisual} />
                        <View style={styles.templateCopy}>
                          <Text style={styles.templateName}>{formatWorkoutDisplayLabel(template.name, 'Workout')}</Text>
                          <Text style={styles.templateMeta}>
                            {pluralize(template.sessionCount, 'session')} | {pluralize(template.exerciseCount, 'exercise')}
                          </Text>
                          <Text style={styles.templateSupporting}>
                            {insights?.cardPrimary ?? 'Open the split or start the exact session you want.'}
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
            {!filteredCustomWorkouts.length ? (
              <EmptyState
                title="No custom workouts match this search"
                description="Try a broader search or open the ready library instead."
              />
            ) : null}
          </View>
        ) : null}

        <View style={styles.section}>
          <SectionHeaderBlock
            accent="blue"
            kicker="Ready"
            title="Templates"
            subtitle="Filter by goal, inspect the plan, then start the exact session you want."
          />

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
              <SurfaceCard accent="blue" emphasis="flat" style={styles.collectionCard}>
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
            <SurfaceCard accent="blue" emphasis="flat" style={styles.compareCard}>
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

          {featuredReadyItems.length ? (
            <View style={styles.featuredReadyList}>
              {featuredReadyItems.map((item, index) => {
                const { template, content } = item;
                const current = template.id === activeTemplateId;
                const comparing = compareTemplateIds.includes(template.id);
                const firstSession = template.sessions[0] ?? null;
                const phasePreview = firstSession ? getWorkoutFlowPhasePreview(firstSession.exercises) : [];
                const insight = programInsightsByTemplateId[template.id];
                const visualVariant = index === 0 ? 'plan' : index === 1 ? 'today' : 'browse';

                return (
                  <SurfaceCard
                    key={`featured:${template.id}`}
                    accent="blue"
                    emphasis="flat"
                    style={[styles.featuredReadyCard, current && styles.templateCardActive]}
                  >
                    <Pressable onPress={() => onOpenReadyProgram(template.id)} style={styles.featuredReadyMainTap}>
                      <View style={styles.featuredReadyTopRow}>
                        <WorkoutSceneGraphic variant={visualVariant} accent="blue" compact style={styles.featuredReadyVisual} />
                        <View style={styles.featuredReadyCopy}>
                          <Text style={styles.featuredReadyName}>{formatWorkoutDisplayLabel(template.name, 'Workout')}</Text>
                          <Text style={styles.featuredReadyMeta}>
                            {template.daysPerWeek} days | {template.estimatedSessionDuration} min | {formatLevel(template.level)}
                          </Text>
                          <Text style={styles.featuredReadyBody}>
                            {content?.audience ?? `${template.sessions.length} sessions with repeatable progression.`}
                          </Text>
                          <Text style={styles.featuredReadyTradeoff}>{getReadyProgramTradeoff(template.id)}</Text>
                        </View>
                      </View>

                      {phasePreview.length ? <WorkoutPhasePreview phases={phasePreview} compact /> : null}
                    </Pressable>

                    <View style={styles.featuredReadyActions}>
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
            <SurfaceCard accent="blue" emphasis="flat" style={styles.libraryGateCard}>
              <Text style={styles.libraryGateKicker}>Library</Text>
              <Text style={styles.libraryGateTitle}>Keep the page curated first</Text>
              <Text style={styles.libraryGateBody}>
                Showing the strongest matches first. Open the full library only when you want the whole list.
              </Text>
              <Pressable onPress={() => setShowReadyLibrary(true)} style={styles.libraryGateButton}>
                <Text style={styles.libraryGateButtonText}>Show all {filteredReadyItems.length} ready plans</Text>
              </Pressable>
            </SurfaceCard>
          ) : null}

          {filteredReadyItems.length ? (
            showReadyLibrary ? (
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
                      { borderColor: current ? 'rgba(85, 138, 189, 0.26)' : variant.borderColor },
                      current && styles.templateCardActive,
                    ]}
                  >
                    <Pressable onPress={() => onOpenReadyProgram(template.id)} style={styles.templateMainTap}>
                      <View style={styles.templateRow}>
                        <WorkoutSceneGraphic variant="plan" accent="blue" compact style={styles.listVisual} />
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
            ) : null
          ) : (
            <EmptyState
              title="No ready plans match these filters"
              description="Try a broader search or switch one of the discovery filters."
            />
          )}
        </View>
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
    borderColor: 'rgba(85, 138, 189, 0.25)',
    backgroundColor: 'rgba(18, 24, 33, 0.88)',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  nextPlanCard: {
    overflow: 'hidden',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(85, 138, 189, 0.26)',
    backgroundColor: 'rgba(18, 24, 33, 0.88)',
    padding: spacing.xl,
    gap: spacing.md,
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
  activeHeroCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  nextPlanHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  nextPlanVisualStack: {
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  nextPlanVisual: {
    width: 120,
    height: 96,
  },
  nextPlanKicker: {
    color: '#9ACCFF',
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
  nextPlanBody: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  nextPlanBadgeStack: {
    gap: spacing.xs,
    alignItems: 'flex-end',
  },
  nextPlanBadge: {
    minHeight: 28,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(150, 216, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(150, 216, 255, 0.30)',
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
    backgroundColor: 'rgba(11, 15, 20, 0.48)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  nextPlanBadgeMutedText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
  },
  nextPlanSignalRow: {
    gap: spacing.sm,
  },
  nextPlanSignalCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(85, 138, 189, 0.18)',
    backgroundColor: 'rgba(10, 15, 21, 0.34)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 3,
  },
  nextPlanSignalLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  nextPlanSignalValue: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '900',
  },
  nextPlanSignalMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  nextPlanExerciseRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  nextPlanExercisePill: {
    minHeight: 30,
    maxWidth: '100%',
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    justifyContent: 'center',
    backgroundColor: 'rgba(11, 15, 20, 0.44)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  nextPlanExerciseText: {
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
    backgroundColor: colors.accentAlt,
    borderWidth: 1,
    borderColor: 'rgba(85, 138, 189, 0.34)',
  },
  nextPlanPrimaryButtonText: {
    color: '#081019',
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
    borderColor: 'rgba(85, 138, 189, 0.18)',
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
    borderColor: 'rgba(162, 54, 18, 0.24)',
    backgroundColor: 'rgba(18, 24, 33, 0.86)',
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
    color: colors.accent,
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
    backgroundColor: colors.featureSoft,
    borderWidth: 1,
    borderColor: 'rgba(191, 74, 105, 0.24)',
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
    backgroundColor: colors.accentAlt,
    borderWidth: 1,
    borderColor: 'rgba(85, 138, 189, 0.34)',
  },
  primaryButtonText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '900',
  },
  createCopy: {
    flex: 1,
    gap: 4,
  },
  createKicker: {
    color: colors.warning,
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
    backgroundColor: 'rgba(162, 54, 18, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(162, 54, 18, 0.28)',
  },
  secondaryPillText: {
    color: '#E37A58',
    fontSize: 13,
    fontWeight: '800',
  },
  section: {
    gap: spacing.md,
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
    color: colors.accent,
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionKickerOrange: {
    color: colors.warning,
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
    color: '#9ACCFF',
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
    color: '#9ACCFF',
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
    borderColor: 'rgba(85, 138, 189, 0.18)',
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
    backgroundColor: colors.accentSoft,
    borderColor: 'rgba(85, 138, 189, 0.3)',
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
    backgroundColor: 'rgba(18, 24, 33, 0.82)',
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
    backgroundColor: 'rgba(18, 24, 33, 0.84)',
    padding: spacing.lg,
  },
  templateCardActive: {
    backgroundColor: 'rgba(20, 29, 39, 0.92)',
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
    color: '#FFD4C3',
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
    borderColor: 'rgba(85, 138, 189, 0.24)',
  },
  comparePillActive: {
    backgroundColor: 'rgba(85, 138, 189, 0.18)',
    borderColor: 'rgba(85, 138, 189, 0.38)',
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
  featuredReadyTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  featuredReadyVisual: {
    width: 104,
  },
  featuredReadyCopy: {
    flex: 1,
    gap: 4,
  },
  featuredReadyName: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  featuredReadyMeta: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  featuredReadyBody: {
    color: colors.textPrimary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  featuredReadyTradeoff: {
    color: '#FFD4C3',
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
    backgroundColor: 'rgba(85, 138, 189, 0.42)',
    borderWidth: 1,
    borderColor: 'rgba(135, 198, 255, 0.44)',
  },
  featuredStartButtonText: {
    color: '#F4FAFF',
    fontSize: 13,
    fontWeight: '900',
  },
  libraryGateCard: {
    gap: spacing.sm,
  },
  libraryGateKicker: {
    color: '#9ACCFF',
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
    backgroundColor: 'rgba(150, 216, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(150, 216, 255, 0.30)',
  },
  libraryGateButtonText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '900',
  },
  currentPill: {
    backgroundColor: '#96D8FF',
    borderColor: 'rgba(255,255,255,0.22)',
  },
  currentPillText: {
    color: '#0B141D',
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
    borderColor: 'rgba(85, 138, 189, 0.16)',
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
    color: '#9ACCFF',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  compareTradeoff: {
    color: '#FFD4C3',
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
    borderColor: 'rgba(85, 138, 189, 0.2)',
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

