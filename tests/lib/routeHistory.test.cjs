const assert = require('node:assert/strict');

const {
  forgetRoutesForTemplate,
  isSameRoute,
  popRoute,
  pushRoute,
} = require('../../.test-dist/navigation/routeHistory.js');
const { readAppWiring } = require('../helpers/appWiringSource.cjs');

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
  {
    name: 'a deleted programme takes its own pages out of the back stack',
    run() {
      const history = [
        { tab: 'home' },
        { tab: 'workout', screen: 'programs_home' },
        { tab: 'workout', screen: 'program', programType: 'custom', workoutTemplateId: 'tpl_gone' },
        { tab: 'workout', screen: 'programDay', programType: 'custom', workoutTemplateId: 'tpl_gone', sessionId: 'd1' },
        { tab: 'workout', screen: 'program', programType: 'custom', workoutTemplateId: 'tpl_kept' },
      ];

      assert.deepEqual(forgetRoutesForTemplate(history, 'tpl_gone'), [
        { tab: 'home' },
        { tab: 'workout', screen: 'programs_home' },
        { tab: 'workout', screen: 'program', programType: 'custom', workoutTemplateId: 'tpl_kept' },
      ]);
      // Nothing else is touched, and an id nothing names leaves the stack whole.
      assert.deepEqual(forgetRoutesForTemplate(history, 'tpl_never'), history);
      assert.deepEqual(forgetRoutesForTemplate([], 'tpl_gone'), []);
    },
  },
  {
    name: 'deleting a programme replaces the page rather than pushing over it',
    run() {
      const wiring = readAppWiring();
      const body = wiring.slice(
        wiring.indexOf('async function handleDeleteCustomWorkout'),
        wiring.indexOf('async function handleOnboardingPickReadyProgram'),
      );
      assert.match(body, /history: forgetRoutesForTemplate\(current\.history, workoutTemplateId\)/);
      assert.doesNotMatch(body, /navigate\(workoutHomeRoute\);/);
    },
  },
];
