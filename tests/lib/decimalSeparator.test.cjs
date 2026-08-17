const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  formatVolume,
  formatWeight,
  parseNumberInput,
  removeTrailingZeros,
  setNumberLanguage,
} = require('../../.test-dist/lib/format.js');

const root = path.join(__dirname, '..', '..');

/**
 * The app wrote 92.5 kg in Finnish, on every screen that states a weight.
 * Noticed on the Pro page, but the Pro page was only where it was noticed.
 *
 * The decimal mark is module state, so this is the only suite that moves it
 * during a run — and it puts it back to English when it is done, because that
 * is what every other suite in the runner asserts against. If a suite ever
 * needs Finnish numbers, it has to set them itself for the same reason.
 */
module.exports = [
  {
    name: 'decimal: Finnish writes a comma, English writes a point',
    run() {
      setNumberLanguage('fi');
      assert.equal(removeTrailingZeros(92.5), '92,5');
      assert.equal(formatWeight(92.5), '92,5 kg');
      assert.equal(formatVolume(1730.5), '1730,5 kg');

      setNumberLanguage('en');
      assert.equal(removeTrailingZeros(92.5), '92.5');
      assert.equal(formatWeight(92.5), '92.5 kg');

      // Whole numbers carry no separator either way.
      setNumberLanguage('fi');
      assert.equal(removeTrailingZeros(90), '90');
      setNumberLanguage('en');
      assert.equal(removeTrailingZeros(90), '90');
      // Left in English for the suites that run after this one.
    },
  },
  {
    name: 'decimal: an unknown language falls back to Finnish, not English',
    run() {
      // Forgetting to set it, or setting it to something unsupported, must
      // land on the app's own first language rather than on English.
      setNumberLanguage('sv');
      assert.equal(removeTrailingZeros(92.5), '92,5');
      setNumberLanguage('en');
    },
  },
  {
    name: 'decimal: typing a comma still parses, in either language',
    run() {
      // The input side already normalised commas and must keep doing so —
      // otherwise the display and the keyboard would disagree.
      for (const language of ['fi', 'en']) {
        setNumberLanguage(language);
        assert.equal(parseNumberInput('92,5'), 92.5);
        assert.equal(parseNumberInput('92.5'), 92.5);
      }
      setNumberLanguage('en');
    },
  },
  {
    name: 'decimal: the setting is written, not just declared',
    run() {
      // The whole failure mode of a module setting is that nothing calls the
      // setter and it silently keeps its default forever.
      const app = fs.readFileSync(path.join(root, 'App.tsx'), 'utf8');
      assert.match(app, /setNumberLanguage\(preferences\.appLanguage\)/);
      assert.match(app, /from '\.\/src\/lib\/format'/);
    },
  },
  {
    name: 'decimal: the setting is written during render, not in an effect',
    run() {
      /**
       * Writing it in an effect is a whole render too late.
       *
       * Much of the app's formatted text comes from useMemo blocks in App.tsx.
       * An effect runs after render, so on the render where the language
       * changed every one of those memos recomputed against the *previous*
       * language's separator and then never recomputed again — their dependency
       * on appLanguage had already fired. The Pro hero shipped "92.5 kg" to a
       * Finnish reader that way.
       *
       * It only appears when the device language and the app language differ,
       * which is why a Finnish phone cannot reproduce it and an en-US emulator
       * can. Nothing about that is going to be obvious to whoever tidies this
       * call back into an effect, so the guard says it instead.
       */
      const app = fs.readFileSync(path.join(root, 'App.tsx'), 'utf8');
      // Split on either ending. The repository stores LF, but core.autocrlf is
      // on for Windows checkouts, so the working copy this reads carries CRLF —
      // and a trailing \r made the anchored match below fail on a file nobody
      // had touched.
      const lines = app.split(/\r?\n/);
      const callIndex = lines.findIndex((line) =>
        line.includes('setNumberLanguage(preferences.appLanguage)'),
      );
      assert.ok(callIndex >= 0, 'App must write the number language');

      // A bare statement at the component body's own indentation. Inside any
      // effect, callback or block it would be indented further.
      assert.match(
        lines[callIndex],
        /^ {2}setNumberLanguage\(preferences\.appLanguage\);$/,
        'setNumberLanguage must be a plain render-phase statement in the component body',
      );

      // ...and nothing hook-shaped may sit above it, or a hook that formats a
      // number would run against the stale separator on the first render.
      const before = lines.slice(0, callIndex).join(String.fromCharCode(10));
      assert.doesNotMatch(
        before,
        /\buseMemo\(|\buseEffect\(|\buseScheduledNotifications\(/,
        'setNumberLanguage must come before any hook that could format a number',
      );
    },
  },
  {
    name: 'decimal: the CSV exports keep writing raw numbers',
    run() {
      // A decimal comma inside a comma-separated file is the one way this
      // change could do real damage. The exports must not route weights
      // through the formatter.
      for (const file of ['workoutLogCsvExport.ts', 'programCsvExport.ts']) {
        const source = fs.readFileSync(path.join(root, 'src', 'lib', file), 'utf8');
        assert.doesNotMatch(
          source,
          /removeTrailingZeros|formatWeight\(/,
          `${file} must write raw numbers, not localized ones`,
        );
      }
    },
  },
];
