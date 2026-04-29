const assert = require('node:assert/strict');

const {
  buildRecommendationOptionIds,
  getFallbackReasonCopy,
  getRecommendationConfidenceCopy,
} = require('../../.test-dist/lib/recommendationPresentation.js');

module.exports = [
  {
    name: 'recommendation presentation builds a unique ordered option list from primary secondary and alternatives',
    run() {
      const optionIds = buildRecommendationOptionIds({
        featuredProgramId: 'tpl_primary',
        secondaryProgramId: 'tpl_secondary',
        alternativeProgramIds: ['tpl_secondary', 'tpl_third', 'tpl_primary', 'tpl_fourth'],
      });

      assert.deepEqual(optionIds, ['tpl_primary', 'tpl_secondary', 'tpl_third', 'tpl_fourth']);
    },
  },
  {
    name: 'recommendation presentation returns an uncertainty message for low confidence',
    run() {
      const copy = getRecommendationConfidenceCopy('low');

      assert.equal(copy.title, 'Close match');
      assert.match(copy.body, /close/i);
    },
  },
  {
    name: 'recommendation presentation explains explicit fallback reasons',
    run() {
      const copy = getFallbackReasonCopy('Closest structured plan with optional extra day.');

      assert.match(copy.title, /Closest match/i);
      assert.match(copy.body, /optional extra day/i);
    },
  },
];
