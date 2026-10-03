const assert = require('node:assert/strict');
const path = require('node:path');

const { createClock, createHookRuntime, flush, requireWithStubs } = require('../../helpers/hookHarness.cjs');

const DIST = path.join(__dirname, '..', '..', '..', '.test-dist');
const HOOK = path.join(DIST, 'features', 'account', 'useAccountBackup.js');
const lib = require(path.join(DIST, 'lib', 'accountBackup.js'));
const { normalizeStoredAccount } = requireWithStubs(path.join(DIST, 'features', 'account', 'accountStore.js'), {
  '@react-native-async-storage/async-storage': { __esModule: true, default: {} },
});
const { createEmptyDatabase } = require(path.join(DIST, 'data', 'seed.js'));

/**
 * The backup's own bookkeeping, run (hunt round, 2026-10-03):
 *
 * - an upload that landed while its answer was lost left the phone one
 *   version behind its own copy, and every later upload was refused as
 *   "another phone wrote since";
 * - a paused automatic backup said nothing;
 * - the restore-or-keep answers used the token captured when the question was
 *   asked, an hour stale by the time it was answered;
 * - "Delete account" could not tell a delete of its own that was lost from one
 *   another phone made.
 *
 * The harness is accountBackupHook.test.cjs's, cut down: the compiled hook on
 * a small React stand-in, with the server, Google, the store and the clock
 * replaced by fakes the test controls.
 */

const QUIET_MS = 8000;

function database(overrides = {}) {
  const base = createEmptyDatabase('fi');
  return { ...base, exerciseLibrary: [], ...overrides, preferences: { ...base.preferences, ...(overrides.preferences ?? {}) } };
}
const workout = (id, extra = {}) => ({
  id,
  workoutTemplateId: 'tpl_x',
  workoutNameSnapshot: 'Push',
  performedAt: '2026-09-01T10:00:00.000Z',
  ...extra,
});
const workouts = (count) => Array.from({ length: count }, (_, index) => workout(`w${index}`));
const emptyHistory = () => ({ sessions: [], slotHistory: {}, lastSelectedTemplateId: null });
const cloudCopy = (db) => JSON.parse(JSON.stringify(lib.buildAccountBackupPayload(db, emptyHistory(), '2026-09-10T08:00:00.000Z')));

function syncedAccount(local, extra = {}) {
  return {
    sub: 'sub-1',
    email: 'reader@example.com',
    name: 'Reader',
    lastBackupAt: '2026-09-10T08:00:00.000Z',
    lastBackupItemCount: lib.countBackupItems(local),
    lastBackupHistoryCount: 0,
    lastBackupFingerprint: lib.accountBackupFingerprint(local, emptyHistory()),
    autoBackupPaused: false,
    cloudVersion: 'v1',
    ...extra,
  };
}

