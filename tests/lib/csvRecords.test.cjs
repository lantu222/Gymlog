const assert = require('node:assert/strict');

const { splitCsvRecords, collapseCellWhitespace } = require('../../.test-dist/lib/csvRecords.js');

/**
 * The one record boundary both CSV importers share: a line break outside an
 * open quote. csvProgramImport.test.cjs and hevyImport.test.cjs each prove
 * this at the importer level (a real row/workout survives); this suite proves
 * the shared primitive itself, including the shape that has no importer of
 * its own yet — a tab-delimited file with a wrapped cell.
 */
module.exports = [
  {
    name: 'splitCsvRecords: a quoted line break stays inside its record',
    run() {
      const text = 'Day,Exercise,Sets,Reps\nDay 1,"Bench\nPress",4,6-10\nDay 2,Back Squat,4,5';
      const records = splitCsvRecords(text, ',');
      assert.equal(records.length, 3, 'the wrapped cell must not add a phantom record');
      assert.equal(records[1], 'Day 1,"Bench\nPress",4,6-10');
    },
  },
  {
    name: 'splitCsvRecords: an unquoted quote does not swallow the rest of the file',
    run() {
      // A stray inch mark ("6\" box jump") must not flip the scanner into
      // "inside quotes" for every record after it.
      const text = 'A,B\nNotes: 6" box,1\nRow two,2';
      const records = splitCsvRecords(text, ',');
      assert.deepEqual(records, ['A,B', 'Notes: 6" box,1', 'Row two,2']);
    },
  },
  {
    name: 'splitCsvRecords: CRLF, bare CR and bare LF all end a record once',
    run() {
      assert.deepEqual(splitCsvRecords('a,1\r\nb,2', ','), ['a,1', 'b,2']);
      assert.deepEqual(splitCsvRecords('a,1\rb,2', ','), ['a,1', 'b,2']);
      assert.deepEqual(splitCsvRecords('a,1\nb,2', ','), ['a,1', 'b,2']);
    },
  },
  {
    name: 'splitCsvRecords: a space before a quoted field still lets the quote open',
    run() {
      const text = 'a, "line one\nline two",1';
      const records = splitCsvRecords(text, ',');
      assert.equal(records.length, 1, 'the leading space must not stop the quote from opening');
    },
  },
  {
    name: 'splitCsvRecords: works with the semicolon and tab delimiters the importers detect',
    run() {
      assert.deepEqual(splitCsvRecords('a;"x\ny";1\nb;z;2', ';'), ['a;"x\ny";1', 'b;z;2']);
      assert.deepEqual(splitCsvRecords('a\t"x\ny"\t1\nb\tz\t2', '\t'), ['a\t"x\ny"\t1', 'b\tz\t2']);
    },
  },
  {
    name: 'collapseCellWhitespace: a wrapped cell is one name, not two lines of one',
    run() {
      assert.equal(collapseCellWhitespace('Bench\nPress'), 'Bench Press');
      assert.equal(collapseCellWhitespace('  Back   Squat  '), 'Back Squat');
      assert.equal(collapseCellWhitespace('Row\r\nTwo'), 'Row Two');
      assert.equal(collapseCellWhitespace(''), '');
    },
  },
];
