const assert = require('node:assert/strict');

const { detectPlateau, detectPlateaus } = require('../../.test-dist/lib/progressionAnalyzer.js');

let _logId = 0;

function makeLog(weight, performedAt) {
  _logId++;
  return {
    id: `log-${_logId}`,
    sessionId: 'sess',
    exerciseTemplateId: null,
    exerciseNameSnapshot: 'Bench Press',
    weight,
    repsPerSet: [8, 8, 8],
    sets: [
      { orderIndex: 0, weight, reps: 8, kind: 'working', outcome: 'completed', status: 'completed' },
      { orderIndex: 1, weight, reps: 8, kind: 'working', outcome: 'completed', status: 'completed' },
      { orderIndex: 2, weight, reps: 8, kind: 'working', outcome: 'completed', status: 'completed' },
    ],
    tracked: true,
    orderIndex: 0,
    skipped: false,
    performedAt,
    workoutNameSnapshot: 'Push',
  };
}

// weightsOldestFirst: e.g. [100, 100, 100] means oldest session was 100, then 100, then 100 (latest)
function makeSummary(weightsOldestFirst, key = 'bench press') {
  const logs = [...weightsOldestFirst]
    .reverse()
    .map((w, i) => makeLog(w, new Date(Date.now() - i * 86400000).toISOString()));
  const best = Math.max(...weightsOldestFirst);
  return {
    key,
    name: 'Bench Press',
    logs,
    latestLog: logs[0],
    previousLog: logs[1] ?? undefined,
    latestWeight: weightsOldestFirst[weightsOldestFirst.length - 1],
    previousWeight: weightsOldestFirst[weightsOldestFirst.length - 2] ?? null,
    latestReps: '8,8,8',
    bestWeight: best,
    bestReps: 24,
  };
}

module.exports = [
  {
    name: 'plateau: three identical weights flags as plateau',
    run() {
      const result = detectPlateau(makeSummary([100, 100, 100]));
      assert.equal(result.isPlateau, true);
      assert.equal(result.stagnantSessions, 3);
      assert.equal(result.sessionCount, 3);
    },
  },
  {
    name: 'plateau: improvement in latest session is not a plateau',
    run() {
      const result = detectPlateau(makeSummary([100, 100, 102]));
      assert.equal(result.isPlateau, false);
      assert.equal(result.stagnantSessions, 1);
    },
  },
  {
    name: 'plateau: regression over three sessions is a plateau',
    run() {
      // user went from 102 down to 100, stuck there
      const result = detectPlateau(makeSummary([102, 100, 100]));
      assert.equal(result.isPlateau, true);
      assert.equal(result.stagnantSessions, 3);
    },
  },
  {
    name: 'plateau: improvement breaks the stagnant streak',
    run() {
      // three stagnant then a new PR
      const result = detectPlateau(makeSummary([100, 100, 100, 105]));
      assert.equal(result.isPlateau, false);
      assert.equal(result.stagnantSessions, 1);
    },
  },
  {
    name: 'plateau: fewer sessions than threshold never flags',
    run() {
      const two = detectPlateau(makeSummary([100, 100]));
      assert.equal(two.isPlateau, false);

      const one = detectPlateau(makeSummary([100]));
      assert.equal(one.isPlateau, false);
    },
  },
  {
    name: 'plateau: empty logs produce safe defaults',
    run() {
      const result = detectPlateau(makeSummary([]));
      assert.equal(result.isPlateau, false);
      assert.equal(result.sessionCount, 0);
      assert.equal(result.stagnantSessions, 0);
      assert.deepEqual(result.topWeightHistory, []);
    },
  },
  {
    name: 'plateau: topWeightHistory is ordered newest first',
    run() {
      const result = detectPlateau(makeSummary([80, 90, 100]));
      assert.deepEqual(result.topWeightHistory, [100, 90, 80]);
    },
  },
  {
    name: 'plateau: custom threshold works',
    run() {
      // only 2 stagnant sessions, threshold=2 should flag
      const result = detectPlateau(makeSummary([100, 100]), 2);
      assert.equal(result.isPlateau, true);
      assert.equal(result.stagnantSessions, 2);
    },
  },
  {
    name: 'detectPlateaus: maps over multiple summaries',
    run() {
      const results = detectPlateaus([
        makeSummary([100, 100, 100], 'bench press'),
        makeSummary([100, 100, 102], 'squat'),
      ]);
      assert.equal(results.length, 2);
      assert.equal(results[0].isPlateau, true);
      assert.equal(results[1].isPlateau, false);
    },
  },
];
