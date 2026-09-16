const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { workoutReducer } = require('../../../.test-dist/features/workout/workoutState');

/**
 * Live-session audit, 2026-09-15: what the guided player does between Start
 * and the summary has to keep what the reader did.
 */

const EMPTY = {
  activeSession: null,
  completionSummary: null,
  history: { sessions: [], slotHistory: {}, lastSelectedTemplateId: null },
  nowMs: 0,
};
const AT = Date.parse('2026-09-15T17:00:00.000Z');
const root = path.join(__dirname, '..', '..', '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8').replace(/\r\n/g, '\n');

function exercise(overrides) {
  return {
    id: 'e1',
    exerciseName: 'Bench Press',
    slotId: 'press',
    role: 'primary',
    progressionPriority: 'high',
    trackingMode: 'load_and_reps',
    sets: 3,
    repsMin: 6,
    repsMax: 8,
    restSecondsMin: 90,
    restSecondsMax: 120,
    substitutionGroup: 'press',
    ...overrides,
  };
}

function startWith(exercises) {
  return workoutReducer(EMPTY, {
    type: 'session/startFromRuntimeTemplate',
    payload: {
      template: { id: 'tpl', name: 'Day', defaultScheduleMode: 'weekly', sessions: [{ id: 'day', name: 'Day', orderIndex: 0, exercises }] },
      sessionOrderIndex: 0,
      unitPreference: 'kg',
    },
  });
}

function log(state, slotId, setIndex, loadText, repsText) {
  const drafted = workoutReducer(state, { type: 'set/updateDraft', payload: { slotId, setIndex, patch: { loadText, repsText } } });
  return workoutReducer(drafted, { type: 'set/complete', payload: { slotId, setIndex, nowMs: AT, unitPreference: 'kg' } });
}

const setOf = (state, index = 0) => state.activeSession.exercises[0].sets[index];

