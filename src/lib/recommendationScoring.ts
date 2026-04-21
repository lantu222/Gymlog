import { rankProgramIdsByTailoring, TailoringPreferencesInput } from './tailoringFit';
import { RECOMMENDATION_PROGRAMS, getRecommendationProgramDefinition } from './recommendationCatalog';
import type {
  RecommendationCandidate,
  RecommendationConfidence,
  RecommendationInput,
  RecommendationProgramDefinition,
  RecommendationResult,
  RecommendationScoreBreakdown,
} from '../types/recommendation';

function clampScore(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function scoreGoalAlignment(definition: RecommendationProgramDefinition, input: RecommendationInput) {
  let score = 0;

  if (definition.supportedGoals.includes(input.goal)) {
    score += 24;
  } else if (definition.backupGoals.includes(input.goal)) {
    score += 9;
  } else if (input.goal === 'general') {
    score += 6;
  } else {
    score += 2;
  }

  for (const outcome of input.secondaryOutcomes) {
    if (definition.secondaryOutcomeTags.includes(outcome)) {
      score += outcome === 'consistency' ? 2 : 3;
    }
  }

  if (input.goal === 'muscle' && definition.styleTags.includes('pump')) {
    score += 2;
  }

  if (input.goal === 'strength' && definition.styleTags.includes('heavy')) {
    score += 2;
  }

  if (input.goal === 'run_mobility' && definition.styleTags.includes('conditioning')) {
    score += 2;
  }

  return clampScore(score, 0, 30);
}

function scoreScheduleFit(definition: RecommendationProgramDefinition, input: RecommendationInput) {
  const dayDifference = Math.abs(definition.daysPerWeek - input.daysPerWeek);
  let score = dayDifference === 0 ? 13 : dayDifference === 1 ? 6 : dayDifference === 2 ? 1 : 0;

  const preferredMinutes = input.preferredSessionMinutes ?? definition.estimatedSessionMinutes;
  const durationDifference = Math.abs(definition.estimatedSessionMinutes - preferredMinutes);

  score += durationDifference <= 5 ? 8 : durationDifference <= 10 ? 6 : durationDifference <= 20 ? 4 : 2;

  if (input.wantsConsistency && definition.lowFriction) {
    score += 2;
  }

  return clampScore(score, 0, 20);
}

function scoreEquipmentFit(definition: RecommendationProgramDefinition, input: RecommendationInput) {
  if (input.equipment === 'gym') {
    return definition.equipmentTier === 'full_gym' ? 15 : 12;
  }

  return definition.equipmentTier === 'low_equipment' ? 15 : 0;
}

function scoreExperienceFit(definition: RecommendationProgramDefinition, input: RecommendationInput) {
  if (definition.supportedLevels.includes(input.level)) {
    return 10;
  }

  return input.level === 'beginner' ? 2 : 5;
}

function scorePreferenceFit(definition: RecommendationProgramDefinition, input: RecommendationInput) {
  let score = 0;

  if (input.secondaryOutcomes.includes('mobility') && definition.jointFriendly) {
    score += 4;
  }

  if (input.secondaryOutcomes.includes('conditioning') && definition.styleTags.includes('conditioning')) {
    score += 4;
  }

  if (input.secondaryOutcomes.includes('consistency') && definition.lowFriction) {
    score += 2;
  }

  if (input.goal === 'strength' && definition.recoveryDemand === 'high' && input.level === 'beginner') {
    score -= 2;
  }

  return clampScore(score, 0, 10);
}

function scoreFocusFit(definition: RecommendationProgramDefinition, input: RecommendationInput) {
  if (input.focusAreas.length === 0) {
    return 2;
  }

  const matches = input.focusAreas.filter((area) => definition.focusAreaTags.includes(area)).length;
  if (matches === 0) {
    return 0;
  }

  return clampScore(matches * 3, 0, 5);
}

function buildBreakdown(definition: RecommendationProgramDefinition, input: RecommendationInput): RecommendationScoreBreakdown {
  return {
    goalAlignment: scoreGoalAlignment(definition, input),
    scheduleFit: scoreScheduleFit(definition, input),
    equipmentFit: scoreEquipmentFit(definition, input),
    experienceFit: scoreExperienceFit(definition, input),
    preferenceFit: scorePreferenceFit(definition, input),
    focusFit: scoreFocusFit(definition, input),
  };
}

function sumBreakdown(breakdown: RecommendationScoreBreakdown) {
  return (
    breakdown.goalAlignment +
    breakdown.scheduleFit +
    breakdown.equipmentFit +
    breakdown.experienceFit +
    breakdown.preferenceFit +
    breakdown.focusFit
  );
}

function applyEquipmentFilter(input: RecommendationInput) {
  if (input.equipment === 'gym') {
    return RECOMMENDATION_PROGRAMS;
  }

  return RECOMMENDATION_PROGRAMS.filter((definition) => definition.equipmentTier === 'low_equipment');
}

function stableSortCandidates(candidates: RecommendationCandidate[]) {
  return [...candidates].sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    return left.programId.localeCompare(right.programId);
  });
}

