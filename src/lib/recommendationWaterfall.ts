import { RECOMMENDATION_PROGRAMS } from './recommendationCatalog';
import type {
  RecommendationInput,
  RecommendationProgramDefinition,
  RecommendationWaterfallDecision,
} from '../types/recommendation';
import type { SetupFocusArea } from '../types/models';

/**
 * Onboarding Rules v2 (onboarding-recommendation-engine.xlsx, "Onboarding Rules v2"):
 * a first-match-wins waterfall that decides which program family the user lands in,
 * before scoring fine-tunes anything. Order matters: equipment > endurance intent >
 * experience > gender targeting > goal.
 */

const FIT_PROGRAM_ID = 'tpl_3_day_full_body_v1';
const HOME_STARTER_PROGRAM_ID = 'tpl_2_day_minimal_full_body_v1';
const RUN_PROGRAM_ID = 'tpl_3_day_run_mobility_v1';
const SHRED_PROGRAM_ID = 'tpl_shred_v1';
const HUGE_STARTER_PROGRAM_ID = 'tpl_huge_starter_v1';

const FOCUS_PROGRAM_BY_AREA: Partial<Record<SetupFocusArea, string>> = {
  chest: 'tpl_focus_chest_program_v1',
  back: 'tpl_focus_back_program_v1',
  arms: 'tpl_focus_arms_program_v1',
  legs: 'tpl_focus_legs_program_v1',
  quads: 'tpl_focus_legs_program_v1',
  hamstrings: 'tpl_focus_legs_program_v1',
  calves: 'tpl_focus_legs_program_v1',
  glutes: 'tpl_focus_glutes_program_v1',
};

/** Experience first: a beginner starts at the core tier (3 days) at most. */
function effectiveDays(input: RecommendationInput) {
  return input.level === 'beginner' ? Math.min(input.daysPerWeek, 3) : input.daysPerWeek;
}

function supportsGoal(definition: RecommendationProgramDefinition, input: RecommendationInput) {
  return definition.supportedGoals.includes(input.goal) || definition.backupGoals.includes(input.goal);
}

function pickClosestWithPenalty(
  pool: RecommendationProgramDefinition[],
  input: RecommendationInput,
  targetDays = effectiveDays(input),
): { definition: RecommendationProgramDefinition; penalty: number } | null {
  let best: RecommendationProgramDefinition | null = null;
  let bestPenalty = Number.POSITIVE_INFINITY;

  for (const definition of pool) {
    let penalty = Math.abs(definition.daysPerWeek - targetDays) * 10;
    if (!definition.supportedLevels.includes(input.level)) {
      penalty += 12;
    }
    if (input.level !== 'beginner' && definition.supportedLevels.includes('beginner')) {
      // Prefer level-targeted programs for experienced users when days tie.
      penalty += 1;
    }
    if (definition.targetGender !== 'unisex') {
      // Matching gender-targeted content wins day-count ties; mismatched loses hard.
      penalty += definition.targetGender === input.gender ? -1 : 30;
    }
    if (!definition.supportedGoals.includes(input.goal)) {
      // A wrong-goal program must never beat the right goal over a one-day difference.
      penalty += definition.backupGoals.includes(input.goal) ? 2 : 25;
    }
    if (
      input.equipment === 'gym'
      && definition.equipmentTier === 'low_equipment'
      && input.goal !== 'run_mobility'
      && definition.familyId !== 'full_body_minimal'
    ) {
      // Gym users get gym content unless the goal is inherently low-equipment.
      // The minimal full-body starter is exempt: it doubles as the universal 2-day base.
      penalty += 15;
    }
    if (penalty < bestPenalty) {
      best = definition;
      bestPenalty = penalty;
    }
  }

  return best ? { definition: best, penalty: bestPenalty } : null;
}

function pickClosest(
  pool: RecommendationProgramDefinition[],
  input: RecommendationInput,
  targetDays = effectiveDays(input),
): RecommendationProgramDefinition | null {
  return pickClosestWithPenalty(pool, input, targetDays)?.definition ?? null;
}

function byId(programId: string) {
  return RECOMMENDATION_PROGRAMS.find((definition) => definition.programId === programId) ?? null;
}

function decision(
  rule: RecommendationWaterfallDecision['rule'],
  primary: RecommendationProgramDefinition,
  alternative: RecommendationProgramDefinition | null,
  whyPrimary: string,
  whyAlternative: string | null,
): RecommendationWaterfallDecision {
  return {
    rule,
    primaryProgramId: primary.programId,
    alternativeProgramId: alternative && alternative.programId !== primary.programId ? alternative.programId : null,
    whyPrimary,
    whyAlternative: alternative && alternative.programId !== primary.programId ? whyAlternative : null,
  };
}

