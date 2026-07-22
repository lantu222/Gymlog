import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { HG } from '../lightTheme';

/**
 * Shared list primitives for the Profile / Settings suite. Extracted from
 * ProfileScreen so the pushed Settings screen renders identical rows instead of
 * a second, drifting copy.
 */

export function SectionLabel({
  label,
  actionLabel,
  onAction,
}: {
  label: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {actionLabel ? (
        <Text onPress={onAction} style={styles.sectionAction}>
          {actionLabel}
        </Text>
      ) : null}
    </View>
  );
}

export function ToggleSwitch({
  value,
  onChange,
  label,
}: {
  value: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      onPress={() => onChange(!value)}
      style={[styles.toggleTrack, value && styles.toggleTrackOn]}
      hitSlop={8}
    >
      <View style={[styles.toggleKnob, value && styles.toggleKnobOn]} />
    </Pressable>
  );
}

export function ChevronIcon({ color = HG.faint }: { color?: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M9 6l6 6-6 6" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function SettingsRow({
  title,
  subtitle,
  right,
  destructive = false,
  isLast = false,
  onPress,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  destructive?: boolean;
  isLast?: boolean;
  onPress?: () => void;
}) {
  const inner = (
    <View style={[styles.setRow, isLast && styles.setRowLast]}>
      <View style={styles.setCopy}>
        <Text style={[styles.setTitle, destructive && styles.setTitleDanger]}>{title}</Text>
        {subtitle ? <Text style={styles.setSub}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );

  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => pressed && styles.rowPressed}>
      {inner}
    </Pressable>
  ) : (
    inner
  );
}

/** The suite's card shadow (mock: 0 6px 18px rgba(120,80,200,.06)). */
export const CARD_SHADOW = {
  boxShadow: '0 6px 18px rgba(120, 80, 200, 0.06)',
} as const;

export const settingsStyles = StyleSheet.create({
  section: {
    marginTop: 22,
  },
  card: {
    backgroundColor: HG.surface,
    borderWidth: 1,
    borderColor: HG.border,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 4,
    ...CARD_SHADOW,
  },
  value: {
    color: HG.ink,
    fontSize: 14,
    fontWeight: '800',
  },
});

const styles = StyleSheet.create({
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    paddingBottom: 11,
  },
  sectionLabel: {
    color: HG.faint,
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 1.15,
  },
  sectionAction: {
    color: HG.purple,
    fontSize: 12.5,
    fontWeight: '800',
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: HG.border,
  },
  setRowLast: {
    borderBottomWidth: 0,
  },
  rowPressed: {
    opacity: 0.65,
  },
  setCopy: {
    flex: 1,
    minWidth: 0,
  },
  setTitle: {
    color: HG.ink,
    fontSize: 14.5,
    fontWeight: '800',
  },
  setTitleDanger: {
    color: '#C0392B',
  },
  setSub: {
    color: HG.muted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  toggleTrack: {
    width: 48,
    height: 28,
    borderRadius: 999,
    backgroundColor: '#E4DBF5',
    padding: 3,
    justifyContent: 'center',
  },
  toggleTrackOn: {
    backgroundColor: HG.purple,
  },
  toggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },
  toggleKnobOn: {
    alignSelf: 'flex-end',
  },
});
