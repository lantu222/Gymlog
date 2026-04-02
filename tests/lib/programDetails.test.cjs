const assert = require('node:assert/strict');

const {
  buildCustomProgramDetail,
  buildCustomSessionRuntimeTemplate,
  buildReadyProgramDetail,
  buildReadySessionRuntimeTemplate,
} = require('../../.test-dist/lib/programDetails.js');
const { getWorkoutTemplateById } = require('../../.test-dist/features/workout/workoutCatalog.js');

module.exports = [
  {
    name: 'ready program detail exposes metadata, info sections, and session focus',
    run() {
      const template = getWorkoutTemplateById('tpl_3_day_full_body_v1');
      const detail = buildReadyProgramDetail(template, {
        cardPrimary: 'Next: Full Body B',
        cardSecondary: 'Top set: Bench Press 85 kg - 8,7,6',
        highlights: [{ label: 'This week', value: '2 sessions' }],
        sessionStatusById: { full_body_a: 'Last done Mar 24', full_body_b: 'Next up | Not logged yet' },
      });

      assert.equal(detail.title, '3-Day Full Body');
      assert.equal(detail.sessions.length, 3);
      assert.ok(detail.badges.includes('Beginner'));
      assert.equal(detail.description.includes('Three full-body sessions'), true);
      assert.equal(detail.infoSections.length, 3);
      assert.equal(detail.infoSections[0].kicker, 'Who it fits');
      assert.equal(detail.highlights[0].label, 'This week');
      assert.equal(detail.sessions[0].name, 'Full Body A');
      assert.ok(detail.sessions[0].preview.includes('Back Squat'));
      assert.ok(detail.sessions[0].focus.includes('Squat + bench'));
      assert.equal(detail.sessions[0].statusLine, 'Last done Mar 24');
    },
  },
  {
    name: 'ready program detail can prepend a why-it-fits explanation',
    run() {
      const template = getWorkoutTemplateById('tpl_3_day_full_body_v1');
      const detail = buildReadyProgramDetail(
        template,
        undefined,
        'Built around your general fitness goal with a 3-day rhythm.',
      );

      assert.equal(detail.infoSections[0].kicker, 'Why it fits');
      assert.match(detail.infoSections[0].body, /3-day rhythm/i);
    },
  },
  {
    name: 'custom program detail exposes custom metadata',
    run() {
      const detail = buildCustomProgramDetail({
        id: 'custom_1',
        name: 'Upper Focus',
        defaultScheduleMode: 'rolling_sequence',
        sessions: [
          {
            id: 'custom_session_1',
            name: 'Upper Focus',
            orderIndex: 1,
            exercises: [
              {
                id: 'bench',
                exerciseName: 'Bench Press',
                slotId: 'bench_slot',
                role: 'secondary',
                progressionPriority: 'medium',
                trackingMode: 'load_and_reps',
                sets: 3,
                repsMin: 6,
                repsMax: 8,
                restSecondsMin: 90,
                restSecondsMax: 120,
                substitutionGroup: 'horizontal_press',
              },
            ],
          },
        ],
      });

      assert.equal(detail.source, 'custom');
      assert.equal(detail.primaryActionLabel, 'Start first session');
      assert.equal(detail.sessionActionLabel, 'Start session');
      assert.equal(detail.sessions.length, 1);
      assert.equal(detail.infoSections.length, 0);
      assert.ok(detail.badges.includes('Custom'));
    },
  },
  {
    name: 'custom session runtime template starts only one custom session at a time',
    run() {
      const runtime = buildCustomSessionRuntimeTemplate(
        {
          id: 'custom_2',
          name: 'Upper Lower',
          defaultScheduleMode: 'rolling_sequence',
          sessions: [
            {
              id: 'upper',
              name: 'Upper',
              orderIndex: 0,
              exercises: [
                {
                  id: 'bench',
                  exerciseName: 'Bench Press',
                  slotId: 'bench_slot',
                  role: 'secondary',
                  progressionPriority: 'medium',
                  trackingMode: 'load_and_reps',
                  sets: 3,
                  repsMin: 6,
                  repsMax: 8,
                  restSecondsMin: 90,
                  restSecondsMax: 120,
                  substitutionGroup: 'horizontal_press',
                },
              ],
            },
            {
              id: 'lower',
              name: 'Lower',
              orderIndex: 1,
              exercises: [
                {
                  id: 'squat',
                  exerciseName: 'Back Squat',
                  slotId: 'squat_slot',
                  role: 'secondary',
                  progressionPriority: 'medium',
                  trackingMode: 'load_and_reps',
                  sets: 3,
                  repsMin: 5,
                  repsMax: 8,
                  restSecondsMin: 120,
                  restSecondsMax: 150,
                  substitutionGroup: 'squat',
                },
              ],
            },
          ],
        },
        'lower',
      );

      assert.equal(runtime.sessions.length, 1);
      assert.equal(runtime.sessions[0].id, 'lower');
      assert.match(runtime.name, /Lower/);
    },
  },
  {
    name: 'ready session runtime template starts only one session at a time',
    run() {
      const template = getWorkoutTemplateById('tpl_4_day_upper_lower_v1');
      const runtime = buildReadySessionRuntimeTemplate(template, 'upper_b');

      assert.equal(runtime.id, template.id);
      assert.equal(runtime.sessions.length, 1);
      assert.equal(runtime.sessions[0].id, 'upper_b');
      assert.match(runtime.name, /Upper B/);
    },
  },
];
