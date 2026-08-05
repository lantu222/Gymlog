const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  PROGRAM_CATEGORIES,
  countByCategory,
  filterByCategory,
  isInCategory,
} = require('../../.test-dist/lib/programCategories.js');
const { WORKOUT_TEMPLATES_V1 } = require('../../.test-dist/features/workout/workoutCatalog');

function read(...segments) {
  return fs.readFileSync(path.join(__dirname, '..', '..', ...segments), 'utf8');
}

module.exports = [
  {
    name: 'every category opens something, and every program is reachable',
    run() {
      const counts = countByCategory(WORKOUT_TEMPLATES_V1);
      for (const category of PROGRAM_CATEGORIES) {
        // A tile that says "0" is worse than no tile: it reads as broken.
        assert.ok(counts[category.key] > 0, `${category.key} is empty`);
      }

      // Nothing may be stranded. A program in none of them is one a
      // browsing user can only find by search, which is what these rows exist
      // to replace.
      const reachable = new Set();
      for (const category of PROGRAM_CATEGORIES) {
        for (const template of filterByCategory(WORKOUT_TEMPLATES_V1, category.key)) {
          reachable.add(template.id);
        }
      }
      const stranded = WORKOUT_TEMPLATES_V1.filter((template) => !reachable.has(template.id));
      assert.deepEqual(
        stranded.map((template) => template.name),
        [],
        'these programs are in no category',
      );
    },
  },
  {
    name: 'the hand-listed categories name programs that exist',
    run() {
      // Fat loss and conditioning cannot be derived — the catalog does not
      // encode "this is a cut" — so they name their members, which is the id
      // typo trap that has bitten this codebase twice. A wrong id here does
      // not throw; the row is just one program short.
      const ids = new Set(WORKOUT_TEMPLATES_V1.map((template) => template.id));
      const source = read('src', 'lib', 'programCategories.ts');
      // Anchored on the _v1 suffix every catalog id carries: the loose
      // version also matched the 'tpl_focus_' prefix used with startsWith,
      // and reported the prefix as a missing program.
      const listed = source.match(/'tpl_[a-z0-9_]+_v[0-9]+'/g) ?? [];
      assert.ok(listed.length > 0, 'the hand-listed ids should be findable');
      const unknown = [...new Set(listed.map((quoted) => quoted.slice(1, -1)))].filter(
        (id) => !ids.has(id),
      );
      assert.deepEqual(unknown, [], `not in the catalog: ${unknown.join(', ')}`);
    },
  },
  {
    name: 'a program may sit in more than one category, and the single-muscle days sit in one',
    run() {
      const byName = (name) => WORKOUT_TEMPLATES_V1.find((template) => template.name === name);

      // Both strength and beginner. Hiding it from one to keep the sets
      // disjoint would make both rows worse.
      const fives = byName('Strength Foundations 5x5');
      assert.ok(fives);
      assert.equal(isInCategory(fives, 'strength'), true);
      assert.equal(isInCategory(fives, 'beginner'), true);

      // A one-day add-on is hypertrophy, but it is not a growth PROGRAM, and
      // putting it in "Muscle" would bury the real ones under six day-cards.
      const chestDay = byName('Chest Day');
      assert.ok(chestDay);
      assert.equal(isInCategory(chestDay, 'focus'), true);
      assert.equal(isInCategory(chestDay, 'muscle'), false);
    },
  },
  {
    name: 'the rail can reach what a tile promises',
    run() {
      const screen = read('src', 'screens', 'ProgramsHomeScreen.tsx');
      const app = read('App.tsx');

      // Explore was eight hand-picked ids. A tile saying "Voima 8" filtering
      // that list would open three, so the filtered rail reads the whole
      // catalog instead.
      assert.match(app, /catalogItems=\{programsCatalogItems\}/);
      assert.match(app, /workout\.templates\.map\(\(template, index\) => \(\{/);
      assert.match(screen, /categoryMembers\[category\]\?\.includes\(item\.id\)/);
      // Counts come from the same source as the filter, so a tile cannot
      // promise a number the rail does not have.
      assert.match(app, /countByCategory\(workout\.templates\)/);
      assert.match(screen, /categoryCounts\[key\]/);
    },
  },
];
