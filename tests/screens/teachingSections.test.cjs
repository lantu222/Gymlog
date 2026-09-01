const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  EXERCISE_TEACHING_TABLES,
} = require('../../.test-dist/lib/exerciseTeaching.js');
const {
  normalizeTechniqueChecks,
  normalizeLearnedExerciseIds,
  toggleTechniqueStatement,
  countRemainingStatements,
} = require('../../.test-dist/lib/exerciseLearning.js');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', '..', rel), 'utf8');
const screen = read('src/screens/ExerciseDetailScreen.tsx');
const i18n = read('src/lib/i18n.ts');

/**
 * Every field the teaching table carries reaches the screen.
 *
 * Caught by the PR review on #40: `check` was authored in two languages (24
 * strings), locked in place by a test asserting exactly four per entry, and
 * rendered by nothing. It shipped in the bundle where no reader could ever
 * see it. The suite that asserted its shape did not notice, because shape and
 * reachability are different questions.
 *
 * So this asks the second question, field by field, and it fails when a new
 * one is written without a screen to put it on.
 */
module.exports = [
  {
    name: 'teaching: every authored field is rendered by the exercise screen',
    run() {
      const fields = new Set();
      for (const table of Object.values(EXERCISE_TEACHING_TABLES)) {
        for (const entry of Object.values(table)) {
          Object.keys(entry).forEach((key) => fields.add(key));
        }
      }

      // What this proves and what it does not: a field named here is READ by
      // the screen somewhere. It cannot prove pixels — the per-field cases
      // below do that. It catches the shape the review found, where a field
      // was authored, translated and tested and appeared in no line of the
      // screen at all.
      //
      // Two ways this line was wrong before it was right. It ended in
      // `|caution\b`, an alternation that matched for EVERY field at once and
      // made the test vacuous. And `[.?]` matches one character, so it missed
      // `teaching?.caution`, whose optional chain is two.
      const unrendered = [...fields]
        .filter((field) => !new RegExp(`teaching\\??\\.${field}\\b`).test(screen))
        .sort();

      assert.deepEqual(
        unrendered,
        [],
        `written into exerciseTeaching.ts and read by nothing: ${unrendered.join(', ')}`,
      );
    },
  },
  {
    name: 'teaching: the technique check is a real control with both its strings',
    run() {
      assert.match(screen, /t\(language, 'exDetail\.check'\)/);
      assert.match(screen, /teaching\.check\.map/);
      assert.match(screen, /accessibilityRole="checkbox"/);
      // The counter names what is LEFT, and stops talking once nothing is.
      assert.match(screen, /remainingChecks > 0 \? \(/);
      assert.match(screen, /exDetail\.checkRemaining/);

      for (const key of ['exDetail.check', 'exDetail.checkRemaining', 'exDetail.markLearned', 'exDetail.learned']) {
        assert.equal(i18n.split(`'${key}':`).length - 1, 2, `${key} is missing one of its two languages`);
      }
    },
  },
  {
    /**
     * Learned is a declaration, not a score. Nothing derives it from the
     * check — ticking four boxes is not the same claim as knowing the lift,
     * and computing one from the other would put words in the reader's mouth.
     */
    name: 'teaching: learned is stored on its own, not derived from the check',
    run() {
      assert.doesNotMatch(screen, /remainingChecks === 0 \?\s*true/);
      assert.match(screen, /accessibilityState=\{\{ selected: learned \}\}/);

      const wiring = require('../helpers/appWiringSource.cjs').readAppWiring();
      assert.match(wiring, /learnedExerciseLibraryItemIds:/);
      // The tick rule lives in src/lib, so the wiring delegates rather than
      // rebuilding the map inline — the emptied-lift case is asserted against
      // the function itself below, where it can actually be executed.
      assert.match(wiring, /exerciseTechniqueChecks: toggleTechniqueStatement\(/);
    },
  },
  {
    /**
     * The loader normalises what it reads. A stored index that is negative,
     * fractional or repeated would each draw a wrong "N left" counter — and
     * the counter is the only thing the section says out loud.
     *
     * The rule lives in src/lib rather than in the loader because
     * `storage/database.ts` reaches AsyncStorage, which reaches React Native,
     * which no test in this suite can import. The loader delegates.
     */
    name: 'learning: a corrupt stored value cannot draw a wrong counter',
    run() {
      const checks = normalizeTechniqueChecks({
        good: [2, 0, 0, 1],
        negative: [-1, 1],
        fractional: [1.5, 2],
        notAnArray: 3,
        empty: [],
        '': [1],
      });

      // Duplicates collapsed and sorted, so the same four boxes ticked in a
      // different order compare equal between devices.
      assert.deepEqual(checks.good, [0, 1, 2]);
      assert.deepEqual(checks.negative, [1]);
      assert.deepEqual(checks.fractional, [2]);
      assert.equal(checks.notAnArray, undefined);
      assert.equal(checks.empty, undefined);
      assert.equal(checks[''], undefined);

      assert.deepEqual(normalizeTechniqueChecks(null), {});
      assert.deepEqual(normalizeTechniqueChecks([1, 2]), {});
      assert.deepEqual(normalizeLearnedExerciseIds(['keep', '', '   ', 42, null, 'keep']), ['keep']);
      assert.deepEqual(normalizeLearnedExerciseIds('nope'), []);

      // And the loader must actually call them rather than trusting the blob.
      const loader = read('src/storage/database.ts');
      assert.match(loader, /exerciseTechniqueChecks: normalizeTechniqueChecks\(/);
      assert.match(loader, /learnedExerciseLibraryItemIds: normalizeLearnedExerciseIds\(/);
    },
  },
  {
    name: 'learning: ticking the last box off removes the lift rather than storing none',
    run() {
      const one = toggleTechniqueStatement({}, 'ex', 2);
      assert.deepEqual(one, { ex: [2] });

      const two = toggleTechniqueStatement(one, 'ex', 0);
      assert.deepEqual(two, { ex: [0, 2] });

      const back = toggleTechniqueStatement(toggleTechniqueStatement(two, 'ex', 0), 'ex', 2);
      assert.deepEqual(back, {}, 'an emptied lift leaves no row behind');

      // Other lifts are untouched, and the input is never mutated.
      const seed = { other: [1] };
      const next = toggleTechniqueStatement(seed, 'ex', 0);
      assert.deepEqual(seed, { other: [1] });
      assert.deepEqual(next, { other: [1], ex: [0] });
    },
  },
  {
    name: 'learning: the counter names what is left, and reaches zero',
    run() {
      assert.equal(countRemainingStatements(4, []), 4);
      assert.equal(countRemainingStatements(4, [0, 2]), 2);
      assert.equal(countRemainingStatements(4, [0, 1, 2, 3]), 0);
      assert.equal(countRemainingStatements(4, null), 4);
      // A stored index past the end is not a tick on anything, so it cannot
      // talk the counter below what is really left.
      assert.equal(countRemainingStatements(4, [9, 9, 9, 9]), 4);
    },
  },
];
