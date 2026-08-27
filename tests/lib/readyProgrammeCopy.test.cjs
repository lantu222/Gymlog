const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { readAppWiring } = require('../helpers/appWiringSource.cjs');

function read(relative) {
  return fs.readFileSync(path.join(__dirname, '../..', relative), 'utf8');
}

/**
 * Editing the same ready programme twice must not leave two programmes.
 *
 * The catalog side was already right: a ready programme keeps its id forever
 * and is never written to. What was missing was the link back — nothing
 * recorded "this custom programme is my version of Advanced Glutes" — so the
 * second edit could not find the copy the first one made and built another.
 * Three edits, three programmes, the third named "(kopio 2)", and a free-tier
 * cap filling up with the same programme (#bugs 2026-08-26).
 */
module.exports = [
  {
    name: 'a stored template can say which catalog programme it came from',
    run() {
      const models = read('src/types/models.ts');
      assert.match(models, /sourceTemplateId\?: string \| null;/);
    },
  },
  {
    /**
     * Written once, by the copy that created the template. If an edit could
     * drop it, the edit after that would look for a copy and not find the very
     * template it had just written.
     */
    name: 'the link survives every later edit of the copy',
    run() {
      const provider = read('src/state/AppProvider.tsx');
      assert.match(
        provider,
        /sourceTemplateId: existingTemplate\?\.sourceTemplateId \?\? draft\.sourceTemplateId \?\? null,/,
      );
    },
  },
  {
    /**
     * The lookup reads the database, not the screen.
     *
     * `workoutTemplates` is the rendered array and is one render behind the
     * write. With an edit every few seconds that never showed; with a stepper
     * on the day screen three taps land inside one render, all three ask the
     * stale array whether a copy exists, and all three make one — two "HOME
     * Starter" rows from a single adjustment, on the emulator, 2026-08-27.
     */
    name: 'a second edit of the same ready programme goes to the copy, not to a new one',
    run() {
      const wiring = readAppWiring();
      assert.match(wiring, /const existingCopyId = await findWorkoutTemplateIdBySource\(programId\);/);
      assert.ok(
        !/const existingCopy = workoutTemplates\.find\(/.test(wiring),
        'the copy must be looked up in stored data, not in the rendered template list',
      );
      // Routed through the custom path, which edits in place.
      assert.match(wiring, /runProgramExerciseEdit\('custom', existingCopyId, sessionId, exerciseId, edit\)/);
      // And the first copy records the link, or there is nothing to find.
      assert.match(wiring, /draft\.sourceTemplateId = programId;/);
    },
  },
  {
    /**
     * Fresh data is only half of it. Two edits that overlap can both read
     * before either writes, so the find-or-create decision has to be ordered
     * as well: the second edit's lookup must run after the first edit's copy
     * has been stored.
     */
    name: 'programme edits run one at a time, in the order they were pressed',
    run() {
      const wiring = readAppWiring();
      assert.match(wiring, /const programEditQueue = useRef<Promise<void>>\(Promise\.resolve\(\)\);/);
      const start = wiring.indexOf('function handleEditProgramExercise(');
      const body = wiring.slice(start, start + 700);
      assert.ok(
        body.includes('programEditQueue.current.then('),
        'every edit should be chained onto the one before it',
      );
      assert.ok(
        body.includes('next.catch('),
        'a failed edit must not wedge the queue behind it',
      );
    },
  },
  {
    /**
     * The lookup runs inside the provider's own exclusive queue, against
     * databaseRef — the same discipline every other mutation follows. Reading
     * `database.workoutTemplates` from the provider's rendered state here
     * would put the stale read back one layer down.
     */
    name: 'the lookup reads databaseRef inside the exclusive queue',
    run() {
      const provider = read('src/state/AppProvider.tsx');
      const start = provider.indexOf('function findWorkoutTemplateIdBySource(');
      assert.ok(start > -1, 'the provider should own the lookup');
      const body = provider.slice(start, start + 400);
      assert.ok(body.includes('runExclusive('), 'the lookup must run inside the queue');
      assert.ok(body.includes('databaseRef.current'), 'the lookup must read stored data');
    },
  },
  {
    /**
     * A database written before the field existed has no link, and guessing one
     * from the name would re-attach copies to catalog programmes they may no
     * longer resemble. Null is the honest value.
     */
    name: 'rows stored before the link existed normalise to null, not to a guess',
    run() {
      const storage = read('src/storage/database.ts');
      const index = storage.indexOf('sourceTemplateId:');
      assert.ok(index > -1, 'the normalizer should handle the field');
      const body = storage.slice(index, index + 260);
      assert.ok(body.includes(': null'), 'an absent link normalises to null');
    },
  },
  {
    /**
     * The copy's plan needs one entry per day, and the day ids come from what
     * was just stored — not from the render that created it.
     *
     * `getWorkoutTemplateSessions` reads rendered state, so calling it here
     * returned nothing, and `buildProgramWorkoutPlan` floors its entry count
     * at one: every reader who edited a lift in a multi-day ready programme
     * got a copy that trained one unnamed day. Found in stored data on the
     * emulator 2026-08-27 — FIT, three days, a plan with one entry.
     */
    name: 'the copy reads its own days back from stored data, not from the render',
    run() {
      const wiring = readAppWiring();
      const start = wiring.indexOf('const draft = buildDuplicatedCustomProgramDraft(');
      const body = wiring.slice(start, start + 4600);
      assert.match(body, /await getWorkoutTemplateSessionsFresh\(workoutTemplateId\)/);
      assert.ok(
        !/const copiedSessions = getWorkoutTemplateSessions\(/.test(body),
        'the rendered getter cannot see a template written moments ago',
      );

      const provider = read('src/state/AppProvider.tsx');
      const at = provider.indexOf('function getWorkoutTemplateSessionsFresh(');
      assert.ok(at > -1, 'the provider should own the fresh read');
      const fresh = provider.slice(at, at + 500);
      assert.ok(fresh.includes('runExclusive('), 'it must read inside the queue');
      assert.ok(fresh.includes('databaseRef.current'), 'it must read stored data');
    },
  },
  {
    /**
     * And the reader stays on the day they were editing. Landing on the
     * programme page was tolerable when an edit closed its own sheet; with a
     * stepper the first press moved the screen out from under the control
     * still being pressed.
     */
    name: 'editing a ready programme lands on the copy of the same day',
    run() {
      const wiring = readAppWiring();
      assert.match(wiring, /const copiedSessionId = dayIndex > -1 \? copiedSessions\[dayIndex\]\?\.id : undefined;/);
      assert.match(wiring, /screen: 'programDay',[\s\S]{0,160}sessionId: copiedSessionId,/);
    },
  },
];
