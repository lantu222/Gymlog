import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CutButton } from '../components/CutButton';
import { CutSurface } from '../components/CutSurface';
import { t } from '../lib/i18n';
import { PRO_UNLOCK_CARDS } from '../lib/proBenefits';
import { Theme, useTheme, useThemedStyles } from '../theming';
import { AppLanguage } from '../types/models';

/**
 * What happens the moment Premium turns on (v2, user feedback 2026-08-02).
 *
 * The first version opened with a 2.2-second splash whose centrepiece was a
 * next-load pill — the set coach demonstrating itself, a feature that had
 * been deleted the day before (the sweep cleaned every surface that read from
 * proBenefits and missed this one, which did not). It also flashed past too
 * fast to read, and ended in two buttons ("Back to my workout" / "Take a look
 * around") that were the same navigation wearing different clothes.
 *
 * Now there is one screen and the celebration is watching things switch on:
 * the checks land one by one, slowly enough to follow — the mirror image of
 * MembershipEndScreen, which strikes the same list through on the way out.
 * Both read PRO_LIVE_BENEFITS-derived data, so neither can outlive a feature.
 *
 * If the user's own log has produced a read (the plateau conclusion), it lands
 * last as proof: not a promise about the feature, the feature's actual output.
 */
interface PremiumUnlockScreenProps {
  language?: AppLanguage;
  onDone: () => void;
  /**
   * The coach's read of the user's own log; null when there is no data. The
   * card simply does not render without it — no invented specimen.
   */
  coachSpecimen?: string | null;
  /**
   * ISO date the trial would end. The app has no billing, so this is the demo
   * story the paywall already tells; releaseReadiness.test.cjs holds the other
   * end of it.
   */
  trialEndsAt: string;
}

/** Gap between one check landing and the next — slow enough to watch. */
const ROW_STAGGER_MS = 430;
const ROW_IN_MS = 420;

function formatTrialDate(iso: string, language: AppLanguage) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const day = date.getDate();
  const month = date.getMonth() + 1;
  return language === 'fi' ? `${day}.${month}.` : `${day}/${month}`;
}

