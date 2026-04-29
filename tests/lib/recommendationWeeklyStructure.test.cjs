const assert = require('node:assert/strict');

const { buildRecommendationWeeklyStructure } = require('../../.test-dist/lib/recommendationWeeklyStructure.js');

const baseSelection = {
  gender: 'unspecified',
  age: 30,
  ageRange: '26_35',
  goal: 'strength',
  level: 'intermediate',
  daysPerWeek: 3,
  equipment: 'gym',
  secondaryOutcomes: ['consistency'],
  focusAreas: [],
  guidanceMode: 'guided_editable',
  scheduleMode: 'app_managed',
  weeklyMinutes: null,
  availableDays: [],
  currentWeightKg: null,
  targetWeightKg: null,
  unitPreference: 'kg',
};

function selection(overrides) {
  return {
    ...baseSelection,
    ...overrides,
    secondaryOutcomes: overrides.secondaryOutcomes ?? baseSelection.secondaryOutcomes,
    focusAreas: overrides.focusAreas ?? baseSelection.focusAreas,
    availableDays: overrides.availableDays ?? baseSelection.availableDays,
  };
}

module.exports = [
  {
    name: 'recommendation weekly structure adds a concrete optional 5th day for 5-day strength fallback',
    run() {
      const structure = buildRecommendationWeeklyStructure(
        selection({
          goal: 'strength',
          daysPerWeek: 5,
          equipment: 'gym',
          currentWeightKg: 100,
          targetWeightKg: 120,
        }),
        'tpl_4_day_powerbuilding_v1',
      );

      assert.ok(structure);
      assert.equal(structure.programDaysPerWeek, 4);
      assert.equal(structure.requestedDaysPerWeek, 5);
      assert.equal(structure.days.length, 5);
      assert.deepEqual(
        structure.days.map((day) => day.weekdayLabel),
        ['Mon', 'Tue', 'Thu', 'Fri', 'Sat'],
      );
      assert.equal(structure.days[4].source, 'suggested');
      assert.match(structure.days[4].name, /accessory/i);
      assert.match(structure.summary, /4-day strength plan.*optional 5th/i);
    },
  },
  {
    name: 'recommendation weekly structure makes 5-day endurance concrete from the 3-day run base',
    run() {
      const structure = buildRecommendationWeeklyStructure(
        selection({
          goal: 'run_mobility',
          daysPerWeek: 5,
          equipment: 'minimal',
          secondaryOutcomes: ['conditioning', 'mobility'],
        }),
        'tpl_3_day_run_mobility_v1',
      );

      assert.ok(structure);
      assert.equal(structure.programDaysPerWeek, 3);
      assert.equal(structure.requestedDaysPerWeek, 5);
      assert.equal(structure.days.length, 5);
      assert.equal(structure.days[3].source, 'suggested');
      assert.equal(structure.days[4].source, 'suggested');
      assert.match(structure.days[3].name, /easy run/i);
      assert.match(structure.days[4].name, /long run/i);
      assert.match(structure.summary, /3-day run.*2 optional/i);
    },
  },
  {
    name: 'recommendation weekly structure gives home muscle fallback clear extra days',
    run() {
      const structure = buildRecommendationWeeklyStructure(
        selection({
          goal: 'muscle',
          daysPerWeek: 4,
          equipment: 'home',
        }),
        'tpl_2_day_minimal_full_body_v1',
      );

      assert.ok(structure);
      assert.equal(structure.programDaysPerWeek, 2);
      assert.equal(structure.requestedDaysPerWeek, 4);
      assert.equal(structure.days.length, 4);
      assert.equal(structure.days[2].source, 'suggested');
      assert.equal(structure.days[3].source, 'suggested');
      assert.match(structure.days[2].name, /bodyweight volume/i);
      assert.match(structure.days[3].name, /mobility|conditioning/i);
      assert.match(structure.summary, /2-day home-friendly base.*2 optional/i);
    },
  },
];
