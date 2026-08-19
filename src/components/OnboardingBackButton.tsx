import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { t } from '../lib/i18n';
import { Theme, useTheme, useThemedStyles } from '../theming';
import { AppLanguage } from '../types/models';

/**
 * The onboarding's back control: a "<" in a faint circle, top-left, where a
 * back control lives on every other screen of the app.
 *
 * It used to be a text link under the primary CTA — "Takaisin" below "Jatka".
 * That put the way back at the bottom of every step, next to the button that
 * goes forward, and it was the only back control in the app that was not a
 * chevron in the corner. User decision 2026-08-19: chevron top-left, link gone.
 *
 * Absolutely positioned so the screens keep their own top padding: the button
 * sits in the safe area's corner and does not push the title down.
 */
interface OnboardingBackButtonProps {
  language: AppLanguage;
  onPress: () => void;
  disabled?: boolean;
  /** Over a dark or photo top pane the circle and chevron go light. */
  light?: boolean;
}

export function OnboardingBackButton({ language, onPress, disabled = false, light = false }: OnboardingBackButtonProps) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t(language, 'common.back')}
      onPress={onPress}
      disabled={disabled}
      hitSlop={10}
      style={({ pressed }) => [
        styles.button,
        light && styles.buttonLight,
        { top: insets.top + 10 },
        pressed && { opacity: 0.7 },
        disabled && { opacity: 0.4 },
      ]}
    >
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
        <Path
          d="M15 5l-7 7 7 7"
          stroke={light ? '#FFFFFF' : theme.ink}
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </Pressable>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    button: {
      position: 'absolute',
      left: 16,
      zIndex: 20,
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      // The "faded circle": the purple at low alpha over whatever is behind.
      backgroundColor: theme.purpleSoft,
    },
    buttonLight: {
      backgroundColor: 'rgba(255,255,255,0.18)',
    },
  });
