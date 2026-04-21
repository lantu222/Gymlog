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
    name: 'recommendation scoring shifts a 4-day muscle user with strength blend toward powerbuilding',
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

      assert.equal(result.featuredProgramId, 'tpl_4_day_powerbuilding_v1');
      assert.equal(result.secondaryProgramId, 'tpl_4_day_muscle_builder_v1');
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

      assert.equal(result.featuredProgramId, 'tpl_2_day_minimal_full_body_v1');
      assert.equal(result.scoredCandidates.every((candidate) => candidate.programId.startsWith('tpl_2_day_') || candidate.programId === 'tpl_3_day_run_mobility_v1'), true);
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
];
