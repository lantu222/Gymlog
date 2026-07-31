import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { HG } from '../lightTheme';
import { spacing } from '../theme';

/**
 * The older screen header, still used by twelve screens.
 *
 * It used to take a `tone` prop defaulting to 'light', where "light" meant the
 * near-white text of the legacy dark theme. Every single caller passed
 * `tone="dark"` to get readable text, so the default branch never rendered —
 * it was a trap waiting for the thirteenth caller to fall into. The prop and
 * the unreachable branch are gone; the colours come from the shared palette
 * like everything else.
 */
interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  backLabel?: string;
  rightActionLabel?: string;
  onRightActionPress?: () => void;
}

export function ScreenHeader({
  title,
  subtitle,
  onBack,
  backLabel = 'Back',
  rightActionLabel,
  onRightActionPress,
}: ScreenHeaderProps) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.topRow}>
        <View style={styles.titleRow}>
          {onBack ? (
            <Pressable hitSlop={10} onPress={onBack} style={styles.backButton}>
              <Text style={styles.backText}>{backLabel}</Text>
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
    color: HG.ink,
    fontSize: 14,
    fontWeight: '800',
  },
  title: {
    flex: 1,
    color: HG.ink,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  subtitle: {
    color: HG.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  action: {
    minHeight: 40,
    paddingHorizontal: spacing.xs,
    justifyContent: 'center',
  },
  actionText: {
    color: HG.ink,
    fontSize: 14,
    fontWeight: '800',
  },
});
