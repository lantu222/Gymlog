import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { TourTargetRegistry } from '../features/tour/tourTargets';
import { cutCornerPath } from '../lib/cutCorner';
import {
  BAR_SWEEP_STOP_MS,
  CALLOUT_ENTER_MS,
  CALLOUT_LEAVE_MS,
  CALLOUT_SIDE_INSET,
  notchOffset,
  placeCallout,
  RING_ENTER_MS,
  ringBox,
  TOUR_BAR_STOP_COPY_KEY,
  TourBarStop,
  TourBeat,
  TourRect,
  TourSurface,
  TourTargetId,
  tourStartDelayMs,
} from '../lib/firstRunTour';
import { I18nKey, t } from '../lib/i18n';
import { Theme, useTheme, useThemeName, useThemedStyles } from '../theming';
import { AppLanguage } from '../types/models';
import { queryReduceMotion } from '../utils/reduceMotion';
import { CutSurface } from './CutSurface';

/**
 * The first-run tour's guidance layer: a ring around one thing and a callout
 * beside it, once per surface.
 *
 * What it deliberately is not: a scrim. The layer is `box-none`, so every
 * touch that is not on the callout reaches the page underneath — the hero
 * stays pressable on the week strip's beat, the bar still switches tabs, the
 * page still scrolls (and the ring follows). The design build shipped an
 * advance surface cut into four strips around the ring; that blocked the
 * one thing the brief said must never block, and it is gone.
 *
 * Tap-to-advance, always: the callout's own button steps the tour. The bar
 * is a single beat whose highlight sweeps the five items on a timer, because
 * the brief asked for one sweep rather than five stops — but the button
 * still steps it by hand, and under reduced motion the sweep is a list.
 */

const RISE_EASING = Easing.bezier(0.22, 1, 0.36, 1);
/** Brand mark on the bar, not copy: the button itself says "AI". */
const AI_MARK = 'AI';

const STOP_TARGET: Record<TourBarStop, TourTargetId> = {
  home: 'bar.home',
  programs: 'bar.programs',
  ai: 'bar.ai',
  progress: 'bar.progress',
  profile: 'bar.profile',
};

const STOP_TITLE_KEY: Record<Exclude<TourBarStop, 'ai'>, I18nKey> = {
  home: 'tabs.home',
  programs: 'tabs.programs',
  progress: 'tabs.progress',
  profile: 'tabs.profile',
};

interface FirstRunTourProps {
  surface: TourSurface;
  beats: TourBeat[];
  registry: TourTargetRegistry;
  language: AppLanguage;
  /** The bar's highlight follows the sweep; null hands it back to the route. */
  onSweep: (stop: TourBarStop | null) => void;
  /**
   * Done, skipped, or left mid-way: the surface is marked seen either way.
   * Leaving early is not failure, and the app gets out of the way.
   */
  onFinish: () => void;
}

interface Origin {
  x: number;
  y: number;
}

