const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { createEmptyDatabase } = require('../../.test-dist/data/seed.js');
const { mergeStoredBoardLogs, freestyleLogsOf } = require('../../.test-dist/lib/emptyWorkoutSession.js');
const { persistCompletedWorkoutSessionToDatabase } = require('../../.test-dist/state/completedWorkoutPersistence.js');
const { workoutReducer, workoutInitialState } = require('../../.test-dist/features/workout/workoutState.js');

/**
 * A free workout board finished again under the id its earlier save holds (bug hunt 2026-10-03).
 *
 * A board that came back carried on after its save (a draft that reached it before the database had loaded) used to
 * be saved beside that save under `<id>_b`, every set the two shared counted twice. It is merged into it under the
 * same id, by place: the lift's key on the board and the set's position in it.
 */

let rowKey = 0;
const row = (kg, reps, done = true) => ({ localKey: `s${(rowKey += 1)}`, kg: String(kg), reps: String(reps), done });
const liftOn = (localKey, name, sets) => ({ localKey, name, libraryItemId: null, imageUrl: null, repMin: 8, repMax: 12, restSeconds: 90, trackedDefault: true, sets });
const logsOf = (board) =>
  freestyleLogsOf(board).map((log) => ({
    ...log,
    sets: log.sets.map((set) => ({ ...set, completedAt: set.status === 'completed' ? '2026-10-03T10:00:00.000Z' : null })),
  }));
const input = (logs, extra = {}) => ({
  sessionId: 'session_board',
  workoutTemplateId: 'tpl_freestyle',
  workoutNameSnapshot: 'Free workout',
  logs,
  startedAt: '2026-10-03T09:00:00.000Z',
  performedAt: '2026-10-03T10:00:00.000Z',
  ...extra,
});
const doneOf = (logs) =>
  [...logs]
    .sort((x, y) => x.orderIndex - y.orderIndex)
    .flatMap((log) => log.sets.filter((s) => s.status === 'completed').map((s) => `${log.exerciseNameSnapshot}:${s.reps}@${s.weight}`));

module.exports = [
  {
    name: 'a free workout board finished again merges into its save by place: an edited set once, an added one added, a stored one the board lacks kept, nothing twice',
    run() {
      const first = [liftOn('l1', 'Bench Press', [row(60, 8), row(62.5, 6)]), liftOn('l2', 'Row', [row(50, 10)])];
      const stored = persistCompletedWorkoutSessionToDatabase(createEmptyDatabase('en'), input(logsOf(first))).database;
      const storedLogs = stored.exerciseLogs;

      // Carried on: the second bench set's weight corrected, a third set and a curl added.
      const carried = [
        liftOn('l1', 'Bench Press', [row(60, 8), row(65, 6), row(65, 5)]),
        liftOn('l2', 'Row', [row(50, 10)]),
        liftOn('l3', 'Curl', [row(20, 12)]),
      ];
      assert.deepEqual(doneOf(mergeStoredBoardLogs(storedLogs, logsOf(carried))), [
        'Bench Press:8@60',
        'Bench Press:6@65',
        'Bench Press:5@65',
        'Row:10@50',
        'Curl:12@20',
      ]);
      // The board came back before the row was ticked (a draft behind its save) and the reader logs on: the row stays.
      const behind = [liftOn('l1', 'Bench Press', [row(60, 8), row(62.5, 6), row(65, 5)]), liftOn('l2', 'Row', [row(50, 10, false)])];
      assert.deepEqual(doneOf(mergeStoredBoardLogs(storedLogs, logsOf(behind))), [
        'Bench Press:8@60',
        'Bench Press:6@62.5',
        'Bench Press:5@65',
        'Row:10@50',
      ]);

      const merged = persistCompletedWorkoutSessionToDatabase(stored, input(logsOf(carried), { mergeStored: true, mergeBy: 'place' }));
      assert.equal(merged.didPersist, true);
      assert.equal(merged.summary.sessionId, 'session_board', 'the same id, not `<id>_b`');
      assert.equal(merged.database.workoutSessions.length, 1, 'one workout');
      const saved = merged.database.workoutSessions[0];
      assert.equal(saved.setsCompleted, 5);
      assert.equal(saved.totalVolumeKg, 8 * 60 + 6 * 65 + 5 * 65 + 10 * 50 + 12 * 20, 'the volume of one workout, not two');
      assert.equal(saved.workoutTemplateId, 'tpl_freestyle', 'the template the save hangs on');

      const again = persistCompletedWorkoutSessionToDatabase(merged.database, input(logsOf(carried), { mergeStored: true, mergeBy: 'place' }));
      assert.equal(again.didPersist, false, 'the same board again writes nothing');
      assert.equal(again.wasStored, true);
    },
  },
  {
    name: 'a free workout finished again goes through the merge, keeps its template, is counted once, and never says the save failed after it landed',
    run() {
      const source = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'app', 'finishSaves.tsx'), 'utf8').replace(/\r\n/g, '\n');
      const fn = source.slice(source.indexOf('const finishLoggedWorkoutSave = async'), source.indexOf('return { handleDiscardWorkout'));
      assert.match(fn, /const storedRow = summary\.sessionId \? getDatabase\(\)\.workoutSessions\.find\(\(row\) => row\.id === sessionId\) : undefined;/);
      assert.match(fn, /workoutTemplateId: storedRow\.workoutTemplateId,[\s\S]*?mergeStored: true,\s*mergeBy: 'place',/);
      assert.ok(fn.indexOf('upsertWorkoutTemplate(draft)') > fn.indexOf('if (storedRow) {'), 'a new template only for a first save');
      assert.match(fn, /if \(firstSave\) \{\s*countWorkoutCompleted\(landedAs\);/);
      // After the save landed, a failure is logged and the board is left, never rethrown as a failed save.
      const after = fn.slice(fn.indexOf('// The sets are on disk.'));
      assert.match(after, /\} catch \(error\) \{\s*console\.error\('Failed after the free workout was saved', error\);\s*navigateBack\(getWorkoutLoggerFallbackRoute\(\)\);\s*\}/);
      assert.doesNotMatch(after, /^\s*throw /m);
    },
  },
  {
    name: 'a workout recorded again replaces its own entry in the slot history',
    run() {
      const record = (sessionId, kg) => ({
        type: 'history/recordLogged',
        payload: {
          performedAt: '2026-10-03T10:00:00.000Z',
          sessionId,
          templateName: 'Free workout',
          exercises: [{ exerciseName: 'Bench Press', sets: [{ setIndex: 0, loadKg: kg, reps: 8 }] }],
        },
      });
      let state = { ...workoutInitialState, hydrated: true };
      state = workoutReducer(state, record('session_old', 50));
      state = workoutReducer(state, record('session_board', 60));
      state = workoutReducer(state, record('session_board', 65));
      const entries = state.history.slotHistory['logged:bench press'];
      assert.deepEqual(entries.map((entry) => `${entry.sessionId}:${entry.sets[0].loadKg}`), ['session_board:65', 'session_old:50']);
    },
  },
];
