const assert = require('node:assert/strict');

const { buildPremiumHeroChart } = require('../../.test-dist/lib/premiumHeroChart.js');

function summary(name, weights) {
  // logs are stored newest-first; each log carries its working weight in kg.
  return {
    key: name.toLowerCase().replace(/\s+/g, '_'),
    name,
    logs: weights
      .slice()
      .reverse()
      .map((weight, index) => ({ id: `${name}_${index}`, weight })),
    bestWeight: Math.max(...weights),
    bestReps: 5,
    latestWeight: weights[weights.length - 1],
    previousWeight: weights[weights.length - 2] ?? null,
    latestReps: '5',
  };
}

module.exports = [
  {
    name: 'premium hero chart picks the richest history and projects the coach next step',
    run() {
      const chart = buildPremiumHeroChart(
        [summary('Barbell Bench Press', [60, 62.5]), summary('Barbell Squat', [80, 82.5, 85, 87.5])],
        'kg',
      );

      assert.ok(chart);
      assert.equal(chart.liftName, 'Barbell Squat');
      assert.deepEqual(chart.points, [80, 82.5, 85, 87.5]);
      assert.equal(chart.latest, 87.5);
      assert.equal(chart.projectedNext, 90); // 87.5 + 2.5
      assert.equal(chart.sessions, 4);
    },
  },
  {
    name: 'premium hero chart returns null when no lift has enough history',
    run() {
      const chart = buildPremiumHeroChart(
        [summary('Barbell Squat', [100]), summary('Deadlift', [])],
        'kg',
      );

      assert.equal(chart, null);
    },
  },
  {
    name: 'premium hero chart reports working weights and projection in kg',
    run() {
      // kg-only app: weights pass through unchanged and the projection is
      // latest + the 2.5 kg micro-progression step.
      const chart = buildPremiumHeroChart([summary('Barbell Squat', [100, 102.5])], 'kg');

      assert.ok(chart);
      assert.ok(Math.abs(chart.points[0] - 100) < 0.01);
      assert.ok(Math.abs(chart.latest - 102.5) < 0.01);
      assert.ok(Math.abs(chart.projectedNext - (chart.latest + 2.5)) < 0.01);
    },
  },
];
