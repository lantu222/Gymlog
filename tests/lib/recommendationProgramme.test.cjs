const assert = require('node:assert/strict');

const {
  buildRecommendationProgrammeProfile,
  getRecommendationProgrammeSummary,
} = require('../../.test-dist/lib/recommendationProgramme.js');

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
];
