const assert = require('node:assert/strict');

const {
  buildCustomProgramDetail,
  buildCustomSessionRuntimeTemplate,
  buildReadyProgramDetail,
  buildReadySessionRuntimeTemplate,
} = require('../../.test-dist/lib/programDetails.js');
const { getWorkoutTemplateById, WORKOUT_TEMPLATES_V1 } = require('../../.test-dist/features/workout/workoutCatalog.js');

module.exports = [
  {
    name: 'ready program detail exposes metadata and info sections',
    run() {
      const template = getWorkoutTemplateById('tpl_3_day_full_body_v1');
      const detail = buildReadyProgramDetail(template, {
        cardPrimary: 'Next: Full Body B',
        cardSecondary: 'Top set: Bench Press 85 kg - 8,7,6',
        highlights: [{ label: 'This week', value: '2 sessions' }],
        sessionStatusById: { full_body_a: 'Last done Mar 24', full_body_b: 'Next up | Not logged yet' },
      });

      assert.equal(detail.title, 'FIT');
      assert.equal(detail.sessions.length, 3);
      assert.ok(detail.badges.includes('Beginner'));
      assert.equal(detail.description.includes('Three full-body sessions'), true);
      assert.equal(detail.infoSections.length, 3);
      assert.equal(detail.infoSections[0].kicker, 'Who it fits');
      assert.equal(detail.highlights[0].label, 'This week');
      assert.equal(detail.sessions[0].name, 'Day 1: Full Body');
      assert.ok(detail.sessions[0].preview.includes('Back Squat'));
      assert.match(detail.sessions[0].guidance.firstAction, /Back Squat.*first work set/i);
      assert.match(detail.sessions[0].guidance.restGuidance, /sec/i);
      assert.equal(detail.sessions[0].statusLine, 'Last done Mar 24');
      assert.match(detail.progressionSummary, /week|easier week|deload|pivot/i);
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
    name: 'ready program detail shows the composed week when one is provided',
    run() {
      const template = getWorkoutTemplateById('tpl_3_day_full_body_v1');
      const composedWeek = {
        programId: template.id,
        days: 2,
        weeks: 4,
        totalWorkouts: 8,
        sessionMinutes: 45,
        composed: true,
        cautionRemoved: [],
        cautionSwapped: [],
        focusAdditions: [],
        equipmentRemoved: [],
        equipmentSwapped: [],
        sessions: [
          {
            id: 'composed_day_1',
            name: 'Day 1: Full Body',
            orderIndex: 0,
            source: 'template',
            exercises: [
              {
                id: 'ex_1',
                exerciseName: 'Goblet Squat',
                slotId: 'slot_1',
                role: 'primary',
                progressionPriority: 'high',
                trackingMode: 'weight_reps',
                sets: 3,
                repsMin: 8,
                repsMax: 10,
              },
            ],
          },
          {
            id: 'composed_day_2',
            name: 'Day 2: Full Body',
            orderIndex: 1,
            source: 'template',
            exercises: [],
          },
        ],
      };

      const detail = buildReadyProgramDetail(template, undefined, null, [], composedWeek);

      // The detail describes the plan the user runs: 2 composed days, not the
      // raw 3-day catalog template.
      assert.match(detail.subtitle, /2 days \/ week/);
      assert.ok(detail.badges.includes('2 days'));
      assert.equal(detail.sessions.length, 2);
      assert.equal(detail.sessions[0].id, 'composed_day_1');
      assert.ok(detail.sessions[0].preview.includes('Goblet Squat'));

      // Without a composed week the raw template still renders.
      const rawDetail = buildReadyProgramDetail(template);
      assert.equal(rawDetail.sessions.length, 3);
      assert.match(rawDetail.subtitle, /3 days \/ week/);
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
      // Not "start the first session": a program the reader owns but is not
      // running has to be adoptable, or the only way onto Home is the catalog
      // and onboarding — neither of which knows about an imported program.
      assert.equal(detail.primaryActionLabel, 'Start this programme');
      assert.equal(detail.sessionActionLabel, 'Start session');
      assert.equal(detail.sessions.length, 1);
      assert.equal(detail.sessions[0].guidance, null);
      assert.equal(detail.infoSections.length, 0);
      assert.ok(detail.badges.includes('Own program'));

      // Every string this builder returns follows the reader's language. It
      // used to return English literals, so a Finnish user's own program was
      // described to them in English on the screen that exists to describe it.
      const fi = buildCustomProgramDetail(
        { id: 'tpl_custom', name: 'Rintavoima', sessions: [{ id: 's1', name: 'Day 1', orderIndex: 0, exercises: [{ id: 'e1', name: 'Bench', targetSets: 3, repMin: 5, repMax: 5, restSeconds: 120, trackedDefault: true }] }] },
        undefined,
        'fi',
      );
      assert.ok(fi.badges.includes('Oma ohjelma'));
      assert.match(fi.description, /omista treeneist/);
      assert.equal(fi.primaryActionLabel, 'Ota ohjelma käyttöön');

      // Already the plan Home reads: the button offers the next workout
      // instead, the same answer a ready programme gives.
      const running = buildCustomProgramDetail(
        { id: 'tpl_custom', name: 'Rintavoima', sessions: [{ id: 's1', name: 'Day 1', orderIndex: 0, exercises: [{ id: 'e1', name: 'Bench', targetSets: 3, repMin: 5, repMax: 5, restSeconds: 120, trackedDefault: true }] }] },
        undefined,
        'fi',
        true,
      );
      assert.equal(running.primaryActionLabel, 'Aloita seuraava treeni');

      // An empty program is still sent to the editor — there is no plan to
      // adopt, and Home would draw a card with no session behind it.
      const empty = buildCustomProgramDetail(
        { id: 'tpl_empty', name: 'Tyhjä', sessions: [{ id: 's1', name: 'Day 1', orderIndex: 0, exercises: [] }] },
        undefined,
        'fi',
      );
      assert.equal(empty.primaryActionLabel, 'Muokkaa pohjaa');
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
    name: 'the primary action reads whether the programme is already the reader’s',
    run() {
      const template = getWorkoutTemplateById('tpl_3_day_full_body_v1');

      const browsing = buildReadyProgramDetail(template, undefined, null, [], null, 'fi');
      assert.equal(browsing.primaryActionLabel, 'Ota ohjelma käyttöön');

      // Adoption returns early for a programme already held, so this label used
      // to name a decision the button could not make.
      const mine = buildReadyProgramDetail(template, undefined, null, [], null, 'fi', true);
      assert.equal(mine.primaryActionLabel, 'Aloita seuraava treeni');
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
  {
    name: 'a rolling programme states its days, and its sessions are not that number',
    run() {
      // Strength Foundations 5x5 is the one catalog entry whose day count and
      // session count differ: A-B-A / B-A-B, three days on two workouts. The
      // detail page used to count sessions and draw it as a two-day programme
      // under a catalog row that said "3 ×" (#bugs 2026-09-01). The view
      // model carries the programme's own number so the screen never has to
      // guess it from the session list.
      const template = getWorkoutTemplateById('tpl_gainer_strength_5x5_v1');
      assert.equal(template.sessions.length, 2, 'the fixture assumes the classic two-workout 5x5');
      assert.equal(template.daysPerWeek, 3);
      const detail = buildReadyProgramDetail(template);
      assert.equal(detail.daysPerWeek, 3);
      assert.equal(detail.sessions.length, 2);
      assert.match(detail.subtitle, /3 days \/ week/);

      // A custom programme has no number of its own: one session per day.
      const custom = buildCustomProgramDetail({
        id: 'tpl_custom_x',
        name: 'Mine',
        goalType: 'general',
        level: 'beginner',
        splitType: 'full_body',
        estimatedSessionDuration: 45,
        defaultScheduleMode: 'rolling_sequence',
        sessions: [
          { id: 'a', name: 'A', orderIndex: 1, exercises: [] },
          { id: 'b', name: 'B', orderIndex: 2, exercises: [] },
        ],
      });
      assert.equal(custom.daysPerWeek, 2);
    },
  },
  {
    name: 'every ready programme trains at least as many days as it has sessions, within a week',
    run() {
      // The guard for the next 5x5. A programme with MORE sessions than days
      // would never reach some of them in a week; one claiming more than
      // seven days is a typo. Either is data nobody can schedule, and nothing
      // else in the app fails on it — the calendar just quietly draws the
      // wrong week.
      const offenders = WORKOUT_TEMPLATES_V1.filter(
        (template) =>
          !Number.isInteger(template.daysPerWeek) ||
          template.daysPerWeek < 1 ||
          template.daysPerWeek > 7 ||
          template.sessions.length > template.daysPerWeek,
      ).map((template) => `${template.id} days=${template.daysPerWeek} sessions=${template.sessions.length}`);
      assert.deepEqual(offenders, []);
      // And the one deliberate exception is still the only one — if a second
      // appears, it is a decision, not an accident.
      const rolling = WORKOUT_TEMPLATES_V1.filter((template) => template.sessions.length !== template.daysPerWeek);
      assert.deepEqual(
        rolling.map((template) => template.id),
        ['tpl_gainer_strength_5x5_v1'],
      );
    },
  },
];
