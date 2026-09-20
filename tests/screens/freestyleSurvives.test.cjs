const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), 'utf8').replace(/\r\n/g, '\n');

/**
 * A freestyle session survives the process, and leaves no half-written trace.
 *
 * Audit round 4 (2026-09-20): the session lived in the screen's React state
 * alone — Android reclaiming the app forty minutes in meant reopening to an
 * empty board — while the guided player persisted every set. The draft is
 * the workout provider's state now (CLAUDE.md: no component-local
 * persistence), persisted with the bundle, read once on mount and mirrored
 * back debounced; leaving on purpose discards it, finishing clears it. And
 * three smaller things from the same audit: the rest cleared when the last
 * lift goes, +15 s on an overrun rest counted from now, and the session
 * save that fails leaves no orphan template behind.
 */
module.exports = [
  {
    name: 'freestyle: the draft flows through the provider, and the screen reads it once and mirrors it back',
    run() {
      const provider = read('src', 'features', 'workout', 'WorkoutProvider.tsx');
      assert.match(provider, /freestyleDraft: state\.freestyleDraft,\n\s+\};\n\s+saveWorkoutBundle\(bundle\)/, 'the draft must be in the persisted bundle');
      assert.match(provider, /\[state\.activeSession, state\.activeCardio, state\.freestyleDraft, state\.hydrated, state\.history\]/, 'the persist effect must run when the draft changes');
      const persistence = read('src', 'features', 'workout', 'workoutPersistence.ts');
      assert.match(persistence, /freestyleDraft: normalizeFreestyleDraftSnapshot\(input\.freestyleDraft\)/, 'a stored draft must go through the normalizer');

      const tab = read('src', 'app', 'renderWorkoutTab.tsx');
      assert.match(tab, /<EmptyWorkoutScreen[\s\S]{0,200}freestyleDraft=\{freestyleDraft\}\s+onSaveDraft=\{saveFreestyleDraft\}\s+onClearDraft=\{clearFreestyleDraft\}/);
      const app = read('App.tsx');
      assert.match(app, /freestyleDraft: workout\.freestyleDraft,\s+saveFreestyleDraft: workout\.saveFreestyleDraft,\s+clearFreestyleDraft: workout\.clearFreestyleDraft,/);

      const screen = read('src', 'screens', 'EmptyWorkoutScreen.tsx');
      assert.match(screen, /useState<FreestyleExerciseState\[\]>\(\(\) => freestyleDraft\?\.exercises \?\? \[\]\)/, 'the lifts must start from the draft');
      assert.match(screen, /freestyleDraft\?\.rest && freestyleDraft\.rest\.endsAtMs > Date\.now\(\) \? freestyleDraft\.rest : null/, 'a rest that ended while the app was gone must not come back');
      // CI review of #162: the clock came back however old the draft was.
      assert.match(screen, /useState<number \| null>\(\(\) =>\s*resolveFreestyleDraftStart\(freestyleDraft, Date\.now\(\)\),/, 'the session clock must go through the staleness rule');
      // CI review of #162: hardware back registered no listener when there
      // was nothing to lose, so it left without discarding what the chevron
      // discarded in the same state.
      assert.match(screen, /BackHandler\.addEventListener\('hardwareBackPress', \(\) => \{[\s\S]{0,700}guard\.onClearDraft\?\.\(\);\s*guard\.onBack\(\);\s*return true;[\s\S]{0,60}\}, \[\]\);/, 'one hardware-back listener, registered always, leaving the way the chevron leaves');
      assert.match(screen, /const timer = setTimeout\(\(\) => \{\s*sink\.onSaveDraft\?\.\(\{ exercises, startedAtMs, rest, savedAtMs: Date\.now\(\) \}\);\s*\}, 400\);/, 'the draft must be written back, debounced');
      assert.match(screen, /await onSave\(draft, summary\);\s*\/\/[^\n]*\n\s*draftSinkRef\.current\.onClearDraft\?\.\(\);/, 'finishing must clear the draft, after the save');
      assert.match(screen, /setConfirmingLeave\(false\);\s*draftSinkRef\.current\.onClearDraft\?\.\(\);\s*leaveGuardRef\.current\.onBack\(\);/, 'a confirmed leave must discard the draft');
    },
  },
  {
    name: 'freestyle: the last lift takes its rest with it, an overrun rest extends from now, a failed save leaves no template',
    run() {
      const screen = read('src', 'screens', 'EmptyWorkoutScreen.tsx');
      assert.match(screen, /const removeExercise = \(exerciseKey: string\) => \{[\s\S]{0,500}if \(exercises\.length <= 1\) \{\s*setRest\(null\);/);
      assert.match(screen, /const endsAtMs = Math\.max\(now \+ 1000, Math\.max\(now, current\.endsAtMs\) \+ deltaSeconds \* 1000\);/);
      const app = read('App.tsx');
      const finish = app.slice(app.indexOf('const finishLoggedWorkoutSave = async'), app.indexOf('workout.recordLoggedWorkout({'));
      assert.match(finish, /\} catch \(error\) \{[\s\S]{0,400}await deleteWorkoutTemplate\(workoutTemplateId\)\.catch\(\(\) => undefined\);\s*throw error;/, 'a session save that fails must take its template with it');
      assert.ok(finish.indexOf("trackEvent('workout_completed')") > finish.indexOf('await saveCompletedWorkoutSession('), 'the event must fire after the save, not before');
    },
  },
];
