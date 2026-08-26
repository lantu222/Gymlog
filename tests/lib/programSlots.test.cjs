const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  FREE_CUSTOM_PROGRAM_LIMIT,
  ProgramLimitReachedError,
  resolveProgramSlots,
} = require('../../.test-dist/lib/programSlots.js');

function read(...segments) {
  return fs.readFileSync(path.join(__dirname, '..', '..', ...segments), 'utf8');
}

module.exports = [
  {
    name: 'programSlots: three of your own on free, unlimited on Pro',
    run() {
      assert.equal(FREE_CUSTOM_PROGRAM_LIMIT, 3);

      const empty = resolveProgramSlots(0, false);
      assert.equal(empty.canCreate, true);
      assert.equal(empty.limit, 3);

      // The cap binds at the limit, not past it: with three you cannot make a
      // fourth. PPL is exactly three, so the most common split in the world
      // sits on the ceiling with no room for a deload or a travel variant —
      // which is the point, and a deliberate step tighter than Hevy's four.
      assert.equal(resolveProgramSlots(2, false).canCreate, true);
      assert.equal(resolveProgramSlots(3, false).canCreate, false);

      for (const count of [0, 3, 9]) {
        const pro = resolveProgramSlots(count, true);
        assert.equal(pro.canCreate, true, `pro at ${count}`);
        assert.equal(pro.limit, null, `pro at ${count}`);
        assert.equal(pro.overLimit, false, `pro at ${count}`);
      }
    },
  },
  {
    name: 'programSlots: a user already over the cap keeps everything and can still edit',
    run() {
      // Hevy's rule, deliberately. Taking something back is the one move that
      // turns a pricing change into a grievance — Hevy removed a shipped
      // feature once and had to restore it after the backlash. So a lapsed or
      // migrated user with nine programs keeps all nine; only the tenth is
      // refused, and nothing in this shape can express "delete some".
      const over = resolveProgramSlots(9, false);
      assert.equal(over.used, 9);
      assert.equal(over.canCreate, false);
      assert.equal(over.overLimit, true);
      assert.equal(over.limit, 3);

      // Negative counts cannot make a slot appear.
      assert.equal(resolveProgramSlots(-4, false).used, 0);
    },
  },
  {
    name: 'the cap is enforced where programs are made, not where they are asked for',
    run() {
      const provider = read('src', 'state', 'AppProvider.tsx');

      // One choke point. Five screens can ask for a program; a check on each
      // is a check that can be forgotten, and forgetting it hands out a paid
      // slot silently.
      assert.match(
        provider,
        /if \(!existingTemplate && draft\.origin !== 'freestyle' && !replacesRunningPlan\) \{[\s\S]{0,400}ProgramLimitReachedError/,
      );
      // The one exemption, and it is verified here rather than claimed by the
      // caller — otherwise a screen could talk its way past the cap by passing
      // an id. A ready programme is immutable, so changing one lift in the one
      // you run means storing a copy; that copy REPLACES the original, so the
      // reader ends with the number of programmes they started with and there
      // is nothing for the cap to count. Copying a second one still counts.
      assert.match(
        provider,
        /current\.preferences\.activePlanIds\.includes\(options\.replacesPlanId\)/,
      );
      // Counted over AUTHORED templates: a freestyle log leaves a template
      // behind, and counting those meant three ad-hoc sessions filled the free
      // tier without the user authoring anything.
      assert.match(provider, /resolveProgramSlots\(\s*countAuthoredPrograms\(current\.workoutTemplates\)/);
      assert.match(provider, /isProUnlocked\(current\.preferences\)/);

      // Editing must never be blocked — the guard sits inside the
      // "no existing template" branch, which is the create case only.
      const gate = provider.slice(
        provider.indexOf("if (!existingTemplate && draft.origin !== 'freestyle' && !replacesRunningPlan) {"),
        provider.indexOf('const workoutTemplateId ='),
      );
      assert.ok(gate.includes('ProgramLimitReachedError'), 'the throw belongs to the create branch');

      const app = require('../helpers/appWiringSource.cjs').readAppWiring();
      // The two authoring entries check before navigating, so the wall lands
      // where the user pressed rather than after they have filled in a form.
      assert.match(app, /programSlots\.canCreate[\s\S]{0,120}setProgramLimitVisible\(true\)/);
      // And the create path still catches the throw, because a screen can be
      // reached by a route the button did not open.
      assert.match(app, /error instanceof ProgramLimitReachedError/);
    },
  },
  {
    name: 'the cap is on authoring: the catalog and the log stay uncapped',
    run() {
      const premium = read('src', 'screens', 'PremiumScreen.tsx');
      // The Pro page (v3) dropped the free/premium table, so this no longer
      // reads a row. It reads the thing that made the row trustworthy: the
      // number in the sales copy is interpolated from the constant that
      // enforces the cap, not typed next to it.
      assert.match(
        premium,
        /titleKey: 'pro\.v3\.delta\.programs\.t',[\s\S]{0,200}?vars: \{ cap: FREE_CUSTOM_PROGRAM_LIMIT \}/,
        'the programs row must take its free number from FREE_CUSTOM_PROGRAM_LIMIT',
      );
      const copy = read('src', 'lib', 'i18n.ts')
        .split('\n')
        .filter((line) => line.includes("'pro.v3.delta.programs.b':"));
      assert.equal(copy.length, 2, 'both languages');
      for (const line of copy) {
        assert.match(line, /\{cap\}/, 'the cap must be a placeholder, never a typed digit');
      }

      // Ready programs and logging are identical in both tiers and the page
      // no longer claims otherwise anywhere. If either ever becomes a
      // difference, it is a decision, not a drift — so nothing on the Pro page
      // may quietly start selling them.
      assert.doesNotMatch(premium, /pro\.v3\.delta\.(ready|logging)/);

      // The wall says what it does not touch. "Three programs" alone reads as
      // a limit on training.
      const i18n = read('src', 'lib', 'i18n.ts');
      const body = i18n.split('\n').filter((line) => line.includes("'programLimit.body':"));
      assert.equal(body.length, 2, 'both languages');
      assert.match(body[0], /ready-made program stays open/);
      assert.match(body[1], /valmis ohjelma pysyy auki/);
    },
  },
  {
    name: 'changing a ready programme copies it, and that copy is not a second programme',
    run() {
      const plan = read('src', 'screens', 'TrainingPlanScreen.tsx');
      const detail = read('src', 'screens', 'ProgramDetailScreen.tsx');
      const day = read('src', 'screens', 'ProgramDayScreen.tsx');
      const app = require('../helpers/appWiringSource.cjs').readAppWiring();

      // "Tee tästä oma versio" stood on all three screens and was removed
      // (user 2026-08-26): it asked the reader to understand that catalog
      // programmes are fixed and theirs are not, before they could change one
      // lift — and the reader hunting for a way to drop an exercise never
      // found it. The duplication still happens, underneath the change.
      for (const source of [plan, detail, day]) {
        assert.doesNotMatch(source, /copyToCustom|ownVersion/);
      }
      assert.doesNotMatch(app, /handleCopyReadyProgramToCustom/);

      // It still reuses the one duplication path rather than a second copier.
      assert.match(app, /buildDuplicatedCustomProgramDraft\([\s\S]{0,80}template\.name/);
      // And the copy replaces the running plan instead of joining it, so the
      // reader keeps the number of programmes they had. Charging a slot to
      // remove one exercise would price editing, which the cap never gates.
      assert.match(app, /upsertWorkoutTemplate\(draft, \{ replacesPlanId: readyPlanId \}\)/);
      assert.match(app, /removeActiveProgram\(preferences\.activePlanIds, readyPlanId\)/);
      // Copying one the reader is only browsing does add, and still counts.
      assert.match(app, /if \(!wasRunning && !programSlots\.canCreate\)/);
    },
  },
  {
    name: 'ProgramLimitReachedError carries the limit it hit',
    run() {
      const error = new ProgramLimitReachedError(3);
      assert.equal(error.limit, 3);
      assert.equal(error.name, 'ProgramLimitReachedError');
      assert.ok(error instanceof Error);
    },
  },
];