function hasMeaningfulTailoringPreferences(preferences: TailoringPreferencesInput | null | undefined) {
  if (!preferences) {
    return false;
  }

  return (
    preferences.setupEquipment !== 'gym' ||
    preferences.setupFreeWeightsPreference !== 'neutral' ||
    preferences.setupBodyweightPreference !== 'neutral' ||
    preferences.setupMachinesPreference !== 'neutral' ||
    preferences.setupShoulderFriendlySwaps !== 'neutral' ||
    preferences.setupElbowFriendlySwaps !== 'neutral' ||
    preferences.setupKneeFriendlySwaps !== 'neutral'
  );
}

function applyTailoringOrdering(
  candidates: RecommendationCandidate[],
  tailoringPreferences?: TailoringPreferencesInput | null,
) {
  if (!hasMeaningfulTailoringPreferences(tailoringPreferences) || candidates.length < 2) {
    return candidates;
  }

  const topScore = candidates[0]?.score ?? 0;
  const rerankWindow = candidates.filter((candidate) => topScore - candidate.score <= 4);
  if (rerankWindow.length < 2) {
    return candidates;
  }

  const rerankedIds = rankProgramIdsByTailoring(
    rerankWindow.map((candidate) => candidate.programId),
    tailoringPreferences,
  );
  const rerankedMap = new Map(rerankedIds.map((programId, index) => [programId, index]));
  const rerankedTop = [...rerankWindow].sort((left, right) => {
    return (rerankedMap.get(left.programId) ?? Number.MAX_SAFE_INTEGER) - (rerankedMap.get(right.programId) ?? Number.MAX_SAFE_INTEGER);
  });
  const remaining = candidates.filter((candidate) => !rerankedMap.has(candidate.programId));

  return [...rerankedTop, ...remaining];
}

function resolveConfidence(candidates: RecommendationCandidate[]): RecommendationConfidence {
  if (candidates.length <= 1) {
    return 'high';
  }

  const [first, second] = candidates;
  const gap = first.score - second.score;
  if (first.score >= 74 && gap >= 8) {
    return 'high';
  }

  if (gap >= 4) {
    return 'medium';
  }

  return 'low';
}

function selectAlternativeCandidates(candidates: RecommendationCandidate[], input: RecommendationInput) {
  const [featuredCandidate, ...remainingCandidates] = candidates;
  if (!featuredCandidate) {
    return [];
  }

  const sameDayAlternatives = remainingCandidates.filter((candidate) => {
    const definition = getRecommendationProgramDefinition(candidate.programId);
    return definition?.daysPerWeek === input.daysPerWeek;
  });
  const orderedAlternatives = sameDayAlternatives.length > 0 ? [...sameDayAlternatives] : [...remainingCandidates];

  return orderedAlternatives.slice(0, 2);
}

export function recommendPrograms(
  input: RecommendationInput,
  tailoringPreferences?: TailoringPreferencesInput | null,
): RecommendationResult {
  const filteredPrograms = applyEquipmentFilter(input);
  const scoredCandidates = filteredPrograms.map((definition) => {
    const breakdown = buildBreakdown(definition, input);

    return {
      programId: definition.programId,
      familyId: definition.familyId,
      breakdown,
      score: sumBreakdown(breakdown),
    };
  });

  const rankedCandidates = applyTailoringOrdering(stableSortCandidates(scoredCandidates), tailoringPreferences);
  const featuredCandidate = rankedCandidates[0] ?? null;
  const alternativeCandidates = selectAlternativeCandidates(rankedCandidates, input);
  const alternativeProgramIds = alternativeCandidates.map((candidate) => candidate.programId);

  if (!featuredCandidate) {
    const fallback = getRecommendationProgramDefinition('tpl_2_day_minimal_full_body_v1');
    if (!fallback) {
      throw new Error('Recommendation fallback program is missing.');
    }

    return {
      featuredProgramId: fallback.programId,
      secondaryProgramId: null,
      alternativeProgramIds: [],
      confidence: 'low',
      primaryFamilyId: fallback.familyId,
      scoredCandidates: [],
    };
  }

  return {
    featuredProgramId: featuredCandidate.programId,
    secondaryProgramId: alternativeProgramIds[0] ?? null,
    alternativeProgramIds,
    confidence: resolveConfidence(rankedCandidates),
    primaryFamilyId: featuredCandidate.familyId,
    scoredCandidates: rankedCandidates,
  };
}
