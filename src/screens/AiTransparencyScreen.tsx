import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { ScreenHeaderTitle } from '../components/ScreenHeaderTitle';
import { CARD_SHADOW, SectionLabel } from '../components/SettingsUi';
import { I18nKey, t } from '../lib/i18n';
import { Theme, useTheme, useThemedStyles } from '../theming';
import { layout } from '../theme';
import { AppLanguage } from '../types/models';

interface AiTransparencyScreenProps {
  language?: AppLanguage;
  /** Live mode means a configured endpoint; preview answers never leave the device. */
  liveModeConfigured: boolean;
  onBack: () => void;
}

/**
 * The reader's version of docs/ai-in-gainer.md.
 *
 * Deliberately short: bullets, no essay. Anyone who wants the full account,
 * including the list of things that have overclaimed and the guard each fix
 * left behind, reads the doc. This screen answers the four questions a user
 * actually asks — where is it, what does it see, what may it say, where is it
 * never used — and it has to stay true to the doc, so update both together.
 */
const SECTIONS: Array<{ labelKey: I18nKey; bulletKeys: I18nKey[] }> = [
  {
    labelKey: 'aiInfo.section.where',
    bulletKeys: ['aiInfo.where.1', 'aiInfo.where.2', 'aiInfo.where.3'],
  },
  {
    labelKey: 'aiInfo.section.sees',
    bulletKeys: ['aiInfo.sees.1', 'aiInfo.sees.2', 'aiInfo.sees.3', 'aiInfo.sees.4'],
  },
  {
    labelKey: 'aiInfo.section.rules',
    bulletKeys: ['aiInfo.rules.1', 'aiInfo.rules.2', 'aiInfo.rules.3', 'aiInfo.rules.4'],
  },
  {
    labelKey: 'aiInfo.section.never',
    bulletKeys: ['aiInfo.never.1', 'aiInfo.never.2', 'aiInfo.never.3', 'aiInfo.never.4'],
  },
];

function Bullet({ text }: { text: string }) {
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.bulletRow}>
      <View style={styles.bulletDot} />
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

export function AiTransparencyScreen({ language = 'en', liveModeConfigured, onBack }: AiTransparencyScreenProps) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
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
        <ScreenHeaderTitle title={t(language, 'aiInfo.title')} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
        <Text style={styles.heroTitle}>{t(language, 'aiInfo.heroTitle')}</Text>
        <Text style={styles.heroBody}>{t(language, 'aiInfo.heroBody')}</Text>

        {/* Which mode the install is in is a fact about this device, not a
            marketing line — preview answers never touch a network. */}
        <View style={[styles.card, styles.modeCard]}>
          <Text style={styles.modeLabel}>
            {t(language, liveModeConfigured ? 'aiInfo.mode.live' : 'aiInfo.mode.preview')}
          </Text>
          <Text style={styles.modeBody}>
            {t(language, liveModeConfigured ? 'aiInfo.mode.liveBody' : 'aiInfo.mode.previewBody')}
          </Text>
        </View>

        {SECTIONS.map((section) => (
          <View key={section.labelKey} style={styles.section}>
            <SectionLabel label={t(language, section.labelKey)} />
            <View style={styles.card}>
              {section.bulletKeys.map((key) => (
                <Bullet key={key} text={t(language, key)} />
              ))}
            </View>
          </View>
        ))}

        <Text style={styles.footer}>{t(language, 'aiInfo.footer')}</Text>
      </ScrollView>
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
    paddingTop: 4,
    paddingHorizontal: 18,
    paddingBottom: layout.bottomTabBarReserve,
  },
  heroTitle: {
    color: theme.ink,
    fontSize: 27,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginTop: 10,
  },
  heroBody: {
    color: theme.muted,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 21,
    marginTop: 6,
  },
  card: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 18,
    paddingVertical: 6,
    paddingHorizontal: 15,
    ...CARD_SHADOW,
  },
  modeCard: {
    marginTop: 16,
    paddingVertical: 14,
    backgroundColor: theme.purpleLight,
    borderColor: theme.border,
  },
  modeLabel: {
    color: theme.purpleDark,
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  modeBody: {
    color: theme.ink,
    fontSize: 13.5,
    fontWeight: '600',
    lineHeight: 20,
    marginTop: 5,
  },
  section: {
    marginTop: 20,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: 11,
    paddingVertical: 9,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.purple,
    marginTop: 7,
  },
  bulletText: {
    flex: 1,
    color: theme.ink,
    fontSize: 13.5,
    fontWeight: '600',
    lineHeight: 20,
  },
  footer: {
    color: theme.faint,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 22,
    paddingHorizontal: 10,
  },
});
