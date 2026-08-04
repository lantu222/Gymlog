import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Polygon, Polyline, Text as SvgText } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProPill } from '../components/ProLockedCard';
import { removeTrailingZeros } from '../lib/format';
import { I18nKey, t } from '../lib/i18n';
import { PremiumHeroChart } from '../lib/premiumHeroChart';
import { PW } from '../lightTheme';
import { Theme, useTheme, useThemedStyles } from '../theming';
import { AppLanguage, UnitPreference } from '../types/models';

/**
 * The Pro full page (design: Vinha Premium v2 / premium2-app.jsx).
 *
 * Structure: own-data hero → three grouped reasons → the free tier stated
 * plainly → plan select → a free/premium table where every cell is a phrase →
 * pinned CTA. The hero is still the user's own numbers with an honest empty
 * state, and every claim below it was checked against the code (see the note
 * above GROUPS).
 *
 * The CTA advertises a trial that does not exist. That is a demo-only decision
 * and releaseReadiness.test.cjs holds the other end of it.
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
  onOpenLegal: (document: 'privacy' | 'terms') => void;
}

/**
 * Every line on this page was checked against the code on 2026-08-01. Claims
 * from the v2 mock that described things this app does not do were cut rather
 * than shipped: a watch app, several active programs, an eight-week cap on free
 * history, and a free tier that gets one AI build. What is left is either live
 * or wears a SOON badge.
 */
const IC = {
  spark: 'M12 2l2.2 5.8L20 10l-5.8 2.2L12 18l-2.2-5.8L4 10l5.8-2.2z',
  clock: 'M12 21a8 8 0 100-16 8 8 0 000 16zM12 13V9M9 3h6',
  lines: 'M4 7h16M4 12h10M4 17h7',
  chart: 'M4 19V5M4 19h16M8 15l3-4 3 2 4-6',
  chat: 'M20 15a3 3 0 01-3 3H8l-4 3V6a3 3 0 013-3h10a3 3 0 013 3z',
  layers: 'M12 3l8 4.5-8 4.5-8-4.5 8-4.5zM4 12l8 4.5 8-4.5',
  doc: 'M7 3h7l4 4v14H7zM14 3v4h4',
  heart: 'M12 20S4 14 4 9a4 4 0 017.5-2A4 4 0 0120 9c0 5-8 11-8 11z',
  moon: 'M20 14a8 8 0 01-10-10 8 8 0 1010 10z',
  cloud: 'M7 18a4 4 0 010-8 5 5 0 019.6-1.4A3.5 3.5 0 1117.5 18z',
};

interface ProItem {
  titleKey: I18nKey;
  bodyKey: I18nKey;
  soon?: boolean;
  icon: string;
}

const GROUPS: Array<{ key: string; kickerKey: I18nKey; titleKey: I18nKey; leadKey: I18nKey; items: ProItem[] }> = [
  {
    key: 'coach',
    kickerKey: 'pro.v2.group.coach.kicker',
    titleKey: 'pro.v2.group.coach.title',
    leadKey: 'pro.v2.group.coach.lead',
    items: [
      // progressionGate.ts; +2.5 kg is the beginner tier's real increment,
      // not a round number chosen for the page. The adaptive set coach and the
      // smart rest timing used to head this group; they were removed with the
      // list logger they lived in (user decision 2026-08-02), so they are not
      // sold here any more.
      { titleKey: 'pro.v2.coach.progression.t', bodyKey: 'pro.v2.coach.progression.b', icon: IC.chart },
      { titleKey: 'pro.v2.coach.session.t', bodyKey: 'pro.v2.coach.session.b', soon: true, icon: IC.lines },
    ],
  },
  {
    key: 'plan',
    kickerKey: 'pro.v2.group.plan.kicker',
    titleKey: 'pro.v2.group.plan.title',
    leadKey: 'pro.v2.group.plan.lead',
    items: [
      // The free quota is real: 3 coach questions a week (aiCoachQuota.ts).
      { titleKey: 'pro.v2.plan.coach.t', bodyKey: 'pro.v2.plan.coach.b', icon: IC.chat },
      // Free gets none, not one — openAiMode() sends free users to this page.
      { titleKey: 'pro.v2.plan.builder.t', bodyKey: 'pro.v2.plan.builder.b', icon: IC.layers },
    ],
  },
  {
    key: 'read',
    kickerKey: 'pro.v2.group.read.kicker',
    titleKey: 'pro.v2.group.read.title',
    leadKey: 'pro.v2.group.read.lead',
    items: [
      { titleKey: 'pro.v2.read.analysis.t', bodyKey: 'pro.v2.read.analysis.b', icon: IC.doc },
      { titleKey: 'pro.v2.read.why.t', bodyKey: 'pro.v2.read.why.b', icon: IC.chart },
      { titleKey: 'pro.v2.read.recovery.t', bodyKey: 'pro.v2.read.recovery.b', icon: IC.heart },
      { titleKey: 'pro.v2.read.theme.t', bodyKey: 'pro.v2.read.theme.b', icon: IC.moon },
      // Not built. The privacy policy two taps away says data stays on the
      // phone, so this cannot be a live promise — only a stated intention.
      { titleKey: 'pro.v2.read.backup.t', bodyKey: 'pro.v2.read.backup.b', soon: true, icon: IC.cloud },
    ],
  },
];

