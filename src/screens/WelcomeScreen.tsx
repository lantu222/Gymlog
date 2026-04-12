import React from 'react';
import { ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppLanguage } from '../types/models';
import { radii, spacing } from '../theme';

const welcomePhoto = require('../../assets/fitness/selected/welcome-portrait.jpg');

interface WelcomeScreenProps {
  language: AppLanguage;
  onChangeLanguage: (language: AppLanguage) => void;
  onContinue: () => void;
}

const copy = {
  en: {
    brandGym: 'GYM',
    brandLog: 'LOG',
    title: 'Training has never felt this easy.',
    continueMain: 'Continue',
    langFi: 'FIN',
    langEn: 'ENG',
  },
  fi: {
    brandGym: 'GYM',
    brandLog: 'LOG',
    title: 'Treenin aloittaminen ei ole koskaan tuntunut nain helpolta.',
    continueMain: 'Jatka',
    langFi: 'FIN',
    langEn: 'ENG',
  },
} as const;

export function WelcomeScreen({ language, onChangeLanguage, onContinue }: WelcomeScreenProps) {
  const insets = useSafeAreaInsets();
  const content = copy[language];

  return (
    <View style={styles.screen}>
      <ImageBackground source={welcomePhoto} resizeMode="cover" style={styles.hero}>
        <View style={styles.photoShade} />
        <View style={[styles.heroContent, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={styles.topRow}>
            <View style={styles.languageToggle}>
              <Pressable
                onPress={() => onChangeLanguage('fi')}
                style={[styles.languagePill, language === 'fi' && styles.languagePillActive]}
              >
                <Text style={[styles.languageText, language === 'fi' && styles.languageTextActive]}>
                  {content.langFi}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => onChangeLanguage('en')}
                style={[styles.languagePill, language === 'en' && styles.languagePillActive]}
              >
                <Text style={[styles.languageText, language === 'en' && styles.languageTextActive]}>
                  {content.langEn}
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.copyBlock}>
            <View style={styles.brandRow}>
              <Text style={styles.brandGym}>{content.brandGym}</Text>
              <View style={styles.brandLogPill}>
                <Text style={styles.brandLog}>{content.brandLog}</Text>
              </View>
            </View>
            <View style={styles.titlePill}>
              <Text style={styles.title}>{content.title}</Text>
            </View>
          </View>

          <View style={styles.actionStack}>
            <Pressable onPress={onContinue} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>{content.continueMain}</Text>
            </Pressable>
          </View>
        </View>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#050608',
  },
  hero: {
    flex: 1,
    minHeight: 0,
    backgroundColor: '#050608',
  },
  photoShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.34)',
  },
  heroContent: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    justifyContent: 'flex-start',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  languageToggle: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(8, 10, 13, 0.56)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 4,
  },
  languagePill: {
    minWidth: 50,
    minHeight: 34,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  languagePillActive: {
    backgroundColor: '#F4F7FB',
  },
  languageText: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  languageTextActive: {
    color: '#06080B',
  },
  copyBlock: {
    gap: spacing.md,
    paddingTop: spacing.xl,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandGym: {
    color: '#FFFFFF',
    fontSize: 46,
    lineHeight: 46,
    fontWeight: '900',
    letterSpacing: -1.8,
  },
  brandLogPill: {
    minWidth: 86,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandLog: {
    color: '#050608',
    fontSize: 31,
    lineHeight: 31,
    fontWeight: '900',
    letterSpacing: -1.1,
  },
  title: {
    color: '#050608',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  titlePill: {
    alignSelf: 'flex-start',
    maxWidth: '78%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.96)',
  },
  actionStack: {
    paddingBottom: spacing.sm,
    marginTop: 'auto',
  },
  primaryButton: {
    minHeight: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4F7FB',
  },
  primaryButtonText: {
    color: '#06080B',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
});
