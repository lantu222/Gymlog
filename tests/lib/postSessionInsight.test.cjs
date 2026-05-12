const assert = require('node:assert/strict');

const { computePostSessionInsight } = require('../../.test-dist/lib/postSessionInsight.js');

function session(id, performedAt, totalVolumeKg = 1000, setsCompleted = 3) {
  return { id, performedAt, totalVolumeKg, setsCompleted };
}

function log(sessionId, exerciseTemplateId, exerciseNameSnapshot, weight, reps, options = {}) {
  return {
    id: `${sessionId}_${exerciseTemplateId ?? exerciseNameSnapshot}`,
    sessionId,
    exerciseTemplateId,
    exerciseNameSnapshot,
    weight,
    repsPerSet: reps,
    sets: reps.map((rep, index) => ({
      orderIndex: index,
      weight,
      reps: rep,
      kind: 'working',
      outcome: options.outcome ?? 'completed',
      status: options.status ?? 'completed',
    })),
    tracked: options.tracked ?? true,
    orderIndex: options.orderIndex ?? 0,
    skipped: options.skipped ?? false,
  };
}

function baseInput(overrides = {}) {
  const completedSession = session('s4', '2026-05-08T10:00:00.000Z', 1400, 3);
  const priorSessions = [
    session('s1', '2026-04-20T10:00:00.000Z', 900, 3),
    session('s2', '2026-04-27T10:00:00.000Z', 1000, 3),
    session('s3', '2026-05-01T10:00:00.000Z', 1100, 3),
  ];

  return {
    completedSession,
    sessionExerciseLogs: [log('s4', 'bench', 'Bench press', 82.5, [5])],
    allPriorSessions: priorSessions,
    allPriorExerciseLogs: [
      log('s1', 'bench', 'Bench press', 75, [5]),
      log('s2', 'bench', 'Bench press', 80, [5]),
      log('s3', 'bench', 'Bench press', 80, [5]),
    ],
    lastInsightSessionId: null,
    lastInsightType: null,
    unitPreference: 'kg',
    ...overrides,
  };
}

module.exports = [
  {
    name: 'post-session insight returns null with fewer than 3 prior sessions',
    run() {
      const input = baseInput({
        allPriorSessions: [session('s1', '2026-05-01T10:00:00.000Z'), session('s2', '2026-05-04T10:00:00.000Z')],
      });

      assert.equal(computePostSessionInsight(input, new Date('2026-05-08T12:00:00.000Z')), null);
    },
  },
  {
    name: 'post-session insight returns null when the previous completed session already received an insight',
    run() {
      const input = baseInput({
        lastInsightSessionId: 's3',
        lastInsightType: 'personal_record',
      });

      assert.equal(computePostSessionInsight(input, new Date('2026-05-08T12:00:00.000Z')), null);
    },
  },
  {
    name: 'post-session insight detects a new top-set personal record',
    run() {
      const insight = computePostSessionInsight(baseInput(), new Date('2026-05-08T12:00:00.000Z'));

      assert.equal(insight.type, 'personal_record');
      assert.equal(insight.confidence, 1);
      assert.equal(insight.exerciseKey, 'bench');
      assert.match(insight.message, /Bench press/);
      assert.match(insight.message, /82.5 kg/);
      assert.equal(insight.message.includes('!'), false);
    },
  },
  {
    name: 'post-session insight detects same weight with more reps as a personal record',
    run() {
      const input = baseInput({
        sessionExerciseLogs: [log('s4', 'bench', 'Bench press', 80, [6])],
      });
      const insight = computePostSessionInsight(input, new Date('2026-05-08T12:00:00.000Z'));

      assert.equal(insight.type, 'personal_record');
      assert.equal(insight.confidence, 0.85);
      assert.match(insight.message, /80 kg/);
      assert.match(insight.message, /6/);
    },
  },
  {
    name: 'post-session insight does not trigger personal record from name-only exercise matching',
    run() {
      const input = baseInput({
        sessionExerciseLogs: [log('s4', null, 'Bench press', 90, [5])],
      });

      assert.equal(computePostSessionInsight(input, new Date('2026-05-08T12:00:00.000Z')), null);
    },
  },
  {
    name: 'post-session insight detects a three-session plateau by exercise id',
    run() {
      const input = baseInput({
        sessionExerciseLogs: [log('s4', 'bench', 'Bench press', 80, [5])],
      });
      const insight = computePostSessionInsight(input, new Date('2026-05-08T12:00:00.000Z'));

      assert.equal(insight.type, 'plateau_detected');
      assert.equal(insight.confidence, 0.9);
      assert.match(insight.message, /three sessions/);
      assert.match(insight.message, /80 kg/);
    },
  },
  {
    name: 'post-session insight detects a six-week session volume peak',
    run() {
      const input = baseInput({
        completedSession: session('s4', '2026-05-08T10:00:00.000Z', 1800, 3),
        sessionExerciseLogs: [log('s4', 'bench', 'Bench press', 75, [5])],
        allPriorSessions: [
          session('s0', '2026-03-01T10:00:00.000Z', 2500, 3),
          session('s1', '2026-04-10T10:00:00.000Z', 900, 3),
          session('s2', '2026-04-20T10:00:00.000Z', 1000, 3),
          session('s3', '2026-05-01T10:00:00.000Z', 1100, 3),
          session('s5', '2026-05-04T10:00:00.000Z', 1200, 3),
        ],
      });
      const insight = computePostSessionInsight(input, new Date('2026-05-08T12:00:00.000Z'));

      assert.equal(insight.type, 'session_volume_peak');
      assert.equal(insight.confidence, 0.85);
      assert.match(insight.message, /volume/);
      assert.match(insight.message, /six weeks/);
    },
  },
  {
    name: 'post-session insight detects return after a 7 day gap',
    run() {
      const input = baseInput({
        sessionExerciseLogs: [log('s4', 'bench', 'Bench press', 75, [5])],
        allPriorSessions: [
          session('s1', '2026-04-10T10:00:00.000Z', 900, 3),
          session('s2', '2026-04-20T10:00:00.000Z', 1000, 3),
          session('s3', '2026-05-01T10:00:00.000Z', 1100, 3),
        ],
      });
      const insight = computePostSessionInsight(input, new Date('2026-05-08T12:00:00.000Z'));

      assert.equal(insight.type, 'return_after_gap');
      assert.equal(insight.confidence, 0.95);
      assert.match(insight.message, /7 days/);
    },
  },
  {
    name: 'post-session insight priority returns personal record over plateau',
    run() {
      const input = baseInput({
        sessionExerciseLogs: [log('s4', 'bench', 'Bench press', 85, [5])],
        allPriorExerciseLogs: [
          log('s1', 'bench', 'Bench press', 80, [5]),
          log('s2', 'bench', 'Bench press', 80, [5]),
          log('s3', 'bench', 'Bench press', 80, [5]),
        ],
      });
      const insight = computePostSessionInsight(input, new Date('2026-05-08T12:00:00.000Z'));

      assert.equal(insight.type, 'personal_record');
    },
  },
  {
    name: 'post-session insight does not repeat the last insight type consecutively',
    run() {
      const input = baseInput({
        lastInsightSessionId: 'older_session',
        lastInsightType: 'personal_record',
      });

      assert.equal(computePostSessionInsight(input, new Date('2026-05-08T12:00:00.000Z')), null);
    },
  },
];
