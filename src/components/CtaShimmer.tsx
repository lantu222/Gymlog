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
 * pressed — four times, five seconds apart, and then stops for good (user
 * 2026-08-26). A motion that repeats without end stops being an invitation
 * and becomes wallpaper, and this app's own rule is to mark the exception
 * rather than decorate the normal.
 *
 * transform-only, so it runs on the native driver and costs the UI thread
 * nothing per frame. Silent under reduce-motion, where a sweeping highlight
 * is exactly the kind of thing the setting exists to stop.
 */
/** How long one band takes to cross the button. */
const SWEEP_MS = 900;

export function CtaShimmer({
  /** Sweeps to play, then it goes quiet for good. */
  bursts = 4,
  /** Start-to-start spacing between sweeps. */
  periodMs = 5000,
  tint = 'rgba(255,255,255,0.55)',
  /** Fired as each sweep begins, so a caller can move with it. */
  onSweep,
}: {
  bursts?: number;
  periodMs?: number;
  tint?: string;
  onSweep?: (index: number) => void;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const [width, setWidth] = useState(0);
  const [allowed, setAllowed] = useState(false);
  // The latest callback without restarting the run: a caller that rebuilds it
  // every render would otherwise reset the sweep counter on every frame.
  const onSweepRef = useRef(onSweep);
  onSweepRef.current = onSweep;

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
    let cancelled = false;
    let index = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    // Driven by hand rather than Animated.loop so each sweep can announce
    // itself — the play mark rides the first couple of passes.
    const sweep = () => {
      if (cancelled || index >= bursts) {
        return;
      }
      onSweepRef.current?.(index);
      index += 1;
      progress.setValue(0);
      Animated.timing(progress, {
        toValue: 1,
        duration: SWEEP_MS,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished || cancelled) {
          return;
        }
        timer = setTimeout(sweep, Math.max(0, periodMs - SWEEP_MS));
      });
    };

    sweep();
    return () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
      progress.stopAnimation();
    };
  }, [allowed, bursts, periodMs, progress, width]);

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
