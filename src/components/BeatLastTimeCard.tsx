import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing } from '../theme';

export interface BeatLastTimeCardData {
  eyebrow: string;
  title: string;
  subtitle: string;
  actionLabel: string;
}

interface BeatLastTimeCardProps {
  card: BeatLastTimeCardData;
  onPress: () => void;
}

export function BeatLastTimeCard({ card, onPress }: BeatLastTimeCardProps) {
  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.copy}>
        <Text style={styles.eyebrow}>{card.eyebrow}</Text>
        <Text style={styles.title}>{card.title}</Text>
        <Text style={styles.subtitle}>{card.subtitle}</Text>
      </View>
      <Text style={styles.action}>{card.actionLabel}</Text>
    </Pressable>
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
  },
  copy: {
    gap: 4,
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  action: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '800',
  },
});
