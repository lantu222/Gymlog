const assert = require('node:assert/strict');

const {
  buildEditorExercisePatchFromLibraryItem,
  buildEditorTableRows,
  buildExerciseHistoryLookup,
  parseDraftRepRangeInput,
  resolveExerciseHistory,
} = require('../../.test-dist/lib/workoutEditorTable.js');

module.exports = [
  {
    name: 'editor history lookup prefers library item matches from previous logs',
    run() {
      const lookup = buildExerciseHistoryLookup({
        exerciseLogs: [
          {
            id: 'log_1',
            sessionId: 'session_1',
            exerciseTemplateId: 'template_1',
            exerciseNameSnapshot: 'Bench Press',
            weight: 90,
            repsPerSet: [6, 6, 5],
            tracked: true,
            orderIndex: 0,
          },
        ],
        workoutSessions: [
          {
            id: 'session_1',
            workoutTemplateId: 'tpl_1',
            workoutNameSnapshot: 'Upper Heavy',
            performedAt: '2026-03-20T08:00:00.000Z',
          },
        ],
        exerciseTemplates: [
          {
            id: 'template_1',
            workoutTemplateId: 'tpl_1',
            workoutTemplateSessionId: 'tpl_session_1',
            name: 'Bench Press',
            targetSets: 3,
            repMin: 5,
            repMax: 8,
            restSeconds: 120,
            trackedDefault: true,
            orderIndex: 0,
            libraryItemId: 'lib_bench',
          },
        ],
        unitPreference: 'kg',
      });

      const history = resolveExerciseHistory({
        name: 'Bench Press',
        libraryItemId: 'lib_bench',
      }, lookup);

      assert.equal(history.lastWeight, '90 kg');
      assert.equal(history.lastReps, '6,6,5');
    },
  },
  {
    name: 'editor history lookup falls back to normalized exercise name when no library id exists',
    run() {
      const lookup = buildExerciseHistoryLookup({
        exerciseLogs: [
          {
            id: 'log_1',
            sessionId: 'session_1',
            exerciseTemplateId: null,
            exerciseNameSnapshot: 'Smith penkki',
            weight: 55,
            repsPerSet: [8, 8, 7],
            tracked: true,
            orderIndex: 0,
          },
        ],
        workoutSessions: [
          {
            id: 'session_1',
            workoutTemplateId: 'tpl_1',
            workoutNameSnapshot: 'Push Day',
            performedAt: '2026-03-22T08:00:00.000Z',
          },
        ],
        exerciseTemplates: [],
        unitPreference: 'kg',
      });

      const history = resolveExerciseHistory({
        name: ' smith penkki ',
        libraryItemId: null,
      }, lookup);

      assert.equal(history.lastWeight, '55 kg');
      assert.equal(history.lastReps, '8,8,7');
    },
  },
  {
    name: 'editor table rows expose source and latest history values',
    run() {
      const lookup = {
        byLibraryItemId: {
          lib_row: {
            lastWeight: '65 kg',
            lastReps: '6,6,6',
            performedAt: '2026-03-24T08:00:00.000Z',
          },
        },
        byName: {},
      };

      const rows = buildEditorTableRows(
        [
          {
            localKey: 'row_1',
            name: 'Kulmasoutu',
            targetSets: '3',
            repRangeText: '6-8',
            restSeconds: '120',
            trackedDefault: true,
            libraryItemId: 'lib_row',
          },
        ],
        lookup,
      );

      assert.equal(rows[0].source, 'library-backed');
      assert.equal(rows[0].history.lastWeight, '65 kg');
      assert.equal(rows[0].history.lastReps, '6,6,6');
    },
  },
  {
    name: 'editor rep range parsing supports both ranges and single values',
    run() {
      assert.deepEqual(parseDraftRepRangeInput('6-8'), { repMin: '6', repMax: '8' });
      assert.deepEqual(parseDraftRepRangeInput('8'), { repMin: '8', repMax: '8' });
    },
  },
  {
    name: 'library selection fills editor row defaults in spreadsheet format',
    run() {
      const patch = buildEditorExercisePatchFromLibraryItem(
        {
          id: 'lib_raise',
          name: 'Lateral Raise',
          category: 'isolation',
          bodyPart: 'shoulders',
          equipment: 'dumbbell',
        },
        120,
      );

      assert.equal(patch.name, 'Lateral Raise');
      assert.equal(patch.targetSets, '3');
      assert.equal(patch.repRangeText, '10-12');
      assert.equal(patch.restSeconds, '75');
      assert.equal(patch.trackedDefault, false);
      assert.equal(patch.libraryItemId, 'lib_raise');
    },
  },
];
