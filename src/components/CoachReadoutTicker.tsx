import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { CoachTickerRow } from '../lib/coachChat';
import { Theme, useThemedStyles } from '../theming';
import { queryReduceMotion } from '../utils/reduceMotion';

/**
 * Everything the coach says before the first question, one slide at a time
 * (design: "AI Chat hienosäätö", A — then widened 2026-08-23).
 *
 * It used to be a bordered card holding three readout rows, and later a
 * stack: this ticker, a "things I noticed" card, and the opening bubble —
 * three surfaces that together pushed the conversation off the screen. Now
 * one stage carries all of it: today's line, what the coach noticed, and the
 * readout, in that order. A slide with a question is tappable and says so;
 * a slide that is a fact from the log is just read out.
 *
 * The rotation stops the moment the first message is sent, because the screen
 * that owns it stops rendering this. Motion is a short fade every few seconds
 * rather than a continuous loop — an idle screen should not be painting frames
 * — and it holds still entirely when the system asks for reduced motion.
 */
const HOLD_MS = 3400;
const MOVE_MS = 320;
const RISE = 9;

interface CoachReadoutTickerProps {
  rows: CoachTickerRow[];
  /** "Ask about this →" — shown under a slide that carries a question. */
  askLabel: string;
  onAsk: (question: string) => void;
}

export function CoachReadoutTicker({ rows, askLabel, onAsk }: CoachReadoutTickerProps) {
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

  const renderSlide = (row: CoachTickerRow, lines: number | undefined) => {
    const body = (
      <>
        <Text style={styles.label}>{row.label}</Text>
        <Text style={styles.value} numberOfLines={lines}>
          {row.value}
        </Text>
        {row.question ? <Text style={styles.ask}>{askLabel}</Text> : null}
      </>
    );
    if (!row.question) {
      return <View>{body}</View>;
    }
    const question = row.question;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${row.value}. ${askLabel}`}
        onPress={() => onAsk(question)}
        style={({ pressed }) => pressed && styles.pressed}
      >
        {body}
      </Pressable>
    );
  };

  // Reduced motion gets the whole list, plainly — the point is the content,
  // and without movement a single rotating line would hide most of it.
  if (still) {
    return (
      <View style={styles.wrap}>
        {rows.map((row) => (
          <View key={row.key} style={styles.stillRow}>
            {renderSlide(row, undefined)}
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
          {renderSlide(row, 3)}
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
    // Fixed height: the slides differ in length, and a stage that resized on
    // every rotation would shove the conversation up and down. Tall enough
    // for a three-line opening sentence plus its ask line.
    stage: {
      height: 96,
      justifyContent: 'center',
    },
    stillRow: {
      paddingVertical: 8,
    },
    label: {
      color: theme.faint,
      fontSize: 11,
      lineHeight: 14,
      fontWeight: '800',
      letterSpacing: 1.25,
      textTransform: 'uppercase',
    },
    value: {
      color: theme.ink,
      fontSize: 16,
      lineHeight: 22,
      fontWeight: '700',
      marginTop: 4,
    },
    ask: {
      color: theme.highlight,
      fontSize: 12.5,
      fontWeight: '800',
      marginTop: 6,
    },
    pressed: {
      opacity: 0.7,
    },
    dots: {
      flexDirection: 'row',
      gap: 5,
      marginTop: 10,
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
