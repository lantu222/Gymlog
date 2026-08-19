import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';

import { DRIFT, scaleY } from './vinhaMotion';
import { Theme, useThemedStyles } from '../theming';
import { queryReduceMotion } from '../utils/reduceMotion';

/**
 * Objects sweeping left to right behind the first screens.
 *
 * *Vinha* means fast, and this is the app saying so without a word of copy.
 * Same bar language as the splash streaks, slower and paler.
 *
 * Two details from the spec that are easy to lose and carry the whole effect:
 *
 *   The durations are mutually non-harmonic (3.4 / 3.9 / 4.2 / 4.4 / 4.8 /
 *   5.6 / 6.0 / 6.4 / 7.2), so the field takes minutes to repeat a pattern
 *   instead of visibly pulsing.
 *
 *   The delays are NEGATIVE — every bar starts mid-flight. Without that the
 *   first paint is an empty field that fills in, and the seam is visible every
 *   time the loop comes round.
 *
 * Reduced motion drops the layer entirely rather than parking it: the spec is
 * explicit, and a row of frozen bars is stranger than no bars.
 */
export function AmbientDrift() {
  const styles = useThemedStyles(makeStyles);
  const { width, height } = useWindowDimensions();
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const values = useRef(DRIFT.map(() => new Animated.Value(0))).current;

  const travelIn = -200 - width * 0.1;
  const travelOut = width + 40;

  // Interpolated once per width, never per render: an inline .interpolate()
  // rebuilds native animated nodes every frame.
  const sweeps = useMemo(
    () =>
      DRIFT.map((_, index) =>
        values[index].interpolate({ inputRange: [0, 1], outputRange: [travelIn, travelOut] }),
      ),
    [travelIn, travelOut, values],
  );
  const fades = useMemo(
    () =>
      DRIFT.map((bar, index) =>
        values[index].interpolate({
          inputRange: [0, 0.12, 0.82, 1],
          outputRange: [0, bar.opacity, bar.opacity, 0],
        }),
      ),
    [values],
  );

  useEffect(() => {
    let cancelled = false;
    queryReduceMotion().then((enabled) => {
      if (!cancelled) {
        setReduceMotion(enabled);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (reduceMotion !== false) {
      return;
    }

    const loops: Animated.CompositeAnimation[] = [];
    DRIFT.forEach((bar, index) => {
      // A negative delay is expressed as a head start: seed the value at the
      // fraction of the cycle it should already be through, run the remainder
      // once, then loop the full cycle from zero.
      const headStart = Math.min(0.999, Math.abs(bar.delay) / bar.ms);
      values[index].setValue(headStart);

      // Runs once and settles. It used to loop forever, and a loop that never
      // ends is a frame that never stops being drawn: measured on a Galaxy A54,
      // this screen rendered 595 frames in six idle seconds and logged 1184
      // high-input-latency frames, so a tap waited behind the drift before the
      // app could answer it. With the loop gone the same six seconds render one
      // frame and report none. The entrance is the whole gesture anyway — the
      // bars arrive, and a background that keeps moving under a reader who is
      // reading is not what it was for.
      const settle = Animated.timing(values[index], {
        toValue: 1,
        duration: bar.ms * (1 - headStart),
        easing: Easing.linear,
        useNativeDriver: true,
      });
      settle.start();
      loops.push(settle);
    });

    return () => {
      loops.forEach((loop) => loop.stop());
      values.forEach((value) => value.stopAnimation());
    };
  }, [reduceMotion, values]);

  if (reduceMotion !== false) {
    return null;
  }

  return (
    <View pointerEvents="none" style={styles.layer}>
      {DRIFT.map((bar, index) => (
        <Animated.View
          key={bar.y}
          style={[
            styles.bar,
            {
              top: scaleY(height, bar.y),
              width: bar.width,
              height: bar.height,
              opacity: fades[index],
              backgroundColor: bar.accent ? styles.accent.color : styles.ink.color,
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
    // Read as values, not applied — hence `color`, not `backgroundColor`.
    accent: {
      color: theme.purple,
    },
    ink: {
      color: theme.ink,
    },
  });
