import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { getSuggestedExerciseLibraryItems } from '../lib/exerciseSuggestions';
import {
  ExerciseBodyPart,
  ExerciseCategory,
  ExerciseEquipment,
  ExerciseLibraryItem,
} from '../types/models';
import { colors, radii, spacing } from '../theme';

interface AddExerciseSheetProps {
  visible: boolean;
  items: ExerciseLibraryItem[];
  recentItems: ExerciseLibraryItem[];
  currentItemIds?: string[];
  selectedIds?: string[];
  title?: string;
  subtitle?: string;
  actionLabel?: string;
  confirmActionLabel?: string;
  autoFocusSearch?: boolean;
  multiSelect?: boolean;
  onClose: () => void;
  onSelectItem: (item: ExerciseLibraryItem) => void;
  onConfirmSelection?: (items: ExerciseLibraryItem[]) => void;
}

interface CommonExerciseSeed {
  label: string;
  keywords: string[];
}

const categoryOptions: Array<'all' | ExerciseCategory> = ['all', 'compound', 'isolation', 'cardio', 'core'];
const bodyPartOptions: Array<'all' | ExerciseBodyPart> = [
  'all',
  'chest',
  'back',
  'shoulders',
  'legs',
  'biceps',
  'triceps',
  'core',
  'glutes',
  'full body',
];
const equipmentOptions: Array<'all' | ExerciseEquipment> = [
  'all',
  'barbell',
  'dumbbell',
  'machine',
  'cable',
  'bodyweight',
];

const COMMON_EXERCISE_SEEDS: CommonExerciseSeed[] = [
  { label: 'Bench Press', keywords: ['bench press'] },
  { label: 'Dumbbell Bench Press', keywords: ['dumbbell bench press'] },
  { label: 'Incline Dumbbell Press', keywords: ['incline dumbbell press', 'incline bench press'] },
  { label: 'Lat Pulldown', keywords: ['lat pulldown', 'pulldown'] },
  { label: 'Seated Row', keywords: ['seated row', 'cable row'] },
  { label: 'Shoulder Press', keywords: ['shoulder press', 'overhead press'] },
  { label: 'Lateral Raise', keywords: ['lateral raise'] },
  { label: 'Squat', keywords: ['barbell squat', 'squat'] },
  { label: 'Leg Press', keywords: ['leg press'] },
  { label: 'Leg Extension', keywords: ['leg extension'] },
  { label: 'Leg Curl', keywords: ['leg curl'] },
  { label: 'Romanian Deadlift', keywords: ['romanian deadlift', 'stiff-leg deadlift'] },
  { label: 'Hip Thrust', keywords: ['hip thrust', 'glute bridge'] },
  { label: 'Biceps Curl', keywords: ['biceps curl', 'dumbbell curl', 'barbell curl'] },
  { label: 'Triceps Pushdown', keywords: ['triceps pushdown', 'cable pushdown', 'pushdown'] },
  { label: 'Calf Raise', keywords: ['calf raise', 'calf press'] },
  { label: 'Crunch', keywords: ['crunch', 'sit-up'] },
];

