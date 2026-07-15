import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFonts } from 'expo-font';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { getHealthProviderLabel } from '../integrations/health';

// Light design tokens (HG palette, same as WelcomeScreen).
const BG = '#F7F3FF';
const SURFACE = '#FFFFFF';
const INK = '#101828';
const MUTED = '#667085';
const FAINT = '#9A93AC';
const BORDER = '#E4D8FF';
const PURPLE = '#7C3AED';
const PURPLE_LIGHT = '#EFE7FF';

export type AboutYouGender = 'male' | 'female' | null;

export interface AboutYouValues {
  name: string | null;
  gender: AboutYouGender;
  age: number;
  heightCm: number;
  weightKg: number;
}

interface AboutYouScreenProps {
  healthConnected: boolean;
  initialValues?: Partial<AboutYouValues> | null;
  onContinue: (values: AboutYouValues) => void;
  onBack: () => void;
}

const AGE_LIMITS = { min: 13, max: 100 };
const HEIGHT_LIMITS = { min: 120, max: 230 };
const WEIGHT_LIMITS = { min: 35, max: 220 };

function clamp(value: number, limits: { min: number; max: number }) {
  return Math.min(Math.max(Math.round(value), limits.min), limits.max);
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '';
  }
  const first = parts[0].charAt(0);
  const second = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
  return (first + second).toUpperCase();
}

function CheckGlyph({ color = PURPLE }: { color?: string }) {
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12l5 5L19 7" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function Stepper({
  value,
  unit,
  onDecrement,
  onIncrement,
  fontFamily,
  decrementLabel,
  incrementLabel,
}: {
  value: number;
  unit: string;
  onDecrement: () => void;
  onIncrement: () => void;
  fontFamily?: string;
  decrementLabel: string;
  incrementLabel: string;
}) {
  return (
    <View style={styles.stepperRow}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={decrementLabel}
        onPress={onDecrement}
        style={({ pressed }) => [styles.stepperButton, pressed && styles.stepperButtonPressed]}
      >
        <Text style={[styles.stepperButtonText, { fontFamily }]}>−</Text>
      </Pressable>
      <View style={styles.stepperValueWrap}>
        <Text style={[styles.stepperValue, { fontFamily }]}>{value}</Text>
        <Text style={[styles.stepperUnit, { fontFamily }]}>{unit}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={incrementLabel}
        onPress={onIncrement}
        style={({ pressed }) => [styles.stepperButton, pressed && styles.stepperButtonPressed]}
      >
        <Text style={[styles.stepperButtonText, { fontFamily }]}>+</Text>
      </Pressable>
    </View>
  );
}

