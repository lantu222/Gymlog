const assert = require('node:assert/strict');

const { renamePlansForTemplate, plansChanged } = require('../../.test-dist/lib/programRename.js');

const plan = (id, name, templateIds) => ({
  id,
  name,
  mode: 'program',
  entries: templateIds.map((templateId, index) => ({
    id: `${id}_e${index}`,
    workoutTemplateId: templateId,
    orderIndex: index,
  })),
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
});

const NOW = '2026-09-08T20:00:00.000Z';

/**
 * A plan carries its own copy of the programme's name, taken when it was made,
 * and Home reads that copy before the template's. So renaming the template on
 * its own page changed that page and left Home on the old name (user
 * 2026-09-08). These are the rules that keep the two in step.
 */
module.exports = [
  {
    name: 'renaming a programme renames every plan built on it',
    run() {
      const before = [plan('p1', 'Advanced Glutes (kopio 2)', ['t1']), plan('p2', 'Upper Lower', ['t2'])];
      const after = renamePlansForTemplate(before, 't1', 'Pakarat', NOW);

      assert.equal(after[0].name, 'Pakarat');
      assert.equal(after[0].updatedAt, NOW, 'the plan changed, so it is dated');
      // Somebody else's plan is not touched, not even its identity.
      assert.equal(after[1], before[1]);
      assert.equal(after[1].name, 'Upper Lower');
    },
  },
  {
    name: 'a plan matches on any of its entries, not just the first',
    run() {
      const before = [plan('p1', 'Mixed', ['tA', 'tB', 'tC'])];
      assert.equal(renamePlansForTemplate(before, 'tC', 'Renamed', NOW)[0].name, 'Renamed');
      assert.equal(renamePlansForTemplate(before, 'tZ', 'Renamed', NOW)[0], before[0], 'no entry, no rename');
    },
  },
  {
    name: 'a name that did not change is not a write',
    run() {
      const before = [plan('p1', 'Pakarat', ['t1'])];
      const after = renamePlansForTemplate(before, 't1', 'Pakarat', NOW);
      assert.equal(after[0], before[0], 'same object back — nothing to commit');
      assert.equal(plansChanged(before, after), false);
    },
  },
  {
    name: 'plansChanged reports whether anything moved',
    run() {
      const before = [plan('p1', 'Old', ['t1']), plan('p2', 'Other', ['t2'])];
      assert.equal(plansChanged(before, renamePlansForTemplate(before, 't1', 'New', NOW)), true);
      assert.equal(plansChanged(before, renamePlansForTemplate(before, 'nope', 'New', NOW)), false);
      assert.equal(plansChanged([], []), false, 'no plans at all is not a change');
    },
  },
];
