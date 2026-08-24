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
      // Smaller step for the slower progression rate.
      assert.equal(twice.incrementKg, 1.25);
      assert.equal(twice.loadKg, 61.25);
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
      assert.deepEqual(on, { loadKg: 62.5, progressed: true, fromLoadKg: 60, heldForFatigue: false, heldForFeel: false });

      // OFF is exactly the old behaviour: repeat what was logged.
      const off = resolveProgressedLoadKg({ ...shared, automatedProgressionEnabled: false });
      assert.deepEqual(off, { loadKg: 60, progressed: false, fromLoadKg: null, heldForFatigue: false, heldForFeel: false });

      // ON but not earned still repeats — the toggle promises a rule, not a
      // weekly increase.
      const notEarned = resolveProgressedLoadKg({
        ...shared,
        history: [entry(60, [12, 11, 10], 0), entry(60, 12, 3)],
        automatedProgressionEnabled: true,
      });
      assert.deepEqual(notEarned, { loadKg: 60, progressed: false, fromLoadKg: null, heldForFatigue: false, heldForFeel: false });
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
      assert.equal(PROGRESSION_LEVEL_PARAMS.intermediate.loadIncrementKg, 1.25);
      assert.equal(PROGRESSION_LEVEL_PARAMS.beginner.requiredConsecutive, 1);
      assert.equal(PROGRESSION_LEVEL_PARAMS.intermediate.requiredConsecutive, 2);
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
    name: 'feel: "too hard" holds an earned jump, and "hard" does not',
    run() {
      const earned = [entry(60, 12, 0), entry(60, 12, 3)];

      assert.equal(gate({ history: earned }).recommendation, 'increase');

      const tooHard = gate({ history: earned, latestSessionFeel: 'too_hard' });
      assert.equal(tooHard.recommendation, 'hold');
      assert.equal(tooHard.holdReason, 'feel_too_hard');

      // 'hard' is what the top of a rep range is supposed to feel like.
      // Holding on it would stall every honest reader and quietly reward the
      // ones who under-report.
      assert.equal(gate({ history: earned, latestSessionFeel: 'hard' }).recommendation, 'increase');
      assert.equal(gate({ history: earned, latestSessionFeel: 'right' }).recommendation, 'increase');

      // Absent is "never asked" or "skipped", not "felt fine" — and it earns
      // neither the hold nor the shortcut.
      assert.equal(gate({ history: earned, latestSessionFeel: null }).recommendation, 'increase');
      assert.equal(gate({ history: earned }).recommendation, 'increase');
    },
  },
  {
    name: 'feel: "easy" satisfies the confirmation session but overrules nothing else',
    run() {
      // An intermediate normally needs a second session at the same load.
      const once = [entry(60, 12, 0), entry(60, [12, 11, 10], 3), entry(60, 10, 6)];
      assert.equal(gate({ history: once, level: 'advanced' }).holdReason, 'awaiting_confirmation');

      // Clearing every set's ceiling and then calling it easy IS the proof the
      // confirmation session exists to collect.
      const confirmed = gate({ history: once, level: 'advanced', latestSessionFeel: 'easy' });
      assert.equal(confirmed.recommendation, 'increase');
      assert.equal(confirmed.loadKg, 61.25);

      // It reaches the wait and nothing else. Every earlier hold still wins.
      const missedCeiling = [entry(60, 9, 0), entry(60, 9, 3), entry(60, 9, 6)];
      assert.equal(
        gate({ history: missedCeiling, level: 'advanced', latestSessionFeel: 'easy' }).holdReason,
        'rep_ceiling_not_reached',
      );
      assert.equal(
        gate({ history: once, level: 'advanced', latestSessionFeel: 'easy', fatigueSignal: 'high' }).holdReason,
        'fatigue_high',
      );
      const afterGap = [entry(60, 12, 0), entry(60, 12, 9), entry(60, 12, 12)];
      assert.equal(
        gate({ history: afterGap, level: 'advanced', latestSessionFeel: 'easy' }).holdReason,
        'gap_return',
      );
    },
  },
  {
    name: 'a feel hold names itself, and never takes credit for a jump that was not coming',
    run() {
      const base = {
        history: [entry(60, 12, 0), entry(60, 12, 3)],
        repsMin: 8,
        repsMax: 12,
        targetSets: 3,
        level: 'beginner',
        automatedProgressionEnabled: true,
        fallbackLoadKg: 60,
      };

      const held = resolveProgressedLoadKg({ ...base, latestSessionFeel: 'too_hard' });
      assert.equal(held.loadKg, 60);
      assert.equal(held.progressed, false);
      assert.equal(held.heldForFeel, true);
      // The two reasons stay apart: the badge has to say which one happened,
      // and "recovery" on a call the reader made themselves would credit the
      // app for their judgement.
      assert.equal(held.heldForFatigue, false);

      // Nothing was going to move, so nothing was held.
      const notEarned = resolveProgressedLoadKg({
        ...base,
        history: [entry(60, 9, 0), entry(60, 9, 3)],
        latestSessionFeel: 'too_hard',
      });
      assert.equal(notEarned.heldForFeel, false);

      // Recovery is checked first, so a cooked reader who also said too hard
      // reports the recovery hold — and only that one, so the badge cannot
      // show two reasons for one weight.
      const both = resolveProgressedLoadKg({ ...base, fatigueSignal: 'high', latestSessionFeel: 'too_hard' });
      assert.equal(both.heldForFatigue, true);
      assert.equal(both.heldForFeel, false);

      // With progression off there is no load to hold, so no claim to make.
      const free = resolveProgressedLoadKg({
        ...base,
        automatedProgressionEnabled: false,
        latestSessionFeel: 'too_hard',
      });
      assert.equal(free.heldForFeel, false);
      assert.equal(free.loadKg, 60);
    },
  },
];
