const assert = require('node:assert/strict');

const {
  buildSupersetRuns,
  isSupersetLinked,
  normalizeSupersetGroups,
  setSupersetLink,
  supersetPositions,
  supersetRoundOrder,
} = require('../../.test-dist/lib/supersetGrouping');

/** Deterministic ids, so a test can say which group a row ended up in. */
function idFactory(prefix = 'g') {
  let next = 0;
  return () => {
    next += 1;
    return `${prefix}${next}`;
  };
}

function rows(...groups) {
  return groups.map((supersetGroup, index) => ({ id: `e${index + 1}`, supersetGroup }));
}

function groupsOf(list) {
  return list.map((row) => row.supersetGroup ?? null);
}

module.exports = [
  {
    name: 'adjacent rows sharing an id are one run; everything else stands alone',
    run() {
      const runs = buildSupersetRuns(rows(null, 'a', 'a', null));
      assert.deepEqual(
        runs.map((run) => [run.groupId, run.indexes]),
        [
          [null, [0]],
          ['a', [1, 2]],
          [null, [3]],
        ],
      );
    },
  },
  {
    name: 'every member appears in exactly one run, in order',
    run() {
      const list = rows('a', 'a', 'b', 'b', null);
      const seen = buildSupersetRuns(list).flatMap((run) => run.indexes);
      assert.deepEqual(seen, [0, 1, 2, 3, 4]);
    },
  },
  {
    name: 'a group id left on a single row is dropped',
    run() {
      // What a remove or a reorder leaves behind: A1 with no A2 under it.
      const normalized = normalizeSupersetGroups(rows('a', null, 'a'), idFactory());
      assert.deepEqual(groupsOf(normalized), [null, null, null]);
    },
  },
  {
    name: 'one id on two separated runs becomes two groups',
    run() {
      const normalized = normalizeSupersetGroups(rows('a', 'a', null, 'a', 'a'), idFactory());
      assert.deepEqual(groupsOf(normalized), ['a', 'a', null, 'g1', 'g1']);
    },
  },
  {
    name: 'normalizing a list that needs nothing returns the same array',
    run() {
      // The caller uses identity as "did anything move" — a fresh array on
      // every load would mark the stored database dirty on every open.
      const list = rows(null, 'a', 'a');
      assert.equal(normalizeSupersetGroups(list, idFactory()), list);
    },
  },
  {
    name: 'a row keeps no pairing when the stored value is blank',
    run() {
      const normalized = normalizeSupersetGroups(rows('   ', '   '), idFactory());
      assert.deepEqual(groupsOf(normalized), [null, null]);
    },
  },
  {
    name: 'badges count supersets, not rows',
    run() {
      // squat · bench+row · deadlift · curl+pushdown
      const positions = supersetPositions(rows(null, 'a', 'a', null, 'b', 'b'));
      assert.deepEqual(
        positions.map((position) => position.label),
        [null, 'A1', 'A2', null, 'B1', 'B2'],
      );
      assert.deepEqual(
        positions.map((position) => position.hasNextInGroup),
        [false, true, false, false, true, false],
      );
      assert.deepEqual(
        positions.map((position) => position.size),
        [1, 2, 2, 1, 2, 2],
      );
    },
  },
  {
    name: 'a group of three is labelled A1 A2 A3',
    run() {
      const positions = supersetPositions(rows('a', 'a', 'a'));
      assert.deepEqual(
        positions.map((position) => position.label),
        ['A1', 'A2', 'A3'],
      );
    },
  },
  {
    name: 'badges run past Z rather than off the end of the alphabet',
    run() {
      const list = [];
      for (let group = 0; group < 27; group += 1) {
        list.push({ supersetGroup: `g${group}` }, { supersetGroup: `g${group}` });
      }
      const positions = supersetPositions(list);
      assert.equal(positions[0].letter, 'A');
      assert.equal(positions[50].letter, 'Z');
      assert.equal(positions[52].letter, 'AA');
    },
  },
  {
    name: 'linking two loose rows makes a pair',
    run() {
      const linked = setSupersetLink(rows(null, null, null), 0, true, idFactory());
      assert.deepEqual(groupsOf(linked), ['g1', 'g1', null]);
      assert.equal(isSupersetLinked(linked, 0), true);
      assert.equal(isSupersetLinked(linked, 1), false);
    },
  },
  {
    name: 'linking a pair to the row below makes a group of three, not a second pair',
    run() {
      const linked = setSupersetLink(rows('a', 'a', null), 1, true, idFactory());
      assert.deepEqual(groupsOf(linked), ['a', 'a', 'a']);
    },
  },
  {
    name: 'linking two existing pairs joins them into one group',
    run() {
      const linked = setSupersetLink(rows('a', 'a', 'b', 'b'), 1, true, idFactory());
      assert.deepEqual(groupsOf(linked), ['a', 'a', 'a', 'a']);
    },
  },
  {
    name: 'unlinking a pair leaves two loose rows',
    run() {
      const unlinked = setSupersetLink(rows('a', 'a'), 0, false, idFactory());
      assert.deepEqual(groupsOf(unlinked), [null, null]);
    },
  },
  {
    name: 'unlinking the middle of a group of three keeps the remaining pair together',
    run() {
      const unlinked = setSupersetLink(rows('a', 'a', 'a'), 0, false, idFactory());
      assert.deepEqual(groupsOf(unlinked), [null, 'g1', 'g1']);
      assert.equal(isSupersetLinked(unlinked, 1), true);
    },
  },
  {
    name: 'a link that is already in the asked-for state changes nothing',
    run() {
      const list = rows('a', 'a', null);
      assert.equal(setSupersetLink(list, 0, true, idFactory()), list);
      assert.equal(setSupersetLink(list, 1, false, idFactory()), list);
    },
  },
  {
    name: 'the last row has no row below it to link to',
    run() {
      const list = rows(null, null);
      assert.equal(setSupersetLink(list, 1, true, idFactory()), list);
      assert.equal(isSupersetLinked(list, 1), false);
    },
  },
  {
    name: 'a superset is performed one set of each lift at a time',
    run() {
      assert.deepEqual(
        supersetRoundOrder([3, 3]).map((step) => `${step.memberIndex}:${step.setIndex}`),
        ['0:0', '1:0', '0:1', '1:1', '0:2', '1:2'],
      );
    },
  },
  {
    name: 'the longer lift of a mismatched pair finishes alone',
    run() {
      assert.deepEqual(
        supersetRoundOrder([3, 2]).map((step) => `${step.memberIndex}:${step.setIndex}`),
        ['0:0', '1:0', '0:1', '1:1', '0:2'],
      );
    },
  },
];
