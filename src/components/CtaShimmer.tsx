import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { queryReduceMotion } from '../utils/reduceMotion';

/**
 * A band of light that sweeps across the primary call to action.
 *
 * Design: "Aloita treeni CTA" (Claude Design, 2026-08-26). The design loops
 * this every 3.2 s forever, and on every animated element of the player at
 * once. It runs on ONE element here — the button the screen exists to get
 * pressed — and it rests between sweeps rather than pulsing without pause:
 * a motion that repeats on a fixed beat stops being an invitation and
 * becomes wallpaper, and this app's own rule is to mark the exception rather
 * than decorate the normal.
 *
 * transform-only, so it runs on the native driver and costs the UI thread
 * nothing per frame. Silent under reduce-motion, where a sweeping highlight
 * is exactly the kind of thing the setting exists to stop.
 */
export function CtaShimmer({
  /** Sweeps to play when the screen arrives, then it goes quiet. */
  bursts = 2,
  /** Rest between sweeps within a burst. */
  gapMs = 2600,
  tint = 'rgba(255,255,255,0.55)',
}: {
  bursts?: number;
  gapMs?: number;
  tint?: string;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const [width, setWidth] = useState(0);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void queryReduceMotion().then((reduced) => {
      if (!cancelled) {
        setAllowed(!reduced);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!allowed || width <= 0) {
      return;
    }
    const sweep = Animated.sequence([
      Animated.timing(progress, {
        toValue: 1,
        duration: 900,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.delay(gapMs),
      Animated.timing(progress, { toValue: 0, duration: 0, useNativeDriver: true }),
    ]);
    const animation = bursts > 1 ? Animated.loop(sweep, { iterations: bursts }) : sweep;
    animation.start();
    return () => animation.stop();
  }, [allowed, bursts, gapMs, progress, width]);

  if (!allowed || width === 0) {
    // Still measured, so the sweep has a distance to travel once the answer
    // arrives — but nothing is drawn until then.
    return <View style={StyleSheet.absoluteFill} onLayout={(event) => setWidth(event.nativeEvent.layout.width)} pointerEvents="none" />;
  }

  const band = Math.max(48, width * 0.38);
  return (
    <View
      style={StyleSheet.absoluteFill}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      pointerEvents="none"
    >
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          width: band,
          transform: [
            {
              translateX: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [-band, width + band],
              }),
            },
            { skewX: '-18deg' },
          ],
        }}
      >
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="ctaShimmer" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={tint} stopOpacity={0} />
              <Stop offset="0.5" stopColor={tint} stopOpacity={1} />
              <Stop offset="1" stopColor={tint} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#ctaShimmer)" />
        </Svg>
      </Animated.View>
    </View>
  );
}
