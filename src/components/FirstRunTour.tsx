import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';

import { measureNode, TourTargetRegistry } from '../features/tour/tourTargets';
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
  TourRect,
  TourSurface,
  TourBeat,
  tourStartDelayMs,
} from '../lib/firstRunTour';
import { I18nKey, t } from '../lib/i18n';
import { useTheme, useThemeName } from '../theming';
import { AppLanguage } from '../types/models';
import { queryReduceMotion } from '../utils/reduceMotion';
import { CutButton } from './CutButton';
import { CutSurface } from './CutSurface';
import { EASE_RISE } from './vinhaMotion';

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

/** Brand mark on the bar, not copy: the button itself says "AI". */
const AI_MARK = 'AI';

const STOP_TITLE_KEY: Record<Exclude<TourBarStop, 'ai'>, I18nKey> = {
  home: 'tabs.home',
  programs: 'tabs.programs',
  progress: 'tabs.progress',
  profile: 'tabs.profile',
};

interface FirstRunTourProps {
  surface: TourSurface;
  /** Memoised by the parent: effects here key on the index, not the array. */
  beats: TourBeat[];
  registry: TourTargetRegistry;
  language: AppLanguage;
  /** The bar's highlight follows the sweep; null hands it back to the route. */
  onSweep: (stop: TourBarStop | null) => void;
  /**
   * Done, skipped, or left mid-way: the surface is marked seen either way.
   * Leaving early is not failure, and the app gets out of the way.
   */
  onFinish: (surface: TourSurface) => void;
}

interface Origin {
  x: number;
  y: number;
}

