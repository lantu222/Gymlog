const assert = require('node:assert/strict');

const {
  buildNotificationPlan,
  parseReminderTime,
  COMEBACK_AFTER_DAYS,
  DAILY_CAP_BY_LEVEL,
  REMINDER_HORIZON_DAYS,
} = require('../../.test-dist/lib/notificationPlan.js');

// Local wall-clock helper: every assertion below is built the same way the
// planner builds its timestamps, so the suite passes in any timezone.
function at(year, month, day, hour = 0, minute = 0) {
  return new Date(year, month - 1, day, hour, minute, 0, 0).getTime();
}

const BASE_PREFS = {
  pushEnabled: true,
  level: 'motivating',
  personalRecords: true,
  weeklySummary: true,
  comebackNudge: true,
  sessionReminders: true,
  reminderTime: '17:30',
};

function planWith(overrides = {}) {
  const { prefs, ...rest } = overrides;
  return buildNotificationPlan({
    // Wednesday 2026-07-01, 12:00 local.
    nowMs: at(2026, 7, 1, 12, 0),
    prefs: { ...BASE_PREFS, ...(prefs ?? {}) },
    language: 'en',
    trainingDays: ['mon', 'wed', 'fri'],
    lastSessionAtMs: null,
    weekSessionCount: 0,
    weekVolumeKg: 0,
    latestPr: null,
    onTrainingBreak: false,
    ...rest,
  });
}

