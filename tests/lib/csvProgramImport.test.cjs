const assert = require('node:assert/strict');

const { parseCsvProgram, buildDraftFromCsvPreview } = require('../../.test-dist/lib/csvProgramImport.js');

const LIBRARY = [
  { id: 'lib_bench', name: 'Bench Press' },
  { id: 'lib_incline_db', name: 'Incline Dumbbell Press' },
  { id: 'lib_row', name: 'Barbell Row' },
  { id: 'lib_pulldown', name: 'Lat Pulldown' },
  { id: 'lib_squat', name: 'Back Squat' },
  { id: 'lib_rdl', name: 'Romanian Deadlift' },
];

const SAMPLE = [
  'Day,Exercise,Sets,Reps',
  'Day 1,Bench Press,4,6-10',
  'Day 1,incline dumbbell press,3,8–12',
  'Day 2,Barbell Row,4,6-10',
  'Day 2,Lat Pulldown,3,10',
  'Day 3,Back Squat,4,5',
  'Day 3,Romanian Deadlift,3,8-10',
].join('\n');

module.exports = [
  {
    name: 'csv import parses lenient headers, delimiters, and rep formats',
    run() {
      const preview = parseCsvProgram(SAMPLE, LIBRARY);
      assert.equal(preview.errors.length, 0);
      assert.equal(preview.rows.length, 6);
      assert.equal(preview.matchedCount, 6);
      assert.equal(preview.unmatchedCount, 0);
      assert.equal(preview.dayCount, 3);
      assert.equal(preview.rows[1].matchedName, 'Incline Dumbbell Press');
      assert.equal(preview.rows[1].repMin, 8);
      assert.equal(preview.rows[1].repMax, 12);
      assert.equal(preview.rows[4].repMin, 5);
      assert.equal(preview.rows[4].repMax, 5);

      const semicolon = parseCsvProgram('DAY;EXERCISE;SETS;REPS\nPush;Bench Press;4;6-10', LIBRARY);
      assert.equal(semicolon.rows.length, 1);
      assert.equal(semicolon.rows[0].libraryItemId, 'lib_bench');
    },
  },
  {
    name: 'csv import matches spacing variants and flags near-misses with a suggestion',
    run() {
      const preview = parseCsvProgram(
        'Day,Exercise,Sets,Reps\nDay 1,Romanian Dead Lift,3,8-10\nDay 1,DB Incline Press,3,10\nDay 1,Benchpress Machine XYZ,3,10',
        LIBRARY,
      );
      assert.equal(preview.rows.length, 3);
      // Spacing variant matches outright.
      assert.equal(preview.rows[0].matchedName, 'Romanian Deadlift');
      // Near-miss stays unmatched but carries a suggestion.
      assert.equal(preview.rows[1].matchedName, null);
      assert.equal(preview.rows[1].suggestion, 'Incline Dumbbell Press');
      // Noise stays unmatched with no suggestion.
      assert.equal(preview.rows[2].matchedName, null);
      assert.equal(preview.rows[2].suggestion, null);
      assert.equal(preview.unmatchedCount, 2);
    },
  },
  {
    name: 'csv import reports row-level errors without dropping valid rows',
    run() {
      const preview = parseCsvProgram('Day,Exercise,Sets,Reps\nDay 1,Bench Press,four,10\nDay 1,Back Squat,4,heavy\nDay 2,Barbell Row,4,6-10', LIBRARY);
      assert.equal(preview.rows.length, 1);
      assert.equal(preview.errors.length, 2);
      assert.equal(preview.rows[0].matchedName, 'Barbell Row');

      const badHeader = parseCsvProgram('Foo,Bar\n1,2', LIBRARY);
      assert.equal(badHeader.rows.length, 0);
      assert.match(badHeader.errors[0], /Day, Exercise, Sets and Reps/);
    },
  },
  {
    name: 'csv import builds a draft grouped by day, skipping unmatched rows',
    run() {
      const preview = parseCsvProgram(`${SAMPLE}\nDay 3,Mystery Movement,3,10`, LIBRARY);
      const draft = buildDraftFromCsvPreview(preview, 'Imported plan');
      assert.equal(draft.name, 'Imported plan');
      assert.equal(draft.sessions.length, 3);
      assert.deepEqual(draft.sessions.map((session) => session.name), ['Day 1', 'Day 2', 'Day 3']);
      assert.equal(draft.sessions[0].exercises.length, 2);
      assert.equal(draft.sessions[2].exercises.length, 2);
      assert.equal(draft.sessions[0].exercises[0].name, 'Bench Press');
      assert.equal(draft.sessions[0].exercises[0].targetSets, 4);
      assert.equal(draft.sessions[0].exercises[0].repMin, 6);
      assert.equal(draft.sessions[0].exercises[0].repMax, 10);
      assert.equal(draft.sessions[0].exercises[0].libraryItemId, 'lib_bench');
    },
  },
  {
    name: 'csv import caps a programme at 7 days, with a clear error, so title/chips/rhythm agree',
    run() {
      const lines = ['Day,Exercise,Sets,Reps'];
      for (let day = 1; day <= 8; day += 1) {
        lines.push(`Day ${day},Bench Press,4,6-10`);
      }
      const preview = parseCsvProgram(lines.join('\n'), LIBRARY);

      // Only 7 distinct days survive — the same cap ProgramDetailScreen's
      // week chips and rhythm editor enforce (getTrainingDayIndexes).
      assert.equal(preview.dayCount, 7);
      assert.equal(preview.rows.length, 7);
      assert.equal(preview.rows.every((row) => row.day !== 'Day 8'), true);
      assert.equal(preview.errors.some((error) => error.includes('Day 8')), true);

      const draft = buildDraftFromCsvPreview(preview, 'Eight day plan');
      assert.equal(draft.sessions.length, 7);
    },
  },
  {
    name: 'csv import errors are written in the reader\'s language',
    run() {
      // They are shown as they are; until 2026-09-26 every one was English.
      assert.deepEqual(parseCsvProgram('', LIBRARY, [], 'fi').errors, ['Tiedosto on tyhjä.']);
      assert.match(parseCsvProgram('Foo,Bar\n1,2', LIBRARY, [], 'fi').errors[0], /^Ensimmäisellä rivillä/);
      const rows = parseCsvProgram(
        'Day,Exercise,Sets,Reps\nDay 1,,4,10\nDay 1,Bench Press,four,10\nDay 1,Back Squat,4,heavy',
        LIBRARY,
        [],
        'fi',
      );
      assert.deepEqual(rows.errors, [
        'Rivi 2: päivä tai liikkeen nimi puuttuu.',
        'Rivi 3: sarjojen pitää olla kokonaisluku, vähintään 1.',
        'Rivi 4: toistojen pitää olla luku tai väli, esim. 6-10.',
      ]);
      const lines = ['Day,Exercise,Sets,Reps'];
      for (let day = 1; day <= 8; day += 1) {
        lines.push(`Päivä ${day},Bench Press,4,6-10`);
      }
      assert.deepEqual(parseCsvProgram(lines.join('\n'), LIBRARY, [], 'fi').errors, [
        'Rivi 9: "Päivä 8" jätettiin pois. Ohjelmassa voi olla enintään 7 treenipäivää.',
      ]);

      // And the sheet passes its language in.
      const sheet = require('node:fs').readFileSync(
        require('node:path').join(__dirname, '..', '..', 'src', 'components', 'NewProgramSheet.tsx'),
        'utf8',
      );
      assert.match(sheet, /parseCsvProgram\(csvText, exerciseLibrary, nameBook, language\)/);
    },
  },
];
