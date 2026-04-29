const assert = require('assert');
const fs = require('fs');
const path = require('path');

const homeScreenSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'src', 'screens', 'HomeScreen.tsx'),
  'utf8',
);
const appSource = fs.readFileSync(path.join(__dirname, '..', '..', 'App.tsx'), 'utf8');

module.exports = [
  {
    name: 'training tab prioritizes the active plan before quick starts',
    run() {
      assert.match(homeScreenSource, /interface HomePlanCard/);
      assert.match(homeScreenSource, /activePlan\?: HomePlanCard \| null/);
      assert.match(homeScreenSource, /const hasActivePlan = Boolean\(activePlan\)/);
      assert.match(homeScreenSource, /Your plan/);
      assert.match(homeScreenSource, /activePlan\.title/);
      assert.match(homeScreenSource, /activePlan\.sessionsPerWeek/);
      assert.match(homeScreenSource, /activePlan\.weeklyMinutes/);
      assert.match(homeScreenSource, /activePlan\.nextSession\.exercises\.slice\(0, 3\)\.map/);
      assert.match(homeScreenSource, /exercise\.setsLabel/);
      assert.match(homeScreenSource, /activePlan\.nextSession\.hiddenExerciseCount > 0/);
      assert.match(homeScreenSource, /\+\{activePlan\.nextSession\.hiddenExerciseCount\} more exercises/);
      assert.match(homeScreenSource, /Start workout/);
      assert.match(homeScreenSource, /onStartActivePlan/);
      assert.match(homeScreenSource, /quickStartIconPlay/);
      assert.match(homeScreenSource, /quickStartPlayTriangle/);
      assert.match(homeScreenSource, /quickStartIconPlus/);
      assert.match(homeScreenSource, /quickStartFileIcon/);
      assert.match(homeScreenSource, /Let's get stronger\. You've got a plan\./);
      assert.match(homeScreenSource, /Start with what the week needs next\./);

      assert.ok(
        homeScreenSource.indexOf('Your plan') < homeScreenSource.indexOf('Week rhythm'),
        'active plan card should render before the week rhythm card',
      );
      assert.ok(
        homeScreenSource.indexOf('Week rhythm') < homeScreenSource.indexOf('Quick start'),
        'week rhythm should stay above quick start options',
      );

      assert.match(appSource, /const homeActivePlanCard = useMemo/);
      assert.match(appSource, /setsLabel: `\$\{exercise\.sets\} sets`/);
      assert.match(appSource, /hiddenExerciseCount: Math\.max\(nextSession\.exercises\.length - 3, 0\)/);
      assert.match(appSource, /activePlan=\{homeActivePlanCard\}/);
      assert.match(appSource, /onStartActivePlan=\{\(\) =>/);
      assert.match(appSource, /handleStartReadyProgram\(homeActivePlanCard\.programId\)/);
    },
  },
];
