import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFonts } from 'expo-font';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { getAgeFromDateOfBirth, getHealthProviderLabel, HealthBasics } from '../integrations/health';

// Light design tokens (HG palette, same as WelcomeScreen).
const BG = '#F7F3FF';
const SURFACE = '#FFFFFF';
const INK = '#101828';
const MUTED = '#667085';
const FAINT = '#9A93AC';
const BORDER = '#E4D8FF';
const PURPLE = '#7C3AED';

interface HealthSyncedScreenProps {
  basics: HealthBasics;
  onContinue: () => void;
  onBack: () => void;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 14 }]}>
      <View style={styles.content}>
        <View style={styles.checkBadge}>
          <Svg width={34} height={34} viewBox="0 0 24 24" fill="none">
            <Path d="M5 12l5 5L19 7" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </View>

        <Text style={[styles.title, { fontFamily }]}>{`Synced with ${providerLabel}`}</Text>
        <Text style={[styles.subtitle, { fontFamily }]}>
          {"We've pre-filled your details. Change anything that's off."}
        </Text>

        <Text style={[styles.importedLabel, { fontFamily }]}>{`IMPORTED FROM ${providerLabel.toUpperCase()}`}</Text>
        <View style={styles.card}>
          {rows.map((row, index) => (
            <View key={row.label} style={[styles.row, index === rows.length - 1 && styles.rowLast]}>
              <Text style={[styles.rowLabel, { fontFamily }]}>{row.label}</Text>
              <Text style={[styles.rowValue, { fontFamily }]}>{row.value}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.footer}>
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
  rowValue: {
    color: INK,
    fontSize: 14.5,
    fontWeight: '800',
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
