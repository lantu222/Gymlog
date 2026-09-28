const assert = require('node:assert/strict');

const {
  PROGRESSION_LEVEL_PARAMS,
  evaluateProgression,
  getProgressionTier,
  isProgressionReadySession,
  resolveProgressedLoadKg,
  toProgressionFatigueSignal,
} = require('../../.test-dist/lib/progressionGate.js');

const DAY_MS = 86400000;
const NOW = Date.parse('2026-07-28T09:00:00.000Z');

/** Newest first, spaced 3 days apart unless told otherwise. */
function entry(loadKg, reps, daysAgo, overrides = {}) {
  const repsList = Array.isArray(reps) ? reps : [reps, reps, reps];
  return {
    slotId: 'slot',
    templateId: 'tpl',
    templateName: 'Push',
    exerciseName: 'Bench Press',
    substitutionGroup: 'press',
    performedAt: new Date(NOW - daysAgo * DAY_MS).toISOString(),
    sessionId: `s-${daysAgo}`,
    sets: repsList.map((count, setIndex) => ({
      setIndex,
      loadKg,
      reps: count,
      completedAt: new Date(NOW - daysAgo * DAY_MS).toISOString(),
    })),
    skipped: false,
    ...overrides,
  };
}

function gate(overrides = {}) {
  return evaluateProgression({
    history: [],
    repsMin: 8,
    repsMax: 12,
    targetSets: 3,
    level: 'beginner',
    ...overrides,
  });
}

