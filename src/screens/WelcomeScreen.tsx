import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFonts } from 'expo-font';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { AppLanguage } from '../types/models';

// Light design tokens (HG palette from the redesign handoff).
const BG = '#F7F3FF';
const SURFACE = '#FFFFFF';
const INK = '#101828';
const MUTED = '#667085';
const BORDER = '#E4D8FF';
const PURPLE = '#7C3AED';
const PURPLE_DARK = '#5B21B6';

interface WelcomeScreenProps {
  language: AppLanguage;
  onContinue: () => void;
  onSignIn?: () => void;
}

const FEATURES = [
  {
    icon: 'dumbbell',
    title: 'AI-built plans',
    body: 'Smart programs built for you.',
  },
  {
    icon: 'trend',
    title: 'Adaptive',
    body: 'We adjust as you improve.',
  },
  {
    icon: 'heart',
    title: 'Recovery aware',
    body: 'Optimized training & rest.',
  },
] as const;

function FeatureIcon({ name }: { name: (typeof FEATURES)[number]['icon'] }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      {name === 'dumbbell' ? (
        <Path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10" stroke={PURPLE} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      ) : null}
      {name === 'trend' ? (
        <Path d="M4 18l5-6 4 3 7-9" stroke={PURPLE} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      ) : null}
      {name === 'heart' ? (
        <Path
          d="M12 20s-7-4.5-7-9a4 4 0 017-2.5A4 4 0 0119 11c0 4.5-7 9-7 9z"
          stroke={PURPLE}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
    </Svg>
  );
}

export function WelcomeScreen({ onContinue, onSignIn }: WelcomeScreenProps) {
  const insets = useSafeAreaInsets();
  const [manropeLoaded] = useFonts({ Manrope: require('../../assets/fonts/Manrope.ttf') });
  const fontFamily = manropeLoaded ? 'Manrope' : undefined;
  const actionOpacity = useRef(new Animated.Value(0)).current;
  const actionTranslateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (cancelled) {
        return;
      }
      if (reduceMotion) {
        actionOpacity.setValue(1);
        actionTranslateY.setValue(0);
        return;
      }
      Animated.parallel([
        Animated.timing(actionOpacity, {
          toValue: 1,
          duration: 520,
          delay: 120,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(actionTranslateY, {
          toValue: 0,
          duration: 700,
          delay: 120,
          easing: Easing.out(Easing.exp),
          useNativeDriver: true,
        }),
      ]).start();
    });
    return () => {
      cancelled = true;
    };
  }, [actionOpacity, actionTranslateY]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom + 22 }]}>
      <View style={styles.hero}>
        <View style={styles.logoRow}>
          <Text style={[styles.logoText, styles.logoInk, { fontFamily }]}>G</Text>
          <Text style={[styles.logoText, styles.logoPurple, { fontFamily }]}>AI</Text>
          <Text style={[styles.logoText, styles.logoInk, { fontFamily }]}>NER</Text>
        </View>
        <Text style={[styles.tagline, { fontFamily }]}>{'You go to the gym.\nWe handle the rest.'}</Text>
      </View>

      <Animated.View style={{ opacity: actionOpacity, transform: [{ translateY: actionTranslateY }] }}>
        <View style={styles.featureRow}>
          {FEATURES.map((feature) => (
            <View key={feature.title} style={styles.featureItem}>
              <View style={styles.featureIconRing}>
                <FeatureIcon name={feature.icon} />
              </View>
              <Text style={[styles.featureTitle, { fontFamily }]}>{feature.title}</Text>
              <Text style={[styles.featureBody, { fontFamily }]}>{feature.body}</Text>
            </View>
          ))}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Start free"
          onPress={onContinue}
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
        >
          <Text style={[styles.ctaLabel, { fontFamily }]}>Start free</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="I already have an account"
          onPress={onSignIn ?? onContinue}
          style={({ pressed }) => [styles.signInLink, pressed && styles.signInLinkPressed]}
        >
          <Text style={[styles.signInText, { fontFamily }]}>I already have an account</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG,
    paddingHorizontal: 24,
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  logoText: {
    fontSize: 52,
    lineHeight: 52,
    fontWeight: '800',
    letterSpacing: -1.04,
  },
  logoInk: {
    color: INK,
  },
  logoPurple: {
    color: PURPLE,
  },
  tagline: {
    color: MUTED,
    fontSize: 18,
    lineHeight: 25,
    fontWeight: '700',
    textAlign: 'center',
  },
  featureRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  featureItem: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  featureIconRing: {
    width: 52,
    height: 52,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: BORDER,
    backgroundColor: SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTitle: {
    color: PURPLE_DARK,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 0.66,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  featureBody: {
    color: MUTED,
    fontSize: 11.5,
    lineHeight: 15.5,
    fontWeight: '600',
    textAlign: 'center',
  },
  cta: {
    height: 56,
    borderRadius: 18,
    backgroundColor: PURPLE,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: PURPLE,
    shadowOpacity: 0.32,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 14 },
    elevation: 10,
  },
  ctaPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  ctaLabel: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.17,
  },
  signInLink: {
    alignSelf: 'center',
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  signInLinkPressed: {
    opacity: 0.7,
  },
  signInText: {
    color: MUTED,
    fontSize: 14.5,
    fontWeight: '700',
    textAlign: 'center',
  },
});
