import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FREE_ACTIVE_PROGRAM_CAP } from '../lib/activeProgramSet';
import { FREE_COACH_QUESTIONS_PER_WEEK } from '../lib/aiCoachQuota';
import { FREE_TREND_MONTHS } from '../lib/historyWindow';
import { I18nKey, t } from '../lib/i18n';
import { PRO_TRIAL_ENABLED } from '../lib/proEntitlement';
import { FREE_CUSTOM_PROGRAM_LIMIT } from '../lib/programSlots';
import { PW } from '../lightTheme';
import { Theme, useTheme, useThemedStyles } from '../theming';
import { AppLanguage } from '../types/models';

/**
 * The Pro full page (design: "Vinha Pro v3 — tumma").
 *
 * Six blocks and a pinned foot:
 *
 *   1 hero — the only filled violet surface on the page
 *   2 what Pro adds — the only block with icons, five rows
 *   3 what the app is in either tier — three checked lines
 *   4 the three objections, as an FAQ
 *   5 fine print
 *   foot — three plan tiles and the CTA, fixed while the page scrolls
 *
 * v2 sold with a 22-row comparison table and twelve grouped feature cards. v3
 * deletes both: a reader who has to audit a table has already stopped reading,
 * and the personal proof (their own plateau, their own withheld coach answer)
 * is carried by the paywall *moments* on Home and Progress, which is where they
 * actually hit the wall. This page is the closer, not the tour.
 *
 * Every free-tier number below is interpolated from the constant that enforces
 * it — FREE_CUSTOM_PROGRAM_LIMIT, FREE_COACH_QUESTIONS_PER_WEEK,
 * FREE_TREND_MONTHS — so the sales copy cannot drift from the gate.
 *
 * The CTA sells a subscription billing does not exist for. That is a demo-only
 * decision and releaseReadiness.test.cjs holds the other end of it; the notice
 * in block 5 says so on screen rather than only in a comment.
 */
interface PremiumScreenProps {
  /**
   * What sent the reader here, when something specific did.
   *
   * A paywall that opens after a refusal and then talks about something else
   * reads as a random toll gate. Naming the wall they just hit is the
   * difference between a sale and an interruption.
   */
  reason?: 'program_cap' | null;
  /** State of the on-device preview switch, which is what the CTA toggles. */
  previewUnlocked: boolean;
  /** Whether Pro is actually on — the preview switch or a live promo code. */
  proUnlocked: boolean;
  language?: AppLanguage;
  onBack: () => void;
  onTogglePreview: () => void;
  /** Where an existing subscriber goes instead of the buy CTA. */
  onManageSubscription: () => void;
  onOpenLegal: (document: 'privacy' | 'terms') => void;
}

const IC = {
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  arrow: 'M7 17L17 7M9 7h8v8',
  spark: 'M12 2.5l2.1 5.6L19.5 10l-5.4 1.9L12 17.5l-2.1-5.6L4.5 10l5.4-1.9z',
  clock: 'M12 7v5l3.5 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  heart: 'M12 20s-7-4.4-7-9a4 4 0 017-2.6A4 4 0 0119 11c0 4.6-7 9-7 9z',
};

interface DeltaRow {
  key: string;
  icon: string;
  /** The one filled glyph in the set. Everything else is a 2.1pt stroke. */
  filled?: boolean;
  titleKey: I18nKey;
  bodyKey: I18nKey;
  vars?: Record<string, string | number>;
  /**
   * Rows whose whole body is the free tier's number rather than a Pro promise.
   * They sit a shade quieter, so the block reads as five gains and not as five
   * limits with a price attached.
   */
  quiet?: boolean;
}

/**
 * Five rows, and no sixth.
 *
 * v2 listed twelve. Cutting to five is the design decision this page turns on:
 * a reader buys on one reason, and every row after the one that convinced them
 * is a row that can raise a doubt. Everything cut is still true, still gated
 * and still announced at the unlock moment (PRO_LIVE_BENEFITS) — it is just no
 * longer part of the pitch.
 *
 * Cloud backup left with them, and that one is a gain: it was the only claim on
 * this page wearing a SOON badge, and a paywall that sells a plan is a paywall
 * that has to be re-read every time the plan slips.
 */
