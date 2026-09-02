const assert = require('node:assert/strict');

const {
  EMPTY_CATALOG_QUERY,
  filterProgramCatalog,
  isCatalogQueryEmpty,
  matchesCatalogQuery,
} = require('../../.test-dist/lib/programCatalogFilter.js');

/**
 * The catalog screen's three narrowings.
 *
 * The nine goal discs are a taxonomy, so "a four-day muscle programme I can
 * start as a beginner" has no door — the question crosses two of them. This
 * is that door, and everything here is about it staying a narrowing: every
 * clause AND, never a widening, and never an empty screen the reader cannot
 * explain.
 */

const row = (id, name, level, categories, blurb = '') => ({ id, name, level, categories, blurb });

const CATALOG = [
  row('strong', 'STRONG', 'beginner', ['strength', 'beginner'], 'A simple strength-first week.'),
  row('powerbuild', 'POWERBUILD', 'intermediate', ['strength', 'muscle'], 'Strength first, volume after.'),
  row('huge_pro', 'HUGE Pro+', 'advanced', ['muscle'], 'A four-day PPL+1 split.'),
  row('five_by_five', 'Strength Foundations 5x5', 'beginner', ['strength', 'beginner'], 'Five sets of five.'),
  row('home_min', 'HOME Minimal', 'beginner', ['home', 'beginner'], 'Bodyweight only, no gym needed.'),
];

const query = (over = {}) => ({ ...EMPTY_CATALOG_QUERY, ...over });