/** A cell is either a phrase, or a dash meaning "not in this tier". */
type Cellv2 = I18nKey | null;

const ROWS: Array<{ labelKey: I18nKey; free: Cellv2; pro: Cellv2 }> = [
  { labelKey: 'pro.v2.row.logging', free: 'pro.v2.val.unlimited', pro: 'pro.v2.val.unlimited' },
  { labelKey: 'pro.v2.row.ready', free: 'pro.v2.val.all', pro: 'pro.v2.val.all' },
  { labelKey: 'pro.v2.row.own', free: 'pro.v2.val.yes', pro: 'pro.v2.val.yes' },
  // Never capped, in either tier. The one row that says we do not hold your
  // own data hostage, so it is stated rather than hidden.
  { labelKey: 'pro.v2.row.history', free: 'pro.v2.val.allTime', pro: 'pro.v2.val.allTime' },
  { labelKey: 'pro.v2.row.records', free: 'pro.v2.val.yes', pro: 'pro.v2.val.yes' },
  { labelKey: 'pro.v2.row.guided', free: 'pro.v2.val.yes', pro: 'pro.v2.val.yes' },
  { labelKey: 'pro.v2.row.widget', free: 'pro.v2.val.yes', pro: 'pro.v2.val.yes' },
  { labelKey: 'pro.v2.row.csv', free: 'pro.v2.val.yes', pro: 'pro.v2.val.yes' },
  // Detection is free — the conclusion is Pro (the paywall-moments rule).
  { labelKey: 'pro.v2.row.plateau', free: 'pro.v2.val.yes', pro: 'pro.v2.val.yes' },
  { labelKey: 'pro.v2.row.coachQ', free: 'pro.v2.val.threeWeek', pro: 'pro.v2.val.unlimited' },
  { labelKey: 'pro.v2.row.builder', free: null, pro: 'pro.v2.val.yes' },
  { labelKey: 'pro.v2.row.progression', free: null, pro: 'pro.v2.val.yes' },
  { labelKey: 'pro.v2.row.why', free: null, pro: 'pro.v2.val.yes' },
  { labelKey: 'pro.v2.row.recovery', free: null, pro: 'pro.v2.val.yes' },
  { labelKey: 'pro.v2.row.analysis', free: null, pro: 'pro.v2.val.yes' },
  { labelKey: 'pro.v2.row.theme', free: null, pro: 'pro.v2.val.yes' },
  { labelKey: 'pro.v2.row.adaptSession', free: null, pro: 'pro.v2.val.soon' },
  { labelKey: 'pro.v2.row.backup', free: null, pro: 'pro.v2.val.soon' },
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
  const styles = useThemedStyles(makeStyles);

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
  onOpenLegal,
}: PremiumScreenProps) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
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
            <Path d="M6 6l12 12M18 6L6 18" stroke={theme.ink} strokeWidth={2.2} strokeLinecap="round" />
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

        {/* THREE GROUPS — the reason to buy, then why the price is fair */}
        {GROUPS.map((group) => (
          <View key={group.key} style={styles.group}>
            <Text style={styles.groupKicker}>{t(language, group.kickerKey)}</Text>
            <Text style={styles.groupTitle}>{t(language, group.titleKey)}</Text>
            <Text style={styles.groupLead}>{t(language, group.leadKey)}</Text>
            <View style={styles.groupItems}>
              {group.items.map((item) => (
                <View key={item.titleKey} style={styles.itemCard}>
                  <View style={styles.itemIcon}>
                    <Svg width={21} height={21} viewBox="0 0 24 24" fill="none">
                      <Path
                        d={item.icon}
                        stroke={theme.purple}
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
                  </View>
                  <View style={styles.itemCopy}>
                    <View style={styles.itemTitleRow}>
                      <Text style={styles.itemTitle}>{t(language, item.titleKey)}</Text>
                      {item.soon ? (
                        <View style={styles.soonPill}>
                          <Text style={styles.soonPillText}>{t(language, 'pro.v2.soon')}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.itemBody}>{t(language, item.bodyKey)}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ))}

        {/* Free stated plainly, before the price — trust first. */}
        <View style={styles.freeCard}>
          <View style={styles.freeHead}>
            <CheckGlyph color={theme.green} />
            <Text style={styles.freeTitle}>{t(language, 'pro.v2.free.title')}</Text>
          </View>
          <Text style={styles.freeBody}>{t(language, 'pro.v2.free.body')}</Text>
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
        {/* COMPARE — every cell is a phrase, not a tick nobody can read */}
        <Text style={styles.sectionLabel}>{t(language, 'pro.v2.compare')}</Text>
        <View style={styles.table}>
          <View style={styles.tableHeadRow}>
            <View style={styles.tableLabelCol} />
            <Text style={styles.tableHeadFree}>{t(language, 'pro.page.colFree')}</Text>
            <Text style={styles.tableHeadPro}>{t(language, 'pro.page.colPro')}</Text>
          </View>
          {ROWS.map((row, index) => (
            <View
              key={row.labelKey}
              style={[styles.tableRow, index === ROWS.length - 1 && styles.tableRowLast]}
            >
              <Text style={styles.tableRowLabel}>{t(language, row.labelKey)}</Text>
              <View style={styles.tableCell}>
                {row.free ? (
                  <Text style={styles.cellFree}>{t(language, row.free)}</Text>
                ) : (
                  <View style={styles.cellDash} />
                )}
              </View>
              <View style={styles.tableCell}>
                {row.pro ? (
                  <Text style={row.pro === 'pro.v2.val.soon' ? styles.cellSoon : styles.cellPro}>
                    {t(language, row.pro)}
                  </Text>
                ) : (
                  <View style={styles.cellDash} />
                )}
              </View>
            </View>
          ))}
        </View>
        <Text style={styles.tableFoot}>{t(language, 'pro.v2.footer')}</Text>

      </ScrollView>

      {/*
        PINNED CTA. This button does not sell anything — billing does not exist.
        It is here because this is a demo build (user decision 2026-08-01) and
        the preview switch that used to live here read as a broken feature.

        releaseReadiness.test.cjs fails while this copy is present and billing
        still is not, so the demo cannot become the release by forgetting.
      */}
      {/* Sits on the gesture bar with only the system inset under it. The fine
          print and the legal links are what push the button up, so they are
          tight — every point spent below the CTA is a point of the page you
          cannot see. */}
      <View style={[styles.ctaBar, { paddingBottom: insets.bottom + 2 }]}>
        <Pressable
          accessibilityRole="button"
          onPress={onTogglePreview}
          style={({ pressed }) => [styles.ctaButton, pressed && styles.pressed]}
        >
          <Text style={styles.ctaButtonText}>{t(language, 'pro.v2.cta')}</Text>
        </Pressable>
        <Text style={styles.ctaFine}>
          {t(language, plan === 'yearly' ? 'pro.v2.ctaSubYearly' : 'pro.v2.ctaSubMonthly')}
        </Text>
        <View style={styles.legalRow}>
          <Pressable accessibilityRole="button" onPress={() => onOpenLegal('terms')} hitSlop={8}>
            <Text style={styles.legalText}>{t(language, 'pro.page.terms')}</Text>
          </Pressable>
          <View style={styles.legalDot} />
          <Pressable accessibilityRole="button" onPress={() => onOpenLegal('privacy')} hitSlop={8}>
            <Text style={styles.legalText}>{t(language, 'pro.page.privacy')}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.bg,
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
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.85,
  },
  restore: {
    fontSize: 13.5,
    fontWeight: '800',
    color: theme.purple,
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
    color: theme.faint,
    marginTop: 24,
    marginBottom: 11,
    paddingHorizontal: 2,
  },
  benefitCard: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
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
    backgroundColor: theme.purpleLight,
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  benefitIndexText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1,
    color: theme.purpleDark,
  },
  benefitTitle: {
    flex: 1,
    fontSize: 17.5,
    fontWeight: '800',
    color: theme.ink,
  },
  benefitBody: {
    fontSize: 13.5,
    fontWeight: '600',
    color: theme.muted,
    lineHeight: 20,
    marginTop: 9,
  },
  benefitSpecimen: {
    marginTop: 14,
    backgroundColor: theme.surfaceSoft,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  table: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 18,
    overflow: 'hidden',
  },
  tableHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 15,
    backgroundColor: theme.surfaceSoft,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  tableLabelCol: {
    flex: 1,
  },
  tableHeadFree: {
    width: 58,
    textAlign: 'center',
    fontSize: 11.5,
    fontWeight: '800',
    color: theme.muted,
  },
  tableHeadPro: {
    width: 66,
    textAlign: 'center',
    fontSize: 11.5,
    fontWeight: '800',
    color: theme.purple,
  },
  // Both pills sit on a themed fill, so their labels have to be themed too.
  // PW's fixed pair put a dark-purple "Pro" on theme.purpleLight — fine on the
  // light tint, invisible once that tint went dark.
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  tableRowLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: theme.ink,
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
    backgroundColor: theme.faint,
  },
  cellFree: {
    fontSize: 11.5,
    fontWeight: '700',
    color: theme.muted,
    textAlign: 'center',
  },
  cellPro: {
    fontSize: 11.5,
    fontWeight: '800',
    color: theme.purple,
    textAlign: 'center',
  },
  // Soon is deliberately quiet: it is a plan, not a feature you are buying.
  cellSoon: {
    fontSize: 11.5,
    fontWeight: '700',
    color: theme.faint,
    textAlign: 'center',
  },
  group: {
    marginTop: 24,
  },
  groupKicker: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: theme.purple,
  },
  groupTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
    color: theme.ink,
    marginTop: 6,
    lineHeight: 24,
  },
  groupLead: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.muted,
    marginTop: 5,
    lineHeight: 19,
  },
  groupItems: {
    gap: 9,
    marginTop: 13,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 16,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemCopy: {
    flex: 1,
    minWidth: 0,
  },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  itemTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: theme.ink,
    flexShrink: 1,
  },
  soonPill: {
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: 999,
    backgroundColor: theme.surfaceSoft,
  },
  soonPillText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: theme.muted,
  },
  itemBody: {
    fontSize: 12.5,
    fontWeight: '600',
    color: theme.muted,
    marginTop: 3,
    lineHeight: 18.5,
  },
  freeCard: {
    marginTop: 24,
    backgroundColor: theme.surfaceSoft,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 18,
    paddingVertical: 15,
    paddingHorizontal: 16,
  },
  freeHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  freeTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: theme.ink,
  },
  freeBody: {
    fontSize: 12.5,
    fontWeight: '600',
    color: theme.muted,
    marginTop: 6,
    lineHeight: 19,
  },
  tableRowLast: {
    borderBottomWidth: 0,
  },
  tableFoot: {
    paddingVertical: 13,
    paddingHorizontal: 15,
    fontSize: 12,
    fontWeight: '600',
    color: theme.muted,
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
    borderColor: theme.border,
    backgroundColor: theme.surface,
    paddingVertical: 15,
    paddingHorizontal: 15,
  },
  planCardOn: {
    borderColor: theme.purple,
    backgroundColor: theme.purpleLight,
  },
  planSave: {
    position: 'absolute',
    top: -10,
    right: 12,
    backgroundColor: theme.green,
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
    borderColor: theme.faint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planRadioOn: {
    borderColor: theme.purple,
  },
  planRadioDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
    backgroundColor: theme.purple,
  },
  planName: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.ink,
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
    color: theme.ink,
  },
  planPer: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.muted,
  },
  planBilled: {
    fontSize: 11.5,
    fontWeight: '600',
    color: theme.muted,
    marginTop: 4,
  },
  // The tab bar is hidden on this route, so the CTA sits on the real bottom
  // edge and the page keeps a bar's worth of height it used to reserve for a
  // control that was floating over the button anyway.
  ctaBar: {
    paddingHorizontal: 18,
    paddingTop: 12,
    backgroundColor: theme.surface,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  ctaButton: {
    height: 54,
    borderRadius: 16,
    backgroundColor: theme.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  ctaFine: {
    textAlign: 'center',
    fontSize: 11.5,
    fontWeight: '600',
    color: theme.muted,
    marginTop: 7,
  },
  legalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginTop: 6,
  },
  legalText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: theme.faint,
    // These open the real documents now, so they have to look like links.
    textDecorationLine: 'underline',
  },
  legalDot: {
    width: 3,
    height: 3,
    borderRadius: 999,
    backgroundColor: theme.faint,
  },
});
