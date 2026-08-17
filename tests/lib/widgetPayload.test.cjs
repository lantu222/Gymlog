const assert = require('node:assert/strict');

const {
  buildHomeWidgetPayload,
  findHomeWidgetNextSession,
  HOME_WIDGET_PAYLOAD_VERSION,
  HOME_WIDGET_WEEK_COUNT,
  HOME_WIDGET_CURRENT_WEEK_INDEX,
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
    // Thursday 2026-07-30, midday.
    nowMs: at(2026, 7, 30),
    language: 'en',
    theme: 'dark',
    planName: 'Strong Chest',
    trainingDayIndexes: [1, 2, 3], // tue, wed, thu (0 = Monday)
    sessions: SESSIONS,
    ...overrides,
  });
}

/** The row the small sizes draw. */
function currentWeek(payload) {
  return payload.weeks[HOME_WIDGET_CURRENT_WEEK_INDEX];
}

function states(payload, weekIndex = HOME_WIDGET_CURRENT_WEEK_INDEX) {
  return payload.weeks[weekIndex].map((day) => day.state);
}

module.exports = [
  {
    name: 'widgetPayload: four weeks — two past, this one, the next',
    run() {
      const payload = build();

      assert.equal(payload.weeks.length, HOME_WIDGET_WEEK_COUNT);
      for (const week of payload.weeks) {
        assert.equal(week.length, 7);
      }
      // 2026-07-30 is a Thursday, so this week started Monday the 27th and the
      // grid starts two Mondays earlier, on the 13th.
      assert.deepEqual(payload.weeks[0].map((day) => day.dateLabel), ['13', '14', '15', '16', '17', '18', '19']);
      assert.deepEqual(payload.weeks[1].map((day) => day.dateLabel), ['20', '21', '22', '23', '24', '25', '26']);
      assert.deepEqual(currentWeek(payload).map((day) => day.dateLabel), ['27', '28', '29', '30', '31', '1', '2']);
      assert.deepEqual(payload.weeks[3].map((day) => day.dateLabel), ['3', '4', '5', '6', '7', '8', '9']);
    },
  },
  {
    name: 'widgetPayload: exactly one day in the whole grid is today',
    run() {
      const payload = build();
      const todays = payload.weeks.flat().filter((day) => day.isToday);

      assert.equal(todays.length, 1);
      assert.equal(todays[0].dateLabel, '30');
      // ...and it sits in the row the small sizes draw.
      assert.equal(currentWeek(payload)[3].isToday, true);
    },
  },
  {
    name: 'widgetPayload: the axis runs Monday to Sunday in the app\'s language',
    run() {
      assert.deepEqual(build().weekdayLabels, ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']);
      assert.deepEqual(build({ language: 'fi' }).weekdayLabels, ['MA', 'TI', 'KE', 'TO', 'PE', 'LA', 'SU']);
    },
  },
  {
    name: 'widgetPayload: three states, and today is not one of them',
    run() {
      const payload = build();
      for (const day of payload.weeks.flat()) {
        assert.ok(['done', 'plan', 'off'].includes(day.state), `${day.state} is not a state the widget can draw`);
      }
      // Today is a training day that has not been logged: planned, and today.
      assert.equal(currentWeek(payload)[3].state, 'plan');
      assert.equal(currentWeek(payload)[3].isToday, true);
    },
  },
  {
    name: 'widgetPayload: a logged day is done, and can still be today',
    run() {
      const payload = build({ completedDayStarts: [at(2026, 7, 28, 19), at(2026, 7, 30, 7)] });

      // Wednesday was a training day, is in the past and was never logged, so
      // it reads free — see the next case.
      assert.deepEqual(states(payload), ['off', 'done', 'off', 'done', 'off', 'off', 'off']);
      // The old shape had to choose between "done" and "today". This one does
      // not, which is the whole reason today moved to its own flag.
      assert.equal(currentWeek(payload)[3].isToday, true);
      assert.equal(currentWeek(payload)[3].state, 'done');
    },
  },
  {
    name: 'widgetPayload: a past planned day that was never trained reads as free',
    run() {
      // Tuesday and Wednesday were training days and are now in the past with
      // nothing logged. The home screen is no place to be reminded of that.
      const payload = build();
      assert.equal(states(payload)[1], 'off');
      assert.equal(states(payload)[2], 'off');
    },
  },
  {
    name: 'widgetPayload: history holds done days only, the next week holds plans only',
    run() {
      const payload = build({ completedDayStarts: [at(2026, 7, 14), at(2026, 7, 21)] });

      assert.deepEqual(states(payload, 0), ['off', 'done', 'off', 'off', 'off', 'off', 'off']);
      assert.deepEqual(states(payload, 1), ['off', 'done', 'off', 'off', 'off', 'off', 'off']);
      // Next week is all future, so every training day is planned.
      assert.deepEqual(states(payload, 3), ['off', 'plan', 'plan', 'plan', 'off', 'off', 'off']);
    },
  },
  {
    name: 'widgetPayload: a training day today reads "Today" and names the session',
    run() {
      const payload = build();
      assert.equal(payload.when, 'Today');
      assert.equal(payload.isPrompt, false);
      assert.ok(payload.title.length > 0);
      assert.equal(payload.textTarget, 'session');
      // Today's own workout, so the card offers it too.
      assert.equal(payload.cardTarget, 'session');
    },
  },
  {
    name: 'widgetPayload: the day before a training day reads "Tomorrow"',
    run() {
      // Monday 2026-07-27; tue/wed/thu train, so Tuesday is next.
      const payload = build({ nowMs: at(2026, 7, 27) });
      assert.equal(payload.when, 'Tomorrow');
      // Nothing to start today, so the card opens Home rather than a workout
      // the reader is not doing today.
      assert.equal(payload.cardTarget, 'home');
      assert.equal(payload.textTarget, 'session');
    },
  },
  {
    name: 'widgetPayload: further out it names the weekday in full',
    run() {
      // Friday 2026-07-31 — next training day is Tuesday. An abbreviation
      // cannot carry the Finnish form, which is why these are their own keys.
      assert.equal(build({ nowMs: at(2026, 7, 31) }).when, 'Tuesday');
      assert.equal(build({ nowMs: at(2026, 7, 31), language: 'fi' }).when, 'Tiistaina');
    },
  },
  {
    name: 'widgetPayload: once today is logged it points at the next session',
    run() {
      // Thursday is today, a training day, and done. Next is Tuesday.
      const payload = build({ completedDayStarts: [at(2026, 7, 30, 7)] });

      assert.equal(payload.when, 'Tuesday');
      assert.equal(payload.cardTarget, 'home');
      assert.equal(payload.isPrompt, false);
    },
  },
  {
    name: 'widgetPayload: no program at all asks for a program',
    run() {
      const payload = build({ sessions: [], planName: null });

      assert.equal(payload.isPrompt, true);
      assert.equal(payload.when, 'No plan yet');
      assert.equal(payload.title, 'Pick a program');
      assert.equal(payload.textTarget, 'programs');
      assert.equal(payload.cardTarget, 'programs');
      // Without sessions there is no rhythm to promise, so no day is planned.
      assert.deepEqual(states(payload), ['off', 'off', 'off', 'off', 'off', 'off', 'off']);
      assert.deepEqual(states(payload, 3), ['off', 'off', 'off', 'off', 'off', 'off', 'off']);
    },
  },
  {
    name: 'widgetPayload: a named plan with nothing in it keeps its name',
    run() {
      const payload = build({ sessions: [] });
      assert.equal(payload.when, 'Strong Chest');
      assert.equal(payload.title, 'Open the app to start a plan');
      assert.equal(payload.isPrompt, true);
    },
  },
  {
    name: 'widgetPayload: no picked days borrows the when-line for the plan name',
    run() {
      const payload = build({ trainingDayIndexes: [] });

      assert.equal(payload.isPrompt, true);
      assert.equal(payload.when, 'Strong Chest');
      assert.equal(payload.title, 'Pick your training days');
      assert.equal(payload.textTarget, 'schedule');
      assert.equal(payload.cardTarget, 'schedule');
      assert.equal(build({ trainingDayIndexes: [], language: 'fi' }).title, 'Valitse treenipäivät');
      // The week still renders, honestly empty.
      assert.deepEqual(states(payload), ['off', 'off', 'off', 'off', 'off', 'off', 'off']);
    },
  },
  {
    name: 'widgetPayload: the big number counts the same days the bars colour',
    run() {
      // Two logged days out of three planned, in the week the widget draws.
      const payload = build({ completedDayStarts: [at(2026, 7, 28, 19), at(2026, 7, 30, 7)] });
      assert.equal(payload.weekCount, '2/3');
      assert.equal(payload.weekCountLabel, 'This week');
      // The number is derived from the row, so it cannot disagree with it.
      assert.equal(
        Number(payload.weekCount.split('/')[0]),
        states(payload).filter((state) => state === 'done').length,
      );
      assert.equal(build({ language: 'fi' }).weekCountLabel, 'Tällä viikolla');
      assert.equal(build().weekCount, '0/3');
    },
  },
  {
    name: 'widgetPayload: with no rhythm there is no denominator',
    run() {
      // "2/0" is not a fraction. Days trained still count.
      const payload = build({ trainingDayIndexes: [], completedDayStarts: [at(2026, 7, 28, 19)] });
      assert.equal(payload.weekCount, '1');
      assert.equal(build({ sessions: [], planName: null }).weekCount, '0');
      // Last week's sessions belong to last week, not to this count.
      assert.equal(build({ completedDayStarts: [at(2026, 7, 21)] }).weekCount, '0/3');
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
      const payload = build();

      assert.equal(payload.version, HOME_WIDGET_PAYLOAD_VERSION);
      assert.ok(!Number.isNaN(Date.parse(payload.updatedAt)), 'updatedAt is an ISO timestamp');
      for (const key of ['when', 'title', 'textTarget', 'cardTarget', 'theme']) {
        assert.equal(typeof payload[key], 'string', `${key} must be a string the native side can draw`);
      }
      assert.equal(typeof payload.isPrompt, 'boolean');
      for (const day of payload.weeks.flat()) {
        assert.equal(typeof day.dateLabel, 'string');
        assert.equal(typeof day.isToday, 'boolean');
      }
      // Serialisable as-is: this is what gets written to disk for Kotlin.
      assert.doesNotThrow(() => JSON.parse(JSON.stringify(payload)));
    },
  },
  {
    name: 'widgetPayload: a week spanning a month boundary numbers the days correctly',
    run() {
      // Sunday 2026-08-02 — this week started Monday 2026-07-27.
      const payload = build({ nowMs: at(2026, 8, 2) });
      assert.deepEqual(currentWeek(payload).map((day) => day.dateLabel), ['27', '28', '29', '30', '31', '1', '2']);
      assert.equal(currentWeek(payload)[6].isToday, true);
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
      assert.equal(buildHomeWidgetPayload({ ...input, language: 'en', theme: 'light', planName: 'P' }).title, next.session.title);

      // Logged: the same call now names the following one instead — Thursday
      // the 30th to Tuesday the 4th.
      const after = findHomeWidgetNextSession({ ...input, completedDayStarts: [at(2026, 7, 30, 7)] });
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
