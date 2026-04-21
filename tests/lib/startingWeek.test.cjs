const assert = require('node:assert/strict');

const { buildStartingWeekView } = require('../../.test-dist/lib/startingWeek.js');

module.exports = [
  {
    name: 'starting week view builds a real weekly handoff from the recommended program',
    run() {
      const week = buildStartingWeekView(
        {
          goal: 'strength',
          level: 'intermediate',
          daysPerWeek: 3,
          equipment: 'gym',
          secondaryOutcomes: ['consistency'],
          focusAreas: [],
          guidanceMode: 'guided_editable',
          scheduleMode: 'self_managed',
          weeklyMinutes: 180,
          availableDays: ['mon', 'wed', 'fri'],
          currentWeightKg: null,
          targetWeightKg: null,
          unitPreference: 'kg',
        },
        'tpl_3_day_strength_base_v1',
      );

      assert.ok(week);
      assert.equal(week.title, 'Your starting week');
      assert.equal(week.programName, '3-Day Strength Base');
      assert.deepEqual(week.rhythm, ['Mon', 'Wed', 'Fri']);
      assert.equal(week.sessions.length, 3);
      assert.match(week.sessions[0].meta, /55 min/i);
      assert.equal(week.sessions[0].weekdayLabel, 'Mon');
      assert.equal(week.helperPrompt.includes('another plan'), true);
      assert.match(week.programmeSummary, /week|easier week|deload|pivot/i);
    },
  },
  {
    name: 'starting week view reflects edit mode copy for setup review',
    run() {
      const week = buildStartingWeekView(
        {
          goal: 'muscle',
          level: 'intermediate',
          daysPerWeek: 4,
          equipment: 'gym',
          secondaryOutcomes: ['strength'],
          focusAreas: ['arms'],
          guidanceMode: 'guided_editable',
          scheduleMode: 'app_managed',
          weeklyMinutes: 220,
          availableDays: [],
          currentWeightKg: null,
          targetWeightKg: null,
          unitPreference: 'kg',
        },
        'tpl_4_day_powerbuilding_v1',
        'edit',
      );

      assert.ok(week);
      assert.equal(week.title, 'Your updated week');
      assert.equal(week.source, 'edit');
      assert.equal(week.daysPerWeek, 4);
      assert.equal(week.reasons.length >= 2, true);
    },
  },
];
