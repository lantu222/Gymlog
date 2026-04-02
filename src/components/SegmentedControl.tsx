import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing } from '../theme';

interface Option {
  key: string;
  label: string;
}

interface SegmentedControlProps {
  options: Option[];
  selectedKey: string;
  onSelect: (key: string) => void;
}

export function SegmentedControl({
  options,
  selectedKey,
  onSelect,
}: SegmentedControlProps) {
  return (
    <View style={styles.wrapper}>
      {options.map((option) => {
        const active = option.key === selectedKey;
        return (
          <Pressable
            key={option.key}
            onPress={() => onSelect(option.key)}
            style={[styles.option, active && styles.optionActive]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    padding: 4,
    gap: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  option: {
    flex: 1,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
  },
  optionActive: {
    backgroundColor: colors.accent,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  labelActive: {
    color: colors.background,
  },
});
