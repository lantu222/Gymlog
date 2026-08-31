const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const panelSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'src', 'components', 'SetPanels.tsx'),
  'utf8',
);
const playerSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'src', 'screens', 'GuidedPlayerScreen.tsx'),
  'utf8',
);
const i18nSource = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'lib', 'i18n.ts'), 'utf8');

/**
 * The set screen's top slot: last time, the photo, the instructions.
 *
 * Design "GAINER Sarjaruudun paneelit". The slot was a photo and nothing else,
 * which answers a question you have once — the one you have standing at the
 * rack is what you lifted last time.
 */
module.exports = [
  {
    name: 'set panels: the panel that opens is the one with something to say',
    run() {
      // History first when it exists, the photo when it does not. A reader who
      // has never done the lift should not land on an empty table.
      assert.match(
        panelSource,
        /history && history\.sets\.length > 0 \? 0 : Math\.min\(panels\.indexOf\('image'\)/,
      );
      // And it is re-asked per exercise rather than held from the last one.
      assert.match(panelSource, /openedFor\.current !== signature/);
    },
  },
  {
    name: 'set panels: a panel with nothing in it is not offered',
    run() {
      // No photo in the library, no photo panel. No instructions, no
      // instructions panel — rather than a dot that leads to a blank screen.
      assert.match(panelSource, /if \(imageUrl\) \{\s*\r?\n\s*kinds\.push\('image'\)/);
      assert.match(panelSource, /if \(instructions\.length > 0\) \{\s*\r?\n\s*kinds\.push\('instructions'\)/);
      // One panel is not a carousel, so the chrome goes away entirely.
      assert.match(panelSource, /panels\.length > 1 \? \(/);
    },
  },
  {
    name: 'set panels: arrows and dots, not swipe alone',
    run() {
      // A draggable was killed once in this app by a parent Pressable eating
      // the gesture. Every panel stays reachable by tap.
      assert.match(panelSource, /label=\{t\(language, 'panels\.a11y\.previous'\)\}/);
      assert.match(panelSource, /label=\{t\(language, 'panels\.a11y\.next'\)\}/);
      // The chevrons are real buttons, not decoration on a scroll view.
      assert.match(panelSource, /accessibilityRole="button"[\s\S]{0,120}onPress=\{onPress\}/);
      assert.match(panelSource, /onPress=\{\(\) => goTo\(dot\)\}/);
      // The swipe is the platform's own paging, not a hand-rolled pan.
      assert.match(panelSource, /pagingEnabled/);
    },
  },
  {
    name: 'set panels: the set screen renders them instead of the bare photo',
    run() {
      assert.match(playerSource, /<SetPanels\b/);
      // The best set is marked only when it actually beat the others.
      assert.match(playerSource, /last\.sets\.some\(\(other\) => other\.loadKg < heaviest\)/);
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
     * is guarded is that there is one reader, with the same inputs.
     */
    name: 'set panels: the table and the prefill resolve last time the same way',
    run() {
      assert.match(playerSource, /resolveLastTimeEntry\(\{/);
      assert.doesNotMatch(playerSource, /workout\.history\.slotHistory\[slotId\]/);
      // Every input the prefill uses: the unscoped key an older install wrote
      // under, the loaded-lift rule, and the rep prescription that keeps a
      // heavy day's weight off a 15-20 day.
      assert.match(playerSource, /templateSlotId: instance\?\.templateSlotId/);
      assert.match(playerSource, /requireLoaded: instance \? !isUnloadedTrackingMode/);
      assert.match(playerSource, /repWindow: instance \? resolveInstanceBorrowRepWindow\(instance\)/);
      // Borrowed sets are shown, and said to be borrowed.
      assert.match(playerSource, /borrowed: resolved\?\.borrowed \?\? false/);
      assert.match(
        panelSource,
        /history\.borrowed \? 'panels\.last\.titleBorrowed' : 'panels\.last\.title'/,
      );
    },
  },
  {
    /**
     * One selector for "the newest session that actually happened", used by
     * the prefill and by the panel. A skipped day is not a last time — it is a
     * day the lift did not happen.
     */
    name: 'set panels: a skipped day is not a last time, decided in one place',
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
    name: 'set panels: every string reads in both languages',
    run() {
      for (const key of [
        'panels.last.title',
        'panels.last.titleBorrowed',
        'panels.last.colSet',
        'panels.last.colLoad',
        'panels.last.colReps',
        'panels.last.record',
        'panels.last.emptyTitle',
        'panels.last.emptyBody',
        'panels.image.title',
        'panels.how.title',
        'panels.how.steps',
        'panels.a11y.previous',
        'panels.a11y.next',
      ]) {
        const occurrences = i18nSource.split(`'${key}':`).length - 1;
        assert.equal(occurrences, 2, `${key} is missing one of its two languages`);
      }
    },
  },
];
