const assert = require('node:assert/strict');

const { getProgressActivityDayStatus } = require('../../.test-dist/lib/progressActivity.js');

module.exports = [
  {
    name: 'progress activity marks completed workout days from persisted activity only',
    run() {
      const status = getProgressActivityDayStatus({
        dayStart: 1,
        dayNumber: 8,
        active: true,
        isToday: false,
        inCurrentMonth: true,
      });

      assert.equal(status, 'workout');
    },
  },
  {
    name: 'progress activity does not fabricate planned days from odd calendar dates',
    run() {
      const status = getProgressActivityDayStatus({
        dayStart: 2,
        dayNumber: 9,
        active: false,
        isToday: false,
        inCurrentMonth: true,
      });

      assert.equal(status, 'rest');
    },
  },
  {
    name: 'progress activity treats outside-month cells as empty calendar space',
    run() {
      const status = getProgressActivityDayStatus({
        dayStart: 3,
        dayNumber: 30,
        active: false,
        isToday: false,
        inCurrentMonth: false,
      });

      assert.equal(status, 'outside');
    },
  },
];
