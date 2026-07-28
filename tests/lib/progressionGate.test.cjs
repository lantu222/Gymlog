const assert = require('node:assert/strict');

const {
  PROGRESSION_LEVEL_PARAMS,
  evaluateProgression,
  getProgressionTier,
  isProgressionReadySession,
  resolveProgressedLoadKg,
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

      const on = resolveProgressedLoadKg({ ...shared, automatedProgressionEnabled: true });
      assert.deepEqual(on, { loadKg: 62.5, progressed: true });

      // OFF is exactly the old behaviour: repeat what was logged.
      const off = resolveProgressedLoadKg({ ...shared, automatedProgressionEnabled: false });
      assert.deepEqual(off, { loadKg: 60, progressed: false });

      // ON but not earned still repeats — the toggle promises a rule, not a
      // weekly increase.
      const notEarned = resolveProgressedLoadKg({
        ...shared,
        history: [entry(60, [12, 11, 10], 0), entry(60, 12, 3)],
        automatedProgressionEnabled: true,
      });
      assert.deepEqual(notEarned, { loadKg: 60, progressed: false });
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
];
