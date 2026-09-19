const assert = require('node:assert/strict');

const { createFakeAsyncStorage, loadAgainstFake } = require('./fakeAsyncStorage.cjs');
const { createEmptyDatabase } = require('../../.test-dist/data/seed');
const { DEVICE_ONLY_PREFERENCE_FIELDS, canStartProTrial } = require('../../.test-dist/lib/proEntitlement');

/**
 * Reset erases the reader's data. It is not a factory reset of what this
 * install has been given, and it is not a switch to English (audit 2026-09-16).
 * These run the real resetDatabase / loadDatabase against the in-memory
 * AsyncStorage the other storage suites use.
 */

function loadDatabaseModule(fake, locale) {
  return loadAgainstFake(fake, (requireDist) => requireDist('storage/database.js'), { locale });
}

/** A reader two days into the trial, with a paid membership record and spent meters. */
function usedInstall(language) {
  const empty = createEmptyDatabase(language);
  return {
    ...empty,
    workoutSessions: [
      {
        id: 'workout_session_1',
        workoutTemplateId: 'workout_x',
        workoutTemplateSessionId: null,
        workoutNameSnapshot: 'Upper',
        sessionNotes: null,
        performedAt: '2026-09-15T09:00:00.000Z',
        startedAt: '2026-09-15T08:00:00.000Z',
        durationMinutes: 50,
        setsCompleted: 12,
        exercisesCompleted: 4,
        totalVolumeKg: 4200,
      },
    ],
    preferences: {
      ...empty.preferences,
      appLanguage: language,
      onboardingCompleted: true,
      promoProUntil: '2026-10-01T00:00:00.000Z',
      proTrialStartedAt: '2026-09-15T10:00:00.000Z',
      proTrialUntil: '2026-09-29T10:00:00.000Z',
      mockSubscriptionPurchasedAt: '2026-09-16T10:00:00.000Z',
      mockSubscriptionTerm: 'monthly',
      mockSubscriptionCancelledAt: '2026-09-16T11:00:00.000Z',
      aiCoachProQuota: { monthStart: '2026-09-01T00:00:00.000Z', used: 7 },
      coachDemoMomentsUsed: ['first_session', 'plateau'],
      firstLaunchAt: '2026-09-15T09:30:00.000Z',
      // The privacy answers are the reader's, and a reset takes them.
      aiLogId: 'abcdef0123456789',
      aiLogChatConsent: true,
      aiLogComposerConsent: true,
      aiLogPhotoConsent: true,
    },
  };
}

