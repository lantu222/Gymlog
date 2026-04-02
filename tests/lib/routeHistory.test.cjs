const assert = require('node:assert/strict');

const {
  isSameRoute,
  popRoute,
  pushRoute,
} = require('../../.test-dist/navigation/routeHistory.js');

module.exports = [
  {
    name: 'route history pushes the current route only when navigating to a different destination',
    run() {
      const home = { tab: 'home', screen: 'dashboard' };
      const program = { tab: 'workout', screen: 'program', programType: 'ready', workoutTemplateId: 'tpl_1' };

      assert.deepEqual(pushRoute([], home, program), [home]);
      assert.deepEqual(pushRoute([home], program, program), [home]);
    },
  },
  {
    name: 'route history can pop back to the previous route',
    run() {
      const home = { tab: 'home', screen: 'dashboard' };
      const workout = { tab: 'workout', screen: 'list' };

      assert.equal(isSameRoute(home, { tab: 'home', screen: 'dashboard' }), true);
      assert.equal(isSameRoute(home, workout), false);
      assert.deepEqual(popRoute([home, workout]), {
        history: [home],
        route: workout,
      });
      assert.deepEqual(popRoute([]), {
        history: [],
        route: null,
      });
    },
  },
];
