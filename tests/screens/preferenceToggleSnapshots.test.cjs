const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..', '..');
const read = (...segments) => fs.readFileSync(path.join(root, ...segments), 'utf8').replace(/\r\n/g, '\n');
const strip = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

/**
 * A write that folds one change into a list or map of preferences builds it
 * from the stored preferences (`updatePreferences((current) => …)`), not from
 * the render the handler closed over. Built from the render, two changes in
 * quick succession both start from the same snapshot and the second puts the
 * first back — the technique checklist lost ticks that way (audit 7), and the
 * notification switches, drill swaps, dismissed suggestions and goal removals
 * had the same shape (2026-09-26).
 */
const KEYS = [
  'notificationPrefs',
  'routineDrillOverrides',
  'dismissedCardSuggestionKeys',
  'coachSuggestionState',
  'strengthGoals',
  'exerciseTechniqueChecks',
  'learnedExerciseLibraryItemIds',
];

module.exports = [
  {
    name: 'preference toggles fold into the stored value, not the render\'s snapshot',
    run() {
      const files = [
        'App.tsx',
        ...fs.readdirSync(path.join(root, 'src', 'app')).filter((name) => /\.tsx?$/.test(name)).map((name) => `src/app/${name}`),
      ];
      const offenders = [];
      for (const file of files) {
        const source = strip(read(...file.split('/')));
        for (const key of KEYS) {
          // `updatePreferences({ key: …preferences.key…` within the same patch.
          const pattern = new RegExp(`updatePreferences\\(\\{\\s*${key}:[^}]{0,200}?preferences\\.${key}\\b`, 'g');
          for (const hit of source.match(pattern) ?? []) {
            offenders.push(`${file}: ${hit.replace(/\s+/g, ' ').slice(0, 90)}`);
          }
        }
      }
      assert.deepEqual(offenders, []);

      const profile = strip(read('src', 'app', 'renderProfileTab.tsx'));
      assert.match(
        profile,
        /updatePreferences\(\(current\) => \(\{ notificationPrefs: \{ \.\.\.current\.notificationPrefs, \.\.\.patch \} \}\)\)/,
      );
    },
  },
];
