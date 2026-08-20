const assert = require('node:assert/strict');

const {
  buildHomeWidgetPayload,
  findHomeWidgetNextSession,
  HOME_WIDGET_PAYLOAD_VERSION,
  HOME_WIDGET_MONTH_ROWS,
} = require('../../.test-dist/lib/widgetPayload.js');
const { WIDGET_LINK_PREFIX, parseWidgetDeepLink } = require('../../.test-dist/lib/widgetDeepLink.js');

// Local wall-clock, built the same way the payload builds it, so the suite
// passes in any timezone.
function at(year, month, day, hour = 12) {
  return new Date(year, month - 1, day, hour, 0, 0, 0).getTime();
}

const SESSIONS = [
  {
    id: 's1',
    title: 'Squat & Bench',
    duration: '~45 min',
    exercises: [{ name: 'Back Squat', setsLabel: '4 sets' }, { name: 'Bench Press', setsLabel: '4 sets' }],
    hiddenExerciseCount: 0,
  },
  {
    id: 's2',
    title: 'Deadlift & Press',
    duration: '~50 min',
    exercises: [{ name: 'Deadlift', setsLabel: '3 sets' }],
    hiddenExerciseCount: 0,
  },
  {
    id: 's3',
    title: 'Upper Pull',
    duration: '~40 min',
    exercises: [{ name: 'Row', setsLabel: '4 sets' }],
    hiddenExerciseCount: 0,
  },
];

function build(overrides = {}) {
  return buildHomeWidgetPayload({
    // Thursday 2026-07-30, midday. July 2026 starts on a Wednesday and runs 31
    // days, so its Monday-first grid is five rows with two blanks in front.
    nowMs: at(2026, 7, 30),
    language: 'en',
    theme: 'dark',
    planName: 'Strong Chest',
    trainingDayIndexes: [1, 2, 3], // tue, wed, thu (0 = Monday)
    sessions: SESSIONS,
    ...overrides,
  });
}

function dates(payload, rowIndex) {
  return payload.monthWeeks[rowIndex].map((day) => day.dateLabel);
}

function states(payload, rowIndex) {
  return payload.monthWeeks[rowIndex].map((day) => day.state);
}

/** The row today falls in — row 4 of July 2026, the week of the 27th. */
const CURRENT_ROW = 4;

