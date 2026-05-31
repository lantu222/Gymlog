const assert = require('node:assert/strict');

const { createEmptyDatabase } = require('../../.test-dist/data/seed.js');
const { buildHomeUpcomingSessions } = require('../../.test-dist/lib/homeVisuals.js');

module.exports = [
  {
    name: 'home upcoming sessions preserve active plan session ids',
    run() {
      const database = createEmptyDatabase();
      database.preferences.activePlanId = 'plan_full_body';
      database.workoutPlans = [
        {
          id: 'plan_full_body',
          name: 'Full Body Plan',
          mode: 'rotation',
          isActive: true,
          createdAt: '2026-05-25T00:00:00.000Z',
          updatedAt: '2026-05-25T00:00:00.000Z',
          entries: [
            { id: 'entry_a', workoutTemplateId: 'custom_full_body', workoutTemplateSessionId: 'day_a', label: 'Mon', orderIndex: 0 },
            { id: 'entry_b', workoutTemplateId: 'custom_full_body', workoutTemplateSessionId: 'day_b', label: 'Thu', orderIndex: 1 },
          ],
        },
      ];
      const customTemplates = [
        {
          id: 'custom_full_body',
          name: 'Full Body',
          sessions: [
            { id: 'day_a', name: 'Full Body A' },
            { id: 'day_b', name: 'Full Body B' },
          ],
        },
      ];

      const sessions = buildHomeUpcomingSessions({
        database,
        readyTemplates: [],
        customTemplates,
        setupSelection: null,
        recommendedReadyTemplate: null,
      });

      assert.deepEqual(
        sessions.map((session) => session.title),
        ['Full Body A', 'Full Body B'],
      );
    },
  },
];
