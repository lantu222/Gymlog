import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFonts } from 'expo-font';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { OnboardingBackButton } from '../components/OnboardingBackButton';
import { t } from '../lib/i18n';
import { darkTheme, Theme, useTheme, useThemedStyles } from '../theming';
import { HG_DARK } from '../darkTheme';
import { AppLanguage } from '../types/models';

/**
 * This screen's own tokens, in two — the fourth onboarding screen to get
 * them, and the one that proved why the sweep had to be finished.
 *
 * It was missed on 2026-08-23: the theme had already been chosen by the time
 * the reader arrived, so the shell painted a near-black ground while every
 * card here stayed white and the title rendered near-black on it — invisible.
 * Reported from the phone the same morning ("liian valkoinen ja otsikkoa ei
 * näy"). Light values are the originals to the digit.
 */
interface AboutPalette {
  surface: string;
  ink: string;
  muted: string;
  faint: string;
  border: string;
  purple: string;
  purpleLight: string;
}

const ABOUT_LIGHT: AboutPalette = {
  surface: '#FFFFFF',
  ink: '#101828',
  muted: '#667085',
  faint: '#9A93AC',
  border: '#E4D8FF',
  purple: '#7C3AED',
  purpleLight: '#EFE7FF',
};

const ABOUT_DARK: AboutPalette = {
  surface: HG_DARK.surface,
  ink: HG_DARK.ink,
  muted: HG_DARK.muted,
  faint: HG_DARK.faint,
  border: HG_DARK.border,
  purple: HG_DARK.purple,
  purpleLight: HG_DARK.purpleLight,
};

const paletteFor = (theme: Theme): AboutPalette => (theme === darkTheme ? ABOUT_DARK : ABOUT_LIGHT);

export type AboutYouGender = 'male' | 'female' | null;

export interface AboutYouValues {
  name: string | null;
  gender: AboutYouGender;
  age: number;
  heightCm: number;
  weightKg: number;
}

