import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatShortDate, pluralize } from '../lib/format';
import { colors, radii, spacing } from '../theme';

interface SessionListItemProps {
  workoutName: string;
  performedAt: string;
  exerciseCount: number;
  summaryText?: string;
  highlightText?: string;
  badgeText?: string;
  onPress: () => void;
}

export function SessionListItem({
  workoutName,
  performedAt,
  exerciseCount,
  summaryText,
  highlightText,
  badgeText,
  onPress,
}: SessionListItemProps) {
  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.left}>
        <Text style={styles.kicker}>Saved session</Text>
        <Text style={styles.name}>{workoutName}</Text>
        <Text style={styles.meta}>
          {formatShortDate(performedAt)} {'\u00b7'} {pluralize(exerciseCount, 'exercise')}
        </Text>
        {summaryText ? <Text style={styles.summary}>{summaryText}</Text> : null}
      </View>
      <View style={styles.right}>
        {badgeText ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badgeText}</Text>
          </View>
        ) : null}
        {highlightText ? (
          <Text style={styles.highlight} numberOfLines={2}>
            {highlightText}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(18, 26, 35, 0.82)',
    padding: spacing.lg,
  },
  left: {
    gap: spacing.xs,
    flex: 1,
  },
  kicker: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  right: {
    maxWidth: 150,
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  name: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  meta: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  summary: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  badge: {
    minHeight: 28,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  badgeText: {
    color: colors.textPrimary,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  highlight: {
    color: colors.textPrimary,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
    textAlign: 'right',
  },
});
