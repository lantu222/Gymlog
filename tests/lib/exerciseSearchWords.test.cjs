const assert = require('node:assert/strict');

const {
  buildExerciseSearchHaystack,
  exerciseMatchesQuery,
  normalizeSearchText,
  rankExerciseMatches,
} = require('../../.test-dist/lib/exerciseSearch.js');
const { exerciseNameLabel } = require('../../.test-dist/lib/exerciseNameLabel.js');
const { buildSwapLibraryMatches, buildSwapShortlist, sessionLiftsMatchingQuery } = require('../../.test-dist/lib/swapShortlist.js');
const { getPopularExerciseLibraryOrder } = require('../../.test-dist/lib/exerciseSuggestions.js');
const library = Object.values(require('../../.test-dist/data/generatedExerciseLibrary.js'))[0];

// The phone, 2026-09-27 (#bugs): "Eikö ole yläpenkkiä?", "jokainen väli pitää
// olla oikein muuten ei löydä", "voisiko lihasryhmittäin hakea",
// "Penkkipunnerrus ketjuilla" listed twice, and "miksi penkkipunnerrus ei ole
// liike?" — it was already in the session.

const popular = getPopularExerciseLibraryOrder(library);
const labels = (query) =>
  buildSwapLibraryMatches(library, query, 'fi', { popularOrder: popular }).map((item) => exerciseNameLabel('fi', item.name));
const matches = (query) =>
  library.filter((item) => exerciseMatchesQuery(buildExerciseSearchHaystack(item, 'fi'), query));

module.exports = [
  {
    name: 'search text folds case, ä/ö and punctuation, so spacing and dashes stop mattering',
    run() {
      assert.equal(normalizeSearchText('  Trap bar -maastaveto '), 'trap bar maastaveto');
      assert.equal(normalizeSearchText('Ylä–Penkki (KP)'), 'yla penkki kp');
      assert.equal(normalizeSearchText('Olkapää'), 'olkapaa');
      // A keyboard without ä still finds "Ylätalja".
      assert.equal(labels('ylatalja')[0], 'Ylätalja');
      // The query's own spaces are optional…
      assert.ok(labels('penkki punnerrus').includes('Penkkipunnerrus'));
      assert.ok(labels('trap bar').includes('Trap bar -maastaveto'));
      // …but the haystack's are not joined: a term never matches across two
      // of its words ("…bar in ta…" is not "rinta").
      assert.ok(matches('rinta').every((item) => normalizeSearchText(buildExerciseSearchHaystack(item, 'fi')).includes('rinta')));
    },
  },
  {
    name: 'the gym\'s own words find the lifts the library names otherwise',
    run() {
      assert.equal(labels('Yläpenkki')[0], 'Vinopenkkipunnerrus');
      assert.ok(labels('yläpenkki kp').includes('Vinopenkkipunnerrus käsipainoilla'));
      assert.ok(labels('alapenkki').some((label) => label.startsWith('Laskeva penkkipunnerrus')));
      assert.equal(labels('mave')[0], 'Maastaveto');
      assert.ok(labels('leuka').includes('Leuanveto'));
      // An alias widens a term; it does not replace the plain match.
      assert.ok(labels('vinopenkki').includes('Vinopenkkipunnerrus'));
    },
  },
  {
    name: 'a muscle named by the start of its word brings its main lifts first, and names beat muscles after that',
    run() {
      assert.equal(labels('Olkap')[0], 'Pystypunnerrus');
      assert.equal(labels('rinta')[0], 'Penkkipunnerrus');
      // "hauis" is the curls before a forearm roller that happens to train it.
      const curls = labels('hauis');
      assert.ok(curls.slice(0, 5).every((label) => /hauis|kääntö/i.test(label)), curls.join(' | '));
    },
  },
  {
    name: 'one row per name the reader sees',
    run() {
      const chains = labels('penkkipunnerrus ketjuilla').filter((label) => label === 'Penkkipunnerrus ketjuilla');
      assert.equal(chains.length, 1);
      const ranked = rankExerciseMatches(library, 'penkkipunnerrus', 'fi').map((item) => exerciseNameLabel('fi', item.name));
      assert.equal(new Set(ranked).size, ranked.length, 'a label repeated in the ranked list');
    },
  },
  {
    name: 'the slot\'s own shortlist searches the same way as the library',
    run() {
      const options = [
        { exerciseName: 'Incline Dumbbell Press', searchLabel: 'Vinopenkkipunnerrus käsipainoilla', score: 1, reason: null },
        { exerciseName: 'Dumbbell Bench Press', searchLabel: 'Penkkipunnerrus käsipainoilla', score: 1, reason: null },
      ];
      // Two words, any order: this list took the query as one exact run.
      const found = buildSwapShortlist('Barbell Bench Press - Medium Grip', options, { query: 'käsipainoilla vinopenkki' });
      assert.deepEqual(
        [...found.variations, ...found.related].map((option) => option.exerciseName),
        ['Incline Dumbbell Press'],
      );
      const alias = buildSwapShortlist('Barbell Bench Press - Medium Grip', options, { query: 'yläpenkki kp' });
      assert.equal([...alias.variations, ...alias.related].length, 1);
    },
  },
  {
    name: 'a lift the search hits but the session already holds is named, never silently missing',
    run() {
      const session = ['Barbell Bench Press - Medium Grip', 'Smith Machine Bench Press', 'Standing Military Press'];
      assert.deepEqual(
        sessionLiftsMatchingQuery(session, 'Smith Machine Bench Press', 'penkkipunnerrus', 'fi'),
        [exerciseNameLabel('fi', 'Barbell Bench Press - Medium Grip')],
      );
      // The lift being swapped is the sheet's own title, not a hit.
      assert.deepEqual(sessionLiftsMatchingQuery(session, 'Standing Military Press', 'pysty', 'fi'), []);
      // Nothing typed, nothing named; a row with no name is skipped, not thrown on.
      assert.deepEqual(sessionLiftsMatchingQuery(session, 'Smith Machine Bench Press', '  ', 'fi'), []);
      assert.deepEqual(sessionLiftsMatchingQuery([undefined, 'Deadlift'], 'Deadlift', 'mave', 'fi'), []);
    },
  },
  {
    name: 'a session lift is left out of the library by the name the reader sees, not only by its stored words',
    run() {
      // The session stores "Bench Press"; the library row is "Barbell Bench
      // Press - Medium Grip". Both read "Penkkipunnerrus".
      assert.equal(exerciseNameLabel('fi', 'Bench Press'), exerciseNameLabel('fi', 'Barbell Bench Press - Medium Grip'));
      const found = buildSwapLibraryMatches(library, 'penkkipunnerrus', 'fi', {
        exclude: ['Chest-Supported Row', 'Bench Press'],
        popularOrder: popular,
      }).map((item) => exerciseNameLabel('fi', item.name));
      assert.ok(!found.includes('Penkkipunnerrus'), found.join(' | '));
      assert.ok(found.includes('Penkkipunnerrus käsipainoilla'));
    },
  },
  {
    name: 'a row with no name renders as nothing instead of throwing mid-search',
    run() {
      assert.equal(exerciseNameLabel('fi', undefined), '');
      assert.equal(exerciseNameLabel('en', null), '');
    },
  },
];
