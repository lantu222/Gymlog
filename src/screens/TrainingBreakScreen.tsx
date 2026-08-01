import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { ScreenHeaderTitle } from '../components/ScreenHeaderTitle';
import { CARD_SHADOW, SectionLabel } from '../components/SettingsUi';
import { formatDate } from '../lib/format';
import { I18nKey, t } from '../lib/i18n';
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

const REASONS: Array<{ key: TrainingBreakReason; labelKey: I18nKey }> = [
  { key: 'injury', labelKey: 'break.reason.injury' },
  { key: 'holiday', labelKey: 'break.reason.holiday' },
  { key: 'other', labelKey: 'break.reason.other' },
];

function reasonLabel(reason: TrainingBreakReason, language: AppLanguage) {
  const match = REASONS.find((item) => item.key === reason);
  return match ? t(language, match.labelKey) : t(language, 'break.reason.fallback');
}

/**
 * Log an injury or holiday. The break is a stored state, not a punishment:
 * starting one records the date and reason, ending it clears the state. Plan
 * pausing logic can hook onto this later.
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
  const [reason, setReason] = useState<TrainingBreakReason | null>(null);
  const [note, setNote] = useState('');

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

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {trainingBreak ? (
          <>
            <View style={[styles.card, styles.statusCard]}>
              <View style={styles.statusDotWrap}>
                <View style={styles.statusDot} />
                <Text style={styles.statusEyebrow}>{t(language, 'break.onBreak')}</Text>
              </View>
              <Text style={styles.statusTitle}>
                {t(language, 'break.since', {
                  reason: reasonLabel(trainingBreak.reason, language),
                  date: formatDate(trainingBreak.startedAt, language),
                })}
              </Text>
              {trainingBreak.note ? <Text style={styles.statusNote}>{trainingBreak.note}</Text> : null}
              <Text style={styles.statusBody}>
                {t(language, 'break.statusBody')}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={onEndBreak}
              style={({ pressed }) => [styles.primaryButton, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.primaryButtonText}>{t(language, 'break.end')}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <View style={styles.section}>
              <SectionLabel label={t(language, 'break.reasonLabel')} />
              <View style={styles.reasonRow}>
                {REASONS.map((item) => {
                  const active = reason === item.key;
                  return (
                    <Pressable
                      key={item.key}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      onPress={() => setReason(item.key)}
                      style={[styles.reasonChip, active && styles.reasonChipActive]}
                    >
                      <Text style={[styles.reasonChipText, active && styles.reasonChipTextActive]}>{t(language, item.labelKey)}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.section}>
              <SectionLabel label={t(language, 'break.noteLabel')} />
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder={t(language, 'break.notePlaceholder')}
                placeholderTextColor={theme.faint}
                style={styles.noteInput}
                multiline
              />
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: reason === null }}
              onPress={() => {
                if (reason !== null) {
                  onStartBreak(reason, note.trim().length > 0 ? note.trim() : null);
                }
              }}
              style={({ pressed }) => [
                styles.primaryButton,
                reason === null && styles.primaryButtonDisabled,
                pressed && reason !== null && { opacity: 0.85 },
              ]}
            >
              <Text style={styles.primaryButtonText}>{t(language, 'break.start')}</Text>
            </Pressable>

            <Text style={styles.footer}>
              {t(language, 'break.footer')}
            </Text>
          </>
        )}
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
  card: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 18,
    ...CARD_SHADOW,
  },
  statusCard: {
    padding: 16,
    marginTop: 4,
  },
  statusDotWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#B45309',
  },
  statusEyebrow: {
    color: '#B45309',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  statusTitle: {
    color: theme.ink,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 10,
  },
  statusNote: {
    color: theme.muted,
    fontSize: 13.5,
    fontWeight: '600',
    marginTop: 6,
  },
  statusBody: {
    color: theme.muted,
    fontSize: 12.5,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: 12,
  },
  section: {
    marginTop: 22,
  },
  reasonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  reasonChip: {
    flex: 1,
    height: 44,
    borderRadius: 13,
    backgroundColor: theme.surface,
    borderWidth: 1.5,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reasonChipActive: {
    backgroundColor: theme.purpleLight,
    borderColor: theme.purple,
  },
  reasonChipText: {
    color: theme.muted,
    fontSize: 14,
    fontWeight: '800',
  },
  reasonChipTextActive: {
    color: theme.purpleDark,
  },
  noteInput: {
    minHeight: 84,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    paddingHorizontal: 15,
    paddingVertical: 12,
    color: theme.ink,
    fontSize: 14,
    fontWeight: '600',
    textAlignVertical: 'top',
  },
  primaryButton: {
    height: 50,
    borderRadius: 15,
    backgroundColor: theme.purple,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  primaryButtonDisabled: {
    backgroundColor: '#D8D2E6',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  footer: {
    color: theme.faint,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 14,
    paddingHorizontal: 10,
  },
});
