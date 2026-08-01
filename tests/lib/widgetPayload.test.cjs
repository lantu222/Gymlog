const assert = require('node:assert/strict');

const {
  buildHomeWidgetPayload,
  HOME_WIDGET_PAYLOAD_VERSION,
} = require('../../.test-dist/lib/widgetPayload.js');

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

module.exports = [
  {
    name: 'widgetPayload: the week runs Monday to Sunday and marks today',
    run() {
      const payload = build();

      assert.equal(payload.days.length, 7);
      assert.deepEqual(
        payload.days.map((day) => day.label),
        ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
      );
      // 2026-07-30 is a Thursday, so the week starts Monday the 27th.
      assert.deepEqual(
        payload.days.map((day) => day.dateLabel),
        ['27', '28', '29', '30', '31', '1', '2'],
      );

      const today = payload.days.filter((day) => day.isToday);
      assert.equal(today.length, 1, 'exactly one day is today');
      assert.equal(today[0].dateLabel, '30');
    },
  },
  {
    name: 'widgetPayload: training days come from the picked days, not a guess',
    run() {
      const payload = build();
      assert.deepEqual(
        payload.days.map((day) => day.isTraining),
        [false, true, true, true, false, false, false],
      );
    },
  },
  {
    name: 'widgetPayload: the week is Finnish when the app is Finnish',
    run() {
      const payload = build({ language: 'fi' });
      assert.deepEqual(
        payload.days.map((day) => day.label),
        ['MA', 'TI', 'KE', 'TO', 'PE', 'LA', 'SU'],
      );
      assert.equal(payload.nextWhen, 'Tänään');
    },
  },
  {
    name: 'widgetPayload: a training day today reads "Today"',
    run() {
      const payload = build();
      assert.equal(payload.hasNext, true);
      assert.equal(payload.nextWhen, 'Today');
      assert.ok(payload.nextTitle.length > 0);
      assert.match(payload.nextMeta, /~\d+ min · \d+ exercises/);
    },
  },
  {
    name: 'widgetPayload: the day after a training day reads "Tomorrow"',
    run() {
      // Monday 2026-07-27; tue/wed/thu are training days, so Tuesday is next.
      const payload = build({ nowMs: at(2026, 7, 27) });
      assert.equal(payload.nextWhen, 'Tomorrow');
    },
  },
  {
    name: 'widgetPayload: further out it names the weekday',
    run() {
      // Friday 2026-07-31 — next training day is Tuesday.
      const payload = build({ nowMs: at(2026, 7, 31) });
      assert.equal(payload.nextWhen, 'TUE');
      assert.equal(payload.hasNext, true);
    },
  },
  {
    name: 'widgetPayload: one exercise is singular, matching Finnish too',
    run() {
      const single = [
        { id: 's', title: 'Solo', duration: '~20 min', exercises: [{ name: 'Squat', setsLabel: '3' }], hiddenExerciseCount: 0 },
      ];
      assert.match(build({ sessions: single }).nextMeta, /1 exercise$/);
      assert.match(build({ sessions: single, language: 'fi' }).nextMeta, /1 liike$/);
      assert.match(build({ language: 'fi' }).nextMeta, /liikettä$/);
    },
  },
  {
    name: 'widgetPayload: a session with no duration still names the count',
    run() {
      const noDuration = [
        { id: 's', title: 'Solo', duration: '', exercises: [{ name: 'A', setsLabel: '3' }, { name: 'B', setsLabel: '3' }], hiddenExerciseCount: 0 },
      ];
      assert.equal(build({ sessions: noDuration }).nextMeta, '2 exercises');
    },
  },
  {
    name: 'widgetPayload: no picked days says so instead of inventing a rhythm',
    run() {
      const payload = build({ trainingDayIndexes: [] });

      assert.equal(payload.hasNext, false);
      assert.equal(payload.nextTitle, 'Pick your training days');
      assert.equal(payload.nextWhen, '');
      assert.deepEqual(payload.days.map((day) => day.isTraining), [false, false, false, false, false, false, false]);
      // The week itself still renders — the strip is useful without a plan.
      assert.equal(payload.days.length, 7);
    },
  },
  {
    name: 'widgetPayload: days picked but no sessions points back at the app',
    run() {
      const payload = build({ sessions: [] });
      assert.equal(payload.hasNext, false);
      assert.equal(payload.nextTitle, 'Open the app to start a plan');
    },
  },
  {
    name: 'widgetPayload: a missing plan name never renders as blank',
    run() {
      assert.equal(build({ planName: null }).planName, 'No plan yet');
      assert.equal(build({ planName: '   ' }).planName, 'No plan yet');
      assert.equal(build({ planName: null, language: 'fi' }).planName, 'Ei suunnitelmaa');
      assert.equal(build({ planName: 'Strong Chest' }).planName, 'Strong Chest');
    },
  },
  {
    name: 'widgetPayload: every field the widget draws is a finished string',
    run() {
      const payload = build();

      assert.equal(payload.version, HOME_WIDGET_PAYLOAD_VERSION);
      assert.ok(!Number.isNaN(Date.parse(payload.updatedAt)), 'updatedAt is an ISO timestamp');
      for (const day of payload.days) {
        assert.equal(typeof day.label, 'string');
        assert.equal(typeof day.dateLabel, 'string');
        assert.equal(typeof day.isToday, 'boolean');
        assert.equal(typeof day.isTraining, 'boolean');
        assert.ok(['done', 'today', 'plan', 'off'].includes(day.state), 'state is one of the four the widget can draw');
      }
      for (const key of ['planName', 'nextTitle', 'nextWhen', 'nextMeta', 'dayLine', 'ctaLabel']) {
        assert.equal(typeof payload[key], 'string', `${key} must be a string the native side can draw`);
      }
      // Serialisable as-is: this is what gets written to disk for Kotlin.
      assert.doesNotThrow(() => JSON.parse(JSON.stringify(payload)));
    },
  },
  {
    name: 'widgetPayload: a week spanning a month boundary numbers the days correctly',
    run() {
      // Sunday 2026-08-02 — the week started Monday 2026-07-27.
      const payload = build({ nowMs: at(2026, 8, 2) });
      assert.deepEqual(
        payload.days.map((day) => day.dateLabel),
        ['27', '28', '29', '30', '31', '1', '2'],
      );
      assert.equal(payload.days[6].isToday, true);
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
    name: 'widgetPayload: a logged session turns its bar to done, outranking today',
    run() {
      // Thursday is today AND a training day; logging it should read as done.
      const payload = build({ completedWeekdayIndexes: [1, 3] });
      assert.deepEqual(
        payload.days.map((day) => day.state),
        ['off', 'done', 'plan', 'done', 'off', 'off', 'off'],
      );
      // Without any logged session, today is still today.
      assert.equal(build().days[3].state, 'today');
    },
  },
  {
    name: 'widgetPayload: the button and the day line are pre-translated',
    run() {
      // The widget is drawn by the launcher, which has none of the app's i18n.
      assert.equal(build().ctaLabel, 'Start');
      assert.equal(build({ language: 'fi' }).ctaLabel, 'Aloita');
      assert.equal(build().dayLine, 'Today · THU');
      assert.equal(build({ language: 'fi' }).dayLine, 'Tänään · TO');
      // Not today: no 'today' claim, and the CTA falls back to opening the app.
      const later = build({ nowMs: at(2026, 7, 31) });
      assert.equal(later.dayLine, 'TUE');
      assert.equal(build({ trainingDayIndexes: [] }).ctaLabel, 'Open app');
    },
  },
];
