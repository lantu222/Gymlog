const assert = require('node:assert/strict');

const { WORKOUT_TEMPLATES_V1 } = require('../../.test-dist/features/workout/workoutCatalog.js');
const { collapseRepRange } = require('../../.test-dist/lib/singleRepTarget.js');
const { intervalOffSeconds } = require('../../.test-dist/lib/intervalScheme.js');

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
  {
    name: 'a saved programme collapses its rep ranges the way the catalog did',
    run() {
      // repsMax wins, same as the catalog on 2026-08-25 — the progression
      // gate always measured readiness against it (user 2026-08-26: the same
      // rule for programmes already in the reader's own database).
      assert.deepEqual(collapseRepRange({ name: 'Bench Press', repMin: 8, repMax: 10 }), { repMin: 10, repMax: 10 });
      assert.deepEqual(collapseRepRange({ name: 'Kettlebell Swing', repMin: 15, repMax: 20 }), { repMin: 20, repMax: 20 });
      // Already single: untouched.
      assert.deepEqual(collapseRepRange({ name: 'Back Squat', repMin: 5, repMax: 5 }), { repMin: 5, repMax: 5 });
      // A hold's numbers are seconds, and 30-60 s is a dose bracket.
      assert.deepEqual(collapseRepRange({ name: 'Plank', repMin: 30, repMax: 60 }), { repMin: 30, repMax: 60 });
    },
  },
  {
    name: 'load-time normalization applies the collapse to stored exercise templates',
    run() {
      // Source-read guard: the compiled database module drags AsyncStorage
      // into Node, so the wiring is pinned as text and the behaviour is
      // covered by the pure-function case above.
      const fs = require('node:fs');
      const path = require('node:path');
      const databaseSource = fs.readFileSync(
        path.join(__dirname, '..', '..', 'src', 'storage', 'database.ts'),
        'utf8',
      );
      assert.match(databaseSource, /const reps = collapseRepRange\(\{/);
      assert.match(databaseSource, /repMin: reps\.repMin,\s*\r?\n\s*repMax: reps\.repMax,/);
      assert.match(databaseSource, /const offSeconds = intervalOffSeconds\(name\)/);
      assert.match(databaseSource, /offSeconds \?\? \(typeof exercise\?\.restSeconds === 'number'/);
    },
  },
  {
    name: 'an interval rests exactly the off-phase its name states',
    run() {
      // 30/30 means the walk IS the rest — a saved programme carried a 60 s
      // rest on top of the 30 s walk, and the player offered "30 s kävelyä,
      // 30 s juoksua, sitten minuutin tauko" (user, 2026-08-26).
      assert.equal(intervalOffSeconds('Treadmill HIIT (30s on / 30s off)'), 30);
      assert.equal(intervalOffSeconds('Bike HIIT (45s sprint / 15s rest)'), 15);
      // Everything that is not an interval keeps its own rest.
      assert.equal(intervalOffSeconds('Bench Press'), null);
      assert.equal(intervalOffSeconds('Plank'), null);
      assert.equal(intervalOffSeconds('Air Bike (30s sprint)'), null);
    },
  },
  {
    name: 'the catalogs already prescribe the exact off-phase as the interval rest',
    run() {
      for (const template of WORKOUT_TEMPLATES_V1) {
        for (const session of template.sessions) {
          for (const exercise of session.exercises) {
            const off = intervalOffSeconds(exercise.exerciseName);
            if (off === null) {
              continue;
            }
            assert.equal(
              exercise.restSecondsMin,
              off,
              `${template.id} ${exercise.id}: interval rest floor must equal the named off-phase`,
            );
            assert.equal(
              exercise.restSecondsMax,
              off,
              `${template.id} ${exercise.id}: interval rest ceiling must equal the named off-phase`,
            );
          }
        }
      }
    },
  },
];
