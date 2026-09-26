const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { newProgramSessionName, removeProgramSession } = require('../../.test-dist/lib/programSessionList.js');
const { readAppWiring } = require('../helpers/appWiringSource.cjs');

// Line endings normalised: a Windows checkout is CRLF.
const read = (...parts) =>
  fs.readFileSync(path.join(__dirname, '..', '..', ...parts), 'utf8').split('\r\n').join('\n');

/** Slices between two anchors, failing loudly when one is missing. */
function between(source, from, to) {
  const start = source.indexOf(from);
  assert.ok(start >= 0, `anchor missing: ${from}`);
  const end = source.indexOf(to, start + from.length);
  assert.ok(end > start, `anchor missing after ${from}: ${to}`);
  return source.slice(start, end);
}

const day = (id, orderIndex) => ({ id, orderIndex, name: id, exercises: [{ id: `${id}_x` }] });

/**
 * Adding and removing whole days of a custom programme (#bugs 2026-09-24:
 * "yhtä päivää ei voi lisätä eikä poistaa" — the only choices were changing a
 * day or deleting the whole programme).
 */
module.exports = [
  {
    name: 'programme days: removing one keeps the rest in order, with no gap in the numbering',
    run() {
      // Given out of order on purpose: position is orderIndex, not the array.
      const outcome = removeProgramSession([day('c', 2), day('a', 0), day('b', 1), day('d', 3)], 'b');
      assert.equal(outcome.kind, 'removed');
      assert.deepEqual(
        outcome.sessions.map((session) => [session.id, session.orderIndex]),
        [['a', 0], ['c', 1], ['d', 2]],
      );
      // Everything else about a surviving day is carried through untouched.
      assert.deepEqual(outcome.sessions[0].exercises, [{ id: 'a_x' }]);
    },
  },
  {
    name: 'programme days: the last day is not removed — that is deleting the programme',
    run() {
      assert.deepEqual(removeProgramSession([day('only', 0)], 'only'), { kind: 'skip', reason: 'lastSession' });
      assert.deepEqual(removeProgramSession([day('a', 0), day('b', 1)], 'zzz'), {
        kind: 'skip',
        reason: 'sessionMissing',
      });
    },
  },
  {
    // The placeholder the template editor writes, so the day list prints it
    // as "Treeni N" and Home names it from its lifts, like any unnamed day.
    name: 'programme days: a new day is named with the editor placeholder, one past the count',
    run() {
      assert.equal(newProgramSessionName(5, 'fi'), 'Päivä 6');
      assert.equal(newProgramSessionName(0, 'en'), 'Day 1');
      const { formatPlanSessionTitle } = require('../../.test-dist/lib/sessionNameLabel.js');
      assert.equal(formatPlanSessionTitle({ name: newProgramSessionName(5, 'fi') }, 5, 'Oma', 'fi'), 'Treeni 6');
    },
  },
  {
    /**
     * A day is never saved empty. The editor refuses to save one and the day
     * page refuses to remove a day's last lift; an "add day" that wrote an
     * empty day first and filled it later would be the one way round both —
     * Home could offer it and starting it would open an empty player.
     */
    name: 'programme days: a new day is written together with its lifts, and not without them',
    run() {
      const app = read('App.tsx');
      const add = between(app, 'async function handleAddProgramSession(', '\n  }\n');
      assert.match(add, /if \(exerciseNames\.length === 0\) \{\s*return null;\s*\}/, 'an empty day can be added');
      const write = between(add, 'editWorkoutTemplateSessions(', 'if (!result.saved)');
      // The new day and its lifts are inside the same write.
      assert.match(write, /id: newSessionId,\s*name: newProgramSessionName\(sessions\.length, preferences\.appLanguage\),\s*exercises,/);
      assert.ok(add.indexOf('buildAddedProgramExercises(exerciseNames, newSessionId)') < add.indexOf('editWorkoutTemplateSessions('));
      // Every existing day is carried through whole — the writer replaces the
      // record, and a hand copy that forgets a field erases it.
      assert.match(write, /exercises: session\.exercises\.map\(toDraftExercise\)/);
      // The week follows, and only after the programme is saved — through
      // its own catch, so a week that could not follow is not reported as a
      // day that was not saved (CI review of #183).
      assert.ok(add.indexOf('await syncPlanAfterDayEdit(workoutTemplateId)') > add.indexOf('if (!result.saved)'));
      const sync = between(app, 'async function syncPlanAfterDayEdit(', '\n  }\n');
      assert.match(sync, /try \{\s*await syncPlanToTemplate\(workoutTemplateId\);\s*return true;\s*\} catch/);

      const remove = between(app, 'async function handleRemoveProgramSession(', '\n  }\n');
      assert.match(remove, /removeProgramSession\(sessions, sessionId\)/);
      assert.match(remove, /exercises: session\.exercises\.map\(toDraftExercise\)/);
      assert.ok(remove.indexOf('await syncPlanAfterDayEdit(workoutTemplateId)') > remove.indexOf('if (!result.saved)'));
    },
  },
  {
    name: 'programme days: custom only, the new day opens after it is saved, and removal is asked first',
    run() {
      const wiring = readAppWiring();
      const addProp = between(wiring, '        onAddSession={', '        exerciseLibrary={exerciseBrowserItems}');
      assert.match(addProp, /route\.programType === 'custom'/, 'a catalog programme can be given a day');
      // The navigation to the new day waits for its id, which only exists
      // once the write resolved.
      assert.match(addProp, /handleAddProgramSession\(route\.workoutTemplateId, exerciseNames\)\.then\(\s*\(added\) => \{\s*if \(!added\) \{\s*return;\s*\}/);
      assert.ok(addProp.indexOf('haptics.success()') > addProp.indexOf('if (!added)'));
      // A saved day whose week lagged still opens, and says the week lagged.
      assert.match(addProp, /if \(added\.weekSynced\) \{\s*void haptics\.success\(\);\s*\} else \{\s*showToast\(t\(preferences\.appLanguage, 'toast\.planWeekOutOfStep'\)\);/);

      const removeProp = between(wiring, '        onRemoveSession={', '        onBack={');
      assert.match(removeProp, /route\.programType === 'custom' && program\.sessions\.length > 1/);
      // The success haptic is the write's, not the tap's.
      assert.match(removeProp, /\(removed\) => \{\s*if \(!removed\) \{\s*return;\s*\}\s*if \(removed\.weekSynced\) \{\s*void haptics\.success\(\);\s*\} else \{\s*showToast\(t\(preferences\.appLanguage, 'toast\.planWeekOutOfStep'\)\);/);

      // The day page asks before it removes: the prop is called only from the
      // dialog's confirm.
      const dayScreen = read('src', 'screens', 'ProgramDayScreen.tsx');
      assert.equal(dayScreen.split('onRemoveSession()').length - 1, 1, 'the day is removed from somewhere other than the dialog');
      const dialog = between(dayScreen, 'visible={confirmRemoveSession}', '/>');
      assert.match(dialog, /onConfirm=\{\(\) => \{\s*setConfirmRemoveSession\(false\);\s*onRemoveSession\(\);/);
      assert.match(dialog, /destructive/);

      // And the page's add row opens the library, not an empty day.
      const detail = read('src', 'screens', 'ProgramDetailScreen.tsx');
      assert.match(detail, /onPress=\{\(\) => setAddSessionOpen\(true\)\}/);
      assert.match(detail, /if \(items\.length > 0\) \{\s*onAddSession\?\.\(items\.map\(\(item\) => item\.name\)\);/);
    },
  },
  {
    // The toast pointed at "the editor", which a programme page no longer
    // opens. It now names the action that exists.
    name: 'programme days: the last-lift toast points at removing the workout, not at an editor',
    run() {
      const i18n = read('src', 'lib', 'i18n.ts');
      for (const line of i18n.split('\n').filter((row) => row.includes("'toast.lastExerciseInDay':"))) {
        assert.doesNotMatch(line, /muokkaim|editor/i, line);
      }
      for (const key of ['detail.addWorkout', 'day.removeWorkout', 'day.removeWorkout.title', 'day.removeWorkout.message', 'day.removeWorkout.confirm']) {
        assert.equal(i18n.split(`'${key}':`).length - 1, 2, `${key} needs EN and FI`);
      }
    },
  },
];
