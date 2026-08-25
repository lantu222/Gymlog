const assert = require('node:assert/strict');

const { WORKOUT_TEMPLATES_V1 } = require('../../.test-dist/features/workout/workoutCatalog.js');

/**
 * Every catalog exercise prescribes ONE rep number, not a range (user decision
 * 2026-08-25: "8-10" became "10" everywhere, because a single target is what
 * lets automated progression say "hit it → next time +2.5 kg" without the
 * range making the claim mushy). Holds are exempt: their numbers are seconds,
 * and 30-60 s is a dose bracket, not a rep range.
 *
 * repsMax was kept as the value on purpose — the progression gate always
 * measured readiness against repsMax, so collapsing onto it changed nothing
 * about when anyone's load moves.
 */
module.exports = [
  {
    name: 'every catalog exercise has a single rep target (holds excepted)',
    run() {
      const offenders = [];
      for (const template of WORKOUT_TEMPLATES_V1) {
        for (const session of template.sessions) {
          for (const exercise of session.exercises) {
            if (exercise.trackingMode === 'hold') {
              continue;
            }
            if (exercise.repsMin !== exercise.repsMax) {
              offenders.push(`${template.id} ${exercise.id}: ${exercise.repsMin}-${exercise.repsMax}`);
            }
          }
        }
      }
      assert.deepEqual(
        offenders,
        [],
        'Catalog exercises with a rep range — set repsMin equal to repsMax:\n  ' + offenders.join('\n  '),
      );
    },
  },
];
