const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  COACH_DEMO_MOMENTS,
  daysSince,
  markCoachDemoMomentUsed,
  pickDemoQuestion,
  resolveDueCoachDemoMoment,
} = require('../../.test-dist/lib/coachDemoMoments.js');

const root = path.join(__dirname, '..', '..');
const i18nSource = fs.readFileSync(path.join(root, 'src', 'lib', 'i18n.ts'), 'utf8');

const INSTALL = '2026-05-01T09:00:00.000Z';

function lift(over = {}) {
  return {
    key: 'squat',
    name: 'Back Squat',
    stalledSessions: 0,
    weightChangeKg: 5,
    spanDays: 28,
    points: [
      { performedAt: '2026-05-02', time: Date.parse('2026-05-02'), topSetWeightKg: 80, totalReps: 15 },
      { performedAt: '2026-05-09', time: Date.parse('2026-05-09'), topSetWeightKg: 82.5, totalReps: 15 },
      { performedAt: '2026-05-16', time: Date.parse('2026-05-16'), topSetWeightKg: 85, totalReps: 15 },
    ],
    first: { performedAt: '2026-05-02', topSetWeightKg: 80 },
    latest: { performedAt: '2026-05-16', topSetWeightKg: 85, topSetReps: 5 },
    ...over,
  };
}

function input(over = {}) {
  return {
    firstLaunchAt: INSTALL,
    usedMoments: [],
    proUnlocked: false,
    sessionCount: 40,
    lifts: [lift()],
    fatigueSignal: null,
    now: new Date(2026, 7, 20),
    ...over,
  };
}

