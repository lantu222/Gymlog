import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { CoachContextRow } from '../lib/coachChat';
import { Theme, useThemedStyles } from '../theming';
import { queryReduceMotion } from '../utils/reduceMotion';

/**
 * What the coach has already read from your log, one line at a time
 * (design: "AI Chat hienosäätö", A).
 *
 * It used to be a bordered card holding all three rows at once — a block of
 * data stacked on an empty screen before anyone had asked anything. Same
 * content, no card: one row rises, holds, and leaves, with dots saying more is
 * coming. It reads as the coach's voice rather than a table.
 *
 * The rotation stops the moment the first message is sent, because the screen
 * that owns it stops rendering this. Motion is a short fade every few seconds
 * rather than a continuous loop — an idle screen should not be painting frames
 * — and it holds still entirely when the system asks for reduced motion.
 */
const HOLD_MS = 2400;
const MOVE_MS = 320;
const RISE = 9;

interface CoachReadoutTickerProps {
  rows: CoachContextRow[];
}

export function CoachReadoutTicker({ rows }: CoachReadoutTickerProps) {
  const styles = useThemedStyles(makeStyles);
  const [index, setIndex] = useState(0);
  const [still, setStill] = useState(false);
  const fade = useRef(new Animated.Value(1)).current;
  const lift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;
    void queryReduceMotion().then((reduced) => {
      if (!cancelled && reduced) {
        setStill(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (still || rows.length < 2) {
      return;
    }
    const timer = setInterval(() => {
      Animated.parallel([
        Animated.timing(fade, { toValue: 0, duration: MOVE_MS, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        Animated.timing(lift, { toValue: -RISE, duration: MOVE_MS, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (!finished) {
          return;
        }
        setIndex((current) => (current + 1) % rows.length);
        lift.setValue(RISE);
        Animated.parallel([
          Animated.timing(fade, { toValue: 1, duration: MOVE_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(lift, { toValue: 0, duration: MOVE_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        ]).start();
      });
    }, HOLD_MS);
    return () => clearInterval(timer);
  }, [fade, lift, rows.length, still]);

  if (rows.length === 0) {
    return null;
  }

  // Reduced motion gets the whole list, plainly — the point is the content,
  // and without movement a single rotating line would hide two thirds of it.
  if (still) {
    return (
      <View style={styles.wrap}>
        {rows.map((row) => (
          <View key={row.key} style={styles.stillRow}>
            <Text style={styles.label}>{row.label}</Text>
            <Text style={styles.value}>{row.value}</Text>
          </View>
        ))}
      </View>
    );
  }

  const row = rows[Math.min(index, rows.length - 1)];

  return (
    <View style={styles.wrap}>
      <View style={styles.stage}>
        <Animated.View style={{ opacity: fade, transform: [{ translateY: lift }] }}>
          <Text style={styles.label}>{row.label}</Text>
          <Text style={styles.value} numberOfLines={2}>
            {row.value}
          </Text>
        </Animated.View>
      </View>
      {rows.length > 1 ? (
        <View style={styles.dots}>
          {rows.map((entry, dotIndex) => (
            <View key={entry.key} style={[styles.dot, dotIndex === index && styles.dotOn]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    wrap: {
      paddingVertical: 2,
    },
    // Fixed height: the rows differ in length, and a stage that resized on
    // every rotation would shove the conversation up and down.
    stage: {
      height: 44,
      justifyContent: 'center',
    },
    stillRow: {
      paddingVertical: 6,
    },
    label: {
      color: theme.faint,
      fontSize: 10.5,
      lineHeight: 14,
      fontWeight: '800',
      letterSpacing: 1.25,
      textTransform: 'uppercase',
    },
    value: {
      color: theme.ink,
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '700',
      marginTop: 3,
    },
    dots: {
      flexDirection: 'row',
      gap: 5,
      marginTop: 12,
    },
    dot: {
      width: 5,
      height: 5,
      borderRadius: 999,
      backgroundColor: theme.faint,
      opacity: 0.3,
    },
    dotOn: {
      opacity: 1,
    },
  });
