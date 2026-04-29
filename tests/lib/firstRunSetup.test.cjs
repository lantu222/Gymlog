const assert = require('node:assert/strict');

const {
  buildFirstRunRecommendationReasons,
  buildScheduleFitNote,
  buildFirstRunCustomProgramName,
  buildFirstRunPromptSuggestions,
  resolveProjectedTrainingDays,
  resolveFirstRunRecommendation,
  resolveFirstRunRecommendationWithTailoring,
} = require('../../.test-dist/lib/firstRunSetup.js');
const { buildRecommendationInput } = require('../../.test-dist/lib/recommendationInput.js');
const { getRecommendationProgramDefinition } = require('../../.test-dist/lib/recommendationCatalog.js');
const { buildRecommendationWeeklyStructure } = require('../../.test-dist/lib/recommendationWeeklyStructure.js');
const { evaluateWorkoutContentFit } = require('../../.test-dist/lib/workoutContentFit.js');

const HIGH_PRIORITY_BASE_SELECTION = {
  gender: 'unspecified',
  age: 30,
  ageRange: '26_35',
  goal: 'strength',
  level: 'intermediate',
  daysPerWeek: 3,
  equipment: 'gym',
  secondaryOutcomes: ['consistency'],
  focusAreas: [],
  guidanceMode: 'guided_editable',
  scheduleMode: 'app_managed',
  weeklyMinutes: null,
  availableDays: [],
  currentWeightKg: null,
  targetWeightKg: null,
  unitPreference: 'kg',
};

function buildHighPrioritySelection(overrides) {
  return {
    ...HIGH_PRIORITY_BASE_SELECTION,
    ...overrides,
    secondaryOutcomes: overrides.secondaryOutcomes ?? HIGH_PRIORITY_BASE_SELECTION.secondaryOutcomes,
    focusAreas: overrides.focusAreas ?? HIGH_PRIORITY_BASE_SELECTION.focusAreas,
    availableDays: overrides.availableDays ?? HIGH_PRIORITY_BASE_SELECTION.availableDays,
  };
}

function evaluateHighPriorityScenario(selection) {
  const recommendation = resolveFirstRunRecommendation(selection);
  const definition = getRecommendationProgramDefinition(recommendation.featuredProgramId);
  const projectedDaysPerWeek = definition?.daysPerWeek ?? selection.daysPerWeek;
  const reasons = buildFirstRunRecommendationReasons(selection, {
    projectedDaysPerWeek,
    estimatedSessionDuration: definition?.estimatedSessionMinutes ?? null,
    mismatchNote: recommendation.mismatchNote,
  });
  const projectedDays = resolveProjectedTrainingDays(selection, projectedDaysPerWeek);

  return { recommendation, reasons, projectedDays, projectedDaysPerWeek };
}

function assertUserReadyRecommendation(selection, options = {}) {
  const recommendation = resolveFirstRunRecommendation(selection);
  const definition = getRecommendationProgramDefinition(recommendation.featuredProgramId);
  const input = buildRecommendationInput(selection);
  const fit = evaluateWorkoutContentFit(recommendation.featuredProgramId, {
    goalType: input.profile.goalType,
    setupContext: input.profile.setupContext,
  });
  const weeklyStructure = buildRecommendationWeeklyStructure(selection, recommendation.featuredProgramId);
  const projectedDaysPerWeek = definition?.daysPerWeek ?? selection.daysPerWeek;
  const reasons = buildFirstRunRecommendationReasons(selection, {
    projectedDaysPerWeek,
    estimatedSessionDuration: definition?.estimatedSessionMinutes ?? null,
    mismatchNote: recommendation.mismatchNote,
  });

  assert.ok(definition, recommendation.featuredProgramId);
  assert.deepEqual(fit.issues, [], `${recommendation.featuredProgramId}: ${fit.issues.join(', ')}`);
  assert.ok(weeklyStructure, recommendation.featuredProgramId);
  assert.ok(weeklyStructure.summary.length > 20, recommendation.featuredProgramId);
  assert.ok(weeklyStructure.days.length >= definition.daysPerWeek, recommendation.featuredProgramId);
  assert.ok(reasons.join(' ').length > 20, recommendation.featuredProgramId);
  assert.equal(recommendation.trainingBlock.blockLengthWeeks, 4, recommendation.featuredProgramId);
  assert.equal(recommendation.trainingBlock.currentWeekRole, 'baseline', recommendation.featuredProgramId);
  assert.equal(recommendation.recommendationConfidence > 0 && recommendation.recommendationConfidence <= 1, true);

  if (definition.daysPerWeek !== selection.daysPerWeek) {
    assert.ok(recommendation.fallbackReason || recommendation.mismatchNote, recommendation.featuredProgramId);
  }

  if (options.maxRecoveryDemand) {
    const recoveryRank = { low: 1, moderate: 2, high: 3 };
    assert.equal(
      recoveryRank[definition.recoveryDemand] <= recoveryRank[options.maxRecoveryDemand],
      true,
      recommendation.featuredProgramId,
    );
  }

  return { recommendation, definition, fit, weeklyStructure, reasons };
}

