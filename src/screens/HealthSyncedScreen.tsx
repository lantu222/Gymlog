import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFonts } from 'expo-font';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { getAgeFromDateOfBirth, getHealthProviderLabel, HealthBasics } from '../integrations/health';

// Light design tokens (HG palette, same as WelcomeScreen).
const BG = '#F7F3FF';
const SURFACE = '#FFFFFF';
const INK = '#101828';
const MUTED = '#667085';
const FAINT = '#9A93AC';
const BORDER = '#E4D8FF';
const PURPLE = '#7C3AED';

// The real Health Connect / HealthKit read is near-instant, so this hold is
// purely presentational: long enough to register as "work being done",
// short enough not to annoy on replays.
const SYNC_HOLD_MS = 1200;
const ROW_STAGGER_MS = 90;

interface HealthSyncedScreenProps {
  basics: HealthBasics;
  onContinue: () => void;
  onBack: () => void;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const PLACEHOLDER_WIDTHS = [64, 52, 46, 110];

function formatDateOfBirth(dateOfBirth: string | null) {
  if (!dateOfBirth) {
    return null;
  }
  const date = new Date(dateOfBirth);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const age = getAgeFromDateOfBirth(dateOfBirth);
  const formatted = `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  return age === null ? formatted : `${formatted} (${age})`;
}

function formatSex(sex: HealthBasics['sex']) {
  if (sex === 'male') {
    return 'Male';
  }
  if (sex === 'female') {
    return 'Female';
  }
  return null;
}

function SpinnerArc() {
  return (
    <Svg width={34} height={34} viewBox="0 0 24 24" fill="none">
      <Circle
        cx={12}
        cy={12}
        r={9}
        stroke="#FFFFFF"
        strokeWidth={3}
        strokeLinecap="round"
        strokeDasharray="40 17"
      />
    </Svg>
  );
}

export function HealthSyncedScreen({ basics, onContinue, onBack }: HealthSyncedScreenProps) {
  const insets = useSafeAreaInsets();
  const [manropeLoaded] = useFonts({ Manrope: require('../../assets/fonts/Manrope.ttf') });
  const fontFamily = manropeLoaded ? 'Manrope' : undefined;
  const providerLabel = getHealthProviderLabel();

  const rows: Array<{ label: string; value: string }> = [];
  if (typeof basics.weightKg === 'number' && Number.isFinite(basics.weightKg)) {
    rows.push({ label: 'Weight', value: `${basics.weightKg} kg` });
  }
  if (typeof basics.heightCm === 'number' && Number.isFinite(basics.heightCm)) {
    rows.push({ label: 'Height', value: `${basics.heightCm} cm` });
  }
  const sexValue = formatSex(basics.sex);
  if (sexValue) {
    rows.push({ label: 'Sex', value: sexValue });
  }
  const dobValue = formatDateOfBirth(basics.dateOfBirth);
  if (dobValue) {
    rows.push({ label: 'Date of birth', value: dobValue });
  }

  const [revealed, setRevealed] = useState(false);
  const pulse = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const checkPop = useRef(new Animated.Value(0)).current;
  const textFade = useRef(new Animated.Value(1)).current;
  const footerFade = useRef(new Animated.Value(0)).current;
  const rowReveals = useRef(rows.map(() => new Animated.Value(0))).current;

  // Shimmer + spinner loops, only while syncing.
  useEffect(() => {
    if (revealed) {
      return;
    }
    const shimmer = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 620, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 620, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    const spinner = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true }),
    );
    shimmer.start();
    spinner.start();
    return () => {
      shimmer.stop();
      spinner.stop();
    };
  }, [revealed, pulse, spin]);

  // Hold in the syncing state, then reveal: check pops, copy swaps,
  // rows cascade in, footer fades up last.
  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.timing(textFade, { toValue: 0, duration: 140, useNativeDriver: true }).start(() => {
        setRevealed(true);
        Animated.parallel([
          Animated.timing(textFade, { toValue: 1, duration: 220, useNativeDriver: true }),
          Animated.spring(checkPop, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
          Animated.stagger(
            ROW_STAGGER_MS,
            rowReveals.map((value) =>
              Animated.timing(value, { toValue: 1, duration: 240, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            ),
          ),
          Animated.timing(footerFade, { toValue: 1, duration: 260, delay: 280, useNativeDriver: true }),
        ]).start();
      });
    }, SYNC_HOLD_MS);
    return () => clearTimeout(timer);
  }, [textFade, checkPop, footerFade, rowReveals]);

  const spinDeg = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 14 }]}>
      <View style={styles.content}>
        <Animated.View
          style={[
            styles.checkBadge,
            { transform: [{ scale: checkPop.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }] },
          ]}
        >
          <Animated.View
            style={[
              styles.badgeLayer,
              {
                opacity: checkPop.interpolate({ inputRange: [0, 0.35], outputRange: [1, 0], extrapolate: 'clamp' }),
                transform: [{ rotate: spinDeg }],
              },
            ]}
          >
            <SpinnerArc />
          </Animated.View>
          <Animated.View
            style={[
              styles.badgeLayer,
              {
                opacity: checkPop.interpolate({ inputRange: [0, 0.3], outputRange: [0, 1], extrapolate: 'clamp' }),
                transform: [{ scale: checkPop.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }],
              },
            ]}
          >
            <Svg width={34} height={34} viewBox="0 0 24 24" fill="none">
              <Path d="M5 12l5 5L19 7" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Animated.View>
        </Animated.View>

        <Animated.View style={{ opacity: textFade }}>
          <Text style={[styles.title, { fontFamily }]}>
            {revealed ? `Synced with ${providerLabel}` : `Syncing with ${providerLabel}…`}
          </Text>
          <Text style={[styles.subtitle, { fontFamily }]}>
            {revealed ? "We've pre-filled your details." : 'Fetching your details securely…'}
          </Text>
        </Animated.View>

        <Text style={[styles.importedLabel, { fontFamily }]}>
          {`${revealed ? 'IMPORTED' : 'IMPORTING'} FROM ${providerLabel.toUpperCase()}`}
        </Text>
        <View style={styles.card}>
          {rows.map((row, index) => {
            const reveal = rowReveals[index];
            return (
              <View key={row.label} style={[styles.row, index === rows.length - 1 && styles.rowLast]}>
                <Text style={[styles.rowLabel, { fontFamily }]}>{row.label}</Text>
                <View style={styles.rowValueSlot}>
                  <Animated.View
                    style={{
                      opacity: reveal,
                      transform: [{ translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }],
                    }}
                  >
                    <Text style={[styles.rowValue, { fontFamily }]}>{row.value}</Text>
                  </Animated.View>
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.rowPlaceholderLayer,
                      { opacity: reveal.interpolate({ inputRange: [0, 0.6], outputRange: [1, 0], extrapolate: 'clamp' }) },
                    ]}
                  >
                    <Animated.View
                      style={[
                        styles.rowPlaceholder,
                        {
                          width: PLACEHOLDER_WIDTHS[index] ?? 64,
                          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }),
                        },
                      ]}
                    />
                  </Animated.View>
                </View>
              </View>
            );
          })}
        </View>

        <Animated.View style={{ opacity: footerFade }} pointerEvents="none">
          <Text style={[styles.editNote, { fontFamily }]}>
            Something off? You can edit all of these on the next screen.
          </Text>
        </Animated.View>
      </View>

      <Animated.View style={[styles.footer, { opacity: footerFade }]} pointerEvents={revealed ? 'auto' : 'none'}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Continue"
          onPress={onContinue}
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
        >
          <Text style={[styles.ctaLabel, { fontFamily }]}>Continue</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={onBack}
          style={({ pressed }) => [styles.backLink, pressed && { opacity: 0.7 }]}
        >
          <Text style={[styles.backText, { fontFamily }]}>Back</Text>
        </Pressable>
      </Animated.View>
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
  checkBadge: {
    width: 68,
    height: 68,
    borderRadius: 999,
    backgroundColor: PURPLE,
    borderWidth: 2,
    borderColor: '#5B21B6',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 22,
    shadowColor: PURPLE,
    shadowOpacity: 0.32,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  badgeLayer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
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
    minHeight: 40,
  },
  importedLabel: {
    color: FAINT,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 28,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  card: {
    backgroundColor: SURFACE,
    borderWidth: 1.5,
    borderColor: '#C9B6FF',
    borderRadius: 18,
    paddingHorizontal: 18,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1EAFD',
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowLabel: {
    color: '#475467',
    fontSize: 13.5,
    fontWeight: '700',
  },
  rowValueSlot: {
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  rowPlaceholderLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  rowPlaceholder: {
    height: 12,
    borderRadius: 6,
    backgroundColor: BORDER,
  },
  rowValue: {
    color: INK,
    fontSize: 14.5,
    fontWeight: '800',
  },
  editNote: {
    color: MUTED,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 14,
    paddingHorizontal: 12,
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
  backLink: {
    alignSelf: 'center',
    marginTop: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  backText: {
    color: MUTED,
    fontSize: 14.5,
    fontWeight: '700',
  },
});
