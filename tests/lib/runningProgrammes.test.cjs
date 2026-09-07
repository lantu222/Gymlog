const assert = require('node:assert/strict');

const {
  listRunningProgrammes,
  planIdsForTemplate,
} = require('../../.test-dist/lib/runningProgrammes.js');

const plan = (id, templateId, name = id) => ({
  id,
  name,
  entries: [{ workoutTemplateId: templateId }],
});

module.exports = [
  {
    /**
     * The bug this file exists for: an adopted ready programme has no row in
     * `workoutTemplates`, so the Programs tab listed it only while Home led
     * with it. Making a second programme lead dropped it out of the one list
     * called "your programmes" while it kept running — and kept holding a slot
     * against the programme cap (user 2026-09-07).
     */
    name: 'running programmes: every running one is listed, leader first',
    run() {
      const plans = [plan('ready_plan_strong', 'tpl_strong'), plan('ready_plan_glutes', 'tpl_glutes')];

      const rows = listRunningProgrammes({
        activePlanId: 'ready_plan_glutes',
        activePlanIds: ['ready_plan_strong', 'ready_plan_glutes'],
        plans,
      });

      assert.deepEqual(
        rows.map((row) => row.templateId),
        ['tpl_glutes', 'tpl_strong'],
        'the leader is not first, or a running programme is missing',
      );
      assert.equal(rows[0].leading, true);
      assert.equal(rows[1].leading, false);
      assert.equal(rows[1].planId, 'ready_plan_strong');
    },
  },
  {
    name: 'running programmes: one programme held under two plan ids is listed once',
    run() {
      // Onboarding writes `onboarding_plan_<id>` and adoption writes
      // `ready_plan_<id>`. Both point at one programme, and the list keys its
      // rows by template, so a row per plan would collide.
      const plans = [
        plan('onboarding_plan_strong', 'tpl_strong'),
        plan('ready_plan_strong', 'tpl_strong'),
      ];

      const rows = listRunningProgrammes({
        activePlanId: 'ready_plan_strong',
        activePlanIds: ['onboarding_plan_strong', 'ready_plan_strong'],
        plans,
      });

      assert.equal(rows.length, 1);
      // And it carries the LEADING plan, not whichever came first in the list.
      assert.equal(rows[0].planId, 'ready_plan_strong');
      assert.equal(rows[0].leading, true);
    },
  },
  {
    name: 'running programmes: an authored template is never listed twice',
    run() {
      const plans = [plan('custom_plan_mine', 'tpl_mine'), plan('ready_plan_strong', 'tpl_strong')];

      const rows = listRunningProgrammes({
        activePlanId: 'custom_plan_mine',
        activePlanIds: ['custom_plan_mine', 'ready_plan_strong'],
        plans,
        authoredTemplateIds: ['tpl_mine'],
      });

      assert.deepEqual(
        rows.map((row) => row.templateId),
        ['tpl_strong'],
        'the reader own template was listed as a running programme too',
      );
    },
  },
  {
    name: 'running programmes: a missing plan, a plan with no entries, and no leader at all',
    run() {
      const plans = [plan('ready_plan_strong', 'tpl_strong'), { id: 'empty', name: 'empty', entries: [] }];

      // A plan id with nothing behind it is skipped rather than throwing.
      const rows = listRunningProgrammes({
        activePlanId: null,
        activePlanIds: ['gone', 'empty', 'ready_plan_strong'],
        plans,
      });
      assert.deepEqual(rows.map((row) => row.templateId), ['tpl_strong']);
      assert.equal(rows[0].leading, false, 'nothing leads, so nothing may claim to');

      assert.deepEqual(listRunningProgrammes({ activePlanId: null, activePlanIds: [], plans }), []);
    },
  },
  {
    /**
     * Stopping a programme has to take every plan pointing at it. Removing
     * only the leading one left it running under the other id, and the switch
     * that reported it stopped would have been lying.
     */
    name: 'plans for a programme: all of them, leader included, and none of anything else',
    run() {
      const plans = [
        plan('onboarding_plan_strong', 'tpl_strong'),
        plan('ready_plan_strong', 'tpl_strong'),
        plan('ready_plan_glutes', 'tpl_glutes'),
      ];

      const ids = planIdsForTemplate({
        activePlanId: 'ready_plan_strong',
        activePlanIds: ['onboarding_plan_strong', 'ready_plan_glutes'],
        plans,
        templateId: 'tpl_strong',
      });

      assert.deepEqual([...ids].sort(), ['onboarding_plan_strong', 'ready_plan_strong']);

      assert.deepEqual(
        planIdsForTemplate({
          activePlanId: null,
          activePlanIds: ['ready_plan_glutes'],
          plans,
          templateId: 'tpl_strong',
        }),
        [],
        'a programme that is not running has no plans to stop',
      );
    },
  },
];
