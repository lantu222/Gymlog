import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Polygon, Polyline, Text as SvgText } from 'react-native-svg';

import { removeTrailingZeros } from '../lib/format';
import { PremiumHeroChart } from '../lib/premiumHeroChart';
import { HG } from '../lightTheme';
import { layout } from '../theme';
import { UnitPreference } from '../types/models';

interface PremiumScreenProps {
  previewUnlocked: boolean;
  heroChart: PremiumHeroChart | null;
  unitPreference: UnitPreference;
  onBack: () => void;
  onTogglePreview: () => void;
}

type LaneVariant = 'coach' | 'rest' | 'session' | 'week';

const LANES: Array<{ live: boolean; title: string; body: string; variant: LaneVariant }> = [
  {
    live: true,
    variant: 'coach',
    title: 'Adaptive set coach',
    body: 'After each set GAINER reads your effort and sets the next load — up when you are flying, back off when you are not.',
  },
  {
    live: true,
    variant: 'rest',
    title: 'Smart rest timing',
    body: 'Rest shifts with the set instead of a fixed timer every round.',
  },
  {
    live: false,
    variant: 'session',
    title: 'Session adjustments',
    body: 'Bad day? It shortens or softens the session so you still train.',
  },
  {
    live: false,
    variant: 'week',
    title: 'Weekly adaptation',
    body: 'Hard weeks, missed sessions, and good runs reshape the next week.',
  },
];

const COMPARISON_ROWS: Array<{ label: string; free: boolean; premium: 'Live' | 'Soon' }> = [
  { label: 'Manual logging', free: true, premium: 'Live' },
  { label: 'Ready-made plans', free: true, premium: 'Live' },
  { label: 'Progress & measures', free: true, premium: 'Live' },
  { label: 'Adaptive set coach', free: false, premium: 'Live' },
  { label: 'Smart rest timing', free: false, premium: 'Live' },
  { label: 'Session adjustments', free: false, premium: 'Soon' },
  { label: 'Weekly adaptation', free: false, premium: 'Soon' },
];

function fmt(value: number) {
  return removeTrailingZeros(Number(value.toFixed(1)));
}