async function withHook({ local, stored = null, cloud = null, storedVersion = 1 }, scenario) {
  const clock = createClock();
  const runtime = createHookRuntime();
  const listeners = new Set();
  const calls = { upload: 0, download: 0, expected: [], uploadTokens: [], deleteOptions: [], signedOut: 0 };
  let written = storedVersion;
  const server = {
    blob: cloud,
    version: cloud ? `v${written}` : null,
    loseNextResponse: false,
    deleteLost: false,
    deleteError: null,
    deleteAnswerId: undefined,
  };
  const write = (blob) => {
    server.blob = blob;
    written += 1;
    server.version = blob ? `v${written}` : null;
  };
  const google = {
    silent: { status: 'ok', idToken: 'token' },
    signIn: { status: 'signed_in', account: { sub: 'sub-1', email: 'reader@example.com', name: 'Reader', idToken: 'token' } },
  };
  const store = { account: stored };
  const app = { database: local, history: emptyHistory(), hydrated: true, liveSession: false };

  const { useAccountBackup } = requireWithStubs(HOOK, {
    react: runtime.react,
    'react-native': {
      AppState: {
        addEventListener(_type, listener) {
          listeners.add(listener);
          return { remove: () => listeners.delete(listener) };
        },
      },
    },
    './backupApi': {
      isBackupApiConfigured: () => true,
      BACKUP_CHANGED: 'BACKUP_CHANGED',
      async uploadBackup(token, payload, expected) {
        calls.upload += 1;
        calls.expected.push(expected);
        calls.uploadTokens.push(token);
        if (token === 'expired') {
          return { ok: false, error: 'INVALID_TOKEN' };
        }
        const refused = expected === null ? server.blob !== null : expected !== server.version;
        if (refused) {
          return { ok: false, error: 'BACKUP_CHANGED' };
        }
        write(JSON.parse(JSON.stringify(payload)));
        if (server.loseNextResponse) {
          // The server committed; the answer never reached the phone.
          server.loseNextResponse = false;
          return { ok: false, error: 'NETWORK' };
        }
        return { ok: true, savedAt: '2026-09-17T12:00:00.000Z', version: server.version };
      },
      async downloadBackup() {
        calls.download += 1;
        return server.blob ? { ok: true, payload: server.blob, version: server.version } : { ok: false, error: 'NO_BACKUP' };
      },
      async deleteBackup(_token, options) {
        calls.deleteOptions.push(options);
        if (server.deleteError) {
          return {
            ok: false,
            error: server.deleteError,
            definite: true,
            ...(server.deleteAnswerId !== undefined ? { deleteRequestId: server.deleteAnswerId } : {}),
          };
        }
        if (server.deleteLost) {
          write(null);
          return { ok: false };
        }
        write(null);
        return { ok: true };
      },
    },
    './accountAuth': {
      availableSignInProviders: () => ['google'],
      isAccountSignInConfigured: () => true,
      signInWith: async () => google.signIn,
      getFreshIdToken: async () => google.silent,
      signOutAccount: async () => {
        calls.signedOut += 1;
      },
    },
    './accountStore': {
      loadStoredAccount: async () => store.account,
      saveStoredAccount: async (account) => {
        store.account = JSON.parse(JSON.stringify(account));
      },
      clearStoredAccount: async () => {
        store.account = null;
      },
      rememberSignedOutAccount: async (sub) => {
        store.signedOut = [...new Set([...(store.signedOut ?? []), sub])];
      },
      loadSignedOutAccounts: async () => store.signedOut ?? [],
      forgetSignedOutAccount: async () => {
        store.signedOut = [];
      },
    },
  });

  const props = () => ({
    hydrated: app.hydrated,
    liveSession: app.liveSession,
    database: app.database,
    workoutHistory: app.history,
    async restoreDatabase(input) {
      app.database = { ...input, exerciseLibrary: [] };
      return app.database;
    },
    async restoreWorkoutHistory(history) {
      app.history = history;
      return history;
    },
  });
  const env = {
    calls,
    server,
    write,
    google,
    store,
    app,
    api: null,
    render() {
      env.api = runtime.render(useAccountBackup, props());
      return env.api;
    },
    async settle() {
      for (let round = 0; round < 4; round += 1) {
        await flush();
        env.render();
      }
    },
    async advance(ms) {
      clock.advance(ms);
      await env.settle();
    },
    async foreground() {
      for (const listener of [...listeners]) {
        listener('background');
        listener('active');
      }
      await env.settle();
    },
    async edit(change) {
      app.database = change(app.database);
      await env.settle();
    },
  };
  const realSetTimeout = global.setTimeout;
  const realClearTimeout = global.clearTimeout;
  global.setTimeout = clock.setTimeout;
  global.clearTimeout = clock.clearTimeout;
  try {
    env.render();
    await env.settle();
    await scenario(env);
  } finally {
    runtime.unmount();
    global.setTimeout = realSetTimeout;
    global.clearTimeout = realClearTimeout;
  }
}

const addWorkout = (id) => (db) => ({ ...db, workoutSessions: [...db.workoutSessions, workout(id)] });

