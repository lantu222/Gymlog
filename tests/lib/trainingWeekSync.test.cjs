const assert = require('node:assert/strict');

const {
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
];
