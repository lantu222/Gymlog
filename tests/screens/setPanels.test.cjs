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
      // Slot history is the workout store's, and a skipped day is not a "last
      // time" — it is a day the lift did not happen.
      assert.match(playerSource, /workout\.history\.slotHistory\[slotId\]/);
      assert.match(playerSource, /!entry\.skipped && entry\.sets\.length > 0/);
      // The best set is marked only when it actually beat the others.
      assert.match(playerSource, /last\.sets\.some\(\(other\) => other\.loadKg < heaviest\)/);
    },
  },
  {
    name: 'set panels: every string reads in both languages',
    run() {
      for (const key of [
        'panels.last.title',
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