export function FirstRunTour({ surface, beats, registry, language, onSweep, onFinish }: FirstRunTourProps) {
  const theme = useTheme();
  const themeName = useThemeName();

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
  /** Set when a beat's rect lands; the enter animation starts once it is drawn. */
  const pendingShowRef = useRef<boolean | null>(null);

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

  const measureOrigin = useCallback(async (): Promise<Origin> => {
    const measured = await measureNode(rootRef.current);
    if (measured) {
      originRef.current = { x: measured.x, y: measured.y };
    }
    return originRef.current;
  }, []);

  const toLocal = (window: TourRect, origin: Origin): TourRect => ({
    x: window.x - origin.x,
    y: window.y - origin.y,
    width: window.width,
    height: window.height,
  });

  const finish = useCallback(() => {
    if (finishedRef.current) {
      return;
    }
    finishedRef.current = true;
    onSweep(null);
    setPhase('done');
    onFinish(surface);
  }, [onFinish, onSweep, surface]);

  // Leaving mid-tour — a tab press, a workout started — still counts as seen,
  // but only once a callout has actually been on screen. Leaving during the
  // start delay or the first scroll (PR #83 review) showed nothing, and a
  // reader who flicks through the tabs on their first open would otherwise
  // burn all three tours without seeing one. Through refs, so a re-created
  // callback can never fire this early.
  const shownRef = useRef(false);
  const finishRef = useRef(finish);
  finishRef.current = finish;
  useEffect(
    () => () => {
      if (shownRef.current) {
        finishRef.current();
      }
    },
    [],
  );

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

  const stepTo = useCallback(
    (next: number) => {
      if (next >= beats.length) {
        finish();
        return;
      }
      setRect(null);
      setStopIndex(0);
      setIndex(next);
    },
    [beats.length, finish],
  );

  // A section beat: bring the target into the band, measure it once the
  // scroll has settled, then show. A target this install does not have
  // (no cards pinned, say) is skipped rather than pointed at.
  useEffect(() => {
    if (phase !== 'beat' || reduceMotion === null) {
      return;
    }
    const beat = beats[index];
    if (!beat) {
      finish();
      return;
    }
    if (beat.kind !== 'section') {
      return;
    }
    let cancelled = false;
    void (async () => {
      await registry.scrollIntoView(surface, beat.target, beat.place, !reduceMotion);
      const [targetRect, origin, pill] = await Promise.all([
        registry.measure(beat.target),
        measureOrigin(),
        registry.measure('bar.pill'),
      ]);
      if (cancelled) {
        return;
      }
      if (!targetRect) {
        stepTo(index + 1);
        return;
      }
      setBarTop(pill ? pill.y - origin.y : null);
      pendingShowRef.current = !reduceMotion;
      setRect(toLocal(targetRect, origin));
    })();
    return () => {
      cancelled = true;
    };
    // `beats` is memoised by the parent; the effect keys on the index.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, index, reduceMotion]);

  // The bar beat: one sweep. Each stop lights the bar's own highlight, moves
  // the ring, and — unless motion is reduced or this is the last stop —
  // schedules the next. The button steps it by hand as well.
  useEffect(() => {
    if (phase !== 'beat' || reduceMotion === null) {
      return;
    }
    const beat = beats[index];
    if (!beat || beat.kind !== 'bar') {
      return;
    }
    const stop = beat.stops[stopIndex];
    if (!stop) {
      return;
    }
    let cancelled = false;
    onSweep(stop);
    void (async () => {
      const [targetRect, origin, pill] = await Promise.all([
        registry.measure(`bar.${stop}`),
        measureOrigin(),
        registry.measure('bar.pill'),
      ]);
      if (cancelled) {
        return;
      }
      if (!targetRect) {
        stepTo(index + 1);
        return;
      }
      setBarTop(pill ? pill.y - origin.y : null);
      if (stopIndex === 0) {
        pendingShowRef.current = !reduceMotion;
      }
      setRect(toLocal(targetRect, origin));
    })();
    const last = stopIndex >= beat.stops.length - 1;
    const timer = reduceMotion || last ? null : setTimeout(() => setStopIndex((current) => current + 1), BAR_SWEEP_STOP_MS);
    return () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, index, stopIndex, reduceMotion]);

  // The enter animation starts after the callout is on screen, never before:
  // a native-driver timing started on a value no view is attached to yet is
  // the kind of thing that works on one renderer and not the other.
  useEffect(() => {
    if (!rect || pendingShowRef.current === null) {
      return;
    }
    const animated = pendingShowRef.current;
    pendingShowRef.current = null;
    shownRef.current = true;
    if (!animated) {
      calloutAnim.setValue(1);
      ringAnim.setValue(1);
      return;
    }
    calloutAnim.setValue(0);
    ringAnim.setValue(0);
    Animated.parallel([
      Animated.timing(calloutAnim, { toValue: 1, duration: CALLOUT_ENTER_MS, easing: EASE_RISE, useNativeDriver: true }),
      Animated.timing(ringAnim, { toValue: 1, duration: RING_ENTER_MS, easing: EASE_RISE, useNativeDriver: true }),
    ]).start();
  }, [calloutAnim, rect, ringAnim]);

  // The page under the tour stays scrollable; the ring follows its target.
  useEffect(() => {
    if (phase !== 'beat') {
      return;
    }
    const beat = beats[index];
    if (!beat || beat.kind !== 'section') {
      return;
    }
    const target = beat.target;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    const unsubscribe = registry.subscribeScroll(() => {
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        void (async () => {
          const [targetRect, origin] = await Promise.all([registry.measure(target), measureOrigin()]);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, index, registry, measureOrigin]);

  const advance = useCallback(() => {
    if (phase !== 'beat') {
      return;
    }
    const beat = beats[index];
    if (!beat) {
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
  }, [beats, calloutAnim, index, phase, reduceMotion, ringAnim, stepTo, stopIndex]);

  const onRootLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width !== size.width || height !== size.height) {
      setSize({ width, height });
    }
    void measureOrigin();
  };

  const beat = beats[index] ?? null;
  if (phase !== 'beat' || !beat || !rect || size.width === 0) {
    return <View ref={rootRef} pointerEvents="box-none" style={StyleSheet.absoluteFill} onLayout={onRootLayout} />;
  }

  const isBar = beat.kind === 'bar';
  const stop = isBar ? beat.stops[stopIndex] ?? null : null;
  const shape = isBar ? (stop === 'ai' ? 'bar-ai' : 'bar') : 'section';
  const ring = ringBox(rect, shape);
  const anchor = isBar ? ring : rect;
  const calloutWidth = size.width - CALLOUT_SIDE_INSET * 2;
  const placement = placeCallout({
    target: anchor,
    calloutHeight: calloutHeight || 120,
    screenHeight: size.height,
    barTop,
    prefer: isBar ? 'above' : beat.place,
  });
  const notchX = notchOffset(anchor, CALLOUT_SIDE_INSET, calloutWidth);
  const listAllStops = isBar && reduceMotion === true;
  const isLast = index + 1 >= beats.length && (!isBar || listAllStops || stopIndex >= beat.stops.length - 1);

  // In light, the callout is the app's own dark-violet layer — the Pro sheets'
  // and the coach's — with the ink those sheets use on it. In dark it lifts.
  const co = themeName === 'dark'
    ? { surface: theme.purpleLight, ink: theme.ink, muted: theme.muted }
    : { surface: theme.proSheetTop, ink: '#FFFFFF', muted: 'rgba(255,255,255,0.72)' };
  const accent = theme.highlight;
  const title = stop ? (stop === 'ai' ? AI_MARK : t(language, STOP_TITLE_KEY[stop])) : null;
  const body = isBar ? (stop ? t(language, TOUR_BAR_STOP_COPY_KEY[stop]) : '') : t(language, beat.copyKey);

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
          <G transform="translate(8 8)">
            {shape === 'section' ? (
              <>
                <Path d={cutCornerPath(ring.width, ring.height, 20)} fill="none" stroke={theme.highlightSoft} strokeWidth={7} />
                <Path d={cutCornerPath(ring.width, ring.height, 20)} fill="none" stroke={accent} strokeWidth={2} />
              </>
            ) : (
              // The bar's own highlight is already under this item; the ring
              // is the line only, not a second halo.
              <Circle cx={ring.width / 2} cy={ring.height / 2} r={ring.width / 2 - 1} fill="none" stroke={accent} strokeWidth={2} />
            )}
          </G>
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
                  {t(language, TOUR_BAR_STOP_COPY_KEY[item])}
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
            <CutButton size="md" variant="accent" label={t(language, isLast ? 'tour.done' : 'tour.next')} onPress={advance} />
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

const styles = StyleSheet.create({
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
});
