import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { ProMomentContent } from '../lib/proInsights';
import { formatWeight } from '../lib/format';
import { t } from '../lib/i18n';
import { PW } from '../lightTheme';
import { Theme, useThemedStyles } from '../theming';
import { AppLanguage } from '../types/models';

/**
 * The contextual paywall sheet (pw-shared.jsx): one benefit, the same topic as
 * the trigger, built on the user's own numbers. Deliberately NO comparison
 * table — that belongs to the full Pro page this sheet's CTA opens.
 *
 * The CTA is honest: billing is not live, so it says what Pro does and routes
 * to the Pro page instead of promising a trial that does not exist.
 */
interface ProMomentSheetProps {
  visible: boolean;
  content: ProMomentContent | null;
  language: AppLanguage;
  onClose: () => void;
  onSeePro: () => void;
}

export function ProMomentSheet({ visible, content, language, onClose, onSeePro }: ProMomentSheetProps) {
  const styles = useThemedStyles(makeStyles);
  const slide = useRef(new Animated.Value(0)).current;
  const slideTranslate = useRef(slide.interpolate({ inputRange: [0, 1], outputRange: [420, 0] })).current;

  useEffect(() => {
    if (!visible) {
      slide.setValue(0);
      return;
    }
    Animated.timing(slide, {
      toValue: 1,
      duration: 380,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: true,
    }).start();
  }, [slide, visible]);

  if (!content) {
    return null;
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose}>
        <Animated.View style={{ transform: [{ translateY: slideTranslate }] }}>
          <Pressable onPress={() => undefined} style={styles.sheet}>
            <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
              <Defs>
                <SvgLinearGradient id="pwSheetGradient" x1="0" y1="0" x2="0.4" y2="1">
                  <Stop offset="0" stopColor={PW.sheetTop} />
                  <Stop offset="0.62" stopColor={PW.sheetMid} />
                  <Stop offset="1" stopColor={PW.sheetBottom} />
                </SvgLinearGradient>
              </Defs>
              <Rect width="100%" height="100%" rx={28} fill="url(#pwSheetGradient)" />
            </Svg>

            <View style={styles.grip} />
            <View style={styles.eyebrowRow}>
              <Svg width={16} height={16} viewBox="0 0 24 24">
                <Path d="M12 2l2.2 5.8L20 10l-5.8 2.2L12 18l-2.2-5.8L4 10l5.8-2.2z" fill={PW.sheetLavender} />
              </Svg>
              <Text style={styles.eyebrow}>{content.eyebrow}</Text>
            </View>
            <Text style={styles.title}>{content.title}</Text>
            <Text style={styles.lead}>{content.lead}</Text>

            <View style={styles.chartCard}>
              <BarsBlock content={content} language={language} />
            </View>

            <View style={styles.bullets}>
              {content.bullets.map((bullet) => (
                <View key={bullet} style={styles.bulletRow}>
                  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                    <Path d="M5 13l4 4L19 7" stroke={PW.sheetMint} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                  <Text style={styles.bulletText}>{bullet}</Text>
                </View>
              ))}
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={onSeePro}
              style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
            >
              <Text style={styles.ctaText}>{t(language, 'pro.sheet.cta')}</Text>
            </Pressable>
            <Text style={styles.fine}>{t(language, 'pro.sheet.fine')}</Text>
            <Pressable accessibilityRole="button" onPress={onClose} hitSlop={8}>
              <Text style={styles.notNow}>{t(language, 'pro.sheet.notNow')}</Text>
            </Pressable>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

/** Bars extracted so the language threading stays simple. */
function BarsBlock({ content, language }: { content: ProMomentContent; language: AppLanguage }) {
  const styles = useThemedStyles(makeStyles);

  const values = content.bars;
  const all = content.nextValue === null ? values : [...values, content.nextValue];
  if (all.length === 0) {
    return null;
  }
  const max = Math.max(...all);
  const min = Math.min(...all) - 8;
  const height = (value: number) => Math.max(8, ((value - min) / Math.max(1, max - min)) * 74);

  return (
    <View>
      <Text style={styles.barLabel}>{content.barLabel}</Text>
      <View style={styles.barRow}>
        {values.map((value, index) => (
          <View key={index} style={styles.barCol}>
            <View style={[styles.bar, { height: height(value) }]} />
          </View>
        ))}
        {content.nextValue !== null ? (
          <View style={styles.barCol}>
            <Text style={styles.nextValueText}>{formatWeight(content.nextValue, 'kg')}</Text>
            <View style={[styles.bar, styles.barNext, { height: height(content.nextValue) }]} />
          </View>
        ) : null}
      </View>
      <View style={styles.barCaptionRow}>
        {values.map((value, index) => (
          <Text key={index} style={styles.barCaption}>
            {formatWeight(value, 'kg').replace(/\s*kg$/, '')}
          </Text>
        ))}
        {content.nextValue !== null ? (
          <Text style={[styles.barCaption, styles.barCaptionNext]}>{t(language, 'pro.sheet.nextBar')}</Text>
        ) : null}
      </View>
    </View>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(16,10,32,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 22,
  },
  grip: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.3,
    color: PW.sheetLavender,
  },
  title: {
    fontSize: 25,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 30,
    marginTop: 10,
  },
  lead: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.72)',
    lineHeight: 21,
    marginTop: 9,
  },
  chartCard: {
    marginTop: 18,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  barLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 1,
    color: 'rgba(255,255,255,0.5)',
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 7,
    height: 100,
    marginTop: 12,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  bar: {
    width: '100%',
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  barNext: {
    backgroundColor: 'rgba(201,182,255,0.16)',
    borderWidth: 1.5,
    borderColor: 'rgba(201,182,255,0.9)',
    borderStyle: 'dashed',
  },
  nextValueText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: PW.sheetLavender,
  },
  barCaptionRow: {
    flexDirection: 'row',
    gap: 7,
    marginTop: 7,
  },
  barCaption: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.45)',
  },
  barCaptionNext: {
    color: PW.sheetLavender,
    fontWeight: '800',
  },
  bullets: {
    marginTop: 16,
    gap: 9,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bulletText: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.9)',
  },
  cta: {
    marginTop: 18,
    height: 54,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.88,
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#2A1A4E',
  },
  fine: {
    fontSize: 11.5,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 17,
  },
  notNow: {
    fontSize: 14,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginTop: 14,
  },
});
