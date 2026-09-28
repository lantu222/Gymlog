const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  BAR_WEIGHTS_KG,
  barChoiceApplies,
  barChoiceKey,
  normalizeBarChoices,
  openingWeightWithBar,
  switchBar,
  withBarChoice,
} = require('../../.test-dist/lib/barChoice.js');

// #bugs 2026-09-28: "pitäskö olla myös tanko painot esim 20kg ja onkohan
// z-bar 7,5kg ja yks 15kg". Agreed shape (user, same day): three chips under
// the weight, the logged weight stays the total with the bar in it, the choice
// is remembered per lift, and the row shows for bar lifts only.

module.exports = [
  {
    name: 'bar choice: three bars and no others',
    run() {
      assert.deepEqual([...BAR_WEIGHTS_KG], [7.5, 15, 20]);
    },
  },
  {
    name: 'bar choice: the total moves by the difference between bars, and never below zero',
    run() {
      // Plates only, then a Z-bar, then the 20 kg bar instead, then no bar.
      assert.equal(switchBar(20, null, 7.5), 27.5);
      assert.equal(switchBar(27.5, 7.5, 20), 40);
      assert.equal(switchBar(40, 20, null), 20);
      // Same bar again changes nothing; float noise is kept out.
      assert.equal(switchBar(27.5, 7.5, 7.5), 27.5);
      assert.equal(switchBar(27.5, 7.5, null), 20);
      assert.equal(switchBar(5, 20, null), 0);
      assert.equal(switchBar(Number.NaN, null, 15), 15);
    },
  },
  {
    name: 'bar choice: the dial opens on the target, or on the bar when there is no target',
    run() {
      // A target came from a logged total, so the bar is in it already.
      assert.equal(openingWeightWithBar(42.5, 20), 42.5);
      assert.equal(openingWeightWithBar(0, 20), 20);
      assert.equal(openingWeightWithBar(null, 7.5), 7.5);
      assert.equal(openingWeightWithBar(undefined, null), 0);
    },
  },
  {
    name: 'bar choice: the row is for barbell lifts, which in the library include the EZ bar',
    run() {
      assert.equal(barChoiceApplies({ equipment: 'barbell' }), true);
      for (const equipment of ['dumbbell', 'machine', 'cable', 'bodyweight']) {
        assert.equal(barChoiceApplies({ equipment }), false, equipment);
      }
      assert.equal(barChoiceApplies(null), false);
    },
  },
  {
    name: 'bar choice: remembered per lift; stored junk is dropped rather than read',
    run() {
      let choices = withBarChoice({}, 'Barbell Curl', 7.5);
      choices = withBarChoice(choices, 'Bench Press', 20);
      assert.deepEqual(choices, { 'barbell curl': 7.5, 'bench press': 20 });
      assert.equal(barChoiceKey('  Barbell Curl '), 'barbell curl');
      assert.deepEqual(withBarChoice(choices, 'Barbell Curl', null), { 'bench press': 20 });
      assert.deepEqual(withBarChoice(choices, '   ', 15), choices);

      assert.deepEqual(normalizeBarChoices(undefined), {});
      assert.deepEqual(normalizeBarChoices([7.5]), {});
      assert.deepEqual(
        normalizeBarChoices({ 'Bench Press': 20, curl: 25, squat: '20', '': 15, Row: 7.5 }),
        { 'bench press': 20, row: 7.5 },
      );
    },
  },
  {
    name: 'bar choice: an old install loads with no choices, and a stored one survives the load',
    run() {
      const source = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'storage', 'database.ts'), 'utf8');
      assert.match(source, /barChoiceByExercise: normalizeBarChoices\(input\?\.preferences\?\.barChoiceByExercise\),/);
      const seed = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'data', 'seed.ts'), 'utf8');
      assert.match(seed, /barChoiceByExercise: \{\},/);
    },
  },
  {
    name: 'bar choice: the set screen moves the weight by the bar, remembers it, and shows it only for bar lifts',
    run() {
      const root = path.join(__dirname, '..', '..');
      const player = fs.readFileSync(path.join(root, 'src', 'screens', 'GuidedPlayerScreen.tsx'), 'utf8');
      assert.match(player, /const \[kg, setKg\] = useState\(\(\) => openingWeightWithBar\(target\?\.loadKg, barRow \? bar : null\)\);/);
      assert.match(player, /\{barRow && !bodyweight \? \(/);
      assert.match(player, /const next = on \? null : option;/);
      assert.match(player, /setKg\(\(current\) => switchBar\(current, bar, next\)\);\s*setBar\(next\);\s*onBarChoice\?\.\(next\);/);
      assert.match(player, /return lift && barChoiceApplies\(libraryFor\(lift\.exerciseName\)\)/);
      // What is logged is still the dial's number — the total.
      assert.match(player, /onConfirm\(step\.slotId, step\.setIndex, reps, bodyweight \? null : kg\)/);
      const tab = fs.readFileSync(path.join(root, 'src', 'app', 'renderWorkoutTab.tsx'), 'utf8');
      assert.match(tab, /barChoiceByExercise: withBarChoice\(current\.barChoiceByExercise, exerciseName, bar\),/);
    },
  },
];
