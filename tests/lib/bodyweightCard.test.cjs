const assert = require('node:assert/strict');

const {
  BMI_BANDS,
  BMI_SCALE_TICKS,
  bmiBand,
  bmiMarkerPosition,
  buildBodyweightCardStats,
  buildWeightAxisTicks,
  buildWeightWindow,
  calculateBmi,
  collapseToLatestPerDay,
} = require('../../.test-dist/lib/bodyweightCard.js');

function entry(recordedAt, weight) {
  return { id: `${recordedAt}-${weight}`, recordedAt, weight };
}

module.exports = [
  {
    name: 'an empty log shows no numbers rather than zeroes',
    run() {
      assert.deepEqual(buildBodyweightCardStats([]), {
        currentKg: null,
        heaviestKg: null,
        lightestKg: null,
        count: 0,
      });
    },
  },
  {
    name: 'current is the latest by date, not the last in the array',
    run() {
      // A back-dated weigh-in written after today's must not become "current".
      const stats = buildBodyweightCardStats([
        entry('2026-08-13T07:00:00.000Z', 80),
        entry('2026-08-01T07:00:00.000Z', 84),
      ]);
      assert.equal(stats.currentKg, 80);
      assert.equal(stats.heaviestKg, 84);
      assert.equal(stats.lightestKg, 80);
      assert.equal(stats.count, 2);
    },
  },
  {
    name: 'a single entry is current, heaviest and lightest at once',
    run() {
      const stats = buildBodyweightCardStats([entry('2026-08-13T07:00:00.000Z', 75)]);
      assert.deepEqual(stats, { currentKg: 75, heaviestKg: 75, lightestKg: 75, count: 1 });
    },
  },
  {
    name: 'nonsense weights are dropped rather than shown as a record low',
    run() {
      const stats = buildBodyweightCardStats([
        entry('2026-08-10T07:00:00.000Z', 0),
        entry('2026-08-11T07:00:00.000Z', Number.NaN),
        entry('2026-08-12T07:00:00.000Z', -5),
        entry('2026-08-13T07:00:00.000Z', 72.4),
      ]);
      assert.deepEqual(stats, { currentKg: 72.4, heaviestKg: 72.4, lightestKg: 72.4, count: 1 });
    },
  },
  {
    name: 'BMI matches the reference: 75 kg at 175 cm is 24.5',
    run() {
      assert.equal(calculateBmi(75, 175), 24.5);
      assert.equal(calculateBmi(60, 170), 20.8);
    },
  },
  {
    name: 'BMI refuses to answer without both numbers',
    run() {
      assert.equal(calculateBmi(75, 0), null);
      assert.equal(calculateBmi(0, 175), null);
      assert.equal(calculateBmi(75, Number.NaN), null);
      assert.equal(calculateBmi(-75, 175), null);
    },
  },
  {
    name: 'the bands cover the whole range with no gap and no overlap',
    run() {
      assert.equal(BMI_BANDS[0].from, null);
      assert.equal(BMI_BANDS[BMI_BANDS.length - 1].to, null);
      for (let index = 1; index < BMI_BANDS.length; index += 1) {
        assert.equal(BMI_BANDS[index].from, BMI_BANDS[index - 1].to, `gap before band ${index}`);
      }
      // One tick per INTERNAL boundary — seven bands have six of them. Getting
      // this wrong shifted the whole printed scale one band to the left, so a
      // healthy 24.7 had "30" printed under its marker.
      assert.equal(BMI_SCALE_TICKS.length, BMI_BANDS.length - 1);
      BMI_SCALE_TICKS.forEach((tick, index) => {
        assert.equal(tick, BMI_BANDS[index].to, `tick ${tick} is not band ${index}'s upper bound`);
      });
    },
  },
  {
    name: 'the cut-offs land on the right side of each boundary',
    run() {
      assert.equal(bmiBand(14.9).key, 'severe');
      assert.equal(bmiBand(15).key, 'moderate');
      assert.equal(bmiBand(18.4).key, 'mild');
      assert.equal(bmiBand(18.5).key, 'healthy');
      assert.equal(bmiBand(24.9).key, 'healthy');
      assert.equal(bmiBand(25).key, 'over');
      assert.equal(bmiBand(30).key, 'obese1');
      assert.equal(bmiBand(35).key, 'obese2');
      assert.equal(bmiBand(60).key, 'obese2');
    },
  },
  {
    name: 'the marker moves within a band, so 19 and 24 are not the same point',
    run() {
      const low = bmiMarkerPosition(19);
      const high = bmiMarkerPosition(24);
      assert.ok(low < high, 'marker did not advance inside the healthy band');
      assert.ok(bmiMarkerPosition(12) < bmiMarkerPosition(14.9), 'open-ended low band does not move');
      assert.ok(bmiMarkerPosition(36) < bmiMarkerPosition(39), 'open-ended high band does not move');
    },
  },
  {
    name: 'the weight axis gives seven ticks, high to low, around the data',
    run() {
      const ticks = buildWeightAxisTicks([74.8, 75.5, 75.1]);
      assert.equal(ticks.length, 7);
      for (let index = 1; index < ticks.length; index += 1) {
        assert.ok(ticks[index] < ticks[index - 1], 'ticks are not descending');
      }
      assert.ok(ticks[0] > 75.5, 'top tick does not clear the highest value');
      assert.ok(ticks[6] < 74.8, 'bottom tick does not clear the lowest value');
    },
  },
  {
    name: 'a single entry still gets a readable window instead of a flat line',
    run() {
      const ticks = buildWeightAxisTicks([75]);
      assert.equal(ticks.length, 7);
      assert.ok(ticks[0] > 75 && ticks[6] < 75);
      assert.equal(new Set(ticks).size, 7, 'ticks collapsed onto each other');
    },
  },
  {
    name: 'the axis refuses to invent ticks with nothing to plot',
    run() {
      assert.deepEqual(buildWeightAxisTicks([]), []);
      assert.deepEqual(buildWeightAxisTicks([75], 1), []);
    },
  },
  {
    name: 'two weigh-ins on one day collapse to the later one',
    run() {
      // The reader's rule: logging 75 then 71 today is a correction, so 71 is
      // the day's weight and it is both the heaviest and the lightest.
      const stats = buildBodyweightCardStats([
        entry('2026-08-13T07:00:00.000Z', 75),
        entry('2026-08-13T19:00:00.000Z', 71),
      ]);
      assert.deepEqual(stats, { currentKg: 71, heaviestKg: 71, lightestKg: 71, count: 1 });
    },
  },
  {
    name: 'collapsing keeps one entry per day, in date order',
    run() {
      const collapsed = collapseToLatestPerDay([
        entry('2026-08-12T07:00:00.000Z', 80),
        entry('2026-08-13T07:00:00.000Z', 75),
        entry('2026-08-13T19:00:00.000Z', 71),
        entry('2026-08-11T07:00:00.000Z', 82),
      ]);
      assert.deepEqual(collapsed.map((item) => item.weight), [82, 80, 71]);
    },
  },
  {
    name: 'the window is seven calendar days with today in the middle',
    run() {
      const now = new Date(2026, 7, 13, 12, 0, 0).getTime();
      const days = buildWeightWindow([], now);
      assert.equal(days.length, 7);
      assert.deepEqual(days.map((day) => day.label), ['10', '11', '12', '13', '14', '15', '16']);
      assert.equal(days[3].isToday, true);
      assert.equal(days.filter((day) => day.isToday).length, 1);
    },
  },
  {
    name: 'a day without a weigh-in keeps its slot and carries no value',
    run() {
      const now = new Date(2026, 7, 13, 12, 0, 0).getTime();
      const days = buildWeightWindow(
        [
          { id: 'a', recordedAt: new Date(2026, 7, 11, 8, 0, 0).toISOString(), weight: 76 },
          { id: 'b', recordedAt: new Date(2026, 7, 13, 8, 0, 0).toISOString(), weight: 75.5 },
        ],
        now,
      );
      assert.deepEqual(days.map((day) => day.value), [null, 76, null, 75.5, null, null, null]);
    },
  },
  {
    name: 'one weigh-in gives exactly one plotted day — never a line across',
    run() {
      const now = new Date(2026, 7, 13, 12, 0, 0).getTime();
      const days = buildWeightWindow(
        [{ id: 'a', recordedAt: new Date(2026, 7, 13, 8, 0, 0).toISOString(), weight: 75.5 }],
        now,
      );
      assert.equal(days.filter((day) => day.value !== null).length, 1);
      // And it is the middle slot, so the first entry ever logged is centred.
      assert.equal(days[3].value, 75.5);
    },
  },
  {
    name: 'one weigh-in gets a 0.6 kg window centred on it, in 0.1 steps',
    run() {
      // A third tighter than the first version's 1.2, and the value sits on the
      // middle gridline rather than floating between two.
      assert.deepEqual(buildWeightAxisTicks([75.5]), [75.8, 75.7, 75.6, 75.5, 75.4, 75.3, 75.2]);
    },
  },
  {
    name: 'gridlines are evenly spaced at a step a person can read',
    run() {
      // Rounding six equal slices of a padded range to one decimal produced
      // 75.9 / 75.8 / 75.6 / 75.5 / 75.4 / 75.2 / 75.1 — lines evenly spaced
      // under labels that were not. The step is snapped now, not the labels.
      const nice = new Set([0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10, 20, 25, 50]);
      for (const values of [[75.5], [75, 76.2], [70, 95], [80, 80.9], [62.3, 62.4]]) {
        const ticks = buildWeightAxisTicks(values);
        const gaps = ticks.slice(1).map((tick, index) => Number((ticks[index] - tick).toFixed(3)));
        assert.equal(new Set(gaps).size, 1, `uneven gaps for ${JSON.stringify(values)}: ${gaps}`);
        assert.ok(nice.has(gaps[0]), `step ${gaps[0]} is not a readable one`);
      }
    },
  },
  {
    name: 'the highest and lowest values keep clear air off the edge gridlines',
    run() {
      for (const values of [[75.5], [75, 76.2], [70, 95]]) {
        const ticks = buildWeightAxisTicks(values);
        assert.ok(ticks[0] > Math.max(...values), `top tick touches the data for ${values}`);
        assert.ok(ticks[6] < Math.min(...values), `bottom tick touches the data for ${values}`);
      }
    },
  },
  {
    name: 'the marker never leaves the bar, however extreme the value',
    run() {
      for (const bmi of [1, 10, 24.5, 39.9, 80, 500]) {
        const position = bmiMarkerPosition(bmi);
        assert.ok(position >= 0 && position <= 1, `BMI ${bmi} placed the marker at ${position}`);
      }
    },
  },
];