module.exports = [
  {
    name: 'widgetPayload: the calendar is the month the reader is in',
    run() {
      const payload = build();

      assert.equal(payload.monthLabel, 'July 2026');
      assert.equal(build({ language: 'fi' }).monthLabel, 'heinäkuu 2026');
      assert.equal(payload.monthWeeks.length, 5);
      for (const week of payload.monthWeeks) {
        assert.equal(week.length, 7);
      }
      // The 1st is a Wednesday, so Monday and Tuesday of the first row belong
      // to June and are drawn as nothing at all.
      assert.deepEqual(dates(payload, 0), ['', '', '1', '2', '3', '4', '5']);
      assert.deepEqual(dates(payload, CURRENT_ROW), ['27', '28', '29', '30', '31', '', '']);
    },
  },
  {
    name: 'widgetPayload: a month that needs six rows gets six',
    run() {
      // August 2026 starts on a Saturday and runs 31 days — the case the layout
      // holds six rows for, and the reason the native side hides the spares.
      const payload = build({ nowMs: at(2026, 8, 15) });
      assert.equal(payload.monthWeeks.length, 6);
      assert.ok(payload.monthWeeks.length <= HOME_WIDGET_MONTH_ROWS);
      assert.deepEqual(dates(payload, 0), ['', '', '', '', '', '1', '2']);
      assert.deepEqual(dates(payload, 5), ['31', '', '', '', '', '', '']);
    },
  },
  {
    name: 'widgetPayload: the days either side of the month are drawn as nothing',
    run() {
      // They hold their column so the weekdays line up, and say nothing else —
      // a June date marked green under a July heading is a lie about the month.
      const payload = build({ completedDayStarts: [at(2026, 6, 30, 18)] });
      const outside = payload.monthWeeks.flat().filter((day) => !day.inMonth);

      assert.ok(outside.length > 0);
      for (const day of outside) {
        assert.equal(day.dateLabel, '');
        assert.equal(day.state, 'off');
        assert.equal(day.isToday, false);
      }
    },
  },
  {
    name: 'widgetPayload: exactly one day in the whole grid is today',
    run() {
      const payload = build();
      const todays = payload.monthWeeks.flat().filter((day) => day.isToday);

      assert.equal(todays.length, 1);
      assert.equal(todays[0].dateLabel, '30');
      assert.equal(payload.monthWeeks[CURRENT_ROW][3].isToday, true);
    },
  },
  {
    name: "widgetPayload: the axis runs Monday to Sunday in the app's language",
    run() {
      assert.deepEqual(build().weekdayLabels, ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']);
      assert.deepEqual(build({ language: 'fi' }).weekdayLabels, ['MA', 'TI', 'KE', 'TO', 'PE', 'LA', 'SU']);
    },
  },
  {
    name: 'widgetPayload: three states, and today is not one of them',
    run() {
      const payload = build();
      for (const day of payload.monthWeeks.flat()) {
        assert.ok(['done', 'plan', 'off'].includes(day.state), `${day.state} is not a state the widget can draw`);
      }
      // Today is a training day that has not been logged: planned, and today.
      assert.equal(states(payload, CURRENT_ROW)[3], 'plan');
      assert.equal(payload.monthWeeks[CURRENT_ROW][3].isToday, true);
    },
  },
  {
    name: 'widgetPayload: a logged day is done, and can still be today',
    run() {
      const payload = build({ completedDayStarts: [at(2026, 7, 28, 19), at(2026, 7, 30, 7)] });

      // Wednesday the 29th was a training day, is in the past and was never
      // logged, so it reads free — see the next case.
      assert.deepEqual(states(payload, CURRENT_ROW), ['off', 'done', 'off', 'done', 'off', 'off', 'off']);
      // The old shape had to choose between "done" and "today". This one does
      // not, which is the whole reason today moved to its own flag.
      assert.equal(payload.monthWeeks[CURRENT_ROW][3].isToday, true);
      assert.equal(payload.monthWeeks[CURRENT_ROW][3].state, 'done');
    },
  },
  {
    name: 'widgetPayload: a past planned day that was never trained reads as free',
    run() {
      // The home screen is no place to be reminded of what did not happen.
      const payload = build();
      assert.equal(states(payload, CURRENT_ROW)[1], 'off');
      assert.equal(states(payload, CURRENT_ROW)[2], 'off');
      // Every training day still ahead this month is planned, though.
      assert.deepEqual(states(payload, CURRENT_ROW).slice(4), ['off', 'off', 'off']);
      assert.equal(payload.monthWeeks[0].filter((day) => day.state === 'plan').length, 0);
    },
  },
  {
    name: 'widgetPayload: without a program nothing is planned, and history still shows',
    run() {
      const payload = build({
        sessions: [],
        planName: null,
        completedDayStarts: [at(2026, 7, 14), at(2026, 7, 21)],
      });

      assert.equal(payload.monthWeeks.flat().filter((day) => day.state === 'plan').length, 0);
      assert.equal(payload.monthWeeks.flat().filter((day) => day.state === 'done').length, 2);
    },
  },
  {
    name: 'widgetPayload: the three figures are this month, formatted and translated',
    run() {
      const payload = build({ monthTotals: { workouts: 8, durationMinutes: 260, volumeKg: 12400 } });

      assert.deepEqual(
        payload.stats.map((stat) => stat.label),
        ['Workouts', 'Duration', 'Volume'],
      );
      assert.deepEqual(payload.stats.slice(0, 2).map((stat) => stat.value), ['8', '4 h 20 min']);
      // The decimal mark follows the app's number language, which is a module
      // global the rest of the suite also sets — so this asserts the shape.
      assert.match(payload.stats[2].value, /^12[.,]4 t$/);
      assert.deepEqual(
        build({ language: 'fi', monthTotals: { workouts: 8, durationMinutes: 260, volumeKg: 12400 } }).stats.map(
          (stat) => stat.label,
        ),
        ['Treenit', 'Kesto', 'Volyymi'],
      );
    },
  },
  {
    name: 'widgetPayload: a month with nothing in it says zero rather than nothing',
    run() {
      // A blank column reads as a broken widget. Three zeroes read as a month
      // that has not started.
      const payload = build();
      assert.equal(payload.stats.length, 3);
      assert.deepEqual(
        payload.stats.map((stat) => stat.value),
        ['0', '0 min', '0 kg'],
      );
    },
  },
  {
    name: 'widgetPayload: the streak counts weeks, and knows when it is one',
    run() {
      assert.equal(build({ weekStreak: 6 }).streakValue, '6');
      assert.equal(build({ weekStreak: 6 }).streakLabel, 'weeks in a row');
      assert.equal(build({ weekStreak: 1 }).streakLabel, 'week in a row');
      assert.equal(build({ weekStreak: 6, language: 'fi' }).streakLabel, 'viikkoa putkeen');
      assert.equal(build({ weekStreak: 1, language: 'fi' }).streakLabel, 'viikko putkeen');
      // Nothing logged, and nothing passed in: zero, not a blank.
      assert.equal(build().streakValue, '0');
      assert.equal(build({ weekStreak: -3 }).streakValue, '0');
    },
  },
  {
    name: 'widgetPayload: today names the weekday and what the day is for',
    run() {
      // Thursday is a training day here, so the routine widget names its
      // session and its arrow opens it.
      const payload = build();
      assert.equal(payload.routineWhen, 'Thursday');
      assert.equal(payload.routineTitle, 'Upper Pull');
      assert.equal(payload.routineTarget, 'session');
      assert.equal(build({ language: 'fi' }).routineWhen, 'Torstai');
    },
  },
  {
    name: 'widgetPayload: a rest day says so, and does not offer a workout',
    run() {
      // Monday 2026-07-27 — tue/wed/thu train, so Monday is a rest day. The
      // card names it rather than reaching for the next session, and the arrow
      // opens Home: there is nothing to start.
      const payload = build({ nowMs: at(2026, 7, 27) });
      assert.equal(payload.routineWhen, 'Monday');
      assert.equal(payload.routineTitle, 'Rest day');
      assert.equal(payload.routineTarget, 'home');
      assert.equal(build({ nowMs: at(2026, 7, 27), language: 'fi' }).routineTitle, 'Lepopäivä');
    },
  },
  {
    name: 'widgetPayload: the session named is the one Home would run that day',
    run() {
      // Tuesday is the first training day of the week, so it is the first
      // session — the same mapping getHomeDayView makes for Home.
      assert.equal(build({ nowMs: at(2026, 7, 28) }).routineTitle, SESSIONS[0].title);
      assert.equal(build({ nowMs: at(2026, 7, 29) }).routineTitle, SESSIONS[1].title);
      assert.equal(build({ nowMs: at(2026, 7, 30) }).routineTitle, SESSIONS[2].title);
    },
  },
  {
    name: 'widgetPayload: no program at all asks for a program',
    run() {
      const payload = build({ sessions: [], planName: null });

      assert.equal(payload.routineWhen, 'No plan yet');
      assert.equal(payload.routineTitle, 'Pick a program');
      assert.equal(payload.routineTarget, 'programs');
    },
  },
  {
    name: 'widgetPayload: with no program it names the one the app recommends',
    run() {
      const payload = build({ sessions: [], planName: null, suggestion: { title: 'Strength · Base' } });

      // "Pick a program" asked a question the app could answer itself.
      assert.equal(payload.routineWhen, 'Suggested for you');
      assert.equal(payload.routineTitle, 'Strength · Base');
      // And the tap opens that programme, not the catalog it came from.
      assert.equal(payload.routineTarget, 'suggestion');
      assert.equal(
        build({ sessions: [], planName: null, suggestion: { title: 'X' }, language: 'fi' }).routineWhen,
        'Suositus sinulle',
      );
    },
  },
  {
    name: 'widgetPayload: no recommendation means it asks instead of inventing one',
    run() {
      // Onboarding may never have produced one, and a widget that names a
      // programme it was not given is worse than one that asks.
      for (const suggestion of [null, undefined, { title: '   ' }]) {
        const payload = build({ sessions: [], planName: null, suggestion });
        assert.equal(payload.routineTitle, 'Pick a program', `suggestion ${JSON.stringify(suggestion)}`);
        assert.equal(payload.routineWhen, 'No plan yet');
        assert.equal(payload.routineTarget, 'programs');
      }
    },
  },
  {
    name: 'widgetPayload: a named plan with nothing in it keeps its name',
    run() {
      const payload = build({ sessions: [] });
      assert.equal(payload.routineWhen, 'Strong Chest');
      assert.equal(payload.routineTitle, 'Open the app to start a plan');
      assert.equal(payload.routineTarget, 'programs');
    },
  },
  {
    name: 'widgetPayload: no picked days points at the editor',
    run() {
      const payload = build({ trainingDayIndexes: [] });

      assert.equal(payload.routineWhen, 'Strong Chest');
      assert.equal(payload.routineTitle, 'Pick your training days');
      assert.equal(payload.routineTarget, 'schedule');
      assert.equal(build({ trainingDayIndexes: [], language: 'fi' }).routineTitle, 'Valitse treenipäivät');
      // The month still renders, honestly empty of plans.
      assert.equal(payload.monthWeeks.flat().filter((day) => day.state === 'plan').length, 0);
    },
  },
  {
    name: 'widgetPayload: every prompt state still draws a full calendar',
    run() {
      // The calendar widgets have no words to fall back on, so the states that
      // change the routine line must not empty the month.
      for (const overrides of [
        { sessions: [], planName: null },
        { sessions: [] },
        { trainingDayIndexes: [] },
      ]) {
        const payload = build({ ...overrides, completedDayStarts: [at(2026, 7, 14)] });
        assert.equal(payload.monthWeeks.length, 5);
        assert.equal(payload.monthLabel, 'July 2026');
        assert.equal(payload.monthWeeks.flat().filter((day) => day.state === 'done').length, 1);
      }
    },
  },
  {
    name: 'widgetPayload: the resolved theme travels with the payload',
    run() {
      // The launcher cannot read the app's preference, so the answer has to be
      // in the file. Whatever the app resolved — Pro gate included — is what
      // the widget paints.
      assert.equal(build({ theme: 'dark' }).theme, 'dark');
      assert.equal(build({ theme: 'light' }).theme, 'light');
    },
  },
  {
    name: 'widgetPayload: every field the widget draws is a finished string',
    run() {
      const payload = build({ weekStreak: 3, monthTotals: { workouts: 2, durationMinutes: 90, volumeKg: 400 } });

      assert.equal(payload.version, HOME_WIDGET_PAYLOAD_VERSION);
      assert.ok(!Number.isNaN(Date.parse(payload.updatedAt)), 'updatedAt is an ISO timestamp');
      for (const key of [
        'monthLabel',
        'streakValue',
        'streakLabel',
        'routineWhen',
        'routineTitle',
        'routineTarget',
        'theme',
      ]) {
        assert.equal(typeof payload[key], 'string', `${key} must be a string the native side can draw`);
      }
      for (const stat of payload.stats) {
        assert.equal(typeof stat.label, 'string');
        assert.equal(typeof stat.value, 'string');
      }
      for (const day of payload.monthWeeks.flat()) {
        assert.equal(typeof day.dateLabel, 'string');
        assert.equal(typeof day.isToday, 'boolean');
        assert.equal(typeof day.inMonth, 'boolean');
      }
      // Serialisable as-is: this is what gets written to disk for Kotlin.
      assert.doesNotThrow(() => JSON.parse(JSON.stringify(payload)));
    },
  },
  {
    name: 'widgetPayload: the named session is the one the app can reopen',
    run() {
      // The link says "the session you named" rather than carrying an id, so
      // the app has to resolve the same session the payload titled.
      const input = {
        nowMs: at(2026, 7, 30),
        trainingDayIndexes: [1, 2, 3],
        sessions: SESSIONS,
      };
      const next = findHomeWidgetNextSession(input);

      assert.ok(next);
      assert.equal(next.offset, 0);
      assert.equal(next.weekdayIndex, 3);
      assert.equal(
        buildHomeWidgetPayload({ ...input, language: 'en', theme: 'light', planName: 'P' }).routineTitle,
        next.session.title,
      );

      // Logged: the same call now names the following one instead — Thursday
      // the 30th to Tuesday the 4th.
      const after = findHomeWidgetNextSession({ ...input, completedWorkoutDayStarts: [at(2026, 7, 30, 7)] });
      assert.equal(after.offset, 5);
      assert.equal(after.weekdayIndex, 1);
    },
  },
  {
    name: 'widgetPayload: nothing to name returns nothing rather than a guess',
    run() {
      assert.equal(findHomeWidgetNextSession({ nowMs: at(2026, 7, 30), trainingDayIndexes: [], sessions: SESSIONS }), null);
      assert.equal(findHomeWidgetNextSession({ nowMs: at(2026, 7, 30), trainingDayIndexes: [1], sessions: [] }), null);
    },
  },
  {
    name: 'widgetDeepLink: every target survives a round trip',
    run() {
      for (const target of ['session', 'calendar', 'home', 'programs', 'schedule']) {
        assert.equal(parseWidgetDeepLink(`${WIDGET_LINK_PREFIX}${target}`), target);
      }
    },
  },
  {
    name: 'widgetDeepLink: anything unrecognised is not a destination',
    run() {
      // An unknown slug means a newer widget is talking to an older app.
      // Guessing where it meant would be worse than leaving the reader where
      // they were.
      assert.equal(parseWidgetDeepLink('vinha://widget/tomorrow'), null);
      assert.equal(parseWidgetDeepLink('vinha://other/session'), null);
      assert.equal(parseWidgetDeepLink('https://vinha.app/widget/session'), null);
      assert.equal(parseWidgetDeepLink(''), null);
      assert.equal(parseWidgetDeepLink(null), null);
      assert.equal(parseWidgetDeepLink(undefined), null);
    },
  },
  {
    name: 'widgetDeepLink: a trailing slash or query does not break the tap',
    run() {
      assert.equal(parseWidgetDeepLink('vinha://widget/calendar/'), 'calendar');
      assert.equal(parseWidgetDeepLink('vinha://widget/calendar?from=widget'), 'calendar');
      assert.equal(parseWidgetDeepLink('VINHA://WIDGET/CALENDAR'), 'calendar');
      assert.equal(parseWidgetDeepLink('  vinha://widget/home  '), 'home');
    },
  },
];
