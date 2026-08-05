const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  SEASON_WEEKS,
  isSeasonActive,
  nextSeasonWindow,
  resolveSeasonWindow,
  seasonBlockIndex,
  seasonProgressRatio,
  seasonWeek,
  seasonWeeksLeft,
} = require('../../.test-dist/lib/season.js');
const {
  POINTS_PER_BLOCK,
  POINTS_PER_FULL_WEEK,
  POINTS_PER_RECORD,
  POINTS_PER_WORKOUT,
  computeSeasonProgress,
  countSeasonRecords,
  resolveSeasonBadges,
} = require('../../.test-dist/lib/seasonScoring.js');
const { getSeasonForDate } = require('../../.test-dist/lib/programSeasons.js');

function read(...segments) {
  return fs.readFileSync(path.join(__dirname, '..', '..', ...segments), 'utf8');
}

/** Local midnight, matching how the windows are built. */
function at(year, month, day) {
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function session(date) {
  return { id: `s-${date.getTime()}`, workoutTemplateId: 'tpl', performedAt: date.toISOString() };
}

module.exports = [
  {
    name: 'a season is a dated window, and winter straddles the new year',
    run() {
      const summer = resolveSeasonWindow(at(2026, 6, 15));
      assert.equal(summer.season, 'summer');
      assert.equal(summer.start.getMonth(), 3, 'starts 1 April');
      assert.equal(summer.end.getMonth(), 9, 'ends 1 October');
      assert.equal(summer.year, 2026);

      const autumn = resolveSeasonWindow(at(2026, 11, 20));
      assert.equal(autumn.season, 'winter');
      assert.equal(autumn.start.getFullYear(), 2026);
      assert.equal(autumn.end.getFullYear(), 2027);

      // February belongs to the winter that opened LAST October. Reading it as
      // a window starting this year would put a reader in week 40 of a
      // 26-week season every February.
      const february = resolveSeasonWindow(at(2027, 2, 10));
      assert.equal(february.season, 'winter');
      assert.equal(february.start.getFullYear(), 2026);
      assert.equal(february.year, 2026);
      assert.deepEqual(february.start, autumn.start, 'the same window, from both ends of it');
    },
  },
  {
    name: 'the season boundary is the one the rest of the app already uses',
    run() {
      // A program filed under winter and the winter season window must never
      // disagree — that is how a tile ends up opening the wrong block.
      for (let month = 1; month <= 12; month += 1) {
        const date = at(2026, month, 15);
        assert.equal(
          resolveSeasonWindow(date).season,
          getSeasonForDate(date),
          `month ${month} disagrees with getSeasonForDate`,
        );
      }
    },
  },
  {
    name: 'next season opens the day the current one closes',
    run() {
      const current = resolveSeasonWindow(at(2026, 6, 1));
      const next = nextSeasonWindow(at(2026, 6, 1));
      assert.equal(next.season, 'winter');
      assert.deepEqual(next.start, current.end, 'no gap and no overlap');

      assert.equal(isSeasonActive(current, at(2026, 6, 1)), true);
      assert.equal(isSeasonActive(current, at(2026, 10, 1)), false);
    },
  },
  {
    name: 'week and weeks-left are clamped to the 26 the screen promises',
    run() {
      const window = resolveSeasonWindow(at(2026, 4, 5));
      assert.equal(seasonWeek(window, at(2026, 4, 1)), 1);
      assert.equal(seasonWeek(window, at(2026, 4, 8)), 2);

      // The calendar half-year is a day or two longer than 26 weeks. "Week 27
      // of 26" is worse than holding at 26 for the last two days.
      assert.equal(seasonWeek(window, at(2026, 9, 29)), SEASON_WEEKS);
      assert.equal(seasonWeeksLeft(window, at(2026, 9, 29)), 0);
      assert.equal(seasonProgressRatio(window, at(2026, 9, 29)), 1);

      // Before it opens is week 0, not week 1.
      assert.equal(seasonWeek(window, at(2026, 3, 20)), 0);
      assert.equal(seasonProgressRatio(window, at(2026, 3, 20)), 0);
    },
  },
  {
    name: 'blocks split 7/6/7/6, because 26 does not divide by four',
    run() {
      assert.equal(seasonBlockIndex(1), 0);
      assert.equal(seasonBlockIndex(7), 0);
      assert.equal(seasonBlockIndex(8), 1);
      assert.equal(seasonBlockIndex(13), 1);
      assert.equal(seasonBlockIndex(14), 2);
      assert.equal(seasonBlockIndex(20), 2);
      assert.equal(seasonBlockIndex(21), 3);
      assert.equal(seasonBlockIndex(26), 3);
      // Out of range is clamped rather than returning an index nothing renders.
      assert.equal(seasonBlockIndex(0), 0);
      assert.equal(seasonBlockIndex(99), 3);
    },
  },
  {
    name: 'points come from the reader own log and nothing else',
    run() {
      const window = resolveSeasonWindow(at(2026, 4, 5));
      const now = at(2026, 4, 22); // week 4
      const progress = computeSeasonProgress(
        [
          // Week 1: three of three — a full week.
          session(at(2026, 4, 1)),
          session(at(2026, 4, 3)),
          session(at(2026, 4, 5)),
          // Week 2: two of three.
          session(at(2026, 4, 9)),
          session(at(2026, 4, 11)),
          // Week 3: three of three.
          session(at(2026, 4, 15)),
          session(at(2026, 4, 17)),
          session(at(2026, 4, 19)),
          // Week 4, in progress: one so far.
          session(at(2026, 4, 22)),
          // Outside the window entirely — the previous season.
          session(at(2026, 3, 2)),
        ],
        window,
        { weeklyTarget: 3, now },
      );

      assert.equal(progress.workouts, 9, 'the March session belongs to the winter season');
      assert.equal(progress.fullWeeks, 2);
      assert.equal(progress.points, 9 * POINTS_PER_WORKOUT + 2 * POINTS_PER_FULL_WEEK);
      assert.equal(progress.thisWeekDone, 1);
      assert.equal(progress.thisWeekTarget, 3);
      assert.equal(progress.weeks.length, 4, 'only weeks up to now');
    },
  },
  {
    name: 'the week in progress does not break a streak',
    run() {
      const window = resolveSeasonWindow(at(2026, 4, 5));
      // Two full weeks, then a Tuesday with one of three done. Counting the
      // unfinished week as missed would reset the streak every Monday.
      const progress = computeSeasonProgress(
        [
          session(at(2026, 4, 1)),
          session(at(2026, 4, 2)),
          session(at(2026, 4, 3)),
          session(at(2026, 4, 8)),
          session(at(2026, 4, 9)),
          session(at(2026, 4, 10)),
          session(at(2026, 4, 15)),
        ],
        window,
        { weeklyTarget: 3, now: at(2026, 4, 15) },
      );
      assert.equal(progress.longestStreak, 2);
      assert.equal(progress.fullWeeks, 2);
    },
  },
  {
    name: 'with no program there is no target, and no invented one',
    run() {
      const window = resolveSeasonWindow(at(2026, 4, 5));
      const progress = computeSeasonProgress([session(at(2026, 4, 2))], window, {
        weeklyTarget: null,
        now: at(2026, 4, 5),
      });
      // Points from workouts alone. A default target of three would hand out
      // full-week bonuses against a number nobody chose.
      assert.equal(progress.points, POINTS_PER_WORKOUT);
      assert.equal(progress.fullWeeks, 0);
      assert.equal(progress.thisWeekTarget, 0);
      assert.deepEqual(computeSeasonProgress([], window, { now: at(2026, 4, 5) }).points, 0);
    },
  },
  {
    name: 'every badge has a condition the reader can check',
    run() {
      const base = {
        points: 0,
        workouts: 0,
        fullWeeks: 0,
        longestStreak: 0,
        weeks: [],
        thisWeekDone: 0,
        thisWeekTarget: 3,
      };
      const none = resolveSeasonBadges(base, { seasonEnded: false, personalRecords: 0 });
      assert.deepEqual(none.map((badge) => badge.earned), [false, false, false]);

      const streak = resolveSeasonBadges({ ...base, longestStreak: 12 }, { seasonEnded: false, personalRecords: 0 });
      assert.equal(streak.find((badge) => badge.key === 'streak12').earned, true);

      // "Season finished" is not awarded for being present on 30 September.
      const present = resolveSeasonBadges({ ...base, fullWeeks: 2 }, { seasonEnded: true, personalRecords: 0 });
      assert.equal(present.find((badge) => badge.key === 'finished').earned, false);
      const trained = resolveSeasonBadges({ ...base, fullWeeks: 22 }, { seasonEnded: true, personalRecords: 0 });
      assert.equal(trained.find((badge) => badge.key === 'finished').earned, true);
    },
  },
  {
    name: 'a record is worth the most, and is capped so max-testing does not pay',
    run() {
      const window = resolveSeasonWindow(at(2026, 4, 5));
      const log = (day, weight) => ({ weight, performedAt: at(2026, 4, day).toISOString() });

      // Four sessions on the same lift, each heavier than the last, all inside
      // block 1. Progress, but ONE block — so one bonus. Uncapped this would
      // pay four times for testing a max every week, which is how a season
      // turns into a max-out contest and how people get hurt.
      assert.equal(
        countSeasonRecords([{ logs: [log(2, 100), log(9, 102.5), log(16, 105), log(23, 107.5)] }], window),
        1,
      );

      // Getting stronger in two different blocks is two pieces of progress —
      // and the first log is the baseline, not a record, so this is one.
      const acrossBlocks = countSeasonRecords(
        [
          {
            logs: [
              { weight: 100, performedAt: at(2026, 4, 2).toISOString() },
              { weight: 110, performedAt: at(2026, 6, 2).toISOString() },
              { weight: 120, performedAt: at(2026, 8, 2).toISOString() },
            ],
          },
        ],
        window,
      );
      assert.equal(acrossBlocks, 2);

      // Touching a lift for the first time is not getting better at it. Ten
      // new exercises would otherwise be 500 points for starting.
      assert.equal(
        countSeasonRecords([{ logs: [{ weight: 100, performedAt: at(2026, 4, 2).toISOString() }] }], window),
        0,
      );

      // Repeating an old weight is not a record. Beating one from before the
      // season is.
      assert.equal(
        countSeasonRecords(
          [
            {
              logs: [
                { weight: 120, performedAt: at(2026, 1, 5).toISOString() },
                { weight: 120, performedAt: at(2026, 5, 5).toISOString() },
              ],
            },
          ],
          window,
        ),
        0,
      );

      // The scale: a record outweighs a full week, and a week outweighs a
      // workout. That order is the whole argument — a record is the only
      // number in the log that means "you got better".
      assert.ok(POINTS_PER_RECORD > POINTS_PER_FULL_WEEK);
      assert.ok(POINTS_PER_FULL_WEEK > POINTS_PER_WORKOUT);
      assert.ok(POINTS_PER_BLOCK > POINTS_PER_RECORD);
    },
  },
  {
    name: 'a block scores only when every one of its weeks was full',
    run() {
      const window = resolveSeasonWindow(at(2026, 4, 5));
      const sessions = [];
      // Weeks 1-7 complete at three a week: that is block one, finished.
      for (let week = 0; week < 7; week += 1) {
        for (let day = 0; day < 3; day += 1) {
          sessions.push(session(new Date(window.start.getTime() + (week * 7 + day) * 86400000 + 3600000)));
        }
      }
      const done = computeSeasonProgress(sessions, window, {
        weeklyTarget: 3,
        now: new Date(window.start.getTime() + 8 * 7 * 86400000),
      });
      assert.equal(done.blocksCompleted, 1);
      assert.equal(done.points, 21 * POINTS_PER_WORKOUT + 7 * POINTS_PER_FULL_WEEK + POINTS_PER_BLOCK);

      // One missed week inside the block and the block does not score. Half a
      // block is not a block.
      const gapped = computeSeasonProgress(
        sessions.filter((entry) => Date.parse(entry.performedAt) < window.start.getTime() + 21 * 86400000
          || Date.parse(entry.performedAt) > window.start.getTime() + 28 * 86400000),
        window,
        { weeklyTarget: 3, now: new Date(window.start.getTime() + 8 * 7 * 86400000) },
      );
      assert.equal(gapped.blocksCompleted, 0);
    },
  },
  {
    name: 'one season, one program — the ranking cannot be decided by day count',
    run() {
      const { SEASON_PROGRAM_IDS } = require('../../.test-dist/lib/programSeasons.js');
      const { WORKOUT_TEMPLATES_V1 } = require('../../.test-dist/features/workout/workoutCatalog');
      const ids = new Set(WORKOUT_TEMPLATES_V1.map((template) => template.id));

      // Ten season programs meant ten different day counts and therefore ten
      // different point ceilings: at ten points a workout, a five-day program
      // beats a two-day one by showing up.
      assert.deepEqual(Object.keys(SEASON_PROGRAM_IDS).sort(), ['summer', 'winter']);
      for (const [season, id] of Object.entries(SEASON_PROGRAM_IDS)) {
        assert.ok(ids.has(id), `${season} points at a program the catalog does not have: ${id}`);
      }

      // And the screen shows that one, not a list.
      const screen = read('src', 'screens', 'SeasonScreen.tsx');
      assert.match(screen, /seasonProgram: SeasonProgramItem;/);
      assert.doesNotMatch(screen, /programs\.map\(/);
      assert.match(screen, /'season\.theProgram'/);
    },
  },
  {
    name: 'only the season program scores — the competition is one event',
    run() {
      const window = resolveSeasonWindow(at(2026, 4, 5));
      const own = (day) => ({ id: `own-${day}`, workoutTemplateId: 'tpl_mine', performedAt: at(2026, 4, day).toISOString() });
      const seasonSession = (day) => ({ id: `s-${day}`, workoutTemplateId: 'tpl_season', performedAt: at(2026, 4, day).toISOString() });

      // Six workouts of their own beat three of the season program under the
      // old rule. That is the exact unfairness one shared program exists to
      // remove, and it would have leaked straight back in through whatever
      // else the reader happened to be running.
      const mine = computeSeasonProgress(
        [own(1), own(2), own(3), own(4), own(5), own(6)],
        window,
        { weeklyTarget: 3, programId: 'tpl_season', now: at(2026, 4, 6) },
      );
      assert.equal(mine.points, 0);
      assert.equal(mine.workouts, 0);

      const theirs = computeSeasonProgress(
        [seasonSession(1), seasonSession(3), seasonSession(5), own(2), own(4)],
        window,
        { weeklyTarget: 3, programId: 'tpl_season', now: at(2026, 4, 6) },
      );
      assert.equal(theirs.workouts, 3);
      assert.equal(theirs.points, 3 * POINTS_PER_WORKOUT + POINTS_PER_FULL_WEEK);

      // With no season program named, everything in the window counts — that
      // is the shape the previous-season report needs.
      const all = computeSeasonProgress([own(1), seasonSession(2)], window, { now: at(2026, 4, 6) });
      assert.equal(all.workouts, 2);
    },
  },
  {
    name: 'the weekly target is the season program week, not the reader own',
    run() {
      // Measuring a three-day season against someone's own six-day split
      // would call four workouts a missed week.
      const app = read('App.tsx');
      assert.match(app, /weeklyTarget: seasonProgramTemplate\?\.daysPerWeek \?\? null/);
      assert.match(app, /programId: seasonProgramId/);
      // And the copy says the rule, because a reader whose own workouts score
      // nothing deserves to know why before they log one.
      const i18n = read('src', 'lib', 'i18n.ts');
      assert.match(i18n, /Kauden ohjelman ulkopuolinen työ ei pisteytä/);
      assert.match(i18n, /eikä se vaihdu/);
    },
  },
  {
    name: 'a record is reps when the lift is never loaded — otherwise summer awards nothing',
    run() {
      const window = resolveSeasonWindow(at(2026, 4, 5));

      // The summer program is running and mobility: not one loaded exercise in
      // it. A weight-only record left 50 points and a badge on the screen that
      // nothing in that program could ever trigger, all season.
      const unloaded = countSeasonRecords(
        [
          {
            logs: [
              { weight: 0, reps: 8, performedAt: at(2026, 4, 2).toISOString() },
              { weight: 0, reps: 10, performedAt: at(2026, 4, 9).toISOString() },
              { weight: 0, reps: 12, performedAt: at(2026, 6, 9).toISOString() },
            ],
          },
        ],
        window,
      );
      assert.equal(unloaded, 2, 'better in two blocks is two records; the first log is the baseline');

      // Fewer reps than before is not a record.
      assert.equal(
        countSeasonRecords(
          [
            {
              logs: [
                { weight: 0, reps: 12, performedAt: at(2026, 4, 2).toISOString() },
                { weight: 0, reps: 10, performedAt: at(2026, 5, 2).toISOString() },
              ],
            },
          ],
          window,
        ),
        0,
      );

      // The two measures never mix: a lift that has been loaded is judged on
      // load for the whole season, so six reps at bodyweight cannot beat five
      // at 100 kg.
      assert.equal(
        countSeasonRecords(
          [
            {
              logs: [
                { weight: 100, reps: 5, performedAt: at(2026, 4, 2).toISOString() },
                { weight: 0, reps: 30, performedAt: at(2026, 5, 2).toISOString() },
              ],
            },
          ],
          window,
        ),
        0,
      );
    },
  },
  {
    name: 'the season program can actually earn its own record award',
    run() {
      const { SEASON_PROGRAM_IDS } = require('../../.test-dist/lib/programSeasons.js');
      const { WORKOUT_TEMPLATES_V1 } = require('../../.test-dist/features/workout/workoutCatalog');

      // The screen states "a record is 50 points". A season whose program
      // cannot produce one is advertising a rule it cannot honour — which is
      // exactly what shipped when records were weight-only and summer became
      // a running program.
      for (const [season, id] of Object.entries(SEASON_PROGRAM_IDS)) {
        const template = WORKOUT_TEMPLATES_V1.find((entry) => entry.id === id);
        const exercises = template.sessions.flatMap((entry) => entry.exercises);
        const measurable = exercises.filter(
          (exercise) => exercise.trackingMode !== 'time' && exercise.trackingMode !== 'distance',
        );
        assert.ok(
          measurable.length > 0,
          `${season} program ${id} has nothing a record could be measured on`,
        );
      }
    },
  },
  {
    name: 'a season screen shows ITS OWN dates, not today\'s',
    run() {
      // Opening the upcoming winter season showed the summer season's dates,
      // its week 19 of 26 and its seven weeks left: every number on the screen
      // belonged to a different season than the title above it.
      const screen = read('src', 'screens', 'SeasonScreen.tsx');
      const app = read('App.tsx');

      assert.match(screen, /const upcoming = current\.season !== season;/);
      assert.match(screen, /const window = upcoming \? nextSeasonWindow\(\) : current;/);
      // An unopened season has no week and no current block.
      assert.match(screen, /const week = upcoming \? 0 :/);
      assert.match(screen, /const blockIndex = upcoming \? -1 :/);
      // And the same resolution decides which sessions score.
      assert.match(
        app,
        /currentWindow\.season === seasonInView \? currentWindow : nextSeasonWindow\(\)/,
      );

      // The underlying rule: the two windows really are different.
      const summer = resolveSeasonWindow(at(2026, 6, 15));
      const winter = nextSeasonWindow(at(2026, 6, 15));
      assert.notDeepEqual(summer.start, winter.start);
      assert.equal(seasonWeek(winter, at(2026, 6, 15)), 0, 'a season not yet open is week 0');
    },
  },
  {
    name: 'the leaderboard is the one part that waits for a server',
    run() {
      // Comment lines are skipped: this guard has been broken three times by
      // prose that describes the very thing it forbids, and a guard that fires
      // on its own documentation gets deleted rather than fixed.
      const code = read('src', 'lib', 'seasonScoring.ts')
        .split(String.fromCharCode(10))
        .filter((line) => {
          const trimmed = line.trim();
          return trimmed !== '' && !trimmed.startsWith('*') && !trimmed.startsWith('//') && !trimmed.startsWith('/*');
        })
        .join(String.fromCharCode(10));

      // Nothing in the scoring layer may take another person as input. The
      // design's season screen is built on 1 480 players and a rank; a device
      // that only knows its own owner cannot produce either.
      assert.doesNotMatch(code, /rank|leaderboard|participant|opponent/i);
      // And nothing here reaches the network.
      assert.doesNotMatch(code, /fetch\(|EXPO_PUBLIC|http/i);

      // Prove the guard still fires.
      assert.throws(() => assert.doesNotMatch(`${code} const rank = 1;`, /rank|leaderboard|participant|opponent/i));
    },
  },
];
