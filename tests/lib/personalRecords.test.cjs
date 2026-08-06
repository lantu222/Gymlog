const assert = require('node:assert/strict');

const {
  FRESH_RECORD_DAYS,
  groupRecordsByMonth,
  resolveRecord,
  resolveRecords,
} = require('../../.test-dist/lib/personalRecords.js');
const {
  buildTrainingCalendar,
  summarizeTrainingMonth,
  weeklyTrainingStreak,
} = require('../../.test-dist/lib/trainingCalendar.js');

function at(year, month, day) {
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function entry(date, sets) {
  return { performedAt: at(...date).toISOString(), sets };
}

const NOW = at(2026, 8, 6);

module.exports = [
  {
    name: 'the previous record is the one that actually stood before it',
    run() {
      // 80 -> 85 -> 82.5. The runner-up in a sorted list is 82.5, but the
      // record that 85 beat was 80, and that is what "+5 kg" has to mean.
      const record = resolveRecord(
        {
          key: 'bench',
          name: 'Penkkipunnerrus',
          entries: [
            entry([2026, 6, 1], [{ weight: 80, reps: 5 }]),
            entry([2026, 7, 1], [{ weight: 85, reps: 3 }]),
            entry([2026, 8, 1], [{ weight: 82.5, reps: 4 }]),
          ],
        },
        'weight',
        NOW,
      );
      assert.equal(record.value, 85);
      assert.equal(record.previous, 80);
      assert.equal(record.companion, 3, 'the reps at the record set');
      assert.equal(new Date(record.performedAt).getMonth(), 6, 'the day it was set, not the latest day');
    },
  },
  {
    name: 'a first record has no previous, and no delta to claim',
    run() {
      const record = resolveRecord(
        { key: 'row', name: 'Kulmasoutu', entries: [entry([2026, 8, 1], [{ weight: 60, reps: 8 }])] },
        'weight',
        NOW,
      );
      assert.equal(record.value, 60);
      assert.equal(record.previous, null);
    },
  },
  {
    name: 'three kinds, because a bodyweight lift has no weight record',
    run() {
      const pullups = {
        key: 'pullup',
        name: 'Leuanveto',
        entries: [
          entry([2026, 7, 1], [{ weight: 0, reps: 8 }]),
          entry([2026, 8, 1], [{ weight: 0, reps: 12 }]),
        ],
      };
      // Nothing was ever loaded, so there is no heaviest set to report.
      assert.equal(resolveRecord(pullups, 'weight', NOW), null);

      const reps = resolveRecord(pullups, 'reps', NOW);
      assert.equal(reps.value, 12);
      assert.equal(reps.previous, 8);
      assert.equal(reps.companion, null, 'no weight to show for a bodyweight set');

      // Volume is the whole session on that lift, which is what makes a
      // session hard in a way one set cannot show.
      const volume = resolveRecord(
        {
          key: 'squat',
          name: 'Takakyykky',
          entries: [
            entry([2026, 7, 1], [{ weight: 100, reps: 5 }, { weight: 100, reps: 5 }]),
            entry([2026, 8, 1], [{ weight: 90, reps: 8 }, { weight: 90, reps: 8 }]),
          ],
        },
        'volume',
        NOW,
      );
      assert.equal(volume.value, 1440, 'the lighter, higher-rep session did more work');
      assert.equal(volume.previous, 1000);
    },
  },
  {
    name: 'freshness is a window, and the list leads with what is recent',
    run() {
      const sources = [
        { key: 'a', name: 'Vanha', entries: [entry([2026, 1, 5], [{ weight: 200, reps: 1 }])] },
        { key: 'b', name: 'Tuore', entries: [entry([2026, 8, 4], [{ weight: 50, reps: 5 }])] },
      ];
      const records = resolveRecords(sources, 'weight', NOW);

      // Sorted by date, not by kilos: ordered by size it is a list of which
      // lifts are heaviest, which the reader already knows.
      assert.deepEqual(records.map((record) => record.name), ['Tuore', 'Vanha']);
      assert.equal(records[0].fresh, true);
      assert.equal(records[1].fresh, false, `set more than ${FRESH_RECORD_DAYS} days ago`);
    },
  },
  {
    name: 'nothing logged is no records, not zeroes',
    run() {
      assert.deepEqual(resolveRecords([], 'weight', NOW), []);
      assert.equal(
        resolveRecord({ key: 'x', name: 'X', entries: [entry([2026, 8, 1], [])] }, 'weight', NOW),
        null,
      );
      // A corrupt timestamp cannot be placed on a timeline; dropping that one
      // entry beats sorting the whole lift by NaN.
      const record = resolveRecord(
        {
          key: 'x',
          name: 'X',
          entries: [
            { performedAt: 'not-a-date', sets: [{ weight: 999, reps: 1 }] },
            entry([2026, 8, 1], [{ weight: 60, reps: 5 }]),
          ],
        },
        'weight',
        NOW,
      );
      assert.equal(record.value, 60);
    },
  },
  {
    name: 'records group by the month they were set',
    run() {
      const groups = groupRecordsByMonth([
        { key: 'a', name: 'A', bodyPart: null, kind: 'weight', value: 1, companion: null, performedAt: at(2026, 8, 4).toISOString(), previous: null, fresh: true },
        { key: 'b', name: 'B', bodyPart: null, kind: 'weight', value: 1, companion: null, performedAt: at(2026, 7, 29).toISOString(), previous: null, fresh: false },
        { key: 'c', name: 'C', bodyPart: null, kind: 'weight', value: 1, companion: null, performedAt: at(2026, 8, 1).toISOString(), previous: null, fresh: true },
      ]);
      assert.equal(groups.length, 2);
      assert.equal(groups[0].month, 7, 'August first');
      assert.equal(groups[0].records.length, 2);
      assert.equal(groups[1].month, 6);
    },
  },
  {
    name: 'the calendar marks trained days without inventing a second grid',
    run() {
      const sessions = [
        { id: 's1', performedAt: at(2026, 8, 3).toISOString(), totalVolumeKg: 4000, durationMinutes: 60 },
        { id: 's2', performedAt: at(2026, 8, 3).toISOString(), totalVolumeKg: 1000, durationMinutes: 30 },
        { id: 's3', performedAt: at(2026, 8, 5).toISOString(), totalVolumeKg: 5000, durationMinutes: 50 },
        // Previous month — must not appear on August's squares.
        { id: 's4', performedAt: at(2026, 7, 29).toISOString(), totalVolumeKg: 3000, durationMinutes: 45 },
      ];
      const calendar = buildTrainingCalendar(sessions, { now: NOW, monthOffset: 0 });
      const days = calendar.weeks.flat();

      const third = days.find((day) => day.inMonth && day.dayOfMonth === 3);
      assert.deepEqual(third.sessionIds, ['s1', 's2'], 'two sessions on one day');
      assert.equal(days.find((day) => day.inMonth && day.dayOfMonth === 5).sessionIds.length, 1);
      assert.equal(days.find((day) => day.inMonth && day.dayOfMonth === 4).sessionIds.length, 0);

      // Padding days belong to another month; marking them would put a
      // trained square outside the month it happened in.
      assert.ok(days.filter((day) => !day.inMonth).every((day) => day.sessionIds.length === 0));

      const summary = summarizeTrainingMonth(sessions, 2026, 7);
      assert.equal(summary.sessions, 3, 'July is not August');
      assert.equal(summary.volumeKg, 10000);
      assert.equal(summary.averageMinutes, 47);

      // No session recorded a duration: no average rather than zero.
      assert.equal(
        summarizeTrainingMonth([{ id: 'x', performedAt: at(2026, 8, 2).toISOString() }], 2026, 7)
          .averageMinutes,
        null,
      );
    },
  },
  {
    name: 'an empty current week does not break the streak',
    run() {
      // NOW is Thursday 6 August 2026. The week is not over, and a counter
      // that resets every Monday morning is a counter nobody trusts.
      const weeks = [at(2026, 7, 22), at(2026, 7, 29), at(2026, 8, 3)];
      const sessions = weeks.map((date, index) => ({ id: `s${index}`, performedAt: date.toISOString() }));
      assert.equal(weeklyTrainingStreak(sessions, NOW), 3);

      const withoutThisWeek = sessions.slice(0, 2);
      assert.equal(weeklyTrainingStreak(withoutThisWeek, NOW), 2, 'the unfinished week is not counted against');

      // A gap ends it.
      assert.equal(
        weeklyTrainingStreak(
          [{ id: 'old', performedAt: at(2026, 6, 1).toISOString() }],
          NOW,
        ),
        0,
      );
      assert.equal(weeklyTrainingStreak([], NOW), 0);
    },
  },
];
