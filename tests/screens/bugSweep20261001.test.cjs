const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

/**
 * The bug lists from the App.tsx split (#bugs 2026-10-01): small wiring
 * faults in src/app hooks, pinned where they were fixed. No React renderer
 * lives in this suite, so each is checked against the source, the way the
 * other src/app tests here are.
 */
const read = (...parts) => fs.readFileSync(path.join(__dirname, '..', '..', ...parts), 'utf8');

module.exports = [
  {
    name: 'recovery: rest-day writes read the stored list, so two quick taps keep both',
    run() {
      const source = read('src', 'app', 'useRecoverySheet.ts');
      assert.match(source, /updatePreferences\(\(current\) => \(\{\s*restDayStarts: withRestDay\(current\.restDayStarts,/);
      assert.match(source, /\(current\) => \(\{ restDayStarts: withoutRestDay\(current\.restDayStarts,/);
      // No write from the render's snapshot is left.
      assert.doesNotMatch(source, /withRestDay\(preferences\.restDayStarts|withoutRestDay\(preferences\.restDayStarts/);
    },
  },
  {
    name: 'coach: the training context is rebuilt when only the age band changes',
    run() {
      const source = read('src', 'app', 'useCoachContext.ts');
      assert.match(source, /ageRange: preferences\.setupAgeRange,/);
      assert.match(source, /preferences\.setupAge,\s*(\/\/[^\n]*\n\s*)*preferences\.setupAgeRange,/);
    },
  },
  {
    name: 'idle nudge: a renamed workout reaches the reminder without waiting for a set',
    run() {
      const source = read('src', 'app', 'useSessionNotifications.ts');
      assert.match(source, /activityTick,\s*(\/\/[^\n]*\n\s*)*workout\.activeSession\?\.templateName,/);
    },
  },
];
