const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { createEmptyDatabase } = require('../../.test-dist/data/seed.js');
const { resolveGuidedSaveTarget, mergeStoredWorkoutLogs } = require('../../.test-dist/lib/emptyWorkoutSession.js');
const { persistCompletedWorkoutSessionToDatabase } = require('../../.test-dist/state/completedWorkoutPersistence.js');
const { workoutReducer, workoutInitialState } = require('../../.test-dist/features/workout/workoutState.js');
const { normalizeWorkoutBundle } = require('../../.test-dist/features/workout/workoutPersistence.js');
const { adaptCompletedWorkoutSessionForAppDatabase } = require('../../.test-dist/features/workout/workoutAppAdapter.js');

/**
 * Finishing a guided session whose id a stored workout already holds (bug hunt 2026-10-03).
 *
 * The save lands before the clear; a lost clear brings the session back active, and the reader can add
 * sets, correct one, take one back, swap or skip a lift, and Finish again. It is the same workout: merged
 * with what is stored under the same id, so no stored set is lost and none is counted twice. (Until 2026-10-03 a finish
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
const merge = (database, logs, takenBackAt = []) => doneOf(mergeStoredWorkoutLogs(storedLogs(database), logs, takenBackAt));

module.exports = [
  {
    name: 'guided finish under a stored id: always merged into it under the same id, a free id is an ordinary save',
    run() {
      const first = [lift('Bench Press', 0, [set(8, 80, 0), set(8, 80, 1)])];
      const database = saved(first);
      assert.deepEqual(resolveGuidedSaveTarget(database, 'session_new'), { mergeStored: false }, 'a free id is used as it is');
      assert.deepEqual(resolveGuidedSaveTarget(database, 'session_a'), { mergeStored: true }, 'a stored id is this workout, finished again');
    },
  },
  {
    name: 'the merge: a set is the moment it was logged - a correction replaces it, a stored set the session never knew stays, one taken back goes, nothing is counted twice',
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
      // Taken back and logged again (a typo fixed by undo): the stored set's moment is on record as taken back, so it
      // goes, and the new one is the set. Taken back alone: it goes, and nothing stands in for it.
      const rest = lift('Row', 1, [set(10, 60, 0, 10)]);
      assert.deepEqual(
        merge(database, [lift('Bench Press', 0, [set(8, 80, 0), set(8, 80, 1), set(9, 80, 2, 40)]), rest], [at(2)]),
        ['Bench Press:8@80', 'Bench Press:8@80', 'Bench Press:9@80', 'Row:10@60'],
      );
      assert.deepEqual(
        merge(database, [lift('Bench Press', 0, [set(8, 80, 0), set(8, 80, 1), pending(2)]), rest], [at(2)]),
        ['Bench Press:8@80', 'Bench Press:8@80', 'Row:10@60'],
      );
      // Without that record a set the session lacks is one it never knew of, and stays.
      assert.deepEqual(
        merge(database, [lift('Bench Press', 0, [set(8, 80, 0), set(8, 80, 1), pending(2)]), rest]),
        ['Bench Press:8@80', 'Bench Press:8@80', 'Bench Press:8@80', 'Row:10@60'],
      );
      // The stored rows are not touched by a merge.
      assert.deepEqual(setsOf(database, 'session_a'), ['Bench Press:8@80', 'Bench Press:8@80', 'Bench Press:8@80', 'Row:10@60']);
    },
  },
  {
    name: 'the merge holds across a swap that renumbers the slot, a lift skipped since, a slot id rewritten on load, and a stored set with no moment',
    run() {
      // Bench set 0 left open, sets 1 and 2 done; in the returned session the slot is swapped to a dumbbell press. A slot
      // that held two lifts is saved lift by lift, each numbered from 0 (lib/liftSegments): bench's sets come back as
      // 0 and 1. The same two sets, by their moments: nothing added, nothing counted twice.
      const swapped = saved([lift('Bench Press', 0, [pending(0), set(8, 80, 1), set(8, 80, 2)], 'press')]);
      const afterSwap = [
        { ...lift('Dumbbell Press', 0, [pending(0)], 'press'), swappedFrom: 'Bench Press' },
        lift('Bench Press', 0, [set(8, 80, 0, 1), set(8, 80, 1, 2)], 'press'),
      ];
      assert.deepEqual(merge(swapped, afterSwap), ['Bench Press:8@80', 'Bench Press:8@80']);

      // Squat's two sets were logged after the bundle the session came back from; there the reader skipped Squat. A
      // skipped row counts nowhere: the row is done after all, with the kept sets in it.
      const squat = saved([lift('Squat', 0, [set(5, 100, 0), set(5, 100, 1)]), lift('Row', 1, [set(10, 60, 0, 10)])]);
      const skippedSquat = { ...lift('Squat', 0, [{ ...pending(0), status: 'skipped', outcome: 'skipped' }]), skipped: true, status: 'skipped' };
      const kept = mergeStoredWorkoutLogs(storedLogs(squat), [skippedSquat, lift('Row', 1, [set(10, 60, 0, 10), set(10, 60, 1, 11)])]);
      const squatRows = kept.filter((log) => log.exerciseNameSnapshot === 'Squat');
      assert.equal(squatRows.length, 1, 'one squat row, not a skipped one beside a done one');
      assert.equal(squatRows[0].skipped, false);
      assert.equal(squatRows[0].status, 'completed');
      assert.deepEqual(squatRows[0].sets.filter((s) => s.status === 'completed').map((s) => `${s.reps}@${s.weight}`), ['5@100', '5@100']);
      assert.equal(squatRows[0].sets.length, 2, "the skipped placeholder at a kept set's place goes");
      const written = persistCompletedWorkoutSessionToDatabase(squat, input([skippedSquat, lift('Row', 1, [set(10, 60, 0, 10), set(10, 60, 1, 11)])], { mergeStored: true }));
      assert.equal(written.database.workoutSessions[0].setsCompleted, 4, 'the squat sets still count');
      assert.equal(written.database.workoutSessions[0].totalVolumeKg, 2 * 500 + 2 * 600);

      // A slot id rewritten when the stored session was repaired on load: the moment is the set, not the slot.
      const renamed = saved([lift('Bench Press', 0, [set(8, 80, 0)], 'old_slot')]);
      assert.deepEqual(merge(renamed, [lift('Bench Press', 0, [set(8, 80, 0), set(8, 80, 1)], 'tpl:day:press')]), ['Bench Press:8@80', 'Bench Press:8@80']);

      // A stored set with no moment (an older save) is matched by its lift and value.
      const legacy = saved([lift('Bench Press', 0, [{ ...set(8, 80, 0), completedAt: null }, { ...set(8, 80, 1), completedAt: null }])]);
      assert.deepEqual(merge(legacy, [lift('Bench Press', 0, [set(8, 80, 0), set(8, 80, 1)])]), ['Bench Press:8@80', 'Bench Press:8@80']);
      assert.deepEqual(merge(legacy, [lift('Bench Press', 0, [set(8, 80, 0), set(8, 80, 1), set(6, 85, 2)])]), ['Bench Press:8@80', 'Bench Press:8@80', 'Bench Press:6@85']);
    },
  },
  {
    name: 'a merge that changes nothing writes nothing; one that changes anything the reader can change is written, never reported as saved and dropped',
    run() {
      const first = [lift('Bench Press', 0, [set(8, 80, 0), set(8, 80, 1)])];
      const database = saved(first);
      const same = persistCompletedWorkoutSessionToDatabase(database, input(first, { mergeStored: true }));
      assert.equal(same.didPersist, false, 'the same finish again');
      assert.equal(same.wasStored, true);
      const stale = persistCompletedWorkoutSessionToDatabase(database, input([lift('Bench Press', 0, [set(8, 80, 0), pending(1)])], { mergeStored: true }));
      assert.equal(stale.didPersist, false, 'a finish that knows less than is stored adds nothing');
      assert.equal(stale.database, database);
      // ... also as the player saves it: the lift still open there, for the set it did not know was done.
      const done = saved([{ ...first[0], status: 'completed' }]);
      const open = persistCompletedWorkoutSessionToDatabase(done, input([{ ...lift('Bench Press', 0, [set(8, 80, 0), pending(1)]), status: 'active' }], { mergeStored: true }));
      assert.equal(open.didPersist, false, 'the lift is done again once the set is back in its place');

      const changes = {
        'a note': [{ ...first[0], notes: 'elbow felt off' }],
        'an effort': [lift('Bench Press', 0, [set(8, 80, 0), { ...set(8, 80, 1), effort: 'hard' }])],
        'an inserted lift with nothing logged': [...first, { ...lift('Face Pull', 1, []), sessionInserted: true }],
        'a skip of a lift with nothing logged': [...first, { ...lift('Row', 1, [{ ...pending(0), status: 'skipped', outcome: 'skipped' }]), skipped: true, status: 'skipped' }],
      };
      for (const [what, logs] of Object.entries(changes)) {
        const result = persistCompletedWorkoutSessionToDatabase(database, input(logs, { mergeStored: true }));
        assert.equal(result.didPersist, true, `${what} is written`);
        assert.equal(result.database.workoutSessions.length, 1, `${what}: one workout`);
        assert.deepEqual(setsOf(result.database, 'session_a'), ['Bench Press:8@80', 'Bench Press:8@80'], `${what}: the sets as they were`);
      }
      const noted = persistCompletedWorkoutSessionToDatabase(database, input(changes['a note'], { mergeStored: true }));
      assert.equal(noted.database.exerciseLogs.find((log) => log.sessionId === 'session_a').notes, 'elbow felt off');
      assert.equal(noted.database.workoutSessions[0].noteCount, 1);
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
      assert.equal(resolveGuidedSaveTarget(decided, 'session_a').mergeStored, true);
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
  {
    name: 'a set taken back is on record by the moment it was logged, through a relaunch and into the save',
    run() {
      const ex = { id: 'e1', exerciseName: 'Bench Press', slotId: 'press', role: 'primary', progressionPriority: 'high', trackingMode: 'load_and_reps', sets: 3, repsMin: 6, repsMax: 8, restSecondsMin: 90, restSecondsMax: 120, substitutionGroup: 'press' };
      const template = { id: 'tpl', name: 'Day', defaultScheduleMode: 'weekly', sessions: [{ id: 'day', name: 'Day', orderIndex: 0, exercises: [ex] }] };
      let state = workoutReducer({ ...workoutInitialState, hydrated: true }, { type: 'session/startFromRuntimeTemplate', payload: { template, sessionOrderIndex: 0, unitPreference: 'kg' } });
      const slotId = state.activeSession.exercises[0].slotId;
      const loggedAt = Date.parse('2026-10-03T09:10:00.000Z');
      state = workoutReducer(state, { type: 'set/updateDraft', payload: { slotId, setIndex: 0, patch: { loadText: '80', repsText: '8' } } });
      state = workoutReducer(state, { type: 'set/complete', payload: { slotId, setIndex: 0, nowMs: loggedAt, unitPreference: 'kg' } });
      assert.equal(state.activeSession.takenBackAt, undefined, 'nothing taken back yet');
      state = workoutReducer(state, { type: 'set/undo', payload: { slotId, setIndex: 0 } });
      assert.deepEqual(state.activeSession.takenBackAt, [new Date(loggedAt).toISOString()]);
      // A pending set taken back is nothing taken back.
      const again = workoutReducer(state, { type: 'set/undo', payload: { slotId, setIndex: 1 } });
      assert.deepEqual(again.activeSession.takenBackAt, [new Date(loggedAt).toISOString()]);

      const reloaded = normalizeWorkoutBundle(JSON.parse(JSON.stringify({ activeSession: state.activeSession, history: state.history })));
      assert.deepEqual(reloaded.activeSession.takenBackAt, [new Date(loggedAt).toISOString()], 'kept through the bundle');
      const junk = normalizeWorkoutBundle(JSON.parse(JSON.stringify({ activeSession: { ...state.activeSession, takenBackAt: [3, null, 'x'] }, history: state.history })));
      assert.deepEqual(junk.activeSession.takenBackAt, ['x'], 'what is not a moment is dropped on load');
      const none = normalizeWorkoutBundle(JSON.parse(JSON.stringify({ activeSession: { ...state.activeSession, takenBackAt: 'x' }, history: state.history })));
      assert.equal(none.activeSession.takenBackAt, undefined);

      assert.deepEqual(adaptCompletedWorkoutSessionForAppDatabase(state.activeSession).takenBackAt, [new Date(loggedAt).toISOString()], 'handed to the save');
      const source = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'app', 'finishSaves.tsx'), 'utf8');
      assert.match(source, /saveCompletedWorkoutSession\(\{\s*\.\.\.adaptedSession,/, 'the guided save passes the adapted session whole, takenBackAt with it');
    },
  },
];
