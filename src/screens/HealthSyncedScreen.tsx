import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFonts } from 'expo-font';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { getAgeFromDateOfBirth, getHealthProviderLabel, HealthBasics } from '../integrations/health';
import { t } from '../lib/i18n';
import { Theme, useThemedStyles } from '../theming';
import { AppLanguage } from '../types/models';

// Light design tokens (HG palette, same as WelcomeScreen).
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
  language?: AppLanguage;
  onContinue: () => void;
  onBack: () => void;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const PLACEHOLDER_WIDTHS = [64, 52, 46, 110];

function formatDateOfBirth(dateOfBirth: string | null, language: AppLanguage) {
  if (!dateOfBirth) {
    return null;
  }
  const date = new Date(dateOfBirth);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const age = getAgeFromDateOfBirth(dateOfBirth);
  const formatted =
    language === 'fi'
      ? `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}`
      : `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  return age === null ? formatted : `${formatted} (${age})`;
}

function formatSex(sex: HealthBasics['sex'], language: AppLanguage) {
  if (sex === 'male') {
    return t(language, 'aboutYou.gender.male');
  }
  if (sex === 'female') {
    return t(language, 'aboutYou.gender.female');
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

export function HealthSyncedScreen({ basics, language = 'en', onContinue, onBack }: HealthSyncedScreenProps) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const [manropeLoaded] = useFonts({ Manrope: require('../../assets/fonts/Manrope.ttf') });
  const fontFamily = manropeLoaded ? 'Manrope' : undefined;
  const providerLabel = getHealthProviderLabel();

  const rows: Array<{ label: string; value: string }> = [];
  if (typeof basics.weightKg === 'number' && Number.isFinite(basics.weightKg)) {
    rows.push({ label: t(language, 'health.synced.row.weight'), value: `${basics.weightKg} kg` });
  }
  if (typeof basics.heightCm === 'number' && Number.isFinite(basics.heightCm)) {
    rows.push({ label: t(language, 'health.synced.row.height'), value: `${basics.heightCm} cm` });
  }
  const sexValue = formatSex(basics.sex, language);
  if (sexValue) {
    rows.push({ label: t(language, 'health.synced.row.sex'), value: sexValue });
  }
  const dobValue = formatDateOfBirth(basics.dateOfBirth, language);
  if (dobValue) {
    rows.push({ label: t(language, 'health.synced.row.dob'), value: dobValue });
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

  // All interpolations built once — rebuilding them per render leaks native
  // animated nodes (disconnectAnimatedNodes crash under Fabric).
  const spinDeg = useRef(spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] })).current;
  const badgeScaleStyle = useRef({
    transform: [{ scale: checkPop.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }],
  }).current;
  const spinnerLayerStyle = useRef({
    opacity: checkPop.interpolate({ inputRange: [0, 0.35], outputRange: [1, 0], extrapolate: 'clamp' as const }),
    transform: [{ rotate: spinDeg }],
  }).current;
  const checkLayerStyle = useRef({
    opacity: checkPop.interpolate({ inputRange: [0, 0.3], outputRange: [0, 1], extrapolate: 'clamp' as const }),
    transform: [{ scale: checkPop.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }],
  }).current;
  const pulseOpacity = useRef(pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] })).current;
  const rowStyles = useRef(
    rowReveals.map((reveal) => ({
      value: {
        opacity: reveal,
        transform: [{ translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }],
      },
      placeholder: {
        opacity: reveal.interpolate({ inputRange: [0, 0.6], outputRange: [1, 0], extrapolate: 'clamp' as const }),
      },
    })),
  ).current;

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 14 }]}>
      <View style={styles.content}>
        <Animated.View style={[styles.checkBadge, badgeScaleStyle]}>
          <Animated.View style={[styles.badgeLayer, spinnerLayerStyle]}>
            <SpinnerArc />
          </Animated.View>
          <Animated.View style={[styles.badgeLayer, checkLayerStyle]}>
            <Svg width={34} height={34} viewBox="0 0 24 24" fill="none">
              <Path d="M5 12l5 5L19 7" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Animated.View>
        </Animated.View>

        <Animated.View style={{ opacity: textFade }}>
          <Text style={[styles.title, { fontFamily }]}>
            {t(language, revealed ? 'health.synced.titleDone' : 'health.synced.titleBusy', { provider: providerLabel })}
          </Text>
          <Text style={[styles.subtitle, { fontFamily }]}>
            {t(
              language,
              // "We pre-filled your details" would be a lie when the store had
              // nothing to read — say the connection worked and move on.
              revealed ? (rows.length > 0 ? 'health.synced.subDone' : 'health.synced.subDoneEmpty') : 'health.synced.subBusy',
            )}
          </Text>
        </Animated.View>

        <Text style={[styles.importedLabel, { fontFamily }]}>
          {t(language, revealed ? 'health.synced.importedFrom' : 'health.synced.importingFrom', {
            provider: providerLabel.toUpperCase(),
          })}
        </Text>
        <View style={styles.card}>
          {rows.length === 0 && revealed ? (
            <Text style={[styles.emptyNote, { fontFamily }]}>
              {t(language, 'health.synced.empty', { provider: providerLabel })}
            </Text>
          ) : null}
          {rows.map((row, index) => (
            <View key={row.label} style={[styles.row, index === rows.length - 1 && styles.rowLast]}>
              <Text style={[styles.rowLabel, { fontFamily }]}>{row.label}</Text>
              <View style={styles.rowValueSlot}>
                <Animated.View style={rowStyles[index].value}>
                  <Text style={[styles.rowValue, { fontFamily }]}>{row.value}</Text>
                </Animated.View>
                <Animated.View
                  pointerEvents="none"
                  style={[styles.rowPlaceholderLayer, rowStyles[index].placeholder]}
                >
                  <Animated.View
                    style={[
                      styles.rowPlaceholder,
                      { width: PLACEHOLDER_WIDTHS[index] ?? 64, opacity: pulseOpacity },
                    ]}
                  />
                </Animated.View>
              </View>
            </View>
          ))}
        </View>

        <Animated.View style={{ opacity: footerFade }} pointerEvents="none">
          <Text style={[styles.editNote, { fontFamily }]}>{t(language, 'health.synced.editNote')}</Text>
        </Animated.View>
      </View>

      <Animated.View style={[styles.footer, { opacity: footerFade }]} pointerEvents={revealed ? 'auto' : 'none'}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(language, 'common.continue')}
          onPress={onContinue}
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
        >
          <Text style={[styles.ctaLabel, { fontFamily }]}>{t(language, 'common.continue')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(language, 'common.back')}
          onPress={onBack}
          style={({ pressed }) => [styles.backLink, pressed && { opacity: 0.7 }]}
        >
          <Text style={[styles.backText, { fontFamily }]}>{t(language, 'common.back')}</Text>
        </Pressable>
      </Animated.View>
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
  emptyNote: {
    color: MUTED,
    fontSize: 13.5,
    lineHeight: 19,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 18,
    paddingHorizontal: 16,
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
