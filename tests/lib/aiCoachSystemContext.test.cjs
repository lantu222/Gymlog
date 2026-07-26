const assert = require('node:assert/strict');

const { buildAiCoachSystemContext } = require('../../.test-dist/lib/aiCoachSystemContext.js');

function history(overrides = {}) {
  return {
    windowDays: 56,
    sessionCount: 0,
    totalVolumeKg: 0,
    sessions: [],
    lifts: [],
    weeks: [],
    schedule: null,
    truncated: false,
    ...overrides,
  };
}

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
    fatigue: { acwr: 1.05, recoveryScore: 98, signal: 'optimal', sessionCount7d: 2, confident: true },
    history: history(),
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
    name: 'recent sessions are dropped once the history block covers them',
    run() {
      const out = buildAiCoachSystemContext(
        baseContext({
          recentCompletedSessions: [
            { sessionId: 's1', title: 'Push Day', performedAt: '2026-07-14T09:00:00.000Z', durationMinutes: 52, setsCompleted: 15, swappedExercises: 0, noteCount: 0 },
          ],
          history: history({
            sessionCount: 1,
            sessions: [
              {
                sessionId: 's1',
                name: 'Push Day',
                performedAt: '2026-07-14T09:00:00.000Z',
                durationMinutes: 52,
                volumeKg: 4300,
                setCount: 15,
                exerciseCount: 4,
              },
            ],
          }),
        }),
      );

      // The same session listed twice is a session a model can count twice.
      assert.ok(!out.includes('Recent sessions'));
      assert.equal(out.split('2026-07-14').length - 1, 1);
    },
  },
  {
    name: 'a lift that is up over the window but stuck right now says both',
    run() {
      const out = buildAiCoachSystemContext(
        baseContext({
          history: history({
            sessionCount: 6,
            lifts: [
              {
                name: 'Bench Press',
                sessions: 6,
                firstWeightKg: 80,
                latestWeightKg: 82.5,
                latestReps: 6,
                bestWeightKg: 82.5,
                changeKg: 2.5,
                spanDays: 49,
                stalledSessions: 5,
                weightSeriesKg: [80, 80, 82.5, 82.5, 82.5, 82.5],
              },
            ],
          }),
        }),
      );

      assert.ok(out.includes('+2.5 kg over 49 days'));
      assert.ok(
        out.includes('but flat at 82.5 kg for 5 sessions'),
        'the window gain must not hide the current stall',
      );
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
  {
    name: 'an unconfident fatigue reading is never stated as a signal',
    run() {
      const out = buildAiCoachSystemContext(
        baseContext({
          fatigue: { acwr: 4, recoveryScore: 20, signal: 'high', sessionCount7d: 1, confident: false },
        }),
      );

      // One logged session divided across a four-week chronic window produces
      // an alarming ratio out of nothing. It must not reach the model as fact.
      assert.ok(!out.includes('ACWR'));
      assert.ok(!out.includes('high'));
      assert.ok(!out.includes('Recovery 20/100'));
      assert.ok(out.includes('do not comment on fatigue'));
    },
  },
  {
    name: 'an empty history tells the model not to describe trends',
    run() {
      const out = buildAiCoachSystemContext(baseContext());

      assert.ok(out.includes('No sessions logged in this window'));
      assert.ok(!out.includes('## Weeks'));
      assert.ok(!out.includes('## Sessions'));
      assert.ok(!out.includes('Lift trajectories'));
    },
  },
  {
    name: 'the history block carries weeks, sessions and lift trajectories',
    run() {
      const out = buildAiCoachSystemContext(
        baseContext({
          history: history({
            sessionCount: 2,
            totalVolumeKg: 9100,
            weeks: [
              { weekStart: '2026-07-13', sessions: 2, volumeKg: 9100, plannedSessions: 3 },
              { weekStart: '2026-07-20', sessions: 0, volumeKg: 0, plannedSessions: 2 },
            ],
            sessions: [
              {
                sessionId: 's1',
                name: 'Push',
                performedAt: '2026-07-14T09:00:00.000Z',
                durationMinutes: 48,
                volumeKg: 4300,
                setCount: 14,
                exerciseCount: 4,
              },
              {
                sessionId: 's2',
                name: 'Push',
                performedAt: '2026-07-17T09:00:00.000Z',
                durationMinutes: 51,
                volumeKg: 4800,
                setCount: 15,
                exerciseCount: 4,
              },
            ],
            lifts: [
              {
                name: 'Barbell Squat',
                sessions: 3,
                firstWeightKg: 95,
                latestWeightKg: 102.5,
                latestReps: 5,
                bestWeightKg: 102.5,
                changeKg: 7.5,
                spanDays: 14,
                stalledSessions: 1,
                weightSeriesKg: [95, 100, 102.5],
              },
            ],
          }),
        }),
      );

      // A reader should be able to rebuild the window from this alone.
      assert.ok(out.includes('week of 2026-07-13: 2/3 planned'));
      assert.ok(out.includes('week of 2026-07-20: 0/2 planned'), 'a missed week must still appear');
      assert.ok(out.includes('2026-07-17 | Push | 51 min'));
      assert.ok(out.includes('14 sets across 4 exercises'));
      assert.ok(out.includes('Barbell Squat: +7.5 kg over 14 days'));
      assert.ok(out.includes('top sets 95 → 100 → 102.5'));
      assert.ok(!out.includes('No sessions logged'));
    },
  },
  {
    name: 'a stalled lift reads as flat rather than as a zero change',
    run() {
      const out = buildAiCoachSystemContext(
        baseContext({
          history: history({
            sessionCount: 3,
            lifts: [
              {
                name: 'Bench Press',
                sessions: 3,
                firstWeightKg: 80,
                latestWeightKg: 80,
                latestReps: 5,
                bestWeightKg: 82.5,
                changeKg: 0,
                spanDays: 21,
                stalledSessions: 3,
                weightSeriesKg: [80, 80, 80],
              },
            ],
          }),
        }),
      );

      assert.ok(out.includes('Bench Press: flat at 80 kg for 3 sessions'));
      assert.ok(out.includes('best 82.5 kg'), 'a lift below its own best should say so');
    },
  },
  {
    name: 'schedule adherence reports planned against done',
    run() {
      const out = buildAiCoachSystemContext(
        baseContext({
          history: history({
            sessionCount: 5,
            schedule: {
              trainingDays: ['mon', 'thu'],
              plannedPerWeek: 2,
              plannedSessions: 8,
              completedSessions: 5,
            },
          }),
        }),
      );

      assert.ok(out.includes('## Schedule'));
      assert.ok(out.includes('2x/week on mon, thu'));
      assert.ok(out.includes('5 done of 8 planned'));
    },
  },
];
