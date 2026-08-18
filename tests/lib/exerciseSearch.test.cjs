const assert = require('node:assert/strict');

const { buildExerciseSearchHaystack, exerciseMatchesQuery } = require('../../.test-dist/lib/exerciseSearch.js');
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
];
