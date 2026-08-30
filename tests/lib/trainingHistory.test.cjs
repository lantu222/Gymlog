const assert = require('node:assert/strict');

const { withHelsinkiClocks } = require('../helpers/clockChange.cjs');

const {
  buildTrainingHistory,
  buildLiftHistories,
  comparableSessions,
  previousComparableSession,
  sessionVolumeKg,
} = require('../../.test-dist/lib/trainingHistory.js');

const DAY = 86400000;
// A fixed Wednesday, so week bucketing is checkable rather than "whatever today is".
const NOW = new Date('2026-07-22T12:00:00.000Z').getTime();

function at(daysAgo, hour = 9) {
  const date = new Date(NOW - daysAgo * DAY);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

function session(id, name, performedAt, totalVolumeKg) {
  return {
    id,
    workoutTemplateId: 'tpl',
    workoutNameSnapshot: name,
    performedAt,
    durationMinutes: 50,
    totalVolumeKg,
  };
}

function log(sessionId, name, weight, repsPerSet, extra = {}) {
  return {
    id: `${sessionId}-${name}`,
    sessionId,
    exerciseTemplateId: null,
    exerciseNameSnapshot: name,
    weight,
    repsPerSet,
    tracked: true,
    orderIndex: 0,
    ...extra,
  };
}

module.exports = [
  {
    name: 'the week rows survive a clock change',
    run() {
      withHelsinkiClocks(() => {
        // Stepping the cursor by 7 * DAY_MS overshoots after the March change:
        // three steps from Monday 9 March land on Monday 30 March at 01:00,
        // which is past currentWeek, so the loop exited before emitting the
        // running week and the most recent week vanished from the coach's
        // evidence and from the analysis chart.
        const history = buildTrainingHistory({
          sessions: [
            session('w1', 'Push', new Date(2026, 2, 10, 9, 0, 0).toISOString(), 1000),
            session('w2', 'Push', new Date(2026, 2, 17, 9, 0, 0).toISOString(), 1000),
            session('w3', 'Push', new Date(2026, 2, 24, 9, 0, 0).toISOString(), 1000),
            session('w4', 'Push', new Date(2026, 2, 31, 9, 0, 0).toISOString(), 1000),
          ],
          logs: [
            log('w1', 'Bench Press', 60, [8]),
            log('w2', 'Bench Press', 60, [8]),
            log('w3', 'Bench Press', 60, [8]),
            log('w4', 'Bench Press', 60, [8]),
          ],
          windowDays: 56,
          now: new Date(2026, 3, 1, 12, 0, 0).getTime(),
        });

        assert.deepEqual(
          history.weeks.map((week) => week.weekStart),
          ['2026-03-09', '2026-03-16', '2026-03-23', '2026-03-30'],
        );
      });
    },
  },
  {
    name: 'week rows stay named after their Monday through an autumn change',
    run() {
      withHelsinkiClocks(() => {
        // Past the October change the drifted cursor sits at Sunday 23:00, and
        // isoDate then names each row after the Sunday before it.
        const history = buildTrainingHistory({
          sessions: [
            session('a1', 'Push', new Date(2026, 9, 13, 9, 0, 0).toISOString(), 1000),
            session('a2', 'Push', new Date(2026, 9, 20, 9, 0, 0).toISOString(), 1000),
            session('a3', 'Push', new Date(2026, 9, 27, 9, 0, 0).toISOString(), 1000),
          ],
          logs: [
            log('a1', 'Bench Press', 60, [8]),
            log('a2', 'Bench Press', 60, [8]),
            log('a3', 'Bench Press', 60, [8]),
          ],
          windowDays: 56,
          now: new Date(2026, 9, 28, 12, 0, 0).getTime(),
        });

        assert.deepEqual(
          history.weeks.map((week) => week.weekStart),
          ['2026-10-12', '2026-10-19', '2026-10-26'],
        );
      });
    },
  },
  {
    name: 'an empty log produces an empty history rather than zeros',
    run() {
      const history = buildTrainingHistory({ sessions: [], logs: [], now: NOW });

      assert.equal(history.sessionCount, 0);
      assert.deepEqual(history.sessions, []);
      assert.deepEqual(history.lifts, []);
      assert.deepEqual(history.weeks, []);
      assert.equal(history.adherence, null);
      assert.equal(history.totalVolumeKg, 0);
    },
  },
  {
    name: 'sessions outside the window are dropped, not summarised',
    run() {
      const history = buildTrainingHistory({
        sessions: [
          session('old', 'Push', at(90), 5000),
          session('recent', 'Push', at(3), 4000),
        ],
        logs: [log('old', 'Bench Press', 60, [8]), log('recent', 'Bench Press', 70, [8])],
        windowDays: 56,
        now: NOW,
      });

      assert.equal(history.sessionCount, 1);
      assert.equal(history.sessions[0].sessionId, 'recent');
      // The dropped session must not leak into the lift trajectory either.
      assert.equal(history.lifts.length, 1);
      assert.deepEqual(
        history.lifts[0].points.map((point) => point.topSetWeightKg),
        [70],
      );
    },
  },
  {
    name: 'sessions come back oldest first with volume, sets and exercise counts',
    run() {
      const history = buildTrainingHistory({
        sessions: [session('s2', 'Pull', at(2), 3000), session('s1', 'Push', at(9), 2000)],
        logs: [
          log('s1', 'Bench Press', 60, [8, 8]),
          log('s2', 'Barbell Row', 70, [10, 10, 10]),
          log('s2', 'Lat Pulldown', 50, [12]),
        ],
        now: NOW,
      });

      assert.deepEqual(
        history.sessions.map((entry) => entry.sessionId),
        ['s1', 's2'],
      );
      assert.equal(history.sessions[0].setCount, 2);
      assert.equal(history.sessions[0].exerciseCount, 1);
      assert.equal(history.sessions[1].setCount, 4);
      assert.equal(history.sessions[1].exerciseCount, 2);
      assert.equal(history.totalVolumeKg, 5000);
    },
  },
  {
    name: 'a session without a stored total has its volume recomputed from sets',
    run() {
      const legacy = session('s1', 'Push', at(1), undefined);
      const volume = sessionVolumeKg(legacy, [log('s1', 'Bench Press', 60, [5, 5])]);

      // 60 kg x 10 reps — old saves predate totalVolumeKg and must not read as 0.
      assert.equal(volume, 600);
    },
  },
  {
    name: 'skipped and zero-weight logs never become points on a trajectory',
    run() {
      const lifts = buildLiftHistories(
        [session('s1', 'Push', at(1), 500)],
        [
          log('s1', 'Bench Press', 60, [5]),
          log('s1', 'Skipped Lift', 80, [5], { skipped: true }),
          log('s1', 'Bodyweight Dip', 0, [10]),
          log('s1', 'No Reps', 40, [0]),
        ],
      );

      assert.deepEqual(
        lifts.map((lift) => lift.name),
        ['Bench Press'],
      );
    },
  },
  {
    name: 'a lift trajectory reports its span, change and best',
    run() {
      const lifts = buildLiftHistories(
        [
          session('s1', 'Legs', at(28), 1),
          session('s2', 'Legs', at(14), 1),
          session('s3', 'Legs', at(0), 1),
        ],
        [
          log('s1', 'Barbell Squat', 95, [5]),
          log('s2', 'Barbell Squat', 105, [5]),
          log('s3', 'Barbell Squat', 100, [5, 5]),
        ],
      );

      const squat = lifts[0];
      assert.deepEqual(squat.points.map((point) => point.topSetWeightKg), [95, 105, 100]);
      assert.equal(squat.first.topSetWeightKg, 95);
      assert.equal(squat.latest.topSetWeightKg, 100);
      assert.equal(squat.weightChangeKg, 5);
      assert.equal(squat.bestWeightKg, 105, 'the best is the heaviest ever, not the latest');
      assert.equal(squat.spanDays, 28);
      assert.equal(squat.stalledSessions, 1);
    },
  },
  {
    name: 'stalledSessions counts the real run of flat sessions, uncapped',
    run() {
      const sessions = [0, 1, 2, 3].map((index) =>
        session(`s${index}`, 'Push', at(index * 7), 1),
      );
      const lifts = buildLiftHistories(
        sessions,
        sessions.map((entry) => log(entry.id, 'Bench Press', 80, [5])),
      );

      assert.equal(lifts[0].stalledSessions, 4);
      assert.equal(lifts[0].weightChangeKg, 0);
    },
  },
  {
    name: 'a lift that moved recently is not counted as stalled',
    run() {
      const lifts = buildLiftHistories(
        [
          session('s1', 'Push', at(21), 1),
          session('s2', 'Push', at(14), 1),
          session('s3', 'Push', at(7), 1),
        ],
        [
          log('s1', 'Bench Press', 80, [5]),
          log('s2', 'Bench Press', 80, [5]),
          log('s3', 'Bench Press', 82.5, [5]),
        ],
      );

      assert.equal(lifts[0].stalledSessions, 1);
    },
  },
  {
    name: 'a renamed lift reads the way it does today',
    run() {
      const lifts = buildLiftHistories(
        [session('s1', 'Push', at(14), 1), session('s2', 'Push', at(1), 1)],
        [log('s1', 'bench press', 80, [5]), log('s2', 'Bench Press', 85, [5])],
      );

      assert.equal(lifts.length, 1, 'casing must not split one lift into two');
      assert.equal(lifts[0].name, 'Bench Press');
    },
  },
  {
    name: 'comparable sessions are same-name only and never look forward',
    run() {
      const push1 = session('p1', 'Push', at(14), 1);
      const pull = session('l1', 'Pull', at(9), 1);
      const push2 = session('p2', 'Push', at(7), 1);
      const push3 = session('p3', 'Push', at(1), 1);
      const all = [push1, pull, push2, push3];

      assert.deepEqual(
        comparableSessions(push2, all).map((entry) => entry.id),
        ['p1', 'p2'],
        'a later session is not an earlier session comparison',
      );
      assert.equal(previousComparableSession(push2, all).id, 'p1');
      assert.equal(previousComparableSession(push1, all), null);
    },
  },
  {
    name: 'weeks include the ones with no training at all',
    run() {
      const history = buildTrainingHistory({
        sessions: [session('s1', 'Push', at(21), 3000), session('s2', 'Push', at(1), 4000)],
        logs: [log('s1', 'Bench Press', 60, [8]), log('s2', 'Bench Press', 65, [8])],
        now: NOW,
      });

      // Three weeks apart with a silent week in between: the gap is the signal.
      assert.equal(history.weeks.length, 4);
      assert.deepEqual(
        history.weeks.map((week) => week.sessions),
        [1, 0, 0, 1],
      );
      assert.equal(history.weeks[0].volumeKg, 3000);
      assert.equal(history.weeks[1].volumeKg, 0);
    },
  },
  {
    name: 'without a schedule nothing is reported as planned',
    run() {
      const history = buildTrainingHistory({
        sessions: [session('s1', 'Push', at(3), 1000)],
        logs: [log('s1', 'Bench Press', 60, [8])],
        now: NOW,
      });

      assert.equal(history.adherence, null);
      assert.ok(history.weeks.every((week) => week.plannedSessions === null));
    },
  },
  {
    name: 'the running week only counts training days that have come round',
    run() {
      // NOW is a Wednesday. Mon has passed, Fri has not.
      const history = buildTrainingHistory({
        sessions: [session('s1', 'Push', at(2), 1000)],
        logs: [log('s1', 'Bench Press', 60, [8])],
        trainingDays: ['mon', 'fri'],
        now: NOW,
      });

      const current = history.weeks[history.weeks.length - 1];
      assert.equal(current.plannedSessions, 1, 'Friday has not been missed yet');
      assert.equal(history.adherence.plannedPerWeek, 2);
      assert.equal(history.adherence.completedSessions, 1);
    },
  },
  {
    name: 'a completed week counts the whole schedule',
    run() {
      const history = buildTrainingHistory({
        sessions: [session('s1', 'Push', at(9), 1000), session('s2', 'Push', at(2), 1000)],
        logs: [log('s1', 'Bench Press', 60, [8]), log('s2', 'Bench Press', 60, [8])],
        trainingDays: ['mon', 'wed', 'fri'],
        now: NOW,
      });

      assert.equal(history.weeks[0].plannedSessions, 3);
      assert.equal(history.weeks[0].sessions, 1, 'one of three planned sessions happened');
    },
  },
  {
    // Transcript 2026-08-23: the coach told a 2-on-1-off reader "your
    // schedule is mon-wed-thu" and put the next session on Wednesday. The
    // history read availability; now it reads the plan's real rhythm, and
    // says when the next training day actually is.
    name: 'a cycle schedule reaches the coach as a rhythm and a next training day, not weekdays',
    run() {
      const { cycleSchedule } = require('../../.test-dist/lib/trainingSchedule.js');
      const { buildAiCoachSystemContext } = require('../../.test-dist/lib/aiCoachSystemContext.js');
      const now = new Date(2026, 7, 23, 12).getTime(); // Sunday 23.8.2026
      // Anchored on Monday 24.8.: Mon+Tue on, Wed off, Thu+Fri on, ...
      const anchor = new Date(2026, 7, 24).getTime();
      const schedule = cycleSchedule([true, true, false], anchor);
      const history = buildTrainingHistory({
        sessions: [{ id: 's1', workoutTemplateId: 'x', workoutNameSnapshot: 'Upper', performedAt: new Date(2026, 7, 21, 17).toISOString(), totalVolumeKg: 1000 }],
        logs: [],
        trainingDays: ['mon', 'wed', 'thu'],
        schedule,
        now,
      });
      assert.ok(history.adherence);
      assert.deepEqual(history.adherence.cycle, { onDays: 2, offDays: 1, length: 3 });
      assert.deepEqual(history.adherence.trainingDays, []);
      assert.equal(history.adherence.nextTrainingDate, '2026-08-24');
      assert.equal(history.adherence.plannedPerWeek, 4.7);

      const text = buildAiCoachSystemContext({
        unitPreference: 'kg', activeSession: null, recentCompletedSessions: [], trackedLifts: [], latestTopSets: [],
        sessionsThisWeek: 0, sessionsLast30Days: 1, rhythm: [], readyProgramCount: 0, recommendedProgramId: null,
        recommendedProgramTitle: null, customProgramTitle: null, plateaus: [],
        fatigue: { acwr: 0, recoveryScore: 0, signal: 'optimal', sessionCount7d: 0, confident: false },
        history: { windowDays: 56, sessionCount: 1, totalVolumeKg: 1000, sessions: [], lifts: [], weeks: history.weeks, schedule: history.adherence, truncated: false },
      });
      assert.match(text, /2 days on, 1 off, repeating every 3 days/);
      assert.match(text, /Next training day: 2026-08-24/);
      assert.doesNotMatch(text, /on mon, wed, thu/);
    },
  },
  {
    name: "the week is read aloud Monday-first, whatever order the plan runs it in",
    run() {
      // The schedule's weekday list is in PLAN order — which session owns
      // which day — because that is what decides "is today session one".
      // This readout is a different question, and it lands in the coach's
      // system prompt as "3x/week on …". A programme adopted on a Sunday
      // described its own week as "Sun, Wed, Fri" until this sorted.
      const { weekdaySchedule } = require("../../.test-dist/lib/trainingSchedule.js");
      const history = buildTrainingHistory({
        sessions: [session("s1", "Full Body", at(2), 1000)],
        logs: [log("s1", "Bench Press", 60, [8])],
        // sun, wed, fri — the order a Sunday adoption stores.
        schedule: weekdaySchedule([6, 2, 4]),
        now: NOW,
      });

      assert.ok(history.adherence);
      assert.deepEqual(history.adherence.trainingDays, ["wed", "fri", "sun"]);
      // And the plan order itself is left alone: sorting a copy, never the
      // schedule, or the fix would undo the thing it was reading from.
      const schedule = weekdaySchedule([6, 2, 4]);
      buildTrainingHistory({ sessions: [], logs: [], schedule, now: NOW });
      assert.deepEqual(schedule.weekdayIndexes, [6, 2, 4]);
    },
  },
];
