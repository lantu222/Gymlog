const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { resolveContinueEntries } = require('../../.test-dist/lib/programContinue.js');
const { resolveProgramAffinity, AFFINITY_REASON_KEYS } = require('../../.test-dist/lib/programAffinity.js');
const { buildProgramCampaigns } = require('../../.test-dist/lib/programCampaigns.js');
const { PROGRAM_CATEGORIES } = require('../../.test-dist/lib/programCategories.js');
const { WORKOUT_TEMPLATES_V1 } = require('../../.test-dist/features/workout/workoutCatalog');

function read(...segments) {
  return fs.readFileSync(path.join(__dirname, '..', '..', ...segments), 'utf8');
}

function session(templateId, performedAt) {
  return { id: `${templateId}-${performedAt}`, workoutTemplateId: templateId, performedAt };
}

const NOW = new Date('2026-08-05T12:00:00.000Z');

module.exports = [
  {
    name: 'continue is logged work, newest first — never programs you merely opened',
    run() {
      const entries = resolveContinueEntries(
        [
          session('a', '2026-08-01T10:00:00.000Z'),
          session('a', '2026-07-28T10:00:00.000Z'),
          session('b', '2026-08-04T10:00:00.000Z'),
          session('active', '2026-08-05T06:00:00.000Z'),
        ],
        { excludeTemplateId: 'active', now: NOW },
      );

      assert.deepEqual(entries.map((entry) => entry.templateId), ['b', 'a']);
      assert.equal(entries[1].sessionCount, 2, 'both sessions count, the newest sorts');
      assert.equal(entries[0].daysSince, 1);
      assert.equal(entries[1].daysSince, 4);

      // The active program owns the hero and the whole week at the top of the
      // screen. Offering it again two rows down makes the page look like it
      // does not know what you are doing.
      assert.ok(!entries.some((entry) => entry.templateId === 'active'));
    },
  },
  {
    name: 'a fresh install has nothing to continue, and says so by being absent',
    run() {
      assert.deepEqual(resolveContinueEntries([], {}), []);
      // A corrupt timestamp cannot be sorted against; dropping that one row
      // beats sorting the whole list by NaN.
      const entries = resolveContinueEntries(
        [session('a', 'not-a-date'), session('b', '2026-08-04T10:00:00.000Z')],
        { now: NOW },
      );
      assert.deepEqual(entries.map((entry) => entry.templateId), ['b']);
      assert.deepEqual(resolveContinueEntries([session('', '2026-08-04T10:00:00.000Z')], {}), []);
    },
  },
  {
    name: 'affinity reads the program you chose, and ranks the better reason first',
    run() {
      const active = { id: 'x', goalType: 'strength', level: 'beginner', daysPerWeek: 3 };
      const catalog = [
        active,
        { id: 'up', goalType: 'strength', level: 'intermediate', daysPerWeek: 4 },
        { id: 'split', goalType: 'strength', level: 'beginner', daysPerWeek: 5 },
        { id: 'light', goalType: 'strength', level: 'advanced', daysPerWeek: 2 },
        { id: 'other', goalType: 'hypertrophy', level: 'beginner', daysPerWeek: 3 },
      ];
      const matches = resolveProgramAffinity(active, catalog, 4);

      // "The same goal one level up" is a better thing to say than "this also
      // runs three days a week", so it is offered first.
      assert.equal(matches[0].templateId, 'up');
      assert.equal(matches[0].reason, 'nextLevel');
      assert.ok(!matches.some((match) => match.templateId === 'x'), 'never itself');
      assert.deepEqual(
        matches.map((match) => match.reason),
        ['nextLevel', 'sameGoalOtherSplit', 'lighterWeek', 'sameDays'],
      );
      assert.equal(matches.length, 4, 'four reasons, four cards, no more');

      // Nothing to read means nothing to claim.
      assert.deepEqual(resolveProgramAffinity(null, catalog), []);
      assert.deepEqual(resolveProgramAffinity(undefined, catalog), []);
    },
  },
  {
    name: 'no single reason may fill the whole row',
    run() {
      // 21 hypertrophy programs share a goal. Taking matches in catalog order
      // would spend every slot on "same goal, different split" and never reach
      // the level-up card, which is the one worth showing.
      const active = WORKOUT_TEMPLATES_V1.find((template) => template.goalType === 'hypertrophy');
      const matches = resolveProgramAffinity(active, WORKOUT_TEMPLATES_V1, 4);
      assert.ok(matches.length > 0);
      // One card per reason, always. On device two cards sat side by side
      // carrying the identical sentence, which reads as a rendering fault
      // rather than as two suggestions.
      const reasons = matches.map((match) => match.reason);
      assert.equal(new Set(reasons).size, reasons.length, `a reason repeated: ${reasons}`);

      // Every reason has a sentence in both languages.
      const i18n = read('src', 'lib', 'i18n.ts');
      for (const key of Object.values(AFFINITY_REASON_KEYS)) {
        const hits = i18n.split('\n').filter((line) => line.trim().startsWith(`'${key}':`));
        assert.equal(hits.length, 2, `${key} is missing a language`);
      }
    },
  },
  {
    name: 'every campaign slide opens something that exists',
    run() {
      const slides = buildProgramCampaigns({
        season: 'winter',
        seasonCount: 21,
        strengthCount: 12,
        exerciseCount: 873,
      });
      assert.equal(slides.length, 4);
      assert.equal(slides[0].target.kind, 'season', 'the season leads — it knows what month it is');
      assert.ok(slides.every((slide) => slide.count > 0));
      // Four slides that turn into each other need four looks. Two of them
      // shared a gradient and the carousel read as the same card returning.
      const gradients = new Set(slides.map((slide) => slide.gradient.join('')));
      assert.equal(gradients.size, slides.length, 'two slides share a gradient');

      // A slide that would claim "0 programs" is worse than one fewer slide.
      const thin = buildProgramCampaigns({
        season: 'summer',
        seasonCount: 0,
        strengthCount: 0,
        exerciseCount: 873,
      });
      assert.deepEqual(thin.map((slide) => slide.key), ['library', 'create']);

      // And each one is a sentence in both languages.
      const i18n = read('src', 'lib', 'i18n.ts');
      for (const slide of slides) {
        for (const key of [slide.kickerKey, slide.titleKey, slide.bodyKey, slide.ctaKey]) {
          const hits = i18n.split('\n').filter((line) => line.trim().startsWith(`'${key}':`));
          assert.equal(hits.length, 2, `${key} is missing a language`);
        }
        // The body states the count, so the number on the card is checkable.
        const body = i18n.split('\n').find((line) => line.trim().startsWith(`'${slide.bodyKey}':`));
        assert.match(body, /\{count\}/);
      }
    },
  },
  {
    name: 'every category tile has its own colour and its own glyph',
    run() {
      // The tiles exist so the row can be scanned rather than read. Two
      // categories sharing a tint or a glyph puts that back to reading.
      const inks = new Set(PROGRAM_CATEGORIES.map((entry) => entry.tint.ink));
      assert.equal(inks.size, PROGRAM_CATEGORIES.length, 'two categories share an ink colour');
      const icons = new Set(PROGRAM_CATEGORIES.map((entry) => entry.icon));
      assert.equal(icons.size, PROGRAM_CATEGORIES.length, 'two categories share a glyph');

      for (const entry of PROGRAM_CATEGORIES) {
        for (const value of Object.values(entry.tint)) {
          assert.match(value, /^#[0-9A-F]{6}$/, `${entry.key} has a colour RN cannot parse: ${value}`);
        }
        assert.match(entry.icon, /^M/, `${entry.key} icon is not a path`);
      }
    },
  },
];
