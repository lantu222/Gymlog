import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { getMondayFirstWeekdayLabels } from '../lib/homeCalendar';
import { removeTrailingZeros } from '../lib/format';
import { t } from '../lib/i18n';
import { readableOn, Theme, useTheme, useThemedStyles } from '../theming';
import { AppLanguage } from '../types/models';

/**
 * The three panels at the top of the set screen.
 *
 * This slot used to be a still photo and nothing else. A photo answers "what
 * does this look like", which is a question you have once and never again by
 * the third set — while the question you actually have, standing at the rack,
 * is "what did I lift last time". Both live here now, with the exercise's
 * instructions behind them, and the panel that opens first is the one that has
 * something to say: last time when there is history, the photo when there is
 * not. Design: "GAINER Sarjaruudun paneelit", built 2026-08-21.
 *
 * Arrows and dots rather than swipe alone. A draggable was killed once in this
 * app by a parent Pressable eating the gesture, and a panel you cannot reach is
 * worse than a panel that needs two taps — the swipe is an addition here, not
 * the only way through.
 */

export interface SetPanelSet {
  /** 1-based, as the reader counts them. */
  setIndex: number;
  loadKg: number;
  reps: number;
  /** The heaviest set of that session — drawn in the accent. */
  isRecord?: boolean;
}

export interface SetPanelHistory {
  /** ISO timestamp of the session those sets were logged in. */
  performedAt: string;
  sets: SetPanelSet[];
  /**
   * These sets were done under a different slot — another day of the
   * programme, another programme, an empty workout. Shown, because the weight
   * on the dial comes from here too, but labelled: "last time" on this slot
   * and "last time anywhere" are different claims.
   */
  borrowed?: boolean;
}

interface SetPanelsProps {
  height: number;
  language: AppLanguage;
  /** Null when this lift has never been logged. */
  history: SetPanelHistory | null;
  /** Already localized. Empty means the instructions panel is not offered. */
  instructions: string[];
  /** The photo, when the library has one. Absent means no photo panel at all. */
  imageUrl: string | null;
  /** Two initials, for the panel that has no photo to fall back on. */
  initials: string;
}

type PanelKind = 'history' | 'image' | 'instructions';

/** "ti 12.8." — the app's own weekday letters, lowercased, and a bare date. */
function formatSessionDate(iso: string, language: AppLanguage): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const weekdayIndex = date.getDay() === 0 ? 6 : date.getDay() - 1;
  const weekday = (getMondayFirstWeekdayLabels(language)[weekdayIndex] ?? '').toLowerCase();
  return `${weekday} ${date.getDate()}.${date.getMonth() + 1}.`;
}