export function selectWaterfallDecision(input: RecommendationInput): RecommendationWaterfallDecision {
  const programs = RECOMMENDATION_PROGRAMS;

  // 1. Equipment overrides everything: never send home/minimal users to gym content.
  if (input.equipment !== 'gym') {
    const pool = programs.filter((definition) => definition.equipmentTier === 'low_equipment');
    const primary = pickClosest(pool, input);
    if (primary) {
      const remaining = pool.filter((definition) => definition.programId !== primary.programId);
      const wantsConditioning = input.goal === 'run_mobility' || input.secondaryOutcomes.includes('conditioning');
      const alternative =
        (wantsConditioning
          ? pickClosest(remaining.filter((definition) => definition.styleTags.includes('conditioning')), input)
          : null)
        ?? pickClosest(remaining, input);
      return decision(
        'home_equipment',
        primary,
        alternative,
        'Built for your equipment setup — nothing in it needs a gym.',
        'A different rhythm with the same low-equipment start.',
      );
    }
  }

  // 2. Endurance intent is explicit.
  if (input.goal === 'run_mobility') {
    const pool = programs.filter((definition) => supportsGoal(definition, input));
    const primary = pickClosest(pool, input) ?? byId(RUN_PROGRAM_ID);
    if (primary) {
      return decision(
        'run_mobility',
        primary,
        byId(FIT_PROGRAM_ID),
        'Running comes first, with mobility built in.',
        'Prefer lifting with your cardio on the side? Start balanced instead.',
      );
    }
  }

  // 3. Experience first: a beginner gets a beginner program regardless of ambition.
  if (input.level === 'beginner') {
    if (input.secondaryOutcomes.includes('mobility') && (input.goal === 'general' || input.goal === 'general_fitness')) {
      const mobilityPrimary = pickClosest(
        programs.filter(
          (definition) => definition.familyId === 'joint_friendly'
            && definition.supportedLevels.includes('beginner')
            && supportsGoal(definition, input),
        ),
        input,
      );
      if (mobilityPrimary) {
        return decision(
          'beginner_first',
          mobilityPrimary,
          pickClosest(programs.filter((definition) => definition.familyId === 'full_body_minimal'), input),
          'Low-stress movement first — recovery and mobility lead this block.',
          'A balanced full-body base if you want more lifting in the week.',
        );
      }
    }

    const beginnerPrograms = programs.filter((definition) => definition.supportedLevels.includes('beginner'));
    // Programs built for the goal beat backup-goal matches; fall back only when empty.
    const primary =
      pickClosest(beginnerPrograms.filter((definition) => definition.supportedGoals.includes(input.goal)), input)
      ?? pickClosest(beginnerPrograms.filter((definition) => supportsGoal(definition, input)), input);
    if (primary) {
      // A fat-loss weight target makes SHRED the natural second card.
      let alternative = input.profile.weightDirection === 'loss' && primary.programId !== SHRED_PROGRAM_ID
        ? byId(SHRED_PROGRAM_ID)
        : null;
      alternative = alternative ?? pickClosest(
        programs.filter(
          (definition) => definition.familyId === 'full_body_minimal' && definition.programId !== primary.programId,
        ),
        input,
      );
      if (!alternative && input.goal === 'muscle') {
        alternative = byId(HUGE_STARTER_PROGRAM_ID);
      }
      return decision(
        'beginner_first',
        primary,
        alternative,
        'Experience first: a start you can repeat beats an ambitious one.',
        'A balanced full-body alternative if you want the simplest possible week.',
      );
    }
  }

  // 4. Women-targeted primary for physique goals; the goal family stays one tap away.
  if (
    input.gender === 'female'
    && (input.goal === 'muscle' || input.goal === 'general' || input.goal === 'general_fitness' || input.goal === 'lean_athletic')
  ) {
    const pool = programs.filter((definition) => definition.targetGender === 'female');
    const primary = pickClosest(pool, input);
    if (primary) {
      const alternative = pickClosest(
        programs.filter(
          (definition) => definition.targetGender !== 'female' && definition.supportedGoals.includes(input.goal),
        ),
        input,
        primary.daysPerWeek,
      );
      return decision(
        'female_targeted',
        primary,
        alternative,
        'Shaped around glute, leg, and shoulder priorities most women ask for.',
        'Rather train the classic route? Same week, different emphasis.',
      );
    }
  }

  // 5. Fat-loss bias — only honest because SHRED actually contains conditioning.
  if (input.goal === 'lean_athletic') {
    const pool = programs.filter(
      (definition) => supportsGoal(definition, input) && definition.styleTags.includes('conditioning'),
    );
    const primary = pickClosest(pool, input) ?? byId(SHRED_PROGRAM_ID);
    if (primary) {
      return decision(
        'lean_athletic',
        primary,
        byId(FIT_PROGRAM_ID),
        'Keeps your strength while conditioning finishers drive the fat loss.',
        'Prefer a calmer week? A balanced base still supports fat loss.',
      );
    }
  }

  // 6. Specialisation for experienced users who picked a focus area (PTV Q4 pattern).
  // 5+ day users skip this: a 3-day specialisation block would waste their week,
  // and the big splits already carry the focus emphasis.
  if (input.goal === 'muscle' && input.level !== 'beginner' && input.daysPerWeek <= 4) {
    const focusProgramId = input.focusAreas.map((area) => FOCUS_PROGRAM_BY_AREA[area]).find(Boolean);
    const primary = focusProgramId ? byId(focusProgramId) : null;
    if (primary) {
      const alternative = pickClosest(
        programs.filter((definition) => definition.familyId === 'mass_hypertrophy' && definition.supportedGoals.includes('muscle')),
        input,
      );
      return decision(
        'muscle_focus',
        primary,
        alternative,
        'A specialisation block that trains your focus area twice a week.',
        'Rather grow everything evenly? Go with the full muscle split.',
      );
    }
  }

  // 7. Muscle: HUGE lane.
  if (input.goal === 'muscle') {
    const pool = programs.filter(
      (definition) => definition.familyId === 'mass_hypertrophy' && definition.supportedGoals.includes('muscle'),
    );
    const primary = pickClosest(pool, input);
    if (primary) {
      const alternative = pickClosest(
        programs.filter(
          (definition) => (definition.familyId === 'strength_base' || definition.familyId === 'powerbuilding')
            && definition.supportedGoals.includes('strength'),
        ),
        input,
        primary.daysPerWeek,
      );
      return decision(
        'muscle',
        primary,
        alternative,
        'Volume-driven muscle building matched to your week.',
        'Prefer heavier lifting? Same week, strength-first.',
      );
    }
  }

  // 8. Strength: STRONG lane. A muscle secondary outcome leans the pick toward
  // the pump-flavoured powerbuilding variant; otherwise the steadier one wins.
  if (input.goal === 'strength') {
    const pool = programs.filter(
      (definition) => (definition.familyId === 'strength_base' || definition.familyId === 'powerbuilding')
        && definition.supportedGoals.includes('strength'),
    );
    const wantsSize = input.secondaryOutcomes.includes('muscle');
    const primary =
      pickClosest(pool.filter((definition) => definition.styleTags.includes('pump') === wantsSize), input)
      ?? pickClosest(pool, input);
    if (primary) {
      // Alternative honours the *requested* days: a 5-day strength user whose
      // primary got capped at 4 still sees a true 5-day option in the other lane.
      const alternative = input.gender === 'female'
        ? pickClosest(programs.filter((definition) => definition.targetGender === 'female'), input, input.daysPerWeek)
        : pickClosest(
            programs.filter((definition) => definition.familyId === 'mass_hypertrophy' && definition.supportedGoals.includes('muscle')),
            input,
            input.daysPerWeek,
          );
      return decision(
        'strength',
        primary,
        alternative,
        'Heavy compounds first — the numbers on the bar lead the plan.',
        'Want more size with your strength? This one leans that way.',
      );
    }
  }

  // 9. Balanced default for general fitness. A mobility outcome flips the pick
  // to the joint-friendly lane; otherwise prefer balanced families but let any
  // goal-supporting program win when it fits the requested days much better.
  if (input.goal === 'general' || input.goal === 'general_fitness') {
    if (input.secondaryOutcomes.includes('mobility')) {
      const primary = pickClosest(
        programs.filter((definition) => definition.familyId === 'joint_friendly' && supportsGoal(definition, input)),
        input,
      );
      if (primary) {
        return decision(
          'general',
          primary,
          pickClosest(programs.filter((definition) => definition.familyId === 'full_body_minimal'), input),
          'Low-stress movement first — recovery and mobility lead this block.',
          'A balanced full-body base if you want more lifting in the week.',
        );
      }
    }

    const pool = programs.filter((definition) => supportsGoal(definition, input));
    const familyBias = (definition: RecommendationProgramDefinition) =>
      definition.familyId === 'full_body_minimal' ? 0 : definition.familyId === 'athletic_recomp' ? 1 : 3;
    let primary: RecommendationProgramDefinition | null = null;
    let bestBiasedPenalty = Number.POSITIVE_INFINITY;
    for (const bias of [0, 1, 3]) {
      const picked = pickClosestWithPenalty(pool.filter((definition) => familyBias(definition) === bias), input);
      if (picked && picked.penalty + bias < bestBiasedPenalty) {
        primary = picked.definition;
        bestBiasedPenalty = picked.penalty + bias;
      }
    }
    if (primary) {
      return decision(
        'general',
        primary,
        byId(SHRED_PROGRAM_ID),
        'A balanced week that covers strength, condition, and energy.',
        'Want fat loss to lead? Add conditioning finishers to the mix.',
      );
    }
  }

  // 10. Safety net.
  const fallback = byId(FIT_PROGRAM_ID);
  if (!fallback) {
    throw new Error('Waterfall fallback program is missing from the recommendation catalog.');
  }
  return decision(
    'fallback',
    fallback,
    byId(HOME_STARTER_PROGRAM_ID),
    'A safe, balanced starting point.',
    'The lowest-friction alternative if the week gets busy.',
  );
}
