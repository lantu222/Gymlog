import React from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { Edge, SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { Theme, useTheme, useThemeName, useThemedStyles } from '../theming';
import { radii, spacing } from '../theme';

interface AppShellProps {
  children: React.ReactNode;
  tabBar?: React.ReactNode;
  toastMessage?: string | null;
  safeAreaEdges?: Edge[];
  statusBarStyleOverride?: 'light' | 'dark';
  statusBarBackgroundColor?: string;
  statusBarTranslucent?: boolean;
  shellBackgroundColor?: string;
}

export function AppShell({
  children,
  tabBar,
  toastMessage,
  safeAreaEdges = ['top', 'left', 'right', 'bottom'],
  statusBarStyleOverride,
  statusBarBackgroundColor,
  statusBarTranslucent = false,
  shellBackgroundColor,
}: AppShellProps) {
  const theme = useTheme();
  const themeName = useThemeName();
  const styles = useThemedStyles(makeStyles);
  const shellBackground = shellBackgroundColor ?? theme.bg;
  // Status-bar icons follow the theme, not a fixed default. Hardcoding 'dark'
  // here was right while the app was light-only; under the dark theme it would
  // paint near-black icons on a near-black bar. Screens that want the other
  // treatment — the gradient heroes — still override it explicitly.
  const statusBarStyle = statusBarStyleOverride ?? (themeName === 'dark' ? 'light' : 'dark');

  return (
    <SafeAreaProvider style={[styles.root, { backgroundColor: shellBackground }]}>
      <StatusBar
        style={statusBarStyle}
        translucent={statusBarTranslucent}
        backgroundColor={statusBarBackgroundColor ?? shellBackground}
      />
      <SafeAreaView style={[styles.safeArea, { backgroundColor: shellBackground }]} edges={safeAreaEdges}>
        <KeyboardAvoidingView
          behavior={Platform.select({ ios: 'padding', android: undefined })}
          style={styles.keyboardArea}
        >
          <View style={styles.content}>{children}</View>
          {toastMessage ? (
            <View style={styles.toast}>
              <Text style={styles.toastText}>{toastMessage}</Text>
            </View>
          ) : null}
          {tabBar}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  safeArea: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  keyboardArea: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  // A dark pill over light content, the ordinary snackbar shape — built from
  // the palette rather than from the retired dark theme.
  toast: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: theme.ink,
  },
  toastText: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
  },
});
