import React, { useMemo, useState } from 'react';
import { ImageBackground, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Barbell } from 'phosphor-react-native/lib/commonjs/icons/Barbell';
import { CalendarBlank } from 'phosphor-react-native/lib/commonjs/icons/CalendarBlank';
import { Clock } from 'phosphor-react-native/lib/commonjs/icons/Clock';
import { Fire } from 'phosphor-react-native/lib/commonjs/icons/Fire';
import { Heartbeat } from 'phosphor-react-native/lib/commonjs/icons/Heartbeat';
import { Lightning } from 'phosphor-react-native/lib/commonjs/icons/Lightning';
import { MagnifyingGlass } from 'phosphor-react-native/lib/commonjs/icons/MagnifyingGlass';
import { SlidersHorizontal } from 'phosphor-react-native/lib/commonjs/icons/SlidersHorizontal';
import { Target } from 'phosphor-react-native/lib/commonjs/icons/Target';
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
import { getReadyProgramContent } from '../lib/readyProgramContent';
import { getCustomTemplatePresentation, getReadyTemplatePresentation } from '../lib/templatePresentation';
import { getWorkoutFlowPhasePreview } from '../lib/workoutFlow';
import {
  buildReadyProgramSearchText,
  filterAndSortReadyDiscoveryItems,
  getReadyProgramEquipmentLabel,
  getReadyProgramTradeoff,
  ReadyDiscoveryItem,
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

type ReadyGoalFilter = 'all' | 'fat_loss' | 'strength' | 'hypertrophy' | 'general';
type TodayFlowItem = {
  label: 'Next' | 'Then' | 'Finish';
  title: string;
  meta: string;
};

const READY_GOAL_FILTERS: Array<{ key: ReadyGoalFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'fat_loss', label: 'Fat Loss' },
  { key: 'strength', label: 'Strength' },
  { key: 'hypertrophy', label: 'Hypertrophy' },
  { key: 'general', label: 'General Fitness' },
];

const READY_CATEGORY_SECTIONS: Array<{ key: Exclude<ReadyGoalFilter, 'all'>; title: string }> = [
  { key: 'hypertrophy', title: 'Hypertrophy' },
  { key: 'general', title: 'General Fitness' },
  { key: 'strength', title: 'Strength' },
  { key: 'fat_loss', title: 'Fat Loss' },
];

const READY_TEMPLATE_CARD_IMAGE = require('../../assets/fitness/selected/ready-template-card.jpg');

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

function ReadyGoalIcon({ filter, active }: { filter: ReadyGoalFilter; active: boolean }) {
  const color = active ? '#FFFFFF' : '#667085';
  const size = 18;

  if (filter === 'fat_loss') {
    return <Fire size={size} color={color} weight="bold" />;
  }

  if (filter === 'strength') {
    return <Barbell size={size} color={color} weight="bold" />;
  }

  if (filter === 'hypertrophy') {
    return <Target size={size} color={color} weight="bold" />;
  }

  if (filter === 'general') {
    return <Heartbeat size={size} color={color} weight="bold" />;
  }

  return null;
}

function isFatLossReadyItem(item: ReadyDiscoveryItem) {
  const searchText = buildReadyProgramSearchText(item);

  return ['fat', 'conditioning', 'hiit', 'cardio', 'runner', 'run', 'lean'].some((keyword) =>
    searchText.includes(keyword),
  );
}

function itemMatchesReadyCategory(item: ReadyDiscoveryItem, category: Exclude<ReadyGoalFilter, 'all'>) {
  if (category === 'fat_loss') {
    return isFatLossReadyItem(item);
  }

  return item.template.goalType === category;
}

function formatGoal(value: string) {
  return value ? value[0].toUpperCase() + value.slice(1) : value;
}

function formatLevel(value: string) {
  return value ? value[0].toUpperCase() + value.slice(1) : value;
}

