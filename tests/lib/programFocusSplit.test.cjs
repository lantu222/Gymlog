const assert = require('node:assert/strict');

const {
  buildProgramFocusSplit,
  PROGRAM_FOCUS_COLORS,
} = require('../../.test-dist/lib/programFocusSplit');

function session(name, exercises) {
  return {
    id: name,
    name,
    orderIndex: 0,
    exercises: exercises.map(([exerciseName, sets], index) => ({
      id: `${name}-${index}`,
      exerciseName,
      slotId: `slot-${index}`,
      role: 'primary',
      progressionPriority: 'high',
      trackingMode: 'load_and_reps',
      sets,
      repsMin: 8,
      repsMax: 12,
      restSecondsMin: 60,
      restSecondsMax: 120,
      substitutionGroup: 'none',
    })),
  };
}

module.exports = [
  {
    name: 'programFocusSplit: percentages come from set-weighted composition and sum to 100',
    run() {
      const split = buildProgramFocusSplit([
        session('Day 1', [
          ['Barbell Bench Press', 3],
          ['Back Squat', 3],
          ['Rowing Intervals', 4],
          ['Hip Flexor Stretch', 2],
        ]),
      ]);

      assert.deepEqual(
        split.map((segment) => segment.quality),
        ['Strength', 'Conditioning', 'Mobility'],
      );
      assert.equal(split.reduce((sum, segment) => sum + segment.pct, 0), 100);
      // 6 / 4 / 2 of 12 sets = 50 / 33.3 / 16.7
      assert.equal(split[0].pct, 50);
      assert.equal(split[1].pct, 33);
      assert.equal(split[2].pct, 17);
    },
  },
  {
    name: 'programFocusSplit: strength-only program omits missing qualities',
    run() {
      const split = buildProgramFocusSplit([
        session('Day 1', [
          ['Deadlift', 3],
          ['Overhead Press', 3],
        ]),
      ]);

      assert.deepEqual(split, [{ quality: 'Strength', pct: 100 }]);
    },
  },
  {
    name: 'programFocusSplit: walking lunge is strength, farmer carry and jumps are conditioning',
    run() {
      const split = buildProgramFocusSplit([
        session('Day 1', [
          ['Walking Lunge', 5],
          ["Farmer's Carry", 3],
          ['Box Jump', 2],
        ]),
      ]);

      assert.deepEqual(
        split.map((segment) => segment.quality),
        ['Strength', 'Conditioning'],
      );
      assert.equal(split[0].pct, 50);
      assert.equal(split[1].pct, 50);
    },
  },
  {
    name: 'programFocusSplit: empty program falls back to full strength, colors are fixed',
    run() {
      assert.deepEqual(buildProgramFocusSplit([]), [{ quality: 'Strength', pct: 100 }]);
      assert.equal(PROGRAM_FOCUS_COLORS.Strength, '#F59E0B');
      assert.equal(PROGRAM_FOCUS_COLORS.Conditioning, '#38BDF8');
      assert.equal(PROGRAM_FOCUS_COLORS.Mobility, '#34D399');
    },
  },
];
