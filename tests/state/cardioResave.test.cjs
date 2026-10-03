const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const { findSavedCardioRun, mergeContinuedCardioRun } = require('../../.test-dist/lib/cardio.js');

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
    '  const { databaseRef, runExclusive, commit, createId, findSavedCardioRun, mergeContinuedCardioRun } = __scope;',
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
    mergeContinuedCardioRun,
  };
  store.save = liftSaveCardioSession()(store);
  return store;
}

const RUN = { activityType: 'run', startedAt: '2026-10-03T08:00:00.000Z', endedAt: '2026-10-03T08:32:00.000Z', durationSec: 1920, distanceKm: 5.2, feel: null };

module.exports = [
  {
    name: 'cardio: a Complete of a run that is already stored is not counted as a second finished workout',
    run() {
      const screens = fs.readFileSync(path.join(ROOT, 'src', 'app', 'renderHomeScreens.tsx'), 'utf8').replace(/\r\n/g, '\n');
      const handler = screens.slice(screens.indexOf('onSaveCardioSession={async (input) => {'), screens.indexOf('onLeave={() => navigateBack(ROOT_ROUTES.home)}'));
      const check = handler.indexOf('findSavedCardioRun(cardioSessions, input) !== null');
      const saved = handler.indexOf('await saveCardioSession(input)');
      assert.ok(check > 0 && check < saved, 'asked before the save, which would store it');
      assert.match(handler, /if \(!alreadyStored\) \{\s*trackEvent\('workout_completed'\);\s*\}/);
    },
  },
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
    name: 'cardio: a run continued after a relaunch extends its stored row under the same id, and never shortens it',
    async run() {
      const store = fakeStore();
      const first = await store.save({ ...RUN, distanceKm: 5.2, feel: 'good' });
      // Complete landed, its clear was lost, the run came back paused; the reader ran 20 more minutes.
      const extended = await store.save({ ...RUN, endedAt: '2026-10-03T08:52:00.000Z', durationSec: 3120, distanceKm: 8.4, feel: 'hard' });
      const rows = store.databaseRef.current.cardioSessions;
      assert.equal(rows.length, 1, 'one run, one row');
      assert.equal(extended.id, first.id, 'under its own id');
      assert.equal(rows[0].id, first.id);
      assert.equal(rows[0].durationSec, 3120, 'the extra time is kept');
      assert.equal(rows[0].performedAt, '2026-10-03T08:52:00.000Z');
      assert.equal(rows[0].distanceKm, 8.4);
      assert.equal(rows[0].feel, 'hard');
      assert.equal(rows[0].startedAt, first.startedAt);
      assert.equal(store.commits, 2);

      // The longer finish with no distance or feel entered keeps the ones stored.
      await store.save({ ...RUN, endedAt: '2026-10-03T09:00:00.000Z', durationSec: 3600, distanceKm: null, feel: null });
      assert.equal(store.databaseRef.current.cardioSessions[0].durationSec, 3600);
      assert.equal(store.databaseRef.current.cardioSessions[0].distanceKm, 8.4);
      assert.equal(store.databaseRef.current.cardioSessions[0].feel, 'hard');
      assert.equal(store.databaseRef.current.cardioSessions.length, 1);

      // The pure half: not longer is not merged.
      const stored = { id: 'c', activityType: 'run', startedAt: 'x', performedAt: 'y', durationSec: 100, distanceKm: 1, feel: null };
      assert.equal(mergeContinuedCardioRun(stored, { ...stored, durationSec: 100, distanceKm: 2 }), stored);
      assert.equal(mergeContinuedCardioRun(stored, { ...stored, durationSec: 99 }), stored);
    },
  },
  {
    name: 'cardio: a run whose clear was lost is not saved a second time on relaunch, and a genuinely new run is',
    async run() {
      const store = fakeStore();
      const first = await store.save(RUN);
      assert.equal(store.databaseRef.current.cardioSessions.length, 1);
      assert.equal(store.commits, 1);

      // The live run came back after a kill and the reader pressed Complete again, as it was.
      const again = await store.save({ ...RUN });
      assert.equal(again.id, first.id, 'the stored run is handed back');
      assert.equal(store.databaseRef.current.cardioSessions.length, 1, 'one run, one row');
      assert.equal(store.commits, 1, 'nothing was written');
      // An older or shorter reading never shortens it.
      await store.save({ ...RUN, durationSec: 1000, distanceKm: 3 });
      assert.deepEqual(store.databaseRef.current.cardioSessions[0], first, 'a shorter finish leaves the stored run as it is');
      assert.equal(store.commits, 1);

      // Different runs still save: another start, and another activity at the same instant.
      await store.save({ ...RUN, startedAt: '2026-10-04T08:00:00.000Z' });
      await store.save({ ...RUN, activityType: 'walk' });
      assert.equal(store.databaseRef.current.cardioSessions.length, 3);
      assert.equal(store.commits, 3);
    },
  },
];
