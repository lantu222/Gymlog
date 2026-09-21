const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const ROOT = path.join(__dirname, '..', '..');
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), 'utf8').replace(/\r\n/g, '\n');

/**
 * The week and the block say the same thing everywhere, and today is today.
 *
 * Audit, 2026-09-20. The week pill on the finish view and the summary took
 * its week from the block and its count from Monday to Sunday, so every plan
 * not started on a Monday read two different weeks in one pill; the session
 * analysis named the week the reader is in rather than the one the analysed
 * session filled; and three summary memos read the clock with no day in their
 * dependencies, so an app left open overnight kept last week's "3 sessions
 * this week" and last month's calendar. The rules are tested where they are
 * pure (homePlanProgress, readyProgramDuration); this holds the wiring.
 */

const app = read('App.tsx');
const between = (source, from, to) => {
  const start = source.indexOf(from);
  const end = source.indexOf(to, start + from.length);
  assert.ok(start >= 0 && end > start, `could not find ${from} … ${to}`);
  return source.slice(start, end);
};

/*
 * The clock, as the shell's memos can read it.
 *
 * Directly — `new Date()` with no argument, `Date.now()` — or through a
 * calendar summary left to default its own `now`. `new Date(todayStartMs)`
 * is not a clock read: it is the day key, and the key is what moves.
 */
const DAY_KEYS = new Set(['todayKey', 'todayStartMs']);
const CALENDAR_SUMMARIES = {
  // name: [index of the clock argument, key inside it when it is an options object]
  getHomeSummary: [2, null],
  getLifetimeTrainingSummary: [1, null],
  getTrainingRhythm: [1, 'now'],
  getMonthTrainingTotals: [1, null],
  getRecentActivityStrip: [1, null],
  getSessionsThisWeek: [1, null],
  getCurrentWeekStreak: [1, null],
  getMonthlyActivityCalendar: [1, null],
};
/*
 * Memos allowed to read the clock without the day. Each needs a reason that
 * would still be true if the memo were written today.
 */
const CLOCK_WITHOUT_DAY = {
  premiumTrialEndsAt:
    'A date, fixed on purpose when the screen mounts: keyed on the day, the paywall\'s seven-day trial end would move a day further every midnight while the reader looked at it.',
};

function isUseMemo(node) {
  if (!ts.isCallExpression(node)) return false;
  const callee = node.expression;
  return (
    (ts.isIdentifier(callee) && callee.text === 'useMemo') ||
    (ts.isPropertyAccessExpression(callee) && callee.name.text === 'useMemo')
  );
}

