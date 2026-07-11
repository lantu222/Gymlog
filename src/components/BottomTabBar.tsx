import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { RootTabKey } from '../navigation/routes';
import { HG3 } from '../lightTheme';
import { spacing } from '../theme';

interface BottomTabBarProps {
  activeTab: RootTabKey | null;
  aiActive?: boolean;
  onTabPress: (tab: RootTabKey) => void;
  onAiPress: () => void;
}

const sideTabs: { key: RootTabKey; label: string }[] = [
  { key: 'home', label: 'Home' },
  // Internal key stays 'workout' (routes/analytics unchanged); only the
  // user-facing label and icon move to Programs.
  { key: 'workout', label: 'Programs' },
  { key: 'progress', label: 'Progress' },
  { key: 'profile', label: 'Profile' },
];

function TabIcon({ tab, active }: { tab: RootTabKey; active: boolean }) {
  const stroke = active ? HG3.purple : HG3.muted;
  const fill = active ? HG3.purple : 'none';
  const size = 22;

  if (tab === 'home') {
    return (
      <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
        <Path
          d="M3.5 8.2L10 3.5L16.5 8.2V15.6C16.5 16.1 16.1 16.5 15.6 16.5H11.9V12.4H8.1V16.5H4.4C3.9 16.5 3.5 16.1 3.5 15.6V8.2Z"
          stroke={stroke}
          strokeWidth={1.8}
          strokeLinejoin="round"
          fill={fill}
        />
      </Svg>
    );
  }

  if (tab === 'workout') {
    // Programs = a stacked-layers glyph (matches the active-program card icon).
    return (
      <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
        <Path
          d="M10 2.6L17.5 6.4L10 10.2L2.5 6.4Z"
          stroke={stroke}
          strokeWidth={1.7}
          strokeLinejoin="round"
          fill={fill}
        />
        <Path d="M2.9 10L10 13.6L17.1 10" stroke={stroke} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M2.9 13.4L10 17L17.1 13.4" stroke={stroke} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    );
  }

  if (tab === 'progress') {
    return (
      <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
        <Path
          d="M3 13.8L7.1 9.7L10 12.1L15.8 6.3"
          stroke={stroke}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Circle cx="15.8" cy="6.3" r="1.1" fill={stroke} />
      </Svg>
    );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Circle cx="10" cy="6.8" r="2.9" stroke={stroke} strokeWidth={1.8} />
      <Path
        d="M4.5 16.2C4.9 13.4 7 11.9 10 11.9C13 11.9 15.1 13.4 15.5 16.2"
        stroke={stroke}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function SideTab({
  tab,
  active,
  onPress,
}: {
  tab: { key: RootTabKey; label: string };
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.sideTab, pressed && styles.pressed]}>
      <TabIcon tab={tab.key} active={active} />
      <Text style={[styles.sideLabel, active && styles.sideLabelActive]}>{tab.label}</Text>
    </Pressable>
  );
}

export function BottomTabBar({ activeTab, aiActive = false, onTabPress, onAiPress }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const leftTabs = sideTabs.slice(0, 2);
  const rightTabs = sideTabs.slice(2);

  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  // Home v3 entrance: the bar rises in at .24s and the FAB pops (scale .3 -> 1
  // with overshoot) at .5s. Reduced motion skips straight to the final state.
  const barRise = useRef(new Animated.Value(0)).current;
  const fabPop = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) {
          setReduceMotion(Boolean(enabled));
        }
      })
      .catch(() => {
        if (mounted) {
          setReduceMotion(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (reduceMotion === null) {
      return;
    }
    if (reduceMotion) {
      barRise.setValue(1);
      fabPop.setValue(1);
      return;
    }
    Animated.timing(barRise, {
      toValue: 1,
      duration: 500,
      delay: 240,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: true,
    }).start();
    Animated.timing(fabPop, {
      toValue: 1,
      duration: 420,
      delay: 500,
      easing: Easing.bezier(0.3, 1.3, 0.5, 1),
      useNativeDriver: true,
    }).start();
  }, [barRise, fabPop, reduceMotion]);

  return (
    <Animated.View
      style={[
        styles.shell,
        { paddingBottom: Math.max(insets.bottom, 8) },
        {
          opacity: barRise,
          transform: [{ translateY: barRise.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
        },
      ]}
    >
      <View style={styles.row}>
        <View style={styles.sideGroup}>
          {leftTabs.map((tab) => (
            <SideTab
              key={tab.key}
              tab={tab}
              active={!aiActive && activeTab !== null && activeTab === tab.key}
              onPress={() => onTabPress(tab.key)}
            />
          ))}
        </View>

        <Pressable
          onPress={onAiPress}
          accessibilityRole="button"
          accessibilityLabel="Start"
          style={({ pressed }) => [styles.centerTab, pressed && styles.pressed]}
        >
          <Animated.View style={[styles.centerButton, aiActive && styles.centerButtonActive, { transform: [{ scale: fabPop }] }]}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Path
                d="M12 5v14M5 12h14"
                stroke={aiActive ? HG3.surface : HG3.purple}
                strokeWidth={2.4}
                strokeLinecap="round"
              />
            </Svg>
          </Animated.View>
        </Pressable>

        <View style={styles.sideGroup}>
          {rightTabs.map((tab) => (
            <SideTab
              key={tab.key}
              tab={tab}
              active={!aiActive && activeTab !== null && activeTab === tab.key}
              onPress={() => onTabPress(tab.key)}
            />
          ))}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: HG3.surface,
    borderTopWidth: 1,
    borderColor: HG3.border,
    paddingTop: 10,
    paddingHorizontal: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  sideGroup: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
  },
  pressed: {
    transform: [{ scale: 0.95 }],
  },
  sideTab: {
    minWidth: 62,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 5,
    paddingBottom: 2,
  },
  sideLabel: {
    color: HG3.muted,
    fontSize: 11,
    fontWeight: '600',
  },
  sideLabelActive: {
    color: HG3.purple,
    fontWeight: '800',
  },
  centerTab: {
    alignItems: 'center',
    justifyContent: 'center',
    // Floats above the bar. marginBottom keeps the button at the same height it
    // sat at when a "Start" label still occupied the row below it.
    marginTop: -26,
    marginBottom: 19,
  },
  centerButton: {
    width: 54,
    height: 54,
    borderRadius: 999,
    backgroundColor: HG3.surface,
    borderWidth: 1.5,
    borderColor: HG3.purple,
    alignItems: 'center',
    justifyContent: 'center',
    // Glowy purple halo around the floating Start button (Home v3).
    shadowColor: HG3.purpleBright,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 12,
  },
  centerButtonActive: {
    backgroundColor: HG3.purple,
    borderColor: HG3.purple,
  },
});
