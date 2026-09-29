const assert = require('node:assert/strict');

const {
  validateProgramTable,
  programTableToCsv,
  isProgramImageMediaType,
  PROGRAM_TABLE_SCHEMA,
  PROGRAM_TABLE_RULES,
} = require('../../.test-dist/lib/programImageImport.js');
const { parseCsvProgram } = require('../../.test-dist/lib/csvProgramImport.js');
const { readAppWiring } = require('../helpers/appWiringSource.cjs');

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
    name: 'image import: a name copied with the spreadsheet cell\'s own line wrap is one name',
    run() {
      // The model is told to copy a cell exactly; a cell wrapped across two
      // lines in the sheet is still one exercise name, not two lines of one.
      // validateProgramTable is the choke point every row passes through
      // before it ever becomes CSV text.
      const validated = validateProgramTable({
        rows: [{ day: 'Ma\ntreeni', exercise: 'Barbell\nBench Press', sets: 4, reps: '6-10' }],
      });
      assert.deepEqual(validated, [{ day: 'Ma treeni', exercise: 'Barbell Bench Press', sets: 4, reps: '6-10' }]);

      // And so the CSV it becomes never carries the line break into the
      // parser that treats a break as a record boundary.
      const csv = programTableToCsv(validated);
      assert.equal(csv.split('\n').length, 2, 'one header line and one data line, not three');

      const preview = parseCsvProgram(csv, LIBRARY);
      assert.equal(preview.rows.length, 1);
      assert.equal(preview.rows[0].exerciseName, 'Barbell Bench Press');
      assert.equal(preview.rows[0].matchedName, 'Barbell Bench Press');
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
  {
    name: 'the photo button is offered only where there is a coach behind it',
    run() {
      // requestProgramTableFromImage returns null before it makes a request
      // when there is no endpoint, so in a preview build the button opened
      // the gallery, made the reader choose a photo, and produced nothing
      // (2026-09-16). NewProgramSheet hides it when the handler is absent.
      const wiring = readAppWiring();
      assert.match(
        wiring,
        /const handlePickProgramImage = isAiCoachLiveConfigured\(\) \? pickProgramImageForImport : undefined;/,
      );
      // The result carries which of the four endings it was since 2026-09-19:
      // `null` for every one of them told a reader who had backed out of the
      // picker that their photo could not be read.
      assert.match(wiring, /handlePickProgramImage\?: \(\) => Promise<ProgramImageImportResult>;/);
      const sheet = require('node:fs').readFileSync(
        require('node:path').join(__dirname, '..', '..', 'src', 'components', 'NewProgramSheet.tsx'),
        'utf8',
      );
      assert.match(
        sheet,
        /\{onPickImage && \(!photoLocked \|\| onOpenPaywall\) \? \(/,
        'the sheet renders the row only when it has a handler, and a locked one only when it can lead to Pro',
      );
    },
  },
  {
    name: 'reading a programme from a photo is Pro only, at the link and at the paid call',
    run() {
      // Each photo is a live model call paid from the coach's balance, and a
      // free reader could run it without limit (2026-09-29 hunt). The user
      // chose Pro only, like the AI-assisted row beside it.
      const fs = require('node:fs');
      const path = require('node:path');
      const sheet = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'components', 'NewProgramSheet.tsx'), 'utf8');
      assert.match(sheet, /const photoLocked = !proUnlocked;/);
      assert.match(
        sheet,
        /if \(photoLocked\) \{\s*handleClose\(\);\s*onOpenPaywall\?\.\(\);\s*return;\s*\}\s*void handlePickImage\(\);/,
        'a locked link opens Pro instead of the picker',
      );
      // Since the beta badge (2026-09-29) the unlocked side carries that pill.
      assert.match(sheet, /\{photoLocked \? \(\s*<ProPill \/>/);

      // The sheet defaults proUnlocked to true, so the paid call checks the
      // entitlement itself before anything else, notice included.
      const wiring = readAppWiring();
      const body = wiring.slice(wiring.indexOf('async function pickProgramImageForImport'));
      const gate = body.indexOf('if (!resolveProEntitlement(preferences).unlocked)');
      assert.ok(gate > 0, 'pickProgramImageForImport checks the entitlement');
      assert.ok(gate < body.indexOf('askPhotoOnlineNotice'), 'before the notice and the picker');
      assert.ok(gate < body.indexOf('requestProgramTableFromImage'), 'before the paid call');

      // Every sheet handed the photo handler also gets the lock.
      const settings = wiring.slice(wiring.indexOf('<SettingsImportSheet'));
      const settingsProps = settings.slice(0, settings.indexOf('/>'));
      assert.match(settingsProps, /proUnlocked=\{resolveProEntitlement\(preferences\)\.unlocked\}/);
      assert.match(settingsProps, /onOpenPaywall=\{/);
    },
  },
  {
    name: 'the photo link says beta, and the preview shows names in the reader\'s language',
    run() {
      // #bugs 2026-09-29: the user asked for a beta badge rather than polish;
      // the preview printed the stored English name of a lift the reader had
      // written in Finnish; SARJAT and TOISTOT broke mid-word.
      const fs = require('node:fs');
      const path = require('node:path');
      const sheet = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'components', 'NewProgramSheet.tsx'), 'utf8');
      assert.match(sheet, /\{photoLocked \? \(\s*<ProPill \/>\s*\) : \(\s*<View style=\{styles\.betaPill\}>/);
      assert.match(sheet, /row\.matchedName \? exerciseNameLabel\(language, row\.matchedName\) : row\.exerciseName/);
      assert.doesNotMatch(sheet, /\{row\.matchedName \?\? row\.exerciseName\}/);
      const width = (name) => Number(sheet.match(new RegExp(`${name}: \\{\\s*width: (\\d+)`))[1]);
      assert.ok(width('previewSets') >= 56, 'SARJAT fits on one line');
      assert.ok(width('previewReps') >= 62, 'TOISTOT fits on one line');
    },
  },
];
