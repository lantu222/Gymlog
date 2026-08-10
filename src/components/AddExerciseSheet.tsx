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

import {
  getPopularExerciseLibraryItems,
  getPopularExerciseLibraryOrder,
  getSuggestedExerciseLibraryItems,
} from '../lib/exerciseSuggestions';
import { exerciseNameLabel } from '../lib/exerciseNameLabel';
import { I18nKey, t } from '../lib/i18n';
import {
  AppLanguage,
  ExerciseBodyPart,
  ExerciseCategory,
  ExerciseEquipment,
  ExerciseLibraryItem,
} from '../types/models';
import { CutButton } from './CutButton';
import { Theme, useTheme, useThemedStyles } from '../theming';
import { radii, spacing } from '../theme';

interface AddExerciseSheetProps {
  visible: boolean;
  language?: AppLanguage;
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

function sortName(item: ExerciseLibraryItem, language: AppLanguage) {
  return exerciseNameLabel(language, item.name);
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

// The library's category / body-part / equipment values are stored English and
// used for filtering, so only the label is translated.
const FACET_KEYS: Record<string, I18nKey> = {
  all: 'facet.all',
  compound: 'facet.compound',
  isolation: 'facet.isolation',
  cardio: 'facet.cardio',
  core: 'facet.core',
  chest: 'facet.chest',
  back: 'facet.back',
  shoulders: 'facet.shoulders',
  legs: 'facet.legs',
  biceps: 'facet.biceps',
  triceps: 'facet.triceps',
  glutes: 'facet.glutes',
  'full body': 'facet.fullBody',
  barbell: 'facet.barbell',
  dumbbell: 'facet.dumbbell',
  machine: 'facet.machine',
  cable: 'facet.cable',
  bodyweight: 'facet.bodyweight',
};

function toLabel(value: string, language: AppLanguage) {
  const key = FACET_KEYS[value];
  if (key) {
    return t(language, key);
  }

  return value
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function buildSearchHaystack(item: ExerciseLibraryItem, language: AppLanguage) {
  // Both spellings, so a Finnish search term and an English one both land.
  return [item.name, exerciseNameLabel(language, item.name), item.category, item.bodyPart, item.equipment]
    .join(' ')
    .toLowerCase();
}

interface FilterPillGroupProps<T extends string> {
  title: string;
  options: T[];
  selected: T;
  language: AppLanguage;
  onSelect: (value: T) => void;
}

function FilterPillGroup<T extends string>({
  title,
  options,
  selected,
  language,
  onSelect,
}: FilterPillGroupProps<T>) {
  const styles = useThemedStyles(makeStyles);

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
              <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>
                {toLabel(option, language)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function AddExerciseSheet({
  visible,
  language = 'en',
  items,
  recentItems,
  currentItemIds = [],
  selectedIds = [],
  title,
  subtitle,
  actionLabel,
  confirmActionLabel,
  autoFocusSearch = false,
  multiSelect = false,
  onClose,
  onSelectItem,
  onConfirmSelection,
}: AddExerciseSheetProps) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const sheetTitle = title ?? t(language, 'editor.addExercise');
  const addLabel = actionLabel ?? t(language, 'editor.add');
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
      if (query && !buildSearchHaystack(item, language).includes(query)) {
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
  }, [bodyPart, category, equipment, items, language, search]);

  const suggestedItems = useMemo(
    () =>
      getSuggestedExerciseLibraryItems({
        exerciseLibrary: items,
        currentItemIds,
        recentItems,
      }),
    [currentItemIds, items, recentItems],
  );

  const commonStarterItems = useMemo(() => getPopularExerciseLibraryItems(items).slice(0, 8), [items]);
  const commonStarterOrder = useMemo(() => getPopularExerciseLibraryOrder(items), [items]);

  const hasCustomFilters = category !== 'all' || bodyPart !== 'all' || equipment !== 'all';
  const showSuggestedOrdering = search.trim().length === 0 && !hasCustomFilters;

  const orderedItems = useMemo(() => {
    const base = [...filteredItems];

    if (!showSuggestedOrdering) {
      return base.sort((left, right) => sortName(left, language).localeCompare(sortName(right, language)));
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

      return sortName(left, language).localeCompare(sortName(right, language));
    });
  }, [
    language,
    commonStarterItems,
    commonStarterOrder,
    currentItemIds.length,
    filteredItems,
    recentItems,
    showSuggestedOrdering,
    suggestedItems,
  ]);

  const listTitle = showSuggestedOrdering
    ? t(language, currentItemIds.length === 0 ? 'sheet.popular' : 'sheet.suggested')
    : t(language, 'sheet.allExercises');
  const listSubtitle = showSuggestedOrdering
    ? t(language, currentItemIds.length === 0 ? 'sheet.popularSub' : 'sheet.suggestedSub')
    : t(language, 'sheet.available', { count: orderedItems.length });

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
        <Text style={styles.searchLabel}>{t(language, 'sheet.search')}</Text>
        <View style={styles.searchRow}>
          <TextInput
            ref={searchRef}
            value={search}
            onChangeText={setSearch}
            placeholder={t(language, 'sheet.searchPlaceholder')}
            placeholderTextColor={theme.faint}
            style={styles.searchInput}
            selectionColor={theme.purple}
          />
          {search.length > 0 ? (
            <Pressable onPress={() => setSearch('')} style={styles.clearButton}>
              <Text style={styles.clearButtonText}>{t(language, 'sheet.clear')}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {multiSelect ? (
        <View style={styles.quickBodyPartGroup}>
          <Text style={styles.filterTitle}>{t(language, 'sheet.bodyPart')}</Text>
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
                    {toLabel(option, language)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : (
        <>
          <FilterPillGroup
            title={t(language, 'sheet.category')}
            options={categoryOptions}
            selected={category}
            language={language}
            onSelect={setCategory}
          />
          <FilterPillGroup
            title={t(language, 'sheet.bodyPart')}
            options={bodyPartOptions}
            selected={bodyPart}
            language={language}
            onSelect={setBodyPart}
          />
          <FilterPillGroup
            title={t(language, 'sheet.equipment')}
            options={equipmentOptions}
            selected={equipment}
            language={language}
            onSelect={setEquipment}
          />
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
              <Text style={styles.headerTitle}>{sheetTitle}</Text>
              {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>{t(language, 'common.close')}</Text>
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
                      <Text style={styles.sectionTitle}>{t(language, 'sheet.popular')}</Text>
                      <Text style={styles.sectionSubtitle}>{t(language, 'sheet.popularSub')}</Text>
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
                              <Text numberOfLines={2} style={styles.gridCardTitle}>
                                {exerciseNameLabel(language, item.name)}
                              </Text>
                              <Text numberOfLines={1} style={styles.gridCardBodyPart}>
                                {toLabel(item.bodyPart, language)}
                              </Text>
                              <Text numberOfLines={2} style={styles.gridCardMeta}>
                                {toLabel(item.category, language)} · {toLabel(item.equipment, language)}
                              </Text>
                              {!multiSelect ? (
                                <View style={[styles.gridActionPill, selected && styles.gridActionPillSelected]}>
                                  <Text style={[styles.gridActionText, selected && styles.gridActionTextSelected]}>
                                    {selected ? t(language, 'sheet.added') : addLabel}
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
                    <Text style={styles.sectionTitle}>
                      {showSuggestedOrdering ? t(language, 'sheet.allExercises') : listTitle}
                    </Text>
                    <Text style={styles.sectionSubtitle}>
                      {showSuggestedOrdering
                        ? t(language, 'sheet.available', { count: mainItems.length })
                        : listSubtitle}
                    </Text>
                  </View>
                </View>
              </>
            }
            ListEmptyComponent={
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>{t(language, 'sheet.noMatches')}</Text>
                <Text style={styles.emptyText}>{t(language, 'sheet.noMatchesBody')}</Text>
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
                    <Text numberOfLines={2} style={styles.gridCardTitle}>
                                {exerciseNameLabel(language, item.name)}
                              </Text>
                    <Text numberOfLines={1} style={styles.gridCardBodyPart}>
                                {toLabel(item.bodyPart, language)}
                              </Text>
                    <Text numberOfLines={2} style={styles.gridCardMeta}>
                      {toLabel(item.category, language)} · {toLabel(item.equipment, language)}
                    </Text>
                    {!multiSelect ? (
                      <View style={[styles.gridActionPill, selected && styles.gridActionPillSelected]}>
                        <Text style={[styles.gridActionText, selected && styles.gridActionTextSelected]}>
                          {selected ? t(language, 'sheet.added') : addLabel}
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
                  ? t(language, 'sheet.selectSome')
                  : t(language, 'sheet.selectedCount', { count: pendingSelectedIds.length })}
              </Text>
              <CutButton
                label={
                  confirmActionLabel ??
                  t(
                    language,
                    pendingSelectedIds.length === 1 ? 'sheet.addOne' : 'sheet.addCount',
                    { count: pendingSelectedIds.length },
                  )
                }
                onPress={pendingSelectedIds.length === 0 ? undefined : handleConfirmSelection}
                variant={pendingSelectedIds.length === 0 ? 'disabled' : 'primary'}
                size="lg"
                stretch
              />
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(17, 17, 17, 0.16)',
  },
  sheet: {
    maxHeight: '92%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
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
    color: theme.ink,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  headerSubtitle: {
    color: theme.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  closeButton: {
    minHeight: 36,
    justifyContent: 'center',
  },
  closeButtonText: {
    color: theme.ink,
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
    color: theme.muted,
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
    borderColor: theme.border,
    backgroundColor: theme.surface,
    paddingHorizontal: spacing.md,
    color: theme.ink,
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
    borderColor: theme.border,
    backgroundColor: theme.surface,
  },
  clearButtonText: {
    color: theme.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  filterGroup: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  filterTitle: {
    color: theme.muted,
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
    borderColor: theme.border,
    backgroundColor: theme.surface,
  },
  filterPillActive: {
    backgroundColor: '#E8F6EC',
    borderColor: '#22C55E',
  },
  filterPillText: {
    color: theme.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  filterPillTextActive: {
    color: theme.greenInk,
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
    borderColor: theme.border,
    backgroundColor: theme.surface,
  },
  quickBodyPartChipActive: {
    backgroundColor: '#22C55E',
    borderColor: '#22C55E',
  },
  quickBodyPartChipText: {
    color: theme.muted,
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
    color: theme.ink,
    fontSize: 18,
    fontWeight: '800',
  },
  sectionSubtitle: {
    color: theme.muted,
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
    borderColor: theme.border,
    backgroundColor: theme.surface,
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
    backgroundColor: theme.surfaceSoft,
  },
  gridCardImage: {
    width: '100%',
    height: '100%',
  },
  gridCardImageFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.surfaceSoft,
  },
  gridCardImageFallbackText: {
    color: theme.ink,
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
    borderColor: theme.border,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridCheckBadgeActive: {
    backgroundColor: '#22C55E',
    borderColor: '#22C55E',
  },
  gridCheckBadgeText: {
    color: theme.ink,
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
    color: theme.ink,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 20,
  },
  gridCardBodyPart: {
    color: theme.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  gridCardMeta: {
    color: theme.muted,
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
    backgroundColor: theme.purpleBright,
  },
  gridActionPillSelected: {
    backgroundColor: theme.greenSoft,
  },
  gridActionText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  gridActionTextSelected: {
    color: theme.greenInk,
  },
  emptyCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  emptyTitle: {
    color: theme.ink,
    fontSize: 16,
    fontWeight: '800',
  },
  emptyText: {
    color: theme.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    backgroundColor: theme.surface,
    gap: spacing.xs,
  },
  footerSelectionText: {
    color: theme.muted,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
});