module.exports = [
  {
    name: 'notificationPlan: the master switch off schedules nothing at all',
    run() {
      assert.deepEqual(planWith({ prefs: { pushEnabled: false } }), []);
    },
  },
  {
    name: 'notificationPlan: a declared training break silences every category',
    run() {
      const plan = planWith({
        onTrainingBreak: true,
        lastSessionAtMs: at(2026, 6, 30, 18, 0),
        weekSessionCount: 2,
        weekVolumeKg: 8000,
        latestPr: { exerciseName: 'Bench press', weightKg: 92.5, reps: 3, achievedAtMs: at(2026, 7, 1, 9, 0) },
      });
      assert.deepEqual(plan, []);
    },
  },
  {
    name: 'notificationPlan: reminders land on the picked weekdays at the picked time',
    run() {
      const plan = planWith({ prefs: { weeklySummary: false } }).filter((item) => item.category === 'reminder');

      assert.ok(plan.length > 0, 'expected reminders for mon/wed/fri');
      // Today is Wednesday and 17:30 has not passed yet, so today counts.
      assert.equal(plan[0].fireAtMs, at(2026, 7, 1, 17, 30));
      assert.equal(plan[1].fireAtMs, at(2026, 7, 3, 17, 30));
      assert.equal(plan[2].fireAtMs, at(2026, 7, 6, 17, 30));

      plan.forEach((item) => {
        const fireAt = new Date(item.fireAtMs);
        assert.ok([1, 3, 5].includes(fireAt.getDay()), 'only mon/wed/fri');
        assert.equal(fireAt.getHours(), 17);
        assert.equal(fireAt.getMinutes(), 30);
      });
    },
  },
  {
    name: 'notificationPlan: reminders cover the whole horizon and never the past',
    run() {
      const nowMs = at(2026, 7, 1, 12, 0);
      const plan = planWith({ prefs: { weeklySummary: false } }).filter((item) => item.category === 'reminder');

      const horizonEnd = at(2026, 7, 1 + REMINDER_HORIZON_DAYS, 23, 59);
      plan.forEach((item) => {
        assert.ok(item.fireAtMs > nowMs, 'nothing scheduled in the past');
        assert.ok(item.fireAtMs <= horizonEnd, 'nothing past the horizon');
      });
      // 4 weeks of mon/wed/fri, starting from today.
      assert.equal(plan.length, 13);
    },
  },
  {
    name: 'notificationPlan: a reminder time already past today starts tomorrow',
    run() {
      const plan = buildNotificationPlan({
        nowMs: at(2026, 7, 1, 19, 0), // Wednesday, after 17:30
        prefs: { ...BASE_PREFS, weeklySummary: false },
        language: 'en',
        trainingDays: ['mon', 'wed', 'fri'],
        lastSessionAtMs: null,
        weekSessionCount: 0,
        weekVolumeKg: 0,
        latestPr: null,
        onTrainingBreak: false,
      }).filter((item) => item.category === 'reminder');

      assert.equal(plan[0].fireAtMs, at(2026, 7, 3, 17, 30), 'Wednesday is spent, Friday is next');
    },
  },
  {
    name: 'notificationPlan: a day already trained gets no reminder',
    run() {
      const plan = planWith({
        prefs: { weeklySummary: false, comebackNudge: false },
        lastSessionAtMs: at(2026, 7, 1, 8, 15), // trained this morning
      }).filter((item) => item.category === 'reminder');

      assert.equal(plan[0].fireAtMs, at(2026, 7, 3, 17, 30), "today's reminder is dropped");
    },
  },
  {
    name: 'notificationPlan: no picked days means no reminders, not invented ones',
    run() {
      const plan = planWith({ trainingDays: [] });
      assert.equal(plan.filter((item) => item.category === 'reminder').length, 0);
    },
  },
  {
    name: 'notificationPlan: the comeback nudge is anchored to the last session only',
    run() {
      const lastSessionAtMs = at(2026, 6, 29, 18, 0);
      const plan = planWith({
        prefs: { sessionReminders: false, weeklySummary: false },
        lastSessionAtMs,
      });

      assert.equal(plan.length, 1);
      assert.equal(plan[0].category, 'comeback');
      assert.equal(plan[0].fireAtMs, at(2026, 6, 29 + COMEBACK_AFTER_DAYS, 17, 30));
    },
  },
  {
    name: 'notificationPlan: a gap longer than the nudge window produces no second nudge',
    run() {
      const plan = planWith({
        prefs: { sessionReminders: false, weeklySummary: false },
        lastSessionAtMs: at(2026, 6, 20, 18, 0), // 11 days ago
      });
      assert.deepEqual(plan, [], 'the moment passed — no daily drip');
    },
  },
  {
    name: 'notificationPlan: never trained means nothing to come back to',
    run() {
      const plan = planWith({
        prefs: { sessionReminders: false, weeklySummary: false },
        lastSessionAtMs: null,
      });
      assert.deepEqual(plan, []);
    },
  },
  {
    name: 'notificationPlan: the weekly summary quotes this week and lands on Sunday',
    run() {
      const plan = planWith({
        prefs: { sessionReminders: false, comebackNudge: false },
        weekSessionCount: 3,
        weekVolumeKg: 12400,
      });

      assert.equal(plan.length, 1);
      assert.equal(plan[0].category, 'weekly');
      assert.equal(plan[0].fireAtMs, at(2026, 7, 5, 18, 0), 'the coming Sunday at 18:00');
      assert.match(plan[0].body, /3 sessions/);
      assert.match(plan[0].body, /12\.4 t/);
    },
  },
  {
    name: 'notificationPlan: an empty week gets no summary rather than a guilt trip',
    run() {
      const plan = planWith({
        prefs: { sessionReminders: false, comebackNudge: false },
        weekSessionCount: 0,
        weekVolumeKg: 0,
      });
      assert.deepEqual(plan, []);
    },
  },
  {
    name: 'notificationPlan: a cardio-only week reports sessions without quoting 0 kg',
    run() {
      const plan = planWith({
        prefs: { sessionReminders: false, comebackNudge: false },
        weekSessionCount: 2,
        weekVolumeKg: 0,
      });

      assert.equal(plan.length, 1);
      assert.equal(plan[0].body, 'Sessions this week: 2.');
      assert.ok(!plan[0].body.includes('0 kg'));
    },
  },
  {
    name: 'notificationPlan: Sunday evening is not carried over into next week',
    run() {
      const plan = buildNotificationPlan({
        nowMs: at(2026, 7, 5, 20, 0), // Sunday, after 18:00
        prefs: { ...BASE_PREFS, sessionReminders: false, comebackNudge: false },
        language: 'en',
        trainingDays: [],
        lastSessionAtMs: null,
        weekSessionCount: 4,
        weekVolumeKg: 9000,
        latestPr: null,
        onTrainingBreak: false,
      });

      assert.deepEqual(plan, [], 'next Sunday would describe a different week');
    },
  },
  {
    name: 'notificationPlan: the record note fires the morning after the session',
    run() {
      const plan = planWith({
        prefs: { sessionReminders: false, comebackNudge: false, weeklySummary: false },
        latestPr: {
          exerciseName: 'Bench press',
          weightKg: 92.5,
          reps: 3,
          achievedAtMs: at(2026, 7, 1, 18, 40),
        },
      });

      assert.equal(plan.length, 1);
      assert.equal(plan[0].category, 'record');
      assert.equal(plan[0].fireAtMs, at(2026, 7, 2, 9, 0));
      assert.match(plan[0].body, /Bench press/);
      assert.match(plan[0].body, /92\.5 kg × 3/);
    },
  },
  {
    name: 'notificationPlan: a record whose morning has passed is not resurrected',
    run() {
      const plan = planWith({
        prefs: { sessionReminders: false, comebackNudge: false, weeklySummary: false },
        latestPr: {
          exerciseName: 'Bench press',
          weightKg: 92.5,
          reps: 3,
          achievedAtMs: at(2026, 6, 28, 18, 40),
        },
      });
      assert.deepEqual(plan, []);
    },
  },
  {
    name: 'notificationPlan: quiet keeps one message a day and drops the rarest-loses',
    run() {
      const input = {
        prefs: { level: 'quiet' },
        lastSessionAtMs: at(2026, 6, 30, 18, 0),
        weekSessionCount: 2,
        weekVolumeKg: 5000,
        latestPr: {
          exerciseName: 'Squat',
          weightKg: 140,
          reps: 2,
          achievedAtMs: at(2026, 6, 30, 18, 0),
        },
      };

      const quiet = planWith(input);
      const byDay = new Map();
      quiet.forEach((item) => {
        const day = new Date(item.fireAtMs).toDateString();
        byDay.set(day, (byDay.get(day) ?? 0) + 1);
      });
      byDay.forEach((count) => assert.ok(count <= DAILY_CAP_BY_LEVEL.quiet, 'quiet caps at 1 per day'));

      // Sunday 2026-07-05 collides: the comeback nudge at 17:30 and the weekly
      // summary at 18:00 want the same single slot. The rarer one takes it.
      const sunday = quiet.filter((item) => new Date(item.fireAtMs).getDay() === 0);
      assert.equal(sunday.length, 1);
      assert.equal(sunday[0].category, 'comeback', 'a once-per-gap nudge outranks a weekly recap');
    },
  },
  {
    name: 'notificationPlan: a busy day keeps the record over the routine reminder',
    run() {
      const plan = planWith({
        prefs: { level: 'quiet', weeklySummary: false, comebackNudge: false },
        latestPr: {
          exerciseName: 'Deadlift',
          weightKg: 180,
          reps: 1,
          achievedAtMs: at(2026, 7, 2, 19, 0), // Thursday session
        },
      });

      // Friday 2026-07-03: record note at 09:00 vs the usual reminder at 17:30.
      const collisionDay = plan.filter(
        (item) => new Date(item.fireAtMs).toDateString() === new Date(at(2026, 7, 3)).toDateString(),
      );
      assert.equal(collisionDay.length, 1);
      assert.equal(collisionDay[0].category, 'record', 'a record outranks a weekly-recurring reminder');

      // The Fridays without a record still get their ordinary reminder.
      const laterFriday = plan.filter(
        (item) => new Date(item.fireAtMs).toDateString() === new Date(at(2026, 7, 10)).toDateString(),
      );
      assert.equal(laterFriday.length, 1);
      assert.equal(laterFriday[0].category, 'reminder');
    },
  },
  {
    name: 'notificationPlan: a higher level raises the cap it advertises',
    run() {
      assert.deepEqual(DAILY_CAP_BY_LEVEL, { quiet: 1, normal: 2, motivating: 3 });
    },
  },
  {
    name: 'notificationPlan: every planned key is unique so nothing schedules twice',
    run() {
      const plan = planWith({
        lastSessionAtMs: at(2026, 6, 30, 18, 0),
        weekSessionCount: 2,
        weekVolumeKg: 5000,
        latestPr: { exerciseName: 'Row', weightKg: 80, reps: 6, achievedAtMs: at(2026, 7, 1, 8, 0) },
      });

      const keys = plan.map((item) => item.key);
      assert.equal(new Set(keys).size, keys.length);
      plan.forEach((item) => {
        assert.ok(item.title.length > 0, `${item.key} needs a title`);
        assert.ok(item.body.length > 0, `${item.key} needs a body`);
      });
    },
  },
  {
    name: 'notificationPlan: the plan is ordered by fire time',
    run() {
      const plan = planWith({
        lastSessionAtMs: at(2026, 6, 30, 18, 0),
        weekSessionCount: 2,
        weekVolumeKg: 5000,
      });

      for (let index = 1; index < plan.length; index += 1) {
        assert.ok(plan[index].fireAtMs >= plan[index - 1].fireAtMs, 'sorted by fire time');
      }
    },
  },
  {
    name: 'notificationPlan: Finnish copy is used when the app is in Finnish',
    run() {
      const plan = planWith({
        language: 'fi',
        prefs: { sessionReminders: false, comebackNudge: false },
        weekSessionCount: 3,
        weekVolumeKg: 12400,
      });

      assert.equal(plan.length, 1);
      assert.match(plan[0].body, /3 treeniä/);
      assert.equal(plan[0].title, 'Viikkosi');
    },
  },
  {
    name: 'notificationPlan: a malformed reminder time falls back instead of drifting',
    run() {
      assert.deepEqual(parseReminderTime('06:45'), { hour: 6, minute: 45 });
      assert.deepEqual(parseReminderTime('25:00'), { hour: 17, minute: 30 });
      assert.deepEqual(parseReminderTime('7:5'), { hour: 17, minute: 30 });
      assert.deepEqual(parseReminderTime(null), { hour: 17, minute: 30 });
      assert.deepEqual(parseReminderTime(''), { hour: 17, minute: 30 });

      const plan = planWith({
        prefs: { reminderTime: 'nonsense', weeklySummary: false, comebackNudge: false },
      });
      assert.equal(plan[0].fireAtMs, at(2026, 7, 1, 17, 30));
    },
  },
];