function clockReadsIn(body, sf) {
  const reads = [];
  const visit = (node) => {
    if (
      ts.isNewExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'Date' &&
      (!node.arguments || node.arguments.length === 0)
    ) {
      reads.push('new Date()');
    } else if (ts.isCallExpression(node) && node.expression.getText(sf) === 'Date.now') {
      reads.push('Date.now()');
    } else if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text in CALENDAR_SUMMARIES) {
      const [index, key] = CALENDAR_SUMMARIES[node.expression.text];
      const arg = node.arguments[index];
      const given =
        key === null
          ? Boolean(arg)
          : Boolean(
              arg &&
                ts.isObjectLiteralExpression(arg) &&
                arg.properties.some((property) => property.name && property.name.getText(sf) === key),
            );
      if (!given) {
        reads.push(`${node.expression.text} with its default clock`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(body);
  return reads;
}

/** Every memo in `source` that reads the clock, and whether its deps hold the day. */
function scanMemos(source, fileName) {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found = [];
  const visit = (node) => {
    if (isUseMemo(node) && node.arguments.length >= 2) {
      const reads = clockReadsIn(node.arguments[0], sf);
      if (reads.length > 0) {
        const deps = node.arguments[1];
        const keyed =
          ts.isArrayLiteralExpression(deps) && deps.elements.some((element) => DAY_KEYS.has(element.getText(sf)));
        const holder = ts.isVariableDeclaration(node.parent) ? node.parent.name.getText(sf) : '(unnamed)';
        const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
        found.push({ where: `${fileName}:${line} ${holder}`, holder, reads, keyed });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

function shellSources() {
  const appDir = path.join(ROOT, 'src', 'app');
  return [
    ['App.tsx', app],
    ...fs
      .readdirSync(appDir)
      .filter((name) => name.endsWith('.ts') || name.endsWith('.tsx'))
      .sort()
      .map((name) => [`src/app/${name}`, read('src', 'app', name)]),
  ];
}

function offences(sources) {
  const out = [];
  for (const [fileName, source] of sources) {
    for (const memo of scanMemos(source, fileName)) {
      const defaulted = memo.reads.filter((entry) => entry.endsWith('with its default clock'));
      if (defaulted.length > 0) {
        out.push(`${memo.where}: ${defaulted.join(', ')} — pass the clock where the memo can be seen reading it`);
      }
      if (!memo.keyed && !(memo.holder in CLOCK_WITHOUT_DAY)) {
        out.push(`${memo.where}: reads ${memo.reads.join(', ')} with no todayKey or todayStartMs in its deps`);
      }
    }
  }
  return out;
}

module.exports = [
  {
    name: 'week and block: the week pill reads one block tally, on both sides of the save',
    run() {
      const memo = between(app, 'const weekProgressBase = useMemo', 'const guidedNextUp = useMemo');
      assert.match(memo, /blockWeekTally\(\{\s*sessionsDone,\s*sessionsTotal: homeActivePlanCard\.sessionsTotal,\s*totalWeeks: homeActivePlanCard\.planTotalWeeks,/);
      // Before the save the session in hand is not in the log; after it is.
      assert.match(memo, /beforeSave: reading\(homeActivePlanCard\.sessionsDone \+ 1\),/);
      assert.match(memo, /afterSave: reading\(homeActivePlanCard\.sessionsDone\),/);
      // No calendar week left to disagree with the block.
      assert.doesNotMatch(memo, /getStartOfWeek|getEndOfWeek|countPlanSessionsInRange|workoutSessions/);
      assert.match(app, /weekProgress=\{completionWeekProgress\}/);
    },
  },
  {
    name: 'week and block: the analysis names the week its own session filled, counted as Home counts',
    run() {
      const memo = between(app, 'const sessionAnalysis = useMemo', 'const profilePlanSummary = useMemo');
      assert.match(
        memo,
        /weekNumber: homeActivePlanCard\s*\? blockWeekOfSession\(\{\s*sessionId: analysisSessionId,\s*sessions: getCanonicalCompletedSessions\(database\),\s*templateIds: new Set\(homeActivePlanCard\.planTemplateIds\),\s*blockStartedAt: homeActivePlanCard\.blockStartedAt,/,
      );
      assert.doesNotMatch(memo, /currentWeek/, 'the week the reader is in is not the week an analysed session filled');
      // The boundary it counts from is the one the hero counts from.
      assert.match(app, /countSessionsSince\(\s*completedPlanSessions,\s*planTemplateIds,\s*activeWorkoutPlan\.updatedAt,\s*\);/);
      assert.match(app, /blockStartedAt: activeWorkoutPlan\.updatedAt,/);
    },
  },
  {
    name: 'today is today: the summaries are asked with a clock and keyed on the day',
    run() {
      // Sunday night to Monday with no writes: the coach opened with last
      // week's "3 sessions this week", and on the 1st Progress drew last
      // month beside a widget already on the new one.
      assert.match(
        app,
        /const homeSummary = useMemo\(\s*\(\) => getHomeSummary\(database, unitPreference, new Date\(\)\),[\s\S]{0,120}\[database, unitPreference, todayKey\],/,
      );
      assert.match(
        app,
        /const lifetimeSummary = useMemo\(\s*\(\) => getLifetimeTrainingSummary\(database, new Date\(\)\),[\s\S]{0,120}\[database, todayKey\],/,
      );
      assert.match(
        app,
        /const progressTrainingRhythm = useMemo\(\s*\(\) => getTrainingRhythm\(database, \{ now: new Date\(\) \}\),[\s\S]{0,120}\[database, todayKey\],/,
      );
      // The player's entry eyebrow names today's weekday from the key.
      assert.match(app, /`guided\.weekday\.\$\{new Date\(todayStartMs\)\.getDay\(\)\}`/);
      assert.match(app, /\}, \[homeActivePlanCard\?\.currentWeek, preferences\.appLanguage, todayStartMs\]\);/);
      // And the coach's "on the plan today" reads the same day.
      assert.match(app, /trainsOn\(homeTrainingSchedule, new Date\(todayStartMs\)\)/);
    },
  },
  {
    name: 'today is today: no memo in the shell reads the clock without the day in its deps',
    run() {
      assert.deepEqual(
        offences(shellSources()),
        [],
        'A memo that reads the clock keeps the day it was computed on until something else changes. ' +
          'Key it on todayKey or todayStartMs (App.tsx), or list it in CLOCK_WITHOUT_DAY with a reason.',
      );
    },
  },
  {
    name: 'today is today: the scan catches the shapes it exists for',
    run() {
      // Fixtures for what the scan must NOT let through, so a scan that
      // matches nothing cannot pass by finding nothing.
      const fixture = [
        'const a = useMemo(() => getHomeSummary(database, unitPreference), [database, unitPreference]);',
        'const b = useMemo(() => items.map(() => new Date().getDay()), [items]);',
        'const c = React.useMemo(() => Date.now() - start, [\n  start,\n  todayKeyish,\n]);',
        'const d = useMemo(() => getTrainingRhythm(database, { weeks: 3 }), [database, todayKey]);',
        'const e = useMemo<number[]>(() => {\n  const now = new Date();\n  return [now.getTime()];\n}, []);',
        // And what it must let through.
        'const ok1 = useMemo(() => getHomeSummary(database, unitPreference, new Date()), [\n  database,\n  todayKey,\n]);',
        'const ok2 = useMemo(() => new Date(todayStartMs).getDay(), [todayStartMs]);',
        'const ok3 = useMemo(() => getMonthTrainingTotals(database, new Date(todayStartMs)), [database, todayStartMs]);',
        'const ok4 = useMemo(() => format(value), [value]);',
      ].join('\n');
      const found = offences([['fixture.tsx', fixture]]);
      const named = (holder) => found.filter((line) => line.includes(` ${holder}:`));
      assert.equal(named('a').length, 2, 'a summary on its default clock, keyed on the data alone');
      assert.equal(named('b').length, 1, 'a clock read nested in a callback');
      assert.equal(named('c').length, 1, 'a dependency that only looks like the key, on a multi-line list');
      assert.equal(named('d').length, 1, 'an options object without its clock');
      assert.equal(named('e').length, 1, 'an empty dependency list');
      for (const holder of ['ok1', 'ok2', 'ok3', 'ok4']) {
        assert.deepEqual(named(holder), [], holder);
      }
      // An excused memo is excused by name only: the same read under any
      // other name is still caught.
      const renamed = offences([['fixture.tsx', 'const premiumTrialEndsAtCopy = useMemo(() => new Date(), []);']]);
      assert.equal(renamed.length, 1);
    },
  },
];
