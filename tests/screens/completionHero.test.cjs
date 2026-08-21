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
      assert.doesNotMatch(appSource, /workoutSummaryActive \|\| historySessionActive\s*\r?\n?\s*\? 'light'/);
      assert.match(appSource, /historySessionActive \? 'light' : undefined/);
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
];
