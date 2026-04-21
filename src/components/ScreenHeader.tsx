import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../theme';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  backLabel?: string;
  rightActionLabel?: string;
  onRightActionPress?: () => void;
  tone?: 'light' | 'dark';
}

export function ScreenHeader({
  title,
  subtitle,
  onBack,
  backLabel = 'Back',
  rightActionLabel,
  onRightActionPress,
  tone = 'light',
}: ScreenHeaderProps) {
  const darkTone = tone === 'dark';

  return (
    <View style={styles.wrapper}>
      <View style={styles.topRow}>
        <View style={styles.titleRow}>
          {onBack ? (
            <Pressable hitSlop={10} onPress={onBack} style={styles.backButton}>
              <Text style={[styles.backText, darkTone && styles.backTextDark]}>{backLabel}</Text>
            </Pressable>
          ) : null}
          <Text style={[styles.title, darkTone && styles.titleDark]}>{title}</Text>
        </View>
        {rightActionLabel && onRightActionPress ? (
          <Pressable hitSlop={10} onPress={onRightActionPress} style={styles.action}>
            <Text style={[styles.actionText, darkTone && styles.actionTextDark]}>{rightActionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
      {subtitle ? <Text style={[styles.subtitle, darkTone && styles.subtitleDark]}>{subtitle}</Text> : null}
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
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  backTextDark: {
    color: '#111111',
  },
  title: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  titleDark: {
    color: '#111111',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  subtitleDark: {
    color: '#6B7280',
  },
  action: {
    minHeight: 40,
    paddingHorizontal: spacing.xs,
    justifyContent: 'center',
  },
  actionText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  actionTextDark: {
    color: '#111111',
  },
});
