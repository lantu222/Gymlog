const assert = require('node:assert/strict');

const { buildAiTrainingContext } = require('../../.test-dist/lib/aiTrainingContext.js');

module.exports = [
  {
    name: 'ai training context keeps a compact but actionable aiCoach summary without active workout context by default',
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
        exerciseLogs: [],
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
        'body',
        'customProgramTitle',
        'fatigue',
        'goals',
        'history',
        'homeState',
        'latestTopSets',
        'plateaus',
        'profile',
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
      assert.equal(context.activeSession, null);
      assert.equal(context.recentCompletedSessions[0].title, 'Push Day');
      assert.equal(context.recentCompletedSessions[0].sessionId, 's1');
      assert.equal(context.recentCompletedSessions[0].noteCount, 2);
      assert.equal(context.recommendedProgramTitle, '3-Day Full Body');
      assert.equal(context.trackedLifts[0].key, 'bench');
      assert.equal(context.trackedLifts[0].name, 'Bench Press');
      assert.equal(context.latestTopSets[0].reps, '7,7,6');
      assert.equal(context.rhythm.length, 2);
      // These sessions are months old, so the eight-week history is empty and
      // says so rather than reporting them as recent training.
      assert.equal(context.history.sessionCount, 0);
      assert.deepEqual(context.history.lifts, []);
    },
  },
  {
    name: 'the history block carries the last eight weeks of logged training',
    run() {
      const DAY = 86400000;
      const at = (daysAgo) => new Date(Date.now() - daysAgo * DAY).toISOString();
      const session = (id, performedAt, totalVolumeKg) => ({
        id,
        workoutTemplateId: 't1',
        workoutNameSnapshot: 'Push',
        performedAt,
        durationMinutes: 50,
        totalVolumeKg,
      });
      const log = (sessionId, weight) => ({
        id: `${sessionId}-bench`,
        sessionId,
        exerciseTemplateId: null,
        exerciseNameSnapshot: 'Bench Press',
        weight,
        repsPerSet: [5, 5, 5],
        tracked: true,
        orderIndex: 0,
      });

      const context = buildAiTrainingContext({
        unitPreference: 'kg',
        activeWorkoutSummary: null,
        homeSummary: {
          streak: { sessionsThisWeek: 1, sessionsLast30Days: 3, activity: { days: [] } },
        },
        workoutSessions: [
          session('s1', at(21), 3000),
          session('s2', at(14), 3200),
          session('s3', at(7), 3400),
        ],
        exerciseLogs: [log('s1', 80), log('s2', 80), log('s3', 80)],
        trackedProgress: [],
        readyProgramCount: 3,
        recommendedProgramId: null,
        recommendedProgramTitle: null,
        customProgramTitle: null,
        trainingDays: ['mon', 'thu'],
      });

      const history = context.history;
      assert.equal(history.sessionCount, 3);
      assert.equal(history.totalVolumeKg, 9600);
      assert.equal(history.truncated, false);
      assert.deepEqual(
        history.sessions.map((entry) => entry.setCount),
        [3, 3, 3],
      );

      // A lift logged at the same weight three times is a plateau the model can
      // see for itself, without being told the conclusion.
      assert.equal(history.lifts.length, 1);
      assert.equal(history.lifts[0].name, 'Bench Press');
      assert.equal(history.lifts[0].changeKg, 0);
      assert.equal(history.lifts[0].stalledSessions, 3);
      assert.deepEqual(history.lifts[0].weightSeriesKg, [80, 80, 80]);

      assert.ok(history.schedule);
      assert.deepEqual(history.schedule.trainingDays, ['mon', 'thu']);
      assert.equal(history.schedule.completedSessions, 3);
      assert.ok(
        history.schedule.plannedSessions >= history.schedule.completedSessions,
        'a twice-weekly schedule over four weeks plans at least as many as were done',
      );
      assert.ok(history.weeks.length >= 4);
    },
  },
  {
    // The deployed endpoint crashed on `context: {}` (FUNCTION_INVOCATION_FAILED,
    // formatLiftLine reading trackedLifts[0]) — the smoke test found it before
    // a user did. A context with fields missing is repaired, not thrown on.
    name: 'a context with fields missing is normalized so the preview can answer it',
    run() {
      const { normalizeAiCoachTrainingContext } = require('../../.test-dist/lib/aiTrainingContext.js');
      const { buildAiCoachPreviewAnswer } = require('../../.test-dist/lib/aiCoachPreview.js');
      for (const raw of [{}, null, undefined, { trackedLifts: 'nonsense' }, { unitPreference: 'stone' }]) {
        const context = normalizeAiCoachTrainingContext(raw);
        assert.deepEqual(context.trackedLifts, []);
        assert.equal(context.unitPreference, 'kg');
        assert.equal(context.fatigue.confident, false);
        assert.equal(typeof context.history.windowDays, 'number');
        const answer = buildAiCoachPreviewAnswer('hei', context, 'fi');
        assert.ok(answer && typeof answer.takeaway === 'string');
      }
      // A present field is trusted as sent.
      const kept = normalizeAiCoachTrainingContext({ unitPreference: 'lb', sessionsThisWeek: 3 });
      assert.equal(kept.unitPreference, 'lb');
      assert.equal(kept.sessionsThisWeek, 3);
    },
  },
  {
    name: 'history confidence is counted from the record, and both halves are needed for the top step',
    run() {
      const { resolveHistoryConfidence } = require('../../.test-dist/lib/aiTrainingContext.js');

      // The bottom step is the rule the prompt already had: three sessions is
      // where a trend starts.
      assert.equal(resolveHistoryConfidence(0, 0), 'low');
      assert.equal(resolveHistoryConfidence(2, 30), 'low');
      assert.equal(resolveHistoryConfidence(3, 1), 'medium');

      // Twelve sessions crammed into a fortnight say less about a direction
      // than the same twelve spread over six weeks, so the top step needs the
      // count and the calendar together.
      assert.equal(resolveHistoryConfidence(12, 41), 'medium', 'enough sessions, too short a stretch');
      assert.equal(resolveHistoryConfidence(11, 56), 'medium', 'long enough stretch, too few sessions');
      assert.equal(resolveHistoryConfidence(12, 42), 'high');
    },
  },
  {
    name: 'a history from an older app is recounted, not called short',
    run() {
      const { normalizeAiCoachTrainingContext } = require('../../.test-dist/lib/aiTrainingContext.js');

      // Defaulting a missing flag to 'low' would tell a reader with two
      // months of training that their record is too short to read.
      const sessions = Array.from({ length: 14 }, (_, index) => ({
        sessionId: `s${index}`,
        performedAt: new Date(2026, 5, 1 + index * 4).toISOString(),
      }));
      const recounted = normalizeAiCoachTrainingContext({
        history: { sessionCount: 14, sessions },
      });
      assert.equal(recounted.history.confidence, 'high');

      // A history that already carries the level is left alone.
      const asSent = normalizeAiCoachTrainingContext({
        history: { sessionCount: 14, sessions, confidence: 'medium' },
      });
      assert.equal(asSent.history.confidence, 'medium');

      // And a context with no history at all is still the empty one.
      assert.equal(normalizeAiCoachTrainingContext({}).history.confidence, 'low');
    },
  },
];
