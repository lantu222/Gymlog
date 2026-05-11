import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { spacing } from '../theme';
import { AppLanguage } from '../types/models';

const PURPLE = '#7F77DD';

interface WelcomeScreenProps {
  language: AppLanguage;
  onContinue: () => void;
  onSignIn?: () => void;
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
      {/* Radial glow overlays */}
      <View style={styles.glowTopLeft} />
      <View style={styles.glowBottomRight} />

      <View style={[styles.content, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={styles.brandBlock}>
          <View style={styles.brandNameRow}>
            <Text style={styles.brandNameWhite}>G</Text>
            <Text style={styles.brandNamePurple}>AI</Text>
            <Text style={styles.brandNameWhite}>NER</Text>
          </View>
          <Text style={styles.tagline}>{'Sinä menet salille.\nMe hoidamme loput.'}</Text>
        </View>

        <Animated.View
          style={[
            styles.actionStack,
            {
              opacity: actionOpacity,
              transform: [{ translateY: actionTranslateY }],
            },
          ]}
        >
          <Pressable onPress={onContinue} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Aloita ilmaiseksi</Text>
          </Pressable>

          <Pressable onPress={onSignIn ?? onContinue} style={styles.signInLink}>
            <Text style={styles.signInLinkText}>Minulla on jo tili</Text>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
  glowTopLeft: {
    position: 'absolute',
    width: 480,
    height: 480,
    borderRadius: 240,
    top: -140,
    left: -140,
    backgroundColor: 'rgba(45, 31, 94, 0.27)',
  },
  glowBottomRight: {
    position: 'absolute',
    width: 480,
    height: 480,
    borderRadius: 240,
    bottom: -140,
    right: -140,
    backgroundColor: 'rgba(26, 15, 51, 0.27)',
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    justifyContent: 'space-between',
  },
  brandBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandNameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: spacing.xl,
  },
  brandNameWhite: {
    color: '#FFFFFF',
    fontSize: 72,
    lineHeight: 76,
    fontWeight: '900',
    letterSpacing: -2.5,
  },
  brandNamePurple: {
    color: PURPLE,
    fontSize: 72,
    lineHeight: 76,
    fontWeight: '900',
    letterSpacing: -2.5,
  },
  tagline: {
    color: 'rgba(180, 172, 220, 0.72)',
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '600',
    textAlign: 'center',
    maxWidth: 300,
  },
  actionStack: {
    alignItems: 'center',
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  primaryButton: {
    width: '100%',
    maxWidth: 360,
    minHeight: 62,
    borderRadius: 18,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PURPLE,
    shadowColor: PURPLE,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 6,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  signInLink: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  signInLinkText: {
    color: 'rgba(180, 172, 220, 0.55)',
    fontSize: 15,
    fontWeight: '600',
  },
});
