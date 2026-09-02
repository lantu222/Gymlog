const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const screenSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'src', 'screens', 'WorkoutCompletionScreen.tsx'),
  'utf8',
);
const appSource = fs.readFileSync(path.join(__dirname, '..', '..', 'App.tsx'), 'utf8');
const i18nSource = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'lib', 'i18n.ts'), 'utf8');

/**
 * The workout-complete hero, in gold. Design: "GAINER Treeni valmis - hero".
 *
 * It was the app's own purple, which is the colour of every other screen — so
 * the one screen that exists to say "you did it" said it in the same voice as a
 * settings row.
 */
module.exports = [
  {
    name: 'completion hero: a record earns gold, a quiet session only borrows it',
    run() {
      // Two strengths of one colour, chosen by whether there is a record. If
      // every workout celebrated equally, the record card under the hero would
      // stop being seen.
      assert.match(screenSource, /function goldHeroFace\(dark: boolean, record: boolean\)/);
      assert.match(screenSource, /goldHeroFace\(themeName === 'dark', pr !== null\)/);
      // The metal sweep is the record's alone.
      assert.match(screenSource, /gold\.sheenPeak > 0 \? \(/);
      // And the quiet seal is a ring with nothing behind it.
      assert.match(screenSource, /sealFill: 'transparent'/);
    },
  },
  {
    name: 'completion hero: all four faces are defined, not derived at render',
    run() {
      // dark+record, dark, light+record, light — each returns its own object,
      // because a gold that reads on cream does not read on near-black.
      const faces = screenSource.split('groundAngle:').length - 1;
      assert.equal(faces, 4, 'expected exactly four hero faces');
    },
  },
  {
    name: 'completion hero: the status bar is no longer forced light',
    run() {
      // A pale gold bar needs dark icons, and the shell already derives that
      // from the theme — so the summary comes off the forced-light list.
      assert.doesNotMatch(appSource, /workoutSummaryActive[\s\S]{0,40}\? 'light'/);
      // The saved-session hero still is, and the Pro page joined it: both are
      // dark surfaces the bar sits directly on. Matched on the list rather
      // than on one exact expression, so adding a screen to it is not a
      // failure — dropping the saved session off it is.
      assert.match(appSource, /historySessionActive \|\| premiumActive[\s\S]{0,30}\? 'light'/);
    },
  },
  {
    name: 'completion hero: the kicker reads in both languages',
    run() {
      for (const key of ['complete.kicker.record', 'complete.kicker.done']) {
        const occurrences = i18nSource.split(`'${key}':`).length - 1;
        assert.equal(occurrences, 2, `${key} is missing one of its two languages`);
      }
      assert.match(screenSource, /pr \? 'complete\.kicker\.record' : 'complete\.kicker\.done'/);
    },
  },
  {
    /**
     * The feel sheet cannot be skipped by missing it.
     *
     * The backdrop called onDone(null) — byte for byte the write Skip makes,
     * with none of the intent behind it. One answer per workout, thrown away
     * by a thumb landing beside the sheet (user 2026-09-01).
     *
     * Two things are pinned. The backdrop must not write, and the refusal must
     * be VISIBLE as well as felt: haptics are a user preference, so a bump
     * alone turns "tap outside closes it" into "tap outside does nothing" for
     * anyone who switched them off, which reads as a frozen screen.
     *
     * Skip stays one tap. Refusing to dismiss is not the same as trapping
     * someone, and the difference is that leaving without answering is now
     * chosen rather than slipped into.
     */
    name: 'complete: a tap beside the feel sheet refuses instead of skipping',
    run() {
      // Exactly one handler still writes the skip, and it is the Skip button.
      // Matched as a HANDLER rather than as the bare call: the comment above
      // the backdrop quotes `onDone(null)` to say what it stopped doing, and
      // a substring count read that as a second caller. A guard that its own
      // explanation can satisfy is the /trending/i shape.
      const skipHandlers = screenSource.match(/onPress=\{\(\) => onDone\(null\)\}/g) ?? [];
      assert.equal(skipHandlers.length, 1, 'the backdrop can throw the answer away again');

      // And that one is the Skip button's, not the backdrop's: it sits after
      // the sheet opens, inside the block styled feelSkip.
      const handlerAt = screenSource.indexOf('onPress={() => onDone(null)}');
      const skipStyleAt = screenSource.indexOf('styles.feelSkip');
      assert.ok(handlerAt > 0 && skipStyleAt > handlerAt, 'the surviving skip is not the Skip button');

      // The backdrop bumps, and moves the sheet so the refusal survives
      // haptics being switched off.
      //
      // Anchored on the feel overlay itself. The first cut sliced from the
      // first `StyleSheet.absoluteFill` in the file to the first
      // `<Animated.View`, which is the hero 340 lines above this sheet — it
      // was reading the wrong region and would have passed on whatever
      // happened to be in it.
      const overlayAt = screenSource.indexOf('styles.feelOverlay');
      const titleAt = screenSource.indexOf('styles.feelTitle', overlayAt);
      assert.ok(overlayAt > 0 && titleAt > overlayAt, 'the feel sheet was restructured — recheck by hand');
      const backdrop = screenSource.slice(overlayAt, titleAt);
      assert.match(backdrop, /haptics\.impactMedium\(\)/, 'the tap outside is silent');
      assert.match(backdrop, /Animated\.sequence\(/, 'nothing moves when haptics are off');

      // And the shake drives its OWN view. A node shared between two views
      // took the app down in 85% of launches once.
      assert.equal((screenSource.match(/feelShake\.interpolate/g) ?? []).length, 1);
      assert.match(screenSource, /const feelShake = useRef\(new Animated\.Value\(0\)\)\.current;/);

      // Skip is still there, still one tap.
      assert.match(i18nSource, /'complete\.feel\.skip':/);
      assert.match(screenSource, /styles\.feelSkip\b/);
    },
  },
];