export function AboutYouScreen({ healthConnected, initialValues, onContinue, onBack }: AboutYouScreenProps) {
  const insets = useSafeAreaInsets();
  const [manropeLoaded] = useFonts({ Manrope: require('../../assets/fonts/Manrope.ttf') });
  const fontFamily = manropeLoaded ? 'Manrope' : undefined;
  const providerLabel = getHealthProviderLabel();

  const [name, setName] = useState(initialValues?.name ?? '');
  const [gender, setGender] = useState<AboutYouGender>(initialValues?.gender ?? null);
  const [age, setAge] = useState(() => clamp(initialValues?.age ?? 25, AGE_LIMITS));
  const [heightCm, setHeightCm] = useState(() => clamp(initialValues?.heightCm ?? 175, HEIGHT_LIMITS));
  const [weightKg, setWeightKg] = useState(() => clamp(initialValues?.weightKg ?? 75, WEIGHT_LIMITS));

  const initials = getInitials(name);
  const hasName = initials.length > 0;

  function handleContinue() {
    const trimmed = name.trim();
    onContinue({
      name: trimmed.length > 0 ? trimmed.slice(0, 32) : null,
      gender,
      age,
      heightCm,
      weightKg,
    });
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 14 }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { fontFamily }]}>{"Let's start with you"}</Text>
        <Text style={[styles.subtitle, { fontFamily }]}>
          Add your details so we can tailor your plan. You can change everything later.
        </Text>

        <View style={styles.identityCard}>
          <View style={[styles.avatar, hasName ? styles.avatarFilled : styles.avatarEmpty]}>
            <Text style={[hasName ? styles.avatarInitials : styles.avatarPlaceholder, { fontFamily }]}>
              {hasName ? initials : '?'}
            </Text>
          </View>
          <View style={styles.nameField}>
            <Text style={[styles.fieldLabel, { fontFamily }]}>YOUR NAME</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={FAINT}
              maxLength={32}
              autoCapitalize="words"
              autoCorrect={false}
              style={[styles.nameInput, { fontFamily }]}
              accessibilityLabel="Your name"
            />
          </View>
        </View>

        {healthConnected ? (
          <View style={styles.healthBanner}>
            <View style={styles.healthBannerCheck}>
              <CheckGlyph />
            </View>
            <Text style={[styles.healthBannerText, { fontFamily }]}>
              {`We got these from ${providerLabel} — check they're correct.`}
            </Text>
          </View>
        ) : null}

        <View style={styles.fieldCard}>
          <Text style={[styles.fieldLabel, { fontFamily }]}>GENDER</Text>
          <View style={styles.genderRow}>
            {(['male', 'female'] as const).map((option) => {
              const selected = gender === option;
              return (
                <Pressable
                  key={option}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={option === 'male' ? 'Male' : 'Female'}
                  onPress={() => setGender(option)}
                  style={({ pressed }) => [
                    styles.genderTile,
                    selected && styles.genderTileSelected,
                    pressed && styles.genderTilePressed,
                  ]}
                >
                  <Text style={[styles.genderTileText, selected && styles.genderTileTextSelected, { fontFamily }]}>
                    {option === 'male' ? 'Male' : 'Female'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.fieldCard}>
          <Text style={[styles.fieldLabel, { fontFamily }]}>AGE</Text>
          <Stepper
            value={age}
            unit="years"
            fontFamily={fontFamily}
            decrementLabel="Decrease age"
            incrementLabel="Increase age"
            onDecrement={() => setAge((current) => clamp(current - 1, AGE_LIMITS))}
            onIncrement={() => setAge((current) => clamp(current + 1, AGE_LIMITS))}
          />
        </View>

        <View style={styles.fieldCard}>
          <Text style={[styles.fieldLabel, { fontFamily }]}>HEIGHT</Text>
          <Stepper
            value={heightCm}
            unit="cm"
            fontFamily={fontFamily}
            decrementLabel="Decrease height"
            incrementLabel="Increase height"
            onDecrement={() => setHeightCm((current) => clamp(current - 1, HEIGHT_LIMITS))}
            onIncrement={() => setHeightCm((current) => clamp(current + 1, HEIGHT_LIMITS))}
          />
        </View>

        <View style={styles.fieldCard}>
          <Text style={[styles.fieldLabel, { fontFamily }]}>WEIGHT</Text>
          <Stepper
            value={weightKg}
            unit="kg"
            fontFamily={fontFamily}
            decrementLabel="Decrease weight"
            incrementLabel="Increase weight"
            onDecrement={() => setWeightKg((current) => clamp(current - 1, WEIGHT_LIMITS))}
            onIncrement={() => setWeightKg((current) => clamp(current + 1, WEIGHT_LIMITS))}
          />
        </View>

        <Text style={[styles.footNote, { fontFamily }]}>You can update these later in your profile.</Text>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Continue"
          onPress={handleContinue}
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
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  title: {
    color: INK,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  subtitle: {
    color: '#475467',
    fontSize: 14.5,
    lineHeight: 20,
    fontWeight: '700',
    marginTop: 6,
  },
  identityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: SURFACE,
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 18,
    padding: 18,
    marginTop: 24,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmpty: {
    borderWidth: 2,
    borderColor: '#C9B6FF',
    borderStyle: 'dashed',
    backgroundColor: BG,
  },
  avatarFilled: {
    borderWidth: 2,
    borderColor: PURPLE,
    backgroundColor: PURPLE_LIGHT,
  },
  avatarPlaceholder: {
    color: FAINT,
    fontSize: 22,
    fontWeight: '800',
  },
  avatarInitials: {
    color: PURPLE,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  nameField: {
    flex: 1,
  },
  fieldLabel: {
    color: FAINT,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  nameInput: {
    color: INK,
    fontSize: 17,
    fontWeight: '700',
    paddingVertical: 8,
    paddingHorizontal: 0,
    borderBottomWidth: 1.5,
    borderBottomColor: '#C9B6FF',
  },
  healthBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: PURPLE_LIGHT,
    borderRadius: 15,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 14,
  },
  healthBannerCheck: {
    width: 24,
    height: 24,
    borderRadius: 999,
    backgroundColor: SURFACE,
    borderWidth: 1.5,
    borderColor: '#C9B6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  healthBannerText: {
    flex: 1,
    color: '#5B21B6',
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '700',
  },
  fieldCard: {
    backgroundColor: SURFACE,
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 18,
    padding: 18,
    marginTop: 14,
    gap: 12,
  },
  genderRow: {
    flexDirection: 'row',
    gap: 10,
  },
  genderTile: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#C9B6FF',
    backgroundColor: SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  genderTileSelected: {
    backgroundColor: PURPLE,
    borderColor: PURPLE,
  },
  genderTilePressed: {
    opacity: 0.85,
  },
  genderTileText: {
    color: INK,
    fontSize: 15,
    fontWeight: '700',
  },
  genderTileTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepperButton: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: PURPLE_LIGHT,
    borderWidth: 1.5,
    borderColor: '#C9B6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonPressed: {
    opacity: 0.7,
  },
  stepperButtonText: {
    color: PURPLE,
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 26,
  },
  stepperValueWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  stepperValue: {
    color: INK,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  stepperUnit: {
    color: MUTED,
    fontSize: 13.5,
    fontWeight: '600',
  },
  footNote: {
    color: FAINT,
    fontSize: 12.5,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 18,
  },
  footer: {
    paddingHorizontal: 24,
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
