import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Path, Polyline, RadialGradient, Rect, Stop } from 'react-native-svg';

import { I18nKey, t } from '../lib/i18n';
import { PW } from '../lightTheme';
import { Theme, useTheme, useThemedStyles } from '../theming';
import { layout } from '../theme';
import { AppLanguage } from '../types/models';

/**
 * What happens the moment Premium turns on (design: GAINER Premium Unlock).
 *
 * No confetti, no trophy, no mascot. The celebration is the product switching
 * on: the wordmark locks in, then the thing they actually bought — the
 * next-load call — demonstrates itself. About 1.6s, then it hands over to a
 * single screen naming what changed and where to find it.
 *
 * Every line on that screen is checked against the code. The mock's third card
 * said "14 months of logs are back", which would mean history had been taken
 * away; it never was, in either tier. That card is the reads instead, which are
 * genuinely gated.
 */

interface PremiumUnlockScreenProps {
  language?: AppLanguage;
  /** Where "Back to my workout" goes — usually wherever they came from. */
  onDone: () => void;
  onOpenLogger: () => void;
  /**
   * ISO date the trial would end. The app has no billing, so this is the demo
   * story the paywall already tells; releaseReadiness.test.cjs holds the other
   * end of it.
   */
  trialEndsAt: string;
}

const CARDS: Array<{ titleKey: I18nKey; bodyKey: I18nKey; toKey: I18nKey }> = [
  // Each of these is genuinely gated in the app — see the audit note on
  // PremiumScreen's GROUPS.
  { titleKey: 'unlock.c1.t', bodyKey: 'unlock.c1.b', toKey: 'unlock.c1.to' },
  { titleKey: 'unlock.c2.t', bodyKey: 'unlock.c2.b', toKey: 'unlock.c2.to' },
  { titleKey: 'unlock.c3.t', bodyKey: 'unlock.c3.b', toKey: 'unlock.c3.to' },
  { titleKey: 'unlock.c4.t', bodyKey: 'unlock.c4.b', toKey: 'unlock.c4.to' },
];

/** How long the moment holds before the screen behind it takes over. */
const MOMENT_MS = 2200;

function formatTrialDate(iso: string, language: AppLanguage) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const day = date.getDate();
  const month = date.getMonth() + 1;
  return language === 'fi' ? `${day}.${month}.` : `${day}/${month}`;
}

function Spark({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 2l2.2 5.8L20 10l-5.8 2.2L12 18l-2.2-5.8L4 10l5.8-2.2z" fill={color} />
    </Svg>
  );
}

function Check({ color, size = 17 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 13l4 4L19 7" stroke={color} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/**
 * Board ① — the unlock moment.
 *
 * A dark violet field, a glow that expands once, the wordmark, and the
 * next-set call arriving underneath it. Reduced motion skips straight to the
 * settled state: the content must never be what the animation is hiding.
 */
function Moment({ language, reduceMotion }: { language: AppLanguage; reduceMotion: boolean }) {
  const styles = useThemedStyles(makeStyles);
  // A percentage-sized Svg does not stretch to a flex parent on Android — it
  // renders at whatever it measured first and leaves a hard edge where the
  // gradient stops. This app has paid for that once already (the Workout
  // Complete hero), so the field is measured and given pixel dimensions.
  const [field, setField] = useState<{ width: number; height: number } | null>(null);
  const glow = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const rise = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const card = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reduceMotion) {
      return;
    }
    Animated.stagger(180, [
      Animated.timing(glow, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(rise, {
        toValue: 1,
        duration: 520,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
        useNativeDriver: true,
      }),
      Animated.timing(card, {
        toValue: 1,
        duration: 520,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
        useNativeDriver: true,
      }),
    ]).start();
  }, [card, glow, reduceMotion, rise]);

  // Interpolated once — a per-render .interpolate() leaks native animated nodes
  // (the disconnectAnimatedNodes crash this app already paid for).
  const glowScale = useRef(glow.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.9] })).current;
  const glowOpacity = useRef(glow.interpolate({ inputRange: [0, 0.45, 1], outputRange: [0, 0.9, 0] })).current;
  const riseY = useRef(rise.interpolate({ inputRange: [0, 1], outputRange: [14, 0] })).current;
  const cardY = useRef(card.interpolate({ inputRange: [0, 1], outputRange: [16, 0] })).current;

  return (
    <View
      style={styles.moment}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setField((current) =>
          current && current.width === width && current.height === height ? current : { width, height },
        );
      }}
    >
      {field ? (
        <Svg style={StyleSheet.absoluteFill} width={field.width} height={field.height}>
          <Defs>
            <RadialGradient id="unlockField" cx="50%" cy="34%" r="120%">
              <Stop offset="0" stopColor="#4A2398" />
              <Stop offset="0.52" stopColor="#2A1650" />
              <Stop offset="1" stopColor="#150C28" />
            </RadialGradient>
          </Defs>
          <Rect width={field.width} height={field.height} fill="url(#unlockField)" />
        </Svg>
      ) : null}

      <Animated.View
        pointerEvents="none"
        style={[styles.glow, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]}
      />

      <Animated.View style={[styles.momentCopy, { opacity: rise, transform: [{ translateY: riseY }] }]}>
        <Text style={styles.momentMark}>GAINER</Text>
        <Text style={styles.momentTier}>{t(language, 'unlock.premium')}</Text>
        <Text style={styles.momentLine}>{t(language, 'unlock.coachOn')}</Text>
        <Text style={styles.momentSub}>{t(language, 'unlock.coachOnSub')}</Text>
      </Animated.View>

      {/* The bought thing, demonstrating itself. */}
      <Animated.View style={[styles.momentCard, { opacity: card, transform: [{ translateY: cardY }] }]}>
        <View style={styles.momentCardHead}>
          <Text style={styles.momentCardLabel}>{t(language, 'unlock.nextSet')}</Text>
          <View style={styles.momentPill}>
            <Svg width={9} height={9} viewBox="0 0 12 12">
              <Path d="M6 3l4 5H2z" fill="#7DEBB4" />
            </Svg>
            <Text style={styles.momentPillText}>+2,5 kg</Text>
          </View>
        </View>
        <Svg width="100%" height={34} viewBox="0 0 260 34">
          <Polyline
            points="0,28 40,25 80,20 120,17 160,12 200,9 232,5"
            fill="none"
            stroke={PW.sheetLavender}
            strokeWidth={2.4}
            strokeLinecap="round"
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

