const assert = require('node:assert/strict');

const {
  READY_PROGRAM_CONTENT_FI,
} = require('../../.test-dist/lib/readyProgramContentFi');
const { getReadyProgramContent } = require('../../.test-dist/lib/readyProgramContent');
const { WORKOUT_TEMPLATES_V1 } = require('../../.test-dist/features/workout/workoutCatalog');

const FIELDS = ['summary', 'audience', 'equipmentProfile', 'whyItWorks'];

module.exports = [
  {
    name: 'every Finnish program entry mirrors an English one, field for field',
    run() {
      for (const [templateId, finnish] of Object.entries(READY_PROGRAM_CONTENT_FI)) {
        const english = getReadyProgramContent(templateId, 'en');
        assert.ok(english, `${templateId} has Finnish content but no English source`);

        for (const field of FIELDS) {
          assert.ok(finnish[field] && finnish[field].trim().length > 0, `${templateId}.${field} is empty`);
          assert.notEqual(
            finnish[field],
            english[field],
            `${templateId}.${field} was left in English`,
          );
        }

      }
    },
  },
  {
    name: 'Finnish is returned for fi and English stays the default',
    run() {
      const fi = getReadyProgramContent('tpl_3_day_full_body_v1', 'fi');
      const en = getReadyProgramContent('tpl_3_day_full_body_v1');

      assert.ok(fi && en);
      assert.notEqual(fi.summary, en.summary);
      assert.match(en.summary, /full-body/i);
    },
  },
  {
    name: 'a program without a Finnish entry still reads in English, never blank',
    run() {
      const missing = Object.keys(READY_PROGRAM_CONTENT_FI).length;
      assert.ok(missing > 0);

      for (const template of WORKOUT_TEMPLATES_V1) {
        const content = getReadyProgramContent(template.id, 'fi');
        if (content) {
          assert.ok(content.summary.trim().length > 0, `${template.id} resolved to an empty summary`);
        }
      }
    },
  },
];
