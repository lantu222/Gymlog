import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { GymlogIcon, GymlogIconName } from './GymlogIcon';
import { getPopularExerciseLibraryOrder } from '../lib/exerciseSuggestions';
import { HG } from '../lightTheme';
import { layout } from '../theme';
import { ExerciseBodyPart, ExerciseLibraryItem } from '../types/models';

// Card is 180 wide with a 1px border → 178 content width for the photo.
const CARD_IMAGE_WIDTH = 178;

interface ExerciseLibraryBrowserProps {
  items: ExerciseLibraryItem[];
  trackedIds?: string[];
  onOpenItem?: (item: ExerciseLibraryItem) => void;
  onToggleTracked?: (item: ExerciseLibraryItem) => void;
  onAddToWorkout?: (item: ExerciseLibraryItem) => void;
}

function buildSearchHaystack(item: ExerciseLibraryItem) {
  return [
    item.name,
    item.bodyPart,
    item.category,
    item.equipment,
    ...(item.primaryMuscles ?? []),
    ...(item.secondaryMuscles ?? []),
  ]
    .join(' ')
    .toLowerCase();
}

function formatFilterLabel(raw: string) {
  return raw
    .split(/[_\s/()-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatCompactBodyPartLabel(raw: string) {
  if (raw === 'all') {
    return 'All';
  }
  if (raw === 'full body') {
    return 'Full body';
  }
  return formatFilterLabel(raw);
}

function getBodyPartIcon(bodyPart: ExerciseBodyPart | 'all'): GymlogIconName {
  switch (bodyPart) {
    case 'chest':
      return 'chest';
    case 'back':
      return 'back';
    case 'shoulders':
      return 'shoulders';
    case 'legs':
      return 'legs';
    case 'biceps':
    case 'triceps':
      return 'arms';
    case 'core':
      return 'core';
    case 'glutes':
      return 'glutes';
    case 'full body':
      return 'strength';
    default:
      return 'strength';
  }
}

function getItemImage(item: ExerciseLibraryItem) {
  return item.imageUrls?.[0] ?? null;
}

function useOrderedExercises(items: ExerciseLibraryItem[], filteredItems: ExerciseLibraryItem[]) {
  const commonOrder = useMemo(() => getPopularExerciseLibraryOrder(items), [items]);

  const orderedItems = useMemo(() => {
    return [...filteredItems].sort((left, right) => {
      const leftCommon = commonOrder.get(left.id);
      const rightCommon = commonOrder.get(right.id);

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
  }, [commonOrder, filteredItems]);

  return { commonOrder, orderedItems };
}

function SearchIcon({ color = HG.faint, size = 18 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="11" cy="11" r="7" stroke={color} strokeWidth={2} />
      <Path d="M21 21l-4-4" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function FilterIcon({ color = HG.purpleDark, size = 19 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 6h18M6 12h12M10 18h4" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ListIcon({ color = HG.muted, size = 14 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 7h16M4 12h16M4 17h10" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function PlusIcon({ color = '#FFFFFF', size = 16 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5v14M5 12h14" stroke={color} strokeWidth={2.8} strokeLinecap="round" />
    </Svg>
  );
}

function StarGlyph({ active, size = 18 }: { active: boolean; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={active ? HG.gold : 'none'}>
      <Path
        d="M12 3l2.6 5.5 6 .8-4.4 4.2 1.1 6L12 16.8 6.7 19.5l1.1-6L3.4 9.3l6-.8z"
        stroke={active ? HG.gold : HG.faint}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function DumbbellIcon({ color = HG.faint, size = 22 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function CategoryIcon({ option, color }: { option: string; color: string }) {
  if (option === 'all') {
    return <ListIcon color={color} size={14} />;
  }
  return <GymlogIcon name={getBodyPartIcon(option as ExerciseBodyPart)} color={color} size={14} />;
}

// Explicit numeric width/height (not '%' or absoluteFill): images nested in the
// horizontal rail ScrollViews inside the FlatList header never get an initial
// layout pass on Android, so a size-inheriting <Image> stays at zero and never
// fires onLoad until a scroll forces re-layout. Intrinsic pixel dimensions let
// the image request fire immediately at mount.
function Thumb({
  uri,
  width,
  height,
  radius = 12,
}: {
  uri: string | null;
  width: number;
  height: number;
  radius?: number;
}) {
  const [state, setState] = useState<'load' | 'ok' | 'err'>(uri ? 'load' : 'err');

  useEffect(() => {
    setState(uri ? 'load' : 'err');
  }, [uri]);

  return (
    <View style={{ width, height, borderRadius: radius, overflow: 'hidden', backgroundColor: HG.surfaceSoft }}>
      {uri ? (
        <Image
          source={{ uri }}
          resizeMode="cover"
          style={{ width, height }}
          onLoad={() => setState('ok')}
          onError={() => setState('err')}
        />
      ) : null}
      {state !== 'ok' ? (
        <View style={[StyleSheet.absoluteFill, styles.thumbSkeleton]}>
          {state === 'err' ? <DumbbellIcon /> : null}
        </View>
      ) : null}
    </View>
  );
}

function AddButton({ onPress }: { onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} hitSlop={6} style={styles.addButton}>
      <PlusIcon />
    </Pressable>
  );
}

function FavoriteStar({ active, onPress, framed }: { active: boolean; onPress?: () => void; framed?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} hitSlop={8} style={framed ? styles.starFrame : styles.starPlain}>
      <StarGlyph active={active} size={framed ? 15 : 18} />
    </Pressable>
  );
}

function ExCard({
  item,
  tracked,
  onOpen,
  onAdd,
  onToggleFavorite,
}: {
  item: ExerciseLibraryItem;
  tracked: boolean;
  onOpen: () => void;
  onAdd?: () => void;
  onToggleFavorite?: () => void;
}) {
  return (
    <Pressable onPress={onOpen} style={styles.card}>
      <View style={styles.cardImageWrap}>
        <Thumb uri={getItemImage(item)} radius={0} width={CARD_IMAGE_WIDTH} height={104} />
        <View style={styles.cardStar}>
          <FavoriteStar active={tracked} onPress={onToggleFavorite} framed />
        </View>
      </View>
      <View style={styles.cardBody}>
        <Text numberOfLines={2} style={styles.cardTitle}>
          {item.name}
        </Text>
        <View style={styles.cardFooter}>
          <Text numberOfLines={1} style={styles.cardMeta}>
            {formatFilterLabel(item.bodyPart)}
          </Text>
          <AddButton onPress={onAdd} />
        </View>
      </View>
    </Pressable>
  );
}

function ExRow({
  item,
  tracked,
  onOpen,
  onAdd,
  onToggleFavorite,
}: {
  item: ExerciseLibraryItem;
  tracked: boolean;
  onOpen: () => void;
  onAdd?: () => void;
  onToggleFavorite?: () => void;
}) {
  return (
    <Pressable onPress={onOpen} style={styles.row}>
      <Thumb uri={getItemImage(item)} radius={11} width={52} height={52} />
      <View style={styles.rowCopy}>
        <Text numberOfLines={1} style={styles.rowTitle}>
          {item.name}
        </Text>
        <Text numberOfLines={1} style={styles.rowMeta}>
          {formatFilterLabel(item.bodyPart)} · {formatFilterLabel(item.equipment)} · {formatFilterLabel(item.category)}
        </Text>
      </View>
      <FavoriteStar active={tracked} onPress={onToggleFavorite} />
      <AddButton onPress={onAdd} />
    </Pressable>
  );
}

function SectionHead({ label, action, onAction }: { label: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionHeadLabel}>{label}</Text>
      {action ? (
        <Text onPress={onAction} style={styles.sectionHeadAction}>
          {action}
        </Text>
      ) : null}
    </View>
  );
}

export function ExerciseLibraryBrowser({
  items,
  trackedIds = [],
  onOpenItem,
  onToggleTracked,
  onAddToWorkout,
}: ExerciseLibraryBrowserProps) {
  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [bodyPartFilter, setBodyPartFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [equipmentFilter, setEquipmentFilter] = useState<string>('all');
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef = useRef<TextInput>(null);

  useEffect(
    () => () => {
      if (toastTimer.current) {
        clearTimeout(toastTimer.current);
      }
    },
    [],
  );

  const flash = (message: string) => {
    setToast(message);
    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
    }
    toastTimer.current = setTimeout(() => setToast(null), 1700);
  };

  const bodyPartOptions = useMemo(
    () => ['all', ...Array.from(new Set(items.map((item) => item.bodyPart))).sort((a, b) => a.localeCompare(b))],
    [items],
  );
  const categoryOptions = useMemo(
    () => ['all', ...Array.from(new Set(items.map((item) => item.category))).sort((a, b) => a.localeCompare(b))],
    [items],
  );
  const equipmentOptions = useMemo(
    () => ['all', ...Array.from(new Set(items.map((item) => item.equipment))).sort((a, b) => a.localeCompare(b))],
    [items],
  );

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      if (query.length && !buildSearchHaystack(item).includes(query)) {
        return false;
      }
      if (bodyPartFilter !== 'all' && item.bodyPart !== bodyPartFilter) {
        return false;
      }
      if (categoryFilter !== 'all' && item.category !== categoryFilter) {
        return false;
      }
      if (equipmentFilter !== 'all' && item.equipment !== equipmentFilter) {
        return false;
      }
      return true;
    });
  }, [items, search, bodyPartFilter, categoryFilter, equipmentFilter]);

  const { commonOrder, orderedItems } = useOrderedExercises(items, filteredItems);
  const hasModalFilters = categoryFilter !== 'all' || equipmentFilter !== 'all';
  const showDashboardSections = search.trim().length === 0 && bodyPartFilter === 'all' && !hasModalFilters;

  const activeFilterCount = (categoryFilter !== 'all' ? 1 : 0) + (equipmentFilter !== 'all' ? 1 : 0);

  const trackedSet = useMemo(() => new Set(trackedIds), [trackedIds]);

  const popularItems = useMemo(
    () => orderedItems.filter((item) => commonOrder.has(item.id)).slice(0, 8),
    [commonOrder, orderedItems],
  );
  const favoriteItems = useMemo(
    () => orderedItems.filter((item) => trackedSet.has(item.id)).slice(0, 8),
    [orderedItems, trackedSet],
  );
  const suggestedItems = useMemo(() => {
    const excluded = new Set([...popularItems.map((item) => item.id), ...favoriteItems.map((item) => item.id)]);
    return orderedItems.filter((item) => !excluded.has(item.id)).slice(0, 8);
  }, [favoriteItems, orderedItems, popularItems]);

  const listItems = useMemo(
    () => orderedItems.slice(0, showDashboardSections ? 36 : undefined),
    [orderedItems, showDashboardSections],
  );

  const resultsLabel = showDashboardSections
    ? 'ALL EXERCISES'
    : search.trim().length
      ? 'RESULTS'
      : bodyPartFilter !== 'all'
        ? formatCompactBodyPartLabel(bodyPartFilter).toUpperCase()
        : 'RESULTS';

  function handleOpen(item: ExerciseLibraryItem) {
    onOpenItem?.(item);
  }

  function handleAdd(item: ExerciseLibraryItem) {
    onAddToWorkout?.(item);
  }

  function handleToggleFavorite(item: ExerciseLibraryItem) {
    if (!onToggleTracked) {
      return;
    }
    flash(trackedSet.has(item.id) ? 'Removed from tracked lifts' : 'Added to tracked lifts');
    onToggleTracked(item);
  }

  function renderRail(sectionItems: ExerciseLibraryItem[]) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.rail}
      >
        {sectionItems.map((item) => (
          <ExCard
            key={item.id}
            item={item}
            tracked={trackedSet.has(item.id)}
            onOpen={() => handleOpen(item)}
            onAdd={onAddToWorkout ? () => handleAdd(item) : undefined}
            onToggleFavorite={onToggleTracked ? () => handleToggleFavorite(item) : undefined}
          />
        ))}
      </ScrollView>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={listItems}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <View style={styles.headerRow}>
              <View style={styles.headerCopy}>
                <Text style={styles.title}>Exercises</Text>
                <Text style={styles.subtitle}>Find and add exercises to your workouts.</Text>
              </View>
              <View style={styles.headerActions}>
                <Pressable onPress={() => searchRef.current?.focus()} style={styles.iconButton}>
                  <SearchIcon color={HG.purpleDark} size={19} />
                </Pressable>
                <Pressable onPress={() => setFiltersOpen((current) => !current)} style={styles.iconButton}>
                  <FilterIcon />
                  {activeFilterCount > 0 ? (
                    <View style={styles.filterBadge}>
                      <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                    </View>
                  ) : null}
                </Pressable>
              </View>
            </View>

            <View style={styles.searchShell}>
              <SearchIcon />
              <TextInput
                ref={searchRef}
                value={search}
                onChangeText={setSearch}
                placeholder="Search exercises..."
                placeholderTextColor={HG.faint}
                style={styles.searchInput}
              />
              {search.length ? (
                <Text onPress={() => setSearch('')} style={styles.searchClear}>
                  ×
                </Text>
              ) : null}
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.categoryRail}
            >
              {bodyPartOptions.map((option) => {
                const selected = bodyPartFilter === option;
                return (
                  <Pressable
                    key={option}
                    onPress={() => setBodyPartFilter(option)}
                    style={[styles.categoryChip, selected && styles.categoryChipActive]}
                  >
                    <CategoryIcon option={option} color={selected ? '#FFFFFF' : HG.muted} />
                    <Text style={[styles.categoryChipText, selected && styles.categoryChipTextActive]}>
                      {formatCompactBodyPartLabel(option)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {filtersOpen ? (
              <View style={styles.filtersShell}>
                <Text style={styles.filtersTitle}>Filters</Text>
                <Text style={styles.filtersSubtitle}>Narrow the library by type or equipment.</Text>

                <Text style={styles.filterSectionLabel}>TYPE</Text>
                <View style={styles.filterGrid}>
                  {categoryOptions.map((option) => {
                    const selected = categoryFilter === option;
                    return (
                      <Pressable
                        key={option}
                        onPress={() => setCategoryFilter(option)}
                        style={[styles.filterChip, selected && styles.filterChipSelected]}
                      >
                        <Text style={[styles.filterChipText, selected && styles.filterChipTextSelected]}>
                          {option === 'all' ? 'All' : formatFilterLabel(option)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={[styles.filterSectionLabel, styles.filterSectionLabelSpaced]}>EQUIPMENT</Text>
                <View style={styles.filterGrid}>
                  {equipmentOptions.map((option) => {
                    const selected = equipmentFilter === option;
                    return (
                      <Pressable
                        key={option}
                        onPress={() => setEquipmentFilter(option)}
                        style={[styles.filterChip, selected && styles.filterChipSelected]}
                      >
                        <Text style={[styles.filterChipText, selected && styles.filterChipTextSelected]}>
                          {option === 'all' ? 'All' : formatFilterLabel(option)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {showDashboardSections ? (
              <>
                <View style={styles.dashboardSection}>
                  <SectionHead label="POPULAR EXERCISES" action="View all" />
                  {renderRail(popularItems)}
                </View>

                <View style={styles.dashboardSection}>
                  <SectionHead label="FAVORITES" action={favoriteItems.length ? 'View all' : undefined} />
                  {favoriteItems.length ? (
                    renderRail(favoriteItems)
                  ) : (
                    <View style={styles.emptyFavoriteCard}>
                      <Text style={styles.emptyFavoriteTitle}>No favorites yet</Text>
                      <Text style={styles.emptyFavoriteText}>Tap the star on any exercise to keep it here.</Text>
                    </View>
                  )}
                </View>

                <View style={styles.dashboardSection}>
                  <SectionHead label="SUGGESTED FOR YOUR PLAN" action="View all" />
                  {renderRail(suggestedItems)}
                </View>
              </>
            ) : null}

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{resultsLabel}</Text>
              <Text style={styles.summaryCount}>
                {orderedItems.length} {orderedItems.length === 1 ? 'exercise' : 'exercises'}
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No matches</Text>
            <Text style={styles.emptyText}>Try a broader search or category.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <ExRow
            item={item}
            tracked={trackedSet.has(item.id)}
            onOpen={() => handleOpen(item)}
            onAdd={onAddToWorkout ? () => handleAdd(item) : undefined}
            onToggleFavorite={onToggleTracked ? () => handleToggleFavorite(item) : undefined}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.rowSeparator} />}
      />

      {toast ? (
        <View pointerEvents="none" style={styles.toast}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: HG.bg,
  },
  listContent: {
    paddingBottom: layout.bottomTabBarReserve,
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  headerBlock: {
    paddingBottom: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: HG.ink,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: HG.muted,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: HG.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  filterBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: HG.purple,
    paddingHorizontal: 4,
  },
  filterBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  searchShell: {
    marginTop: 14,
    height: 46,
    borderRadius: 14,
    backgroundColor: HG.surface,
    borderWidth: 1,
    borderColor: HG.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    color: HG.ink,
    fontSize: 14.5,
    fontWeight: '600',
    paddingVertical: 0,
  },
  searchClear: {
    color: HG.faint,
    fontSize: 20,
    fontWeight: '700',
    paddingHorizontal: 2,
  },
  categoryRail: {
    gap: 8,
    paddingTop: 12,
    paddingBottom: 2,
    paddingRight: 8,
  },
  categoryChip: {
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: HG.border,
    backgroundColor: HG.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
  },
  categoryChipActive: {
    borderColor: HG.purple,
    backgroundColor: HG.purple,
  },
  categoryChipText: {
    color: HG.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
  },
  filtersShell: {
    marginTop: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: HG.border,
    backgroundColor: HG.surface,
    padding: 16,
  },
  filtersTitle: {
    color: HG.ink,
    fontSize: 17,
    fontWeight: '800',
  },
  filtersSubtitle: {
    color: HG.muted,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  filterSectionLabel: {
    color: HG.faint,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    marginTop: 14,
  },
  filterSectionLabelSpaced: {
    marginTop: 16,
  },
  filterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  filterChip: {
    minHeight: 34,
    paddingHorizontal: 14,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: HG.bg,
    borderWidth: 1,
    borderColor: HG.border,
  },
  filterChipSelected: {
    backgroundColor: HG.purpleLight,
    borderColor: HG.purple,
  },
  filterChipText: {
    color: HG.muted,
    fontSize: 12.5,
    fontWeight: '700',
  },
  filterChipTextSelected: {
    color: HG.purpleDark,
  },
  dashboardSection: {
    marginTop: 22,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    paddingBottom: 11,
  },
  sectionHeadLabel: {
    color: HG.faint,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  sectionHeadAction: {
    color: HG.purple,
    fontSize: 12.5,
    fontWeight: '800',
  },
  rail: {
    gap: 12,
    paddingRight: 20,
    paddingVertical: 2,
  },
  emptyFavoriteCard: {
    backgroundColor: HG.surface,
    borderWidth: 1,
    borderColor: HG.border,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  emptyFavoriteTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: HG.ink,
  },
  emptyFavoriteText: {
    fontSize: 13,
    fontWeight: '600',
    color: HG.muted,
    marginTop: 4,
  },
  card: {
    width: 180,
    backgroundColor: HG.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: HG.border,
    overflow: 'hidden',
  },
  cardImageWrap: {
    position: 'relative',
  },
  cardStar: {
    position: 'absolute',
    top: 8,
    left: 8,
  },
  cardBody: {
    paddingHorizontal: 12,
    paddingTop: 11,
    paddingBottom: 13,
  },
  cardTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: HG.ink,
    lineHeight: 17,
    height: 34,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 9,
  },
  cardMeta: {
    flex: 1,
    fontSize: 11.5,
    fontWeight: '700',
    color: HG.muted,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: HG.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: HG.border,
  },
  rowSeparator: {
    height: 9,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: HG.ink,
  },
  rowMeta: {
    fontSize: 11.5,
    fontWeight: '600',
    color: HG.muted,
    marginTop: 3,
  },
  thumbSkeleton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: HG.surfaceSoft,
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: HG.green,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  starFrame: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#140A28',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 3,
    elevation: 2,
  },
  starPlain: {
    padding: 2,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    marginTop: 26,
    marginBottom: 12,
  },
  summaryLabel: {
    color: HG.faint,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  summaryCount: {
    color: HG.muted,
    fontSize: 12.5,
    fontWeight: '700',
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 38,
    paddingHorizontal: 10,
  },
  emptyTitle: {
    color: HG.ink,
    fontSize: 15,
    fontWeight: '800',
  },
  emptyText: {
    color: HG.muted,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  toast: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 28,
    alignItems: 'center',
  },
  toastText: {
    backgroundColor: 'rgba(20,12,38,0.94)',
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
});
