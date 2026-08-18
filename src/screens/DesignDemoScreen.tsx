import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { BlurredPreview, ProPreviewCard } from '../components/BlurredPreview';
import { RateAppSheet } from '../components/RateAppSheet';
import { ScreenHeaderTitle } from '../components/ScreenHeaderTitle';
import { t } from '../lib/i18n';
import {
  RATING_MIN_SESSIONS,
  RatingPromptState,
  decideRatingPrompt,
  emptyRatingPromptState,
  recordRatingAsked,
  recordRatingCompleted,
} from '../lib/ratingPrompt';
import { Theme, useTheme, useThemedStyles } from '../theming';
import { AppLanguage } from '../types/models';

/**
 * Where finished-but-unwired components live so they are not forgotten.
 *
 * Two things sit here right now, both from the Home Workout teardown
 * (2026-08-13): the blurred Pro preview and the store-rating ask. Neither has a
 * caller in the app. This screen is the caller, so the work is visible on a
 * device and can be judged before it is wired into a real moment.
 *
 * Delete this screen once both have real callers.
 */
interface DesignDemoScreenProps {
  language: AppLanguage;
  onBack: () => void;
}

/** Six weeks of squat volume, so the blurred bars have a real shape. */
const DEMO_BARS = [7400, 7900, 7650, 8300, 8100, 8850];

export function DesignDemoScreen({ language, onBack }: DesignDemoScreenProps) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [ratingVisible, setRatingVisible] = useState(false);
  const [nudge, setNudge] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  // The demo runs the real gate against a local state, so the rules are
  // visible on device rather than only in the unit test. A wired build reads
  // and writes this through AppProvider instead.
  const [promptState, setPromptState] = useState<RatingPromptState>(emptyRatingPromptState);

  const decision = decideRatingPrompt({
    state: promptState,
    sessionsLogged: RATING_MIN_SESSIONS,
    atPeakMoment: true,
    nowMs: Date.now(),
  });

  const openRating = (withNudge: boolean) => {
    setNudge(withNudge);
    setPicked(null);
    setPromptState((current) => recordRatingAsked(current, Date.now()));
    setRatingVisible(true);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(language, 'common.back')}
          onPress={onBack}
          style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.75 }]}
        >
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path d="M15 5l-7 7 7 7" stroke={theme.ink} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
        <ScreenHeaderTitle title={t(language, 'designDemo.title')} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
        <Text style={styles.lead}>{t(language, 'designDemo.lead')}</Text>

        <Text style={styles.sectionLabel}>{t(language, 'designDemo.blur.section')}</Text>
        <Text style={styles.note}>{t(language, 'designDemo.blur.note')}</Text>
        <ProPreviewCard
          language={language}
          teaser={t(language, 'designDemo.blur.teaser')}
          content={{ kind: 'text', text: t(language, 'designDemo.blur.body') }}
          overlayTitle={t(language, 'designDemo.blur.overlay')}
          previewHeight={92}
          onPress={() => undefined}
        />

        {/* The same blur with no overlay, so the sigma can be judged on its
            own: the words have to be gone while the paragraph shape stays. */}
        <View style={styles.bareBlurCard}>
          <BlurredPreview
            content={{ kind: 'text', text: t(language, 'designDemo.blur.body') }}
            height={86}
          />
        </View>

        <Text style={styles.sectionLabel}>{t(language, 'designDemo.bars.section')}</Text>
        <ProPreviewCard
          language={language}
          teaser={t(language, 'designDemo.bars.teaser')}
          content={{ kind: 'bars', values: DEMO_BARS }}
          overlayTitle={t(language, 'designDemo.bars.overlay')}
          previewHeight={104}
          onPress={() => undefined}
        />

        <Text style={styles.sectionLabel}>{t(language, 'designDemo.rating.section')}</Text>
        <Text style={styles.note}>{t(language, 'designDemo.rating.note')}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => openRating(false)}
          style={({ pressed }) => [styles.demoButton, pressed && styles.pressed]}
        >
          <Text style={styles.demoButtonText}>{t(language, 'designDemo.rating.open')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => openRating(true)}
          style={({ pressed }) => [styles.demoButton, styles.demoButtonGhost, pressed && styles.pressed]}
        >
          <Text style={[styles.demoButtonText, styles.demoButtonGhostText]}>
            {t(language, 'designDemo.rating.openNudge')}
          </Text>
        </Pressable>
        {picked !== null ? (
          <Text style={styles.result}>{t(language, 'designDemo.rating.picked', { count: picked })}</Text>
        ) : null}
        <Text style={styles.gateReadout}>
          {t(language, 'designDemo.rating.gate', {
            asks: promptState.askCount,
            verdict: decision.ask ? 'ask' : decision.reason,
          })}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => setPromptState(emptyRatingPromptState)}
          hitSlop={8}
        >
          <Text style={styles.resetLink}>{t(language, 'designDemo.rating.reset')}</Text>
        </Pressable>
      </ScrollView>

      <RateAppSheet
        visible={ratingVisible}
        language={language}
        nudgeBestStar={nudge}
        // A demo must not open the store. It reports the star and closes, which
        // is exactly what the real caller will do before the deep link.
        onRate={(rating) => {
          setPicked(rating);
          setPromptState(recordRatingCompleted);
          setRatingVisible(false);
        }}
        onDismiss={() => setRatingVisible(false)}
      />
    </View>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    paddingHorizontal: 18,
    paddingBottom: 48,
    gap: 12,
  },
  lead: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    color: theme.muted,
  },
  sectionLabel: {
    marginTop: 14,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: theme.faint,
  },
  note: {
    fontSize: 12.5,
    fontWeight: '600',
    lineHeight: 18,
    color: theme.muted,
  },
  bareBlurCard: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 14,
    padding: 14,
  },
  demoButton: {
    height: 50,
    borderRadius: 14,
    backgroundColor: theme.highlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  demoButtonGhost: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
  },
  pressed: {
    opacity: 0.8,
  },
  demoButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.onHighlight,
  },
  demoButtonGhostText: {
    color: theme.ink,
  },
  result: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.ink,
    textAlign: 'center',
  },
  gateReadout: {
    fontSize: 12.5,
    fontWeight: '700',
    color: theme.muted,
    textAlign: 'center',
  },
  resetLink: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.highlight,
    textAlign: 'center',
  },
});
