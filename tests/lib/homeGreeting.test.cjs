const assert = require('node:assert/strict');

const { selectHomeGreeting, getGreetingRotation } = require('../../.test-dist/lib/homeGreeting.js');
const { t, I18N_KEYS } = require('../../.test-dist/lib/i18n.js');

function greeting(overrides = {}) {
  return selectHomeGreeting({
    totalSessions: 5,
    trainedToday: false,
    weekStreak: 0,
    rotation: 0,
    ...overrides,
  });
}

module.exports = [
  {
    name: 'greeting: a brand-new account is never welcomed back',
    run() {
      const first = greeting({ totalSessions: 0 });
      assert.equal(first.titleKey, 'home.greet.first.title');
      // Even with a streak somehow set, no history means no "back".
      assert.equal(greeting({ totalSessions: 0, weekStreak: 9 }).titleKey, 'home.greet.first.title');
      assert.notEqual(t('en', first.titleKey), t('en', 'home.greet.back1.title'));
    },
  },
  {
    name: 'greeting: a streak is only claimed once it is really a streak',
    run() {
      assert.equal(greeting({ weekStreak: 2 }).titleKey, 'home.greet.back1.title');

      const streak = greeting({ weekStreak: 3 });
      assert.equal(streak.titleKey, 'home.greet.streak.title');
      assert.deepEqual(streak.titleVars, { count: 3 });
      // The number shown is the number passed, never a rounded-up flourish.
      assert.match(t('fi', streak.titleKey, streak.titleVars), /3 viikkoa/);
    },
  },
  {
    name: 'greeting: training today is acknowledged over the streak',
    run() {
      const done = greeting({ trainedToday: true, weekStreak: 8 });
      assert.equal(done.titleKey, 'home.greet.done.title');
    },
  },
  {
    name: 'greeting: returning lines rotate and every one is translated',
    run() {
      const seen = new Set();
      for (let rotation = 0; rotation < 12; rotation += 1) {
        const picked = greeting({ rotation });
        seen.add(picked.titleKey);
        for (const language of ['en', 'fi']) {
          assert.ok(t(language, picked.titleKey).length > 0);
          assert.ok(t(language, picked.subtitleKey).length > 0);
        }
      }
      assert.ok(seen.size >= 6, `expected the rotation to cycle, saw ${seen.size}`);

      // Same rotation → same greeting, so it cannot reshuffle mid-render.
      assert.deepEqual(greeting({ rotation: 4 }), greeting({ rotation: 4 }));
    },
  },
  {
    name: 'greeting: rotation survives negative and huge inputs',
    run() {
      for (const rotation of [-1, -7, 0, 999999, 20234.7]) {
        const picked = greeting({ rotation });
        assert.ok(I18N_KEYS.includes(picked.titleKey), `bad key for rotation ${rotation}`);
      }
    },
  },
  {
    name: 'greeting: the rotation seed is stable within a day and moves between days',
    run() {
      const morning = getGreetingRotation(new Date(2026, 6, 27, 6, 30));
      const evening = getGreetingRotation(new Date(2026, 6, 27, 23, 45));
      const tomorrow = getGreetingRotation(new Date(2026, 6, 28, 6, 30));

      assert.equal(morning, evening, 'the greeting must not change during the day');
      assert.notEqual(morning, tomorrow);
    },
  },
];
