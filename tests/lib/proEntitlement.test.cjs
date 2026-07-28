const assert = require('node:assert/strict');

const {
  isProUnlocked,
  resolveProEntitlement,
  resolveProgressionOptions,
} = require('../../.test-dist/lib/proEntitlement.js');

const NOW = new Date('2026-07-25T12:00:00.000Z');

function prefs(overrides) {
  return { promoProUntil: null, adaptiveCoachPremiumUnlocked: false, ...overrides };
}

module.exports = [
  {
    name: 'a fresh account has no Pro',
    run() {
      const entitlement = resolveProEntitlement(prefs({}), NOW);
      assert.equal(entitlement.unlocked, false);
      assert.equal(entitlement.source, null);
      assert.equal(entitlement.promoUntil, null);
    },
  },
  {
    name: 'an unexpired promo unlocks Pro and says so',
    run() {
      const entitlement = resolveProEntitlement(
        prefs({ promoProUntil: '2026-08-24T12:00:00.000Z' }),
        NOW,
      );
      assert.equal(entitlement.unlocked, true);
      assert.equal(entitlement.source, 'promo');
      assert.equal(entitlement.promoUntil, '2026-08-24T12:00:00.000Z');
    },
  },
  {
    name: 'an expired promo does not unlock Pro',
    run() {
      assert.equal(isProUnlocked(prefs({ promoProUntil: '2026-07-24T12:00:00.000Z' }), NOW), false);
    },
  },
  {
    name: 'a malformed promo date is treated as no promo rather than as valid',
    run() {
      assert.equal(isProUnlocked(prefs({ promoProUntil: 'not-a-date' }), NOW), false);
    },
  },
  {
    name: 'the premium preview switch unlocks Pro without claiming a promo',
    run() {
      const entitlement = resolveProEntitlement(prefs({ adaptiveCoachPremiumUnlocked: true }), NOW);
      assert.equal(entitlement.unlocked, true);
      assert.equal(entitlement.source, 'preview');
      assert.equal(entitlement.promoUntil, null);
    },
  },
  {
    name: 'an active promo wins over the preview switch as the stated reason',
    run() {
      const entitlement = resolveProEntitlement(
        prefs({ promoProUntil: '2026-08-24T12:00:00.000Z', adaptiveCoachPremiumUnlocked: true }),
        NOW,
      );
      assert.equal(entitlement.source, 'promo');
    },
  },
  {
    name: 'progression options: the toggle only progresses with Pro, and Pro never overrides OFF',
    run() {
      const base = { automatedProgressionEnabled: true, setupLevel: 'beginner' };

      // Free user, toggle on: stored choice respected, prefill must not move.
      assert.deepEqual(resolveProgressionOptions(prefs(base), NOW), {
        automatedProgressionEnabled: false,
        setupLevel: 'beginner',
      });

      // Pro user, toggle on: the paid feature runs.
      assert.deepEqual(
        resolveProgressionOptions(prefs({ ...base, adaptiveCoachPremiumUnlocked: true }), NOW),
        { automatedProgressionEnabled: true, setupLevel: 'beginner' },
      );

      // Pro user, toggle off: paying does not force progression on.
      assert.deepEqual(
        resolveProgressionOptions(
          prefs({ ...base, automatedProgressionEnabled: false, adaptiveCoachPremiumUnlocked: true }),
          NOW,
        ),
        { automatedProgressionEnabled: false, setupLevel: 'beginner' },
      );

      // A promo grant counts as Pro here exactly like everywhere else.
      assert.equal(
        resolveProgressionOptions(prefs({ ...base, promoProUntil: '2026-08-24T12:00:00.000Z' }), NOW)
          .automatedProgressionEnabled,
        true,
      );

      // And an expired promo does not.
      assert.equal(
        resolveProgressionOptions(prefs({ ...base, promoProUntil: '2026-07-24T12:00:00.000Z' }), NOW)
          .automatedProgressionEnabled,
        false,
      );
    },
  },
];
