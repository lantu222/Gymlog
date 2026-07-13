import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { RootTabKey } from '../navigation/routes';
import { HG3 } from '../lightTheme';

// EXPERIMENT (2026-07-13): dark, detached "floating pill" tab bar. Absolutely
// positioned so it floats low over the (light) app content — no light backdrop
// strip. The active tab gets a circular purple highlight that slides between
// tabs. Kept isolated in this file + its own commit so it reverts cleanly.
const BAR = {
  pill: '#1E1B2C',
  pillBorder: 'rgba(255,255,255,0.09)',
  active: '#A78BFA',
  inactive: '#8B84A6',
  highlight: 'rgba(167, 139, 250, 0.22)',
};

// Diameter of the sliding circular highlight behind the active tab's icon.
const HIGHLIGHT = 44;
// Center "AI" button (design_handoff_ai_button): spec is 48px; sized down a touch.
const AI_SIZE = 46;
const AI_HALO = 58;

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
  const stroke = active ? BAR.active : BAR.inactive;
  const fill = active ? BAR.active : 'none';
  const size = 26;

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
  onMeasure,
}: {
  tab: { key: RootTabKey; label: string };
  active: boolean;
  onPress: () => void;
  onMeasure: (key: RootTabKey, event: LayoutChangeEvent) => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      onLayout={(event) => onMeasure(tab.key, event)}
      accessibilityRole="button"
      accessibilityLabel={tab.label}
      accessibilityState={{ selected: active }}
      style={styles.sideTab}
    >
      <TabIcon tab={tab.key} active={active} />
    </Pressable>
  );
}

export function BottomTabBar({ activeTab, aiActive = false, onTabPress, onAiPress }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  // Entrance: the bar rises in at .24s and the FAB pops (scale .3 -> 1 with
  // overshoot) at .5s. Reduced motion skips straight to the final state.
  const barRise = useRef(new Animated.Value(0)).current;
  const fabPop = useRef(new Animated.Value(0.3)).current;

  // Sliding circular highlight: we measure each side tab's centre and animate a
  // single circle's translateX to the active tab (spring => it "slides" in).
  const activeKey = !aiActive && activeTab !== null && sideTabs.some((tab) => tab.key === activeTab) ? activeTab : null;
  const indicatorX = useRef(new Animated.Value(0)).current;
  const indicatorOpacity = useRef(new Animated.Value(0)).current;
  const centers = useRef<Partial<Record<RootTabKey, number>>>({});
  const positioned = useRef(false);

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

  function positionIndicator(animate: boolean) {
    if (activeKey === null) {
      Animated.timing(indicatorOpacity, { toValue: 0, duration: 140, useNativeDriver: true }).start();
      return;
    }
    const center = centers.current[activeKey];
    if (center === undefined) {
      return;
    }
    const target = center - HIGHLIGHT / 2;
    if (animate && positioned.current && reduceMotion !== true) {
      Animated.parallel([
        Animated.spring(indicatorX, { toValue: target, useNativeDriver: true, speed: 13, bounciness: 7 }),
        Animated.timing(indicatorOpacity, { toValue: 1, duration: 140, useNativeDriver: true }),
      ]).start();
    } else {
      indicatorX.setValue(target);
      indicatorOpacity.setValue(1);
      positioned.current = true;
    }
  }

  useEffect(() => {
    positionIndicator(true);
    // positionIndicator reads the latest refs/props on each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey, reduceMotion]);

  function handleMeasure(key: RootTabKey, event: LayoutChangeEvent) {
    const { x, width } = event.nativeEvent.layout;
    centers.current[key] = x + width / 2;
    if (key === activeKey && !positioned.current) {
      positionIndicator(false);
    }
  }

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.shell,
        { paddingBottom: 4 + Math.min(insets.bottom, 4) },
        {
          opacity: barRise,
          transform: [{ translateY: barRise.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
        },
      ]}
    >
      <View style={styles.pill}>
        <View style={styles.row}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.indicator,
              { opacity: indicatorOpacity, transform: [{ translateX: indicatorX }] },
            ]}
          />

          {sideTabs.slice(0, 2).map((tab) => (
            <SideTab
              key={tab.key}
              tab={tab}
              active={activeKey === tab.key}
              onPress={() => onTabPress(tab.key)}
              onMeasure={handleMeasure}
            />
          ))}

          <Pressable
            onPress={onAiPress}
            accessibilityRole="button"
            accessibilityLabel="AI session"
            style={({ pressed }) => [styles.centerTab, pressed && styles.pressed]}
          >
            <Animated.View style={[styles.centerGlow, aiActive && styles.centerGlowActive, { transform: [{ scale: fabPop }] }]}>
              <View style={styles.aiCircle}>
                <Svg style={StyleSheet.absoluteFill} width={AI_SIZE} height={AI_SIZE}>
                  <Defs>
                    <RadialGradient id="aiFill" cx="50%" cy="38%" r="65%">
                      <Stop offset="0" stopColor="#FFFFFF" />
                      <Stop offset="0.62" stopColor="#F2ECFF" />
                      <Stop offset="1" stopColor="#E3D4FF" />
                    </RadialGradient>
                  </Defs>
                  <Rect width={AI_SIZE} height={AI_SIZE} fill="url(#aiFill)" />
                </Svg>
                <Text style={styles.aiText}>AI</Text>
              </View>
            </Animated.View>
          </Pressable>

          {sideTabs.slice(2).map((tab) => (
            <SideTab
              key={tab.key}
              tab={tab}
              active={activeKey === tab.key}
              onPress={() => onTabPress(tab.key)}
              onMeasure={handleMeasure}
            />
          ))}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Absolutely positioned so it floats low over the content (no backdrop strip).
  shell: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 16,
    paddingHorizontal: 18,
  },
  pill: {
    backgroundColor: BAR.pill,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: BAR.pillBorder,
    paddingHorizontal: 6,
    shadowColor: '#0B0714',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.32,
    shadowRadius: 22,
    elevation: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  // The single sliding highlight. left:0 + translateX centres it on a tab; top is
  // set so the circle sits centred on the icon (icon-only tabs, height 64).
  indicator: {
    position: 'absolute',
    top: 10,
    left: 0,
    width: HIGHLIGHT,
    height: HIGHLIGHT,
    borderRadius: HIGHLIGHT / 2,
    backgroundColor: BAR.highlight,
  },
  pressed: {
    transform: [{ scale: 0.95 }],
  },
  sideTab: {
    minWidth: 58,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The AI button now sits INSIDE the pill, centred like the other tabs (no lift).
  centerTab: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Soft purple halo ring + downward/ambient glow around the AI button.
  centerGlow: {
    width: AI_HALO,
    height: AI_HALO,
    borderRadius: AI_HALO / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(124, 58, 237, 0.16)',
    shadowColor: HG3.purpleBright,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.62,
    shadowRadius: 22,
    elevation: 14,
  },
  centerGlowActive: {
    backgroundColor: 'rgba(124, 58, 237, 0.26)',
    shadowOpacity: 0.82,
    shadowRadius: 26,
  },
  aiCircle: {
    width: AI_SIZE,
    height: AI_SIZE,
    borderRadius: AI_SIZE / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  aiText: {
    color: '#6D28D9',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
});