module.exports = [
  {
    name: 'catalog filter: an empty query is the whole catalog',
    run() {
      assert.equal(filterProgramCatalog(CATALOG, EMPTY_CATALOG_QUERY).length, CATALOG.length);
      assert.equal(isCatalogQueryEmpty(EMPTY_CATALOG_QUERY), true);
      // Whitespace is not a search. A reader who tapped the field and typed a
      // space has not narrowed anything, and must not see "0 of 57".
      assert.equal(isCatalogQueryEmpty(query({ search: '   ' })), true);
      assert.equal(filterProgramCatalog(CATALOG, query({ search: '   ' })).length, CATALOG.length);
    },
  },
  {
    /**
     * The crossing the goal discs cannot express, and the reason this screen
     * exists: level AND goal at once.
     */
    name: 'catalog filter: level and goal narrow together, never apart',
    run() {
      assert.deepEqual(
        filterProgramCatalog(CATALOG, query({ level: 'beginner' })).map((entry) => entry.id),
        ['strong', 'five_by_five', 'home_min'],
      );
      assert.deepEqual(
        filterProgramCatalog(CATALOG, query({ goal: 'strength' })).map((entry) => entry.id),
        ['strong', 'powerbuild', 'five_by_five'],
      );
      assert.deepEqual(
        filterProgramCatalog(CATALOG, query({ level: 'beginner', goal: 'strength' })).map((e) => e.id),
        ['strong', 'five_by_five'],
        'adding a filter widened the result',
      );

      // A crossing nothing satisfies is empty, not "the nearest thing".
      assert.deepEqual(filterProgramCatalog(CATALOG, query({ level: 'advanced', goal: 'home' })), []);
    },
  },
  {
    /**
     * A programme can sit in several categories — POWERBUILD is strength and
     * muscle both. Matching on a single category field would have hidden it
     * from one of its own discs.
     */
    name: 'catalog filter: a programme in two categories is found under both',
    run() {
      const underStrength = filterProgramCatalog(CATALOG, query({ goal: 'strength' }));
      const underMuscle = filterProgramCatalog(CATALOG, query({ goal: 'muscle' }));
      assert.ok(underStrength.some((entry) => entry.id === 'powerbuild'));
      assert.ok(underMuscle.some((entry) => entry.id === 'powerbuild'));
    },
  },
  {
    name: 'catalog filter: search survives how people actually type a name',
    run() {
      const find = (search) => filterProgramCatalog(CATALOG, query({ search })).map((e) => e.id);

      assert.deepEqual(find('strong'), ['strong']);
      assert.deepEqual(find('STRONG'), ['strong'], 'case must not matter');
      // The blurb counts too: "five sets" is nowhere in a name.
      assert.deepEqual(find('five sets'), ['five_by_five'], 'the blurb is searched as well');
      assert.deepEqual(find('5x5'), ['five_by_five']);
      assert.deepEqual(find('strength   foundations'), ['five_by_five'], 'collapsed whitespace');
      assert.deepEqual(find('  HUGE pro  '), ['huge_pro'], 'trimmed');
      // "+" is a literal in a programme name, not a regex quantifier. A naive
      // implementation throws or matches nothing here.
      assert.deepEqual(find('Pro+'), ['huge_pro']);
      assert.deepEqual(find('no such programme'), []);

      // Someone typing a description rather than a name still lands: the
      // blurbs say what the names do not.
      assert.deepEqual(find('bodyweight'), ['home_min']);
    },
  },
  {
    name: 'catalog filter: search narrows what the chips already narrowed',
    run() {
      assert.deepEqual(
        filterProgramCatalog(CATALOG, query({ level: 'beginner', search: 'strong' })).map((e) => e.id),
        ['strong'],
      );
      assert.deepEqual(
        filterProgramCatalog(CATALOG, query({ level: 'advanced', search: 'strong' })),
        [],
        'the level filter still applies once text is typed',
      );
      assert.equal(isCatalogQueryEmpty(query({ level: 'advanced' })), false);
      assert.equal(isCatalogQueryEmpty(query({ goal: 'home' })), false);
      assert.equal(isCatalogQueryEmpty(query({ search: 'x' })), false);
    },
  },
  {
    name: 'catalog filter: the row list is never mutated',
    run() {
      const before = CATALOG.map((entry) => entry.id);
      filterProgramCatalog(CATALOG, query({ level: 'beginner', goal: 'strength', search: 'a' }));
      assert.deepEqual(CATALOG.map((entry) => entry.id), before);
    },
  },
  {
    /**
     * The real catalog, asked through the same helpers the screen uses.
     *
     * A filter combination that shows nothing is a legitimate answer, but a
     * CHIP that always shows nothing is a dead control — the "Length" chip in
     * piece 04 was exactly that, and the only way that was found was measuring
     * the shipped modules rather than reading the source.
     */
    name: 'catalog filter: every chip the screen offers finds something in the real catalog',
    run() {
      const { WORKOUT_TEMPLATES_V1 } = require('../../.test-dist/features/workout/workoutCatalog.js');
      const { PROGRAM_CATEGORIES, isInCategory } = require('../../.test-dist/lib/programCategories.js');
      const { getReadyProgramContent } = require('../../.test-dist/lib/readyProgramContent.js');

      const rows = WORKOUT_TEMPLATES_V1.map((template) => ({
        id: template.id,
        name: template.name,
        blurb: getReadyProgramContent(template.id, 'en')?.summary ?? '',
        level: template.level,
        categories: PROGRAM_CATEGORIES.filter((category) => isInCategory(template, category.key)).map(
          (category) => category.key,
        ),
      }));

      assert.ok(rows.length > 50, `only ${rows.length} programmes — the catalog moved`);

      for (const level of ['beginner', 'intermediate', 'advanced']) {
        assert.ok(
          filterProgramCatalog(rows, query({ level })).length > 0,
          `the ${level} chip finds nothing`,
        );
      }
      for (const category of PROGRAM_CATEGORIES) {
        assert.ok(
          filterProgramCatalog(rows, query({ goal: category.key })).length > 0,
          `the ${category.key} chip finds nothing`,
        );
      }

      // Every programme is reachable with no filters on, and every one of them
      // is findable by its own name — a row nothing can search for is a row
      // the catalog hides from anyone who knows what they want.
      assert.equal(filterProgramCatalog(rows, EMPTY_CATALOG_QUERY).length, rows.length);
      const unfindable = rows.filter((row) => !matchesCatalogQuery(row, query({ search: row.name })));
      assert.deepEqual(unfindable.map((row) => row.name), []);

      // And every programme belongs to at least one disc, or the goal chips
      // can never reach it.
      const homeless = rows.filter((row) => row.categories.length === 0);
      assert.deepEqual(homeless.map((row) => row.id), []);
    },
  },
];