const DELTA: DeltaRow[] = [
  {
    key: 'programs',
    icon: IC.grid,
    titleKey: 'pro.v3.delta.programs.t',
    bodyKey: 'pro.v3.delta.programs.b',
    vars: { cap: FREE_CUSTOM_PROGRAM_LIMIT },
    quiet: true,
  },
  // progressionGate.ts, reached through resolveProgressionOptions — the free
  // tier gets the prefill turned off, not a worse increment.
  {
    key: 'progression',
    icon: IC.arrow,
    titleKey: 'pro.v3.delta.progression.t',
    bodyKey: 'pro.v3.delta.progression.b',
  },
  // The free quota is real and metered (aiCoachQuota.ts); out of quota the
  // chat still answers, blurred, rather than refusing to talk.
  {
    key: 'coach',
    icon: IC.spark,
    filled: true,
    titleKey: 'pro.v3.delta.coach.t',
    bodyKey: 'pro.v3.delta.coach.b',
    vars: { count: FREE_COACH_QUESTIONS_PER_WEEK },
  },
  // Careful wording, and the trust block below backs it up: the LOG is never
  // capped in either tier. What free narrows is the charts and the records
  // (historyWindow.ts), and the body says exactly that.
  {
    key: 'history',
    icon: IC.clock,
    titleKey: 'pro.v3.delta.history.t',
    bodyKey: 'pro.v3.delta.history.b',
    vars: { months: FREE_TREND_MONTHS },
  },
  // Not a feature, and it earns its row anyway. It is the one reason on the
  // page that a competitor with a larger team cannot copy.
  {
    key: 'support',
    icon: IC.heart,
    titleKey: 'pro.v3.delta.support.t',
    bodyKey: 'pro.v3.delta.support.b',
  },
];

/**
 * What the app is regardless of tier.
 *
 * Each line is the loudest complaint about the market leader — the social feed
 * people say they hate, the connection Hevy needs for everything, and the
 * update that lost Strong users years of saved workouts. They cost nothing to
 * state because the app already works this way; not stating them was the only
 * thing wrong. No account exists anywhere in the code, there is exactly one
 * outbound request in the app (the AI coach), and nothing ever deletes a set.
 */
const TRUST: I18nKey[] = ['pro.v3.trust.private', 'pro.v3.trust.offline', 'pro.v3.trust.forever'];

/**
 * The three questions, answered before they are asked.
 *
 * The first one is the whole objection: a reader who suspects their history is
 * hostage will not subscribe, and will not ask either. It leads on purpose.
 */
const FAQ: Array<{ key: string; q: I18nKey; a: I18nKey; vars?: Record<string, string | number> }> = [
  { key: 'data', q: 'pro.v3.faq.data.q', a: 'pro.v3.faq.data.a', vars: { months: FREE_TREND_MONTHS } },
  { key: 'cancel', q: 'pro.v3.faq.cancel.q', a: 'pro.v3.faq.cancel.a' },
  { key: 'lifetime', q: 'pro.v3.faq.lifetime.q', a: 'pro.v3.faq.lifetime.a' },
];

type PlanId = 'monthly' | 'yearly' | 'lifetime';

/**
 * Prices live in the dictionary, not here. Two string literals in this array
 * are how the app once shipped 71,99 €/yr on this page and 59,90 €/yr on the
 * onboarding paywall in the same build: the guard that exists to catch exactly
 * that reads i18n.ts, so a price typed into a screen is a price nothing checks.
 *
 * Order is monthly · yearly · lifetime with the year pre-selected, so the
 * recommended tile sits in the middle where the thumb already is.
 */
