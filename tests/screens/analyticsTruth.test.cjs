const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { readAppWiring } = require('../helpers/appWiringSource.cjs');

/**
 * Each usage event sent at the moment it names (analytics audit, 2026-09-21).
 *
 * Wiring, so it is pinned at the source; the decisions themselves are in
 * lib/analyticsMoments and tested there. Comments are stripped first: every
 * fix explains the old placement in a comment, and a guard that can match
 * its own explanation passes itself.
 */

const root = path.join(__dirname, '..', '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const strip = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const app = strip(readAppWiring());

/** One of App's handlers, from its signature to the next member at the same depth. */
function appFunction(name) {
  const start = app.search(new RegExp(`\\n  (?:async )?function ${name}\\(`));
  assert.notEqual(start, -1, `${name} should exist in App`);
  const rest = app.slice(start + 1);
  const end = rest.slice(1).search(/\n  (?:async )?function \w+\(|\n  const \w+ = /);
  return end === -1 ? rest : rest.slice(0, end + 1);
}

const ADOPTED = "trackEvent('plan_adopted')";

/** Every place the event is sent in `body` comes after `write`, the write it reports. */
function sentOnlyAfter(body, write, label) {
  const writeAt = body.indexOf(write);
  assert.notEqual(writeAt, -1, `${label}: ${write} not found`);
  const first = body.indexOf(ADOPTED);
  assert.notEqual(first, -1, `${label}: plan_adopted is never sent`);
  assert.ok(first > writeAt, `${label}: plan_adopted is sent before the write lands`);
}

module.exports = [
  {
    name: 'analytics: a programme is counted as adopted after the write that starts it, at every door',
    run() {
      // The main door: after the cap has answered and the plan is stored, not
      // above the cap check where a refused reader was counted.
      const ready = appFunction('handleAdoptReadyProgram');
      sentOnlyAfter(ready, 'activePlanIds: nextActivePlanIds,', 'ready adoption');
      assert.ok(
        ready.indexOf(ADOPTED) > ready.indexOf("if (decision.kind === 'blocked')"),
        'the cap refusing is not an adoption',
      );

      // Resuming a held programme — its copy or itself — counts once, only
      // when it was not already running.
      const resume = appFunction('resumeHeldProgramme');
      sentOnlyAfter(resume, 'await updatePreferences(', 'resume');
      assert.match(resume, /if \(joinedRunningSet\(preferences\.activePlanIds, resumed\.activePlanIds\)\) \{\s*trackEvent\('plan_adopted'\);/);

      // The Active switch.
      const toggle = appFunction('handleResumeProgram');
      sentOnlyAfter(toggle, 'await updatePreferences(', 'Active switch');
      assert.match(toggle, /if \(joinedRunningSet\(preferences\.activePlanIds, resumed\.activePlanIds\)\) \{\s*trackEvent\('plan_adopted'\);/);

      // The reader's own programme.
      const custom = appFunction('handleAdoptCustomProgram');
      sentOnlyAfter(custom, 'activePlanIds: addActiveProgram(preferences.activePlanIds, plan.id),', 'custom adoption');

      // Onboarding's catalogue pick.
      const pick = appFunction('handleOnboardingPickReadyProgram');
      sentOnlyAfter(pick, 'await completeOnboarding(', 'catalogue pick');
      assert.match(pick, /if \(activation && joinedRunningSet\(preferences\.activePlanIds, activation\.activePlanIds\)\) \{\s*trackEvent\('plan_adopted'\);/);

      // Onboarding's build finish, and Profile's re-run of it: decided inside
      // the save's lock, sent once the save has returned.
      for (const name of ['handleOnboardingCompleteToTraining', 'handleSetupCompleteToTraining']) {
        const finish = appFunction(name);
        sentOnlyAfter(finish, 'if (!saved) {', name);
        assert.match(finish, /joined = joinedRunningSet\(current\.activePlanIds, next\.activePlanIds\);/, `${name} decides inside the lock`);
        assert.match(finish, /if \(joined\) \{\s*trackEvent\('plan_adopted'\);/);
      }
    },
  },
  {
    name: 'analytics: Welcome is its own onboarding step, and the path picker is measured when it shows',
    run() {
      assert.match(
        app,
        /trackEvent\('onboarding_step', \{ path: entryFlowActive \? 'welcome' : onboardingStep \}\);/,
      );
      assert.match(app, /\}, \[hydrated, onboardingActive, entryFlowActive, onboardingStep\]\);/, 'leaving Welcome must re-run the effect');
    },
  },
  {
    name: 'analytics: the paywall is counted once per visit, and never for a reader with Pro on',
    run() {
      const effect = app.slice(app.indexOf('const paywallOpenRef = useRef(false);'), app.indexOf("trackEvent('paywall_viewed')") + 200);
      assert.ok(effect.length > 200, 'the paywall effect must keep its visit ref');
      assert.match(effect, /countsAsPaywallView\(\{\s*paywallWasOpen: paywallOpenRef\.current,\s*onPaywall,\s*proUnlocked: resolveProEntitlement\(preferences\)\.unlocked,\s*\}\)/);
      assert.match(effect, /paywallOpenRef\.current = onPaywall \|\| navigationState\.history\.some\(isPaywall\);/);
      assert.equal(app.split("trackEvent('paywall_viewed')").length - 1, 1, 'one call site');
    },
  },
  {
    name: 'analytics: an open is the cold start or a return after a real absence',
    run() {
      const opens = app.split("trackEvent('app_open')").length - 1;
      assert.equal(opens, 2, 'the cold start and the gated return');
      assert.match(app, /if \(state === 'background'\) \{\s*backgroundedAtMs = Date\.now\(\);/);
      assert.match(app, /if \(countsAsAppOpen\(backgroundedAtMs, Date\.now\(\)\)\) \{\s*trackEvent\('app_open'\);\s*\}/);
      // The old listener: every 'active' an open.
      assert.doesNotMatch(app, /if \(state === 'active'\) \{\s*void refresh\(\);\s*trackEvent\('app_open'\);/);
    },
  },
  {
    name: 'analytics: a guided workout is counted complete once per session, after a save that proved itself',
    run() {
      const finish = appFunction('handleConfirmFinishWorkout');
      const sent = finish.indexOf("trackEvent('workout_completed')");
      assert.notEqual(sent, -1);
      assert.ok(sent > finish.indexOf("throw new Error('Workout save did not produce a valid summary')"), 'after the summary is known to be real');
      assert.match(
        finish,
        /if \(!completionCountedRef\.current\.has\(adaptedSession\.sessionId\)\) \{\s*completionCountedRef\.current\.add\(adaptedSession\.sessionId\);\s*trackEvent\('workout_completed'\);/,
      );
    },
  },
  {
    name: 'analytics: the free workout sends its start, once, and a restored board does not start again',
    run() {
      const screen = strip(read('src', 'screens', 'EmptyWorkoutScreen.tsx'));
      assert.match(screen, /const startCountedRef = useRef\(freestyleDraft != null\);/);
      const add = screen.slice(screen.indexOf('const addExercises = '), screen.indexOf('const removeExercise = '));
      assert.match(add, /if \(!startCountedRef\.current\) \{\s*startCountedRef\.current = true;\s*trackEvent\('workout_started'\);/);
      assert.equal(screen.split("trackEvent('workout_started')").length - 1, 1);
    },
  },
  {
    name: 'analytics: a cardio session sends both ends of a workout',
    run() {
      const provider = strip(read('src', 'features', 'workout', 'WorkoutProvider.tsx'));
      assert.match(provider, /startCardio\(activityType\) \{\s*trackEvent\('workout_started'\);\s*dispatch\(\{ type: 'cardio\/start'/);
      assert.match(app, /await saveCardioSession\(input\);\s*trackEvent\('workout_completed'\);/);
    },
  },
];
