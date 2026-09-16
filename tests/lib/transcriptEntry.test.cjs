const assert = require('node:assert/strict');

const {
  LOG_ID_PATTERN,
  logIdFromTranscriptPath,
  randomLogId,
  shapeTranscriptEntry,
  transcriptTimeKey,
} = require('../../.test-dist/lib/aiCoachLogId.js');

const LABEL = '3f2a9c1e-77aa-4b1b-9d10-0c5e2a7b1f00';
const labelled = (day, time, label = LABEL) => `transcripts/${day}/${label}--${time}.json`;
const unlabelled = (day, time) => `transcripts/${day}/${time}-0he6vn.json`;

module.exports = [
  {
    name: 'transcript entry: a minted label is one the server accepts',
    run() {
      for (let index = 0; index < 50; index += 1) {
        assert.match(randomLogId(), LOG_ID_PATTERN);
      }
    },
  },
  {
    name: 'transcript entry: the label comes out of a labelled path, and nothing out of an old one',
    run() {
      assert.equal(logIdFromTranscriptPath(labelled('2026-09-12', '2026-09-12T10-00-00-000Z')), LABEL);
      // Written by the development log before #92: no `--`, no label.
      assert.equal(logIdFromTranscriptPath(unlabelled('2026-09-01', '2026-09-01T10-00-00-000Z')), null);
      // The day segment looks label-shaped but is not followed by `--`.
      assert.equal(logIdFromTranscriptPath('transcripts/2026-09-12/x.json'), null);
      // Something before `--` that the server would never have accepted.
      assert.equal(logIdFromTranscriptPath('transcripts/2026-09-12/..%2F--2026.json'), null);
      assert.equal(logIdFromTranscriptPath(''), null);
    },
  },
  {
    name: 'transcript entry: copies sort by when they were written, not by their label',
    run() {
      // Same day, the later copy has the alphabetically earlier label: a plain
      // sort of the paths put it first, and "the newest twenty" were arbitrary.
      const early = labelled('2026-09-12', '2026-09-12T08-00-00-000Z', 'ffffffff-0000-0000-0000-000000000000');
      const late = labelled('2026-09-12', '2026-09-12T20-00-00-000Z', '00000000-0000-0000-0000-000000000000');
      const older = unlabelled('2026-09-01', '2026-09-01T23-00-00-000Z');
      const nextDay = labelled('2026-09-13', '2026-09-13T00-00-01-000Z');
      const newestFirst = [early, older, nextDay, late].sort((a, b) => {
        const ka = transcriptTimeKey(a);
        const kb = transcriptTimeKey(b);
        return ka < kb ? 1 : ka > kb ? -1 : 0;
      });
      assert.deepEqual(newestFirst, [nextDay, late, early, older]);
    },
  },
  {
    name: 'transcript entry: a stored email never comes back, only the fact that there was one',
    run() {
      const path = labelled('2026-09-12', '2026-09-12T10-00-00-000Z');
      const shaped = shapeTranscriptEntry(path, {
        at: '2026-09-12T10:00:00.000Z',
        kind: 'chat',
        reporter: 'someone@example.com',
        prompt: 'How many sets?',
      });
      assert.equal('reporter' in shaped, false);
      assert.equal(JSON.stringify(shaped).includes('@'), false, 'no address anywhere in the shaped entry');
      assert.equal(shaped.withheld, true);
      assert.equal(shaped.label, LABEL);
      assert.equal(shaped.pathname, path);
      assert.equal(shaped.prompt, 'How many sets?');

      // No email, no mark: a signed-out reader's entry stored `reporter: null`.
      for (const reporter of [null, undefined, '']) {
        const plain = shapeTranscriptEntry(path, { kind: 'chat', reporter });
        assert.equal('withheld' in plain, false, `reporter ${JSON.stringify(reporter)} is not an email`);
        assert.equal('reporter' in plain, false);
      }
    },
  },
  {
    name: 'transcript entry: a stored field cannot stand in for the ones the endpoint sets',
    run() {
      const path = unlabelled('2026-09-01', '2026-09-01T10-00-00-000Z');
      const shaped = shapeTranscriptEntry(path, {
        pathname: 'transcripts/elsewhere.json',
        label: LABEL,
        withheld: true,
        prompt: 'q',
      });
      assert.equal(shaped.pathname, path);
      assert.equal(shaped.label, null);
      assert.equal('withheld' in shaped, false, 'withheld is said by the shaper, never by the store');
    },
  },
  {
    name: 'transcript entry: a stored value that is not an object still shapes',
    run() {
      const path = labelled('2026-09-12', '2026-09-12T10-00-00-000Z');
      for (const stored of [null, 'text', 42, ['a', 'b']]) {
        const shaped = shapeTranscriptEntry(path, stored);
        assert.deepEqual(shaped, { pathname: path, label: LABEL }, `stored ${JSON.stringify(stored)}`);
      }
    },
  },
];