module.exports = [
  {
    name: 'reset: the trial, the membership and the meters stay with the install',
    async run() {
      const fake = createFakeAsyncStorage();
      const database = loadDatabaseModule(fake, 'fi_FI');
      const before = usedInstall('fi');
      await database.saveDatabase(before);
      await database.savePreferences(before.preferences);

      const cleared = await database.resetDatabase(before.preferences);
      const reloaded = await database.loadDatabase();

      for (const snapshot of [cleared, reloaded]) {
        assert.equal(snapshot.workoutSessions.length, 0, 'the log is erased');
        assert.equal(snapshot.preferences.onboardingCompleted, false, 'setup starts again');
        for (const field of DEVICE_ONLY_PREFERENCE_FIELDS) {
          if (field === 'pendingAiLogDeletions') {
            continue; // grows by the label; the next suite reads it
          }
          assert.deepEqual(snapshot.preferences[field], before.preferences[field], `${field} survives the reset`);
        }
        // The one that made Reset a trial dispenser.
        assert.equal(canStartProTrial(snapshot.preferences), false, 'a reset must not hand out the trial again');
        // Consent is not entitlement: it goes, and the caller deletes the
        // copies filed under the old label.
        assert.equal(snapshot.preferences.aiLogId, null);
        assert.equal(snapshot.preferences.aiLogChatConsent, false);
        assert.equal(snapshot.preferences.aiLogComposerConsent, false);
        assert.equal(snapshot.preferences.aiLogPhotoConsent, false);
      }
    },
  },
  {
    name: 'reset: the coach-log label is filed as a delete still owed, in the same write that clears it',
    async run() {
      const fake = createFakeAsyncStorage();
      const database = loadDatabaseModule(fake, 'fi_FI');
      const earlier = '0123abcd-0000-4000-8000-00000000000e';
      const before = usedInstall('fi');
      before.preferences.pendingAiLogDeletions = [earlier];
      await database.saveDatabase(before);
      await database.savePreferences(before.preferences);

      const cleared = await database.resetDatabase(before.preferences);
      // Read straight back from storage: a label that only lived in memory
      // would be lost with the app, and it is the only way to the copies.
      const reloaded = await database.loadDatabase();
      for (const snapshot of [cleared, reloaded]) {
        assert.equal(snapshot.preferences.aiLogId, null);
        assert.deepEqual(snapshot.preferences.pendingAiLogDeletions, [earlier, 'abcdef0123456789']);
      }

      // No label, nothing new owed; what was owed stays.
      const again = await database.resetDatabase(reloaded.preferences);
      assert.deepEqual(again.preferences.pendingAiLogDeletions, [earlier, 'abcdef0123456789']);
    },
  },
  {
    name: 'reset: an old install loads with nothing owed, and a stored list is cleaned on load',
    async run() {
      const fake = createFakeAsyncStorage();
      const database = loadDatabaseModule(fake, 'fi_FI');
      const empty = createEmptyDatabase('fi');
      const { pendingAiLogDeletions: _absent, ...oldPreferences } = empty.preferences;
      await database.saveDatabase({ ...empty, preferences: oldPreferences });
      assert.deepEqual((await database.loadDatabase()).preferences.pendingAiLogDeletions, []);

      const label = '0123abcd-0000-4000-8000-00000000000f';
      await database.savePreferences({
        ...empty.preferences,
        pendingAiLogDeletions: [label, '../../etc', 7, label, null],
      });
      assert.deepEqual((await database.loadDatabase()).preferences.pendingAiLogDeletions, [label]);

      await database.savePreferences({ ...empty.preferences, pendingAiLogDeletions: 'not a list' });
      assert.deepEqual((await database.loadDatabase()).preferences.pendingAiLogDeletions, []);
    },
  },
  {
    name: 'reset: the app opens in the phone’s language, as a new install does',
    async run() {
      // A Finnish phone came back from Reset in English: the blank database
      // was built with no language, and English is what that means.
      const finnish = createFakeAsyncStorage();
      const onFinnishPhone = loadDatabaseModule(finnish, 'fi_FI');
      const fi = usedInstall('fi');
      await onFinnishPhone.saveDatabase(fi);
      const clearedFi = await onFinnishPhone.resetDatabase(fi.preferences);
      assert.equal(clearedFi.preferences.appLanguage, 'fi');
      assert.equal((await onFinnishPhone.loadDatabase()).preferences.appLanguage, 'fi');

      // The phone decides, not the old choice: a reset keeps no preference the
      // reader set (database.ts), and a new install on this phone would open
      // in English too.
      const english = createFakeAsyncStorage();
      const onEnglishPhone = loadDatabaseModule(english, 'en_GB');
      await onEnglishPhone.saveDatabase(fi);
      const clearedEn = await onEnglishPhone.resetDatabase(fi.preferences);
      assert.equal(clearedEn.preferences.appLanguage, 'en');
    },
  },
  {
    name: 'reset: the provider hands over the live preferences',
    run() {
      const fs = require('node:fs');
      const path = require('node:path');
      const provider = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'state', 'AppProvider.tsx'), 'utf8');
      const reset = provider.slice(provider.indexOf('function resetAllData()'), provider.indexOf('function importWorkoutHistory'));
      assert.match(reset, /await resetDatabase\(databaseRef\.current\.preferences\)/);
    },
  },
];
