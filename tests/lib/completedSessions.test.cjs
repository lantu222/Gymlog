const assert = require('node:assert/strict');

const { withHelsinkiClocks } = require('../helpers/clockChange.cjs');
const {
  getCalendarWeekStartAfter,
  getCalendarWeekStartBefore,
  getCalendarWeekStartTimestamp,
  getRollingWindowStart,
} = require('../../.test-dist/lib/completedSessions.js');

module.exports = [
  {
    name: 'calendar week stepping lands on real week starts across a clock change',
    run() {
      withHelsinkiClocks(() => {
        // The week of 23 March 2026 is 167 hours long and the week of 26
        // October is 169, so neither can be reached by adding or subtracting a
        // fixed 168. Every caller looks these values up in a set of week starts,
        // where being an hour off is the same as not existing.
        const march30 = getCalendarWeekStartTimestamp(new Date(2026, 2, 31, 9, 0, 0));
        const march23 = getCalendarWeekStartTimestamp(new Date(2026, 2, 24, 9, 0, 0));
        const october26 = getCalendarWeekStartTimestamp(new Date(2026, 9, 27, 9, 0, 0));
        const october19 = getCalendarWeekStartTimestamp(new Date(2026, 9, 20, 9, 0, 0));

        assert.equal(getCalendarWeekStartBefore(march30), march23);
        assert.equal(getCalendarWeekStartAfter(march23), march30);
        assert.equal(getCalendarWeekStartBefore(october26), october19);
        assert.equal(getCalendarWeekStartAfter(october19), october26);

        // The spans the fixed-millisecond arithmetic assumed are not 168 hours.
        assert.equal((march30 - march23) / 3600000, 167);
        assert.equal((october26 - october19) / 3600000, 169);
      });
    },
  },
  {
    name: 'stepping several weeks in one hop matches stepping one at a time',
    run() {
      withHelsinkiClocks(() => {
        // trainingRhythm indexes its bars with a single multi-week hop, so the
        // two forms have to agree or the chart disagrees with the streak.
        const start = getCalendarWeekStartTimestamp(new Date(2026, 3, 1, 12, 0, 0));

        let iterative = start;
        for (let step = 0; step < 4; step += 1) {
          iterative = getCalendarWeekStartBefore(iterative);
        }

        assert.equal(getCalendarWeekStartBefore(start, 4), iterative);
      });
    },
  },
  {
    name: 'stepping zero weeks is the identity',
    run() {
      withHelsinkiClocks(() => {
        // trainingRhythm asks for offset 0 on its newest bar.
        const start = getCalendarWeekStartTimestamp(new Date(2026, 3, 1, 12, 0, 0));

        assert.equal(getCalendarWeekStartBefore(start, 0), start);
        assert.equal(getCalendarWeekStartAfter(start, 0), start);
      });
    },
  },
  {
    name: 'a rolling day window keeps the time of day it started from',
    run() {
      withHelsinkiClocks(() => {
        // The 30-day counter's contract: same wall-clock time, N calendar days
        // back, rather than N fixed 24-hour chunks.
        const now = new Date(2026, 3, 10, 12, 0, 0);
        const start = new Date(getRollingWindowStart(now, 30));

        assert.equal(start.getHours(), 12);
        assert.equal(start.getDate(), 11);
        assert.equal(start.getMonth(), 2);
        assert.equal((now.getTime() - start.getTime()) / 3600000, 719);
      });
    },
  },
];
