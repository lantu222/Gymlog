const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { withHelsinkiClocks } = require('../helpers/clockChange.cjs');
const { resolveSeasonWindow, seasonWeek } = require('../../.test-dist/lib/season.js');
const { computeSeasonProgress, countSeasonRecords } = require('../../.test-dist/lib/seasonScoring.js');
const { localDateKey } = require('../../.test-dist/lib/completedSessions.js');
const { buildWorkoutLogCsv } = require('../../.test-dist/lib/workoutLogCsvExport.js');

/**
 * Days as the reader lives them, not as 24-hour spans or UTC dates.
 *
 * Every case here sits within an hour or three of midnight, where fixed
 * milliseconds and UTC disagree with a Helsinki calendar. Noon tests pass
 * against either arithmetic, which is how these went unnoticed.
 */

function read(...segments) {
  return fs.readFileSync(path.join(__dirname, '..', '..', ...segments), 'utf8');
}

const strip = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

function session(date) {
  return { id: `s-${date.getTime()}`, workoutTemplateId: 'tpl', performedAt: date.toISOString() };
}

module.exports = [
  {
    name: 'calendar days: a late session after the October clock change stays in its season week',
    run() {
      withHelsinkiClocks(() => {
        const winter = resolveSeasonWindow(new Date(2026, 9, 10, 12));
        // 1 October 2026 is a Thursday, so week 4 runs 22–28 October — and the
        // clocks went back on the 25th.
        assert.equal(seasonWeek(winter, new Date(2026, 9, 28, 23, 30)), 4, 'a Wednesday 23:30 counted as next week');
        assert.equal(seasonWeek(winter, new Date(2026, 9, 29, 0, 30)), 5);
        assert.equal(seasonWeek(winter, new Date(2026, 9, 1, 0, 0)), 1);
        // Week 26 opens on 25 March, still in winter time.
        assert.equal(seasonWeek(winter, new Date(2027, 2, 24, 23, 30)), 25, 'the last Wednesday of week 25 counted as week 26');
        assert.equal(seasonWeek(winter, new Date(2027, 2, 25, 0, 30)), 26);
        // Summer time again from 28 March: the last day still counts, and holds at 26.
        assert.equal(seasonWeek(winter, new Date(2027, 2, 31, 23, 30)), 26);

        const progress = computeSeasonProgress(
          [
            session(new Date(2026, 9, 22, 18)),
            session(new Date(2026, 9, 25, 18)),
            session(new Date(2026, 9, 28, 23, 30)),
          ],
          winter,
          { weeklyTarget: 3, now: new Date(2026, 9, 30, 12) },
        );
        const weekFour = progress.weeks.find((week) => week.week === 4);
        assert.equal(weekFour.workouts, 3);
        assert.equal(weekFour.complete, true, 'the full week lost its points to the next one');
      });
    },
  },
  {
    name: 'calendar days: a record set late on a block’s last day scores in that block',
    run() {
      withHelsinkiClocks(() => {
        const winter = resolveSeasonWindow(new Date(2026, 9, 10, 12));
        const lift = (lateAt) => [
          {
            logs: [
              { weight: 100, performedAt: new Date(2026, 9, 2, 12).toISOString() },
              { weight: 110, performedAt: lateAt.toISOString() },
              { weight: 120, performedAt: new Date(2026, 10, 19, 12).toISOString() },
            ],
          },
        ];
        // Week 7, the first block's last, ends on 18 November.
        const late = countSeasonRecords(lift(new Date(2026, 10, 18, 23, 30)), winter);
        const noon = countSeasonRecords(lift(new Date(2026, 10, 18, 12)), winter);
        const sameBlock = countSeasonRecords(lift(new Date(2026, 10, 19, 10)), winter);
        assert.equal(late, noon, 'a record at 23:30 on the block’s last day was filed in the next block');
        assert.ok(late > sameBlock);
      });
    },
  },
  {
    name: 'calendar days: a date key is the local day, not the UTC one',
    run() {
      withHelsinkiClocks(() => {
        assert.equal(localDateKey('2026-09-13T22:30:00.000Z'), '2026-09-14');
        assert.equal(localDateKey(new Date(2026, 0, 5, 0, 15)), '2026-01-05');
        assert.equal(localDateKey(Date.UTC(2026, 11, 31, 23, 0)), '2027-01-01');
        assert.equal(localDateKey('not a date'), '');
      });
    },
  },
  {
    name: 'calendar days: the log export dates a session after midnight by the local day',
    run() {
      withHelsinkiClocks(() => {
        // 00:30 on 2 March in Helsinki, still 1 March in UTC.
        const performedAt = '2026-03-01T22:30:00.000Z';
        const csv = buildWorkoutLogCsv({
          sessions: [{ id: 's1', workoutTemplateId: 't', workoutNameSnapshot: 'Push A', performedAt }],
          logs: [
            {
              id: 'l1',
              sessionId: 's1',
              exerciseNameSnapshot: 'Bench Press',
              weight: 60,
              repsPerSet: [8],
              orderIndex: 0,
              tracked: true,
            },
          ],
        });
        assert.match(csv.split('\n')[1], /^2026-03-02,/);
      });
    },
  },
  {
    name: 'calendar days: screens count days since and bucket charts by the local calendar',
    run() {
      const detail = strip(read('src', 'screens', 'ExerciseDetailScreen.tsx'));
      const lastDone = detail.slice(detail.indexOf('function formatLastDone'), detail.indexOf('function formatLastDone') + 400);
      assert.match(lastDone, /calendarDaysBetween\(iso, Date\.now\(\)\)/);
      assert.doesNotMatch(lastDone, /86400000|86_400_000/);

      const app = strip(read('App.tsx'));
      assert.match(app, /daysSinceLogged: Math\.max\(0, calendarDaysBetween\(history\.latest\.time, now\)\)/);

      const progress = strip(read('src', 'screens', 'ProgressScreen.tsx'));
      assert.doesNotMatch(progress, /toISOString\(\)\.slice\(0, (7|10)\)/, 'a chart groups by UTC day or month');
      assert.doesNotMatch(progress, /return dateString\.slice\(0, 10\)/);
    },
  },
];
