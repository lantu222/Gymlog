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
    name: 'a second edit of the same ready programme goes to the copy, not to a new one',
    run() {
      const wiring = readAppWiring();
      assert.match(wiring, /const existingCopy = workoutTemplates\.find\(\(item\) => item\.sourceTemplateId === programId\);/);
      // Routed through the custom path, which edits in place.
      assert.match(wiring, /handleEditProgramExercise\('custom', existingCopy\.id, sessionId, exerciseId, edit\)/);
      // And the first copy records the link, or there is nothing to find.
      assert.match(wiring, /draft\.sourceTemplateId = programId;/);
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
];
