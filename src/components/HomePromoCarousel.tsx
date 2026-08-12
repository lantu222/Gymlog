import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { CutSurface } from './CutSurface';
import { t } from '../lib/i18n';
import { HomePromoSlide } from '../lib/homePromoSlides';
import { spacing } from '../theme';
import { Theme, useThemedStyles } from '../theming';
import { AppLanguage } from '../types/models';

/**
 * The strip under "Aloita treeni".
 *
 * Each slide is built from state that is true right now — see
 * lib/homePromoSlides — so this file only has to render them. It renders
 * nothing at all when there is nothing true to say, rather than keeping a
 * placeholder card warm.
 */

/** Painted per slide kind, so the three are told apart before they are read. */
const SLIDE_PAINT: Record<string, [string, string]> = {
  season: ['#0B93BD', '#02466E'],
  program: ['#6B7FE0', '#1D2C7E'],
  goal: ['#249A5F', '#014D19'],
};

interface HomePromoCarouselProps {
  slides: HomePromoSlide[];
  language: AppLanguage;
  onPress: (slide: HomePromoSlide) => void;
}

export function HomePromoCarousel({ slides, language, onPress }: HomePromoCarouselProps) {
  const styles = useThemedStyles(makeStyles);
  const { width } = useWindowDimensions();

  if (slides.length === 0) {
    return null;
  }

  // One and a bit visible, so the strip reads as swipeable without a dot row
  // taking a line of its own.
  const cardWidth = Math.min(300, width - spacing.lg * 2 - 34);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      snapToInterval={cardWidth + 10}
      decelerationRate="fast"
    >
      {slides.map((slide) => {
        const paint = SLIDE_PAINT[slide.kind] ?? SLIDE_PAINT.program;
        const gid = `promo-${slide.kind}`;
        return (
          <Pressable
            key={slide.kind}
            accessibilityRole="button"
            onPress={() => onPress(slide)}
            style={({ pressed }) => [pressed && styles.pressed]}
          >
            <CutSurface size="lg" fill={paint[1]} style={[styles.card, { width: cardWidth }]}>
              <Svg width={cardWidth} height={CARD_HEIGHT} style={StyleSheet.absoluteFill}>
                <Defs>
                  <SvgLinearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0" stopColor={paint[0]} />
                    <Stop offset="1" stopColor={paint[1]} />
                  </SvgLinearGradient>
                </Defs>
                <Rect x="0" y="0" width={cardWidth} height={CARD_HEIGHT} fill={`url(#${gid})`} />
              </Svg>
              <Text style={styles.eyebrow}>{t(language, slide.eyebrowKey)}</Text>
              {slide.title ? (
                <Text style={styles.title} numberOfLines={1}>
                  {slide.title}
                </Text>
              ) : null}
              <Text style={styles.body} numberOfLines={slide.title ? 2 : 3}>
                {t(language, slide.bodyKey, slide.bodyVars)}
              </Text>
              <View style={styles.ctaRow}>
                <Text style={styles.cta}>{t(language, slide.ctaKey)}</Text>
                <Svg viewBox="0 0 24 24" width={15} height={15}>
                  <Path
                    d="M5 12h14M13 6l6 6-6 6"
                    stroke="#FFFFFF"
                    strokeWidth={2.4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </Svg>
              </View>
            </CutSurface>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const CARD_HEIGHT = 138;

const makeStyles = (theme: Theme) => StyleSheet.create({
  row: {
    paddingHorizontal: spacing.lg,
    gap: 10,
    paddingTop: 14,
  },
  pressed: {
    transform: [{ scale: 0.985 }],
  },
  card: {
    height: CARD_HEIGHT,
    paddingHorizontal: 15,
    paddingVertical: 13,
    justifyContent: 'space-between',
  },
  // Fixed white on a painted card, the same rule the programme heroes follow.
  eyebrow: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 10.5,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 1,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginTop: 3,
  },
  body: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '600',
    marginTop: 4,
    flex: 1,
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  cta: {
    color: '#FFFFFF',
    fontSize: 13.5,
    lineHeight: 18,
    fontWeight: '800',
  },
});
