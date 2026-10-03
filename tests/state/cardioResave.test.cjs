const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const { findSavedCardioRun } = require('../../.test-dist/lib/cardio.js');

const ROOT = path.join(__dirname, '..', '..');

/**
 * A cardio run is saved once (bug hunt 2026-10-03).
 *
 * CardioScreen's Complete saves, and only then clears the live run, with a bundle write nobody
 * awaits. When that write is lost the run comes back on the next launch, and Complete saved it
 * again under a fresh id: one run, two History rows, double in every total. A run is named by when
 * it started and what it was, so a second save of the same one is the first landing again.
 */

/** saveCardioSession as written in AppProvider, run against a fake store (the same lift the lifecycle invariant makes). */
function liftSaveCardioSession() {
  const source = fs.readFileSync(path.join(ROOT, 'src', 'state', 'AppProvider.tsx'), 'utf8').replace(/\r\n/g, '\n');
  const start = source.indexOf('  function saveCardioSession(input: {');
  assert.ok(start >= 0, 'saveCardioSession moved');
  const end = source.indexOf('\n  }\n', start) + 5;
  const wrapped = [
    'function __part(__scope) {',
    '  const { databaseRef, runExclusive, commit, createId, findSavedCardioRun } = __scope;',
    source.slice(start, end),
    '  return saveCardioSession;',
    '}',
  ].join('\n');
  const js = ts.transpileModule(wrapped, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None } }).outputText;
  return new Function(`'use strict';\n${js}\nreturn __part;`)();
}

function fakeStore(initial = []) {
  let counter = 0;
  const store = {
    commits: 0,
    databaseRef: { current: { cardioSessions: initial } },
    runExclusive: (task) => task(),
    commit: async (next) => {
      store.commits += 1;
      store.databaseRef.current = next;
    },
    createId: (prefix) => `${prefix}_${(counter += 1)}`,
    findSavedCardioRun,
  };
  store.save = liftSaveCardioSession()(store);
  return store;
}

const RUN = { activityType: 'run', startedAt: '2026-10-03T08:00:00.000Z', endedAt: '2026-10-03T08:32:00.000Z', durationSec: 1920, distanceKm: 5.2, feel: null };

module.exports = [
  {
    name: 'cardio: findSavedCardioRun names a run by when it started and what it was',
    run() {
      const stored = [{ id: 'c1', activityType: 'run', startedAt: '2026-10-03T08:00:00.000Z' }];
      assert.equal(findSavedCardioRun(stored, { activityType: 'run', startedAt: '2026-10-03T08:00:00.000Z' }), stored[0]);
      assert.equal(findSavedCardioRun(stored, { activityType: 'walk', startedAt: '2026-10-03T08:00:00.000Z' }), null, 'another activity is another run');
      assert.equal(findSavedCardioRun(stored, { activityType: 'run', startedAt: '2026-10-03T08:00:00.001Z' }), null, 'a different start is a new run');
      assert.equal(findSavedCardioRun([], RUN), null);
    },
  },
  {
    name: 'cardio: a run whose clear was lost is not saved a second time on relaunch, and a genuinely new run is',
    async run() {
      const store = fakeStore();
      const first = await store.save(RUN);
      assert.equal(store.databaseRef.current.cardioSessions.length, 1);
      assert.equal(store.commits, 1);

      // The live run came back after a kill and the reader pressed Complete again.
      const again = await store.save({ ...RUN, durationSec: 1925 });
      assert.equal(again.id, first.id, 'the stored run is handed back');
      assert.equal(store.databaseRef.current.cardioSessions.length, 1, 'one run, one row');
      assert.equal(store.commits, 1, 'nothing was written');

      // Different runs still save: another start, and another activity at the same instant.
      await store.save({ ...RUN, startedAt: '2026-10-04T08:00:00.000Z' });
      await store.save({ ...RUN, activityType: 'walk' });
      assert.equal(store.databaseRef.current.cardioSessions.length, 3);
      assert.equal(store.commits, 3);
    },
  },
];