const PLANS: Array<{
  id: PlanId;
  nameKey: I18nKey;
  priceKey: I18nKey;
  unitKey: I18nKey;
  badgeKey: I18nKey | null;
  fineKey: I18nKey;
  /** Used only while PRO_TRIAL_ENABLED — the "then …" line, not the flat one. */
  trialFineKey: I18nKey;
}> = [
  {
    id: 'monthly',
    nameKey: 'pro.page.monthly',
    priceKey: 'paywall.plan.monthly.price',
    unitKey: 'pro.v3.unit.month',
    badgeKey: null,
    fineKey: 'pro.v3.fine.recurring',
    trialFineKey: 'pro.v2.ctaSubMonthly',
  },
  {
    id: 'yearly',
    nameKey: 'pro.page.yearly',
    priceKey: 'paywall.plan.yearly.price',
    unitKey: 'pro.v3.unit.year',
    // 59,90 against 9,90 x 12 = 118,80 is 49.6% off. The badge said 40% for
    // months, which was the retired price set's number left behind.
    badgeKey: 'pro.page.save',
    fineKey: 'pro.v3.fine.recurring',
    trialFineKey: 'pro.v2.ctaSubYearly',
  },
  // Both leaders in this category sell one, it is the loudest thing their
  // paying users say they wanted, and it fits an app whose whole posture is
  // that it does not hold anything of yours hostage. Priced at ~2x the year
  // rather than the market's ~3x: a deliberate two-year payback.
  {
    id: 'lifetime',
    nameKey: 'pro.page.lifetime',
    priceKey: 'pro.page.perLifetime',
    unitKey: 'pro.v3.unit.lifetime',
    badgeKey: null,
    fineKey: 'pro.v3.fine.lifetime',
    trialFineKey: 'pro.v2.ctaSubLifetime',
  },
];

/** The hero is violet in both themes, so what sits on it is fixed, not themed. */
const HERO_INK = '#FFFFFF';
const HERO_INK_SOFT = 'rgba(255,255,255,0.72)';
const BADGE_INK = '#241743';

/**
 * The gradient is drawn into a fixed-size Svg behind the card rather than sized
 * from layout: a percentage-sized Svg under an Android `overflow: hidden` clip
 * renders empty on first paint. The card is wider than any phone, and the
 * parent clips it back.
 */
const HERO_W = 460;
const HERO_H = 300;

