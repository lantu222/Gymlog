const assert = require('node:assert/strict');

/**
 * These assert English copy, so they assert its decimal point with it.
 * `removeTrailingZeros` reads a module-level decimal mark that defaults to
 * Finnish, so a suite that wants "62.5 kg" has to say so — otherwise it
 * passes or fails on whichever suite ran before it.
 */
const { setNumberLanguage } = require('../../.test-dist/lib/format.js');
setNumberLanguage('en');

const {
  buildLastTimeLine,
  buildOverviewScheme,
  buildProgressionPill,
  findLastTimeSession,
} = require('../../.test-dist/lib/sessionOverviewRows.js');
const { formatGroupedVolume } = require('../../.test-dist/lib/format.js');

const move = (loadKg, fromKg, reps = 8, fromReps = null) => ({
  loadKg,
  autoProgressedFromKg: fromKg,
  reps,
  autoProgressedFromReps: fromReps,
});

module.exports = [
  {
    name: 'overview scheme carries the weight, and never invents one',
    run() {
      const base = { exerciseName: 'Barbell Squat', setCount: 4, repsLabel: '7', timed: false };
      assert.equal(buildOverviewScheme({ ...base, loadKg: 62.5 }, 'en'), '4 × 7 · 62.5 kg');
      // A rep range keeps its dash.
      assert.equal(buildOverviewScheme({ ...base, repsLabel: '6–8', loadKg: 60 }, 'en'), '4 × 6–8 · 60 kg');
      // Bodyweight and unlogged loads say the plan and stop there — "0 kg"
      // would be the row claiming a weight nobody is lifting.
      assert.equal(buildOverviewScheme({ ...base, loadKg: null }, 'en'), '4 × 7');
      assert.equal(buildOverviewScheme({ ...base, loadKg: 0 }, 'en'), '4 × 7');
      // A hold counts seconds and carries no weight even when one is stored.
      assert.equal(buildOverviewScheme({ ...base, timed: true, repsLabel: '45', loadKg: 20 }, 'en'), '4 × 45 s');
    },
  },
  {
    name: 'last time finds the same day of the same programme, newest first',
    run() {
      const sessions = [
        { performedAt: '2026-08-20T18:00:00.000Z', workoutTemplateId: 'p1', workoutTemplateSessionId: 'push' },
        { performedAt: '2026-08-27T18:00:00.000Z', workoutTemplateId: 'p1', workoutTemplateSessionId: 'push' },
        { performedAt: '2026-08-29T18:00:00.000Z', workoutTemplateId: 'p1', workoutTemplateSessionId: 'pull' },
        { performedAt: '2026-08-30T18:00:00.000Z', workoutTemplateId: 'p2', workoutTemplateSessionId: 'push' },
      ];
      // Not the newest session — the newest PUSH of THIS programme.
      assert.equal(findLastTimeSession(sessions, 'p1', 'push').performedAt, '2026-08-27T18:00:00.000Z');
      // A programme with no run of that day at all falls back to the programme,
      // which is still a truer comparison than nothing.
      assert.equal(findLastTimeSession(sessions, 'p1', 'legs').performedAt, '2026-08-29T18:00:00.000Z');
      assert.equal(findLastTimeSession(sessions, 'p3', 'push'), null);
      // An unparseable date cannot win by being "greater than" everything.
      assert.equal(
        findLastTimeSession(
          [{ performedAt: 'not a date', workoutTemplateId: 'p1', workoutTemplateSessionId: 'push' }],
          'p1',
          'push',
        ),
        null,
      );
    },
  },
  {
    name: 'the last-time line prints only the halves it actually knows',
    run() {
      assert.equal(
        buildLastTimeLine(
          { performedAt: '2026-08-27T18:00:00.000Z', workoutTemplateId: 'p1', durationMinutes: 48, totalVolumeKg: 12340 },
          'en',
        ),
        `48 min · ${formatGroupedVolume(12340)}`,
      );
      // Duration alone, volume alone, and a session that has neither.
      assert.equal(
        buildLastTimeLine({ performedAt: '2026-08-27T18:00:00.000Z', workoutTemplateId: 'p1', durationMinutes: 48 }, 'en'),
        '48 min',
      );
      assert.equal(
        buildLastTimeLine({ performedAt: '2026-08-27T18:00:00.000Z', workoutTemplateId: 'p1', totalVolumeKg: 900 }, 'en'),
        '900 kg',
      );
      assert.equal(buildLastTimeLine({ performedAt: '2026-08-27T18:00:00.000Z', workoutTemplateId: 'p1' }, 'en'), null);
      assert.equal(buildLastTimeLine(null, 'en'), null);
      // A save from before durations were stored still has its own span.
      assert.equal(
        buildLastTimeLine(
          {
            performedAt: '2026-08-27T18:50:00.000Z',
            startedAt: '2026-08-27T18:00:00.000Z',
            workoutTemplateId: 'p1',
          },
          'en',
        ),
        '50 min',
      );
    },
  },
  {
    name: 'volume grouping breaks thousands and never wraps mid-number',
    run() {
      assert.equal(formatGroupedVolume(940), '940 kg');
      assert.equal(formatGroupedVolume(12340), '12 340 kg');
      assert.equal(formatGroupedVolume(1234567), '1 234 567 kg');
      assert.equal(formatGroupedVolume(0), '0 kg');
      // Negative volume is not a thing; it must not print a stray sign.
      assert.equal(formatGroupedVolume(-5), '0 kg');
    },
  },
  {
    name: 'the progression pill claims a move only when the gate made one',
    run() {
      // One lift moved: the delta, alone.
      assert.equal(buildProgressionPill([move(62.5, 60), move(50, null)], 'en'), '+2.5 kg today');
      // Several moved: the biggest step, and how many lifts it was one of.
      assert.equal(
        buildProgressionPill([move(62.5, 60), move(55, 50)], 'en'),
        '+5 kg today · 2 lifts',
      );
      // Nothing moved.
      assert.equal(buildProgressionPill([move(60, null), move(50, null)], 'en'), null);
      assert.equal(buildProgressionPill([], 'en'), null);
      // A weight the user pulled DOWN is not a progression, even though the
      // gate's "from" value is still attached.
      assert.equal(buildProgressionPill([move(57.5, 60)], 'en'), null);
      // Bodyweight lifts progress by reps, and only when no load moved. One
      // rep is singular in both languages — "+1 toistoa" is what a plural
      // template would have printed.
      assert.equal(buildProgressionPill([move(null, null, 9, 8)], 'en'), '+1 rep today');
      assert.equal(buildProgressionPill([move(null, null, 9, 8)], 'fi'), '+1 toisto tänään');
      assert.equal(buildProgressionPill([move(null, null, 10, 8)], 'en'), '+2 reps today');
      assert.equal(buildProgressionPill([move(62.5, 60), move(null, null, 9, 8)], 'en'), '+2.5 kg today');
      // Finnish.
      assert.equal(buildProgressionPill([move(62.5, 60)], 'fi'), '+2.5 kg tänään');
    },
  },
];