export function SetPanels({ height, language, history, instructions, imageUrl, initials }: SetPanelsProps) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const scroller = useRef<ScrollView>(null);
  // Which panels exist at all. A panel with nothing in it is not a choice, and
  // a dot that leads to an empty screen is worse than one dot fewer.
  const panels = useMemo<PanelKind[]>(() => {
    const kinds: PanelKind[] = ['history'];
    if (imageUrl) {
      kinds.push('image');
    }
    if (instructions.length > 0) {
      kinds.push('instructions');
    }
    return kinds;
  }, [imageUrl, instructions.length]);

  // The panel that opens is the one with something to say. Applied once per
  // exercise rather than held in state, so moving to the next lift re-asks.
  const opening = history && history.sets.length > 0 ? 0 : Math.min(panels.indexOf('image'), panels.length - 1);
  const openedFor = useRef<string | null>(null);
  // Whether the opening panel has been scrolled to yet.
  const settled = useRef(false);
  const signature = `${initials}|${imageUrl ?? ''}|${history?.performedAt ?? ''}`;
  if (openedFor.current !== signature) {
    openedFor.current = signature;
    settled.current = false;
    if (index !== Math.max(0, opening)) {
      setIndex(Math.max(0, opening));
    }
  }

  // The opening panel has to be scrolled to, not just chosen. Width is 0 on
  // the first render, so the choice landed in state and nowhere else — the dots
  // said one thing, the deck showed another, and the first arrow tap jumped two
  // panels because it counted from the state.
  const goTo = (next: number) => {
    const clamped = Math.max(0, Math.min(panels.length - 1, next));
    setIndex(clamped);
    scroller.current?.scrollTo({ x: clamped * width, animated: true });
  };

  const onMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width <= 0) {
      return;
    }
    setIndex(Math.round(event.nativeEvent.contentOffset.x / width));
  };

  // The chrome sits on the photo as often as on a card, and a muted grey on a
  // dark gym photo is not readable.
  const over = panels[index] === 'image';

  return (
    <View
      style={[styles.frame, { height }]}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumEnd}
        // Scrolled here rather than from an effect on width: an effect fires
        // before the children have been laid out at that width, so the jump
        // landed on a zero-width content box and did nothing — the dots said
        // "photo" while the deck still showed "last time".
        onContentSizeChange={(contentWidth) => {
          if (settled.current || width <= 0 || contentWidth < width * panels.length) {
            return;
          }
          settled.current = true;
          if (index > 0) {
            scroller.current?.scrollTo({ x: index * width, animated: false });
          }
        }}
        scrollEventThrottle={16}
      >
        {panels.map((kind) => (
          <View key={kind} style={{ width, height }}>
            {kind === 'history' ? (
              <HistoryPanel history={history} language={language} styles={styles} theme={theme} />
            ) : null}
            {kind === 'image' && imageUrl ? (
              <ImagePanel imageUrl={imageUrl} initials={initials} styles={styles} />
            ) : null}
            {kind === 'instructions' ? (
              <InstructionsPanel
                steps={instructions}
                language={language}
                styles={styles}
                theme={theme}
              />
            ) : null}
          </View>
        ))}
      </ScrollView>

      {panels.length > 1 ? (
        <View pointerEvents="box-none" style={styles.chrome}>
          <Chevron
            direction="left"
            faded={index === 0}
            over={over}
            theme={theme}
            styles={styles}
            label={t(language, 'panels.a11y.previous')}
            onPress={() => goTo(index - 1)}
          />
          <View style={styles.dots}>
            {panels.map((kind, dot) => (
              <Pressable
                key={kind}
                accessibilityRole="button"
                accessibilityState={{ selected: dot === index }}
                accessibilityLabel={t(language, PANEL_LABEL_KEYS[kind])}
                hitSlop={10}
                onPress={() => goTo(dot)}
                style={[
                  styles.dot,
                  dot === index && styles.dotActive,
                  over && (dot === index ? styles.dotActiveOver : styles.dotOver),
                ]}
              />
            ))}
          </View>
          <Chevron
            direction="right"
            faded={index === panels.length - 1}
            over={over}
            theme={theme}
            styles={styles}
            label={t(language, 'panels.a11y.next')}
            onPress={() => goTo(index + 1)}
          />
        </View>
      ) : null}
    </View>
  );
}

const PANEL_LABEL_KEYS = {
  history: 'panels.last.title',
  image: 'panels.image.title',
  instructions: 'panels.how.title',
} as const;

