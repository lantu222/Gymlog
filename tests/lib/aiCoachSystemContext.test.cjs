const assert = require('node:assert/strict');

const { buildAiCoachSystemContext } = require('../../.test-dist/lib/aiCoachSystemContext.js');

function baseContext(overrides = {}) {
  return {
    unitPreference: 'kg',
    activeSession: null,
    recentCompletedSessions: [],
    trackedLifts: [],
    latestTopSets: [],
    sessionsThisWeek: 2,
    sessionsLast30Days: 8,
    rhythm: [],
    readyProgramCount: 5,
    recommendedProgramId: null,
    recommendedProgramTitle: null,
    customProgramTitle: null,
    plateaus: [],
    fatigue: { acwr: 1.05, recoveryScore: 98, signal: 'optimal', sessionCount7d: 2 },
    ...overrides,
  };
}

module.exports = [
  {
    name: 'system context always includes load section with fatigue fields',
    run() {
      const out = buildAiCoachSystemContext(baseContext());
      assert.ok(out.includes('## Load'));
      assert.ok(out.includes('ACWR 1.05'));
      assert.ok(out.includes('optimal'));
      assert.ok(out.includes('Recovery 98/100'));
      assert.ok(out.includes('2 sessions'));
    },
  },
  {
    name: 'system context includes plateau section when plateaus exist',
    run() {
      const out = buildAiCoachSystemContext(
        baseContext({
          plateaus: [
            { exerciseKey: 'bench press', name: 'Bench Press', stagnantSessions: 4, topWeightKg: 100 },
          ],
        }),
      );
      assert.ok(out.includes('## Plateaus detected'));
      assert.ok(out.includes('Bench Press'));
      assert.ok(out.includes('4 sessions at 100 kg'));
    },
  },
  {
    name: 'system context omits plateau section when no plateaus',
    run() {
      const out = buildAiCoachSystemContext(baseContext({ plateaus: [] }));
      assert.ok(!out.includes('Plateaus'));
    },
  },
  {
    name: 'system context includes active session when present',
    run() {
      const out = buildAiCoachSystemContext(
        baseContext({
          activeSession: { title: 'Push Day', nextExercise: 'Bench Press', meta: '3 sets left' },
        }),
      );
      assert.ok(out.includes('## Active session'));
      assert.ok(out.includes('Push Day'));
      assert.ok(out.includes('Bench Press next'));
    },
  },
  {
    name: 'system context omits active session when null',
    run() {
      const out = buildAiCoachSystemContext(baseContext({ activeSession: null }));
      assert.ok(!out.includes('Active session'));
    },
  },
  {
    name: 'system context includes recent sessions',
    run() {
      const out = buildAiCoachSystemContext(
        baseContext({
          recentCompletedSessions: [
            { sessionId: 's1', title: 'Push Day', performedAt: '2026-05-10T09:00:00.000Z', durationMinutes: 52, setsCompleted: 15, swappedExercises: 0, noteCount: 0 },
          ],
        }),
      );
      assert.ok(out.includes('## Recent sessions'));
      assert.ok(out.includes('Push Day'));
      assert.ok(out.includes('52 min'));
      assert.ok(out.includes('2026-05-10'));
    },
  },
  {
    name: 'system context includes tracked lifts with best weight',
    run() {
      const out = buildAiCoachSystemContext(
        baseContext({
          trackedLifts: [
            { key: 'bench', name: 'Bench Press', latestWeight: 85, bestWeight: 90, latestReps: '8,7,6' },
          ],
        }),
      );
      assert.ok(out.includes('## Tracked lifts'));
      assert.ok(out.includes('Bench Press: 85 kg x 8,7,6'));
      assert.ok(out.includes('best: 90 kg'));
    },
  },
  {
    name: 'system context includes planner setup when present',
    run() {
      const out = buildAiCoachSystemContext(
        baseContext({
          plannerSetup: {
            goal: 'strength',
            daysPerWeek: 4,
            experience: 'intermediate',
            sessionMinutes: 60,
            equipment: 'full_gym',
            recovery: 'moderate',
            mustInclude: ['deadlift'],
            avoid: ['overhead press'],
            limitations: [],
          },
        }),
      );
      assert.ok(out.includes('## Athlete profile'));
      assert.ok(out.includes('strength'));
      assert.ok(out.includes('4d/week'));
      assert.ok(out.includes('must include: deadlift'));
      assert.ok(out.includes('avoid: overhead press'));
    },
  },
  {
    name: 'system context omits planner setup when null',
    run() {
      const out = buildAiCoachSystemContext(baseContext({ plannerSetup: null }));
      assert.ok(!out.includes('Athlete profile'));
    },
  },
  {
    name: 'system context does not contain raw JSON brackets',
    run() {
      const out = buildAiCoachSystemContext(
        baseContext({
          plateaus: [{ exerciseKey: 'squat', name: 'Squat', stagnantSessions: 3, topWeightKg: 120 }],
          recentCompletedSessions: [
            { sessionId: 's1', title: 'Legs', performedAt: '2026-05-09T09:00:00.000Z', durationMinutes: 45, setsCompleted: 12, swappedExercises: 0, noteCount: 0 },
          ],
        }),
      );
      assert.ok(!out.includes('{"'), 'output should not contain raw JSON object literals');
      assert.ok(!out.includes('"sessionId"'), 'output should not contain JSON field names');
    },
  },
];
