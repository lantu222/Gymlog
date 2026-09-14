const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { programSlotsLineKey, resolveProgramSlots } = require('../../.test-dist/lib/programSlots.js');
const {
  ONBOARDING_PLAN_PREFIX,
  findReplaceableOnboardingTemplateId,
} = require('../../.test-dist/lib/activeProgramSet.js');
const { t } = require('../../.test-dist/lib/i18n.js');

/**
 * The free programme limits, said before and at the wall (user 2026-09-14).
 *
 * A counter above "your programmes" once one place is left, one sheet for both
 * limits with the count in its title, and answering setup again writes over
 * the programme the last run made instead of filling the limit with copies.
 */

const root = path.join(__dirname, '..', '..');
const strip = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const read = (...parts) => strip(fs.readFileSync(path.join(root, ...parts), 'utf8'));

function body(source, signature) {
  const start = source.indexOf(signature);
  assert.ok(start >= 0, `${signature} is gone`);
  const ends = ['\n  function ', '\n  async function ']
    .map((marker) => source.indexOf(marker, start + signature.length))
    .filter((index) => index > 0);
  return source.slice(start, ends.length ? Math.min(...ends) : undefined);
}

const template = (id, createdAt, updatedAt = createdAt) => ({ id, createdAt, updatedAt });

