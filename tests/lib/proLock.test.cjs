const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..', '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8').split('\r\n').join('\n');

/** Every .ts/.tsx under src, plus App.tsx — the whole app surface. */
function sourceFiles() {
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
        files.push({ rel: path.relative(root, full).split(path.sep).join('/'), text: fs.readFileSync(full, 'utf8') });
      }
    }
  };
  walk(path.join(root, 'src'));
  files.push({ rel: 'App.tsx', text: fs.readFileSync(path.join(root, 'App.tsx'), 'utf8') });
  return files;
}

/**
 * The free/Pro lock, swept at the source level (user 2026-09-03: "katso
 * samalla että mistään ei pysty kiertämään free/pro lukkoa").
 *
 * The unit tests in proEntitlement prove the RULE. These prove that no screen
 * has quietly grown its own — which is how the lock came loose in the first
 * place: the Pro page's CTA wrote a boolean that meant "Pro is on", and then
 * a button under it wrote the same boolean back to false.
 */
module.exports = [
  {
    name: 'proLock: the entitlement grants from exactly two things, and names them',
    run() {
      const entitlement = read('src', 'lib', 'proEntitlement.ts');
      // The fields it is allowed to read at all.
      assert.match(
        entitlement,
        /'promoProUntil' \| 'mockSubscriptionPurchasedAt' \| 'mockSubscriptionTerm' \| 'mockSubscriptionCancelledAt'/,
      );
      // Two sources, no third.
      assert.match(entitlement, /source: 'promo' \| 'purchase' \| null;/);
      assert.match(entitlement, /source: 'promo'/);
      assert.match(entitlement, /source: 'purchase' as const/);
    },
  },
  {
    name: 'proLock: the demo build\'s free Pro switch is gone from every file',
    run() {
      // A boolean preference that meant "Pro is on" and could be written from
      // a screen. Nothing may bring it back under any name.
      const offenders = [];
      for (const { rel, text } of sourceFiles()) {
        if (rel === 'src/storage/database.ts') {
          // Names it once in a comment saying an old stored value is dropped.
          continue;
        }
        if (/adaptiveCoachPremiumUnlocked/.test(text)) {
          offenders.push(rel);
        }
      }
      assert.deepEqual(offenders, [], 'the preview switch is back');
      // And its copy went with it.
      assert.equal(read('src', 'lib', 'i18n.ts').includes("'pro.previewOff'"), false);
    },
  },
  {
    name: 'proLock: nothing decides Pro from a preference of its own',
    run() {
      /**
       * The grant fields may be DISPLAYED — the promo screen shows the date,
       * the subscription screen shows the term. What no file outside the
       * entitlement may do is turn one into a yes/no about a feature.
       */
      const offenders = [];
      for (const { rel, text } of sourceFiles()) {
        if (rel === 'src/lib/proEntitlement.ts') {
          continue;
        }
        for (const [index, line] of text.split('\n').entries()) {
          const at = `${rel}:${index + 1}`;
          // "promoProUntil is in the future" is the entitlement's own job.
          if (/promoProUntil[^\n]*(>|<)[^\n]*(Date\.now|getTime)/.test(line)) {
            offenders.push(`${at} decides Pro from the promo date`);
          }
          // A tier string compared to 'pro' is a second entitlement.
          if (/selectedAccessTier\s*===\s*'pro'/.test(line)) {
            offenders.push(`${at} decides Pro from selectedAccessTier`);
          }
          // The purchase fields must not gate a feature outside the entitlement.
          if (/mockSubscription(PurchasedAt|CancelledAt)[^\n]*\?\s*true/.test(line)) {
            offenders.push(`${at} decides Pro from the purchase record`);
          }
        }
      }
      assert.deepEqual(offenders, [], `these bypass resolveProEntitlement:\n  ${offenders.join('\n  ')}`);
    },
  },
  {
    name: 'proLock: every proUnlocked handed to a screen comes from the entitlement',
    run() {
      const allowed = new Set([
        'coachProUnlocked',
        'proUnlocked',
        'proEntitlement.unlocked',
        'resolveProEntitlement(preferences).unlocked',
      ]);
      const offenders = [];
      for (const { rel, text } of sourceFiles()) {
        for (const [index, line] of text.split('\n').entries()) {
          const jsx = line.match(/proUnlocked=\{([^}]+)\}/);
          const prop = line.match(/^\s*proUnlocked:\s*([^,]+),/);
          const value = (jsx?.[1] ?? prop?.[1] ?? '').trim();
          if (!value || value === 'boolean' || allowed.has(value)) {
            continue;
          }
          offenders.push(`${rel}:${index + 1} -> ${value}`);
        }
      }
      assert.deepEqual(offenders, [], `a Pro flag from somewhere else:\n  ${offenders.join('\n  ')}`);
    },
  },
  {
    name: 'proLock: only the promo screen and the purchase write a grant',
    run() {
      // Writers, not readers: an updatePreferences that sets one of the four
      // fields. Two places may, and the sweep names any third.
      const allowedWriters = new Set(['src/app/renderProfileTab.tsx', 'src/data/seed.ts', 'src/state/AppProvider.tsx', 'src/storage/database.ts']);
      const offenders = [];
      for (const { rel, text } of sourceFiles()) {
        if (allowedWriters.has(rel) || rel === 'src/lib/proEntitlement.ts') {
          continue;
        }
        for (const [index, line] of text.split('\n').entries()) {
          if (/(promoProUntil|mockSubscriptionPurchasedAt|mockSubscriptionCancelledAt|mockSubscriptionTerm)\s*:/.test(line) && /updatePreferences|onPreferencesChange/.test(text)) {
            // Only flag an actual assignment inside a preferences write.
            if (/:\s*(new Date|'|"|`|null|true|false|proUntil|plan)/.test(line)) {
              offenders.push(`${rel}:${index + 1}`);
            }
          }
        }
      }
      assert.deepEqual(offenders, [], `a grant written outside the promo screen and the purchase:\n  ${offenders.join('\n  ')}`);

      // And the promo grant still comes from a code, not from opening a screen.
      const promo = read('src', 'screens', 'PromoCodeScreen.tsx');
      assert.match(promo, /const until = redeemPromoCode\(code\);/);
      // An unknown code says so; it does not fall through to a grant.
      assert.match(promo, /if \(until\) \{[\s\S]{0,120}onRedeemed\(until\);[\s\S]{0,60}\} else \{[\s\S]{0,80}'promo\.noMatch'/);
      // And "is my promo live" is the entitlement's answer, not a second clock.
      assert.match(promo, /promoActive: boolean;/);
      assert.doesNotMatch(promo, /promoProUntil[^\n]*getTime\(\) >/);
    },
  },
  {
    name: 'proLock: the purchase is simulated end to end, and the build says so',
    run() {
      const tab = read('src', 'app', 'renderProfileTab.tsx');
      // It records an instant and a term — the shape billing slots into.
      assert.match(tab, /mockSubscriptionPurchasedAt: new Date\(\)\.toISOString\(\)/);
      assert.match(tab, /mockSubscriptionTerm: plan/);
      // Cancelling records WHEN, because a cancelled period must not roll on.
      assert.match(tab, /mockSubscriptionCancelledAt: new Date\(\)\.toISOString\(\)/);

      // The invented card and receipt stay behind the demo flag, so clearing
      // it for a store build takes them off the screen.
      const view = read('src', 'lib', 'subscriptionView.ts');
      assert.match(view, /export function showsMockBilling\(view: SubscriptionView, demoBuild: boolean\)/);
      assert.match(view, /return demoBuild && view\.state === 'active' && !view\.promoBacked;/);
      assert.equal(JSON.parse(read('app.json')).expo.extra.demoBuild, true);
    },
  },
];
