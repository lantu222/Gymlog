import React, { useEffect, useMemo, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';

import { Theme, useThemedStyles } from '../theming';

/**
 * Objects sweeping left to right behind the first screens.
 *
 * *Vinha* means fast, and this is the app saying so without a word of copy —
 * the design's whole reason for it. Reduced motion gets the bars parked at
 * rest rather than removed: the layer is decoration, and taking it away would
 * change the composition for the people who need it least changed.
 */
const BARS: Array<{ top: number; width: number; height: number; seconds: number; delay: number; accent: boolean; opacity: number }> = [
  { top: 78, width: 96, height: 5, seconds: 4.2, delay: 0.4, accent: true, opacity: 0.16 },
  { top: 132, width: 54, height: 4, seconds: 6.4, delay: 2.1, accent: false, opacity: 0.08 },
  { top: 196, width: 140, height: 7, seconds: 3.4, delay: 1.2, accent: true, opacity: 0.13 },
  { top: 268, width: 72, height: 4, seconds: 5.6, delay: 3.4, accent: false, opacity: 0.07 },
  { top: 330, width: 112, height: 6, seconds: 3.9, delay: 0.9, accent: true, opacity: 0.1 },
  { top: 402, width: 44, height: 3, seconds: 7.2, delay: 4.6, accent: false, opacity: 0.07 },
  { top: 486, width: 126, height: 5, seconds: 4.8, delay: 2.7, accent: true, opacity: 0.12 },
  { top: 604, width: 88, height: 4, seconds: 6, delay: 1.7, accent: true, opacity: 0.09 },
  { top: 722, width: 108, height: 5, seconds: 4.4, delay: 3.9, accent: true, opacity: 0.11 },
];

export function AmbientDrift() {
  const styles = useThemedStyles(makeStyles);
  const { width } = useWindowDimensions();
  // One value per bar, created once. Re-creating them on a resize would restart
  // every loop mid-sweep.
  const values = useRef(BARS.map(() => new Animated.Value(0))).current;
  // Interpolated once per width, never per render: an inline .interpolate()
  // rebuilds native animated nodes every frame, which is the crash this app
  // already paid for (disconnectAnimatedNodes, 11 files).
  const sweeps = useMemo(
    () =>
      BARS.map((bar, index) =>
        values[index].interpolate({ inputRange: [0, 1], outputRange: [-bar.width, width] }),
      ),
    [values, width],
  );

  useEffect(() => {
    let cancelled = false;
    const loops: Animated.CompositeAnimation[] = [];

    AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (cancelled) {
        return;
      }
      if (reduceMotion) {
        values.forEach((value) => value.setValue(0.35));
        return;
      }
      BARS.forEach((bar, index) => {
        const loop = Animated.loop(
          Animated.sequence([
            Animated.delay(bar.delay * 1000),
            Animated.timing(values[index], {
              toValue: 1,
              duration: bar.seconds * 1000,
              easing: Easing.linear,
              useNativeDriver: true,
            }),
          ]),
        );
        loops.push(loop);
        loop.start();
      });
    });

    return () => {
      cancelled = true;
      loops.forEach((loop) => loop.stop());
    };
  }, [values]);

  return (
    <View pointerEvents="none" style={styles.layer}>
      {BARS.map((bar, index) => (
        <Animated.View
          key={bar.top}
          style={[
            styles.bar,
            {
              top: bar.top,
              width: bar.width,
              height: bar.height,
              opacity: bar.opacity,
              backgroundColor: bar.accent ? styles.accentBar.backgroundColor : styles.inkBar.backgroundColor,
              transform: [{ translateX: sweeps[index] }],
            },
          ]}
        />
      ))}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    layer: {
      ...StyleSheet.absoluteFillObject,
      overflow: 'hidden',
    },
    bar: {
      position: 'absolute',
      left: 0,
      borderRadius: 999,
    },
    accentBar: {
      backgroundColor: theme.purple,
    },
    inkBar: {
      backgroundColor: theme.ink,
    },
  });
