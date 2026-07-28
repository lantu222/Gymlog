const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function read(...segments) {
  return fs.readFileSync(path.join(__dirname, '..', '..', ...segments), 'utf8');
}

const appSource = read('App.tsx');
const settingsSource = read('src', 'screens', 'SettingsScreen.tsx');
const planSettingsSource = read('src', 'screens', 'PlanSettingsScreen.tsx');
const premiumSource = read('src', 'screens', 'PremiumScreen.tsx');
const homeSource = read('src', 'screens', 'HomeScreen.tsx');
const loggerSource = read('src', 'screens', 'WorkoutLoggingScreen.tsx');
const proOfferSource = read('src', 'screens', 'ProOfferScreen.tsx');

/**
 * The Pro/Free audit (2026-07-28) found three ways the paid tier lied: a promo
 * code that never expired, screens that read the preview switch instead of the
 * entitlement, and a dark-theme toggle sold as a Pro perk that repainted
 * nothing. These guard the fixes, because every one of them is invisible until
 * someone pays.
 */
module.exports = [
  {
    name: 'redeeming a promo stores only the expiry, so Pro ends when the code does',
    run() {
      const redeem = appSource.match(/onRedeemed=\{[^}]*\}/);
      assert.ok(redeem, 'PromoCodeScreen should still be wired with onRedeemed');
      assert.match(redeem[0], /promoProUntil: proUntilIso/);
      assert.doesNotMatch(
        redeem[0],
        /adaptiveCoachPremiumUnlocked/,
        'flipping the preview switch on redemption would make a 30-day code permanent Pro',
      );
    },
  },
  {
    name: 'the logger and the premium screen ask the entitlement, not the preview switch',
    run() {
      assert.match(appSource, /hasAdaptiveCoachPremium=\{coachProUnlocked\}/);
      assert.match(appSource, /proUnlocked=\{coachProUnlocked\}/);
    },
  },
  {
    name: 'Settings and Plan settings resolve Pro through isProUnlocked',
    run() {
      for (const [name, source] of [
        ['SettingsScreen', settingsSource],
        ['PlanSettingsScreen', planSettingsSource],
      ]) {
        assert.match(source, /import \{ isProUnlocked \} from '\.\.\/lib\/proEntitlement';/, name);
        assert.match(source, /const proUnlocked = isProUnlocked\(preferences\);/, name);
        assert.doesNotMatch(
          source,
          /preferences\.adaptiveCoachPremiumUnlocked/,
          `${name} must not read the raw preview flag — a promo user is Pro too`,
        );
      }
    },
  },
  {
    name: 'the dark-theme row offers no switch while the theme engine does not exist',
    run() {
      assert.doesNotMatch(
        settingsSource,
        /darkTheme, setDarkTheme/,
        'a toggle that repaints nothing reads as a delivered Pro perk',
      );
      assert.match(settingsSource, /title=\{t\(language, 'settings\.darkTheme'\)\}[\s\S]{0,240}?soonPill/);
    },
  },
  {
    name: 'every lane the premium screen calls LIVE is one the app actually runs',
    run() {
      const lanes = premiumSource.match(/const LANES[\s\S]*?\n\];/);
      assert.ok(lanes, 'LANES list should still be declared');

      // The AI coach sheet and the session-analysis screen are both gated on
      // Pro and both work, so they belong on the list a buyer reads.
      assert.match(lanes[0], /live: true, variant: 'ai'/);
      assert.match(premiumSource, /labelKey: 'premium\.lane\.ai', free: false, premium: 'Live'/);

      // Nothing without an implementation may claim Live.
      assert.match(lanes[0], /live: false, variant: 'session'/);
      assert.match(lanes[0], /live: false, variant: 'week'/);
    },
  },
  {
    name: 'the paywall states no efficacy figure nobody measured',
    run() {
      const stats = homeSource.match(/const PRO_STATS[\s\S]*?\n\];/);
      assert.ok(stats, 'PRO_STATS should still be declared');

      // These two shipped as "2.3x more consistent training" and "+34% avg.
      // strength in 12 wks" on a paywall. There is no study and there are no
      // users; they were invented. Every figure here must come from the code.
      assert.doesNotMatch(stats[0], /'2\.3'|'\+34'/);
      assert.match(stats[0], /GENERATED_EXERCISE_LIBRARY\.length/);
      assert.match(stats[0], /DEFAULT_HISTORY_WINDOW_DAYS/);
      // "Unlimited AI coach questions" was false too — the endpoint rate-limits
      // and holds a token budget.
      assert.doesNotMatch(stats[0], /'∞'/);
    },
  },
  {
    name: 'the paywall does not bill free features as Pro',
    run() {
      const rows = homeSource.match(/const PRO_COMPARISON[\s\S]*?\n\];/);
      assert.ok(rows, 'PRO_COMPARISON should still be declared');

      // Ready plans, own templates and the progress tab all work without
      // paying. Marking them Pro-only sells the free tier short and is the
      // same lie in the other direction.
      for (const key of ['log', 'plans', 'analytics']) {
        assert.match(
          rows[0],
          new RegExp(`'home\\.proSheet\\.row\\.${key}', free: true`),
          `${key} is free in the app and must say so`,
        );
      }
      for (const key of ['adaptive', 'coach']) {
        assert.match(rows[0], new RegExp(`'home\\.proSheet\\.row\\.${key}', free: false`));
      }
      // Nothing implemented an early-access promise.
      assert.doesNotMatch(rows[0], /earlyAccess/);
    },
  },
  {
    name: 'the paywall CTA leads somewhere real instead of promising a trial',
    run() {
      assert.doesNotMatch(homeSource, /home\.proSheet\.cta.*trial/i);
      assert.match(homeSource, /onOpenPremium\?\.\(\)/, 'the CTA must open the premium screen');
      assert.match(appSource, /onOpenPremium=\{\(\) => navigate\(\{ tab: 'profile', screen: 'premium' \}\)\}/);
    },
  },
  {
    name: 'automated progression is sold as Pro, so every start path gates it on Pro',
    run() {
      // App.tsx: all three start call sites go through the one helper that
      // combines the toggle with the entitlement.
      assert.doesNotMatch(
        appSource,
        /automatedProgressionEnabled: (preferences|nextPreferences)\.automatedProgressionEnabled/,
        'a start call passing the raw toggle would hand a free user the paid prefill',
      );
      assert.equal(
        (appSource.match(/resolveProgressionOptions\((preferences|nextPreferences)\)/g) ?? []).length,
        3,
        'the ready, custom, and AI start paths must all resolve through the entitlement',
      );

      // The logger's own bootstrap is the fourth path.
      assert.match(
        loggerSource,
        /automatedProgressionEnabled: automatedProgressionEnabled && hasAdaptiveCoachPremium/,
      );

      // The raw toggle still drives the adaptive-coach offer, so a free user
      // with it on sees the locked upsell and one with it off is left alone.
      assert.match(loggerSource, /resolveAdaptiveCoachOffer\(\{\s*automatedProgressionEnabled,/);
    },
  },
  {
    name: 'the post-onboarding offer states only counts the code can prove',
    run() {
      // The two figures are read from the catalog and the library, never typed.
      assert.match(proOfferSource, /WORKOUT_TEMPLATES_V1\.length/);
      assert.match(proOfferSource, /GENERATED_EXERCISE_LIBRARY\.length/);
      assert.doesNotMatch(proOfferSource, /'\d+ (ready programs|exercises)/);

      // No trial promise, and continuing free is the primary action.
      assert.doesNotMatch(proOfferSource, /trial|kokeilu/i);
      assert.match(proOfferSource, /proOffer\.continueFree/);

      // Shown once, on the plan-ready path.
      assert.match(appSource, /resetToRoute\(\{ tab: 'home', screen: 'pro_offer' \}\)/);
    },
  },
];
