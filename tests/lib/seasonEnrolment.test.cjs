const assert = require('node:assert/strict');

const {
  SEASON_JOIN_WINDOW_DAYS,
  addSeasonEnrolment,
  daysUntil,
  isEnrolled,
  isJoinWindowOpen,
  normalizeSeasonEnrolments,
} = require('../../.test-dist/lib/seasonEnrolment.js');

const summer2026 = { season: 'summer', year: 2026, joinedAt: '2026-04-02T10:00:00.000Z' };

module.exports = [
  {
    // Winter 2026 runs into March 2027 and is still winter 2026. Keying on the
    // start year is what keeps "am I in this season" from answering yes for
    // last winter every February.
    name: 'a sign-up is identified by season AND start year',
    run() {
      const entries = [summer2026];
      assert.equal(isEnrolled(entries, 'summer', 2026), true);
      assert.equal(isEnrolled(entries, 'summer', 2027), false);
      assert.equal(isEnrolled(entries, 'winter', 2026), false);
      assert.equal(isEnrolled([], 'summer', 2026), false);
    },
  },
  {
    // Pressing the button twice is one sign-up, not two rows and not an error.
    name: 'signing up twice is the same as signing up once',
    run() {
      const once = addSeasonEnrolment([], summer2026);
      const twice = addSeasonEnrolment(once, { ...summer2026, joinedAt: '2026-05-01T00:00:00.000Z' });
      assert.equal(twice.length, 1);
      // The first sign-up is the one that happened; the second is a no-op and
      // must not backdate or forward-date it.
      assert.equal(twice[0].joinedAt, summer2026.joinedAt);
      // Never mutates what it was handed.
      assert.deepEqual(once, [summer2026]);
    },
  },
  {
    name: 'the join window is closed early and open right up to the start',
    run() {
      assert.equal(isJoinWindowOpen(SEASON_JOIN_WINDOW_DAYS + 1), false);
      assert.equal(isJoinWindowOpen(SEASON_JOIN_WINDOW_DAYS), true);
      assert.equal(isJoinWindowOpen(1), true);
      assert.equal(isJoinWindowOpen(0), true);
      assert.equal(isJoinWindowOpen(-1), false);
    },
  },
  {
    name: 'days until the start round up, and never go negative',
    run() {
      const now = new Date('2026-08-12T12:00:00.000Z');
      assert.equal(daysUntil(new Date('2026-08-12T12:00:00.000Z'), now), 0);
      assert.equal(daysUntil(new Date('2026-08-13T00:00:00.000Z'), now), 1);
      assert.equal(daysUntil(new Date('2026-08-13T12:00:00.000Z'), now), 1);
      assert.equal(daysUntil(new Date('2026-10-01T00:00:00.000Z'), now), 50);
      assert.equal(daysUntil(new Date('2026-01-01T00:00:00.000Z'), now), 0);
    },
  },
  {
    // Stored data is whatever the last version wrote, plus whatever a crash
    // left behind. A malformed row must drop out, not crash the season card.
    name: 'stored rows are cleaned rather than trusted',
    run() {
      assert.deepEqual(normalizeSeasonEnrolments(null), []);
      assert.deepEqual(normalizeSeasonEnrolments('summer'), []);
      assert.deepEqual(
        normalizeSeasonEnrolments([
          summer2026,
          { season: 'spring', year: 2026, joinedAt: 'x' },
          { season: 'winter', year: null, joinedAt: 'x' },
          { season: 'summer', year: 2026, joinedAt: 'a duplicate' },
          null,
          { season: 'winter', year: 2026.7 },
        ]),
        [
          summer2026,
          // Truncated, and the missing timestamp becomes the epoch rather than
          // today — a row with no date is old, not new.
          { season: 'winter', year: 2026, joinedAt: new Date(0).toISOString() },
        ],
      );
    },
  },
];
