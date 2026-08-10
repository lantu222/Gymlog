import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { ExerciseSetLog, SET_LOG_SESSIONS } from '../lib/exerciseSetLog';
import { exerciseNameLabel } from '../lib/exerciseNameLabel';
import { FREE_RECORD_MONTHS } from '../lib/historyWindow';
import { I18nKey, t } from '../lib/i18n';
import { CutSurface } from './CutSurface';
import { libraryLabel } from '../lib/libraryLabel';
import { PersonalRecord } from '../lib/personalRecords';
import { Theme, useTheme, useThemedStyles } from '../theming';
import type { AppLanguage } from '../types/models';

/**
 * One lift's set log, on a sheet over the exercise it belongs to.
 *
 * A sheet rather than a screen because the curve underneath is the context:
 * you open this to find out what the line is made of, and closing it should
 * put you back where you were looking.
 *
 * Locked, it shows the SHAPE of what is there — one skeleton per session, one
 * block per set — and none of the figures. Fading the real rows was the first
 * attempt and they stayed readable, which makes a lock decorative; inventing
 * sets would have been worse, because what is behind this lock is the reader's
 * own training.
 */

interface SetLogSheetProps {
  visible: boolean;
  log: ExerciseSetLog | null;
  language: AppLanguage;
  locked: boolean;
  onClose: () => void;
  onOpenPro: () => void;
  /** The empty state's way out: there is nothing to read until you log one. */
  onStartWorkout?: () => void;
}

function decimal(value: number, language: AppLanguage) {
  const rounded = Math.round(value * 10) / 10;
  return language === 'fi' ? `${rounded}`.replace('.', ',') : `${rounded}`;
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

const WEEKDAY_KEYS: I18nKey[] = [
  'cal.dow.sun',
  'cal.dow.mon',
  'cal.dow.tue',
  'cal.dow.wed',
  'cal.dow.thu',
  'cal.dow.fri',
  'cal.dow.sat',
];

function weekday(iso: string, language: AppLanguage) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return t(language, WEEKDAY_KEYS[date.getDay()]);
}

/**
 * The lift's line — every session, both tiers.
 *
 * Free gets the curve and Pro gets the sets behind it, so this sits above the
 * lock rather than under it.
 */
function Curve({ values, color, width, height = 92 }: {
  values: number[];
  color: string;
  width: number;
  height?: number;
}) {
  if (values.length < 2) {
    return null;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 0.001);
  const pad = 8;
  const x = (index: number) => pad + (index / (values.length - 1)) * (width - pad * 2);
  const y = (value: number) => pad + (height - pad * 2) - ((value - min) / span) * (height - pad * 2);
  const line = values.map((value, index) => `${x(index)},${y(value)}`).join(' ');

  return (
    <Svg width={width} height={height}>
      <Path d={`M${line.split(' ').join(' L')}`} stroke={color} strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Rect
        x={x(values.length - 1) - 3.5}
        y={y(values[values.length - 1]) - 3.5}
        width={7}
        height={7}
        rx={3.5}
        fill={color}
      />
    </Svg>
  );
}

