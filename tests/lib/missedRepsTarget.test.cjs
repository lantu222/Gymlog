const assert = require('node:assert/strict');

const { resolveMissedRepsTarget } = require('../../.test-dist/lib/progressionGate.js');
const { workoutReducer } = require('../../.test-dist/features/workout/workoutState');
const { resolveGuidedSetTarget } = require('../../.test-dist/lib/guidedPlayer');

// At the gym, 2026-09-09: 7 · 6 · 4 · 4 last time, and the app asked for
// 4 × 12 at the same weight. The rule (user): "tee samalla painolla mutta yritä
// tehdä 6 6 6 6" — the average rounded up, then +1 (+2 when every set went
// past it) until the programme's reps are back. Pro, like the rest of
// automated progression (user, 2026-09-28).

function entry(reps, extra = {}) {
  return {
    slotId: 'slot',
    templateId: 'tpl',
    templateName: 'Upper',
    exerciseName: 'Bench Press',
    substitutionGroup: 'press',
    performedAt: '2026-09-20T09:00:00.000Z',
    sessionId: 's',
    sets: reps.map((count, setIndex) => ({ setIndex, loadKg: 60, reps: count, completedAt: '2026-09-20T09:00:00.000Z' })),
    skipped: false,
    ...extra,
  };
}

const rule = (history, extra = {}) =>
  resolveMissedRepsTarget({ history, repsMin: 12, targetSets: 4, trackingMode: 'load_and_reps', automatedProgressionEnabled: true, ...extra });

const EMPTY = {
  activeSession: null,
  completionSummary: null,
  history: { sessions: [], slotHistory: {}, lastSelectedTemplateId: null },
  nowMs: 0,
};

const TEMPLATE = {
  id: 'tpl_missed',
  name: 'Missed reps',
  defaultScheduleMode: 'weekly',
  sessions: [
    {
      id: 'day',
      name: 'Upper',
      orderIndex: 0,
      exercises: [
        {
          id: 'e_bench',
          exerciseName: 'Bench Press',
          slotId: 'bench',
          role: 'primary',
          progressionPriority: 'high',
          trackingMode: 'load_and_reps',
          sets: 4,
          repsMin: 12,
          repsMax: 12,
          restSecondsMin: 120,
          restSecondsMax: 180,
          substitutionGroup: 'bench_press',
        },
      ],
    },
  ],
};

function session(state, reps, day, pro = true) {
  let next = workoutReducer(state, {
    type: 'session/startFromRuntimeTemplate',
    payload: {
      template: TEMPLATE,
      sessionOrderIndex: 0,
      unitPreference: 'kg',
      progression: { automatedProgressionEnabled: pro, setupLevel: 'beginner' },
    },
  });
  const opened = next.activeSession.exercises[0];
  const openedOn = opened.sets.map((_, index) => resolveGuidedSetTarget(opened.sets, index, opened.trackingMode).reps);
  const at = new Date(Date.UTC(2026, 8, day, 9)).toISOString();
  reps.forEach((count, index) => {
    next = workoutReducer(next, {
      type: 'set/updateDraft',
      payload: { slotId: opened.slotId, setIndex: index, patch: { loadText: '60', repsText: String(count) } },
    });
    next = workoutReducer(next, {
      type: 'set/complete',
      payload: { slotId: opened.slotId, setIndex: index, nowMs: Date.parse(at), unitPreference: 'kg' },
    });
  });
  next = workoutReducer(next, { type: 'session/finishWorkout', payload: { performedAt: at } });
  return { state: workoutReducer(next, { type: 'session/clearCompletedSession' }), openedOn };
}

