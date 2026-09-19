const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { resolveReminderSchedule, reminderWeekdays } = require('../../.test-dist/lib/reminderSchedule.js');
const { isScheduleKnown, trainsOn } = require('../../.test-dist/lib/trainingSchedule.js');

const ROOT = path.join(__dirname, '..', '..');
const strip = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const read = (...parts) => strip(fs.readFileSync(path.join(ROOT, ...parts), 'utf8'));

const NO_PLAN = [];
const MON_THU = [{ label: 'mon' }, { label: 'thu' }];

/**
 * The rhythm the training-day reminders follow, and the two screens that say
 * whether there is one (audit 2026-09-16, S6): "No training days picked yet"
 * beside reminders that were firing on the plan's own days.
 */
module.exports = [
  {
    name: 'reminder schedule: a cycle first, then the plan’s weekdays, then the days setup left open',
    run() {
      const anchor = new Date(2026, 8, 14).getTime();
      const cycle = resolveReminderSchedule({
        trainingCycle: { pattern: [true, true, false], anchorDayStart: anchor },
        planEntries: MON_THU,
        availableDays: ['tue'],
      });
      assert.equal(cycle.kind, 'cycle');
      assert.equal(trainsOn(cycle, new Date(2026, 8, 16)), false, 'the cycle’s rest day');
      assert.deepEqual(reminderWeekdays(cycle), [], 'a cycle has no weekdays to name');

      const named = resolveReminderSchedule({ trainingCycle: null, planEntries: MON_THU, availableDays: ['tue'] });
      assert.deepEqual(reminderWeekdays(named), ['mon', 'thu']);

      const open = resolveReminderSchedule({
        trainingCycle: null,
        planEntries: [{ label: 'Day 1' }, { label: 'mon' }],
        availableDays: ['fri', 'tue'],
      });
      assert.deepEqual(reminderWeekdays(open), ['tue', 'fri'], 'a positional plan names no days');

      const none = resolveReminderSchedule({ trainingCycle: null, planEntries: NO_PLAN, availableDays: [] });
      assert.equal(isScheduleKnown(none), false);
      // The case the screens got wrong: nothing picked in setup, and still a
      // rhythm the reminders fire on.
      assert.equal(
        isScheduleKnown(resolveReminderSchedule({ trainingCycle: null, planEntries: MON_THU, availableDays: [] })),
        true,
      );
    },
  },
  {
    name: 'reminder schedule: the settings screens read the rule the reminders follow',
    run() {
      const screen = read('src', 'screens', 'NotificationsScreen.tsx');
      assert.match(screen, /const remindersWithoutDays = prefs\.sessionReminders && !scheduleKnown;/);
      assert.doesNotMatch(screen, /trainingDays/);

      const tab = read('src', 'app', 'renderProfileTab.tsx');
      assert.match(tab, /scheduleKnown=\{isScheduleKnown\(reminderSchedule\(\)\)\}/);
      assert.match(
        tab,
        /resolveReminderSchedule\(\{\s*trainingCycle: preferences\.trainingCycle,\s*planEntries: database\.workoutPlans\.find\(\(plan\) => plan\.id === preferences\.activePlanId\)\?\.entries \?\? \[\],\s*availableDays: preferences\.setupAvailableDays,\s*\}\)/,
      );
      // The plan screen shows the days reminders follow when setup left none.
      assert.match(
        tab,
        /trainingDays=\{\s*preferences\.setupAvailableDays\.length > 0\s*\? preferences\.setupAvailableDays\s*: reminderWeekdays\(reminderSchedule\(\)\)\s*\}/,
      );
      assert.doesNotMatch(tab, /trainingDays=\{preferences\.setupAvailableDays\}/);
    },
  },
];