function Chevron({
  direction,
  faded,
  over,
  theme,
  styles,
  label,
  onPress,
}: {
  direction: 'left' | 'right';
  faded: boolean;
  over: boolean;
  theme: Theme;
  styles: ReturnType<typeof makeStyles>;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={faded}
      hitSlop={8}
      onPress={onPress}
      style={[styles.chevron, over && styles.chevronOver, faded && styles.chevronFaded]}
    >
      <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
        <Path
          d={direction === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'}
          stroke={over ? '#FFFFFF' : theme.highlight}
          strokeWidth={2.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </Pressable>
  );
}

function PanelHead({
  title,
  right,
  styles,
}: {
  title: string;
  right?: string;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.head}>
      <Text style={styles.headTitle}>{title}</Text>
      {right ? <Text style={styles.headRight}>{right}</Text> : null}
    </View>
  );
}

function HistoryPanel({
  history,
  language,
  styles,
  theme,
}: {
  history: SetPanelHistory | null;
  language: AppLanguage;
  styles: ReturnType<typeof makeStyles>;
  theme: Theme;
}) {
  if (!history || history.sets.length === 0) {
    return (
      <View style={styles.panel}>
        <PanelHead title={t(language, 'panels.last.title')} styles={styles} />
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path
                d="M12 7.5V12l3 2M3.6 9.4A8.6 8.6 0 1 1 3 12M3 5.5V9.4h3.9"
                stroke={theme.purpleBright}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>
          <Text style={styles.emptyTitle}>{t(language, 'panels.last.emptyTitle')}</Text>
          <Text style={styles.emptyBody}>{t(language, 'panels.last.emptyBody')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.panel}>
      <PanelHead
        title={t(language, history.borrowed ? 'panels.last.titleBorrowed' : 'panels.last.title')}
        right={formatSessionDate(history.performedAt, language)}
        styles={styles}
      />
      <View style={styles.columns}>
        <Text style={[styles.columnLabel, styles.colSet]}>{t(language, 'panels.last.colSet')}</Text>
        <Text style={[styles.columnLabel, styles.colValue]}>{t(language, 'panels.last.colLoad')}</Text>
        <Text style={[styles.columnLabel, styles.colValue]}>{t(language, 'panels.last.colReps')}</Text>
        <View style={styles.colBadge} />
      </View>
      <View style={styles.rows}>
        {history.sets.map((set) => (
          <View key={set.setIndex} style={[styles.row, set.isRecord && styles.rowRecord]}>
            <Text style={[styles.rowIndex, styles.colSet, set.isRecord && styles.rowInkRecord]}>
              {set.setIndex}
            </Text>
            <Text style={[styles.rowValue, styles.colValue, set.isRecord && styles.rowInkRecord]}>
              {removeTrailingZeros(set.loadKg)}
              <Text style={[styles.rowUnit, set.isRecord && styles.rowInkRecord]}> kg</Text>
            </Text>
            <Text style={[styles.rowValue, styles.colValue, set.isRecord && styles.rowInkRecord]}>
              {set.reps}
            </Text>
            <View style={styles.colBadge}>
              {set.isRecord ? (
                <Text style={styles.recordBadge}>{t(language, 'panels.last.record')}</Text>
              ) : null}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function ImagePanel({
  imageUrl,
  initials,
  styles,
}: {
  imageUrl: string;
  initials: string;
  styles: ReturnType<typeof makeStyles>;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <View style={styles.imageFallback}>
        <Text style={styles.imageFallbackText}>{initials}</Text>
      </View>
    );
  }

  return (
    <View style={styles.imageWrap}>
      <Image
        source={{ uri: imageUrl }}
        resizeMode="cover"
        onError={() => setFailed(true)}
        style={styles.image}
      />
      {/* The chrome sits on whatever the photo happens to be. A gym floor is
          light as often as dark, so the strip under the dots is darkened
          rather than the glyphs being guessed at. */}
      <View style={styles.scrim} pointerEvents="none">
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="setPanelScrim" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#0A0616" stopOpacity={0} />
              <Stop offset="1" stopColor="#0A0616" stopOpacity={0.5} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#setPanelScrim)" />
        </Svg>
      </View>
    </View>
  );
}

function InstructionsPanel({
  steps,
  language,
  styles,
  theme,
}: {
  steps: string[];
  language: AppLanguage;
  styles: ReturnType<typeof makeStyles>;
  theme: Theme;
}) {
  return (
    <View style={styles.panel}>
      <PanelHead
        title={t(language, 'panels.how.title')}
        right={t(language, 'panels.how.steps', { count: steps.length })}
        styles={styles}
      />
      {/* The bar is on. This panel has always scrolled; with the indicator
          hidden and the fade over the last line, a long first step read as
          text that had been cut off rather than text you could reach — the
          reader asked for scrolling it already had (#bugs 2026-08-26). */}
      <ScrollView
        style={styles.stepScroll}
        contentContainerStyle={styles.stepList}
        showsVerticalScrollIndicator
        persistentScrollbar
      >
        {steps.map((step, order) => (
          <View key={`${order}-${step.slice(0, 12)}`} style={styles.step}>
            <Text style={styles.stepNumber}>{order + 1}</Text>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}
      </ScrollView>
      {/* RN has no mask-image, so the fade is the panel's own colour drawn back
          over the text — which is what a mask would have done anyway. */}
      <View style={styles.stepFade} pointerEvents="none">
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="setPanelFade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={theme.surface} stopOpacity={0} />
              <Stop offset="1" stopColor={theme.surface} stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#setPanelFade)" />
        </Svg>
      </View>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    frame: {
      width: '100%',
      overflow: 'hidden',
      backgroundColor: theme.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    panel: {
      flex: 1,
      backgroundColor: theme.surface,
    },
    chrome: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: 40,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
    },
    chevron: {
      // Bigger, filled and outlined in something you can see. A 26 px circle
      // with a hairline border in border-grey is a control the reader has to
      // hunt for, and this one is next to text they are trying to read
      // (#bugs 2026-08-26, "nuolia on vaikea nähdä").
      width: 32,
      height: 32,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: theme.highlight,
      backgroundColor: theme.highlightSoft,
    },
    chevronOver: {
      borderWidth: 0,
      backgroundColor: 'rgba(12, 8, 26, 0.34)',
    },
    chevronFaded: {
      opacity: 0.32,
    },
    dots: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 999,
      backgroundColor: theme.faint,
    },
    dotActive: {
      // A pill, not a bigger circle: the active panel reads as "you are here"
      // rather than as a fourth choice.
      width: 17,
      backgroundColor: theme.purpleBright,
    },
    dotOver: {
      backgroundColor: 'rgba(255, 255, 255, 0.45)',
    },
    dotActiveOver: {
      backgroundColor: '#FFFFFF',
    },
    head: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      paddingHorizontal: 18,
      paddingTop: 14,
    },
    headTitle: {
      fontSize: 14.5,
      fontWeight: '800',
      letterSpacing: -0.3,
      color: theme.ink,
    },
    headRight: {
      fontSize: 11.5,
      fontWeight: '700',
      color: theme.faint,
    },
    columns: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 18,
      paddingTop: 9,
      paddingBottom: 4,
    },
    columnLabel: {
      fontSize: 9.5,
      fontWeight: '800',
      letterSpacing: 1.2,
      color: theme.faint,
      textTransform: 'uppercase',
    },
    colSet: {
      width: 42,
    },
    colValue: {
      flex: 1,
    },
    colBadge: {
      width: 62,
      alignItems: 'flex-end',
    },
    rows: {
      flex: 1,
      minHeight: 0,
      gap: 3,
      paddingHorizontal: 12,
      paddingBottom: 40,
    },
    row: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 6,
      borderRadius: 11,
    },
    rowRecord: {
      backgroundColor: theme.purpleLight,
    },
    rowIndex: {
      fontSize: 13,
      fontWeight: '800',
      color: theme.faint,
    },
    rowValue: {
      fontSize: 17,
      fontWeight: '800',
      letterSpacing: -0.3,
      color: theme.ink,
    },
    rowUnit: {
      fontSize: 11.5,
      fontWeight: '800',
      color: theme.faint,
    },
    rowInkRecord: {
      color: theme.purpleDark,
    },
    recordBadge: {
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: 0.8,
      color: readableOn(theme.purpleBright),
      backgroundColor: theme.purpleBright,
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 999,
      overflow: 'hidden',
    },
    empty: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 9,
      paddingHorizontal: 44,
      paddingBottom: 30,
    },
    emptyIcon: {
      width: 40,
      height: 40,
      borderRadius: 13,
      backgroundColor: theme.purpleLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyTitle: {
      fontSize: 14.5,
      fontWeight: '800',
      letterSpacing: -0.3,
      color: theme.ink,
      textAlign: 'center',
    },
    emptyBody: {
      fontSize: 12.5,
      fontWeight: '600',
      lineHeight: 19,
      color: theme.muted,
      textAlign: 'center',
    },
    imageWrap: {
      flex: 1,
      backgroundColor: theme.surfaceSoft,
    },
    image: {
      width: '100%',
      height: '100%',
    },
    scrim: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: 76,
    },
    imageFallback: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surfaceSoft,
    },
    imageFallbackText: {
      fontSize: 64,
      fontWeight: '800',
      letterSpacing: 2,
      color: theme.faint,
    },
    stepScroll: {
      flex: 1,
      minHeight: 0,
    },
    stepList: {
      gap: 10,
      paddingHorizontal: 18,
      paddingTop: 10,
      // Clear of the chrome with room to spare: a line half-hidden behind the
      // dots is a line you try to read and cannot.
      paddingBottom: 72,
    },
    step: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 11,
    },
    stepNumber: {
      width: 21,
      height: 21,
      borderRadius: 999,
      overflow: 'hidden',
      textAlign: 'center',
      lineHeight: 21,
      backgroundColor: theme.purpleLight,
      color: theme.purpleDark,
      fontSize: 11,
      fontWeight: '800',
    },
    stepText: {
      flex: 1,
      fontSize: 12.5,
      fontWeight: '600',
      lineHeight: 18,
      color: theme.muted,
    },
    stepFade: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: 76,
    },
  });
