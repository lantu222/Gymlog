const assert = require('node:assert/strict');

const {
  MOCK_BILLING,
  SUBSCRIPTION_TERMS,
  isSubscriptionTermKey,
  nextChargeAt,
  resolveSubscriptionView,
  showsMockBilling,
} = require('../../.test-dist/lib/subscriptionView.js');

const NONE = { unlocked: false, source: null, promoUntil: null };
const PREVIEW = { unlocked: true, source: 'preview', promoUntil: null };
const promo = (until) => ({ unlocked: true, source: 'promo', promoUntil: until });

const base = { mockTerm: 'yearly', mockCancelled: false };

module.exports = [
  {
    name: 'subscription: never subscribed is its own state, not a broken active one',
    run() {
      // The state that looks dead and is not. Home's PRO pill does send a free
      // reader to the paywall — but Settings → Account → Subscription is an
      // unconditional row, so this is what a reader who has never paid sees.
      const view = resolveSubscriptionView({ ...base, entitlement: NONE });
      assert.equal(view.state, 'none');
      assert.equal(view.term, null);
      assert.equal(view.endsAt, null);
      assert.equal(view.nextChargeAt, null);
    },
  },
  {
    name: 'subscription: an expired promo is lapsed, and a live one is active',
    run() {
      // "Lapsed" is the one state the app can prove today: a promoProUntil in
      // the past means this reader really did have Pro and really did lose it.
      const lapsed = resolveSubscriptionView({
        ...base,
        entitlement: NONE,
        lapsedPromoUntil: '2026-07-15T00:00:00.000Z',
      });
      assert.equal(lapsed.state, 'lapsed');
      assert.equal(lapsed.endsAt, '2026-07-15T00:00:00.000Z');

      const live = resolveSubscriptionView({
        ...base,
        entitlement: promo('2026-09-15T00:00:00.000Z'),
      });
      assert.equal(live.state, 'active');
      assert.equal(live.endsAt, '2026-09-15T00:00:00.000Z');
    },
  },
  {
    name: 'subscription: promo Pro is never dressed in invented billing',
    run() {
      // A promo is real Pro on a real clock. Putting a Visa and a renewal date
      // on top of it would be inventing billing over a fact the reader can
      // check against the code they redeemed.
      const view = resolveSubscriptionView({
        ...base,
        entitlement: promo('2026-09-15T00:00:00.000Z'),
      });
      assert.equal(view.promoBacked, true);
      assert.equal(view.term, null);
      assert.equal(view.nextChargeAt, null);
      // ...and the gate refuses the billing rows even in a demo build.
      assert.equal(showsMockBilling(view, true), false);
    },
  },
  {
    name: 'subscription: the next charge is counted, never written',
    run() {
      // The shape real billing will have to fill: a purchase instant plus a
      // period, from which the date is derived. Writing the date into copy is
      // the bug #bugs logged against the unlock receipt.
      assert.equal(nextChargeAt('yearly', '2026-08-15T00:00:00.000Z'), '2027-08-15T00:00:00.000Z');
      assert.equal(nextChargeAt('monthly', '2026-08-15T00:00:00.000Z'), '2026-09-15T00:00:00.000Z');
      // Lifetime does not renew at all — not "renews far away".
      assert.equal(nextChargeAt('lifetime', '2026-08-15T00:00:00.000Z'), null);
      assert.equal(nextChargeAt('yearly', 'not-a-date'), null);
    },
  },
  {
    name: 'subscription: cancelling keeps Pro until the period ends',
    run() {
      // The end-membership page promises Pro works until the date two lines
      // above the button. A cancel that switched it off on the spot would
      // contradict the screen the reader is standing on.
      const view = resolveSubscriptionView({
        entitlement: PREVIEW,
        mockTerm: 'yearly',
        mockCancelled: true,
      });
      assert.equal(view.state, 'active');
      assert.equal(view.cancelled, true);
      assert.equal(view.endsAt, '2027-08-15T00:00:00.000Z');
      // Nothing more is owed, but Pro is still on.
      assert.equal(view.nextChargeAt, null);
    },
  },
  {
    name: 'subscription: clearing the demo flag takes every invented row away',
    run() {
      // The release valve. showsMockBilling is the only thing the screen asks,
      // so one flag removes the card, the receipts and the term switcher
      // without anyone editing the screen.
      const view = resolveSubscriptionView({ ...base, entitlement: PREVIEW });
      assert.equal(showsMockBilling(view, true), true);
      assert.equal(showsMockBilling(view, false), false);

      const none = resolveSubscriptionView({ ...base, entitlement: NONE });
      assert.equal(showsMockBilling(none, true), false);
    },
  },
  {
    name: 'subscription: every term has a price, a unit and an honest renewal flag',
    run() {
      for (const key of ['monthly', 'yearly', 'lifetime']) {
        const term = SUBSCRIPTION_TERMS[key];
        assert.equal(term.key, key);
        assert.ok(term.priceKey && term.perKey && term.labelKey);
        assert.equal(typeof term.renews, 'boolean');
        assert.ok(isSubscriptionTermKey(key));
      }
      // The one that decides how three different screens phrase themselves.
      assert.equal(SUBSCRIPTION_TERMS.lifetime.renews, false);
      assert.equal(SUBSCRIPTION_TERMS.yearly.renews, true);
      assert.equal(isSubscriptionTermKey('weekly'), false);
      assert.equal(isSubscriptionTermKey(null), false);
    },
  },
  {
    name: 'subscription: the mock prices come from the dictionary, not from here',
    run() {
      // Every price on this screen is an i18n key, so the one price set the
      // proSurfaces guard pins is also the one this screen quotes. A number
      // typed into MOCK_BILLING would be a second price set nobody guards.
      const serialized = JSON.stringify(MOCK_BILLING);
      assert.doesNotMatch(serialized, /\d+,\d\d\s?€/, 'MOCK_BILLING must not carry literal prices');
      for (const term of ['yearly', 'monthly', 'lifetime']) {
        for (const receipt of MOCK_BILLING.receipts[term]) {
          assert.match(receipt.priceKey, /^(paywall\.plan|pro\.page\.per)/);
          assert.ok(!Number.isNaN(Date.parse(receipt.paidAt)));
        }
      }
    },
  },
];
