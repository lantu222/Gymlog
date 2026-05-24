import React, { useMemo, useState } from 'react';
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
import { colors, layout, spacing } from '../theme';
import { ExerciseBodyPart, ExerciseLibraryItem } from '../types/models';

const GREEN = '#B8FF6A';
const PURPLE = '#C68BFF';
const BACKGROUND = colors.background;
const SURFACE = '#151515';
const SURFACE_SOFT = 'rgba(255,255,255,0.045)';
const BORDER = 'rgba(255,255,255,0.12)';
const TEXT = '#FFFFFF';
const MUTED = 'rgba(255,255,255,0.62)';
const FAINT = 'rgba(255,255,255,0.42)';

const COMMON_EXERCISE_KEYWORDS = [
  ['incline dumbbell press', 'incline bench press'],
  ['chest supported row'],
  ['leg press'],
  ['lateral raise'],
  ['bench press'],
  ['pull-up', 'pull ups', 'pullup'],
  ['romanian deadlift', 'stiff-leg deadlift'],
  ['overhead press', 'shoulder press'],
  ['dumbbell fly', 'fly'],
  ['seated row', 'cable row'],
  ['triceps pushdown', 'cable pushdown', 'pushdown'],
  ['barbell squat', 'squat'],
  ['lat pulldown', 'pulldown'],
  ['biceps curl', 'dumbbell curl', 'barbell curl'],
  ['hip thrust', 'glute bridge'],
  ['calf raise', 'calf press'],
  ['crunch', 'sit-up'],
] as const;

interface ExerciseLibraryBrowserProps {
  items: ExerciseLibraryItem[];
  selectedIds?: string[];
  trackedIds?: string[];
  onSelectItem?: (item: ExerciseLibraryItem) => void;
  onOpenItem?: (item: ExerciseLibraryItem) => void;
  onToggleTracked?: (item: ExerciseLibraryItem) => void;
  actionLabel?: string;
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

function buildCommonExerciseOrder(items: ExerciseLibraryItem[]) {
  const ids: string[] = [];
  const picked = new Set<string>();

  for (const keywords of COMMON_EXERCISE_KEYWORDS) {
    const match = items.find((item) => {
      if (picked.has(item.id)) {
        return false;
      }

      const normalizedName = item.name.toLowerCase();
      return keywords.some((keyword) => normalizedName.includes(keyword));
    });

    if (match) {
      picked.add(match.id);
      ids.push(match.id);
    }
  }

  return new Map(ids.map((id, index) => [id, index]));
}

function SearchIcon({ color = TEXT, size = 20 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="11" cy="11" r="6.5" stroke={color} strokeWidth="2" />
      <Path d="M16 16L21 21" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

function FilterIcon({ color = TEXT, size = 20 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 7H20" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Path d="M7 12H17" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Path d="M10 17H14" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
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
    return 'Full';
  }
  return formatFilterLabel(raw);
}

function buildActiveFilterSummary(parts: string[]) {
  if (!parts.length) {
    return 'All exercises';
  }

  return parts.join(' - ');
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
      return 'check';
  }
}

function getItemImage(item: ExerciseLibraryItem) {
  return item.imageUrls?.[0] ?? null;
}

function useOrderedExercises(items: ExerciseLibraryItem[], filteredItems: ExerciseLibraryItem[]) {
  const commonOrder = useMemo(() => buildCommonExerciseOrder(items), [items]);

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

function ExerciseThumb({ item, size = 58 }: { item: ExerciseLibraryItem; size?: number }) {
  const previewImage = getItemImage(item);

  if (previewImage) {
    return (
      <Image
        source={{ uri: previewImage }}
        resizeMode="cover"
        style={[styles.thumbImage, { width: size, height: size, borderRadius: Math.max(10, Math.round(size * 0.18)) }]}
      />
    );
  }

  return (
    <View style={[styles.thumbFallback, { width: size, height: size, borderRadius: Math.max(10, Math.round(size * 0.18)) }]}>
      <Text style={styles.thumbFallbackText}>{item.name.charAt(0).toUpperCase()}</Text>
    </View>
  );
}

function AddButton({
  selected,
  onPress,
}: {
  selected: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={[styles.addButton, selected && styles.addButtonSelected]}>
      <Text style={[styles.addButtonText, selected && styles.addButtonTextSelected]}>{selected ? '✓' : '+'}</Text>
    </Pressable>
  );
}

function FavoriteButton({
  active,
  onPress,
  compact = false,
}: {
  active: boolean;
  onPress?: () => void;
  compact?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      hitSlop={8}
      style={[styles.favoriteButton, compact && styles.favoriteButtonCompact, active && styles.favoriteButtonActive]}
    >
      <Text style={[styles.favoriteButtonText, compact && styles.favoriteButtonTextCompact, active && styles.favoriteButtonTextActive]}>
        {'\u2605'}
      </Text>
    </Pressable>
  );
}

function MiniExerciseCard({
  item,
  selected,
  tracked,
  onPress,
  onAction,
  onToggleFavorite,
}: {
  item: ExerciseLibraryItem;
  selected: boolean;
  tracked: boolean;
  onPress: () => void;
  onAction?: () => void;
  onToggleFavorite?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.miniCard, selected && styles.cardSelected]}>
      <View style={styles.miniThumbWrap}>
        <ExerciseThumb item={item} size={42} />
        <View style={styles.miniFavoriteWrap}>
          <FavoriteButton active={tracked} compact onPress={onToggleFavorite} />
        </View>
      </View>
      <View style={styles.miniCopy}>
        <Text numberOfLines={2} style={styles.miniTitle}>{item.name}</Text>
        <Text numberOfLines={1} style={styles.miniMeta}>{formatFilterLabel(item.bodyPart)}</Text>
      </View>
      <View style={styles.miniAddWrap}>
        <AddButton selected={selected} onPress={onAction} />
      </View>
    </Pressable>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderCopy}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      </View>
      <Text style={styles.viewAllText}>View all</Text>
    </View>
  );
}

