const assert = require('node:assert/strict');

const { buildCustomDraftFromReadyProgram } = require('../../.test-dist/lib/readyProgramDuplication.js');
const { getWorkoutTemplateById } = require('../../.test-dist/features/workout/workoutCatalog.js');

module.exports = [
  {
    name: 'ready program duplication keeps sessions and exercise prescriptions',
    run() {
      const template = getWorkoutTemplateById('tpl_3_day_full_body_v1');
      const draft = buildCustomDraftFromReadyProgram(template, [], []);

      assert.equal(draft.name, '3-Day Full Body Custom');
      assert.equal(draft.sessions.length, 3);
      assert.equal(draft.sessions[0].name, 'Full Body A');
      assert.equal(draft.sessions[0].exercises[0].name, 'Back Squat');
      assert.equal(draft.sessions[0].exercises[0].targetSets, 3);
      assert.equal(draft.sessions[0].exercises[0].repMin, 6);
      assert.equal(draft.sessions[0].exercises[0].repMax, 8);
      assert.equal(draft.sessions[0].exercises[0].restSeconds, 180);
    },
  },
  {
    name: 'ready program duplication generates a unique custom name and accessory tracking defaults',
    run() {
      const template = getWorkoutTemplateById('tpl_3_day_full_body_v1');
      const draft = buildCustomDraftFromReadyProgram(template, [], ['3-Day Full Body Custom']);

      assert.equal(draft.name, '3-Day Full Body Custom 2');
      const cableCrunch = draft.sessions[0].exercises.find((exercise) => exercise.name === 'Cable Crunch');
      assert.equal(cableCrunch.trackedDefault, false);
    },
  },
  {
    name: 'ready program duplication keeps matching library ids when available',
    run() {
      const template = {
        id: 'tpl_test',
        name: 'Test Plan',
        goalType: 'general',
        level: 'beginner',
        splitType: 'full_body',
        daysPerWeek: 1,
        estimatedSessionDuration: 45,
        progressionModel: 'double_progression',
        defaultScheduleMode: 'rolling_sequence',
        progressionRules: {
          primary: 'x',
          secondary: 'x',
          accessory: 'x',
          failureHandling: 'x',
        },
        sessions: [
          {
            id: 's1',
            name: 'Session 1',
            orderIndex: 1,
            exercises: [
              {
                id: 'ex1',
                exerciseName: 'Bench Press',
                slotId: 'bench_slot',
                role: 'primary',
                progressionPriority: 'high',
                trackingMode: 'load_and_reps',
                sets: 3,
                repsMin: 5,
                repsMax: 8,
                restSecondsMin: 120,
                restSecondsMax: 150,
                substitutionGroup: 'horizontal_press',
              },
            ],
          },
        ],
      };

      const draft = buildCustomDraftFromReadyProgram(template, [
        { id: 'lib_bench', name: 'Bench Press', category: 'compound', bodyPart: 'chest', equipment: 'barbell' },
      ], []);

      assert.equal(draft.sessions[0].exercises[0].libraryItemId, 'lib_bench');
    },
  },
];
