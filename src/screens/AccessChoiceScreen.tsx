import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FitnessPhotoSurface } from '../components/FitnessPhotoSurface';
import { BadgePill, SurfaceCard } from '../components/MainScreenPrimitives';
import { ScreenHeader } from '../components/ScreenHeader';
import { AppLanguage } from '../types/models';
import { layout, spacing } from '../theme';

interface AccessChoiceScreenProps {
  language: AppLanguage;
  onBack: () => void;
  onChooseFree: () => void;
  onChoosePremium: () => void;
}

const copy = {
  en: {
    title: 'Choose your start',
    subtitle: 'Start free or unlock the full coaching layer from day one.',
    premiumKicker: 'Premium',
    premiumTitle: 'Let Gymlog coach the whole block',
    premiumBody: 'A more personalized start with smarter progression, rest, and coaching from the first workout.',
    premiumBullet1: 'A plan that fits you',
    premiumBullet2: 'Always know what to do',
    premiumBullet3: 'Progressive tracking',
    premiumBullet4: 'Recovery-aware',
    premiumAction: 'Start Premium',
    freeKicker: 'Free',
    freeTitle: 'Keep the basics clean',
    freeBody: 'Plans, logging, progress, and setup. Add Premium later if you want the adaptive layer.',
    freeAction: 'Continue Free',
    note: 'Both continue to the same setup. You can switch later.',
  },
  fi: {
    title: 'Valitse aloitus',
    subtitle: 'Aloita ilmaiseksi tai avaa koko valmennuskerros heti alusta.',
    premiumKicker: 'Premium',
    premiumTitle: 'Anna Gymlogin ohjata koko blokkia',
    premiumBody: 'Henkilokohtaisempi alku, fiksumpi progressio, palautukset ja valmennus heti ensimmaisesta treenista.',
    premiumBullet1: 'Sinulle sopiva suunnitelma',
    premiumBullet2: 'Tiedat mita tehda',
    premiumBullet3: 'Tarkka seuranta',
    premiumBullet4: 'Palautuminen huomioidaan',
    premiumAction: 'Aloita Premium',
    freeKicker: 'Free',
    freeTitle: 'Pidä perusta siistina',
    freeBody: 'Suunnitelmat, loggaus, progress ja setup. Voit lisata Premiumin myohemmin.',
    freeAction: 'Jatka Free',
    note: 'Molemmat jatkuvat samaan setupiin. Voit vaihtaa myohemmin.',
  },
} as const;

export function AccessChoiceScreen({
  language,
  onBack,
  onChooseFree,
  onChoosePremium,
}: AccessChoiceScreenProps) {
  const content = copy[language];

  return (
    <>
      <ScreenHeader title={content.title} subtitle={content.subtitle} onBack={onBack} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <FitnessPhotoSurface variant="strength" compact style={styles.heroSurface}>
          <View style={styles.heroContent}>
            <View style={styles.heroCopy}>
              <Text style={styles.heroKicker}>GYMLOG</Text>
              <Text style={styles.heroTitle}>{content.title}</Text>
            </View>
          </View>
        </FitnessPhotoSurface>

        <SurfaceCard accent="neutral" emphasis="hero" style={styles.optionCard}>
          <View style={styles.optionHeader}>
            <View style={styles.optionCopy}>
              <Text style={styles.optionKicker}>{content.premiumKicker}</Text>
              <Text style={styles.optionTitle}>{content.premiumTitle}</Text>
              <Text style={styles.optionBody}>{content.premiumBody}</Text>
            </View>
            <BadgePill accent="neutral" label="Live" />
          </View>

          <View style={styles.tokenRow}>
            <BadgePill accent="neutral" label={content.premiumBullet1} />
            <BadgePill accent="neutral" label={content.premiumBullet2} />
            <BadgePill accent="neutral" label={content.premiumBullet3} />
            <BadgePill accent="neutral" label={content.premiumBullet4} />
          </View>

          <Pressable onPress={onChoosePremium} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>{content.premiumAction}</Text>
          </Pressable>
        </SurfaceCard>

        <SurfaceCard accent="neutral" emphasis="flat" style={styles.optionCard}>
          <View style={styles.optionCopy}>
            <Text style={styles.optionKicker}>{content.freeKicker}</Text>
            <Text style={styles.optionTitle}>{content.freeTitle}</Text>
            <Text style={styles.optionBody}>{content.freeBody}</Text>
          </View>

          <Pressable onPress={onChooseFree} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>{content.freeAction}</Text>
          </Pressable>
        </SurfaceCard>

        <Text style={styles.note}>{content.note}</Text>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: layout.bottomTabBarReserve,
    gap: spacing.md,
  },
  heroSurface: {
    minHeight: 180,
  },
  heroContent: {
    flex: 1,
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  heroCopy: {
    gap: spacing.xs,
  },
  heroKicker: {
    color: 'rgba(255,255,255,0.74)',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 30,
    lineHeight: 32,
    fontWeight: '900',
    letterSpacing: -1,
    maxWidth: '80%',
  },
  optionCard: {
    gap: spacing.md,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  optionCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  optionKicker: {
    color: 'rgba(255,255,255,0.56)',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  optionTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  optionBody: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  tokenRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  primaryButton: {
    minHeight: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4F7FB',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
  },
  primaryButtonText: {
    color: '#06080B',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  secondaryButton: {
    minHeight: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10, 13, 18, 0.54)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  secondaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  note: {
    color: 'rgba(255,255,255,0.52)',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
});
