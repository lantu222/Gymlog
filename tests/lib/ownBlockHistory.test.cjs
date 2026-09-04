const assert = require('node:assert/strict');

const {
  OWN_BLOCK_OFFER_AFTER,
  formatLastOwnBlock,
  normalizeOwnBlockStats,
  recordOwnBlock,
  shouldOfferAlwaysOwn,
} = require('../../.test-dist/lib/ownBlockHistory.js');

module.exports = [
  {
    name: 'own-block stats survive whatever an older install stored',
    run() {
      assert.deepEqual(normalizeOwnBlockStats(undefined), {});
      assert.deepEqual(normalizeOwnBlockStats(null), {});
      assert.deepEqual(normalizeOwnBlockStats('4:20'), {});
      // An array is an object; it is still not this.
      assert.deepEqual(normalizeOwnBlockStats([]), {});
      // Junk inside a real shape drops out rather than reaching the screen.
      assert.deepEqual(
        normalizeOwnBlockStats({ warmup: { lastSeconds: 'x', count: -3 }, cooldown: null, legs: { count: 9 } }),
        {},
      );
      assert.deepEqual(normalizeOwnBlockStats({ warmup: { lastSeconds: 260.4, count: 2.2 } }), {
        warmup: { lastSeconds: 260, count: 2 },
      });
    },
  },
  {
    name: 'a recorded block sets the mark and counts, unless it was a mis-tap',
    run() {
      const first = recordOwnBlock({}, 'warmup', 260);
      assert.deepEqual(first, { warmup: { lastSeconds: 260, count: 1 } });
      const second = recordOwnBlock(first, 'warmup', 134);
      assert.deepEqual(second, { warmup: { lastSeconds: 134, count: 2 } });
      // The other phase keeps its own tally.
      const both = recordOwnBlock(second, 'cooldown', 90);
      assert.deepEqual(both.warmup, { lastSeconds: 134, count: 2 });
      assert.deepEqual(both.cooldown, { lastSeconds: 90, count: 1 });
      // Four seconds is a mis-tap, not a warm-up: it neither moves the mark
      // nor earns a step towards the offer.
      assert.deepEqual(recordOwnBlock(second, 'warmup', 4), second);
      assert.deepEqual(recordOwnBlock(second, 'warmup', Number.NaN), second);
      // And the input is not mutated.
      assert.deepEqual(first, { warmup: { lastSeconds: 260, count: 1 } });
    },
  },
  {
    name: 'the standing offer waits for the third, and never comes back once taken',
    run() {
      assert.equal(OWN_BLOCK_OFFER_AFTER, 3);
      assert.equal(shouldOfferAlwaysOwn({}, 'warmup', false), false);
      assert.equal(shouldOfferAlwaysOwn({ warmup: { lastSeconds: 200, count: 2 } }, 'warmup', false), false);
      assert.equal(shouldOfferAlwaysOwn({ warmup: { lastSeconds: 200, count: 3 } }, 'warmup', false), true);
      // Already answered yes: not asked again.
      assert.equal(shouldOfferAlwaysOwn({ warmup: { lastSeconds: 200, count: 9 } }, 'warmup', true), false);
      // The cooldown's own count does not speak for the warm-up.
      assert.equal(shouldOfferAlwaysOwn({ cooldown: { lastSeconds: 200, count: 5 } }, 'warmup', false), false);
    },
  },
  {
    name: 'the last-time line is a clock, and absent before there is one',
    run() {
      assert.equal(formatLastOwnBlock({ warmup: { lastSeconds: 260, count: 1 } }, 'warmup', 'en'), 'Last time you took 4:20');
      assert.equal(formatLastOwnBlock({ warmup: { lastSeconds: 260, count: 1 } }, 'warmup', 'fi'), 'Viime kerralla käytit 4:20');
      // Seconds pad, so 4:05 is never "4:5".
      assert.equal(formatLastOwnBlock({ warmup: { lastSeconds: 245, count: 1 } }, 'warmup', 'en'), 'Last time you took 4:05');
      assert.equal(formatLastOwnBlock({}, 'warmup', 'en'), null);
      assert.equal(formatLastOwnBlock({ cooldown: { lastSeconds: 90, count: 1 } }, 'warmup', 'en'), null);
    },
  },
];