module.exports = [
  {
    name: 'first-run setup recommends beginner strength for a 2-day beginner strength setup',
    run() {
      const recommendation = resolveFirstRunRecommendation({
        goal: 'strength',
        level: 'beginner',
        daysPerWeek: 2,
        equipment: 'gym',
        secondaryOutcomes: ['consistency'],
        focusAreas: [],
        guidanceMode: 'guided_editable',
        unitPreference: 'kg',
      });

      assert.equal(recommendation.featuredProgramId, 'tpl_2_day_beginner_strength_v1');
      assert.equal(recommendation.secondaryProgramId, 'tpl_2_day_minimal_full_body_v1');
      assert.equal(recommendation.mismatchNote, null);
    },
  },
  {
    name: 'first-run setup recommends strength base with a same-cadence secondary option for a 3-day strength setup',
    run() {
      const recommendation = resolveFirstRunRecommendation({
        goal: 'strength',
        level: 'intermediate',
        daysPerWeek: 3,
        equipment: 'gym',
        secondaryOutcomes: ['consistency'],
        focusAreas: [],
        guidanceMode: 'guided_editable',
        unitPreference: 'kg',
      });

      assert.equal(recommendation.featuredProgramId, 'tpl_3_day_strength_base_v1');
      assert.equal(recommendation.secondaryProgramId, 'tpl_3_day_upper_lower_lite_v1');
    },
  },
  {
    name: 'tailoring keeps a 3-day strength recommendation on a 3-day plan when gym preferences are neutral',
    run() {
      const recommendation = resolveFirstRunRecommendationWithTailoring(
        {
          goal: 'strength',
          level: 'beginner',
          daysPerWeek: 3,
          equipment: 'gym',
          secondaryOutcomes: ['consistency'],
          focusAreas: [],
          guidanceMode: 'guided_editable',
          unitPreference: 'kg',
        },
        {
          setupEquipment: 'gym',
          setupFreeWeightsPreference: 'neutral',
          setupBodyweightPreference: 'neutral',
          setupMachinesPreference: 'neutral',
          setupShoulderFriendlySwaps: 'neutral',
          setupElbowFriendlySwaps: 'neutral',
          setupKneeFriendlySwaps: 'neutral',
        },
      );

      assert.equal(recommendation.featuredProgramId, 'tpl_3_day_strength_base_v1');
    },
  },
  {
    name: 'first-run setup falls back to low-equipment plans when the user has home equipment',
    run() {
      const recommendation = resolveFirstRunRecommendation({
        goal: 'muscle',
        level: 'beginner',
        daysPerWeek: 4,
        equipment: 'home',
        secondaryOutcomes: ['consistency'],
        focusAreas: [],
        guidanceMode: 'guided_editable',
        unitPreference: 'kg',
      });

      assert.equal(recommendation.featuredProgramId, 'tpl_2_day_minimal_full_body_v1');
      assert.ok(recommendation.mismatchNote);
      assert.match(recommendation.mismatchNote, /lighter equipment/i);
    },
  },
  {
    name: 'first-run setup recommends run and mobility with yoga as the secondary 4-day option',
    run() {
      const recommendation = resolveFirstRunRecommendation({
        goal: 'run_mobility',
        level: 'beginner',
        daysPerWeek: 4,
        equipment: 'minimal',
        secondaryOutcomes: ['mobility'],
        focusAreas: [],
        guidanceMode: 'done_for_me',
        unitPreference: 'kg',
      });

      assert.equal(recommendation.featuredProgramId, 'tpl_3_day_run_mobility_v1');
      assert.equal(recommendation.secondaryProgramId, 'tpl_2_day_yoga_recovery_v1');
      assert.match(recommendation.mismatchNote, /closest match/i);
    },
  },
  {
    name: 'first-run setup prompt suggestions reflect the selected days and goal',
    run() {
      const suggestions = buildFirstRunPromptSuggestions(
        {
          goal: 'strength',
          level: 'beginner',
          daysPerWeek: 3,
          equipment: 'gym',
          secondaryOutcomes: ['consistency', 'mobility'],
          focusAreas: ['arms'],
          guidanceMode: 'guided_editable',
          scheduleMode: 'self_managed',
          weeklyMinutes: 180,
          availableDays: ['mon', 'wed', 'fri'],
          unitPreference: 'kg',
        },
        '3-Day Strength Base',
      );

      assert.equal(suggestions.length, 3);
      assert.match(suggestions[0], /Best 3-day strength start/i);
      assert.match(suggestions[1], /3-Day Strength Base/);
      assert.match(suggestions[1], /another plan/i);
      assert.match(suggestions[2], /How should I start with 3 days/i);
    },
  },
  {
    name: 'first-run setup shifts 4-day muscle users toward powerbuilding when strength also matters',
    run() {
      const recommendation = resolveFirstRunRecommendation({
        goal: 'muscle',
        level: 'intermediate',
        daysPerWeek: 4,
        equipment: 'gym',
        secondaryOutcomes: ['strength'],
        focusAreas: [],
        guidanceMode: 'guided_editable',
        unitPreference: 'kg',
      });

      assert.equal(recommendation.featuredProgramId, 'tpl_4_day_powerbuilding_v1');
      assert.equal(recommendation.secondaryProgramId, 'tpl_4_day_muscle_builder_v1');
    },
  },
  {
    name: 'tailoring can bias a 4-day strength recommendation away from powerbuilding toward the steadier option',
    run() {
      const recommendation = resolveFirstRunRecommendationWithTailoring(
        {
          goal: 'strength',
          level: 'intermediate',
          daysPerWeek: 4,
          equipment: 'gym',
          secondaryOutcomes: ['muscle'],
          focusAreas: [],
          guidanceMode: 'guided_editable',
          unitPreference: 'kg',
        },
        {
          setupEquipment: 'gym',
          setupFreeWeightsPreference: 'avoid',
          setupBodyweightPreference: 'neutral',
          setupMachinesPreference: 'love',
          setupShoulderFriendlySwaps: 'prioritize',
          setupElbowFriendlySwaps: 'neutral',
          setupKneeFriendlySwaps: 'neutral',
        },
      );

      assert.equal(recommendation.featuredProgramId, 'tpl_4_day_strength_size_v1');
    },
  },
  {
    name: 'first-run setup can bias a 2-day general setup toward mobility reset when mobility matters',
    run() {
      const recommendation = resolveFirstRunRecommendation({
        goal: 'general',
        level: 'beginner',
        daysPerWeek: 2,
        equipment: 'gym',
        secondaryOutcomes: ['mobility', 'consistency'],
        focusAreas: [],
        guidanceMode: 'done_for_me',
        unitPreference: 'kg',
      });

      assert.equal(recommendation.featuredProgramId, 'tpl_2_day_mobility_reset_v1');
      assert.equal(recommendation.secondaryProgramId, 'tpl_2_day_minimal_full_body_v1');
    },
  },
  {
    name: 'first-run custom split names carry focus areas when selected',
    run() {
      const name = buildFirstRunCustomProgramName({
        goal: 'muscle',
        level: 'beginner',
        daysPerWeek: 4,
        equipment: 'gym',
        secondaryOutcomes: ['consistency'],
        focusAreas: ['arms', 'core'],
        guidanceMode: 'self_directed',
        scheduleMode: 'app_managed',
        weeklyMinutes: null,
        availableDays: [],
        unitPreference: 'kg',
      });

      assert.match(name, /4-Day Muscle/i);
      assert.match(name, /Arms & Core/i);
    },
  },
  {
    name: 'self-managed schedule picks evenly spaced projected days from the selected week',
    run() {
      const projectedDays = resolveProjectedTrainingDays(
        {
          scheduleMode: 'self_managed',
          availableDays: ['mon', 'tue', 'thu', 'sat'],
        },
        3,
      );

      assert.deepEqual(projectedDays, ['mon', 'thu', 'sat']);
    },
  },
  {
    name: 'schedule fit note warns when the weekly budget is tighter than the default split',
    run() {
      const note = buildScheduleFitNote(
        {
          scheduleMode: 'self_managed',
          weeklyMinutes: 140,
          availableDays: ['mon', 'wed', 'fri', 'sat'],
        },
        4,
        55,
      );

      assert.match(note, /tight week/i);
    },
  },
  {
    name: 'recommendation reasons explain goal, schedule, and focus succinctly',
    run() {
      const reasons = buildFirstRunRecommendationReasons(
        {
          goal: 'muscle',
          level: 'intermediate',
          daysPerWeek: 4,
          equipment: 'gym',
          secondaryOutcomes: ['strength'],
          focusAreas: ['arms'],
          guidanceMode: 'guided_editable',
          scheduleMode: 'self_managed',
          weeklyMinutes: 220,
          availableDays: ['mon', 'tue', 'thu', 'sat'],
          unitPreference: 'kg',
        },
        {
          projectedDaysPerWeek: 4,
          estimatedSessionDuration: 55,
          mismatchNote: null,
        },
      );

      assert.equal(reasons.length >= 3, true);
      assert.match(reasons[0], /muscle/i);
      assert.match(reasons[1], /220 minutes|220/i);
      assert.match(reasons[2], /Arms|focus/i);
    },
  },
  {
    name: 'user-ready acceptance matrix covers the supported onboarding paths',
    run() {
      const scenarios = [
        {
          selection: buildHighPrioritySelection({
            goal: 'strength',
            level: 'beginner',
            daysPerWeek: 2,
            equipment: 'gym',
          }),
          expectedPrograms: ['tpl_2_day_beginner_strength_v1'],
          expectedReason: /2 days for strength/i,
          expectedExplanation: /Heavy compounds/i,
        },
        {
          selection: buildHighPrioritySelection({
            goal: 'strength',
            level: 'intermediate',
            daysPerWeek: 3,
            equipment: 'gym',
          }),
          expectedPrograms: ['tpl_3_day_strength_base_v1'],
          expectedReason: /3 days for strength/i,
          expectedExplanation: /heavy compounds/i,
        },
        {
          selection: buildHighPrioritySelection({
            goal: 'strength',
            level: 'intermediate',
            daysPerWeek: 4,
            equipment: 'gym',
            secondaryOutcomes: ['muscle'],
          }),
          expectedPrograms: ['tpl_4_day_powerbuilding_v1', 'tpl_4_day_strength_size_v1'],
          expectedReason: /4 days for strength/i,
          expectedExplanation: /heavy compounds.*volume|volume.*heavy compounds/i,
        },
        {
          selection: buildHighPrioritySelection({
            goal: 'strength',
            level: 'intermediate',
            daysPerWeek: 5,
            equipment: 'gym',
          }),
          expectedPrograms: ['tpl_4_day_powerbuilding_v1'],
          expectedReason: /closest match.*4 days/i,
          expectedExplanation: /closest match.*4 days/i,
        },
        {
          selection: buildHighPrioritySelection({
            goal: 'muscle',
            level: 'intermediate',
            daysPerWeek: 5,
            equipment: 'gym',
            currentWeightKg: 80,
            targetWeightKg: 90,
          }),
          expectedPrograms: ['tpl_5_day_hybrid_v1'],
          expectedReason: /5 days for muscle gain/i,
          expectedExplanation: /gain target/i,
        },
        {
          selection: buildHighPrioritySelection({
            goal: 'general',
            level: 'beginner',
            daysPerWeek: 3,
            equipment: 'gym',
            currentWeightKg: 100,
            targetWeightKg: 85,
          }),
          expectedPrograms: ['tpl_3_day_full_body_v1'],
          expectedReason: /fat-loss support/i,
          expectedExplanation: /fat-loss target/i,
        },
        {
          selection: buildHighPrioritySelection({
            goal: 'muscle',
            level: 'beginner',
            daysPerWeek: 4,
            equipment: 'home',
          }),
          expectedPrograms: ['tpl_2_day_minimal_full_body_v1'],
          expectedReason: /home setup/i,
          expectedExplanation: /closest low-equipment starting point/i,
        },
        {
          selection: buildHighPrioritySelection({
            goal: 'run_mobility',
            level: 'beginner',
            daysPerWeek: 4,
            equipment: 'minimal',
            secondaryOutcomes: ['conditioning', 'mobility'],
            guidanceMode: 'done_for_me',
          }),
          expectedPrograms: ['tpl_3_day_run_mobility_v1'],
          expectedReason: /run \+ mobility/i,
          expectedExplanation: /optional 4th session/i,
        },
      ];

      scenarios.forEach(({ selection, expectedPrograms, expectedReason, expectedExplanation }) => {
        const { recommendation, reasons } = evaluateHighPriorityScenario(selection);

        assert.ok(expectedPrograms.includes(recommendation.featuredProgramId), recommendation.featuredProgramId);
        assert.match(reasons.join(' '), expectedReason);
        assert.match(reasons.join(' '), expectedExplanation);
      });
    },
  },
  {
    name: 'final user-ready regression suite covers high-risk onboarding combinations',
    run() {
      const scenarios = [
        buildHighPrioritySelection({ goal: 'strength', level: 'beginner', daysPerWeek: 2, equipment: 'gym' }),
        buildHighPrioritySelection({ goal: 'strength', level: 'intermediate', daysPerWeek: 3, equipment: 'gym' }),
        buildHighPrioritySelection({
          goal: 'strength',
          level: 'intermediate',
          daysPerWeek: 4,
          equipment: 'gym',
          secondaryOutcomes: ['muscle'],
        }),
        buildHighPrioritySelection({ goal: 'strength', level: 'intermediate', daysPerWeek: 5, equipment: 'gym' }),
        buildHighPrioritySelection({ goal: 'muscle', level: 'beginner', daysPerWeek: 3, equipment: 'gym' }),
        buildHighPrioritySelection({ goal: 'muscle', level: 'intermediate', daysPerWeek: 4, equipment: 'gym' }),
        buildHighPrioritySelection({
          goal: 'muscle',
          level: 'intermediate',
          daysPerWeek: 5,
          equipment: 'gym',
          currentWeightKg: 80,
          targetWeightKg: 90,
        }),
        buildHighPrioritySelection({
          goal: 'general',
          level: 'beginner',
          daysPerWeek: 3,
          equipment: 'gym',
          currentWeightKg: 100,
          targetWeightKg: 85,
        }),
        buildHighPrioritySelection({ goal: 'muscle', level: 'beginner', daysPerWeek: 4, equipment: 'home' }),
        buildHighPrioritySelection({
          goal: 'run_mobility',
          level: 'beginner',
          daysPerWeek: 3,
          equipment: 'minimal',
          secondaryOutcomes: ['conditioning', 'mobility'],
          guidanceMode: 'done_for_me',
        }),
        buildHighPrioritySelection({
          goal: 'run_mobility',
          level: 'beginner',
          daysPerWeek: 4,
          equipment: 'minimal',
          secondaryOutcomes: ['conditioning', 'mobility'],
          guidanceMode: 'done_for_me',
        }),
        buildHighPrioritySelection({
          goal: 'run_mobility',
          level: 'beginner',
          daysPerWeek: 5,
          equipment: 'minimal',
          secondaryOutcomes: ['conditioning', 'mobility'],
          guidanceMode: 'done_for_me',
        }),
      ];

      scenarios.forEach((selection) => assertUserReadyRecommendation(selection));

      const beginnerFiveDay = assertUserReadyRecommendation(
        buildHighPrioritySelection({ goal: 'strength', level: 'beginner', daysPerWeek: 5, equipment: 'gym' }),
        { maxRecoveryDemand: 'moderate' },
      );
      assert.notEqual(beginnerFiveDay.definition.recoveryDemand, 'high');
    },
  },
  {
    name: 'high-priority scenario: full gym strength 3 days maps to strength base',
    run() {
      const selection = buildHighPrioritySelection({
        goal: 'strength',
        level: 'intermediate',
        daysPerWeek: 3,
        equipment: 'gym',
      });
      const { recommendation, reasons, projectedDays } = evaluateHighPriorityScenario(selection);

      assert.equal(recommendation.featuredProgramId, 'tpl_3_day_strength_base_v1');
      assert.equal(recommendation.secondaryProgramId, 'tpl_3_day_upper_lower_lite_v1');
      assert.deepEqual(projectedDays, ['mon', 'wed', 'fri']);
      assert.match(reasons.join(' '), /3 days for strength/i);
      assert.match(reasons.join(' '), /heavy compounds/i);
    },
  },
  {
    name: 'high-priority scenario: full gym strength 4 days maps to a powerbuilding strength plan',
    run() {
      const selection = buildHighPrioritySelection({
        goal: 'strength',
        level: 'intermediate',
        daysPerWeek: 4,
        equipment: 'gym',
        secondaryOutcomes: ['muscle'],
      });
      const { recommendation, reasons, projectedDays } = evaluateHighPriorityScenario(selection);

      assert.equal(recommendation.featuredProgramId, 'tpl_4_day_powerbuilding_v1');
      assert.equal(recommendation.secondaryProgramId, 'tpl_4_day_strength_size_v1');
      assert.deepEqual(projectedDays, ['mon', 'tue', 'thu', 'sat']);
      assert.match(reasons.join(' '), /4 days for strength/i);
      assert.match(reasons.join(' '), /heavy compounds.*volume|volume.*heavy compounds/i);
    },
  },
  {
    name: 'high-priority scenario: full gym strength 5 days falls back to a 4-day strength plan with target context',
    run() {
      const selection = buildHighPrioritySelection({
        goal: 'strength',
        level: 'intermediate',
        daysPerWeek: 5,
        equipment: 'gym',
        currentWeightKg: 100,
        targetWeightKg: 120,
      });
      const { recommendation, reasons, projectedDays, projectedDaysPerWeek } = evaluateHighPriorityScenario(selection);

      assert.equal(recommendation.featuredProgramId, 'tpl_4_day_powerbuilding_v1');
      assert.equal(recommendation.secondaryProgramId, 'tpl_5_day_hybrid_v1');
      assert.equal(projectedDaysPerWeek, 4);
      assert.deepEqual(projectedDays, ['mon', 'tue', 'thu', 'sat']);
      assert.match(recommendation.mismatchNote, /closest match.*4 days/i);
      assert.match(reasons.join(' '), /100 kg to 120 kg/i);
      assert.match(reasons.join(' '), /closest match.*4 days/i);
    },
  },
  {
    name: 'high-priority scenario: full gym muscle gain 5 days maps to hybrid with gain explanation',
    run() {
      const selection = buildHighPrioritySelection({
        goal: 'muscle',
        level: 'intermediate',
        daysPerWeek: 5,
        equipment: 'gym',
        currentWeightKg: 80,
        targetWeightKg: 90,
      });
      const { recommendation, reasons, projectedDays } = evaluateHighPriorityScenario(selection);

      assert.equal(recommendation.featuredProgramId, 'tpl_5_day_hybrid_v1');
      assert.equal(recommendation.secondaryProgramId, 'tpl_4_day_muscle_builder_v1');
      assert.deepEqual(projectedDays, ['mon', 'tue', 'thu', 'fri', 'sat']);
      assert.match(reasons.join(' '), /5 days for muscle gain/i);
      assert.match(reasons.join(' '), /80 kg to 90 kg gain target/i);
    },
  },
  {
    name: 'high-priority scenario: lose weight with target keeps a sustainable 3-day plan and explains the target',
    run() {
      const selection = buildHighPrioritySelection({
        goal: 'general',
        level: 'beginner',
        daysPerWeek: 3,
        equipment: 'gym',
        currentWeightKg: 100,
        targetWeightKg: 85,
      });
      const { recommendation, reasons, projectedDays } = evaluateHighPriorityScenario(selection);

      assert.equal(recommendation.featuredProgramId, 'tpl_3_day_full_body_v1');
      assert.equal(recommendation.secondaryProgramId, 'tpl_3_day_upper_lower_lite_v1');
      assert.deepEqual(projectedDays, ['mon', 'wed', 'fri']);
      assert.match(reasons.join(' '), /3 days for fat-loss support/i);
      assert.match(reasons.join(' '), /100 kg to 85 kg fat-loss target/i);
    },
  },
  {
    name: 'high-priority scenario: home workout muscle avoids full-gym plans and explains the tradeoff',
    run() {
      const selection = buildHighPrioritySelection({
        goal: 'muscle',
        level: 'beginner',
        daysPerWeek: 4,
        equipment: 'home',
      });
      const { recommendation, reasons, projectedDays, projectedDaysPerWeek } = evaluateHighPriorityScenario(selection);

      assert.equal(recommendation.featuredProgramId, 'tpl_2_day_minimal_full_body_v1');
      assert.equal(projectedDaysPerWeek, 2);
      assert.deepEqual(projectedDays, ['mon', 'thu']);
      assert.match(reasons.join(' '), /home setup/i);
      assert.match(reasons.join(' '), /closest low-equipment starting point/i);
      assert.equal(
        recommendation.scoredCandidates.every((candidate) => {
          const definition = getRecommendationProgramDefinition(candidate.programId);
          return definition?.equipmentTier === 'low_equipment';
        }),
        true,
      );
    },
  },
  {
    name: 'high-priority scenario: outdoor running endurance uses run mobility and calls out optional extra movement',
    run() {
      const selection = buildHighPrioritySelection({
        goal: 'run_mobility',
        level: 'beginner',
        daysPerWeek: 4,
        equipment: 'minimal',
        secondaryOutcomes: ['conditioning', 'mobility'],
        guidanceMode: 'done_for_me',
      });
      const { recommendation, reasons, projectedDays, projectedDaysPerWeek } = evaluateHighPriorityScenario(selection);

      assert.equal(recommendation.featuredProgramId, 'tpl_3_day_run_mobility_v1');
      assert.equal(recommendation.secondaryProgramId, 'tpl_2_day_yoga_recovery_v1');
      assert.equal(projectedDaysPerWeek, 3);
      assert.deepEqual(projectedDays, ['mon', 'wed', 'fri']);
      assert.match(reasons.join(' '), /3 days for run \+ mobility/i);
      assert.match(reasons.join(' '), /optional 4th session/i);
    },
  },
];
