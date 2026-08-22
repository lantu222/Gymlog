import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { ScreenHeaderTitle } from '../components/ScreenHeaderTitle';
import { CARD_SHADOW, ToggleSwitch } from '../components/SettingsUi';
import { formatDate } from '../lib/format';
import { t } from '../lib/i18n';
import { Theme, useTheme, useThemedStyles } from '../theming';
import { layout } from '../theme';
import { AppLanguage, TrainingBreak, TrainingBreakReason } from '../types/models';

interface TrainingBreakScreenProps {
  trainingBreak: TrainingBreak | null;
  language?: AppLanguage;
  onBack: () => void;
  onStartBreak: (reason: TrainingBreakReason, note: string | null) => void;
  onEndBreak: () => void;
}

/**
 * One switch, one date. The reason chips, the note field and the reassurance
 * prose were a form the reader had to fill to be left alone (user, 2026-08-22)
 * — the break itself is just "silence everything until I flip this back".
 * The stored model keeps its reason field for compatibility; the switch files
 * every break under 'other'.
 */
export function TrainingBreakScreen({
  trainingBreak,
  language = 'en',
  onBack,
  onStartBreak,
  onEndBreak,
}: TrainingBreakScreenProps) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const onBreak = trainingBreak !== null;

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
        <ScreenHeaderTitle title={t(language, 'break.title')} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle}>{t(language, 'break.title')}</Text>
              <Text style={styles.rowSub}>
                {onBreak && trainingBreak
                  ? t(language, 'break.sinceDate', { date: formatDate(trainingBreak.startedAt, language) })
                  : t(language, 'break.switchSub')}
              </Text>
            </View>
            <ToggleSwitch
              label={t(language, 'break.title')}
              value={onBreak}
              onChange={(next) => {
                if (next) {
                  onStartBreak('other', null);
                } else {
                  onEndBreak();
                }
              }}
            />
          </View>
        </View>
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
    paddingTop: 8,
    paddingHorizontal: 18,
    paddingBottom: layout.bottomTabBarReserve,
  },
  card: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 18,
    ...CARD_SHADOW,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingVertical: 14,
    paddingHorizontal: 15,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    color: theme.ink,
    fontSize: 14.5,
    fontWeight: '800',
  },
  rowSub: {
    color: theme.muted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
    lineHeight: 17,
  },
});
