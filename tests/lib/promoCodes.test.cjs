const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { redeemPromoCode, listPromoCodes } = require('../../.test-dist/lib/promoCodes');
const { DEMO_BUILD } = require('../../.test-dist/lib/demoMode');

const root = path.join(__dirname, '..', '..');
const NOW = new Date('2026-08-01T09:00:00.000Z');

module.exports = [
  {
    name: 'a live code grants Pro for its own stretch of days from redemption',
    run() {
      const until = redeemPromoCode('vinhauusi2026', NOW);
      assert.ok(until, 'the live code did not redeem');
      // 30 days from redemption, not a fixed date — a hardcoded expiry turns a
      // campaign into a dead code that reads as a broken app.
      assert.equal(new Date(until).toISOString().slice(0, 10), '2026-08-31');
    },
  },
  {
    name: 'codes survive how people actually type them off a poster',
    run() {
      const expected = redeemPromoCode('vinhauusi2026', NOW);
      assert.equal(redeemPromoCode('Vinhauusi2026', NOW), expected);
      assert.equal(redeemPromoCode('  VINHAUUSI2026 ', NOW), expected);
    },
  },
  {
    name: 'an unknown code yields nothing rather than a default grant',
    run() {
      assert.equal(redeemPromoCode('', NOW), null);
      assert.equal(redeemPromoCode('nope', NOW), null);
      // The GAINER-era code is retired with the name.
      assert.equal(redeemPromoCode('gainer_2026', NOW), null);
      assert.deepEqual(listPromoCodes(), ['vinhauusi2026']);
    },
  },
  {
    name: 'the demo switch is tied to the one flag the release step clears',
    run() {
      // DEMO_BUILD is declared in src and again in app.json. Pinning them to
      // each other is what makes clearing extra.demoBuild a real release step
      // instead of a note someone has to remember: the moment they disagree,
      // this fails and names the other half.
      const appJson = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
      assert.equal(
        DEMO_BUILD,
        appJson.expo.extra.demoBuild === true,
        'src/lib/demoMode DEMO_BUILD and app.json extra.demoBuild disagree',
      );

      // The Settings demo section was removed by user decision (2026-08-22);
      // the one remaining preview-Pro switch lives on the Premium screen's
      // active state, where it can also be turned back off.
      const settings = fs.readFileSync(
        path.join(root, 'src', 'screens', 'SettingsScreen.tsx'),
        'utf8',
      );
      assert.ok(!/isDemoBuild/.test(settings), 'the Settings demo section must stay removed');
      const premium = fs.readFileSync(
        path.join(root, 'src', 'screens', 'PremiumScreen.tsx'),
        'utf8',
      );
      assert.match(premium, /pro\.previewOff/);
    },
  },
];
