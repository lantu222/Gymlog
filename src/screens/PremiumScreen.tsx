import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Polygon, Polyline, Text as SvgText } from 'react-native-svg';

import { ProPill } from '../components/ProLockedCard';
import { removeTrailingZeros } from '../lib/format';
import { I18nKey, t } from '../lib/i18n';
import { PremiumHeroChart } from '../lib/premiumHeroChart';
import { HG, PW } from '../lightTheme';
import { layout } from '../theme';
import { AppLanguage, UnitPreference } from '../types/models';

/**
 * The Pro full page (design: GAINER Pro Page / pro-page.jsx).
 *
 * Structure: own-data hero → three benefits with real specimens → the Free/Pro
 * promise in one line → grouped Track/Understand/Decide table → plan select →
 * pinned CTA. Every specimen is the user's own data with an honest empty state,
 * every table cell matches what the app actually does, and the CTA is the
 * preview switch until billing exists — the planned prices are labeled planned.
 */
interface PremiumScreenProps {
  /** State of the on-device preview switch, which is what the CTA toggles. */
  previewUnlocked: boolean;
  /** Whether Pro is actually on — the preview switch or a live promo code. */
  proUnlocked: boolean;
  heroChart: PremiumHeroChart | null;
  unitPreference: UnitPreference;
  /** Real session count behind the hero headline. */
  sessionCount: number;
  /** Deterministic coach read of the user's own log; null with no data. */
  coachSpecimen: string | null;
  /** Monday-first weekday indexes of the user's training days. */
  trainingDayIndexes: number[];
  language?: AppLanguage;
  onBack: () => void;
  onTogglePreview: () => void;
}

type TableCell = 1 | 0 | 'quota';

const TABLE: Array<{
  bandKey: I18nKey;
  noteKey: I18nKey;
  notePro: boolean;
  rows: Array<[I18nKey, TableCell, TableCell]>;
}> = [
  {
    bandKey: 'pro.page.band.track',
    noteKey: 'pro.page.band.trackNote',
    notePro: false,
    rows: [
      ['pro.page.row.logging', 1, 1],
      ['pro.page.row.ready', 1, 1],
      ['pro.page.row.own', 1, 1],
      ['pro.page.row.history', 1, 1],
      ['pro.page.row.records', 1, 1],
      ['pro.page.row.rest', 1, 1],
    ],
  },
  {
    bandKey: 'pro.page.band.understand',
    noteKey: 'pro.page.bandNote.pro',
    notePro: true,
    rows: [
      // Detection is free — the conclusion is Pro (the paywall-moments rule).
      ['pro.page.row.plateau', 1, 1],
      ['pro.page.row.why', 0, 1],
      ['pro.page.row.recovery', 0, 1],
      ['pro.page.row.analysis', 0, 1],
    ],
  },
  {
    bandKey: 'pro.page.band.decide',
    noteKey: 'pro.page.bandNote.pro',
    notePro: true,
    rows: [
      ['pro.page.row.adaptive', 0, 1],
      ['pro.page.row.progression', 0, 1],
      ['pro.page.row.builder', 0, 1],
      // The free quota is real: 3 coach questions a week (aiCoachQuota.ts).
      ['pro.page.row.coach', 'quota', 1],
    ],
  },
];

function fmt(value: number) {
  return removeTrailingZeros(Number(value.toFixed(1)));
}

function SparkGlyph({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 2l2.2 5.8L20 10l-5.8 2.2L12 18l-2.2-5.8L4 10l5.8-2.2z" fill={color} />
    </Svg>
  );
}

