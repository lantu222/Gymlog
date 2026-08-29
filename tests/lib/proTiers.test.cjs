const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  PRO_TIERS,
  PRO_TIER_ORDER,
  READY_PROGRAM_COUNT,
  defaultPlanForTier,
  resolveTierCtaKey,
  resolveTierFineKey,
} = require('../../.test-dist/lib/proTiers');
const { WORKOUT_TEMPLATES_V1 } = require('../../.test-dist/features/workout/workoutCatalog');

const root = path.join(__dirname, '..', '..');
const i18nSource = fs.readFileSync(path.join(root, 'src', 'lib', 'i18n.ts'), 'utf8');

/** Every .ts/.tsx under src/, flattened, so a proof can be looked for by name. */
function readSourceTree(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return readSourceTree(full);
    }
    return /\.tsx?$/.test(entry.name) ? [fs.readFileSync(full, 'utf8')] : [];
  });
}

const sourceTree = readSourceTree(path.join(root, 'src')).join('\n');
const tiers = PRO_TIER_ORDER.map((key) => PRO_TIERS[key]);
const allRows = tiers.flatMap((tier) => tier.rows);

function keyLines(key) {
  return i18nSource.split('\n').filter((line) => line.includes(`'${key}':`));
}

module.exports = [
  {
    name: 'every row the paywall sells names something that exists in the code',
    run() {
      assert.equal(tiers.length, 3, 'three tabs, no more');
      assert.ok(allRows.length >= 15, 'the tabs are not empty');

      // The same discipline PRO_LIVE_BENEFITS applies to the what-you-lose
      // list. A paywall row whose proof has been deleted is a sentence that
      // survives the feature, which is how "3D demos" outlived the 3D media.
      for (const row of allRows) {
        assert.ok(
          sourceTree.includes(row.proof),
          `${row.titleKey} claims ${row.proof}, which is nowhere in src/`,
        );
      }
    },
  },
  {
    name: 'every string on the paywall exists in both languages',
    run() {
      const keys = [];
      for (const tier of tiers) {
        keys.push(tier.tabKey, tier.headKey, tier.ctaKey);
        if (tier.badgeKey) keys.push(tier.badgeKey);
        if (tier.trialCtaKey) keys.push(tier.trialCtaKey);
        for (const row of tier.rows) {
          keys.push(row.titleKey);
          if (row.bodyKey) keys.push(row.bodyKey);
        }
        for (const plan of tier.plans) {
          keys.push(plan.nameKey, plan.priceKey, plan.unitKey);
          // Free carries no fine print: nothing is being sold, so there are no
          // terms to state and the 0 € tile has already said the rest.
          if (plan.fineKey) keys.push(plan.fineKey);
          if (plan.subKey) keys.push(plan.subKey);
          if (plan.badgeKey) keys.push(plan.badgeKey);
          if (plan.trialFineKey) keys.push(plan.trialFineKey);
        }
      }

      for (const key of new Set(keys)) {
        assert.equal(keyLines(key).length, 2, `${key} should exist in both languages`);
      }
    },
  },
  {
    name: 'the free tab counts the catalogue it gives away',
    run() {
      assert.equal(READY_PROGRAM_COUNT, WORKOUT_TEMPLATES_V1.length);

      const ready = PRO_TIERS.free.rows.find((row) => row.key === 'ready');
      assert.ok(ready, 'the free tab must name the ready catalogue');
      assert.equal(
        ready.vars.count,
        WORKOUT_TEMPLATES_V1.length,
        'the free tab names a programme count the catalogue no longer has',
      );
    },
  },
  {
    name: 'the Pro tab never sells something the free tier already has',
    run() {
      // Both of these were on the Pro tab of the reference design, and both
      // are free: the dark theme since 2026-08-23 (resolveThemeName stopped
      // reading the entitlement), the widget and cloud backup always. Selling
      // a free feature is worse than omitting a paid one — the reader can
      // check it in thirty seconds, and everything else on the page then
      // reads as sales copy too.
      const proKeys = PRO_TIERS.pro.rows
        .flatMap((row) => [row.titleKey, row.bodyKey])
        .filter(Boolean)
        .join(' ');
      assert.doesNotMatch(proKeys, /theme|teema/i, 'the dark theme is free');
      assert.doesNotMatch(proKeys, /widget/i, 'the widget is free');
      assert.doesNotMatch(proKeys, /backup|varmuuskopio/i, 'cloud backup is not gated');

      // proBenefits.test.cjs fails the build if backup is ever sold as a live
      // benefit. This is the same rule on the other surface, stated here so
      // the paywall cannot quietly disagree with the what-you-lose list.
      for (const row of PRO_TIERS.pro.rows) {
        assert.doesNotMatch(row.proof, /backup/i);
      }
    },
  },
  {
    name: 'the fine print follows the plan, not the tab',
    run() {
      const pro = PRO_TIERS.pro;
      const monthly = resolveTierFineKey(pro, 'monthly', false);
      const yearly = resolveTierFineKey(pro, 'yearly', false);
      assert.ok(monthly, 'a subscription CTA always carries fine print');
      assert.ok(yearly);

      // A plan the tier does not have falls back rather than rendering an
      // empty line under a buy button.
      assert.equal(resolveTierFineKey(pro, 'lifetime', false), pro.plans[0].fineKey);

      // While the trial is off the flat wording is the honest one; the "then
      // 59,90 €" line only appears when there is a trial to be after.
      const flat = resolveTierFineKey(pro, 'yearly', false);
      const trial = resolveTierFineKey(pro, 'yearly', true);
      assert.notEqual(flat, trial, 'the trial changes what the fine print promises');
      assert.equal(resolveTierCtaKey(pro, false), pro.ctaKey);
      assert.equal(resolveTierCtaKey(pro, true), pro.trialCtaKey);

      // Free has no trial wording to switch to, so the flag cannot change it.
      const free = PRO_TIERS.free;
      assert.equal(resolveTierFineKey(free, 'free', true), resolveTierFineKey(free, 'free', false));
      assert.equal(resolveTierCtaKey(free, true), free.ctaKey);
    },
  },
  {
    name: 'each tab opens on the plan it means to sell',
    run() {
      assert.equal(defaultPlanForTier('pro'), 'yearly', 'the year is the offer');
      assert.equal(defaultPlanForTier('free'), 'free');
      assert.equal(defaultPlanForTier('life'), 'lifetime');
    },
  },
  {
    name: 'no price is written into the tier table',
    run() {
      // The root cause this repeats: PremiumScreen once carried '5,99 €' and
      // '9,99 €' as string literals and kept selling a retired price set. Every
      // figure here is a key into the one price dictionary.
      const source = fs.readFileSync(path.join(root, 'src', 'lib', 'proTiers.ts'), 'utf8');
      const code = source
        .split('\n')
        .filter((line) => !line.trim().startsWith('*') && !line.trim().startsWith('//'))
        .join('\n');
      assert.doesNotMatch(code, /\d+[.,]\d{2}\s*€/, 'a price literal reached the tier table');
    },
  },
];
