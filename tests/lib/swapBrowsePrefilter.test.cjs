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
  {
    /**
     * Device, 2026-09-30: swapping the bench press, the chest list opened on
     * a kettlebell floor press above the incline bench — popularity alone.
     * Nearest is the same kit first, then the same kind of lift, and
     * popularity only breaks the ties.
     */
    name: 'the swap list puts the lift nearest the one being swapped first',
    run() {
      const { orderSwapCandidates } = require('../../.test-dist/lib/swapBrowsePrefilter.js');
      const bench = { id: 'bench', category: 'compound', equipment: 'barbell' };
      const pool = [
        { id: 'kb-floor', category: 'compound', equipment: 'dumbbells', sourceEquipment: 'kettlebells' },
        { id: 'db-fly', category: 'isolation', equipment: 'dumbbells' },
        { id: 'incline', category: 'compound', equipment: 'barbell' },
        { id: 'bar-iso', category: 'isolation', equipment: 'barbell' },
        { id: 'db-press', category: 'compound', equipment: 'dumbbells' },
      ];
      // Most popular first by the library's own order: the kettlebell press,
      // then the fly — the order the list used to show.
      const popular = new Map([
        ['kb-floor', 0],
        ['db-fly', 1],
        ['db-press', 2],
        ['incline', 3],
        ['bar-iso', 4],
      ]);
      assert.deepEqual(
        orderSwapCandidates(pool, bench, popular).map((item) => item.id),
        // Same bar and kind; same bar; same kind (popular first); neither.
        ['incline', 'bar-iso', 'kb-floor', 'db-press', 'db-fly'],
      );
      // Equipment is read as the row prints it: a kettlebell row filed under
      // dumbbells is not a dumbbell match.
      const dbPress = { id: 'x', category: 'compound', equipment: 'dumbbells' };
      assert.equal(orderSwapCandidates(pool, dbPress, popular)[0].id, 'db-press');
      // Nothing to be near: popularity alone, as before.
      assert.deepEqual(
        orderSwapCandidates(pool, null, popular).map((item) => item.id),
        ['kb-floor', 'db-fly', 'db-press', 'incline', 'bar-iso'],
      );
      // The input is not reordered in place.
      assert.equal(pool[0].id, 'kb-floor');
    },
  },
  {
    name: 'the swap sheet offers what can be logged, and uses the nearest order',
    run() {
      const fs = require('node:fs');
      const path = require('node:path');
      const player = fs
        .readFileSync(path.join(__dirname, '..', '..', 'src', 'screens', 'GuidedPlayerScreen.tsx'), 'utf8')
        .replace(/\r\n/g, '\n');
      // Stretches and drills out until the reader types, like the add sheet.
      assert.match(player, /const pool = filterBrowsableExercises\(exerciseLibrary, \{ query \}\)\.filter\(/);
      assert.match(player, /orderSwapCandidates\(pool, swapCurrentLibraryItem, popular\)/);
    },
  },
];
