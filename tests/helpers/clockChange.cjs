const assert = require('node:assert/strict');

/**
 * Runs `body` with the clock set to Helsinki, and refuses to pass quietly when
 * that override did not take hold.
 *
 * Under a timezone with no clock change every assertion about one is vacuously
 * true — the pre-fix arithmetic passes just as well as the fix — so a suite that
 * only sets `process.env.TZ` and hopes can go permanently green on a runner that
 * pins the zone or lacks the tz data. Asserting the offsets differ makes that
 * case fail loudly instead.
 *
 * Finland moves its clocks on 29 March and 25 October 2026, so a week or a
 * thirty-day window ending in April or November spans one. The guard pins the
 * offsets either side of both, because a zone that merely has some change in
 * the same month leaves the weeks under test a flat 168 hours.
 */
function withHelsinkiClocks(body) {
  const originalTimezone = process.env.TZ;
  process.env.TZ = 'Europe/Helsinki';

  try {
    // Pin both 2026 transitions, not merely "two offsets differ somewhere".
    // Under Australia/Sydney the looser check passes — its change falls on 5
    // April — while the weeks these suites assert on stay a flat 168 hours, so
    // every assertion would hold against the arithmetic it exists to reject.
    // EET is -120 and EEST is -180; nothing but Helsinki's zone matches all four.
    assert.deepEqual(
      [
        new Date(2026, 2, 28, 12).getTimezoneOffset(),
        new Date(2026, 2, 30, 12).getTimezoneOffset(),
        new Date(2026, 9, 24, 12).getTimezoneOffset(),
        new Date(2026, 9, 27, 12).getTimezoneOffset(),
      ],
      [-120, -180, -180, -120],
      'TZ override did not take effect, so this test proves nothing',
    );
    body();
  } finally {
    if (originalTimezone === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = originalTimezone;
    }
  }
}

module.exports = { withHelsinkiClocks };
