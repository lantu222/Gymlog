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

function GoogleMark() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
        fill="#4285F4"
      />
      <Path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0012 23z"
        fill="#34A853"
      />
      <Path
        d="M5.84 14.1A6.6 6.6 0 015.5 12c0-.73.13-1.43.34-2.1V7.07H2.18a11 11 0 000 9.87l3.66-2.85z"
        fill="#FBBC05"
      />
      <Path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 002.18 7.07L5.84 9.9C6.71 7.31 9.14 5.38 12 5.38z"
        fill="#EA4335"
      />
    </Svg>
  );
}

function AppleMark() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="#000000">
      <Path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8.98-.2 1.92-.86 3.05-.78 1.39.11 2.44.66 3.13 1.66-2.88 1.73-2.2 5.53.44 6.59-.53 1.39-1.21 2.76-2.7 4.7zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </Svg>
  );
}

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
          accessibilityLabel="Continue with Google"
          onPress={onContinue}
          style={({ pressed }) => [styles.providerButton, pressed && styles.providerButtonPressed]}
        >
          <GoogleMark />
          <Text style={[styles.providerLabel, { fontFamily }]}>Continue with Google</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Continue with Apple"
          onPress={onContinue}
          style={({ pressed }) => [styles.providerButton, pressed && styles.providerButtonPressed]}
        >
          <AppleMark />
          <Text style={[styles.providerLabel, { fontFamily }]}>Continue with Apple</Text>
        </Pressable>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={[styles.dividerText, { fontFamily }]}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sign up with email"
          onPress={onContinue}
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
        >
          <Text style={[styles.ctaLabel, { fontFamily }]}>Sign up with email</Text>
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
    fontSize: 64,
    lineHeight: 64,
    fontWeight: '800',
    letterSpacing: -1.28,
  },
  logoInk: {
    color: INK,
  },
  logoPurple: {
    color: PURPLE,
  },
  tagline: {
    color: INK,
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
    color: INK,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  providerButton: {
    height: 54,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: BORDER,
    backgroundColor: SURFACE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 10,
  },
  providerButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  providerLabel: {
    color: INK,
    fontSize: 15.5,
    fontWeight: '800',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
    marginBottom: 14,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: BORDER,
  },
  dividerText: {
    color: MUTED,
    fontSize: 12.5,
    fontWeight: '700',
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
    color: INK,
    fontSize: 14.5,
    fontWeight: '700',
    textAlign: 'center',
  },
});
