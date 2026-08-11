const {
  FREE_ACTIVE_PROGRAM_CAP,
  PRO_ACTIVE_PROGRAM_CAP,
  addActiveProgram,
  evaluateProgramAdoption,
  removeActiveProgram,
  resolveActiveProgramCap,
} = require('../../.test-dist/lib/activeProgramSet.js');

module.exports = [
  {
    name: 'the cap is two free and five on Pro',
    run() {
      const assert = require('node:assert/strict');
      assert.equal(FREE_ACTIVE_PROGRAM_CAP, 2);
      assert.equal(PRO_ACTIVE_PROGRAM_CAP, 5);
      assert.equal(resolveActiveProgramCap(false), 2);
      assert.equal(resolveActiveProgramCap(true), 5);
    },
  },
  {
    name: 'an empty set has room, and adopting reports what it used',
    run() {
      const assert = require('node:assert/strict');
      const decision = evaluateProgramAdoption({
        activePlanIds: [],
        targetPlanId: 'ready_plan_run',
        proUnlocked: false,
      });
      assert.deepEqual(decision, { kind: 'adopt', used: 0, cap: 2 });
    },
  },
  {
    name: 'one programme still leaves room for the season',
    run() {
      const assert = require('node:assert/strict');
      const decision = evaluateProgramAdoption({
        activePlanIds: ['onboarding_plan_back'],
        targetPlanId: 'ready_plan_run',
        proUnlocked: false,
      });
      assert.equal(decision.kind, 'adopt');
    },
  },
  {
    name: 'the third programme is blocked for free and offers the upgrade',
    run() {
      const assert = require('node:assert/strict');
      const decision = evaluateProgramAdoption({
        activePlanIds: ['plan_a', 'plan_b'],
        targetPlanId: 'ready_plan_run',
        proUnlocked: false,
      });
      assert.deepEqual(decision, { kind: 'blocked', used: 2, cap: 2, canUpgrade: true });
    },
  },
  {
    name: 'Pro gets past two but is blocked at six without being sold Pro again',
    run() {
      const assert = require('node:assert/strict');
      const atThree = evaluateProgramAdoption({
        activePlanIds: ['a', 'b'],
        targetPlanId: 'c',
        proUnlocked: true,
      });
      assert.equal(atThree.kind, 'adopt');

      const full = evaluateProgramAdoption({
        activePlanIds: ['a', 'b', 'c', 'd', 'e'],
        targetPlanId: 'f',
        proUnlocked: true,
      });
      assert.deepEqual(full, { kind: 'blocked', used: 5, cap: 5, canUpgrade: false });
    },
  },
  {
    name: 'a programme already running is never blocked by the cap',
    run() {
      const assert = require('node:assert/strict');
      const decision = evaluateProgramAdoption({
        activePlanIds: ['plan_a', 'ready_plan_run'],
        targetPlanId: 'ready_plan_run',
        proUnlocked: false,
      });
      assert.deepEqual(decision, { kind: 'already_active' });
    },
  },
  {
    name: 'duplicates in stored data cannot eat the cap',
    run() {
      const assert = require('node:assert/strict');
      const decision = evaluateProgramAdoption({
        activePlanIds: ['plan_a', 'plan_a'],
        targetPlanId: 'ready_plan_run',
        proUnlocked: false,
      });
      assert.deepEqual(decision, { kind: 'adopt', used: 1, cap: 2 });
    },
  },
  {
    name: 'adding keeps order and never duplicates on a double tap',
    run() {
      const assert = require('node:assert/strict');
      assert.deepEqual(addActiveProgram(['a'], 'b'), ['a', 'b']);
      assert.deepEqual(addActiveProgram(['a', 'b'], 'b'), ['a', 'b']);
      assert.deepEqual(addActiveProgram([], 'a'), ['a']);
    },
  },
  {
    name: 'removing frees the cap again so two is not a dead end',
    run() {
      const assert = require('node:assert/strict');
      assert.deepEqual(removeActiveProgram(['a', 'b'], 'a'), ['b']);

      const afterRemoval = evaluateProgramAdoption({
        activePlanIds: removeActiveProgram(['a', 'b'], 'a'),
        targetPlanId: 'ready_plan_run',
        proUnlocked: false,
      });
      assert.equal(afterRemoval.kind, 'adopt');
    },
  },
  {
    name: 'removing something absent leaves the set alone',
    run() {
      const assert = require('node:assert/strict');
      assert.deepEqual(removeActiveProgram(['a', 'b'], 'zzz'), ['a', 'b']);
    },
  },
];
