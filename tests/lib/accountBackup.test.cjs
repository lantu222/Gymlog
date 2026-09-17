const assert = require('node:assert/strict');

const {
  ACCOUNT_BACKUP_VERSION,
  DEVICE_PRIVACY_PREFERENCE_FIELDS,
  accountBackupFingerprint,
  autoBackupWouldShrinkLog,
  buildAccountBackupPayload,
  countBackupContents,
  countBackupItems,
  decideAfterLook,
  describeAccountBackup,
  describeRestoreChoice,
  hasLocalDataWorthKeeping,
  parseAccountBackupPayload,
  planBackup,
  preferencesForRestore,
} = require('../../.test-dist/lib/accountBackup.js');
const { restoreQuestionCopy } = require('../../.test-dist/lib/accountBackupCopy.js');
const { DEVICE_ONLY_PREFERENCE_FIELDS, resolveProEntitlement } = require('../../.test-dist/lib/proEntitlement.js');
const { createEmptyDatabase } = require('../../.test-dist/data/seed');

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
          // Every free workout leaves a template behind; none is a programme.
          workoutTemplates: [{ id: 'tpl' }, { id: 'free_1', origin: 'freestyle' }, { id: 'free_2', origin: 'freestyle' }],
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
        measurementCount: 0,
        readyProgramCount: 0,
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
      assert.equal(hasLocalDataWorthKeeping(makeDatabase({ bodyweightEntries: [{ id: 'w', weight: 80 }] })), true);
      assert.equal(hasLocalDataWorthKeeping(makeDatabase({ workoutTemplates: [{ id: 't', createdAt: 'a', updatedAt: 'a' }] })), true);
      // Logged by hand like the rest; a measurements-only phone was overwritten unasked.
      assert.equal(hasLocalDataWorthKeeping(makeDatabase({ measurementEntries: [{ id: 'm' }] })), true);
    },
  },
  {
    // A new phone is set up before anyone signs in. Setup's own programme and
    // weigh-in made every new phone ask, and "Use the data on this phone"
    // replaced a year of history with them (user decision 2026-09-17).
    name: 'accountBackup: a phone holding only what setup wrote counts as empty',
    run() {
      const setupTemplate = { id: 'workout_1', origin: 'authored', createdAt: '2026-09-17T08:00:00.000Z', updatedAt: '2026-09-17T08:00:00.000Z' };
      const setupOnly = (overrides = {}) =>
        makeDatabase({
          preferences: { appLanguage: 'fi', setupCurrentWeightKg: 82 },
          workoutTemplates: [setupTemplate],
          workoutPlans: [{ id: 'onboarding_plan_workout_1', entries: [{}] }],
          bodyweightEntries: [{ id: 'bw', weight: 82 }],
          ...overrides,
        });
      assert.equal(hasLocalDataWorthKeeping(setupOnly()), false, 'setup alone made the phone ask');
      assert.equal(hasLocalDataWorthKeeping(setupOnly({ bodyweightEntries: [] })), false);
      assert.equal(hasLocalDataWorthKeeping(setupOnly({ workoutTemplates: [], workoutPlans: [] })), false);

      // Anything the reader did themselves still asks.
      assert.equal(hasLocalDataWorthKeeping(setupOnly({ workoutSessions: [{ id: 'a' }] })), true, 'a logged workout');
      assert.equal(
        hasLocalDataWorthKeeping(setupOnly({ workoutTemplates: [{ ...setupTemplate, updatedAt: '2026-09-17T09:00:00.000Z' }] })),
        true,
        'an edited setup programme',
      );
      assert.equal(hasLocalDataWorthKeeping(setupOnly({ workoutPlans: [{ id: 'ready_plan_workout_1', entries: [{}] }] })), true, 'a programme setup did not write');
      assert.equal(hasLocalDataWorthKeeping(setupOnly({ bodyweightEntries: [{ id: 'bw', weight: 81.5 }] })), true, 'a weigh-in that is not setup\'s number');
      assert.equal(
        hasLocalDataWorthKeeping(setupOnly({ bodyweightEntries: [{ id: 'bw', weight: 82 }, { id: 'bw2', weight: 82 }] })),
        true,
        'a second weigh-in',
      );
      assert.equal(
        hasLocalDataWorthKeeping(setupOnly({ workoutTemplates: [setupTemplate, { ...setupTemplate, id: 'free', origin: 'freestyle' }] })),
        true,
      );
      // A workout or run in progress: a restore would put it away.
      assert.equal(hasLocalDataWorthKeeping(setupOnly(), true), true, 'a live workout was restored over unasked');
      assert.equal(hasLocalDataWorthKeeping(makeDatabase(), true), true);
      assert.equal(hasLocalDataWorthKeeping(makeDatabase(), false), false);

      // An adopted ready programme is a plan and no template: it is data.
      const onboardingPlan = { id: 'onboarding_plan_workout_1', entries: [{ workoutTemplateId: 'workout_1' }] };
      const readyPlan = { id: 'ready_plan_tpl_gainer_full_body_v1', entries: [{ workoutTemplateId: 'tpl_gainer_full_body_v1' }] };
      const running = { appLanguage: 'fi', setupCurrentWeightKg: 82, activePlanId: onboardingPlan.id, activePlanIds: [onboardingPlan.id] };
      assert.equal(
        hasLocalDataWorthKeeping(setupOnly({ preferences: running, workoutPlans: [onboardingPlan] })),
        false,
        'setup\'s own running plan made the phone ask',
      );
      assert.equal(
        hasLocalDataWorthKeeping(
          setupOnly({
            preferences: { ...running, activePlanId: readyPlan.id, activePlanIds: [onboardingPlan.id, readyPlan.id] },
            workoutPlans: [onboardingPlan, readyPlan],
          }),
        ),
        true,
        'an adopted ready programme was restored over unasked',
      );
      assert.equal(hasLocalDataWorthKeeping(makeDatabase({ workoutPlans: [readyPlan] })), true);
      // A running-set id with no plan behind it is not a programme: a fresh
      // install carries the seed's default one exactly so.
      const fresh = createEmptyDatabase('fi');
      assert.ok(fresh.preferences.activePlanIds.length > 0 && fresh.workoutPlans.length === 0, 'the fresh-install shape this pins has changed');
      assert.equal(hasLocalDataWorthKeeping(fresh), false, 'every fresh install was asked');
      assert.equal(hasLocalDataWorthKeeping({ ...fresh, preferences: { ...fresh.preferences, activePlanId: readyPlan.id } }), false);

      // And the question counts it as a programme, on either side, once.
      assert.equal(countBackupContents(makeDatabase({ workoutPlans: [readyPlan, { ...readyPlan, id: 'ready_plan_again' }] })).readyProgramCount, 1);
      assert.equal(countBackupContents(setupOnly({ workoutPlans: [onboardingPlan] })).readyProgramCount, 0, 'setup\'s plan counted twice');
      assert.equal(
        countBackupContents(makeDatabase({ workoutTemplates: [{ id: 'mine' }], workoutPlans: [{ id: 'custom_plan_mine', entries: [{ workoutTemplateId: 'mine' }] }] })).readyProgramCount,
        0,
        'a built programme counted again through its plan',
      );
      assert.equal(countBackupContents({ workoutPlans: [null, { id: 'p', entries: null }, { id: 3 }] }).readyProgramCount, 0, 'an old backup with odd plans');
    },
  },
  {
    name: 'accountBackup: the restore question counts both sides, and flags a keep that would shrink the cloud copy',
    run() {
      const cloud = buildAccountBackupPayload(
        makeDatabase({ workoutSessions: new Array(12).fill({}), workoutTemplates: [{ id: 'a' }, { id: 'b' }, { id: 'f', origin: 'freestyle' }] }),
        HISTORY,
        '2026-09-12T10:00:00.000Z',
      );
      const small = makeDatabase({ workoutSessions: [{}], workoutTemplates: [{ id: 'mine' }] });
      const summary = describeRestoreChoice(cloud, small);
      assert.equal(summary.cloud.workoutCount, 12);
      assert.equal(summary.cloud.customProgramCount, 2);
      assert.deepEqual(summary.local, {
        workoutCount: 1,
        customProgramCount: 1,
        cardioCount: 0,
        bodyweightCount: 0,
        measurementCount: 0,
        readyProgramCount: 0,
        workoutInProgress: false,
      });
      assert.equal(summary.keepingLocalShrinksCloud, true);
      assert.equal(describeRestoreChoice(cloud, makeDatabase({ workoutSessions: new Array(10).fill({}) })).keepingLocalShrinksCloud, false);

      // The words: both sides, in the app's language, with the date the app writes.
      const fi = restoreQuestionCopy(summary, 'fi');
      assert.equal(
        fi.body,
        'Tililläsi on varmuuskopio (12.9.2026): 12 treeniä, 2 ohjelmaa. Tällä puhelimella on 1 treeni, 1 ohjelma. Kumpi pidetään? Toinen korvataan.',
      );
      assert.equal(fi.keepLocal, 'Käytä puhelimen tietoja');
      assert.ok(fi.replace, 'keeping a phone with less is not asked twice');
      assert.equal(
        fi.replace.body,
        'Varmuuskopiossa on 12 treeniä, 2 ohjelmaa. Se korvataan tämän puhelimen tiedoilla (1 treeni, 1 ohjelma), ja kaikki, mikä on vain varmuuskopiossa, menetetään.',
      );
      const en = restoreQuestionCopy(summary, 'en');
      assert.equal(
        en.body,
        'Your account has a backup from 9/12/2026: 12 workouts, 2 programs. This phone has 1 workout, 1 program. Which one do you keep? The other is replaced.',
      );
      assert.match(en.replace.body, /^The backup holds 12 workouts, 2 programs\. It is replaced by the data on this phone \(1 workout, 1 program\)/);
      assert.equal(en.replace.back, 'Back');
      assert.equal(restoreQuestionCopy({ ...summary, keepingLocalShrinksCloud: false }, 'en').replace, null);

      // The second question names everything that goes, not only workouts:
      // a backup of weigh-ins read as "the backup with 0 workouts".
      const weighIns = describeRestoreChoice(
        buildAccountBackupPayload(
          makeDatabase({ bodyweightEntries: new Array(300).fill({}), cardioSessions: [{}], measurementEntries: new Array(4).fill({}) }),
          HISTORY,
          '2026-09-12T10:00:00.000Z',
        ),
        makeDatabase(),
      );
      assert.equal(weighIns.keepingLocalShrinksCloud, true);
      assert.match(restoreQuestionCopy(weighIns, 'fi').replace.body, /^Varmuuskopiossa on 1 cardiotreeni, 300 punnitusta, 4 mittausta\. /);
      assert.match(restoreQuestionCopy(weighIns, 'en').replace.body, /^The backup holds 1 cardio session, 300 weigh-ins, 4 measurements\. /);

      // And this phone is counted the same way, in both questions: a phone of
      // weigh-ins and runs read "0 workouts, 0 programs", and "Restore backup"
      // looked free.
      const runner = describeRestoreChoice(
        cloud,
        makeDatabase({ bodyweightEntries: new Array(200).fill({}), cardioSessions: new Array(30).fill({}) }),
        true,
      );
      assert.deepEqual(runner.local, {
        workoutCount: 0,
        customProgramCount: 0,
        cardioCount: 30,
        bodyweightCount: 200,
        measurementCount: 0,
        readyProgramCount: 0,
        workoutInProgress: true,
      });
      assert.equal(runner.keepingLocalShrinksCloud, false);
      assert.equal(
        restoreQuestionCopy(runner, 'fi').body,
        'Tililläsi on varmuuskopio (12.9.2026): 12 treeniä, 2 ohjelmaa. Tällä puhelimella on 30 cardiotreeniä, 200 punnitusta, kesken oleva treeni. Kumpi pidetään? Toinen korvataan.',
      );
      assert.match(restoreQuestionCopy(runner, 'en').body, /This phone has 30 cardio sessions, 200 weigh-ins, a workout in progress\. /);
      const runnerShrinks = restoreQuestionCopy({ ...runner, keepingLocalShrinksCloud: true }, 'en');
      assert.match(runnerShrinks.replace.body, /by the data on this phone \(30 cardio sessions, 200 weigh-ins, a workout in progress\)/);
      // A phone whose only programme is an adopted one says so.
      const adopted = describeRestoreChoice(
        cloud,
        makeDatabase({ workoutPlans: [{ id: 'ready_plan_tpl_x', entries: [{ workoutTemplateId: 'tpl_x' }] }] }),
      );
      assert.match(restoreQuestionCopy(adopted, 'fi').body, /Tällä puhelimella on 1 ohjelma\. /);
      assert.match(restoreQuestionCopy(adopted, 'en').body, /This phone has 1 program\. /);
      // An empty phone still says what it has.
      assert.match(restoreQuestionCopy(describeRestoreChoice(cloud, makeDatabase()), 'fi').body, /Tällä puhelimella on 0 treeniä\. /);
    },
  },
  {
    name: 'accountBackup: a restore keeps this phone\'s Pro, meters and privacy answers, and counts the lead programme',
    run() {
      const device = {
        ...createEmptyDatabase('fi').preferences,
        usageStatisticsEnabled: false,
        aiLogId: null,
        aiLogChatConsent: false,
        aiLogComposerConsent: false,
        aiLogPhotoConsent: false,
        coachDemoMomentsUsed: ['day7'],
      };
      const restored = {
        ...createEmptyDatabase('en').preferences,
        profileName: 'Sanna',
        usageStatisticsEnabled: true,
        aiLogId: 'label-from-the-other-phone',
        aiLogChatConsent: true,
        aiLogComposerConsent: true,
        aiLogPhotoConsent: true,
        promoProUntil: '9999-01-01T00:00:00.000Z',
        coachDemoMomentsUsed: [],
        activePlanId: 'onboarding_plan_x',
        activePlanIds: ['ready_plan_y'],
      };
      const plans = [{ id: 'onboarding_plan_x', entries: [{}] }, { id: 'ready_plan_y', entries: [{}] }];
      const kept = preferencesForRestore(restored, device, plans);
      for (const field of [...DEVICE_PRIVACY_PREFERENCE_FIELDS, ...DEVICE_ONLY_PREFERENCE_FIELDS]) {
        assert.deepEqual(kept[field], device[field], `${field} came from the backup`);
      }
      assert.equal(resolveProEntitlement(kept).unlocked, false);
      assert.equal(kept.profileName, 'Sanna');
      assert.equal(kept.appLanguage, 'en');
      // The loader's step, applied to the restore too.
      assert.deepEqual(kept.activePlanIds, ['ready_plan_y', 'onboarding_plan_x']);
      assert.deepEqual(restored.activePlanIds, ['ready_plan_y'], 'the input was mutated');

      // Usage statistics default to yes, so a new phone's yes is nobody's
      // answer: a no on either side wins.
      const fresh = { ...createEmptyDatabase('fi').preferences };
      assert.equal(fresh.usageStatisticsEnabled, true, 'the default this rule is about has changed');
      const saidNo = { ...createEmptyDatabase('fi').preferences, usageStatisticsEnabled: false };
      assert.equal(preferencesForRestore(saidNo, fresh, []).usageStatisticsEnabled, false, 'the old phone\'s no became a yes');
      assert.equal(preferencesForRestore(fresh, saidNo, []).usageStatisticsEnabled, false);
      assert.equal(preferencesForRestore(fresh, { ...fresh }, []).usageStatisticsEnabled, true);
      // The consents default to no, so this phone's answer stays.
      assert.equal(preferencesForRestore({ ...fresh, aiLogChatConsent: true }, fresh, []).aiLogChatConsent, false);
    },
  },
  {
    // The automatic backup watched five counts, so an edit never reached the
    // cloud copy. The fingerprint moves with edits and stays with meters.
    name: 'accountBackup: the backup fingerprint moves with edits, and not with meters or privacy answers',
    run() {
      const base = createEmptyDatabase('fi');
      const db = {
        ...base,
        workoutSessions: [{ id: 's1', workoutTemplateId: 't1', workoutNameSnapshot: 'Push', performedAt: 'x' }],
        workoutTemplates: [{ id: 't1', name: 'Mine', exerciseIds: [], sessions: [], createdAt: 'a', updatedAt: 'a', origin: 'authored' }],
        exerciseNameBook: [],
      };
      const history = { sessions: [], slotHistory: {}, lastSelectedTemplateId: null };
      const print = accountBackupFingerprint(db, history);
      assert.equal(accountBackupFingerprint(JSON.parse(JSON.stringify(db)), { ...history }), print, 'the same data printed twice differs');

      const changed = {
        'a corrected workout': { ...db, workoutSessions: [{ ...db.workoutSessions[0], sessionNotes: 'fixed' }] },
        'a renamed workout': { ...db, workoutSessions: [{ ...db.workoutSessions[0], workoutNameSnapshot: 'Pull' }] },
        'a workout feel': { ...db, workoutSessions: [{ ...db.workoutSessions[0], feel: 'hard' }] },
        'an edited programme': { ...db, workoutTemplates: [{ ...db.workoutTemplates[0], updatedAt: 'b' }] },
        'a taught name': { ...db, exerciseNameBook: [{ wrote: 'penkki', name: 'Bench Press', libraryItemId: null }] },
        'a goal': { ...db, preferences: { ...db.preferences, bodyweightGoalKg: 75 } },
        'a setting': { ...db, preferences: { ...db.preferences, hapticsEnabled: !db.preferences.hapticsEnabled } },
        'a weigh-in': { ...db, bodyweightEntries: [{ id: 'b', recordedAt: 'x', weight: 80 }] },
        'an exercise log': { ...db, exerciseLogs: [{ id: 'l' }] },
        'a plan': { ...db, workoutPlans: [{ id: 'p', entries: [] }] },
      };
      for (const [what, next] of Object.entries(changed)) {
        assert.notEqual(accountBackupFingerprint(next, history), print, `${what} did not move the fingerprint`);
      }
      assert.notEqual(
        accountBackupFingerprint(db, { ...history, sessions: [{ sessionId: 'n', performedAt: 'y' }] }),
        print,
        'a finished player session did not move it',
      );

      // Not restored, so not worth a multi-megabyte upload each time.
      const meters = {
        ...db,
        preferences: {
          ...db.preferences,
          aiCoachProQuota: { monthStart: '2026-09-01', used: 9 },
          coachDemoMomentsUsed: ['day7'],
          usageStatisticsEnabled: !db.preferences.usageStatisticsEnabled,
          aiLogChatConsent: !db.preferences.aiLogChatConsent,
        },
      };
      assert.equal(accountBackupFingerprint(meters, history), print);
      // The exercise library is regenerated on load and never uploaded.
      assert.equal(accountBackupFingerprint({ ...db, exerciseLibrary: [] }, history), print);
    },
  },
  {
    name: 'accountBackup: what a backup may do before and after it reads the cloud copy',
    run() {
      const synced = { lastBackupAt: '2026-09-10T08:00:00.000Z', lastBackupItemCount: 40, autoBackupPaused: false };
      // Nothing to worry about: straight up.
      assert.equal(planBackup({ interactive: false, sync: synced, localItemCount: 41 }), 'upload');
      assert.equal(planBackup({ interactive: true, sync: synced, localItemCount: 41 }), 'upload');
      // A phone holding far less: the automatic path stays out, "Back up now" looks and asks.
      assert.equal(planBackup({ interactive: false, sync: synced, localItemCount: 3 }), 'skip');
      assert.equal(planBackup({ interactive: true, sync: synced, localItemCount: 3 }), 'look', '"Back up now" skipped the shrink check');
      // Never synced, or the size never learned: look first, either way.
      for (const interactive of [false, true]) {
        assert.equal(planBackup({ interactive, sync: { ...synced, lastBackupAt: null }, localItemCount: 41 }), 'look');
        assert.equal(planBackup({ interactive, sync: { ...synced, lastBackupItemCount: null }, localItemCount: 41 }), 'look');
      }
      // After "Delete cloud backup" only the reader backs up.
      const paused = { lastBackupAt: null, lastBackupItemCount: null, autoBackupPaused: true };
      assert.equal(planBackup({ interactive: false, sync: paused, localItemCount: 5 }), 'skip', 'the delete was undone by the next weigh-in');
      assert.equal(planBackup({ interactive: true, sync: paused, localItemCount: 5 }), 'look');

      const backup = (itemCount) => ({ kind: 'backup', itemCount });
      // Never synced: the reader gets sign-in's question; unattended, only "no backup" uploads.
      assert.equal(decideAfterLook({ interactive: true, neverSynced: true, remote: backup(40), localItemCount: 0 }), 'settle');
      assert.equal(decideAfterLook({ interactive: true, neverSynced: true, remote: { kind: 'unreachable' }, localItemCount: 0 }), 'settle');
      assert.equal(decideAfterLook({ interactive: false, neverSynced: true, remote: { kind: 'none' }, localItemCount: 0 }), 'upload');
      assert.equal(decideAfterLook({ interactive: false, neverSynced: true, remote: backup(1), localItemCount: 9 }), 'fail');
      assert.equal(decideAfterLook({ interactive: false, neverSynced: true, remote: { kind: 'unreachable' }, localItemCount: 9 }), 'fail');
      // Synced.
      assert.equal(decideAfterLook({ interactive: true, neverSynced: false, remote: backup(40), localItemCount: 3 }), 'ask');
      assert.equal(decideAfterLook({ interactive: false, neverSynced: false, remote: backup(40), localItemCount: 3 }), 'hold');
      assert.equal(decideAfterLook({ interactive: true, neverSynced: false, remote: backup(40), localItemCount: 30 }), 'upload');
      assert.equal(decideAfterLook({ interactive: true, neverSynced: false, remote: { kind: 'none' }, localItemCount: 0 }), 'upload');
      assert.equal(decideAfterLook({ interactive: true, neverSynced: false, remote: { kind: 'unreachable' }, localItemCount: 30 }), 'fail');
    },
  },
  {
    // A phone whose database was set aside as unreadable opens empty and still
    // signed in; its next automatic backup replaced the one full copy left.
    name: 'accountBackup: the automatic backup will not replace a copy holding more than twice the log',
    run() {
      // Counted over everything the backup watches, not workouts alone: two
      // workouts and a year of weigh-ins is a log worth protecting.
      assert.equal(
        countBackupItems(makeDatabase({ workoutSessions: [{}, {}], bodyweightEntries: new Array(40).fill({}), workoutTemplates: [{}] })),
        43,
      );
      assert.equal(countBackupItems({ workoutSessions: [{}] }), 1, 'an old backup missing arrays counts what it has');
      assert.equal(autoBackupWouldShrinkLog(countBackupItems(makeDatabase({ bodyweightEntries: [{}] })), 43), true);

      // A quarantined phone: nothing, or one workout, against a real history.
      assert.equal(autoBackupWouldShrinkLog(0, 40), true);
      assert.equal(autoBackupWouldShrinkLog(1, 40), true);
      assert.equal(autoBackupWouldShrinkLog(19, 40), true);
      // Half or more is a reader tidying their history, and it backs up.
      assert.equal(autoBackupWouldShrinkLog(20, 40), false);
      assert.equal(autoBackupWouldShrinkLog(41, 40), false);
      // Too small a copy to judge, and an account from before the count was kept.
      assert.equal(autoBackupWouldShrinkLog(0, 2), false);
      assert.equal(autoBackupWouldShrinkLog(0, null), false);
    },
  },
];
