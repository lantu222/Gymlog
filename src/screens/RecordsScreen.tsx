import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { exerciseNameLabel } from '../lib/exerciseNameLabel';
import { I18nKey, t } from '../lib/i18n';
import { groupRecordsByMonth, PersonalRecord, RecordKind } from '../lib/personalRecords';
import { Theme, useTheme, useThemedStyles } from '../theming';
import type { AppLanguage } from '../types/models';

/**
 * Your bests, in three kinds.
 *
 * "Best" means three different things and a single list would have to pick
 * one: the heaviest set, the most reps in a set, and the hardest session for
 * that lift. A bodyweight program has no weight records at all, so the kinds
 * are a segmented control rather than a sort order — switching is the point,
 * not a refinement.
 *
 * Grouped by the month the record was SET, newest first, because the question
 * this screen answers is "what have I done lately" and not "which lift is
 * heaviest" — the reader already knows the second one.
 */

const KIND_LABELS: Record<RecordKind, I18nKey> = {
  weight: 'pr.kind.weight',
  reps: 'pr.kind.reps',
  volume: 'pr.kind.volume',
};

const KINDS: RecordKind[] = ['weight', 'reps', 'volume'];

const MONTHS: Record<AppLanguage, string[]> = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  fi: ['tammikuu', 'helmikuu', 'maaliskuu', 'huhtikuu', 'toukokuu', 'kesäkuu', 'heinäkuu', 'elokuu', 'syyskuu', 'lokakuu', 'marraskuu', 'joulukuu'],
};

function decimal(value: number, language: AppLanguage) {
  const rounded = Math.round(value * 10) / 10;
  const text = Number.isInteger(rounded) ? `${rounded}` : `${rounded}`;
  return language === 'fi' ? text.replace('.', ',') : text;
}

function thousands(value: number, language: AppLanguage) {
  return Math.round(value).toLocaleString(language === 'fi' ? 'fi-FI' : 'en-GB');
}

