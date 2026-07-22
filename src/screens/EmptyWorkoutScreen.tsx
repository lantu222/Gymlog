import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { PlatePop } from '../components/PlatePop';
import { RestBar } from '../components/RestBar';
import { formatLiftDisplayLabel } from '../lib/displayLabel';
import {
  EMPTY_WORKOUT_MUSCLE_FILTERS,
  EmptyWorkoutMuscleFilter,
  FreestyleExerciseDraft,
  FreestyleFinishSummary,
  buildFreestyleFinish,
  exerciseInitials,
  freestyleDoneSetCount,
  freestyleVolumeKg,
  matchesMuscleFilter,
} from '../lib/emptyWorkoutSession';
import { getExerciseTemplateDefaults, getPopularExerciseLibraryItems } from '../lib/exerciseSuggestions';
import { createId } from '../lib/ids';
import { ExercisePrLookup } from '../lib/workoutCompletionSummary';
import { AW3, HG } from '../lightTheme';
import { ExerciseLibraryItem, WorkoutTemplateDraft } from '../types/models';
import { haptics } from '../utils/haptics';
import { useKeepScreenAwake } from '../utils/keepAwake';
import { sound } from '../utils/sound';

/**
 * Freestyle logging in the GAINER (HG) language — replaces the old generic
 * Empty Workout presentation. Empty state → Add-exercise sheet → set table
 * with plate readout and the shared floating rest bar. Design source:
 * empty-workout.jsx + aw3-shared.jsx in the design archive.
 */

interface FreestyleExerciseState extends FreestyleExerciseDraft {
  displayName: string;
  initials: string;
  metaLabel: string;
  isBarbell: boolean;
}

interface EmptyWorkoutScreenProps {
  exerciseLibrary: ExerciseLibraryItem[];
  recentExerciseLibraryItems: ExerciseLibraryItem[];
  defaultRestSeconds: number;
  keepScreenAwake?: boolean;
  exercisePrLookup: ExercisePrLookup;
  onBack: () => void;
  onSave: (draft: WorkoutTemplateDraft, summary: FreestyleFinishSummary) => Promise<void> | void;
}

function toLabel(value: string) {
  return value
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function buildMetaLabel(item: ExerciseLibraryItem) {
  const muscle = toLabel(item.bodyPart);
  const tag = item.equipment === 'bodyweight' ? 'Bodyweight' : toLabel(item.category);
  // Core exercises would otherwise read "Core · Core".
  return tag.toLowerCase() === muscle.toLowerCase() ? muscle : `${muscle} · ${tag}`;
}

function createSet() {
  return { localKey: createId('set'), kg: '', reps: '', done: false };
}

function buildExerciseState(item: ExerciseLibraryItem, defaultRestSeconds: number): FreestyleExerciseState {
  const defaults = getExerciseTemplateDefaults(item, defaultRestSeconds);
  const displayName = formatLiftDisplayLabel(item.name, 'Exercise');

  return {
    localKey: createId('draft'),
    name: item.name,
    libraryItemId: item.id,
    imageUrl: item.imageUrls?.[0] ?? null,
    repMin: defaults.repMin,
    repMax: defaults.repMax,
    restSeconds: defaults.restSeconds,
    trackedDefault: defaults.trackedDefault,
    sets: [createSet()],
    displayName,
    initials: exerciseInitials(displayName),
    metaLabel: buildMetaLabel(item),
    isBarbell: item.equipment === 'barbell',
  };
}

/** Session clock in the design's m:ss form (minutes unbounded). */
function formatSessionClock(totalSeconds: number) {
  const safe = Math.max(0, totalSeconds);
  return `${Math.floor(safe / 60)}:${`${safe % 60}`.padStart(2, '0')}`;
}

function formatVolumeLabel(volumeKg: number) {
  return volumeKg % 1 ? volumeKg.toFixed(1) : `${volumeKg}`;
}

function buildSearchHaystack(item: ExerciseLibraryItem) {
  return [item.name, item.category, item.bodyPart, item.equipment].join(' ').toLowerCase();
}

// ── small shared pieces ──────────────────────────────────────────────────

function PlusIcon({ size, color, strokeWidth = 2.8 }: { size: number; color: string; strokeWidth?: number }) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Path d="M12 5v14M5 12h14" stroke={color} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

function CheckIcon({ size, color, strokeWidth = 3 }: { size: number; color: string; strokeWidth?: number }) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Path d="M5 12l5 5L19 7" stroke={color} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Letter tile — the purpleLight / purpleDark idiom shared with the guided player. */
function Tile({ initials, size = 46, radius = 12, fontSize }: { initials: string; size?: number; radius?: number; fontSize?: number }) {
  return (
    <View style={[styles.tile, { width: size, height: size, borderRadius: radius }]}>
      <Text style={[styles.tileText, { fontSize: fontSize ?? Math.round(size * 0.36) }]}>{initials}</Text>
    </View>
  );
}

/** Mount fade+rise, mirroring the mock's aw3Fade keyframe. */
function FadeInView({ style, children }: { style?: object; children: React.ReactNode }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, { toValue: 1, duration: 240, useNativeDriver: true }).start();
  }, [progress]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** Check button with the aw3Pop squash when a set flips to done. */
