const assert = require('node:assert/strict');

const {
  MAX_PENDING_AI_LOG_DELETIONS,
  createAiLogDeletionRunner,
  normalizePendingAiLogDeletions,
  withPendingAiLogDeletion,
  withoutAiLogDeletions,
} = require('../../.test-dist/lib/aiLogDeletion.js');
const { buildAccountBackupPayload } = require('../../.test-dist/lib/accountBackup.js');
const { DEVICE_ONLY_PREFERENCE_FIELDS, keepDeviceEntitlement } = require('../../.test-dist/lib/proEntitlement.js');
const { createEmptyDatabase } = require('../../.test-dist/data/seed');

/**
 * A coach-log delete that failed is owed, not forgotten (decision 2026-09-17).
 * The privacy policy promises the kept copies go when permission is taken
 * back; Reset takes it back, and a network that was down at that moment used
 * to leave the copies behind with nothing left that could name them.
 */

const A = '0123abcd-0000-4000-8000-00000000000a';
const B = '0123abcd-0000-4000-8000-00000000000b';

/** A forget that answers from a script and counts its calls. */
function scriptedForget(answers) {
  const calls = [];
  const forget = async (logId) => {
    calls.push(logId);
    const answer = answers[logId];
    if (answer instanceof Error) {
      throw answer;
    }
    return { ok: answer === true, removed: 0 };
  };
  return { forget, calls };
}