function formatDay(iso: string, language: AppLanguage) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return language === 'fi'
    ? `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}`
    : `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

function recordValue(record: PersonalRecord, language: AppLanguage) {
  if (record.kind === 'volume') {
    return t(language, 'pr.value.volume', { volume: thousands(record.value, language) });
  }
  if (record.kind === 'weight') {
    return t(language, 'pr.value.weight', {
      weight: decimal(record.value, language),
      reps: record.companion ?? 0,
    });
  }
  // A bodyweight set has no load to name, and "0 kg" is not what happened.
  return record.companion === null
    ? t(language, 'pr.value.repsBodyweight', { reps: record.value })
    : t(language, 'pr.value.reps', { reps: record.value, weight: decimal(record.companion, language) });
}

function recordDelta(record: PersonalRecord, language: AppLanguage) {
  if (record.previous === null || record.value <= record.previous) {
    return null;
  }
  const delta = record.value - record.previous;
  if (record.kind === 'reps') {
    return t(language, 'pr.delta.reps', { delta });
  }
  return t(language, 'pr.delta.weight', {
    delta: record.kind === 'volume' ? thousands(delta, language) : decimal(delta, language),
  });
}

export function RecordRow({
  record,
  language,
  onPress,
}: {
  record: PersonalRecord;
  language: AppLanguage;
  onPress?: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const delta = recordDelta(record, language);

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      style={({ pressed }) => [styles.row, record.fresh && styles.rowFresh, pressed && styles.pressed]}
    >
      <View style={styles.rowCopy}>
        <View style={styles.rowTitleLine}>
          <Text style={styles.rowName} numberOfLines={1}>
            {exerciseNameLabel(language, record.name)}
          </Text>
          {record.fresh ? (
            <View style={styles.freshTag}>
              <Text style={styles.freshTagText}>{t(language, 'pr.new')}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {[record.bodyPart, formatDay(record.performedAt, language)].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <View style={styles.rowValueBlock}>
        <Text style={styles.rowValue}>{recordValue(record, language)}</Text>
        {delta ? <Text style={styles.rowDelta}>{delta}</Text> : null}
      </View>
    </Pressable>
  );
}

interface RecordsScreenProps {
  language?: AppLanguage;
  /** Every lift's record, per kind. Empty arrays are a real state. */
  records: Record<RecordKind, PersonalRecord[]>;
  onBack: () => void;
  onStartWorkout: () => void;
  onOpenExercise?: (key: string) => void;
}

export function RecordsScreen({
  language = 'en',
  records,
  onBack,
  onStartWorkout,
  onOpenExercise,
}: RecordsScreenProps) {
  const styles = useThemedStyles(makeStyles);
  const theme = useTheme();
  const [kind, setKind] = useState<RecordKind>('weight');

  const shown = records[kind];
  const groups = groupRecordsByMonth(shown);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(language, 'common.back')}
          onPress={onBack}
          hitSlop={10}
          style={styles.backButton}
        >
          <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
            <Path d="M15 6l-6 6 6 6" stroke={theme.ink} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
        <Text style={styles.headerTitle}>{t(language, 'pr.tab.records')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.kindRow}>
          <View style={styles.segment}>
            {KINDS.map((entry) => {
              const on = kind === entry;
              return (
                <Pressable
                  key={entry}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  onPress={() => setKind(entry)}
                  style={[styles.segmentItem, on && styles.segmentItemOn]}
                >
                  <Text style={[styles.segmentText, on && styles.segmentTextOn]}>
                    {t(language, KIND_LABELS[entry])}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {shown.length > 0 ? (
            <Text style={styles.liftCount}>{t(language, 'pr.liftCount', { count: shown.length })}</Text>
          ) : null}
        </View>

        {shown.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Svg width={27} height={27} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M8 4h8v5a4 4 0 01-8 0z M8 6H5v1a3 3 0 003 3M16 6h3v1a3 3 0 01-3 3 M12 13v4M9 20h6"
                  stroke={theme.purple}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </View>
            <Text style={styles.emptyTitle}>{t(language, 'pr.empty.title')}</Text>
            <Text style={styles.emptyBody}>{t(language, 'pr.empty.body')}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={onStartWorkout}
              style={({ pressed }) => [styles.emptyCta, pressed && styles.pressed]}
            >
              <Text style={styles.emptyCtaText}>{t(language, 'pr.empty.cta')}</Text>
            </Pressable>
          </View>
        ) : (
          groups.map((group) => (
            <View key={`${group.year}-${group.month}`} style={styles.group}>
              <Text style={styles.groupLabel}>
                {`${MONTHS[language][group.month]} ${group.year}`.toUpperCase()}
              </Text>
              <View style={styles.groupRows}>
                {group.records.map((record) => (
                  <RecordRow
                    key={`${record.key}-${record.kind}`}
                    record={record}
                    language={language}
                    onPress={onOpenExercise ? () => onOpenExercise(record.key) : undefined}
                  />
                ))}
              </View>
            </View>
          ))
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 12,
  },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: theme.ink,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 132,
  },
  pressed: {
    opacity: 0.85,
  },
  kindRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: '#EEE8FA',
    borderRadius: 11,
    padding: 3,
    gap: 2,
  },
  segmentItem: {
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: 8,
  },
  segmentItemOn: {
    backgroundColor: '#FFFFFF',
  },
  segmentText: {
    color: theme.muted,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '800',
  },
  segmentTextOn: {
    color: '#5B21B6',
  },
  liftCount: {
    color: theme.faint,
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  group: {
    marginBottom: 20,
  },
  groupLabel: {
    color: theme.faint,
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: '800',
    letterSpacing: 1,
    paddingHorizontal: 2,
    marginBottom: 10,
  },
  groupRows: {
    gap: 9,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
  },
  rowFresh: {
    borderColor: theme.purple,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
  },
  rowTitleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  rowName: {
    flexShrink: 1,
    color: theme.ink,
    fontSize: 14.5,
    lineHeight: 19,
    fontWeight: '800',
  },
  freshTag: {
    borderRadius: 5,
    backgroundColor: theme.purple,
    paddingHorizontal: 6,
    paddingVertical: 2.5,
  },
  freshTagText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    lineHeight: 12,
    fontWeight: '900',
    letterSpacing: 0.9,
  },
  rowMeta: {
    color: theme.faint,
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: '700',
    marginTop: 3,
  },
  rowValueBlock: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  rowValue: {
    color: theme.ink,
    fontSize: 15.5,
    lineHeight: 20,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  rowDelta: {
    color: '#157A3A',
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: '800',
    marginTop: 3,
  },
  emptyCard: {
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    paddingHorizontal: 20,
    paddingVertical: 30,
  },
  emptyIcon: {
    width: 62,
    height: 62,
    borderRadius: 20,
    backgroundColor: '#EFE7FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    color: theme.ink,
    fontSize: 17.5,
    lineHeight: 23,
    fontWeight: '800',
    letterSpacing: -0.2,
    marginTop: 16,
  },
  emptyBody: {
    color: theme.muted,
    fontSize: 13.5,
    lineHeight: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 260,
  },
  emptyCta: {
    marginTop: 18,
    height: 46,
    paddingHorizontal: 22,
    borderRadius: 14,
    backgroundColor: theme.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCtaText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    lineHeight: 19,
    fontWeight: '800',
  },
});
