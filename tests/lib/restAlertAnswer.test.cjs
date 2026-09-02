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
    name: 'restAlertsAnswered: Allow on a fresh install turns the phone on for the workout alone',
    run() {
      // Measured 2026-09-02: the ask granted the permission and never touched
      // the master switch the ladder is gated on — one ladder, then silence.
      const next = restAlertsAnswered(FRESH, 'granted');
      assert.equal(next.restAlertsAsked, true);
      assert.equal(next.pushEnabled, true);
      assert.equal(next.restAlerts, true);
      // "Only during a workout. Never a marketing push." — the categories
      // that default to on stay off when THIS is what switched the phone on.
      assert.equal(next.personalRecords, false);
      assert.equal(next.weeklySummary, false);
      assert.equal(next.comebackNudge, false);
      // Untouched: the reader's other choices.
      assert.equal(next.sessionReminders, false);
      assert.equal(next.restWarning, true);
      assert.equal(next.level, 'normal');
    },
  },
  {
    name: 'restAlertsAnswered: a master switch already on keeps every choice the reader made',
    run() {
      const on = { ...FRESH, pushEnabled: true, weeklySummary: true, restAlerts: false };
      const next = restAlertsAnswered(on, 'granted');
      assert.deepEqual(next, { ...on, restAlertsAsked: true });
    },
  },
  {
    name: 'restAlertsAnswered: Not now and a denied dialog record the ask and change nothing else',
    run() {
      assert.deepEqual(restAlertsAnswered(FRESH, 'later'), { ...FRESH, restAlertsAsked: true });
      assert.deepEqual(restAlertsAnswered(FRESH, 'denied'), { ...FRESH, restAlertsAsked: true });
      // Pure: the input is not written to.
      assert.equal(FRESH.restAlertsAsked, false);
    },
  },
];
