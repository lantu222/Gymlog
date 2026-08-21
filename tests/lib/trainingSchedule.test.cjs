const assert = require('node:assert/strict');

const {
  cycleSchedule,
  isScheduleKnown,
  patternFromOnOff,
  sessionSlotOn,
  trainsOn,
  UNKNOWN_SCHEDULE,
  weekdaySchedule,
} = require('../../.test-dist/lib/trainingSchedule.js');

/** Local wall-clock, the way the schedule reads dates. */
function on(year, month, day) {
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

const SESSIONS = ['A', 'B', 'C'];

/** What the app would show for a run of days, as a readable string. */
function walk(schedule, from, days) {
  return Array.from({ length: days }, (_, offset) => {
    const date = new Date(from.getFullYear(), from.getMonth(), from.getDate() + offset);
    const slot = sessionSlotOn(schedule, date);
    return slot === null ? '-' : SESSIONS[((slot % 3) + 3) % 3];
  }).join('');
}

module.exports = [
  {
    name: 'trainingSchedule: a weekday list still means what it always meant',
    run() {
      // Tue, Wed, Thu — the shape every existing plan is written in.
      const schedule = weekdaySchedule([1, 2, 3]);

      // Monday 2026-07-27 through the following Sunday.
      assert.equal(walk(schedule, on(2026, 7, 27), 14), '-ABC----ABC---');
      assert.equal(isScheduleKnown(schedule), true);
    },
  },
  {
    name: 'trainingSchedule: two days on and one off, the rhythm a week cannot hold',
    run() {
      // Reported 2026-08-21: "2pv treeni 1 lepo" repeated. The point of the
      // whole file — no set of weekdays produces this, because Wednesday is a
      // training day this week and a rest day the next.
      const schedule = cycleSchedule(patternFromOnOff(2, 1), on(2026, 8, 19));

      assert.equal(walk(schedule, on(2026, 8, 19), 12), 'AB-CA-BC-AB-');

      // Wednesday the 19th trains and Wednesday 2 September does not — the
      // weekday walks one slot forward a week, so it takes three weeks to come
      // back to where it started. That is the whole reason weekdays cannot
      // hold this rhythm.
      assert.equal(trainsOn(schedule, on(2026, 8, 19)), true);
      assert.equal(trainsOn(schedule, on(2026, 8, 26)), true);
      assert.equal(trainsOn(schedule, on(2026, 9, 2)), false);
      assert.equal(trainsOn(schedule, on(2026, 9, 9)), true);
    },
  },
  {
    name: 'trainingSchedule: the programme walks its sessions in order across the cycle',
    run() {
      // Three sessions on a three-day cycle would repeat A on every training
      // day if the slot were the position inside the cycle rather than a count
      // of training days. It is a count, so the programme actually rotates.
      const schedule = cycleSchedule(patternFromOnOff(2, 1), on(2026, 8, 19));

      assert.equal(sessionSlotOn(schedule, on(2026, 8, 19)), 0);
      assert.equal(sessionSlotOn(schedule, on(2026, 8, 20)), 1);
      assert.equal(sessionSlotOn(schedule, on(2026, 8, 21)), null);
      assert.equal(sessionSlotOn(schedule, on(2026, 8, 22)), 2);
      assert.equal(sessionSlotOn(schedule, on(2026, 8, 23)), 3);
    },
  },
  {
    name: 'trainingSchedule: the days before the anchor belong to the cycle too',
    run() {
      // The reader sets the rhythm today, and the calendar they are looking at
      // already shows the rest of the month behind them. Those days walk
      // backwards through the same pattern rather than falling off it.
      const schedule = cycleSchedule(patternFromOnOff(2, 1), on(2026, 8, 19));

      assert.equal(trainsOn(schedule, on(2026, 8, 18)), false);
      assert.equal(trainsOn(schedule, on(2026, 8, 17)), true);
      assert.equal(trainsOn(schedule, on(2026, 8, 16)), true);
      assert.equal(sessionSlotOn(schedule, on(2026, 8, 17)), -1);
      assert.equal(sessionSlotOn(schedule, on(2026, 8, 16)), -2);
      // And the walk stays continuous across the anchor, with no repeat or gap.
      assert.equal(walk(schedule, on(2026, 8, 16), 6), 'BC-AB-');
    },
  },
  {
    name: 'trainingSchedule: a cycle survives the clock change',
    run() {
      // 2026-10-25 is a 25-hour day in most of Europe. Stepped by milliseconds
      // this lands on 0.96 of a day and truncates, and every date after the
      // change reads the day before it — the class of bug that drew Sunday
      // twice in the home calendar.
      const schedule = cycleSchedule(patternFromOnOff(2, 1), on(2026, 10, 20));

      assert.equal(walk(schedule, on(2026, 10, 20), 12), 'AB-CA-BC-AB-');
      assert.equal(walk(schedule, on(2026, 10, 24), 6), 'A-BC-A');
    },
  },
  {
    name: 'trainingSchedule: a rhythm with no training day in it is no rhythm',
    run() {
      // An all-rest pattern would stop the app dead: every day free, forever.
      assert.equal(isScheduleKnown(cycleSchedule([false, false], on(2026, 8, 19))), false);
      assert.equal(isScheduleKnown(UNKNOWN_SCHEDULE), false);
      assert.equal(isScheduleKnown(weekdaySchedule([])), false);
      assert.equal(trainsOn(UNKNOWN_SCHEDULE, on(2026, 8, 19)), false);
      assert.equal(sessionSlotOn(weekdaySchedule([]), on(2026, 8, 19)), null);
    },
  },
  {
    name: 'trainingSchedule: on/off counts become a pattern, and stay sane at the edges',
    run() {
      assert.deepEqual(patternFromOnOff(2, 1), [true, true, false]);
      assert.deepEqual(patternFromOnOff(3, 1), [true, true, true, false]);
      // No rest day is a legitimate answer — every day trains.
      assert.deepEqual(patternFromOnOff(1, 0), [true]);
      // Zero training days is not, and would otherwise produce a dead app.
      assert.deepEqual(patternFromOnOff(0, 2), [true, false, false]);
    },
  },
  {
    name: 'trainingSchedule: the schedule is copied, not captured',
    run() {
      // The pattern comes from React state on the way in and goes into
      // AsyncStorage on the way out; a shared array would let one mutate the
      // other behind the reader's back.
      const pattern = [true, true, false];
      const schedule = cycleSchedule(pattern, on(2026, 8, 19));
      pattern[2] = true;

      assert.equal(trainsOn(schedule, on(2026, 8, 21)), false);

      const weekdays = [1, 3];
      const weekly = weekdaySchedule(weekdays);
      weekdays.push(5);
      assert.equal(trainsOn(weekly, on(2026, 8, 22)), false);
    },
  },
];
