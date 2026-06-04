const assert = require('assert');
const fs = require('fs');
const path = require('path');

const programDetailSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'src', 'screens', 'ProgramDetailScreen.tsx'),
  'utf8',
);
const appSource = fs.readFileSync(path.join(__dirname, '..', '..', 'App.tsx'), 'utf8');

module.exports = [
  {
    name: 'program detail screen renders the light plan overview instead of the old session-flow hero',
    run() {
      assert.match(programDetailSource, /PLAN_BACKGROUND = '#F7F3FF'/);
      assert.match(programDetailSource, /PLAN_PURPLE = '#7C3AED'/);
      assert.match(programDetailSource, /PLAN_GREEN = '#16A34A'/);
      assert.match(programDetailSource, /Plan Overview/);
      assert.match(programDetailSource, /headerTitle[\s\S]*Plan Overview/);
      assert.match(programDetailSource, /Your Plan/);
      assert.match(programDetailSource, /This week/);
      assert.match(programDetailSource, /Workouts/);
      assert.match(programDetailSource, /Start next workout/);
      assert.match(programDetailSource, /formatPlanSessionTitle/);
      assert.match(programDetailSource, /Day \$\{index \+ 1\}\. Full Body/);
      assert.match(programDetailSource, /buildSessionContentSections/);
      assert.match(programDetailSource, /Warmup/);
      assert.match(programDetailSource, /Workout/);
      assert.match(programDetailSource, /Cooldown/);
      assert.match(programDetailSource, /sessionContentSection/);
      assert.match(programDetailSource, /progressFill/);
      assert.match(programDetailSource, /scheduleDot/);
      assert.match(programDetailSource, /workoutCard/);
      assert.match(programDetailSource, /stickyFooter/);
      assert.match(programDetailSource, /onStartSession\(nextSession\.id\)/);
      assert.match(programDetailSource, /program\.sessions\.map/);
      assert.match(programDetailSource, /program\.source === 'custom'/);

      assert.doesNotMatch(programDetailSource, /WorkoutSceneGraphic/);
      assert.doesNotMatch(programDetailSource, /Session flow/);
      assert.doesNotMatch(programDetailSource, /heroFlow/);
      assert.doesNotMatch(programDetailSource, /SurfaceCard/);
      assert.doesNotMatch(programDetailSource, /accent="blue"/);
      assert.doesNotMatch(programDetailSource, /Start here/);
      assert.doesNotMatch(programDetailSource, /<Text style=\{styles\.headerTitle\}[^>]*>\s*\{displayTitle\}\s*<\/Text>/);
      assert.doesNotMatch(programDetailSource, /styles\.screenEyebrow/);
      assert.doesNotMatch(programDetailSource, /Progress signals/);
      assert.doesNotMatch(programDetailSource, /inlineTip \?/);
      assert.doesNotMatch(programDetailSource, /secondaryActionLabel && onSecondaryAction/);
      assert.doesNotMatch(programDetailSource, /secondaryButton/);
      assert.doesNotMatch(programDetailSource, /<GymlogIcon name="dumbbell" color="#FFFFFF"/);
      assert.doesNotMatch(programDetailSource, /<GymlogIcon name="chevronRight" color="#FFFFFF"/);

      assert.match(appSource, /<ProgramDetailScreen/);
      assert.match(appSource, /onStartSession=\{\(sessionId\) => \{/);
      assert.doesNotMatch(appSource, /secondaryActionLabel=\{route\.programType === 'ready' \? 'Make it mine' : 'Duplicate'\}/);
    },
  },
];