function SetCheckButton({ done, onPress }: { done: boolean; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  const wasDone = useRef(done);

  useEffect(() => {
    if (done && !wasDone.current) {
      Animated.sequence([
        Animated.timing(scale, { toValue: 0.9, duration: 140, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
    }
    wasDone.current = done;
  }, [done, scale]);

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={done ? 'Mark set not done' : 'Mark set done'} onPress={onPress}>
      <Animated.View style={[styles.setCheck, done && styles.setCheckDone, { transform: [{ scale }] }]}>
        <CheckIcon size={18} color={done ? '#FFFFFF' : AW3.ghost} />
      </Animated.View>
    </Pressable>
  );
}

// ── Add-exercise sheet ───────────────────────────────────────────────────

interface AddSheetProps {
  visible: boolean;
  items: ExerciseLibraryItem[];
  onClose: () => void;
  onAdd: (items: ExerciseLibraryItem[]) => void;
}

function SelectTogglePill({ selected }: { selected: boolean }) {
  return (
    <View style={[styles.selectPill, selected && styles.selectPillOn]}>
      {selected ? <CheckIcon size={16} color="#FFFFFF" strokeWidth={2.8} /> : <PlusIcon size={16} color={HG.purple} />}
    </View>
  );
}

function AddExerciseSheetHG({ visible, items, onClose, onAdd }: AddSheetProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filter, setFilter] = useState<EmptyWorkoutMuscleFilter>('All');
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!visible) {
      setSelectedIds([]);
      setFilter('All');
      setQuery('');
    }
  }, [visible]);

  const toggle = (id: string) =>
    setSelectedIds((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));

  const normalizedQuery = query.trim().toLowerCase();
  const matches = useMemo(
    () =>
      items.filter(
        (item) =>
          matchesMuscleFilter(item.bodyPart, filter) &&
          (!normalizedQuery || buildSearchHaystack(item).includes(normalizedQuery)),
      ),
    [filter, items, normalizedQuery],
  );

  const popularItems = useMemo(() => {
    const matchIds = new Set(matches.map((item) => item.id));
    return getPopularExerciseLibraryItems(items, 8)
      .filter((item) => matchIds.has(item.id))
      .slice(0, 4);
  }, [items, matches]);

  const popularIds = useMemo(() => new Set(popularItems.map((item) => item.id)), [popularItems]);
  const listItems = useMemo(
    () =>
      matches
        .filter((item) => !popularIds.has(item.id))
        .sort((left, right) => left.name.localeCompare(right.name)),
    [matches, popularIds],
  );

  const confirm = () => {
    if (!selectedIds.length) {
      return;
    }
    onAdd(items.filter((item) => selectedIds.includes(item.id)));
  };

  const listHeader = (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sheetChipRow}>
        {EMPTY_WORKOUT_MUSCLE_FILTERS.map((option) => {
          const active = option === filter;
          return (
            <Pressable key={option} onPress={() => setFilter(option)} style={[styles.sheetChip, active && styles.sheetChipActive]}>
              <Text style={[styles.sheetChipText, active && styles.sheetChipTextActive]}>{option}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {popularItems.length > 0 ? (
        <>
          <View style={styles.sheetSectionHeader}>
            <Text style={styles.sheetSectionTitle}>Popular to start</Text>
            <Text style={styles.sheetSectionSubtitle}>Common first picks for a new workout.</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.popularRow}>
            {popularItems.map((item) => {
              const selected = selectedIds.includes(item.id);
              return (
                <Pressable
                  key={item.id}
                  onPress={() => toggle(item.id)}
                  style={[styles.popularCard, selected && styles.popularCardSelected]}
                >
                  <View>
                    <View style={styles.popularTile}>
                      <Text style={styles.popularTileText}>{exerciseInitials(formatLiftDisplayLabel(item.name, 'Exercise'))}</Text>
                    </View>
                    <View style={styles.popularToggle}>
                      <SelectTogglePill selected={selected} />
                    </View>
                  </View>
                  <Text numberOfLines={2} style={styles.popularName}>
                    {formatLiftDisplayLabel(item.name, 'Exercise')}
                  </Text>
                  <Text numberOfLines={1} style={styles.popularMeta}>
                    {buildMetaLabel(item)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </>
      ) : null}

      <View style={styles.sheetSectionHeaderAll}>
        <Text style={styles.sheetSectionTitle}>All exercises</Text>
        <Text style={styles.sheetSectionSubtitle}>{listItems.length} available</Text>
      </View>
    </>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetGripRow}>
            <View style={styles.sheetGrip} />
          </View>
          <View style={styles.sheetHead}>
            <View style={styles.sheetHeadRow}>
              <View style={styles.sheetHeadCopy}>
                <Text style={styles.sheetTitle}>Add exercise</Text>
                <Text style={styles.sheetSubtitle}>Add the next lift to this workout.</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={8}>
                <Text style={styles.sheetClose}>Close</Text>
              </Pressable>
            </View>
            <View style={styles.searchField}>
              <Svg viewBox="0 0 24 24" width={18} height={18}>
                <Circle cx={11} cy={11} r={7} stroke={HG.faint} strokeWidth={2} fill="none" />
                <Path d="M20 20l-3.5-3.5" stroke={HG.faint} strokeWidth={2} fill="none" strokeLinecap="round" />
              </Svg>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search exercises"
                placeholderTextColor={AW3.ghost}
                selectionColor={HG.purple}
                style={styles.searchInput}
              />
            </View>
          </View>

          <FlatList
            data={listItems}
            keyExtractor={(item) => item.id}
            initialNumToRender={12}
            maxToRenderPerBatch={16}
            windowSize={8}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.sheetListContent}
            ListHeaderComponent={listHeader}
            ListEmptyComponent={
              popularItems.length === 0 ? (
                <Text style={styles.sheetEmptyText}>No exercises match “{query}”.</Text>
              ) : null
            }
            renderItem={({ item }) => {
              const selected = selectedIds.includes(item.id);
              return (
                <Pressable onPress={() => toggle(item.id)} style={[styles.sheetRow, selected && styles.sheetRowSelected]}>
                  <Tile initials={exerciseInitials(formatLiftDisplayLabel(item.name, 'Exercise'))} size={46} />
                  <View style={styles.sheetRowCopy}>
                    <Text numberOfLines={1} style={styles.sheetRowName}>
                      {formatLiftDisplayLabel(item.name, 'Exercise')}
                    </Text>
                    <Text numberOfLines={1} style={styles.sheetRowMeta}>
                      {buildMetaLabel(item)}
                    </Text>
                  </View>
                  <SelectTogglePill selected={selected} />
                </Pressable>
              );
            }}
          />

          <View style={styles.sheetFooter}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add selected exercises"
              onPress={confirm}
              disabled={selectedIds.length === 0}
              style={[styles.sheetConfirm, selectedIds.length === 0 && styles.sheetConfirmDisabled]}
            >
              <Text style={[styles.sheetConfirmText, selectedIds.length === 0 && styles.sheetConfirmTextDisabled]}>
                {selectedIds.length
                  ? `Add ${selectedIds.length} ${selectedIds.length === 1 ? 'exercise' : 'exercises'}`
                  : 'Select one or more exercises'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── screen ───────────────────────────────────────────────────────────────

export function EmptyWorkoutScreen({
  exerciseLibrary,
  recentExerciseLibraryItems,
  defaultRestSeconds,
  keepScreenAwake = false,
  exercisePrLookup,
  onBack,
  onSave,
}: EmptyWorkoutScreenProps) {
  const [exercises, setExercises] = useState<FreestyleExerciseState[]>([]);
  const [startedAtMs, setStartedAtMs] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [rest, setRest] = useState<{ totalSeconds: number; endsAtMs: number } | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const hasExercises = exercises.length > 0;
  const canFinish = hasExercises && !isSaving;

  useKeepScreenAwake(keepScreenAwake, 'empty-workout');

  useEffect(() => {
    if (!hasExercises) {
      return;
    }
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [hasExercises]);

  const elapsedSeconds = startedAtMs === null ? 0 : Math.max(0, Math.floor((nowMs - startedAtMs) / 1000));
  const restRemaining = rest ? Math.ceil((rest.endsAtMs - nowMs) / 1000) : null;

  useEffect(() => {
    // The countdown ran out — clear the bar and cue "back to work".
    if (rest && restRemaining !== null && restRemaining <= 0) {
      setRest(null);
      void haptics.impactMedium();
      sound.rest();
    }
  }, [rest, restRemaining]);

  const doneSetCount = freestyleDoneSetCount(exercises);
  const volumeKg = freestyleVolumeKg(exercises);

  const quickItems = useMemo(() => {
    const source = recentExerciseLibraryItems.length > 0 ? recentExerciseLibraryItems : getPopularExerciseLibraryItems(exerciseLibrary, 8);
    return source.slice(0, 4);
  }, [exerciseLibrary, recentExerciseLibraryItems]);
  const quickListTitle = recentExerciseLibraryItems.length > 0 ? 'Recent exercises' : 'Popular exercises';

  const addExercises = (items: ExerciseLibraryItem[]) => {
    if (!items.length) {
      return;
    }
    setExercises((current) => [...current, ...items.map((item) => buildExerciseState(item, defaultRestSeconds))]);
    setStartedAtMs((current) => current ?? Date.now());
    setNowMs(Date.now());
    setSheetVisible(false);
  };

  const removeExercise = (exerciseKey: string) =>
    setExercises((current) => current.filter((exercise) => exercise.localKey !== exerciseKey));

  const patchSet = (exerciseKey: string, setKey: string, patch: Partial<{ kg: string; reps: string }>) =>
    setExercises((current) =>
      current.map((exercise) =>
        exercise.localKey === exerciseKey
          ? {
              ...exercise,
              sets: exercise.sets.map((set) => (set.localKey === setKey ? { ...set, ...patch } : set)),
            }
          : exercise,
      ),
    );

  const addSet = (exerciseKey: string) =>
    setExercises((current) =>
      current.map((exercise) =>
        exercise.localKey === exerciseKey ? { ...exercise, sets: [...exercise.sets, createSet()] } : exercise,
      ),
    );

  const toggleSetDone = (exerciseKey: string, setKey: string) => {
    const exercise = exercises.find((entry) => entry.localKey === exerciseKey);
    const set = exercise?.sets.find((entry) => entry.localKey === setKey);
    if (!exercise || !set) {
      return;
    }

    if (!set.done) {
      void haptics.success();
      sound.done();
      const duration = exercise.restSeconds > 0 ? Math.round(exercise.restSeconds) : defaultRestSeconds;
      const now = Date.now();
      setNowMs(now);
      setRest({ totalSeconds: duration, endsAtMs: now + duration * 1000 });
    }

    setExercises((current) =>
      current.map((entry) =>
        entry.localKey === exerciseKey
          ? {
              ...entry,
              sets: entry.sets.map((item) => (item.localKey === setKey ? { ...item, done: !item.done } : item)),
            }
          : entry,
      ),
    );
  };

  const adjustRest = (deltaSeconds: number) =>
    setRest((current) => {
      if (!current) {
        return current;
      }
      const now = Date.now();
      const remaining = Math.max(1, Math.ceil((current.endsAtMs - now) / 1000) + deltaSeconds);
      return {
        totalSeconds: Math.max(1, current.totalSeconds + deltaSeconds),
        endsAtMs: now + remaining * 1000,
      };
    });

  const handleFinish = async () => {
    if (!canFinish) {
      return;
    }

    setIsSaving(true);
    try {
      const { draft, summary } = buildFreestyleFinish({
        exercises,
        workoutName: 'Empty workout',
        startedAtIso: new Date(startedAtMs ?? Date.now()).toISOString(),
        performedAtIso: new Date().toISOString(),
        elapsedSeconds,
        exercisePrLookup,
      });
      await onSave(draft, summary);
    } catch {
      // Save failed — the logged sets stay on screen so nothing is lost;
      // App.tsx surfaces the error toast. Never show success early.
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      {/* header */}
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} hitSlop={10} style={styles.headerBack}>
          <Svg viewBox="0 0 24 24" width={24} height={24}>
            <Path d="M15 6l-6 6 6 6" stroke={HG.ink} strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Empty workout</Text>
          <Text style={styles.headerClock}>{formatSessionClock(elapsedSeconds)}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Finish workout"
          onPress={handleFinish}
          disabled={!canFinish}
          hitSlop={10}
          style={styles.headerFinish}
        >
          <Text style={[styles.headerFinishText, !canFinish && styles.headerFinishTextDisabled]}>Finish</Text>
        </Pressable>
      </View>

      {/* stat strip */}
      <View style={styles.statStrip}>
        <Text style={[styles.statText, !hasExercises && styles.statTextFaint]}>{doneSetCount} sets</Text>
        <View style={styles.statDot} />
        <Text style={[styles.statText, !hasExercises && styles.statTextFaint]}>{formatVolumeLabel(volumeKg)} kg volume</Text>
        <Text style={styles.statTag}>freestyle session</Text>
      </View>

      {!hasExercises ? (
        /* ── empty state ── */
        <ScrollView style={styles.body} contentContainerStyle={styles.emptyContent} showsVerticalScrollIndicator={false}>
          <View style={styles.emptyHero}>
            <View style={styles.emptyIconTile}>
              <Svg viewBox="0 0 24 24" width={42} height={42}>
                <Path
                  d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10"
                  stroke={HG.purple}
                  strokeWidth={2}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </View>
            <Text style={styles.emptyTitle}>Nothing logged yet</Text>
            <Text style={styles.emptySubtitle}>Add your first exercise and log sets as you go — no plan required.</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add exercise"
              onPress={() => setSheetVisible(true)}
              style={styles.emptyCta}
            >
              <PlusIcon size={20} color="#FFFFFF" />
              <Text style={styles.emptyCtaText}>Add exercise</Text>
            </Pressable>
          </View>

          {quickItems.length > 0 ? (
            <View style={styles.quickSection}>
              <View style={styles.quickHeader}>
                <Text style={styles.quickTitle}>{quickListTitle}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="See all exercises" onPress={() => setSheetVisible(true)} hitSlop={8}>
                  <Text style={styles.quickSeeAll}>See all</Text>
                </Pressable>
              </View>
              <View style={styles.quickList}>
                {quickItems.map((item) => (
                  <Pressable key={item.id} onPress={() => addExercises([item])} style={styles.quickRow}>
                    <Tile initials={exerciseInitials(formatLiftDisplayLabel(item.name, 'Exercise'))} size={44} />
                    <View style={styles.quickRowCopy}>
                      <Text numberOfLines={1} style={styles.quickRowName}>
                        {formatLiftDisplayLabel(item.name, 'Exercise')}
                      </Text>
                      <Text numberOfLines={1} style={styles.quickRowMeta}>
                        {toLabel(item.bodyPart)}
                      </Text>
                    </View>
                    <View style={styles.quickRowPlus}>
                      <PlusIcon size={16} color={HG.purpleDark} />
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
        </ScrollView>
      ) : (
        /* ── freestyle logging ── */
        <ScrollView
          style={styles.body}
          contentContainerStyle={[styles.loggingContent, { paddingBottom: rest ? 118 : 24 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {exercises.map((exercise, exerciseIndex) => {
            const activeIndex = exercise.sets.findIndex((set) => !set.done);
            return (
              <View key={exercise.localKey} style={[styles.exerciseBlock, exerciseIndex > 0 && styles.exerciseBlockDivided]}>
                <View style={styles.exerciseHead}>
                  <Tile initials={exercise.initials} size={40} radius={11} />
                  <View style={styles.exerciseHeadCopy}>
                    <Text numberOfLines={1} style={styles.exerciseName}>
                      {exercise.displayName}
                    </Text>
                    <Text numberOfLines={1} style={styles.exerciseMeta}>
                      {exercise.metaLabel}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${exercise.displayName}`}
                    onPress={() => removeExercise(exercise.localKey)}
                    style={styles.exerciseRemove}
                  >
                    <Svg viewBox="0 0 24 24" width={18} height={18}>
                      <Path d="M6 6l12 12M18 6L6 18" stroke={HG.faint} strokeWidth={2.2} fill="none" strokeLinecap="round" />
                    </Svg>
                  </Pressable>
                </View>

                <View style={styles.setGridHeader}>
                  <Text style={[styles.setGridHeaderText, styles.setColIndex]}>#</Text>
                  <Text style={[styles.setGridHeaderText, styles.setColField, styles.setGridHeaderCenter]}>KG</Text>
                  <Text style={[styles.setGridHeaderText, styles.setColField, styles.setGridHeaderCenter]}>REPS</Text>
                  <View style={styles.setColCheck} />
                </View>

                <View style={styles.setList}>
                  {exercise.sets.map((set, setIndex) => (
                    <View key={set.localKey}>
                      <View style={[styles.setRow, set.done && styles.setRowDone]}>
                        <Text style={[styles.setIndex, styles.setColIndex, setIndex === activeIndex && styles.setIndexActive]}>
                          {setIndex + 1}
                        </Text>
                        <TextInput
                          value={set.kg}
                          onChangeText={(value) => patchSet(exercise.localKey, set.localKey, { kg: value })}
                          placeholder="0"
                          placeholderTextColor={AW3.ghost}
                          selectionColor={HG.purple}
                          keyboardType="decimal-pad"
                          style={[styles.setInput, styles.setColField]}
                        />
                        <TextInput
                          value={set.reps}
                          onChangeText={(value) => patchSet(exercise.localKey, set.localKey, { reps: value })}
                          placeholder="0"
                          placeholderTextColor={AW3.ghost}
                          selectionColor={HG.purple}
                          keyboardType="number-pad"
                          style={[styles.setInput, styles.setColField]}
                        />
                        <View style={[styles.setColCheck, styles.setCheckCell]}>
                          <SetCheckButton done={set.done} onPress={() => toggleSetDone(exercise.localKey, set.localKey)} />
                        </View>
                      </View>
                      {exercise.isBarbell && setIndex === activeIndex ? (
                        <FadeInView style={styles.plateStrip}>
                          <PlatePop kg={set.kg} />
                        </FadeInView>
                      ) : null}
                    </View>
                  ))}
                </View>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Add set to ${exercise.displayName}`}
                  onPress={() => addSet(exercise.localKey)}
                  style={styles.addSetButton}
                >
                  <PlusIcon size={15} color={HG.purpleDark} strokeWidth={2.6} />
                  <Text style={styles.addSetText}>Add set</Text>
                </Pressable>
              </View>
            );
          })}

          <View style={styles.loggingFooter}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add exercise"
              onPress={() => setSheetVisible(true)}
              style={styles.addExerciseDashed}
            >
              <PlusIcon size={17} color={HG.purpleDark} strokeWidth={2.6} />
              <Text style={styles.addExerciseDashedText}>Add exercise</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Finish workout"
              onPress={handleFinish}
              disabled={!canFinish}
              style={[styles.finishButton, isSaving && styles.finishButtonSaving]}
            >
              <CheckIcon size={19} color="#FFFFFF" />
              <Text style={styles.finishButtonText}>{isSaving ? 'Saving…' : 'Finish workout'}</Text>
            </Pressable>
          </View>
        </ScrollView>
      )}

      {rest && restRemaining !== null && restRemaining > 0 && !sheetVisible ? (
        <RestBar totalSeconds={rest.totalSeconds} remainingSeconds={restRemaining} onAdjust={adjustRest} onSkip={() => setRest(null)} />
      ) : null}

      <AddExerciseSheetHG visible={sheetVisible} items={exerciseLibrary} onClose={() => setSheetVisible(false)} onAdd={addExercises} />
    </View>
  );
}

// ── styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: HG.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 8,
    paddingBottom: 10,
    paddingHorizontal: 16,
  },
  headerBack: {
    flexShrink: 0,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 15.5,
    fontWeight: '800',
    color: HG.ink,
    letterSpacing: -0.15,
  },
  headerClock: {
    fontSize: 11.5,
    fontWeight: '700',
    color: HG.faint,
    fontVariant: ['tabular-nums'],
    marginTop: 1,
  },
  headerFinish: {
    flexShrink: 0,
  },
  headerFinishText: {
    fontSize: 14.5,
    fontWeight: '800',
    color: HG.purple,
  },
  headerFinishTextDisabled: {
    color: '#C9C2DA',
  },
  statStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: AW3.hair,
  },
  statText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: HG.ink,
  },
  statTextFaint: {
    color: HG.faint,
  },
  statDot: {
    width: 3,
    height: 3,
    borderRadius: 999,
    backgroundColor: AW3.ghost,
  },
  statTag: {
    marginLeft: 'auto',
    fontSize: 11.5,
    fontWeight: '700',
    color: HG.faint,
  },
  body: {
    flex: 1,
  },

  // empty state
  emptyContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  emptyHero: {
    marginTop: 34,
    alignItems: 'center',
  },
  emptyIconTile: {
    width: 92,
    height: 92,
    borderRadius: 26,
    backgroundColor: HG.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: HG.ink,
    letterSpacing: -0.2,
    marginTop: 18,
  },
  emptySubtitle: {
    fontSize: 13.5,
    fontWeight: '600',
    color: HG.muted,
    marginTop: 7,
    lineHeight: 20,
    maxWidth: 260,
    textAlign: 'center',
  },
  emptyCta: {
    alignSelf: 'stretch',
    height: 54,
    borderRadius: 16,
    backgroundColor: HG.purple,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    marginTop: 22,
    shadowColor: HG.purple,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.32,
    shadowRadius: 26,
    elevation: 10,
  },
  emptyCtaText: {
    fontSize: 16.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  quickSection: {
    marginTop: 34,
  },
  quickHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quickTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: HG.ink,
  },
  quickSeeAll: {
    fontSize: 12.5,
    fontWeight: '800',
    color: HG.purple,
  },
  quickList: {
    gap: 9,
    marginTop: 12,
  },
  quickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    padding: 11,
    borderRadius: 14,
    backgroundColor: HG.surface,
    borderWidth: 1,
    borderColor: HG.border,
  },
  quickRowCopy: {
    flex: 1,
    minWidth: 0,
  },
  quickRowName: {
    fontSize: 15,
    fontWeight: '800',
    color: HG.ink,
  },
  quickRowMeta: {
    fontSize: 12.5,
    fontWeight: '700',
    color: HG.faint,
    marginTop: 2,
  },
  quickRowPlus: {
    width: 30,
    height: 30,
    borderRadius: 999,
    backgroundColor: HG.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  // logging state
  loggingContent: {},
  exerciseBlock: {
    paddingTop: 15,
    paddingBottom: 8,
    paddingHorizontal: 20,
  },
  exerciseBlockDivided: {
    borderTopWidth: 1,
    borderTopColor: AW3.hair,
  },
  exerciseHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  exerciseHeadCopy: {
    flex: 1,
    minWidth: 0,
  },
  exerciseName: {
    fontSize: 16.5,
    fontWeight: '800',
    color: HG.ink,
    letterSpacing: -0.16,
  },
  exerciseMeta: {
    fontSize: 12,
    fontWeight: '700',
    color: HG.faint,
    marginTop: 1,
  },
  exerciseRemove: {
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  setGridHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: 13,
  },
  setGridHeaderText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.7,
    color: HG.faint,
  },
  setGridHeaderCenter: {
    textAlign: 'center',
  },
  setColIndex: {
    width: 22,
  },
  setColField: {
    flex: 1,
  },
  setColCheck: {
    width: 44,
  },
  setList: {
    gap: 6,
    marginTop: 6,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingVertical: 3,
    paddingHorizontal: 8,
    marginHorizontal: -8,
    borderRadius: 10,
  },
  setRowDone: {
    backgroundColor: AW3.field,
  },
  setIndex: {
    fontSize: 14,
    fontWeight: '800',
    color: HG.ink,
  },
  setIndexActive: {
    color: HG.purple,
  },
  setInput: {
    height: 40,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: AW3.fieldBorder,
    backgroundColor: AW3.field,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '800',
    color: HG.ink,
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  setCheckCell: {
    alignItems: 'center',
  },
  setCheck: {
    width: 40,
    height: 40,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFEBF9',
  },
  setCheckDone: {
    backgroundColor: HG.green,
  },
  plateStrip: {
    marginTop: 7,
    marginBottom: 2,
    marginHorizontal: -8,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: HG.purpleLight,
  },
  addSetButton: {
    height: 36,
    borderRadius: 999,
    backgroundColor: '#F1EDFA',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 11,
  },
  addSetText: {
    fontSize: 13,
    fontWeight: '800',
    color: HG.purpleDark,
  },
  loggingFooter: {
    marginTop: 6,
    paddingTop: 16,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: AW3.hair,
    gap: 12,
  },
  addExerciseDashed: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1.6,
    borderStyle: 'dashed',
    borderColor: HG.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addExerciseDashedText: {
    fontSize: 15,
    fontWeight: '800',
    color: HG.purpleDark,
  },
  finishButton: {
    height: 54,
    borderRadius: 16,
    backgroundColor: HG.purple,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    shadowColor: HG.purple,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 26,
    elevation: 10,
  },
  finishButtonSaving: {
    opacity: 0.7,
  },
  finishButtonText: {
    fontSize: 16.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // shared tile
  tile: {
    flexShrink: 0,
    backgroundColor: HG.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileText: {
    fontWeight: '800',
    color: HG.purpleDark,
    letterSpacing: 0.3,
  },

  // add-exercise sheet
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(16,12,40,0.42)',
  },
  sheet: {
    maxHeight: '90%',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    backgroundColor: HG.bg,
    overflow: 'hidden',
  },
  sheetGripRow: {
    alignItems: 'center',
    paddingTop: 9,
    paddingBottom: 4,
  },
  sheetGrip: {
    width: 38,
    height: 4.5,
    borderRadius: 999,
    backgroundColor: '#D8CFEC',
  },
  sheetHead: {
    paddingTop: 6,
    paddingBottom: 12,
    paddingHorizontal: 20,
  },
  sheetHeadRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  sheetHeadCopy: {
    flex: 1,
    minWidth: 0,
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: HG.ink,
    letterSpacing: -0.22,
  },
  sheetSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: HG.muted,
    marginTop: 3,
  },
  sheetClose: {
    fontSize: 14.5,
    fontWeight: '800',
    color: HG.purple,
    paddingTop: 4,
  },
  searchField: {
    marginTop: 14,
    height: 46,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: AW3.fieldBorder,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: HG.ink,
    paddingVertical: 0,
  },
  sheetChipRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  sheetChip: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: AW3.fieldBorder,
  },
  sheetChipActive: {
    backgroundColor: HG.purple,
    borderColor: HG.purple,
  },
  sheetChipText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: HG.ink,
  },
  sheetChipTextActive: {
    color: '#FFFFFF',
  },
  sheetSectionHeader: {
    paddingHorizontal: 20,
  },
  sheetSectionHeaderAll: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
  },
  sheetSectionTitle: {
    fontSize: 16.5,
    fontWeight: '800',
    color: HG.ink,
  },
  sheetSectionSubtitle: {
    fontSize: 12.5,
    fontWeight: '600',
    color: HG.muted,
    marginTop: 2,
  },
  popularRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 13,
    paddingBottom: 4,
  },
  popularCard: {
    width: 148,
    flexShrink: 0,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: AW3.fieldBorder,
    padding: 12,
    shadowColor: '#28185A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 2,
  },
  popularCardSelected: {
    borderColor: HG.purple,
    shadowColor: HG.purple,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 22,
    elevation: 5,
  },
  popularTile: {
    height: 78,
    borderRadius: 12,
    backgroundColor: HG.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  popularTileText: {
    fontSize: 30,
    fontWeight: '800',
    color: HG.purpleDark,
  },
  popularToggle: {
    position: 'absolute',
    top: 6,
    right: 6,
  },
  popularName: {
    fontSize: 14.5,
    fontWeight: '800',
    color: HG.ink,
    marginTop: 10,
    lineHeight: 17,
  },
  popularMeta: {
    fontSize: 12,
    fontWeight: '700',
    color: HG.faint,
    marginTop: 4,
  },
  selectPill: {
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: AW3.fieldBorder,
    shadowColor: '#28185A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
    flexShrink: 0,
  },
  selectPillOn: {
    backgroundColor: HG.green,
    borderColor: HG.green,
  },
  sheetListContent: {
    paddingBottom: 12,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    padding: 11,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: AW3.fieldBorder,
    marginHorizontal: 20,
    marginBottom: 8,
  },
  sheetRowSelected: {
    borderColor: HG.purple,
  },
  sheetRowCopy: {
    flex: 1,
    minWidth: 0,
  },
  sheetRowName: {
    fontSize: 15,
    fontWeight: '800',
    color: HG.ink,
  },
  sheetRowMeta: {
    fontSize: 12.5,
    fontWeight: '700',
    color: HG.faint,
    marginTop: 2,
  },
  sheetEmptyText: {
    textAlign: 'center',
    paddingVertical: 30,
    fontSize: 14,
    fontWeight: '700',
    color: HG.faint,
  },
  sheetFooter: {
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: AW3.hair,
    backgroundColor: HG.bg,
  },
  sheetConfirm: {
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: HG.purple,
    shadowColor: HG.purple,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.32,
    shadowRadius: 26,
    elevation: 10,
  },
  sheetConfirmDisabled: {
    backgroundColor: '#E7E1F2',
    shadowOpacity: 0,
    elevation: 0,
  },
  sheetConfirmText: {
    fontSize: 16.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  sheetConfirmTextDisabled: {
    color: HG.faint,
  },
});
