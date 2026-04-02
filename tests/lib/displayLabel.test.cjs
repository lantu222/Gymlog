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
      const nextName = buildDisplayCopyName('Upper Lower', [
        'Upper Lower Copy',
        'Upper Lower (copy)',
        'Upper Lower (copy 2)',
      ]);

      assert.equal(nextName, 'Upper Lower (copy 3)');
    },
  },
];