export function FirstRunTour({ surface, beats, registry, language, onSweep, onFinish }: FirstRunTourProps) {
  const theme = useTheme();
  const themeName = useThemeName();
  const styles = useThemedStyles(makeStyles);

  const rootRef = useRef<View>(null);
  const originRef = useRef<Origin>({ x: 0, y: 0 });
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const [phase, setPhase] = useState<'waiting' | 'beat' | 'done'>('waiting');
  const [index, setIndex] = useState(0);
  const [stopIndex, setStopIndex] = useState(0);
  const [rect, setRect] = useState<TourRect | null>(null);
  const [barTop, setBarTop] = useState<number | null>(null);
  const [calloutHeight, setCalloutHeight] = useState(0);
  const finishedRef = useRef(false);
  const onFinishRef = useRef(onFinish);
  const onSweepRef = useRef(onSweep);
  onFinishRef.current = onFinish;
  onSweepRef.current = onSweep;

  // One node per animated view, interpolated once (ref-animated-node-one-view).
  const calloutAnim = useRef(new Animated.Value(0)).current;
  const ringAnim = useRef(new Animated.Value(0)).current;
  const calloutStyle = useRef({
    opacity: calloutAnim,
    transform: [
      { translateY: calloutAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
      { scale: calloutAnim.interpolate({ inputRange: [0, 1], outputRange: [0.985, 1] }) },
    ],
  }).current;
  const ringStyle = useRef({
    opacity: ringAnim,
    transform: [{ scale: ringAnim.interpolate({ inputRange: [0, 1], outputRange: [1.05, 1] }) }],
  }).current;

  const beat = beats[index] ?? null;
  // Effects key on these primitives, not on `beat`: the beats array is
  // rebuilt by the parent now and then, and an object dependency would
  // restart the sweep's timer on every one of those renders.
  const beatKind = beat ? beat.kind : null;
  const beatTarget = beat && beat.kind === 'section' ? beat.target : null;
  const stopCount = beat && beat.kind === 'bar' ? beat.stops.length : 0;
  const currentStop: TourBarStop | null = beat && beat.kind === 'bar' ? beat.stops[stopIndex] ?? null : null;

  const measureOrigin = useCallback(
    () =>
      new Promise<Origin>((resolve) => {
        const node = rootRef.current;
        if (!node) {
          resolve(originRef.current);
          return;
        }
        let settled = false;
        const timer = setTimeout(() => {
          if (!settled) {
            settled = true;
            resolve(originRef.current);
          }
        }, 300);
        node.measureInWindow((x, y) => {
          clearTimeout(timer);
          if (!settled) {
            settled = true;
            originRef.current = { x, y };
            resolve(originRef.current);
          }
        });
      }),
    [],
  );

  const toLocal = useCallback((window: TourRect, origin: Origin): TourRect => ({
    x: window.x - origin.x,
    y: window.y - origin.y,
    width: window.width,
    height: window.height,
  }), []);

  const finish = useCallback(() => {
    if (finishedRef.current) {
      return;
    }
    finishedRef.current = true;
    onSweepRef.current(null);
    setPhase('done');
    onFinishRef.current();
  }, []);

  // Reduced motion decides the start delay; the query always answers.
  useEffect(() => {
    let mounted = true;
    void queryReduceMotion().then((enabled) => {
      if (mounted) {
        setReduceMotion(Boolean(enabled));
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (reduceMotion === null || phase !== 'waiting') {
      return;
    }
    const timer = setTimeout(() => setPhase('beat'), tourStartDelayMs(reduceMotion));
    return () => clearTimeout(timer);
  }, [phase, reduceMotion]);

  // Leaving mid-tour — a tab press, a workout started — still counts as seen.
  useEffect(
    () => () => {
      onSweepRef.current(null);
      if (!finishedRef.current) {
        finishedRef.current = true;
        onFinishRef.current();
      }
    },
    [],
  );

  const showCallout = useCallback(
    (animated: boolean) => {
      if (!animated) {
        calloutAnim.setValue(1);
        ringAnim.setValue(1);
        return;
      }
      calloutAnim.setValue(0);
      ringAnim.setValue(0);
      Animated.parallel([
        Animated.timing(calloutAnim, { toValue: 1, duration: CALLOUT_ENTER_MS, easing: RISE_EASING, useNativeDriver: true }),
        Animated.timing(ringAnim, { toValue: 1, duration: RING_ENTER_MS, easing: RISE_EASING, useNativeDriver: true }),
      ]).start();
    },
    [calloutAnim, ringAnim],
  );

  const stepTo = useCallback(
    (next: number) => {
      if (next >= beats.length) {
        finish();
        return;
      }
      setRect(null);
      setIndex(next);
    },
    [beats.length, finish],
  );

  // A beat starts: bring its target into the band, measure it, show the ring.
  useEffect(() => {
    if (phase !== 'beat' || reduceMotion === null) {
      return;
    }
    if (!beat) {
      finish();
      return;
    }
    let cancelled = false;
    const animated = !reduceMotion;

    void (async () => {
      let targetRect: TourRect | null = null;
      if (beat.kind === 'section') {
        if (!registry.has(beat.target)) {
          // The section is not on this install's screen; the beat has nothing
          // to point at, so it is skipped rather than shown pointing at air.
          if (!cancelled) {
            stepTo(index + 1);
          }
          return;
        }
        await registry.scrollIntoView(surface, beat.target, beat.place, animated);
        targetRect = await registry.measure(beat.target);
      } else {
        setStopIndex(0);
        onSweepRef.current(beat.stops[0]);
        targetRect = await registry.measure(STOP_TARGET[beat.stops[0]]);
      }
      const origin = await measureOrigin();
      const pill = await registry.measure('bar.pill');
      if (cancelled) {
        return;
      }
      if (!targetRect) {
        stepTo(index + 1);
        return;
      }
      setBarTop(pill ? pill.y - origin.y : null);
      setRect(toLocal(targetRect, origin));
      showCallout(animated);
    })();

    return () => {
      cancelled = true;
    };
    // `beat` is derived from index; the effect keys on the index itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, index, reduceMotion]);

  // The bar sweep: the highlight travels on a timer; the button can step it too.
  useEffect(() => {
    if (phase !== 'beat' || beatKind !== 'bar' || reduceMotion !== false) {
      return;
    }
    if (stopIndex >= stopCount - 1) {
      return;
    }
    const timer = setTimeout(() => setStopIndex((current) => current + 1), BAR_SWEEP_STOP_MS);
    return () => clearTimeout(timer);
  }, [beatKind, phase, reduceMotion, stopCount, stopIndex]);

  useEffect(() => {
    if (phase !== 'beat' || beatKind !== 'bar' || stopIndex === 0 || !currentStop) {
      return;
    }
    let cancelled = false;
    onSweepRef.current(currentStop);
    void (async () => {
      const [targetRect, origin] = await Promise.all([registry.measure(STOP_TARGET[currentStop]), measureOrigin()]);
      if (!cancelled && targetRect) {
        setRect(toLocal(targetRect, origin));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [beatKind, currentStop, measureOrigin, phase, registry, stopIndex, toLocal]);

  // The page under the tour stays scrollable; the ring follows its target.
  useEffect(() => {
    if (phase !== 'beat' || !beatTarget) {
      return;
    }
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    const unsubscribe = registry.subscribeScroll(() => {
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        void (async () => {
          const [targetRect, origin] = await Promise.all([registry.measure(beatTarget), measureOrigin()]);
          if (!cancelled && targetRect) {
            setRect(toLocal(targetRect, origin));
          }
        })();
      }, 120);
    });
    return () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
      unsubscribe();
    };
  }, [beatTarget, measureOrigin, phase, registry, toLocal]);

  const advance = useCallback(() => {
    if (phase !== 'beat' || !beat) {
      return;
    }
    if (beat.kind === 'bar' && reduceMotion === false && stopIndex < beat.stops.length - 1) {
      setStopIndex(stopIndex + 1);
      return;
    }
    const next = index + 1;
    if (reduceMotion) {
      stepTo(next);
      return;
    }
    Animated.parallel([
      Animated.timing(calloutAnim, { toValue: 0, duration: CALLOUT_LEAVE_MS, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.timing(ringAnim, { toValue: 0, duration: CALLOUT_LEAVE_MS, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) {
        stepTo(next);
      }
    });
  }, [beat, calloutAnim, index, phase, reduceMotion, ringAnim, stepTo, stopIndex]);

  const onRootLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width !== size.width || height !== size.height) {
      setSize({ width, height });
    }
    void measureOrigin();
  };

  if (phase !== 'beat' || !beat || !rect || size.width === 0) {
    return <View ref={rootRef} pointerEvents="box-none" style={StyleSheet.absoluteFill} onLayout={onRootLayout} />;
  }

  const isBar = beat.kind === 'bar';
  const stop = isBar ? beat.stops[stopIndex] ?? beat.stops[0] : null;
  const shape = isBar ? (stop === 'ai' ? 'bar-ai' : 'bar') : 'section';
  const ring = ringBox(rect, shape);
  const calloutWidth = size.width - CALLOUT_SIDE_INSET * 2;
  const placement = placeCallout({
    target: isBar ? ring : rect,
    calloutHeight: calloutHeight || 120,
    screenHeight: size.height,
    barTop,
    prefer: isBar ? 'above' : beat.place,
  });
  const notchX = notchOffset(isBar ? ring : rect, CALLOUT_SIDE_INSET, calloutWidth);
  const listAllStops = isBar && reduceMotion === true;
  const isLast = index + 1 >= beats.length && (!isBar || listAllStops || stopIndex >= beat.stops.length - 1);

  const co = themeName === 'dark'
    ? { surface: theme.purpleLight, ink: theme.ink, muted: theme.muted }
    : { surface: theme.proSheetTop, ink: '#F4F1FF', muted: '#B7ABDA' };
  const accent = theme.highlight;
  const accentInk = theme.onHighlight;
  const title = isBar && stop ? (stop === 'ai' ? AI_MARK : t(language, STOP_TITLE_KEY[stop])) : null;
  const body = isBar
    ? stop
      ? t(language, TOUR_BAR_STOP_COPY_KEY[stop] as I18nKey)
      : ''
    : t(language, beat.copyKey as I18nKey);

  return (
    <View ref={rootRef} pointerEvents="box-none" style={StyleSheet.absoluteFill} onLayout={onRootLayout}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.ring,
          { left: ring.x - 8, top: ring.y - 8, width: ring.width + 16, height: ring.height + 16 },
          ringStyle,
        ]}
      >
        <Svg width={ring.width + 16} height={ring.height + 16}>
          {shape === 'section' ? (
            <>
              <Path d={cutCornerPath(ring.width, ring.height, 20)} x={8} y={8} fill="none" stroke={theme.highlightSoft} strokeWidth={7} />
              <Path d={cutCornerPath(ring.width, ring.height, 20)} x={8} y={8} fill="none" stroke={accent} strokeWidth={2} />
            </>
          ) : (
            <>
              <Circle cx={ring.width / 2 + 8} cy={ring.height / 2 + 8} r={ring.width / 2 - 1} fill="none" stroke={theme.highlightSoft} strokeWidth={7} />
              <Circle cx={ring.width / 2 + 8} cy={ring.height / 2 + 8} r={ring.width / 2 - 1} fill="none" stroke={accent} strokeWidth={2} />
            </>
          )}
        </Svg>
      </Animated.View>

      <Animated.View
        pointerEvents="box-none"
        onLayout={(event) => {
          const height = event.nativeEvent.layout.height;
          if (height !== calloutHeight) {
            setCalloutHeight(height);
          }
        }}
        style={[
          styles.calloutWrap,
          { left: CALLOUT_SIDE_INSET, width: calloutWidth, top: placement.top, opacity: calloutHeight ? 1 : 0 },
          calloutHeight ? calloutStyle : null,
        ]}
      >
        <CutSurface size="lg" fill={co.surface} speedLine={{ color: accent }} style={styles.callout}>
          <View style={styles.headRow}>
            <Text style={[styles.counter, { color: co.muted }]}>{`${index + 1}/${beats.length}`}</Text>
            {title && !listAllStops ? <Text style={[styles.title, { color: co.ink }]}>{title}</Text> : null}
          </View>
          {listAllStops ? (
            <View style={styles.stopList}>
              {beat.stops.map((item) => (
                <Text key={item} style={[styles.body, { color: co.ink }]}>
                  <Text style={styles.title}>{item === 'ai' ? AI_MARK : t(language, STOP_TITLE_KEY[item])}</Text>
                  {'  '}
                  {t(language, TOUR_BAR_STOP_COPY_KEY[item] as I18nKey)}
                </Text>
              ))}
            </View>
          ) : (
            <Text style={[styles.body, { color: co.ink }]}>{body}</Text>
          )}
          <View style={styles.footer}>
            <Pressable
              accessibilityRole="button"
              onPress={finish}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={({ pressed }) => [styles.skip, pressed && styles.pressed]}
            >
              <Text style={[styles.skipText, { color: co.muted }]}>{t(language, 'tour.skip')}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={advance}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              style={({ pressed }) => [pressed && styles.pressed]}
            >
              <CutSurface size="sm" fill={accent} style={styles.nextButton}>
                <Text style={[styles.nextText, { color: accentInk }]}>{t(language, isLast ? 'tour.done' : 'tour.next')}</Text>
              </CutSurface>
            </Pressable>
          </View>
        </CutSurface>
        <View
          pointerEvents="none"
          style={[
            styles.notch,
            { left: notchX - 7, backgroundColor: co.surface },
            placement.above ? styles.notchDown : styles.notchUp,
          ]}
        />
      </Animated.View>
    </View>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  ring: {
    position: 'absolute',
  },
  calloutWrap: {
    position: 'absolute',
    shadowColor: '#0B0714',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.34,
    shadowRadius: 26,
    elevation: 12,
  },
  callout: {
    paddingTop: 13,
    paddingRight: 15,
    paddingBottom: 12,
    paddingLeft: 26,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 9,
  },
  counter: {
    fontFamily: 'JetBrainsMono',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  title: {
    fontSize: 14.5,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  body: {
    fontSize: 13.5,
    fontWeight: '600',
    lineHeight: 20,
    marginTop: 6,
  },
  stopList: {
    gap: 2,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 10,
  },
  // A text link, but a 44 dp target: the padding and hitSlop together clear
  // the minimum even though the underline stays small.
  skip: {
    paddingVertical: 10,
    minHeight: 40,
    justifyContent: 'center',
  },
  skipText: {
    fontSize: 12.5,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  nextButton: {
    height: 36,
    minWidth: 92,
    paddingHorizontal: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextText: {
    fontSize: 12.5,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.8,
  },
  // The little triangle that points at the target. Rotated square, so it
  // takes the callout's fill without a second SVG.
  notch: {
    position: 'absolute',
    width: 14,
    height: 14,
    transform: [{ rotate: '45deg' }],
  },
  notchUp: {
    top: -5,
  },
  notchDown: {
    bottom: -5,
  },
  unused: {
    color: theme.ink,
  },
});
