const assert = require('node:assert/strict');

const { isHevyHistoryCsv, parseHevyCsv } = require('../../.test-dist/lib/hevyImport.js');
const {
  persistCompletedWorkoutSessionToDatabase,
} = require('../../.test-dist/state/completedWorkoutPersistence.js');

const HEADER =
  'title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_kg,reps,distance_km,duration_seconds,rpe';

const SAMPLE = [
  HEADER,
  '"Push Day","10 Jun 2024, 08:15","10 Jun 2024, 09:05",,"Bench Press (Barbell)",,,0,warmup,40,10,,,',
  '"Push Day","10 Jun 2024, 08:15","10 Jun 2024, 09:05",,"Bench Press (Barbell)",,,1,normal,80,8,,,7.5',
  '"Push Day","10 Jun 2024, 08:15","10 Jun 2024, 09:05",,"Bench Press (Barbell)",,,2,normal,80,6,,,',
  '"Push Day","10 Jun 2024, 08:15","10 Jun 2024, 09:05",,"Lateral Raise (Dumbbell)",,,0,normal,10,12,,,',
  // A cardio block: duration only, no reps — counted out loud, not imported.
  '"Push Day","10 Jun 2024, 08:15","10 Jun 2024, 09:05",,"Treadmill",,,0,normal,,,1.2,600,',
  '"Leg Day","12 Jun 2024, 17:30",,,"Squat (Barbell)",,,0,normal,100,5,,,',
].join('\n');

module.exports = [
  {
    name: 'hevyImport: detection needs both history columns, so a programme CSV never trips it',
    run() {
      assert.equal(isHevyHistoryCsv(SAMPLE), true);
      assert.equal(isHevyHistoryCsv('Day,Exercise,Sets,Reps\nDay 1,Bench Press,4,6-10'), false);
      assert.equal(isHevyHistoryCsv(''), false);
    },
  },
  {
    name: 'hevyImport: rows group into workouts by start time, exercises keep their sets in order',
    run() {
      const preview = parseHevyCsv(SAMPLE);
      assert.equal(preview.errors.length, 0);
      assert.equal(preview.workouts.length, 2);
      assert.equal(preview.setCount, 5);
      assert.equal(preview.skippedRowCount, 1);

      const push = preview.workouts[0];
      assert.equal(push.name, 'Push Day');
      assert.equal(push.exercises.length, 2);
      assert.deepEqual(
        push.exercises[0].sets.map((set) => set.reps),
        [10, 8, 6],
      );
      assert.equal(push.exercises[0].sets[0].kind, 'warmup');
      assert.equal(push.exercises[0].sets[1].kind, 'working');
      // The quoted "10 Jun 2024, 08:15" timestamp parses despite its comma.
      assert.equal(new Date(push.startedAt).getFullYear(), 2024);
    },
  },
  {
    name: 'hevyImport: pounds convert when the export has no kg column',
    run() {
      const lbs = [
        'title,start_time,exercise_title,set_type,weight_lbs,reps',
        '"A","2024-06-10T08:15:00.000Z","Bench Press",normal,225,5',
      ].join('\n');
      const preview = parseHevyCsv(lbs);
      assert.equal(preview.workouts.length, 1);
      const weight = preview.workouts[0].exercises[0].sets[0].weightKg;
      assert.ok(Math.abs(weight - 102.06) < 0.01, String(weight));
    },
  },
  {
    // The whole point of the deterministic id: mailing the same export twice
    // must not double anyone's history.
    name: 'hevyImport: re-importing the same file reports duplicates instead of doubling history',
    run() {
      const preview = parseHevyCsv(SAMPLE);
      let database = {
        workoutTemplates: [],
        exerciseTemplates: [],
        workoutPlans: [],
        exerciseLibrary: [],
        workoutSessions: [],
        cardioSessions: [],
        exerciseLogs: [],
        bodyweightEntries: [],
        measurementEntries: [],
        preferences: {},
      };
      const persistAll = () => {
        let imported = 0;
        let duplicates = 0;
        for (const workout of preview.workouts) {
          const result = persistCompletedWorkoutSessionToDatabase(database, {
            sessionId: `hevy_${Date.parse(workout.startedAt)}`,
            workoutTemplateId: 'hevy_import',
            workoutTemplateSessionId: null,
            workoutNameSnapshot: workout.name,
            startedAt: workout.startedAt,
            performedAt: workout.endedAt ?? workout.startedAt,
            logs: workout.exercises.map((exercise, orderIndex) => ({
              exerciseTemplateId: null,
              exerciseNameSnapshot: exercise.name,
              weight: Math.max(0, ...exercise.sets.map((set) => set.weightKg)),
              repsPerSet: exercise.sets.map((set) => set.reps),
              sets: exercise.sets.map((set, setIndex) => ({
                orderIndex: setIndex,
                weight: set.weightKg,
                reps: set.reps,
                kind: set.kind,
                outcome: 'completed',
                status: 'completed',
              })),
              tracked: false,
              orderIndex,
            })),
          });
          if (result.didPersist) {
            imported += 1;
            database = result.database;
          } else {
            duplicates += 1;
          }
        }
        return { imported, duplicates };
      };

      const first = persistAll();
      assert.deepEqual(first, { imported: 2, duplicates: 0 });
      assert.equal(database.workoutSessions.length, 2);
      assert.equal(database.exerciseLogs.length, 3);
      // The bench log carries its real sets, so records and history can read them.
      const bench = database.exerciseLogs.find((log) => log.exerciseNameSnapshot.includes('Bench'));
      assert.equal(bench.sets.length, 3);
      assert.equal(bench.weight, 80);

      const second = persistAll();
      assert.deepEqual(second, { imported: 0, duplicates: 2 });
      assert.equal(database.workoutSessions.length, 2);
    },
  },
];
