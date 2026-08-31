const assert = require('node:assert/strict');

const {
  buildTrainingWeekLoad,
  formatTrainingDays,
  formatTrainingMinutes,
} = require('../../.test-dist/lib/trainingWeekLoad.js');

const base = {
  cyclePattern: null,
  weekdayCount: null,
  sessionCount: 5,
  minutesPerSession: 55,
};

module.exports = [
  {
    name: 'a cycle answers for itself: "4 on / 1 off" is 5.6 days a week, not five',
    run() {
      // The report this exists for: a five-session programme set to 4 on / 1
      // off trains six days in some calendar weeks, and the header went on
      // saying "5 DAYS / WK" because it was reading the session count.
      const load = buildTrainingWeekLoad({
        ...base,
        cyclePattern: [true, true, true, true, false],
      });
      assert.equal(load.daysPerWeek, 5.6);
      assert.equal(load.minutesPerWeek, Math.round(5.6 * 55));
      assert.equal(formatTrainingDays(load.daysPerWeek), '5.6');

      // Every other preset in the family, from the same arithmetic.
      const rate = (on) =>
        buildTrainingWeekLoad({
          ...base,
          cyclePattern: [...Array(on).fill(true), false],
        }).daysPerWeek;
      assert.equal(rate(1), 3.5);
      assert.equal(rate(2), 4.7);
      assert.equal(rate(3), 5.3);
    },
  },
  {
    name: 'a weekday rhythm answers with its own days, and outranks the session count',
    run() {
      // Three sessions rotated across four training days is four days a week.
      // The session count cannot see that, which is why it is last in line.
      const load = buildTrainingWeekLoad({ ...base, sessionCount: 3, weekdayCount: 4 });
      assert.equal(load.daysPerWeek, 4);
      assert.equal(formatTrainingDays(load.daysPerWeek), '4');

      // A cycle still wins over the weekday count: while it runs, the weekday
      // mask is the old week, not this one.
      const cycled = buildTrainingWeekLoad({
        ...base,
        weekdayCount: 4,
        cyclePattern: [true, false],
      });
      assert.equal(cycled.daysPerWeek, 3.5);
    },
  },
  {
    name: 'nothing adopted: the session count is the last thing that knows',
    run() {
      const load = buildTrainingWeekLoad(base);
      assert.equal(load.daysPerWeek, 5);
      assert.equal(load.minutesPerWeek, 275);
    },
  },
  {
    name: 'an unknown session length withholds the week rather than inventing one',
    run() {
      const load = buildTrainingWeekLoad({ ...base, minutesPerSession: 0 });
      assert.equal(load.minutesPerSession, 0);
      // Zero minutes a session times any number of days is still nothing known.
      assert.equal(load.minutesPerWeek, 0);
      assert.equal(formatTrainingMinutes(load.minutesPerWeek), '—');
      assert.equal(formatTrainingMinutes(55), '~55');
    },
  },
  {
    name: 'degenerate rhythms do not divide or multiply their way to a confident lie',
    run() {
      // An empty pattern is not a rhythm — fall through to the next source.
      assert.equal(
        buildTrainingWeekLoad({ ...base, cyclePattern: [], weekdayCount: 3 }).daysPerWeek,
        3,
      );
      // An all-rest pattern trains nothing, and says so.
      assert.equal(
        buildTrainingWeekLoad({ ...base, cyclePattern: [false, false] }).daysPerWeek,
        0,
      );
      // A weekday count cannot exceed the week it is counted in.
      assert.equal(buildTrainingWeekLoad({ ...base, weekdayCount: 9 }).daysPerWeek, 7);
      // A count of zero is nothing said, not "trains zero days".
      assert.equal(buildTrainingWeekLoad({ ...base, weekdayCount: 0 }).daysPerWeek, 5);
      assert.equal(
        buildTrainingWeekLoad({ ...base, minutesPerSession: Number.NaN }).minutesPerSession,
        0,
      );
    },
  },
];
