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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  getPopularExerciseLibraryItems,
  getPopularExerciseLibraryOrder,
  getSuggestedExerciseLibraryItems,
} from '../lib/exerciseSuggestions';
import { exerciseNameLabel } from '../lib/exerciseNameLabel';
import { filterBrowsableExercises } from '../lib/exerciseBrowseFilter';
import { buildExerciseSearchHaystack, exerciseMatchesQuery } from '../lib/exerciseSearch';
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
  const insets = useSafeAreaInsets();
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

    // Stretches and cone drills are in the library but are not sets, and they
    // came back alongside the bench press whenever a body part was picked
    // (#bugs 2026-08-26). A typed query lifts the hiding: see the module.
    return filterBrowsableExercises(items, { query }).filter((item) => {
      if (query && !exerciseMatchesQuery(buildExerciseSearchHaystack(item, language), query)) {
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

          {/* `flex: 1, minHeight: 0` is what keeps the footer on screen.
              Without it the list is laid out at its content height — hundreds
              of exercises — inside a sheet capped at 92% with overflow hidden,
              so "Lisää N liikettä" was pushed past the sheet's own bottom edge
              and clipped away. It looked like a button hidden behind the phone's
              system bar, and padding it up did nothing, because it was never on
              screen to begin with (user 2026-08-26, second report). */}
          <FlatList
            style={styles.grid}
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
                              <Text numberOfLines={3} style={styles.gridCardTitle}>
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
                    <Text numberOfLines={3} style={styles.gridCardTitle}>
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
            /* The sheet is anchored to the bottom edge and its footer padding
               was a fixed number, so on a phone with system buttons the confirm
               button sat behind them — and "Lisää N liikettä" is the only way
               anything gets added at all ("nappi häviää alas... mitään
               liikkeitä ei voi lisätä", #bugs 2026-08-26). The bar's height is
               only known at runtime. */
            <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
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
    backgroundColor: 'rgba(6, 4, 16, 0.45)',
  },
  /**
   * The sheet stands on `bg`, not on `surface`.
   *
   * Both the sheet and the cards inside it were `surface`, which in dark is a
   * lighter indigo than the app behind them — so the sheet read as a pale
   * rectangle pasted over a near-black screen, and the cards had no edge
   * against it ("tausta värikin näyttää oudolta", #bugs 2026-08-26). Ground on
   * `bg` and the sheet belongs to the app; the cards keep `surface` and lift
   * off it.
   */
  sheet: {
    maxHeight: '92%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: theme.bg,
    borderWidth: 1,
    borderColor: theme.border,
    overflow: 'hidden',
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: theme.border,
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
  // The list takes the space left over, rather than the space it wants.
  grid: { flexGrow: 1, flexShrink: 1, minHeight: 0 },
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
    backgroundColor: theme.purpleLight,
    borderColor: theme.purple,
  },
  filterPillText: {
    color: theme.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  filterPillTextActive: {
    color: theme.purpleDark,
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
    backgroundColor: theme.purple,
    borderColor: theme.purple,
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
  /**
   * Two per row, by giving the card a width to wrap on.
   *
   * It inherited `flex: 1` from gridCard, and `flex: 1` means `flexBasis: 0` —
   * a child with no base width never makes the line overflow, so `flexWrap`
   * had nothing to trigger on and all four popular exercises shared one row at
   * about 80dp each. The names broke every three letters (user 2026-08-26).
   *
   * The basis is 47 rather than 48 because the gap counts too: two 48% cards
   * plus a 16dp gap is wider than the row, which would wrap them to one per
   * line instead. Grow fills whatever is left over, capped at 48%.
   */
  featuredCard: {
    flexGrow: 1,
    flexShrink: 0,
    flexBasis: '47%',
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
    borderColor: theme.purple,
    backgroundColor: theme.purpleLight,
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
    backgroundColor: theme.purple,
    borderColor: theme.purple,
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
  /**
   * Sized for Finnish compounds, not for English.
   *
   * "Istuen ojentajapunnerrus" broke as "Istuen ojentajap / unnerrus" and the
   * card next to it truncated mid-word at two lines (#bugs 2026-08-26). The
   * card is about 141dp of text at a 411dp screen, and the longest single word
   * in the library is 25 characters, so no size makes every name fit on one
   * line — the aim is that the common name fits and the long one is at least
   * shown whole. 14dp holds roughly eighteen characters, and the third line
   * takes what is left rather than cutting it off.
   */
  gridCardTitle: {
    color: theme.ink,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 18,
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
    backgroundColor: theme.purpleLight,
  },
  gridActionText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  gridActionTextSelected: {
    color: theme.purpleDark,
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
