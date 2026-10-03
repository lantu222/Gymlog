import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

import { t } from '../lib/i18n';
import { resolveDeviceLanguage } from '../storage/deviceLocale';
import { colors, radii, spacing, typography } from '../theme';

/**
 * Shown when the app hit a bug it could not draw past (AppErrorBoundary).
 *
 * Calm on purpose, and honest about the one thing a reader needs to know:
 * nothing was deleted. A render error does not touch what is stored, so the
 * sentence is true; "Try again" remounts the app, which reads it back.
 *
 * It renders above the theme and the preferences — the boundary sits outside
 * both, since either could be what failed — so it uses the fixed palette and
 * the phone's language, like StorageLoadFailedScreen.
 */
export function AppCrashScreen({ onRetry }: { onRetry: () => void }) {
  const language = resolveDeviceLanguage();

  useEffect(() => {
    // If the failure came before the app hid it, the splash would cover this.
    void SplashScreen.hideAsync().catch(() => undefined);
  }, []);

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>{t(language, 'appCrash.title')}</Text>
      <Text style={styles.body}>{t(language, 'appCrash.body')}</Text>
      <Pressable accessibilityRole="button" onPress={onRetry} style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}>
        <Text style={styles.buttonText}>{t(language, 'appCrash.retry')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.background,
  },
  title: {
    fontFamily: typography.fontFamily,
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  body: {
    fontFamily: typography.fontFamily,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  button: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
  },
  buttonPressed: {
    backgroundColor: colors.accentPressed,
  },
  buttonText: {
    fontFamily: typography.fontFamily,
    fontSize: 15,
    fontWeight: '700',
    color: colors.background,
  },
});
