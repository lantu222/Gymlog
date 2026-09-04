const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sheetSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'src', 'components', 'ExerciseSheet.tsx'),
  'utf8',
);
const playerSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'src', 'screens', 'GuidedPlayerScreen.tsx'),
  'utf8',
);
const i18nSource = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'lib', 'i18n.ts'), 'utf8');

/**
 * The set screen's exercise card, and the sheet it opens.
 *
 * This file guarded components/SetPanels.tsx until 2026-09-04 — three panels
 * swiped sideways at the top of the set screen, from design "GAINER
 * Sarjaruudun paneelit". The panels answered the right questions behind the
 * wrong control: a swipe, above a screen whose whole job is a number you are
 * about to type, and a camera glyph in the header that cost the sound toggle
 * its slot.
 *
 * The card replaced them. It is always on screen, it carries last time's
 * numbers without a tap, and it is the only door to the sheet. What survives
 * from the old file is everything that was never really about the panels: one
 * reader for "last time", and a skipped day not counting as one.
 */
module.exports = [
  {
    name: 'exercise card: always on screen, and the only way into the sheet',
    run() {
      // Not behind a toggle. The reader standing at the rack should not have
      // to press anything to see what they lifted last time.
      assert.doesNotMatch(playerSource, /\{panelsOpen \?/);
      assert.match(playerSource, /onPress=\{onOpenSheet\}\s*\r?\n\s*style=\{styles\.setExerciseCard\}/);
      assert.match(playerSource, /onOpenSheet=\{\(\) => setSetPanelsOpen\(true\)\}/);
      // And the sheet it opens is the new one, not the retired carousel.
      assert.match(playerSource, /<ExerciseSheet\b/);
      assert.equal(
        fs.existsSync(path.join(__dirname, '..', '..', 'src', 'components', 'SetPanels.tsx')),
        false,
        'the retired panels component is still on disk',
      );
    },
  },
  {
    name: 'the top bar right slot is the sound toggle again, on every screen',
    run() {
      // It held the set screen's info button, which put the one control the
      // design says lives in exactly one place in two. The info moved to the
      // card; the slot went back to sound.
      assert.doesNotMatch(playerSource, /video=\{\s*\r?\n?\s*step\.type === 'set'/);
      assert.doesNotMatch(playerSource, /active: setPanelsOpen/);
      // The card carries the info affordance instead.
      assert.match(playerSource, /<GPIcon name="info"/);
    },
  },
  {
    name: 'the sheet offers the tabs it has content for, and says so when one is empty',
    run() {
      // Three when the lift has teaching written, two when it does not — a
      // Learn tab with nothing in it is worse than no Learn tab (2026-09-04).
      assert.match(sheetSource, /const ALL_TABS: ExerciseSheetTab\[\] = \['learn', 'howTo', 'history'\]/);
      assert.match(sheetSource, /learn \? ALL_TABS : ALL_TABS\.filter\(\(key\) => key !== 'learn'\)/);
      // The photo sits with the instructions rather than in a tab of its own
      // whose other half was the same instructions.
      assert.doesNotMatch(sheetSource, /tab === 'loop'/);
      assert.match(sheetSource, /tab === 'howTo'[\s\S]{0,400}styles\.photo/);
      // A tab with nothing behind it says so rather than rendering blank.
      assert.match(sheetSource, /guided\.sheet\.noInstructions/);
      assert.match(sheetSource, /guided\.sheet\.noHistory/);
      // Today's bar is the accent one; the rest are not.
      assert.match(sheetSource, /bar\.isToday \? theme\.highlight : theme\.purpleLight/);
      // The sheet clears the system bar — the bug the Pro sheet had.
      assert.match(sheetSource, /paddingBottom: insets\.bottom/);
    },
  },
  {
    /**
     * #bugs 2026-08-29: "Alla näkyy viimeksi tehty 27.8 mutta ei näy ylhäällä
     * olevassa taulukossa mitään."
     *
     * The table read `slotHistory[slotId]` and stopped there; the weight badge
     * under it came from the prefill, which falls through to the unscoped key
     * and then to a name lookup. One screen, two readers of one fact — so what
     * is guarded is that there is one reader, with the same inputs. The card
     * inherited the table's half of it.
     */
    name: 'the card and the prefill resolve last time the same way',
    run() {
      assert.match(playerSource, /resolveLastTimeEntry\(\{/);
      assert.doesNotMatch(playerSource, /workout\.history\.slotHistory\[slotId\]/);
      // Every input the prefill uses: the unscoped key an older install wrote
      // under, the loaded-lift rule, and the rep prescription that keeps a
      // heavy day's weight off a 15-20 day.
      assert.match(playerSource, /templateSlotId: instance\?\.templateSlotId/);
      assert.match(playerSource, /requireLoaded: instance \? !isUnloadedTrackingMode/);
      assert.match(playerSource, /repWindow: instance \? resolveInstanceBorrowRepWindow\(instance\)/);
      // Borrowed sets are shown, and still marked as borrowed in the data.
      assert.match(playerSource, /borrowed: resolved\?\.borrowed \?\? false/);
      // The best set is marked only when it actually beat the others.
      assert.match(playerSource, /last\.sets\.some\(\(other\) => other\.loadKg < heaviest\)/);
    },
  },
  {
    /**
     * One selector for "the newest session that actually happened", used by
     * the prefill and by the card. A skipped day is not a last time — it is a
     * day the lift did not happen.
     */
    name: 'a skipped day is not a last time, decided in one place',
    run() {
      const lookupSource = fs.readFileSync(
        path.join(__dirname, '..', '..', 'src', 'lib', 'exerciseHistoryLookup.ts'),
        'utf8',
      );
      assert.match(lookupSource, /export function selectLatestUsableEntry/);
      assert.match(lookupSource, /!entry!\.skipped && entry!\.sets\.length > 0/);

      const stateSource = fs.readFileSync(
        path.join(__dirname, '..', '..', 'src', 'features', 'workout', 'workoutState.ts'),
        'utf8',
      );
      assert.match(stateSource, /const latest = selectLatestUsableEntry\(entries\)/);
    },
  },
  {
    /**
     * PR #57 review: `setPanelSource` opens with `if (step.type !== 'set')
     * return null`, and the rest screen's delta pill and the walk-up screen's
     * LAST card both read it while standing on a rest and a position step. So
     * both were null for everybody, always — and on a device they read as
     * "this lift has no history yet" rather than as a bug.
     *
     * A lift's history is a fact about the slot, not about which step is on
     * screen.
     */
    name: 'last time is resolved per slot, not only on a set step',
    run() {
      assert.match(playerSource, /const resolveSlotHistory = useCallback\(/);
      // The rest screen and the walk-up ask for their own slot.
      assert.match(playerSource, /heaviestOf\(resolveSlotHistory\(step\.slotId, step\.exerciseName\)\)/);
      assert.match(playerSource, /const last = resolveSlotHistory\(step\.slotId, step\.exerciseName\);/);
      // And neither reaches for the set-step value any more.
      assert.doesNotMatch(playerSource, /setPanelSource\?\.history/);
    },
  },
  {
    /**
     * PR #57 review: the walk-up card showed `restSecondsMax` while
     * `buildGuidedSteps` is handed `restSecondsMin` — so a 120-180 lift was
     * promised 180 s and got a 2:00 ring thirty seconds later.
     */
    name: 'the walk-up card names the rest the timer actually runs',
    run() {
      assert.match(playerSource, /rest: instance\.restSecondsMin,/);
      assert.doesNotMatch(playerSource, /rest: instance\.restSecondsMax,/);
      // The one place the plan's rest reaches the step machine, unchanged.
      assert.match(playerSource, /restSeconds: exercise\.restSecondsMin,/);
    },
  },
  {
    /**
     * PR #57 review: the card guarded on the FIRST set's load and printed the
     * heaviest. A session whose set 1 was logged at 0 kg — what the dial
     * offers on a lift with no history — hid a real top set behind a dash.
     */
    name: 'the card decides and prints with the same number',
    run() {
      assert.doesNotMatch(playerSource, /panels\.history\.sets\[0\]/);
      assert.match(playerSource, /heaviestOf\(panels\.history\) > 0/);
    },
  },
  {
    name: 'every string of the card and the sheet reads in both languages',
    run() {
      for (const key of [
        'guided.sheet.tab.learn',
        'guided.sheet.tab.howTo',
        'guided.sheet.tab.history',
        'guided.sheet.today',
        'guided.sheet.bestSet',
        'guided.sheet.oneRepMax',
        'guided.sheet.sessions',
        'guided.sheet.topSets',
        'guided.sheet.noHistory',
        'guided.sheet.noInstructions',
        'guided.sheet.watchFor',
        'guided.sheet.pr',
        'guided.sheet.cues',
        'guided.card.hint',
        'guided.card.lastTime',
        'guided.card.firstTime',
        'guided.logSetIndex',
        'guided.rest.editTitle',
        'guided.rest.editSave',
      ]) {
        const occurrences = i18nSource.split(`'${key}':`).length - 1;
        assert.equal(occurrences, 2, `${key} is missing one of its two languages`);
      }
      // The retired panels' own strings went with the component.
      assert.doesNotMatch(i18nSource, /'panels\.last\.title'/);
    },
  },
];
