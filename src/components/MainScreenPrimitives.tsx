import React from 'react';
import { Pressable, PressableProps, StyleProp, StyleSheet, Text, TextStyle, View, ViewProps, ViewStyle } from 'react-native';

import { colors, radii, spacing } from '../theme';

export type SurfaceAccent = 'blue' | 'rose' | 'orange' | 'neutral';
export type SurfaceEmphasis = 'hero' | 'standard' | 'utility' | 'flat';

const accentTokens: Record<SurfaceAccent, { border: string; accent: string; wash: string; kicker: string }> = {
  blue: {
    border: 'rgba(85, 138, 189, 0.30)',
    accent: colors.accentAlt,
    wash: 'rgba(85, 138, 189, 0.08)',
    kicker: '#9ACCFF',
  },
  rose: {
    border: 'rgba(191, 74, 105, 0.30)',
    accent: colors.feature,
    wash: 'rgba(191, 74, 105, 0.08)',
    kicker: '#F39AB2',
  },
  orange: {
    border: 'rgba(240, 106, 57, 0.30)',
    accent: '#F06A39',
    wash: 'rgba(240, 106, 57, 0.08)',
    kicker: '#FFB389',
  },
  neutral: {
    border: 'rgba(255,255,255,0.10)',
    accent: 'rgba(255,255,255,0.20)',
    wash: 'rgba(255,255,255,0.02)',
    kicker: colors.textMuted,
  },
};

const emphasisTokens: Record<SurfaceEmphasis, { background: string; padding: number; shadowOpacity: number; elevation: number }> = {
  hero: {
    background: 'rgba(22, 31, 41, 0.88)',
    padding: spacing.lg,
    shadowOpacity: 0.28,
    elevation: 12,
  },
  standard: {
    background: 'rgba(20, 29, 39, 0.84)',
    padding: spacing.lg,
    shadowOpacity: 0.22,
    elevation: 9,
  },
  utility: {
    background: 'rgba(18, 26, 35, 0.82)',
    padding: spacing.lg,
    shadowOpacity: 0.18,
    elevation: 7,
  },
  flat: {
    background: 'rgba(18, 26, 35, 0.76)',
    padding: spacing.md,
    shadowOpacity: 0.10,
    elevation: 4,
  },
};

type SharedProps = {
  accent?: SurfaceAccent;
  emphasis?: SurfaceEmphasis;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  children: React.ReactNode;
};

type SurfaceCardProps = SharedProps & {
  onPress?: PressableProps['onPress'];
};

export function SurfaceCard({
  accent = 'neutral',
  emphasis = 'standard',
  style,
  contentStyle,
  children,
  onPress,
}: SurfaceCardProps) {
  const accentToken = accentTokens[accent];
  const emphasisToken = emphasisTokens[emphasis];
  const Container = onPress ? Pressable : View;
  const containerProps: ViewProps | PressableProps = onPress ? { onPress } : {};

  return (
    <Container
      {...containerProps}
      style={[
        styles.card,
        {
          borderColor: accentToken.border,
          backgroundColor: emphasisToken.background,
          padding: emphasisToken.padding,
          shadowOpacity: emphasisToken.shadowOpacity,
          elevation: emphasisToken.elevation,
        },
        style,
      ]}
    >
      {accent !== 'neutral' ? <View pointerEvents="none" style={[styles.topAccent, { backgroundColor: accentToken.accent }]} /> : null}
      <View pointerEvents="none" style={styles.sheen} />
      <View pointerEvents="none" style={[styles.innerWash, { backgroundColor: accentToken.wash }]} />
      <View style={contentStyle}>{children}</View>
    </Container>
  );
}

export function SectionHeaderBlock({
  title,
  subtitle,
  kicker,
  accent = 'blue',
  style,
}: {
  title: string;
  subtitle?: string;
  kicker?: string;
  accent?: SurfaceAccent;
  style?: StyleProp<ViewStyle>;
}) {
  const accentToken = accentTokens[accent];

  return (
    <View style={[styles.sectionHeader, style]}>
      {kicker ? <Text style={[styles.sectionKicker, { color: accentToken.kicker }]}>{kicker}</Text> : null}
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function BadgePill({
  label,
  accent = 'neutral',
  style,
  textStyle,
}: {
  label: string;
  accent?: SurfaceAccent;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}) {
  const accentToken = accentTokens[accent];
  return (
    <View style={[styles.badge, { borderColor: accentToken.border, backgroundColor: accentToken.wash }, style]}>
      <Text style={[styles.badgeText, { color: accentToken.kicker }, textStyle]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    borderRadius: radii.lg,
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 28,
  },
  topAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  sheen: {
    position: 'absolute',
    top: 1,
    left: 16,
    right: 16,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  innerWash: {
    position: 'absolute',
    inset: 0,
  },
  sectionHeader: {
    gap: 2,
  },
  sectionKicker: {
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  sectionSubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  badge: {
    minHeight: 28,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    justifyContent: 'center',
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});
