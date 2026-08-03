import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, G, Path, Rect, Stop } from 'react-native-svg';

import { FitnessPhotoSurface } from '../components/FitnessPhotoSurface';
import { isDemoBuild } from '../lib/demoMode';
import { t } from '../lib/i18n';
import { AppLanguage } from '../types/models';

/**
 * The Pro paywall, from the "GAINER Paywall Sell" design.
 *
 * It runs dark whatever the app's theme is, on purpose: the dark theme is
 * itself a Pro feature, so the screen that sells Pro is the first taste of it.
 * That is why this file paints from its own constants rather than the theme —
 * same arrangement the onboarding uses to stay light.
 *
 * Order is the design's, and the design's argument for it is the reason to keep
 * it: strongest claim first, price last. Built for you (their own answers) →
 * what Pro does → free vs Pro → the first month → plans → trust.
 */

const PW = {
  bg: '#17132B',
  card: '#211B3D',
  surface: '#1B1633',
  border: 'rgba(255,255,255,0.10)',
  ink: '#F4F1FF',
  muted: 'rgba(244,241,255,0.66)',
  faint: 'rgba(244,241,255,0.42)',
  purple: '#9B6DFF',
  purpleSoft: 'rgba(155,109,255,0.16)',
  green: '#37D08A',
};

/**
 * The three hero numbers.
 *
 * The design's own note calls them placeholders, and they are: nothing in this
 * app has measured a cohort. They are behind the demo flag so the screen looks
 * like the design in the build it was designed for, and a release build shows
 * the hero without them rather than shipping a made-up study. The headline and
 * the sub line stand on their own, because those describe what the app does.
 */
const HERO_STATS: Array<{ valueKey: Parameters<typeof t>[1]; labelKey: Parameters<typeof t>[1] }> = [
  { valueKey: 'paywall.stat1.v', labelKey: 'paywall.stat1.l' },
  { valueKey: 'paywall.stat2.v', labelKey: 'paywall.stat2.l' },
  { valueKey: 'paywall.stat3.v', labelKey: 'paywall.stat3.l' },
];

type PwIconName = 'trend' | 'heart' | 'trophy' | 'chat' | 'target' | 'dumbbell' | 'sparkle' | 'check' | 'arrow';

function PwIcon({ name, size = 20, color = PW.purple }: { name: PwIconName; size?: number; color?: string }) {
  const paths: Record<PwIconName, React.ReactNode> = {
    trend: <Path d="M4 17.5l5.5-6 3.5 3L20 6" />,
    heart: <Path d="M12 20s-7-4.5-7-9a4 4 0 017-2.5A4 4 0 0119 11c0 4.5-7 9-7 9z" />,
    trophy: (
      <G>
        <Path d="M6 9a6 6 0 0012 0V4H6z" />
        <Path d="M6 5H3v2a3 3 0 003 3M18 5h3v2a3 3 0 01-3 3M9 21h6M12 15v6" />
      </G>
    ),
    chat: <Path d="M4.5 6.5h15v9.5h-9l-6 4.5z" />,
    target: (
      <G>
        <Circle cx="12" cy="12" r="8" />
        <Circle cx="12" cy="12" r="3.4" />
      </G>
    ),
    dumbbell: <Path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10" />,
    sparkle: <Path d="M12 3l1.7 6.1L20 11l-6.3 1.9L12 19l-1.7-6.1L4 11l6.3-1.9z" />,
    check: <Path d="M5 12l5 5L19 7" />,
    arrow: <Path d="M5 12h13M12 5l7 7-7 7" />,
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </Svg>
  );
}

function PwLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

export interface ProPaywallScreenProps {
  language?: AppLanguage;
  /** The goal the questionnaire settled on, already localized. */
  goalLabel: string;
  /** Training days per week, so the personalised card quotes their own answer. */
  daysPerWeek: number;
  onStartTrial: () => void;
  onSkip: () => void;
  busy?: boolean;
}

