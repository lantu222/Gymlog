const assert = require('node:assert/strict');

const {
  buildRecommendationPlanReadyPayload,
  buildRecommendationProgrammeProfile,
  getRecommendationProgrammeSummary,
} = require('../../.test-dist/lib/recommendationProgramme.js');

const baseSelection = {
  gender: 'unspecified',
  age: 30,
  ageRange: '26_35',
  goal: 'strength',
  level: 'intermediate',
  daysPerWeek: 3,
  equipment: 'gym',
  trainingEnvironment: 'full_gym',
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

function selection(overrides = {}) {
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
    name: 'recommendation programme builds a 4-week strength block with an easier review week',
    run() {
      const profile = buildRecommendationProgrammeProfile('tpl_3_day_strength_base_v1');

      assert.equal(profile.blockLengthWeeks, 4);
      assert.equal(profile.progressionStyle, 'strength_wave');
      assert.equal(profile.easierWeek.week, 4);
      assert.match(profile.phaseLabels[0], /Week 1/i);
      assert.match(profile.phaseLabels[3], /Week 4/i);
      assert.match(profile.volumeProgression, /volume/i);
      assert.match(profile.intensityProgression, /intensity|load/i);
    },
  },
  {
    name: 'recommendation programme summary explains the heavy plus volume split for powerbuilding',
    run() {
      const summary = getRecommendationProgrammeSummary('tpl_4_day_powerbuilding_v1');

      assert.ok(summary);
      assert.match(summary, /4-week/i);
      assert.match(summary, /heavy|strength/i);
      assert.match(summary, /volume|hypertrophy|muscle/i);
      assert.match(summary, /easier week|pivot|deload/i);
    },
  },
  {
    name: 'recommendation plan-ready payload exposes documented myplan fields',
    run() {
      const payload = buildRecommendationPlanReadyPayload(
        selection({
          goal: 'muscle',
          level: 'intermediate',
          daysPerWeek: 5,
          equipment: 'gym',
          currentWeightKg: 80,
          targetWeightKg: 90,
          focusAreas: ['chest', 'back'],
        }),
        'tpl_5_day_hybrid_v1',
      );

      assert.equal(payload.programId, 'tpl_5_day_hybrid_v1');
      assert.equal(payload.blockLengthWeeks, 4);
      assert.ok(payload.title.length > 0);
      assert.match(payload.subtitle, /goals|schedule|recovery|muscle/i);
      assert.equal('starterNote' in payload, false);
      assert.equal(payload.weeklySchedule.length, 5);
      assert.equal(payload.fourWeekProgression.length, 4);
      assert.deepEqual(
        payload.fourWeekProgression.map((week) => week.role),
        ['baseline', 'build', 'build', 'review'],
      );
      assert.ok(payload.whyThisPlan.some((reason) => /muscle|gain/i.test(reason)));
      assert.ok(payload.whyThisPlan.length <= 4);
      assert.ok(payload.whyThisPlan.every((reason) => reason.length <= 34), payload.whyThisPlan.join(' | '));
      assert.ok(payload.whyThisPlan.some((reason) => /5 days/i.test(reason)));
      assert.match(payload.focusAllocation, /Pecs|Back|focus/i);
      assert.match(payload.howToProgress, /reps|load|volume/i);
      assert.match(payload.readinessGuardrail, /intermediate|recovery|build/i);
      assert.match(payload.firstAction, /start|open|begin/i);
    },
  },
  {
    name: 'recommendation plan-ready payload explains coherent fallback days',
    run() {
      const payload = buildRecommendationPlanReadyPayload(
        selection({
          goal: 'strength',
          level: 'beginner',
          daysPerWeek: 5,
          equipment: 'gym',
        }),
        'tpl_2_day_beginner_strength_v1',
        { fallbackReason: 'Closest structured plan with optional extra day.' },
      );

      assert.equal(payload.requestedDaysPerWeek, 5);
      assert.equal(payload.programDaysPerWeek, 2);
      assert.equal(payload.weeklySchedule.length, 5);
      assert.ok(payload.weeklySchedule.some((day) => day.source === 'suggested'));
      assert.match(payload.fallbackReason ?? '', /optional extra day/i);
      assert.ok(payload.whyThisPlan.length <= 4);
      assert.ok(payload.whyThisPlan.every((reason) => reason.length <= 34), payload.whyThisPlan.join(' | '));
      assert.doesNotMatch(payload.whyThisPlan.join(' '), /Gymlog recommends|starting point|optional extra day/i);
      assert.match(payload.readinessGuardrail, /beginner|conservative|recovery/i);
    },
  },
  {
    name: 'recommendation plan-ready payload gives every selected day a visible plan item',
    run() {
      const payload = buildRecommendationPlanReadyPayload(
        selection({
          goal: 'muscle',
          level: 'beginner',
          daysPerWeek: 6,
          equipment: 'home',
          trainingEnvironment: 'bodyweight_only',
        }),
        'tpl_2_day_minimal_full_body_v1',
      );

      assert.equal(payload.requestedDaysPerWeek, 6);
      assert.equal(payload.weeklySchedule.length, 6);
      assert.equal(new Set(payload.weeklySchedule.map((day) => day.weekdayLabel)).size, 6);
      assert.equal(payload.weeklySchedule.filter((day) => day.source === 'suggested').length, 4);
      assert.ok(payload.weeklySchedule.every((day) => day.name.length > 0));
      assert.ok(payload.weeklySchedule.every((day) => day.keyLifts.length > 0));
      assert.ok(payload.whyThisPlan.includes('6 days / week.'));
      assert.ok(payload.planOverview.includes('6 workouts / week'));
    },
  },
];
