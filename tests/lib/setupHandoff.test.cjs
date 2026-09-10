const assert = require('node:assert/strict');

const fs = require('node:fs');
const path = require('node:path');

const {
  countSetupHandoffOffers,
  planSetupHandoff,
  resolveSetupTrackingOffer,
} = require('../../.test-dist/lib/setupHandoff.js');

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
      // Mobility and conditioning are not measured with a tape anywhere in
      // this app. Back WAS in this list until 2026-08-31, when it got its own
      // measurement — it was a focus area onboarding let a reader pick and
      // nothing downstream could act on.
      for (const focus of [['mobility'], ['conditioning'], ['bodyweight'], []]) {
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
      assert.deepEqual(resolveSetupTrackingOffer(['mobility', 'conditioning', 'arms']), { cardKey: 'arms', focus: 'arms' });
      // Back now answers for itself rather than falling through.
      assert.deepEqual(resolveSetupTrackingOffer(['back']), { cardKey: 'back', focus: 'back' });
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
      // Bodyweight is on Home by default, so a reader whose only focus has no
      // tape is offered the widget alone rather than a card they already have.
      // (Back was the example here until it got its own measurement on
      // 2026-08-31 — it now answers for itself.)
      const plan = planSetupHandoff({
        canOfferWidget: true,
        pinnedCardKeys: ['bodyweight'],
        focusAreas: ['mobility'],
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
  {
    name: 'the heading counts the offers actually on the screen',
    run() {
      // Seen on a phone with the widget already placed: "Kaksi asiaa ennen
      // kuin aloitat · Molemmat vievät yhden napautuksen" over one card. The
      // screen picks its heading from this count.
      const cardOnly = planSetupHandoff({ canOfferWidget: false, pinnedCardKeys: ['bodyweight'], focusAreas: ['glutes'] });
      const both = planSetupHandoff({ canOfferWidget: true, pinnedCardKeys: [], focusAreas: ['glutes'] });
      const widgetOnly = planSetupHandoff({ canOfferWidget: true, pinnedCardKeys: ['hips'], focusAreas: ['glutes'] });
      // The bodyweight card joined as a second card (user, 2026-08-19), offered
      // whenever the focus card is not bodyweight and bodyweight is not pinned.
      assert.equal(countSetupHandoffOffers(cardOnly), 1);   // bodyweight pinned, so only the focus card
      assert.equal(countSetupHandoffOffers(widgetOnly), 2); // widget + bodyweight
      assert.equal(countSetupHandoffOffers(both), 3);       // widget + focus card + bodyweight
      assert.equal(both.offerBodyweight, true);
      assert.equal(cardOnly.offerBodyweight, false);
      // And the copy exists in both languages for the single case.
      const i18n = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'lib', 'i18n.ts'), 'utf8');
      assert.match(i18n, /'handoff\.titleOne': 'One more thing'/);
      assert.match(i18n, /'handoff\.titleOne': 'Yksi asia vielä'/);
    },
  },
  {
    name: 'the sign-in card is an offer beside the door, never in it',
    run() {
      // Decision 2026-08-22: real Google sign-in, offered on the hand-off
      // screen for free and Pro alike — and only when this build can actually
      // sign someone in. A build without the OAuth client shows nothing.
      const offered = planSetupHandoff({
        canOfferWidget: false,
        pinnedCardKeys: ['bodyweight', 'hips'],
        focusAreas: ['glutes'],
        canOfferAccountBackup: true,
      });
      assert.equal(offered.offerAccountBackup, true);
      // Even when every other offer is exhausted, the sign-in card alone
      // keeps the step alive...
      assert.equal(offered.shouldShow, true);
      assert.equal(countSetupHandoffOffers(offered), 1);

      // ...and without it, the same exhausted plan hides the step entirely —
      // a signed-in reader re-running onboarding sees no dead card.
      const hidden = planSetupHandoff({
        canOfferWidget: false,
        pinnedCardKeys: ['bodyweight', 'hips'],
        focusAreas: ['glutes'],
        canOfferAccountBackup: false,
      });
      assert.equal(hidden.offerAccountBackup, false);
      assert.equal(hidden.shouldShow, false);

      // "Beside the door, never in it" is a fact about the SWITCH, not about
      // a word in the sentence.
      //
      // This used to assert that the copy contained "Optional" /
      // "Vapaaehtoinen". That pinned one wording of the principle rather than
      // the principle, and it went red on 2026-08-31 for a copy pass that did
      // not weaken the offer at all. What actually keeps sign-in optional is
      // that the toggle starts OFF, so pressing Done without touching it is a
      // complete answer — a string cannot promise that and this can.
      const screen = fs.readFileSync(
        path.join(__dirname, '..', '..', 'src', 'screens', 'SetupHandoffScreen.tsx'),
        'utf8',
      );
      assert.match(screen, /const \[signInForBackup, setSignInForBackup\] = useState\(false\)/);
      assert.match(screen, /signInForBackup: plan\.offerAccountBackup && signInForBackup/);
      // And no separate "not now": Done with everything off already is one.
      assert.doesNotMatch(screen, /handoff\.notNow|handoff\.skip/);
    },
  },
  {
    /**
     * The last screen of onboarding ends on the same button as the five before
     * it, clear of the gesture bar.
     *
     * It was the A3 cut button at 50dp — a cut corner and a diagonal sheen
     * where every other footer in the flow is a plain rounded rectangle at
     * 56–62dp — and its clearance was a bare `insets.bottom`, which on this
     * screen comes back 0. Measured on the emulator (2026-09-08): the button
     * ended at y=2368 of 2400 with 31px under it, and the gesture pill is drawn
     * at y=2364..2372 — on the button's bottom edge. It has 164px now.
     */
    name: 'the handoff footer clears the gesture bar and wears the same button as the rest of the flow',
    run() {
      const screen = fs.readFileSync(
        path.join(__dirname, '..', '..', 'src', 'screens', 'SetupHandoffScreen.tsx'),
        'utf8',
      );

      // A floor under the inset, not the inset alone: an inset that can be
      // zero is not a clearance.
      assert.match(screen, /paddingBottom: Math\.max\(insets\.bottom, GESTURE_BAR_FLOOR\) \+ spacing\.md/);
      assert.match(screen, /const GESTURE_BAR_FLOOR = 24;/);
      assert.doesNotMatch(
        screen,
        /paddingBottom: insets\.bottom \+ spacing/,
        'the bare inset is back, and on this screen it is 0',
      );

      // The shape the rest of the flow ends on: OnboardingScreen's primary
      // button is minHeight 62 / radius 18, StartPathScreen's is height 56 /
      // radius 18. The cut button is neither.
      assert.match(screen, /done: \{\s*\r?\n\s*minHeight: 62,\s*\r?\n\s*borderRadius: 18,/);
      assert.doesNotMatch(screen, /CutButton/, 'the A3 cut button is back on the last onboarding screen');

      // Filled with the action accent, so the ink is the token written for it.
      //
      // Scoped to the button's own block. Unscoped, this matched the check
      // circle's fill further down the same file — so it passed on the source
      // it was written to guard, and would have kept passing if the button
      // went back to violet (review, #78).
      assert.match(screen, /done: \{[^}]*backgroundColor: theme\.accent,/);
      assert.match(screen, /doneText: \{\s*\r?\n\s*color: theme\.onHighlight,/);
    },
  },
  {
    name: 'the Pro row is offered to everyone who has not bought it, and to nobody who has',
    run() {
      const base = {
        canOfferWidget: false,
        pinnedCardKeys: ['bodyweight', 'chest'],
        focusAreas: ['chest'],
        canOfferAccountBackup: false,
      };

      // Nothing else to offer, and Pro alone is enough to show the step: it is
      // the last screen before the app, which is where the page belongs.
      const withPro = planSetupHandoff({ ...base, canOfferPro: true });
      assert.equal(withPro.offerPro, true);
      assert.equal(withPro.shouldShow, true);
      assert.equal(countSetupHandoffOffers(withPro), 1);

      // A reader who already bought it is not sold it again, and with nothing
      // else left the step does not appear at all.
      const bought = planSetupHandoff({ ...base, canOfferPro: false });
      assert.equal(bought.offerPro, false);
      assert.equal(bought.shouldShow, false);
      assert.equal(countSetupHandoffOffers(bought), 0);

      // Same three-valued trap the account offer had: an older stored call
      // carries no field, and `undefined` must not leak into shouldShow.
      const older = planSetupHandoff(base);
      assert.equal(older.offerPro, false);
      assert.equal(older.shouldShow, false);

      // And it counts alongside the others rather than replacing one.
      const everything = planSetupHandoff({
        canOfferWidget: true,
        pinnedCardKeys: [],
        focusAreas: ['chest'],
        canOfferAccountBackup: true,
        canOfferPro: true,
      });
      // Widget, the focus card, bodyweight, the account and Pro: five, not four.
      assert.equal(countSetupHandoffOffers(everything), 5);
    },
  },
];
