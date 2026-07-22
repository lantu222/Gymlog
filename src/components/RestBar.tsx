import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { HG } from '../lightTheme';

interface RestBarProps {
  totalSeconds: number;
  remainingSeconds: number;
  onAdjust: (deltaSeconds: number) => void;
  onSkip: () => void;
}

function formatClock(seconds: number) {
  const safe = Math.max(0, seconds);
  return `${Math.floor(safe / 60)}:${`${safe % 60}`.padStart(2, '0')}`;
}

/**
 * Slim floating rest bar (AW3 design language): purpleDark pill above the
 * home indicator with the countdown, ±15s adjusters, Skip, and a thin
 * progress line. Shared by the freestyle logger; Active Workout v3 will
 * reuse it.
 */
export function RestBar({ totalSeconds, remainingSeconds, onAdjust, onSkip }: RestBarProps) {
  const slideIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(slideIn, {
      toValue: 1,
      duration: 380,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: true,
    }).start();
  }, [slideIn]);

  const fraction = totalSeconds > 0 ? Math.max(0, Math.min(1, remainingSeconds / totalSeconds)) : 0;

  return (
    <Animated.View
      style={[
        styles.bar,
        {
          opacity: slideIn,
          transform: [
            {
              translateY: slideIn.interpolate({ inputRange: [0, 1], outputRange: [120, 0] }),
            },
          ],
        },
      ]}
    >
      <View style={styles.row}>
        <Svg viewBox="0 0 24 24" width={19} height={19} style={styles.clockIcon}>
          <Circle cx={12} cy={13.5} r={7} stroke="#FFFFFF" strokeWidth={2} fill="none" />
          <Path
            d="M10 2.5h4M12 2.5v4M12 10.5v3.5l2.2 1.6"
            stroke="#FFFFFF"
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
        <View style={styles.copy}>
          <Text style={styles.eyebrow}>REST</Text>
          <Text style={styles.time}>{formatClock(remainingSeconds)}</Text>
        </View>
        <View style={styles.pillRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="Shorten rest by 15 seconds" onPress={() => onAdjust(-15)} style={styles.pill}>
            <Text style={styles.pillText}>−15s</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Extend rest by 15 seconds" onPress={() => onAdjust(15)} style={styles.pill}>
            <Text style={styles.pillText}>+15s</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Skip rest" onPress={onSkip} style={[styles.pill, styles.pillSolid]}>
            <Text style={[styles.pillText, styles.pillTextSolid]}>Skip</Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${fraction * 100}%` }]} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 30,
    zIndex: 8,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: HG.purpleDark,
    shadowColor: '#3C1690',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.45,
    shadowRadius: 34,
    elevation: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  clockIcon: {
    flexShrink: 0,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1.05,
    color: 'rgba(255,255,255,0.65)',
  },
  time: {
    fontSize: 21,
    fontWeight: '800',
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
    lineHeight: 23,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 7,
  },
  pill: {
    height: 34,
    paddingHorizontal: 13,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  pillSolid: {
    backgroundColor: '#FFFFFF',
  },
  pillText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  pillTextSolid: {
    color: HG.purpleDark,
  },
  progressTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
  },
});