module.exports = [
  {
    name: 'guided: an interval work bout is logged with no load, as the timer logs it',
    run() {
      let state = startWith([
        exercise({ exerciseName: 'Treadmill HIIT (30s on / 30s off)', trackingMode: 'reps_first', sets: 8, repsMin: 30, repsMax: 30, restSecondsMin: 30, restSecondsMax: 30, substitutionGroup: 'cardio_intervals' }),
      ]);
      const slotId = state.activeSession.exercises[0].slotId;
      // Exactly what the player's expiry does: reps = the work seconds, load empty.
      state = log(state, slotId, 0, '', '30');
      assert.equal(setOf(state).status, 'completed');
      assert.equal(setOf(state).actualReps, 30);
      assert.equal(setOf(state).actualLoadKg, 0);
      // Its number is seconds, so a long bout is not held to the reps dial's 300.
      let long = startWith([
        exercise({ exerciseName: 'Bike intervals (400s hard / 60s easy)', trackingMode: 'reps_first', sets: 2, repsMin: 400, repsMax: 400, substitutionGroup: 'cardio_intervals' }),
      ]);
      long = log(long, long.activeSession.exercises[0].slotId, 0, '', '400');
      assert.equal(setOf(long).status, 'completed');

      // A loaded lift still needs its load.
      let bench = startWith([exercise({})]);
      bench = log(bench, bench.activeSession.exercises[0].slotId, 0, '', '8');
      assert.equal(setOf(bench).status, 'pending');
    },
  },
  {
    name: 'guided: a weight or rep count past the dials is refused, logged or corrected',
    run() {
      let state = startWith([exercise({})]);
      const slotId = state.activeSession.exercises[0].slotId;
      // "825" for 82,5 at logging.
      const typo = log(state, slotId, 0, '825', '6');
      assert.equal(setOf(typo).status, 'pending');
      const tooManyReps = log(state, slotId, 0, '80', '400');
      assert.equal(setOf(tooManyReps).status, 'pending');

      state = log(state, slotId, 0, '82.5', '6');
      assert.equal(setOf(state).status, 'completed');
      // And at correction.
      const edited = workoutReducer(state, { type: 'set/editLogged', payload: { slotId, setIndex: 0, reps: 6, loadKg: 825 } });
      assert.equal(setOf(edited).actualLoadKg, 82.5);
      const repsEdited = workoutReducer(state, { type: 'set/editLogged', payload: { slotId, setIndex: 0, reps: 66666, loadKg: 82.5 } });
      assert.equal(setOf(repsEdited).actualReps, 6);
      const fine = workoutReducer(state, { type: 'set/editLogged', payload: { slotId, setIndex: 0, reps: 7, loadKg: 85 } });
      assert.equal(setOf(fine).actualLoadKg, 85);

      // A hold counts seconds, so ten minutes is a hold and not a typo.
      let plank = startWith([exercise({ exerciseName: 'Plank', trackingMode: 'hold', repsMin: 30, repsMax: 60, substitutionGroup: 'core' })]);
      plank = log(plank, plank.activeSession.exercises[0].slotId, 0, '', '600');
      assert.equal(setOf(plank).status, 'completed');

      // A prescription past the reps dial is still the prescription: the
      // catalog's "Rowing Machine (500m intervals)" asks for 500 (PR #121 review).
      let rowing = startWith([exercise({ exerciseName: 'Rowing Machine (500m intervals)', repsMin: 500, repsMax: 500, sets: 6, substitutionGroup: 'row' })]);
      rowing = log(rowing, rowing.activeSession.exercises[0].slotId, 0, '0', '500');
      assert.equal(setOf(rowing).status, 'completed');
      assert.equal(setOf(rowing).actualReps, 500);
      const rowingEdited = workoutReducer(rowing, { type: 'set/editLogged', payload: { slotId: rowing.activeSession.exercises[0].slotId, setIndex: 0, reps: 480, loadKg: 0 } });
      assert.equal(setOf(rowingEdited).actualReps, 480);
    },
  },
  {
    name: 'guided: the free workout will not tick a set nobody could lift, or keep one ticked',
    run() {
      // The rule itself is covered in tests/lib/emptyWorkoutSession; this is the wiring.
      const screen = read('src', 'screens', 'EmptyWorkoutScreen.tsx');
      assert.match(screen, /if \(!set\.done && !isLoggableFreestyleSet\(set\)\) \{\s*void haptics\.error\(\);\s*return;/);
      // The weight and rep fields stay editable after the tick, so the same
      // rule has to hold on the way through the edit: 82,5 ticked and then
      // typed over as 825 stayed ticked at 825 kg (PR #121 review).
      assert.match(
        screen,
        /return next\.done && !isLoggableFreestyleSet\(next\) \? \{ \.\.\.next, done: false \} : next;/,
      );
    },
  },
  {
    name: 'guided: moving on resumes a paused session, a logged set is not logged again, and a failed save says so',
    run() {
      const player = read('src', 'screens', 'GuidedPlayerScreen.tsx');
      const goTo = player.slice(player.indexOf('const goTo = useCallback('), player.indexOf('/** ±15s / +10s'));
      assert.match(goTo, /if \(workout\.activeSession\?\.pausedAt\) \{\s*workout\.resumeWorkout\(\);\s*\}/);
      const confirm = player.slice(player.indexOf('const confirmSet = ('), player.indexOf('expireRef.current = () =>'));
      assert.match(confirm, /if \(isSetCompleted\(slotId, setIndex\)\) \{\s*advance\(\);\s*return;\s*\}\s*workout\.updateSetDraft/);
      assert.match(player, /goToRef\.current\(rollPastLoggedWork\(steps, Math\.min\(target, steps\.length - 1\), isSetCompletedRef\.current\)\);/);

      // The editor's Save follows the reducer's own ceiling, interval and
      // prescription included, so Save and the store cannot disagree.
      assert.match(player, /nextReps <= repsCeiling &&\s*\(unloaded \|\| isLiftableWeight\(nextLoad\)\)/);
      assert.match(player, /repsCeilingFor\(exercise, findSetByIndex\(exercise, restEdit\.setIndex\)\)/);
      // And the correction is written to the set the reader chose, which in a
      // superset is not always the one the rest step names (2026-09-16).
      assert.match(
        player,
        /workout\.editLoggedSet\(restEdit\.slotId, restEdit\.setIndex, reps, loadKg\);/,
      );
      // The superset landing rule lives in tests/lib/guidedPlayer; this is its wiring.

      // The finish step shows the failure and the save again.
      assert.match(player, /<FinishView\s*onFinish=\{onFinishSession\}\s*saveFailed=\{saveFailed && !isSavingWorkout\}/);
      assert.match(player, /if \(saveFailed\) \{[\s\S]{0,400}<BigBtn label=\{t\(language, 'guided\.finish\.saveFailed\.retry'\)\} onPress=\{onFinish\} \/>/);
      assert.match(read('src', 'app', 'renderWorkoutTab.tsx'), /saveFailed=\{finishSaveState\.status === 'error'\}/);
    },
  },
  {
    name: 'guided: leaving the coach mid-answer cancels it, charges nothing and takes the question back',
    run() {
      const chat = read('src', 'screens', 'AICoachChatScreen.tsx');
      const cleanup = chat.slice(chat.indexOf('const pendingAskRef = useRef'), chat.indexOf('const pendingAskRef = useRef') + 1400);
      assert.match(cleanup, /askToken\.current \+= 1;\s*pending\.controller\.abort\(\);/);
      assert.match(cleanup, /message\.id !== `me:\$\{pending\.token\}`/);
      assert.match(chat, /pendingAskRef\.current = \{ token, controller \};/);
      assert.match(chat, /\}, controller\.signal\);\s*if \(token !== askToken\.current\) \{\s*return;/);
    },
  },
  {
    name: 'guided: taking a set away lands on the next lift’s walk-up, not past it',
    run() {
      // Removing the last set deletes it and the rest before it, so the list
      // shrinks under the index the reader is on and the same index becomes
      // the next lift's first set — its walk-up skipped (2026-09-16).
      const player = read('src', 'screens', 'GuidedPlayerScreen.tsx');
      const remove = player.slice(player.indexOf('const removable = block.every('), player.indexOf('panels={setPanelSource}'));
      assert.match(remove, /resyncTargetRef\.current = blockStart >= 0 \? blockStart : stepIndex;/);
      assert.ok(
        remove.indexOf('resyncTargetRef.current =') < remove.indexOf('workout.removeSet(step.slotId);'),
        'the landing place is chosen before the steps are rebuilt',
      );

      // The rule it lands by is the one tests/lib/guidedPlayer covers.
      const { rollPastLoggedWork } = require('../../../.test-dist/lib/guidedPlayer.js');
      const steps = [
        { type: 'position', phase: 'work', slotId: 'a', exerciseName: 'A', seconds: 20, groupIndex: 0, exerciseIndex: 0, exerciseCount: 2 },
        { type: 'set', phase: 'work', slotId: 'a', setIndex: 0, exerciseName: 'A', groupIndex: 0 },
        { type: 'rest', phase: 'work', slotId: 'a', setIndex: 0, seconds: 90, groupIndex: 0 },
        { type: 'position', phase: 'work', slotId: 'b', exerciseName: 'B', seconds: 20, groupIndex: 0, exerciseIndex: 1, exerciseCount: 2 },
        { type: 'set', phase: 'work', slotId: 'b', setIndex: 0, exerciseName: 'B', groupIndex: 0 },
      ];
      // A's only remaining set is logged, so rolling from A's block start
      // stops at B's walk-up rather than at B's set.
      assert.equal(rollPastLoggedWork(steps, 0, (slotId) => slotId === 'a'), 3);
    },
  },
];
