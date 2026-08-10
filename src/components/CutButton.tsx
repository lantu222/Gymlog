import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';

import { CutSize, CutSurface } from './CutSurface';
import { Theme, useTheme, useThemedStyles } from '../theming';

/**
 * The A3 button (design: GAINER Nopeus A3 — nappisarja).
 *
 * One gesture across the whole set: the top-left corner is cut away and the
 * cut scales with the button, so a 30px chip reads as the same shape as a 50px
 * CTA. The primary variant carries a diagonal sheen at the same −18° the cut
 * implies, which is what keeps the shape from reading as a rendering error.
 *
 * Press is deliberately small and fast — 1px down, 1.5% in, ~80ms. The design
 * calls this "nopeus": the button should feel like it already moved.
 */

export type CutButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'disabled'
  | 'done'
  | 'warn';

/** Sheen geometry per size: how far in it starts, and how wide it is. */
const SHEEN: Record<CutSize, { left: number; width: number }> = {
  lg: { left: 15, width: 13 },
  md: { left: 12, width: 10 },
  sm: { left: 9, width: 8 },
  chip: { left: 8, width: 7 },
};

const HEIGHT: Record<CutSize, number> = { lg: 50, md: 40, sm: 30, chip: 32 };
const PADDING: Record<CutSize, number> = { lg: 22, md: 16, sm: 12, chip: 13 };
const FONT: Record<CutSize, number> = { lg: 14.5, md: 13, sm: 11.5, chip: 12.5 };

interface CutButtonProps {
  label: string;
  onPress?: () => void;
  variant?: CutButtonVariant;
  size?: CutSize;
  /** Fills the row it sits in, for a CTA pair. */
  stretch?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export function CutButton({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  stretch,
  accessibilityLabel,
  style,
}: CutButtonProps) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);

  const disabled = variant === 'disabled' || !onPress;

  const fill =
    variant === 'primary'
      ? theme.purpleBright
      : variant === 'done'
        ? '#16A34A'
        : variant === 'warn'
          ? '#FDF3E3'
          : variant === 'secondary'
            ? theme.surface
            : variant === 'disabled'
              ? '#E4DEF2'
              : 'transparent';

  const textColor =
    variant === 'primary' || variant === 'done'
      ? '#FFFFFF'
      : variant === 'warn'
        ? '#7A5B32'
        : variant === 'secondary'
          ? theme.ink
          : variant === 'disabled'
            ? '#A79FBC'
            : theme.purple;

  const stroke =
    variant === 'outline'
      ? theme.purpleBright
      : variant === 'warn'
        ? '#F0D3A2'
        : undefined;

  const sheen = SHEEN[size];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        stretch && styles.stretch,
        // 1px down and a hair in. Anything larger reads as a bounce, which is
        // the opposite of what this shape is for.
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      <CutSurface
        size={size}
        fill={fill}
        stroke={stroke}
        sheen={variant === 'primary' || variant === 'done' ? sheen : undefined}
        style={[
          styles.surface,
          {
            height: HEIGHT[size],
            paddingHorizontal: PADDING[size],
          },
          variant === 'primary' && styles.primaryShadow,
          variant === 'done' && styles.doneShadow,
          variant === 'secondary' && styles.secondaryShadow,
        ]}
      >
        <Text style={[styles.label, { fontSize: FONT[size], color: textColor }]} numberOfLines={1}>
          {label}
        </Text>
      </CutSurface>
    </Pressable>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  stretch: {
    flex: 1,
  },
  pressed: {
    transform: [{ translateY: 1 }, { scale: 0.985 }],
  },
  surface: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  label: {
    fontWeight: '800',
    letterSpacing: -0.15,
  },
  primaryShadow: {
    shadowColor: theme.purple,
    shadowOpacity: 0.32,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  doneShadow: {
    shadowColor: '#16A34A',
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  secondaryShadow: {
    shadowColor: '#D8C7FF',
    shadowOpacity: 0.5,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
});
