const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// api/ is outside the src/ test build, so the reader is guarded at the
// source, as tests/api/aiCoachEndpoint.test.cjs does. Which batches match is
// pure and tested in tests/lib/analyticsRead; this pins that the endpoint
// uses it and how it pages (analytics audit, 2026-09-21). Comments are
// stripped first: the fix quotes the bug it replaced.
const strip = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const source = strip(fs.readFileSync(path.join(__dirname, '../../api/events.ts'), 'utf8'));
const get = source.slice(source.indexOf('async function handleGet('), source.indexOf('export default async function handler('));

module.exports = [
  {
    name: 'events reader: the whole folder is listed, and since is only a lower bound',
    run() {
      assert.ok(get.length > 0, 'handleGet not found');
      // `since` as the prefix read one day and called it "since".
      assert.doesNotMatch(get, /prefix: [^,}]*since/);
      assert.doesNotMatch(get, /`events\/\$\{since\}`/);
      const lists = get.match(/list\(\{[^}]*\}\)/g) ?? [];
      assert.ok(lists.length > 0, 'the reader lists the store');
      for (const call of lists) {
        assert.match(call, /prefix: EVENTS_PREFIX/, `${call} must list the whole folder`);
      }
      assert.match(get, /selectEventBatches\(page\.blobs\.map\(\(blob\) => blob\.pathname\), since\)/);
      assert.match(get, /!ANALYTICS_SINCE_PATTERN\.test\(since\)[\s\S]{0,120}status\(400\)/, 'a malformed since is refused, not ignored');
    },
  },
  {
    name: 'events reader: pages on the store\'s cursor instead of silently keeping the newest, and counts the whole once',
    run() {
      assert.doesNotMatch(get, /slice\(-limit\)/, 'the newest `limit` batches, and nothing said about the rest');
      // One listing call per page, continued from the cursor the last page
      // handed out. Re-listing the folder on every page made a full read cost
      // the square of the batch count in billed calls (review).
      assert.match(get, /const page = await list\(\{ prefix: EVENTS_PREFIX, cursor, limit \}\);/);
      assert.match(get, /next: page\.hasMore && page\.cursor \? page\.cursor : null/);
      // The total is counted on the first page only.
      assert.match(get, /if \(cursor === undefined\) \{\s*total = 0;[\s\S]{0,400}?\} while \(countCursor\);\s*\}/);
      assert.match(get, /\.\.\.\(total !== undefined \? \{ total \} : \{\}\)/);
    },
  },
  {
    name: 'events reader: blobs are read in runs, each inside its own try',
    run() {
      assert.match(get, /for \(const chunk of inChunks\(selected, ANALYTICS_READ_CONCURRENCY\)\)/);
      assert.doesNotMatch(get, /Promise\.all\(\s*selected\.map/);
      // The fetch itself is inside the try: one blob that throws is one
      // unreadable batch, not a 500 for the whole read.
      const read = source.slice(source.indexOf('async function readBatch('), source.indexOf('async function handleGet('));
      assert.match(read, /try \{\s*const stored = await get\(/);
      assert.match(get, /unreadable/);
    },
  },
];