module.exports = [
  {
    // Evidence s1 (hunt round D): the server wrote, the answer was lost, and
    // every upload after that was refused — with the old green time on screen.
    name: 'backup sync: an upload whose answer was lost is recognised as this phone\'s own copy, and the next ones go through without a question',
    async run() {
      const local = database({ workoutSessions: workouts(3) });
      await withHook({ local, stored: syncedAccount(local), cloud: cloudCopy(local) }, async (env) => {
        env.server.loseNextResponse = true;
        await env.edit(addWorkout('a'));
        await env.advance(QUIET_MS);
        assert.equal(env.calls.upload, 1);
        assert.equal(env.server.blob.database.workoutSessions.length, 4, 'the fake did not commit');
        // The phone does not know: its version is the old one, but the
        // fingerprint of what it sent was kept before the request.
        assert.equal(env.store.account.cloudVersion, 'v1');
        assert.equal(env.store.account.uploadInFlightFingerprints.length, 1);

        await env.edit(addWorkout('b'));
        await env.advance(QUIET_MS);
        assert.equal(env.server.blob.database.workoutSessions.length, 5, 'the workouts never reached the cloud');
        assert.equal(env.store.account.cloudVersion, env.server.version);
        assert.equal(env.store.account.lastBackupAt, '2026-09-17T12:00:00.000Z');
        assert.deepEqual(env.store.account.uploadInFlightFingerprints, [], 'a settled copy left its fingerprint behind');
        assert.equal(env.api.state.backupPaused, null);
        // The refused upload was retried once, on the version found.
        assert.deepEqual(env.calls.expected, ['v1', 'v1', 'v2']);

        // And it keeps working, with no question anywhere.
        await env.edit(addWorkout('c'));
        await env.advance(QUIET_MS);
        assert.equal(env.server.blob.database.workoutSessions.length, 6);
        assert.equal((await env.api.backUpOrAsk()).kind, 'backed_up');
      });
    },
  },
  {
    name: 'backup sync: "Back up now" after a lost answer uploads instead of asking about the phone\'s own copy',
    async run() {
      const local = database({ workoutSessions: workouts(3) });
      await withHook({ local, stored: syncedAccount(local), cloud: cloudCopy(local) }, async (env) => {
        env.server.loseNextResponse = true;
        await env.edit(addWorkout('a'));
        await env.advance(QUIET_MS);
        await env.edit(addWorkout('b'));
        const outcome = await env.api.backUpOrAsk();
        assert.equal(outcome.kind, 'backed_up', '"Back up now" asked restore-or-keep about this phone\'s own copy');
        assert.equal(env.server.blob.database.workoutSessions.length, 5);
        assert.equal(env.app.database.workoutSessions.length, 5, 'newer local workouts were dropped');
      });
    },
  },
  {
    name: 'backup sync: the fingerprint kept before the request survives a restart',
    async run() {
      const local = database({ workoutSessions: workouts(3) });
      let carried;
      let carriedBlob;
      let carriedVersion;
      let localAfter;
      await withHook({ local, stored: syncedAccount(local), cloud: cloudCopy(local) }, async (env) => {
        env.server.loseNextResponse = true;
        await env.edit(addWorkout('a'));
        await env.advance(QUIET_MS);
        carried = env.store.account;
        carriedBlob = env.server.blob;
        carriedVersion = env.server.version;
        localAfter = env.app.database;
      });
      // A new run of the app: only the stored account and the server remember.
      await withHook({ local: localAfter, stored: carried, cloud: carriedBlob, storedVersion: Number(carriedVersion.slice(1)) }, async (env) => {
        await env.edit(addWorkout('b'));
        await env.advance(QUIET_MS);
        assert.equal(env.server.blob.database.workoutSessions.length, 5, 'after a restart the phone\'s own copy was treated as another phone\'s');
        assert.equal(env.api.state.backupPaused, null);
      });
    },
  },
  {
    // The loose rule: no fingerprint kept (an account stored by an older build),
    // but the copy holds nothing the phone lacks.
    name: 'backup sync: a copy the phone already contains is replaced; one with a row, an edit or a deletion from another phone is asked about',
    async run() {
      const local = database({ workoutSessions: workouts(4) });
      const stored = () => syncedAccount(local);
      // The phone has two more than the copy it last saw.
      const ahead = database({ workoutSessions: [...workouts(4), workout('x1'), workout('x2')] });

      // Held already: the copy is a subset of the phone.
      await withHook({ local: ahead, stored: stored(), cloud: cloudCopy(local), storedVersion: 5 }, async (env) => {
        env.server.version = 'v9'; // moved on without this phone knowing
        await env.edit(addWorkout('x3'));
        await env.advance(QUIET_MS);
        assert.equal(env.server.blob.database.workoutSessions.length, 7);
        assert.equal(env.api.state.backupPaused, null);
      });

      // A row the phone lacks: another phone logged it.
      await withHook({ local: ahead, stored: stored(), cloud: cloudCopy(database({ workoutSessions: [...workouts(4), workout('theirs')] })) }, async (env) => {
        env.server.version = 'v9';
        await env.edit(addWorkout('x3'));
        await env.advance(QUIET_MS);
        assert.equal(env.calls.upload, 1, 'only the refused attempt may have been sent');
        assert.ok(env.server.blob.database.workoutSessions.some((row) => row.id === 'theirs'), 'the other phone\'s workout was overwritten');
        assert.equal(env.api.state.backupPaused, 'other_phone');
        assert.equal((await env.api.backUpOrAsk()).kind, 'choice');
      });

      // The same rows, but one was corrected on the other phone.
      const edited = cloudCopy(database({ workoutSessions: [workout('w0', { sessionNotes: 'felt heavy' }), ...workouts(4).slice(1)] }));
      await withHook({ local: ahead, stored: stored(), cloud: edited }, async (env) => {
        env.server.version = 'v9';
        await env.edit(addWorkout('x3'));
        await env.advance(QUIET_MS);
        assert.equal(env.calls.upload, 1);
        assert.equal(env.server.blob.database.workoutSessions[0].sessionNotes, 'felt heavy', 'an edit made on another phone was overwritten');
        assert.equal(env.api.state.backupPaused, 'other_phone');
      });

      // Something deleted on the other phone is not "this phone catching up".
      await withHook({ local: ahead, stored: stored(), cloud: cloudCopy(database({ workoutSessions: workouts(2) })) }, async (env) => {
        env.server.version = 'v9';
        await env.edit(addWorkout('x3'));
        await env.advance(QUIET_MS);
        assert.equal(env.calls.upload, 1);
        assert.equal(env.server.blob.database.workoutSessions.length, 2, 'a deletion made on another phone was undone');
        assert.equal(env.api.state.backupPaused, 'other_phone');
      });
    },
  },
  {
    name: 'backup sync: a first backup that landed while its answer was lost is adopted on the next look, not asked about',
    async run() {
      const local = database({ workoutSessions: workouts(3) });
      await withHook({ local, cloud: null }, async (env) => {
        env.server.loseNextResponse = true;
        assert.equal((await env.api.signIn()).kind, 'not_backed_up');
        assert.equal(env.server.blob.database.workoutSessions.length, 3);
        assert.equal(env.store.account.lastBackupAt, null);
        assert.equal(env.store.account.uploadInFlightFingerprints.length, 1, 'the failed sign-in upload dropped its fingerprint');
        await env.edit(addWorkout('later'));
        const outcome = await env.api.backUpOrAsk();
        assert.equal(outcome.kind, 'backed_up', 'a phone\'s own first backup was put to it as a question');
        assert.equal(env.server.blob.database.workoutSessions.length, 4);
        assert.equal(env.store.account.cloudVersion, env.server.version);
      });
    },
  },
  {
    // Lib: the rules the hook leans on.
    name: 'backup sync: copyIsInPhoneData and isCopyPhonesOwnWork judge a refused upload\'s copy',
    run() {
      const phone = database({ workoutSessions: [...workouts(3), workout('extra')], bodyweightEntries: [{ id: 'bw1', recordedAt: 't', weight: 80 }] });
      const copy = (db) => cloudCopy(db);
      assert.equal(lib.copyIsInPhoneData(phone, copy(database({ workoutSessions: workouts(3) })).database), true);
      assert.equal(lib.copyIsInPhoneData(phone, copy(database()).database), true, 'an empty copy is in any phone');
      assert.equal(lib.copyIsInPhoneData(phone, null), false);
      assert.equal(lib.copyIsInPhoneData(phone, copy(database({ workoutSessions: [workout('w9')] })).database), false);
      assert.equal(
        lib.copyIsInPhoneData(phone, copy(database({ bodyweightEntries: [{ id: 'bw1', recordedAt: 't', weight: 81 }] })).database),
        false,
        'a weigh-in edited elsewhere passed',
      );
      assert.equal(lib.copyIsInPhoneData(phone, copy(database({ workoutSessions: [workout('w0', { feel: 4 })] })).database), false);

      const payload = copy(database({ workoutSessions: workouts(3) }));
      const own = (extra) => lib.isCopyPhonesOwnWork({ inFlightFingerprints: [], lastCounts: { itemCount: 3, historyCount: 0 }, local: phone, copy: payload, ...extra });
      assert.equal(own({}), true);
      assert.equal(own({ lastCounts: { itemCount: 4, historyCount: 0 } }), false, 'a smaller copy than the one last seen passed as catching up');
      assert.equal(own({ lastCounts: { itemCount: null, historyCount: null } }), false, 'with no size to compare it passed');
      const foreign = copy(database({ workoutSessions: [workout('theirs')] }));
      assert.equal(lib.isCopyPhonesOwnWork({ inFlightFingerprints: [], lastCounts: { itemCount: 1, historyCount: 0 }, local: phone, copy: foreign }), false);
      // Exact: what an upload of this phone's was made of, whatever the rows say.
      const fingerprint = lib.accountBackupFingerprint(foreign.database, foreign.workoutHistory);
      assert.equal(lib.isCopyPhonesOwnWork({ inFlightFingerprints: ['nope', fingerprint], lastCounts: { itemCount: null, historyCount: null }, local: phone, copy: foreign }), true);
      assert.equal(
        lib.isCloudCopyThisPhones(
          { cloudVersion: 'v1', lastBackupAt: 'x', lastBackupFingerprint: null, uploadInFlightFingerprints: [fingerprint] },
          { version: 'v2', payload: foreign },
        ),
        true,
      );
      assert.equal(lib.isCloudCopyThisPhones({ cloudVersion: 'v1', lastBackupAt: 'x', lastBackupFingerprint: null }, { version: 'v2', payload: foreign }), false);
    },
  },
  {
    name: 'backup sync: a stored account keeps the kept fingerprints and the delete request id, and drops what is not one',
    run() {
      const fp = ['a1', 'b2'];
      assert.deepEqual(normalizeStoredAccount({ sub: 's', uploadInFlightFingerprints: fp }).uploadInFlightFingerprints, fp);
      assert.deepEqual(normalizeStoredAccount({ sub: 's', uploadInFlightFingerprints: ['a', 'b', 'c', 'd'] }).uploadInFlightFingerprints, ['a', 'b', 'c']);
      for (const bad of ['x', 7, [], [7, ''], {}]) {
        assert.equal('uploadInFlightFingerprints' in normalizeStoredAccount({ sub: 's', uploadInFlightFingerprints: bad }), false, JSON.stringify(bad));
      }
      const id = '0123456789abcdef0123456789abcdef';
      assert.equal(normalizeStoredAccount({ sub: 's', deleteRequestId: id }).deleteRequestId, id);
      for (const bad of ['', 'xyz', id.toUpperCase(), id + '0', 7, null]) {
        assert.equal('deleteRequestId' in normalizeStoredAccount({ sub: 's', deleteRequestId: bad }), false, JSON.stringify(bad));
      }
    },
  },
  {
    // The signal: a paused automatic backup said nothing.
    name: 'backup sync: a backup held for another phone\'s copy, or by the shrink guard, says so, and says no more once it is settled',
    async run() {
      const local = database({ workoutSessions: workouts(3) });
      await withHook({ local, stored: syncedAccount(local), cloud: cloudCopy(local) }, async (env) => {
        assert.equal(env.api.state.backupPaused, null);
        env.write(cloudCopy(database({ workoutSessions: workouts(5) })));
        await env.edit(addWorkout('mine'));
        await env.advance(QUIET_MS);
        assert.equal(env.api.state.backupPaused, 'other_phone', 'a held backup showed nothing');
        // The question is the reader's; answering it lifts the signal.
        assert.equal((await env.api.backUpOrAsk()).kind, 'choice');
        await env.settle();
        assert.equal(await env.api.resolveRestoreChoice('restore'), 'done');
        await env.settle();
        assert.equal(env.api.state.backupPaused, null, 'a settled pause kept showing');
      });
      // Shrink guard.
      const full = database({ workoutSessions: workouts(40) });
      await withHook({ local: database(), stored: syncedAccount(full, { lastBackupFingerprint: null }), cloud: cloudCopy(full) }, async (env) => {
        await env.edit((db) => ({ ...db, bodyweightEntries: [{ id: 'bw', recordedAt: 't', weight: 80 }] }));
        await env.advance(QUIET_MS);
        assert.equal(env.calls.upload + env.calls.download, 0);
        assert.equal(env.api.state.backupPaused, 'smaller_phone');
        assert.equal((await env.api.backUpOrAsk()).kind, 'choice');
        await env.settle();
        assert.equal(await env.api.resolveRestoreChoice('restore'), 'done');
        await env.settle();
        assert.equal(env.api.state.backupPaused, null);
      });
      // Signing out clears it, and a deleted copy's own pause is not this one.
      await withHook({ local, stored: syncedAccount(local), cloud: cloudCopy(local) }, async (env) => {
        env.write(cloudCopy(database({ workoutSessions: workouts(5) })));
        await env.edit(addWorkout('mine'));
        await env.advance(QUIET_MS);
        assert.equal(env.api.state.backupPaused, 'other_phone');
        await env.api.signOut();
        await env.settle();
        assert.equal(env.api.state.backupPaused, null);
      });
      await withHook({ local, stored: syncedAccount(local), cloud: cloudCopy(local) }, async (env) => {
        assert.equal(await env.api.deleteRemoteBackup(), 'done');
        await env.edit(addWorkout('next'));
        await env.advance(QUIET_MS);
        assert.equal(env.api.state.backupPaused, null, '"No backup yet" already says it');
      });
    },
  },
  {
    name: 'backup sync: restore-or-keep and confirm-upload answers go out with a fresh token, not the one captured when they were asked',
    async run() {
      const phone = database({ workoutSessions: [workout('mine')] });
      await withHook({ local: phone, cloud: cloudCopy(database({ workoutSessions: workouts(4) })) }, async (env) => {
        assert.equal((await env.api.signIn()).kind, 'choice');
        // The question sat open for hours: the token it was asked with has expired.
        env.google.silent = { status: 'ok', idToken: 'fresh' };
        await env.settle();
        assert.equal(await env.api.resolveRestoreChoice('keep_local'), 'done');
        assert.deepEqual(env.calls.uploadTokens, ['fresh'], 'the answer used the captured token');
      });
      // The switch question.
      await withHook({ local: database({ workoutSessions: workouts(3) }), cloud: null }, async (env) => {
        assert.equal((await env.api.signIn()).kind, 'backed_up');
        await env.api.signOut();
        env.write(null);
        env.google.signIn = { status: 'signed_in', account: { sub: 'sub-2', email: 'o@example.com', name: 'O', idToken: 'token-b' } };
        const before = env.calls.upload;
        assert.equal((await env.api.signIn()).kind, 'confirm_upload');
        env.google.silent = { status: 'ok', idToken: 'fresh-b' };
        assert.equal(await env.api.resolveUploadChoice('upload'), 'done');
        assert.deepEqual(env.calls.uploadTokens.slice(before), ['fresh-b']);
      });
      // Offline when answered: the captured token is tried, and the upload says so.
      await withHook({ local: phone, cloud: cloudCopy(database({ workoutSessions: workouts(4) })) }, async (env) => {
        assert.equal((await env.api.signIn()).kind, 'choice');
        env.google.silent = { status: 'error' };
        await env.settle();
        assert.equal(await env.api.resolveRestoreChoice('keep_local'), 'done');
        assert.deepEqual(env.calls.uploadTokens, ['token']);
      });
      // Google has no session left: nothing is sent.
      await withHook({ local: phone, cloud: cloudCopy(database({ workoutSessions: workouts(4) })) }, async (env) => {
        assert.equal((await env.api.signIn()).kind, 'choice');
        env.google.silent = { status: 'signed_out' };
        await env.settle();
        assert.equal(await env.api.resolveRestoreChoice('keep_local'), 'failed');
        assert.equal(env.calls.upload, 0);
      });
    },
  },
  {
    // Protocol: the phone's request id, kept before the request and handed back by the server.
    name: 'backup sync: a Delete account retry says "done" only when the server\'s marker carries this phone\'s own request id',
    async run() {
      const local = database({ workoutSessions: [workout('a')] });
      const apple = { status: 'ok', idToken: 'vs1.session.mac' };
      const lostFirst = async (env) => {
        env.google.silent = apple;
        env.server.deleteLost = true;
        assert.equal(await env.api.deleteAccount(), 'failed');
        await env.settle();
        const id = env.calls.deleteOptions[0].requestId;
        assert.match(id, /^[0-9a-f]{32}$/);
        assert.equal(env.store.account.deleteRequestId, id, 'the id was not kept with the pending record');
        env.server.deleteLost = false;
        env.server.deleteError = 'SESSION_REVOKED';
        return id;
      };

      // The marker is this phone's own: the lost answer, delivered.
      await withHook({ local, stored: syncedAccount(local), cloud: cloudCopy(local) }, async (env) => {
        const id = await lostFirst(env);
        env.server.deleteAnswerId = id;
        assert.equal(await env.api.deleteAccount(), 'done');
        assert.equal(env.calls.deleteOptions[1].requestId, id, 'the retry sent a new id and could not recognise the first');
        await env.settle();
        assert.equal(env.store.account, null);
      });
      // The marker is another phone's: this phone's own never arrived.
      await withHook({ local, stored: syncedAccount(local), cloud: cloudCopy(local) }, async (env) => {
        await lostFirst(env);
        env.server.deleteAnswerId = 'f'.repeat(32);
        assert.equal(await env.api.deleteAccount(), 'ended', 'another phone\'s delete was reported as this phone\'s');
        await env.settle();
        assert.equal(env.api.state.status, 'signed_out');
      });
      // An older server sends no id: the pending record decides, as before.
      await withHook({ local, stored: syncedAccount(local), cloud: cloudCopy(local) }, async (env) => {
        await lostFirst(env);
        assert.equal(await env.api.deleteAccount(), 'done');
      });
      await withHook({ local, stored: syncedAccount(local), cloud: cloudCopy(local) }, async (env) => {
        env.google.silent = apple;
        env.server.deleteError = 'SESSION_REVOKED';
        assert.equal(await env.api.deleteAccount(), 'ended');
      });
      // No try of this phone's own, and a marker that names one: still not this phone's.
      await withHook({ local, stored: syncedAccount(local), cloud: cloudCopy(local) }, async (env) => {
        env.google.silent = apple;
        env.server.deleteError = 'SESSION_REVOKED';
        env.server.deleteAnswerId = 'a'.repeat(32);
        assert.equal(await env.api.deleteAccount(), 'ended');
      });
      assert.equal(lib.revokedDeleteOutcome({ pendingBefore: true, ownRequestId: 'x', answerRequestId: 'x' }), 'done');
      assert.equal(lib.revokedDeleteOutcome({ pendingBefore: true, ownRequestId: 'x', answerRequestId: 'y' }), 'ended');
      assert.equal(lib.revokedDeleteOutcome({ pendingBefore: true, ownRequestId: 'x', answerRequestId: undefined }), 'done');
      assert.equal(lib.revokedDeleteOutcome({ pendingBefore: false, ownRequestId: 'x', answerRequestId: null }), 'ended');
    },
  },
];
