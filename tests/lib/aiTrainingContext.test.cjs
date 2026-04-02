const assert = require('node:assert/strict');

const { buildAiTrainingContext } = require('../../.test-dist/lib/aiTrainingContext.js');

module.exports = [
  {
    name: 'ai training context keeps a compact but actionable vallu summary',
    run() {
      const context = buildAiTrainingContext({
        unitPreference: 'kg',
        activeWorkoutSummary: {
          title: '3-Day Full Body',
          nextExercise: 'Back Squat',
          meta: '12 sets left | Started 15:49',
        },
        homeSummary: {
          streak: {
            sessionsThisWeek: 2,
            sessionsLast30Days: 7,
            activity: {
              days: [
                {
                  dayStart: 1,
                  dayNumber: 10,
                  weekdayLabel: 'ma',
                  active: true,
                  isToday: false,
                },
                {
                  dayStart: 2,
                  dayNumber: 11,
                  weekdayLabel: 'ti',
                  active: false,
                  isToday: true,
                },
              ],
            },
          },
        },
        workoutSessions: [
          {
            id: 's1',
            workoutTemplateId: 't1',
            workoutNameSnapshot: 'Push Day',
            performedAt: '2026-03-26T09:00:00.000Z',
            durationMinutes: 52,
            setsCompleted: 15,
            exercisesSwapped: 1,
            noteCount: 2,
          },
          { id: 's2', workoutTemplateId: 't2', workoutNameSnapshot: 'Upper', performedAt: '2026-03-25T09:00:00.000Z' },
        ],
        trackedProgress: [
          {
            key: 'bench',
            name: 'Bench Press',
            logs: [],
            latestWeight: 85,
            previousWeight: 82.5,
            latestReps: '7,7,6',
            bestWeight: 87.5,
            bestReps: 21,
            latestLog: { performedAt: '2026-03-26T09:00:00.000Z' },
          },
        ],
        readyProgramCount: 3,
        recommendedProgramId: 'tpl_3_day_full_body_v1',
        recommendedProgramTitle: '3-Day Full Body',
        customProgramTitle: 'Oma ylakroppa',
      });

      assert.deepEqual(Object.keys(context).sort(), [
        'activeSession',
        'customProgramTitle',
        'latestTopSets',
        'readyProgramCount',
        'recentCompletedSessions',
        'recommendedProgramId',
        'recommendedProgramTitle',
        'rhythm',
        'sessionsLast30Days',
        'sessionsThisWeek',
        'trackedLifts',
        'unitPreference',
      ]);
      assert.equal(context.activeSession.title, '3-Day Full Body');
      assert.equal(context.recentCompletedSessions[0].title, 'Push Day');
      assert.equal(context.recentCompletedSessions[0].sessionId, 's1');
      assert.equal(context.recentCompletedSessions[0].noteCount, 2);
      assert.equal(context.recommendedProgramTitle, '3-Day Full Body');
      assert.equal(context.trackedLifts[0].key, 'bench');
      assert.equal(context.trackedLifts[0].name, 'Bench Press');
      assert.equal(context.latestTopSets[0].reps, '7,7,6');
      assert.equal(context.rhythm.length, 2);
    },
  },
];
