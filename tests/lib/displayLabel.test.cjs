const assert = require('node:assert/strict');

const {
  buildDisplayCopyName,
  formatLiftDisplayLabel,
  formatWorkoutDisplayLabel,
} = require('../../.test-dist/lib/displayLabel.js');

module.exports = [
  {
    name: 'display labels collapse whitespace and preserve readable workout names',
    run() {
      assert.equal(formatWorkoutDisplayLabel('  Upper   Lower  '), 'Upper Lower');
    },
  },
  {
    name: 'display labels fall back for blank or whitespace-only workout names',
    run() {
      assert.equal(formatWorkoutDisplayLabel(''), 'Custom workout');
      assert.equal(formatWorkoutDisplayLabel('   '), 'Custom workout');
    },
  },
  {
    name: 'display labels fall back for broken one-character lift names',
    run() {
      assert.equal(formatLiftDisplayLabel('t'), 'Unnamed lift');
    },
  },
  {
    name: 'display labels normalize legacy copy suffixes',
    run() {
      assert.equal(formatWorkoutDisplayLabel('Bench Day Copy'), 'Bench Day (copy)');
      assert.equal(formatWorkoutDisplayLabel('Bench Day Copy 2'), 'Bench Day (copy 2)');
    },
  },
  {
    name: 'display copy names stay unique across legacy and new suffix formats',
    run() {
      const nextName = buildDisplayCopyName('Upper Lower', 'en', [
        'Upper Lower Copy',
        'Upper Lower (copy)',
        'Upper Lower (copy 2)',
      ]);

      assert.equal(nextName, 'Upper Lower (copy 3)');

      // The suffix is written into the user's own data and never derived
      // again, so it has to be their language at the moment of duplication.
      // It was the English literal 'copy' for every user.
      assert.equal(buildDisplayCopyName('Rintavoima', 'fi', []), 'Rintavoima (kopio)');
      assert.equal(
        buildDisplayCopyName('Rintavoima', 'fi', ['Rintavoima (kopio)']),
        'Rintavoima (kopio 2)',
      );
      // A name stored in the other language still parses, so the two formats
      // cannot collide into a duplicate.
      assert.equal(
        buildDisplayCopyName('Upper Lower', 'fi', ['Upper Lower (copy)', 'Upper Lower (kopio)']),
        'Upper Lower (kopio 2)',
      );
    },
  },
];