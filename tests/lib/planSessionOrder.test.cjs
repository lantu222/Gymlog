const assert = require('node:assert/strict');

const { repointPlanEntrySessions } = require('../../.test-dist/lib/planSessionOrder.js');

const plan = () => [
  { orderIndex: 0, label: 'mon', workoutTemplateSessionId: 'a' },
  { orderIndex: 1, label: 'wed', workoutTemplateSessionId: 'b' },
  { orderIndex: 2, label: 'thu', workoutTemplateSessionId: 'c' },
];

module.exports = [
  {
    name: 'the plan follows the programme order, and the weekdays stay where the reader put them',
    run() {
      // The programme's days were dragged into c, a, b.
      const result = repointPlanEntrySessions(plan(), ['c', 'a', 'b']);
      assert.equal(result.kind, 'repointed');
      assert.deepEqual(
        result.entries.map((entry) => entry.workoutTemplateSessionId),
        ['c', 'a', 'b'],
      );
      // Moving a day changes WHICH session lands on Thursday, never whether
      // Thursday is a training day at all.
      assert.deepEqual(
        result.entries.map((entry) => entry.label),
        ['mon', 'wed', 'thu'],
      );
      assert.deepEqual(
        result.entries.map((entry) => entry.orderIndex),
        [0, 1, 2],
      );
    },
  },
  {
    name: 'entries are read in stored order, not in the order the store returned them',
    run() {
      const shuffled = [
        { orderIndex: 2, label: 'thu', workoutTemplateSessionId: 'c' },
        { orderIndex: 0, label: 'mon', workoutTemplateSessionId: 'a' },
        { orderIndex: 1, label: 'wed', workoutTemplateSessionId: 'b' },
      ];
      const result = repointPlanEntrySessions(shuffled, ['b', 'c', 'a']);
      assert.deepEqual(
        result.entries.map((entry) => [entry.label, entry.workoutTemplateSessionId]),
        [
          ['mon', 'b'],
          ['wed', 'c'],
          ['thu', 'a'],
        ],
      );
    },
  },
  {
    name: 'an order that changes nothing is not a write',
    run() {
      assert.deepEqual(repointPlanEntrySessions(plan(), ['a', 'b', 'c']), {
        kind: 'skip',
        reason: 'unchanged',
      });
    },
  },
  {
    name: 'sessions the plan never ran are ignored, and it still has to come out even',
    run() {
      // A session with no exercises never reached the plan at adoption. It may
      // sit anywhere in the programme; it must not become a training day here.
      const result = repointPlanEntrySessions(plan(), ['empty', 'c', 'a', 'b']);
      assert.equal(result.kind, 'repointed');
      assert.deepEqual(
        result.entries.map((entry) => entry.workoutTemplateSessionId),
        ['c', 'a', 'b'],
      );

      // But a programme missing one of the plan's own sessions is a pair of
      // records that no longer describe the same thing. Refuse rather than
      // scramble: a cosmetic reorder is better than a wrong training week.
      assert.deepEqual(repointPlanEntrySessions(plan(), ['c', 'a']), {
        kind: 'skip',
        reason: 'countMismatch',
      });
    },
  },
  {
    name: 'an entry that stands for the whole template is left alone',
    run() {
      // planRotation reads a null session id as "any session of this template".
      // Re-pointing it would silently narrow the entry to one day.
      const loose = [
        { orderIndex: 0, label: 'mon', workoutTemplateSessionId: null },
        { orderIndex: 1, label: 'wed', workoutTemplateSessionId: 'b' },
      ];
      assert.deepEqual(repointPlanEntrySessions(loose, ['b', 'a']), {
        kind: 'skip',
        reason: 'noSessionIds',
      });
      // A plan with no entries has nothing to re-point, which is a no-op
      // rather than a disagreement.
      assert.deepEqual(repointPlanEntrySessions([], ['a']), {
        kind: 'skip',
        reason: 'unchanged',
      });
    },
  },
];
