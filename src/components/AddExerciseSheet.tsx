import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
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
  autoFocusSearch?: boolean;
  onClose: () => void;
  onSelectItem: (item: ExerciseLibraryItem) => void;
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

function toLabel(value: string) {
  return value
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function buildSearchHaystack(item: ExerciseLibraryItem) {
  return [item.name, item.category, item.bodyPart, item.equipment].join(' ').toLowerCase();
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
              <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>
                {toLabel(option)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

interface ExerciseListSectionProps {
  title: string;
  subtitle?: string;
  items: ExerciseLibraryItem[];
  selectedIds: string[];
  actionLabel: string;
  onSelectItem: (item: ExerciseLibraryItem) => void;
}

function ExerciseListSection({
  title,
  subtitle,
  items,
  selectedIds,
  actionLabel,
  onSelectItem,
}: ExerciseListSectionProps) {
  if (!items.length) {
    return null;
  }

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      </View>
      <View style={styles.list}>
        {items.map((item) => {
          const selected = selectedIds.includes(item.id);

          return (
            <Pressable
              key={item.id}
              onPress={() => !selected && onSelectItem(item)}
              disabled={selected}
              style={[styles.card, selected && styles.cardDisabled]}
            >
              <View style={styles.cardCopy}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.meta}>
                  {toLabel(item.category)} / {toLabel(item.bodyPart)} / {toLabel(item.equipment)}
                </Text>
              </View>
              <View style={[styles.actionButton, selected && styles.actionButtonDisabled]}>
                <Text style={[styles.actionButtonText, selected && styles.actionButtonTextDisabled]}>
                  {selected ? 'Added' : actionLabel}
                </Text>
              </View>
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
  title = 'Add Exercise',
  subtitle,
  actionLabel = 'Add',
  autoFocusSearch = false,
  onClose,
  onSelectItem,
}: AddExerciseSheetProps) {
  const searchRef = useRef<TextInput | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<'all' | ExerciseCategory>('all');
  const [bodyPart, setBodyPart] = useState<'all' | ExerciseBodyPart>('all');
  const [equipment, setEquipment] = useState<'all' | ExerciseEquipment>('all');

  useEffect(() => {
    if (!visible) {
      setSearch('');
      setCategory('all');
      setBodyPart('all');
      setEquipment('all');
      return;
    }

    if (autoFocusSearch) {
      const timeout = setTimeout(() => {
        searchRef.current?.focus();
      }, 40);

      return () => clearTimeout(timeout);
    }

    return undefined;
  }, [autoFocusSearch, visible]);

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

  const hasCustomFilters = category !== 'all' || bodyPart !== 'all' || equipment !== 'all';
  const showSectionedView = search.trim().length === 0 && !hasCustomFilters;

  const sectionedRecentItems = useMemo(
    () => recentItems.filter((item) => !selectedIds.includes(item.id)).slice(0, 8),
    [recentItems, selectedIds],
  );

  const sectionedSuggestedItems = useMemo(
    () =>
      suggestedItems
        .filter((item) => !selectedIds.includes(item.id) && !sectionedRecentItems.some((recent) => recent.id === item.id))
        .slice(0, 6),
    [sectionedRecentItems, selectedIds, suggestedItems],
  );

  const sectionedAllItems = useMemo(
    () =>
      filteredItems.filter(
        (item) =>
          !sectionedRecentItems.some((recent) => recent.id === item.id) &&
          !sectionedSuggestedItems.some((suggested) => suggested.id === item.id),
      ),
    [filteredItems, sectionedRecentItems, sectionedSuggestedItems],
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
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
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

            <FilterPillGroup title="Category" options={categoryOptions} selected={category} onSelect={setCategory} />
            <FilterPillGroup title="Body part" options={bodyPartOptions} selected={bodyPart} onSelect={setBodyPart} />
            <FilterPillGroup title="Equipment" options={equipmentOptions} selected={equipment} onSelect={setEquipment} />

            {showSectionedView ? (
              <>
                <ExerciseListSection
                  title="Recents"
                  subtitle="Last used movements first."
                  items={sectionedRecentItems}
                  selectedIds={selectedIds}
                  actionLabel={actionLabel}
                  onSelectItem={onSelectItem}
                />
                <ExerciseListSection
                  title="Suggested for today"
                  subtitle="Based on what is already in this workout."
                  items={sectionedSuggestedItems}
                  selectedIds={selectedIds}
                  actionLabel={actionLabel}
                  onSelectItem={onSelectItem}
                />
                <ExerciseListSection
                  title="All exercises"
                  subtitle={`${sectionedAllItems.length} available`}
                  items={sectionedAllItems}
                  selectedIds={selectedIds}
                  actionLabel={actionLabel}
                  onSelectItem={onSelectItem}
                />
              </>
            ) : (
              <ExerciseListSection
                title="Results"
                subtitle={`${filteredItems.length} match${filteredItems.length === 1 ? '' : 'es'}`}
                items={filteredItems}
                selectedIds={selectedIds}
                actionLabel={actionLabel}
                onSelectItem={onSelectItem}
              />
            )}

            {!filteredItems.length ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No matches</Text>
                <Text style={styles.emptyText}>Adjust the search or filters to widen the results.</Text>
              </View>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay,
  },
  sheet: {
    maxHeight: '92%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.border,
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
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  headerSubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  closeButton: {
    minHeight: 36,
    justifyContent: 'center',
  },
  closeButtonText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '700',
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  searchCard: {
    gap: spacing.sm,
  },
  searchLabel: {
    color: colors.textSecondary,
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
    minHeight: 54,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  clearButton: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  clearButtonText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  filterGroup: {
    gap: spacing.sm,
  },
  filterTitle: {
    color: colors.textMuted,
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
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterPillActive: {
    backgroundColor: colors.accentSoft,
    borderColor: 'rgba(110, 168, 254, 0.24)',
  },
  filterPillText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  filterPillTextActive: {
    color: colors.accent,
  },
  section: {
    gap: spacing.sm,
  },
  sectionHeader: {
    gap: 2,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  sectionSubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  list: {
    gap: spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  cardDisabled: {
    opacity: 0.72,
  },
  cardCopy: {
    flex: 1,
    gap: 4,
  },
  name: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '800',
  },
  meta: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  actionButton: {
    minHeight: 38,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: 'rgba(110, 168, 254, 0.24)',
  },
  actionButtonDisabled: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  actionButtonText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  actionButtonTextDisabled: {
    color: colors.textMuted,
  },
  emptyCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
});
