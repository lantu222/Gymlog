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
      // Every module constant is gone: a constant is evaluated once at import
      // and cannot follow a theme, so colours are read in the style factory.
      //
      // This assertion used to pin PLAN_PURPLE and PLAN_GREEN in place, two
      // lines under a comment explaining why a pinned constant is the bug. The
      // screen kept its whole light palette under the dark theme — white cards
      // and near-black body copy on a near-black page — and the guard stayed
      // green through exactly that.
      assert.doesNotMatch(programDetailSource, /const PLAN_[A-Z_]* =/);
      assert.match(programDetailSource, /backgroundColor: theme.bg/);
      // The one place a fixed colour is still right: white on the hero's own
      // painted gradient, which does not change with the theme.
      assert.match(programDetailSource, /heroTitle: \{\s*color: '#FFFFFF'/);
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
      // rather than written per program. The roles moved with the exercise
      // list into the day view (design: GAINER Hourglass Shape screen 2) —
      // the programme page shows compact day rows that open it.
      const programDaySource = fs.readFileSync(
        path.join(__dirname, '..', '..', 'src', 'screens', 'ProgramDayScreen.tsx'),
        'utf8',
      );
      assert.match(programDaySource, /ROLE_TAG_KEYS\[exercise\.role/);
      assert.match(programDetailSource, /onOpenSession/);
      assert.match(programDetailSource, /resolveProgramEmphasis/);
      assert.match(i18nSource, /'detail\.role\.primary': 'ANCHOR'/);
      assert.match(i18nSource, /'detail\.role\.primary': 'ANKKURI'/);
      // The summary comes back in the reader's language now. It was fetched
      // without one, so every program's description was English and the screen
      // simply did not render it.
      assert.match(programDetailsSource, /getReadyProgramContent\(template\.id, language\)/);
      assert.match(appSource, /preferences\.appLanguage,\s*\n\s*\)/);

      assert.match(programDetailSource, /t\(language, 'detail\.workouts'\)/);
      // The primary action is "adopt this programme", and it sits IN the page
      // under the week rhythm — not in a footer pinned to the bottom, where
      // the floating tab bar covered it and a reader reported there was no way
      // to start a programme at all. A pinned footer here must stay gone.
      assert.match(programDetailSource, /onPress=\{onPrimaryAction\}/);
      assert.match(programDetailSource, /styles\.adoptButton/);
      assert.doesNotMatch(programDetailSource, /stickyFooter/);
      assert.match(i18nSource, /'detail\.adopt': 'Start this programme'/);
      assert.match(i18nSource, /'detail\.adopt': 'Ota ohjelma käyttöön'/);
      // The label comes from the view model, so it is translated at the source
      // rather than hardcoded English that no screen ever showed.
      assert.match(programDetailsSource, /primaryActionLabel: t\(language, 'detail\.adopt'\)/);
      assert.match(programDetailSource, /formatPlanSessionTitle/);
      // The inline warmup/workout/cooldown listing left with the day view:
      // the programme page shows compact rows, and the full session — the
      // same generated warmup and cooldown Home shows — lives one tap in.
      assert.doesNotMatch(programDetailSource, /buildSessionContentSections/);
      assert.doesNotMatch(programDetailSource, /sessionContentSection/);
      assert.match(programDaySource, /getDefaultWarmup/);
      assert.match(programDaySource, /getDefaultCooldown/);
      assert.match(programDaySource, /detail\.day\.warmup/);
      assert.match(programDaySource, /detail\.day\.cooldown/);
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

      // The pinned footer and its "start the first session" shortcut are gone;
      // the adopt button above replaced both. Session rows still open the day.
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
