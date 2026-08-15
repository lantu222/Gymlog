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