function Check({ color, size = 17 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 13l4 4L19 7" stroke={color} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function PremiumUnlockScreen({
  language = 'en',
  onDone,
  coachSpecimen = null,
  trialEndsAt,
}: PremiumUnlockScreenProps) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);

  // One value drives each row: its fade, its lift and its check's pop. The
  // array is sized for every possible row so the ref stays stable; rows that
  // do not render (no specimen) just keep an unused value.
  const rowValues = useRef(
    Array.from({ length: PRO_UNLOCK_CARDS.length + 1 }, () => new Animated.Value(0)),
  ).current;
  const ctaFade = useRef(new Animated.Value(0)).current;

  // Interpolated once per mount — an inline .interpolate() rebuilds native
  // animated nodes every render, the crash this app has already paid for.
  const rowStyles = useMemo(
    () =>
      rowValues.map((value) => ({
        opacity: value,
        transform: [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
      })),
    [rowValues],
  );
  const checkStyles = useMemo(
    () =>
      rowValues.map((value) => ({
        transform: [
          { scale: value.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.2, 1.15, 1] }) },
        ],
      })),
    [rowValues],
  );

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (!cancelled) {
        setReduceMotion(enabled);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (reduceMotion === null) {
      return;
    }
    if (reduceMotion) {
      // The settled state is the content; the animation must never hide it.
      rowValues.forEach((value) => value.setValue(1));
      ctaFade.setValue(1);
      return;
    }
    const rowCount = PRO_UNLOCK_CARDS.length + (coachSpecimen ? 1 : 0);
    Animated.sequence([
      Animated.delay(300),
      Animated.stagger(ROW_STAGGER_MS, [
        ...rowValues.slice(0, rowCount).map((value) =>
          Animated.timing(value, {
            toValue: 1,
            duration: ROW_IN_MS,
            easing: Easing.bezier(0.22, 1, 0.36, 1),
            useNativeDriver: true,
          }),
        ),
        Animated.timing(ctaFade, { toValue: 1, duration: 360, useNativeDriver: true }),
      ]),
    ]).start();
  }, [coachSpecimen, ctaFade, reduceMotion, rowValues]);

  const trialDate = useMemo(() => formatTrialDate(trialEndsAt, language), [language, trialEndsAt]);

  if (reduceMotion === null) {
    return <View style={styles.screen} />;
  }

  return (
    <View style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.activeRow}>
          <View style={styles.activeDot}>
            <Check color="#FFFFFF" size={15} />
          </View>
          <Text style={styles.activeLabel}>{t(language, 'unlock.active')}</Text>
        </View>

        <Text style={styles.title}>{t(language, 'unlock.title')}</Text>
        <Text style={styles.lead}>{t(language, 'unlock.lead')}</Text>

        <View style={styles.cards}>
          {PRO_UNLOCK_CARDS.map((card, index) => (
            <Animated.View key={card.titleKey} style={rowStyles[index]}>
              <CutSurface size="lg" fill={theme.surface} stroke={theme.border} strokeWidth={1} style={styles.card}>
                <View style={styles.cardHead}>
                  <Animated.View style={[styles.checkDot, checkStyles[index]]}>
                    <Check color="#FFFFFF" size={13} />
                  </Animated.View>
                  <Text style={styles.cardTitle}>{t(language, card.titleKey)}</Text>
                </View>
                <Text style={styles.cardBody}>{t(language, card.bodyKey)}</Text>
                <Text style={styles.cardTo}>{t(language, card.placeKey)}</Text>
              </CutSurface>
            </Animated.View>
          ))}

          {/* The payoff, and only when it is real: the reads just unlocked, so
              here is the first one — computed from their own log, not a sample. */}
          {coachSpecimen ? (
            <Animated.View style={rowStyles[PRO_UNLOCK_CARDS.length]}>
              <CutSurface size="lg" fill={theme.purpleLight} stroke={theme.border} strokeWidth={1} style={styles.specimen}>
                <Text style={styles.specimenKicker}>{t(language, 'unlock.specimen.kicker')}</Text>
                <Text style={styles.specimenText}>{coachSpecimen}</Text>
                <Text style={styles.specimenTo}>{t(language, 'unlock.reads.to')}</Text>
              </CutSurface>
            </Animated.View>
          ) : null}
        </View>

        {/* The trial end date up front — the thing that kills a day-7 surprise
            cancel. There is no billing yet; see PremiumScreen's CTA note. */}
        <CutSurface size="md" fill={theme.surfaceSoft} stroke={theme.border} strokeWidth={1} style={styles.trial}>
          <Text style={styles.trialTitle}>{t(language, 'unlock.trialTitle', { date: trialDate })}</Text>
          <Text style={styles.trialBody}>{t(language, 'unlock.trialBody')}</Text>
        </CutSurface>

        <Text style={styles.noBadge}>{t(language, 'unlock.noBadge')}</Text>
      </ScrollView>

      <Animated.View style={[styles.ctaBar, { opacity: ctaFade, paddingBottom: insets.bottom + 12 }]}>
        <CutButton size="lg" label={t(language, 'unlock.cta')} onPress={onDone} />
      </Animated.View>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: theme.bg,
    },
    content: {
      paddingHorizontal: 20,
      paddingTop: 18,
      paddingBottom: 20,
    },
    activeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    activeDot: {
      width: 26,
      height: 26,
      borderRadius: 999,
      backgroundColor: theme.green,
      alignItems: 'center',
      justifyContent: 'center',
    },
    activeLabel: {
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 1.2,
      color: theme.green,
    },
    title: {
      fontSize: 27,
      fontWeight: '800',
      letterSpacing: -0.7,
      color: theme.ink,
      marginTop: 14,
      lineHeight: 31,
    },
    lead: {
      fontSize: 13.5,
      fontWeight: '600',
      color: theme.muted,
      marginTop: 8,
      lineHeight: 20,
    },
    cards: {
      gap: 10,
      marginTop: 20,
    },
    card: {
      paddingVertical: 14,
      paddingHorizontal: 15,
    },
    cardHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
    },
    // Green filled dot, not an outline: these rows are the ON state, the same
    // green the membership screen answers with a red strike on the way out.
    checkDot: {
      width: 22,
      height: 22,
      borderRadius: 999,
      backgroundColor: theme.green,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardTitle: {
      fontSize: 15,
      fontWeight: '800',
      color: theme.ink,
      flexShrink: 1,
    },
    cardBody: {
      fontSize: 12.5,
      fontWeight: '600',
      color: theme.muted,
      marginTop: 5,
      lineHeight: 18.5,
      paddingLeft: 31,
    },
    cardTo: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.7,
      color: theme.highlight,
      marginTop: 8,
      paddingLeft: 31,
    },
    specimen: {
      paddingVertical: 14,
      paddingHorizontal: 15,
    },
    specimenKicker: {
      fontSize: 10.5,
      fontWeight: '800',
      letterSpacing: 1.5,
      color: theme.purpleDark,
    },
    specimenText: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.ink,
      lineHeight: 20.5,
      marginTop: 7,
    },
    specimenTo: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.7,
      color: theme.highlight,
      marginTop: 9,
    },
    trial: {
      marginTop: 18,
      paddingVertical: 13,
      paddingHorizontal: 15,
    },
    trialTitle: {
      fontSize: 13.5,
      fontWeight: '800',
      color: theme.ink,
    },
    trialBody: {
      fontSize: 11.5,
      fontWeight: '600',
      color: theme.muted,
      marginTop: 6,
      lineHeight: 17,
    },
    noBadge: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.faint,
      marginTop: 18,
      lineHeight: 19,
    },
    ctaBar: {
      paddingHorizontal: 20,
      paddingTop: 12,
      backgroundColor: theme.surface,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
  });
