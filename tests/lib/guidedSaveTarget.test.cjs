const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { createEmptyDatabase } = require('../../.test-dist/data/seed.js');
const { resolveGuidedSaveTarget, mergeStoredWorkoutLogs } = require('../../.test-dist/lib/emptyWorkoutSession.js');
const { persistCompletedWorkoutSessionToDatabase } = require('../../.test-dist/state/completedWorkoutPersistence.js');
const { workoutReducer, workoutInitialState } = require('../../.test-dist/features/workout/workoutState.js');

/**
 * Finishing a guided session whose id a stored workout already holds (bug hunt 2026-10-03).
 *
 * The save lands before the clear; a lost clear brings the session back active, and the reader can add
 * sets, correct one or take one back, and Finish again. It is the same workout: merged with what is
 * stored under the same id, so no stored set is lost and none is counted twice. (Until 2026-10-03 a finish
 * lacking a stored set was saved beside it under `<id>_b`, every shared set counted twice.)
 */

// A done set as the guided player saves it: logged at a moment, in a slot, at a place in it.
const at = (minute) => `2026-10-03T09:${String(minute).padStart(2, '0')}:00.000Z`;
const set = (reps, weight, orderIndex = 0, minute = orderIndex) => ({
  orderIndex,
  weight,
  reps,
  kind: 'working',
  outcome: 'completed',
  status: 'completed',
  completedAt: at(minute),
});
const pending = (orderIndex) => ({ orderIndex, weight: 0, reps: 0, kind: 'working', outcome: null, status: 'pending', completedAt: null });
const lift = (name, orderIndex, sets, slotId = name.toLowerCase().replace(/\s+/g, '_')) => ({
  exerciseTemplateId: null,
  exerciseNameSnapshot: name,
  sets,
  tracked: true,
  orderIndex,
  skipped: false,
  sessionInserted: false,
  slotId,
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
const doneOf = (logs) =>
  [...logs]
    .sort((x, y) => x.orderIndex - y.orderIndex)
    .flatMap((log) => log.sets.filter((s) => s.status === 'completed').map((s) => `${log.exerciseNameSnapshot}:${s.reps}@${s.weight}`));
const setsOf = (database, sessionId) => doneOf(database.exerciseLogs.filter((log) => log.sessionId === sessionId));
const storedLogs = (database) => database.exerciseLogs.filter((log) => log.sessionId === 'session_a');
const merge = (database, logs) => doneOf(mergeStoredWorkoutLogs(storedLogs(database), logs));

module.exports = [
  {
    name: 'guided finish under a stored id: the same sets are saved already, anything else merges with the stored workout under the same id',
    run() {
      const first = [lift('Bench Press', 0, [set(8, 80, 0), set(8, 80, 1)])];
      const database = saved(first);
      assert.deepEqual(resolveGuidedSaveTarget(database, 'session_new', first), { alreadySaved: false, mergeStored: false }, 'a free id is used as it is');
      assert.deepEqual(resolveGuidedSaveTarget(database, 'session_a', first), { alreadySaved: true, mergeStored: true }, 'the finish that landed');
      const more = [lift('Bench Press', 0, [set(8, 80, 0), set(8, 80, 1), set(6, 85, 2)])];
      assert.deepEqual(resolveGuidedSaveTarget(database, 'session_a', more), { alreadySaved: false, mergeStored: true }, 'sets added');
      const corrected = [lift('Bench Press', 0, [set(8, 80, 0), set(8, 82.5, 1), set(6, 85, 2)])];
      assert.deepEqual(resolveGuidedSaveTarget(database, 'session_a', corrected), { alreadySaved: false, mergeStored: true }, 'a set corrected: the same id, never an id of its own');
      // The returned session came from a bundle written before the second set: it knows only the first.
      const stale = [lift('Bench Press', 0, [set(8, 80, 0), pending(1)])];
      assert.deepEqual(resolveGuidedSaveTarget(database, 'session_a', stale), { alreadySaved: true, mergeStored: true }, 'a finish that knows less than is stored adds nothing');
    },
  },
  {
    name: 'the merge: a correction replaces its set, a stored set the finish lacks is kept, a new set is added, and nothing is counted twice',
    run() {
      const database = saved([
        lift('Bench Press', 0, [set(8, 80, 0), set(8, 80, 1), set(8, 80, 2)]),
        lift('Row', 1, [set(10, 60, 0, 10)]),
      ]);
      // Corrected in the returned session: the same set (the same moment), a new value. Once, corrected.
      assert.deepEqual(
        merge(database, [lift('Bench Press', 0, [set(8, 80, 0), set(8, 82.5, 1), set(8, 80, 2)]), lift('Row', 1, [set(10, 60, 0, 10)])]),
        ['Bench Press:8@80', 'Bench Press:8@82.5', 'Bench Press:8@80', 'Row:10@60'],
      );
      // A stale bundle: the third bench set and the row were logged after it was written. The reader logs another
      // bench set at the place the stale session shows as open, later. All of them stay, in order.
      assert.deepEqual(
        merge(database, [lift('Bench Press', 0, [set(8, 80, 0), set(8, 80, 1), set(6, 85, 2, 30)]), lift('Row', 1, [pending(0)])]),
        ['Bench Press:8@80', 'Bench Press:8@80', 'Bench Press:8@80', 'Bench Press:6@85', 'Row:10@60'],
      );
      // A lift the finish has no row for at all keeps its stored row.
      const merged = mergeStoredWorkoutLogs(storedLogs(database), [lift('Bench Press', 0, [set(8, 80, 0), set(8, 80, 1), set(8, 80, 2)])]);
      assert.equal(merged.length, 2);
      assert.equal(merged[1].exerciseNameSnapshot, 'Row');
      assert.equal(merged[1].slotId, 'row');
      assert.deepEqual(merged[1].sets.map((s) => `${s.reps}@${s.weight}`), ['10@60']);
      // Taken back and logged again is a new moment: another set. Both are kept (the two cannot be told from a set
      // the bundle never knew of).
      assert.deepEqual(
        merge(database, [lift('Bench Press', 0, [set(8, 80, 0), set(8, 80, 1), set(9, 80, 2, 40)]), lift('Row', 1, [set(10, 60, 0, 10)])]),
        ['Bench Press:8@80', 'Bench Press:8@80', 'Bench Press:8@80', 'Bench Press:9@80', 'Row:10@60'],
      );
      // The same lift in another slot is another row: its sets are not taken for this one's.
      assert.deepEqual(
        merge(database, [lift('Bench Press', 0, [set(8, 80, 0)], 'other_slot'), lift('Row', 1, [set(10, 60, 0, 10)])]),
        ['Bench Press:8@80', 'Bench Press:8@80', 'Bench Press:8@80', 'Bench Press:8@80', 'Row:10@60'],
      );
      // The stored rows are not touched by a merge.
      assert.deepEqual(setsOf(database, 'session_a'), ['Bench Press:8@80', 'Bench Press:8@80', 'Bench Press:8@80', 'Row:10@60']);
    },
  },
  {
    name: 'persisting with mergeStored writes the merge under the same id, once, and keeps what the reader added to the stored row since',
    run() {
      const first = [lift('Bench Press', 0, [set(8, 80, 0), set(8, 80, 1)])];
      let database = saved(first);
      database = {
        ...database,
        workoutSessions: database.workoutSessions.map((session) => ({ ...session, workoutNameSnapshot: 'Leg day', sessionNotes: 'felt strong', feel: 'hard' })),
      };
      const more = [lift('Bench Press', 0, [set(8, 80, 0), set(8, 80, 1), set(6, 85, 2)])];

      const withoutFlag = persistCompletedWorkoutSessionToDatabase(database, input(more));
      // Without the flag a taken id is never merged: other sets are a workout of their own under another id (they
      // used to be dropped as a duplicate, with the save reported as done), and the same sets are the save again.
      // The free workout board saves this way; a guided finish under a stored id always passes the flag.
      assert.equal(withoutFlag.didPersist, true);
      assert.equal(withoutFlag.summary.sessionId, 'session_a_b');
      assert.deepEqual(setsOf(withoutFlag.database, 'session_a'), setsOf(database, 'session_a'), 'the stored workout is untouched');
      const same = persistCompletedWorkoutSessionToDatabase(database, input(first));
      assert.equal(same.didPersist, false);
      assert.equal(same.wasStored, true, 'the same finish again was already stored');

      const merged = persistCompletedWorkoutSessionToDatabase(database, input(more, { mergeStored: true }));
      assert.equal(merged.didPersist, true);
      assert.equal(merged.summary.sessionId, 'session_a');
      assert.equal(merged.database.workoutSessions.length, 1, 'one workout, not two');
      assert.deepEqual(setsOf(merged.database, 'session_a'), ['Bench Press:8@80', 'Bench Press:8@80', 'Bench Press:6@85']);
      const row = merged.database.workoutSessions[0];
      assert.equal(row.setsCompleted, 3, 'the totals are the merge');
      assert.equal(row.totalVolumeKg, 8 * 80 * 2 + 6 * 85);
      assert.equal(row.workoutNameSnapshot, 'Leg day');
      assert.equal(row.sessionNotes, 'felt strong');
      assert.equal(row.feel, 'hard');
      assert.equal(merged.summary.setsCompleted, 3);
      assert.equal(merged.wasStored, true, 'a stored workout finished again was counted when it first landed');

      // A correction: written once, corrected, and the volume is the corrected workout's, not two workouts'.
      const corrected = persistCompletedWorkoutSessionToDatabase(
        database,
        input([lift('Bench Press', 0, [set(8, 80, 0), set(8, 82.5, 1), set(6, 85, 2)])], { mergeStored: true }),
      );
      assert.equal(corrected.database.workoutSessions.length, 1);
      assert.deepEqual(setsOf(corrected.database, 'session_a'), ['Bench Press:8@80', 'Bench Press:8@82.5', 'Bench Press:6@85']);
      assert.equal(corrected.database.workoutSessions[0].totalVolumeKg, 8 * 80 + 8 * 82.5 + 6 * 85);

      // A stale finish that adds nothing: nothing written, nothing lost.
      const stale = persistCompletedWorkoutSessionToDatabase(database, input([lift('Bench Press', 0, [set(8, 80, 0), pending(1)])], { mergeStored: true }));
      assert.equal(stale.didPersist, false);
      assert.equal(stale.wasStored, true);
      assert.equal(stale.database, database);

      const noStored = persistCompletedWorkoutSessionToDatabase(createEmptyDatabase('en'), input(more, { mergeStored: true }));
      assert.equal(noStored.database.workoutSessions.length, 1, 'the flag with nothing stored is an ordinary save');
      assert.equal(noStored.wasStored, undefined);
    },
  },
  {
    name: 'the write merges with the database it writes: a set stored after the decision is kept',
    run() {
      // The decision read a database holding two sets; by the write a third is stored under the id.
      const decided = saved([lift('Bench Press', 0, [set(8, 80, 0), set(8, 80, 1)])]);
      const written = saved([lift('Bench Press', 0, [set(8, 80, 0), set(8, 80, 1), set(7, 80, 2)])]);
      const finish = [lift('Bench Press', 0, [set(8, 80, 0), set(8, 80, 1), set(6, 85, 3)])];
      assert.equal(resolveGuidedSaveTarget(decided, 'session_a', finish).mergeStored, true);
      const result = persistCompletedWorkoutSessionToDatabase(written, input(finish, { mergeStored: true }));
      assert.equal(result.summary.sessionId, 'session_a', 'the same id');
      assert.deepEqual(setsOf(result.database, 'session_a'), ['Bench Press:8@80', 'Bench Press:8@80', 'Bench Press:7@80', 'Bench Press:6@85']);
      // And the same finish again is the merge already stored.
      const again = persistCompletedWorkoutSessionToDatabase(result.database, input(finish, { mergeStored: true }));
      assert.equal(again.didPersist, false);
      assert.equal(again.wasStored, true);
      assert.equal(again.database.workoutSessions.length, 1);
    },
  },
  {
    name: 'guided finish of a restored workout: not counted twice, compared with what came before it and not with itself, named as History names it',
    run() {
      const source = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'app', 'finishSaves.tsx'), 'utf8').replace(/\r\n/g, '\n');
      const fn = source.slice(source.indexOf('async function handleConfirmFinishWorkout()'), source.indexOf('const finishLoggedWorkoutSave = async'));
      // Counted at the first save only, as the write reports it (it read the database it wrote).
      assert.match(fn, /const alreadyCounted = summary\.wasStored === true;/);
      assert.match(fn, /if \(!alreadyCounted\) \{\s*countWorkoutCompleted\(adaptedSession\.sessionId\);\s*\}/);
      // The insight, the record cards and the volume delta read the history without this session's own earlier version.
      assert.match(fn, /allPriorSessions: priorSessions,\s*allPriorExerciseLogs: priorExerciseLogs,/);
      assert.match(fn, /exercisePrLookup: priorPrLookup,/);
      assert.match(fn, /priorSessions,\s*\),/);
      assert.doesNotMatch(fn, /allPriorSessions: database\.workoutSessions/);
      // A guided finish under a stored id is merged with it, never filed beside it.
      assert.match(fn, /mergeStored: saveTarget\.mergeStored,/);
      // A merge keeps the stored name, and the summary shows it.
      assert.match(fn, /workoutName: shownName,/);
      // ... but only when the write did merge, not when it filed the sets under an id of its own.
      assert.match(fn, /const shownName = keptName !== undefined && summary\.sessionId === keptNameId \? keptName : /);
      // The id the write filed the sets under is the session's before anything is stamped.
      assert.ok(fn.indexOf('workout.adoptSessionId(summary.sessionId)') < fn.indexOf('workout.finishWorkout('));
    },
  },
  {
    name: 'a fresh id the write finds taken by other sets is walked on, not dropped as a duplicate',
    run() {
      // The decision saw a free id; by the write another workout's sets sit under it.
      const other = saved([lift('Squat', 0, [set(5, 100, 0)])]);
      const finish = [lift('Bench Press', 0, [set(8, 80, 0)])];
      const result = persistCompletedWorkoutSessionToDatabase(other, input(finish));
      assert.equal(result.didPersist, true, 'written, not reported as saved and dropped');
      assert.equal(result.summary.sessionId, 'session_a_b', 'under the id it walked to, which the summary reports');
      assert.deepEqual(setsOf(result.database, 'session_a'), ['Squat:5@100']);
      assert.deepEqual(setsOf(result.database, 'session_a_b'), ['Bench Press:8@80']);
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
