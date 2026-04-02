import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { formatShortDate, pluralize } from '../lib/format';
import { colors, radii, shadows, spacing } from '../theme';

interface WorkoutCardProps {
  name: string;
  exerciseCount: number;
  lastCompletedAt?: string;
  onOpen: () => void;
  onEdit: () => void;
  onRename: (nextName: string) => void;
  onDelete: () => void;
}

export function WorkoutCard({
  name,
  exerciseCount,
  lastCompletedAt,
  onOpen,
  onEdit,
  onRename,
  onDelete,
}: WorkoutCardProps) {
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(name);

  useEffect(() => {
    setDraftName(name);
  }, [name]);

  return (
    <View style={styles.card}>
      <Pressable onPress={onOpen} style={styles.launchArea}>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.meta}>{pluralize(exerciseCount, 'exercise')}</Text>
        <Text style={styles.lastCompleted}>
          {lastCompletedAt ? `Last completed ${formatShortDate(lastCompletedAt)}` : 'No sessions yet'}
        </Text>
        <Text style={styles.hint}>Tap to open and log</Text>
      </Pressable>

      {renaming ? (
        <View style={styles.renameBox}>
          <TextInput
            value={draftName}
            onChangeText={setDraftName}
            placeholder="Workout name"
            placeholderTextColor={colors.textMuted}
            style={styles.renameInput}
            selectionColor={colors.accent}
          />
          <View style={styles.actionsRow}>
            <Pressable onPress={() => setRenaming(false)} style={styles.secondaryButton}>
              <Text style={styles.secondaryText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                onRename(draftName);
                setRenaming(false);
              }}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryText}>Save</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.actionsRow}>
          <Pressable onPress={onEdit} style={styles.secondaryButton}>
            <Text style={styles.secondaryText}>Edit</Text>
          </Pressable>
          <Pressable onPress={() => setRenaming(true)} style={styles.secondaryButton}>
            <Text style={styles.secondaryText}>Rename</Text>
          </Pressable>
          <Pressable onPress={onDelete} style={styles.deleteButton}>
            <Text style={styles.deleteText}>Delete</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card,
  },
  launchArea: {
    gap: spacing.xs,
  },
  name: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  meta: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  lastCompleted: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  hint: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  renameBox: {
    gap: spacing.sm,
  },
  renameInput: {
    minHeight: 52,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.input,
    paddingHorizontal: spacing.md,
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  secondaryButton: {
    minHeight: 42,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  primaryButton: {
    minHeight: 42,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  primaryText: {
    color: colors.background,
    fontSize: 13,
    fontWeight: '800',
  },
  deleteButton: {
    minHeight: 42,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.18)',
  },
  deleteText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '700',
  },
});
