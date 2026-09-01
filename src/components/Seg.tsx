import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { CutSurface } from './CutSurface';
import { Theme, useTheme, useThemedStyles } from '../theming';

/**
 * The one segmented control.
 *
 * It lived inside ProgressScreen and its own comment claimed "every selector
 * in the app goes through this one component" — which was true of three of
 * them. RecordsScreen had a fourth, hand-built, with a different fill and a
 * different inner surface, so the Progress tab shipped two widgets that do the
 * same job and do not look alike. The brief calls that out by name: "Weight /
 * Reps / Volume is the same segmented control as the trend switch, so the tab
 * has one widget instead of three."
 *
 * Moved here rather than imported across screens, so the claim in the comment
 * is something a file can keep.
 */
export function Seg<T extends string>({
  options,
  value,
  onChange,
  grow,
  lockedKeys,
  onLockedPress,
}: {
  options: Array<{ key: T; label: string }>;
  value: T;
  onChange: (next: T) => void;
  grow?: boolean;
  /**
   * Options that exist but are not this reader's to pick.
   *
   * Shown with a lock rather than removed: hiding them would make the free
   * tier look like the whole product, and a reader who never learns the long
   * view exists cannot want it. Pressing one opens the Pro page instead of
   * selecting — it is not a broken control, it is a door.
   */
  lockedKeys?: readonly T[];
  onLockedPress?: () => void;
}) {
  const styles = useThemedStyles(makeSegStyles);
  const theme = useTheme();

  return (
    // A3: the shell and the selected option both take the cut. Every selector
    // on the Progress tab goes through this one component, so the shape lands
    // on the metric switch, the trend range, the measure range and the records
    // kind at once.
    <CutSurface size="sm" fill={theme.surfaceSoft} style={[styles.seg, grow && styles.segGrow]}>
      {options.map((option) => {
        const locked = lockedKeys?.includes(option.key) ?? false;
        const active = !locked && option.key === value;
        const inner = (
          <>
            {locked ? (
              <Svg width={11} height={11} viewBox="0 0 24 24" fill="none">
                <Rect x={5} y={11} width={14} height={9} rx={2.5} stroke={theme.faint} strokeWidth={2.4} />
                <Path
                  d="M8.5 11V8a3.5 3.5 0 017 0v3"
                  stroke={theme.faint}
                  strokeWidth={2.4}
                  strokeLinecap="round"
                />
              </Svg>
            ) : null}
            <Text style={[styles.segText, active && styles.segTextActive, locked && styles.segTextLocked]}>
              {option.label}
            </Text>
          </>
        );

        return (
          <Pressable
            key={option.key}
            accessibilityRole="button"
            accessibilityState={{ selected: active, disabled: false }}
            onPress={() => (locked ? onLockedPress?.() : onChange(option.key))}
            style={grow && styles.segItemGrow}
          >
            {active ? (
              <CutSurface size="chip" fill={theme.surface} style={[styles.segItem, styles.segItemActive]}>
                {inner}
              </CutSurface>
            ) : (
              <View style={styles.segItem}>{inner}</View>
            )}
          </Pressable>
        );
      })}
    </CutSurface>
  );
}

const makeSegStyles = (theme: Theme) => StyleSheet.create({
  seg: {
    flexDirection: 'row',
    padding: 3,
    gap: 2,
  },
  segGrow: {
    alignSelf: 'stretch',
  },
  segItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  segItemGrow: {
    flex: 1,
    alignItems: 'center',
  },
  segItemActive: {
    shadowColor: '#5028A0',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.14,
    shadowRadius: 4,
    elevation: 2,
  },
  segTextLocked: {
    color: theme.faint,
  },
  segText: {
    color: theme.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  segTextActive: {
    color: theme.purpleDark,
  },
});
