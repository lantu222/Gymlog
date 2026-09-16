const assert = require('node:assert/strict');

const fs = require('node:fs');
const path = require('node:path');

const {
  buildDuplicatedCustomProgramDraft,
  locateCopiedProgramTarget,
} = require('../../.test-dist/lib/customProgramDuplication.js');

const ROOT = path.join(__dirname, '..', '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\r\n/g, '\n');

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

      assert.equal(draft.name, 'Upper Lower', 'a copy keeps its own name');
      assert.equal(draft.sessions.length, 2);
      assert.equal(draft.sessions[0].name, 'Upper');
      assert.deepEqual(draft.sessions[0].exercises.map((exercise) => exercise.name), ['Bench Press', 'Row']);
      assert.equal(draft.sessions[1].exercises[0].restSeconds, 150);
    },
  },
  {
    /**
     * A copy keeps its own name. The reader changed a lift in a ready
     * programme; they did not ask for a second programme, and there is no
     * second programme — the catalog original is untouched behind them (user
     * 2026-09-08, "ei ole tarkoitus olla kopiota").
     */
    name: 'a copy keeps the programme\'s own name',
    run() {
      const draft = buildDuplicatedCustomProgramDraft('Upper Lower', [], ['Something Else']);
      assert.equal(draft.name, 'Upper Lower');
      // Whitespace is not a different name.
      assert.equal(buildDuplicatedCustomProgramDraft('  Upper Lower  ', [], ['Upper Lower']).name.startsWith('Upper Lower ('), true);
    },
  },
  {
    /**
     * The suffix survives for one case, and it is not a feature: the plain
     * name is already taken. Two rows reading the same is worse than one
     * reading "(copy)" — and either can be typed over on the programme page.
     */
    name: 'only a name already taken falls back to a suffix, and it counts up',
    run() {
      assert.equal(
        buildDuplicatedCustomProgramDraft('Upper Lower', [], ['Upper Lower']).name,
        'Upper Lower (copy)',
      );
      assert.equal(
        buildDuplicatedCustomProgramDraft('Upper Lower', [], ['Upper Lower', 'Upper Lower (copy)']).name,
        'Upper Lower (copy 2)',
      );
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

      assert.equal(draft.name, 'Rintavoima');
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

      // And when the fallback does fire, the suffix is the reader's language.
      const clash = buildDuplicatedCustomProgramDraft('Rintavoima', [], ['Rintavoima'], 'fi');
      assert.equal(clash.name, 'Rintavoima (kopio)');
    },
  },
  {
    /**
     * There is no "duplicate this programme" action, and there was never
     * meant to be one (user 2026-09-08). The idea was only ever that editing
     * a programme you were given must not touch the original — so the app
     * makes you your own copy, silently, and the catalog keeps its own.
     *
     * A handler for a real duplicate existed anyway, threaded through three
     * files and called from nowhere, quietly adding "(kopio)" if anything had
     * ever reached it. It is gone. This guard is what stops it coming back by
     * accident, because nothing on screen would have shown it was there.
     */
    name: 'nothing offers to duplicate a programme',
    run() {
      for (const file of ['App.tsx', 'src/app/renderWorkoutTab.tsx', 'src/screens/WorkoutsScreen.tsx']) {
        const source = read(file);
        assert.doesNotMatch(source, /handleDuplicateCustomProgram|DuplicateCustomWorkout/, file);
      }
      // And the one caller left asks for no naming option at all: keeping the
      // name is the rule now, not a flag one call site happens to pass.
      const lib = read('src/lib/customProgramDuplication.ts');
      assert.doesNotMatch(lib, /keepName|DuplicateNamingOptions/);
      assert.match(lib, /name: taken \? buildDisplayCopyName\(name, language, existingNames\) : name,/);
      // The toast only that handler raised went with it.
      assert.doesNotMatch(read('src/lib/i18n.ts'), /workoutDuplicateFailed/);
    },
  },
  {
    name: 'an edit made on the catalog page finds the same day and lift in the copy',
    run() {
      // The copy is written through the repository, which mints its own ids.
      const original = [
        { id: 'full_body_a', exercises: [{ id: 'cat_1', name: 'Squat' }, { id: 'cat_2', name: 'Bench Press' }] },
        { id: 'full_body_b', exercises: [{ id: 'cat_3', name: 'Deadlift' }] },
      ];
      const copy = [
        { id: 'sess_aaa', exercises: [{ id: 'ex_aaa', name: 'Squat' }, { id: 'ex_bbb', name: 'Bench Press' }] },
        { id: 'sess_bbb', exercises: [{ id: 'ex_ccc', name: 'Deadlift' }] },
      ];

      assert.deepEqual(locateCopiedProgramTarget(original, copy, 'full_body_a', 'cat_2'), {
        sessionId: 'sess_aaa',
        exerciseId: 'ex_bbb',
      });
      assert.deepEqual(locateCopiedProgramTarget(original, copy, 'full_body_b', 'cat_3'), {
        sessionId: 'sess_bbb',
        exerciseId: 'ex_ccc',
      });

      // An add names the day only.
      assert.deepEqual(locateCopiedProgramTarget(original, copy, 'full_body_a', ''), {
        sessionId: 'sess_aaa',
        exerciseId: '',
      });

      // The reader already dropped that lift from their copy: there is
      // nothing to edit, and the caller must not claim there was.
      const trimmed = [{ id: 'sess_aaa', exercises: [{ id: 'ex_aaa', name: 'Squat' }] }, copy[1]];
      assert.equal(locateCopiedProgramTarget(original, trimmed, 'full_body_a', 'cat_2'), null);
      assert.equal(locateCopiedProgramTarget(original, copy, 'no_such_day', 'cat_1'), null);
      // The reader deleted that whole day from their copy. There is no day at
      // its position any more, and the day that is there is a different day —
      // even when it happens to hold a lift of the same name.
      assert.equal(locateCopiedProgramTarget(original, [copy[0]], 'full_body_b', 'cat_3'), null);
      const sharedName = [
        { id: 'full_body_a', exercises: [{ id: 'cat_1', name: 'Squat' }] },
        { id: 'full_body_b', exercises: [{ id: 'cat_2', name: 'Squat' }] },
      ];
      assert.equal(
        locateCopiedProgramTarget(sharedName, [{ id: 'sess_aaa', exercises: [{ id: 'ex_aaa', name: 'Squat' }] }], 'full_body_b', 'cat_2'),
        null,
      );
      assert.equal(locateCopiedProgramTarget(original, copy, 'full_body_a', 'no_such_lift'), null);

      // The same lift twice in a day is answered by which of the two it is.
      const twice = [
        { id: 'full_body_a', exercises: [{ id: 'cat_1', name: 'Squat' }, { id: 'cat_2', name: 'Squat' }] },
      ];
      const twiceCopy = [
        { id: 'sess_aaa', exercises: [{ id: 'ex_aaa', name: 'Squat' }, { id: 'ex_bbb', name: 'Squat' }] },
      ];
      assert.deepEqual(locateCopiedProgramTarget(twice, twiceCopy, 'full_body_a', 'cat_2'), {
        sessionId: 'sess_aaa',
        exerciseId: 'ex_bbb',
      });
      // A lift added to the copy shifts every row after it, and the second
      // squat is still the second squat.
      const grown = [
        { id: 'sess_aaa', exercises: [{ id: 'ex_zzz', name: 'Leg Press' }, { id: 'ex_aaa', name: 'Squat' }, { id: 'ex_bbb', name: 'Squat' }] },
      ];
      assert.deepEqual(locateCopiedProgramTarget(twice, grown, 'full_body_a', 'cat_2'), {
        sessionId: 'sess_aaa',
        exerciseId: 'ex_bbb',
      });
      // One of the two dropped: the second squat is not there to edit.
      const halved = [{ id: 'sess_aaa', exercises: [{ id: 'ex_aaa', name: 'Squat' }] }];
      assert.equal(locateCopiedProgramTarget(twice, halved, 'full_body_a', 'cat_2'), null);
    },
  },
];
