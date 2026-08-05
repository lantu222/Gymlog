const assert = require('assert');
const fs = require('fs');
const path = require('path');

const programDetailSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'src', 'screens', 'ProgramDetailScreen.tsx'),
  'utf8',
);
const programDetailsSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'src', 'lib', 'programDetails.ts'),
  'utf8',
);
const appSource = fs.readFileSync(path.join(__dirname, '..', '..', 'App.tsx'), 'utf8');
const i18nSource = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'lib', 'i18n.ts'), 'utf8');

module.exports = [
  {
    name: 'program detail screen renders the light plan overview instead of the old session-flow hero',
    run() {
      // The module constant is gone: a constant is evaluated once at import and
      // cannot follow a theme, so the background is read in the style factory.
      assert.doesNotMatch(programDetailSource, /PLAN_BACKGROUND/);
      assert.match(programDetailSource, /backgroundColor: theme.bg/);
      assert.match(programDetailSource, /PLAN_PURPLE = '#7C3AED'/);
      assert.match(programDetailSource, /PLAN_GREEN = '#16A34A'/);
      // The screen leads with a hero that says what the program IS. It opened
      // on a header, a photo slot and a stats card — three containers before a
      // reader learned whether this was a strength program or a cut.
      assert.match(programDetailSource, /styles\.hero\b/);
      assert.match(programDetailSource, /heroBars\.map/);
      assert.match(programDetailSource, /styles\.heroTitle/);
      assert.doesNotMatch(programDetailSource, /styles\.headerTitle/);
      assert.doesNotMatch(programDetailSource, /styles\.planCard\b/);
      // Four numbers, so the commitment is legible before the button.
      assert.match(programDetailSource, /'detail\.stat\.daysPerWeek'/);
      assert.match(programDetailSource, /'detail\.stat\.total'/);
      // The week is seven named chips. A dot-and-word list said
      // "Treeni / Palautuminen" seven times and never named a session.
      assert.match(programDetailSource, /styles\.rhythmDay\b/);
      assert.match(programDetailSource, /shortSessionLabel\(session, language\)/);
      assert.doesNotMatch(programDetailSource, /scheduleDot/);
      // Every exercise says what it is FOR, read off the template's own role
      // rather than written per program.
      assert.match(programDetailSource, /ROLE_KEYS\[exercise\.role\]/);
      assert.match(i18nSource, /'detail\.role\.primary': 'ANCHOR'/);
      assert.match(i18nSource, /'detail\.role\.primary': 'ANKKURI'/);
      // The summary comes back in the reader's language now. It was fetched
      // without one, so every program's description was English and the screen
      // simply did not render it.
      assert.match(programDetailsSource, /getReadyProgramContent\(template\.id, language\)/);
      assert.match(appSource, /preferences\.appLanguage,\s*\n\s*\)/);

      assert.match(programDetailSource, /t\(language, 'detail\.workouts'\)/);
      assert.match(programDetailSource, /t\(language, 'detail\.startNext'\)/);
      assert.match(i18nSource, /'detail\.startNext': 'Start next workout'/);
      assert.match(programDetailSource, /formatPlanSessionTitle/);
      assert.match(programDetailSource, /buildSessionContentSections/);
      assert.match(programDetailSource, /detail\.warmup/);
      assert.match(programDetailSource, /ai\.signal\.workout/);
      assert.match(programDetailSource, /detail\.cooldown/);
      assert.match(programDetailSource, /sessionContentSection/);
      assert.match(programDetailSource, /workoutCard/);

      // How the weight goes up. The catalog carries four rules per template
      // and the app had never shown one — they were written in English, and
      // the screen's answer to English text had been not to render it.
      assert.match(programDetailSource, /'detail\.progression'/);
      assert.match(programDetailSource, /progressionRuleLabel\(language, rule\)/);
      assert.match(appSource, /progressionRules=\{readyTemplate\?\.progressionRules \?\? null\}/);
      // Custom programs have no rules and get no section: they are the
      // reader's own sessions, and inventing a rule invents the whole thing.
      assert.match(programDetailSource, /\{progressionRules \? \(/);
      // The warning only fires when the setup actually says how many days the
      // reader has. Guessing would turn a real warning into noise.
      assert.match(programDetailSource, /availableDays != null && availableDays > 0/);

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
      assert.doesNotMatch(programDetailSource, /styles\.screenEyebrow/);
      assert.doesNotMatch(programDetailSource, /Progress signals/);
      assert.doesNotMatch(programDetailSource, /inlineTip \?/);
      assert.doesNotMatch(programDetailSource, /secondaryActionLabel && onSecondaryAction/);
      assert.doesNotMatch(programDetailSource, /secondaryButton/);
      assert.doesNotMatch(programDetailSource, /<VinhaIcon name="dumbbell" color="#FFFFFF"/);
      assert.doesNotMatch(programDetailSource, /<VinhaIcon name="chevronRight" color="#FFFFFF"/);

      assert.match(appSource, /<ProgramDetailScreen/);
      assert.match(appSource, /onStartSession=\{\(sessionId\) => \{/);
      assert.doesNotMatch(appSource, /secondaryActionLabel=\{route\.programType === 'ready' \? 'Make it mine' : 'Duplicate'\}/);
    },
  },
];
