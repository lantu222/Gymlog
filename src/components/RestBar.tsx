import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { t } from '../lib/i18n';
import { formatClock as formatTimer, formatEndsAt } from '../lib/restSchedule';
import { Theme, useThemedStyles } from '../theming';
import { AppLanguage } from '../types/models';

interface RestBarProps {
  totalSeconds: number;
  remainingSeconds: number;
  onAdjust: (deltaSeconds: number) => void;
  onSkip: () => void;
  language?: AppLanguage;
  /**
   * The wall-clock end, when known. The eyebrow then reads "REST · ENDS 18:42"
   * — checkable against the gym clock, which a countdown alone never is after
   * any gap (design: Background Timer, "wall-clock bar").
   */
  endsAtMs?: number | null;
  /**
   * Seconds past the end. When set and > 0 the bar is in its DONE state: "REST
   * DONE · 2:14 AGO" with one action, log the set. Overrun is data, not an
   * error — the phone was in a pocket, and this is how long the rest really was.
   */
  overrunSeconds?: number | null;
  /** The done state's one action. */
  onLogSet?: () => void;
  /** What the done state names, e.g. "Set 3 · 60 kg × 8". */
  doneLabel?: string | null;
}

const formatClock = formatTimer;

/**
 * Slim floating rest bar (AW3 design language): purpleDark pill above the
 * home indicator with the countdown, ±15s adjusters, Skip, and a thin
 * progress line. Shared by the freestyle logger; Active Workout v3 will
 * reuse it.
 */
export function RestBar({
  totalSeconds,
  remainingSeconds,
  onAdjust,
  onSkip,
  language = 'en',
  endsAtMs = null,
  overrunSeconds = null,
  onLogSet,
  doneLabel = null,
}: RestBarProps) {
  const styles = useThemedStyles(makeStyles);
  const slideIn = useRef(new Animated.Value(0)).current;
  // Interpolated once: the bar re-renders every second while the timer runs,
  // and a per-render interpolate leaks native nodes (disconnectAnimatedNodes).
  const slideInTranslate = useRef(
    slideIn.interpolate({ inputRange: [0, 1], outputRange: [120, 0] }),
  ).current;

  useEffect(() => {
    Animated.timing(slideIn, {
      toValue: 1,
      duration: 380,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: true,
    }).start();
  }, [slideIn]);

  const fraction = totalSeconds > 0 ? Math.max(0, Math.min(1, remainingSeconds / totalSeconds)) : 0;
  const done = typeof overrunSeconds === 'number' && overrunSeconds >= 0 && remainingSeconds <= 0;

  if (done) {
    return (
      <Animated.View
        style={[
          styles.bar,
          styles.barDone,
          { opacity: slideIn, transform: [{ translateY: slideInTranslate }] },
        ]}
      >
        <View style={styles.row}>
          <View style={styles.copy}>
            <Text style={[styles.eyebrow, styles.eyebrowDone]}>
              {t(language, 'rest.bar.doneAgo', { ago: formatClock(overrunSeconds ?? 0) })}
            </Text>
            <Text style={styles.time} numberOfLines={1}>
              {doneLabel ?? t(language, 'rest.notify.plain')}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(language, 'rest.bar.logSet')}
            onPress={onLogSet ?? onSkip}
            style={[styles.pill, styles.pillDone]}
          >
            <Text style={[styles.pillText, styles.pillTextSolid]}>{t(language, 'rest.bar.logSet')}</Text>
          </Pressable>
        </View>
        <View style={[styles.progressTrack, styles.progressTrackDone]} />
      </Animated.View>
    );
  }

  return (
    <Animated.View
      style={[
        styles.bar,
        { opacity: slideIn, transform: [{ translateY: slideInTranslate }] },
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
          <Text style={styles.eyebrow}>{t(language, 'rest.eyebrow')}</Text>
          <Text style={styles.time}>{formatClock(remainingSeconds)}</Text>
          {/* The wall-clock end on its own line: the copy column is narrow
              next to three pills, and "REST · ENDS 18:42" as one eyebrow wrapped
              to three lines on a 360dp phone. */}
          {endsAtMs ? (
            <Text style={styles.endsAt} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
              {t(language, 'rest.bar.ends', { time: formatEndsAt(endsAtMs) })}
            </Text>
          ) : null}
        </View>
        <View style={styles.pillRow}>
          <Pressable accessibilityRole="button" accessibilityLabel={t(language, 'rest.a11y.shorten')} onPress={() => onAdjust(-15)} style={styles.pill}>
            <Text style={styles.pillText}>−15s</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={t(language, 'rest.a11y.extend')} onPress={() => onAdjust(15)} style={styles.pill}>
            <Text style={styles.pillText}>+15s</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={t(language, 'rest.a11y.skip')} onPress={onSkip} style={[styles.pill, styles.pillSolid]}>
            <Text style={[styles.pillText, styles.pillTextSolid]}>{t(language, 'rest.skip')}</Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${fraction * 100}%` }]} />
      </View>
    </Animated.View>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 30,
    zIndex: 8,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: theme.purpleDark,
    shadowColor: '#3C1690',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.45,
    shadowRadius: 34,
    elevation: 12,
  },
  // Done: dark field, green edge — the same bar after the phone was in a
  // pocket. Not an alarm colour: the rest is over, nothing is wrong.
  barDone: {
    backgroundColor: '#1D1630',
    borderWidth: 1,
    borderColor: 'rgba(22,163,74,0.35)',
    shadowColor: '#140C28',
  },
  eyebrowDone: {
    color: '#22C55E',
  },
  pillDone: {
    backgroundColor: '#16A34A',
    height: 40,
    paddingHorizontal: 16,
  },
  progressTrackDone: {
    backgroundColor: '#16A34A',
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
  endsAt: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
    color: 'rgba(255,255,255,0.62)',
    marginTop: 2,
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
    backgroundColor: theme.surface,
  },
  pillText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  pillTextSolid: {
    color: theme.purpleDark,
  },
  progressTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.surface,
  },
});
