const assert = require('node:assert/strict');

const {
  validateProgramTable,
  programTableToCsv,
  isProgramImageMediaType,
  PROGRAM_TABLE_SCHEMA,
  PROGRAM_TABLE_RULES,
} = require('../../.test-dist/lib/programImageImport.js');
const { parseCsvProgram } = require('../../.test-dist/lib/csvProgramImport.js');

/**
 * Reading a programme out of a photo.
 *
 * The point of the design is that a photo becomes the same CSV a paste would
 * have produced, so it joins the existing preview, correction and name-book
 * flow instead of growing its own. These tests hold that seam.
 */

const LIBRARY = [
  { id: 'ex_bench', name: 'Barbell Bench Press' },
  { id: 'ex_squat', name: 'Back Squat' },
];

module.exports = [
  {
    name: 'image import: a good answer survives, junk rows are dropped',
    run() {
      const rows = validateProgramTable({
        rows: [
          { day: ' Ma ', exercise: '  alatalja ', sets: 3, reps: ' 8-10 ' },
          { day: 'Ma', exercise: 'Barbell Bench Press', sets: 4.4, reps: '5' },
          // One unreadable line out of many must not cost the reader the rest.
          { day: 'Ma', exercise: '', sets: 3, reps: '8' },
          { day: 'Ti', exercise: 'Back Squat', sets: 0, reps: '5' },
          { day: 'Ti', exercise: 'Back Squat', sets: 3 },
          'not a row',
        ],
      });

      assert.equal(rows.length, 2);
      // Trimmed, and sets rounded to something a set count can be.
      assert.deepEqual(rows[0], { day: 'Ma', exercise: 'alatalja', sets: 3, reps: '8-10' });
      assert.equal(rows[1].sets, 4);
    },
  },
  {
    name: 'image import: an empty table is an answer, a broken payload is not',
    run() {
      // "This photo is not a programme" is a thing the rules ask for, so it
      // comes back as an empty table rather than as a failure.
      assert.deepEqual(validateProgramTable({ rows: [] }), []);
      assert.equal(validateProgramTable(null), null);
      assert.equal(validateProgramTable({}), null);
      assert.equal(validateProgramTable({ rows: 'nope' }), null);
    },
  },
  {
    name: 'image import: the table becomes CSV the existing parser reads',
    run() {
      const csv = programTableToCsv([
        { day: 'Ma', exercise: 'Barbell Bench Press', sets: 4, reps: '6-10' },
        { day: 'Ti', exercise: 'Back Squat', sets: 3, reps: '5' },
      ]);

      assert.equal(csv.split('\n')[0], 'Day,Exercise,Sets,Reps');

      // The seam: a photo does not get its own importer, it joins this one.
      const preview = parseCsvProgram(csv, LIBRARY);
      assert.equal(preview.rows.length, 2);
      assert.equal(preview.matchedCount, 2);
      assert.equal(preview.dayCount, 2);
      assert.deepEqual(preview.errors, []);
    },
  },
  {
    name: 'image import: a name with a comma cannot break the row',
    run() {
      const csv = programTableToCsv([
        { day: 'Ma', exercise: 'Kyykky, kapea haara-asento', sets: 3, reps: '8' },
        { day: 'Ma', exercise: 'Sanoi "noin"', sets: 2, reps: '10' },
      ]);

      const preview = parseCsvProgram(csv, LIBRARY);
      assert.equal(preview.rows.length, 2, 'a quoted cell must stay one cell');
      assert.equal(preview.rows[0].exerciseName, 'Kyykky, kapea haara-asento');
      assert.equal(preview.rows[0].sets, 3);
      assert.equal(preview.rows[1].exerciseName, 'Sanoi "noin"');
    },
  },
  {
    name: 'image import: unmatched names reach the correction flow intact',
    run() {
      // The reader's own word must arrive at the preview UNTRANSLATED, or the
      // name book has nothing to learn and the reader nothing to correct.
      const csv = programTableToCsv([{ day: 'Ma', exercise: 'alatalja', sets: 3, reps: '10' }]);
      const preview = parseCsvProgram(csv, LIBRARY);

      assert.equal(preview.rows[0].exerciseName, 'alatalja');
      assert.equal(preview.rows[0].matchedName, null);
      assert.equal(preview.unmatchedCount, 1);
    },
  },
  {
    name: 'image import: the rules forbid the model from being helpful',
    run() {
      // A model that translates "alatalja" has made a guess nobody can see or
      // correct — and taught the name book nothing. Both of these rules are
      // load-bearing rather than decorative.
      assert.match(PROGRAM_TABLE_RULES, /EXACTLY as written/);
      assert.match(PROGRAM_TABLE_RULES, /Never translate/);
      // A day written once against a block belongs to every row in it.
      assert.match(PROGRAM_TABLE_RULES, /repeat it/i);
      // And it must not invent numbers to fill a gap.
      assert.match(PROGRAM_TABLE_RULES, /rather than inventing/);
    },
  },
  {
    name: 'image import: the schema forces the four columns the parser needs',
    run() {
      const item = PROGRAM_TABLE_SCHEMA.properties.rows.items;
      assert.deepEqual([...item.required].sort(), ['day', 'exercise', 'reps', 'sets']);
      assert.equal(item.additionalProperties, false);
      assert.equal(item.properties.sets.type, 'integer');
      // Reps stay text: "6-10" is not a number, and the CSV parser already
      // owns every form that is accepted.
      assert.equal(item.properties.reps.type, 'string');
    },
  },
  {
    name: 'image import: only real image types are accepted',
    run() {
      assert.equal(isProgramImageMediaType('image/jpeg'), true);
      assert.equal(isProgramImageMediaType('image/png'), true);
      assert.equal(isProgramImageMediaType('application/pdf'), false);
      assert.equal(isProgramImageMediaType(''), false);
      assert.equal(isProgramImageMediaType(undefined), false);
    },
  },
];