export function ProPaywallScreen({
  language = 'en',
  goalLabel,
  daysPerWeek,
  onStartTrial,
  onSkip,
  busy = false,
}: ProPaywallScreenProps) {
  const [plan, setPlan] = useState<'year' | 'month'>('year');
  const showStats = isDemoBuild();

  const benefits: Array<[PwIconName, string, string]> = [
    ['trend', t(language, 'paywall.benefit.plateau.t'), t(language, 'paywall.benefit.plateau.b')],
    ['heart', t(language, 'paywall.benefit.recover.t'), t(language, 'paywall.benefit.recover.b')],
    ['trophy', t(language, 'paywall.benefit.pr.t'), t(language, 'paywall.benefit.pr.b')],
    ['chat', t(language, 'paywall.benefit.ask.t'), t(language, 'paywall.benefit.ask.b')],
  ];

  const compare: Array<[string, string]> = [
    [t(language, 'paywall.vs.progression.free'), t(language, 'paywall.vs.progression.pro')],
    [t(language, 'paywall.vs.program.free'), t(language, 'paywall.vs.program.pro')],
    [t(language, 'paywall.vs.next.free'), t(language, 'paywall.vs.next.pro')],
    [t(language, 'paywall.vs.logging.free'), t(language, 'paywall.vs.logging.pro')],
  ];

  const journey: Array<[PwIconName, string, string]> = [
    ['dumbbell', t(language, 'paywall.month.today'), t(language, 'paywall.month.today.b')],
    ['trend', t(language, 'paywall.month.w1'), t(language, 'paywall.month.w1.b')],
    ['sparkle', t(language, 'paywall.month.w2'), t(language, 'paywall.month.w2.b')],
    ['trophy', t(language, 'paywall.month.m2'), t(language, 'paywall.month.m2.b')],
  ];

  const builtRows = [
    t(language, 'paywall.built.row1'),
    t(language, 'paywall.built.row2', { days: daysPerWeek }),
    t(language, 'paywall.built.row3'),
  ];

  const trust = [
    t(language, 'paywall.trust.cancel'),
    t(language, 'paywall.trust.export'),
    t(language, 'paywall.trust.ads'),
    t(language, 'paywall.trust.own'),
  ];

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero — the diagonal seam is the design's own full-bleed language. */}
        <View style={styles.hero}>
          <FitnessPhotoSurface variant="strength" style={styles.heroPhoto} imageStyle={styles.heroPhotoImage} />
          <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
            <Defs>
              <SvgLinearGradient id="paywallHeroScrim" x1="0" y1="0" x2="1" y2="0.6">
                <Stop offset="0" stopColor="#0F0A20" stopOpacity="0.94" />
                <Stop offset="0.46" stopColor="#140D2C" stopOpacity="0.74" />
                <Stop offset="1" stopColor="#2E1065" stopOpacity="0.24" />
              </SvgLinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#paywallHeroScrim)" />
          </Svg>

          <View style={styles.heroCopy}>
            <Text style={styles.heroEyebrow}>{t(language, 'paywall.eyebrow')}</Text>
            <Text style={styles.heroTitle}>{t(language, 'paywall.title')}</Text>
            <Text style={styles.heroSub}>{t(language, 'paywall.sub')}</Text>

            {showStats ? (
              <>
                <View style={styles.statRow}>
                  {HERO_STATS.map((stat) => (
                    <View key={stat.valueKey} style={styles.stat}>
                      <Text style={styles.statValue}>{t(language, stat.valueKey)}</Text>
                      <Text style={styles.statLabel}>{t(language, stat.labelKey)}</Text>
                    </View>
                  ))}
                </View>
                <Text style={styles.statSource}>{t(language, 'paywall.stat.source')}</Text>
              </>
            ) : null}
          </View>
        </View>

        <View style={styles.body}>
          {/* Built for you — quotes the questionnaire's own answers back. */}
          <View>
            <PwLabel>{t(language, 'paywall.built.label')}</PwLabel>
            <View style={[styles.card, styles.builtCard]}>
              <View style={styles.builtHead}>
                <View style={styles.builtIcon}>
                  <PwIcon name="target" size={21} />
                </View>
                <View style={styles.flex1}>
                  <Text style={styles.builtTitle}>
                    {t(language, 'paywall.built.title', { goal: goalLabel, days: daysPerWeek })}
                  </Text>
                  <Text style={styles.builtSub}>{t(language, 'paywall.built.sub')}</Text>
                </View>
              </View>
              <View style={styles.builtRows}>
                {builtRows.map((row) => (
                  <View key={row} style={styles.builtRow}>
                    <PwIcon name="check" size={15} color={PW.green} />
                    <Text style={styles.builtRowText}>{row}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          {/* What you get */}
          <View>
            <PwLabel>{t(language, 'paywall.benefits.label')}</PwLabel>
            <View style={[styles.card, styles.benefitCard]}>
              {benefits.map(([icon, title, body], index) => (
                <View key={title} style={[styles.benefitRow, index > 0 && styles.benefitRowDivided]}>
                  <View style={styles.benefitIcon}>
                    <PwIcon name={icon} size={19} />
                  </View>
                  <View style={styles.flex1}>
                    <Text style={styles.benefitTitle}>{title}</Text>
                    <Text style={styles.benefitBody}>{body}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Free vs Pro */}
          <View>
            <PwLabel>{t(language, 'paywall.vs.label')}</PwLabel>
            <View style={styles.compareFrame}>
              <View style={styles.compareRow}>
                <Text style={[styles.compareHeadCell, styles.compareFreeHead]}>{t(language, 'paywall.vs.free')}</Text>
                <Text style={[styles.compareHeadCell, styles.compareProHead]}>{t(language, 'paywall.vs.pro')}</Text>
              </View>
              {compare.map(([free, pro], index) => (
                <View key={free} style={[styles.compareRow, index > 0 || true ? styles.compareRowDivided : null]}>
                  <Text style={[styles.compareCell, styles.compareFreeCell]}>{free}</Text>
                  <View style={[styles.compareCell, styles.compareProCell]}>
                    <PwIcon name="check" size={13} color={PW.green} />
                    <Text style={styles.compareProText}>{pro}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Your first month */}
          <View>
            <PwLabel>{t(language, 'paywall.month.label')}</PwLabel>
            <View style={[styles.card, styles.journeyCard]}>
              <View style={styles.journeyRow}>
                {journey.map(([icon, step, note], index) => (
                  <React.Fragment key={step}>
                    <View style={styles.journeyStep}>
                      <View style={[styles.journeyIcon, index === 0 && styles.journeyIconNow]}>
                        <PwIcon name={icon} size={19} color={index === 0 ? '#FFFFFF' : PW.purple} />
                      </View>
                      <Text style={styles.journeyStepLabel}>{step}</Text>
                      <Text style={styles.journeyStepNote}>{note}</Text>
                    </View>
                    {index < journey.length - 1 ? (
                      <View style={styles.journeyArrow}>
                        <PwIcon name="arrow" size={12} color={PW.faint} />
                      </View>
                    ) : null}
                  </React.Fragment>
                ))}
              </View>
            </View>
          </View>

          {/* Plans */}
          <View style={styles.planRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: plan === 'year' }}
              onPress={() => setPlan('year')}
              style={[styles.planCard, plan === 'year' && styles.planCardOn]}
            >
              <View style={styles.planBadge}>
                <Text style={styles.planBadgeText}>{t(language, 'paywall.plan.save')}</Text>
              </View>
              <Text style={[styles.planTitle, plan === 'year' && styles.planTitleOn]}>
                {t(language, 'paywall.plan.yearly')}
              </Text>
              <View style={styles.planPriceRow}>
                <Text style={styles.planPrice}>{t(language, 'paywall.plan.yearly.price')}</Text>
                <Text style={styles.planPer}>{t(language, 'paywall.plan.yearly.per')}</Text>
              </View>
              <Text style={[styles.planNote, plan === 'year' && styles.planNoteOn]}>
                {t(language, 'paywall.plan.yearly.note')}
              </Text>
              <View style={styles.planWeek}>
                <Text style={styles.planWeekText}>{t(language, 'paywall.plan.yearly.week')}</Text>
              </View>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: plan === 'month' }}
              onPress={() => setPlan('month')}
              style={[styles.planCard, plan === 'month' && styles.planCardOn]}
            >
              <Text style={[styles.planTitle, plan === 'month' && styles.planTitleOn]}>
                {t(language, 'paywall.plan.monthly')}
              </Text>
              <View style={styles.planPriceRow}>
                <Text style={styles.planPrice}>{t(language, 'paywall.plan.monthly.price')}</Text>
                <Text style={styles.planPer}>{t(language, 'paywall.plan.monthly.per')}</Text>
              </View>
              <Text style={[styles.planNote, plan === 'month' && styles.planNoteOn]}>
                {t(language, 'paywall.plan.monthly.note')}
              </Text>
            </Pressable>
          </View>

          {/* Trust */}
          <View style={styles.trustGrid}>
            {trust.map((item) => (
              <View key={item} style={styles.trustChip}>
                <PwIcon name="check" size={12} color={PW.green} />
                <Text style={styles.trustText}>{item}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* The CTA floats over the scroll from the first frame — the design is
          explicit that it must be visible without scrolling. */}
      <View style={styles.footer} pointerEvents="box-none">
        <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <SvgLinearGradient id="paywallFooterFade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={PW.bg} stopOpacity="0" />
              <Stop offset="0.34" stopColor={PW.bg} stopOpacity="0.96" />
              <Stop offset="1" stopColor={PW.bg} stopOpacity="1" />
            </SvgLinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#paywallFooterFade)" />
        </Svg>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(language, 'paywall.cta')}
          disabled={busy}
          onPress={onStartTrial}
          style={({ pressed }) => [styles.cta, pressed && styles.pressed, busy && styles.ctaBusy]}
        >
          <Text style={styles.ctaText}>{t(language, 'paywall.cta')}</Text>
          <PwIcon name="arrow" size={18} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.ctaFoot}>
          {t(language, plan === 'year' ? 'paywall.cta.footYear' : 'paywall.cta.footMonth')}
        </Text>
        <Pressable accessibilityRole="button" hitSlop={10} disabled={busy} onPress={onSkip} style={styles.later}>
          <Text style={styles.laterText}>{t(language, 'paywall.later')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const PAD = 22;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PW.bg },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 210 },
  flex1: { flex: 1, minWidth: 0 },

  hero: { height: 300, overflow: 'hidden' },
  heroPhoto: { ...StyleSheet.absoluteFillObject, borderRadius: 0 },
  heroPhotoImage: { borderRadius: 0 },
  heroCopy: { position: 'absolute', left: 0, right: 0, top: 0, paddingTop: 58, paddingHorizontal: PAD },
  heroEyebrow: { fontSize: 10.5, fontWeight: '800', letterSpacing: 1.7, color: '#C4B5FD' },
  heroTitle: {
    fontSize: 31,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -1.1,
    lineHeight: 33,
    marginTop: 12,
    maxWidth: 250,
  },
  heroSub: { fontSize: 12.5, fontWeight: '600', color: 'rgba(255,255,255,0.74)', marginTop: 10, lineHeight: 17.5, maxWidth: 236 },
  statRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  stat: { flex: 1 },
  statValue: { fontSize: 24, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.7, lineHeight: 25 },
  statLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.62)', marginTop: 5, lineHeight: 13 },
  statSource: { fontSize: 9, fontWeight: '700', letterSpacing: 0.55, color: 'rgba(255,255,255,0.4)', marginTop: 12 },

  body: { paddingHorizontal: PAD, paddingTop: 18, gap: 22 },
  sectionLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.6, color: PW.purple, marginBottom: 12 },
  card: { backgroundColor: PW.card, borderWidth: 1, borderColor: PW.border, borderRadius: 18, padding: 16 },

  builtCard: { backgroundColor: '#241B4A' },
  builtHead: { flexDirection: 'row', gap: 13 },
  builtIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: PW.purpleSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  builtTitle: { fontSize: 15, fontWeight: '800', color: PW.ink, letterSpacing: -0.15 },
  builtSub: { fontSize: 12, fontWeight: '600', color: PW.muted, marginTop: 3 },
  builtRows: { gap: 9, marginTop: 13 },
  builtRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  builtRowText: { flex: 1, fontSize: 12.5, fontWeight: '700', color: PW.ink },

  benefitCard: { paddingVertical: 6 },
  benefitRow: { flexDirection: 'row', gap: 13, paddingVertical: 13 },
  benefitRowDivided: { borderTopWidth: 1, borderTopColor: PW.border },
  benefitIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: PW.purpleSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitTitle: { fontSize: 14.5, fontWeight: '800', color: PW.ink, letterSpacing: -0.15 },
  benefitBody: { fontSize: 12, fontWeight: '600', color: PW.muted, marginTop: 3, lineHeight: 16.8 },

  compareFrame: { borderWidth: 1, borderColor: PW.border, borderRadius: 18, overflow: 'hidden' },
  compareRow: { flexDirection: 'row' },
  compareRowDivided: { borderTopWidth: 1, borderTopColor: PW.border },
  compareHeadCell: { flex: 1, paddingVertical: 9, paddingHorizontal: 14, fontSize: 10.5, fontWeight: '800', letterSpacing: 1.5 },
  compareFreeHead: { color: PW.faint, backgroundColor: PW.surface },
  compareProHead: { color: '#FFFFFF', backgroundColor: '#7C3AED' },
  compareCell: { flex: 1, paddingVertical: 11, paddingHorizontal: 14 },
  compareFreeCell: {
    fontSize: 12,
    fontWeight: '600',
    color: PW.faint,
    backgroundColor: PW.surface,
    textDecorationLine: 'line-through',
  },
  compareProCell: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: 'rgba(155,109,255,0.10)' },
  compareProText: { flex: 1, fontSize: 12, fontWeight: '800', color: PW.ink },

  journeyCard: { paddingHorizontal: 12 },
  journeyRow: { flexDirection: 'row', alignItems: 'flex-start' },
  journeyStep: { flex: 1, alignItems: 'center' },
  journeyIcon: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: PW.purpleSoft,
    borderWidth: 1,
    borderColor: PW.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  journeyIconNow: { backgroundColor: '#7C3AED', borderWidth: 0 },
  journeyStepLabel: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.95, color: PW.ink, marginTop: 9 },
  journeyStepNote: { fontSize: 10.5, fontWeight: '600', color: PW.muted, marginTop: 2, textAlign: 'center' },
  journeyArrow: { width: 12, alignItems: 'center', paddingTop: 14 },

  planRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  planCard: {
    flex: 1,
    borderRadius: 18,
    paddingTop: 14,
    paddingBottom: 15,
    paddingHorizontal: 14,
    backgroundColor: PW.surface,
    borderWidth: 1.5,
    borderColor: PW.border,
  },
  planCardOn: { backgroundColor: 'rgba(155,109,255,0.14)', borderColor: PW.purple },
  planBadge: {
    position: 'absolute',
    top: -9,
    right: 12,
    backgroundColor: '#7C3AED',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  planBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.9, color: '#FFFFFF' },
  planTitle: { fontSize: 10.5, fontWeight: '800', letterSpacing: 1.5, color: PW.faint },
  planTitleOn: { color: '#C4B5FD' },
  planPriceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 7 },
  planPrice: { fontSize: 22, fontWeight: '800', color: PW.ink, letterSpacing: -0.7 },
  planPer: { fontSize: 12, fontWeight: '700', color: PW.muted },
  planNote: { fontSize: 12, fontWeight: '700', color: PW.faint, marginTop: 5 },
  planNoteOn: { color: PW.purple },
  planWeek: {
    alignSelf: 'flex-start',
    marginTop: 10,
    backgroundColor: PW.purpleSoft,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  planWeekText: { fontSize: 10.5, fontWeight: '800', color: '#DDD1FF' },

  trustGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  trustChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: PW.border,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
    flexGrow: 1,
    flexBasis: '46%',
  },
  trustText: { fontSize: 10.5, fontWeight: '700', color: PW.muted },

  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: PAD, paddingTop: 22, paddingBottom: 18 },
  cta: {
    height: 56,
    borderRadius: 18,
    backgroundColor: '#7C3AED',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    shadowColor: '#6D28D9',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.5,
    shadowRadius: 34,
    elevation: 10,
  },
  ctaBusy: { opacity: 0.6 },
  ctaText: { fontSize: 17, fontWeight: '800', color: '#FFFFFF' },
  ctaFoot: { fontSize: 11.5, fontWeight: '600', color: PW.faint, textAlign: 'center', marginTop: 10 },
  later: { alignSelf: 'center', marginTop: 11 },
  laterText: { fontSize: 12.5, fontWeight: '700', color: PW.muted },
  pressed: { opacity: 0.9 },
});
