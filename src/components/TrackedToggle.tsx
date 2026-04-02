import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing } from '../theme';

interface TrackedToggleProps {
  checked: boolean;
  onPress: () => void;
  label?: string;
}

export function TrackedToggle({ checked, onPress, label = 'Tracked' }: TrackedToggleProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.wrapper, checked ? styles.wrapperChecked : styles.wrapperUnchecked]}
    >
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked ? <Text style={styles.checkmark}>x</Text> : null}
      </View>
      <Text style={[styles.label, checked && styles.labelChecked]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  wrapperChecked: {
    backgroundColor: colors.accentSoft,
    borderColor: 'rgba(110, 168, 254, 0.24)',
  },
  wrapperUnchecked: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  checkbox: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.input,
  },
  checkboxChecked: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  checkmark: {
    color: colors.background,
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 14,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  labelChecked: {
    color: colors.textPrimary,
  },
});
