import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing } from '../theme';

interface StatChipProps {
  label: string;
  value: string;
  tone?: 'default' | 'accent' | 'success';
}

export function StatChip({ label, value, tone = 'default' }: StatChipProps) {
  return (
    <View
      style={[
        styles.wrapper,
        tone === 'accent' && styles.wrapperAccent,
        tone === 'success' && styles.wrapperSuccess,
      ]}
    >
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    minWidth: 96,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: 3,
  },
  wrapperAccent: {
    backgroundColor: colors.accentSoft,
    borderColor: 'rgba(110, 168, 254, 0.24)',
  },
  wrapperSuccess: {
    backgroundColor: colors.accentAltSoft,
    borderColor: 'rgba(85, 138, 189, 0.24)',
  },
  label: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  value: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
