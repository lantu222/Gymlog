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
    name: 'premium hero chart converts working weights and projection to the display unit',
    run() {
      const chart = buildPremiumHeroChart([summary('Barbell Squat', [100, 102.5])], 'lb');

      assert.ok(chart);
      // 100 kg -> ~220.46 lb, 102.5 kg -> ~225.97 lb, projection 105 kg -> ~231.49 lb
      assert.ok(Math.abs(chart.points[0] - 220.46) < 0.1);
      assert.ok(Math.abs(chart.latest - 225.97) < 0.1);
      assert.ok(Math.abs(chart.projectedNext - 231.49) < 0.1);
    },
  },
];
