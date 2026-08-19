const assert = require('node:assert/strict');

const {
  planLabelsForProgramme,
  planLabelsFromWeekdays,
  weekdaysFromPlanLabels,
} = require('../../.test-dist/lib/trainingWeekSync.js');

module.exports = [
  {
    name: 'reads the weekdays a plan names, Monday first and without repeats',
    run() {
      assert.deepEqual(
        weekdaysFromPlanLabels([{ label: 'fri' }, { label: 'mon' }, { label: 'wed' }]),
        ['mon', 'wed', 'fri'],
      );
      // Case and padding come from stored data, not from a picker.
      assert.deepEqual(weekdaysFromPlanLabels([{ label: ' Mon ' }, { label: 'MON' }]), ['mon']);
    },
  },
  {
    name: 'reads nothing from a plan that labels entries by position',
    run() {
      // "Day 1" is not a weekday. Returning the labelled half would tell the
      // rest of the app a rhythm the plan does not actually keep.
      assert.deepEqual(weekdaysFromPlanLabels([{ label: 'mon' }, { label: 'Day 2' }]), []);
      assert.deepEqual(weekdaysFromPlanLabels([{ label: null }]), []);
      assert.deepEqual(weekdaysFromPlanLabels([]), []);
    },
  },
  {
    name: 'places every session when there are days enough',
    run() {
      assert.deepEqual(planLabelsFromWeekdays(3, ['mon', 'wed', 'fri']), ['mon', 'wed', 'fri']);
      // Chosen days arrive in tap order; the plan gets them in week order.
      assert.deepEqual(planLabelsFromWeekdays(2, ['sat', 'tue']), ['tue', 'sat']);
    },
  },
  {
    name: 'spreads a short programme across a wide week instead of stacking it',
    run() {
      // Two sessions across five open days land apart, the same spread the
      // week strip derives with — not Monday and Tuesday.
      assert.deepEqual(planLabelsFromWeekdays(2, ['mon', 'tue', 'wed', 'thu', 'fri']), ['mon', 'thu']);
    },
  },
  {
    name: 'refuses to write when the sessions do not fit the chosen days',
    run() {
      // Four sessions, three days: repeating a day to make the count fit would
      // hand back a week the reader never chose. The caller keeps the old
      // rhythm and stores the availability only.
      assert.equal(planLabelsFromWeekdays(4, ['mon', 'wed', 'fri']), null);
      assert.equal(planLabelsFromWeekdays(1, []), null);
      assert.equal(planLabelsFromWeekdays(0, ['mon']), null);
    },
  },
  {
    name: 'survives a round trip in both directions',
    run() {
      const days = ['tue', 'thu', 'sat'];
      const labels = planLabelsFromWeekdays(3, days);
      assert.deepEqual(labels, days);
      assert.deepEqual(
        weekdaysFromPlanLabels(labels.map((label) => ({ label }))),
        days,
      );
    },
  },
  {
    name: 'a programme keeps its own number of days when it is taken into use',
    run() {
      // The bug this pins: adoption read availability alone and fell back to a
      // three-day default, so every programme — one session or six — ran as a
      // three-day programme.
      assert.equal(planLabelsForProgramme(6, []).length, 6);
      assert.equal(planLabelsForProgramme(1, []).length, 1);
      assert.equal(planLabelsForProgramme(4, []).length, 4);
      // No day is ever repeated to make the count fit.
      const six = planLabelsForProgramme(6, []);
      assert.equal(new Set(six).size, 6);
    },
  },
  {
    name: 'availability places the days when it can hold the programme',
    run() {
      assert.deepEqual(planLabelsForProgramme(2, ['tue', 'thu', 'sat']), ['tue', 'sat']);
      assert.deepEqual(planLabelsForProgramme(1, ['wed', 'sun']), ['wed']);
      // Three open days cannot hold six sessions, so the programme's own week
      // wins rather than being halved in silence.
      assert.equal(planLabelsForProgramme(6, ['mon', 'wed', 'fri']).length, 6);
    },
  },
];
