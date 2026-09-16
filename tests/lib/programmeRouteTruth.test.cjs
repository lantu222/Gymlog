const assert = require('node:assert/strict');

const { readAppWiring } = require('../helpers/appWiringSource.cjs');

/**
 * Programme audit, 2026-09-16: a programme row opens the programme it names,
 * and the page under it counts the programme's own weeks.
 *
 * Source-level because all three live in React wiring. The rules themselves
 * are tested where they are pure — composedWeekMatchesPlan in programDetails,
 * getReadyProgramBlockWeeks in readyProgramDuration.
 */

const wiring = readAppWiring();
const strip = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const code = strip(wiring);

module.exports = [
  {
    name: 'route truth: Home opens an adopted programme as what it is, not always as a ready one',
    run() {
      // The list holds whatever the reader adopted, their own programmes
      // included. Opening every row as 'ready' sent the route guard looking
      // for a catalog template that was never there, and the reader landed on
      // the programme list instead of the programme they tapped.
      assert.match(
        code,
        /onOpenOtherProgram=\{\(planId\) => \{[\s\S]{0,320}handleOpenProgramDetail\(templateId\);/,
      );
      // And no door forces the type any more: the one that did is gone.
      assert.doesNotMatch(code, /handleOpenReadyProgramDetail/);
      assert.doesNotMatch(code, /screen: 'program', programType: 'ready', workoutTemplateId \}\);/);
      // Stored template first, the same order Home resolves its own hero in:
      // an id both stores know is custom on both screens or on neither.
      assert.match(
        code,
        /function resolveProgramTypeForTemplate\(workoutTemplateId: string\): 'ready' \| 'custom' \{\s*return workoutTemplates\.some\(\(template\) => template\.id === workoutTemplateId\) \? 'custom' : 'ready';/,
      );
      assert.match(
        code,
        /function handleOpenProgramDetail\(workoutTemplateId: string\) \{[\s\S]{0,240}programType: resolveProgramTypeForTemplate\(workoutTemplateId\),/,
      );
    },
  },
  {
    name: 'route truth: Home counts an adopted ready programme over the weeks the programme prescribes',
    run() {
      // Twelve-week programmes were counted as eight — the generic default —
      // so the hero said "week 1/8" beside a programme page saying 12, and
      // the session total under it was a third short.
      assert.match(
        code,
        /const readyBlockWeeks = readyPlanTemplate \? getReadyProgramBlockWeeks\(readyPlanTemplate\) : undefined;/,
      );
      assert.match(code, /totalWeeks: demoBlockWeeks \?\? onboardingBlockWeeks \?\? readyBlockWeeks,/);
    },
  },
  {
    name: 'route truth: the composed week stands in on both programme pages or on neither',
    run() {
      // The programme page and its day page read the same resolver, so a day
      // row from Home cannot find its day on one page and an empty screen on
      // the other.
      const uses = code.match(/resolveComposedWeekForRoute\(route\.workoutTemplateId\)/g) ?? [];
      assert.equal(uses.length, 2, 'both the programme page and the day page ask the resolver');
      assert.match(
        code,
        /const resolveComposedWeekForRoute = \(workoutTemplateId: string\) => \{[\s\S]{0,900}composedWeekMatchesPlan\(composed\.sessions\.map\(\(session\) => session\.id\), planSessionIds\)/,
      );
      // And nothing composes a week for a page without passing that gate.
      assert.doesNotMatch(
        code,
        /preferences\.recommendedProgramId === route\.workoutTemplateId && setupSelection\s*\?\s*composeProgramWeekForSelection/,
      );
    },
  },
  {
    name: 'route truth: the summary and the finish view read different sides of the save',
    run() {
      // The finish view renders before the write and asks for the week the
      // reader is in; the summary renders after it, where that week has
      // already rolled over.
      assert.match(
        code,
        /completionWeekLabel: homeActivePlanCard[\s\S]{0,240}weekOfLastLoggedSession\(\{/,
      );
      assert.match(code, /weekLabel: weekProgressBase\.completionWeekLabel,\s*done: weekProgressBase\.savedThisWeek,/);
      assert.match(code, /weekLabel: weekProgressBase\.weekLabel,\s*done: weekProgressBase\.savedThisWeek \+ 1,/);
    },
  },
  {
    name: 'route truth: an edit the copy refused does not move the reader as if it had gone through',
    run() {
      // Removing the copy's last lift in a day, or a row already at the edge,
      // is refused inside the custom path — and the reader used to be carried
      // to the copy's day anyway, which reads as "done".
      assert.match(
        code,
        /const edited = await runProgramExerciseEdit\('custom', existingCopyId, target\.sessionId, target\.exerciseId, edit\);\s*if \(edited\) \{\s*navigate\(\{/,
      );
      // And the outcome is a real answer, not an assumption.
      assert.match(code, /async function runProgramExerciseEdit\([\s\S]{0,260}\): Promise<boolean> \{/);
    },
  },
];
