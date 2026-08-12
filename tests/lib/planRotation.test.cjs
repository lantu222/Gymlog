const assert = require('node:assert/strict');

const { resolveNextPlanEntryIndex } = require('../../.test-dist/lib/planRotation.js');

const ENTRIES = [
  { workoutTemplateId: 'tpl', workoutTemplateSessionId: 's1' },
  { workoutTemplateId: 'tpl', workoutTemplateSessionId: 's2' },
  { workoutTemplateId: 'tpl', workoutTemplateSessionId: 's3' },
];

const logged = (sessionId, performedAt) => ({
  workoutTemplateId: 'tpl',
  workoutTemplateSessionId: sessionId,
  performedAt,
});

module.exports = [
  {
    // The bug this exists to end: Home offered entries[0] forever, so
    // finishing day 1 offered day 1 again — and logging it wrote the wrong
    // session against the plan.
    name: 'the plan offers the session after the most recent one',
    run() {
      assert.equal(resolveNextPlanEntryIndex(ENTRIES, [logged('s1', '2026-08-10T10:00:00.000Z')]), 1);
      assert.equal(resolveNextPlanEntryIndex(ENTRIES, [logged('s2', '2026-08-10T10:00:00.000Z')]), 2);
    },
  },
  {
    name: 'the last session wraps to the first',
    run() {
      assert.equal(resolveNextPlanEntryIndex(ENTRIES, [logged('s3', '2026-08-10T10:00:00.000Z')]), 0);
    },
  },
  {
    name: 'recency decides, not log order',
    run() {
      const out = resolveNextPlanEntryIndex(ENTRIES, [
        logged('s3', '2026-08-01T10:00:00.000Z'),
        logged('s1', '2026-08-09T10:00:00.000Z'),
        logged('s2', '2026-08-05T10:00:00.000Z'),
      ]);
      assert.equal(out, 1, 's1 was the most recent, so s2 is next');
    },
  },
  {
    name: 'a fresh plan and an empty plan both start at the first entry',
    run() {
      assert.equal(resolveNextPlanEntryIndex(ENTRIES, []), 0);
      assert.equal(resolveNextPlanEntryIndex([], [logged('s1', '2026-08-10T10:00:00.000Z')]), 0);
    },
  },
  {
    name: 'sessions from other programmes do not move this rotation',
    run() {
      const out = resolveNextPlanEntryIndex(ENTRIES, [
        { workoutTemplateId: 'other', workoutTemplateSessionId: 'x', performedAt: '2026-08-11T10:00:00.000Z' },
        logged('s1', '2026-08-09T10:00:00.000Z'),
      ]);
      assert.equal(out, 1);
    },
  },
  {
    // One unreadable row must not be treated as the newest and hijack the
    // whole rotation.
    name: 'a corrupt timestamp is skipped rather than treated as newest',
    run() {
      const out = resolveNextPlanEntryIndex(ENTRIES, [
        logged('s3', 'not-a-date'),
        logged('s1', '2026-08-09T10:00:00.000Z'),
      ]);
      assert.equal(out, 1);
    },
  },
  {
    // An entry with no session id stands for the whole template, which is how
    // plans built before named sessions are stored.
    name: 'a template-wide entry matches any session of that template',
    run() {
      const entries = [
        { workoutTemplateId: 'tpl', workoutTemplateSessionId: null },
        { workoutTemplateId: 'other', workoutTemplateSessionId: null },
      ];
      assert.equal(resolveNextPlanEntryIndex(entries, [logged('anything', '2026-08-10T10:00:00.000Z')]), 1);
    },
  },
];
