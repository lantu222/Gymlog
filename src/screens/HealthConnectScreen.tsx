import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFonts } from 'expo-font';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { getHealthProviderLabel, HealthBasics, requestHealthBasics } from '../integrations/health';

// Light design tokens (HG palette, same as WelcomeScreen).
const BG = '#F7F3FF';
const SURFACE = '#FFFFFF';
const INK = '#101828';
const MUTED = '#667085';
const BORDER = '#E4D8FF';
const PURPLE = '#7C3AED';
const HEALTH_RED = '#FF2D55';

interface HealthConnectScreenProps {
  onConnected: (basics: HealthBasics) => void;
  onSkip: () => void;
}

function DumbbellGlyph() {
  return (
    <Svg width={30} height={30} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10"
        stroke="#FFFFFF"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function HealthHeart() {
  return (
    <Svg width={30} height={30} viewBox="0 0 24 24" fill={HEALTH_RED}>
      <Path d="M12 21s-8-5-8-10.2C4 7.5 6 5.5 8.5 5.5c1.5 0 2.8.8 3.5 2 .7-1.2 2-2 3.5-2C18 5.5 20 7.5 20 10.8 20 16 12 21 12 21z" />
    </Svg>
  );
}

function CheckGlyph() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12l5 5L19 7" stroke={PURPLE} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function LockGlyph() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path
        d="M7 11V8a5 5 0 0110 0v3M6 11h12v9H6v-9z"
        stroke={MUTED}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function Bullet({ title, body, fontFamily }: { title: string; body: string; fontFamily?: string }) {
  return (
    <View style={styles.bulletRow}>
      <View style={styles.bulletCheck}>
        <CheckGlyph />
      </View>
      <View style={styles.bulletCopy}>
        <Text style={[styles.bulletTitle, { fontFamily }]}>{title}</Text>
        <Text style={[styles.bulletBody, { fontFamily }]}>{body}</Text>
      </View>
    </View>
  );
}

export function HealthConnectScreen({ onConnected, onSkip }: HealthConnectScreenProps) {
  const insets = useSafeAreaInsets();
  const [manropeLoaded] = useFonts({ Manrope: require('../../assets/fonts/Manrope.ttf') });
  const fontFamily = manropeLoaded ? 'Manrope' : undefined;
  const providerLabel = getHealthProviderLabel();
  const [busy, setBusy] = useState(false);
  const [errorNote, setErrorNote] = useState<string | null>(null);

  async function handleConnect() {
    if (busy) {
      return;
    }
    setBusy(true);
    setErrorNote(null);
    try {
      const result = await requestHealthBasics();
      if (result.status === 'connected') {
        onConnected(result.basics);
        return;
      }
      setErrorNote(
        result.status === 'denied'
          ? `Permission was denied. You can enter your details manually instead.`
          : `${providerLabel} isn't available on this device. You can enter your details manually instead.`,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 14 }]}>
      <View style={styles.content}>
        <View style={styles.tileRow}>
          <View style={[styles.appTile, styles.appTileGainer]}>
            <DumbbellGlyph />
          </View>
          <View style={styles.connectorRow}>
            <View style={styles.connectorDot} />
            <View style={styles.connectorDot} />
            <View style={styles.connectorDot} />
          </View>
          <View style={[styles.appTile, styles.appTileHealth]}>
            <HealthHeart />
          </View>
        </View>

        <Text style={[styles.title, { fontFamily }]}>{`Connect ${providerLabel}`}</Text>
        <Text style={[styles.subtitle, { fontFamily }]}>
          Sync your details so we can build your plan faster — no manual typing.
        </Text>

        <View style={styles.bullets}>
          <Bullet
            title="We pre-fill what we know"
            body="Weight, height, age and sex flow straight into your setup."
            fontFamily={fontFamily}
          />
          <Bullet
            title="Workouts log themselves"
            body={`Finished sets sync back to ${providerLabel} automatically.`}
            fontFamily={fontFamily}
          />
        </View>

        {errorNote ? <Text style={[styles.errorNote, { fontFamily }]}>{errorNote}</Text> : null}
      </View>

      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Connect ${providerLabel}`}
          onPress={() => void handleConnect()}
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
        >
          {busy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={[styles.ctaLabel, { fontFamily }]}>{`Connect ${providerLabel}`}</Text>
          )}
        </Pressable>

        <View style={styles.privacyRow}>
          <LockGlyph />
          <Text style={[styles.privacyText, { fontFamily }]}>Data stays on your device. We never share or sell it.</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Maybe later"
          onPress={onSkip}
          style={({ pressed }) => [styles.skipLink, pressed && { opacity: 0.7 }]}
        >
          <Text style={[styles.skipText, { fontFamily }]}>Maybe later</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG,
    paddingHorizontal: 24,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  tileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    marginBottom: 28,
  },
  appTile: {
    width: 74,
    height: 74,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appTileGainer: {
    backgroundColor: PURPLE,
    shadowColor: PURPLE,
    shadowOpacity: 0.32,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  appTileHealth: {
    backgroundColor: SURFACE,
    borderWidth: 1.5,
    borderColor: BORDER,
  },
  connectorRow: {
    flexDirection: 'row',
    gap: 6,
  },
  connectorDot: {
    width: 5,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#C9B6FF',
  },
  title: {
    color: INK,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  subtitle: {
    color: MUTED,
    fontSize: 14.5,
    lineHeight: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 8,
  },
  bullets: {
    marginTop: 28,
    gap: 16,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  bulletCheck: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: '#EFE7FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  bulletCopy: {
    flex: 1,
    gap: 2,
  },
  bulletTitle: {
    color: INK,
    fontSize: 14.5,
    lineHeight: 19,
    fontWeight: '800',
  },
  bulletBody: {
    color: MUTED,
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '600',
  },
  errorNote: {
    color: '#B42318',
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 18,
  },
  footer: {
    paddingTop: 8,
  },
  cta: {
    height: 56,
    borderRadius: 18,
    backgroundColor: PURPLE,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: PURPLE,
    shadowOpacity: 0.32,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 14 },
    elevation: 10,
  },
  ctaPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  ctaLabel: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.17,
  },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
  },
  privacyText: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '600',
  },
  skipLink: {
    alignSelf: 'center',
    marginTop: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  skipText: {
    color: INK,
    fontSize: 14.5,
    fontWeight: '700',
  },
});
