const assert = require('node:assert/strict');

const { resolveSwapBrowsePrefilter } = require('../../.test-dist/lib/swapBrowsePrefilter.js');

module.exports = [
  {
    name: 'the swap sheet\'s browse opens on the exercise\'s own body part',
    run() {
      assert.equal(resolveSwapBrowsePrefilter({ bodyPart: 'chest', primaryMuscles: ['chest'] }), 'chest');
      assert.equal(resolveSwapBrowsePrefilter({ bodyPart: 'back', primaryMuscles: ['lats'] }), 'back');
    },
  },
  {
    name: 'a leg exercise opens on its muscle chip, not the whole "legs" bucket',
    run() {
      assert.equal(
        resolveSwapBrowsePrefilter({ bodyPart: 'legs', primaryMuscles: ['hamstrings'] }),
        'hamstrings',
      );
      assert.equal(
        resolveSwapBrowsePrefilter({ bodyPart: 'legs', primaryMuscles: ['quadriceps'] }),
        'quadriceps',
      );
      assert.equal(resolveSwapBrowsePrefilter({ bodyPart: 'legs', primaryMuscles: ['calves'] }), 'calves');
      // A leg exercise whose primary muscle is not one of the three chips
      // (glutes has its own top-level chip already) falls back to "legs"
      // rather than a chip that does not exist.
      assert.equal(resolveSwapBrowsePrefilter({ bodyPart: 'legs', primaryMuscles: ['glutes'] }), 'legs');
      assert.equal(resolveSwapBrowsePrefilter({ bodyPart: 'legs', primaryMuscles: [] }), 'legs');
    },
  },
  {
    name: 'no library row for the current exercise browses everything, unfiltered',
    run() {
      assert.equal(resolveSwapBrowsePrefilter(null), 'all');
      assert.equal(resolveSwapBrowsePrefilter(undefined), 'all');
    },
  },
];
