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
];
