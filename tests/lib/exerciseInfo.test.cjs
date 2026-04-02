const assert = require('node:assert/strict');

const { buildExerciseInfoSnapshot, getExerciseInfoMeta } = require('../../.test-dist/lib/exerciseInfo.js');

function makeExercise(overrides = {}) {
  return {
    templateExerciseId: overrides.templateExerciseId ?? 'exercise',
    persistedExerciseTemplateId: null,
    slotId: overrides.slotId ?? 'slot',
    templateSlotId: overrides.templateSlotId ?? overrides.slotId ?? 'slot',
    exerciseName: overrides.exerciseName ?? 'Bench Press',
    role: overrides.role ?? 'primary',
    progressionPriority: overrides.progressionPriority ?? 'high',
    trackingMode: overrides.trackingMode ?? 'load_and_reps',
    restSecondsMin: overrides.restSecondsMin ?? 120,
    restSecondsMax: overrides.restSecondsMax ?? 180,
    substitutionGroup: overrides.substitutionGroup ?? 'group',
    orderIndex: overrides.orderIndex ?? 0,
    sets: overrides.sets ?? [
      {
        setIndex: 0,
        plannedLoadKg: 80,
        plannedRepsMin: 5,
        plannedRepsMax: 8,
        draftLoadText: '',
        draftRepsText: '',
        status: 'pending',
        edited: false,
      },
      {
        setIndex: 1,
        plannedLoadKg: 80,
        plannedRepsMin: 5,
        plannedRepsMax: 8,
        draftLoadText: '',
        draftRepsText: '',
        status: 'pending',
        edited: false,
      },
    ],
    status: overrides.status ?? 'pending',
    notes: overrides.notes,
    isExpanded: false,
    libraryItemId: overrides.libraryItemId ?? null,
  };
}

function makeHistoryEntry(overrides = {}) {
  return {
    slotId: overrides.slotId ?? 'slot',
    templateId: overrides.templateId ?? 'template',
    templateName: overrides.templateName ?? 'Upper A',
    exerciseName: overrides.exerciseName ?? 'Bench Press',
    substitutionGroup: overrides.substitutionGroup ?? 'group',
    performedAt: overrides.performedAt ?? '2026-03-01T09:00:00.000Z',
    sessionId: overrides.sessionId ?? `session-${overrides.performedAt ?? '1'}`,
    sets:
      overrides.sets ?? [
        { setIndex: 0, loadKg: 75, reps: 8, completedAt: overrides.performedAt ?? '2026-03-01T09:00:00.000Z' },
        { setIndex: 1, loadKg: 80, reps: 6, completedAt: overrides.performedAt ?? '2026-03-01T09:02:00.000Z' },
      ],
    skipped: overrides.skipped ?? false,
  };
}

module.exports = [
  {
    name: 'exercise info snapshot formats target best and trend for weighted lifts',
    run() {
      const snapshot = buildExerciseInfoSnapshot({
        exercise: makeExercise(),
        libraryItem: {
          id: 'bench',
          name: 'Bench Press',
          category: 'compound',
          bodyPart: 'chest',
          equipment: 'barbell',
        },
        previousEntries: [
          makeHistoryEntry({ performedAt: '2026-03-20T09:00:00.000Z', sets: [{ setIndex: 0, loadKg: 82.5, reps: 6, completedAt: '2026-03-20T09:00:00.000Z' }] }),
          makeHistoryEntry({ performedAt: '2026-03-10T09:00:00.000Z', sets: [{ setIndex: 0, loadKg: 80, reps: 6, completedAt: '2026-03-10T09:00:00.000Z' }] }),
        ],
        unitPreference: 'kg',
        activeSetIndex: 0,
      });

      assert.equal(snapshot.movementLabel, 'Horizontal press');
      assert.equal(snapshot.targetLabel, '80 kg x 5-8');
      assert.equal(snapshot.targetMeta, '2 sets planned');
      assert.equal(snapshot.restLabel, '120-180s');
      assert.equal(snapshot.bestLabel, '82.5 kg x 6');
      assert.equal(snapshot.trend.empty, false);
      assert.equal(snapshot.trend.latestLabel, '82.5 kg');
      assert.equal(snapshot.trend.bestLabel, '82.5 kg');
      assert.equal(snapshot.trend.points.length, 2);
    },
  },
  {
    name: 'exercise info snapshot falls back to rep trends for bodyweight lifts',
    run() {
      const snapshot = buildExerciseInfoSnapshot({
        exercise: makeExercise({
          exerciseName: 'Hanging Knee Raise',
          trackingMode: 'bodyweight',
          restSecondsMin: 45,
          restSecondsMax: 60,
          sets: [
            {
              setIndex: 0,
              plannedRepsMin: 10,
              plannedRepsMax: 15,
              draftLoadText: '',
              draftRepsText: '',
              status: 'pending',
              edited: false,
            },
          ],
        }),
        libraryItem: {
          id: 'knees',
          name: 'Hanging Knee Raise',
          category: 'core',
          bodyPart: 'core',
          equipment: 'bodyweight',
        },
        previousEntries: [
          makeHistoryEntry({
            exerciseName: 'Hanging Knee Raise',
            performedAt: '2026-03-20T09:00:00.000Z',
            sets: [{ setIndex: 0, loadKg: 0, reps: 14, completedAt: '2026-03-20T09:00:00.000Z' }],
          }),
        ],
        unitPreference: 'kg',
        activeSetIndex: 0,
      });

      assert.equal(snapshot.targetLabel, '10-15 reps');
      assert.equal(snapshot.bestLabel, '14 reps');
      assert.equal(snapshot.trend.unitLabel, 'reps');
      assert.equal(snapshot.trend.latestLabel, '14 reps');
    },
  },
  {
    name: 'exercise info meta falls back to lower body defaults when the lift is unknown',
    run() {
      const meta = getExerciseInfoMeta('Unknown Leg Machine', {
        id: 'leg',
        name: 'Unknown Leg Machine',
        category: 'compound',
        bodyPart: 'legs',
        equipment: 'machine',
      });

      assert.equal(meta.theme, 'legs');
      assert.equal(meta.movementLabel, 'Lower body');
      assert.deepEqual(meta.joints, ['Hips', 'Knees', 'Ankles']);
    },
  },
];
