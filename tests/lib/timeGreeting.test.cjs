const assert = require('node:assert/strict');

const {
  isRotatingGreeting,
  selectTimeGreetingKey,
} = require('../../.test-dist/lib/homeGreeting.js');

function at(hour, minute = 0) {
  return new Date(2026, 7, 10, hour, minute, 0, 0);
}

module.exports = [
  {
    name: 'the time greeting changes on the hour it says it does',
    run() {
      // The boundaries are the whole spec, so every one of them is pinned.
      assert.equal(selectTimeGreetingKey(at(4, 59)), 'home.greet.time.night');
      assert.equal(selectTimeGreetingKey(at(5, 0)), 'home.greet.time.morning');
      assert.equal(selectTimeGreetingKey(at(10, 59)), 'home.greet.time.morning');
      assert.equal(selectTimeGreetingKey(at(11, 0)), 'home.greet.time.day');
      assert.equal(selectTimeGreetingKey(at(16, 59)), 'home.greet.time.day');
      assert.equal(selectTimeGreetingKey(at(17, 0)), 'home.greet.time.evening');
      assert.equal(selectTimeGreetingKey(at(22, 59)), 'home.greet.time.evening');
      assert.equal(selectTimeGreetingKey(at(23, 0)), 'home.greet.time.night');
      // Night runs across midnight, which is why it is the default rather
      // than a fourth range.
      assert.equal(selectTimeGreetingKey(at(0, 0)), 'home.greet.time.night');
      assert.equal(selectTimeGreetingKey(at(3, 30)), 'home.greet.time.night');
    },
  },
  {
    name: 'only the rotating fillers give way to the clock',
    run() {
      // A first visit, a session logged today and a real streak are claims the
      // log earned. "Good morning" is true of everyone, so it must not
      // displace them.
      assert.equal(isRotatingGreeting('home.greet.first.title'), false);
      assert.equal(isRotatingGreeting('home.greet.done.title'), false);
      assert.equal(isRotatingGreeting('home.greet.streak.title'), false);

      assert.equal(isRotatingGreeting('home.greet.back1.title'), true);
      assert.equal(isRotatingGreeting('home.greet.back6.title'), true);
    },
  },
];