function formatTemplateHeroLabel(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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
      return `${firstSet.plannedLoadKg} kg x ${formatReps(firstSet.plannedRepsMin, firstSet.plannedRepsMax)}`;
    }
    return `${exercise.sets.length} ${exercise.sets.length === 1 ? 'set' : 'sets'}`;
  }

  const templateExercise = exercise as WorkoutTemplateExercise;

  if (templateExercise.trackingMode === 'load_and_reps') {
    return `${templateExercise.sets} ${templateExercise.sets === 1 ? 'set' : 'sets'} - ${formatReps(templateExercise.repsMin, templateExercise.repsMax)} reps`;
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
  const [readyGoalFilter, setReadyGoalFilter] = useState<ReadyGoalFilter>('all');
  const [readyTimeFilter, setReadyTimeFilter] = useState<ReadyTimeFilter>('all');
  const [readyEquipmentFilter, setReadyEquipmentFilter] = useState<ReadyEquipmentFilter>('all');
  const [readyLevelFilter, setReadyLevelFilter] = useState<ReadyLevelFilter>('all');
  const [showAdvancedReadyFilters, setShowAdvancedReadyFilters] = useState(false);
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
  const readyDiscoveryItems = useMemo(() => {
    return templates.map((template) => ({
      template,
      content: getReadyProgramContent(template.id),
    }));
  }, [templates]);
  const filteredReadyItems = useMemo(
    () => {
      return filterAndSortReadyDiscoveryItems(
        readyDiscoveryItems,
        {
          query: searchQuery,
          goal: 'all',
          level: readyLevelFilter,
          time: readyTimeFilter,
          equipment: readyEquipmentFilter,
        },
        tailoringPreferences,
      );
    },
    [
      readyDiscoveryItems,
      readyEquipmentFilter,
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
  const allGainerProgramItems = readyDiscoveryItems.filter((item) => item.template.id.startsWith('tpl_gainer_'));
  const gainerProgramItems = filteredReadyItems.filter((item) => item.template.id.startsWith('tpl_gainer_'));
  const readyCategorySections = READY_CATEGORY_SECTIONS
    .filter((section) => readyGoalFilter === 'all' || readyGoalFilter === section.key)
    .map((section) => ({
      ...section,
      items: gainerProgramItems.filter((item) => itemMatchesReadyCategory(item, section.key)),
    }))
    .filter((section) => section.items.length > 0);
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
      <ScreenHeader title="Ready Templates" subtitle={`${allGainerProgramItems.length} templates ready to inspect or start.`} tone="dark" />
      <ScrollView contentContainerStyle={styles.readyTemplateContent} showsVerticalScrollIndicator={false}>
        <View style={styles.readyTemplateSearchCard}>
          <MagnifyingGlass size={18} color="#98A2B3" weight="bold" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search ready templates..."
            placeholderTextColor={colors.textMuted}
            selectionColor={colors.accentAlt}
            style={styles.readyTemplateSearchInput}
          />
          <Pressable
            onPress={() => setShowAdvancedReadyFilters((visible) => !visible)}
            hitSlop={10}
            style={[styles.readyTemplateFilterButton, showAdvancedReadyFilters && styles.readyTemplateFilterButtonActive]}
            accessibilityRole="button"
            accessibilityLabel="Open ready template filters"
          >
            <SlidersHorizontal size={18} color={showAdvancedReadyFilters ? '#FFFFFF' : '#7C3AED'} weight="bold" />
          </Pressable>
        </View>

        <View style={styles.readyTemplateFilterBlock}>
          <Text style={styles.readyTemplateFilterLabel}>Filter templates</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.readyTemplateFilterRow}
            snapToInterval={116}
            decelerationRate="fast"
          >
            {READY_GOAL_FILTERS.map((filter) => {
              const active = readyGoalFilter === filter.key;

              return (
                <Pressable
                  key={filter.key}
                  onPress={() => setReadyGoalFilter(filter.key)}
                  style={[styles.readyTemplateFilterChip, active && styles.readyTemplateFilterChipActive]}
                >
                  <ReadyGoalIcon filter={filter.key} active={active} />
                  <Text style={[styles.readyTemplateFilterText, active && styles.readyTemplateFilterTextActive]}>
                    {filter.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {showAdvancedReadyFilters ? (
        <View style={styles.readyTemplateRefinePanel}>
          <View style={styles.readyTemplateRefineGroup}>
            <Text style={styles.readyTemplateFilterLabel}>Duration</Text>
            <View style={styles.readyTemplateMiniChipRow}>
              {READY_TIME_FILTERS.map((filter) => {
                const active = readyTimeFilter === filter.key;

                return (
                  <Pressable
                    key={filter.key}
                    onPress={() => setReadyTimeFilter(filter.key)}
                    style={[styles.readyTemplateMiniChip, active && styles.readyTemplateMiniChipActive]}
                  >
                    <Text style={[styles.readyTemplateMiniChipText, active && styles.readyTemplateMiniChipTextActive]}>
                      {filter.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.readyTemplateRefineGroup}>
            <Text style={styles.readyTemplateFilterLabel}>Equipment</Text>
            <View style={styles.readyTemplateMiniChipRow}>
              {READY_EQUIPMENT_FILTERS.map((filter) => {
                const active = readyEquipmentFilter === filter.key;

                return (
                  <Pressable
                    key={filter.key}
                    onPress={() => setReadyEquipmentFilter(filter.key)}
                    style={[styles.readyTemplateMiniChip, active && styles.readyTemplateMiniChipActive]}
                  >
                    <Text style={[styles.readyTemplateMiniChipText, active && styles.readyTemplateMiniChipTextActive]}>
                      {filter.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.readyTemplateRefineGroup}>
            <Text style={styles.readyTemplateFilterLabel}>Experience</Text>
            <View style={styles.readyTemplateMiniChipRow}>
              {READY_LEVEL_FILTERS.map((filter) => {
                const active = readyLevelFilter === filter.key;

                return (
                  <Pressable
                    key={filter.key}
                    onPress={() => setReadyLevelFilter(filter.key)}
                    style={[styles.readyTemplateMiniChip, active && styles.readyTemplateMiniChipActive]}
                  >
                    <Text style={[styles.readyTemplateMiniChipText, active && styles.readyTemplateMiniChipTextActive]}>
                      {filter.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
        ) : null}

        {readyCategorySections.length ? (
          <View style={styles.readyTemplateCategoryList}>
            {readyCategorySections.map((section) => (
              <View key={`ready-section:${section.key}`} style={styles.readyTemplateCategorySection}>
                <View style={styles.readyTemplateSectionHeader}>
                  <Text style={styles.readyTemplateSectionTitle}>{section.title}</Text>
                  <View style={styles.readyTemplateScrollHint}>
                    <View style={styles.readyTemplateScrollDotActive} />
                    <View style={styles.readyTemplateScrollDot} />
                  </View>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.readyTemplateCarousel}
                  decelerationRate="fast"
                  snapToInterval={232}
                >
                  {section.items.map((item, index) => {
                    const { template } = item;
                    const current = template.id === activeTemplateId;
                    const heroStyle =
                      section.key === 'general' || section.key === 'fat_loss'
                        ? styles.readyTemplateHeroGreen
                        : index % 2 === 0
                          ? styles.readyTemplateHeroPurple
                          : styles.readyTemplateHeroGreen;

                    return (
                      <View key={`ready-template:${template.id}`} style={[styles.readyTemplateCard, current && styles.readyTemplateCardCurrent]}>
                        <Pressable onPress={() => onOpenReadyProgram(template.id)} style={styles.readyTemplateCardMain}>
                          <ImageBackground
                            source={READY_TEMPLATE_CARD_IMAGE}
                            resizeMode="cover"
                            style={styles.readyTemplateHero}
                            imageStyle={styles.readyTemplateHeroImage}
                          >
                            <View style={styles.readyTemplateHeroShade} />
                            <View style={[styles.readyTemplateHeroTone, heroStyle]} />
                            <View style={[styles.readyTemplateHeroBadge, heroStyle]}>
                              <Lightning size={14} color="#FFFFFF" weight="fill" />
                              <Text style={styles.readyTemplateHeroDays}>{template.daysPerWeek} DAY</Text>
                            </View>
                            <Text style={styles.readyTemplateHeroTitle} numberOfLines={2} adjustsFontSizeToFit>
                              {formatTemplateHeroLabel(template.splitType)}
                            </Text>
                          </ImageBackground>

                          <View style={styles.readyTemplateCopy}>
                            <Text style={styles.readyTemplateName} numberOfLines={2}>
                              {formatWorkoutDisplayLabel(template.name, 'Template')}
                            </Text>
                            <Text style={styles.readyTemplateMeta} numberOfLines={1}>
                              <Text style={styles.readyTemplateMetaStrong}>{template.daysPerWeek} days</Text>
                              <Text> | {formatGoal(template.goalType)}</Text>
                            </Text>
                            <View style={styles.readyTemplateFooterRow}>
                              <CalendarBlank size={14} color="#7B7196" weight="bold" />
                              <Text style={styles.readyTemplateDuration}>{template.sessions.length} sessions</Text>
                              <Clock size={14} color="#7B7196" weight="bold" />
                              <Text style={styles.readyTemplateDuration}>{template.estimatedSessionDuration} min</Text>
                            </View>
                          </View>
                        </Pressable>

                        <Pressable
                          onPress={() => onStartReadyProgram(template.id)}
                          style={[styles.readyTemplateStartButton, current && styles.readyTemplateStartButtonCurrent]}
                        >
                          <Text style={styles.readyTemplateStartText}>{current ? 'Current' : 'Start Plan'}</Text>
                        </Pressable>
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            ))}
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
    paddingHorizontal: spacing.md,
    paddingBottom: layout.bottomTabBarReserve,
    gap: spacing.md,
    backgroundColor: '#F7F3FF',
  },
  readyTemplateSearchCard: {
    minHeight: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E7D9FF',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    position: 'relative',
    shadowColor: '#BDA5F4',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 3,
  },
  readyTemplateSearchInput: {
    flex: 1,
    minHeight: 42,
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '800',
    paddingVertical: 0,
    paddingRight: 48,
  },
  readyTemplateFilterButton: {
    width: 44,
    height: 38,
    borderRadius: 19,
    position: 'absolute',
    right: 4,
    top: 3,
    zIndex: 3,
    elevation: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3ECFF',
  },
  readyTemplateFilterButtonActive: {
    backgroundColor: '#7C3AED',
  },
  readyTemplateFilterBlock: {
    gap: 6,
  },
  readyTemplateFilterLabel: {
    color: '#7C3AED',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  readyTemplateFilterRow: {
    gap: spacing.sm,
    paddingRight: spacing.xl,
  },
  readyTemplateFilterChip: {
    minWidth: 104,
    minHeight: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2D3FF',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
  },
  readyTemplateFilterChipActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  readyTemplateFilterText: {
    color: '#667085',
    fontSize: 12,
    fontWeight: '900',
  },
  readyTemplateFilterTextActive: {
    color: '#FFFFFF',
  },
  readyTemplateRefinePanel: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E7D9FF',
    backgroundColor: '#FFFFFF',
    padding: spacing.xs,
    gap: spacing.xs,
  },
  readyTemplateRefineGroup: {
    gap: 3,
  },
  readyTemplateMiniChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  readyTemplateMiniChip: {
    minHeight: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2D3FF',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  readyTemplateMiniChipActive: {
    backgroundColor: '#F3ECFF',
    borderColor: '#B994FF',
  },
  readyTemplateMiniChipText: {
    color: '#667085',
    fontSize: 10,
    fontWeight: '900',
  },
  readyTemplateMiniChipTextActive: {
    color: '#7C3AED',
  },
  readyTemplateSectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  readyTemplateSectionTitle: {
    color: '#050817',
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  readyTemplateCategoryList: {
    gap: spacing.lg,
  },
  readyTemplateCategorySection: {
    gap: spacing.sm,
  },
  readyTemplateCarousel: {
    gap: spacing.sm,
    paddingRight: 42,
  },
  readyTemplateScrollHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  readyTemplateScrollDotActive: {
    width: 16,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#7C3AED',
  },
  readyTemplateScrollDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D8C7FF',
  },
  readyTemplateCard: {
    overflow: 'hidden',
    width: 220,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E7D9FF',
    backgroundColor: '#FFFFFF',
    shadowColor: '#BDA5F4',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 5,
  },
  readyTemplateCardCurrent: {
    borderColor: '#7C3AED',
  },
  readyTemplateCardMain: {
    gap: 0,
  },
  readyTemplateHero: {
    height: 222,
    padding: spacing.md,
    justifyContent: 'flex-end',
  },
  readyTemplateHeroImage: {
    borderTopLeftRadius: 21,
    borderTopRightRadius: 21,
  },
  readyTemplateHeroPurple: {
    backgroundColor: 'rgba(74, 22, 158, 0.72)',
  },
  readyTemplateHeroGreen: {
    backgroundColor: 'rgba(5, 92, 57, 0.70)',
  },
  readyTemplateHeroShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.30)',
  },
  readyTemplateHeroTone: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 112,
    opacity: 0.72,
  },
  readyTemplateHeroBadge: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    minHeight: 36,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  readyTemplateHeroDays: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  readyTemplateHeroTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    lineHeight: 27,
    fontWeight: '900',
    letterSpacing: -0.5,
    textTransform: 'uppercase',
  },
  readyTemplateCopy: {
    minHeight: 142,
    padding: spacing.md,
    gap: spacing.xs,
  },
  readyTemplateName: {
    color: '#0F172A',
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  readyTemplateMeta: {
    color: '#667085',
    fontSize: 12,
    fontWeight: '800',
  },
  readyTemplateMetaStrong: {
    color: '#7C3AED',
    fontWeight: '900',
  },
  readyTemplateFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 4,
  },
  readyTemplateDuration: {
    color: '#667085',
    fontSize: 11,
    fontWeight: '800',
  },
  readyTemplateStartButton: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    minHeight: 40,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3ECFF',
  },
  readyTemplateStartButtonCurrent: {
    backgroundColor: '#DCFCE7',
  },
  readyTemplateStartText: {
    color: '#7C3AED',
    fontSize: 13,
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

