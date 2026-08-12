import React, { useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Svg, { ClipPath, Defs, G, LinearGradient as SvgLinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { t } from '../lib/i18n';
import { HomePromoSlide } from '../lib/homePromoSlides';
import { SEASON_COLORS } from '../lib/season';
import { SEASON_JOIN_WINDOW_DAYS } from '../lib/seasonEnrolment';
import { Theme, useThemedStyles } from '../theming';
import { AppLanguage } from '../types/models';

/**
 * The strip under "Aloita treeni" (design: GAINER Kausikaruselli).
 *
 * Rounded, not cut: the A3 cut corner is the app's button-and-surface language,
 * and a season card is a poster — the design draws it as a 24 px radius with a
 * watermark behind it, and the two shapes fight each other on one screen.
 *
 * Each slide is built from state that is true right now — see
 * lib/homePromoSlides — so this file only has to render them. It renders
 * nothing at all when there is nothing true to say, rather than keeping a
 * placeholder card warm.
 */

/** Painted per slide kind; seasons carry their own two colours. */
const SLIDE_PAINT: Record<string, readonly [string, string]> = {
  program: ['#6B7FE0', '#1D2C7E'],
  goal: ['#249A5F', '#014D19'],
};

const RADIUS = 24;
const CARD_HEIGHT = 214;
const GAP = 12;

/**
 * How full the bar is.
 *
 * A running season fills as it is spent. A coming one fills as it approaches,
 * so the bar is "how close is this" and not "how long until you can stop
 * waiting" — an empty bar 40 days out that stays empty says nothing.
 */
function trackRatio(season: NonNullable<HomePromoSlide['season']>): number {
  if (season.state === 'running') {
    return season.progress;
  }
  return Math.max(0, Math.min(1, 1 - season.daysUntilStart / SEASON_JOIN_WINDOW_DAYS));
}

function paintFor(slide: HomePromoSlide): readonly [string, string] {
  if (slide.season) {
    return SEASON_COLORS[slide.season.season];
  }
  return SLIDE_PAINT[slide.kind] ?? SLIDE_PAINT.program;
}

/**
 * Home's content column is padded 20. The rail has to run edge to edge or the
 * next card cannot peek, so it steps back out of that padding and re-applies
 * its own — passed in rather than assumed, because a rail that silently
 * assumed 20 would break the day Home changed its gutter.
 */
interface HomePromoCarouselProps {
  /** The horizontal padding of the container this sits in. */
  gutter: number;
  slides: HomePromoSlide[];
  language: AppLanguage;
  /** The card body and its primary button do the same thing. */
  onPress: (slide: HomePromoSlide) => void;
  /** The ghost button beside it — only the season card has one. */
  onPressSecondary: (slide: HomePromoSlide) => void;
}

export function HomePromoCarousel({
  gutter,
  slides,
  language,
  onPress,
  onPressSecondary,
}: HomePromoCarouselProps) {
  const styles = useThemedStyles(makeStyles);
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);

  if (slides.length === 0) {
    return null;
  }

  // A peek of the next card, so the rail reads as swipeable without an arrow.
  const cardWidth = Math.min(340, width - gutter * 2 - 34);
  const step = cardWidth + GAP;

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / step);
    setIndex(Math.max(0, Math.min(slides.length - 1, next)));
  };

  return (
    <View style={{ marginHorizontal: -gutter }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.row, { paddingHorizontal: gutter }]}
        snapToInterval={step}
        decelerationRate="fast"
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {slides.map((slide) => {
          const paint = paintFor(slide);
          const gid = `promo-${slide.id}`.replace(/[^a-zA-Z0-9-]/g, '');
          const season = slide.season;
          return (
            <Pressable
              key={slide.id}
              accessibilityRole="button"
              onPress={() => onPress(slide)}
              style={({ pressed }) => [pressed && styles.pressed]}
            >
              <View style={[styles.card, { width: cardWidth }]}>
                {/* Clipped INSIDE the svg: on Android a child of an svg walks
                    straight out of the parent's overflow:hidden, so the
                    watermark would draw over the card next to it. */}
                <Svg width={cardWidth} height={CARD_HEIGHT} style={StyleSheet.absoluteFill}>
                  <Defs>
                    <SvgLinearGradient id={`${gid}-g`} x1="0" y1="0" x2="0.75" y2="1">
                      <Stop offset="0" stopColor={paint[0]} />
                      <Stop offset="1" stopColor={paint[1]} />
                    </SvgLinearGradient>
                    <ClipPath id={`${gid}-c`}>
                      <Rect x="0" y="0" width={cardWidth} height={CARD_HEIGHT} rx={RADIUS} ry={RADIUS} />
                    </ClipPath>
                  </Defs>
                  <G clipPath={`url(#${gid}-c)`}>
                    <Rect x="0" y="0" width={cardWidth} height={CARD_HEIGHT} fill={`url(#${gid}-g)`} />
                    <Rect
                      x={cardWidth - 76}
                      y={-64}
                      width={132}
                      height={132}
                      rx={22}
                      ry={22}
                      fill="none"
                      stroke="#FFFFFF"
                      strokeOpacity={0.1}
                      strokeWidth={12}
                      origin={`${cardWidth - 10}, 2`}
                      rotation={45}
                    />
                  </G>
                </Svg>

                <View style={[styles.badge, slide.badgeTone === 'ghost' && styles.badgeGhost]}>
                  {slide.badgeTone === 'solid' ? (
                    <Svg viewBox="0 0 24 24" width={9} height={9}>
                      <Path
                        d="M12 5a7 7 0 100 14 7 7 0 000-14z"
                        fill="none"
                        stroke={paint[1]}
                        strokeWidth={4}
                      />
                    </Svg>
                  ) : null}
                  <Text
                    style={[styles.badgeText, slide.badgeTone === 'ghost' && styles.badgeTextGhost, { color: slide.badgeTone === 'solid' ? paint[1] : '#FFFFFF' }]}
                    numberOfLines={1}
                  >
                    {t(language, slide.badgeKey, slide.badgeVars)}
                  </Text>
                </View>

                {/* The title sits on the floor of the card, the way the design
                    draws it — everything above it is a spacer. */}
                <View style={styles.spacer} />

                <Text style={styles.title} numberOfLines={1}>
                  {slide.titleKey ? t(language, slide.titleKey) : slide.title ?? ''}
                </Text>
                {slide.subtitle || slide.subtitleKey ? (
                  <Text style={styles.subtitle} numberOfLines={2}>
                    {slide.subtitle ?? t(language, slide.subtitleKey!, slide.subtitleVars)}
                  </Text>
                ) : null}

                {/* Both season states share one shape: a bar, then two labels
                    under it. The coming season used to carry a counter box
                    with its own lead word instead, which made a third block in
                    a card that already had four — and the two cards, swiped
                    one after the other, did not look like the same object.

                    The bar is what each season has to show: how much of the
                    window is behind you, or how much of the run-up is. */}
                {season ? (
                  <>
                    <View style={styles.track}>
                      <View
                        style={[
                          styles.trackFill,
                          { width: `${Math.round(trackRatio(season) * 100)}%` },
                          season.state === 'upcoming' && styles.trackFillPending,
                        ]}
                      />
                    </View>
                    <View style={styles.metaRow}>
                      <Text style={styles.meta} numberOfLines={1}>
                        {season.state === 'running'
                          ? t(language, 'season.weeksLeft', { count: season.weeksLeft })
                          : t(language, 'home.promo.season.opensIn', { count: season.daysUntilStart })}
                      </Text>
                      <Text style={styles.meta} numberOfLines={1}>
                        {season.state === 'running'
                          ? t(language, 'home.promo.season.pointsUntil', { date: season.endLabel })
                          : t(language, 'home.promo.season.length', { count: season.weeksLeft })}
                      </Text>
                    </View>
                  </>
                ) : null}

                <View style={styles.ctaRow}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => onPress(slide)}
                    style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
                  >
                    <Text style={[styles.primaryText, { color: paint[1] }]} numberOfLines={1}>
                      {t(language, slide.ctaKey)}
                    </Text>
                  </Pressable>
                  {slide.secondaryCtaKey ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => onPressSecondary(slide)}
                      style={({ pressed }) => [styles.ghost, pressed && styles.pressed]}
                    >
                      <Text style={styles.ghostText} numberOfLines={1}>
                        {t(language, slide.secondaryCtaKey)}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {slides.length > 1 ? (
        <View style={styles.dots}>
          {slides.map((slide, dot) => (
            <View
              key={slide.id}
              style={[
                styles.dot,
                dot === index && styles.dotOn,
                dot === index && { backgroundColor: paintFor(slide)[0] },
              ]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  row: {
    gap: GAP,
    paddingTop: 14,
  },
  pressed: {
    opacity: 0.85,
  },
  card: {
    height: CARD_HEIGHT,
    borderRadius: RADIUS,
    overflow: 'hidden',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 18,
  },
  spacer: {
    flex: 1,
  },
  // Fixed white on a painted card, the same rule the programme heroes follow.
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.94)',
  },
  badgeGhost: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.42)',
  },
  badgeText: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  badgeTextGhost: {
    color: '#FFFFFF',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 27,
    lineHeight: 30,
    fontWeight: '800',
    letterSpacing: -0.7,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '700',
    marginTop: 5,
  },
  track: {
    height: 7,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.24)',
    marginTop: 12,
    overflow: 'hidden',
  },
  trackFill: {
    height: 7,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
  },
  // A season that has not opened has not been trained, so its bar is not the
  // same white as one you have been filling by showing up.
  trackFillPending: {
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    marginTop: 7,
  },
  meta: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: 14,
  },
  primary: {
    height: 38,
    paddingHorizontal: 15,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
  },
  ghost: {
    height: 38,
    paddingHorizontal: 13,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.34)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostText: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
    marginTop: 11,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 4,
    backgroundColor: theme.border,
  },
  dotOn: {
    width: 18,
  },
});
