import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { CARD_SHADOW } from '../components/SettingsUi';
import { GENERATED_EXERCISE_LIBRARY } from '../data/generatedExerciseLibrary';
import { WORKOUT_TEMPLATES_V1 } from '../features/workout/workoutCatalog';
import { I18nKey, t } from '../lib/i18n';
import { HG } from '../lightTheme';
import { layout } from '../theme';
import { AppLanguage } from '../types/models';

interface ProOfferScreenProps {
  language?: AppLanguage;
  onContinueFree: () => void;
  onSeePro: () => void;
}

/**
 * The post-onboarding Pro/Free split (user decision 2026-07-28), shown once on
 * the plan-ready → Home path.
 *
 * Free-first on purpose: the screen opens with everything the user just got
 * without paying, then names the three Pro features. Every count is read from
 * the code (`WORKOUT_TEMPLATES_V1.length`, `GENERATED_EXERCISE_LIBRARY.length`)
 * and every Pro line is implemented and gated — the paywall audit
 * (tests/lib/proSurfaces.test.cjs) exists because invented figures shipped
 * here once already. Billing is not live, so the Pro button explains rather
 * than sells, and continuing free is the primary action.
 */
const FREE_ROWS: I18nKey[] = [
  'proOffer.free.programs',
  'proOffer.free.logging',
  'proOffer.free.library',
  'proOffer.free.progress',
  'proOffer.free.cardio',
];

const PRO_ROWS: Array<{ titleKey: I18nKey; bodyKey: I18nKey }> = [
  { titleKey: 'proOffer.pro.coach', bodyKey: 'proOffer.pro.coachBody' },
  { titleKey: 'proOffer.pro.progression', bodyKey: 'proOffer.pro.progressionBody' },
  { titleKey: 'proOffer.pro.adaptive', bodyKey: 'proOffer.pro.adaptiveBody' },
];

function CheckGlyph() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M5 13l4 4L19 7" stroke={HG.green} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function SparkGlyph({ color }: { color: string }) {
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24">
      <Path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" fill={color} />
    </Svg>
  );
}

export function ProOfferScreen({ language = 'en', onContinueFree, onSeePro }: ProOfferScreenProps) {
  return (
    <View style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
        <Text style={styles.kicker}>{t(language, 'proOffer.kicker')}</Text>
        <Text style={styles.title}>{t(language, 'proOffer.title')}</Text>
        <Text style={styles.subtitle}>{t(language, 'proOffer.subtitle')}</Text>

        {/* Everything free — the part the user already has. */}
        <View style={[styles.card, styles.freeCard]}>
          <Text style={styles.freeLabel}>{t(language, 'proOffer.freeLabel')}</Text>
          {FREE_ROWS.map((key) => (
            <View key={key} style={styles.freeRow}>
              <CheckGlyph />
              <Text style={styles.freeRowText}>
                {t(language, key, {
                  programs: WORKOUT_TEMPLATES_V1.length,
                  exercises: GENERATED_EXERCISE_LIBRARY.length,
                })}
              </Text>
            </View>
          ))}
        </View>

        {/* The Pro layer — three features, all implemented and gated. */}
        <View style={styles.proCard}>
          <View style={styles.proHead}>
            <SparkGlyph color={HG.gold} />
            <Text style={styles.proLabel}>{t(language, 'proOffer.proLabel')}</Text>
          </View>
          {PRO_ROWS.map((row) => (
            <View key={row.titleKey} style={styles.proRow}>
              <Text style={styles.proRowTitle}>{t(language, row.titleKey)}</Text>
              <Text style={styles.proRowBody}>{t(language, row.bodyKey)}</Text>
            </View>
          ))}
          <Text style={styles.proFine}>{t(language, 'proOffer.proFine')}</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={onContinueFree}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
        >
          <Text style={styles.primaryButtonText}>{t(language, 'proOffer.continueFree')}</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={onSeePro}
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
        >
          <Text style={styles.secondaryButtonText}>{t(language, 'proOffer.seePro')}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: HG.bg,
  },
  body: {
    paddingTop: 18,
    paddingHorizontal: 20,
    paddingBottom: layout.bottomTabBarReserve,
  },
  kicker: {
    color: HG.purple,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  title: {
    color: HG.ink,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginTop: 8,
  },
  subtitle: {
    color: HG.muted,
    fontSize: 14.5,
    fontWeight: '600',
    lineHeight: 21,
    marginTop: 6,
  },
  card: {
    backgroundColor: HG.surface,
    borderWidth: 1,
    borderColor: HG.border,
    borderRadius: 20,
    ...CARD_SHADOW,
  },
  freeCard: {
    marginTop: 20,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  freeLabel: {
    color: HG.greenInk,
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  freeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 7,
  },
  freeRowText: {
    flex: 1,
    color: HG.ink,
    fontSize: 14.5,
    fontWeight: '700',
  },
  proCard: {
    marginTop: 14,
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 18,
    backgroundColor: '#2E1B57',
  },
  proHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  proLabel: {
    color: HG.gold,
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  proRow: {
    marginTop: 14,
  },
  proRowTitle: {
    color: '#F5F2FC',
    fontSize: 15.5,
    fontWeight: '800',
  },
  proRowBody: {
    color: '#B9AEDC',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
    marginTop: 3,
  },
  proFine: {
    color: '#8B7FB4',
    fontSize: 11.5,
    fontWeight: '600',
    lineHeight: 17,
    marginTop: 16,
  },
  primaryButton: {
    marginTop: 20,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: HG.purple,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryButton: {
    marginTop: 10,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: HG.surface,
    borderWidth: 1,
    borderColor: HG.border,
  },
  secondaryButtonText: {
    color: HG.purpleDark,
    fontSize: 14.5,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.85,
  },
});
