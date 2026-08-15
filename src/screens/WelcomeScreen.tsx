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
import { queryReduceMotion } from '../utils/reduceMotion';

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
    queryReduceMotion().then((reduceMotion) => {
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
        {/* One button, and it does what it says.

            This screen used to offer "Continue with Google" and "Continue
            with Apple", both wired to this same handler. There is no OAuth,
            no account and nothing created — the buttons only moved you into
            onboarding, under two companies' trademarks, for a feature that
            does not exist. Unlike the paywall's demo copy this was behind no
            guard at all, and it is the first screen of the app.

            When sign-in ships, the providers come back as buttons that sign
            you in. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(language, 'welcome.start')}
          onPress={onContinue}
          style={({ pressed }) => [styles.startButton, pressed && styles.providerButtonPressed]}
        >
          <Text style={[styles.startLabel, { fontFamily }]}>{t(language, 'welcome.start')}</Text>
        </Pressable>

        {/* The "no account needed" reassurance is gone. It answered a worry
            nobody has yet on the first screen — there is no sign-in form in
            sight to be worried about — and the privacy promise it made is
            stated properly in Settings, where it can be read in full. */}
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
    // FIN and ENG are both three letters but not the same width — the I is
    // narrow — so chips that hug their text come out visibly different sizes.
    // A fixed label width makes the two chips identical.
    minWidth: 30,
    textAlign: 'center',
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
  startButton: {
    height: 54,
    borderRadius: 15,
    backgroundColor: '#6D28D9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  startLabel: {
    color: '#FFFFFF',
    fontSize: 15.5,
    fontWeight: '800',
    // Uppercased here rather than in the string, so the translation stays
    // readable and the accessibility label reads as a sentence.
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  providerButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
});