function toLabel(value: string) {
  return value
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function toBodyPartQuickLabel(value: 'all' | ExerciseBodyPart) {
  switch (value) {
    case 'all':
      return 'All';
    case 'full body':
      return 'Full body';
    default:
      return toLabel(value);
  }
}

function buildSearchHaystack(item: ExerciseLibraryItem) {
  return [item.name, item.category, item.bodyPart, item.equipment].join(' ').toLowerCase();
}

function findCommonExerciseItems(items: ExerciseLibraryItem[]) {
  const picked = new Set<string>();
  const matches: ExerciseLibraryItem[] = [];

  for (const seed of COMMON_EXERCISE_SEEDS) {
    const match = items.find((item) => {
      if (picked.has(item.id)) {
        return false;
      }

      const normalizedName = item.name.toLowerCase();
      return seed.keywords.some((keyword) => normalizedName.includes(keyword));
    });

    if (match) {
      picked.add(match.id);
      matches.push(match);
    }
  }

  return matches;
}

function buildCommonExerciseOrder(items: ExerciseLibraryItem[]) {
  const ids: string[] = [];
  const picked = new Set<string>();

  for (const seed of COMMON_EXERCISE_SEEDS) {
    const match = items.find((item) => {
      if (picked.has(item.id)) {
        return false;
      }

      const normalizedName = item.name.toLowerCase();
      return seed.keywords.some((keyword) => normalizedName.includes(keyword));
    });

    if (match) {
      picked.add(match.id);
      ids.push(match.id);
    }
  }

  return new Map(ids.map((id, index) => [id, index]));
}

interface FilterPillGroupProps<T extends string> {
  title: string;
  options: T[];
  selected: T;
  onSelect: (value: T) => void;
}

function FilterPillGroup<T extends string>({ title, options, selected, onSelect }: FilterPillGroupProps<T>) {
  return (
    <View style={styles.filterGroup}>
      <Text style={styles.filterTitle}>{title}</Text>
      <View style={styles.filterRow}>
        {options.map((option) => {
          const active = option === selected;
          return (
            <Pressable
              key={option}
              onPress={() => onSelect(option)}
              style={[styles.filterPill, active && styles.filterPillActive]}
            >
              <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>{toLabel(option)}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function AddExerciseSheet({
  visible,
  items,
  recentItems,
  currentItemIds = [],
  selectedIds = [],
  title = 'Add exercise',
  subtitle,
  actionLabel = 'Add',
  confirmActionLabel,
  autoFocusSearch = false,
  multiSelect = false,
  onClose,
  onSelectItem,
  onConfirmSelection,
}: AddExerciseSheetProps) {
  const searchRef = useRef<TextInput | null>(null);
  const wasVisibleRef = useRef(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<'all' | ExerciseCategory>('all');
  const [bodyPart, setBodyPart] = useState<'all' | ExerciseBodyPart>('all');
  const [equipment, setEquipment] = useState<'all' | ExerciseEquipment>('all');
  const [pendingSelectedIds, setPendingSelectedIds] = useState<string[]>(selectedIds);

  useEffect(() => {
    if (!visible) {
      wasVisibleRef.current = false;
      setSearch('');
      setCategory('all');
      setBodyPart('all');
      setEquipment('all');
      setPendingSelectedIds(selectedIds);
      return;
    }

    if (!wasVisibleRef.current) {
      wasVisibleRef.current = true;
      setPendingSelectedIds(selectedIds);
    }

    if (autoFocusSearch) {
      const timeout = setTimeout(() => {
        searchRef.current?.focus();
      }, 40);

      return () => clearTimeout(timeout);
    }

    return undefined;
  }, [autoFocusSearch, selectedIds, visible]);

  const effectiveSelectedIds = multiSelect ? pendingSelectedIds : selectedIds;

  const quickBodyPartOptions = useMemo<Array<'all' | ExerciseBodyPart>>(
    () => ['all', 'chest', 'back', 'shoulders', 'legs', 'glutes', 'core', 'full body'],
    [],
  );

  function handleSelectItem(item: ExerciseLibraryItem) {
    if (!multiSelect) {
      if (selectedIds.includes(item.id)) {
        return;
      }
      onSelectItem(item);
      return;
    }

    setPendingSelectedIds((current) =>
      current.includes(item.id) ? current.filter((value) => value !== item.id) : [...current, item.id],
    );
  }

  function handleConfirmSelection() {
    if (!multiSelect || !onConfirmSelection) {
      return;
    }

    const selectedItems = items.filter((item) => pendingSelectedIds.includes(item.id));
    onConfirmSelection(selectedItems);
  }

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();

    return items.filter((item) => {
      if (query && !buildSearchHaystack(item).includes(query)) {
        return false;
      }
      if (category !== 'all' && item.category !== category) {
        return false;
      }
      if (bodyPart !== 'all' && item.bodyPart !== bodyPart) {
        return false;
      }
      if (equipment !== 'all' && item.equipment !== equipment) {
        return false;
      }
      return true;
    });
  }, [bodyPart, category, equipment, items, search]);

  const suggestedItems = useMemo(
    () =>
      getSuggestedExerciseLibraryItems({
        exerciseLibrary: items,
        currentItemIds,
        recentItems,
      }),
    [currentItemIds, items, recentItems],
  );

  const commonStarterItems = useMemo(() => findCommonExerciseItems(items).slice(0, 8), [items]);
  const commonStarterOrder = useMemo(() => buildCommonExerciseOrder(items), [items]);

  const hasCustomFilters = category !== 'all' || bodyPart !== 'all' || equipment !== 'all';
  const showSuggestedOrdering = search.trim().length === 0 && !hasCustomFilters;

  const orderedItems = useMemo(() => {
    const base = [...filteredItems];

    if (!showSuggestedOrdering) {
      return base.sort((left, right) => left.name.localeCompare(right.name));
    }

    const recentOrder = new Map(
      recentItems.slice(0, 8).map((item, index) => [item.id, index]),
    );
    const suggestedOrder = new Map(
      (currentItemIds.length === 0 ? commonStarterItems : suggestedItems)
        .slice(0, 12)
        .map((item, index) => [item.id, index]),
    );

    return base.sort((left, right) => {
      const leftRecent = recentOrder.get(left.id);
      const rightRecent = recentOrder.get(right.id);
      if (leftRecent !== undefined && rightRecent !== undefined) {
        return leftRecent - rightRecent;
      }
      if (leftRecent !== undefined) {
        return -1;
      }
      if (rightRecent !== undefined) {
        return 1;
      }

      const leftSuggested = suggestedOrder.get(left.id);
      const rightSuggested = suggestedOrder.get(right.id);
      if (leftSuggested !== undefined && rightSuggested !== undefined) {
        return leftSuggested - rightSuggested;
      }
      if (leftSuggested !== undefined) {
        return -1;
      }
      if (rightSuggested !== undefined) {
        return 1;
      }

      const leftCommon = commonStarterOrder.get(left.id);
      const rightCommon = commonStarterOrder.get(right.id);
      if (leftCommon !== undefined && rightCommon !== undefined) {
        return leftCommon - rightCommon;
      }
      if (leftCommon !== undefined) {
        return -1;
      }
      if (rightCommon !== undefined) {
        return 1;
      }

      return left.name.localeCompare(right.name);
    });
  }, [
    commonStarterItems,
    commonStarterOrder,
    currentItemIds.length,
    filteredItems,
    recentItems,
    showSuggestedOrdering,
    suggestedItems,
  ]);

  const listTitle = showSuggestedOrdering
    ? currentItemIds.length === 0
      ? 'Popular to start'
      : 'Suggested for today'
    : 'All exercises';
  const listSubtitle = showSuggestedOrdering
    ? currentItemIds.length === 0
      ? 'Common first picks for a new workout.'
      : 'Based on what is already in this workout.'
    : `${orderedItems.length} available`;

  const popularItems = useMemo(() => {
    if (!showSuggestedOrdering) {
      return [];
    }
    return orderedItems.filter((item) => commonStarterOrder.has(item.id)).slice(0, 4);
  }, [commonStarterOrder, orderedItems, showSuggestedOrdering]);

  const popularItemIds = useMemo(() => new Set(popularItems.map((item) => item.id)), [popularItems]);

  const mainItems = useMemo(() => {
    if (!showSuggestedOrdering) {
      return orderedItems;
    }
    return orderedItems.filter((item) => !popularItemIds.has(item.id));
  }, [orderedItems, popularItemIds, showSuggestedOrdering]);

  const listHeader = (
    <>
      <View style={styles.searchCard}>
        <Text style={styles.searchLabel}>Search</Text>
        <View style={styles.searchRow}>
          <TextInput
            ref={searchRef}
            value={search}
            onChangeText={setSearch}
            placeholder="Search exercises"
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
            selectionColor={colors.accent}
          />
          {search.length > 0 ? (
            <Pressable onPress={() => setSearch('')} style={styles.clearButton}>
              <Text style={styles.clearButtonText}>Clear</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {multiSelect ? (
        <View style={styles.quickBodyPartGroup}>
          <Text style={styles.filterTitle}>Body part</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickBodyPartRow}>
            {quickBodyPartOptions.map((option) => {
              const active = option === bodyPart;
              return (
                <Pressable
                  key={option}
                  onPress={() => setBodyPart(option)}
                  style={[styles.quickBodyPartChip, active && styles.quickBodyPartChipActive]}
                >
                  <Text style={[styles.quickBodyPartChipText, active && styles.quickBodyPartChipTextActive]}>
                    {toBodyPartQuickLabel(option)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : (
        <>
          <FilterPillGroup title="Category" options={categoryOptions} selected={category} onSelect={setCategory} />
          <FilterPillGroup title="Body part" options={bodyPartOptions} selected={bodyPart} onSelect={setBodyPart} />
          <FilterPillGroup title="Equipment" options={equipmentOptions} selected={equipment} onSelect={setEquipment} />
        </>
      )}
    </>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.headerTitle}>{title}</Text>
              {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>Close</Text>
            </Pressable>
          </View>

          <FlatList
            data={mainItems}
            keyExtractor={(item) => item.id}
            numColumns={2}
            initialNumToRender={12}
            maxToRenderPerBatch={16}
            windowSize={8}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            columnWrapperStyle={styles.gridRow}
            contentContainerStyle={styles.content}
            ListHeaderComponent={
              <>
                {listHeader}
                {popularItems.length > 0 ? (
                  <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                      <Text style={styles.sectionTitle}>Popular to start</Text>
                      <Text style={styles.sectionSubtitle}>Common first picks for a new workout.</Text>
                    </View>
                    <View style={styles.featuredGrid}>
                      {popularItems.map((item) => {
                        const selected = effectiveSelectedIds.includes(item.id);
                        const previewImage = item.imageUrls?.[0] ?? null;

                        return (
                          <Pressable
                            key={item.id}
                            onPress={() => handleSelectItem(item)}
                            style={[styles.gridCard, styles.featuredCard, selected && styles.gridCardSelected]}
                          >
                            <View style={styles.gridCardMedia}>
                              {previewImage ? (
                                <Image source={{ uri: previewImage }} style={styles.gridCardImage} resizeMode="cover" />
                              ) : (
                                <View style={styles.gridCardImageFallback}>
                                  <Text style={styles.gridCardImageFallbackText}>{item.name.charAt(0).toUpperCase()}</Text>
                                </View>
                              )}

                              {multiSelect ? (
                                <View style={[styles.gridCheckBadge, selected && styles.gridCheckBadgeActive]}>
                                  <Text style={[styles.gridCheckBadgeText, selected && styles.gridCheckBadgeTextActive]}>
                                    {selected ? '\u2713' : '+'}
                                  </Text>
                                </View>
                              ) : null}
                            </View>

                            <View style={styles.gridCardCopy}>
                              <Text numberOfLines={2} style={styles.gridCardTitle}>{item.name}</Text>
                              <Text numberOfLines={1} style={styles.gridCardBodyPart}>{toLabel(item.bodyPart)}</Text>
                              <Text numberOfLines={2} style={styles.gridCardMeta}>
                                {toLabel(item.category)} · {toLabel(item.equipment)}
                              </Text>
                              {!multiSelect ? (
                                <View style={[styles.gridActionPill, selected && styles.gridActionPillSelected]}>
                                  <Text style={[styles.gridActionText, selected && styles.gridActionTextSelected]}>
                                    {selected ? 'Added' : actionLabel}
                                  </Text>
                                </View>
                              ) : null}
                            </View>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ) : null}

                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>{showSuggestedOrdering ? 'All exercises' : listTitle}</Text>
                    <Text style={styles.sectionSubtitle}>
                      {showSuggestedOrdering ? `${mainItems.length} available` : listSubtitle}
                    </Text>
                  </View>
                </View>
              </>
            }
            ListEmptyComponent={
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No matches</Text>
                <Text style={styles.emptyText}>Adjust the search or filters to widen the results.</Text>
              </View>
            }
            renderItem={({ item }) => {
              const selected = effectiveSelectedIds.includes(item.id);
              const previewImage = item.imageUrls?.[0] ?? null;

              return (
                <Pressable onPress={() => handleSelectItem(item)} style={[styles.gridCard, selected && styles.gridCardSelected]}>
                  <View style={styles.gridCardMedia}>
                    {previewImage ? (
                      <Image source={{ uri: previewImage }} style={styles.gridCardImage} resizeMode="cover" />
                    ) : (
                      <View style={styles.gridCardImageFallback}>
                        <Text style={styles.gridCardImageFallbackText}>{item.name.charAt(0).toUpperCase()}</Text>
                      </View>
                    )}

                    {multiSelect ? (
                      <View style={[styles.gridCheckBadge, selected && styles.gridCheckBadgeActive]}>
                        <Text style={[styles.gridCheckBadgeText, selected && styles.gridCheckBadgeTextActive]}>
                          {selected ? '\u2713' : '+'}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.gridCardCopy}>
                    <Text numberOfLines={2} style={styles.gridCardTitle}>{item.name}</Text>
                    <Text numberOfLines={1} style={styles.gridCardBodyPart}>{toLabel(item.bodyPart)}</Text>
                    <Text numberOfLines={2} style={styles.gridCardMeta}>
                      {toLabel(item.category)} · {toLabel(item.equipment)}
                    </Text>
                    {!multiSelect ? (
                      <View style={[styles.gridActionPill, selected && styles.gridActionPillSelected]}>
                        <Text style={[styles.gridActionText, selected && styles.gridActionTextSelected]}>
                          {selected ? 'Added' : actionLabel}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </Pressable>
              );
            }}
          />

          {multiSelect ? (
            <View style={styles.footer}>
              <Text style={styles.footerSelectionText}>
                {pendingSelectedIds.length === 0
                  ? 'Select one or more exercises'
                  : `${pendingSelectedIds.length} selected`}
              </Text>
              <Pressable
                onPress={handleConfirmSelection}
                disabled={pendingSelectedIds.length === 0}
                style={[styles.confirmButton, pendingSelectedIds.length === 0 && styles.confirmButtonDisabled]}
              >
                <Text style={styles.confirmButtonText}>
                  {confirmActionLabel ??
                    `Add ${pendingSelectedIds.length} exercise${pendingSelectedIds.length === 1 ? '' : 's'}`}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(17, 17, 17, 0.16)',
  },
  sheet: {
    maxHeight: '92%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: '#D1D5DB',
    marginTop: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  headerTitle: {
    color: '#111111',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  headerSubtitle: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '600',
  },
  closeButton: {
    minHeight: 36,
    justifyContent: 'center',
  },
  closeButtonText: {
    color: '#111111',
    fontSize: 14,
    fontWeight: '700',
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  searchCard: {
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  searchLabel: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    minHeight: 52,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.md,
    color: '#111111',
    fontSize: 15,
    fontWeight: '600',
  },
  clearButton: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  clearButtonText: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '700',
  },
  filterGroup: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  filterTitle: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  filterPill: {
    minHeight: 38,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  filterPillActive: {
    backgroundColor: '#E8F6EC',
    borderColor: '#22C55E',
  },
  filterPillText: {
    color: '#4B5563',
    fontSize: 12,
    fontWeight: '700',
  },
  filterPillTextActive: {
    color: '#166534',
  },
  quickBodyPartGroup: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  quickBodyPartRow: {
    gap: spacing.sm,
    paddingRight: spacing.md,
  },
  quickBodyPartChip: {
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
  },
  quickBodyPartChipActive: {
    backgroundColor: '#22C55E',
    borderColor: '#22C55E',
  },
  quickBodyPartChipText: {
    color: '#4B5563',
    fontSize: 13,
    fontWeight: '800',
  },
  quickBodyPartChipTextActive: {
    color: '#FFFFFF',
  },
  section: {
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  sectionHeader: {
    gap: 2,
  },
  sectionTitle: {
    color: '#111111',
    fontSize: 18,
    fontWeight: '800',
  },
  sectionSubtitle: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '600',
  },
  featuredGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  featuredCard: {
    maxWidth: '48%',
    marginBottom: 0,
  },
  gridRow: {
    gap: spacing.md,
  },
  gridCard: {
    flex: 1,
    maxWidth: '48%',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  gridCardSelected: {
    borderColor: '#22C55E',
    backgroundColor: '#F8FFFA',
  },
  gridCardMedia: {
    position: 'relative',
    aspectRatio: 0.84,
    backgroundColor: '#F3F4F6',
  },
  gridCardImage: {
    width: '100%',
    height: '100%',
  },
  gridCardImageFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  gridCardImageFallbackText: {
    color: '#111111',
    fontSize: 28,
    fontWeight: '900',
  },
  gridCheckBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridCheckBadgeActive: {
    backgroundColor: '#22C55E',
    borderColor: '#22C55E',
  },
  gridCheckBadgeText: {
    color: '#111111',
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 18,
  },
  gridCheckBadgeTextActive: {
    color: '#FFFFFF',
  },
  gridCardCopy: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: 4,
  },
  gridCardTitle: {
    color: '#111111',
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 20,
  },
  gridCardBodyPart: {
    color: '#111111',
    fontSize: 13,
    fontWeight: '700',
  },
  gridCardMeta: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
    minHeight: 32,
  },
  gridActionPill: {
    marginTop: 6,
    alignSelf: 'flex-start',
    minHeight: 28,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111111',
  },
  gridActionPillSelected: {
    backgroundColor: '#E8F6EC',
  },
  gridActionText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  gridActionTextSelected: {
    color: '#166534',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    gap: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    padding: spacing.md,
    marginBottom: spacing.sm,
    minHeight: 116,
  },
  cardSelected: {
    borderColor: '#22C55E',
    backgroundColor: '#F8FFFA',
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  cardMedia: {
    width: 92,
    height: 92,
    flexShrink: 0,
    borderRadius: radii.md,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardImageFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  cardImageFallbackText: {
    color: '#111111',
    fontSize: 22,
    fontWeight: '900',
  },
  cardCopy: {
    flex: 1,
    flexShrink: 1,
    gap: 6,
    justifyContent: 'center',
    paddingRight: 8,
  },
  name: {
    color: '#111111',
    fontSize: 17,
    fontWeight: '800',
  },
  meta: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '600',
  },
  actionButton: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#111111',
  },
  actionButtonDisabled: {
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  actionButtonTextDisabled: {
    color: '#9CA3AF',
  },
  checkBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    top: 10,
    right: 10,
  },
  checkBadgeActive: {
    backgroundColor: '#22C55E',
    borderColor: '#22C55E',
  },
  checkBadgeText: {
    color: 'transparent',
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 18,
  },
  checkBadgeTextActive: {
    color: '#FFFFFF',
  },
  emptyCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    padding: spacing.lg,
    gap: spacing.xs,
  },
  emptyTitle: {
    color: '#111111',
    fontSize: 16,
    fontWeight: '800',
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    gap: spacing.xs,
  },
  footerSelectionText: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  confirmButton: {
    minHeight: 54,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111111',
  },
  confirmButtonDisabled: {
    opacity: 0.45,
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
