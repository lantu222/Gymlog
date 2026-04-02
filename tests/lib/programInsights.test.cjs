const assert = require('node:assert/strict');

const { buildProgramInsightMap } = require('../../.test-dist/lib/programInsights.js');

module.exports = [
  {
    name: 'program insights expose next session, top set, and session statuses',
    run() {
      const database = {
        workoutTemplates: [],
        exerciseTemplates: [],
        workoutPlans: [],
        exerciseLibrary: [],
        workoutSessions: [
          {
            id: 'session_upper',
            workoutTemplateId: 'custom_1',
            workoutNameSnapshot: 'Upper Lower - Upper',
            performedAt: '2026-03-24T08:00:00.000Z',
          },
        ],
        exerciseLogs: [
          {
            id: 'log_bench',
            sessionId: 'session_upper',
            exerciseTemplateId: null,
            exerciseNameSnapshot: 'Bench Press',
            weight: 85,
            repsPerSet: [8, 7, 6],
            tracked: true,
            orderIndex: 0,
            sets: [
              { orderIndex: 0, weight: 85, reps: 8, kind: 'working', outcome: 'completed' },
              { orderIndex: 1, weight: 85, reps: 7, kind: 'working', outcome: 'completed' },
              { orderIndex: 2, weight: 85, reps: 6, kind: 'working', outcome: 'completed' },
            ],
          },
        ],
        bodyweightEntries: [],
        preferences: {
          unitPreference: 'kg',
          theme: 'dark',
          defaultRestSeconds: 120,
          autoFocusNextInput: true,
          keepScreenAwakeDuringWorkout: true,
          onboardingCompleted: true,
          activePlanId: null,
        },
      };

      const insights = buildProgramInsightMap({
        database,
        programs: [
          {
            id: 'custom_1',
            name: 'Upper Lower',
            sessions: [
              { id: 'upper', name: 'Upper', orderIndex: 0, exercises: [] },
              { id: 'lower', name: 'Lower', orderIndex: 1, exercises: [] },
            ],
            weeklyTarget: 2,
          },
        ],
        unitPreference: 'kg',
        activeSession: null,
        now: new Date('2026-03-26T12:00:00.000Z'),
      });

      assert.equal(insights.custom_1.cardPrimary, 'Next: Lower');
      assert.match(insights.custom_1.cardSecondary, /Top set: Bench Press 85 kg/);
      assert.match(insights.custom_1.sessionStatusById.upper, /Last done/);
      assert.match(insights.custom_1.sessionStatusById.lower, /Next up/);
      assert.equal(insights.custom_1.highlights[0].label, 'This week');
      assert.equal(insights.custom_1.highlights[1].label, 'Rhythm');
      assert.match(insights.custom_1.highlights[1].value, /1\/9/);
    },
  },
  {
    name: 'program insights prefer live session when active session exists',
    run() {
      const database = {
        workoutTemplates: [],
        exerciseTemplates: [],
        workoutPlans: [],
        exerciseLibrary: [],
        workoutSessions: [],
        exerciseLogs: [],
        bodyweightEntries: [],
        preferences: {
          unitPreference: 'kg',
          theme: 'dark',
          defaultRestSeconds: 120,
          autoFocusNextInput: true,
          keepScreenAwakeDuringWorkout: true,
          onboardingCompleted: true,
          activePlanId: null,
        },
      };

      const insights = buildProgramInsightMap({
        database,
        programs: [
          {
            id: 'custom_1',
            name: 'Upper Lower',
            sessions: [
              { id: 'upper', name: 'Upper', orderIndex: 0, exercises: [] },
              { id: 'lower', name: 'Lower', orderIndex: 1, exercises: [] },
            ],
            weeklyTarget: 2,
          },
        ],
        unitPreference: 'kg',
        activeSession: {
          sessionId: 'live_1',
          templateId: 'custom_1',
          templateName: 'Upper Lower - Lower',
          status: 'active',
          startedAt: '2026-03-26T08:00:00.000Z',
          updatedAt: '2026-03-26T08:00:00.000Z',
          elapsedSeconds: 0,
          activePlanMode: 'rolling_sequence',
          exercises: [],
          restTimer: {
            status: 'idle',
            exerciseSlotId: null,
            setIndex: null,
            startedAtMs: null,
            endsAtMs: null,
            durationSeconds: 0,
          },
          ui: {
            activeSlotId: null,
            activeSetIndex: 0,
            focusedField: null,
            noteEditorSlotId: null,
            swapSheetSlotId: null,
            expandedSlotIds: [],
            finishSummaryOpen: false,
          },
          sessionOrderIndex: 1,
        },
        now: new Date('2026-03-26T12:00:00.000Z'),
      });

      assert.equal(insights.custom_1.cardPrimary, 'Live now: Lower');
      assert.match(insights.custom_1.sessionStatusById.lower, /Live now/);
    },
  },
  {
    name: 'program insights surface pr signal and pace when a new best set lands',
    run() {
      const database = {
        workoutTemplates: [],
        exerciseTemplates: [],
        workoutPlans: [],
        exerciseLibrary: [],
        workoutSessions: [
          {
            id: 'session_old',
            workoutTemplateId: 'custom_1',
            workoutNameSnapshot: 'Upper Lower - Upper',
            performedAt: '2026-03-10T08:00:00.000Z',
          },
          {
            id: 'session_new',
            workoutTemplateId: 'custom_1',
            workoutNameSnapshot: 'Upper Lower - Upper',
            performedAt: '2026-03-24T08:00:00.000Z',
          },
        ],
        exerciseLogs: [
          {
            id: 'log_old_bench',
            sessionId: 'session_old',
            exerciseTemplateId: null,
            exerciseNameSnapshot: 'Bench Press',
            weight: 85,
            repsPerSet: [6],
            tracked: true,
            orderIndex: 0,
            sets: [
              { orderIndex: 0, weight: 85, reps: 6, kind: 'working', outcome: 'completed' },
            ],
          },
          {
            id: 'log_new_bench',
            sessionId: 'session_new',
            exerciseTemplateId: null,
            exerciseNameSnapshot: 'Bench Press',
            weight: 87.5,
            repsPerSet: [6],
            tracked: true,
            orderIndex: 0,
            sets: [
              { orderIndex: 0, weight: 87.5, reps: 6, kind: 'working', outcome: 'completed' },
            ],
          },
        ],
        bodyweightEntries: [],
        preferences: {
          unitPreference: 'kg',
          theme: 'dark',
          defaultRestSeconds: 120,
          autoFocusNextInput: true,
          keepScreenAwakeDuringWorkout: true,
          onboardingCompleted: true,
          activePlanId: null,
        },
      };

      const insights = buildProgramInsightMap({
        database,
        programs: [
          {
            id: 'custom_1',
            name: 'Upper Lower',
            sessions: [
              { id: 'upper', name: 'Upper', orderIndex: 0, exercises: [] },
              { id: 'lower', name: 'Lower', orderIndex: 1, exercises: [] },
            ],
            weeklyTarget: 2,
          },
        ],
        unitPreference: 'kg',
        activeSession: null,
        now: new Date('2026-03-26T12:00:00.000Z'),
      });

      assert.match(insights.custom_1.cardSecondary, /^PR: Bench Press 87\.5 kg/);
      assert.ok(insights.custom_1.highlights.some((item) => item.label === 'PR signal' && item.value === 'New PR'));
      assert.ok(insights.custom_1.highlights.some((item) => item.label === 'Rhythm' && item.detail === 'Behind target'));
    },
  },
];
