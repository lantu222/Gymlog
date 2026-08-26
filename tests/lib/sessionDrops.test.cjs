const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  applySessionAdaptation,
  hasSessionAdaptation,
  EMPTY_SESSION_ADAPTATION,
} = require('../../.test-dist/lib/sessionAdaptation.js');

const read = (relative) => fs.readFileSync(path.join(__dirname, '../..', relative), 'utf8');

function template() {
  return {
    id: 'tpl',
    name: 'Lower',
    sessions: [
      {
        id: 'day1',
        name: 'Lower',
        exercises: [
          { slotId: 'primary_1', exerciseName: 'Barbell Hip Thrust', role: 'primary', sets: 4 },
          { slotId: 'secondary_2', exerciseName: 'Bulgarian Split Squat', role: 'secondary', sets: 3 },
          { slotId: 'accessory_3', exerciseName: 'Leg Curl', role: 'accessory', sets: 3 },
        ],
      },
    ],
  };
}

module.exports = [
  {
    name: 'drops: a slot left out today is gone from the session that starts',
    run() {
      const adapted = applySessionAdaptation(template(), {
        ...EMPTY_SESSION_ADAPTATION,
        drops: ['secondary_2'],
      });
      const slots = adapted.sessions[0].exercises.map((exercise) => exercise.slotId);
      assert.deepEqual(slots, ['primary_1', 'accessory_3']);
      // The source template is not touched — the programme is edited from its
      // own page, and today's answer must not rewrite it.
      assert.equal(template().sessions[0].exercises.length, 3);
    },
  },
  {
    name: 'drops: a drop counts as an adaptation, so it is not silently discarded',
    run() {
      // hasSessionAdaptation gates the whole apply. Forgetting drops here
      // would return the template untouched and the row would come back at
      // the moment the session started.
      assert.equal(hasSessionAdaptation({ swaps: {}, drops: ['a'], trimSets: false }), true);
      assert.equal(hasSessionAdaptation(EMPTY_SESSION_ADAPTATION), false);
      // An older caller that predates the field must not throw.
      assert.equal(hasSessionAdaptation({ swaps: {}, trimSets: false }), false);
      assert.doesNotThrow(() => applySessionAdaptation(template(), { swaps: { primary_1: 'Machine Hip Thrust' }, trimSets: false }));
    },
  },
  {
    name: 'drops: a trim shares its sets among what is left, not among what was dropped',
    run() {
      const adapted = applySessionAdaptation(template(), {
        swaps: {},
        drops: ['accessory_3'],
        trimSets: true,
      });
      const remaining = adapted.sessions[0].exercises;
      assert.deepEqual(remaining.map((exercise) => exercise.slotId), ['primary_1', 'secondary_2']);
      // Trimming an exercise nobody will do spends the budget on nothing and
      // leaves the session as long as it was.
      const total = remaining.reduce((sum, exercise) => sum + exercise.sets, 0);
      assert.ok(total < 7, `expected the remaining two to lose a set, got ${total}`);
    },
  },
  {
    name: 'drops: swaps and drops are spent together when the session starts',
    run() {
      const wiring = require('../helpers/appWiringSource.cjs').readAppWiring();
      // Both are answers about today. Clearing one and keeping the other would
      // carry a stale decision into the next session.
      assert.match(wiring, /setSessionSwaps\(\{\}\);\s*\n\s*setSessionDrops\(\[\]\);/);
      assert.match(wiring, /\{ swaps: sessionSwaps, drops: sessionDrops, trimSets \}/);
      // Dropping twice must not stack the same slot.
      assert.match(wiring, /current\.includes\(slotId\) \? current : \[\.\.\.current, slotId\]/);
    },
  },
  {
    name: 'home: the whole exercise row opens the sheet, and a dropped row can be put back',
    run() {
      const home = read('src/screens/HomeScreen.tsx');
      // The reader tapped the name — the part that says what the row is — and
      // nothing happened, because only the 15dp glyph was pressable.
      assert.match(home, /<Pressable\s*\n\s*key=\{`\$\{exercise\.name\}-\$\{index\}`\}/);
      assert.match(home, /onPress=\{\(\) => setSwapSlotId\(exercise\.slotId \?\? null\)\}/);
      // A row that vanishes takes its own undo with it.
      assert.match(home, /planExerciseDropped/);
      assert.match(home, /textDecorationLine: 'line-through'/);
      assert.match(home, /onRestoreSessionExercise\?\.\(swapSlotId\)/);
      assert.match(home, /onDropSessionExercise\?\.\(swapSlotId\)/);
      // The sheet must say the scope out loud: this is today, not the plan.
      assert.match(home, /home\.swapSheet\.dropNote/);
      const fi = read('src/lib/i18n.ts');
      assert.match(fi, /'home\.swapSheet\.dropNote': 'Vain tälle kerralle\. Ohjelmasi pysyy ennallaan\.'/);
    },
  },
];
