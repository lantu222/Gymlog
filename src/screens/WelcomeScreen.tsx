import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useFonts } from 'expo-font';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AmbientDrift } from '../components/AmbientDrift';
import { VinhaWordmark } from '../components/VinhaWordmark';
import { EASE_SETTLE, MARK_CENTER_WELCOME, MARK_SIZE, markSlotTop } from '../components/vinhaMotion';
import Svg, { Path } from 'react-native-svg';

import { SUPPORTED_LANGUAGES, t } from '../lib/i18n';
import { Theme, useThemedStyles } from '../theming';
import { AppLanguage } from '../types/models';

// Light design tokens (HG palette from the redesign handoff).
const SURFACE = '#FFFFFF';
const INK = '#101828';
const BORDER = '#E4D8FF';
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
  const { height: windowHeight } = useWindowDimensions();
  const [manropeLoaded] = useFonts({ Manrope: require('../../assets/fonts/Manrope.ttf') });
  const fontFamily = manropeLoaded ? 'Manrope' : undefined;
  const actionOpacity = useRef(new Animated.Value(0)).current;
  // The spec rises the sign-in block 26 px over 620 ms — it is the third beat
  // of the hand-off, and it starts as this screen takes over from the splash.
  const actionTranslateY = useRef(new Animated.Value(26)).current;

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
          duration: 620,
          easing: EASE_SETTLE,
          useNativeDriver: true,
        }),
        Animated.timing(actionTranslateY, {
          toValue: 0,
          duration: 620,
          easing: EASE_SETTLE,
          useNativeDriver: true,
        }),
      ]).start();
    });
    return () => {
      cancelled = true;
    };
  }, [actionOpacity, actionTranslateY]);

  return (
    <View style={styles.screen}>
      {/* The same objects that streaked past on the splash, still going. */}
      <AmbientDrift />
      {onChangeLanguage ? (
        <View style={[styles.langRow, { paddingTop: insets.top + 10 }]}>
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

      {/* The splash's anchor and this one are both CENTRES. Measuring one from
          the top and the other from the centre is what made the mark jump
          between the two screens. */}
      <View style={[styles.markSlot, { top: markSlotTop(windowHeight, MARK_CENTER_WELCOME), height: MARK_SIZE }]}>
        {/* No 'app' tag here: the splash carried it, and it left. */}
        <VinhaWordmark size={MARK_SIZE} fontFamily={fontFamily} />
      </View>

      <Animated.View
        style={[
          styles.actions,
          {
            paddingBottom: insets.bottom + 22,
            opacity: actionOpacity,
            transform: [{ translateY: actionTranslateY }],
          },
        ]}
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
  // No padding on the screen itself: an absolutely positioned child is laid out
  // inside the parent's padding box, so a paddingTop here would push the mark
  // down by the status-bar inset — and the splash, which has no padding, hands
  // it over at the unpadded coordinate. That mismatch was the jump.
  screen: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  markSlot: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    marginTop: 'auto',
    paddingHorizontal: 24,
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
