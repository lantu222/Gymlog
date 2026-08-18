const assert = require('node:assert/strict');

const {
  PLATEAU_STALL_SESSIONS,
  detectPlateau,
  buildPlateauDetection,
  buildPlateauConclusion,
  buildPlateauMoment,
  buildNextSessionMoment,
  buildWeeklyRead,
  pickCompletionLift,
  buildCompletionConclusion,
  nextStepKg,
} = require('../../.test-dist/lib/proInsights.js');
const { buildLiftHistories } = require('../../.test-dist/lib/trainingHistory.js');

/**
 * These assert English copy, so they assert English number formatting with it.
 * removeTrailingZeros reads a module-level decimal mark (lib/format.ts) that
 * the app sets from preferences and that defaults to Finnish, so a suite that
 * wants points rather than commas has to say so — otherwise it passes or fails
 * on whichever suite ran before it.
 */
const { setNumberLanguage } = require('../../.test-dist/lib/format.js');
setNumberLanguage('en');

const DAY = 86400000;
const NOW = Date.parse('2026-07-28T09:00:00.000Z');
const at = (daysAgo) => new Date(NOW - daysAgo * DAY).toISOString();

function history({ name = 'Barbell Back Squat', weights, reps = null }) {
  const sessions = [];
  const logs = [];
  weights.forEach((weight, index) => {
    const id = `s${index}`;
    const daysAgo = (weights.length - 1 - index) * 4;
    sessions.push({
      id,
      workoutTemplateId: 'tpl',
      workoutNameSnapshot: 'Day 1: Push',
      performedAt: at(daysAgo),
      durationMinutes: 50,
      setsCompleted: 9,
    });
    logs.push({
      id: `${id}-log`,
      sessionId: id,
      exerciseTemplateId: null,
      exerciseNameSnapshot: name,
      weight,
      repsPerSet: reps ? reps[index] : [8, 8, 8],
      tracked: true,
      orderIndex: 0,
    });
  });
  return buildLiftHistories(sessions, logs);
}

module.exports = [
  {
    name: 'proInsights: a lift stalled for 4 sessions is detected with real numbers and dates',
    run() {
      const lifts = history({ weights: [80, 82.5, 82.5, 82.5, 82.5] });
      const lift = detectPlateau(lifts);
      assert.ok(lift, 'four sessions at one top set is a plateau');
      assert.equal(lift.stalledSessions, 4);

      const detection = buildPlateauDetection(lift, 'en');
      // The finding is stated from the log: the weight, the reps, the count.
      assert.match(detection.headline, /hasn't moved in 4 sessions/);
      assert.match(detection.meta, /82\.5 kg × 8, 4 sessions running/);
    },
  },
  {
    name: 'proInsights: an improving lift is NOT a plateau',
    run() {
      const lifts = history({ weights: [60, 62.5, 65, 67.5, 70] });
      assert.equal(detectPlateau(lifts), null);
    },
  },
  {
    name: 'proInsights: falling later-set reps read as recovery, holding reps as earn-the-step',
    run() {
      // Total reps decline across the stalled run → recovery.
      const declining = history({
        weights: [82.5, 82.5, 82.5, 82.5],
        reps: [[8, 8, 8], [8, 8, 7], [8, 7, 6], [8, 6, 5]],
      });
      const decliningFix = buildPlateauConclusion(detectPlateau(declining), 'en');
      assert.match(decliningFix.body, /recovery, not load/);
      assert.match(decliningFix.body, /82\.5 kg/);

      // Reps hold → the reps path. Same weight appears in the real text.
      const holding = history({
        weights: [82.5, 82.5, 82.5, 82.5],
        reps: [[8, 8, 8], [8, 8, 8], [8, 8, 8], [8, 8, 8]],
      });
      const holdingFix = buildPlateauConclusion(detectPlateau(holding), 'en');
      assert.match(holdingFix.body, /add one rep per set/);
    },
  },
  {
    name: 'proInsights: the moment sheet bars are the real top sets and the next step is one increment',
    run() {
      const lifts = history({ weights: [77.5, 80, 82.5, 82.5, 82.5, 82.5] });
      const lift = detectPlateau(lifts);
      const moment = buildPlateauMoment(lift, 'en', 'beginner');
      assert.deepEqual(moment.bars, [80, 82.5, 82.5, 82.5, 82.5]);
      // Beginner increment is 2.5 kg — the progression gate's own step, not a
      // forecast.
      assert.equal(moment.nextValue, 85);
      assert.equal(nextStepKg(lift, 'intermediate'), 83.75);
    },
  },
  {
    name: 'proInsights: weekly read gives a green improving row and an amber stalled row with a locked conclusion',
    run() {
      const improving = history({ name: 'Barbell Bench Press', weights: [60, 62.5, 65, 67.5] });
      const stalled = history({ weights: [82.5, 82.5, 82.5, 82.5] });
      const rows = buildWeeklyRead([...stalled, ...improving], null, 'en');

      const amber = rows.find((row) => row.tone === 'amber');
      assert.ok(amber, 'stalled lift gets an amber row');
      assert.equal(amber.status, 'Stalled');
      assert.ok(amber.locked, 'the stalled conclusion is the paid part');

      const green = rows.find((row) => row.tone === 'green');
      assert.ok(green, 'improving lift gets a green row');
      assert.equal(green.locked, null, 'nothing to sell on a lift that is working');
      assert.ok(green.bars.every((bar) => bar >= 0.3 && bar <= 1));
    },
  },
  {
    name: 'proInsights: no recovery row without a confident fatigue model',
    run() {
      const lifts = history({ weights: [60, 62.5, 65, 67.5] });
      const unconfident = { confident: false, signal: 'high', recoveryScore: 10, sessionCount7d: 6 };
      const rows = buildWeeklyRead(lifts, unconfident, 'en');
      assert.equal(rows.find((row) => row.key === 'recovery'), undefined);

      const confident = { confident: true, signal: 'high', recoveryScore: 20, sessionCount7d: 6 };
      const withRecovery = buildWeeklyRead(lifts, confident, 'en');
      const recovery = withRecovery.find((row) => row.key === 'recovery');
      assert.ok(recovery);
      assert.equal(recovery.tone, 'red');
      assert.ok(recovery.locked);
    },
  },
  {
    name: 'proInsights: completion conclusion states the honest next step for a healthy lift',
    run() {
      const lifts = history({ weights: [60, 62.5, 65] });
      const lift = pickCompletionLift(lifts);
      assert.ok(lift);
      const conclusion = buildCompletionConclusion(lift, 'en', 'beginner');
      assert.match(conclusion.body, /67\.5 kg/);
      assert.match(conclusion.body, /top of its rep range/);
    },
  },
  {
    name: 'proInsights: the stall threshold matches the coach context (3 sessions)',
    run() {
      assert.equal(PLATEAU_STALL_SESSIONS, 3);
      const lifts = history({ weights: [80, 82.5, 82.5, 82.5] });
      assert.ok(detectPlateau(lifts), 'three sessions at one top set already reads as stalled');
      const next = buildNextSessionMoment(lifts[0], 'en', null);
      assert.ok(next.bars.length > 0);
    },
  },
];
