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
// The workout tab's wiring moved to src/app in the phase-A split (2026-08-26).
const appSource = require('../helpers/appWiringSource.cjs').readAppWiring();
const i18nSource = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'lib', 'i18n.ts'), 'utf8');

module.exports = [
  {
    /**
     * "Ota ohjelma käyttöön" has to adopt the programme.
     *
     * It was wired to handleStartReadyProgram, which starts the first SESSION
     * and never touches the active plan: press it and you trained one workout,
     * then found Home still running whatever it ran before. The adopt function
     * existed the whole time and was reachable only from the season screen.
     *
     * This is the sibling of the bug that left the button unrendered — the
     * label and the wire have now disagreed twice, so both are pinned.
     */
    name: 'the adopt button adopts, rather than starting one session',
    run() {
      const fs = require('node:fs');
      const path = require('node:path');
      const app = require('../helpers/appWiringSource.cjs').readAppWiring();
      const branch = app.slice(app.indexOf('onPrimaryAction={() => {'), app.indexOf('onStartSession={(sessionId) => {'));
      assert.ok(branch.length > 100, 'the primary action branch moved');
      assert.match(branch, /handleAdoptReadyProgram\(route\.workoutTemplateId/);
      assert.doesNotMatch(branch, /handleStartReadyProgram\(route\.workoutTemplateId\)/);
    },
  },

  {
    /**
     * The same bug, on the other side of the catalog.
     *
     * The ready half of "Ota ohjelma käyttöön" was fixed above and the custom
     * half was left starting a session, so a program the reader built or
     * imported could be run one workout at a time but never became the plan
     * Home reads. Reported by a reader who imported their own six-day program
     * from a spreadsheet and found no route onto the home screen: Home offers
     * the catalog and onboarding, and neither knows about it.
     */
    name: "a program of the reader's own can become the program on Home",
    run() {
      const branch = appSource.slice(
        appSource.indexOf('onPrimaryAction={() => {'),
        appSource.indexOf('onStartSession={(sessionId) => {'),
      );
      assert.ok(branch.length > 100, 'the primary action branch moved');
      assert.match(branch, /handleAdoptCustomProgram\(route\.workoutTemplateId/);

      // Adoption is what writes the plan Home reads. Starting a session is not
      // adoption, and that distinction is the whole bug.
      // Sliced rather than matched with a multi-line regex: App.tsx is CRLF on
      // this checkout, and a line-terminator pattern is the one thing here that
      // silently matches nothing instead of failing loudly.
      const handlerStart = appSource.indexOf('async function handleAdoptCustomProgram(');
      assert.ok(handlerStart > 0, 'handleAdoptCustomProgram not found');
      const handler = appSource.slice(handlerStart, handlerStart + 3000);
      assert.match(handler, /await upsertWorkoutPlan\(plan\)/);
      assert.match(handler, /activePlanId:/);
      assert.match(handler, /buildCustomProgramPlanId\(workoutTemplateId\)/);

      // The button has to say what it does. "Start first session" on a program
      // that is about to become your plan is the label half of the same bug.
      assert.match(programDetailsSource, /isActivePlan\s*\?\s*'detail\.startNext'/);
      assert.match(programDetailsSource, /:\s*'detail\.adopt'/);
      assert.match(i18nSource, /'detail\.adopt': 'Ota ohjelma käyttöön'/);
    },
  },

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
      // rather than hardcoded English that no screen ever showed — and it reads
      // the state. Three answers, not two: adopt it, put it on Home when you
      // already hold it but something else is leading, or start the next
      // workout when it is the one leading. Without the middle one, the only
      // way to change which programme Home leads with was to remove the other.
      assert.match(
        programDetailsSource,
        /isActivePlan \? 'detail\.startNext' : isHeldNotLeading \? 'detail\.lead' : 'detail\.adopt'/,
      );
      assert.match(i18nSource, /'detail\.startNext': 'Aloita seuraava treeni'/);
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
  {
    /**
     * "Tee tästä oma versio" reaches a screen.
     *
     * Both strings were translated for the programme page and rendered by
     * nothing; the copy handler took a programme id whose only caller was the
     * plan screen in Profile, three levels deep. Wanting a ready programme
     * CHANGED is the documented buying moment, so the offer has to stand where
     * the reader is when they want it — on the programme, and at the end of the
     * day's list where "one more lift" is felt.
     */
    name: 'the offer to make a ready programme your own is rendered, not just translated',
    run() {
      const programDaySource = fs.readFileSync(
        path.join(__dirname, '..', '..', 'src', 'screens', 'ProgramDayScreen.tsx'),
        'utf8',
      );

      assert.match(programDetailSource, /detail\.ownVersion\.note/);
      assert.match(programDetailSource, /detail\.ownVersion\.cta/);
      assert.match(programDaySource, /detail\.ownVersion\.cta/);
      // A plus that can really add belongs to a programme whose days are the
      // reader's; a fixed one gets the copy instead of a shrug.
      assert.match(programDaySource, /editor\.addExercise/);
      assert.match(programDaySource, /onAddExercise \?/);

      assert.match(appSource, /onCopyToCustom=\{[\s\S]{0,200}handleCopyReadyProgramToCustom\(route\.workoutTemplateId\)/);
      assert.match(appSource, /onAddExercise=\{[\s\S]{0,200}screen: 'template'/);
    },
  },
];
