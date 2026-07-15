import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Image, Pressable, StyleSheet, Text, View } from 'react-native';
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

// Dots between the app tiles pulse in a travelling wave that ping-pongs
// left <-> right, hinting at data syncing both ways.
const CONNECTOR_DOT_COUNT = 7;

function ConnectorWave() {
  const wave = useRef(new Animated.Value(-0.3)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(wave, {
          toValue: 1.3,
          duration: 1300,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(wave, {
          toValue: -0.3,
          duration: 1300,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [wave]);

  return (
    <View style={styles.connectorTrack}>
      {Array.from({ length: CONNECTOR_DOT_COUNT }, (_, index) => {
        const center = index / (CONNECTOR_DOT_COUNT - 1);

        return (
          <Animated.View
            key={index}
            style={[
              styles.connectorDot,
              {
                opacity: wave.interpolate({
                  inputRange: [center - 0.3, center, center + 0.3],
                  outputRange: [0.25, 1, 0.25],
                  extrapolate: 'clamp',
                }),
                transform: [
                  {
                    scale: wave.interpolate({
                      inputRange: [center - 0.3, center, center + 0.3],
                      outputRange: [0.7, 1.25, 0.7],
                      extrapolate: 'clamp',
                    }),
                  },
                ],
              },
            ]}
          />
        );
      })}
    </View>
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
            <Image
              source={require('../../assets/branding/gainer-app-icon.png')}
              style={styles.appTileLogoImage}
              resizeMode="cover"
            />
          </View>
          <ConnectorWave />
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
    justifyContent: 'space-between',
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
    backgroundColor: '#0B0B0E',
    borderWidth: 2,
    borderColor: '#C9B6FF',
    overflow: 'hidden',
    shadowColor: PURPLE,
    shadowOpacity: 0.32,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  // The exported icon has a small white margin around its rounded square;
  // rendering it slightly oversized inside the clipped tile crops that away.
  appTileLogoImage: {
    width: 88,
    height: 88,
  },
  appTileHealth: {
    backgroundColor: SURFACE,
    borderWidth: 2,
    borderColor: '#C9B6FF',
  },
  connectorTrack: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingHorizontal: 16,
  },
  connectorDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: '#9F7BEF',
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
    color: '#475467',
    fontSize: 14.5,
    lineHeight: 20,
    fontWeight: '700',
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
    borderWidth: 1.5,
    borderColor: '#C9B6FF',
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
    color: '#475467',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
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
  skipLink: {
    alignSelf: 'center',
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  skipText: {
    color: INK,
    fontSize: 14.5,
    fontWeight: '700',
  },
});