module.exports = [
  {
    name: 'programme limit: the counter shows with one place left and at the wall, never on Pro',
    run() {
      const free = (used) => programSlotsLineKey(resolveProgramSlots(used, false));
      assert.equal(free(0), null);
      assert.equal(free(1), null, 'a count nobody is near is a sign about nothing');
      assert.equal(free(2), 'lastPlace');
      assert.equal(free(3), 'atCap');
      assert.equal(free(4), 'atCap', 'over the limit from before is still the wall');
      assert.equal(programSlotsLineKey(resolveProgramSlots(9, true)), null);

      assert.equal(t('fi', 'programLimit.lastPlace', { used: 2, limit: 3 }), '2/3 omaa ohjelmaa · yksi paikka jäljellä');
      assert.equal(t('fi', 'programLimit.atCap', { used: 3, limit: 3 }), '3/3 omaa ohjelmaa · poista yksi tehdäksesi uuden');
      assert.equal(t('en', 'programLimit.lastPlace', { used: 2, limit: 3 }), '2/3 programmes of your own · one place left');
    },
  },
  {
    name: 'programme limit: the sheet names the wall with its count and offers the free way past it',
    run() {
      assert.equal(t('fi', 'programLimit.title', { used: 3, limit: 3 }), 'Omat ohjelmasi ovat täynnä · 3/3');
      assert.match(t('fi', 'programLimit.body', { limit: 3 }), /^Ilmaisella voit pitää 3 omaa ohjelmaa\. Poista yksi tehdäksesi uuden/);
      assert.equal(t('fi', 'programLimit.cta'), 'Avaa lisää ohjelmia');
      assert.equal(t('fi', 'programLimit.later'), 'Selvä');
      assert.equal(t('fi', 'programLimit.running.title', { used: 2, limit: 2 }), 'Ohjelmapaikkasi ovat täynnä · 2/2');
      assert.match(t('fi', 'programLimit.running.body', { limit: 2 }), /Lopeta yksi aloittaaksesi uuden/);
      assert.equal(t('en', 'programLimit.cta'), 'Unlock more programmes');

      const sheet = read('src', 'components', 'ProgramLimitSheet.tsx');
      assert.match(sheet, /kind === 'running' \? 'programLimit\.running\.title' : 'programLimit\.title'/);
      assert.doesNotMatch(sheet, /programLimit\.count/, 'the count is in the title now, not said twice');
    },
  },
  {
    name: 'programme limit: a full set of running programmes shows the sheet, then Pro only if asked',
    run() {
      const app = read('App.tsx');
      assert.doesNotMatch(
        app,
        /if \(decision\.canUpgrade\) \{\s*navigate\(\{ tab: 'profile', screen: 'premium', reason: 'program_cap' \}\)/,
        'a free reader at the running limit is still sent straight to the paywall',
      );
      const blocks = app.match(/if \(decision\.canUpgrade\) \{\s*setRunningCapSheet\(\{ visible: true, used: decision\.used, cap: decision\.cap \}\)/g) ?? [];
      assert.equal(blocks.length, 2, 'both adoption paths (ready and custom) show the sheet');
      assert.match(app, /kind="running"[\s\S]{0,400}navigate\(\{ tab: 'profile', screen: 'premium', reason: 'program_cap' \}\)/);

      // The programme page's "take it on" goes Home only once it is running.
      // It navigated first, so at the limit the sheet opened over a Home still
      // leading with the old programme (seen on the emulator, 2026-09-14).
      const workoutTab = read('src', 'app', 'renderWorkoutTab.tsx');
      for (const adopt of ['handleAdoptReadyProgram', 'handleAdoptCustomProgram']) {
        assert.match(
          workoutTab,
          new RegExp(`void ${adopt}\\(route\\.workoutTemplateId, \\{ lead: true \\}\\)\\.then\\(\\(adopted\\) => \\{\\s*if \\(adopted\\) \\{\\s*navigate\\(ROOT_ROUTES\\.home\\);`),
          `${adopt} navigates Home whether or not the programme was taken on`,
        );
      }
      assert.match(body(app, 'async function handleAdoptCustomProgram'), /return false;\s*\}\s*showToast\(t\(preferences\.appLanguage, 'programs\.cap\.full'/);

      const programs = read('src', 'screens', 'ProgramsHomeScreen.tsx');
      assert.match(programs, /\{ownProgramsLine \? <Text style=\{styles\.ownProgramsLine\}>\{ownProgramsLine\}<\/Text> : null\}/);
      const tab = read('src', 'app', 'renderWorkoutTab.tsx');
      assert.match(tab, /ownProgramsLine=\{\(\(\) => \{\s*const key = programSlotsLineKey\(programSlots\)/);
    },
  },
  {
    // A CSV import at the limit awaited the provider's refusal and sat there.
    name: 'programme limit: every import path shows the sheet instead of failing silently',
    run() {
      const sources = [read('App.tsx'), read('src', 'app', 'renderWorkoutTab.tsx'), read('src', 'app', 'renderProfileTab.tsx')];
      let imports = 0;
      for (const source of sources) {
        for (const match of source.matchAll(/onImportProgram=\{async \(draft\) => \{([\s\S]*?)\n\s{8}\}\}/g)) {
          imports += 1;
          assert.match(match[1], /createUnlessAtLimit\(\s*\(\) => upsertWorkoutTemplate\(draft\),\s*\(\) => setProgramLimitVisible\(true\),?\s*\)/);
        }
      }
      assert.equal(imports, 3, `expected three import paths, found ${imports}`);
    },
  },
  {
    name: 'programme limit: answering setup again writes over the untouched programme the last run made',
    run() {
      const lead = `${ONBOARDING_PLAN_PREFIX}tpl_old`;
      const at = '2026-09-01T10:00:00.000Z';

      const untrained = [];
      assert.equal(
        findReplaceableOnboardingTemplateId({ activePlanId: lead, activePlanIds: [lead], templates: [template('tpl_old', at)], sessions: untrained }),
        'tpl_old',
      );
      // Trained, never edited: writing over it would regenerate its exercise
      // rows under new ids and cut every "last time" and record lookup off
      // from the sessions logged against the old ones. It stays.
      assert.equal(
        findReplaceableOnboardingTemplateId({
          activePlanId: lead,
          activePlanIds: [lead],
          templates: [template('tpl_old', at)],
          sessions: [{ workoutTemplateId: 'tpl_old' }],
        }),
        null,
      );
      // A session logged against some other programme does not protect this one.
      assert.equal(
        findReplaceableOnboardingTemplateId({
          activePlanId: lead,
          activePlanIds: [lead],
          templates: [template('tpl_old', at)],
          sessions: [{ workoutTemplateId: 'tpl_other' }],
        }),
        'tpl_old',
      );
      // Edited since: the reader's work, kept, and the new run is a new programme.
      assert.equal(
        findReplaceableOnboardingTemplateId({
          activePlanId: lead,
          activePlanIds: [lead],
          templates: [template('tpl_old', at, '2026-09-05T08:00:00.000Z')],
          sessions: untrained,
        }),
        null,
      );
      // A programme adopted by hand is never written over — even one whose id,
      // cut where an onboarding prefix would end, names an untouched template.
      const handAdopted = 'custom_plan_ab12tpl_mine';
      assert.equal(handAdopted.slice(ONBOARDING_PLAN_PREFIX.length), 'tpl_mine');
      assert.equal(
        findReplaceableOnboardingTemplateId({
          activePlanId: handAdopted,
          activePlanIds: [handAdopted],
          templates: [template('tpl_mine', at)],
          sessions: untrained,
        }),
        null,
      );
      // Not running: the last run's programme was already set aside by the reader.
      assert.equal(
        findReplaceableOnboardingTemplateId({ activePlanId: null, activePlanIds: [], templates: [template('tpl_old', at)], sessions: untrained }),
        null,
      );
      // Its template is gone.
      assert.equal(findReplaceableOnboardingTemplateId({ activePlanId: lead, activePlanIds: [lead], templates: [], sessions: untrained }), null);
      // The lead is asked first; an edited lead lets an untouched one behind it go.
      const second = `${ONBOARDING_PLAN_PREFIX}tpl_second`;
      assert.equal(
        findReplaceableOnboardingTemplateId({
          activePlanId: lead,
          activePlanIds: [second, lead],
          templates: [template('tpl_old', at, '2026-09-05T08:00:00.000Z'), template('tpl_second', at)],
          sessions: untrained,
        }),
        'tpl_second',
      );
    },
  },
  {
    name: 'programme limit: both finishes pass the replaceable id, and a replaced programme stays replaceable',
    run() {
      const app = read('App.tsx');
      for (const signature of ['async function handleOnboardingCompleteToTraining', 'async function handleSetupCompleteToTraining']) {
        assert.match(body(app, signature), /templateDraft: withReplaceableOnboardingId\(savedPlan\.draft\)/);
      }
      assert.match(
        body(app, 'function withReplaceableOnboardingId'),
        /findReplaceableOnboardingTemplateId\(\{[\s\S]*templates: database\.workoutTemplates,\s*sessions: database\.workoutSessions,/,
      );

      // An in-place write keeps createdAt and moves updatedAt, which would read
      // as "edited" and stop the next run from replacing it.
      const provider = read('src', 'state', 'AppProvider.tsx');
      assert.match(
        body(provider, 'function saveOnboardingResult'),
        /template\.id === built\.workoutTemplateId \? \{ \.\.\.template, createdAt: template\.updatedAt \} : template/,
      );
    },
  },
];