export function ExerciseLibraryBrowser({
  items,
  selectedIds = [],
  trackedIds = [],
  onSelectItem,
  onOpenItem,
  onToggleTracked,
}: ExerciseLibraryBrowserProps) {
  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [bodyPartFilter, setBodyPartFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [equipmentFilter, setEquipmentFilter] = useState<string>('all');

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
  const hasCustomFilters = bodyPartFilter !== 'all' || categoryFilter !== 'all' || equipmentFilter !== 'all';
  const showDashboardSections = search.trim().length === 0 && !hasCustomFilters;

  const activeFilterCount =
    (bodyPartFilter !== 'all' ? 1 : 0) +
    (categoryFilter !== 'all' ? 1 : 0) +
    (equipmentFilter !== 'all' ? 1 : 0);

  const filterSummary = useMemo(() => {
    const parts: string[] = [];
    if (bodyPartFilter !== 'all') {
      parts.push(formatFilterLabel(bodyPartFilter));
    }
    if (categoryFilter !== 'all') {
      parts.push(formatFilterLabel(categoryFilter));
    }
    if (equipmentFilter !== 'all') {
      parts.push(formatFilterLabel(equipmentFilter));
    }
    return buildActiveFilterSummary(parts);
  }, [bodyPartFilter, categoryFilter, equipmentFilter]);

  const recentlyUsedItems = useMemo(
    () => orderedItems.filter((item) => commonOrder.has(item.id)).slice(0, 6),
    [commonOrder, orderedItems],
  );
  const favoriteItems = useMemo(() => {
    const trackedSet = new Set(trackedIds);
    return orderedItems.filter((item) => trackedSet.has(item.id)).slice(0, 6);
  }, [orderedItems, trackedIds]);
  const suggestedItems = useMemo(() => {
    const excluded = new Set([...recentlyUsedItems.map((item) => item.id), ...favoriteItems.map((item) => item.id)]);
    return orderedItems.filter((item) => !excluded.has(item.id)).slice(0, 6);
  }, [favoriteItems, orderedItems, recentlyUsedItems]);

  const listItems = useMemo(() => orderedItems.slice(0, showDashboardSections ? 36 : undefined), [orderedItems, showDashboardSections]);

  function handleOpen(item: ExerciseLibraryItem) {
    if (onOpenItem) {
      onOpenItem(item);
      return;
    }
    if (onSelectItem) {
      onSelectItem(item);
    }
  }

  function handleAction(item: ExerciseLibraryItem) {
    if (onSelectItem) {
      onSelectItem(item);
      return;
    }
    handleOpen(item);
  }

  function renderHorizontalSection({
  title,
  subtitle,
  sectionItems,
  emptyBody,
}: {
  title: string;
  subtitle?: string;
  sectionItems: ExerciseLibraryItem[];
  emptyBody?: string;
}) {
    if (!sectionItems.length && !emptyBody) {
      return null;
    }

    return (
      <View style={styles.dashboardSection}>
        <SectionHeader title={title} subtitle={subtitle} />
        {sectionItems.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalCards}>
            {sectionItems.map((item) => {
              const selected = selectedIds.includes(item.id);
              const tracked = trackedIds.includes(item.id);

              return (
                <MiniExerciseCard
                  key={`${title}:${item.id}`}
                  item={item}
                  selected={selected}
                  tracked={tracked}
                  onPress={() => handleOpen(item)}
                  onAction={() => handleAction(item)}
                  onToggleFavorite={onToggleTracked ? () => onToggleTracked(item) : undefined}
                />
              );
            })}
          </ScrollView>
        ) : (
          <View style={styles.emptyFavoriteCard}>
            <Text style={styles.emptyFavoriteTitle}>No favorites yet</Text>
            <Text style={styles.emptyFavoriteText}>{emptyBody}</Text>
          </View>
        )}
      </View>
    );
  }

  return (
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
              <Pressable style={styles.iconButton}>
                <SearchIcon />
              </Pressable>
              <Pressable onPress={() => setFiltersOpen((current) => !current)} style={[styles.iconButton, filtersOpen && styles.iconButtonActive]}>
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
            <SearchIcon color="rgba(255,255,255,0.56)" size={20} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search exercises..."
              placeholderTextColor="rgba(255,255,255,0.48)"
              style={styles.searchInput}
            />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRail}>
            {bodyPartOptions.map((option) => {
              const selected = bodyPartFilter === option;
              const bodyPart = option as ExerciseBodyPart | 'all';

              return (
                <Pressable
                  key={option}
                  onPress={() => setBodyPartFilter(option)}
                  style={[styles.categoryChip, selected && styles.categoryChipActive]}
                >
                  <GymlogIcon name={getBodyPartIcon(bodyPart)} color={selected ? GREEN : 'rgba(255,255,255,0.76)'} size={13} />
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
              <Text style={styles.filtersSubtitle}>Narrow the library by category or equipment.</Text>

              <View style={styles.filterSection}>
                <Text style={styles.filterSectionLabel}>Category</Text>
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
              </View>

              <View style={styles.filterSection}>
                <Text style={styles.filterSectionLabel}>Equipment</Text>
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
            </View>
          ) : null}

          {showDashboardSections ? (
            <>
              {renderHorizontalSection({ title: 'Recently used', sectionItems: recentlyUsedItems })}
              {renderHorizontalSection({
                title: 'Favorites',
                sectionItems: favoriteItems,
                emptyBody: 'Tap the star on any exercise to keep it here.',
              })}
              {renderHorizontalSection({
                title: 'Suggested for your plan',
                subtitle: 'Based on your current workout focus',
                sectionItems: suggestedItems,
              })}
            </>
          ) : null}

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{showDashboardSections ? 'All exercises' : filterSummary}</Text>
            <Text style={styles.summaryCount}>{orderedItems.length} exercises</Text>
          </View>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No matches</Text>
          <Text style={styles.emptyText}>Try a broader search term.</Text>
        </View>
      }
      renderItem={({ item }) => {
        const selected = selectedIds.includes(item.id);
        const tracked = trackedIds.includes(item.id);

        return (
          <Pressable onPress={() => handleOpen(item)} style={[styles.listRow, selected && styles.cardSelected]}>
            <View style={styles.listThumbWrap}>
              <ExerciseThumb item={item} size={48} />
              <View style={styles.listFavoriteWrap}>
                <FavoriteButton active={tracked} compact onPress={onToggleTracked ? () => onToggleTracked(item) : undefined} />
              </View>
            </View>
            <View style={styles.listRowCopy}>
              <Text numberOfLines={1} style={styles.listRowTitle}>{item.name}</Text>
              <Text numberOfLines={1} style={styles.listRowMeta}>
                {formatFilterLabel(item.bodyPart)}  •  {formatFilterLabel(item.equipment)}  •  {formatFilterLabel(item.category)}
              </Text>
            </View>
            <AddButton selected={selected} onPress={() => handleAction(item)} />
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: layout.bottomTabBarReserve,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: 0,
    backgroundColor: BACKGROUND,
  },
  headerBlock: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    color: TEXT,
    fontSize: 25,
    lineHeight: 29,
    fontWeight: '900',
  },
  subtitle: {
    color: MUTED,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  iconButtonActive: {
    borderColor: 'rgba(184,255,106,0.46)',
    backgroundColor: 'rgba(184,255,106,0.09)',
  },
  filterBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GREEN,
    paddingHorizontal: 4,
  },
  filterBadgeText: {
    color: '#050505',
    fontSize: 10,
    fontWeight: '900',
  },
  searchShell: {
    minHeight: 40,
    borderRadius: 10,
    backgroundColor: SURFACE,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: BORDER,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: TEXT,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
    paddingVertical: 0,
  },
  categoryRail: {
    gap: 6,
    paddingRight: spacing.sm,
  },
  categoryChip: {
    minHeight: 32,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE_SOFT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
  },
  categoryChipActive: {
    borderColor: GREEN,
    backgroundColor: 'rgba(184,255,106,0.08)',
  },
  categoryChipText: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '900',
  },
  categoryChipTextActive: {
    color: GREEN,
  },
  filtersShell: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE,
    padding: spacing.md,
    gap: spacing.md,
  },
  filtersTitle: {
    color: TEXT,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '900',
  },
  filtersSubtitle: {
    color: MUTED,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  filterSection: {
    gap: spacing.sm,
  },
  filterSectionLabel: {
    color: FAINT,
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  filterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    minHeight: 34,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: BORDER,
  },
  filterChipSelected: {
    backgroundColor: 'rgba(184,255,106,0.12)',
    borderColor: GREEN,
  },
  filterChipText: {
    color: MUTED,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '800',
  },
  filterChipTextSelected: {
    color: GREEN,
  },
  dashboardSection: {
    gap: spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sectionHeaderCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  sectionTitle: {
    color: 'rgba(255,255,255,0.76)',
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  sectionSubtitle: {
    color: MUTED,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
  },
  viewAllText: {
    color: GREEN,
    fontSize: 14,
    lineHeight: 17,
    fontWeight: '900',
  },
  horizontalCards: {
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  miniCard: {
    width: 172,
    minHeight: 70,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    paddingRight: 28,
    position: 'relative',
  },
  miniThumbWrap: {
    position: 'relative',
  },
  miniFavoriteWrap: {
    position: 'absolute',
    top: -7,
    left: -7,
  },
  miniCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  miniTitle: {
    color: TEXT,
    fontSize: 12,
    lineHeight: 13,
    fontWeight: '900',
  },
  miniMeta: {
    color: MUTED,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '700',
  },
  miniAddWrap: {
    position: 'absolute',
    right: 5,
    bottom: 5,
    transform: [{ scale: 0.64 }],
  },
  favoriteButton: {
    width: 30,
    height: 30,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(0,0,0,0.52)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteButtonCompact: {
    width: 22,
    height: 22,
  },
  favoriteButtonActive: {
    borderColor: 'rgba(184,255,106,0.72)',
    backgroundColor: 'rgba(184,255,106,0.16)',
  },
  favoriteButtonText: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 17,
    lineHeight: 18,
    fontWeight: '900',
    marginTop: -1,
  },
  favoriteButtonTextCompact: {
    fontSize: 13,
    lineHeight: 14,
  },
  favoriteButtonTextActive: {
    color: GREEN,
  },
  emptyFavoriteCard: {
    minHeight: 62,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE,
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: spacing.md,
  },
  emptyFavoriteTitle: {
    color: TEXT,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '900',
  },
  emptyFavoriteText: {
    color: MUTED,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingTop: spacing.xs,
  },
  summaryLabel: {
    color: 'rgba(255,255,255,0.76)',
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  summaryCount: {
    color: MUTED,
    fontSize: 14,
    lineHeight: 17,
    fontWeight: '800',
  },
  listRow: {
    minHeight: 58,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderBottomWidth: 0,
  },
  listRowCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  listThumbWrap: {
    position: 'relative',
  },
  listFavoriteWrap: {
    position: 'absolute',
    top: -5,
    left: -5,
  },
  listRowTitle: {
    color: TEXT,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '900',
  },
  listRowMeta: {
    color: MUTED,
    fontSize: 10.5,
    lineHeight: 13,
    fontWeight: '700',
  },
  thumbImage: {
    backgroundColor: '#080808',
  },
  thumbFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  thumbFallbackText: {
    color: TEXT,
    fontSize: 22,
    lineHeight: 24,
    fontWeight: '900',
  },
  addButton: {
    width: 28,
    height: 28,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(184,255,106,0.62)',
    backgroundColor: 'rgba(0,0,0,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonSelected: {
    backgroundColor: GREEN,
    borderColor: GREEN,
  },
  addButtonText: {
    color: GREEN,
    fontSize: 21,
    lineHeight: 22,
    fontWeight: '500',
    marginTop: -2,
  },
  addButtonTextSelected: {
    color: '#06080B',
    fontSize: 15,
    lineHeight: 17,
    fontWeight: '900',
    marginTop: 0,
  },
  cardSelected: {
    borderColor: 'rgba(184,255,106,0.74)',
    backgroundColor: 'rgba(184,255,106,0.08)',
  },
  emptyCard: {
    borderRadius: 16,
    backgroundColor: SURFACE,
    padding: spacing.lg,
    gap: 4,
    borderWidth: 1,
    borderColor: BORDER,
  },
  emptyTitle: {
    color: TEXT,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
  },
  emptyText: {
    color: MUTED,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
  },
});
