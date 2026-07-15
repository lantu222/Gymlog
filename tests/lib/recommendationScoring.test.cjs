const assert = require('node:assert/strict');

const { buildRecommendationInput } = require('../../.test-dist/lib/recommendationInput.js');
const { recommendPrograms } = require('../../.test-dist/lib/recommendationScoring.js');

module.exports = [
  {
    name: 'recommendation scoring prefers beginner strength for a 2-day strength beginner',
    run() {
      const result = recommendPrograms(
        buildRecommendationInput({
          goal: 'strength',
          level: 'beginner',
          daysPerWeek: 2,
          equipment: 'gym',
          secondaryOutcomes: ['consistency'],
          focusAreas: [],
          guidanceMode: 'guided_editable',
          scheduleMode: 'app_managed',
          weeklyMinutes: null,
          availableDays: [],
          gender: 'unspecified',
          unitPreference: 'kg',
        }),
      );

      assert.equal(result.featuredProgramId, 'tpl_2_day_beginner_strength_v1');
      assert.equal(result.secondaryProgramId, 'tpl_2_day_minimal_full_body_v1');
      assert.equal(result.primaryFamilyId, 'strength_base');
    },
  },
  {
    name: 'recommendation scoring keeps a 4-day muscle user on the muscle lane with a strength alternative',
    run() {
      const result = recommendPrograms(
        buildRecommendationInput({
          goal: 'muscle',
          level: 'intermediate',
          daysPerWeek: 4,
          equipment: 'gym',
          secondaryOutcomes: ['strength'],
          focusAreas: [],
          guidanceMode: 'guided_editable',
          scheduleMode: 'app_managed',
          weeklyMinutes: null,
          availableDays: [],
          gender: 'unspecified',
          unitPreference: 'kg',
        }),
      );

      assert.equal(result.featuredProgramId, 'tpl_4_day_upper_lower_v1');
      assert.equal(result.secondaryProgramId, 'tpl_4_day_powerbuilding_v1');
    },
  },
  {
    name: 'recommendation scoring limits home setups to low-equipment options',
    run() {
      const result = recommendPrograms(
        buildRecommendationInput({
          goal: 'muscle',
          level: 'beginner',
          daysPerWeek: 4,
          equipment: 'home',
          secondaryOutcomes: ['consistency'],
          focusAreas: [],
          guidanceMode: 'guided_editable',
          scheduleMode: 'app_managed',
          weeklyMinutes: null,
          availableDays: [],
          gender: 'unspecified',
          unitPreference: 'kg',
        }),
      );

      assert.equal(result.featuredProgramId, 'tpl_gainer_at_home_beginner_v1');
      assert.equal(
        result.scoredCandidates.every((candidate) =>
          candidate.programId.startsWith('tpl_2_day_') ||
          candidate.programId === 'tpl_3_day_run_mobility_v1' ||
          candidate.programId.startsWith('tpl_gainer_at_home_') ||
          candidate.programId === 'tpl_gainer_fat_burn_hiit_v1' ||
          candidate.programId === 'tpl_gainer_mobility_flow_v1',
        ),
        true,
      );
    },
  },
  {
    name: 'recommendation scoring lets tailoring reorder close 4-day strength candidates',
    run() {
      const result = recommendPrograms(
        buildRecommendationInput({
          goal: 'strength',
          level: 'intermediate',
          daysPerWeek: 4,
          equipment: 'gym',
          secondaryOutcomes: ['muscle'],
          focusAreas: [],
          guidanceMode: 'guided_editable',
          scheduleMode: 'app_managed',
          weeklyMinutes: null,
          availableDays: [],
          gender: 'unspecified',
          unitPreference: 'kg',
        }),
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

      assert.equal(result.featuredProgramId, 'tpl_4_day_strength_size_v1');
    },
  },
  {
    name: 'recommendation scoring uses program fit gender as a soft signal',
    run() {
      const femaleResult = recommendPrograms(
        buildRecommendationInput({
          goal: 'muscle',
          level: 'beginner',
          daysPerWeek: 3,
          equipment: 'gym',
          secondaryOutcomes: [],
          focusAreas: ['glutes'],
          guidanceMode: 'guided_editable',
          scheduleMode: 'app_managed',
          weeklyMinutes: null,
          availableDays: [],
          gender: 'female',
          unitPreference: 'kg',
        }),
      );
      const maleResult = recommendPrograms(
        buildRecommendationInput({
          goal: 'muscle',
          level: 'intermediate',
          daysPerWeek: 5,
          equipment: 'gym',
          secondaryOutcomes: [],
          focusAreas: ['chest', 'arms'],
          guidanceMode: 'guided_editable',
          scheduleMode: 'app_managed',
          weeklyMinutes: null,
          availableDays: [],
          gender: 'male',
          unitPreference: 'kg',
        }),
      );

      assert.equal(femaleResult.featuredProgramId, 'tpl_gainer_glute_foundations_v1');
      assert.equal(maleResult.featuredProgramId, 'tpl_gainer_dream_body_man_v1');
      assert.equal(femaleResult.scoredCandidates[0].breakdown.genderFit > 0, true);
      assert.equal(maleResult.scoredCandidates[0].breakdown.genderFit > 0, true);
    },
  },
  {
    name: 'recommendation scoring penalizes content that does not fit the requested goal',
    run() {
      const result = recommendPrograms(
        buildRecommendationInput({
          goal: 'run_mobility',
          level: 'beginner',
          daysPerWeek: 3,
          equipment: 'gym',
          secondaryOutcomes: ['conditioning', 'mobility'],
          focusAreas: [],
          guidanceMode: 'guided_editable',
          scheduleMode: 'app_managed',
          weeklyMinutes: null,
          availableDays: [],
          gender: 'unspecified',
          unitPreference: 'kg',
        }),
      );
      const runCandidate = result.scoredCandidates.find((candidate) => candidate.programId === 'tpl_3_day_run_mobility_v1');
      const strengthCandidate = result.scoredCandidates.find((candidate) => candidate.programId === 'tpl_3_day_strength_base_v1');

      assert.equal(result.featuredProgramId, 'tpl_3_day_run_mobility_v1');
      assert.ok(runCandidate);
      assert.ok(strengthCandidate);
      assert.equal(runCandidate.breakdown.contentFit > 0, true);
      assert.equal(strengthCandidate.breakdown.contentFit < 0, true);
    },
  },
  {
    name: 'recommendation scoring marks 5-day strength as an explicit optional-day fallback',
    run() {
      const result = recommendPrograms(
        buildRecommendationInput({
          goal: 'strength',
          level: 'intermediate',
          daysPerWeek: 5,
          equipment: 'gym',
          secondaryOutcomes: ['consistency'],
          focusAreas: [],
          guidanceMode: 'guided_editable',
          scheduleMode: 'app_managed',
          weeklyMinutes: null,
          availableDays: [],
          gender: 'unspecified',
          unitPreference: 'kg',
        }),
      );

      assert.equal(result.featuredProgramId, 'tpl_4_day_strength_size_v1');
      assert.match(result.fallbackReason, /optional/i);
      assert.equal(result.recommendationConfidence < 1, true);
      assert.equal(result.trainingBlock.blockLengthWeeks, 4);
      assert.equal(result.trainingBlock.currentWeek, 1);
      assert.equal(result.trainingBlock.currentWeekRole, 'baseline');
      assert.match(result.trainingBlock.nextWeekAction, /week 2/i);
    },
  },
  {
    name: 'recommendation scoring caps a 6-day general fitness beginner at the core 3-day tier',
    run() {
      const result = recommendPrograms(
        buildRecommendationInput({
          goal: 'general_fitness',
          level: 'beginner',
          daysPerWeek: 6,
          equipment: 'gym',
          secondaryOutcomes: ['consistency'],
          focusAreas: [],
          guidanceMode: 'guided_editable',
          scheduleMode: 'app_managed',
          weeklyMinutes: null,
          availableDays: [],
          gender: 'unspecified',
          unitPreference: 'kg',
        }),
      );

      // Experience first: a beginner asking for 6 days starts at the 3-day core tier.
      assert.equal(result.featuredProgramId, 'tpl_3_day_full_body_v1');
      assert.equal(result.waterfall.rule, 'beginner_first');
    },
  },
];
