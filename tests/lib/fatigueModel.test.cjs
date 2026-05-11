const assert = require('node:assert/strict');

const { createEmptyDatabase } = require('../../.test-dist/data/seed.js');
const { buildFatigueModel } = require('../../.test-dist/lib/fatigueModel.js');

const NOW = new Date('2026-05-11T12:00:00.000Z');

function daysAgo(n) {
  return new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString();
}

function makeSession(id, performedAt, totalVolumeKg) {
  return {
    id,
    workoutTemplateId: 'tpl',
    workoutNameSnapshot: 'Push',
    performedAt,
    totalVolumeKg,
  };
}

module.exports = [
  {
    name: 'fatigue: no sessions produces undertrained signal and safe defaults',
    run() {
      const db = createEmptyDatabase();
      const result = buildFatigueModel({ workoutSessions: db.workoutSessions, exerciseLogs: db.exerciseLogs }, NOW);
      assert.equal(result.signal, 'undertrained');
      assert.equal(result.acuteLoadKg, 0);
      assert.equal(result.chronicLoadKg, 0);
      assert.equal(result.acwr, 0);
      assert.equal(result.sessionCount7d, 0);
      assert.equal(result.sessionCount28d, 0);
    },
  },
  {
    name: 'fatigue: consistent weekly volume gives optimal signal',
    run() {
      // 4 sessions per week for 4 weeks, each with 2000 kg → chronic = 2000, acute = 2000, acwr = 1.0
      const db = createEmptyDatabase();
      db.workoutSessions = [
        // this week
        makeSession('w4a', daysAgo(1), 500),
        makeSession('w4b', daysAgo(2), 500),
        makeSession('w4c', daysAgo(4), 500),
        makeSession('w4d', daysAgo(6), 500),
        // week 2
        makeSession('w3a', daysAgo(8), 500),
        makeSession('w3b', daysAgo(10), 500),
        makeSession('w3c', daysAgo(12), 500),
        makeSession('w3d', daysAgo(14), 500),
        // week 3
        makeSession('w2a', daysAgo(15), 500),
        makeSession('w2b', daysAgo(17), 500),
        makeSession('w2c', daysAgo(19), 500),
        makeSession('w2d', daysAgo(21), 500),
        // week 4
        makeSession('w1a', daysAgo(22), 500),
        makeSession('w1b', daysAgo(24), 500),
        makeSession('w1c', daysAgo(26), 500),
        makeSession('w1d', daysAgo(27), 500),
      ];
      const result = buildFatigueModel({ workoutSessions: db.workoutSessions, exerciseLogs: db.exerciseLogs }, NOW);
      assert.equal(result.signal, 'optimal');
      assert.equal(result.acwr, 1);
      assert.ok(result.recoveryScore >= 75, `expected score >= 75, got ${result.recoveryScore}`);
    },
  },
  {
    name: 'fatigue: spike week with low chronic baseline gives elevated or high signal',
    run() {
      const db = createEmptyDatabase();
      // chronic: 3 light weeks at 1000 kg each → chronicLoadKg = (3000 + acuteLoad) / 4
      // acute: 4000 kg this week → acwr ≈ 4000 / (7000/4) = 4000/1750 ≈ 2.28 → high
      db.workoutSessions = [
        makeSession('spike1', daysAgo(1), 1000),
        makeSession('spike2', daysAgo(2), 1000),
        makeSession('spike3', daysAgo(3), 1000),
        makeSession('spike4', daysAgo(4), 1000),
        makeSession('base1', daysAgo(10), 500),
        makeSession('base2', daysAgo(17), 500),
        makeSession('base3', daysAgo(24), 500),
      ];
      const result = buildFatigueModel({ workoutSessions: db.workoutSessions, exerciseLogs: db.exerciseLogs }, NOW);
      assert.ok(result.acwr > 1.5, `expected acwr > 1.5, got ${result.acwr}`);
      assert.equal(result.signal, 'high');
      assert.ok(result.recoveryScore < 50);
    },
  },
  {
    name: 'fatigue: active last 3 weeks but no sessions this week gives undertrained',
    run() {
      const db = createEmptyDatabase();
      db.workoutSessions = [
        makeSession('old1', daysAgo(8), 1000),
        makeSession('old2', daysAgo(15), 1000),
        makeSession('old3', daysAgo(22), 1000),
      ];
      const result = buildFatigueModel({ workoutSessions: db.workoutSessions, exerciseLogs: db.exerciseLogs }, NOW);
      assert.equal(result.acuteLoadKg, 0);
      assert.equal(result.sessionCount7d, 0);
      assert.equal(result.sessionCount28d, 3);
      assert.equal(result.signal, 'undertrained');
    },
  },
  {
    name: 'fatigue: sessions older than 28 days are excluded',
    run() {
      const db = createEmptyDatabase();
      db.workoutSessions = [
        makeSession('recent', daysAgo(3), 2000),
        makeSession('old', daysAgo(35), 99999), // must not count
      ];
      const result = buildFatigueModel({ workoutSessions: db.workoutSessions, exerciseLogs: db.exerciseLogs }, NOW);
      assert.equal(result.sessionCount28d, 1);
      assert.equal(result.acuteLoadKg, 2000);
    },
  },
  {
    name: 'fatigue: falls back to exerciseLogs volume when totalVolumeKg is missing',
    run() {
      const db = createEmptyDatabase();
      // session without totalVolumeKg — should use log-level computation
      db.workoutSessions = [
        { id: 'sess1', workoutTemplateId: 'tpl', workoutNameSnapshot: 'Push', performedAt: daysAgo(2) },
        { id: 'sess2', workoutTemplateId: 'tpl', workoutNameSnapshot: 'Push', performedAt: daysAgo(10) },
        { id: 'sess3', workoutTemplateId: 'tpl', workoutNameSnapshot: 'Push', performedAt: daysAgo(18) },
        { id: 'sess4', workoutTemplateId: 'tpl', workoutNameSnapshot: 'Push', performedAt: daysAgo(26) },
      ];
      // 4 sets of 100 kg x 5 reps = 2000 kg per session
      function makeLogs(sessionId) {
        return [0, 1, 2, 3].map((i) => ({
          id: `${sessionId}_log_${i}`,
          sessionId,
          exerciseTemplateId: null,
          exerciseNameSnapshot: 'Squat',
          weight: 100,
          repsPerSet: [5, 5, 5, 5],
          sets: [0, 1, 2, 3].map((j) => ({
            orderIndex: j,
            weight: 100,
            reps: 5,
            kind: 'working',
            outcome: 'completed',
            status: 'completed',
          })),
          tracked: true,
          orderIndex: i,
          skipped: false,
        }));
      }
      db.exerciseLogs = [
        ...makeLogs('sess1'),
        ...makeLogs('sess2'),
        ...makeLogs('sess3'),
        ...makeLogs('sess4'),
      ];
      const result = buildFatigueModel({ workoutSessions: db.workoutSessions, exerciseLogs: db.exerciseLogs }, NOW);
      // each session: 4 logs * 4 sets * 100 kg * 5 reps = 8000 kg
      assert.ok(result.acuteLoadKg > 0, 'should compute volume from logs');
      assert.equal(result.sessionCount7d, 1);
      assert.equal(result.sessionCount28d, 4);
    },
  },
  {
    name: 'fatigue: recoveryScore peaks near acwr 1.05 and degrades outside optimal zone',
    run() {
      function scoreAt(acwr) {
        // build a db that gives exactly that ACWR
        // chronic = 1000, so acute = acwr * 1000
        const db = createEmptyDatabase();
        const acuteLoad = acwr * 1000;
        // 3 weeks of 1000 each → total28d = 3000 + acuteLoad, chronic = (3000 + acuteLoad)/4
        // We want chronic = 1000, so total28d = 4000, so older weeks contribute 4000 - acuteLoad
        db.workoutSessions = [
          makeSession('acute', daysAgo(1), acuteLoad),
          makeSession('old1', daysAgo(10), (4000 - acuteLoad) / 3),
          makeSession('old2', daysAgo(17), (4000 - acuteLoad) / 3),
          makeSession('old3', daysAgo(24), (4000 - acuteLoad) / 3),
        ];
        return buildFatigueModel({ workoutSessions: db.workoutSessions, exerciseLogs: db.exerciseLogs }, NOW).recoveryScore;
      }

      const scoreOptimal = scoreAt(1.05);
      const scoreUnder = scoreAt(0.5);
      const scoreHigh = scoreAt(2.0);

      assert.ok(scoreOptimal >= 95, `expected peak score >= 95, got ${scoreOptimal}`);
      assert.ok(scoreUnder < scoreOptimal, 'undertrained score should be below optimal');
      assert.ok(scoreHigh < scoreOptimal, 'overreaching score should be below optimal');
    },
  },
];
