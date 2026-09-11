const assert = require('node:assert/strict');

const { setNumberLanguage } = require('../../.test-dist/lib/format');

setNumberLanguage('en');

const {
  buildGuidedRunSheet,
  buildGuidedSteps,
  getGuidedNextName,
  getGuidedNextPreview,
  getGuidedStepPlanKey,
} = require('../../.test-dist/lib/guidedPlayer');

function lift(slotId, name, overrides = {}) {
  return { slotId, name, restSeconds: 90, setCount: 3, skipped: false, supersetGroup: null, ...overrides };
}

/** The work steps as a readable script: what happens, to which lift, in order. */
function script(plan) {
  return plan.steps
    .filter((step) => step.type === 'set' || step.type === 'rest' || step.type === 'position')
    .map((step) => `${step.type}:${step.slotId}${step.type === 'position' ? '' : step.setIndex}`);
}

function pairPlan(overrides = {}) {
  return buildGuidedSteps({
    warmup: [],
    cooldown: [],
    exercises: [
      lift('a', 'Bench Press', { supersetGroup: 'g1', setCount: 2, ...overrides.a }),
      lift('b', 'Barbell Row', { supersetGroup: 'g1', setCount: 2, ...overrides.b }),
    ],
  });
}

module.exports = [
  {
    name: 'a superset runs A1 then A2, and rests only after the pair',
    run() {
      assert.deepEqual(script(pairPlan()), [
        'position:a',
        'set:a0',
        'set:b0',
        'rest:b0',
        'set:a1',
        'set:b1',
      ]);
    },
  },
  {
    name: 'the lifts of a superset are badged A1 and A2',
    run() {
      const sets = pairPlan().steps.filter((step) => step.type === 'set');
      assert.deepEqual(
        sets.map((step) => step.supersetLabel),
        ['A1', 'A2', 'A1', 'A2'],
      );
      assert.deepEqual(
        sets.map((step) => `${step.supersetRound.round}/${step.supersetRound.rounds}`),
        ['1/2', '1/2', '2/2', '2/2'],
      );
    },
  },
  {
    name: 'a lift done on its own carries no superset badge',
    run() {
      const plan = buildGuidedSteps({
        warmup: [],
        cooldown: [],
        exercises: [lift('a', 'Bench Press', { setCount: 2 })],
      });
      assert.deepEqual(
        plan.steps.filter((step) => step.type === 'set').map((step) => step.supersetLabel),
        [undefined, undefined],
      );
    },
  },
  {
    name: 'an ordinary session still rests between sets and not after the last one',
    run() {
      const plan = buildGuidedSteps({
        warmup: [],
        cooldown: [],
        exercises: [lift('a', 'Bench Press', { setCount: 3 }), lift('b', 'Overhead Press', { setCount: 2 })],
      });
      assert.deepEqual(script(plan), [
        'position:a',
        'set:a0',
        'rest:a0',
        'set:a1',
        'rest:a1',
        'set:a2',
        'position:b',
        'set:b0',
        'rest:b0',
        'set:b1',
      ]);
    },
  },
  {
    name: 'a superset rests as long as the more demanding lift in it asks for',
    run() {
      // A squat paired with a curl is still a squat: the pair's rest is the
      // longer of the two, not the rest of whichever lift happens to be last.
      const plan = pairPlan({ a: { restSeconds: 180 }, b: { restSeconds: 45 } });
      const rests = plan.steps.filter((step) => step.type === 'rest');
      assert.equal(rests.length, 1);
      assert.equal(rests[0].seconds, 180);
    },
  },
  {
    name: 'the superset is one block on the rail, counted in rounds',
    run() {
      const plan = pairPlan();
      assert.deepEqual(plan.groups, [{ phase: 'work', setCount: 2, supersetSize: 2 }]);
    },
  },
  {
    name: 'a superset of three runs A1 A2 A3 before it rests',
    run() {
      const plan = buildGuidedSteps({
        warmup: [],
        cooldown: [],
        exercises: [
          lift('a', 'Bench Press', { supersetGroup: 'g1', setCount: 2 }),
          lift('b', 'Barbell Row', { supersetGroup: 'g1', setCount: 2 }),
          lift('c', 'Plank', { supersetGroup: 'g1', setCount: 2 }),
        ],
      });
      assert.deepEqual(script(plan), [
        'position:a',
        'set:a0',
        'set:b0',
        'set:c0',
        'rest:c0',
        'set:a1',
        'set:b1',
        'set:c1',
      ]);
    },
  },
  {
    name: 'the longer lift of a mismatched pair finishes its last set alone',
    run() {
      const plan = pairPlan({ a: { setCount: 3 }, b: { setCount: 2 } });
      assert.deepEqual(script(plan), [
        'position:a',
        'set:a0',
        'set:b0',
        'rest:b0',
        'set:a1',
        'set:b1',
        'rest:b1',
        'set:a2',
      ]);
    },
  },
  {
    name: 'skipping one half of a pair leaves the other running on its own',
    run() {
      // Nothing in the skip path knows about supersets; the pairing survives
      // only as long as the rule holds, and here it stops holding.
      const plan = pairPlan({ b: { skipped: true } });
      assert.deepEqual(script(plan), ['position:a', 'set:a0', 'rest:a0', 'set:a1']);
      assert.equal(plan.groups[0].supersetSize, undefined);
    },
  },
  {
    name: 'a pairing that is no longer adjacent is no longer a superset',
    run() {
      const plan = buildGuidedSteps({
        warmup: [],
        cooldown: [],
        exercises: [
          lift('a', 'Bench Press', { supersetGroup: 'g1', setCount: 1 }),
          lift('b', 'Squat', { setCount: 1 }),
          lift('c', 'Barbell Row', { supersetGroup: 'g1', setCount: 1 }),
        ],
      });
      assert.deepEqual(script(plan), ['position:a', 'set:a0', 'position:b', 'set:b0', 'position:c', 'set:c0']);
    },
  },
  {
    name: 'the second superset of a session is B',
    run() {
      const plan = buildGuidedSteps({
        warmup: [],
        cooldown: [],
        exercises: [
          lift('a', 'Bench Press', { supersetGroup: 'g1', setCount: 1 }),
          lift('b', 'Barbell Row', { supersetGroup: 'g1', setCount: 1 }),
          lift('c', 'Squat', { setCount: 1 }),
          lift('d', 'Curl', { supersetGroup: 'g2', setCount: 1 }),
          lift('e', 'Pushdown', { supersetGroup: 'g2', setCount: 1 }),
        ],
      });
      assert.deepEqual(
        plan.steps.filter((step) => step.type === 'set').map((step) => step.supersetLabel ?? null),
        ['A1', 'A2', null, 'B1', 'B2'],
      );
    },
  },
  {
    name: 'the run sheet lists both lifts of a superset, badged',
    run() {
      const sheet = buildGuidedRunSheet(pairPlan(), 0);
      assert.equal(sheet.length, 1);
      assert.deepEqual(
        sheet[0].members.map((member) => `${member.supersetLabel} ${member.name}`),
        ['A1 Bench Press', 'A2 Barbell Row'],
      );
      // Rounds, not halves of rounds.
      assert.equal(sheet[0].setCount, 2);
    },
  },
  {
    name: 'an ordinary lift is one member of its own row',
    run() {
      const plan = buildGuidedSteps({
        warmup: [],
        cooldown: [],
        exercises: [lift('a', 'Bench Press', { setCount: 2 })],
      });
      const sheet = buildGuidedRunSheet(plan, 0);
      assert.deepEqual(sheet[0].members, [{ name: 'Bench Press', slotId: 'a', supersetLabel: null }]);
    },
  },
  {
    name: 'what comes next inside a superset is the other lift',
    run() {
      const plan = pairPlan();
      const firstSet = plan.steps.findIndex((step) => step.type === 'set');
      assert.equal(getGuidedNextName(plan.steps, firstSet), 'Barbell Row');
    },
  },
  {
    name: 'the no-rest line is only shown when no rest is actually coming',
    run() {
      const plan = pairPlan();
      const sets = plan.steps
        .map((step, index) => ({ step, index }))
        .filter((entry) => entry.step.type === 'set');
      const resolve = () => null;
      // On A1, the row after it is A2 with nothing between them.
      const fromA1 = getGuidedNextPreview(plan.steps, sets[0].index, resolve, 'en');
      assert.match(fromA1.line, /No rest/);
      // On A2, the next set is the top of the NEXT round, and a rest stands in
      // front of it. Saying "no rest" there is the app promising something the
      // step list itself contradicts two steps later.
      const fromA2 = getGuidedNextPreview(plan.steps, sets[1].index, resolve, 'en');
      assert.doesNotMatch(fromA2.line, /No rest/);
      assert.equal(fromA2.line, 'Bench Press');
    },
  },
  {
    name: 'pairing two lifts changes the memo key that rebuilds the steps',
    run() {
      const loose = [lift('a', 'Bench Press'), lift('b', 'Barbell Row')];
      const paired = [
        lift('a', 'Bench Press', { supersetGroup: 'g1' }),
        lift('b', 'Barbell Row', { supersetGroup: 'g1' }),
      ];
      assert.notEqual(getGuidedStepPlanKey(loose), getGuidedStepPlanKey(paired));
    },
  },
];
