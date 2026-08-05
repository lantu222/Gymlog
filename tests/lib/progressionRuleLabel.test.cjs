const assert = require('node:assert/strict');

const { progressionRuleLabel } = require('../../.test-dist/lib/progressionRuleLabel.js');
const { WORKOUT_TEMPLATES_V1 } = require('../../.test-dist/features/workout/workoutCatalog');

const KEYS = ['primary', 'secondary', 'accessory', 'failureHandling'];

module.exports = [
  {
    name: 'every progression rule in the catalog has a Finnish sentence',
    run() {
      // These are the most useful prose in the whole catalog — how the anchor
      // climbs, what to do when the reps do not come — and the app never
      // showed one because they were English. A rule that slips through
      // untranslated puts English back on a Finnish screen.
      const untranslated = new Set();
      for (const template of WORKOUT_TEMPLATES_V1) {
        for (const key of KEYS) {
          const rule = template.progressionRules[key];
          if (progressionRuleLabel('fi', rule) === rule) {
            untranslated.add(`${template.id}.${key}`);
          }
        }
      }
      assert.equal(
        untranslated.size,
        0,
        `untranslated rules: ${[...untranslated].slice(0, 5).join(', ')}`,
      );
    },
  },
  {
    name: 'English passes through, and an unknown rule reads rather than vanishes',
    run() {
      const rule = WORKOUT_TEMPLATES_V1[0].progressionRules.primary;
      assert.equal(progressionRuleLabel('en', rule), rule);
      // Blank would be worse than English: a rule added tomorrow is readable
      // until someone translates it.
      assert.equal(progressionRuleLabel('fi', 'A brand new rule.'), 'A brand new rule.');
    },
  },
];
