const assert = require('node:assert/strict');

const { buildExerciseSearchHaystack, exerciseMatchesQuery, rankExerciseMatches } = require('../../.test-dist/lib/exerciseSearch.js');
const { exerciseNameLabel } = require('../../.test-dist/lib/exerciseNameLabel.js');
const library = Object.values(require('../../.test-dist/data/generatedExerciseLibrary.js'))[0];

function search(query, language = 'fi') {
  return library.filter((item) => exerciseMatchesQuery(buildExerciseSearchHaystack(item, language), query));
}

module.exports = [
  {
    name: 'a Finnish search finds the lifts the Finnish screen shows',
    run() {
      // Seen on a phone: the library listed "Takakyykky", the search box got
      // "kyykky", and the result was "Ei osumia". The haystack was English only.
      const squats = search('kyykky');
      assert.ok(squats.length >= 5, `"kyykky" found ${squats.length}`);
      assert.ok(squats.some((item) => item.name === 'Barbell Full Squat'), 'the squat the app calls Takakyykky is missing');

      const bench = search('penkkipunnerrus');
      assert.ok(bench.some((item) => item.name === 'Barbell Bench Press - Medium Grip'));
    },
  },
  {
    name: 'the English name still matches, and so do the translated facets',
    run() {
      assert.ok(search('squat', 'fi').length >= 5, 'English term stopped matching under Finnish');
      // "rinta" is what the chip and the row say for chest; the data says
      // "chest". Both have to work.
      const chest = search('rinta');
      assert.ok(chest.length >= 20, `"rinta" found ${chest.length}`);
      assert.ok(chest.every((item) => buildExerciseSearchHaystack(item, 'fi').includes('rinta')));
    },
  },
  {
    name: 'every term has to land, so a two-word query narrows',
    run() {
      const both = search('kyykky tanko');
      const one = search('kyykky');
      assert.ok(both.length > 0 && both.length < one.length, `${both.length} vs ${one.length}`);
      assert.equal(exerciseMatchesQuery('barbell full squat takakyykky', '  '), true);
      assert.equal(exerciseMatchesQuery('barbell full squat', 'kyykky'), false);
    },
  },
  {
    name: 'the lift itself comes before its variants: "ylätal" answers with Ylätalja',
    run() {
      // #bugs 2026-08-28, "haluisin vain ylätalja — huonot suositukset": the
      // matches came in the English name's alphabetical order, so Kapea
      // ylätalja and Soutu ylätaljasta korokkeelta led and the plain lat
      // pulldown was twelfth of thirteen.
      const ranked = rankExerciseMatches(library, 'ylätal', 'fi');
      assert.ok(ranked.length >= 10, `found ${ranked.length}`);
      assert.equal(ranked[0].name, 'Wide-Grip Lat Pulldown');
      assert.equal(exerciseNameLabel('fi', ranked[0].name), 'Ylätalja');
      // Names that BEGIN with the query outrank names that merely carry it
      // in a later word — the biceps curl "Hauiskääntö ylätaljassa" is a
      // real match, but it is not what "ylätal" is asking for.
      const names = ranked.map((item) => exerciseNameLabel('fi', item.name));
      const starts = names.filter((name) => name.toLowerCase().startsWith('ylätal'));
      assert.ok(starts.length >= 3, `expected several names starting with the query, got ${starts.length}`);
      assert.deepEqual(names.slice(0, starts.length), starts);
      assert.ok(names.indexOf('Hauiskääntö ylätaljassa') > names.indexOf('Ylätalja V-kahvalla'));

      // Same rule in English: "lat pull" answers with Lat Pulldown.
      const en = rankExerciseMatches(library, 'lat pull', 'en');
      assert.equal(en[0].name, 'Wide-Grip Lat Pulldown');
      // The exact stored name wins outright, whatever the language.
      assert.equal(rankExerciseMatches(library, 'Barbell Full Squat', 'fi')[0].name, 'Barbell Full Squat');
      // Within a rank, popularity breaks the tie before length: "penkki" is
      // the bench press, not the bench dip that happens to be shorter.
      const { getPopularExerciseLibraryOrder } = require('../../.test-dist/lib/exerciseSuggestions.js');
      const order = getPopularExerciseLibraryOrder(library);
      const penkki = rankExerciseMatches(library, 'penkki', 'fi', (item) => order.get(item.id));
      assert.equal(exerciseNameLabel('fi', penkki[0].name), 'Penkkipunnerrus');
      assert.equal(exerciseNameLabel('fi', rankExerciseMatches(library, 'penkki', 'fi')[0].name), 'Penkkidippi', 'without popularity the shorter name leads');
      // No query: the caller's order, untouched.
      assert.deepEqual(rankExerciseMatches(library.slice(0, 5), '  ', 'fi').map((i) => i.name), library.slice(0, 5).map((i) => i.name));
    },
  },
];
