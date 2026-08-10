const assert = require('node:assert/strict');

const { buildDuplicatedCustomProgramDraft } = require('../../.test-dist/lib/customProgramDuplication.js');

module.exports = [
  {
    name: 'custom program duplication keeps sessions and exercises in order',
    run() {
      const draft = buildDuplicatedCustomProgramDraft('Upper Lower', [
        {
          id: 'upper',
          name: 'Upper',
          orderIndex: 0,
          exerciseIds: ['bench', 'row'],
          exercises: [
            { id: 'bench', workoutTemplateId: 'custom_1', workoutTemplateSessionId: 'upper', name: 'Bench Press', targetSets: 3, repMin: 6, repMax: 8, restSeconds: 120, trackedDefault: true, orderIndex: 0, libraryItemId: 'lib_bench' },
            { id: 'row', workoutTemplateId: 'custom_1', workoutTemplateSessionId: 'upper', name: 'Row', targetSets: 3, repMin: 8, repMax: 10, restSeconds: 90, trackedDefault: true, orderIndex: 1, libraryItemId: 'lib_row' },
          ],
        },
        {
          id: 'lower',
          name: 'Lower',
          orderIndex: 1,
          exerciseIds: ['squat'],
          exercises: [
            { id: 'squat', workoutTemplateId: 'custom_1', workoutTemplateSessionId: 'lower', name: 'Back Squat', targetSets: 3, repMin: 5, repMax: 8, restSeconds: 150, trackedDefault: true, orderIndex: 0, libraryItemId: 'lib_squat' },
          ],
        },
      ], []);

      assert.equal(draft.name, 'Upper Lower (copy)');
      assert.equal(draft.sessions.length, 2);
      assert.equal(draft.sessions[0].name, 'Upper');
      assert.deepEqual(draft.sessions[0].exercises.map((exercise) => exercise.name), ['Bench Press', 'Row']);
      assert.equal(draft.sessions[1].exercises[0].restSeconds, 150);
    },
  },
  {
    name: 'custom program duplication generates a unique copy name',
    run() {
      const draft = buildDuplicatedCustomProgramDraft('Upper Lower', [], ['Upper Lower Copy']);
      assert.equal(draft.name, 'Upper Lower (copy 2)');
    },
  },
  {
    // Duplication is where catalog English entered the user's own database.
    // Every viewer localises on the way out, so this showed through only in
    // the template editor — the one screen that must display the stored name
    // verbatim, because that is the name it will save.
    name: 'duplicating into Finnish writes Finnish names, not catalog English',
    run() {
      const draft = buildDuplicatedCustomProgramDraft(
        'Rintavoima',
        [
          { id: 'd1', name: 'Day 1: Upper (Heavy)', orderIndex: 0, exercises: [] },
          { id: 'd4', name: 'Day 4: Lower (Growth)', orderIndex: 1, exercises: [] },
        ],
        [],
        'fi',
      );

      assert.equal(draft.name, 'Rintavoima (kopio)');
      assert.equal(draft.sessions[0].name, 'Päivä 1: Ylävartalo (raskas)');
      assert.equal(draft.sessions[1].name, 'Päivä 4: Alavartalo (kasvu)');

      // English stays English — the language decides, not the presence of a
      // dictionary entry.
      const en = buildDuplicatedCustomProgramDraft(
        'Chest Power',
        [{ id: 'd1', name: 'Day 1: Upper (Heavy)', orderIndex: 0, exercises: [] }],
        [],
        'en',
      );
      assert.equal(en.sessions[0].name, 'Day 1: Upper (Heavy)');
    },
  },
];