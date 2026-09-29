const assert = require('node:assert/strict');

const { clampHistoryScrollOffset } = require('../../.test-dist/lib/historyScrollMemory.js');

module.exports = [
  {
    name: 'a remembered offset within the current list is restored unchanged',
    run() {
      // #bugs 2026-09-29: coming back from a session must land where the
      // reader was, not at the top.
      assert.equal(clampHistoryScrollOffset(420, 3000, 800), 420);
    },
  },
  {
    name: 'a remembered offset past the new bottom is clamped, not left wedged past the content',
    run() {
      // The list got shorter — a session was deleted while its detail was
      // open — so the old offset would scroll past the last row.
      assert.equal(clampHistoryScrollOffset(900, 1000, 800), 200);
    },
  },
  {
    name: 'a list shorter than the viewport clamps to the top, never negative',
    run() {
      assert.equal(clampHistoryScrollOffset(500, 400, 800), 0);
    },
  },
  {
    name: 'zero, negative or non-finite offsets stay at the top',
    run() {
      assert.equal(clampHistoryScrollOffset(0, 3000, 800), 0);
      assert.equal(clampHistoryScrollOffset(-40, 3000, 800), 0);
      assert.equal(clampHistoryScrollOffset(Number.NaN, 3000, 800), 0);
    },
  },
];
