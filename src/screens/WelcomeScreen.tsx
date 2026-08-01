import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFonts } from 'expo-font';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AmbientDrift } from '../components/AmbientDrift';
import { VinhaWordmark } from '../components/VinhaWordmark';
import Svg, { Path } from 'react-native-svg';

import { SUPPORTED_LANGUAGES, t } from '../lib/i18n';
import { Theme, useThemedStyles } from '../theming';
import { AppLanguage } from '../types/models';

// Light design tokens (HG palette from the redesign handoff).
const SURFACE = '#FFFFFF';
const INK = '#101828';
const MUTED = '#667085';
const BORDER = '#E4D8FF';
const PURPLE = '#7C3AED';
const PURPLE_DARK = '#5B21B6';
const FAINT = '#9A93AC';

interface WelcomeScreenProps {
  language: AppLanguage;
  onChangeLanguage?: (language: AppLanguage) => void;
  onContinue: () => void;
}

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

export function WelcomeScreen({ language, onChangeLanguage, onContinue }: WelcomeScreenProps) {
  const styles = useThemedStyles(makeStyles);
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
      {/* The same objects that streaked past on the splash, still going. */}
      <AmbientDrift />
      {onChangeLanguage ? (
        <View style={styles.langRow}>
          {SUPPORTED_LANGUAGES.map((option) => {
            const active = option.key === language;
            return (
              <Pressable
                key={option.key}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Language ${option.label}`}
                onPress={() => onChangeLanguage(option.key)}
                style={[styles.langChip, active && styles.langChipActive]}
              >
                <Text style={styles.langFlag}>{option.flag}</Text>
                <Text style={[styles.langLabel, active && styles.langLabelActive, { fontFamily }]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {/* Same slot as the splash's, so the mark does not move when the one
          hands over to the other. */}
      <View style={styles.markSlot}>
        {/* No 'app' tag here: the splash carried it, and it left. */}
        <VinhaWordmark size={62} fontFamily={fontFamily} />
      </View>

      <Animated.View
        style={[styles.actions, { opacity: actionOpacity, transform: [{ translateY: actionTranslateY }] }]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(language, 'welcome.continueGoogle')}
          onPress={onContinue}
          style={({ pressed }) => [styles.providerButton, pressed && styles.providerButtonPressed]}
        >
          <GoogleMark />
          <Text style={[styles.providerLabel, { fontFamily }]}>{t(language, 'welcome.continueGoogle')}</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(language, 'welcome.continueApple')}
          onPress={onContinue}
          style={({ pressed }) => [styles.providerButton, pressed && styles.providerButtonPressed]}
        >
          <AppleMark />
          <Text style={[styles.providerLabel, { fontFamily }]}>{t(language, 'welcome.continueApple')}</Text>
        </Pressable>

        <Text style={[styles.tagline, { fontFamily }]}>{t(language, 'brand.tagline')}</Text>
      </Animated.View>
    </View>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  langRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  langChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: '#E4D8FF',
    backgroundColor: '#FFFFFF',
  },
  langChipActive: {
    borderColor: '#7C3AED',
    backgroundColor: '#EFE7FF',
  },
  langFlag: {
    fontSize: 14,
  },
  langLabel: {
    color: '#9A93AC',
    fontSize: 12,
    fontWeight: '800',
  },
  langLabelActive: {
    color: '#5B21B6',
  },
  screen: {
    flex: 1,
    backgroundColor: theme.bg,
    paddingHorizontal: 24,
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
  markSlot: {
    position: 'absolute',
    top: 201,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  actions: {
    marginTop: 'auto',
  },
  // The design's tagline is a quiet footer, not a headline: small, tracked
  // out, and the last thing you read rather than the second.
  tagline: {
    color: FAINT,
    fontSize: 12.5,
    fontWeight: '700',
    letterSpacing: 2.7,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginTop: 22,
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
});
