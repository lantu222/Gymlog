const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), 'utf8').replace(/\r\n/g, '\n');

/**
 * The programme onboarding hands over and the catalog page it came from are
 * one programme.
 *
 * Audit round 4 (2026-09-20). Onboarding fits the recommended programme to
 * the reader's answers and saves that composed week as a programme of their
 * own — and recorded nothing about where it came from, though the edit path
 * has recorded exactly that since 2026-08-26. So the catalog page went on
 * showing the composed week while its buttons worked on the untouched
 * original: the day editor could not find the copy and built a second one,
 * "Take this programme" adopted the catalog version beside the copy being
 * trained, and "Sinulle" kept recommending the programme the reader had just
 * been given. Source-level, because all four are wiring.
 */
module.exports = [
  {
    name: 'onboarding: the copy records the catalog programme it was composed from',
    run() {
      const handoff = read('src', 'app', 'onboardingHandoff.ts');
      const draft = handoff.slice(handoff.indexOf('const draft: WorkoutTemplateDraft = {'));
      assert.match(
        draft.slice(0, draft.indexOf('const runtimeTemplate')),
        /sourceTemplateId: recommendedProgramId,/,
        'the saved programme must say which catalog programme it is a version of',
      );
    },
  },
  {
    name: 'onboarding: the catalog page shows the catalog once the copy exists, and the lookup finds copies made before the link',
    run() {
      const tab = read('src', 'app', 'renderWorkoutTab.tsx');
      const resolver = tab.slice(
        tab.indexOf('const resolveComposedWeekForRoute = (workoutTemplateId: string) => {'),
      );
      assert.match(
        resolver.slice(0, resolver.indexOf('const composed =')),
        /if \(findReadyProgrammeCopyId\(workoutTemplateId, database\.workoutTemplates\)\) \{\s*return null;/,
        "a page whose programme the reader has copied shows the catalog's own week",
      );

      // And the page acts on the id it is really about. Adoption resumes
      // the copy, so a page that asked every question of the catalog id
      // kept offering to adopt a programme it had just started, said so on
      // every tap, and its Active switch turned nothing off (CI review).
      for (const line of [
        'const runningTemplateId = ownCopyTemplateId ?? route.workoutTemplateId;',
        'const programIsMine = activeProgramTemplateIds.includes(runningTemplateId);',
        'const programLeads = homeActivePlanCard?.programId === runningTemplateId;',
        'next ? onResumeProgram(runningTemplateId) : onStopProgram(runningTemplateId)',
      ]) {
        assert.ok(tab.includes(line), `the page must act on the id it is about: ${line}`);
      }

      const provider = read('src', 'state', 'AppProvider.tsx');
      const lookup = provider.slice(provider.indexOf('function findWorkoutTemplateIdBySource('));
      assert.match(
        lookup.slice(0, lookup.indexOf('\n  }')),
        /findReadyProgrammeCopyId\(sourceTemplateId, current\.workoutTemplates, running\)/,
        'the editor must find a copy made before the link was written',
      );
    },
  },
  {
    name: 'onboarding: adopting resumes the copy, and the row stops recommending a programme already being run',
    run() {
      const app = read('App.tsx');
      const adopt = app.slice(
        app.indexOf('async function handleAdoptReadyProgram('),
        app.indexOf('const planId = buildReadyProgramPlanId(workoutTemplateId);'),
      );
      assert.match(
        adopt,
        /const copyTemplateId = findReadyProgrammeCopyId\(\s*workoutTemplateId,\s*database\.workoutTemplates,/,
        'adoption must look for the reader’s own version first',
      );
      assert.match(
        adopt,
        /const resumedCopy = await resumeHeldProgramme\(copyTemplateId, options\);\s*if \(resumedCopy !== null\) \{[\s\S]{0,200}return resumedCopy;/,
        'a held copy comes back through its own plan, block and all',
      );

      assert.match(
        adopt,
        /findReadyProgrammeCopyId\(\s*workoutTemplateId,\s*database\.workoutTemplates,[\s\S]{0,400}\.\.\.activeProgramTemplateIds,/,
        'with two copies of one programme, the one being trained answers',
      );
      // The funnel row counts adoptions, and this fired at the top of the
      // handler — once per tap, including the taps that adopt nothing.
      assert.ok(
        !/return false;\s*\}\s*trackEvent\('plan_adopted'\);/.test(adopt),
        'the event must not fire before the early returns',
      );
      assert.match(
        app,
        /trackEvent\('plan_adopted'\);\s*\/\/ Held but switched off/,
        'the event belongs where a programme starts running',
      );

      assert.match(
        app,
        /adoptedIds: expandRunningIdsWithSources\(\s*activeProgramTemplateIds,\s*database\.workoutTemplates,/,
        'a programme run under a copy of it counts as run',
      );
      // The row reads the stored templates, so it has to depend on them: a
      // fork made while browsing changes no other dependency (review).
      assert.match(
        app,
        /\[\s*activeProgramTemplateIds,[\s\S]{0,400}database\.workoutTemplates,[\s\S]{0,300}workout\.templates,\s*\],/,
        'the recommendation memo must depend on the templates it reads',
      );
    },
  },
];
