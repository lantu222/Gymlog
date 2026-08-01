import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { VinhaWordmark } from '../components/VinhaWordmark';
import { t } from '../lib/i18n';
import { Theme, useThemedStyles } from '../theming';
import { AppLanguage } from '../types/models';

/**
 * The launch animation (design: Vinha Splash & Welcome).
 *
 * Objects streak past at different speeds and the wordmark arrives last and
 * fastest, landing dead centre. That is the whole idea: *vinha* means fast, so
 * the name is demonstrated rather than explained.
 *
 * This is not the native splash — that one is a static image Android shows
 * before any JavaScript runs. This plays after it, and hands over to whatever
 * comes next with the mark sitting at the same height, so the handoff has no
 * jump. The "app" tag carries the momentum out to the right and does not come
 * back; see VinhaWordmark for why the tag exists at all.
 */
interface VinhaSplashScreenProps {
  language?: AppLanguage;
  /** Called once the animation has settled, or immediately on reduced motion. */
  onDone: () => void;
}

/** Where the wordmark sits, measured from the top, on this screen and Welcome. */
export const VINHA_MARK_TOP = 247;

const STREAKS: Array<{ top: number; width: number; height: number; ms: number; delay: number; accent: boolean; opacity: number }> = [
  { top: 214, width: 116, height: 6, ms: 700, delay: 60, accent: true, opacity: 0.2 },
  { top: 266, width: 62, height: 4, ms: 1020, delay: 0, accent: false, opacity: 0.13 },
  { top: 318, width: 178, height: 9, ms: 560, delay: 180, accent: true, opacity: 0.32 },
  { top: 470, width: 90, height: 5, ms: 880, delay: 120, accent: false, opacity: 0.1 },
  { top: 512, width: 148, height: 7, ms: 640, delay: 300, accent: true, opacity: 0.24 },
  { top: 566, width: 46, height: 4, ms: 1180, delay: 220, accent: false, opacity: 0.12 },
  { top: 612, width: 124, height: 5, ms: 760, delay: 420, accent: true, opacity: 0.16 },
  { top: 668, width: 74, height: 3, ms: 980, delay: 500, accent: false, opacity: 0.09 },
];

/** The mark lands at 900ms; the tagline follows it; then we hand over. */
const HOLD_MS = 2500;

export function VinhaSplashScreen({ language = 'en', onDone }: VinhaSplashScreenProps) {
  const styles = useThemedStyles(makeStyles);
  const { width } = useWindowDimensions();
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  // Held in a ref, not a dependency: the parent passes a fresh closure on every
  // render, and depending on it restarted the hand-off timer each time — so the
  // splash animated correctly and then never left.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const streaks = useRef(STREAKS.map(() => new Animated.Value(0))).current;
  const mark = useRef(new Animated.Value(0)).current;
  const tagline = useRef(new Animated.Value(0)).current;

  const streakSweeps = useMemo(
    () =>
      STREAKS.map((streak, index) =>
        streaks[index].interpolate({ inputRange: [0, 1], outputRange: [-streak.width, width] }),
      ),
    [streaks, width],
  );
  // The mark arrives from the left like everything else, only faster and last.
  const markX = useRef(mark.interpolate({ inputRange: [0, 1], outputRange: [-90, 0] })).current;
  const taglineY = useRef(tagline.interpolate({ inputRange: [0, 1], outputRange: [10, 0] })).current;

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (!cancelled) {
        setReduceMotion(enabled);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (reduceMotion === null) {
      return;
    }

    if (reduceMotion) {
      // Nothing to watch, so nothing to wait for. The settled frame is shown
      // for a beat and then we move on.
      streaks.forEach((value) => value.setValue(1));
      mark.setValue(1);
      tagline.setValue(1);
      const timer = setTimeout(() => onDoneRef.current(), 600);
      return () => clearTimeout(timer);
    }

    Animated.parallel([
      ...STREAKS.map((streak, index) =>
        Animated.timing(streaks[index], {
          toValue: 1,
          duration: streak.ms,
          delay: streak.delay,
          easing: Easing.bezier(0.35, 0, 0.25, 1),
          useNativeDriver: true,
        }),
      ),
      Animated.timing(mark, {
        toValue: 1,
        duration: 900,
        delay: 900,
        easing: Easing.bezier(0.12, 0.8, 0.2, 1),
        useNativeDriver: true,
      }),
      Animated.timing(tagline, {
        toValue: 1,
        duration: 700,
        delay: 1700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => onDoneRef.current(), HOLD_MS);
    return () => clearTimeout(timer);
  }, [mark, reduceMotion, streaks, tagline]);

  return (
    <View style={styles.screen}>
      {STREAKS.map((streak, index) => (
        <Animated.View
          key={streak.top}
          style={[
            styles.streak,
            {
              top: streak.top,
              width: streak.width,
              height: streak.height,
              opacity: streak.opacity,
              backgroundColor: streak.accent ? styles.accent.backgroundColor : styles.ink.backgroundColor,
              transform: [{ translateX: streakSweeps[index] }],
            },
          ]}
        />
      ))}

      <View style={styles.markSlot}>
        <Animated.View style={{ opacity: mark, transform: [{ translateX: markX }] }}>
          <VinhaWordmark size={64} showAppTag />
        </Animated.View>
      </View>

      <Animated.Text style={[styles.tagline, { opacity: tagline, transform: [{ translateY: taglineY }] }]}>
        {t(language, 'brand.tagline')}
      </Animated.Text>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: theme.bg,
      overflow: 'hidden',
    },
    streak: {
      position: 'absolute',
      left: 0,
      borderRadius: 999,
    },
    accent: {
      backgroundColor: theme.purple,
    },
    ink: {
      backgroundColor: theme.ink,
    },
    // Fixed top so the mark does not move when Welcome takes over.
    markSlot: {
      position: 'absolute',
      top: VINHA_MARK_TOP,
      left: 0,
      right: 0,
      height: 64,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tagline: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 34,
      textAlign: 'center',
      fontSize: 12.5,
      fontWeight: '700',
      letterSpacing: 2.7,
      textTransform: 'uppercase',
      color: theme.faint,
    },
  });