module.exports = [
  {
    name: 'aiLogDeletion: the stored list keeps only labels, once each, and the newest when it overflows',
    run() {
      assert.deepEqual(normalizePendingAiLogDeletions(undefined), []);
      assert.deepEqual(normalizePendingAiLogDeletions('abc'), []);
      // A label ends up in a server path, so anything that is not one's shape is dropped.
      assert.deepEqual(normalizePendingAiLogDeletions([A, '../transcripts', 42, null, '', A, B]), [A, B]);

      const many = Array.from({ length: MAX_PENDING_AI_LOG_DELETIONS + 5 }, (_, index) =>
        `0123abcd-0000-4000-8000-${String(index).padStart(12, '0')}`,
      );
      const kept = normalizePendingAiLogDeletions(many);
      assert.equal(kept.length, MAX_PENDING_AI_LOG_DELETIONS);
      assert.equal(kept[kept.length - 1], many[many.length - 1], 'the newest label is the one kept');

      assert.deepEqual(withPendingAiLogDeletion([A], B), [A, B]);
      assert.deepEqual(withPendingAiLogDeletion([A], A), [A], 'a label is owed once');
      assert.deepEqual(withPendingAiLogDeletion([A], null), [A]);
      assert.deepEqual(withoutAiLogDeletions([A, B], [A]), [B]);
    },
  },
  {
    name: 'aiLogDeletion: a confirmed delete leaves the list, a failed one stays owed',
    async run() {
      const { forget, calls } = scriptedForget({ [A]: true, [B]: false });
      const deleted = [];
      const run = createAiLogDeletionRunner({
        live: true,
        forget,
        onDeleted: async (labels) => {
          deleted.push(...labels);
        },
      });

      assert.deepEqual(await run([A, B]), [B], 'the runner names what it could not confirm');
      assert.deepEqual(calls, [A, B]);
      assert.deepEqual(deleted, [A], 'only a confirmed label is taken off');

      // A delete that throws is a delete that did not happen.
      const throwing = createAiLogDeletionRunner({
        live: true,
        forget: scriptedForget({ [A]: new Error('offline') }).forget,
        onDeleted: async () => assert.fail('nothing was confirmed'),
      });
      assert.deepEqual(await throwing([A]), [A]);

      // The copies are gone even if the note of it failed to save: the reader
      // is not told otherwise, and the label stays for a harmless second ask.
      const unsaved = createAiLogDeletionRunner({
        live: true,
        forget: scriptedForget({ [A]: true }).forget,
        onDeleted: async () => {
          throw new Error('disk full');
        },
      });
      assert.deepEqual(await unsaved([A]), []);
    },
  },
  {
    name: 'aiLogDeletion: a build without the live coach sends nothing and reports nothing',
    async run() {
      // No server copy can come from such a build, so a reset there must not
      // toast on every press — and the labels stay owed for a build that can
      // reach the server, because an earlier one may have filed copies.
      const { forget, calls } = scriptedForget({ [A]: false });
      const run = createAiLogDeletionRunner({
        live: false,
        forget,
        onDeleted: async () => assert.fail('nothing was sent'),
      });
      assert.deepEqual(await run([A]), []);
      assert.deepEqual(calls, []);
    },
  },
  {
    name: 'aiLogDeletion: a label already on its way is asked once, and every caller hears the answer',
    async run() {
      let release;
      const gate = new Promise((resolve) => {
        release = resolve;
      });
      const calls = [];
      const run = createAiLogDeletionRunner({
        live: true,
        forget: async (logId) => {
          calls.push(logId);
          await gate;
          return { ok: false };
        },
        onDeleted: async () => undefined,
      });
      // The start-up retry and the reset, a moment apart.
      const retry = run([A]);
      const reset = run([A]);
      release();
      assert.deepEqual(await retry, [A]);
      assert.deepEqual(await reset, [A], 'the reset learns its label did not go');
      assert.deepEqual(calls, [A], 'one request for one label');

      // Once settled, the next foreground asks again.
      assert.deepEqual(await run([A]), [A]);
      assert.deepEqual(calls, [A, A]);
    },
  },
  {
    name: 'aiLogDeletion: the owed labels stay on this phone — not uploaded, not restored',
    run() {
      const device = { ...createEmptyDatabase('fi').preferences, pendingAiLogDeletions: [A] };
      const database = { ...createEmptyDatabase('fi'), preferences: device };

      const payload = buildAccountBackupPayload(database, { sessions: [], slotHistory: {}, lastSelectedTemplateId: null }, '2026-09-17T10:00:00.000Z');
      assert.deepEqual(payload.database.preferences.pendingAiLogDeletions, [], 'a backup must not carry the labels');
      assert.equal(payload.database.preferences.appLanguage, 'fi', 'the rest of the preferences still go');
      assert.deepEqual(database.preferences.pendingAiLogDeletions, [A], 'the phone’s own list is untouched');

      // A restore keeps this phone's list, whatever the backup says.
      assert.ok(DEVICE_ONLY_PREFERENCE_FIELDS.includes('pendingAiLogDeletions'));
      const fromBackup = { ...createEmptyDatabase('fi').preferences, pendingAiLogDeletions: [B] };
      assert.deepEqual(keepDeviceEntitlement(fromBackup, device).pendingAiLogDeletions, [A]);
    },
  },
  {
    name: 'aiLogDeletion: a backup from before the reset does not revive a label whose delete is owed',
    run() {
      // Reset while offline files A as owed; the cloud copy, made before the
      // reset, still says A with every line on. Restored as it was, the coach
      // would keep new copies under A and the next retry would delete them.
      const device = { ...createEmptyDatabase('fi').preferences, pendingAiLogDeletions: [A] };
      const backup = {
        ...createEmptyDatabase('fi').preferences,
        profileName: 'Sanna',
        aiLogId: A,
        aiLogChatConsent: true,
        aiLogComposerConsent: true,
        aiLogPhotoConsent: true,
      };
      const kept = keepDeviceEntitlement(backup, device);
      assert.equal(kept.aiLogId, null, 'the owed label is not handed back');
      assert.equal(kept.aiLogChatConsent, false);
      assert.equal(kept.aiLogComposerConsent, false);
      assert.equal(kept.aiLogPhotoConsent, false);
      assert.deepEqual(kept.pendingAiLogDeletions, [A], 'and its delete is still owed');
      assert.equal(kept.profileName, 'Sanna', 'the rest of the backup is restored');

      // A label nobody owes a delete for restores as it was.
      const other = keepDeviceEntitlement({ ...backup, aiLogId: B }, device);
      assert.equal(other.aiLogId, B);
      assert.equal(other.aiLogChatConsent, true);
    },
  },
  {
    name: 'aiLogDeletion: the app retries on start and on foreground, and Reset uses the same runner',
    run() {
      const fs = require('node:fs');
      const path = require('node:path');
      const root = path.join(__dirname, '..', '..');
      const code = (...parts) =>
        fs
          .readFileSync(path.join(root, ...parts), 'utf8')
          .replace(/\r\n/g, '\n')
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/^\s*\/\/.*$/gm, '');

      const hook = code('src', 'hooks', 'usePendingAiLogDeletions.ts');
      assert.match(hook, /live: isAiCoachLiveConfigured\(\),\s*forget: forgetAiCoachLog,/);
      assert.match(hook, /if \(!input\.hydrated\) \{\s*return undefined;\s*\}/);
      // Once when the load lands, and on every return to the foreground.
      assert.match(hook, /retry\(\);\s*const subscription = AppState\.addEventListener\('change', \(state\) => \{\s*if \(state === 'active'\) \{\s*retry\(\);/);
      assert.match(hook, /void run\(pendingRef\.current\);/);

      const app = code('App.tsx');
      assert.match(
        app,
        /const deletePendingAiLogs = usePendingAiLogDeletions\(\{\s*hydrated,\s*pending: preferences\.pendingAiLogDeletions,\s*clear: clearPendingAiLogDeletions,\s*\}\);/,
      );
      assert.match(app, /resetAllData: handleResetAllData,\s*deletePendingAiLogs,/);

      // The provider drops confirmed labels from the list as it is NOW, inside
      // the write queue — a retry older than a reset must not undo its filing.
      const provider = code('src', 'state', 'AppProvider.tsx');
      const clear = provider.slice(
        provider.indexOf('function clearPendingAiLogDeletions('),
        provider.indexOf('function resetAllData()'),
      );
      assert.match(clear, /return runExclusive\(async \(\) => \{\s*const current = databaseRef\.current;/);
      assert.match(clear, /withoutAiLogDeletions\(pending, deleted\)/);
      assert.match(clear, /await savePreferences\(next\.preferences\);/);
    },
  },
];