module.exports = [
  {
    name: 'progression: the rep ceiling means ALL sets, not one',
    run() {
      // The spec's own worked example (progression-gating-rules.md §Core Model).
      assert.equal(isProgressionReadySession(entry(60, [10, 9, 8], 0), 12, 3), false);
      assert.equal(isProgressionReadySession(entry(60, [12, 11, 9], 0), 12, 3), false);
      assert.equal(isProgressionReadySession(entry(60, [12, 12, 11], 0), 12, 3), false);
      assert.equal(isProgressionReadySession(entry(60, [12, 12, 12], 0), 12, 3), true);
    },
  },
  {
    name: 'progression: a beginner moves after one ceiling session, at 2.5 kg',
    run() {
      const decision = gate({
        history: [entry(60, 12, 0), entry(60, [12, 11, 10], 3)],
        level: 'beginner',
      });

      assert.equal(decision.recommendation, 'increase');
      assert.equal(decision.fromLoadKg, 60);
      assert.equal(decision.loadKg, 62.5);
      assert.equal(decision.incrementKg, 2.5);
    },
  },
  {
    name: 'progression: an intermediate needs a second confirming session',
    run() {
      const once = gate({
        history: [entry(60, 12, 0), entry(60, [12, 11, 10], 3), entry(60, 10, 6)],
        level: 'advanced',
      });
      assert.equal(once.recommendation, 'hold');
      assert.equal(once.holdReason, 'awaiting_confirmation');

      const twice = gate({
        history: [entry(60, 12, 0), entry(60, 12, 3), entry(60, 10, 6)],
        level: 'advanced',
      });
      assert.equal(twice.recommendation, 'increase');
      // Slower to move, but the same step: 1.25 kg is 0.625 kg a side, which
      // standard plates cannot build (user decision 2026-09-28).
      assert.equal(twice.incrementKg, 2.5);
      assert.equal(twice.loadKg, 62.5);
    },
  },
  {
    name: 'progression: confirmation only counts sessions at the same load',
    run() {
      // A lighter session that hit the ceiling proves nothing about 60 kg.
      const decision = gate({
        history: [entry(60, 12, 0), entry(50, 12, 3), entry(50, 12, 6)],
        level: 'advanced',
      });

      assert.equal(decision.recommendation, 'hold');
      assert.equal(decision.holdReason, 'awaiting_confirmation');
    },
  },
  {
    name: 'progression: fatigue is a hard block that outranks a clean ceiling',
    run() {
      const perfect = [entry(60, 12, 0), entry(60, 12, 3)];

      assert.equal(gate({ history: perfect, fatigueSignal: 'high' }).holdReason, 'fatigue_high');
      assert.equal(gate({ history: perfect, fatigueSignal: 'elevated' }).holdReason, 'fatigue_elevated');
      // Undefined counts as clear, exactly as the spec's T11 words it.
      assert.equal(gate({ history: perfect }).recommendation, 'increase');
      assert.equal(gate({ history: perfect, fatigueSignal: 'normal' }).recommendation, 'increase');
    },
  },
  {
    name: 'progression: a session after a 7-day gap never adds load',
    run() {
      const decision = gate({ history: [entry(60, 12, 0), entry(60, 12, 8)] });

      assert.equal(decision.recommendation, 'hold');
      assert.equal(decision.holdReason, 'gap_return');
      assert.equal(decision.loadKg, 60, 'the hold still tells the logger what to repeat');
    },
  },
  {
    name: 'progression: skipped or short sessions hold rather than progress',
    run() {
      const skipped = gate({
        history: [entry(60, 12, 0, { skipped: true }), entry(60, 12, 3)],
      });
      assert.equal(skipped.holdReason, 'set_skipped');

      // Two sets logged where the template asked for three.
      const short = gate({ history: [entry(60, [12, 12], 0), entry(60, 12, 3)] });
      assert.equal(short.holdReason, 'insufficient_sets');
    },
  },
  {
    name: 'progression: silence until there is enough baseline',
    run() {
      assert.equal(gate({ history: [entry(60, 12, 0)], level: 'beginner' }).recommendation, 'silent');
      assert.equal(
        gate({ history: [entry(60, 12, 0), entry(60, 12, 3)], level: 'advanced' }).recommendation,
        'silent',
      );
      // No rep range means nothing to evaluate against.
      assert.equal(gate({ history: [entry(60, 12, 0), entry(60, 12, 3)], repsMax: 0 }).recommendation, 'silent');
      assert.equal(gate({ history: [entry(60, 12, 0), entry(60, 12, 3)], targetSets: 0 }).recommendation, 'silent');
    },
  },
  {
    name: 'progression: bodyweight work never gets a load bump',
    run() {
      const decision = gate({
        history: [entry(0, 12, 0), entry(0, 12, 3)],
        trackingMode: 'bodyweight',
      });
      assert.equal(decision.recommendation, 'silent');
    },
  },
  {
    name: 'progression: the toggle is what decides whether the prefill moves',
    run() {
      const history = [entry(60, 12, 0), entry(60, 12, 3)];
      const shared = { history, repsMin: 8, repsMax: 12, targetSets: 3, level: 'beginner', fallbackLoadKg: 60 };

      // `fromLoadKg` is what the loggers show as "AUTO +2.5 kg" — a progressed
      // load has to be able to say where it came from.
      const on = resolveProgressedLoadKg({ ...shared, automatedProgressionEnabled: true });
      assert.deepEqual(on, { loadKg: 62.5, progressed: true, fromLoadKg: 60, heldForFatigue: false });

      // OFF is exactly the old behaviour: repeat what was logged.
      const off = resolveProgressedLoadKg({ ...shared, automatedProgressionEnabled: false });
      assert.deepEqual(off, { loadKg: 60, progressed: false, fromLoadKg: null, heldForFatigue: false });

      // ON but not earned still repeats — the toggle promises a rule, not a
      // weekly increase.
      const notEarned = resolveProgressedLoadKg({
        ...shared,
        history: [entry(60, [12, 11, 10], 0), entry(60, 12, 3)],
        automatedProgressionEnabled: true,
      });
      assert.deepEqual(notEarned, { loadKg: 60, progressed: false, fromLoadKg: null, heldForFatigue: false });
    },
  },
  {
    name: 'progression: level tiers map the way the spec describes',
    run() {
      assert.equal(getProgressionTier('beginner'), 'beginner');
      assert.equal(getProgressionTier('advanced'), 'intermediate');
      assert.equal(getProgressionTier('pro'), 'intermediate');
      assert.equal(getProgressionTier(null), 'beginner');

      assert.equal(PROGRESSION_LEVEL_PARAMS.beginner.loadIncrementKg, 2.5);
      assert.equal(PROGRESSION_LEVEL_PARAMS.intermediate.loadIncrementKg, 2.5);
      assert.equal(PROGRESSION_LEVEL_PARAMS.beginner.requiredConsecutive, 1);
      assert.equal(PROGRESSION_LEVEL_PARAMS.intermediate.requiredConsecutive, 2);
      // Two sessions for a beginner, as the code has always done and the doc
      // now says (user decision 2026-09-28); three for everyone else.
      assert.equal(PROGRESSION_LEVEL_PARAMS.beginner.minSessions, 2);
      assert.equal(PROGRESSION_LEVEL_PARAMS.intermediate.minSessions, 3);
    },
  },
  {
    // User decision 2026-09-28: a beginner who beats the reps straight away
    // is offered more without waiting for a second session.
    name: 'progression: a beginner whose first session cleared the ceiling by two reps on every set moves now',
    run() {
      // The gate's ceiling here is 12.
      const clear = gate({ history: [entry(40, [14, 14, 14], 0)], level: 'beginner', nowMs: NOW + DAY_MS });
      assert.equal(clear.recommendation, 'increase');
      assert.equal(clear.loadKg, 42.5);

      // Recheck of #223: only off a recent session. Months old, or a week
      // back as the break rule counts it, the first session moves nothing —
      // and without a clock the gate does not guess.
      assert.equal(gate({ history: [entry(40, [14, 14, 14], 90)], level: 'beginner', nowMs: NOW }).recommendation, 'silent');
      assert.equal(gate({ history: [entry(40, [14, 14, 14], 7)], level: 'beginner', nowMs: NOW }).recommendation, 'silent');
      assert.equal(gate({ history: [entry(40, [14, 14, 14], 6)], level: 'beginner', nowMs: NOW }).recommendation, 'increase');
      assert.equal(gate({ history: [entry(40, [14, 14, 14], 0)], level: 'beginner' }).recommendation, 'silent');

      // At the ceiling, or past it on only some sets: the baseline still waits.
      assert.equal(gate({ history: [entry(40, [12, 12, 12], 0)], level: 'beginner' }).recommendation, 'silent');
      assert.equal(gate({ history: [entry(40, [14, 14, 13], 0)], level: 'beginner' }).recommendation, 'silent');
      // Fewer sets than the programme asks: not proof the weight is light.
      assert.equal(gate({ history: [entry(40, [15, 15], 0)], level: 'beginner' }).recommendation, 'silent');
      // Only beginners.
      assert.equal(gate({ history: [entry(40, [16, 16, 16], 0)], level: 'advanced' }).recommendation, 'silent');
      // And the holds still come first: a fatigue signal wins.
      const tired = gate({ history: [entry(40, [14, 14, 14], 0)], level: 'beginner', fatigueSignal: 'high', nowMs: NOW });
      assert.equal(tired.recommendation, 'hold');
    },
  },
  {
    // Break round, 2026-09-28: a week off across the spring clock change is
    // 6.96 days of elapsed time and was not read as a break.
    name: 'progression: a week off across the spring clock change is a break',
    run() {
      const { withHelsinkiClocks } = require('../helpers/clockChange.cjs');
      withHelsinkiClocks(() => {
        // At the ceiling both times, so the break is the only reason to hold.
        const at = (iso) => ({ ...entry(40, 12, 0), performedAt: new Date(iso).toISOString() });
        const decision = gate({
          history: [at('2026-03-29T10:00:00'), at('2026-03-22T10:00:00')],
          level: 'beginner',
        });
        assert.equal(decision.recommendation, 'hold');
        assert.equal(decision.holdReason, 'gap_return');

        // CI review of #223: counting midnights made 23:00 to 01:00 six days
        // later a week. It is barely six days, and not a break.
        const late = gate({
          history: [at('2026-05-08T01:00:00'), at('2026-05-01T23:00:00')],
          level: 'beginner',
        });
        assert.notEqual(late.holdReason, 'gap_return');
        assert.equal(late.recommendation, 'increase');
      });
    },
  },
  {
    name: 'recovery holds an earned load, and never on a guess',
    run() {
      // The ACWR model's four-way signal, narrowed to what the gate acts on.
      // 'undertrained' is room to add, not a reason to ease off.
      assert.equal(toProgressionFatigueSignal({ signal: 'high', confident: true }), 'high');
      assert.equal(toProgressionFatigueSignal({ signal: 'elevated', confident: true }), 'elevated');
      assert.equal(toProgressionFatigueSignal({ signal: 'optimal', confident: true }), 'normal');
      assert.equal(toProgressionFatigueSignal({ signal: 'undertrained', confident: true }), 'normal');

      // Confidence is the whole safety story. Chronic load is a 28-day total
      // over four, so ONE logged session reads as ACWR 4 — a confident "you
      // are far above your safe zone" built from a single workout. Below the
      // bar the gate must not ease off at all.
      assert.equal(toProgressionFatigueSignal({ signal: 'high', confident: false }), 'normal');
      assert.equal(toProgressionFatigueSignal(null), 'normal');
      assert.equal(toProgressionFatigueSignal(undefined), 'normal');
    },
  },
  {
    name: 'a fatigue hold keeps the weight and says so, but only when a jump was earned',
    run() {
      // Two sessions at 60 kg with every set at the ceiling: this one earned it.
      const earned = [entry(60, 12, 0), entry(60, 12, 3)];
      const base = {
        history: earned,
        repsMin: 8,
        repsMax: 12,
        targetSets: 3,
        level: 'beginner',
        automatedProgressionEnabled: true,
        fallbackLoadKg: 60,
      };

      const rested = resolveProgressedLoadKg({ ...base, fatigueSignal: 'normal' });
      assert.equal(rested.loadKg, 62.5);
      assert.equal(rested.heldForFatigue, false);

      // Cooked: the load stays and the set carries the reason. Without the
      // flag the hold is invisible, which is indistinguishable from the
      // feature not existing — which is what it was until it was wired up.
      for (const signal of ['elevated', 'high']) {
        const held = resolveProgressedLoadKg({ ...base, fatigueSignal: signal });
        assert.equal(held.loadKg, 60, signal);
        assert.equal(held.progressed, false, signal);
        assert.equal(held.heldForFatigue, true, signal);
      }

      // Fatigue is checked FIRST in the gate order, so a session that never
      // earned a jump also reports a fatigue hold. The badge must not claim
      // it: a high ACWR lasts weeks, so this would sit on every set of every
      // session while the app took credit for holding back a jump that was
      // never coming.
      const notEarned = resolveProgressedLoadKg({
        ...base,
        history: [entry(60, 9, 0), entry(60, 9, 3)],
        fatigueSignal: 'high',
      });
      assert.equal(notEarned.loadKg, 60);
      assert.equal(notEarned.heldForFatigue, false);

      // With progression off there is nothing to hold, so nothing to say.
      const free = resolveProgressedLoadKg({ ...base, automatedProgressionEnabled: false, fatigueSignal: 'high' });
      assert.equal(free.heldForFatigue, false);
      assert.equal(free.loadKg, 60);
    },
  },
  {
    name: 'rep progression: bodyweight moves the target by one when it is earned',
    run() {
      const { resolveProgressedReps } = require('../../.test-dist/lib/progressionGate.js');
      const base = {
        templateTargetReps: 12,
        targetSets: 3,
        level: 'beginner',
        trackingMode: 'bodyweight',
        automatedProgressionEnabled: true,
      };

      // Cleared on every set → one more than the floor the user proved.
      const earned = resolveProgressedReps({ ...base, history: [entry(0, 12, 0), entry(0, [12, 11, 10], 3)] });
      assert.equal(earned.progressed, true);
      assert.equal(earned.fromReps, 12);
      assert.equal(earned.targetReps, 13);

      // Overshooting raises from the proven floor, not from the template:
      // 15-14-13 on a 12 target suggests 14, not 13.
      const overshoot = resolveProgressedReps({ ...base, history: [entry(0, [15, 14, 13], 0), entry(0, 12, 3)] });
      assert.equal(overshoot.progressed, true);
      assert.equal(overshoot.fromReps, 13);
      assert.equal(overshoot.targetReps, 14);

      // One set short of the target → the template target stands.
      const missed = resolveProgressedReps({ ...base, history: [entry(0, [12, 12, 11], 0), entry(0, 12, 3)] });
      assert.equal(missed.progressed, false);
      assert.equal(missed.targetReps, 12);
      assert.equal(missed.fromReps, null);

      // The same Pro-gated switch as the load: off means the old behaviour.
      const off = resolveProgressedReps({
        ...base,
        automatedProgressionEnabled: false,
        history: [entry(0, 12, 0), entry(0, 12, 3)],
      });
      assert.equal(off.progressed, false);
      assert.equal(off.targetReps, 12);
    },
  },
  {
    name: 'rep progression: only bodyweight — loads have the load gate, holds are seconds',
    run() {
      const { resolveProgressedReps } = require('../../.test-dist/lib/progressionGate.js');
      const history = [entry(0, 12, 0), entry(0, 12, 3)];
      for (const trackingMode of ['load_and_reps', 'reps_first', 'hold']) {
        const result = resolveProgressedReps({
          history,
          templateTargetReps: 12,
          targetSets: 3,
          level: 'beginner',
          trackingMode,
          automatedProgressionEnabled: true,
        });
        assert.equal(result.progressed, false, trackingMode);
        assert.equal(result.targetReps, 12, trackingMode);
      }
    },
  },
  {
    name: 'rep progression: fatigue holds an earned jump and says so, like the load gate',
    run() {
      const { resolveProgressedReps } = require('../../.test-dist/lib/progressionGate.js');
      const base = {
        history: [entry(0, 12, 0), entry(0, 12, 3)],
        templateTargetReps: 12,
        targetSets: 3,
        level: 'beginner',
        trackingMode: 'bodyweight',
        automatedProgressionEnabled: true,
      };

      const held = resolveProgressedReps({ ...base, fatigueSignal: 'high' });
      assert.equal(held.progressed, false);
      assert.equal(held.targetReps, 12);
      assert.equal(held.heldForFatigue, true);

      // Not earned → the fatigue hold is not the reason, so no claim.
      const notEarned = resolveProgressedReps({
        ...base,
        history: [entry(0, 9, 0), entry(0, 9, 3)],
        fatigueSignal: 'high',
      });
      assert.equal(notEarned.heldForFatigue, false);

      // An intermediate needs the confirming session for reps too.
      const once = resolveProgressedReps({
        ...base,
        level: 'advanced',
        history: [entry(0, 12, 0), entry(0, [12, 11, 10], 3), entry(0, 10, 6)],
      });
      assert.equal(once.progressed, false);
      const confirmed = resolveProgressedReps({
        ...base,
        level: 'advanced',
        history: [entry(0, 12, 0), entry(0, 12, 3), entry(0, 10, 6)],
      });
      assert.equal(confirmed.progressed, true);
      assert.equal(confirmed.targetReps, 13);
    },
  },
];
