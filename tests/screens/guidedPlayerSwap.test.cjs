const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const playerSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'src', 'screens', 'GuidedPlayerScreen.tsx'),
  'utf8',
);
const i18nSource = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'lib', 'i18n.ts'), 'utf8');

/**
 * Swapping a lift lives behind the set screen's dots menu — and only there.
 *
 * This has moved twice, both times on the user's word. 2026-08-21: "ei
 * tässäkään voi vaihtaa liikettä" — swap buttons grew on the set screen and
 * the rest screen, ungated. 2026-08-23, after a second tester's round: a set
 * screen is for logging reps and weight, so everything else — swap included —
 * goes behind the three dots ("3 pisteen taakse siirtyy kaikki liikkeiden
 * vaihto"), and the rest screen's swap button goes away ("Poista vaihda liike
 * tästä ruudusta"). What must survive the move: the row never hides itself,
 * and the sheet still searches the whole library.
 */
module.exports = [
  {
    name: 'guided swap: reachable from the actions sheet, never gated',
    run() {
      // The sheet's swap row must not hide when the substitution group is
      // empty — an empty group is a reason to search the library.
      assert.doesNotMatch(playerSource, /swapOptions\.length \?/);
      assert.match(playerSource, /label=\{t\(language, 'guided\.action\.swap'\)\}/);
    },
  },
  {
    name: 'guided swap: no dedicated buttons on the set or rest screens',
    run() {
      // The set screen's own controls are pause and the menu; swap rides
      // behind the menu rather than as a fourth button.
      assert.doesNotMatch(playerSource, /onSwapExercise/);
      // The rest screen lost its swap button (2026-08-23); its old label is
      // gone from the app entirely.
      assert.doesNotMatch(playerSource, /'guided\.swap\.action'/);
      assert.doesNotMatch(i18nSource, /'guided\.swap\.action'/);
      // But the actions sheet still resolves the lift a rest belongs to, so
      // swapping mid-rest stays possible through the menu.
      assert.match(
        playerSource,
        /step\.type === 'set' \|\| step\.type === 'position' \|\| step\.type === 'rest'/,
      );
    },
  },
  {
    name: 'guided swap: search, then suggestions, then the whole library',
    run() {
      assert.match(playerSource, /'guided\.swap\.search'/);
      assert.match(playerSource, /'guided\.swap\.suggested'/);
      assert.match(playerSource, /'guided\.swap\.library'/);
      // The library list is derived and capped: 873 rows inside a sheet is a
      // scroll, not a choice.
      assert.match(playerSource, /const swapLibrary = useMemo/);
      assert.match(playerSource, /\.slice\(0, 25\)/);
      assert.match(playerSource, /\.slice\(0, 40\)/);
      // And an empty search says so rather than drawing nothing.
      assert.match(playerSource, /'guided\.swap\.noMatch'/);
    },
  },
  {
    name: 'guided swap: every new string reads in both languages',
    run() {
      for (const key of [
        'guided.swap.search',
        'guided.swap.suggested',
        'guided.swap.library',
        'guided.swap.noMatch',
      ]) {
        const occurrences = i18nSource.split(`'${key}':`).length - 1;
        assert.equal(occurrences, 2, `${key} is missing one of its two languages`);
      }
    },
  },
  {
    /**
     * The rest runs out into the set.
     *
     * It used to hold at zero, say READY and count how far over you were, and
     * the reader had to press "Aloita sarja" — on the theory that a set screen
     * nobody asked for is worse than an overrun. From the gym, watching the
     * ring reach zero: "sarja 2 pitäis alkaa nyt itsestään mutta ei ala vain
     * tuli valmista ruutu ja tämä on väärin" (user 2026-09-09). So a rest
     * expires like a drill does, the ring says only what is left, and the
     * READY state, the "/ 2:00" total and the start button went with their copy.
     */
    name: 'guided rest: the wait runs out into the set, and says only what is left',
    run() {
      assert.doesNotMatch(playerSource, /restHoldsAtZero|restIsOver/);
      // Expiry advances — the branch every timed step takes.
      assert.match(playerSource, /if \(next <= 0\) \{[\s\S]{0,1200}?expireRef\.current\(\);/);
      // A deadline already in the past is still not handed to the OS.
      assert.match(playerSource, /step\.type === 'rest' && endsAtRef\.current > Date\.now\(\)/);
      // And a rest that now runs out on its own must not run out behind the
      // "fix the set you just logged" sheet, whose edits commit on Save only.
      assert.match(playerSource, /const frozen =[^;]*\|\| restEditOpen[^;]*;/);
      for (const key of [
        'guided.rest.of',
        'guided.rest.ready',
        'guided.rest.over',
        'guided.rest.startSet',
        'guided.rest.startSetWeight',
      ]) {
        assert.equal(i18nSource.includes(`'${key}'`), false, `${key} outlived its screen`);
        assert.equal(playerSource.includes(`'${key}'`), false, `${key} is still rendered`);
      }
    },
  },
  {
    /**
     * −15 s takes time away, +15 s adds it, Tauko holds: three same-shaped
     * outlines the reader told apart by reading, mid-set, at arm's length.
     * Colour does it without reading (user 2026-09-09, light theme).
     */
    name: 'guided rest: the three timer controls are red, green and amber',
    run() {
      assert.match(playerSource, /label="−15s"\s+tint=\{theme\.danger\}/);
      assert.match(playerSource, /label="\+15s"\s+tint=\{theme\.green\}/);
      assert.match(playerSource, /icon=\{paused \? 'play' : 'pause'\}\s+tint=\{theme\.amber\}/);
    },
  },
  {
    /**
     * "16,25" had to share its row with two buttons and lost the ",25"; the
     * reps number was squeezed the same way. The reader's sketch (2026-09-09):
     * the number on its own line, −/+ under it, always there, and "tap to
     * type" under those. Both cards type now, not only the weight.
     */
    name: 'guided dial: number above, buttons always below, both cards type',
    run() {
      // The buttons render unconditionally, under the number, above the hint.
      assert.match(
        playerSource,
        /<\/Pressable>\s*<View style=\{styles\.setDialControls\}>\s*<DialButton glyph="−"[^\n]*\n\s*<DialButton glyph="\+"[^\n]*\n\s*<\/View>/,
      );
      assert.doesNotMatch(playerSource, /open \? \(\s*<View style=\{styles\.setDialControls\}>/);
      // The reps card steps and commits through the lib rule, inside the same
      // bounds, as the weight card does — a stepper without a ceiling and a
      // field with one would disagree about the same number.
      assert.match(
        playerSource,
        /onStep=\{\(direction\) => setReps\(\(current\) => stepDialReps\(current, direction, timed \? HOLD_DIAL : REPS_DIAL\)\)\}/,
      );
      assert.match(
        playerSource,
        /onCommit=\{\(text\) => setReps\(\(current\) => commitDialReps\(text, current, timed \? HOLD_DIAL : REPS_DIAL\)\)\}/,
      );
      // No "tap to type" line under the buttons: it was in the sketch and
      // struck out on the phone the same day ("napauta ja kirjoita poista nämä").
      assert.doesNotMatch(playerSource, /setDialHint|guided\.dial\.tapToType/);
      assert.equal(i18nSource.includes("'guided.dial.tapToType'"), false);
      // Typing commits on every keystroke: the log button reads the number in
      // the same tick it closes the card, and a commit deferred to blur, to
      // the done key or to an unmount was a typed weight logged as the old one.
      assert.match(playerSource, /onChangeText=\{\(text\) => \{\s*setDraft\(text\);\s*onCommit\(text\);\s*\}\}/);
      assert.doesNotMatch(playerSource, /draftRef|onCommitRef/);
    },
  },
  {
    /**
     * Where you are in the workout is a colour, not a size.
     *
     * The rail gave the current exercise the same purple as the finished ones
     * and told them apart by two pixels of height and twice the width — on a
     * 5px bar, read at arm's length between sets (user 2026-09-01).
     *
     * Amber carried that mark until 2026-09-04, when the session flow started
     * using amber for a body part the reader flagged in setup. Two meanings
     * for one colour in one flow is the problem the size difference was: the
     * rail moved to `highlight` for here and `green` for done, which are the
     * same two colours every other screen of the session uses, and amber is
     * now caution and nothing else.
     */
    name: 'guided player: the rail says here and done in the two colours the session uses',
    run() {
      // The bar no longer shares a branch with `done`.
      assert.doesNotMatch(
        playerSource,
        /done \|\| isCurrent \? \(dark \? GPD\.purple : theme\.purple\)/,
        'the current exercise is the same colour as a finished one again',
      );
      // Here / done / ahead, three states in one expression.
      assert.match(
        playerSource,
        /backgroundColor: isCurrent \? theme\.highlight : done \? theme\.green : theme\.faint/,
      );

      // The multi-set pill is the current exercise too, so it wears the same
      // mark: a `highlight` rim, `highlight` on the set being worked, and
      // green on the sets already logged.
      assert.match(playerSource, /borderColor: theme\.highlight/);
      assert.match(playerSource, /dot === dotIndex\s+\? theme\.highlight/);
      assert.match(playerSource, /dot < dotsDone\s+\? theme\.green/);

      // And amber is gone from the rail entirely — including the dark
      // gradient's own palette, which no longer carries one.
      assert.doesNotMatch(playerSource, /GPD\.amber/, 'the rail palette still has an amber to reach for');
    },
  },
  {
    /**
     * A borrowed "last time" is a different claim from this slot's own.
     *
     * `LastTimeView.borrowed` has existed since 2026-08-29 with a comment
     * asking for it to be said out loud, and `resolveSlotHistory` set it on
     * every view — but neither heading that shows the number read it. So the
     * first time a pump day came round, the heavy day's weight for the same
     * lift sat under "VIIME KERRALLA" as this day's own record, and under
     * "VIIMEKSI" on the walk-up card one step before (#bugs 2026-09-09,
     * "3x20 10kg ei pidä paikkansa ... eri päivä"). The number stays; both
     * headings say where it came from.
     */
    name: 'guided player: a borrowed last time says so on the set card and on the walk-up card',
    run() {
      // The view carries the flag...
      assert.match(playerSource, /borrowed: resolved\?\.borrowed \?\? false,/);
      // ...and both surfaces that print its number choose their heading by it.
      assert.match(
        playerSource,
        /panels\.history\.borrowed\s*\?\s*'guided\.card\.lastTimeBorrowed'\s*:\s*'guided\.card\.lastTime'/,
      );
      assert.match(playerSource, /last\?\.borrowed\s*\?\s*'guided\.walk\.lastBorrowed'\s*:\s*'guided\.walk\.last'/);
      // Both claims exist in both dictionaries, and each visibly differs from
      // the plain heading — a borrowed heading identical to the plain one
      // would be the bug wearing a new key. The qualifier sits on a second
      // line: the set card's row has no room for a longer first one.
      const borrowedHeadings =
        i18nSource.match(/'guided\.(?:card\.lastTimeBorrowed|walk\.lastBorrowed)': '[^']+'/g) ?? [];
      assert.equal(borrowedHeadings.length, 4, 'two borrowed headings, each in EN and FI');
      assert.match(i18nSource, /'guided\.card\.lastTimeBorrowed': 'LAST TIME\\n[^']+'/);
      assert.match(i18nSource, /'guided\.card\.lastTimeBorrowed': 'VIIME KERRALLA\\n[^']+'/);
      assert.match(i18nSource, /'guided\.walk\.lastBorrowed': 'LAST\\n[^']+'/);
      assert.match(i18nSource, /'guided\.walk\.lastBorrowed': 'VIIMEKSI\\n[^']+'/);
    },
  },
  {
    /**
     * The rest screen, from the gym: "vähän liikaa kaikkea". The next set's
     * card and the "Seuraava · …" line under the buttons said what the ring
     * already implied, three ways; the logged card cut its own text at one
     * line. What is left: what was logged (name, then numbers), how long is
     * left, three controls, skip (user 2026-09-09).
     */
    name: 'guided rest: what was logged and how long is left, nothing about the set to come',
    run() {
      assert.doesNotMatch(playerSource, /restNextCard|restTargetRow|restChosenKg|restTargetMove/);
      for (const key of ['guided.rest.nextSet', 'guided.rest.target', 'guided.rest.targetHold']) {
        assert.equal(i18nSource.includes(`'${key}'`), false, `${key} outlived its card`);
      }
      // The logged card: the name may take two lines, the numbers follow it.
      assert.match(playerSource, /<Text style=\{styles\.restLoggedName\} numberOfLines=\{2\}>\s*\{restLogged\.name\}/);
      assert.match(playerSource, /<Text style=\{styles\.restLoggedValue\}>\{restLogged\.detail\}<\/Text>/);
      // One NextLine left in the file: the drills'. The rest screen's is gone.
      assert.equal((playerSource.match(/<NextLine /g) ?? []).length, 1);
    },
  },
  {
    /**
     * The walk-up's finished-lift card is two lines — check and name, then
     * weight and reps — so the screen after a lift fits without scrolling
     * (user 2026-09-09, "max 2 riviä valmis osiolle että ei tarvitse
     * skrollata").
     */
    name: 'guided walk-up: the finished lift is a check, its name, and one row of numbers',
    run() {
      assert.doesNotMatch(playerSource, /walkDoneLabel|guided\.walk\.done/);
      assert.match(
        playerSource,
        /<GPIcon name="check"[^\n]*\n\s*<\/View>\s*<Text style=\{\[styles\.walkDoneName, \{ flex: 1, minWidth: 0 \}\]\} numberOfLines=\{1\}>/,
      );
      assert.match(playerSource, /\{walkDone\.weight \? <Text style=\{styles\.walkDoneWeight\}>\{walkDone\.weight\}<\/Text> : null\}/);
      assert.equal(i18nSource.includes("'guided.walk.done'"), false);
    },
  },
  {
    /**
     * The recovery splash is its title and its list. "Treeni valmis",
     * "SEURAAVAKSI" and "2 venytystä · ~4 min" were three lines about a
     * screen that shows its own contents (user 2026-09-09). The warm-up and
     * workout splashes keep theirs until asked.
     */
    name: 'guided splash: the recovery splash drops the done row, the eyebrow and the length',
    run() {
      assert.match(playerSource, /\{step\.doneLabel && step\.phase !== 'cooldown' \? \(/);
      assert.match(playerSource, /\{step\.phase !== 'cooldown' \? \(\s*<Text[^\n]*\n\s*\{t\(language, 'guided\.upNext'\)\}/);
      assert.match(playerSource, /\{step\.phase !== 'cooldown' \? \(\s*<Text[^\n]*\{step\.sub\}<\/Text>\s*\) : null\}/);
    },
  },
  {
    /**
     * Nothing flashes between the last set and the summary. "{title} — valmis"
     * and a spinner were on screen for the length of the save (user
     * 2026-09-09, "tämä valmis ja treeni valmis osion väliin ei saa jäädä
     * mitään mikä välähtää").
     */
    name: 'guided finish: the step that exists for the length of a save says nothing',
    run() {
      assert.match(playerSource, /<StepIn stepKey="finish">\s*<View style=\{\{ flex: 1 \}\} \/>\s*<\/StepIn>/);
      assert.doesNotMatch(playerSource, /finishTitle|ActivityIndicator|guided\.finish\.title|guided\.finish\.saving/);
      for (const key of ['guided.finish.title', 'guided.finish.saving', 'guided.finish.continue']) {
        assert.equal(i18nSource.includes(`'${key}'`), false, `${key} outlived its screen`);
      }
    },
  },
];
