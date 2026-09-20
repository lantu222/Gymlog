const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), 'utf8').replace(/\r\n/g, '\n');

/**
 * Home's week strip and month grid tell the truth about the week.
 *
 * Audit round 4 (2026-09-20), four things one screen got wrong at once:
 * the done chips matched every session's day id against the plan's, without
 * the lineage alignment the hero counter uses (a swap that copied the
 * programme greyed the chips) and without a template filter (the catalog
 * reuses day ids, so a day trained in another programme lit a chip); the
 * month grid's memo left the date out of its deps and kept yesterday's ring
 * after midnight; the rename field opened with a derived focus label and
 * saved it as the name; and the header kept counting a lift dropped for the
 * day. Source-level, because all four live in wiring.
 */
module.exports = [
  {
    name: 'home: the done chips read the lead programme\'s aligned history, within its lineage',
    run() {
      const app = read('App.tsx');
      const memo = app.slice(app.indexOf('const homeDoneThisWeekSessionIds = useMemo'), app.indexOf('const homeTrainingSchedule = useMemo'));
      assert.ok(memo.length > 0, 'the chip memo is gone');
      assert.match(memo, /completedSessionsForTemplate\(programId\)/, 'the chips must read the aligned history, as the hero does');
      assert.match(memo, /programmeHistoryIds\(programId, workoutTemplates, templatesRunByOtherPlans\(programId\)\)/, 'the lineage is the same set the hero counter reads');
      assert.match(memo, /!lineage\.has\(session\.workoutTemplateId\)/, 'a session of another programme must not light a chip');
      assert.doesNotMatch(memo, /for \(const session of workoutSessions\)/, 'the chips read raw sessions again');
    },
  },
  {
    name: 'home: the month grid follows the date, the header follows the drops, the rename field holds the stored name',
    run() {
      const screen = read('src', 'screens', 'HomeScreen.tsx');
      assert.match(screen, /getHomeMonthCalendar\(new Date\(\), language, monthOffset\),[\s\S]{0,120}\[language, monthOffset, todayDayStart\]/, 'the month grid memo must be keyed on the day');
      assert.match(screen, /const plannedExercises = \(nextPlanSession\?\.exercises \?\? \[\]\)\.filter\(/, 'the header must leave out dropped lifts');
      assert.match(screen, /setRenameDraft\(session\.name \?\? localizeSessionName\(session\.title, language\)\)/, 'the rename field must open with the stored name');
      // And App carries the name and the numeric sets Home now reads.
      const app = read('App.tsx');
      assert.match(app, /id: session\.id,\n\s+name: session\.name,\n\s+title: formatHomeSessionTitle/);
      assert.match(app, /targetSets: exercise\.targetSets,/);
    },
  },
];
