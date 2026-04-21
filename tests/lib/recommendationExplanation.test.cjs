const assert = require('node:assert/strict');

const {
  buildRecommendationReasonLines,
  buildRecommendationTradeoffLabel,
} = require('../../.test-dist/lib/recommendationExplanation.js');
const { buildRecommendationInput } = require('../../.test-dist/lib/recommendationInput.js');
const { recommendPrograms } = require('../../.test-dist/lib/recommendationScoring.js');

module.exports = [
  {
    name: 'recommendation explanation builds concise reasons from onboarding inputs',
    run() {
      const reasons = buildRecommendationReasonLines(
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
  {
    name: 'recommendation explanation describes the tradeoff for a secondary alternative',
    run() {
      const result = recommendPrograms(
        buildRecommendationInput({
          goal: 'muscle',
          level: 'intermediate',
          daysPerWeek: 4,
          equipment: 'gym',
          secondaryOutcomes: ['strength'],
          focusAreas: ['arms'],
          guidanceMode: 'guided_editable',
          scheduleMode: 'app_managed',
          weeklyMinutes: null,
          availableDays: [],
          gender: 'unspecified',
          unitPreference: 'kg',
        }),
      );

      const primaryCandidate = result.scoredCandidates[0];
      const alternativeCandidate = result.scoredCandidates.find((candidate) => candidate.programId === result.secondaryProgramId);

      assert.ok(primaryCandidate);
      assert.ok(alternativeCandidate);

      const tradeoff = buildRecommendationTradeoffLabel(primaryCandidate, alternativeCandidate);

      assert.ok(tradeoff);
      assert.match(tradeoff, /goal|week|focus|preference|equipment|experience/i);
    },
  },
];
