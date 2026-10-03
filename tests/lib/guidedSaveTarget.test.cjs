const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { createEmptyDatabase } = require('../../.test-dist/data/seed.js');
const { resolveGuidedSaveTarget } = require('../../.test-dist/lib/emptyWorkoutSession.js');
const { persistCompletedWorkoutSessionToDatabase } = require('../../.test-dist/state/completedWorkoutPersistence.js');
const { workoutReducer, workoutInitialState } = require('../../.test-dist/features/workout/workoutState.js');

/**
 * Finishing a guided session whose id a stored workout already holds (bug hunt 2026-10-03).
 *
 * The save lands before the clear; a lost clear brings the session back active, and the reader can add
 * sets and Finish again. The stored workout is the same one finished further, unless a stored set was
 * corrected or removed since.
 */

const set = (reps, weight, orderIndex = 0) => ({ orderIndex, weight, reps, kind: 'working', outcome: 'completed' });
const lift = (name, orderIndex, sets) => ({
  exerciseTemplateId: null,
  exerciseNameSnapshot: name,
  sets,
  tracked: true,
  orderIndex,
  skipped: false,
  sessionInserted: false,
});
const input = (logs, extra = {}) => ({
  sessionId: 'session_a',
  workoutTemplateId: 'tpl',
  workoutNameSnapshot: 'Day 1',
  logs,
  startedAt: '2026-10-03T09:00:00.000Z',
  performedAt: '2026-10-03T10:00:00.000Z',
  ...extra,
});
const saved = (logs) => persistCompletedWorkoutSessionToDatabase(createEmptyDatabase('en'), input(logs)).database;
const setsOf = (database, sessionId) =>
  database.exerciseLogs.filter((log) => log.sessionId === sessionId).flatMap((log) => log.sets.map((s) => `${log.exerciseNameSnapshot}:${s.reps}@${s.weight}`));