export function PremiumUnlockScreen({
  language = 'en',
  onDone,
  onOpenLogger,
  trialEndsAt,
}: PremiumUnlockScreenProps) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const [showMoment, setShowMoment] = useState(true);

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

  // Auto-advance. Reduced motion gets a much shorter hold — there is nothing
  // to watch, so holding the screen would just be a delay.
  useEffect(() => {
    if (reduceMotion === null) {
      return;
    }
    const timer = setTimeout(() => setShowMoment(false), reduceMotion ? 700 : MOMENT_MS);
    return () => clearTimeout(timer);
  }, [reduceMotion]);

  const trialDate = useMemo(() => formatTrialDate(trialEndsAt, language), [language, trialEndsAt]);

  if (reduceMotion === null) {
    // One frame of the settled background rather than a flash of the light
    // screen before the moment starts.
    return <View style={styles.momentPlaceholder} />;
  }

  if (showMoment) {
    return (
      // Tapping skips: a celebration you cannot dismiss is a modal.
      <Pressable accessibilityRole="button" onPress={() => setShowMoment(false)} style={styles.momentPress}>
        <Moment language={language} reduceMotion={reduceMotion} />
      </Pressable>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.activeRow}>
          <View style={styles.activeDot}>
            <Check color="#FFFFFF" size={15} />
          </View>
          <Text style={styles.activeLabel}>{t(language, 'unlock.active')}</Text>
        </View>

        <Text style={styles.title}>{t(language, 'unlock.title')}</Text>
        <Text style={styles.lead}>{t(language, 'unlock.lead')}</Text>

        <View style={styles.cards}>
          {CARDS.map((card) => (
            <View key={card.titleKey} style={styles.card}>
              <View style={styles.cardHead}>
                <Check color={theme.purple} />
                <Text style={styles.cardTitle}>{t(language, card.titleKey)}</Text>
              </View>
              <Text style={styles.cardBody}>{t(language, card.bodyKey)}</Text>
              <Text style={styles.cardTo}>{t(language, card.toKey)}</Text>
            </View>
          ))}
        </View>

        {/* The trial end date up front — the thing that kills a day-7 surprise
            cancel. There is no billing yet; see PremiumScreen's CTA note. */}
        <View style={styles.trial}>
          <Text style={styles.trialTitle}>{t(language, 'unlock.trialTitle', { date: trialDate })}</Text>
          <Text style={styles.trialBody}>{t(language, 'unlock.trialBody')}</Text>
        </View>

        <Text style={styles.noBadge}>{t(language, 'unlock.noBadge')}</Text>
      </ScrollView>

      <View style={styles.ctaBar}>
        <Pressable
          accessibilityRole="button"
          onPress={onOpenLogger}
          style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
        >
          <Text style={styles.ctaText}>{t(language, 'unlock.back')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onDone} hitSlop={8}>
          <Text style={styles.later}>{t(language, 'unlock.later')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: theme.bg,
    },
    momentPress: {
      flex: 1,
    },
    momentPlaceholder: {
      flex: 1,
      backgroundColor: '#150C28',
    },
    moment: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 30,
      backgroundColor: '#150C28',
    },
    glow: {
      position: 'absolute',
      top: '22%',
      width: 300,
      height: 300,
      borderRadius: 999,
      backgroundColor: 'rgba(180,140,255,0.30)',
    },
    momentCopy: {
      alignItems: 'center',
      marginTop: -60,
    },
    momentMark: {
      fontSize: 40,
      fontWeight: '800',
      letterSpacing: -1.2,
      color: '#FFFFFF',
    },
    momentTier: {
      fontSize: 12.5,
      fontWeight: '800',
      letterSpacing: 5,
      color: PW.sheetLavender,
      marginTop: 10,
    },
    momentLine: {
      fontSize: 15,
      fontWeight: '700',
      color: 'rgba(255,255,255,0.82)',
      marginTop: 26,
    },
    momentSub: {
      fontSize: 13,
      fontWeight: '600',
      color: 'rgba(255,255,255,0.55)',
      marginTop: 6,
    },
    momentCard: {
      position: 'absolute',
      left: 26,
      right: 26,
      bottom: 96,
      backgroundColor: 'rgba(255,255,255,0.09)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.16)',
      borderRadius: 18,
      paddingVertical: 14,
      paddingHorizontal: 15,
    },
    momentCardHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    momentCardLabel: {
      fontSize: 10.5,
      fontWeight: '800',
      letterSpacing: 0.9,
      color: 'rgba(255,255,255,0.55)',
    },
    momentPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'rgba(55,208,138,0.22)',
      paddingVertical: 3,
      paddingHorizontal: 8,
      borderRadius: 999,
    },
    momentPillText: {
      fontSize: 11,
      fontWeight: '800',
      color: '#7DEBB4',
    },
    content: {
      paddingHorizontal: 20,
      paddingTop: 10,
      paddingBottom: 20,
    },
    activeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    activeDot: {
      width: 26,
      height: 26,
      borderRadius: 999,
      backgroundColor: theme.green,
      alignItems: 'center',
      justifyContent: 'center',
    },
    activeLabel: {
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 1.2,
      color: theme.green,
    },
    title: {
      fontSize: 27,
      fontWeight: '800',
      letterSpacing: -0.7,
      color: theme.ink,
      marginTop: 14,
      lineHeight: 31,
    },
    lead: {
      fontSize: 13.5,
      fontWeight: '600',
      color: theme.muted,
      marginTop: 8,
      lineHeight: 20,
    },
    cards: {
      gap: 10,
      marginTop: 20,
    },
    card: {
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 16,
      paddingVertical: 14,
      paddingHorizontal: 15,
    },
    cardHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
    },
    cardTitle: {
      fontSize: 15,
      fontWeight: '800',
      color: theme.ink,
      flexShrink: 1,
    },
    cardBody: {
      fontSize: 12.5,
      fontWeight: '600',
      color: theme.muted,
      marginTop: 5,
      lineHeight: 18.5,
      paddingLeft: 26,
    },
    cardTo: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.7,
      color: theme.highlight,
      marginTop: 8,
      paddingLeft: 26,
    },
    trial: {
      marginTop: 18,
      backgroundColor: theme.surfaceSoft,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 16,
      paddingVertical: 13,
      paddingHorizontal: 15,
    },
    trialTitle: {
      fontSize: 13.5,
      fontWeight: '800',
      color: theme.ink,
    },
    trialBody: {
      fontSize: 11.5,
      fontWeight: '600',
      color: theme.muted,
      marginTop: 6,
      lineHeight: 17,
    },
    noBadge: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.faint,
      marginTop: 18,
      lineHeight: 19,
    },
    ctaBar: {
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: layout.bottomTabBarReserve,
      backgroundColor: theme.surface,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    cta: {
      height: 54,
      borderRadius: 16,
      backgroundColor: theme.highlight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ctaText: {
      fontSize: 16.5,
      fontWeight: '800',
      color: theme.onHighlight,
    },
    later: {
      fontSize: 12.5,
      fontWeight: '700',
      color: theme.muted,
      textAlign: 'center',
      marginTop: 11,
    },
    pressed: {
      opacity: 0.9,
    },
  });
