const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '..', '..', 'App.tsx'), 'utf8').replace(/\r\n/g, '\n');

/**
 * A programme the reader holds but has switched off is one programme, with
 * its block, and not a second one.
 *
 * Audit round 4 (2026-09-20), three handlers in App.tsx: forking a running
 * ready programme (editing one lift copies it) removed its plan from the
 * running set but left the record, so the programme was listed twice and the
 * second row's Active switch re-adopted the catalog version beside the copy;
 * adopting a held programme from the goal flow or the completion card rebuilt
 * its plan and reset the block (week 5 → week 1); and the rhythm editor of a
 * held programme rewrote the app's availability, so Profile and the reminders
 * followed a programme Home was not running. Source-level: all three are wiring.
 */
const between = (from, to) => {
  const start = app.indexOf(from);
  assert.ok(start >= 0, `${from} is gone`);
  const end = app.indexOf(to, start);
  return app.slice(start, end > 0 ? end : undefined);
};

module.exports = [
  {
    name: 'programmes: the fork forgets the record it replaced, adoption resumes a held one, the rhythm of a held one stays its own',
    run() {
      const fork = between('const replacedPlan = wasRunning', "if (edit.kind === 'replace')");
      assert.match(fork, /if \(wasRunning\) \{[\s\S]{0,600}await forgetHeldProgramme\(template\.id\);/, 'the replaced plan record must go with the copy');

      const adopt = between('const planId = buildReadyProgramPlanId(workoutTemplateId);', 'const dayLabels = planLabelsForProgramme(');
      assert.match(adopt, /if \(database\.workoutPlans\.some\(\(item\) => item\.id === planId\)\) \{[\s\S]{0,300}resumeProgramme\(\{/, 'a held programme must be resumed, not rebuilt');

      const rhythm = between('async function handleSaveRhythm(', 'setupScheduleMode:');
      // Not the running set: two programmes may run at once, and the second
      // one's rhythm is not the app's availability either (CI review of #161).
      assert.match(rhythm, /if \(days\.length > 0 && plan\.id === preferences\.activePlanId\) \{/, "availability must follow the lead plan's rhythm only");
      assert.ok(!/activeProgramTemplateIds/.test(rhythm), 'the running set is not the lead');
    },
  },
];
