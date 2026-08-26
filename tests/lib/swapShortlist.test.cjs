const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { buildSwapShortlist, movementHead } = require('../../.test-dist/lib/swapShortlist.js');
const { buildSwapOptionsForSlot } = require('../../.test-dist/lib/tailoringFit.js');

const read = (relative) => fs.readFileSync(path.join(__dirname, '../..', relative), 'utf8');

module.exports = [
  {
    name: 'shortlist: the hip thrust pool becomes a choice instead of a catalogue',
    run() {
      // Nine options, all of them some hip thrust or glute bridge, ranked
      // together — so the machine version could sit fourth behind three
      // bridges, and the actions under the list fell off the sheet
      // (user 2026-08-26).
      const options = buildSwapOptionsForSlot('hip_thrust_bridge', 'Barbell Hip Thrust', null);
      assert.ok(options.length >= 8, `the pool itself is still large: ${options.length}`);

      const shortlist = buildSwapShortlist('Barbell Hip Thrust', options);
      assert.ok(shortlist.total <= options.length);
      assert.ok(shortlist.variations.length <= 3);
      assert.ok(shortlist.related.length <= 3);
      assert.ok(shortlist.variations.length + shortlist.related.length <= 6, 'six rows at the very most');

      // Same movement, different kit.
      for (const option of shortlist.variations) {
        assert.match(option.exerciseName, /Hip Thrust/i, `${option.exerciseName} is not a hip thrust`);
      }
      // Same area, different movement.
      for (const option of shortlist.related) {
        assert.doesNotMatch(option.exerciseName, /Hip Thrust/i);
      }
      // The one the reader went looking for is in the half where they would
      // look for it.
      assert.ok(
        shortlist.variations.some((option) => option.exerciseName === 'Machine Hip Thrust'),
        shortlist.variations.map((option) => option.exerciseName).join(', '),
      );
    },
  },
  {
    name: 'shortlist: the head is the movement, and the qualifiers are the kit',
    run() {
      assert.equal(movementHead('Barbell Hip Thrust'), 'hip thrust');
      assert.equal(movementHead('Machine Hip Thrust'), 'hip thrust');
      assert.equal(movementHead('Single-Leg Hip Thrust'), 'hip thrust');
      assert.equal(movementHead('Hip Thrust (Bodyweight or Light Bar)'), 'hip thrust');
      // A different movement stays different, however similar the area.
      assert.equal(movementHead('Glute Bridge Hold'), 'glute bridge hold');
      assert.notEqual(movementHead('Banded Glute Bridge'), movementHead('Banded Hip Thrust'));
    },
  },
  {
    name: 'shortlist: the same lift written two ways is one row',
    run() {
      // The pool carries both spellings because the catalogs were imported
      // separately; two rows that do the same thing is not a choice.
      const shortlist = buildSwapShortlist('Barbell Hip Thrust', [
        { exerciseName: 'Glute Bridge (Banded)', reason: null, score: 5 },
        { exerciseName: 'Banded Glute Bridge', reason: null, score: 4 },
        { exerciseName: 'Glute Bridge Hold', reason: null, score: 3 },
      ]);
      assert.deepEqual(
        shortlist.related.map((option) => option.exerciseName),
        // First wins, so the tailoring pass's ranking picks the spelling.
        ['Glute Bridge (Banded)', 'Glute Bridge Hold'],
      );
      // A word the others do not have makes it a different lift, not a respelling.
      assert.equal(shortlist.total, 2);
    },
  },
  {
    name: 'shortlist: a lift the session already holds is not offered as a change',
    run() {
      // The pool offered "taljapotku" for a slot in a session that already had
      // taljapotku two rows down (#bugs 2026-08-26). Swapping to it means doing
      // the same exercise twice and calling it a change.
      const options = [
        { exerciseName: 'Cable Kickback', reason: null, score: 5 },
        { exerciseName: 'Frog Pump', reason: null, score: 4 },
      ];
      const shortlist = buildSwapShortlist('Barbell Hip Thrust', options, {
        // Matched on identity, so the other spelling counts too.
        alreadyInSession: ['Kickback Cable'],
      });
      const names = [...shortlist.variations, ...shortlist.related].map((o) => o.exerciseName);
      assert.deepEqual(names, ['Frog Pump']);
    },
  },
  {
    name: 'shortlist: search reaches past the six rows, in the language the reader types',
    run() {
      // The shortlist is deliberately short and the pool behind it is not. A
      // reader who knows what they want should not have to be offered it.
      const options = [
        { exerciseName: 'Cable Kickback', searchLabel: 'Taljapotku', reason: null, score: 5 },
        { exerciseName: 'Frog Pump', searchLabel: 'Sammakkopumppu', reason: null, score: 4 },
      ];
      const byFinnish = buildSwapShortlist('Barbell Hip Thrust', options, { query: 'talja' });
      assert.deepEqual(byFinnish.related.map((o) => o.exerciseName), ['Cable Kickback']);
      // The English name still matches, since that is what the pool stores.
      const byEnglish = buildSwapShortlist('Barbell Hip Thrust', options, { query: 'frog' });
      assert.deepEqual(byEnglish.related.map((o) => o.exerciseName), ['Frog Pump']);
      // An empty query changes nothing.
      assert.equal(buildSwapShortlist('Barbell Hip Thrust', options, { query: '  ' }).total, 2);
    },
  },
  {
    name: 'shortlist: a movement with no siblings still offers a full list',
    run() {
      // Cutting related lifts to three when there are no variations to pair
      // them with would hide choices for the sake of symmetry.
      const options = [
        { exerciseName: 'Romanian Deadlift', reason: null, score: 5 },
        { exerciseName: 'Trap Bar Deadlift', reason: null, score: 4 },
        { exerciseName: 'Hip Thrust', reason: null, score: 3 },
        { exerciseName: 'Cable Pull-Through', reason: null, score: 2 },
        { exerciseName: 'Single-Leg RDL', reason: null, score: 1 },
      ];
      const shortlist = buildSwapShortlist('Good Morning', options);
      assert.equal(shortlist.variations.length, 0);
      assert.equal(shortlist.related.length, 5);
      // Ranking is left exactly as the tailoring pass made it — re-sorting here
      // would be a second opinion competing with the one that weighs equipment
      // and joints.
      assert.deepEqual(
        shortlist.related.map((option) => option.exerciseName),
        options.map((option) => option.exerciseName),
      );
    },
  },
  {
    name: 'sheets: the list scrolls under a ceiling so the actions stay reachable',
    run() {
      const home = read('src/screens/HomeScreen.tsx');
      const day = read('src/screens/ProgramDayScreen.tsx');

      // With nine rows the sheet grew past the screen and "Poista ohjelmasta"
      // could not be pressed at all.
      assert.match(home, /adaptOptsScroll: \{\s*\n\s*maxHeight: 300,/);
      assert.match(home, /<ScrollView style=\{styles\.adaptOptsScroll\}/);
      for (const source of [home, day]) {
        assert.match(source, /buildSwapShortlist\(/);
        // Headings only when both halves exist: one heading over the whole
        // list labels nothing.
        assert.match(source, /shortlist\.variations\.length[\s\S]{0,80}shortlist\.related\.length/);
      }
    },
  },
  {
    name: 'sheets: the two answers are told apart by colour, and by the right two colours',
    run() {
      const home = read('src/screens/HomeScreen.tsx');
      const day = read('src/screens/ProgramDayScreen.tsx');
      // Orange is the app's "you can press this"; red is the one that does not
      // come back. Using theme tokens, never literals — the app has two themes.
      assert.match(home, /adaptDropTextToday: \{ color: theme\.highlight \}/);
      assert.match(home, /adaptDropTextRemove: \{ color: theme\.danger \}/);
      assert.match(day, /styles\.swapRemoveText, \{ color: theme\.danger \}/);
      for (const source of [home, day]) {
        assert.doesNotMatch(source, /color: '#(?:ff0000|f00)'/i, 'a literal red would ignore the dark theme');
      }
    },
  },
];
