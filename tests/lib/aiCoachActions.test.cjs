const assert = require('node:assert/strict');

const { buildAiCoachActions } = require('../../.test-dist/lib/aiCoachActions.js');

function createContext(overrides = {}) {
  return {
    unitPreference: 'kg',
    activeSession: {
      title: '4-Day Upper/Lower',
      nextExercise: 'Bench Press',
      meta: '8 sets left',
    },
    recentCompletedSessions: [
      {
        sessionId: 'session_1',
        title: 'Upper A',
        performedAt: '2026-03-31T10:00:00.000Z',
        durationMinutes: 58,
        setsCompleted: 14,
        swappedExercises: 1,
        noteCount: 2,
      },
    ],
    trackedLifts: [
      {
        key: 'bench press',
        name: 'Bench Press',
        latestWeight: 85,
        bestWeight: 87.5,
        latestReps: '8,7,6',
      },
    ],
    latestTopSets: [],
    sessionsThisWeek: 2,
    sessionsLast30Days: 8,
    rhythm: [],
    readyProgramCount: 12,
    recommendedProgramId: 'tpl_3_day_full_body_v1',
    recommendedProgramTitle: '3-Day Full Body',
    customProgramTitle: 'Upper / Lower',
    ...overrides,
  };
}

module.exports = [
  {
    name: 'ai coach actions turn a stuck lift question into progress and history actions',
    run() {
      const actions = buildAiCoachActions('Why is my bench stuck?', createContext());

      assert.equal(actions[0].kind, 'open_lift_progress');
      assert.equal(actions[0].exerciseKey, 'bench press');
      assert.equal(actions[1].kind, 'open_last_session');
    },
  },
  {
    name: 'ai coach actions turn a program question into plan, setup, and custom-editor actions',
    run() {
      const actions = buildAiCoachActions('Fix my split for 4 days', createContext());

      assert.deepEqual(
        actions.map((action) => action.kind),
        ['open_recommended_program', 'review_setup', 'open_custom_editor'],
      );
      assert.equal(actions[2].prefillName, '4-Day AI Coach Plan');
    },
  },
  {
    name: 'ai coach actions can direct home gym questions back to setup review',
    run() {
      const actions = buildAiCoachActions('Swap this for a home gym setup', createContext());
      const setupAction = actions.find((action) => action.kind === 'review_setup');

      assert.ok(setupAction);
      assert.equal(setupAction.label, 'Swap setup for home gym');
    },
  },
  {
    name: 'ai coach actions prioritize resuming the live workout for current-session prompts',
    run() {
      const actions = buildAiCoachActions('What should my next move be in this workout?', createContext());

      assert.equal(actions[0].kind, 'resume_workout');
    },
  },
];
