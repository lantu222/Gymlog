const assert = require('node:assert/strict');

const {
  extractFigures,
  flattenAdvice,
  scoreCase,
  scoreRun,
} = require('../../.test-dist/lib/aiCoachEval.js');
const { AI_COACH_EVAL_CASES, buildEvalContext } = require('../../.test-dist/lib/aiCoachEvalCases.js');

function advice(overrides = {}) {
  return {
    takeaway: '',
    why: [],
    nextSteps: [],
    plan: [],
    assumptions: [],
    ...overrides,
  };
}

const stalled = AI_COACH_EVAL_CASES.find((entry) => entry.id === 'stalled-bench');
const empty = AI_COACH_EVAL_CASES.find((entry) => entry.id === 'empty-account');

module.exports = [
  {
    name: 'eval: figures are extracted without tripping over dates',
    run() {
      assert.deepEqual(extractFigures('82.5 kg for 5 sessions'), ['82.5', '5']);
      // Comma decimals normalize, so a Finnish answer scores the same.
      assert.deepEqual(extractFigures('82,5 kg'), ['82.5']);
      // A performedAt year is not a claim about training.
      assert.deepEqual(extractFigures('since 2026 you lifted 100'), ['100']);
      assert.deepEqual(extractFigures('no numbers here'), []);
    },
  },
  {
    name: 'eval: an invented figure fails the grounding check',
    run() {
      const fabricated = scoreCase(
        stalled,
        advice({ takeaway: 'Your bench has been 82.5 kg and your volume is up 8% to 6240 kg.' }),
      );
      const grounding = fabricated.checks.find((check) => check.check === 'grounded');

      assert.equal(grounding.passed, false);
      // 6240 is the handoff mock's canned number — exactly the class of claim
      // this whole harness exists to catch.
      assert.match(grounding.detail, /6240/);
    },
  },
  {
    name: 'eval: a declared prescription is not fabrication',
    run() {
      // "try 85 next time" is advice, not a claim about what happened, and the
      // case declares it. It must not be scored as an invented figure.
      const grounded = scoreCase(
        stalled,
        advice({
          takeaway: 'Bench has sat at 82.5 kg for five sessions.',
          nextSteps: ['Try 85 kg for a single top set next time.'],
        }),
      );
      const grounding = grounded.checks.find((check) => check.check === 'grounded');
      assert.equal(grounding.passed, true, grounding.detail);
    },
  },
  {
    name: 'eval: a good answer scores higher than a plausible-sounding one',
    run() {
      const good = scoreCase(
        stalled,
        advice({
          takeaway: 'Your bench press has not moved from 82.5 kg across five sessions.',
          nextSteps: ['Add a rep before adding load.'],
        }),
      );
      const flattering = scoreCase(
        stalled,
        advice({ takeaway: 'Great progress — keep it up!' }),
      );

      assert.equal(good.score, 1, JSON.stringify(good.checks.filter((c) => !c.passed)));
      assert.ok(flattering.score < good.score);
      // It fails for the right reasons: no figure, and it claimed progress.
      assert.ok(flattering.checks.some((check) => check.check === 'cites:82.5' && !check.passed));
      assert.ok(flattering.checks.some((check) => check.check === 'avoids:great progress' && !check.passed));
    },
  },
  {
    name: 'eval: abstention cases fail when a trend is claimed anyway',
    run() {
      const silent = scoreCase(
        empty,
        advice({ takeaway: 'Log a couple of sessions and I can say something useful.' }),
      );
      const talkative = scoreCase(
        empty,
        advice({ takeaway: 'Your consistency is improving nicely.' }),
      );

      assert.equal(silent.checks.find((check) => check.check === 'abstains').passed, true);
      assert.equal(talkative.checks.find((check) => check.check === 'abstains').passed, false);
    },
  },
  {
    name: 'eval: the run score is a single comparable number',
    run() {
      const results = AI_COACH_EVAL_CASES.map((entry) =>
        scoreCase(entry, advice({ takeaway: 'Great progress, your volume is up 8%.' })),
      );
      const run = scoreRun(results);

      assert.equal(run.totalChecks > 0, true);
      assert.ok(run.score >= 0 && run.score <= 1);
      assert.ok(run.failures.length > 0, 'a flattering answer must not score clean');

      // Same answers, same number — the comparison is meaningful across runs.
      const repeat = scoreRun(
        AI_COACH_EVAL_CASES.map((entry) =>
          scoreCase(entry, advice({ takeaway: 'Great progress, your volume is up 8%.' })),
        ),
      );
      assert.equal(repeat.score, run.score);
    },
  },
  {
    name: 'eval: every seeded case is well-formed and built from the real payload',
    run() {
      assert.ok(AI_COACH_EVAL_CASES.length >= 5);

      for (const entry of AI_COACH_EVAL_CASES) {
        assert.ok(entry.id && entry.intent && entry.prompt, `${entry.id} is missing a field`);
        // The context must be the shape the endpoint really sends.
        assert.ok(entry.context.history, `${entry.id} has no history block`);
        assert.ok(Array.isArray(entry.context.history.sessions));
        // A case with no expectations would score 100% on anything.
        const expectations =
          (entry.mustCite?.length ?? 0)
          + (entry.mustMention?.length ?? 0)
          + (entry.mustNotSay?.length ?? 0)
          + (entry.expectsAbstention ? 1 : 0);
        assert.ok(expectations > 0, `${entry.id} asserts nothing`);
      }
    },
  },
  {
    name: 'eval: flattenAdvice searches every field the user can read',
    run() {
      const text = flattenAdvice(
        advice({
          takeaway: 'one',
          why: ['two'],
          nextSteps: ['three'],
          plan: ['four'],
          assumptions: ['five'],
        }),
      );
      for (const word of ['one', 'two', 'three', 'four', 'five']) {
        assert.match(text, new RegExp(word));
      }
    },
  },
  {
    name: 'eval: contexts can be built for a real anonymised history',
    run() {
      // The path the user follows when adding their own logs.
      const context = buildEvalContext(
        [
          {
            id: 'x1',
            workoutTemplateId: 't',
            workoutNameSnapshot: 'Pull',
            performedAt: new Date().toISOString(),
            totalVolumeKg: 2000,
          },
        ],
        [
          {
            id: 'x1-row',
            sessionId: 'x1',
            exerciseTemplateId: null,
            exerciseNameSnapshot: 'Barbell Row',
            weight: 70,
            repsPerSet: [8, 8],
            tracked: true,
            orderIndex: 0,
          },
        ],
      );

      assert.equal(context.history.sessionCount, 1);
      assert.equal(context.history.lifts[0].name, 'Barbell Row');
    },
  },
];
