const assert = require('node:assert/strict');
const path = require('node:path');

const { createClock, createHookRuntime, deferred, flush, requireWithStubs } = require('../../helpers/hookHarness.cjs');

const DIST = path.join(__dirname, '..', '..', '..', '.test-dist');
const HOOK = path.join(DIST, 'features', 'account', 'useAccountBackup.js');
const GOOGLE_AUTH = path.join(DIST, 'features', 'account', 'googleAuth.js');
const lib = require(path.join(DIST, 'lib', 'accountBackup.js'));
const { normalizeStoredAccount } = requireWithStubs(path.join(DIST, 'features', 'account', 'accountStore.js'), {
  '@react-native-async-storage/async-storage': { __esModule: true, default: {} },
});
const { createEmptyDatabase } = require(path.join(DIST, 'data', 'seed.js'));

/**
 * The account hook, run.
 *
 * Audit round 2 (2026-09-16) found the cloud backup losing and misreporting
 * data in ways that only show in order: an upload finishing after sign-out,
 * a failed upload never retried, a delete undone by the next weigh-in. These
 * drive the compiled hook through a small React stand-in
 * (tests/helpers/hookHarness) with Google, the server, the account store,
 * the clock and AppState replaced by fakes the test controls.
 */

const QUIET_MS = 8000;

function database(overrides = {}) {
  const base = createEmptyDatabase('fi');
  return {
    ...base,
    exerciseLibrary: [],
    ...overrides,
    preferences: { ...base.preferences, ...(overrides.preferences ?? {}) },
  };
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
    // The copy these accounts made carries an empty history.
    lastBackupHistoryCount: 0,
    lastBackupFingerprint: lib.accountBackupFingerprint(local, emptyHistory()),
    autoBackupPaused: false,
    ...extra,
  };
}

