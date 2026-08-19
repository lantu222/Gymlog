import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { CoachHighlightedText } from '../components/CoachHighlightedText';
import { t } from '../lib/i18n';
import { SessionAnalysis, SessionTrend, describeVolumeChange } from '../lib/sessionAnalysis';
import { COACH } from '../lightTheme';
import { layout } from '../theme';
import { AppLanguage } from '../types/models';

interface SessionAnalysisScreenProps {
  analysis: SessionAnalysis | null;
  language?: AppLanguage;
  onBack: () => void;
  onAskCoach: () => void;
}

const BAR_HEIGHT = 96;

function toneColor(trend: SessionTrend) {
  return trend === 'up' ? COACH.good : trend === 'down' ? COACH.warn : COACH.gold;
}

function toneMark(trend: SessionTrend) {
  return trend === 'up' ? '▲' : trend === 'down' ? '▼' : '=';
}

export function SessionAnalysisScreen({
  analysis,
  language = 'en',
  onBack,
  onAskCoach,
}: SessionAnalysisScreenProps) {
  const bars = analysis?.volumeBars ?? [];
  const volumeChange = describeVolumeChange(analysis?.volumeChangePercent ?? null, language);
  // Scale from just under the smallest bar rather than zero: on real training
  // data every bar is a large number, and a zero baseline flattens the very
  // trend the chart exists to show.
  const values = bars.map((bar) => bar.volumeKg);
  const maxValue = values.length ? Math.max(...values) : 0;
  const minValue = values.length ? Math.min(...values) : 0;
  const baseline = values.length ? Math.max(0, minValue - (maxValue - minValue) * 0.35 - 1) : 0;
  const span = Math.max(maxValue - baseline, 1);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(language, 'common.back')}
          onPress={onBack}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <Svg width={19} height={19} viewBox="0 0 24 24" fill="none">
            <Path
              d="M15 5l-7 7 7 7"
              stroke={COACH.text}
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </Pressable>
        <Text style={styles.headerTitle}>{t(language, 'analysis.title')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {!analysis ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>{t(language, 'analysis.empty')}</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
          {/* 1 · session hero */}
          <Text style={styles.eyebrow}>{analysis.eyebrow}</Text>
          <Text style={styles.title}>{analysis.title}</Text>
          {analysis.metaParts.length > 0 ? (
            <Text style={styles.meta}>{analysis.metaParts.join('  ·  ')}</Text>
          ) : null}

          {/* 2 · verdict */}
          {analysis.verdict ? (
            <View style={styles.verdictCard}>
              <View style={styles.verdictTagRow}>
                <Text style={styles.verdictSparkle}>✦</Text>
                <Text style={styles.verdictTag}>{t(language, analysis.verdictTagKey)}</Text>
              </View>
              <CoachHighlightedText
                text={analysis.verdict.text}
                highlights={analysis.verdict.highlights}
                style={styles.verdictBody}
                highlightStyle={styles.gold}
              />
            </View>
          ) : null}

          {/* 3 · key numbers */}
          {analysis.keyNumbers.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{t(language, 'analysis.key.label')}</Text>
              <View style={styles.metricRow}>
                {analysis.keyNumbers.map((metric) => (
                  <View key={metric.labelKey} style={styles.metricCell}>
                    <Text style={styles.metricKey}>{t(language, metric.labelKey)}</Text>
                    {/* "60 kg × 8" is one reading, so it never wraps; if the
                        cell is too narrow the type shrinks instead. */}
                    <Text style={styles.metricValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                      {metric.value}
                    </Text>
                    {metric.sub ? (
                      <Text style={styles.metricSub} numberOfLines={2}>
                        {metric.sub}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* 4 · volume over comparable sessions */}
          {bars.length > 0 ? (
            <View style={styles.section}>
              <View style={styles.sectionHeadRow}>
                <Text style={styles.sectionLabel}>{t(language, 'analysis.volumeLabel')}</Text>
                {volumeChange ? (
                  <View
                    style={[
                      styles.changePill,
                      volumeChange.kind === 'down' && styles.changePillDown,
                      volumeChange.kind === 'flat' && styles.changePillFlat,
                    ]}
                  >
                    <Text
                      style={[
                        styles.changePillText,
                        volumeChange.kind === 'down' && styles.changePillTextDown,
                        volumeChange.kind === 'flat' && styles.changePillTextFlat,
                      ]}
                    >
                      {volumeChange.text}
                    </Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.barRow}>
                {bars.map((bar) => {
                  const height = Math.max(
                    6,
                    ((bar.volumeKg - baseline) / span) * BAR_HEIGHT,
                  );
                  return (
                    <View key={bar.sessionId} style={styles.barSlot}>
                      <View
                        style={[styles.bar, { height }, bar.isCurrent && styles.barCurrent]}
                      />
                      <Text style={[styles.barLabel, bar.isCurrent && styles.barLabelCurrent]}>
                        {bar.label}
                      </Text>
                    </View>
                  );
                })}
              </View>

              {bars.length === 1 ? (
                <Text style={styles.sectionNote}>{t(language, 'analysis.volumeSingle')}</Text>
              ) : null}
            </View>
          ) : null}

          {/* 5 · exercise breakdown */}
          {analysis.exercises.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{t(language, 'analysis.breakdown')}</Text>
              {analysis.exercises.map((row) => (
                <View key={row.key} style={styles.exerciseRow}>
                  <View style={styles.exerciseCopy}>
                    <Text style={styles.exerciseName}>{row.name}</Text>
                    <Text style={styles.exerciseDetail}>
                      {row.detail}
                      {row.topSet ? `  ·  ${row.topSet}` : ''}
                    </Text>
                  </View>
                  {row.trend && row.trendLabel ? (
                    <View style={styles.trendPill}>
                      <Text style={[styles.trendMark, { color: toneColor(row.trend) }]}>
                        {toneMark(row.trend)}
                      </Text>
                      <Text style={[styles.trendText, { color: toneColor(row.trend) }]}>
                        {row.trendLabel}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.trendAbsent}>{t(language, 'analysis.noCompare')}</Text>
                  )}
                </View>
              ))}
            </View>
          ) : null}

          {/* 6 · what the coach noticed */}
          {analysis.observations.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{t(language, 'analysis.noticed')}</Text>
              {analysis.observations.map((entry, index) => (
                <View key={`${entry.trend}:${index}`} style={styles.observationRow}>
                  <View style={[styles.observationSquare, { backgroundColor: toneColor(entry.trend) }]} />
                  <CoachHighlightedText
                    text={entry.body.text}
                    highlights={entry.body.highlights}
                    style={styles.observationText}
                    highlightStyle={styles.observationStrong}
                  />
                </View>
              ))}
            </View>
          ) : null}

          {/* 7 · next session */}
          {analysis.nextActions.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{t(language, 'analysis.next')}</Text>
              <View style={styles.nextCard}>
                {analysis.nextActions.map((action, index) => (
                  <View key={index} style={styles.nextRow}>
                    <View style={styles.nextCheck}>
                      <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
                        <Path
                          d="M5 12l5 5L19 7"
                          stroke={COACH.gold}
                          strokeWidth={3}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </Svg>
                    </View>
                    <CoachHighlightedText
                      text={action.text}
                      highlights={action.highlights}
                      style={styles.nextText}
                      highlightStyle={styles.goldMono}
                    />
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* 8 · recovery note */}
          <View style={styles.recoveryCard}>
            <Svg width={19} height={19} viewBox="0 0 24 24" fill="none">
              <Path
                d="M20 13.5A8 8 0 0 1 10.5 4 8 8 0 1 0 20 13.5z"
                stroke={COACH.purple}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
            <Text style={styles.recoveryText}>{t(language, 'analysis.recovery')}</Text>
          </View>

          {/* 9 · back to the coach */}
          <Pressable
            accessibilityRole="button"
            onPress={onAskCoach}
            style={({ pressed }) => [styles.askButton, pressed && styles.pressed]}
          >
            <Text style={styles.askButtonText}>{t(language, 'analysis.askCoach')}</Text>
          </Pressable>
          <Text style={styles.footnote}>{t(language, 'analysis.footnote')}</Text>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COACH.bg,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: COACH.text,
    fontSize: 16,
    fontWeight: '800',
  },
  headerSpacer: {
    width: 38,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    color: COACH.muted,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  body: {
    paddingHorizontal: 22,
    // The tab bar floats over this screen, so the last card needs to clear it.
    paddingBottom: layout.bottomTabBarReserve,
  },
  eyebrow: {
    color: COACH.gold,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.3,
    marginTop: 4,
  },
  title: {
    color: COACH.text,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.6,
    marginTop: 6,
  },
  meta: {
    color: COACH.muted,
    fontFamily: 'JetBrainsMono',
    fontSize: 12.5,
    marginTop: 8,
  },
  verdictCard: {
    marginTop: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COACH.focusBorder,
    backgroundColor: COACH.focusTop,
    padding: 16,
  },
  verdictTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 9,
  },
  verdictSparkle: {
    color: COACH.gold,
    fontSize: 12,
  },
  verdictTag: {
    color: COACH.gold,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  verdictBody: {
    color: COACH.text,
    fontSize: 14.5,
    fontWeight: '700',
    lineHeight: 22,
  },
  gold: {
    color: COACH.gold,
    fontWeight: '800',
  },
  goldMono: {
    color: COACH.gold,
    fontFamily: 'JetBrainsMono',
  },
  section: {
    marginTop: 22,
    borderTopWidth: 1,
    borderTopColor: COACH.hairline,
    paddingTop: 18,
  },
  sectionHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    color: COACH.gold,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  sectionNote: {
    color: COACH.faint,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 12,
  },
  metricRow: {
    flexDirection: 'row',
    gap: 9,
    marginTop: 12,
  },
  metricCell: {
    flex: 1,
    backgroundColor: COACH.surface,
    borderRadius: 15,
    padding: 13,
  },
  metricKey: {
    color: COACH.faint,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.9,
  },
  metricValue: {
    color: COACH.text,
    fontFamily: 'JetBrainsMono',
    fontSize: 17,
    marginTop: 6,
  },
  metricSub: {
    color: COACH.muted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },
  changePill: {
    backgroundColor: 'rgba(55,208,138,0.14)',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  changePillDown: {
    backgroundColor: 'rgba(224,146,47,0.14)',
  },
  // Nothing changed, so nothing is claimed: the badge goes quiet rather than
  // wearing the green that promises growth.
  changePillFlat: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  changePillText: {
    color: COACH.good,
    fontFamily: 'JetBrainsMono',
    fontSize: 12,
  },
  changePillTextDown: {
    color: COACH.warn,
  },
  changePillTextFlat: {
    color: COACH.muted,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginTop: 16,
    height: BAR_HEIGHT + 24,
  },
  barSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 7,
  },
  bar: {
    width: '100%',
    borderRadius: 6,
    backgroundColor: 'rgba(155,109,255,0.35)',
  },
  barCurrent: {
    backgroundColor: COACH.gold,
  },
  barLabel: {
    color: COACH.faint,
    fontFamily: 'JetBrainsMono',
    fontSize: 10,
  },
  barLabelCurrent: {
    color: COACH.gold,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: COACH.hairline,
  },
  exerciseCopy: {
    flex: 1,
    minWidth: 0,
  },
  exerciseName: {
    color: COACH.text,
    fontSize: 15,
    fontWeight: '800',
  },
  exerciseDetail: {
    color: COACH.muted,
    fontFamily: 'JetBrainsMono',
    fontSize: 12,
    marginTop: 5,
  },
  trendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  trendMark: {
    fontSize: 10,
    fontWeight: '800',
  },
  trendText: {
    fontFamily: 'JetBrainsMono',
    fontSize: 12,
  },
  trendAbsent: {
    color: COACH.faint,
    fontSize: 11,
    fontWeight: '700',
  },
  observationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 13,
  },
  observationSquare: {
    width: 9,
    height: 9,
    borderRadius: 2,
    marginTop: 6,
  },
  observationText: {
    flex: 1,
    color: COACH.muted,
    fontSize: 13.5,
    fontWeight: '600',
    lineHeight: 20,
  },
  observationStrong: {
    color: COACH.text,
    fontWeight: '800',
  },
  nextCard: {
    backgroundColor: COACH.surface,
    borderRadius: 16,
    padding: 15,
    marginTop: 12,
    gap: 12,
  },
  nextRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
  },
  nextCheck: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: 'rgba(228,177,76,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextText: {
    flex: 1,
    color: COACH.text,
    fontSize: 13.5,
    fontWeight: '600',
    lineHeight: 20,
  },
  recoveryCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
    backgroundColor: COACH.surfaceSoft,
    borderRadius: 16,
    padding: 15,
    marginTop: 22,
  },
  recoveryText: {
    flex: 1,
    color: COACH.muted,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 20,
  },
  askButton: {
    backgroundColor: COACH.gold,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 22,
  },
  askButtonText: {
    color: COACH.goldInk,
    fontSize: 15,
    fontWeight: '800',
  },
  footnote: {
    color: COACH.faint,
    fontSize: 11.5,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 17,
    marginTop: 13,
  },
  pressed: {
    opacity: 0.85,
  },
});
