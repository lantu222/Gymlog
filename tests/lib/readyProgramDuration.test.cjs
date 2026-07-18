const assert = require('node:assert/strict');

const {
  getReadyProgramBlockWeeks,
  READY_PROGRAM_MIN_BLOCK_WEEKS,
  READY_PROGRAM_MAX_BLOCK_WEEKS,
} = require('../../.test-dist/lib/readyProgramDuration');
const { WORKOUT_TEMPLATES_V1 } = require('../../.test-dist/features/workout/workoutCatalog');
const { READY_PROGRAM_COLLECTIONS } = require('../../.test-dist/lib/readyProgramCollections');

module.exports = [
  {
    name: 'readyProgramDuration: block length follows the tier rule with a bounded override',
    run() {
      assert.equal(getReadyProgramBlockWeeks({ level: 'beginner' }), 4);
      assert.equal(getReadyProgramBlockWeeks({ level: 'intermediate' }), 8);
      assert.equal(getReadyProgramBlockWeeks({ level: 'advanced' }), 12);
      // Override wins inside 4-12; out-of-range overrides fall back to the rule.
      assert.equal(getReadyProgramBlockWeeks({ level: 'beginner', blockLengthWeeks: 6 }), 6);
      assert.equal(getReadyProgramBlockWeeks({ level: 'beginner', blockLengthWeeks: 20 }), 4);
    },
  },
  {
    name: 'readyProgramDuration: every catalog program lands inside the 4-12 week band',
    run() {
      for (const template of WORKOUT_TEMPLATES_V1) {
        const weeks = getReadyProgramBlockWeeks(template);
        assert.ok(
          weeks >= READY_PROGRAM_MIN_BLOCK_WEEKS && weeks <= READY_PROGRAM_MAX_BLOCK_WEEKS,
          `${template.id} block length ${weeks} outside 4-12`,
        );
      }
    },
  },
  {
    name: 'catalog tier coverage: the Pro tier has programs across at least three goal directions',
    run() {
      const proTemplates = WORKOUT_TEMPLATES_V1.filter((template) => template.level === 'advanced');
      assert.ok(proTemplates.length >= 5, `expected >=5 Pro programs, got ${proTemplates.length}`);

      const goalTypes = new Set(proTemplates.map((template) => template.goalType));
      assert.ok(goalTypes.size >= 3, `Pro tier covers only: ${[...goalTypes].join(', ')}`);

      // The new Pro programs are reachable from the catalog collections.
      const collected = new Set(READY_PROGRAM_COLLECTIONS.flatMap((collection) => collection.templateIds));
      for (const id of ['tpl_strong_elite_v1', 'tpl_fit_elite_v1', 'tpl_shred_elite_v1']) {
        assert.ok(collected.has(id), `${id} missing from collections`);
        assert.ok(WORKOUT_TEMPLATES_V1.some((template) => template.id === id), `${id} missing from catalog`);
      }
    },
  },
];
