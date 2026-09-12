import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { useTheme } from '../theming';
import { queryReduceMotion } from '../utils/reduceMotion';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

/**
 * Two lights running the outline of whatever contains them, in opposite
 * directions — the mark of a superset.
 *
 * Drop it in as the last child of any container: it fills that container,
 * measures itself, and takes no taps. Nothing about the layout it sits in has
 * to change, which is the point — it goes around the SET SCREEN as readily as
 * around one row of the run sheet.
 *
 * This app's rule is to mark the exception rather than decorate the normal,
 * and a motion that loops forever normally breaks it: CtaShimmer runs four
 * times and then stops for good, because an invitation that repeats becomes
 * wallpaper. A state is not an invitation. This says "the two lifts inside
 * this line are done back to back" for exactly as long as that is true, and
 * the two directions are the point rather than an effect — the eye follows
 * them round and finds both lifts inside one boundary.
 *
 * Silent under reduce-motion, where it falls back to the same outline, still
 * drawn: the reader who turned motion off still needs to know it is a
 * superset.
 */
export function SupersetBorder({
  /** Match the corner radius of the container this sits in. */
  radius = 16,
  /** How far inside the container the line runs, so a 2px stroke is not clipped. */
  inset = 1.5,
  /** One lap, in milliseconds. Slow: this is a marker, not a spinner. */
  lapMs = 4200,
}: {
  radius?: number;
  inset?: number;
  lapMs?: number;
}) {
  const theme = useTheme();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [allowed, setAllowed] = useState(false);
  // One node per view. A single Animated.Value driving two elements is the
  // shape that took the app down once before — see the animated-node note.
  const clockwise = useRef(new Animated.Value(0)).current;
  const widdershins = useRef(new Animated.Value(0)).current;

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
    if (!allowed || size.width <= 0 || size.height <= 0) {
      return;
    }
    // Linear, because a lap that eases is a lap that looks like it is about to
    // stop — and this one never does while the reader is inside the superset.
    const lap = (value: Animated.Value) =>
      Animated.loop(
        Animated.timing(value, {
          toValue: 1,
          duration: lapMs,
          easing: Easing.linear,
          // strokeDashoffset is not a transform, so this cannot be native.
          // One interpolated prop per line, two lines, four seconds a lap.
          useNativeDriver: false,
        }),
      );
    const runs = [lap(clockwise), lap(widdershins)];
    runs.forEach((run) => run.start());
    return () => {
      runs.forEach((run) => run.stop());
      clockwise.setValue(0);
      widdershins.setValue(0);
    };
  }, [allowed, size.width, size.height, lapMs, clockwise, widdershins]);

  const width = Math.max(0, size.width - inset * 2);
  const height = Math.max(0, size.height - inset * 2);
  // A rounded rectangle's outline: the four straight runs, plus the four
  // corner quarters, which together make one circle.
  const cornerRadius = Math.min(radius, width / 2, height / 2);
  const perimeter =
    2 * Math.max(0, width - cornerRadius * 2) +
    2 * Math.max(0, height - cornerRadius * 2) +
    2 * Math.PI * cornerRadius;
  // Long enough to read as a moving light, short enough that the corner it is
  // turning is always visible as a corner.
  const segment = perimeter * 0.24;

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      onLayout={(event) => {
        const { width: w, height: h } = event.nativeEvent.layout;
        setSize((current) => (current.width === w && current.height === h ? current : { width: w, height: h }));
      }}
    >
      {perimeter > 0 ? (
        <Svg width={size.width} height={size.height}>
          {/* The line the two lights run on. Faint, and the whole of the
              marking when motion is off. */}
          <Rect
            x={inset}
            y={inset}
            width={width}
            height={height}
            rx={cornerRadius}
            ry={cornerRadius}
            fill="none"
            stroke={theme.purple}
            strokeOpacity={0.28}
            strokeWidth={1.5}
          />
          {allowed ? (
            <>
              <AnimatedRect
                x={inset}
                y={inset}
                width={width}
                height={height}
                rx={cornerRadius}
                ry={cornerRadius}
                fill="none"
                stroke={theme.purple}
                strokeWidth={2.4}
                strokeLinecap="round"
                strokeDasharray={`${segment},${Math.max(1, perimeter - segment)}`}
                strokeDashoffset={clockwise.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -perimeter],
                })}
              />
              {/* The other way round, in the colour this app gives to what you
                  act on — the two meeting and parting is what makes the shape
                  read as one thing holding two. */}
              <AnimatedRect
                x={inset}
                y={inset}
                width={width}
                height={height}
                rx={cornerRadius}
                ry={cornerRadius}
                fill="none"
                stroke={theme.highlight}
                strokeWidth={2.4}
                strokeLinecap="round"
                strokeDasharray={`${segment},${Math.max(1, perimeter - segment)}`}
                strokeDashoffset={widdershins.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, perimeter],
                })}
              />
            </>
          ) : null}
        </Svg>
      ) : null}
    </View>
  );
}
