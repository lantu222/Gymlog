const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const appSource = fs.readFileSync(path.join(__dirname, '..', '..', 'App.tsx'), 'utf8');

/**
 * A copy made by editing a lift in a ready programme (see programmeCopyLink)
 * carries no goal or level of its own — those live on the catalog original.
 * Home's completion card used to look the ACTIVE plan's template id up in the
 * catalog directly (`getWorkoutTemplateById(firstEntry.workoutTemplateId)`),
 * which finds nothing for a copy's id, so `resolveProgramAffinity` got `null`
 * and every reader running an edited ready programme saw a completion card
 * with no "next level" offer, forever (2026-09-26).
 *
 * The fix reads the copy's `sourceTemplateId` — the same link
 * `resolveSourceReadyProgrammeId` and the History screen (App.tsx's `source =
 * copy?.sourceTemplateId ? getWorkoutTemplateById(...)`) already use — and
 * looks THAT id up in the catalog for the affinity comparison instead.
 */
module.exports = [
  {
    name: 'completion card: a custom copy resolves next-level affinity via its source template, not its own id',
    run() {
      const buildCompletionCall = appSource.match(
        /completion: buildCompletion\(\s*activeWorkoutPlan\.id,[\s\S]{0,400}?\),/,
      );
      assert.ok(buildCompletionCall, 'expected a buildCompletion(...) call for the active plan card');
      const snippet = buildCompletionCall[0];

      // A copy (dbTemplate truthy) must be resolved through its OWN
      // sourceTemplateId — not through firstEntry.workoutTemplateId, which is
      // the copy's own id and is never in the ready catalog.
      assert.match(
        snippet,
        /dbTemplate\s*\?\s*\(\s*dbTemplate\.sourceTemplateId\s*\?\s*getWorkoutTemplateById\(dbTemplate\.sourceTemplateId\)/,
        'expected the copy branch to look up dbTemplate.sourceTemplateId in the catalog',
      );
      // A programme with no dbTemplate (a plan running a ready programme
      // directly) keeps using the already-resolved ready template.
      assert.match(
        snippet,
        /:\s*readyPlanTemplate\s*,/,
        'expected the non-copy branch to fall back to readyPlanTemplate',
      );
    },
  },
];
