import React, { useState } from 'react';
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
const PURPLE_DARK = '#5B21B6';
const PURPLE_SOFT = '#EEE7FC';

type StartPath = 'build' | 'ready';

interface StartPathScreenProps {
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
  recommended?: boolean;
  selected: boolean;
  fontFamily?: string;
  accessibilityLabel: string;
  onPress: () => void;
}

function PathCard({ icon, title, body, recommended, selected, fontFamily, accessibilityLabel, onPress }: PathCardProps) {
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
          {recommended ? (
            <View style={[styles.recommendedPill, selected && styles.recommendedPillSelected]}>
              <Text
                style={[styles.recommendedPillText, selected && styles.recommendedPillTextSelected, { fontFamily }]}
              >
                RECOMMENDED
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

export function StartPathScreen({ onGuidedOnboarding, onBrowsePrograms, onBack }: StartPathScreenProps) {
  const insets = useSafeAreaInsets();
  const [manropeLoaded] = useFonts({ Manrope: require('../../assets/fonts/Manrope.ttf') });
  const fontFamily = manropeLoaded ? 'Manrope' : undefined;
  const [selected, setSelected] = useState<StartPath>('build');

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 14 }]}>
      <Text style={[styles.heading, { fontFamily }]}>How do you want to start?</Text>
      <Text style={[styles.subheading, { fontFamily }]}>You can always change your mind later.</Text>

      <View style={styles.cardStack}>
        <PathCard
          icon="sparkle"
          title="Build my plan"
          body="Answer a few quick questions and get a program that fits your goal and week."
          recommended
          selected={selected === 'build'}
          fontFamily={fontFamily}
          accessibilityLabel="Build my plan, recommended: answer a few quick questions and get a program"
          onPress={() => setSelected('build')}
        />
        <PathCard
          icon="grid"
          title="Pick a ready program"
          body="Browse the catalog and choose the program you want yourself."
          selected={selected === 'ready'}
          fontFamily={fontFamily}
          accessibilityLabel="Pick a ready program yourself from the catalog"
          onPress={() => setSelected('ready')}
        />
      </View>

      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Continue"
          onPress={() => {
            if (selected === 'build') {
              onGuidedOnboarding();
            } else {
              onBrowsePrograms();
            }
          }}
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
    padding: 20,
  },
  cardSelected: {
    backgroundColor: PURPLE,
    borderColor: PURPLE,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIconTileSelected: {
    backgroundColor: 'rgba(255,255,255,0.16)',
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
    color: MUTED,
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '600',
  },
  cardBodySelected: {
    color: 'rgba(255,255,255,0.85)',
  },
  recommendedPill: {
    borderRadius: 999,
    backgroundColor: PURPLE_SOFT,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  recommendedPillSelected: {
    backgroundColor: '#FFFFFF',
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
    borderColor: BORDER,
  },
  checkCircle: {
    width: 26,
    height: 26,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
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