function LockGlyph({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={4} y={10} width={16} height={11} rx={3} stroke={color} strokeWidth={2.2} />
      <Path d="M8 10V7a4 4 0 018 0v3" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

function CheckGlyph({ color }: { color: string }) {
  return (
    <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
      <Path d="M4 12.5l5 5L20 6.5" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** One session: the day, its volume, and the sets as chips. */
function SessionRow({
  session,
  language,
  last,
}: {
  session: ExerciseSetLog['sessions'][number];
  language: AppLanguage;
  last?: boolean;
}) {
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={[styles.session, !last && styles.sessionDivider]}>
      <View style={styles.sessionHead}>
        <View style={styles.sessionDateLine}>
          <Text style={styles.sessionDate}>
            {formatDay(session.performedAt, language)}
          </Text>
          <Text style={styles.sessionDow}>
            {weekday(session.performedAt, language)}
          </Text>
        </View>
        <Text style={styles.sessionVolume}>
          {thousands(session.volumeKg, language)} kg
        </Text>
      </View>
      <View style={styles.chipRow}>
        {session.sets.map((set, index) => (
          <View
            key={index}
            style={[styles.chip, set.isRecord && styles.chipRecord]}
          >
            <Text style={[styles.chipText, set.isRecord && styles.chipTextRecord]}>
              {set.reps} × {decimal(set.weightKg, language)}
            </Text>
            {set.isRecord ? (
              <Text style={styles.chipBadge}>{t(language, 'setlog.pr')}</Text>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

export function SetLogSheet({
  visible,
  log,
  language,
  locked,
  onClose,
  onOpenPro,
  onStartWorkout,
}: SetLogSheetProps) {
  const styles = useThemedStyles(makeStyles);
  const theme = useTheme();
  const [curveWidth, setCurveWidth] = useState(280);

  if (!log) {
    return null;
  }

  const title = exerciseNameLabel(language, log.name);
  const part = log.bodyPart ? libraryLabel(log.bodyPart, language) : null;
  const empty = log.sessions.length === 0;
  // "5 most recent" is a lie when there are three. Say what is shown.
  const shownLabel = empty
    ? null
    : log.totalSessions > SET_LOG_SESSIONS
      ? t(language, 'setlog.recentCapped', {
          shown: log.sessions.length,
          total: log.totalSessions,
        })
      : log.sessions.length === 1
        ? t(language, 'setlog.recentOne')
        : t(language, 'setlog.recent', { count: log.sessions.length });

  const bests: Array<{ labelKey: I18nKey; value: string; meta: string } | null> = [
    best(log.bestWeight, 'setlog.best.weight', (record) => ({
      value: `${decimal(record.value, language)} kg`,
      meta: `× ${record.companion ?? 0} · ${formatDay(record.performedAt, language)}`,
    })),
    best(log.bestReps, 'setlog.best.reps', (record) => ({
      value:
        record.companion === null
          ? `${record.value}`
          : `${record.value} × ${decimal(record.companion, language)}`,
      meta: formatDay(record.performedAt, language),
    })),
    best(log.bestVolume, 'setlog.best.volume', (record) => ({
      value: `${thousands(record.value, language)} kg`,
      meta: formatDay(record.performedAt, language),
    })),
  ];

  function best(
    record: PersonalRecord | null,
    labelKey: I18nKey,
    format: (record: PersonalRecord) => { value: string; meta: string },
  ) {
    if (!record) {
      return null;
    }
    return { labelKey, ...format(record) };
  }

  const shownBests = bests.filter(Boolean) as Array<{
    labelKey: I18nKey;
    value: string;
    meta: string;
  }>;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.grabber} />

        <View style={styles.head}>
          <View style={styles.headCopy}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {[part, shownLabel].filter(Boolean).join(' · ')}
            </Text>
          </View>
          {locked ? (
            <View style={styles.freePill}>
              <Text style={styles.freePillText}>
                {t(language, 'setlog.freePill', { months: FREE_RECORD_MONTHS })}
              </Text>
            </View>
          ) : (
            <View style={styles.proTag}>
              <Text style={styles.proTagText}>PRO</Text>
            </View>
          )}
        </View>

        {log.curve.length > 1 ? (
          <View
            style={styles.curveCard}
            onLayout={(event) => setCurveWidth(event.nativeEvent.layout.width - 24)}
          >
            <Curve values={log.curve} color={theme.purple} width={Math.max(curveWidth, 1)} />
          </View>
        ) : null}

        {empty ? (
          <View style={styles.emptyBlock}>
            <View style={styles.emptyIcon}>
              <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M4 7h16M4 12h16M4 17h10"
                  stroke={theme.purple}
                  strokeWidth={2.2}
                  strokeLinecap="round"
                />
              </Svg>
            </View>
            <Text style={styles.emptyTitle}>{t(language, 'setlog.empty.title')}</Text>
            <Text style={styles.emptyBody}>{t(language, 'setlog.empty.body')}</Text>
            {onStartWorkout ? (
              <Pressable
                accessibilityRole="button"
                onPress={onStartWorkout}
                style={({ pressed }) => [pressed && styles.pressed]}
              >
                <CutSurface size="lg" fill={theme.purple} style={styles.cta}>
                  <Text style={styles.ctaText}>{t(language, 'setlog.empty.cta')}</Text>
                </CutSurface>
              </Pressable>
            ) : null}
          </View>
        ) : locked ? (
          <View style={styles.lockedBlock}>
            {/* The shape of what is there, not the figures. Dimming the real
                rows was the first attempt and they stayed readable, which
                makes a lock decorative; drawing invented sets would be worse.
                A skeleton says "three sessions, three sets each" and claims
                nothing else. */}
            <View style={styles.lockedRows} pointerEvents="none">
              {log.sessions.slice(0, 3).map((session) => (
                <View key={session.performedAt} style={styles.skeletonSession}>
                  <View style={styles.skeletonHeadRow}>
                    <View style={[styles.skeletonBar, { width: 92 }]} />
                    <View style={[styles.skeletonBar, { width: 52 }]} />
                  </View>
                  <View style={styles.skeletonChipRow}>
                    {session.sets.slice(0, 4).map((unused, index) => (
                      <View key={index} style={styles.skeletonChip} />
                    ))}
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.lockedCopy}>
              <View style={styles.lockBadge}>
                <LockGlyph color="#FFFFFF" />
              </View>
              <View style={styles.lockTitleRow}>
                <Text style={styles.lockTitle}>{t(language, 'setlog.lock.title')}</Text>
                <View style={styles.proTagSolid}>
                  <Text style={styles.proTagSolidText}>PRO</Text>
                </View>
              </View>
              <View style={styles.lockBenefits}>
                {(
                  [
                    ['setlog.lock.b1.t', 'setlog.lock.b1.b'],
                    ['setlog.lock.b2.t', 'setlog.lock.b2.b'],
                    ['setlog.lock.b3.t', 'setlog.lock.b3.b'],
                  ] as Array<[I18nKey, I18nKey]>
                ).map(([titleKey, bodyKey]) => (
                  <View key={titleKey} style={styles.lockBenefit}>
                    <CheckGlyph color={theme.purple} />
                    <View style={styles.lockBenefitCopy}>
                      <Text style={styles.lockBenefitTitle}>{t(language, titleKey)}</Text>
                      <Text style={styles.lockBenefitBody}>
                        {t(language, bodyKey, { months: FREE_RECORD_MONTHS })}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={onOpenPro}
                style={({ pressed }) => [styles.ctaWide, pressed && styles.pressed]}
              >
                <CutSurface size="lg" fill={theme.purple} style={styles.cta}>
                  <Text style={styles.ctaText}>{t(language, 'setlog.lock.cta')}</Text>
                </CutSurface>
              </Pressable>
            </View>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
            {shownBests.length > 0 ? (
              <View style={styles.bestRow}>
                {shownBests.map((entry) => (
                  <View key={entry.labelKey} style={styles.bestCard}>
                    <Text style={styles.bestLabel}>{t(language, entry.labelKey)}</Text>
                    <Text style={styles.bestValue}>{entry.value}</Text>
                    <Text style={styles.bestMeta}>{entry.meta}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={styles.setsHead}>
              <Text style={styles.setsLabel}>{t(language, 'setlog.sets')}</Text>
              <Text style={styles.setsHint}>{t(language, 'setlog.setsHint')}</Text>
            </View>

            {log.sessions.map((session, index) => (
              <SessionRow
                key={session.performedAt}
                session={session}
                language={language}
                last={index === log.sessions.length - 1}
              />
            ))}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(16, 10, 40, 0.42)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '86%',
    backgroundColor: theme.surface,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 26,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.border,
    marginBottom: 14,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  headCopy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: theme.ink,
    fontSize: 19,
    lineHeight: 25,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  subtitle: {
    color: theme.faint,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    marginTop: 2,
  },
  proTag: {
    borderRadius: 6,
    backgroundColor: '#EFE7FF',
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  proTagText: {
    color: theme.purpleDark,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '900',
    letterSpacing: 1,
  },
  proTagSolid: {
    borderRadius: 6,
    backgroundColor: theme.purple,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  proTagSolidText: {
    color: '#FFFFFF',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '900',
    letterSpacing: 1,
  },
  freePill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.bg,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  freePillText: {
    color: theme.muted,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
  },
  body: {
    paddingBottom: 12,
  },
  curveCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.bg,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 16,
  },
  bestRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  bestCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.bg,
    paddingHorizontal: 11,
    paddingVertical: 10,
  },
  bestLabel: {
    color: theme.faint,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  bestValue: {
    color: theme.ink,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
    letterSpacing: -0.2,
    marginTop: 4,
  },
  bestMeta: {
    color: theme.faint,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  setsHead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    marginBottom: 10,
  },
  setsLabel: {
    color: theme.faint,
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: '800',
    letterSpacing: 1,
  },
  setsHint: {
    color: theme.faint,
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: '800',
  },
  session: {
    paddingBottom: 15,
  },
  sessionDivider: {
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    marginBottom: 15,
  },
  sessionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sessionDateLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 7,
  },
  sessionDate: {
    color: theme.ink,
    fontSize: 13.5,
    lineHeight: 18,
    fontWeight: '800',
  },
  sessionDow: {
    color: theme.faint,
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: '700',
  },
  sessionVolume: {
    color: theme.muted,
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: '800',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.bg,
  },
  chipRecord: {
    backgroundColor: theme.purple,
    borderColor: theme.purple,
  },
  chipText: {
    color: theme.ink,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
  },
  chipTextRecord: {
    color: '#FFFFFF',
  },
  chipBadge: {
    color: '#FFFFFF',
    fontSize: 9.5,
    lineHeight: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  lockedBlock: {
    position: 'relative',
  },
  lockedRows: {
    gap: 15,
  },
  skeletonSession: {
    gap: 9,
  },
  skeletonHeadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  skeletonBar: {
    height: 11,
    borderRadius: 6,
    backgroundColor: '#F1ECFB',
  },
  skeletonChipRow: {
    flexDirection: 'row',
    gap: 7,
  },
  skeletonChip: {
    width: 62,
    height: 31,
    borderRadius: 10,
    backgroundColor: '#F1ECFB',
  },
  lockedCopy: {
    marginTop: -34,
    alignItems: 'center',
  },
  lockBadge: {
    width: 52,
    height: 52,
    borderRadius: 17,
    backgroundColor: theme.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
  },
  lockTitle: {
    color: theme.ink,
    fontSize: 18.5,
    lineHeight: 24,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  lockBenefits: {
    alignSelf: 'stretch',
    gap: 9,
    marginTop: 16,
  },
  lockBenefit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.bg,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  lockBenefitCopy: {
    flex: 1,
    minWidth: 0,
  },
  lockBenefitTitle: {
    color: theme.ink,
    fontSize: 13.5,
    lineHeight: 18,
    fontWeight: '800',
  },
  lockBenefitBody: {
    color: theme.faint,
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: '700',
    marginTop: 1,
  },
  cta: {
    marginTop: 16,
    height: 50,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaWide: {
    alignSelf: 'stretch',
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.85,
  },
  emptyBlock: {
    alignItems: 'center',
    paddingVertical: 22,
  },
  emptyIcon: {
    width: 58,
    height: 58,
    borderRadius: 19,
    backgroundColor: '#EFE7FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    color: theme.ink,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800',
    marginTop: 15,
  },
  emptyBody: {
    color: theme.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 250,
  },
});
