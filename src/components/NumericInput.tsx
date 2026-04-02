import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, radii, spacing } from '../theme';

interface NumericInputProps {
  label?: string;
  value: string;
  placeholder?: string;
  suffix?: string;
  dense?: boolean;
  onChangeText: (value: string) => void;
}

export function NumericInput({
  label,
  value,
  placeholder,
  suffix,
  dense,
  onChangeText,
}: NumericInputProps) {
  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.inputWrap, dense && styles.inputWrapDense]}>
        <TextInput
          keyboardType="decimal-pad"
          value={value}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          onChangeText={onChangeText}
          style={[styles.input, dense && styles.inputDense]}
          selectionColor={colors.accent}
          selectTextOnFocus
        />
        {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.xs,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 60,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.input,
  },
  inputWrapDense: {
    minHeight: 52,
  },
  input: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  inputDense: {
    fontSize: 16,
  },
  suffix: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
});
