import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFonts } from 'expo-font';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import {
  getHealthAvailability,
  getHealthProviderLabel,
  HealthAvailability,
  HealthBasics,
  openHealthSettings,
  requestHealthBasics,
} from '../integrations/health';
import { t } from '../lib/i18n';
import { Theme, useThemedStyles } from '../theming';
import { AppLanguage } from '../types/models';

// Light design tokens (HG palette, same as WelcomeScreen).
const SURFACE = '#FFFFFF';
const INK = '#101828';
const MUTED = '#667085';
const BORDER = '#E4D8FF';
const PURPLE = '#7C3AED';
const HEALTH_RED = '#FF2D55';

interface HealthConnectScreenProps {
  language?: AppLanguage;
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
  const styles = useThemedStyles(makeStyles);

  const wave = useRef(new Animated.Value(-0.3)).current;
  // One interpolation per dot for the component's life — per-render
  // interpolations leak native nodes (disconnectAnimatedNodes crash).
  const dotStyles = useRef(
    Array.from({ length: CONNECTOR_DOT_COUNT }, (_, index) => {
      const center = index / (CONNECTOR_DOT_COUNT - 1);
      return {
        opacity: wave.interpolate({
          inputRange: [center - 0.3, center, center + 0.3],
          outputRange: [0.25, 1, 0.25],
          extrapolate: 'clamp' as const,
        }),
        transform: [
          {
            scale: wave.interpolate({
              inputRange: [center - 0.3, center, center + 0.3],
              outputRange: [0.7, 1.25, 0.7],
              extrapolate: 'clamp' as const,
            }),
          },
        ],
      };
    }),
  ).current;

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
      {dotStyles.map((dotStyle, index) => (
        <Animated.View key={index} style={[styles.connectorDot, dotStyle]} />
      ))}
    </View>
  );
}

function Bullet({ title, body, fontFamily }: { title: string; body: string; fontFamily?: string }) {
  const styles = useThemedStyles(makeStyles);

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

export function HealthConnectScreen({ language = 'en', onConnected, onSkip }: HealthConnectScreenProps) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const [manropeLoaded] = useFonts({ Manrope: require('../../assets/fonts/Manrope.ttf') });
  const fontFamily = manropeLoaded ? 'Manrope' : undefined;
  const providerLabel = getHealthProviderLabel();
  const [busy, setBusy] = useState(false);
  const [errorNote, setErrorNote] = useState<string | null>(null);
  // null while the check is still in flight — the CTA must not promise a
  // connection before the device has said it can make one.
  const [availability, setAvailability] = useState<HealthAvailability | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getHealthAvailability().then((status) => {
      if (!cancelled) {
        setAvailability(status);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

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
          ? t(language, 'health.link.denied')
          : t(language, 'health.link.unavailable', { provider: providerLabel }),
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleOpenSettings() {
    const opened = await openHealthSettings();
    if (!opened) {
      setErrorNote(t(language, 'health.link.unsupported'));
    }
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 14 }]}>
      <View style={styles.content}>
        <View style={styles.tileRow}>
          <View style={[styles.appTile, styles.appTileVinha]}>
            <Image
              source={require('../../assets/branding/vinha-app-icon.png')}
              style={styles.appTileLogoImage}
              // The old mark was drawn to be cropped; this one is a full tile
              // with its own margins, and cover was cutting the V off top and
              // bottom. The image now fills the tile exactly.
              resizeMode="cover"
            />
          </View>
          <ConnectorWave />
          <View style={[styles.appTile, styles.appTileHealth]}>
            <HealthHeart />
          </View>
        </View>

        <Text style={[styles.title, { fontFamily }]}>{t(language, 'health.link.title', { provider: providerLabel })}</Text>
        <Text style={[styles.subtitle, { fontFamily }]}>{t(language, 'health.link.sub')}</Text>

        <View style={styles.bullets}>
          <Bullet
            title={t(language, 'health.link.prefill.title')}
            body={t(language, 'health.link.prefill.body')}
            fontFamily={fontFamily}
          />
          <Bullet
            title={t(language, 'health.link.private.title')}
            body={t(language, 'health.link.private.body')}
            fontFamily={fontFamily}
          />
        </View>

        {/* Names the mechanism. "Health Connect" means nothing to someone who
            thinks of their data as living in Samsung Health — and the app
            cannot choose sources, so the user has to know where they live. */}
        <Text style={[styles.sourcesNote, { fontFamily }]}>{t(language, 'health.link.sources')}</Text>

        {availability === 'update_required' ? (
          <Text style={[styles.statusNote, { fontFamily }]}>{t(language, 'health.link.updateRequired')}</Text>
        ) : null}
        {availability === 'unsupported' ? (
          <Text style={[styles.statusNote, { fontFamily }]}>{t(language, 'health.link.unsupported')}</Text>
        ) : null}

        {errorNote ? <Text style={[styles.errorNote, { fontFamily }]}>{errorNote}</Text> : null}
      </View>

      <View style={styles.footer}>
        {/* No connect button once the device has told us it cannot connect —
            a CTA that only leads to an error is the promise being broken
            after the tap rather than before it. */}
        {availability === 'unsupported' ? null : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              availability === 'update_required'
                ? t(language, 'health.link.openSettings')
                : t(language, 'health.link.title', { provider: providerLabel })
            }
            onPress={() => void (availability === 'update_required' ? handleOpenSettings() : handleConnect())}
            style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
          >
            {busy ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={[styles.ctaLabel, { fontFamily }]}>
                {availability === 'update_required'
                  ? t(language, 'health.link.openSettings')
                  : t(language, 'health.link.title', { provider: providerLabel })}
              </Text>
            )}
          </Pressable>
        )}

        {availability === 'available' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(language, 'health.link.manageSources')}
            onPress={() => void handleOpenSettings()}
            style={({ pressed }) => [styles.manageLink, pressed && { opacity: 0.7 }]}
          >
            <Text style={[styles.manageText, { fontFamily }]}>{t(language, 'health.link.manageSources')}</Text>
          </Pressable>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(language, 'health.link.skip')}
          onPress={onSkip}
          style={({ pressed }) => [styles.skipLink, pressed && { opacity: 0.7 }]}
        >
          <Text style={[styles.skipText, { fontFamily }]}>{t(language, 'health.link.skip')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.bg,
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
    marginBottom: 44,
  },
  appTile: {
    width: 74,
    height: 74,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appTileVinha: {
    // The icon's own field colour, so the tile matches even while the image
    // loads or if a future icon stops covering the full square.
    backgroundColor: '#101828',
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
    width: 74,
    height: 74,
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
    marginTop: 44,
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
  sourcesNote: {
    color: MUTED,
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 26,
    paddingHorizontal: 4,
  },
  statusNote: {
    color: '#B54708',
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 14,
  },
  manageLink: {
    alignSelf: 'center',
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  manageText: {
    color: PURPLE,
    fontSize: 14,
    fontWeight: '800',
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
