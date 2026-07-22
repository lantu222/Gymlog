const assert = require('node:assert/strict');

const {
  buildHomeStatCardCatalog,
  buildHomeStatCards,
  resolveHomeStatCardKeys,
  formatHomeStatValue,
  DEFAULT_HOME_STAT_CARD_KEYS,
} = require('../../.test-dist/lib/homeStatCards.js');

function createLog(performedAt, weight, reps) {
  return {
    id: `log_${performedAt}`,
    sessionId: `session_${performedAt}`,
    exerciseTemplateId: null,
    exerciseNameSnapshot: 'Takakyykky',
    weight,
    repsPerSet: [reps],
    sets: [{ orderIndex: 0, weight, reps, kind: 'working', outcome: 'completed' }],
    tracked: true,
    orderIndex: 0,
    skipped: false,
    performedAt,
    workoutNameSnapshot: 'Leg Day',
  };
}

function createLiftSummary(key, name, points) {
  return {
    key,
    name,
    logs: points.map(([performedAt, weight, reps]) => createLog(performedAt, weight, reps)),
    latestWeight: null,
    previousWeight: null,
    latestReps: '-',
    bestWeight: Math.max(...points.map(([, weight]) => weight), 0) || null,
    bestReps: 0,
  };
}

const EMPTY_SOURCES = { bodyweightEntries: [], measurementEntries: [], trackedProgress: [] };

module.exports = [
  {
    name: 'catalog: body metrics always offered, tracked lifts appended heaviest first with logged names',
    run() {
      const sources = {
        ...EMPTY_SOURCES,
        trackedProgress: [
          createLiftSummary('penkki', 'Penkki', [['2026-07-01T10:00:00', 80, 5]]),
          createLiftSummary('takakyykky', 'Takakyykky', [['2026-07-01T10:00:00', 105, 5]]),
        ],
      };

      const catalog = buildHomeStatCardCatalog(sources);

      assert.deepEqual(
        catalog.map((item) => item.key),
        ['bodyweight', 'bodyfat', 'waist', 'lift:takakyykky', 'lift:penkki'],
      );
      assert.equal(catalog[3].label, 'Takakyykky');
    },
  },
  {
    name: 'bodyweight card: series is chronological, capped to 7, previous = second-to-last entry',
    run() {
      const entries = [];
      for (let day = 1; day <= 9; day += 1) {
        entries.push({ id: `bw_${day}`, recordedAt: `2026-07-0${day > 9 ? day : `${day}`.padStart(1, '0')}T08:00:00`, weight: 77 + day * 0.5 });
      }
      // Deliberately shuffled input — the lib must sort by recordedAt.
      const shuffled = [entries[4], entries[0], entries[8], entries[2], entries[6], entries[1], entries[3], entries[5], entries[7]];

      const [card] = buildHomeStatCards(['bodyweight'], { ...EMPTY_SOURCES, bodyweightEntries: shuffled });

      assert.equal(card.series.length, 7);
      assert.equal(card.value, 77 + 9 * 0.5);
      // The result before the latest one: day 8.
      assert.equal(card.previous, 77 + 8 * 0.5);
      assert.equal(card.reps, null);
    },
  },
  {
    name: 'measurement cards: bodyfat and waist filter by kind',
    run() {
      const sources = {
        ...EMPTY_SOURCES,
        measurementEntries: [
          { id: 'm1', kind: 'bodyfat', recordedAt: '2026-07-01T08:00:00', value: 17.2, unit: '%' },
          { id: 'm2', kind: 'waist', recordedAt: '2026-07-02T08:00:00', value: 85, unit: 'cm' },
          { id: 'm3', kind: 'bodyfat', recordedAt: '2026-07-10T08:00:00', value: 15.4, unit: '%' },
        ],
      };

      const cards = buildHomeStatCards(['bodyfat', 'waist'], sources);

      assert.equal(cards[0].value, 15.4);
      assert.equal(cards[0].previous, 17.2);
      assert.equal(cards[1].value, 85);
      assert.equal(cards[1].previous, null); // single point — nothing before it
    },
  },
  {
    name: 'lift card: top-set weights per session, reps from the latest top set',
    run() {
      const sources = {
        ...EMPTY_SOURCES,
        trackedProgress: [
          createLiftSummary('takakyykky', 'Takakyykky', [
            ['2026-07-15T10:00:00', 105, 7],
            ['2026-07-01T10:00:00', 95, 8],
            ['2026-07-08T10:00:00', 100, 6],
          ]),
        ],
      };

      const [card] = buildHomeStatCards(['lift:takakyykky'], sources);

      assert.deepEqual(card.series, [95, 100, 105]);
      assert.equal(card.value, 105);
      assert.equal(card.reps, 7);
      assert.equal(card.previous, 100);
    },
  },
  {
    name: 'pinned card with no data keeps honest nulls instead of an invented trend',
    run() {
      const [card] = buildHomeStatCards(['bodyweight'], EMPTY_SOURCES);

      assert.equal(card.value, null);
      assert.equal(card.previous, null);
      assert.deepEqual(card.series, []);
      assert.equal(formatHomeStatValue(card.value), '—');
    },
  },
  {
    name: 'unknown pinned keys are dropped silently',
    run() {
      const cards = buildHomeStatCards(['bodyweight', 'lift:gone', 'nonsense'], EMPTY_SOURCES);
      assert.deepEqual(
        cards.map((card) => card.key),
        ['bodyweight'],
      );
    },
  },
  {
    name: 'resolveHomeStatCardKeys: null means default, empty array means the user cleared the section',
    run() {
      assert.deepEqual(resolveHomeStatCardKeys(null), DEFAULT_HOME_STAT_CARD_KEYS);
      assert.deepEqual(resolveHomeStatCardKeys([]), []);
      assert.deepEqual(resolveHomeStatCardKeys(['a', 'a', '', 'b']), ['a', 'b']);
    },
  },
];
