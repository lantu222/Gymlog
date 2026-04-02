import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SurfaceAccent, SurfaceCard } from './MainScreenPrimitives';
import { colors, spacing } from '../theme';

interface InlineTipProps {
  title: string;
  body: string;
  accent?: SurfaceAccent;
  onDismiss: () => void;
  compact?: boolean;
}

export function InlineTip({ title, body, accent = 'blue', onDismiss, compact = false }: InlineTipProps) {
  return (
    <SurfaceCard accent={accent} emphasis="flat" style={[styles.card, compact && styles.cardCompact]}>
      {compact ? (
        <View style={styles.compactRow}>
          <View style={styles.compactCopy}>
            <Text style={styles.compactTitle} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.compactBody} numberOfLines={2}>
              {body}
            </Text>
          </View>
          <Pressable onPress={onDismiss} hitSlop={8} style={styles.dismissButtonCompact}>
            <Text style={styles.dismissText}>Hide</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.topRow}>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={onDismiss} hitSlop={8} style={styles.dismissButton}>
              <Text style={styles.dismissText}>Dismiss</Text>
            </Pressable>
          </View>
          <Text style={styles.body}>{body}</Text>
        </>
      )}
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.xs,
  },
  cardCompact: {
    paddingVertical: spacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  dismissButton: {
    minHeight: 28,
    justifyContent: 'center',
  },
  dismissText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  body: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  compactCopy: {
    flex: 1,
    gap: 2,
  },
  compactTitle: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '900',
  },
  compactBody: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  dismissButtonCompact: {
    minHeight: 32,
    minWidth: 46,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
});
