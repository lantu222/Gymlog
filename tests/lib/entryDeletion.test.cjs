const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { readAppWiring } = require('../helpers/appWiringSource.cjs');

function read(relative) {
  return fs.readFileSync(path.join(__dirname, '../..', relative), 'utf8');
}

/**
 * Entry has a second half.
 *
 * The provider could delete exactly two things — a programme and a logged
 * workout — so a mistyped measurement, a stray weigh-in and a run that was
 * really a walk were permanent the moment they were saved, and stayed in every
 * chart and calendar that reads them (#bugs 2026-08-26, three separate
 * reports). These pin the primitives, the queue they run on, and the fact that
 * each one is actually reachable from a screen.
 */
module.exports = [
  {
    name: 'the provider can delete a measurement, a weigh-in and a run',
    run() {
      const provider = read('src/state/AppProvider.tsx');
      for (const fn of ['deleteMeasurementEntry', 'deleteBodyweightEntry', 'deleteCardioSession']) {
        assert.match(provider, new RegExp(`function ${fn}\\(`), `${fn} should exist`);
        assert.match(provider, new RegExp(`^  ${fn}: \\(`, 'm'), `${fn} should be on the context type`);
      }
    },
  },
  {
    /**
     * Every other write goes through runExclusive so a read-modify-write
     * cannot be built on a snapshot another write has moved past. A delete is
     * a read-modify-write too, and racing the save that created the entry is
     * exactly the bug class this queue exists for.
     */
    name: 'each delete runs on the same serial queue as every other write',
    run() {
      const provider = read('src/state/AppProvider.tsx');
      for (const fn of ['deleteMeasurementEntry', 'deleteBodyweightEntry', 'deleteCardioSession']) {
        const start = provider.indexOf(`function ${fn}(`);
        const body = provider.slice(start, start + 600);
        assert.ok(body.includes('runExclusive('), `${fn} must run inside runExclusive`);
        assert.ok(body.includes('databaseRef.current'), `${fn} must read the queue's own snapshot`);
      }
    },
  },
  {
    name: 'a run can be removed from the list that removes workouts beside it',
    run() {
      const history = read('src/screens/HistoryScreen.tsx');
      assert.match(history, /onDeleteCardioSession\?: \(sessionId: string\) => void;/);
      // Behind the same confirmation the workout rows use — deleting is not
      // one stray tap on a list you are scrolling.
      assert.match(history, /setPendingCardioDelete\(\{ id: session\.id/);
      assert.match(history, /onDeleteCardioSession\?\.\(target\.id\)/);
      assert.match(readAppWiring(), /onDeleteCardioSession=\{\(sessionId\) => void deleteCardioSession\(sessionId\)\}/);
    },
  },
  {
    name: 'a single reading has a row of its own, and that row can remove it',
    run() {
      const progress = read('src/screens/ProgressScreen.tsx');
      // The measure list shows one row per MEASURE; the entry list is what
      // gives an individual reading somewhere to be deleted from.
      assert.match(progress, /function renderMeasureEntries\(\)/);
      assert.match(progress, /entryIds: kindEntries\.map\(\(entry\) => entry\.id\)/);
      assert.match(progress, /setPendingEntryDelete\(row\.id\)/);
      // Bodyweight and the other measures go to different stores, so the row
      // has to pick the right remover rather than assuming one.
      assert.match(progress, /model\.kind === null \? onDeleteBodyweight : onDeleteMeasurement/);
      const wiring = readAppWiring();
      assert.match(wiring, /onDeleteBodyweight=\{\(entryId\) => \{/);
      assert.match(wiring, /onDeleteMeasurement=\{\(entryId\) => \{/);
    },
  },
];
