import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFonts } from 'expo-font';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

// Light design tokens (HG palette, same as WelcomeScreen).
const BG = '#F7F3FF';
const SURFACE = '#FFFFFF';
const INK = '#101828';
const MUTED = '#667085';
const BORDER = '#E4D8FF';
const PURPLE = '#7C3AED';
const PURPLE_SOFT = '#EEE7FC';

interface StartPathScreenProps {
  onGuidedOnboarding: () => void;
  onBrowsePrograms: () => void;
  onBack: () => void;
}

function PathIcon({ name }: { name: 'sparkle' | 'grid' | 'lock' }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      {name === 'sparkle' ? (
        <Path
          d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3zM19 16l.9 2.1L22 19l-2.1.9L19 22l-.9-2.1L16 19l2.1-.9L19 16z"
          stroke={PURPLE}
          strokeWidth={1.8}
          strokeLinejoin="round"
        />
      ) : null}
      {name === 'grid' ? (
        <Path
          d="M4 4h7v7H4V4zm9 0h7v7h-7V4zM4 13h7v7H4v-7zm9 0h7v7h-7v-7z"
          stroke={PURPLE}
          strokeWidth={1.8}
          strokeLinejoin="round"
        />
      ) : null}
      {name === 'lock' ? (
        <Path
          d="M7 11V8a5 5 0 0110 0v3M6 11h12v9H6v-9z"
          stroke={MUTED}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
    </Svg>
  );
}

export function StartPathScreen({ onGuidedOnboarding, onBrowsePrograms, onBack }: StartPathScreenProps) {
  const insets = useSafeAreaInsets();
  const [manropeLoaded] = useFonts({ Manrope: require('../../assets/fonts/Manrope.ttf') });
  const fontFamily = manropeLoaded ? 'Manrope' : undefined;

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 22 }]}>
      <Text style={[styles.heading, { fontFamily }]}>How do you want to start?</Text>
      <Text style={[styles.subheading, { fontFamily }]}>You can always change your mind later.</Text>

      <View style={styles.cardStack}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Build my plan, recommended: answer a few quick questions and get a program"
          onPress={onGuidedOnboarding}
          style={({ pressed }) => [styles.card, styles.cardPrimary, pressed && styles.cardPressed]}
        >
          <View style={styles.cardIconRing}>
            <PathIcon name="sparkle" />
          </View>
          <View style={styles.cardCopy}>
            <View style={styles.cardTitleRow}>
              <Text style={[styles.cardTitle, { fontFamily }]}>Build my plan</Text>
              <View style={styles.recommendedPill}>
                <Text style={[styles.recommendedPillText, { fontFamily }]}>RECOMMENDED</Text>
              </View>
            </View>
            <Text style={[styles.cardBody, { fontFamily }]}>
              Answer a few quick questions and get a program that fits your goal and week.
            </Text>
          </View>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Pick a ready program yourself from the catalog"
          onPress={onBrowsePrograms}
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        >
          <View style={styles.cardIconRing}>
            <PathIcon name="grid" />
          </View>
          <View style={styles.cardCopy}>
            <Text style={[styles.cardTitle, { fontFamily }]}>Pick a ready program</Text>
            <Text style={[styles.cardBody, { fontFamily }]}>
              Browse the catalog and choose the program you want yourself.
            </Text>
          </View>
        </Pressable>

        <View
          accessible
          accessibilityLabel="AI-built custom program, coming soon"
          style={[styles.card, styles.cardLocked]}
        >
          <View style={[styles.cardIconRing, styles.cardIconRingLocked]}>
            <PathIcon name="lock" />
          </View>
          <View style={styles.cardCopy}>
            <View style={styles.cardTitleRow}>
              <Text style={[styles.cardTitle, styles.cardTitleLocked, { fontFamily }]}>AI-built custom program</Text>
              <View style={styles.comingSoonPill}>
                <Text style={[styles.comingSoonPillText, { fontFamily }]}>COMING SOON</Text>
              </View>
            </View>
            <Text style={[styles.cardBody, { fontFamily }]}>
              A personal plan built from scratch by your AI coach.
            </Text>
          </View>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={onBack}
        style={({ pressed }) => [styles.backLink, pressed && { opacity: 0.7 }]}
      >
        <Text style={[styles.backText, { fontFamily }]}>Back</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG,
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
    color: MUTED,
    fontSize: 14.5,
    lineHeight: 20,
    fontWeight: '600',
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
    padding: 18,
  },
  cardPrimary: {
    borderColor: PURPLE,
    borderWidth: 2,
  },
  cardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  cardLocked: {
    opacity: 0.72,
    backgroundColor: BG,
  },
  cardIconRing: {
    width: 48,
    height: 48,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: BORDER,
    backgroundColor: PURPLE_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIconRingLocked: {
    backgroundColor: SURFACE,
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
    fontSize: 16.5,
    lineHeight: 21,
    fontWeight: '800',
  },
  cardTitleLocked: {
    color: MUTED,
  },
  cardBody: {
    color: MUTED,
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '600',
  },
  recommendedPill: {
    borderRadius: 999,
    backgroundColor: PURPLE_SOFT,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  recommendedPillText: {
    color: PURPLE,
    fontSize: 9.5,
    lineHeight: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  comingSoonPill: {
    borderRadius: 999,
    backgroundColor: '#ECE9F2',
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  comingSoonPillText: {
    color: MUTED,
    fontSize: 9.5,
    lineHeight: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  backLink: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  backText: {
    color: MUTED,
    fontSize: 14.5,
    fontWeight: '700',
  },
});
