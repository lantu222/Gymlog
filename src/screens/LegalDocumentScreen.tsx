import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { ScreenHeaderTitle } from '../components/ScreenHeaderTitle';
import { CARD_SHADOW } from '../components/SettingsUi';
import { t } from '../lib/i18n';
import { LegalDocumentId, buildLegalDocument } from '../lib/legalDocuments';
import { Theme, useTheme, useThemedStyles } from '../theming';
import { layout } from '../theme';
import { AppLanguage } from '../types/models';

interface LegalDocumentScreenProps {
  document: LegalDocumentId;
  language: AppLanguage;
  onBack: () => void;
}

/**
 * Renders the privacy policy or the terms from src/lib/legalDocuments.ts.
 *
 * One screen for both, because they are the same shape and a legal document
 * whose in-app version can drift from its published version is worse than
 * having none. Both read from the same data the Markdown export uses.
 */
export function LegalDocumentScreen({ document, language, onBack }: LegalDocumentScreenProps) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const doc = useMemo(() => buildLegalDocument(document, language), [document, language]);

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
        <ScreenHeaderTitle title={doc.title} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
        <Text style={styles.updated}>{doc.updatedLabel}</Text>
        <Text style={styles.summary}>{doc.summary}</Text>

        {doc.sections.map((section, index) => (
          <View key={section.heading} style={[styles.card, index === 0 && styles.cardFirst]}>
            <Text style={styles.heading}>{section.heading}</Text>
            {(section.body ?? []).map((paragraph, paragraphIndex) => (
              <Text key={paragraphIndex} style={styles.paragraph}>
                {paragraph}
              </Text>
            ))}
            {(section.bullets ?? []).map((bullet, bulletIndex) => (
              <View key={bulletIndex} style={styles.bulletRow}>
                <View style={styles.bulletDot} />
                <Text style={styles.bulletText}>{bullet}</Text>
              </View>
            ))}
          </View>
        ))}
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
    paddingHorizontal: 16,
    paddingBottom: layout.bottomTabBarReserve,
  },
  updated: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: theme.muted,
  },
  summary: {
    marginTop: 8,
    fontSize: 15.5,
    lineHeight: 23,
    fontWeight: '600',
    color: theme.ink,
  },
  card: {
    marginTop: 14,
    backgroundColor: theme.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: 16,
    paddingVertical: 15,
    ...CARD_SHADOW,
  },
  cardFirst: {
    marginTop: 18,
  },
  heading: {
    fontSize: 14.5,
    fontWeight: '800',
    color: theme.ink,
    marginBottom: 9,
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 22,
    color: theme.muted,
    marginBottom: 9,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: 9,
    marginBottom: 8,
  },
  bulletDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.purple,
    marginTop: 8,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 22,
    color: theme.muted,
  },
});
