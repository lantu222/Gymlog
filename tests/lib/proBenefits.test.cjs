const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  PRO_LIVE_BENEFITS,
  PRO_UNLOCK_CARDS,
  resolveMembershipEndPlan,
} = require('../../.test-dist/lib/proBenefits');

const root = path.join(__dirname, '..', '..');
const premiumSource = fs.readFileSync(path.join(root, 'src', 'screens', 'PremiumScreen.tsx'), 'utf8');
const i18nSource = fs.readFileSync(path.join(root, 'src', 'lib', 'i18n.ts'), 'utf8');

module.exports = [
  {
    name: 'the what-you-lose list only names benefits the Pro page ships today',
    run() {
      assert.ok(PRO_LIVE_BENEFITS.length > 0);

      for (const benefit of PRO_LIVE_BENEFITS) {
        const entry = premiumSource.match(
          new RegExp(`\\{ titleKey: '${benefit.titleKey.replace(/\./g, '\\.')}'[^}]*\\}`),
        );
        assert.ok(entry, `${benefit.titleKey} is not on the Pro page at all`);
        // A SOON item is not a loss — you cannot lose what never shipped, and
        // striking it through turns the screen into a threat about nothing.
        assert.doesNotMatch(
          entry[0],
          /soon: true/,
          `${benefit.titleKey} is marked SOON on the Pro page but listed as a live loss`,
        );
        assert.match(i18nSource, new RegExp(`'${benefit.bodyKey.replace(/\./g, '\\.')}'`));
      }
    },
  },
  {
    name: 'ending Pro only offers an action the app can actually carry out',
    run() {
      // A promo lapses; there is nothing to cancel, so no button.
      const promo = resolveMembershipEndPlan('promo', '2026-09-01T00:00:00.000Z');
      assert.equal(promo.canEndNow, false);
      assert.equal(promo.lapsesOn, '2026-09-01T00:00:00.000Z');

      // The demo switch is the one source the app can turn off itself.
      const preview = resolveMembershipEndPlan('preview', null);
      assert.equal(preview.canEndNow, true);
      assert.equal(preview.lapsesOn, null);

      // No Pro at all: no end button and no date to promise.
      const none = resolveMembershipEndPlan('none', null);
      assert.equal(none.canEndNow, false);
      assert.equal(none.lapsesOn, null);

      // A promo still outranks the preview flag in resolveProEntitlement, so
      // 'promo' must never be given the turn-off button by mistake.
      assert.equal(resolveMembershipEndPlan('promo', null).canEndNow, false);
    },
  },
  {
    name: 'the unlock cards announce every live benefit exactly once',
    run() {
      // This is the guard that was missing when the adaptive set coach was
      // deleted: the unlock screen kept announcing it for a day because its
      // card list lived apart from PRO_LIVE_BENEFITS. Now the union of the
      // cards' gates must equal the benefit list exactly — remove a benefit
      // and the card announcing it fails here, loudly.
      const announced = PRO_UNLOCK_CARDS.flatMap((card) => card.gates);
      const sold = PRO_LIVE_BENEFITS.map((benefit) => benefit.titleKey);

      assert.deepEqual(
        [...announced].sort(),
        [...sold].sort(),
        'the unlock cards and PRO_LIVE_BENEFITS disagree about what Pro is',
      );
      assert.equal(
        new Set(announced).size,
        announced.length,
        'a benefit is announced by two different cards',
      );
    },
  },
];
