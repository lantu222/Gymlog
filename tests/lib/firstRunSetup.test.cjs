const assert = require('node:assert/strict');

const {
  buildFirstRunRecommendationReasons,
  buildScheduleFitNote,
  buildFirstRunCustomProgramName,
  buildFirstRunPromptSuggestions,
  resolveProjectedTrainingDays,
  resolveFirstRunRecommendation,
  resolveFirstRunRecommendationWithTailoring,
} = require('../../.test-dist/lib/firstRunSetup.js');

module.exports = [
  {
    name: 'first-run setup recommends beginner strength for a 2-day beginner strength setup',
    run() {
      const recommendation = resolveFirstRunRecommendation({
        goal: 'strength',
        level: 'beginner',
        daysPerWeek: 2,
        equipment: 'gym',
        secondaryOutcomes: ['consistency'],
        focusAreas: [],
        guidanceMode: 'guided_editable',
        unitPreference: 'kg',
      });

      assert.equal(recommendation.featuredProgramId, 'tpl_2_day_beginner_strength_v1');
      assert.equal(recommendation.secondaryProgramId, 'tpl_2_day_minimal_full_body_v1');
      assert.equal(recommendation.mismatchNote, null);
    },
  },
  {
    name: 'first-run setup recommends strength base for a 3-day strength setup',
    run() {
      const recommendation = resolveFirstRunRecommendation({
        goal: 'strength',
        level: 'intermediate',
        daysPerWeek: 3,
        equipment: 'gym',
        secondaryOutcomes: ['consistency'],
        focusAreas: [],
        guidanceMode: 'guided_editable',
        unitPreference: 'kg',
      });

      assert.equal(recommendation.featuredProgramId, 'tpl_3_day_strength_base_v1');
      assert.equal(recommendation.secondaryProgramId, 'tpl_2_day_beginner_strength_v1');
    },
  },
  {
    name: 'first-run setup falls back to low-equipment plans when the user has home equipment',
    run() {
      const recommendation = resolveFirstRunRecommendation({
        goal: 'muscle',
        level: 'beginner',
        daysPerWeek: 4,
        equipment: 'home',
        secondaryOutcomes: ['consistency'],
        focusAreas: [],
        guidanceMode: 'guided_editable',
        unitPreference: 'kg',
      });

      assert.equal(recommendation.featuredProgramId, 'tpl_2_day_minimal_full_body_v1');
      assert.ok(recommendation.mismatchNote);
      assert.match(recommendation.mismatchNote, /lighter equipment/i);
    },
  },
  {
    name: 'first-run setup recommends run and mobility with yoga as the secondary 4-day option',
    run() {
      const recommendation = resolveFirstRunRecommendation({
        goal: 'run_mobility',
        level: 'beginner',
        daysPerWeek: 4,
        equipment: 'minimal',
        secondaryOutcomes: ['mobility'],
        focusAreas: [],
        guidanceMode: 'done_for_me',
        unitPreference: 'kg',
      });

      assert.equal(recommendation.featuredProgramId, 'tpl_3_day_run_mobility_v1');
      assert.equal(recommendation.secondaryProgramId, 'tpl_2_day_yoga_recovery_v1');
      assert.match(recommendation.mismatchNote, /closest match/i);
    },
  },
  {
    name: 'first-run setup prompt suggestions reflect the selected days and goal',
    run() {
      const suggestions = buildFirstRunPromptSuggestions(
        {
          goal: 'strength',
          level: 'beginner',
          daysPerWeek: 3,
          equipment: 'gym',
          secondaryOutcomes: ['consistency', 'mobility'],
          focusAreas: ['arms'],
          guidanceMode: 'guided_editable',
          scheduleMode: 'self_managed',
          weeklyMinutes: 180,
          availableDays: ['mon', 'wed', 'fri'],
          unitPreference: 'kg',
        },
        '3-Day Strength Base',
      );

      assert.equal(suggestions.length, 3);
      assert.match(suggestions[0], /Best 3-day strength start/i);
      assert.match(suggestions[1], /3-Day Strength Base/);
      assert.match(suggestions[1], /another plan/i);
      assert.match(suggestions[2], /How should I start with 3 days/i);
    },
  },
  {
    name: 'first-run setup shifts 4-day muscle users toward powerbuilding when strength also matters',
    run() {
      const recommendation = resolveFirstRunRecommendation({
        goal: 'muscle',
        level: 'intermediate',
        daysPerWeek: 4,
        equipment: 'gym',
        secondaryOutcomes: ['strength'],
        focusAreas: [],
        guidanceMode: 'guided_editable',
        unitPreference: 'kg',
      });

      assert.equal(recommendation.featuredProgramId, 'tpl_4_day_powerbuilding_v1');
      assert.equal(recommendation.secondaryProgramId, 'tpl_4_day_muscle_builder_v1');
    },
  },
  {
    name: 'tailoring can bias a 4-day strength recommendation away from powerbuilding toward the steadier option',
    run() {
      const recommendation = resolveFirstRunRecommendationWithTailoring(
        {
          goal: 'strength',
          level: 'intermediate',
          daysPerWeek: 4,
          equipment: 'gym',
          secondaryOutcomes: ['muscle'],
          focusAreas: [],
          guidanceMode: 'guided_editable',
          unitPreference: 'kg',
        },
        {
          setupEquipment: 'gym',
          setupFreeWeightsPreference: 'avoid',
          setupBodyweightPreference: 'neutral',
          setupMachinesPreference: 'love',
          setupShoulderFriendlySwaps: 'prioritize',
          setupElbowFriendlySwaps: 'neutral',
          setupKneeFriendlySwaps: 'neutral',
        },
      );

      assert.equal(recommendation.featuredProgramId, 'tpl_4_day_strength_size_v1');
    },
  },
  {
    name: 'first-run setup can bias a 2-day general setup toward mobility reset when mobility matters',
    run() {
      const recommendation = resolveFirstRunRecommendation({
        goal: 'general',
        level: 'beginner',
        daysPerWeek: 2,
        equipment: 'gym',
        secondaryOutcomes: ['mobility', 'consistency'],
        focusAreas: [],
        guidanceMode: 'done_for_me',
        unitPreference: 'kg',
      });

      assert.equal(recommendation.featuredProgramId, 'tpl_2_day_mobility_reset_v1');
      assert.equal(recommendation.secondaryProgramId, 'tpl_2_day_minimal_full_body_v1');
    },
  },
  {
    name: 'first-run custom split names carry focus areas when selected',
    run() {
      const name = buildFirstRunCustomProgramName({
        goal: 'muscle',
        level: 'beginner',
        daysPerWeek: 4,
        equipment: 'gym',
        secondaryOutcomes: ['consistency'],
        focusAreas: ['arms', 'core'],
        guidanceMode: 'self_directed',
        scheduleMode: 'app_managed',
        weeklyMinutes: null,
        availableDays: [],
        unitPreference: 'kg',
      });

      assert.match(name, /4-Day Muscle/i);
      assert.match(name, /Arms & Core/i);
    },
  },
  {
    name: 'self-managed schedule picks evenly spaced projected days from the selected week',
    run() {
      const projectedDays = resolveProjectedTrainingDays(
        {
          scheduleMode: 'self_managed',
          availableDays: ['mon', 'tue', 'thu', 'sat'],
        },
        3,
      );

      assert.deepEqual(projectedDays, ['mon', 'thu', 'sat']);
    },
  },
  {
    name: 'schedule fit note warns when the weekly budget is tighter than the default split',
    run() {
      const note = buildScheduleFitNote(
        {
          scheduleMode: 'self_managed',
          weeklyMinutes: 140,
          availableDays: ['mon', 'wed', 'fri', 'sat'],
        },
        4,
        55,
      );

      assert.match(note, /tight week/i);
    },
  },
  {
    name: 'recommendation reasons explain goal, schedule, and focus succinctly',
    run() {
      const reasons = buildFirstRunRecommendationReasons(
        {
          goal: 'muscle',
          level: 'intermediate',
          daysPerWeek: 4,
          equipment: 'gym',
          secondaryOutcomes: ['strength'],
          focusAreas: ['arms'],
          guidanceMode: 'guided_editable',
          scheduleMode: 'self_managed',
          weeklyMinutes: 220,
          availableDays: ['mon', 'tue', 'thu', 'sat'],
          unitPreference: 'kg',
        },
        {
          projectedDaysPerWeek: 4,
          estimatedSessionDuration: 55,
          mismatchNote: null,
        },
      );

      assert.equal(reasons.length >= 3, true);
      assert.match(reasons[0], /muscle/i);
      assert.match(reasons[1], /220 minutes|220/i);
      assert.match(reasons[2], /Arms|focus/i);
    },
  },
];
