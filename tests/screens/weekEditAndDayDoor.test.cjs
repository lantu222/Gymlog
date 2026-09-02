const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (...parts) => fs.readFileSync(path.join(__dirname, '..', '..', ...parts), 'utf8');
const detail = read('src', 'screens', 'ProgramDetailScreen.tsx');
const home = read('src', 'screens', 'HomeScreen.tsx');
const i18n = read('src', 'lib', 'i18n.ts');

/**
 * Two asks from the 2026-09-02 device build.
 *
 * "Päivien vaihto liian helppo, tee edit nappi": the programme page's week
 * chips wrote the plan on a tap, and a tap is what a thumb does while
 * scrolling. They take taps only behind an Edit control now.
 *
 * "Painamalla ensimmäistä se vie tähän ruutuun": the Home card's week chips
 * were labels; a training day opens its own day now, through the door App
 * already had for the old session rows.
 */
module.exports = [
  {
    name: 'programme page: the week chips take taps only while editing, and the presets with them',
    run() {
      assert.match(detail, /const \[rhythmEditing, setRhythmEditing\] = useState\(false\);/);
      // Reading the week never costs a tap; the chip is a plain View unless
      // the reader opened editing.
      assert.match(detail, /if \(!onSaveRhythm \|\| !rhythmEditing\) \{\s*return \(\s*<View key=\{slot\.dayKey\}/);
      assert.match(detail, /\{onSaveRhythm && rhythmEditing \? \(\s*<View style=\{styles\.patRow\}>/);
      // The control sits in the section header and names its two states.
      assert.match(detail, /rhythmEditing \? 'detail\.rhythm\.done' : 'detail\.rhythm\.edit'/);
      for (const key of ['detail.rhythm.edit', 'detail.rhythm.done']) {
        assert.equal(i18n.split(`'${key}': '`).length - 1, 2, `${key} in EN and FI`);
      }
    },
  },
  {
    name: 'home: a training-day chip opens its day; a rest day stays a label',
    run() {
      const strip = home.slice(home.indexOf('styles.programWeekStrip'), home.indexOf('styles.programActions'));
      assert.ok(strip.length > 0, 'week strip not found');
      assert.match(strip, /if \(session === null \|\| !onOpenPlanSession\) \{/);
      assert.match(strip, /onPress=\{\(\) => onOpenPlanSession\(session\.id\)\}/);
      // The door itself is App's existing one: the day screen, by session id.
      const app = read('App.tsx');
      assert.match(app, /onOpenPlanSession=\{\(sessionId\) => \{[\s\S]{0,400}screen: 'programDay'/);
    },
  },
];
