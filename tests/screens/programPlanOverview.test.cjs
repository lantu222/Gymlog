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
      /**
       * The painted hero is gone, and with it the last fixed colours.
       *
       * These lines used to pin it in place: a 262 px gradient carrying a
       * back button, a level chip and the title, with the week drawn behind
       * it as bars. That is a third of the screen, most of it empty colour,
       * before a single fact about the programme — "ylä heron viel ihan
       * liikaa tilaa … otsikko ylös data siihen ja ei mitään värikästä
       * heroa" (#bugs 2026-08-27). The title now leads in the theme's own
       * ink and the stat strip follows it directly.
       */
      assert.match(programDetailSource, /pageTitle: \{\s*color: theme\.ink/);
      assert.match(programDetailSource, /styles\.pageTitle/);
      assert.match(programDetailSource, /styles\.headerRow/);
      assert.doesNotMatch(programDetailSource, /styles\.hero\b/);
      assert.doesNotMatch(programDetailSource, /heroBars/);
      assert.doesNotMatch(programDetailSource, /styles\.heroTitle/);
      // White text still exists where a painted surface still exists — the
      // adopt button and the filled day chip. What went is white text that
      // depended on a gradient BEHIND the page.
      assert.doesNotMatch(programDetailSource, /styles\.headerTitle/);
      assert.doesNotMatch(programDetailSource, /styles\.planCard\b/);
      // Three numbers answering one question — how much of a week is this?
      // It used to run days / session / sessions, where the first and last
      // were the same number wearing two labels (user 2026-08-31).
      assert.match(programDetailSource, /'detail\.stat\.daysPerWeek'/);
      assert.match(programDetailSource, /'detail\.stat\.minPerSession'/);
      assert.match(programDetailSource, /'detail\.stat\.minPerWeek'/);
      // And the day count comes from the RHYTHM, not the session count: a
      // five-session programme on "4 on / 1 off" trains 5.6 days a week and
      // the header used to keep saying five.
      assert.doesNotMatch(programDetailSource, /value: `\$\{program\.sessions\.length\}`/);
      assert.match(programDetailSource, /formatTrainingDays\(weekLoad\.daysPerWeek\)/);
      // The cycle hint reads the same number from the same place; computing
      // it twice is how two lines on one screen end up disagreeing.
      assert.doesNotMatch(programDetailSource, /7 \* trainingCycle\.pattern\.filter/);
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
      // The days warning is gone. "Vaatii 4 päivää viikossa. Sinun viikossasi
      // on 1." compared the programme's day count against the reader's stated
      // AVAILABILITY, which is a different thing from their plan's rhythm — so
      // it fired on anyone whose week was recorded loosely, and the reader
      // could not tell what it was about (user 2026-08-26, "en ihan tajua mikä
      // tämä on"). A warning nobody can act on is furniture with an alarm on
      // it; the day count is stated plainly in the Rytmi section.
      assert.doesNotMatch(programDetailSource, /availableDays|daysWarning|styles\.warnRow/);

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
    name: 'the programme page answers "is this for me" before it explains itself',
    run() {
      // "Kenelle" sat fourth, under the day list and the progression rules, so
      // the reader worked through how a programme runs before finding out
      // whether it was meant for them — which is the question they opened it
      // with (user 2026-08-26, "nostetaan kenelle osio ylös").
      // First mention of each: "equipment" appears again further down for the
      // chips it labels, and a second sighting is not a second section.
      const seen = [];
      for (const match of programDetailSource.matchAll(
        /'detail\.(forWhom|rhythm|workouts|progression|equipment)'/g,
      )) {
        if (!seen.includes(match[1])) {
          seen.push(match[1]);
        }
      }
      assert.deepEqual(seen, ['forWhom', 'rhythm', 'workouts', 'progression', 'equipment']);
    },
  },
  {
    name: 'changing a fixed programme is a change to a lift, not a lesson about the catalog',
    run() {
      const programDaySource = fs.readFileSync(
        path.join(__dirname, '..', '..', 'src', 'screens', 'ProgramDayScreen.tsx'),
        'utf8',
      );

      // "Tee tästä oma versio" is gone from both screens. It asked the reader
      // to understand that catalog programmes are fixed and theirs are not
      // before they could change one lift — and the reader looking for a way
      // to drop an exercise never found it (user 2026-08-26). The copy still
      // happens; it happens underneath the change that needs it.
      assert.doesNotMatch(programDetailSource, /detail\.ownVersion/);
      assert.doesNotMatch(programDaySource, /detail\.ownVersion/);
      assert.doesNotMatch(programDaySource, /onCopyToCustom/);

      // The plus opens the library here, over the day. It used to navigate to
      // the template editor on the Workout tab, and the reader tapped it and
      // asked what tab they had landed on ("vie johonkin ihan outoon
      // välilehteen", #bugs 2026-08-26). Removal is offered on every
      // programme, fixed or not, and adding now is too — the copy-on-write
      // that makes a ready day editable already existed for removal.
      assert.match(programDaySource, /editor\.addExercise/);
      assert.match(programDaySource, /setAddSheetOpen\(true\)/);
      assert.match(programDaySource, /<AddExerciseSheet/);
      assert.doesNotMatch(programDaySource, /onAddExercise\b(?!s)/);
      assert.match(programDaySource, /home\.swapSheet\.remove/);
      assert.match(programDaySource, /onRemoveExercise\(swapRow\.exerciseId as string\)/);

      assert.doesNotMatch(appSource, /onAddExercise=\{/);
      assert.match(
        appSource,
        /onAddExercises=\{[\s\S]{0,220}kind: 'add',\s*\n\s*exerciseNames,/,
      );

      // The swap search reaches the library, not just the slot's six.
      // Searching "taka" returned "Tälle paikalle ei ole vaihtoehtoa", which
      // is a sentence about the pool and was read as a sentence about the app
      // ("ei pysty hakemaan todellisuudessa mitään", #bugs 2026-08-26).
      assert.match(programDaySource, /swapLibraryMatches/);
      assert.match(programDaySource, /exerciseMatchesQuery\(buildExerciseSearchHaystack\(item, language\), query\)/);
      assert.match(programDaySource, /home\.swapSheet\.library/);
      // And the pool-is-empty line only shows when nothing was searched for.
      assert.match(programDaySource, /swapQuery\.trim\(\) \? 'home\.swapSheet\.noMatches' : 'home\.swapSheet\.empty'/);
      assert.match(
        appSource,
        /onRemoveExercise=\{[\s\S]{0,200}editProgramExercise\(route\.programType, route\.workoutTemplateId, daySession\.id, exerciseId, \{[\s\S]{0,60}kind: 'remove'/,
      );
      // The same path keeps a swap, because both are one edit to one lift in
      // one programme — two near-identical handlers is how they drift.
      assert.match(
        appSource,
        /onKeepSwap=\{[\s\S]{0,240}kind: 'replace',\s*\n\s*exerciseName,/,
      );
      assert.match(programDaySource, /home\.swapSheet\.keep/);
      // The sheet's own padding was a fixed number, so its last row sat behind
      // the phone's system buttons and could not be pressed. The inset travels
      // through the kit's shell now — read on the screen, never in the Modal.
      assert.match(programDaySource, /bottomInset=\{insets\.bottom\}/);
      const kitSource = fs.readFileSync(
        path.join(__dirname, '..', '..', 'src', 'components', 'sheetKit.tsx'),
        'utf8',
      );
      assert.match(kitSource, /\(barUp \? KIT_BAR_SPACE : 26\) \+ bottomInset/);
    },
  },
  {
    /**
     * The day page lost its gradient too, and kept everything that was in it.
     *
     * The programme page went first; the day's own 292 px hero was the same
     * argument one screen along, with one difference worth stating — it
     * carried content, not just colour. So the day name and the two numbers
     * stayed and only the paint went ("ilman gradienttia mutta voisiko silti
     * jättää lämmittely liikkeet ja lopetus osiot", 2026-08-27).
     */
    name: 'the day page leads with its title and keeps every section it had',
    run() {
      const day = fs.readFileSync(
        path.join(__dirname, '..', '..', 'src', 'screens', 'ProgramDayScreen.tsx'),
        'utf8',
      );
      assert.doesNotMatch(day, /HERO_HEIGHT/);
      assert.doesNotMatch(day, /styles\.hero\b/);
      assert.doesNotMatch(day, /SvgLinearGradient/);
      assert.match(day, /pageTitle: \{\s*color: theme\.ink/);
      // What the hero was carrying, still carried — except that the title is
      // now the DAY the reader tapped rather than the programme's name with
      // the session under it, which named the same day twice, differently.
      assert.match(day, /formatPlanSessionTitle\(session, dayNumber - 1, programTitle, language\)/);
      assert.doesNotMatch(day, /styles\.pageSession/);
      // The stat pair went too (design frame 05: title only at the top) —
      // both counts already sit on the section headers the rows live under.
      assert.doesNotMatch(day, /styles\.pageStatValue/);
      // The role legend survives, but LAST on the screen: the reader meets
      // ANCHOR on a row before being lectured about it.
      assert.ok(
        day.indexOf('styles.roleCard') > day.indexOf('detail.day.cooldown'),
        'the role legend should render below the sections, not above them',
      );
      // And the sections under it, untouched.
      assert.match(day, /detail\.day\.warmup/);
      assert.match(day, /detail\.day\.exercises/);
      assert.match(day, /detail\.day\.cooldown/);
      assert.match(day, /ROLE_TAG_KEYS\[exercise\.role/);
    },
  },
  {
    /**
     * Reordering is a mode on the list, not a trip through a sheet.
     *
     * The arrows lived inside the per-row edit sheet: three taps and a read
     * to move one row one place, with the list you are ordering hidden behind
     * the sheet while you do it.
     */
    name: 'the day page is reordered by dragging, as one edit per drag',
    run() {
      const day = fs.readFileSync(
        path.join(__dirname, '..', '..', 'src', 'screens', 'ProgramDayScreen.tsx'),
        'utf8',
      );
      // Drag replaced the Reorder mode and its arrows (design frame 05):
      // grab the handle, the rows make room, and letting go writes ONE
      // reorder with the destination.
      assert.doesNotMatch(day, /reorderMode|<MoveButton/);
      assert.match(day, /onReorderExercise\?\.\(exercise\.id, to\)/);
      // Only when there is an order to change.
      assert.match(day, /onReorderExercise && session\.exercises\.length > 1/);
      // Two vertical gestures cannot share one finger: the screen's scroll
      // freezes for the drag's duration.
      assert.match(day, /scrollEnabled=\{dragIndex === null\}/);
      // Heights are measured, never guessed — the preview shifts rows by the
      // dragged row's real height.
      assert.match(day, /rowHeights\.current\[index\] = event\.nativeEvent\.layout\.height/);
    },
  },
  {
    /**
     * Order is the answer on this screen too.
     *
     * `planWeekdayIndexes` stopped sorting so that its POSITION carries which
     * session owns which day. This screen re-sorted the array before pairing
     * it with `program.sessions[order]`, so a Mon/Thu programme adopted on a
     * Wednesday printed session 1 under MON while Home and the calendar ran
     * it on THU (PR #33 review) — the same failure the sort removal fixed,
     * relocated. The write path was never wrong: handleSaveRhythm re-derives
     * the assignment from the rotation. Only the read lied.
     */
    name: 'the rhythm strip pairs sessions in the plan order, not the sorted one',
    run() {
      // The sorted view still exists — membership, counting and the toggle
      // have no opinion about which session owns which day.
      assert.match(
        programDetailSource,
        /const committedDays = useMemo\(\s*\(\) => \[\.\.\.orderedDays\]\.sort/,
      );
      // The pairing reads the order-carrying array instead.
      assert.match(
        programDetailSource,
        /\(draftDays \?\? orderedDays\)\.forEach\(\(dayIndex, order\) => \{/,
      );
      assert.doesNotMatch(
        programDetailSource,
        /shownDays\.forEach\(\(dayIndex, order\)/,
        'pairing from the sorted view is the bug this pins',
      );
    },
  },
  {
    /**
     * Editing a ready programme buys a copy, so the copy must carry the edit.
     *
     * The duplication branch built its dose from `edit.prescription` but then
     * wrote `restSeconds: exercise.restSecondsMin` — the catalog's own value.
     * Changing only the rest time therefore spent one of three custom-programme
     * slots and dropped the change in silence (PR #33 review).
     */
    name: 'duplicating a ready programme carries the rest-time edit into the copy',
    run() {
      assert.match(
        appSource,
        /restSeconds:\s*typeof dose\.restSeconds === 'number' \? dose\.restSeconds : exercise\.restSecondsMin/,
      );
    },
  },
];
