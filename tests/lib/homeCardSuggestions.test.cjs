const assert = require('node:assert/strict');

const { suggestHomeStatCardKeys } = require('../../.test-dist/lib/homeCardSuggestions.js');

const base = { focusAreas: [], goals: [], pinnedKeys: [], dismissedKeys: [] };

module.exports = [
  {
    // Onboarding asks which areas the reader cares about and then nothing on
    // Home ever used the answer.
    name: 'a named focus area becomes its measurement',
    run() {
      assert.deepEqual(suggestHomeStatCardKeys({ ...base, focusAreas: ['chest'] }), ['chest']);
      assert.deepEqual(suggestHomeStatCardKeys({ ...base, focusAreas: ['glutes'] }), ['hips']);
      assert.deepEqual(suggestHomeStatCardKeys({ ...base, focusAreas: ['quads'] }), ['thighs']);
    },
  },
  {
    name: 'two focus areas on the same tape suggest it once',
    run() {
      assert.deepEqual(suggestHomeStatCardKeys({ ...base, focusAreas: ['quads', 'hamstrings'] }), ['thighs']);
    },
  },
  {
    name: 'a growth goal adds the scale, after the areas they named',
    run() {
      assert.deepEqual(
        suggestHomeStatCardKeys({ ...base, focusAreas: ['chest'], goals: ['muscle'] }),
        ['chest', 'bodyweight'],
      );
    },
  },
  {
    // A stronger squat shows in the lift's own card; telling a strength
    // trainee to watch the scale suggests a relationship the app cannot
    // stand behind.
    name: 'strength does not get told to watch the scale',
    run() {
      assert.deepEqual(suggestHomeStatCardKeys({ ...base, goals: ['strength'] }), []);
    },
  },
  {
    name: 'nothing already on Home, and nothing already declined, is offered',
    run() {
      assert.deepEqual(
        suggestHomeStatCardKeys({ ...base, focusAreas: ['chest'], pinnedKeys: ['chest'] }),
        [],
      );
      assert.deepEqual(
        suggestHomeStatCardKeys({ ...base, focusAreas: ['chest'], dismissedKeys: ['chest'] }),
        [],
      );
    },
  },
  {
    name: 'an area with no tape measure suggests nothing rather than guessing',
    run() {
      assert.deepEqual(suggestHomeStatCardKeys({ ...base, focusAreas: ['mobility', 'conditioning'] }), []);
      assert.deepEqual(suggestHomeStatCardKeys({ ...base, goals: [null] }), []);
    },
  },
];
