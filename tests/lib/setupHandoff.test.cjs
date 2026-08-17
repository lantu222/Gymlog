const assert = require('node:assert/strict');

const fs = require('node:fs');
const path = require('node:path');

const { planSetupHandoff, resolveSetupTrackingOffer } = require('../../.test-dist/lib/setupHandoff.js');

module.exports = [
  {
    name: 'setupHandoff: a focus area maps to the tape that actually measures it',
    run() {
      // Twelve focus areas, seven tape measurements. Glutes are measured at the
      // hips and hamstrings at the thigh, so this is a mapping and not a rename.
      assert.deepEqual(resolveSetupTrackingOffer(['glutes']), { cardKey: 'hips', focus: 'glutes' });
      assert.deepEqual(resolveSetupTrackingOffer(['hamstrings']), { cardKey: 'thighs', focus: 'hamstrings' });
      assert.deepEqual(resolveSetupTrackingOffer(['quads']), { cardKey: 'thighs', focus: 'quads' });
      assert.deepEqual(resolveSetupTrackingOffer(['core']), { cardKey: 'waist', focus: 'core' });
      assert.deepEqual(resolveSetupTrackingOffer(['chest']), { cardKey: 'chest', focus: 'chest' });
    },
  },
  {
    name: 'setupHandoff: an area with no tape falls back to the one number everyone has',
    run() {
      // Back and mobility are not measured with a tape anywhere in this app.
      for (const focus of [['back'], ['mobility'], ['bodyweight'], []]) {
        assert.deepEqual(
          resolveSetupTrackingOffer(focus),
          { cardKey: 'bodyweight', focus: null },
          JSON.stringify(focus),
        );
      }
    },
  },
  {
    name: 'setupHandoff: several focus areas still produce one offer',
    run() {
      // Onboarding allows several. Three cards at the door is a form, not an
      // offer, so the first area with a measurement wins.
      assert.deepEqual(resolveSetupTrackingOffer(['glutes', 'chest', 'arms']), { cardKey: 'hips', focus: 'glutes' });
      // ...and an unmeasurable area does not block the ones behind it.
      assert.deepEqual(resolveSetupTrackingOffer(['back', 'mobility', 'arms']), { cardKey: 'arms', focus: 'arms' });
    },
  },
  {
    name: 'setupHandoff: the step does not appear when it has nothing to offer',
    run() {
      // What happens to a reader who runs onboarding again: the widget is
      // already placed and the card is already on Home. One more tap between
      // the questions and the app, for nothing.
      const plan = planSetupHandoff({
        canOfferWidget: false,
        pinnedCardKeys: ['bodyweight', 'hips'],
        focusAreas: ['glutes'],
      });
      assert.equal(plan.shouldShow, false);
      assert.equal(plan.tracking, null);
      assert.equal(plan.offerWidget, false);
    },
  },
  {
    name: 'setupHandoff: an already-pinned card is not offered twice',
    run() {
      // Bodyweight is on Home by default, so a reader who said "back" is offered
      // the widget alone rather than a card they already have.
      const plan = planSetupHandoff({
        canOfferWidget: true,
        pinnedCardKeys: ['bodyweight'],
        focusAreas: ['back'],
      });
      assert.equal(plan.shouldShow, true);
      assert.equal(plan.offerWidget, true);
      assert.equal(plan.tracking, null);
    },
  },
  {
    name: 'setupHandoff: an install that predates the flag is not ambushed by the step',
    run() {
      // The flag defaults to false, and a stored install has no value for it. On
      // the next launch that reads as "never handed off" and an old install with
      // months of history would meet a first-run step before its own Home.
      const source = fs.readFileSync(
        path.join(__dirname, '..', '..', 'src', 'storage', 'database.ts'),
        'utf8',
      );
      const block = source.slice(source.indexOf('setupHandoffCompleted:'));
      assert.match(
        block.slice(0, 400),
        /onboardingCompleted === true/,
        'a missing setupHandoffCompleted must fall back to onboardingCompleted, not to false',
      );
    },
  },
  {
    name: 'setupHandoff: the widget alone, or the card alone, is enough to show it',
    run() {
      const cardOnly = planSetupHandoff({
        canOfferWidget: false,
        pinnedCardKeys: ['bodyweight'],
        focusAreas: ['glutes'],
      });
      assert.equal(cardOnly.shouldShow, true);
      assert.deepEqual(cardOnly.tracking, { cardKey: 'hips', focus: 'glutes' });

      const both = planSetupHandoff({
        canOfferWidget: true,
        pinnedCardKeys: [],
        focusAreas: ['glutes'],
      });
      assert.equal(both.shouldShow, true);
      assert.equal(both.offerWidget, true);
      assert.deepEqual(both.tracking, { cardKey: 'hips', focus: 'glutes' });
    },
  },
];
