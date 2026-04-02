import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  ExerciseBodyPart,
  ExerciseCategory,
  ExerciseEquipment,
  ExerciseLibraryItem,
} from '../types/models';
import { colors, radii, spacing } from '../theme';

interface ExerciseLibraryBrowserProps {
  items: ExerciseLibraryItem[];
  selectedIds?: string[];
  onSelectItem?: (item: ExerciseLibraryItem) => void;
  actionLabel?: string;
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

export function ExerciseLibraryBrowser({
  items,
  selectedIds = [],
  onSelectItem,
  actionLabel = 'Add',
}: ExerciseLibraryBrowserProps) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<'all' | ExerciseCategory>('all');
  const [bodyPart, setBodyPart] = useState<'all' | ExerciseBodyPart>('all');
  const [equipment, setEquipment] = useState<'all' | ExerciseEquipment>('all');

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();

    return items.filter((item) => {
      if (query && !item.name.toLowerCase().includes(query)) {
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

  return (
    <View style={styles.wrapper}>
      <View style={styles.searchCard}>
        <Text style={styles.sectionLabel}>Search</Text>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search exercises"
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
          selectionColor={colors.accent}
        />
      </View>

      <FilterPillGroup title="Category" options={categoryOptions} selected={category} onSelect={setCategory} />
      <FilterPillGroup title="Body part" options={bodyPartOptions} selected={bodyPart} onSelect={setBodyPart} />
      <FilterPillGroup title="Equipment" options={equipmentOptions} selected={equipment} onSelect={setEquipment} />

      <View style={styles.resultsHeader}>
        <Text style={styles.resultsTitle}>Exercise library</Text>
        <Text style={styles.resultsCount}>{filteredItems.length} results</Text>
      </View>

      <View style={styles.list}>
        {filteredItems.map((item) => {
          const selected = selectedIds.includes(item.id);

          return (
            <View key={item.id} style={styles.card}>
              <View style={styles.cardCopy}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.meta}>
                  {toLabel(item.category)} / {toLabel(item.bodyPart)} / {toLabel(item.equipment)}
                </Text>
              </View>
              {onSelectItem ? (
                <Pressable
                  onPress={() => onSelectItem(item)}
                  disabled={selected}
                  style={[styles.actionButton, selected && styles.actionButtonDisabled]}
                >
                  <Text style={[styles.actionButtonText, selected && styles.actionButtonTextDisabled]}>
                    {selected ? 'Added' : actionLabel}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}

        {filteredItems.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No matches</Text>
            <Text style={styles.emptyText}>Adjust the search or filters to widen the library results.</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.md,
  },
  searchCard: {
    gap: spacing.xs,
  },
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  searchInput: {
    minHeight: 54,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  filterGroup: {
    gap: spacing.xs,
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
    gap: spacing.xs,
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
    color: colors.textPrimary,
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  resultsTitle: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  resultsCount: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  list: {
    gap: spacing.sm,
  },
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardCopy: {
    gap: 4,
  },
  name: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  meta: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  actionButton: {
    alignSelf: 'flex-start',
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionButtonDisabled: {
    backgroundColor: colors.accentSoft,
  },
  actionButtonText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  actionButtonTextDisabled: {
    color: colors.accent,
  },
  emptyCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
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
    fontSize: 14,
    lineHeight: 20,
  },
});
