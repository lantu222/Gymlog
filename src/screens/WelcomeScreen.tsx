import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppLanguage } from '../types/models';
import { spacing } from '../theme';

interface WelcomeScreenProps {
  language: AppLanguage;
  onContinue: () => void;
}

const copy = {
  en: {
    setupHint: 'Build your plan.\nTrack your progress.',
    continueLabel: 'Get started',
  },
  fi: {
    setupHint: 'Rakenna ohjelma.\nSeuraa kehitysta.',
    continueLabel: 'Aloitetaan',
  },
} as const;

export function WelcomeScreen({ language, onContinue }: WelcomeScreenProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const content = copy[language];
  const actionOpacity = useRef(new Animated.Value(0)).current;
  const actionTranslateX = useRef(new Animated.Value(-12)).current;
  const orbSize = Math.max(430, Math.min(width * 1.45, 560));
  const orbTop = insets.top + 34;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(actionOpacity, {
        toValue: 1,
        duration: 460,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(actionTranslateX, {
        toValue: 0,
        duration: 800,
        easing: Easing.out(Easing.exp),
        useNativeDriver: true,
      }),
    ]).start();
  }, [actionOpacity, actionTranslateX]);

  return (
    <View style={styles.screen}>
      <View
        style={[
          styles.topOrb,
          {
            width: orbSize,
            height: orbSize,
            borderRadius: orbSize / 2,
            top: orbTop - orbSize * 0.52,
            left: (width - orbSize) / 2,
          },
        ]}
      >
      </View>

      <View style={[styles.content, { paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={styles.brandBlock}>
          <Text style={styles.brandTitle}>GYMLOG</Text>
          <Text style={styles.setupHint}>{content.setupHint}</Text>
        </View>

        <Animated.View
          style={[
            styles.actionStack,
            {
              opacity: actionOpacity,
              transform: [{ translateX: actionTranslateX }],
            },
          ]}
        >
          <Pressable onPress={onContinue} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>{content.continueLabel}</Text>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  topOrb: {
    position: 'absolute',
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    justifyContent: 'space-between',
  },
  brandBlock: {
    alignItems: 'center',
    paddingTop: 452,
  },
  brandTitle: {
    color: '#000000',
    fontSize: 64,
    lineHeight: 68,
    fontWeight: '900',
    letterSpacing: -2.2,
    marginBottom: spacing.xl,
  },
  setupHint: {
    color: 'rgba(0,0,0,0.74)',
    fontSize: 21,
    lineHeight: 28,
    fontWeight: '700',
    textAlign: 'center',
    maxWidth: 320,
  },
  actionStack: {
    alignItems: 'center',
    paddingBottom: spacing.xl,
  },
  primaryButton: {
    width: '100%',
    maxWidth: 360,
    minHeight: 62,
    borderRadius: 18,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 5,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
});