module.exports = [
  {
    name: 'demo moments: three per install, at a week, a month and three months',
    run() {
      assert.equal(COACH_DEMO_MOMENTS.length, 3);
      assert.deepEqual(
        COACH_DEMO_MOMENTS.map((moment) => moment.afterDays),
        [7, 30, 90],
      );
      // Each one needs more log behind it than the last, because each asks a
      // harder question. A moment that fires on an empty log gives the coach's
      // most generic answer at the one moment it gets to make an impression.
      const sessions = COACH_DEMO_MOMENTS.map((moment) => moment.minSessions);
      assert.deepEqual([...sessions].sort((a, b) => a - b), sessions);
    },
  },
  {
    name: 'demo moments: a paying reader is never shown a sample of what they bought',
    run() {
      assert.equal(resolveDueCoachDemoMoment(input({ proUnlocked: true })), null);
    },
  },
  {
    name: 'demo moments: nothing fires before its day or before its sessions',
    run() {
      // Day 6 with plenty of sessions: too early.
      assert.equal(
        resolveDueCoachDemoMoment(input({ now: new Date(2026, 4, 6) })),
        null,
        'the first moment must wait for day 7',
      );
      // Day 200 with one session: the log cannot answer anything yet, and a
      // slip is better than a weak demo that can never be re-spent.
      assert.equal(
        resolveDueCoachDemoMoment(input({ sessionCount: 1 })),
        null,
        'a thin log slips the moment rather than wasting it',
      );
      // An install that predates the field has no anchor to count from.
      assert.equal(resolveDueCoachDemoMoment(input({ firstLaunchAt: null })), null);
    },
  },
  {
    name: 'demo moments: they arrive in order, even for a reader who qualified late',
    run() {
      // Ninety days in with forty sessions, nothing spent: still the FIRST
      // moment. Handing the three-month question to someone who never saw the
      // other two would skip the arc the moments are for.
      const first = resolveDueCoachDemoMoment(input());
      assert.equal(first.key, 'week1');

      const second = resolveDueCoachDemoMoment(input({ usedMoments: ['week1'] }));
      assert.equal(second.key, 'month1');

      const third = resolveDueCoachDemoMoment(input({ usedMoments: ['week1', 'month1'] }));
      assert.equal(third.key, 'month3');

      // All three spent: nothing more, ever.
      assert.equal(
        resolveDueCoachDemoMoment(input({ usedMoments: ['week1', 'month1', 'month3'] })),
        null,
      );
    },
  },
  {
    name: 'demo moments: the question is chosen from the log, never assumed',
    run() {
      // A stalled lift is the strongest question available — it is the exact
      // conclusion the reader has been seeing blurred for a month.
      const stalled = pickDemoQuestion('month1', {
        lifts: [lift({ stalledSessions: 4 })],
        fatigueSignal: null,
      });
      assert.equal(stalled.questionKey, 'coach.demo.month1.stalled');
      assert.equal(stalled.vars.lift, 'Back Squat');

      // Nothing stalled and nothing falling: asking "why has it stalled" here
      // would be embarrassing, and each of these happens once ever.
      const climbing = pickDemoQuestion('month1', { lifts: [lift()], fatigueSignal: null });
      assert.equal(climbing.questionKey, 'coach.demo.month1.pace');

      const declining = pickDemoQuestion('month1', {
        lifts: [lift({ weightChangeKg: -5 })],
        fatigueSignal: null,
      });
      assert.equal(declining.questionKey, 'coach.demo.month1.declining');

      // Month three follows the fatigue read when there is one.
      assert.equal(
        pickDemoQuestion('month3', { lifts: [lift()], fatigueSignal: 'high' }).questionKey,
        'coach.demo.month3.load',
      );
      assert.equal(
        pickDemoQuestion('month3', { lifts: [lift()], fatigueSignal: 'optimal' }).questionKey,
        'coach.demo.month3.next',
      );

      // And an empty log still has something to ask at week one, which is what
      // makes the first moment safe to fire at all.
      assert.equal(
        pickDemoQuestion('week1', { lifts: [], fatigueSignal: null }).questionKey,
        'coach.demo.week1.fit',
      );
    },
  },
  {
    name: 'demo moments: every question exists in both languages',
    run() {
      const keys = new Set();
      for (const key of ['week1', 'month1', 'month3']) {
        for (const lifts of [[], [lift()], [lift({ stalledSessions: 4 })], [lift({ weightChangeKg: -5 })]]) {
          for (const fatigueSignal of [null, 'high', 'optimal']) {
            keys.add(pickDemoQuestion(key, { lifts, fatigueSignal }).questionKey);
          }
        }
      }
      assert.ok(keys.size >= 5, 'the candidate set should cover every branch');
      for (const key of keys) {
        const lines = i18nSource.split('\n').filter((line) => line.includes(`'${key}':`));
        assert.equal(lines.length, 2, `${key} should exist in both languages`);
      }
    },
  },
  {
    name: 'demo moments: spending one is append-only and cannot double-spend',
    run() {
      const once = markCoachDemoMomentUsed([], 'week1');
      assert.deepEqual(once, ['week1']);
      // Idempotent: a re-render that fires the same send twice must not be
      // able to leave a longer list, and nothing ever removes a key.
      assert.deepEqual(markCoachDemoMomentUsed(once, 'week1'), ['week1']);
      assert.deepEqual(markCoachDemoMomentUsed(once, 'month1'), ['week1', 'month1']);
    },
  },
  {
    name: 'demo moments: the day count survives a clock change',
    run() {
      // Helsinki puts the clocks back on 25 Oct 2026 and forward on 29 Mar.
      // Stepping by fixed milliseconds lands 23 or 25 hours off across those,
      // which fires a moment a day early or late.
      const beforeAutumn = '2026-10-20T12:00:00.000Z';
      assert.equal(daysSince(beforeAutumn, new Date(2026, 9, 27, 12, 0)), 7);
      const beforeSpring = '2027-03-25T12:00:00.000Z';
      assert.equal(daysSince(beforeSpring, new Date(2027, 3, 1, 12, 0)), 7);

      // An unreadable stamp counts as zero rather than as NaN, which would
      // compare false against every threshold and silently disable the feature.
      assert.equal(daysSince('not a date', new Date(2026, 7, 20)), 0);
    },
  },
];
