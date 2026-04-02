import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing } from '../theme';

interface EmptyStateProps {
  title: string;
  description: string;
  children?: React.ReactNode;
}

export function EmptyState({ title, description, children }: EmptyStateProps) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {children ? <View style={styles.content}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  description: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  content: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
});
