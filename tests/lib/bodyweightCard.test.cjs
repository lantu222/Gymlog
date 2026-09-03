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
    name: 'value window: calendar days ending today, gaps keep their slots',
    run() {
      const { buildValueWindow } = require('../../.test-dist/lib/bodyweightCard.js');
      const now = new Date(2026, 7, 25, 12, 0).getTime(); // 25 Aug, local noon

      const window = buildValueWindow(
        [
          { recordedAt: new Date(2026, 7, 20, 8, 0).toISOString(), value: 96.5 },
          { recordedAt: new Date(2026, 7, 24, 8, 0).toISOString(), value: 98 },
        ],
        now,
        7,
      );
      assert.equal(window.length, 7);
      // Ends today rather than centring it: a history is "how did I get here".
      assert.equal(window[6].isToday, true);
      assert.equal(window[6].value, null);
      // A week is labelled like the weight card: bare day numbers, which is
      // the axis the user pointed at and asked the others to copy.
      assert.equal(window[0].label, '19');
      assert.equal(window[6].label, '25');

      // Past a fortnight the month has to be said, or the axis reads
      // "26 30 3 7 11" — a number sequence rather than a calendar (both
      // verdicts from the user, 2026-08-25).
      const long = buildValueWindow([], now, 40);
      assert.equal(long[long.length - 1].label, '25.8.');
      assert.equal(long[0].label, '17.7.');
      // The reading keeps its own day; the empty days between keep theirs.
      assert.equal(window[1].value, 96.5);
      assert.equal(window[3].value, null);
      assert.equal(window[5].value, 98);

      // Two readings on one day: the later one wins, same rule as weigh-ins.
      const sameDay = buildValueWindow(
        [
          { recordedAt: new Date(2026, 7, 25, 8, 0).toISOString(), value: 6 },
          { recordedAt: new Date(2026, 7, 25, 20, 0).toISOString(), value: 7 },
        ],
        now,
        3,
      );
      assert.equal(sameDay[2].value, 7);
    },
  },

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
    /**
     * A gridline is a number you read, so it has to be a number you would
     * write. The axis used to snap the step and hang the grid off the middle
     * of the data, giving evenly spaced lines labelled 68,35 — 68,85 — 69,35:
     * two decimals under a headline that says 70,7 kg, on a value entered with
     * one (#bugs 2026-08-26).
     */
    name: 'every gridline lands on a multiple of the step, not on the data average',
    run() {
      const assert = require('node:assert/strict');
      const { buildWeightAxisTicks } = require('../../.test-dist/lib/bodyweightCard');

      for (const values of [[68.9, 70.7], [75.4], [60, 95], [70.95, 71.2], [82.3, 82.35]]) {
        const ticks = buildWeightAxisTicks(values);
        const step = Number((ticks[0] - ticks[1]).toFixed(4));
        for (const tick of ticks) {
          const multiples = tick / step;
          assert.ok(
            Math.abs(multiples - Math.round(multiples)) < 1e-6,
            `${tick} is not a multiple of the ${step} step for ${JSON.stringify(values)}`,
          );
        }
      }

      // The reported case, spelled out.
      assert.deepEqual(buildWeightAxisTicks([68.9, 70.7]), [71.5, 71, 70.5, 70, 69.5, 69, 68.5]);
    },
  },
  {
    /**
     * The chart drew a ring per weigh-in whatever the range, so a year of
     * weekly entries overlapped into a caterpillar with the line hidden under
     * it. The demo made the boundary obvious: fine to three months, too dense
     * after (user 2026-08-27).
     */
    name: 'markers are drawn only while they have room to be separate dots',
    run() {
      const assert = require('node:assert/strict');
      const { weightMarkersFit } = require('../../.test-dist/lib/bodyweightCard');

      const PLOT = 300;
      // A quarter of weekly weigh-ins, and a week of daily ones: room to spare.
      assert.equal(weightMarkersFit(13, PLOT), true);
      assert.equal(weightMarkersFit(7, PLOT), true);
      // Half a year and a year of weekly weigh-ins: the rings would touch.
      assert.equal(weightMarkersFit(26, PLOT), false);
      assert.equal(weightMarkersFit(53, PLOT), false);

      // A single point is always its own dot, and a chart with no width yet
      // must not flicker its markers off during the first layout pass.
      assert.equal(weightMarkersFit(1, PLOT), true);
      assert.equal(weightMarkersFit(40, 0), true);
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
  {
    /**
     * The window follows the data, not the clock.
     *
     * Asking for three months with two weigh-ins in the log put both of them
     * against the right-hand edge and spent eleven weeks of chart width saying
     * nothing had happened yet — "ihan tyhmää että se alkaa 4.6" (user,
     * 2026-09-02, looking at a 3M chart whose only entries were 30.8 and 1.9).
     *
     * So a short history anchors the window: it starts at the first entry and
     * runs forward. A long one trails, so the newest is always the right-hand
     * edge. The two meet exactly where the history is as long as the range,
     * which is why this can be one comparison and not a mode.
     */
    name: 'labels: today is always labelled, a week labels every day, and no stride label sits under today',
    run() {
      const assert = require('node:assert/strict');
      const { weightLabelIndexes, WEIGHT_LABEL_WIDTH } = require('../../.test-dist/lib/bodyweightCard.js');

      // A week: every day, whatever the width.
      assert.deepEqual(weightLabelIndexes(7, 3, 300), [0, 1, 2, 3, 4, 5, 6]);

      // Three months anchored at the first weigh-in two days ago: day 0 would
      // be drawn over today's label (two slots ≈ 7 px apart on a 300 px plot,
      // the ink is ~30 px wide), so it is dropped; 13 is eleven slots ≈ 36 px
      // away and stays, which is the "3.9. … 14.9." the device already showed.
      const anchored = weightLabelIndexes(91, 2, 300);
      assert.equal(anchored[0], 2, 'today first');
      assert.equal(anchored.includes(0), false, '1.9. under 3.9.');
      assert.deepEqual(anchored.slice(0, 4), [2, 13, 26, 39]);

      // Today mid-window: the two stride labels within 30 px of it (39 and 52,
      // six and seven slots away) are dropped, the other five stay.
      assert.deepEqual(weightLabelIndexes(91, 45, 300), [0, 13, 26, 45, 65, 78]);
      // Today on a stride slot: labelled once, not twice.
      assert.deepEqual(weightLabelIndexes(91, 13, 300).filter((index) => index === 13).length, 1);
      // No today in the window (a future-anchored end past the clock): plain stride.
      assert.deepEqual(weightLabelIndexes(91, -1, 300).slice(0, 3), [0, 13, 26]);
      // An unmeasured plot (width 0) cannot judge overlap and keeps the stride.
      assert.deepEqual(weightLabelIndexes(91, 2, 0).slice(0, 3), [0, 2, 13]);
      assert.equal(WEIGHT_LABEL_WIDTH, 40);

      // The anchor is the earliest entry whatever the order — the progress
      // summary hands entries newest first, and entries[0] anchored the
      // weight card at the latest weigh-in while the Trend grid used the
      // earliest (user 2026-09-03: the two axes disagreed).
      const { earliestEntryMs } = require('../../.test-dist/lib/bodyweightCard.js');
      const newestFirst = ['2026-09-03T06:00:00Z', '2026-09-01T06:00:00Z', '2026-08-30T06:00:00Z'];
      assert.equal(earliestEntryMs(newestFirst), Date.parse('2026-08-30T06:00:00Z'));
      assert.equal(earliestEntryMs([...newestFirst].reverse()), Date.parse('2026-08-30T06:00:00Z'));
      assert.equal(earliestEntryMs([]), null);
      assert.equal(earliestEntryMs(['not a date']), null);
    },
  },
  {
    name: 'window: a short history anchors the chart, a long one trails it',
    run() {
      const assert = require('node:assert/strict');
      const { measureWindowEnd, buildValueWindow } = require('../../.test-dist/lib/bodyweightCard.js');
      const day = (y, m, d) => new Date(y, m - 1, d).getTime();
      const now = day(2026, 9, 2);

      // Two entries, three-month range: the window starts at the first one.
      const firstRecent = day(2026, 8, 30);
      const endRecent = measureWindowEnd(firstRecent, now, 91);
      assert.equal(endRecent, day(2026, 11, 28), 'the window did not anchor to the first entry');

      const window = buildValueWindow(
        [
          { recordedAt: new Date(day(2026, 8, 30)).toISOString(), value: 75 },
          { recordedAt: new Date(day(2026, 9, 1)).toISOString(), value: 75.3 },
        ],
        now,
        91,
        endRecent,
      );
      assert.equal(window.length, 91);
      assert.equal(window[0].dayStart, firstRecent, 'the chart still starts before the first entry');
      assert.equal(window[0].value, 75, 'the first entry is not on the first day');
      // Today is inside the window and still marked, even though it is not the
      // right-hand edge any more.
      assert.equal(window.filter((d) => d.isToday).length, 1);

      // A history longer than the range trails: the newest day is the edge.
      const firstOld = day(2026, 1, 5);
      assert.equal(measureWindowEnd(firstOld, now, 91), now, 'a long history stopped trailing');
      const trailing = buildValueWindow([], now, 91, measureWindowEnd(firstOld, now, 91));
      assert.equal(trailing[trailing.length - 1].dayStart, now);

      // The handover is exact: a history of precisely `days` ends today.
      const firstExact = day(2026, 6, 4);
      assert.equal(
        Math.round((now - firstExact) / 86400000) + 1,
        91,
        'fixture drifted — that is not a 91-day history',
      );
      assert.equal(measureWindowEnd(firstExact, now, 91), now, 'the two cases do not meet');

      // No entries at all: today, as before the anchor existed.
      assert.equal(measureWindowEnd(null, now, 91), now);
      // And the default end is still today, so every old caller is unchanged.
      const legacy = buildValueWindow([], now, 7);
      assert.equal(legacy[legacy.length - 1].dayStart, now);
    },
  },
];
