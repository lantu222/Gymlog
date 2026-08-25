const assert = require('node:assert/strict');

const {
  localizeSessionName,
  localizeWorkoutFocus,
} = require('../../.test-dist/lib/sessionNameLabel');

module.exports = [
  {
    name: 'session focus: the ordinal goes where something else already names the day',
    run() {
      const { localizeSessionFocus } = require('../../.test-dist/lib/sessionNameLabel.js');

      // The home card carries a MA/TO badge, so "Päivä 1:" said it twice and
      // cost the focus the width it then truncated for.
      assert.equal(localizeSessionFocus('Day 1: Full Body', 'fi'), 'Koko keho');
      assert.equal(localizeSessionFocus('HOME Starter - Day 2: Upper Body', 'fi'), 'Ylävartalo');
      assert.equal(localizeSessionFocus('Day 1: Full Body', 'en'), 'Full Body');

      // A name with no day in it is just the name.
      assert.equal(localizeSessionFocus('Bench Day', 'fi'), 'Penkkipäivä');

      // The editor's placeholder has no focus to fall back on, so the ordinal
      // stays rather than leaving an empty row.
      assert.equal(localizeSessionFocus('Day 3', 'fi'), 'Päivä 3');
      assert.equal(localizeSessionFocus('Day 3:', 'fi'), 'Päivä 3');
      assert.equal(localizeSessionFocus('', 'fi'), '');

      // Custom programmes SAVE their session names in Finnish (by design —
      // customProgramDuplication), and the Finnish ordinal used to slip
      // through untouched: "Päivä 1:" came back onto the very rows this
      // function exists to unclutter (user, 2026-08-25).
      assert.equal(localizeSessionFocus('Päivä 1: Koko keho + HIIT', 'fi'), 'Koko keho + HIIT');
      assert.equal(localizeSessionFocus('Päivä 3', 'fi'), 'Päivä 3');
    },
  },
  {
    name: 'session names keep the plan brand and translate the structure',
    run() {
      assert.equal(
        localizeSessionName('HOME Starter - Day 1: Full Body', 'fi'),
        'HOME Starter - Päivä 1: Koko keho',
      );
      assert.equal(
        localizeSessionName('STRONG Elite - Day 3: Upper (Heavy)', 'fi'),
        'STRONG Elite - Päivä 3: Ylävartalo (raskas)',
      );
    },
  },
  {
    name: 'English is the source of truth and passes through untouched',
    run() {
      const name = 'HOME Starter - Day 1: Full Body';
      assert.equal(localizeSessionName(name, 'en'), name);
      assert.equal(localizeSessionName(name), name);
    },
  },
  {
    name: 'focus decomposes on the separators the catalogs use',
    run() {
      assert.equal(localizeWorkoutFocus('Chest & Triceps', 'fi'), 'Rinta & Ojentajat');
      assert.equal(localizeWorkoutFocus('Full Body + HIIT', 'fi'), 'Koko keho + HIIT');
      assert.equal(localizeWorkoutFocus('Squat & Bench', 'fi'), 'Kyykky & Penkki');
    },
  },
  {
    name: 'whole-phrase entries win over decomposition',
    run() {
      assert.equal(localizeWorkoutFocus('Full Body Circuit', 'fi'), 'Koko kehon kierto');
      assert.equal(localizeWorkoutFocus('Lower Power', 'fi'), 'Alavartalon teho');
    },
  },
  {
    name: 'unknown catalog copy degrades to English instead of breaking',
    run() {
      assert.equal(localizeWorkoutFocus('Sandbag Carries', 'fi'), 'Sandbag Carries');
      assert.equal(
        localizeSessionName('NEW Plan - Day 2: Sandbag Carries', 'fi'),
        'NEW Plan - Päivä 2: Sandbag Carries',
      );
    },
  },
  {
    name: 'a name without a Day prefix still gets its focus translated',
    run() {
      assert.equal(localizeSessionName('Upper Body', 'fi'), 'Ylävartalo');
    },
  },
  {
    name: 'no session name is left half-English, which a same-string check misses',
    run() {
      const { WORKOUT_TEMPLATES_V1 } = require('../../.test-dist/features/workout/workoutCatalog');

      // The obvious check — "did the string come back unchanged" — passes for
      // "Morning Mobility (Full Body)" -> "Morning Mobility (Koko keho)",
      // because the qualifier translated and the head did not. Fourteen names
      // were sitting half-translated behind exactly that blind spot.
      //
      // Loanwords Finnish uses as-is are allowed; the rest must not survive.
      const KEEP = new Set([
        'hiit', 'tabata', 'emom', 'amrap', 'vinha', 'strong', 'huge', 'shred',
        'fit', 'home', 'run', 'reset', 'powerbuild', 'focus', 'flow', 'plyo',
        'planche', 'lever', 'muscle', 'muscle-up', 'front', 'day', 'ppl',
      ]);

      const leftovers = [];
      for (const template of WORKOUT_TEMPLATES_V1) {
        for (const session of template.sessions) {
          const finnish = localizeSessionName(session.name, 'fi');
          const source = new Set(session.name.toLowerCase().match(/[a-z-]{4,}/g) ?? []);
          const survived = (finnish.toLowerCase().match(/[a-z-]{4,}/g) ?? []).filter(
            (word) => source.has(word) && !KEEP.has(word),
          );
          if (survived.length > 0) {
            leftovers.push(`${session.name} -> ${finnish}`);
          }
        }
      }
      assert.equal(leftovers.length, 0, `half-English: ${leftovers.slice(0, 5).join(' | ')}`);
    },
  },
];
