const assert = require('node:assert/strict');

const appWiring = require('../helpers/appWiringSource.cjs').readAppWiring();

/**
 * Editing a lift of a ready programme writes a copy first, then its plan and
 * the reader's running set. A failure in between used to leave the copy
 * behind under a toast that said the copy failed, and the next edit found it
 * by its source and went to it (#bugs 2026-10-01, phase-B list item 3).
 */
module.exports = [
  {
    name: 'a ready-programme copy is taken back when its follow-up writes fail',
    run() {
      const start = appWiring.indexOf('let uncommittedCopyId: string | null = null;');
      assert.ok(start > 0, 'the copy is no longer tracked until committed');
      const body = appWiring.slice(start, appWiring.indexOf("showToast(t(preferences.appLanguage, 'toast.programCopyFailed'));", start));

      // Tracked from the moment it exists…
      assert.match(body, /const workoutTemplateId = await upsertWorkoutTemplate\(draft\);\s*uncommittedCopyId = workoutTemplateId;/);
      // …until the reader's programme points at it, and not a line earlier.
      const prefsAt = body.indexOf('await updatePreferences(');
      const committedAt = body.indexOf('uncommittedCopyId = null;');
      assert.ok(prefsAt > 0 && committedAt > prefsAt, 'the copy counts as committed before the preferences land');
      // The held record's cleanup after that cannot fail the edit.
      assert.match(body, /await forgetHeldProgramme\(template\.id\)\.catch\(/);
      // And a failure before it deletes the copy before saying it failed.
      assert.match(
        body,
        /if \(uncommittedCopyId\) \{\s*\/\/[^\n]*\n\s*await deleteWorkoutTemplate\(uncommittedCopyId\)\.catch\(\(\) => undefined\);/,
      );
      // Wired: App.tsx hands the hook the delete.
      assert.match(appWiring, /forgetHeldProgramme,\s*deleteWorkoutTemplate,\s*navigate,/);
    },
  },
];