function LaneGlyph({ variant }: { variant: LaneVariant }) {
  const stroke = HG.purple;
  const common = { stroke, strokeWidth: 2, fill: 'none' as const, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (variant) {
    case 'coach':
      return (
        <Svg width={22} height={22} viewBox="0 0 24 24">
          <Path d="M12 2l2.2 5.8L20 10l-5.8 2.2L12 18l-2.2-5.8L4 10l5.8-2.2z" fill={stroke} />
        </Svg>
      );
    case 'rest':
      return (
        <Svg width={22} height={22} viewBox="0 0 24 24">
          <Circle cx={12} cy={13} r={8} {...common} />
          <Path d="M12 13V9M9 2h6" {...common} />
        </Svg>
      );
    case 'session':
      return (
        <Svg width={22} height={22} viewBox="0 0 24 24">
          <Path d="M4 7h16M4 12h10M4 17h7" {...common} />
        </Svg>
      );
    case 'week':
    default:
      return (
        <Svg width={22} height={22} viewBox="0 0 24 24">
          <Path d="M4 19V5M4 19h16M8 15l3-4 3 2 4-6" {...common} />
        </Svg>
      );
  }
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

export function PremiumScreen({
  previewUnlocked,
  heroChart,
  unitPreference,
  onBack,
  onTogglePreview,
}: PremiumScreenProps) {
  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable onPress={onBack} style={styles.closeButton}>
          <Svg width={19} height={19} viewBox="0 0 24 24">
            <Path d="M6 6l12 12M18 6L6 18" stroke={HG.ink} strokeWidth={2.2} strokeLinecap="round" />
          </Svg>
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* HERO */}
        <View style={styles.hero}>
          <View style={styles.heroKickerRow}>
            <Svg width={16} height={16} viewBox="0 0 24 24">
              <Path d="M12 2l2.2 5.8L20 10l-5.8 2.2L12 18l-2.2-5.8L4 10l5.8-2.2z" fill="#C9B6FF" />
            </Svg>
            <Text style={styles.heroKicker}>GAINER PREMIUM</Text>
          </View>
          <Text style={styles.heroTitle}>Keep progressing —{'\n'}without the guesswork</Text>
          <Text style={styles.heroBody}>
            The Adaptive Coach reads every set and sets your next load. The longer you train, the sharper it gets.
          </Text>

          {heroChart ? (
            <View style={styles.heroDataCard}>
              <View style={styles.heroDataHead}>
                <Text numberOfLines={1} style={styles.heroDataLabel}>
                  {heroChart.liftName.toUpperCase()} · WORKING WEIGHT
                </Text>
                <View style={styles.heroDataBadge}>
                  <Text style={styles.heroDataBadgeText}>Next step</Text>
                </View>
              </View>
              <View style={styles.heroChartWrap}>
                <HeroChart chart={heroChart} unitPreference={unitPreference} />
              </View>
              <View style={styles.heroDataFootRow}>
                <View style={styles.heroDashSwatch} />
                <Text style={styles.heroDataFoot}>
                  Coach&apos;s next step · {fmt(heroChart.latest)} → {fmt(heroChart.projectedNext)} {unitPreference}
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.heroEmptyCard}>
              <Text style={styles.heroEmptyTitle}>Your progression chart builds here</Text>
              <Text style={styles.heroEmptyText}>
                Log a few sessions with a tracked lift and the coach starts plotting your climb.
              </Text>
            </View>
          )}
        </View>

        {/* WHAT PREMIUM ADDS */}
        <Text style={styles.sectionLabel}>WHAT PREMIUM ADDS</Text>
        <View style={styles.laneList}>
          {LANES.map((lane) => (
            <View key={lane.title} style={styles.laneCard}>
              <View style={styles.laneIcon}>
                <LaneGlyph variant={lane.variant} />
              </View>
              <View style={styles.laneCopy}>
                <View style={styles.laneHead}>
                  <Text style={styles.laneTitle}>{lane.title}</Text>
                  <View style={[styles.tag, lane.live ? styles.tagLive : styles.tagSoon]}>
                    <Text style={[styles.tagText, lane.live ? styles.tagTextLive : styles.tagTextSoon]}>
                      {lane.live ? 'LIVE' : 'SOON'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.laneBody}>{lane.body}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* FREE VS PREMIUM */}
        <Text style={styles.sectionLabel}>FREE VS PREMIUM</Text>
        <View style={styles.compareCard}>
          <View style={styles.compareHeadRow}>
            <View style={styles.compareLabelCell} />
            <Text style={styles.compareHeadFree}>Free</Text>
            <Text style={styles.compareHeadPremium}>Premium</Text>
          </View>
          {COMPARISON_ROWS.map((row, index) => (
            <View
              key={row.label}
              style={[styles.compareRow, index === COMPARISON_ROWS.length - 1 && styles.compareRowLast]}
            >
              <Text style={styles.compareLabel}>{row.label}</Text>
              <View style={styles.compareCell}>
                {row.free ? <CheckGlyph color={HG.green} /> : <View style={styles.compareDash} />}
              </View>
              <View style={styles.compareCell}>
                {row.premium === 'Soon' ? (
                  <Text style={styles.compareSoon}>Soon</Text>
                ) : (
                  <CheckGlyph color={HG.purple} />
                )}
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.footNote}>
          Free stays fully usable forever. Your data and logs are always yours.
        </Text>

        {/* PREVIEW CTA */}
        <View style={styles.ctaCard}>
          <View style={styles.ctaHeadRow}>
            <Text style={styles.ctaTitle}>{previewUnlocked ? 'Preview is on' : 'Try the preview'}</Text>
            <View style={[styles.tag, previewUnlocked ? styles.tagLive : styles.tagSoon]}>
              <Text style={[styles.tagText, previewUnlocked ? styles.tagTextLive : styles.tagTextSoon]}>
                {previewUnlocked ? 'PREVIEW ON' : 'PREVIEW OFF'}
              </Text>
            </View>
          </View>
          <Text style={styles.ctaBody}>
            {previewUnlocked
              ? 'Adaptive Coach is active on this device — the logger shows real next-set guidance after each set. Billing is not live yet.'
              : 'Billing is not live yet. This unlocks the Adaptive Coach preview on this device so you can try the live next-set guidance.'}
          </Text>
          <Pressable onPress={onTogglePreview} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>{previewUnlocked ? 'Turn preview off' : 'Try the preview'}</Text>
          </Pressable>
        </View>
      </ScrollView>
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
  content: {
    paddingHorizontal: 18,
    paddingTop: 4,
    paddingBottom: layout.bottomTabBarReserve,
  },
  hero: {
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 18,
    backgroundColor: '#2E1B57',
  },
  heroKickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  heroKicker: {
    color: '#C9B6FF',
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 30,
    marginTop: 11,
  },
  heroBody: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 13.5,
    fontWeight: '600',
    lineHeight: 20,
    marginTop: 9,
  },
  heroDataCard: {
    marginTop: 16,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingTop: 13,
    paddingBottom: 11,
  },
  heroDataHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  heroDataLabel: {
    flex: 1,
    minWidth: 0,
    color: 'rgba(255,255,255,0.62)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  heroDataBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(55,208,138,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  heroDataBadgeText: {
    color: '#7DEBB4',
    fontSize: 11,
    fontWeight: '800',
  },
  heroChartWrap: {
    marginTop: 6,
  },
  heroDataFootRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 4,
  },
  heroDashSwatch: {
    width: 14,
    borderTopWidth: 2,
    borderTopColor: '#37D08A',
    borderStyle: 'dashed',
  },
  heroDataFoot: {
    flex: 1,
    color: 'rgba(255,255,255,0.66)',
    fontSize: 11.5,
    fontWeight: '600',
  },
  heroEmptyCard: {
    marginTop: 16,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: 16,
    paddingHorizontal: 15,
    paddingVertical: 16,
  },
  heroEmptyTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  heroEmptyText: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12.5,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: 5,
  },
  sectionLabel: {
    color: HG.faint,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 22,
    marginBottom: 11,
    paddingHorizontal: 2,
  },
  laneList: {
    gap: 10,
  },
  laneCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 13,
    backgroundColor: HG.surface,
    borderWidth: 1,
    borderColor: HG.border,
    borderRadius: 16,
    padding: 14,
  },
  laneIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: HG.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  laneCopy: {
    flex: 1,
    minWidth: 0,
  },
  laneHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  laneTitle: {
    color: HG.ink,
    fontSize: 15,
    fontWeight: '800',
  },
  laneBody: {
    color: HG.muted,
    fontSize: 12.5,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: 4,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  tagLive: {
    backgroundColor: HG.greenSoft,
  },
  tagSoon: {
    backgroundColor: HG.surfaceSoft,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  tagTextLive: {
    color: HG.greenInk,
  },
  tagTextSoon: {
    color: HG.muted,
  },
  compareCard: {
    backgroundColor: HG.surface,
    borderWidth: 1,
    borderColor: HG.border,
    borderRadius: 18,
    overflow: 'hidden',
  },
  compareHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: HG.surfaceSoft,
    borderBottomWidth: 1,
    borderBottomColor: HG.border,
  },
  compareLabelCell: {
    flex: 1,
  },
  compareHeadFree: {
    width: 64,
    textAlign: 'center',
    color: HG.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  compareHeadPremium: {
    width: 72,
    textAlign: 'center',
    color: HG.purple,
    fontSize: 12,
    fontWeight: '800',
  },
  compareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: HG.border,
  },
  compareRowLast: {
    borderBottomWidth: 0,
  },
  compareLabel: {
    flex: 1,
    color: HG.ink,
    fontSize: 13.5,
    fontWeight: '700',
  },
  compareCell: {
    width: 64,
    alignItems: 'center',
  },
  compareDash: {
    width: 12,
    height: 2,
    borderRadius: 2,
    backgroundColor: HG.faint,
  },
  compareSoon: {
    color: HG.muted,
    fontSize: 11,
    fontWeight: '800',
  },
  footNote: {
    color: HG.faint,
    fontSize: 11.5,
    fontWeight: '600',
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 16,
    paddingHorizontal: 8,
  },
  ctaCard: {
    marginTop: 20,
    backgroundColor: HG.surface,
    borderWidth: 1,
    borderColor: HG.border,
    borderRadius: 18,
    padding: 16,
  },
  ctaHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  ctaTitle: {
    color: HG.ink,
    fontSize: 18,
    fontWeight: '800',
  },
  ctaBody: {
    color: HG.muted,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
    marginTop: 8,
  },
  primaryButton: {
    height: 54,
    borderRadius: 16,
    backgroundColor: HG.purple,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});