module.exports = [
  {
    name: 'reps short of the programme: every set aims for the average, rounded up',
    run() {
      assert.deepEqual(rule([entry([7, 6, 4, 4])]), { targetReps: 6, fromAverage: 5.25 });
      // Within the programme's reps, the ordinary rules stand.
      assert.equal(rule([entry([12, 12, 11, 12])]), null);
      assert.equal(rule([entry([12, 12, 12, 12])]), null);
    },
  },
  {
    name: 'the target climbs one rep, two when every set beat it, back to the programme',
    run() {
      assert.equal(rule([entry([6, 6, 6, 6], { targetReps: 6 })]).targetReps, 7);
      assert.equal(rule([entry([6, 7, 8, 7], { targetReps: 6 })]).targetReps, 7);
      assert.equal(rule([entry([7, 7, 7, 7], { targetReps: 6 })]).targetReps, 8);
      // Past the programme's floor, the rule lets go.
      assert.equal(rule([entry([11, 11, 11, 11], { targetReps: 11 })]), null);
      assert.equal(rule([entry([11, 12, 12, 12], { targetReps: 10 })]), null);
    },
  },
  {
    name: 'a lowered target missed again goes back to the average; fewer sets than asked do not count as met',
    run() {
      assert.equal(rule([entry([6, 6, 5, 4], { targetReps: 6 })]).targetReps, 6);
      assert.equal(rule([entry([6, 6, 6], { targetReps: 6 })]).targetReps, 6);
    },
  },
  {
    name: 'bodyweight, holds, a skipped lift, Pro off and a malformed stored target are left alone',
    run() {
      assert.equal(rule([entry([7, 6, 4, 4])], { trackingMode: 'bodyweight' }), null);
      assert.equal(rule([entry([7, 6, 4, 4])], { trackingMode: 'hold' }), null);
      assert.equal(rule([entry([7, 6, 4, 4], { skipped: true })]), null);
      assert.equal(rule([entry([7, 6, 4, 4])], { automatedProgressionEnabled: false }), null);
      assert.equal(rule([]), null);
      // A stored target that is not a whole number below the floor is not one.
      assert.equal(rule([entry([6, 6, 6, 6], { targetReps: '6' })]).targetReps, 6);
      assert.equal(rule([entry([6, 6, 6, 6], { targetReps: 13 })]).targetReps, 6);
    },
  },
  {
    name: 'end to end: the dial opens on 6, then 7, then the programme — at the same weight',
    run() {
      let { state } = session(EMPTY, [7, 6, 4, 4], 20);
      let result = session(state, [6, 6, 6, 6], 22);
      assert.deepEqual(result.openedOn, [6, 6, 6, 6]);
      const stored = result.state.history.slotHistory[Object.keys(result.state.history.slotHistory)[0]][0];
      assert.equal(stored.targetReps, 6, 'the lowered target is kept for the next session');
      const next = workoutReducer(result.state, {
        type: 'session/startFromRuntimeTemplate',
        payload: { template: TEMPLATE, sessionOrderIndex: 0, unitPreference: 'kg', progression: { automatedProgressionEnabled: true, setupLevel: 'beginner' } },
      });
      const bench = next.activeSession.exercises[0];
      assert.equal(resolveGuidedSetTarget(bench.sets, 0, bench.trackingMode).reps, 7);
      assert.equal(resolveGuidedSetTarget(bench.sets, 0, bench.trackingMode).loadKg, 60);

      // Up to 11 with every set met, then 12 is the programme's own.
      ({ state } = session(result.state, [7, 7, 7, 7], 24));
      for (let reps = 8, day = 26; reps <= 11; reps += 1, day += 2) {
        result = session(state, [reps, reps, reps, reps], day);
        assert.deepEqual(result.openedOn, [reps, reps, reps, reps], `day ${day}`);
        state = result.state;
      }
      assert.deepEqual(session(state, [12, 12, 12, 12], 40).openedOn, [12, 12, 12, 12]);
    },
  },
  {
    name: 'without Pro the dial opens on the programme\'s reps, as before',
    run() {
      const { state } = session(EMPTY, [7, 6, 4, 4], 20, false);
      assert.deepEqual(session(state, [6, 6, 6, 6], 22, false).openedOn, [12, 12, 12, 12]);
    },
  },
];
