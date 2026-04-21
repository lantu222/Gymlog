import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppLanguage } from '../types/models';
import { spacing } from '../theme';

interface WelcomeScreenProps {
  language: AppLanguage;
  onContinue: () => void;
}

const copy = {
  en: {
    setupHint: 'Takes less than a minute to set up.',
    continueLabel: 'Get started',
  },
  fi: {
    setupHint: 'Aloitus vie alle minuutin.',
    continueLabel: 'Aloitetaan',
  },
} as const;

export function WelcomeScreen({ language, onContinue }: WelcomeScreenProps) {
  const insets = useSafeAreaInsets();
  const content = copy[language];

  return (
    <View style={styles.screen}>
      <View style={styles.hero}>
        <View style={styles.heroTop} />
        <View style={styles.heroBottom} />

        <View pointerEvents="none" style={styles.backgroundLogo}>
          <Text style={styles.backgroundGym}>GYM</Text>
          <Text style={styles.backgroundLog}>LOG</Text>
        </View>

        <View
          style={[
            styles.heroContent,
            {
              paddingTop: insets.top + 18,
              paddingBottom: insets.bottom + spacing.lg,
            },
          ]}
        >
          <View style={styles.copyBlock} />

          <View style={styles.actionStack}>
            <Pressable onPress={onContinue} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>{content.continueLabel}</Text>
            </Pressable>
            <Text style={styles.setupHint}>{content.setupHint}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  hero: {
    flex: 1,
    minHeight: 0,
    backgroundColor: '#FFFFFF',
  },
  heroTop: {
    ...StyleSheet.absoluteFillObject,
    bottom: '50%',
    backgroundColor: '#000000',
  },
  heroBottom: {
    ...StyleSheet.absoluteFillObject,
    top: '50%',
    backgroundColor: '#FFFFFF',
  },
  backgroundLogo: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    alignItems: 'center',
    transform: [{ translateY: -118 }],
  },
  backgroundGym: {
    color: '#FFFFFF',
    fontSize: 122,
    lineHeight: 122,
    fontWeight: '900',
    letterSpacing: -4.4,
    marginBottom: -10,
  },
  backgroundLog: {
    color: '#000000',
    fontSize: 130,
    lineHeight: 130,
    fontWeight: '900',
    letterSpacing: -3.8,
    marginTop: -10,
  },
  heroContent: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    justifyContent: 'space-between',
  },
  copyBlock: {
    justifyContent: 'flex-start',
    paddingTop: spacing.xl + spacing.sm,
  },
  actionStack: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  setupHint: {
    color: 'rgba(0,0,0,0.74)',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: -0.1,
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
