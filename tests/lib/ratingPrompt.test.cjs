const assert = require('node:assert/strict');

const {
  RATING_COOLDOWN_DAYS,
  RATING_MAX_ASKS,
  RATING_MIN_SESSIONS,
  decideRatingPrompt,
  emptyRatingPromptState,
  recordRatingAsked,
  recordRatingCompleted,
} = require('../../.test-dist/lib/ratingPrompt.js');

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-08-13T08:00:00.000Z');

function input(overrides = {}) {
  return {
    state: overrides.state ?? emptyRatingPromptState,
    sessionsLogged: overrides.sessionsLogged ?? RATING_MIN_SESSIONS,
    atPeakMoment: overrides.atPeakMoment ?? true,
    nowMs: overrides.nowMs ?? NOW,
  };
}

module.exports = [
  {
    name: 'asks at a peak moment once the log has enough sessions',
    run() {
      assert.deepEqual(decideRatingPrompt(input()), { ask: true });
    },
  },
  {
    name: 'stays silent until the app has done its job a few times',
    run() {
      const decision = decideRatingPrompt(input({ sessionsLogged: RATING_MIN_SESSIONS - 1 }));
      assert.deepEqual(decision, { ask: false, reason: 'too_few_sessions' });
    },
  },
  {
    name: 'never asks in the middle of the flow, only after a success',
    run() {
      const decision = decideRatingPrompt(input({ atPeakMoment: false }));
      assert.deepEqual(decision, { ask: false, reason: 'not_a_peak_moment' });
    },
  },
  {
    name: 'a reader who already rated is never asked again',
    run() {
      const state = recordRatingCompleted(emptyRatingPromptState);
      assert.deepEqual(decideRatingPrompt(input({ state })), { ask: false, reason: 'already_rated' });
    },
  },
  {
    name: 'the cooldown holds, then releases',
    run() {
      const state = recordRatingAsked(emptyRatingPromptState, NOW);
      assert.equal(state.askCount, 1);

      const tooSoon = NOW + (RATING_COOLDOWN_DAYS - 1) * DAY_MS;
      assert.deepEqual(decideRatingPrompt(input({ state, nowMs: tooSoon })), {
        ask: false,
        reason: 'cooling_down',
      });

      const later = NOW + (RATING_COOLDOWN_DAYS + 1) * DAY_MS;
      assert.deepEqual(decideRatingPrompt(input({ state, nowMs: later })), { ask: true });
    },
  },
  {
    name: 'stops for good after the maximum number of asks',
    run() {
      let state = emptyRatingPromptState;
      let clock = NOW;
      for (let index = 0; index < RATING_MAX_ASKS; index += 1) {
        assert.deepEqual(decideRatingPrompt(input({ state, nowMs: clock })), { ask: true });
        state = recordRatingAsked(state, clock);
        clock += (RATING_COOLDOWN_DAYS + 1) * DAY_MS;
      }
      assert.deepEqual(decideRatingPrompt(input({ state, nowMs: clock })), {
        ask: false,
        reason: 'asked_enough',
      });
    },
  },
  {
    name: 'an unreadable stored date does not become a way to ask every launch',
    run() {
      const state = { lastAskedAt: 'not a date', askCount: 1, rated: false };
      assert.deepEqual(decideRatingPrompt(input({ state })), { ask: false, reason: 'cooling_down' });
    },
  },
  {
    name: 'recording an ask does not mutate the state it was given',
    run() {
      const state = emptyRatingPromptState;
      const next = recordRatingAsked(state, NOW);
      assert.equal(state.askCount, 0);
      assert.equal(state.lastAskedAt, null);
      assert.equal(next.askCount, 1);
      assert.equal(next.lastAskedAt, new Date(NOW).toISOString());
    },
  },
];
