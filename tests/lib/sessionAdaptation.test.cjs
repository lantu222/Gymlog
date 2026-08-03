const assert = require('node:assert/strict');

const {
  EMPTY_SESSION_ADAPTATION,
  applySessionAdaptation,
  countTrimmedSets,
  getSessionTrimTarget,
  hasSessionAdaptation,
  planSessionTrim,
} = require('../../.test-dist/lib/sessionAdaptation.js');

const DAY = [
  { slotId: 'primary_squat', role: 'primary', sets: 4 },
  { slotId: 'secondary_press', role: 'secondary', sets: 3 },
  { slotId: 'accessory_curl', role: 'accessory', sets: 3 },
  { slotId: 'accessory_calf', role: 'accessory', sets: 3 },
];

function template(exercises = DAY) {
  return {
    id: 'tpl_1',
    name: 'Plan - Day 1: Legs',
    defaultScheduleMode: 'rolling_sequence',
    sessions: [
      {
        id: 'day_1',
        name: 'Legs',
        orderIndex: 0,
        exercises: exercises.map((exercise, index) => ({
          id: `ex_${index}`,
          exerciseName: `Lift ${index}`,
          slotId: exercise.slotId,
          role: exercise.role,
          progressionPriority: 'medium',
          trackingMode: 'load_and_reps',
          sets: exercise.sets,
          repsMin: 6,
          repsMax: 8,
          restSecondsMin: 90,
          restSecondsMax: 120,
          substitutionGroup: 'squat_pattern',
        })),
      },
    ],
  };
}

module.exports = [
  {
    name: 'trimming takes from accessories first and never touches the primary',
    run() {
      // 13 sets → 30 % → 4 to drop.
      assert.equal(getSessionTrimTarget(13), 4);

      const kept = planSessionTrim(DAY, 4);

      // The lift the day exists for is untouched. A "shorter" session that
      // guts the main work is a different session, not a shorter one.
      assert.equal(kept.primary_squat, 4);

      // Accessories carry the whole cut, and they carry it evenly: a round at
      // a time, later exercise first, rather than stripping one to the bone
      // while the next keeps everything. Nothing falls below a single set, so
      // no exercise silently disappears from the day.
      assert.equal(kept.accessory_calf, 1);
      assert.equal(kept.accessory_curl, 1);
      assert.equal(kept.secondary_press, 3);
      assert.equal(countTrimmedSets(DAY, kept), 4);

      // A smaller cut stops at the back instead of spreading: 2 sets come off
      // the last accessory only.
      const light = planSessionTrim(DAY, 2);
      assert.equal(light.accessory_calf, 2);
      assert.equal(light.accessory_curl, 2);
      assert.equal(light.secondary_press, 3);
    },
  },
  {
    name: 'a cut deeper than the accessories reaches secondaries, then stops',
    run() {
      // Accessories can give up 4 sets in total (3+3, floored at 1 each), so a
      // target of 6 has to walk up a tier.
      const kept = planSessionTrim(DAY, 6);
      assert.equal(kept.accessory_curl, 1);
      assert.equal(kept.accessory_calf, 1);
      assert.equal(kept.secondary_press, 1);
      assert.equal(kept.primary_squat, 4);
      assert.equal(countTrimmedSets(DAY, kept), 6);

      // Asking for more than the session can give trims what it can and stops
      // rather than emptying exercises.
      const floored = planSessionTrim(DAY, 99);
      assert.equal(countTrimmedSets(DAY, floored), 6);
      assert.equal(floored.primary_squat, 4);

      // A session of nothing but primary work cannot be trimmed at all — the
      // caller has to be able to see that and say so.
      const primaryOnly = [{ slotId: 'a', role: 'primary', sets: 5 }];
      assert.equal(countTrimmedSets(primaryOnly, planSessionTrim(primaryOnly, 3)), 0);
    },
  },
  {
    name: 'an adaptation applies swaps and trims to the runtime template',
    run() {
      const source = template();
      const adapted = applySessionAdaptation(source, {
        swaps: { primary_squat: 'Hack Squat' },
        trimSets: true,
      });

      const exercises = adapted.sessions[0].exercises;
      assert.equal(exercises[0].exerciseName, 'Hack Squat');
      // Swapping does not change the prescription — same sets, same reps, same
      // slot. It is the same work done on something else.
      assert.equal(exercises[0].sets, 4);
      assert.equal(exercises[0].slotId, 'primary_squat');
      assert.equal(exercises[3].sets, 1);

      // The source template is a catalog object shared across sessions; it must
      // come back unchanged.
      assert.equal(source.sessions[0].exercises[0].exerciseName, 'Lift 0');
      assert.equal(source.sessions[0].exercises[3].sets, 3);
    },
  },
  {
    name: 'no adaptation is a no-op, by identity',
    run() {
      const source = template();
      assert.equal(hasSessionAdaptation(EMPTY_SESSION_ADAPTATION), false);
      assert.equal(hasSessionAdaptation(null), false);
      assert.equal(hasSessionAdaptation({ swaps: {}, trimSets: true }), true);
      assert.equal(hasSessionAdaptation({ swaps: { a: 'B' }, trimSets: false }), true);

      // Same object back, not a copy: the ordinary start path pays nothing.
      assert.equal(applySessionAdaptation(source, EMPTY_SESSION_ADAPTATION), source);
      assert.equal(applySessionAdaptation(source, null), source);
    },
  },
];
