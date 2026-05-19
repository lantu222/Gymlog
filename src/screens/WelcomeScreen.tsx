import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Rect } from 'react-native-svg';

import { PrimaryCTAButton } from '../components/PrimaryCTAButton';
import { spacing } from '../theme';
import { AppLanguage } from '../types/models';

const PURPLE = '#7F77DD';
const BACKGROUND = '#080815';
const PANEL = '#1D1C35';

interface WelcomeScreenProps {
  language: AppLanguage;
  onContinue: () => void;
  onSignIn?: () => void;
}

const FEATURES = [
  {
    icon: 'brain',
    title: 'AI-BUILT PLANS',
    body: 'Smart programs built for you.',
  },
  {
    icon: 'progress',
    title: 'ADAPTIVE PROGRESSION',
    body: 'We adjust as you improve.',
  },
  {
    icon: 'recovery',
    title: 'RECOVERY AWARE',
    body: 'Optimized training and recovery.',
  },
] as const;

function FeatureIcon({ name }: { name: (typeof FEATURES)[number]['icon'] }) {
  return (
    <View style={styles.featureIconRing}>
      <Svg width={28} height={28} viewBox="0 0 34 34" fill="none">
        {name === 'brain' ? (
          <>
            <Path
              d="M14 8.2c-2.2-1.1-5 .5-5 3.3-2.2.4-3.8 2.2-3.8 4.4 0 1.7.9 3.1 2.2 3.9-.5 2.6 1.4 5 4.1 5 .9 0 1.8-.3 2.5-.8V8.2Z"
              stroke={PURPLE}
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Path
              d="M20 8.2c2.2-1.1 5 .5 5 3.3 2.2.4 3.8 2.2 3.8 4.4 0 1.7-.9 3.1-2.2 3.9.5 2.6-1.4 5-4.1 5-.9 0-1.8-.3-2.5-.8V8.2Z"
              stroke={PURPLE}
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Path d="M10.5 15.1h3.5M9.9 20.1h4.1M20 15.1h3.5M20 20.1h4.1" stroke={PURPLE} strokeWidth={2.2} strokeLinecap="round" />
          </>
        ) : null}
        {name === 'progress' ? (
          <>
            <Rect x={7} y={18} width={4.4} height={9} rx={1.2} stroke={PURPLE} strokeWidth={2.2} />
            <Rect x={15} y={12.5} width={4.4} height={14.5} rx={1.2} stroke={PURPLE} strokeWidth={2.2} />
            <Rect x={23} y={7} width={4.4} height={20} rx={1.2} stroke={PURPLE} strokeWidth={2.2} />
            <Path d="M6.8 14.6 13 9.8" stroke={PURPLE} strokeWidth={2.2} strokeLinecap="round" />
          </>
        ) : null}
        {name === 'recovery' ? (
          <Path
            d="M4.8 17h6l2.6-7.2 5 15 3-7.8h7.8"
            stroke={PURPLE}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
      </Svg>
    </View>
  );
}

export function WelcomeScreen({ onContinue, onSignIn }: WelcomeScreenProps) {
  const insets = useSafeAreaInsets();
  const actionOpacity = useRef(new Animated.Value(0)).current;
  const actionTranslateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
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
  }, [actionOpacity, actionTranslateY]);

  return (
    <View style={styles.screen}>
      <View style={[styles.content, { paddingTop: insets.top + spacing.xl }]}>
        <View style={styles.brandBlock}>
          <View style={styles.brandNameRow}>
            <Text style={styles.brandNameWhite}>G</Text>
            <Text style={styles.brandNamePurple}>AI</Text>
            <Text style={styles.brandNameWhite}>NER</Text>
          </View>
          <Text style={styles.tagline}>{'You go to the gym.\nWe handle the rest.'}</Text>
        </View>

        <Animated.View
          style={[
            styles.bottomPanel,
            { paddingBottom: insets.bottom + spacing.lg },
            {
              opacity: actionOpacity,
              transform: [{ translateY: actionTranslateY }],
            },
          ]}
        >
          <View pointerEvents="none" style={styles.panelSlant} />
          <View style={styles.featureRow}>
            {FEATURES.map((feature, index) => (
              <View key={feature.title} style={styles.featureItem}>
                <FeatureIcon name={feature.icon} />
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureBody}>{feature.body}</Text>
                {index < FEATURES.length - 1 ? <View style={styles.featureDivider} /> : null}
              </View>
            ))}
          </View>

          <View style={styles.actionStack}>
            <PrimaryCTAButton title="Start free" onPress={onContinue} style={styles.welcomeCTAButton} />

            <Pressable onPress={onSignIn ?? onContinue} style={styles.signInLink}>
              <Text style={styles.signInLinkText}>I already have an account</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BACKGROUND,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
  },
  brandBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
  },
  brandNameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: spacing.lg,
  },
  brandNameWhite: {
    color: '#FFFFFF',
    fontSize: 74,
    lineHeight: 78,
    fontWeight: '900',
    letterSpacing: 0,
  },
  brandNamePurple: {
    color: PURPLE,
    fontSize: 74,
    lineHeight: 78,
    fontWeight: '900',
    letterSpacing: 0,
  },
  tagline: {
    color: 'rgba(222, 218, 245, 0.72)',
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '600',
    textAlign: 'center',
    maxWidth: 300,
  },
  bottomPanel: {
    minHeight: 274,
    paddingHorizontal: spacing.xl,
    paddingTop: 64,
    paddingBottom: spacing.xl,
    backgroundColor: PANEL,
    overflow: 'hidden',
  },
  panelSlant: {
    position: 'absolute',
    top: -46,
    left: -40,
    right: -40,
    height: 84,
    backgroundColor: BACKGROUND,
    transform: [{ rotate: '-5deg' }],
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  featureItem: {
    flex: 1,
    alignItems: 'center',
    minHeight: 112,
    paddingHorizontal: 6,
  },
  featureIconRing: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 1.4,
    borderColor: PURPLE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    backgroundColor: 'rgba(127, 119, 221, 0.05)',
  },
  featureTitle: {
    color: PURPLE,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '900',
    textAlign: 'center',
    minHeight: 26,
  },
  featureBody: {
    color: 'rgba(222, 218, 245, 0.74)',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    textAlign: 'center',
    maxWidth: 98,
  },
  featureDivider: {
    position: 'absolute',
    right: 0,
    top: 38,
    width: 1,
    height: 58,
    backgroundColor: 'rgba(222, 218, 245, 0.18)',
  },
  actionStack: {
    alignItems: 'center',
    gap: spacing.md,
  },
  welcomeCTAButton: {
    width: '100%',
    maxWidth: 360,
  },
  signInLink: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  signInLinkText: {
    color: 'rgba(222, 218, 245, 0.64)',
    fontSize: 16,
    fontWeight: '700',
  },
});
