import React from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { ScreenHeaderTitle } from '../components/ScreenHeaderTitle';
import { CARD_SHADOW, ChevronIcon, SectionLabel } from '../components/SettingsUi';
import { t } from '../lib/i18n';
import { buildProgramCsv, CsvExportSession, summarizeExportSessions } from '../lib/programCsvExport';
import { HG } from '../lightTheme';
import { layout } from '../theme';
import { AppLanguage } from '../types/models';

export interface ExportablePlan {
  id: string;
  name: string;
  sessions: CsvExportSession[];
}

/**
 * "1 päivä · 13 liikettä". Each half is pluralised on its own count — Finnish
 * needs the singular for exactly one, and a shared template would print
 * "1 päivää".
 */
function countLabel(language: AppLanguage, dayCount: number, exerciseCount: number) {
  const days =
    dayCount === 1 ? t(language, 'export.meta.day') : t(language, 'export.meta.days', { count: dayCount });
  const exercises =
    exerciseCount === 1
      ? t(language, 'export.meta.exercise')
      : t(language, 'export.meta.exercises', { count: exerciseCount });
  return `${days} · ${exercises}`;
}

interface ExportPlanScreenProps {
  language?: AppLanguage;
  /** The user's own plans plus the ready program they are running, if any. */
  plans: ExportablePlan[];
  onBack: () => void;
}

/**
 * "Export plan (CSV)" from Settings.
 *
 * The row used to promise a local download. There is no storage the user can
 * reach and no file-share dependency, so this hands the plan to the system
 * share sheet as text instead — mail it to yourself, drop it in Sheets, or
 * paste it straight back into the importer.
 */
export function ExportPlanScreen({ language = 'en', plans, onBack }: ExportPlanScreenProps) {
  async function sharePlan(plan: ExportablePlan) {
    try {
      await Share.share({
        title: plan.name,
        message: buildProgramCsv(plan.sessions),
      });
    } catch {
      // Dismissed, or no share target — nothing to recover from.
    }
  }

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
            <Path d="M15 5l-7 7 7 7" stroke={HG.ink} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
        <ScreenHeaderTitle title={t(language, 'export.title')} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
        <Text style={styles.intro}>{t(language, 'export.intro')}</Text>

        {plans.length === 0 ? (
          <View style={[styles.card, styles.emptyCard]}>
            <Text style={styles.emptyTitle}>{t(language, 'export.emptyTitle')}</Text>
            <Text style={styles.emptyBody}>{t(language, 'export.emptyBody')}</Text>
          </View>
        ) : (
          <View style={styles.section}>
            <SectionLabel label={t(language, 'export.section')} />
            <View style={styles.card}>
              {plans.map((plan, index) => {
                const { dayCount, exerciseCount } = summarizeExportSessions(plan.sessions);
                return (
                  <Pressable
                    key={plan.id}
                    accessibilityRole="button"
                    accessibilityLabel={t(language, 'export.shareA11y', { name: plan.name })}
                    onPress={() => void sharePlan(plan)}
                    style={({ pressed }) => [
                      styles.row,
                      index !== plans.length - 1 && styles.rowDivider,
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <View style={styles.rowCopy}>
                      <Text style={styles.rowTitle}>{plan.name}</Text>
                      <Text style={styles.rowSub}>{countLabel(language, dayCount, exerciseCount)}</Text>
                    </View>
                    <ChevronIcon />
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        <Text style={styles.footer}>{t(language, 'export.footer')}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: HG.bg,
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
    backgroundColor: HG.surface,
    borderWidth: 1,
    borderColor: HG.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    paddingTop: 4,
    paddingHorizontal: 18,
    paddingBottom: layout.bottomTabBarReserve,
  },
  intro: {
    color: HG.muted,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
    paddingHorizontal: 2,
    marginBottom: 20,
  },
  section: {
    marginTop: 2,
  },
  card: {
    backgroundColor: HG.surface,
    borderWidth: 1,
    borderColor: HG.border,
    borderRadius: 18,
    ...CARD_SHADOW,
  },
  emptyCard: {
    padding: 18,
  },
  emptyTitle: {
    color: HG.ink,
    fontSize: 15,
    fontWeight: '800',
  },
  emptyBody: {
    color: HG.muted,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
    marginTop: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingVertical: 14,
    paddingHorizontal: 15,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: HG.border,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    color: HG.ink,
    fontSize: 14.5,
    fontWeight: '800',
  },
  rowSub: {
    color: HG.muted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  footer: {
    color: HG.faint,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 24,
    paddingHorizontal: 10,
  },
});
