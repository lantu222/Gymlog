import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFonts } from 'expo-font';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { t } from '../lib/i18n';
import { Theme, useThemedStyles } from '../theming';
import { AppLanguage } from '../types/models';

// Light design tokens (HG palette, same as WelcomeScreen).
const SURFACE = '#FFFFFF';
const INK = '#101828';
const MUTED = '#667085';
const BORDER = '#E4D8FF';
const PURPLE = '#7C3AED';
const PURPLE_DARK = '#5B21B6';
const PURPLE_SOFT = '#EEE7FC';

type StartPath = 'build' | 'ready';

interface StartPathScreenProps {
  language?: AppLanguage;
  onGuidedOnboarding: () => void;
  onBrowsePrograms: () => void;
  onBack: () => void;
}

function PathIcon({ name, color }: { name: 'sparkle' | 'grid'; color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      {name === 'sparkle' ? (
        <Path
          d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3zM19 16l.9 2.1L22 19l-2.1.9L19 22l-.9-2.1L16 19l2.1-.9L19 16z"
          stroke={color}
          strokeWidth={1.8}
          strokeLinejoin="round"
        />
      ) : null}
      {name === 'grid' ? (
        <Path
          d="M4 4h7v7H4V4zm9 0h7v7h-7V4zM4 13h7v7H4v-7zm9 0h7v7h-7v-7z"
          stroke={color}
          strokeWidth={1.8}
          strokeLinejoin="round"
        />
      ) : null}
    </Svg>
  );
}

function CheckCircle({ selected }: { selected: boolean }) {
  const styles = useThemedStyles(makeStyles);

  if (!selected) {
    return <View style={styles.checkRing} />;
  }
  return (
    <View style={styles.checkCircle}>
      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
        <Path d="M5 12l5 5L19 7" stroke={PURPLE} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

interface PathCardProps {
  icon: 'sparkle' | 'grid';
  title: string;
  body: string;
  recommendedLabel?: string | null;
  selected: boolean;
  fontFamily?: string;
  accessibilityLabel: string;
  onPress: () => void;
}

function PathCard({ icon, title, body, recommendedLabel, selected, fontFamily, accessibilityLabel, onPress }: PathCardProps) {
  const styles = useThemedStyles(makeStyles);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.card, selected && styles.cardSelected, pressed && styles.cardPressed]}
    >
      <View style={[styles.cardIconTile, selected && styles.cardIconTileSelected]}>
        <PathIcon name={icon} color={selected ? '#FFFFFF' : PURPLE} />
      </View>
      <View style={styles.cardCopy}>
        <View style={styles.cardTitleRow}>
          <Text style={[styles.cardTitle, selected && styles.cardTitleSelected, { fontFamily }]}>{title}</Text>
          {recommendedLabel ? (
            <View style={[styles.recommendedPill, selected && styles.recommendedPillSelected]}>
              <Text
                style={[styles.recommendedPillText, selected && styles.recommendedPillTextSelected, { fontFamily }]}
              >
                {recommendedLabel}
              </Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.cardBody, selected && styles.cardBodySelected, { fontFamily }]}>{body}</Text>
      </View>
      <CheckCircle selected={selected} />
    </Pressable>
  );
}

export function StartPathScreen({
  language = 'en',
  onGuidedOnboarding,
  onBrowsePrograms,
  onBack,
}: StartPathScreenProps) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const [manropeLoaded] = useFonts({ Manrope: require('../../assets/fonts/Manrope.ttf') });
  const fontFamily = manropeLoaded ? 'Manrope' : undefined;
  const [selected, setSelected] = useState<StartPath>('build');

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 14 }]}>
      <Text style={[styles.heading, { fontFamily }]}>{t(language, 'startPath.heading')}</Text>
      <Text style={[styles.subheading, { fontFamily }]}>{t(language, 'startPath.sub')}</Text>

      <View style={styles.cardStack}>
        <PathCard
          icon="sparkle"
          title={t(language, 'startPath.build.title')}
          body={t(language, 'startPath.build.body')}
          recommendedLabel={t(language, 'common.recommended')}
          selected={selected === 'build'}
          fontFamily={fontFamily}
          accessibilityLabel={t(language, 'startPath.build.a11y')}
          onPress={() => setSelected('build')}
        />
        <PathCard
          icon="grid"
          title={t(language, 'startPath.ready.title')}
          body={t(language, 'startPath.ready.body')}
          selected={selected === 'ready'}
          fontFamily={fontFamily}
          accessibilityLabel={t(language, 'startPath.ready.a11y')}
          onPress={() => setSelected('ready')}
        />
      </View>

      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(language, 'common.continue')}
          onPress={() => {
            if (selected === 'build') {
              onGuidedOnboarding();
            } else {
              onBrowsePrograms();
            }
          }}
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
  heading: {
    color: INK,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  subheading: {
    color: '#475467',
    fontSize: 14.5,
    lineHeight: 20,
    fontWeight: '700',
    marginTop: 6,
  },
  cardStack: {
    marginTop: 28,
    gap: 14,
    flex: 1,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: BORDER,
    backgroundColor: SURFACE,
    padding: 20,
  },
  cardSelected: {
    backgroundColor: PURPLE,
    borderWidth: 2,
    borderColor: PURPLE_DARK,
    shadowColor: PURPLE,
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 16 },
    elevation: 8,
  },
  cardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  cardIconTile: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: PURPLE_SOFT,
    borderWidth: 1.5,
    borderColor: '#C9B6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIconTileSelected: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderColor: 'rgba(255,255,255,0.7)',
  },
  cardCopy: {
    flex: 1,
    gap: 4,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  cardTitle: {
    color: INK,
    fontSize: 18.5,
    lineHeight: 23,
    fontWeight: '800',
  },
  cardTitleSelected: {
    color: '#FFFFFF',
  },
  cardBody: {
    color: '#475467',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  cardBodySelected: {
    color: 'rgba(255,255,255,0.95)',
  },
  recommendedPill: {
    borderRadius: 999,
    backgroundColor: PURPLE_SOFT,
    borderWidth: 1.5,
    borderColor: '#C9B6FF',
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  recommendedPillSelected: {
    backgroundColor: '#FFFFFF',
    borderColor: PURPLE_DARK,
  },
  recommendedPillText: {
    color: PURPLE,
    fontSize: 9.5,
    lineHeight: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  recommendedPillTextSelected: {
    color: PURPLE_DARK,
  },
  checkRing: {
    width: 26,
    height: 26,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#C9B6FF',
  },
  checkCircle: {
    width: 26,
    height: 26,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: PURPLE_DARK,
    alignItems: 'center',
    justifyContent: 'center',
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