async function withHook({ local, stored = null, cloud = null }, scenario) {
  const clock = createClock();
  const runtime = createHookRuntime();
  const listeners = new Set();
  const calls = { upload: 0, download: 0, delete: 0, restoreDatabase: 0, restoreHistory: 0 };
  const server = { blob: cloud, uploadError: null, downloadError: null, deleteOk: true, gates: {} };
  const google = {
    silent: { status: 'ok', idToken: 'token' },
    signIn: { status: 'signed_in', account: { sub: 'sub-1', email: 'reader@example.com', name: 'Reader', idToken: 'token' } },
  };
  const store = { account: stored };
  const app = { database: local, history: emptyHistory(), historyWriteError: null, gates: {}, hydrated: true, liveSession: false };
  const pass = async (gates, name) => {
    if (gates[name]) {
      await gates[name].promise;
    }
  };

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
      async uploadBackup(_token, payload) {
        calls.upload += 1;
        await pass(server.gates, 'upload');
        if (server.uploadError) {
          return { ok: false, error: server.uploadError };
        }
        server.blob = JSON.parse(JSON.stringify(payload));
        return { ok: true, savedAt: '2026-09-17T12:00:00.000Z' };
      },
      async downloadBackup() {
        calls.download += 1;
        await pass(server.gates, 'download');
        if (server.downloadError) {
          return { ok: false, error: server.downloadError };
        }
        return server.blob ? { ok: true, payload: server.blob } : { ok: false, error: 'NO_BACKUP' };
      },
      async deleteBackup() {
        calls.delete += 1;
        await pass(server.gates, 'delete');
        if (!server.deleteOk) {
          return { ok: false };
        }
        server.blob = null;
        return { ok: true };
      },
    },
    './googleAuth': {
      isGoogleSignInConfigured: () => true,
      signInWithGoogle: async () => google.signIn,
      getFreshIdToken: async () => google.silent,
      signOutGoogle: async () => undefined,
    },
    './accountStore': {
      loadStoredAccount: async () => store.account,
      saveStoredAccount: async (account) => {
        store.account = account;
      },
      clearStoredAccount: async () => {
        store.account = null;
      },
    },
  });

  const props = () => ({
    hydrated: app.hydrated,
    liveSession: app.liveSession,
    database: app.database,
    workoutHistory: app.history,
    async restoreDatabase(input) {
      calls.restoreDatabase += 1;
      await pass(app.gates, 'database');
      app.database = { ...input, exerciseLibrary: [] };
      return app.database;
    },
    async restoreWorkoutHistory(history) {
      calls.restoreHistory += 1;
      await pass(app.gates, 'history');
      if (app.historyWriteError) {
        throw app.historyWriteError;
      }
      app.history = history;
      return history;
    },
  });

  const env = {
    calls,
    server,
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

module.exports = [
  {
    name: 'account hook: a phone holding only what setup wrote restores the cloud copy without asking',
    async run() {
      const setupOnly = database({
        preferences: { setupCurrentWeightKg: 82 },
        workoutTemplates: [{ id: 'workout_a', name: 'Mine', exerciseIds: [], sessions: [], createdAt: 't', updatedAt: 't', origin: 'authored' }],
        workoutPlans: [{ id: 'onboarding_plan_workout_a', name: 'Mine', entries: [{}] }],
        bodyweightEntries: [{ id: 'bw', recordedAt: '2026-09-17T08:00:00.000Z', weight: 82 }],
      });
      const cloud = cloudCopy(database({ workoutSessions: workouts(5) }));
      await withHook({ local: setupOnly, cloud }, async (env) => {
        const outcome = await env.api.signIn();
        assert.equal(outcome.kind, 'restored', 'a new phone was asked restore-or-keep over what setup made');
        assert.equal(env.calls.restoreDatabase, 1);
        assert.equal(env.store.account.lastBackupAt, cloud.exportedAt);
        // What was restored is the cloud copy: it is not uploaded straight back.
        await env.settle();
        await env.advance(QUIET_MS);
        assert.equal(env.calls.upload, 0);
      });
    },
  },
  {
    name: 'account hook: signing in mid-workout asks before a restore puts the workout away',
    async run() {
      const cloud = cloudCopy(database({ workoutSessions: workouts(5) }));
      await withHook({ local: database(), cloud }, async (env) => {
        env.app.liveSession = true;
        await env.settle();
        const outcome = await env.api.signIn();
        assert.equal(outcome.kind, 'choice', 'the workout in progress was restored over without asking');
        assert.equal(env.calls.restoreDatabase + env.calls.restoreHistory, 0);
        assert.equal(outcome.summary.local.workoutInProgress, true);
      });
    },
  },
  {
    name: 'account hook: a workout history set aside as unreadable is not backed up over the cloud copy of it',
    async run() {
      // The workout store's loader puts an unreadable bundle away and opens
      // on an empty history. The database is whole, so the guard that
      // counted only the database saw nothing shrink, the fingerprint moved,
      // and eight seconds later the empty history replaced the only copy of
      // every lift's "last time" (persistence audit, 2026-09-20).
      const local = database({ workoutSessions: workouts(4) });
      const history = {
        sessions: Array.from({ length: 20 }, (_, index) => ({ sessionId: `h${index}`, templateId: 'tpl_x', templateName: 'Push', performedAt: '2026-09-01T10:00:00.000Z' })),
        slotHistory: { 'tpl_x:s1:bench': Array.from({ length: 10 }, (_, index) => ({ slotId: 'tpl_x:s1:bench', sessionId: `h${index}`, sets: [] })) },
        lastSelectedTemplateId: 'tpl_x',
      };
      const cloud = JSON.parse(JSON.stringify(lib.buildAccountBackupPayload(local, history, '2026-09-10T08:00:00.000Z')));
      const madeWithHistory = { lastBackupFingerprint: lib.accountBackupFingerprint(local, history) };

      await withHook({ local, stored: syncedAccount(local, { ...madeWithHistory, lastBackupHistoryCount: 30 }), cloud }, async (env) => {
        assert.deepEqual(env.app.history.sessions, [], 'the phone should open on the empty history the loader hands over');
        await env.advance(QUIET_MS);
        assert.equal(env.calls.upload, 0, 'the empty history replaced the cloud copy of it');
        assert.equal(env.server.blob.workoutHistory.sessions.length, 20);
        // "Back up now" is the reader's decision, and it is asked twice.
        const outcome = await env.api.backUpOrAsk();
        assert.equal(outcome.kind, 'choice');
        assert.equal(outcome.summary.keepingLocalShrinksCloud, true, '"Use the data on this phone" was not asked a second time');
        assert.equal(env.calls.upload, 0);
      });

      // An account stored before the history was counted looks at the copy
      // once, stays out, and learns the size for next time.
      await withHook({ local, stored: syncedAccount(local, { ...madeWithHistory, lastBackupHistoryCount: null }), cloud }, async (env) => {
        await env.advance(QUIET_MS);
        assert.equal(env.calls.download, 1, 'an account with no history count uploaded without looking');
        assert.equal(env.calls.upload, 0);
        assert.equal(env.store.account.lastBackupHistoryCount, 30);
      });

      // A history that is all there backs up as before.
      await withHook({ local, stored: syncedAccount(local, { ...madeWithHistory, lastBackupHistoryCount: 30 }), cloud }, async (env) => {
        env.app.history = { ...history, sessions: [{ sessionId: 'h20', templateId: 'tpl_x', templateName: 'Push', performedAt: '2026-09-11T10:00:00.000Z' }, ...history.sessions] };
        await env.settle();
        await env.advance(QUIET_MS);
        assert.equal(env.calls.upload, 1);
        assert.equal(env.store.account.lastBackupHistoryCount, 31);
      });
    },
  },
  {
    name: 'account hook: a phone running an adopted ready programme is asked, not restored over',
    async run() {
      const readyPlan = { id: 'ready_plan_tpl_gainer_x', name: 'X', entries: [{ workoutTemplateId: 'tpl_gainer_x' }] };
      const adopted = database({
        workoutPlans: [readyPlan],
        preferences: { activePlanId: readyPlan.id, activePlanIds: [readyPlan.id] },
      });
      await withHook({ local: adopted, cloud: cloudCopy(database({ workoutSessions: workouts(5) })) }, async (env) => {
        const outcome = await env.api.signIn();
        assert.equal(outcome.kind, 'choice', 'the adopted programme was replaced without asking');
        assert.equal(env.calls.restoreDatabase, 0);
        assert.equal(outcome.summary.local.readyProgramCount, 1);
      });
    },
  },
  {
    name: 'account hook: a restore after a delete turns the automatic backup back on',
    async run() {
      const local = database({ workoutSessions: [workout('a')] });
      // Asked, then restored.
      await withHook({ local, stored: syncedAccount(local), cloud: cloudCopy(local) }, async (env) => {
        assert.equal(await env.api.deleteRemoteBackup(), 'done');
        assert.equal(env.store.account.autoBackupPaused, true);
        // Another phone on the account writes a copy; this one restores it.
        env.server.blob = cloudCopy(database({ workoutSessions: workouts(6) }));
        await env.settle();
        assert.equal((await env.api.backUpOrAsk()).kind, 'choice');
        await env.settle();
        assert.equal(await env.api.resolveRestoreChoice('restore'), 'done');
        assert.equal(env.store.account.autoBackupPaused, false, 'the row showed a fresh backup while backups stayed off');
        await env.settle();
        await env.edit((db) => ({ ...db, preferences: { ...db.preferences, profileName: 'Sanna' } }));
        await env.advance(QUIET_MS);
        assert.equal(env.calls.upload, 1);
      });
      // Restored without asking (this phone was empty).
      const paused = syncedAccount(database(), { lastBackupAt: null, lastBackupItemCount: null, lastBackupFingerprint: null, autoBackupPaused: true });
      await withHook({ local: database(), stored: paused, cloud: cloudCopy(database({ workoutSessions: workouts(3) })) }, async (env) => {
        assert.equal((await env.api.backUpOrAsk()).kind, 'restored');
        assert.equal(env.store.account.autoBackupPaused, false);
      });
    },
  },
  {
    name: 'account hook: a restore that fails after Reset does not write the old database back',
    async run() {
      await withHook({ local: database(), cloud: cloudCopy(database({ workoutSessions: workouts(3) })) }, async (env) => {
        env.app.gates.history = deferred();
        env.app.historyWriteError = new Error('database or disk is full');
        const pending = env.api.signIn();
        await env.settle();
        assert.equal(env.calls.restoreHistory, 1);
        // Reset: signs out, then wipes.
        await env.api.signOut();
        env.app.database = database();
        env.app.gates.history.resolve();
        const originalError = console.error;
        console.error = () => undefined;
        try {
          assert.equal((await pending).kind, 'cancelled');
        } finally {
          console.error = originalError;
        }
        assert.equal(env.calls.restoreDatabase, 1, 'the rollback wrote the pre-restore database over the reset');
        assert.equal(env.store.account, null);
      });
    },
  },
  {
    name: 'account hook: nothing is backed up until the workout store has loaded too',
    async run() {
      const local = database({ workoutSessions: [workout('a')] });
      const loaded = {
        sessions: [{ sessionId: 'a', templateId: 'tpl_x', templateSessionId: null, templateName: 'Push', performedAt: '2026-09-01T10:00:00.000Z' }],
        slotHistory: {},
        lastSelectedTemplateId: 'tpl_x',
      };
      await withHook({ local, stored: syncedAccount(local, { lastBackupFingerprint: null }) }, async (env) => {
        // The database is in; the player's store is still loading (or on its
        // Retry screen), holding the empty history it starts with.
        env.app.hydrated = false;
        await env.edit((db) => ({ ...db, preferences: { ...db.preferences, profileName: 'Sanna' } }));
        await env.advance(QUIET_MS);
        await env.foreground();
        await env.advance(QUIET_MS);
        assert.equal(env.calls.upload, 0, 'an empty history was uploaded before the real one loaded');

        env.app.history = loaded;
        env.app.hydrated = true;
        await env.settle();
        await env.advance(QUIET_MS);
        assert.equal(env.calls.upload, 1);
        assert.equal(env.server.blob.workoutHistory.sessions.length, 1);
      });
    },
  },
  {
    name: 'account hook: restore-or-keep shows both sides, and says when keeping this phone shrinks the cloud copy',
    async run() {
      const local = database({
        workoutSessions: [workout('mine')],
        workoutTemplates: [{ id: 'tpl_mine', name: 'Mine', exerciseIds: [], sessions: [], createdAt: 'a', updatedAt: 'b', origin: 'authored' }],
      });
      await withHook({ local, cloud: cloudCopy(database({ workoutSessions: workouts(10) })) }, async (env) => {
        const outcome = await env.api.signIn();
        assert.equal(outcome.kind, 'choice');
        assert.equal(outcome.summary.local.workoutCount, 1);
        assert.equal(outcome.summary.local.customProgramCount, 1);
        assert.equal(outcome.summary.local.workoutInProgress, false);
        assert.equal(outcome.summary.cloud.workoutCount, 10);
        assert.equal(outcome.summary.keepingLocalShrinksCloud, true);
        // Nothing is written while the question is open.
        assert.equal(env.calls.upload, 0);
        await env.settle();
        assert.equal(await env.api.resolveRestoreChoice('keep_local'), 'done');
        assert.equal(env.server.blob.database.workoutSessions.length, 1);
      });
      const bigger = database({ workoutSessions: workouts(8) });
      await withHook({ local: bigger, cloud: cloudCopy(database({ workoutSessions: workouts(10) })) }, async (env) => {
        const outcome = await env.api.signIn();
        assert.equal(outcome.kind, 'choice');
        assert.equal(outcome.summary.keepingLocalShrinksCloud, false, 'eight of ten is a reader tidying, not a loss');
      });
    },
  },
  {
    name: 'account hook: offline keeps the reader signed in; only Google having no credential signs them out',
    async run() {
      const local = database({ workoutSessions: [workout('a')] });
      await withHook({ local, stored: syncedAccount(local, { lastBackupFingerprint: null }) }, async (env) => {
        env.google.silent = { status: 'error' };
        assert.equal((await env.api.backUpOrAsk()).kind, 'failed');
        await env.settle();
        assert.equal(env.api.state.status, 'signed_in', 'being offline signed the reader out');
        assert.notEqual(env.store.account, null);

        env.google.silent = { status: 'signed_out' };
        assert.equal((await env.api.backUpOrAsk()).kind, 'failed');
        await env.settle();
        assert.equal(env.api.state.status, 'signed_out');
        assert.equal(env.store.account, null);
      });
    },
  },
  {
    name: 'account hook: an edit reaches the cloud copy, and a failed upload is tried again when the app returns',
    async run() {
      const local = database({ workoutSessions: [workout('a')] });
      await withHook({ local, stored: syncedAccount(local) }, async (env) => {
        await env.advance(QUIET_MS);
        assert.equal(env.calls.upload, 0, 'unchanged data was uploaded');

        // A corrected workout: no count moves.
        await env.edit((db) => ({ ...db, workoutSessions: [workout('a', { sessionNotes: 'felt heavy' })] }));
        await env.advance(QUIET_MS);
        assert.equal(env.calls.upload, 1, 'an edited workout never reached the cloud copy');
        assert.equal(env.store.account.lastBackupFingerprint, lib.accountBackupFingerprint(env.app.database, env.app.history));

        // A setting, and this time the network is down.
        env.server.uploadError = 'NETWORK';
        const before = env.store.account.lastBackupFingerprint;
        await env.edit((db) => ({ ...db, preferences: { ...db.preferences, profileName: 'Sanna' } }));
        await env.advance(QUIET_MS);
        assert.equal(env.calls.upload, 2);
        assert.equal(env.store.account.lastBackupFingerprint, before, 'a failed upload was marked as done');
        // No retry loop while offline.
        await env.advance(QUIET_MS);
        await env.advance(QUIET_MS);
        assert.equal(env.calls.upload, 2);

        env.server.uploadError = null;
        await env.foreground();
        await env.advance(QUIET_MS);
        assert.equal(env.calls.upload, 3, 'coming back to the app did not retry');
        assert.equal(env.server.blob.database.preferences.profileName, 'Sanna');
        assert.notEqual(env.store.account.lastBackupFingerprint, before);
      });
    },
  },
  {
    name: 'account hook: "Back up now" on a phone holding far less than the cloud asks instead of overwriting',
    async run() {
      const full = database({ workoutSessions: workouts(40) });
      const emptied = database();
      await withHook({ local: emptied, stored: syncedAccount(full, { lastBackupFingerprint: null }), cloud: cloudCopy(full) }, async (env) => {
        // Unattended, it does not even look.
        await env.edit((db) => ({ ...db, bodyweightEntries: [{ id: 'bw', recordedAt: 't', weight: 80 }] }));
        await env.advance(QUIET_MS);
        assert.equal(env.calls.download + env.calls.upload, 0);

        const outcome = await env.api.backUpOrAsk();
        assert.equal(outcome.kind, 'choice', 'the one good copy was overwritten by an emptied phone');
        assert.equal(env.calls.upload, 0);
        assert.equal(outcome.summary.cloud.workoutCount, 40);
        assert.equal(outcome.summary.local.workoutCount, 0);
        assert.equal(outcome.summary.keepingLocalShrinksCloud, true);
        await env.settle();
        assert.equal(await env.api.resolveRestoreChoice('restore'), 'done');
        assert.equal(env.app.database.workoutSessions.length, 40);
      });
      // A copy whose size this phone never learned is read first too.
      await withHook(
        { local: database({ workoutSessions: [workout('a')] }), stored: syncedAccount(full, { lastBackupItemCount: null }), cloud: cloudCopy(full) },
        async (env) => {
          assert.equal((await env.api.backUpOrAsk()).kind, 'choice');
          assert.equal(env.calls.upload, 0);
        },
      );
    },
  },
  {
    name: 'account hook: deleting the cloud copy holds a phase, says when it failed, and keeps the automatic backup away',
    async run() {
      const local = database({ workoutSessions: [workout('a')] });
      await withHook({ local, stored: syncedAccount(local), cloud: cloudCopy(local) }, async (env) => {
        env.server.gates.delete = deferred();
        const pending = env.api.deleteRemoteBackup();
        await env.settle();
        assert.equal(env.api.phase, 'deleting', 'Sign out stayed enabled while the delete ran');
        env.server.gates.delete.resolve();
        assert.equal(await pending, 'done');
        await env.settle();
        assert.equal(env.api.state.lastBackupAt, null);
        assert.equal(env.api.phase, 'idle');

        // The next weigh-in does not write the history back.
        await env.edit((db) => ({ ...db, bodyweightEntries: [{ id: 'bw', recordedAt: 't', weight: 80 }] }));
        await env.advance(QUIET_MS);
        await env.foreground();
        await env.advance(QUIET_MS);
        assert.equal(env.calls.upload + env.calls.download, 0, 'the delete was undone by the automatic backup');
        assert.equal(env.server.blob, null);

        // The reader's own backup starts it again.
        assert.equal((await env.api.backUpOrAsk()).kind, 'backed_up');
        assert.equal(env.store.account.autoBackupPaused, false);
      });
      // An automatic upload already on its way when Delete is confirmed: the
      // delete waits for it, or the upload lands after it and brings the copy back.
      await withHook({ local, stored: syncedAccount(local), cloud: cloudCopy(local) }, async (env) => {
        env.server.gates.upload = deferred();
        await env.edit((db) => ({ ...db, bodyweightEntries: [{ id: 'bw', recordedAt: 't', weight: 80 }] }));
        await env.advance(QUIET_MS);
        assert.equal(env.calls.upload, 1);
        const pending = env.api.deleteRemoteBackup();
        await flush();
        assert.equal(env.calls.delete, 0, 'the delete ran beside an upload that would undo it');
        env.server.gates.upload.resolve();
        assert.equal(await pending, 'done');
        assert.equal(env.calls.delete, 1);
        assert.equal(env.server.blob, null);
        assert.equal(env.store.account.autoBackupPaused, true);
        assert.equal(env.store.account.lastBackupAt, null);
      });
      await withHook({ local, stored: syncedAccount(local), cloud: cloudCopy(local) }, async (env) => {
        env.server.deleteOk = false;
        assert.equal(await env.api.deleteRemoteBackup(), 'failed');
        assert.equal(env.store.account.lastBackupAt, '2026-09-10T08:00:00.000Z', 'a failed delete cleared the backup row');
        assert.equal(env.store.account.autoBackupPaused, false);
      });
    },
  },
  {
    name: 'account hook: sign-out overtakes a running upload and a running sign-in',
    async run() {
      const local = database({ workoutSessions: [workout('a')] });
      await withHook({ local, stored: syncedAccount(local, { lastBackupFingerprint: null }) }, async (env) => {
        env.server.gates.upload = deferred();
        const pending = env.api.backUpOrAsk();
        await flush();
        assert.equal(env.calls.upload, 1);
        await env.api.signOut();
        env.server.gates.upload.resolve();
        assert.equal((await pending).kind, 'cancelled');
        await env.settle();
        assert.equal(env.store.account, null, 'the upload signed the account back in');
        assert.equal(env.api.state.status, 'signed_out');
        assert.equal(env.api.phase, 'idle');
      });
      await withHook({ local: database(), cloud: cloudCopy(database({ workoutSessions: workouts(3) })) }, async (env) => {
        env.server.gates.download = deferred();
        const pending = env.api.signIn();
        await flush();
        await env.api.signOut();
        env.server.gates.download.resolve();
        assert.equal((await pending).kind, 'cancelled');
        assert.equal(env.calls.restoreDatabase, 0, 'the backup was restored onto a phone that had just been reset');
        assert.equal(env.store.account, null);
      });
    },
  },
  {
    name: 'account hook: a sign-in whose backup failed is reported as a backup failure, signed in',
    async run() {
      await withHook({ local: database(), cloud: null }, async (env) => {
        env.server.downloadError = 'STORE_UNAVAILABLE';
        assert.equal((await env.api.signIn()).kind, 'not_backed_up');
        await env.settle();
        assert.equal(env.api.state.status, 'signed_in');
      });
      await withHook({ local: database({ workoutSessions: [workout('a')] }), cloud: null }, async (env) => {
        env.server.uploadError = 'NETWORK';
        assert.equal((await env.api.signIn()).kind, 'not_backed_up');
        await env.settle();
        assert.equal(env.api.state.status, 'signed_in');
        assert.equal(env.api.state.lastBackupAt, null);
      });
    },
  },
  {
    name: 'account hook: "Backup restored" waits for the workout history on disk, and a refused write fails the restore',
    async run() {
      const cloud = cloudCopy(database({ workoutSessions: workouts(3) }));
      await withHook({ local: database(), cloud }, async (env) => {
        env.app.gates.history = deferred();
        let settled = false;
        const pending = env.api.signIn().then((outcome) => {
          settled = true;
          return outcome;
        });
        await env.settle();
        assert.equal(env.calls.restoreHistory, 1);
        assert.equal(settled, false, 'the restore was reported before the history was written');
        env.app.gates.history.resolve();
        assert.equal((await pending).kind, 'restored');
      });
      const quietly = async (work) => {
        const originalError = console.error;
        console.error = () => undefined;
        try {
          return await work();
        } finally {
          console.error = originalError;
        }
      };
      await withHook({ local: database(), cloud }, async (env) => {
        env.app.historyWriteError = new Error('database or disk is full');
        assert.equal((await quietly(() => env.api.signIn())).kind, 'restore_failed');
        assert.equal(env.store.account.lastBackupAt, null, 'a half-written restore was marked as synced');
        // "Nothing on this phone changed" is made true: the database goes back.
        assert.equal(env.calls.restoreDatabase, 2);
        assert.equal(env.app.database.workoutSessions.length, 0, 'the backup database stayed beside this phone\'s history');
      });
      // The same on the "Back up now" path, where the account was synced
      // before: it is left unsynced, so the automatic backup cannot write
      // this phone over the copy the reader chose.
      const full = database({ workoutSessions: workouts(40) });
      await withHook(
        { local: database(), stored: syncedAccount(full, { lastBackupFingerprint: null }), cloud: cloudCopy(full) },
        async (env) => {
          assert.equal((await env.api.backUpOrAsk()).kind, 'choice');
          await env.settle();
          env.app.historyWriteError = new Error('database or disk is full');
          assert.equal(await quietly(() => env.api.resolveRestoreChoice('restore')), 'failed');
          assert.equal(env.app.database.workoutSessions.length, 0);
          assert.equal(env.store.account.lastBackupAt, null);
          env.app.historyWriteError = null;
          await env.edit((db) => ({ ...db, workoutSessions: workouts(25) }));
          await env.advance(QUIET_MS);
          assert.equal(env.calls.upload, 0, 'a failed restore let the automatic backup replace the chosen copy');
          assert.equal(env.server.blob.database.workoutSessions.length, 40);
        },
      );
    },
  },
  {
    name: 'account hook: silent sign-in signs out only on no saved credential',
    async run() {
      const answers = [];
      const library = {
        GoogleSignin: {
          configure() {},
          async signInSilently() {
            const next = answers.shift();
            if (next instanceof Error) {
              throw next;
            }
            return next;
          },
        },
      };
      // The client id is read when the module loads, and the library when it
      // is first used — so the stub stays in the cache for the whole test.
      const savedId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
      const libraryFile = require.resolve('@react-native-google-signin/google-signin', { paths: [path.dirname(GOOGLE_AUTH)] });
      const savedLibrary = require.cache[libraryFile];
      process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = 'client.apps.googleusercontent.com';
      require.cache[libraryFile] = { id: libraryFile, filename: libraryFile, loaded: true, exports: library };
      try {
        const googleAuth = requireWithStubs(GOOGLE_AUTH, {});
        answers.push({ type: 'success', data: { idToken: 'fresh', user: { id: 'u', email: null, name: null } } });
        assert.deepEqual(await googleAuth.getFreshIdToken(), { status: 'ok', idToken: 'fresh' });
        // The library turns SIGN_IN_REQUIRED into this answer and throws everything else.
        answers.push({ type: 'noSavedCredentialFound', data: null });
        assert.deepEqual(await googleAuth.getFreshIdToken(), { status: 'signed_out' });
        answers.push(Object.assign(new Error('A network error occurred'), { code: '7' }));
        assert.deepEqual(await googleAuth.getFreshIdToken(), { status: 'error' }, 'offline read as signed out');
        answers.push({ type: 'success', data: { idToken: null, user: { id: 'u', email: null, name: null } } });
        assert.deepEqual(await googleAuth.getFreshIdToken(), { status: 'error' });
      } finally {
        if (savedId === undefined) {
          delete process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
        } else {
          process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = savedId;
        }
        if (savedLibrary) {
          require.cache[libraryFile] = savedLibrary;
        } else {
          delete require.cache[libraryFile];
        }
      }
    },
  },
  {
    name: 'account store: an account saved by an older build loads with the new fields defaulted',
    run() {
      assert.deepEqual(normalizeStoredAccount({ sub: 's', email: 'e', name: null, lastBackupAt: 'x', lastBackupItemCount: 4 }), {
        sub: 's',
        email: 'e',
        name: null,
        lastBackupAt: 'x',
        lastBackupItemCount: 4,
        // Unknown for an account stored before the history was counted: its
        // next backup looks at the copy first and learns it.
        lastBackupHistoryCount: null,
        lastBackupFingerprint: null,
        autoBackupPaused: false,
      });
      const odd = normalizeStoredAccount({
        sub: 's',
        lastBackupFingerprint: 7,
        autoBackupPaused: 'yes',
        lastBackupItemCount: -1,
        lastBackupHistoryCount: 'many',
      });
      assert.equal(odd.lastBackupFingerprint, null);
      assert.equal(odd.autoBackupPaused, false);
      assert.equal(odd.lastBackupItemCount, null);
      assert.equal(odd.lastBackupHistoryCount, null);
      assert.equal(normalizeStoredAccount({ sub: 's', lastBackupHistoryCount: 12.7 }).lastBackupHistoryCount, 12);
      assert.equal(normalizeStoredAccount({ sub: 's', lastBackupFingerprint: 'abc', autoBackupPaused: true }).autoBackupPaused, true);
      assert.equal(normalizeStoredAccount({ sub: '' }), null);
      assert.equal(normalizeStoredAccount(null), null);
    },
  },
];
