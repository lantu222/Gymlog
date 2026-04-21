import React from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { Edge, SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { colors, radii, spacing } from '../theme';

export type AppShellTone = 'home' | 'workout' | 'progress' | 'profile' | 'default';

interface AppShellProps {
  children: React.ReactNode;
  tabBar?: React.ReactNode;
  toastMessage?: string | null;
  screenTone?: AppShellTone;
  showBackgroundFrame?: boolean;
  safeAreaEdges?: Edge[];
  statusBarStyleOverride?: 'light' | 'dark';
  statusBarBackgroundColor?: string;
  statusBarTranslucent?: boolean;
}

const toneStyles: Record<AppShellTone, { topWash: string; sideWash: string; bottomWash: string; edgeLine: string }> = {
  home: {
    topWash: 'rgba(135, 198, 255, 0.10)',
    sideWash: 'rgba(240, 106, 57, 0.06)',
    bottomWash: 'rgba(191, 74, 105, 0.05)',
    edgeLine: 'rgba(135, 198, 255, 0.28)',
  },
  workout: {
    topWash: 'rgba(135, 198, 255, 0.07)',
    sideWash: 'rgba(85, 138, 189, 0.06)',
    bottomWash: 'rgba(85, 138, 189, 0.04)',
    edgeLine: 'rgba(135, 198, 255, 0.22)',
  },
  progress: {
    topWash: 'rgba(85, 138, 189, 0.05)',
    sideWash: 'rgba(255,255,255,0.02)',
    bottomWash: 'rgba(10, 14, 19, 0.08)',
    edgeLine: 'rgba(135, 198, 255, 0.16)',
  },
  profile: {
    topWash: 'rgba(255,255,255,0.03)',
    sideWash: 'rgba(135, 198, 255, 0.03)',
    bottomWash: 'rgba(191, 74, 105, 0.03)',
    edgeLine: 'rgba(255,255,255,0.14)',
  },
  default: {
    topWash: 'rgba(255,255,255,0.03)',
    sideWash: 'rgba(135, 198, 255, 0.03)',
    bottomWash: 'rgba(255,255,255,0.02)',
    edgeLine: 'rgba(255,255,255,0.14)',
  },
};

export function AppShell({
  children,
  tabBar,
  toastMessage,
  screenTone = 'default',
  showBackgroundFrame = true,
  safeAreaEdges = ['top', 'left', 'right', 'bottom'],
  statusBarStyleOverride,
  statusBarBackgroundColor,
  statusBarTranslucent = false,
}: AppShellProps) {
  const tone = toneStyles[screenTone];
  const shellBackground = screenTone === 'home' || screenTone === 'profile' ? '#FFFFFF' : colors.background;
  const statusBarStyle = statusBarStyleOverride ?? (screenTone === 'home' || screenTone === 'profile' ? 'dark' : 'light');

  return (
    <SafeAreaProvider style={[styles.root, { backgroundColor: shellBackground }]}>
      <StatusBar
        style={statusBarStyle}
        translucent={statusBarTranslucent}
        backgroundColor={statusBarBackgroundColor ?? shellBackground}
      />
      <SafeAreaView style={[styles.safeArea, { backgroundColor: shellBackground }]} edges={safeAreaEdges}>
        {showBackgroundFrame ? (
          <View pointerEvents="none" style={styles.backgroundFrame}>
            <View style={[styles.topVeil, { backgroundColor: tone.topWash }]} />
            <View style={[styles.sideWash, { backgroundColor: tone.sideWash }]} />
            <View style={[styles.bottomWash, { backgroundColor: tone.bottomWash }]} />
            <View style={[styles.edgeLine, { backgroundColor: tone.edgeLine }]} />
            <View style={styles.gridV1} />
            <View style={styles.gridV2} />
            <View style={styles.gridH1} />
            <View style={styles.gridH2} />
            <View style={styles.topFadeStrong} />
            <View style={styles.topFadeSoft} />
            <View style={styles.bottomMask} />
          </View>
        ) : null}
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

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardArea: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  backgroundFrame: {
    position: 'absolute',
    inset: 0,
    overflow: 'hidden',
    backgroundColor: colors.background,
  },
  topVeil: {
    position: 'absolute',
    top: -72,
    right: -76,
    width: 420,
    height: 320,
    borderRadius: 320,
  },
  sideWash: {
    position: 'absolute',
    top: 120,
    left: -96,
    width: 260,
    height: 360,
    borderRadius: 260,
  },
  bottomWash: {
    position: 'absolute',
    right: -100,
    bottom: -60,
    width: 260,
    height: 260,
    borderRadius: 260,
  },
  edgeLine: {
    position: 'absolute',
    top: 94,
    left: 0,
    width: 176,
    height: 3,
    borderTopRightRadius: radii.pill,
    borderBottomRightRadius: radii.pill,
  },
  gridV1: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '34%',
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  gridV2: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: '26%',
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  gridH1: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '22%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.025)',
  },
  gridH2: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '54%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.025)',
  },
  topFadeStrong: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 184,
    backgroundColor: 'rgba(11, 15, 20, 0.56)',
  },
  topFadeSoft: {
    position: 'absolute',
    top: 152,
    left: 0,
    right: 0,
    height: 112,
    backgroundColor: 'rgba(11, 15, 20, 0.20)',
  },
  bottomMask: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 320,
    backgroundColor: 'rgba(11, 15, 20, 0.22)',
  },
  toast: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toastText: {
    color: colors.textPrimary,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
  },
});
