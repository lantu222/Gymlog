import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

import { queryReduceMotion } from '../utils/reduceMotion';

/**
 * A number that lands on each new second.
 *
 * Design: "Lepoajastin" (Claude Design, 2026-08-26) — the countdown drops in
 * slightly oversized and settles, so a glance says the clock is running
 * without a second indicator to read.
 *
 * The beat is tied to the value CHANGING, not to a clock of its own. That is
 * the whole difference between this and an ambient pulse: it cannot drift out
 * of step with what it describes, and it stops the moment the number does —
 * a paused timer sits still, which is the truth a paused timer should tell.
 */
export function CountBeat({
  value,
  children,
  style,
}: {
  /** Whatever change should trigger a beat — usually the seconds remaining. */
  value: number | string;
  children: React.ReactNode;
  style?: Animated.WithAnimatedValue<object>;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const allowed = useRef(false);
  const first = useRef(true);

  useEffect(() => {
    let cancelled = false;
    void queryReduceMotion().then((reduced) => {
      if (!cancelled) {
        allowed.current = !reduced;
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // No beat on arrival: the screen already animates in, and a number that
    // jumps as it appears reads as a glitch rather than a tick.
    if (first.current) {
      first.current = false;
      return;
    }
    if (!allowed.current) {
      return;
    }
    scale.setValue(1.12);
    const animation = Animated.timing(scale, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.back(2)),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [scale, value]);

  return <Animated.View style={[{ transform: [{ scale }] }, style]}>{children}</Animated.View>;
}
