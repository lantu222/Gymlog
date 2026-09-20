const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), 'utf8').replace(/\r\n/g, '\n');
const exists = (...parts) => fs.existsSync(path.join(ROOT, ...parts));

/**
 * Two screens nothing could open — audit round 3, 2026-09-20.
 *
 * `AICoachScreen` was reachable only from itself: the one place that built a
 * `screen: 'ai'` route was `handleOpenAICoach`, and the only thing holding
 * `handleOpenAICoach` was that screen's own `onSubmitPrompt`. A door whose
 * only key is on the inside.
 *
 * `WorkoutEditorScreen` hung off it: the one place that built a
 * `screen: 'editor'` route was the `open_custom_editor` branch of
 * `handleSelectAiCoachAction`, which only that screen could reach. 1 286 lines
 * of editor behind a door behind the first door.
 *
 * This guard is about the shape, not the files: what made them dead was that
 * a route existed with no way in. Re-adding either screen is fine — wiring one
 * to nothing is what must not come back.
 */
module.exports = [
  {
    name: 'dead screens: the two unreachable screens are gone, with the routes that only they built',
    run() {
      assert.ok(!exists('src', 'screens', 'AICoachScreen.tsx'), 'AICoachScreen is back');
      assert.ok(!exists('src', 'screens', 'WorkoutEditorScreen.tsx'), 'WorkoutEditorScreen is back');
      // Its only importer went with it.
      assert.ok(!exists('src', 'components', 'FitnessPhotoSurface.tsx'), 'FitnessPhotoSurface is back');
      // The libraries that existed only to serve them.
      assert.ok(!exists('src', 'lib', 'workoutEditorTable.ts'), 'workoutEditorTable is back');
      assert.ok(!exists('src', 'lib', 'aiCoachActions.ts'), 'aiCoachActions is back');

      // Superseded by WorkoutCompletionScreen in 83b718b, which deleted the
      // only `replaceRoute` that opened it. Its state was unreachable twice
      // over: `setWorkoutCelebration` was called in two places and passed
      // `null` in both, and the render branch needed it truthy.
      assert.ok(!exists('src', 'screens', 'WorkoutCelebrationScreen.tsx'), 'WorkoutCelebrationScreen is back');

      const routes = read('src', 'navigation', 'routes.ts');
      assert.doesNotMatch(routes, /screen: 'ai';/, "the 'ai' route is back");
      assert.doesNotMatch(routes, /screen: 'editor';/, "the 'editor' route is back");
      assert.doesNotMatch(routes, /screen: 'celebration';/, "the 'celebration' route is back");
      // The state it was the only reader of, and the setter threaded through
      // the profile tab to clear it.
      assert.doesNotMatch(read('src', 'app', 'workoutCompletionState.ts'), /WorkoutCelebrationState/);
      assert.doesNotMatch(read('src', 'app', 'renderProfileTab.tsx'), /setWorkoutCelebration/);
      assert.doesNotMatch(read('App.tsx'), /workoutCelebration/);
      // And the memo the Seasons parking left behind: computed every render,
      // passed to nothing, one of the "App memos behind them" that were meant
      // to go with the section on 2026-08-31.
      assert.doesNotMatch(read('App.tsx'), /programsSeasonTileCounts/);
    },
  },
  {
    name: 'dead screens: no route is declared that nothing navigates to',
    run() {
      /*
       * The rule the deletion came from, kept as a rule.
       *
       * Every `screen:` in the route union must have somewhere that builds it,
       * or it is a door with no key — which is exactly how 2 000 lines sat in
       * the bundle being compiled, translated and reviewed for weeks.
       *
       * Read from the union rather than a list, so a route added tomorrow is
       * covered without anyone remembering to add it here.
       */
      const routes = read('src', 'navigation', 'routes.ts');
      // A declaration ends in a semicolon, a construction does not — which is
      // also what lets routes.ts itself count as a builder for the route
      // constants it exports (WORKOUT_PLAN_ROUTE and friends).
      const declared = new Set([...routes.matchAll(/^\s+screen: '([^']+)';/gm)].map((m) => m[1]));
      assert.ok(declared.size > 20, `only ${declared.size} routes parsed — the union's shape changed`);

      /*
       * One route is declared, rendered, and built by nothing — and it is not
       * a defect.
       *
       * `season` is PARKED ON PURPOSE (decision 2026-08-31, written down in
       * ProgramsHomeScreen where the section used to be): the screen and every
       * library under it were left working so that putting the section back is
       * one commit. An entry point that is absent by decision is not a bug,
       * and deleting the screen would throw away what the decision kept.
       *
       * This guard's first run flagged `celebration` beside it, and that one
       * WAS dead: 83b718b rebuilt the post-finish flow onto `screen: 'summary'`
       * and WorkoutCompletionScreen, deleting the `replaceRoute` that opened
       * the old one. It is removed in this commit rather than listed here —
       * the difference between the two is a decision to come back, and only
       * `season` has one.
       *
       * Removing this name must mean the route got its entry point back, or
       * the screen went.
       */
      const UNWIRED = new Set(['season']);

      // Every source file except the union's own, so a route built in a tab
      // module nobody thought to list here still counts. Narrowing this to
      // three files named fourteen live routes as dead on the first run.
      const walk = (dir) => {
        const out = [];
        for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
          const next = `${dir}/${entry.name}`;
          if (entry.isDirectory()) out.push(...walk(next));
          else if (/\.tsx?$/.test(entry.name) && next !== 'src/navigation/routes.ts') out.push(next);
        }
        return out;
      };
      const everything = ['App.tsx', ...walk('src')]
        .map((file) => read(...file.split('/')))
        .join('\n');

      // A route is built somewhere if its name appears as a `screen: 'x'`
      // value outside the type union itself.
      const built = new Set([...everything.matchAll(/screen: '([^']+)'(?!;)/g)].map((m) => m[1]));
      for (const m of routes.matchAll(/screen: '([^']+)'(?!;)/g)) built.add(m[1]);

      const unreachable = [...declared].filter((name) => !built.has(name) && !UNWIRED.has(name));
      assert.deepEqual(
        unreachable,
        [],
        `these routes are declared but nothing builds them: ${unreachable.join(', ')}`,
      );
      // And the two held apart are still exactly that: if one gets wired up,
      // this fails so the list stops claiming something untrue.
      const stillUnwired = [...UNWIRED].filter((name) => !built.has(name));
      assert.deepEqual([...UNWIRED], stillUnwired, 'a route in UNWIRED has an entry point now — take it off the list');
    },
  },
  {
    name: 'dead screens: the coach stops computing an action list nobody draws',
    run() {
      // `buildAiCoachActions` ran on every offline answer and its result was
      // read in exactly one place — the screen that no longer exists.
      const preview = read('src', 'lib', 'aiCoachPreview.ts');
      assert.doesNotMatch(preview, /buildAiCoachActions/);
      assert.doesNotMatch(preview, /actions:/);

      const types = read('src', 'types', 'aiCoach.ts');
      assert.doesNotMatch(types, /AICoachActionKind/);
      assert.doesNotMatch(types, /actions\?: AICoachAction/);
    },
  },
  {
    name: 'dead screens: the freestyle save carries the type of the thing that builds it',
    run() {
      /*
       * `finishLoggedWorkoutSave` took `WorkoutEditorFinishSummary`, a type
       * the deleted screen exported — while the live caller passes a
       * `FreestyleFinishSummary`, whose declaration carried the comment
       * "Structurally identical to WorkoutEditorFinishSummary". Two names for
       * one shape, one of them on a screen nobody could open.
       */
      const app = read('App.tsx');
      assert.match(app, /finishLoggedWorkoutSave = async \(draft: WorkoutTemplateDraft, summary: FreestyleFinishSummary\)/);
      assert.doesNotMatch(app, /WorkoutEditorFinishSummary/);

      const lib = read('src', 'lib', 'emptyWorkoutSession.ts');
      assert.doesNotMatch(lib, /Structurally identical to WorkoutEditorFinishSummary/);
    },
  },
];
