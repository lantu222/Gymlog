import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../theme';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightActionLabel?: string;
  onRightActionPress?: () => void;
}

export function ScreenHeader({
  title,
  subtitle,
  onBack,
  rightActionLabel,
  onRightActionPress,
}: ScreenHeaderProps) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.topRow}>
        <View style={styles.titleRow}>
          {onBack ? (
            <Pressable hitSlop={10} onPress={onBack} style={styles.backButton}>
              <Text style={styles.backText}>{'< Back'}</Text>
            </Pressable>
          ) : null}
          <Text style={styles.title}>{title}</Text>
        </View>
        {rightActionLabel && onRightActionPress ? (
          <Pressable hitSlop={10} onPress={onRightActionPress} style={styles.action}>
            <Text style={styles.actionText}>{rightActionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.xs,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  titleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  backButton: {
    minWidth: 70,
    minHeight: 40,
    paddingHorizontal: spacing.sm,
    marginLeft: -spacing.sm,
    borderRadius: 999,
    justifyContent: 'center',
  },
  backText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '700',
  },
  title: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  action: {
    minHeight: 40,
    paddingHorizontal: spacing.xs,
    justifyContent: 'center',
  },
  actionText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '700',
  },
});