interface AboutYouScreenProps {
  language?: AppLanguage;
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
  const styles = useThemedStyles(makeStyles);

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

export function AboutYouScreen({
  language = 'en',
  initialValues,
  onContinue,
  onBack,
}: AboutYouScreenProps) {
  const styles = useThemedStyles(makeStyles);
  const C = paletteFor(useTheme());
  const insets = useSafeAreaInsets();
  const [manropeLoaded] = useFonts({ Manrope: require('../../assets/fonts/Manrope.ttf') });
  const fontFamily = manropeLoaded ? 'Manrope' : undefined;

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
    // Top padding = inset + the back chevron (10 + 40) + a gap, so the title
    // starts under the button instead of behind it.
    <View style={[styles.screen, { paddingTop: insets.top + 10 + 40 + 22, paddingBottom: insets.bottom + 14 }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { fontFamily }]}>{t(language, 'aboutYou.title')}</Text>
        {/* The sub-line ("add your details… change everything later"), the
            "?" avatar and the three zero counters are gone (user, 2026-08-19).
            A profile card that says 0 · 0 · 0 and "fresh profile" before the
            reader has typed a letter is a receipt for nothing; the step is a
            form, and the form is enough. */}

        <View style={styles.identityCard}>
          <View>
            <Text style={[styles.fieldLabel, { fontFamily }]}>{t(language, 'aboutYou.label.name')}</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={t(language, 'aboutYou.namePlaceholder')}
              placeholderTextColor={C.faint}
              maxLength={32}
              autoCapitalize="words"
              autoCorrect={false}
              style={[styles.nameInput, { fontFamily }]}
              accessibilityLabel={t(language, 'aboutYou.namePlaceholder')}
            />
          </View>
        </View>


        <View style={styles.fieldCard}>
          <Text style={[styles.fieldLabel, { fontFamily }]}>{t(language, 'aboutYou.label.gender')}</Text>
          <View style={styles.genderRow}>
            {(['male', 'female'] as const).map((option) => {
              const selected = gender === option;
              const label = t(language, option === 'male' ? 'aboutYou.gender.male' : 'aboutYou.gender.female');
              return (
                <Pressable
                  key={option}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={label}
                  onPress={() => setGender(option)}
                  style={({ pressed }) => [
                    styles.genderTile,
                    selected && styles.genderTileSelected,
                    pressed && styles.genderTilePressed,
                  ]}
                >
                  <Text style={[styles.genderTileText, selected && styles.genderTileTextSelected, { fontFamily }]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.fieldCard}>
          <Text style={[styles.fieldLabel, { fontFamily }]}>{t(language, 'aboutYou.label.age')}</Text>
          <Stepper
            value={age}
            unit={t(language, 'aboutYou.unit.years')}
            fontFamily={fontFamily}
            decrementLabel={t(language, 'aboutYou.a11y.decreaseAge')}
            incrementLabel={t(language, 'aboutYou.a11y.increaseAge')}
            onDecrement={() => setAge((current) => clamp(current - 1, AGE_LIMITS))}
            onIncrement={() => setAge((current) => clamp(current + 1, AGE_LIMITS))}
          />
        </View>

        <View style={styles.fieldCard}>
          <Text style={[styles.fieldLabel, { fontFamily }]}>{t(language, 'aboutYou.label.height')}</Text>
          <Stepper
            value={heightCm}
            unit="cm"
            fontFamily={fontFamily}
            decrementLabel={t(language, 'aboutYou.a11y.decreaseHeight')}
            incrementLabel={t(language, 'aboutYou.a11y.increaseHeight')}
            onDecrement={() => setHeightCm((current) => clamp(current - 1, HEIGHT_LIMITS))}
            onIncrement={() => setHeightCm((current) => clamp(current + 1, HEIGHT_LIMITS))}
          />
        </View>

        <View style={styles.fieldCard}>
          <Text style={[styles.fieldLabel, { fontFamily }]}>{t(language, 'aboutYou.label.weight')}</Text>
          <Stepper
            value={weightKg}
            unit="kg"
            fontFamily={fontFamily}
            decrementLabel={t(language, 'aboutYou.a11y.decreaseWeight')}
            incrementLabel={t(language, 'aboutYou.a11y.increaseWeight')}
            onDecrement={() => setWeightKg((current) => clamp(current - 1, WEIGHT_LIMITS))}
            onIncrement={() => setWeightKg((current) => clamp(current + 1, WEIGHT_LIMITS))}
          />
        </View>

        <Text style={[styles.footNote, { fontFamily }]}>{t(language, 'aboutYou.footNote')}</Text>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(language, 'common.continue')}
          onPress={handleContinue}
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
        >
          <Text style={[styles.ctaLabel, { fontFamily }]}>{t(language, 'common.continue')}</Text>
        </Pressable>
      </View>
      <OnboardingBackButton language={language} onPress={onBack} />
    </View>
  );
}

const makeStyles = (theme: Theme) => {
  const C = paletteFor(theme);
  return StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  title: {
    color: C.ink,
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
    backgroundColor: C.surface,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 18,
    padding: 18,
    marginTop: 24,
  },
  profileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  profileStatsRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  profileStat: {
    alignItems: 'center',
    gap: 1,
  },
  profileStatValue: {
    color: C.ink,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  profileStatLabel: {
    color: C.faint,
    fontSize: 11.5,
    fontWeight: '700',
  },
  profileName: {
    color: C.ink,
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.2,
    marginTop: 14,
  },
  profileHint: {
    color: C.faint,
    fontSize: 12.5,
    fontWeight: '600',
    marginTop: 2,
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#F1EAFD',
    marginVertical: 14,
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
    backgroundColor: theme.bg,
  },
  avatarFilled: {
    borderWidth: 2,
    borderColor: C.purple,
    backgroundColor: C.purpleLight,
  },
  avatarPlaceholder: {
    color: C.faint,
    fontSize: 22,
    fontWeight: '800',
  },
  avatarInitials: {
    color: C.purple,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  fieldLabel: {
    color: C.faint,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  nameInput: {
    color: C.ink,
    fontSize: 17,
    fontWeight: '700',
    paddingVertical: 8,
    paddingHorizontal: 0,
    borderBottomWidth: 1.5,
    borderBottomColor: '#C9B6FF',
  },
  fieldCard: {
    backgroundColor: C.surface,
    borderWidth: 1.5,
    borderColor: C.border,
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
    backgroundColor: C.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  genderTileSelected: {
    backgroundColor: C.purple,
    borderColor: C.purple,
  },
  genderTilePressed: {
    opacity: 0.85,
  },
  genderTileText: {
    color: C.ink,
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
    backgroundColor: C.purpleLight,
    borderWidth: 1.5,
    borderColor: '#C9B6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonPressed: {
    opacity: 0.7,
  },
  stepperButtonText: {
    color: C.purple,
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
    color: C.ink,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  stepperUnit: {
    color: C.muted,
    fontSize: 13.5,
    fontWeight: '600',
  },
  footNote: {
    color: C.faint,
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
    backgroundColor: C.purple,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.purple,
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
    color: C.muted,
    fontSize: 14.5,
    fontWeight: '700',
  },
});
};
