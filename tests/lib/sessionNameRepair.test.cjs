const assert = require('node:assert/strict');

const { repairTruncatedSessionName } = require('../../.test-dist/lib/sessionNameRepair.js');

module.exports = [
  {
    name: 'a session name saved with its ellipsis is completed from the catalog',
    run() {
      // The two names from the user's own phone (2026-08-25): a composed
      // programme SAVED its days already clipped, and every display-side fix
      // bounced off the stored string.
      assert.equal(repairTruncatedSessionName('Day 1: Full Body + H...'), 'Day 1: Full Body + HIIT');
      assert.equal(repairTruncatedSessionName('Day 2: Full Body + C...'), 'Day 2: Full Body + Circuit');

      // Finnish-saved custom programmes complete through the localizer.
      assert.equal(repairTruncatedSessionName('Päivä 1: Koko keho + H...'), 'Päivä 1: Koko keho + HIIT');

      // The unicode ellipsis is the same wound with one character — and so is
      // the two-dot form, which the first version of this repair missed on
      // the very phone it was written for.
      assert.equal(repairTruncatedSessionName('Day 1: Full Body + H…'), 'Day 1: Full Body + HIIT');
      assert.equal(repairTruncatedSessionName('Day 1: Full Body + H..'), 'Day 1: Full Body + HIIT');
      assert.equal(repairTruncatedSessionName('Päivä 2: Koko keho + C..'), 'Päivä 2: Koko keho + Circuit');
      assert.equal(repairTruncatedSessionName('Day 1: Full Body + H ...'), 'Day 1: Full Body + HIIT');

      // No day prefix still completes — the stem is the key, not the frame.
      assert.equal(repairTruncatedSessionName('Full Body + Interv...'), 'Full Body + Intervals');
    },
  },
  {
    name: 'only an unambiguous completion is applied',
    run() {
      // "Full Body + ..." matches HIIT, Circuit and Intervals at once: three
      // completions is zero completions, and the honest ellipsis stays.
      assert.equal(repairTruncatedSessionName('Day 1: Full Body + ...'), 'Day 1: Full Body + ...');

      // A stem no catalog name starts with keeps its dots too — completing it
      // would invent a name, which is the plan-composer bug class this repo
      // already guards against.
      assert.equal(repairTruncatedSessionName('Day 1: Zebra Yoga...'), 'Day 1: Zebra Yoga...');

      // Nothing but dots, or no dots at all: untouched.
      assert.equal(repairTruncatedSessionName('Day 3: ...'), 'Day 3: ...');
      assert.equal(repairTruncatedSessionName('Day 1: Full Body + HIIT'), 'Day 1: Full Body + HIIT');
      assert.equal(repairTruncatedSessionName('Oma treeni'), 'Oma treeni');
    },
  },
];
