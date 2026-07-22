const assert = require('node:assert/strict');

const {
  EMPTY_WORKOUT_MUSCLE_FILTERS,
  buildFreestyleFinish,
  exerciseInitials,
  freestyleDoneSetCount,
  freestyleVolumeKg,
  matchesMuscleFilter,
} = require('../../.test-dist/lib/emptyWorkoutSession.js');

const emptyPrLookup = { byLibraryItemId: {}, byName: {} };

function makeExercise(overrides = {}) {
  return {
    localKey: 'draft_1',
    name: 'Barbell Squat',
    libraryItemId: 'ex_squat',
    imageUrl: null,
    repMin: 6,
    repMax: 8,
    restSeconds: 120,
    trackedDefault: true,
    sets: [
      { localKey: 'set_1', kg: '100', reps: '5', done: true },
      { localKey: 'set_2', kg: '100', reps: '5', done: false },
    ],
    ...overrides,
  };
}

module.exports = [
  {
    name: 'muscle filter maps design chips onto library body parts',
    run() {
      assert.deepEqual(
        [...EMPTY_WORKOUT_MUSCLE_FILTERS],
        ['All', 'Chest', 'Back', 'Shoulders', 'Legs', 'Arms', 'Core'],
      );
      assert.equal(matchesMuscleFilter('chest', 'Chest'), true);
      assert.equal(matchesMuscleFilter('glutes', 'Legs'), true);
      assert.equal(matchesMuscleFilter('biceps', 'Arms'), true);
      assert.equal(matchesMuscleFilter('triceps', 'Arms'), true);
      assert.equal(matchesMuscleFilter('back', 'Chest'), false);
      assert.equal(matchesMuscleFilter('full body', 'All'), true);
      assert.equal(matchesMuscleFilter('full body', 'Core'), false);
    },
  },
  {
    name: 'exerciseInitials builds two-letter tiles like the design mock',
    run() {
      assert.equal(exerciseInitials('Barbell Squat'), 'BS');
      assert.equal(exerciseInitials('Pull-Up'), 'PU');
      assert.equal(exerciseInitials('Squat'), 'SQ');
      // Letter words beat leading numerals; all-numeric names still resolve.
      assert.equal(exerciseInitials('3/4 Sit-Up'), 'SU');
      assert.equal(exerciseInitials('90/90 Hamstring'), 'HA');
      assert.equal(exerciseInitials(''), 'EX');
    },
  },
  {
    name: 'stat strip counts only done sets and their volume',
    run() {
      const exercises = [makeExercise()];
      assert.equal(freestyleDoneSetCount(exercises), 1);
      assert.equal(freestyleVolumeKg(exercises), 500);
    },
  },
  {
    name: 'buildFreestyleFinish produces a matching draft and summary',
    run() {
      const { draft, summary } = buildFreestyleFinish({
        exercises: [makeExercise()],
        workoutName: 'Empty workout',
        startedAtIso: '2026-07-22T10:00:00.000Z',
        performedAtIso: '2026-07-22T10:40:00.000Z',
        elapsedSeconds: 2400,
        exercisePrLookup: emptyPrLookup,
      });

      // Draft: one session named after the first lift, sets count as targetSets.
      assert.equal(draft.name, 'Empty workout');
      assert.equal(draft.sessions.length, 1);
      assert.equal(draft.sessions[0].name, 'Barbell Squat');
      assert.deepEqual(draft.sessions[0].exercises[0], {
        name: 'Barbell Squat',
        targetSets: 2,
        repMin: 6,
        repMax: 8,
        restSeconds: 120,
        trackedDefault: true,
        libraryItemId: 'ex_squat',
      });

      // Summary: mirrors the editor finish math.
      assert.equal(summary.durationMinutes, 40);
      assert.equal(summary.setsCompleted, 1);
      assert.equal(summary.totalVolume, 500);
      assert.equal(summary.exercisesLogged, 1);
      assert.equal(summary.exerciseCards[0].completedSets, 1);
      assert.equal(summary.exerciseCards[0].totalSets, 2);
      assert.equal(summary.exerciseCards[0].totalVolumeKg, 500);

      // Logs keep every typed set; only the done one is completed.
      const log = summary.logs[0];
      assert.equal(log.exerciseNameSnapshot, 'Barbell Squat');
      assert.equal(log.sets.length, 2);
      assert.equal(log.sets[0].status, 'completed');
      assert.equal(log.sets[0].completedAt, '2026-07-22T10:40:00.000Z');
      assert.equal(log.sets[1].status, 'pending');
      assert.equal(log.sets[1].completedAt, null);
      assert.equal(log.status, 'completed');
      assert.equal(log.sessionInserted, true);
    },
  },
  {
    name: 'first-ever session yields a PR card; beaten history suppresses it',
    run() {
      const fresh = buildFreestyleFinish({
        exercises: [makeExercise()],
        workoutName: 'Empty workout',
        startedAtIso: '2026-07-22T10:00:00.000Z',
        performedAtIso: '2026-07-22T10:40:00.000Z',
        elapsedSeconds: 600,
        exercisePrLookup: emptyPrLookup,
      });
      assert.equal(fresh.summary.prCards.length, 1);
      // 100 kg × 5 → Epley estimate 116.67.
      assert.ok(Math.abs(fresh.summary.prCards[0].estimatedOneRepMaxKg - 100 * (1 + 5 / 30)) < 0.01);

      const beaten = buildFreestyleFinish({
        exercises: [makeExercise()],
        workoutName: 'Empty workout',
        startedAtIso: '2026-07-22T10:00:00.000Z',
        performedAtIso: '2026-07-22T10:40:00.000Z',
        elapsedSeconds: 600,
        exercisePrLookup: { byLibraryItemId: { ex_squat: 140 }, byName: {} },
      });
      assert.equal(beaten.summary.prCards.length, 0);
    },
  },
  {
    name: 'undone-only exercises still persist but log as active',
    run() {
      const { summary } = buildFreestyleFinish({
        exercises: [
          makeExercise({
            sets: [{ localKey: 'set_1', kg: '', reps: '', done: false }],
          }),
        ],
        workoutName: 'Empty workout',
        startedAtIso: '2026-07-22T10:00:00.000Z',
        performedAtIso: '2026-07-22T10:05:00.000Z',
        elapsedSeconds: 90,
        exercisePrLookup: emptyPrLookup,
      });

      assert.equal(summary.setsCompleted, 0);
      assert.equal(summary.totalVolume, 0);
      assert.equal(summary.durationMinutes, 2);
      assert.equal(summary.prCards.length, 0);
      assert.equal(summary.logs[0].status, 'active');
    },
  },
];
