const {
  buildReadyProgramPlanId,
  buildReadyProgramWorkoutPlan,
} = require('../../.test-dist/lib/programAdoption.js');

const NOW = '2026-08-11T09:00:00.000Z';

function buildInput(overrides = {}) {
  return {
    workoutTemplateId: 'run_starter',
    programName: 'Kesäkunto',
    sessionIds: ['s1', 's2', 's3'],
    dayLabels: ['Ma', 'Ke', 'Pe'],
    now: NOW,
    ...overrides,
  };
}

module.exports = [
  {
    name: 'the plan id comes from the template so re-joining updates one record',
    run() {
      const assert = require('node:assert/strict');
      assert.equal(buildReadyProgramPlanId('run_starter'), 'ready_plan_run_starter');

      const first = buildReadyProgramWorkoutPlan(buildInput());
      const second = buildReadyProgramWorkoutPlan(buildInput({ now: '2026-12-24T00:00:00.000Z' }));
      assert.equal(first.id, second.id, 're-joining must not mint a second plan');
    },
  },
  {
    name: 'every session becomes an ordered entry carrying its own session id',
    run() {
      const assert = require('node:assert/strict');
      const plan = buildReadyProgramWorkoutPlan(buildInput());

      assert.equal(plan.entries.length, 3);
      assert.deepEqual(
        plan.entries.map((entry) => entry.workoutTemplateSessionId),
        ['s1', 's2', 's3'],
      );
      assert.deepEqual(plan.entries.map((entry) => entry.orderIndex), [0, 1, 2]);
      assert.ok(plan.entries.every((entry) => entry.workoutTemplateId === 'run_starter'));
    },
  },
  {
    name: 'day labels repeat when there are more sessions than training days',
    run() {
      const assert = require('node:assert/strict');
      const plan = buildReadyProgramWorkoutPlan(
        buildInput({ sessionIds: ['s1', 's2', 's3', 's4'], dayLabels: ['Ma', 'To'] }),
      );

      assert.deepEqual(plan.entries.map((entry) => entry.label), ['Ma', 'To', 'Ma', 'To']);
    },
  },
  {
    name: 'no chosen days falls back to Day N rather than inventing a weekday',
    run() {
      const assert = require('node:assert/strict');
      const plan = buildReadyProgramWorkoutPlan(buildInput({ dayLabels: [] }));

      assert.deepEqual(plan.entries.map((entry) => entry.label), ['Day 1', 'Day 2', 'Day 3']);
    },
  },
  {
    name: 'a programme with no sessions still produces one usable entry',
    run() {
      const assert = require('node:assert/strict');
      const plan = buildReadyProgramWorkoutPlan(buildInput({ sessionIds: [] }));

      assert.equal(plan.entries.length, 1);
      assert.equal(plan.entries[0].workoutTemplateSessionId, null);
    },
  },
  {
    name: 'the adopted plan is active and carries the programme name and timestamps',
    run() {
      const assert = require('node:assert/strict');
      const plan = buildReadyProgramWorkoutPlan(buildInput());

      assert.equal(plan.isActive, true);
      assert.equal(plan.name, 'Kesäkunto');
      assert.equal(plan.mode, 'rotation');
      assert.equal(plan.createdAt, NOW);
      assert.equal(plan.updatedAt, NOW);
    },
  },
];
