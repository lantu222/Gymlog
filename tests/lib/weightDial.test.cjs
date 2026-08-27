const assert = require('node:assert/strict');

const {
  commitDialWeight,
  stepDialWeight,
  WEIGHT_DIAL_MAX_KG,
  WEIGHT_DIAL_STEP_KG,
} = require('../../.test-dist/lib/weightDial');
const { readAppWiring } = require('../helpers/appWiringSource.cjs');

module.exports = [
  {
    /**
     * The complaint itself. 12 is not on the 1,25 grid and never will be, so
     * the only answer is being able to write it.
     */
    name: 'exactly 12 kg can be typed, though it is not on the step grid',
    run() {
      let kg = 0;
      for (let i = 0; i < 40; i += 1) {
        kg = stepDialWeight(kg, 1);
        assert.notEqual(kg, 12, 'stepping should never land on 12 — that is the bug');
      }
      assert.equal(commitDialWeight('12', 10), 12);
    },
  },
  {
    name: 'a held button stops at the ceiling instead of running to 5000',
    run() {
      let kg = 495;
      for (let i = 0; i < 100; i += 1) {
        kg = stepDialWeight(kg, 1);
      }
      assert.equal(kg, WEIGHT_DIAL_MAX_KG);
      // And the ceiling is above any lift a reader could actually do.
      assert.ok(WEIGHT_DIAL_MAX_KG >= 500);
    },
  },
  {
    name: 'the dial never goes below zero',
    run() {
      let kg = 2;
      for (let i = 0; i < 10; i += 1) {
        kg = stepDialWeight(kg, -1);
      }
      assert.equal(kg, 0);
    },
  },
  {
    name: 'the step stays on two decimals rather than rounding itself away',
    run() {
      assert.equal(WEIGHT_DIAL_STEP_KG, 1.25);
      assert.equal(stepDialWeight(60, 1), 61.25);
      assert.equal(stepDialWeight(61.25, 1), 62.5);
    },
  },
  {
    /** Finnish writes 92,5. The app's first language cannot be the one that fails. */
    name: 'a typed weight takes the Finnish comma as well as the dot',
    run() {
      assert.equal(commitDialWeight('92,5', 0), 92.5);
      assert.equal(commitDialWeight('92.5', 0), 92.5);
    },
  },
  {
    name: 'typed nonsense keeps the number that was there, and a typo is clamped',
    run() {
      // Mid-edit with the field emptied: the number being adjusted survives.
      assert.equal(commitDialWeight('', 82.5), 82.5);
      assert.equal(commitDialWeight('kg', 82.5), 82.5);
      assert.equal(commitDialWeight('-5', 82.5), 0);
      assert.equal(commitDialWeight('5000', 82.5), WEIGHT_DIAL_MAX_KG);
    },
  },
  {
    /**
     * The card drew a pencil and told a screen reader "tap to edit" while
     * tapping opened two buttons. This pins the promise to a handler.
     */
    name: 'the weight card is wired to both stepping and typing',
    run() {
      const fs = require('node:fs');
      const path = require('node:path');
      const screen = fs.readFileSync(
        path.join(__dirname, '../../src/screens/GuidedPlayerScreen.tsx'),
        'utf8',
      );
      assert.match(screen, /onStep=\{\(direction\) => setKg\(\(current\) => stepDialWeight\(current, direction\)\)\}/);
      assert.match(screen, /onCommit=\{\(text\) => setKg\(\(current\) => commitDialWeight\(text, current\)\)\}/);
      // The old unbounded arithmetic must not come back.
      assert.doesNotMatch(screen, /setKg\(\(current\) => Math\.max\(0, Number\(\(current \+ direction/);
      // And the wiring lives on a screen, not in the shell — this only checks
      // the shell has not grown its own copy of the rule.
      assert.doesNotMatch(readAppWiring(), /current \+ direction \* 1\.25/);
    },
  },
];
