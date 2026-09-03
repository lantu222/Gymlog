const assert = require('node:assert/strict');

const {
  isProUnlocked,
  resolveProEntitlement,
  resolveProgressionOptions,
} = require('../../.test-dist/lib/proEntitlement.js');

const NOW = new Date('2026-07-25T12:00:00.000Z');

function prefs(overrides) {
  return {
    promoProUntil: null,
    mockSubscriptionPurchasedAt: null,
    mockSubscriptionTerm: 'yearly',
    mockSubscriptionCancelledAt: null,
    ...overrides,
  };
}

/**
 * Two doors into Pro, and no third (user 2026-09-03). The suite is written as
 * a list of ways in, so adding one without adding a case here is the thing it
 * is meant to make hard.
 */
module.exports = [
  {
    name: 'a fresh account has no Pro',
    run() {
      const entitlement = resolveProEntitlement(prefs({}), NOW);
      assert.equal(entitlement.unlocked, false);
      assert.equal(entitlement.source, null);
      assert.equal(entitlement.promoUntil, null);
      assert.equal(entitlement.purchaseEndsAt, null);
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
    name: 'an expired or unreadable promo does not unlock Pro',
    run() {
      assert.equal(isProUnlocked(prefs({ promoProUntil: '2026-07-24T12:00:00.000Z' }), NOW), false);
      assert.equal(isProUnlocked(prefs({ promoProUntil: 'not-a-date' }), NOW), false);
    },
  },
  {
    name: 'a recorded purchase unlocks Pro, and an unreadable one does not',
    run() {
      const bought = resolveProEntitlement(
        prefs({ mockSubscriptionPurchasedAt: '2026-07-01T09:00:00.000Z' }),
        NOW,
      );
      assert.equal(bought.unlocked, true);
      assert.equal(bought.source, 'purchase');
      // Still renewing, so there is no end date to name.
      assert.equal(bought.purchaseEndsAt, null);

      assert.equal(isProUnlocked(prefs({ mockSubscriptionPurchasedAt: 'whenever' }), NOW), false);
    },
  },
  {
    name: 'cancelling runs the purchase to the end of the period, and then it stops',
    run() {
      // Bought 1 July, cancelled: a yearly term keeps working until 1 July next
      // year. This is the sentence the End membership screen makes.
      const cancelled = resolveProEntitlement(
        prefs({
          mockSubscriptionPurchasedAt: '2026-07-01T09:00:00.000Z',
          mockSubscriptionCancelledAt: NOW.toISOString(),
        }),
        NOW,
      );
      assert.equal(cancelled.unlocked, true);
      assert.equal(cancelled.purchaseEndsAt, '2027-07-01T09:00:00.000Z');

      // The day after that period ends, it is over.
      assert.equal(
        isProUnlocked(
          prefs({
            mockSubscriptionPurchasedAt: '2026-07-01T09:00:00.000Z',
            mockSubscriptionCancelledAt: NOW.toISOString(),
          }),
          new Date('2027-07-02T09:00:00.000Z'),
        ),
        false,
      );

      // A monthly bought three months ago has renewed twice, so cancelling it
      // today runs to the end of the CURRENT month, not to a date in the past.
      const monthly = resolveProEntitlement(
        prefs({
          mockSubscriptionPurchasedAt: '2026-04-10T09:00:00.000Z',
          mockSubscriptionTerm: 'monthly',
          mockSubscriptionCancelledAt: NOW.toISOString(),
        }),
        NOW,
      );
      assert.equal(monthly.unlocked, true);
      assert.equal(monthly.purchaseEndsAt, '2026-08-10T09:00:00.000Z');

      // Lifetime has no period left to run, so cancelling ends it at once.
      assert.equal(
        isProUnlocked(
          prefs({
            mockSubscriptionPurchasedAt: '2026-07-01T09:00:00.000Z',
            mockSubscriptionTerm: 'lifetime',
            mockSubscriptionCancelledAt: NOW.toISOString(),
          }),
          NOW,
        ),
        false,
      );
      // Uncancelled, it never ends.
      assert.equal(
        isProUnlocked(
          prefs({ mockSubscriptionPurchasedAt: '2026-07-01T09:00:00.000Z', mockSubscriptionTerm: 'lifetime' }),
          new Date('2099-01-01T00:00:00.000Z'),
        ),
        true,
      );
    },
  },
  {
    name: 'an active promo wins over a purchase as the stated reason',
    run() {
      const entitlement = resolveProEntitlement(
        prefs({
          promoProUntil: '2026-08-24T12:00:00.000Z',
          mockSubscriptionPurchasedAt: '2026-07-01T09:00:00.000Z',
        }),
        NOW,
      );
      assert.equal(entitlement.source, 'promo');
    },
  },
  {
    name: 'nothing else in preferences can unlock Pro',
    run() {
      // The demo build used to carry a preview switch the Pro page flipped, and
      // a button under it to flip it back — Pro for free, from inside the app,
      // as often as you liked. Anything shaped like that must not work.
      for (const stowaway of [
        { adaptiveCoachPremiumUnlocked: true },
        { selectedAccessTier: 'pro' },
        { proUnlocked: true },
        { premium: true },
        { mockSubscriptionTerm: 'lifetime' },
        { mockSubscriptionCancelledAt: null },
      ]) {
        assert.equal(
          isProUnlocked(prefs(stowaway), NOW),
          false,
          `${JSON.stringify(stowaway)} unlocked Pro without a promo or a purchase`,
        );
      }
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

      // Paying user, toggle on: the paid feature runs.
      assert.deepEqual(
        resolveProgressionOptions(
          prefs({ ...base, mockSubscriptionPurchasedAt: '2026-07-01T09:00:00.000Z' }),
          NOW,
        ),
        { automatedProgressionEnabled: true, setupLevel: 'beginner' },
      );

      // Paying user, toggle off: paying does not force progression on.
      assert.deepEqual(
        resolveProgressionOptions(
          prefs({
            ...base,
            automatedProgressionEnabled: false,
            mockSubscriptionPurchasedAt: '2026-07-01T09:00:00.000Z',
          }),
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