function CheckGlyph({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M5 13l4 4L19 7"
        stroke={color}
        strokeWidth={2.8}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function DeltaIcon({ row, color }: { row: DeltaRow; color: string }) {
  return (
    <Svg width={17} height={17} viewBox="0 0 24 24">
      {row.filled ? (
        <Path d={row.icon} fill={color} />
      ) : (
        <Path
          d={row.icon}
          stroke={color}
          strokeWidth={2.1}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </Svg>
  );
}

function FaqRow({
  question,
  answer,
  open,
  onToggle,
}: {
  question: string;
  answer: string;
  open: boolean;
  onToggle: () => void;
}) {
  const styles = useThemedStyles(makeStyles);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      onPress={onToggle}
      style={[styles.faqCard, open && styles.faqCardOpen]}
    >
      <View style={styles.faqHead}>
        <Text style={styles.faqQuestion}>{question}</Text>
        {/* One glyph for both states: a plus that becomes a close. */}
        <Text style={[styles.faqSign, open && styles.faqSignOpen]}>+</Text>
      </View>
      {open ? <Text style={styles.faqAnswer}>{answer}</Text> : null}
    </Pressable>
  );
}

export function PremiumScreen({
  reason = null,
  previewUnlocked,
  proUnlocked,
  language = 'en',
  onBack,
  onTogglePreview,
  onManageSubscription,
  onOpenLegal,
}: PremiumScreenProps) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const [plan, setPlan] = useState<PlanId>('yearly');
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  // Pro via a redeemed code rather than the on-device preview switch: the
  // switch cannot turn that off, so the page must not offer to.
  const promoOnly = proUnlocked && !previewUnlocked;
  const selectedPlan = PLANS.find((option) => option.id === plan) ?? PLANS[1];

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(language, 'common.back')}
          onPress={onBack}
          style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
        >
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path d="M6 6l12 12M18 6L6 18" stroke={theme.ink} strokeWidth={2.2} strokeLinecap="round" />
          </Svg>
        </Pressable>
        {/* Restore is required store copy once billing ships; inert until then. */}
        <Text style={styles.restore}>{t(language, 'pro.page.restore')}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {reason === 'program_cap' ? (
          <View style={styles.reasonBanner}>
            <Text style={styles.reasonBannerText}>
              {t(language, 'programs.cap.paywall', { cap: FREE_ACTIVE_PROGRAM_CAP })}
            </Text>
          </View>
        ) : null}

        {/* 1 · HERO — the only filled violet surface on the page */}
        <View style={styles.hero}>
          <Svg
            style={StyleSheet.absoluteFill}
            width={HERO_W}
            height={HERO_H}
            viewBox={`0 0 ${HERO_W} ${HERO_H}`}
            // Stretch rather than letterbox: the card's aspect ratio follows
            // however the copy wraps, and a gradient does not mind the skew,
            // but a gap at the edge would show the page through the hero.
            preserveAspectRatio="none"
          >
            <Defs>
              <SvgLinearGradient id="proHeroGradient" x1="0" y1="0" x2="0.42" y2="1">
                <Stop offset="0" stopColor={PW.sheetTop} />
                <Stop offset="0.58" stopColor={PW.sheetMid} />
                <Stop offset="1" stopColor={PW.sheetBottom} />
              </SvgLinearGradient>
            </Defs>
            <Rect width={HERO_W} height={HERO_H} fill="url(#proHeroGradient)" />
          </Svg>

          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>{t(language, 'pro.page.eyebrow')}</Text>
          </View>
          <Text style={styles.heroTitle}>{t(language, 'pro.v3.hero.title')}</Text>
          <Text style={styles.heroBody}>{t(language, 'pro.v3.hero.body')}</Text>
        </View>

        {/* 2 · WHAT PRO ADDS — the only block with icons */}
        <Text style={styles.sectionLabel}>{t(language, 'pro.v3.delta.label')}</Text>
        <View style={styles.deltaCard}>
          {DELTA.map((row, index) => (
            <View key={row.key} style={[styles.deltaRow, index > 0 && styles.deltaRowDivided]}>
              <View style={styles.deltaIcon}>
                <DeltaIcon row={row} color={theme.purple} />
              </View>
              <View style={styles.deltaCopy}>
                <Text style={styles.deltaTitle}>{t(language, row.titleKey)}</Text>
                <Text style={[styles.deltaBody, row.quiet && styles.deltaBodyQuiet]}>
                  {t(language, row.bodyKey, row.vars)}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* 3 · TRUST — true in both tiers, which is why it carries no price */}
        <View style={styles.trustBlock}>
          {TRUST.map((key) => (
            <View key={key} style={styles.trustRow}>
              <View style={styles.trustCheck}>
                <CheckGlyph color={theme.green} />
              </View>
              <Text style={styles.trustText}>{t(language, key)}</Text>
            </View>
          ))}
        </View>

        {/* 4 · FAQ */}
        <View style={styles.faqBlock}>
          {FAQ.map((entry) => (
            <FaqRow
              key={entry.key}
              question={t(language, entry.q)}
              answer={t(language, entry.a, {
                ...entry.vars,
                // The lifetime answer quotes the price, and quotes it from the
                // same dictionary entry the tile above it reads.
                price: t(language, 'pro.page.perLifetime'),
              })}
              open={openFaq === entry.key}
              onToggle={() => setOpenFaq(openFaq === entry.key ? null : entry.key)}
            />
          ))}
        </View>

        {/* 5 · FINE PRINT */}
        <View style={styles.finePrint}>
          <Text style={styles.noticeText}>{t(language, 'pro.v3.notice')}</Text>
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
      </ScrollView>

      {/*
        PINNED FOOT. The plan tiles are here rather than in the scroll because
        the price is the one thing a reader looks for twice, and a page that
        makes them hunt for it a second time has already lost them.

        This button does not sell anything — billing does not exist. It is here
        because this is a demo build (user decision 2026-08-01) and the preview
        switch that used to live here read as a broken feature.
        releaseReadiness.test.cjs fails while this copy is present and billing
        still is not, so the demo cannot become the release by forgetting.

        The tab bar is hidden on this route, so only the system inset sits
        under the button.
      */}
      <View style={[styles.foot, { paddingBottom: insets.bottom + 8 }]}>
        {/*
          proUnlocked was once computed and never read, so this page showed a
          subscriber the same buy button as everyone else — and pressing it ran
          onTogglePreview, which flips the switch OFF. The one button on the
          page was a cancel button wearing a purchase label. A reader who
          already pays gets a status line and a way to manage instead; a promo
          unlock gets no toggle at all, because the preview switch cannot turn
          a redeemed code off.
        */}
        {proUnlocked ? (
          <>
            <View style={styles.activeRow}>
              <CheckGlyph color={theme.green} />
              <Text style={styles.activeText}>{t(language, 'promo.proOn')}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={promoOnly ? onManageSubscription : onTogglePreview}
              style={({ pressed }) => [styles.manageButton, pressed && styles.pressed]}
            >
              <Text style={styles.manageButtonText}>
                {t(language, promoOnly ? 'subs.manageMembership' : 'settings.demoPro')}
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <View style={styles.planRow}>
              {PLANS.map((option) => {
                const on = option.id === plan;
                return (
                  <Pressable
                    key={option.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    onPress={() => setPlan(option.id)}
                    style={[styles.planTile, on && styles.planTileOn]}
                  >
                    {option.badgeKey ? (
                      // An absolutely positioned child does not inherit the
                      // parent's alignItems, so the pill is centred by a
                      // full-width anchor rather than by alignSelf.
                      <View style={styles.planBadgeAnchor} pointerEvents="none">
                        <View style={styles.planBadge}>
                          <Text style={styles.planBadgeText}>{t(language, option.badgeKey)}</Text>
                        </View>
                      </View>
                    ) : null}
                    <Text style={[styles.planName, on && styles.planNameOn]}>
                      {t(language, option.nameKey)}
                    </Text>
                    <Text style={styles.planPrice}>{t(language, option.priceKey)}</Text>
                    <Text style={styles.planUnit}>{t(language, option.unitKey)}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={onTogglePreview}
              style={({ pressed }) => [styles.ctaButton, pressed && styles.pressed]}
            >
              {/* The trial can be switched off (PRO_TRIAL_ENABLED). When it
                  is, this button must stop promising a week. */}
              <Text style={styles.ctaButtonText}>
                {t(language, PRO_TRIAL_ENABLED ? 'pro.v2.cta' : 'pro.v2.cta.noTrial')}
              </Text>
            </Pressable>
            <Text style={styles.ctaFine}>
              {t(language, PRO_TRIAL_ENABLED ? selectedPlan.trialFineKey : selectedPlan.fineKey)}
            </Text>
          </>
        )}
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
    paddingHorizontal: 16,
    paddingTop: 2,
    paddingBottom: 8,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: theme.surfaceSoft,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.85,
  },
  restore: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.purple,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 22,
  },
  reasonBanner: {
    backgroundColor: PW.sheetLavender,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  reasonBannerText: {
    color: '#3B1E77',
    fontSize: 13.5,
    lineHeight: 19,
    fontWeight: '800',
  },
  hero: {
    borderRadius: 22,
    // The gradient is a child, so the corners have to clip it.
    overflow: 'hidden',
    paddingHorizontal: 18,
    paddingVertical: 20,
    // The card carries the page's only heavy shadow; everything below it is
    // flat, which is what makes this read as the one raised surface.
    shadowColor: '#000000',
    shadowOpacity: 0.28,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    backgroundColor: theme.gold,
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 9,
  },
  heroBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.9,
    color: BADGE_INK,
  },
  heroTitle: {
    fontSize: 27,
    fontWeight: '800',
    letterSpacing: -0.7,
    lineHeight: 32,
    color: HERO_INK,
    marginTop: 13,
  },
  heroBody: {
    fontSize: 13.5,
    fontWeight: '600',
    lineHeight: 20,
    color: HERO_INK_SOFT,
    marginTop: 11,
  },
  sectionLabel: {
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: theme.faint,
    marginTop: 26,
    marginBottom: 11,
    paddingHorizontal: 2,
  },
  deltaCard: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 20,
    overflow: 'hidden',
  },
  deltaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 15,
  },
  deltaRowDivided: {
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  deltaIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: theme.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deltaCopy: {
    flex: 1,
    minWidth: 0,
    paddingTop: 1,
  },
  deltaTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    letterSpacing: -0.2,
    color: theme.ink,
  },
  deltaBody: {
    fontSize: 12.5,
    fontWeight: '600',
    lineHeight: 18,
    color: theme.muted,
    marginTop: 3,
  },
  deltaBodyQuiet: {
    color: theme.faint,
  },
  trustBlock: {
    marginTop: 24,
    gap: 12,
    paddingHorizontal: 2,
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  trustCheck: {
    marginTop: 1,
  },
  trustText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
    color: theme.ink,
  },
  faqBlock: {
    marginTop: 26,
    gap: 9,
  },
  faqCard: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  faqCardOpen: {
    borderColor: theme.purple,
  },
  faqHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  faqQuestion: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '800',
    lineHeight: 18,
    letterSpacing: -0.1,
    color: theme.ink,
  },
  faqSign: {
    fontSize: 19,
    fontWeight: '700',
    lineHeight: 22,
    color: theme.faint,
  },
  faqSignOpen: {
    color: theme.purple,
    transform: [{ rotate: '45deg' }],
  },
  faqAnswer: {
    fontSize: 12.5,
    fontWeight: '600',
    lineHeight: 19,
    color: theme.muted,
    marginTop: 9,
  },
  finePrint: {
    marginTop: 24,
    alignItems: 'center',
  },
  noticeText: {
    fontSize: 11.5,
    fontWeight: '600',
    lineHeight: 18,
    color: theme.faint,
    textAlign: 'center',
  },
  legalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 8,
  },
  legalText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: theme.muted,
    // These open the real documents, so they have to look like links.
    textDecorationLine: 'underline',
  },
  legalDot: {
    width: 3,
    height: 3,
    borderRadius: 999,
    backgroundColor: theme.faint,
  },
  foot: {
    backgroundColor: theme.surface,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    paddingHorizontal: 14,
    // The save badge overhangs the tile, so the foot needs headroom for it.
    paddingTop: 17,
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -8 },
    elevation: 12,
  },
  planRow: {
    flexDirection: 'row',
    gap: 8,
  },
  planTile: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: theme.surfaceSoft,
    paddingTop: 11,
    paddingBottom: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  planTileOn: {
    borderColor: theme.purple,
    backgroundColor: theme.purpleLight,
  },
  planBadgeAnchor: {
    position: 'absolute',
    top: -9,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  planBadge: {
    backgroundColor: theme.gold,
    borderRadius: 999,
    paddingVertical: 2,
    paddingHorizontal: 7,
  },
  planBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: BADGE_INK,
  },
  planName: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.4,
    color: theme.faint,
  },
  planNameOn: {
    color: theme.purpleDark,
  },
  planPrice: {
    fontSize: 16.5,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: theme.ink,
    marginTop: 5,
  },
  planUnit: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.muted,
    marginTop: 2,
  },
  ctaButton: {
    height: 52,
    borderRadius: 16,
    backgroundColor: theme.purple,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  ctaButtonText: {
    fontSize: 16.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  ctaFine: {
    textAlign: 'center',
    fontSize: 11.5,
    fontWeight: '600',
    color: theme.muted,
    marginTop: 9,
  },
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginBottom: 10,
  },
  activeText: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.ink,
  },
  manageButton: {
    height: 52,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manageButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.ink,
  },
});
