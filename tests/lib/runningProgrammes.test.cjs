const assert = require('node:assert/strict');

const {
  listHeldProgrammes,
  listRunningProgrammes,
  planIdsForTemplate,
  planIdsHoldingTemplate,
  resumeProgramme,
  stopProgramme,
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
  {
    name: 'running programmes: stopping one takes every plan it is held under and passes the lead on',
    run() {
      const plans = [
        plan('onboarding_plan_tpl_mine', 'tpl_mine'),
        plan('custom_plan_tpl_mine', 'tpl_mine'),
        plan('ready_plan_run', 'tpl_run'),
      ];

      assert.deepEqual(
        stopProgramme({
          activePlanId: 'onboarding_plan_tpl_mine',
          activePlanIds: ['onboarding_plan_tpl_mine', 'ready_plan_run', 'custom_plan_tpl_mine'],
          plans,
          templateId: 'tpl_mine',
        }),
        { activePlanId: 'ready_plan_run', activePlanIds: ['ready_plan_run'] },
      );

      // Not the lead: the lead stays where it is.
      assert.deepEqual(
        stopProgramme({
          activePlanId: 'ready_plan_run',
          activePlanIds: ['ready_plan_run', 'custom_plan_tpl_mine'],
          plans,
          templateId: 'tpl_mine',
        }),
        { activePlanId: 'ready_plan_run', activePlanIds: ['ready_plan_run'] },
      );

      // The last one: nobody leads.
      assert.deepEqual(
        stopProgramme({ activePlanId: 'ready_plan_run', activePlanIds: ['ready_plan_run'], plans, templateId: 'tpl_run' }),
        { activePlanId: null, activePlanIds: [] },
      );

      assert.equal(
        stopProgramme({ activePlanId: 'ready_plan_run', activePlanIds: ['ready_plan_run'], plans, templateId: 'tpl_other' }),
        null,
        'a programme that was not running reports a change',
      );
    },
  },
  {
    name: 'held programmes: switching one off keeps it, it does not delete it',
    run() {
      // The Active switch took a ready programme out of the running set, and
      // with no template of its own nothing listed it any more — to the
      // reader, the switch had deleted it (device, 2026-09-16).
      const plans = [plan('ready_plan_a', 'tpl_a'), plan('ready_plan_b', 'tpl_b'), plan('custom_plan_c', 'own_c')];
      const held = listHeldProgrammes({
        activePlanId: 'ready_plan_b',
        activePlanIds: ['ready_plan_b'],
        plans,
        authoredTemplateIds: ['own_c'],
      });
      assert.deepEqual(
        held.map((row) => [row.templateId, row.running, row.leading]),
        [
          ['tpl_b', true, true],
          ['tpl_a', false, false],
        ],
      );
      // An authored programme is listed by its own source, not twice.
      assert.ok(!held.some((row) => row.templateId === 'own_c'));
      // Held once, even when two plans point at it.
      const twice = listHeldProgrammes({
        activePlanId: null,
        activePlanIds: [],
        plans: [plan('onboarding_plan_a', 'tpl_a'), plan('ready_plan_a', 'tpl_a')],
      });
      assert.equal(twice.length, 1);
    },
  },
  {
    name: 'held programmes: switched back on under the plan it already has',
    run() {
      const plans = [plan('ready_plan_a', 'tpl_a'), plan('ready_plan_b', 'tpl_b')];
      // Something else leads: rejoin the running set, leave the lead alone.
      assert.deepEqual(
        resumeProgramme({ activePlanId: 'ready_plan_b', activePlanIds: ['ready_plan_b'], plans, templateId: 'tpl_a' }),
        { planId: 'ready_plan_a', activePlanIds: ['ready_plan_b', 'ready_plan_a'], activePlanId: 'ready_plan_b' },
      );
      // Nothing leads: this one does.
      assert.deepEqual(
        resumeProgramme({ activePlanId: null, activePlanIds: [], plans, templateId: 'tpl_a' }),
        { planId: 'ready_plan_a', activePlanIds: ['ready_plan_a'], activePlanId: 'ready_plan_a' },
      );
      // Already running: nothing doubles.
      assert.deepEqual(
        resumeProgramme({ activePlanId: 'ready_plan_a', activePlanIds: ['ready_plan_a'], plans, templateId: 'tpl_a' })?.activePlanIds,
        ['ready_plan_a'],
      );
      // Not held: nothing to switch on.
      assert.equal(resumeProgramme({ activePlanId: null, activePlanIds: [], plans, templateId: 'tpl_z' }), null);
    },
  },
  {
    name: 'held programmes: deleting one finds every plan that holds it',
    run() {
      const plans = [plan('onboarding_plan_a', 'tpl_a'), plan('ready_plan_a', 'tpl_a'), plan('ready_plan_b', 'tpl_b')];
      assert.deepEqual(planIdsHoldingTemplate(plans, 'tpl_a'), ['onboarding_plan_a', 'ready_plan_a']);
      assert.deepEqual(planIdsHoldingTemplate(plans, 'tpl_z'), []);
    },
  },
];
