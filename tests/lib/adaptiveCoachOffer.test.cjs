const assert = require('node:assert/strict');

const { resolveAdaptiveCoachOffer } = require('../../.test-dist/lib/adaptiveCoach');

module.exports = [
  {
    name: 'adaptiveCoachOffer: automated progression OFF silences coach and upsell',
    run() {
      assert.deepEqual(resolveAdaptiveCoachOffer({ automatedProgressionEnabled: false, premiumUnlocked: true }), {
        offer: false,
        showLockedUpsell: false,
      });
      assert.deepEqual(resolveAdaptiveCoachOffer({ automatedProgressionEnabled: false, premiumUnlocked: false }), {
        offer: false,
        showLockedUpsell: false,
      });
    },
  },
  {
    name: 'adaptiveCoachOffer: ON keeps the premium gate as before',
    run() {
      assert.deepEqual(resolveAdaptiveCoachOffer({ automatedProgressionEnabled: true, premiumUnlocked: true }), {
        offer: true,
        showLockedUpsell: false,
      });
      assert.deepEqual(resolveAdaptiveCoachOffer({ automatedProgressionEnabled: true, premiumUnlocked: false }), {
        offer: false,
        showLockedUpsell: true,
      });
    },
  },
];
