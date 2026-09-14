const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

/**
 * The two places the running set used to drift from what was running.
 *
 * Source-level because both live in React: App.tsx's onboarding finishes and
 * AppProvider's template delete. The rules themselves are tested in
 * activeProgramSet and runningProgrammes; this pins that they are called.
 */

const root = path.join(__dirname, '..', '..');
const strip = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const app = strip(fs.readFileSync(path.join(root, 'App.tsx'), 'utf8'));
const provider = strip(fs.readFileSync(path.join(root, 'src', 'state', 'AppProvider.tsx'), 'utf8'));
const database = strip(fs.readFileSync(path.join(root, 'src', 'storage', 'database.ts'), 'utf8'));

/** From `signature` to the next function declared at the same indent. */
function body(source, signature) {
  const start = source.indexOf(signature);
  assert.ok(start >= 0, `${signature} is gone`);
  const ends = ['\n  function ', '\n  async function ']
    .map((marker) => source.indexOf(marker, start + signature.length))
    .filter((index) => index > 0);
  return source.slice(start, ends.length ? Math.min(...ends) : undefined);
}

module.exports = [
  {
    name: 'program cap wiring: both guided onboarding finishes put their plan in the running set',
    run() {
      for (const signature of ['async function handleOnboardingCompleteToTraining', 'async function handleSetupCompleteToTraining']) {
        assert.match(
          body(app, signature),
          /activate: \(planId, current\) => activateOnboardingPlan\(current, planId\)/,
          `${signature} leads with its plan without counting it against the cap`,
        );
      }
      assert.doesNotMatch(app, /activate: \(planId\) => \(\{ activePlanId: planId \}\)/);
    },
  },
  {
    name: 'program cap wiring: the catalogue onboarding finish follows the same rule',
    run() {
      const pick = body(app, 'async function handleOnboardingPickReadyProgram');
      assert.match(pick, /activateOnboardingPlan\(preferences, adoptedPlanId\)/);
      assert.doesNotMatch(pick, /activePlanIds: adoptedPlanId \? \[adoptedPlanId\] : \[\]/, 're-running onboarding stops a season');
    },
  },
  {
    name: 'program cap wiring: the loader repairs the lead after the preferences overlay, not before',
    run() {
      const load = database.slice(database.indexOf('export async function loadDatabase'));
      const overlay = load.indexOf('await loadStoredPreferences(database.preferences)');
      const repair = load.indexOf('includeLeadInRunningSet(preferences, database.workoutPlans)');
      assert.ok(overlay > 0, 'the preferences overlay moved');
      assert.ok(repair > overlay, 'the repair runs on a copy the overlay then replaces');
    },
  },
  {
    name: 'program cap wiring: onboarding activation reads the preferences inside the lock',
    run() {
      assert.match(body(provider, 'function saveOnboardingResult'), /input\.activate\(plan\.id, withPlan\.preferences\)/);
    },
  },
  {
    name: 'program cap wiring: deleting a programme stops it before its plans are emptied',
    run() {
      const remove = body(provider, 'function deleteWorkoutTemplate');
      const stop = remove.indexOf('stopProgramme(');
      const removal = remove.indexOf('workoutTemplateRepository.remove(');
      assert.ok(stop > 0, 'a deleted programme keeps its slot in the running set');
      assert.ok(removal > stop, 'the plans are emptied before stopProgramme can find them');
      assert.match(
        remove,
        /\{ \.\.\.nextDatabase\.preferences, \.\.\.stopped \}/,
        'stopProgramme is asked, and its answer is never written',
      );
    },
  },
];
