const assert = require('node:assert/strict');

const {
  ACCOUNT_BACKUP_VERSION,
  buildAccountBackupPayload,
  describeAccountBackup,
  hasLocalDataWorthKeeping,
  parseAccountBackupPayload,
} = require('../../.test-dist/lib/accountBackup.js');

function makeDatabase(overrides = {}) {
  return {
    workoutTemplates: [],
    exerciseTemplates: [],
    workoutPlans: [],
    exerciseLibrary: [{ id: 'lib_1', name: 'Bench Press' }],
    workoutSessions: [],
    cardioSessions: [],
    exerciseLogs: [],
    bodyweightEntries: [],
    measurementEntries: [],
    preferences: { appLanguage: 'fi' },
    ...overrides,
  };
}

const HISTORY = { sessions: [], slotHistory: {}, lastSelectedTemplateId: null };

module.exports = [
  {
    // The library is 873 generated entries that every load reseeds; shipping
    // it to the server would make each backup megabytes of data the restore
    // path throws away.
    name: 'accountBackup: the payload strips the exercise library, exactly like the local save',
    run() {
      const payload = buildAccountBackupPayload(makeDatabase(), HISTORY, '2026-08-22T10:00:00.000Z');
      assert.equal('exerciseLibrary' in payload.database, false);
      assert.equal(payload.version, ACCOUNT_BACKUP_VERSION);
      assert.equal(payload.exportedAt, '2026-08-22T10:00:00.000Z');
    },
  },
  {
    name: 'accountBackup: a built payload round-trips through parse',
    run() {
      const payload = buildAccountBackupPayload(makeDatabase(), HISTORY, '2026-08-22T10:00:00.000Z');
      const parsed = parseAccountBackupPayload(JSON.parse(JSON.stringify(payload)));
      assert.ok(parsed);
      assert.equal(parsed.exportedAt, payload.exportedAt);
    },
  },
  {
    // A wrong-shaped download must become "no backup", never a restore of
    // garbage — the local data is the only copy the reader is guaranteed.
    name: 'accountBackup: parse rejects everything that is not a v1 backup',
    run() {
      for (const bad of [
        null,
        undefined,
        'text',
        42,
        {},
        { version: 2, exportedAt: 'x', database: {}, workoutHistory: {} },
        { version: 1, exportedAt: '', database: {}, workoutHistory: {} },
        { version: 1, exportedAt: 'x', database: null, workoutHistory: {} },
        { version: 1, exportedAt: 'x', database: {}, workoutHistory: null },
      ]) {
        assert.equal(parseAccountBackupPayload(bad), null, JSON.stringify(bad));
      }
    },
  },
  {
    name: 'accountBackup: the summary counts what the restore dialog names',
    run() {
      const payload = buildAccountBackupPayload(
        makeDatabase({
          workoutSessions: [{ id: 'a' }, { id: 'b' }],
          cardioSessions: [{ id: 'c' }],
          workoutTemplates: [{ id: 'tpl' }],
          bodyweightEntries: [{ id: 'w1' }, { id: 'w2' }, { id: 'w3' }],
        }),
        HISTORY,
        '2026-08-22T10:00:00.000Z',
      );
      assert.deepEqual(describeAccountBackup(payload), {
        exportedAt: '2026-08-22T10:00:00.000Z',
        workoutCount: 2,
        cardioCount: 1,
        customProgramCount: 1,
        bodyweightCount: 3,
      });
    },
  },
  {
    // The line between "restore silently" and "ask first": a fresh install
    // has nothing to lose, a device with any logged work does.
    name: 'accountBackup: only a device with logged work forces the restore question',
    run() {
      assert.equal(hasLocalDataWorthKeeping(makeDatabase()), false);
      assert.equal(hasLocalDataWorthKeeping(makeDatabase({ workoutSessions: [{ id: 'a' }] })), true);
      assert.equal(hasLocalDataWorthKeeping(makeDatabase({ cardioSessions: [{ id: 'c' }] })), true);
      assert.equal(hasLocalDataWorthKeeping(makeDatabase({ bodyweightEntries: [{ id: 'w' }] })), true);
      assert.equal(hasLocalDataWorthKeeping(makeDatabase({ workoutTemplates: [{ id: 't' }] })), true);
    },
  },
];
