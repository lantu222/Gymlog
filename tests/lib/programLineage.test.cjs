const assert = require('node:assert/strict');

const {
  alignHistoryToCopiedDays,
  programmeLineageIds,
} = require('../../.test-dist/lib/programLineage.js');

/**
 * The same programme, before and after the reader changed a lift in it
 * (programme audit, 2026-09-16).
 */

const TEMPLATES = [
  { id: 'copy_1', sourceTemplateId: 'tpl_full_body' },
  { id: 'copy_2', sourceTemplateId: 'tpl_full_body' },
  { id: 'own', sourceTemplateId: null },
  { id: 'copy_other', sourceTemplateId: 'tpl_upper_lower' },
];

module.exports = [
  {
    name: 'lineage: a copy, the programme it came from, and the other copies of it are one programme',
    run() {
      assert.deepEqual(programmeLineageIds('copy_1', TEMPLATES), ['copy_1', 'tpl_full_body', 'copy_2']);
      // Asked of the catalog programme itself — which is what the season does.
      assert.deepEqual(programmeLineageIds('tpl_full_body', TEMPLATES), ['tpl_full_body', 'copy_1', 'copy_2']);
      // A programme of the reader's own is only itself.
      assert.deepEqual(programmeLineageIds('own', TEMPLATES), ['own']);
      // And an id nothing knows about is still an answer, not a crash.
      assert.deepEqual(programmeLineageIds('tpl_unknown', TEMPLATES), ['tpl_unknown']);
      // Copies of a different programme stay out of it.
      assert.ok(!programmeLineageIds('copy_1', TEMPLATES).includes('copy_other'));
    },
  },
  {
    name: 'lineage: yesterday’s session wears the day id the copy knows it by',
    run() {
      const sessions = [
        { id: 's1', workoutTemplateId: 'tpl_full_body', workoutTemplateSessionId: 'day_b', performedAt: '2026-09-15T17:00:00.000Z' },
        { id: 's2', workoutTemplateId: 'copy_1', workoutTemplateSessionId: 'copy_day_a', performedAt: '2026-09-16T17:00:00.000Z' },
        { id: 's3', workoutTemplateId: 'tpl_other', workoutTemplateSessionId: 'x', performedAt: '2026-09-14T17:00:00.000Z' },
      ];
      const mapping = {
        fromTemplateIds: ['copy_1', 'tpl_full_body'],
        fromSessionIds: ['day_a', 'day_b', 'day_c'],
        toTemplateId: 'copy_1',
        toSessionIds: ['copy_day_a', 'copy_day_b', 'copy_day_c'],
      };

      const aligned = alignHistoryToCopiedDays(sessions, mapping);
      // Day 2 of the original is day 2 of the copy.
      assert.deepEqual(aligned[0], { ...sessions[0], workoutTemplateId: 'copy_1', workoutTemplateSessionId: 'copy_day_b' });
      // What already belongs to the copy is left alone, and so is everything
      // that belongs to another programme.
      assert.deepEqual(aligned[1], sessions[1]);
      assert.deepEqual(aligned[2], sessions[2]);
      // Nothing is dropped and nothing is added.
      assert.equal(aligned.length, sessions.length);
    },
  },
  {
    name: 'lineage: once the days no longer line up, nothing is translated',
    run() {
      const sessions = [{ id: 's1', workoutTemplateId: 'tpl_full_body', workoutTemplateSessionId: 'day_b' }];
      // The reader deleted a day from their copy: position no longer means
      // the same day, and guessing would put yesterday on the wrong workout.
      const shortened = alignHistoryToCopiedDays(sessions, {
        fromTemplateIds: ['copy_1', 'tpl_full_body'],
        fromSessionIds: ['day_a', 'day_b', 'day_c'],
        toTemplateId: 'copy_1',
        toSessionIds: ['copy_day_a', 'copy_day_b'],
      });
      assert.deepEqual(shortened, sessions);

      // A day the original does not have is left as it is.
      const unknownDay = alignHistoryToCopiedDays(
        [{ id: 's1', workoutTemplateId: 'tpl_full_body', workoutTemplateSessionId: 'day_z' }],
        {
          fromTemplateIds: ['copy_1', 'tpl_full_body'],
          fromSessionIds: ['day_a', 'day_b'],
          toTemplateId: 'copy_1',
          toSessionIds: ['copy_day_a', 'copy_day_b'],
        },
      );
      assert.equal(unknownDay[0].workoutTemplateId, 'tpl_full_body');

      // And a programme with no copy at all is a no-op.
      assert.deepEqual(
        alignHistoryToCopiedDays(sessions, {
          fromTemplateIds: ['copy_1'],
          fromSessionIds: ['day_a', 'day_b'],
          toTemplateId: 'copy_1',
          toSessionIds: ['copy_day_a', 'copy_day_b'],
        }),
        sessions,
      );
    },
  },
];