function CheckGlyph({ color }: { color: string }) {
  return (
    <Svg width={17} height={17} viewBox="0 0 24 24">
      <Path d="M5 13l4 4L19 7" stroke={color} strokeWidth={2.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function HeroChart({ chart, unitPreference }: { chart: PremiumHeroChart; unitPreference: UnitPreference }) {
  const W = 300;
  const H = 118;
  const padL = 8;
  const padR = 46;
  const padT = 16;
  const padB = 18;

  const { points, projectedNext } = chart;
  const all = [...points, projectedNext];
  const rawMin = Math.min(...all);
  const rawMax = Math.max(...all);
  const span = Math.max(rawMax - rawMin, 1);
  const domMin = rawMin - span * 0.2;
  const domMax = rawMax + span * 0.12;

  const total = points.length + 1; // history points + one projected step
  const x = (index: number) => padL + (index / (total - 1)) * (W - padL - padR);
  const y = (value: number) => padT + (1 - (value - domMin) / (domMax - domMin)) * (H - padT - padB);

  const lastIndex = points.length - 1;
  const historyLine = points.map((value, index) => `${x(index)},${y(value)}`).join(' ');
  const area = `${x(0)},${H - padB} ${historyLine} ${x(lastIndex)},${H - padB}`;

  const gridValues = [rawMax, (rawMin + rawMax) / 2, rawMin].map((value) => Math.round(value));

  return (
    <Svg width="100%" height={118} viewBox={`0 0 ${W} ${H}`}>
      {gridValues.map((value) => (
        <React.Fragment key={value}>
          <Line x1={padL} x2={W - padR} y1={y(value)} y2={y(value)} stroke="rgba(255,255,255,0.14)" strokeWidth={1} />
          <SvgText x={W - padR + 6} y={y(value) + 3.5} fontSize={9.5} fontWeight="700" fill="rgba(255,255,255,0.5)">
            {value}
          </SvgText>
        </React.Fragment>
      ))}
      <Polygon points={area} fill="rgba(255,255,255,0.12)" />
      <Polyline points={historyLine} fill="none" stroke="#FFFFFF" strokeWidth={2.6} strokeLinejoin="round" strokeLinecap="round" />
      <Line
        x1={x(lastIndex)}
        y1={y(points[lastIndex])}
        x2={x(total - 1)}
        y2={y(projectedNext)}
        stroke="#37D08A"
        strokeWidth={2.6}
        strokeDasharray="3 3"
        strokeLinecap="round"
      />
      <Circle cx={x(lastIndex)} cy={y(points[lastIndex])} r={3.4} fill="#FFFFFF" />
      <Circle cx={x(total - 1)} cy={y(projectedNext)} r={5} fill="#37D08A" stroke="#241743" strokeWidth={2.5} />
      <SvgText x={x(total - 1) - 6} y={y(projectedNext) - 9} fontSize={11} fontWeight="800" fill="#FFFFFF" textAnchor="end">
        {`${fmt(projectedNext)} ${unitPreference}`}
      </SvgText>
    </Svg>
  );
}

function Cell({ value, pro }: { value: TableCell; pro?: boolean }) {
  if (value === 1) {
    return <CheckGlyph color={pro ? HG.purple : PW.green} />;
  }
  if (value === 0) {
    return <View style={styles.cellDash} />;
  }
  return null;
}

function BenefitCard({
  index,
  title,
  body,
  children,
}: {
  index: number;
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.benefitCard}>
      <View style={styles.benefitHead}>
        <View style={styles.benefitIndex}>
          <Text style={styles.benefitIndexText}>{`0${index + 1}`}</Text>
        </View>
        <Text style={styles.benefitTitle}>{title}</Text>
      </View>
      <Text style={styles.benefitBody}>{body}</Text>
      <View style={styles.benefitSpecimen}>{children}</View>
    </View>
  );
}

export function PremiumScreen({
  previewUnlocked,
  proUnlocked,
  heroChart,
  unitPreference,
  sessionCount,
  coachSpecimen,
  trainingDayIndexes,
  language = 'en',
  onBack,
  onTogglePreview,
}: PremiumScreenProps) {
  const [plan, setPlan] = useState<'yearly' | 'monthly'>('yearly');
  const promoOnly = proUnlocked && !previewUnlocked;
  const chartStep = heroChart ? fmt(heroChart.projectedNext - heroChart.latest) : null;
  const lastChips = heroChart ? heroChart.points.slice(-3) : [];

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(language, 'common.back')}
          onPress={onBack}
          style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
        >
          <Svg width={19} height={19} viewBox="0 0 24 24" fill="none">
            <Path d="M6 6l12 12M18 6L6 18" stroke={HG.ink} strokeWidth={2.2} strokeLinecap="round" />
          </Svg>
        </Pressable>
        {/* Restore is required store copy once billing ships; inert until then. */}
        <Text style={styles.restore}>{t(language, 'pro.page.restore')}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* HERO — the user's own numbers do the selling */}
        <View style={styles.hero}>
          <View style={styles.heroKickerRow}>
            <SparkGlyph color={PW.sheetLavender} />
            <Text style={styles.heroKicker}>{t(language, 'pro.page.eyebrow')}</Text>
          </View>
          {/* Finnish needs its own singular: "1 treeniä" is wrong, and one
              plural key cannot cover both cases. */}
          <Text style={styles.heroTitle}>
            {sessionCount === 0
              ? t(language, 'pro.page.heroTitleFresh')
              : sessionCount === 1
                ? t(language, 'pro.page.heroTitleOne')
                : t(language, 'pro.page.heroTitle', { count: sessionCount })}
          </Text>
          <Text style={styles.heroBody}>{t(language, 'pro.page.heroBody')}</Text>

          <View style={styles.heroChartCard}>
            {heroChart ? (
              <>
                <View style={styles.heroChartHead}>
                  <Text style={styles.heroChartLabel}>
                    {t(language, 'pro.page.chartLabel', { lift: heroChart.liftName.toUpperCase() })}
                  </Text>
                  <View style={styles.heroChartPill}>
                    <Svg width={9} height={9} viewBox="0 0 12 12">
                      <Path d="M6 3l4 5H2z" fill="#7DEBB4" />
                    </Svg>
                    <Text style={styles.heroChartPillText}>{`+${chartStep} ${unitPreference}`}</Text>
                  </View>
                </View>
                <HeroChart chart={heroChart} unitPreference={unitPreference} />
                <View style={styles.heroChartFootRow}>
                  <View style={styles.heroChartDash} />
                  <Text style={styles.heroChartFoot}>
                    {t(language, 'pro.page.chartNext', { step: `${chartStep} ${unitPreference}` })}
                  </Text>
                </View>
              </>
            ) : (
              <Text style={styles.heroChartEmpty}>{t(language, 'pro.page.chartEmpty')}</Text>
            )}
          </View>
        </View>

        {/* THREE BENEFITS — each with a specimen of real output */}
        <Text style={styles.sectionLabel}>{t(language, 'pro.page.whatYouGet')}</Text>
        <View style={styles.benefitList}>
          <BenefitCard index={0} title={t(language, 'pro.page.b1.title')} body={t(language, 'pro.page.b1.body')}>
            <View style={styles.specimenHead}>
              <SparkGlyph color={HG.purple} size={13} />
              <Text style={styles.specimenTag}>{t(language, 'pro.page.b1.tag')}</Text>
            </View>
            <Text style={coachSpecimen ? styles.specimenQuote : styles.specimenEmpty}>
              {coachSpecimen ? `“${coachSpecimen}”` : t(language, 'pro.page.b1.empty')}
            </Text>
          </BenefitCard>

          <BenefitCard index={1} title={t(language, 'pro.page.b2.title')} body={t(language, 'pro.page.b2.body')}>
            {heroChart && lastChips.length > 0 ? (
              <View style={styles.chipRow}>
                {lastChips.map((weight, index) => (
                  <View key={index} style={styles.chip}>
                    <Text style={styles.chipText}>{fmt(weight)}</Text>
                  </View>
                ))}
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Path d="M5 12h14M13 6l6 6-6 6" stroke={HG.faint} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
                <View style={[styles.chip, styles.chipNext]}>
                  <Text style={styles.chipNextText}>{fmt(heroChart.projectedNext)}</Text>
                </View>
                <View style={styles.chipDelta}>
                  <Text style={styles.chipDeltaText}>{`+${chartStep}`}</Text>
                </View>
              </View>
            ) : (
              <Text style={styles.specimenEmpty}>{t(language, 'pro.page.b2.empty')}</Text>
            )}
          </BenefitCard>

          <BenefitCard index={2} title={t(language, 'pro.page.b3.title')} body={t(language, 'pro.page.b3.body')}>
            <View style={styles.weekRow}>
              {['M', 'T', 'K', 'T', 'P', 'L', 'S'].map((label, index) => (
                <View key={index} style={styles.weekCol}>
                  <View
                    style={[styles.weekBar, trainingDayIndexes.includes(index) && styles.weekBarActive]}
                  />
                  <Text style={styles.weekLabel}>{label}</Text>
                </View>
              ))}
            </View>
          </BenefitCard>
        </View>

        {/* THE PROMISE — the whole pitch in two lines */}
        <View style={styles.promise}>
          <View style={styles.promiseFree}>
            <Text style={styles.promiseFreeLabel}>{t(language, 'pro.page.promiseFree')}</Text>
            <Text style={styles.promiseFreeLine}>{t(language, 'pro.page.promiseFreeLine')}</Text>
          </View>
          <View style={styles.promisePro}>
            <Text style={styles.promiseProLabel}>{t(language, 'pro.page.promisePro')}</Text>
            <Text style={styles.promiseProLine}>{t(language, 'pro.page.promiseProLine')}</Text>
          </View>
        </View>

        {/* GROUPED TABLE — verbs, not feature names */}
        <Text style={styles.sectionLabel}>{t(language, 'pro.page.whereLine')}</Text>
        <View style={styles.table}>
          <View style={styles.tableHeadRow}>
            <View style={styles.tableLabelCol} />
            <Text style={styles.tableHeadFree}>{t(language, 'pro.page.colFree')}</Text>
            <Text style={styles.tableHeadPro}>{t(language, 'pro.page.colPro')}</Text>
          </View>
          {TABLE.map((band) => (
            <View key={band.bandKey}>
              <View style={styles.bandRow}>
                <Text style={styles.bandLabel}>{t(language, band.bandKey)}</Text>
                <View style={[styles.bandNote, band.notePro ? styles.bandNotePro : styles.bandNoteFree]}>
                  <Text style={[styles.bandNoteText, band.notePro ? styles.bandNoteTextPro : styles.bandNoteTextFree]}>
                    {t(language, band.noteKey)}
                  </Text>
                </View>
              </View>
              {band.rows.map(([labelKey, freeCell, proCell]) => (
                <View key={labelKey} style={styles.tableRow}>
                  <Text style={styles.tableRowLabel}>{t(language, labelKey)}</Text>
                  <View style={styles.tableCell}>
                    {freeCell === 'quota' ? (
                      <Text style={styles.quotaText}>{t(language, 'pro.page.coachQuota')}</Text>
                    ) : (
                      <Cell value={freeCell} />
                    )}
                  </View>
                  <View style={styles.tableCell}>
                    <Cell value={proCell} pro />
                  </View>
                </View>
              ))}
            </View>
          ))}
          <Text style={styles.tableFoot}>{t(language, 'pro.page.tableFoot')}</Text>
        </View>

        {/* PLAN — planned prices, labeled planned */}
        <Text style={styles.sectionLabel}>{t(language, 'pro.page.choosePlan')}</Text>
        <View style={styles.planRow}>
          {(
            [
              { id: 'yearly' as const, per: '5,99 €', billedKey: 'pro.page.billedYearly' as I18nKey, save: true },
              { id: 'monthly' as const, per: '9,99 €', billedKey: 'pro.page.billedMonthly' as I18nKey, save: false },
            ]
          ).map((option) => {
            const on = plan === option.id;
            return (
              <Pressable
                key={option.id}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => setPlan(option.id)}
                style={[styles.planCard, on && styles.planCardOn]}
              >
                {option.save ? (
                  <View style={styles.planSave}>
                    <Text style={styles.planSaveText}>{t(language, 'pro.page.save')}</Text>
                  </View>
                ) : null}
                <View style={styles.planHeadRow}>
                  <View style={[styles.planRadio, on && styles.planRadioOn]}>
                    {on ? <View style={styles.planRadioDot} /> : null}
                  </View>
                  <Text style={styles.planName}>
                    {t(language, option.id === 'yearly' ? 'pro.page.yearly' : 'pro.page.monthly')}
                  </Text>
                </View>
                <View style={styles.planPriceRow}>
                  <Text style={styles.planPrice}>{option.per}</Text>
                  <Text style={styles.planPer}>{t(language, 'pro.page.perMonth')}</Text>
                </View>
                <Text style={styles.planBilled}>{t(language, option.billedKey)}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.reassure}>{t(language, 'pro.page.reassure')}</Text>
      </ScrollView>

      {/* PINNED CTA — the honest one: the preview switch until billing exists */}
      <View style={styles.ctaBar}>
        {promoOnly ? (
          <Text style={styles.promoNote}>{t(language, 'pro.page.promoNote')}</Text>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={onTogglePreview}
            style={({ pressed }) => [styles.ctaButton, pressed && styles.pressed]}
          >
            <Text style={styles.ctaButtonText}>
              {t(language, previewUnlocked ? 'pro.page.previewCtaOn' : 'pro.page.previewCtaOff')}
            </Text>
          </Pressable>
        )}
        <Text style={styles.ctaFine}>{t(language, 'pro.page.plannedNote')}</Text>
        <View style={styles.legalRow}>
          <Text style={styles.legalText}>{t(language, 'pro.page.terms')}</Text>
          <View style={styles.legalDot} />
          <Text style={styles.legalText}>{t(language, 'pro.page.privacy')}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: HG.bg,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 2,
    paddingBottom: 6,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: HG.surface,
    borderWidth: 1,
    borderColor: HG.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.85,
  },
  restore: {
    fontSize: 13.5,
    fontWeight: '800',
    color: HG.purple,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 4,
    paddingBottom: 16,
  },
  hero: {
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 18,
    backgroundColor: PW.sheetMid,
  },
  heroKickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  heroKicker: {
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 1.3,
    color: PW.sheetLavender,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 31,
    marginTop: 12,
  },
  heroBody: {
    fontSize: 13.5,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 20,
    marginTop: 10,
  },
  heroChartCard: {
    marginTop: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingTop: 13,
    paddingBottom: 11,
  },
  heroChartHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  heroChartLabel: {
    flex: 1,
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: 'rgba(255,255,255,0.6)',
  },
  heroChartPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(55,208,138,0.2)',
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  heroChartPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#7DEBB4',
  },
  heroChartFootRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 6,
  },
  heroChartDash: {
    width: 14,
    borderTopWidth: 2,
    borderColor: '#37D08A',
    borderStyle: 'dashed',
  },
  heroChartFoot: {
    fontSize: 11.5,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.66)',
  },
  heroChartEmpty: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 19,
  },
  sectionLabel: {
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 1,
    color: HG.faint,
    marginTop: 24,
    marginBottom: 11,
    paddingHorizontal: 2,
  },
  benefitList: {
    gap: 12,
  },
  benefitCard: {
    backgroundColor: HG.surface,
    borderWidth: 1,
    borderColor: HG.border,
    borderRadius: 20,
    paddingHorizontal: 17,
    paddingTop: 17,
    paddingBottom: 15,
  },
  benefitHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  benefitIndex: {
    backgroundColor: HG.purpleLight,
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  benefitIndexText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1,
    color: PW.proInk,
  },
  benefitTitle: {
    flex: 1,
    fontSize: 17.5,
    fontWeight: '800',
    color: HG.ink,
  },
  benefitBody: {
    fontSize: 13.5,
    fontWeight: '600',
    color: HG.muted,
    lineHeight: 20,
    marginTop: 9,
  },
  benefitSpecimen: {
    marginTop: 14,
    backgroundColor: HG.surfaceSoft,
    borderWidth: 1,
    borderColor: HG.border,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  specimenHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 8,
  },
  specimenTag: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    color: HG.faint,
  },
  specimenQuote: {
    fontSize: 13.5,
    fontWeight: '700',
    color: HG.ink,
    lineHeight: 20,
  },
  specimenEmpty: {
    fontSize: 12.5,
    fontWeight: '600',
    color: HG.muted,
    lineHeight: 18,
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  chip: {
    backgroundColor: HG.surface,
    borderWidth: 1,
    borderColor: HG.border,
    borderRadius: 9,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '800',
    color: HG.muted,
  },
  chipNext: {
    backgroundColor: HG.purple,
    borderColor: HG.purple,
  },
  chipNextText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  chipDelta: {
    backgroundColor: PW.greenSoft,
    borderRadius: 7,
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  chipDeltaText: {
    fontSize: 11,
    fontWeight: '800',
    color: PW.green,
  },
  weekRow: {
    flexDirection: 'row',
    gap: 6,
  },
  weekCol: {
    flex: 1,
    alignItems: 'center',
  },
  weekBar: {
    alignSelf: 'stretch',
    height: 6,
    borderRadius: 999,
    backgroundColor: '#E6DEF7',
  },
  weekBarActive: {
    backgroundColor: HG.purple,
  },
  weekLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: HG.faint,
    marginTop: 5,
  },
  promise: {
    marginTop: 24,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: HG.border,
  },
  promiseFree: {
    backgroundColor: HG.surface,
    paddingVertical: 15,
    paddingHorizontal: 17,
  },
  promiseFreeLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1,
    color: HG.faint,
  },
  promiseFreeLine: {
    fontSize: 16.5,
    fontWeight: '800',
    color: HG.ink,
    marginTop: 6,
  },
  promisePro: {
    backgroundColor: '#2B1B4F',
    paddingVertical: 15,
    paddingHorizontal: 17,
  },
  promiseProLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1,
    color: PW.sheetLavender,
  },
  promiseProLine: {
    fontSize: 16.5,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 6,
    lineHeight: 22,
  },
  table: {
    backgroundColor: HG.surface,
    borderWidth: 1,
    borderColor: HG.border,
    borderRadius: 18,
    overflow: 'hidden',
  },
  tableHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 15,
    backgroundColor: HG.surfaceSoft,
    borderBottomWidth: 1,
    borderBottomColor: HG.border,
  },
  tableLabelCol: {
    flex: 1,
  },
  tableHeadFree: {
    width: 58,
    textAlign: 'center',
    fontSize: 11.5,
    fontWeight: '800',
    color: HG.muted,
  },
  tableHeadPro: {
    width: 66,
    textAlign: 'center',
    fontSize: 11.5,
    fontWeight: '800',
    color: HG.purple,
  },
  bandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 15,
    backgroundColor: '#FBF8FF',
    borderBottomWidth: 1,
    borderBottomColor: HG.border,
  },
  bandLabel: {
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 1,
    color: HG.ink,
  },
  bandNote: {
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 7,
  },
  bandNoteFree: {
    backgroundColor: PW.greenSoft,
  },
  bandNotePro: {
    backgroundColor: HG.purpleLight,
  },
  bandNoteText: {
    fontSize: 10,
    fontWeight: '800',
  },
  bandNoteTextFree: {
    color: PW.green,
  },
  bandNoteTextPro: {
    color: PW.proInk,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: HG.border,
  },
  tableRowLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: HG.ink,
    paddingRight: 6,
  },
  tableCell: {
    width: 58,
    alignItems: 'center',
  },
  cellDash: {
    width: 12,
    height: 2,
    borderRadius: 2,
    backgroundColor: HG.faint,
  },
  quotaText: {
    fontSize: 11,
    fontWeight: '800',
    color: HG.muted,
  },
  tableFoot: {
    paddingVertical: 13,
    paddingHorizontal: 15,
    fontSize: 12,
    fontWeight: '600',
    color: HG.muted,
    lineHeight: 18,
  },
  planRow: {
    flexDirection: 'row',
    gap: 11,
  },
  planCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: HG.border,
    backgroundColor: HG.surface,
    paddingVertical: 15,
    paddingHorizontal: 15,
  },
  planCardOn: {
    borderColor: HG.purple,
    backgroundColor: HG.purpleLight,
  },
  planSave: {
    position: 'absolute',
    top: -10,
    right: 12,
    backgroundColor: PW.green,
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 9,
  },
  planSaveText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  planHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  planRadio: {
    width: 19,
    height: 19,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: HG.faint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planRadioOn: {
    borderColor: HG.purple,
  },
  planRadioDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
    backgroundColor: HG.purple,
  },
  planName: {
    fontSize: 14,
    fontWeight: '800',
    color: HG.ink,
  },
  planPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
    marginTop: 11,
  },
  planPrice: {
    fontSize: 27,
    fontWeight: '800',
    color: HG.ink,
  },
  planPer: {
    fontSize: 13,
    fontWeight: '700',
    color: HG.muted,
  },
  planBilled: {
    fontSize: 11.5,
    fontWeight: '600',
    color: HG.muted,
    marginTop: 4,
  },
  reassure: {
    fontSize: 11.5,
    fontWeight: '600',
    color: HG.faint,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 16,
  },
  ctaBar: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: layout.bottomTabBarReserve,
    backgroundColor: HG.surface,
    borderTopWidth: 1,
    borderTopColor: HG.border,
  },
  ctaButton: {
    height: 54,
    borderRadius: 16,
    backgroundColor: HG.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  promoNote: {
    fontSize: 13,
    fontWeight: '700',
    color: HG.ink,
    lineHeight: 19,
    textAlign: 'center',
  },
  ctaFine: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: HG.muted,
    marginTop: 9,
  },
  legalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginTop: 8,
  },
  legalText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: HG.faint,
  },
  legalDot: {
    width: 3,
    height: 3,
    borderRadius: 999,
    backgroundColor: HG.faint,
  },
});
