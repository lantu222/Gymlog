const assert = require('node:assert/strict');

const { resolveProgramEmphasis } = require('../../.test-dist/lib/programEmphasis.js');
const {
  programCoverIndex,
  PROGRAM_COVER_STYLES,
} = require('../../.test-dist/lib/programVisualIdentity.js');
const { WORKOUT_TEMPLATES_V1 } = require('../../.test-dist/features/workout/workoutCatalog.js');

function toEmphasisSessions(template) {
  return template.sessions.map((session) => ({
    exercises: session.exercises.map((exercise) => ({ name: exercise.exerciseName, sets: exercise.sets })),
  }));
}

module.exports = [
  {
    // The card is computed from the sessions the programme actually
    // prescribes; a distribution that disagreed with the exercise list below
    // it would be the seed-data lie one card up.
    name: 'every ready program yields an emphasis whose sets and percents add up',
    run() {
      for (const template of WORKOUT_TEMPLATES_V1) {
        const emphasis = resolveProgramEmphasis(toEmphasisSessions(template));
        assert.ok(emphasis, `${template.id} produced no emphasis`);

        const declaredSets = template.sessions.reduce(
          (sum, session) => sum + session.exercises.reduce((inner, exercise) => inner + exercise.sets, 0),
          0,
        );
        const slicedSets = emphasis.slices.reduce((sum, slice) => sum + slice.sets, 0);
        assert.equal(slicedSets, declaredSets, `${template.id} lost sets in the split`);
        assert.equal(emphasis.totalSets, declaredSets);

        const percentSum = emphasis.slices.reduce((sum, slice) => sum + slice.percent, 0);
        assert.equal(percentSum, 100, `${template.id} percents sum to ${percentSum}`);
      }
    },
  },
  {
    /**
     * Every programme's week is named — none of it is "Other".
     *
     * "Where the week goes" is the design's promise that a reader can see what
     * a programme trains before running it, and `other` breaks that promise
     * silently: the bar still draws, the percentages still add to 100, and the
     * largest slice says nothing. Mobility Flow's week was 51 % "Other", RUN's
     * 45 %, Calisthenics Mastery's 44 % — the card was a shrug.
     *
     * Zero is the bar because a new exercise name that lands nowhere is
     * exactly the drift this catches. Naming it costs one word in NAME_HINTS.
     */
    name: 'no programme has an unnamed slice in "where the week goes"',
    run() {
      const offenders = [];
      for (const template of WORKOUT_TEMPLATES_V1) {
        const emphasis = resolveProgramEmphasis(toEmphasisSessions(template));
        const other = emphasis.slices.find((slice) => slice.area === 'other');
        if (other) {
          offenders.push(`${template.name}: ${other.percent} %`);
        }
      }

      assert.deepEqual(offenders, []);
    },
  },
  {
    name: 'every exercise the catalog prescribes lands in a named area',
    run() {
      const { emphasisAreaForExercise } = require('../../.test-dist/lib/programEmphasis.js');
      const unplaced = new Set();
      for (const template of WORKOUT_TEMPLATES_V1) {
        for (const session of template.sessions) {
          for (const exercise of session.exercises) {
            if (emphasisAreaForExercise(exercise.exerciseName) === 'other') {
              unplaced.add(exercise.exerciseName);
            }
          }
        }
      }

      // Named per exercise rather than per programme, so the failure tells you
      // which word to add instead of which programme to go hunting through.
      assert.deepEqual([...unplaced].sort(), []);
    },
  },
  {
    name: 'a glute-focused week puts glutes and legs on top',
    run() {
      const emphasis = resolveProgramEmphasis([
        {
          exercises: [
            { name: 'Barbell Hip Thrust', sets: 4 },
            { name: 'Romanian Deadlift', sets: 4 },
            { name: 'Cable Kickback', sets: 3 },
            { name: 'Overhead Press', sets: 2 },
          ],
        },
      ]);
      assert.equal(emphasis.slices[0].area, 'glutesLegs');
      assert.equal(emphasis.slices[0].sets, 11);
    },
  },
  {
    name: 'an empty program yields no emphasis rather than a fabricated one',
    run() {
      assert.equal(resolveProgramEmphasis([]), null);
      assert.equal(resolveProgramEmphasis([{ exercises: [] }]), null);
    },
  },
  {
    // Identity, not position: the same programme must wear the same colour on
    // every surface, forever — the browse screen used to colour by list index,
    // so one programme changed colour between rows.
    name: 'cover colours are stable, in range, and spread across the palette',
    run() {
      for (const template of WORKOUT_TEMPLATES_V1) {
        const first = programCoverIndex(template.id);
        assert.equal(first, programCoverIndex(template.id));
        assert.ok(first >= 0 && first < PROGRAM_COVER_STYLES.length);
      }
      // The hash must actually spread: a catalog painted one colour is the
      // bug this replaces, reintroduced through the back door.
      const used = new Set(WORKOUT_TEMPLATES_V1.map((template) => programCoverIndex(template.id)));
      assert.ok(used.size >= 4, `only ${used.size} of ${PROGRAM_COVER_STYLES.length} styles in use`);
    },
  },
];