module.exports = [
  {
    name: 'guided finish under a stored id: the same sets are saved already, sets only added replace the row, a corrected or removed set earns an id of its own',
    run() {
      const first = [lift('Bench Press', 0, [set(8, 80, 0), set(8, 80, 1)])];
      const database = saved(first);
      assert.deepEqual(resolveGuidedSaveTarget(database, 'session_new', first), { sessionId: 'session_new', alreadySaved: false, replaceStored: false }, 'a free id is used as it is');
      assert.deepEqual(resolveGuidedSaveTarget(database, 'session_a', first), { sessionId: 'session_a', alreadySaved: true, replaceStored: false }, 'the finish that landed');
      const more = [lift('Bench Press', 0, [set(8, 80, 0), set(8, 80, 1), set(6, 85, 2)])];
      assert.deepEqual(resolveGuidedSaveTarget(database, 'session_a', more), { sessionId: 'session_a', alreadySaved: false, replaceStored: true }, 'sets only added: the same workout, finished further');
      const moreLifts = [...first, lift('Row', 1, [set(10, 60, 0)])];
      assert.equal(resolveGuidedSaveTarget(database, 'session_a', moreLifts).replaceStored, true, 'a lift added counts as added');
      const corrected = [lift('Bench Press', 0, [set(8, 80, 0), set(8, 82.5, 1), set(6, 85, 2)])];
      assert.deepEqual(resolveGuidedSaveTarget(database, 'session_a', corrected), { sessionId: 'session_a_b', alreadySaved: false, replaceStored: false }, 'a stored set that is gone: replacing would lose it');
      const removed = [lift('Bench Press', 0, [set(8, 80, 0)])];
      assert.equal(resolveGuidedSaveTarget(database, 'session_a', removed).sessionId, 'session_a_b', 'a removed set too');
    },
  },
  {
    name: 'persisting with replaceStored swaps the stored rows for the longer finish, once, and keeps what the reader added to the stored row since',
    run() {
      const first = [lift('Bench Press', 0, [set(8, 80, 0), set(8, 80, 1)])];
      let database = saved(first);
      database = {
        ...database,
        workoutSessions: database.workoutSessions.map((session) => ({ ...session, workoutNameSnapshot: 'Leg day', sessionNotes: 'felt strong', feel: 'hard' })),
      };
      const more = [lift('Bench Press', 0, [set(8, 80, 0), set(8, 80, 1), set(6, 85, 2)])];

      const withoutFlag = persistCompletedWorkoutSessionToDatabase(database, input(more));
      assert.equal(withoutFlag.didPersist, false, 'without the flag a taken id is a duplicate: dropped');
      assert.deepEqual(setsOf(withoutFlag.database, 'session_a'), setsOf(database, 'session_a'));

      const replaced = persistCompletedWorkoutSessionToDatabase(database, input(more, { replaceStored: true }));
      assert.equal(replaced.didPersist, true);
      assert.equal(replaced.database.workoutSessions.length, 1, 'one workout, not two');
      assert.deepEqual(setsOf(replaced.database, 'session_a').sort(), ['Bench Press:6@85', 'Bench Press:8@80', 'Bench Press:8@80']);
      const row = replaced.database.workoutSessions[0];
      assert.equal(row.setsCompleted, 3, 'the totals are the longer finish');
      assert.equal(row.workoutNameSnapshot, 'Leg day');
      assert.equal(row.sessionNotes, 'felt strong');
      assert.equal(row.feel, 'hard');
      assert.equal(replaced.summary.setsCompleted, 3);

      const noStored = persistCompletedWorkoutSessionToDatabase(createEmptyDatabase('en'), input(more, { replaceStored: true }));
      assert.equal(noStored.database.workoutSessions.length, 1, 'the flag with nothing stored is an ordinary save');
    },
  },
  {
    name: 'a replace the write finds no longer lossless is saved under an id of its own instead, and says which',
    run() {
      // The decision read a database where the stored workout was a subset; the one written holds a set the
      // finish lacks (the stored workout changed in between).
      const stale = [lift('Bench Press', 0, [set(8, 80, 0), set(8, 82.5, 1)])];
      const database = saved(stale);
      const finish = [lift('Bench Press', 0, [set(8, 80, 0), set(6, 85, 2)])];
      const result = persistCompletedWorkoutSessionToDatabase(database, input(finish, { replaceStored: true }));
      assert.equal(result.didPersist, true);
      assert.equal(result.summary.sessionId, 'session_a_b', 'the id it landed under');
      assert.deepEqual(setsOf(result.database, 'session_a'), setsOf(database, 'session_a'), 'the stored workout is untouched');
      assert.deepEqual(setsOf(result.database, 'session_a_b').sort(), ['Bench Press:6@85', 'Bench Press:8@80']);
      // The same sets already stored under the walked id are not written again.
      const again = persistCompletedWorkoutSessionToDatabase(result.database, input(finish, { replaceStored: true }));
      assert.equal(again.didPersist, false);
      assert.equal(again.summary.sessionId, 'session_a_b');
      assert.equal(again.database.workoutSessions.length, 2);
    },
  },
  {
    name: 'guided finish of a restored workout: not counted twice, compared with what came before it and not with itself, named as History names it',
    run() {
      const source = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'app', 'finishSaves.tsx'), 'utf8').replace(/\r\n/g, '\n');
      const fn = source.slice(source.indexOf('async function handleConfirmFinishWorkout()'), source.indexOf('const finishLoggedWorkoutSave = async'));
      // Counted at the first save only.
      assert.match(fn, /const alreadyCounted =\s*saveTarget\.alreadySaved \|\| \(saveTarget\.replaceStored && summary\.sessionId === adaptedSession\.sessionId\);/);
      assert.match(fn, /if \(!alreadyCounted\) \{\s*countWorkoutCompleted\(adaptedSession\.sessionId\);\s*\}/);
      // The insight, the record cards and the volume delta read the history without this session's own earlier version.
      assert.match(fn, /allPriorSessions: priorSessions,\s*allPriorExerciseLogs: priorExerciseLogs,/);
      assert.match(fn, /exercisePrLookup: priorPrLookup,/);
      assert.match(fn, /priorSessions,\s*\),/);
      assert.doesNotMatch(fn, /allPriorSessions: database\.workoutSessions/);
      // A replace keeps the stored name, and the summary shows it.
      assert.match(fn, /workoutName: shownName,/);
      // The id the write filed the sets under is the session's before anything is stamped.
      assert.ok(fn.indexOf('workout.adoptSessionId(summary.sessionId)') < fn.indexOf('workout.finishWorkout('));
    },
  },
  {
    name: 'session/adoptSessionId re-ids the running session before its save, and never a finished one',
    run() {
      const ex = { id: 'e1', exerciseName: 'Bench Press', slotId: 'press', role: 'primary', progressionPriority: 'high', trackingMode: 'load_and_reps', sets: 3, repsMin: 6, repsMax: 8, restSecondsMin: 90, restSecondsMax: 120, substitutionGroup: 'press' };
      const template = { id: 'tpl', name: 'Day', defaultScheduleMode: 'weekly', sessions: [{ id: 'day', name: 'Day', orderIndex: 0, exercises: [ex] }] };
      let state = workoutReducer({ ...workoutInitialState, hydrated: true }, { type: 'session/startFromRuntimeTemplate', payload: { template, sessionOrderIndex: 0, unitPreference: 'kg' } });
      const before = state.activeSession;
      assert.equal(workoutReducer(state, { type: 'session/adoptSessionId', payload: { sessionId: before.sessionId } }), state, 'the same id changes nothing');
      assert.equal(workoutReducer(state, { type: 'session/adoptSessionId', payload: { sessionId: '' } }), state, 'an empty id is refused');
      state = workoutReducer(state, { type: 'session/adoptSessionId', payload: { sessionId: 'session_b' } });
      assert.equal(state.activeSession.sessionId, 'session_b');
      assert.deepEqual({ ...state.activeSession, sessionId: before.sessionId }, before, 'nothing else about the session moved');
      state = workoutReducer(state, { type: 'set/updateDraft', payload: { slotId: 'press', setIndex: 0, patch: { loadText: '80', repsText: '8' } } });
      state = workoutReducer(state, { type: 'set/complete', payload: { slotId: 'press', setIndex: 0, nowMs: Date.now(), unitPreference: 'kg' } });
      state = workoutReducer(state, { type: 'session/finishWorkout', payload: { performedAt: '2026-10-03T10:00:00.000Z' } });
      assert.equal(state.history.sessions[0].sessionId, 'session_b', 'the history is stamped with the adopted id');
      assert.equal(Object.values(state.history.slotHistory).flat()[0].sessionId, 'session_b');
      const after = workoutReducer(state, { type: 'session/adoptSessionId', payload: { sessionId: 'session_c' } });
      assert.equal(after, state, 'a finished session keeps its id: it is its history\'s key');
      assert.equal(workoutReducer(workoutInitialState, { type: 'session/adoptSessionId', payload: { sessionId: 'x' } }), workoutInitialState, 'no session, nothing to re-id');
    },
  },
];
