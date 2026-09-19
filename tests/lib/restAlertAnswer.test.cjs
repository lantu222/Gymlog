const assert = require('node:assert/strict');

const { restAlertsAnswered } = require('../../.test-dist/lib/restAlertAnswer.js');

const FRESH = {
  pushEnabled: false,
  level: 'normal',
  personalRecords: true,
  weeklySummary: true,
  comebackNudge: true,
  sessionReminders: false,
  reminderTime: '17:30',
  weighInReminder: false,
  restAlerts: true,
  restWarning: true,
  sessionOngoing: true,
  idleNudge: true,
  restAlertsAsked: false,
};

module.exports = [
  {
    name: 'restAlertsAnswered: Allow records the ask and keeps the end-of-rest alert on, and nothing else',
    run() {
      // The rest alerts have their own switches now (user 2026-09-17). The
      // phone's Notifications switch governs the scheduled reminders, so the
      // answer to a question about rest alerts leaves it where it was.
      const next = restAlertsAnswered(FRESH, 'granted');
      assert.deepEqual(next, { ...FRESH, restAlertsAsked: true });
      assert.equal(next.pushEnabled, false, 'the rest ask switched the reminders on');
      // A reader who said yes to "rings when rest ends" wants the alert.
      const offBefore = restAlertsAnswered({ ...FRESH, restAlerts: false }, 'granted');
      assert.equal(offBefore.restAlerts, true);
      // The reminder categories are not this sheet's business either way.
      const on = { ...FRESH, pushEnabled: true, weeklySummary: true };
      assert.deepEqual(restAlertsAnswered(on, 'granted'), { ...on, restAlertsAsked: true });
    },
  },
  {
    name: 'restAlertsAnswered: Not now and a denied dialog record the ask and change nothing else',
    run() {
      assert.deepEqual(restAlertsAnswered(FRESH, 'later'), { ...FRESH, restAlertsAsked: true });
      assert.deepEqual(restAlertsAnswered(FRESH, 'denied'), { ...FRESH, restAlertsAsked: true });
      // A reader who switched the alert off keeps it off when they only
      // dismissed the sheet.
      const off = { ...FRESH, restAlerts: false };
      assert.equal(restAlertsAnswered(off, 'later').restAlerts, false);
      // Pure: the input is not written to.
      assert.equal(FRESH.restAlertsAsked, false);
    },
  },
];
